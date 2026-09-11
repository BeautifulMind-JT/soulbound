import { createServiceRoleSupabaseClient } from "@soulbound/adapters";

import { readWebEnv } from "../../../../_lib/env";
import {
  dependencyFailure,
  jsonResponse,
  notFound,
} from "../../../../_lib/http";
import { serviceRoleStorageAdapter } from "../../../../_lib/storage";
import {
  requireActiveVoteContext,
  voteErrorResponse,
} from "../../../_lib/vote-context";

interface RouteContext {
  readonly params: Promise<{
    readonly voteId: string;
  }>;
}

interface ClipAccessRow {
  readonly asset_id: string;
  readonly window_ends_at: string;
}

function isUnexpired(row: ClipAccessRow | null): row is ClipAccessRow {
  return Boolean(row?.asset_id) && Date.parse(row?.window_ends_at ?? "") > Date.now();
}

function serviceRoleClient() {
  const env = readWebEnv();
  return createServiceRoleSupabaseClient({
    url: env.supabaseUrl,
    serviceRoleKey: env.supabaseServiceRoleKey,
  });
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const authorized = await requireActiveVoteContext(request);
    if ("response" in authorized) {
      return authorized.response;
    }

    const { voteId } = await context.params;
    const client = serviceRoleClient();
    const { data, error } = await client
      .rpc("authorize_admission_vote_clip", {
        p_vote_id: voteId,
        p_voter_id: authorized.userId,
        p_record_access: true,
      })
      .maybeSingle();
    if (error) {
      throw error;
    }

    const row = data as unknown as ClipAccessRow | null;
    if (!isUnexpired(row)) {
      return notFound();
    }

    const url = await serviceRoleStorageAdapter().getSignedUrl(
      row.asset_id,
    );
    if (!isUnexpired(row)) {
      return notFound();
    }

    // Signing is external to the DB transaction: discard the URL if the vote,
    // application, member or clip changed while storage was signing it.
    const { data: currentData, error: currentError } = await client
      .rpc("authorize_admission_vote_clip", {
        p_vote_id: voteId,
        p_voter_id: authorized.userId,
        p_record_access: false,
      })
      .maybeSingle();
    if (currentError) {
      throw currentError;
    }
    const current = currentData as unknown as ClipAccessRow | null;
    if (!isUnexpired(current) || current.asset_id !== row.asset_id) {
      return notFound();
    }
    return jsonResponse({ url });
  } catch (error) {
    return voteErrorResponse(error) ?? dependencyFailure(error);
  }
}
