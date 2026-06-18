// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
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
    authedFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      id: "application-1",
      applicantId: "applicant-1",
      status: "needs_more_info",
      policyVersion: "phase1-v1",
      reasonCode: "needs_identity_clarification",
      applicantNotice: "신청자에게 보이는 안내입니다.",
      reviewSummary: "검토자만 보는 내부 메모입니다.",
      createdAt: "2026-06-08T00:00:00.000Z",
      updatedAt: "2026-06-08T00:00:00.000Z",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    render(<ApplicationStatusPage />);

    expect(await screen.findByText("신청자에게 보이는 안내입니다."))
      .toBeTruthy();
    expect(screen.queryByText("검토자만 보는 내부 메모입니다.")).toBeNull();
    expect(screen.queryByText("검토자 내부 메모")).toBeNull();
    expect(screen.queryByText("사유")).toBeNull();
    expect(screen.queryByText("신원 확인 필요")).toBeNull();
  });
});
