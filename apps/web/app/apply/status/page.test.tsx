// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ApplicationStatusPage from "./page";

const authMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));
const routerMocks = vi.hoisted(() => ({
  replace: vi.fn(),
}));

vi.mock("../../../lib/auth-provider", () => ({
  useAuth: authMocks.useAuth,
  UnauthenticatedError: class extends Error {},
}));

vi.mock("../../../lib/application-state", () => ({
  readRememberedApplicationId: vi.fn(() => null),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function application(status: string, applicantNotice: string | null = null) {
  return {
    id: "application-1",
    applicantId: "applicant-1",
    status,
    policyVersion: "phase1-v1",
    reasonCode: "needs_identity_clarification",
    applicantNotice,
    reviewSummary: "검토자만 보는 내부 메모입니다.",
    createdAt: "2026-06-08T00:00:00.000Z",
    updatedAt: "2026-06-08T00:00:00.000Z",
  };
}

describe("ApplicationStatusPage", () => {
  const authedFetch = vi.fn();

  beforeEach(() => {
    authMocks.useAuth.mockReturnValue({
      authedFetch,
      loading: false,
      session: { user: { id: "applicant-1" } },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows applicant notice without exposing review summary", async () => {
    authedFetch.mockResolvedValueOnce(jsonResponse(
      application("needs_more_info", "신청자에게 보이는 안내입니다."),
    ));

    render(<ApplicationStatusPage />);

    expect(await screen.findByText("신청자에게 보이는 안내입니다."))
      .toBeTruthy();
    expect(screen.getByText("검토자 안내를 확인하고 요청된 정보를 준비해 주세요."))
      .toBeTruthy();
    expect(screen.queryByText("검토자만 보는 내부 메모입니다.")).toBeNull();
    expect(screen.queryByText("검토자 내부 메모")).toBeNull();
    expect(screen.queryByText("사유")).toBeNull();
    expect(screen.queryByText("신원 확인 필요")).toBeNull();
  });

  it("shows the approved next action without loading membership", async () => {
    authedFetch.mockResolvedValueOnce(jsonResponse(application("approved")));

    render(<ApplicationStatusPage />);

    expect(await screen.findByText("입장이 승인되었습니다.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "입장 절차 보기" })
      .getAttribute("href")).toBe("/gate");
    expect(authedFetch).toHaveBeenCalledOnce();
  });

  it("waits for reviewer guidance when more info is requested without notice", async () => {
    authedFetch.mockResolvedValueOnce(jsonResponse(application("needs_more_info")));

    render(<ApplicationStatusPage />);

    expect(await screen.findByText(
      "추가 정보가 필요합니다. 검토자의 안내를 기다려 주세요.",
    )).toBeTruthy();
    expect(screen.queryByText("검토자 안내를 확인하고 요청된 정보를 준비해 주세요."))
      .toBeNull();
  });

  it.each([
    ["rejected", "이번 신청은 거부되었습니다."],
    ["expired", "이번 신청은 만료되었습니다."],
    ["withdrawn", "이번 신청은 철회되었습니다."],
  ])("shows the reapply action for %s", async (status, message) => {
    authedFetch.mockResolvedValueOnce(jsonResponse(application(status)));

    render(<ApplicationStatusPage />);

    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.getByRole("link", { name: "새로 신청하기" })
      .getAttribute("href")).toBe("/apply");
  });

  it("keeps in-vote hidden as review in progress", async () => {
    authedFetch.mockResolvedValueOnce(jsonResponse(application("in_vote")));

    render(<ApplicationStatusPage />);

    expect(await screen.findByText("검토가 끝나면 이 화면에서 결과를 안내합니다."))
      .toBeTruthy();
    expect(screen.getByText("검토 중")).toBeTruthy();
    expect(screen.queryByText("멤버 투표 중")).toBeNull();
    expect(screen.queryByText("in_vote")).toBeNull();
  });

  it("retries a failed status load", async () => {
    authedFetch
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(jsonResponse(application("approved")));

    render(<ApplicationStatusPage />);

    expect(await screen.findByText("신청 현황을 불러오지 못했습니다."))
      .toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(await screen.findByText("입장이 승인되었습니다.")).toBeTruthy();
    expect(authedFetch).toHaveBeenCalledTimes(2);
  });
});
