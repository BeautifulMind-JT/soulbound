// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MemberDetailPage from "./page";

const authMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));
const routerMocks = vi.hoisted(() => ({
  replace: vi.fn(),
}));
const navigationMocks = vi.hoisted(() => ({
  handle: "other_member",
}));

vi.mock("../../../lib/auth-provider", () => ({
  useAuth: authMocks.useAuth,
  UnauthenticatedError: class extends Error {},
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ handle: navigationMocks.handle }),
  useRouter: () => routerMocks,
}));

describe("MemberDetailPage", () => {
  const authedFetch = vi.fn();

  beforeEach(() => {
    authedFetch.mockReset();
    routerMocks.replace.mockClear();
    navigationMocks.handle = "other_member";
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

  it("renders persona-only member detail", async () => {
    authedFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      handle: "other_member",
      displayName: "Other Member",
      bio: "Warm public intro.",
      isMe: false,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    render(<MemberDetailPage />);

    expect(await screen.findByText("Other Member")).toBeTruthy();
    expect(screen.getByText("@other_member · Warm public intro.")).toBeTruthy();
    expect(screen.queryByText("role")).toBeNull();
    expect(authedFetch).toHaveBeenCalledWith(
      "/api/members/other_member",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("shows the same empty state for missing or non-public members", async () => {
    authedFetch.mockResolvedValueOnce(new Response("{}", {
      status: 404,
      headers: { "content-type": "application/json" },
    }));

    render(<MemberDetailPage />);

    expect(await screen.findByText("멤버를 찾을 수 없습니다.")).toBeTruthy();
  });

  it("returns unauthenticated users to login", async () => {
    authMocks.useAuth.mockReturnValue({
      authedFetch,
      loading: false,
      session: null,
    });

    render(<MemberDetailPage />);

    await waitFor(() =>
      expect(routerMocks.replace).toHaveBeenCalledWith("/login")
    );
    expect(authedFetch).not.toHaveBeenCalled();
  });
});
