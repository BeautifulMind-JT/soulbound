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
    })).mockResolvedValueOnce(new Response(JSON.stringify({
      handle: "quiet_member",
      displayName: "Quiet Member",
      bio: "I prefer signal over spectacle.",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    render(<MemberPage />);

    expect(await screen.findByText("Quiet Member")).toBeTruthy();
    expect(screen.getByText("@quiet_member · I prefer signal over spectacle."))
      .toBeTruthy();
    expect(screen.getByText("New Members")).toBeTruthy();
    expect(screen.getByText("Active Members")).toBeTruthy();
    expect(screen.getByText("All Members")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "더보기" }));
    expect(screen.getAllByText("로그아웃").length).toBeGreaterThanOrEqual(1);
    [
      "입장 현황",
      "내 멤버십",
      "내 프로필 (페르소나)",
      "대화 / 다이렉트 메시지 (E2EE)",
      "알림",
      "멤버 디렉터리",
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
    expect(authedFetch).toHaveBeenCalledWith(
      "/api/profile/me",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("edits the active member persona", async () => {
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
    })).mockResolvedValueOnce(new Response(JSON.stringify({
      handle: null,
      displayName: null,
      bio: null,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })).mockResolvedValueOnce(new Response(JSON.stringify({
      handle: "new_member",
      displayName: "New Member",
      bio: "Self-authored intro.",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    render(<MemberPage />);

    expect(await screen.findByText("익명 멤버")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "편집" }));
    fireEvent.change(screen.getByLabelText("핸들"), {
      target: { value: "new_member" },
    });
    fireEvent.change(screen.getByLabelText("표시 이름"), {
      target: { value: "New Member" },
    });
    fireEvent.change(screen.getByLabelText("소개"), {
      target: { value: "Self-authored intro." },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() =>
      expect(authedFetch).toHaveBeenCalledWith(
        "/api/profile/me",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            handle: "new_member",
            displayName: "New Member",
            bio: "Self-authored intro.",
          }),
        }),
      )
    );
    expect(await screen.findByText("New Member")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
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
