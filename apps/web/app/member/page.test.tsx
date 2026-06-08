// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MemberPage from "./page";

const authMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));
const routerMocks = vi.hoisted(() => ({
  replace: vi.fn(),
}));

vi.mock("../../lib/auth-provider", () => ({
  useAuth: authMocks.useAuth,
  UnauthenticatedError: class extends Error {},
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

describe("MemberPage", () => {
  const authedFetch = vi.fn();

  beforeEach(() => {
    authMocks.useAuth.mockReturnValue({
      authedFetch,
      loading: false,
      session: { user: { id: "member-1" } },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the member home for an active membership", async () => {
    authedFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      id: "membership-1",
      userId: "member-1",
      status: "active",
      tier: "member",
      issuedAt: "2026-06-08T00:00:00.000Z",
      revokedAt: null,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    render(<MemberPage />);

    expect(await screen.findByText("입장이 확인되었습니다")).toBeTruthy();
    expect(screen.getByText("활성")).toBeTruthy();
    expect(screen.getByText("membership-1")).toBeTruthy();
    expect(authedFetch).toHaveBeenCalledWith(
      "/api/membership/me",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("returns a non-member to the gate", async () => {
    authedFetch.mockResolvedValueOnce(new Response("null", {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    render(<MemberPage />);

    expect(await screen.findByText("아직 멤버가 아닙니다")).toBeTruthy();
    await waitFor(() =>
      expect(routerMocks.replace).toHaveBeenCalledWith("/gate")
    );
  });
});
