"use client";

import type { AdmissionApplication, Membership } from "@soulbound/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import {
  UnauthenticatedError,
  useAuth,
} from "../../lib/auth-provider";
import { rememberApplicationId } from "../../lib/application-state";
import { readJson } from "../../lib/api-response";

interface GateState {
  readonly application: AdmissionApplication | null;
  readonly membership: Membership | null;
}

export default function GatePage() {
  const router = useRouter();
  const { session, loading, authedFetch } = useAuth();
  const [state, setState] = useState<GateState | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!session) {
      router.replace("/login");
      return;
    }

    const controller = new AbortController();
    const loadState = async () => {
      try {
        const [applicationResponse, membershipResponse] = await Promise.all([
          authedFetch("/api/admission/applications/me", {
            signal: controller.signal,
          }),
          authedFetch("/api/membership/me", {
            signal: controller.signal,
          }),
        ]);

        if (applicationResponse.status === 401 || membershipResponse.status === 401) {
          router.replace("/login");
          return;
        }
        if (!applicationResponse.ok || !membershipResponse.ok) {
          throw new Error("Unable to load gate state");
        }

        const application =
          await readJson<AdmissionApplication | null>(applicationResponse);
        const membership = await readJson<Membership | null>(membershipResponse);
        if (application) {
          rememberApplicationId(application.id);
        }
        setState({ application, membership });
      } catch (error) {
        if (error instanceof UnauthenticatedError) {
          router.replace("/login");
        } else if (
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          setErrorMessage("입장 상태를 불러오지 못했습니다.");
        }
      }
    };

    void loadState();
    return () => controller.abort();
  }, [authedFetch, loading, router, session]);

  const nextStep = state?.membership?.status === "active"
    ? {
        title: "입장이 완료되었습니다",
        body: "멤버 공간으로 이동할 수 있습니다.",
        href: "/member",
        label: "멤버 공간으로",
      }
    : state?.application
      ? {
          title: "신청을 검토하고 있습니다",
          body: "현재 상태와 검토자의 안내를 확인하세요.",
          href: "/apply/status",
          label: "신청 현황 보기",
        }
      : {
          title: "입장 신청이 필요합니다",
          body: "신청 정보와 선택 사항인 Persona Clip을 제출할 수 있습니다.",
          href: "/apply",
          label: "신청서 작성",
        };

  return (
    <main className="page-main">
      <header className="page-heading">
        <p className="eyebrow">The gate</p>
        <h1>입장 절차</h1>
        <p>신청, 검토, 승인 순서로 잠긴 문을 통과합니다.</p>
      </header>

      {errorMessage ? (
        <p className="form-message" role="alert">{errorMessage}</p>
      ) : null}

      <div className="gate-grid">
        <section className="gate-status" aria-live="polite">
          {!state && !errorMessage ? (
            <p className="loading-line">현재 상태를 확인하는 중입니다.</p>
          ) : state ? (
            <>
              <h2>{nextStep.title}</h2>
              <p>{nextStep.body}</p>
              <Link className="button" href={nextStep.href}>
                {nextStep.label}
              </Link>
            </>
          ) : null}
        </section>

        <section className="status-panel" aria-labelledby="process-title">
          <h2 id="process-title">절차</h2>
          <ol className="process-list">
            <li>1. 신청 정보를 제출합니다.</li>
            <li>2. 인가된 검토자가 확인합니다.</li>
            <li>3. 승인 후 멤버 공간이 열립니다.</li>
          </ol>
        </section>
      </div>
    </main>
  );
}
