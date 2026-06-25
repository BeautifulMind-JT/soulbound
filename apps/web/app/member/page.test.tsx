// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MemberPage from "./page";

const authMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));
const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("../../lib/auth-provider", () => ({
  useAuth: authMocks.useAuth,
  UnauthenticatedError: class extends Error {},
}));

vi.mock("../../components/pwa/install-prompt", () => ({
  InstallPrompt: () => <span>설치</span>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

describe("MemberPage", () => {
  const authedFetch = vi.fn();
  const signOut = vi.fn(async () => undefined);

  beforeEach(() => {
    authedFetch.mockReset();
    routerMocks.push.mockClear();
    routerMocks.replace.mockClear();
    signOut.mockClear();
    authMocks.useAuth.mockReturnValue({
      authedFetch,
      loading: false,
      session: { user: { id: "member-1" } },
      signOut,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the member-number directory for an active membership", async () => {
    authedFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      id: "membership-1",
      userId: "member-1",
      status: "active",
      tier: "basic",
      issuedAt: "2026-06-08T00:00:00.000Z",
      revokedAt: null,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })).mockResolvedValueOnce(new Response(JSON.stringify({
      myMemberNumber: 7,
      myLabel: "soulbound-member-7",
      items: [
        {
          memberNumber: 7,
          label: "soulbound-member-7",
          createdAt: "2026-06-08T00:00:00.000Z",
          isMe: true,
        },
        {
          memberNumber: 8,
          label: "soulbound-member-8",
          createdAt: "2026-06-09T00:00:00.000Z",
          isMe: false,
        },
      ],
      nextCursor: 8,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    render(<MemberPage />);

    expect(await screen.findAllByText("soulbound-member-7"))
      .toHaveLength(2);
    expect(screen.getByText("soulbound-member-8")).toBeTruthy();
    expect(screen.getByText("50+")).toBeTruthy();
    expect(screen.queryByText("My Persona")).toBeNull();
    expect(screen.queryByText("내 프로필 (페르소나)")).toBeNull();
    expect(screen.queryByText(/@/)).toBeNull();
    expect(screen.queryByText("username")).toBeNull();
    expect(screen.queryByText("이메일")).toBeNull();
    expect(screen.getByRole("button", { name: "더 보기" })).toBeTruthy();

    authedFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      myMemberNumber: 7,
      myLabel: "soulbound-member-7",
      items: [
        {
          memberNumber: 9,
          label: "soulbound-member-9",
          createdAt: "2026-06-10T00:00:00.000Z",
          isMe: false,
        },
      ],
      nextCursor: null,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    fireEvent.click(screen.getByRole("button", { name: "더 보기" }));
    expect(await screen.findByText("soulbound-member-9")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "더보기" }));
    [
      "입장 현황",
      "내 멤버십",
      "대화 / 다이렉트 메시지 (E2EE)",
      "알림",
      "소울바운드 신원 / 온체인 크리덴셜",
      "SOUL 잔액 · 스테이킹 · 원장",
      "지갑 연결",
      "신고 · 모더레이션",
      "Support / Challenge (stake review)",
      "심사 권한",
      "프라이버시 / 데이터 보관 정책",
      "E2EE 보안 설명",
      "설정 (계정/화면)",
      "앱 설치",
      "앱 정보 / 버전",
    ].forEach((label) => expect(screen.getByText(label)).toBeTruthy());
    expect(screen.getByText("자격 획득 필요")).toBeTruthy();
    expect(authedFetch).toHaveBeenCalledWith(
      "/api/membership/me",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(authedFetch).toHaveBeenCalledWith("/api/members?limit=50");
    expect(authedFetch).toHaveBeenCalledWith(
      "/api/members?limit=50&cursor=8",
    );
  });

  it("returns a non-member to the gate", async () => {
    authedFetch.mockResolvedValueOnce(new Response("null", {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    render(<MemberPage />);

    await waitFor(() =>
      expect(routerMocks.replace).toHaveBeenCalledWith("/gate")
    );
  });
});
