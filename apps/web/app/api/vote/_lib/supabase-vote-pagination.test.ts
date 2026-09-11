import { describe, expect, it, vi } from "vitest";
import type { SupabaseAdapterClient } from "@soulbound/adapters";
import { SupabaseVoteRepository } from "./supabase-vote-repository";

describe("vote list maximum-page cursor", () => {
  it("returns the 51st vote on a second page without duplicates", async () => {
    const rows = Array.from({ length: 51 }, (_, i) => ({
      id: `00000000-0000-0000-0000-${String(100 - i).padStart(12, "0")}`,
      candidate_token: `candidate-${i}`,
      applicant_statement: "statement",
      has_clip: false,
      window_ends_at: "2026-09-12T00:00:00Z",
      opened_at: "2026-09-11T00:00:00Z",
      has_voted: false,
    }));
    const rpc = vi.fn().mockResolvedValueOnce({ data: rows, error: null })
      .mockResolvedValueOnce({ data: [rows[50]], error: null });
    const repo = new SupabaseVoteRepository({ rpc } as unknown as SupabaseAdapterClient);
    const first = await repo.listOpenVotes({ limit: 50, cursor: null });
    expect(first.items).toHaveLength(50);
    expect(first.nextCursor).not.toBeNull();
    const second = await repo.listOpenVotes({ limit: 50, cursor: first.nextCursor });
    expect(second.items.map((item) => item.id)).toEqual([rows[50]!.id]);
    expect(second.nextCursor).toBeNull();
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(51);
    expect(rpc).toHaveBeenLastCalledWith("list_open_admission_votes", {
      p_limit: 51, p_cursor_opened_at: rows[49]!.opened_at, p_cursor_id: rows[49]!.id,
    });
  });
});
