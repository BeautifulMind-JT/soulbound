import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  rpc: vi.fn(),
  result: vi.fn(),
  sign: vi.fn(),
}));
vi.mock("@soulbound/adapters", () => ({
  createServiceRoleSupabaseClient: () => ({ rpc: mocks.rpc }),
}));
vi.mock("../../../../_lib/env", () => ({
  readWebEnv: () => ({ supabaseUrl: "http://localhost", supabaseServiceRoleKey: "test" }),
}));
vi.mock("../../../../_lib/storage", () => ({
  serviceRoleStorageAdapter: () => ({ getSignedUrl: mocks.sign }),
}));
vi.mock("../../../_lib/vote-context", () => ({
  requireActiveVoteContext: mocks.authorize,
  voteErrorResponse: () => null,
}));

import { GET } from "./route";

const now = new Date("2026-09-11T02:00:00Z");
const allowed = { asset_id: "clip-1", window_ends_at: "2026-09-11T02:01:00Z" };
const request = () => new Request("http://localhost/api/vote/applications/vote-1/persona-clip-url");
const context = () => ({ params: Promise.resolve({ voteId: "vote-1" }) });

describe("vote clip authorization", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.resetAllMocks();
    mocks.authorize.mockResolvedValue({ userId: "member-1" });
    mocks.rpc.mockReturnValue({ maybeSingle: mocks.result });
    mocks.result.mockResolvedValue({ data: allowed, error: null });
    mocks.sign.mockResolvedValue("https://storage.test/signed-clip");
  });
  afterEach(() => vi.useRealTimers());

  it("returns only the URL after authorization and a record-free DB recheck", async () => {
    const response = await GET(request(), context());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://storage.test/signed-clip" });
    expect(mocks.rpc.mock.calls).toEqual([
      ["authorize_admission_vote_clip", { p_vote_id: "vote-1", p_voter_id: "member-1", p_record_access: true }],
      ["authorize_admission_vote_clip", { p_vote_id: "vote-1", p_voter_id: "member-1", p_record_access: false }],
    ]);
    expect(mocks.sign).toHaveBeenCalledTimes(1);
    expect(mocks.sign).toHaveBeenCalledWith("clip-1");
  });

  it("does not query or sign when request authentication fails", async () => {
    mocks.authorize.mockResolvedValue({ response: new Response(null, { status: 401 }) });
    expect((await GET(request(), context())).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.sign).not.toHaveBeenCalled();
  });

  it("does not sign when the DB denies access", async () => {
    mocks.result.mockResolvedValueOnce({ data: null, error: null });
    expect((await GET(request(), context())).status).toBe(404);
    expect(mocks.sign).not.toHaveBeenCalled();
  });

  it.each(["2026-09-11T01:59:59Z", now.toISOString(), "invalid"])(
    "does not sign an expired or invalid authorization window: %s",
    async (window_ends_at) => {
      mocks.result.mockResolvedValueOnce({ data: { ...allowed, window_ends_at }, error: null });
      expect((await GET(request(), context())).status).toBe(404);
      expect(mocks.sign).not.toHaveBeenCalled();
    },
  );

  it("discards a URL if the deadline is reached during signing", async () => {
    mocks.sign.mockImplementation(async () => {
      vi.setSystemTime(new Date(allowed.window_ends_at));
      return "private-url";
    });
    const response = await GET(request(), context());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: "NOT_FOUND" } });
  });

  it("discards a URL if DB authorization disappears during signing", async () => {
    // The DB regression suite covers closed/terminal/revoked conditions.
    mocks.result.mockResolvedValueOnce({ data: allowed, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    const response = await GET(request(), context());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: "NOT_FOUND" } });
    expect(mocks.sign).toHaveBeenCalledTimes(1);
  });

  it("discards a URL when the clip changed during signing", async () => {
    mocks.result.mockResolvedValueOnce({ data: allowed, error: null })
      .mockResolvedValueOnce({ data: { ...allowed, asset_id: "clip-2" }, error: null });
    expect((await GET(request(), context())).status).toBe(404);
  });

  it("discards a URL when the window closes during the DB recheck", async () => {
    mocks.result.mockResolvedValueOnce({ data: allowed, error: null })
      .mockImplementationOnce(async () => {
        vi.setSystemTime(new Date(allowed.window_ends_at));
        return { data: allowed, error: null };
      });
    expect((await GET(request(), context())).status).toBe(404);
  });

  it.each([1, 2])("fails closed on DB query %i errors", async (queryNumber) => {
    if (queryNumber === 2) mocks.result.mockResolvedValueOnce({ data: allowed, error: null });
    mocks.result.mockResolvedValueOnce({ data: null, error: new Error("private-db-error") });
    const response = await GET(request(), context());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: { code: "DEPENDENCY_FAILURE", message: "dependency failure" } });
    expect(mocks.sign).toHaveBeenCalledTimes(queryNumber - 1);
  });

  it("does not return a URL when storage signing fails", async () => {
    mocks.sign.mockRejectedValue(new Error("private-storage-error"));
    expect((await GET(request(), context())).status).toBe(502);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
});
