"use client";

import type {
  AdmissionApplication,
  AdmissionStatus,
} from "@soulbound/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import {
  UnauthenticatedError,
  useAuth,
} from "../../../lib/auth-provider";
import { readRememberedApplicationId } from "../../../lib/application-state";
import { readJson } from "../../../lib/api-response";

const statusLabel: Record<AdmissionStatus, string> = {
  draft: "작성 중",
  submitted: "제출됨",
  under_review: "검토 중",
  needs_more_info: "추가 정보 필요",
  approved: "승인됨",
  rejected: "거절됨",
  withdrawn: "철회됨",
  expired: "만료됨",
};

type ApplicantApplicationView = AdmissionApplication;

export default function ApplicationStatusPage() {
  const router = useRouter();
  const { session, loading, authedFetch } = useAuth();
  const [application, setApplication] =
    useState<ApplicantApplicationView | null | undefined>(undefined);
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
    const loadApplication = async () => {
      try {
        const activeResponse = await authedFetch(
          "/api/admission/applications/me",
          { signal: controller.signal },
        );
        if (activeResponse.status === 401) {
          router.replace("/login");
          return;
        }
        if (!activeResponse.ok) {
          throw new Error("Unable to load application");
        }

        let nextApplication =
          await readJson<ApplicantApplicationView | null>(activeResponse);
        if (!nextApplication) {
          const rememberedId = readRememberedApplicationId();
          if (rememberedId) {
            const detailResponse = await authedFetch(
              `/api/admission/applications/${encodeURIComponent(rememberedId)}`,
              { signal: controller.signal },
            );
            if (detailResponse.status === 401) {
              router.replace("/login");
              return;
            }
            if (detailResponse.ok) {
              nextApplication =
                await readJson<ApplicantApplicationView>(detailResponse);
            }
          }
        }
        setApplication(nextApplication);
      } catch (error) {
        if (error instanceof UnauthenticatedError) {
          router.replace("/login");
        } else if (
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          setErrorMessage("신청 현황을 불러오지 못했습니다.");
        }
      }
    };

    void loadApplication();
    return () => controller.abort();
  }, [authedFetch, loading, router, session]);

  return (
    <main className="page-main narrow-main">
      <header className="page-heading">
        <p className="eyebrow">Status</p>
        <h1>내 신청 현황</h1>
      </header>

      {errorMessage ? (
        <p className="form-message" role="alert">{errorMessage}</p>
      ) : null}

      <section className="status-panel" aria-live="polite">
        {application === undefined && !errorMessage ? (
          <p className="loading-line">신청 현황을 확인하는 중입니다.</p>
        ) : null}

        {application === null ? (
          <>
            <h2>진행 중인 신청이 없습니다</h2>
            <p>새 입장 신청을 시작할 수 있습니다.</p>
            <Link className="button" href="/apply">입장 신청</Link>
          </>
        ) : null}

        {application ? (
          <>
            <span className="status-badge">
              {statusLabel[application.status]}
            </span>
            <dl className="status-details">
              <div>
                <dt>신청 상태</dt>
                <dd>{statusLabel[application.status]}</dd>
              </div>
              {application.applicantNotice ? (
                <div>
                  <dt>검토자 안내</dt>
                  <dd>{application.applicantNotice}</dd>
                </div>
              ) : null}
            </dl>
          </>
        ) : null}
      </section>
    </main>
  );
}
