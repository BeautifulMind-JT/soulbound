import { describe, expect, it, vi } from "vitest";
import { SupabaseMemberDirectoryRepository } from "./supabase-member-directory-repository";
import type { SupabaseAdapterClient } from "./clients";

describe("member directory RPC boundary", () => {
  it("paginates through the safe RPC using a lookahead row", async () => {
    const rows = Array.from({ length: 51 }, (_, i) => ({ member_number: i + 1, created_at: "2026-09-11T00:00:00Z" }));
    const select = vi.fn().mockResolvedValueOnce({ data: rows, error: null })
      .mockResolvedValueOnce({ data: [rows[50]], error: null });
    const rpc = vi.fn().mockReturnValue({ select });
    const repo = new SupabaseMemberDirectoryRepository({ rpc } as unknown as SupabaseAdapterClient);
    const first = await repo.listActiveMembers({ limit: 50, cursor: null });
    expect(first.items).toHaveLength(50);
    expect(first.nextCursor).toBe(50);
    expect(first.items[0]).toEqual({ memberNumber: 1, label: "soulbound-member-1", createdAt: rows[0]!.created_at });
    const last = await repo.listActiveMembers({ limit: 50, cursor: first.nextCursor });
    expect(last.items.map((item) => item.memberNumber)).toEqual([51]);
    expect(last.nextCursor).toBeNull();
    expect(rpc.mock.calls).toEqual([
      ["list_active_members", { p_limit: 51, p_cursor: null }],
      ["list_active_members", { p_limit: 51, p_cursor: 50 }],
    ]);
    expect(select).toHaveBeenCalledWith("member_number,created_at");
  });
});
