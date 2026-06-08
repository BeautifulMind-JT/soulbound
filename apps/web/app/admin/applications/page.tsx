"use client";

import type {
  AdmissionApplication,
  AdmissionStatus,
} from "@soulbound/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import {
  UnauthenticatedError,
  useAuth,
} from "../../../lib/auth-provider";
import { readJson } from "../../../lib/api-response";
import styles from "./admin.module.css";

const statusOptions: readonly {
  readonly value: AdmissionStatus | "all";
  readonly label: string;
}[] = [
  { value: "submitted", label: "제출됨" },
  { value: "under_review", label: "검토 중" },
  { value: "needs_more_info", label: "추가 정보 필요" },
  { value: "approved", label: "승인됨" },
  { value: "rejected", label: "거절됨" },
  { value: "draft", label: "작성 중" },
  { value: "withdrawn", label: "철회됨" },
  { value: "expired", label: "만료됨" },
  { value: "all", label: "전체" },
];

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

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function ReviewQueuePage() {
  const router = useRouter();
  const { session, loading, authedFetch } = useAuth();
  const [status, setStatus] = useState<AdmissionStatus | "all">("submitted");
  const [applications, setApplications] =
    useState<readonly AdmissionApplication[] | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [permissionDenied, setPermissionDenied] = useState(false);

  const loadQueue = useCallback(async (
    nextStatus: AdmissionStatus | "all",
    signal?: AbortSignal,
  ) => {
    setErrorMessage("");
    setPermissionDenied(false);
    const params = new URLSearchParams({ limit: "50" });
    if (nextStatus !== "all") {
      params.set("status", nextStatus);
    }

    try {
      const response = await authedFetch(
        `/api/admin/applications?${params.toString()}`,
        signal ? { signal } : undefined,
      );
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (response.status === 403) {
        setPermissionDenied(true);
        setApplications([]);
        return;
      }
      if (!response.ok) {
        throw new Error("Unable to load review queue");
      }

      setApplications(
        await readJson<readonly AdmissionApplication[]>(response),
      );
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        router.replace("/login");
      } else if (
        !(error instanceof DOMException && error.name === "AbortError")
      ) {
        setErrorMessage("검토 대기열을 불러오지 못했습니다.");
      }
    }
  }, [authedFetch, router]);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!session) {
      router.replace("/login");
      return;
    }
    const controller = new AbortController();
    void loadQueue(status, controller.signal);
    return () => controller.abort();
  }, [loadQueue, loading, router, session, status]);

  return (
    <main className="page-main">
      <header className="page-heading">
        <p className="eyebrow">Review operations</p>
        <h1>입장 신청 검토</h1>
        <p>상태별 신청을 확인하고 상세 검토로 이동합니다.</p>
      </header>

      <section className={styles.toolbar} aria-label="검토 대기열 필터">
        <div className={styles.filterField}>
          <label htmlFor="queue-status">신청 상태</label>
          <select
            id="queue-status"
            value={status}
            onChange={(event) => {
              setApplications(null);
              setStatus(event.target.value as AdmissionStatus | "all");
            }}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <p className={styles.queueCount}>
          {applications === null ? "불러오는 중" : `${applications.length}건`}
        </p>
      </section>

      {permissionDenied ? (
        <section className={styles.permissionState} role="alert">
          <h2>권한이 없습니다</h2>
          <p>검토자 또는 관리자 계정으로 접근해 주세요.</p>
        </section>
      ) : null}

      {errorMessage ? (
        <p className="form-message" role="alert">{errorMessage}</p>
      ) : null}

      {!permissionDenied && applications?.length === 0 ? (
        <section className={styles.emptyState}>
          <h2>해당 상태의 신청이 없습니다</h2>
        </section>
      ) : null}

      {!permissionDenied && applications && applications.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.queueTable}>
            <thead>
              <tr>
                <th>신청자 ID</th>
                <th>상태</th>
                <th>제출 시각</th>
                <th>Persona Clip</th>
                <th>상세</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => (
                <tr key={application.id}>
                  <td className={styles.idCell}>{application.applicantId}</td>
                  <td>
                    <span className="status-badge">
                      {statusLabel[application.status]}
                    </span>
                  </td>
                  <td>{formatDate(application.createdAt)}</td>
                  <td>
                    {application.personaClipAssetId ? (
                      <span className={styles.clipMarker}>클립 있음</span>
                    ) : "없음"}
                  </td>
                  <td>
                    <Link
                      className={styles.rowLink}
                      href={`/admin/applications/${application.id}`}
                    >
                      열기
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  );
}
