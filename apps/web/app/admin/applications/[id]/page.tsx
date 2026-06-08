"use client";

import type {
  AdmissionApplication,
  AdmissionReasonCode,
  AdmissionStatus,
} from "@soulbound/core";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import React, {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import {
  UnauthenticatedError,
  useAuth,
} from "../../../../lib/auth-provider";
import { readJson } from "../../../../lib/api-response";
import styles from "../admin.module.css";

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

const reasonLabel: Record<AdmissionReasonCode, string> = {
  meets_phase1_policy: "입장 정책 충족",
  insufficient_context: "판단 정보 부족",
  mismatch_with_policy: "입장 정책과 불일치",
  needs_identity_clarification: "신원 확인 필요",
  duplicate_identity_suspected: "중복 신원 의심",
  applicant_withdrew: "신청자 철회",
  application_expired: "신청 만료",
};

const decisionConfigs = [
  {
    action: "approve",
    title: "승인",
    submitLabel: "승인 확정",
    options: ["meets_phase1_policy"],
    buttonClassName: "button",
  },
  {
    action: "reject",
    title: "거절",
    submitLabel: "거절 확정",
    options: [
      "mismatch_with_policy",
      "insufficient_context",
      "duplicate_identity_suspected",
    ],
    buttonClassName: "button-danger",
  },
  {
    action: "request-more-info",
    title: "추가 정보 요청",
    submitLabel: "요청 보내기",
    options: [
      "needs_identity_clarification",
      "insufficient_context",
    ],
    buttonClassName: "button-secondary",
  },
] as const satisfies readonly {
  readonly action: "approve" | "reject" | "request-more-info";
  readonly title: string;
  readonly submitLabel: string;
  readonly options: readonly AdmissionReasonCode[];
  readonly buttonClassName: string;
}[];

type DecisionAction =
  typeof decisionConfigs[number]["action"];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function optionalFormText(form: FormData, name: string): string | undefined {
  const value = String(form.get(name) ?? "").trim();
  return value || undefined;
}

interface DecisionFormProps {
  readonly action: DecisionAction;
  readonly title: string;
  readonly submitLabel: string;
  readonly options: readonly AdmissionReasonCode[];
  readonly buttonClassName: string;
  readonly busy: boolean;
  readonly onSubmit: (
    action: DecisionAction,
    input: {
      readonly reasonCode: AdmissionReasonCode;
      readonly applicantNotice?: string;
      readonly reviewSummary?: string;
    },
  ) => Promise<void>;
}

function DecisionForm({
  action,
  title,
  submitLabel,
  options,
  buttonClassName,
  busy,
  onSubmit,
}: DecisionFormProps) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const reasonCode = String(form.get("reasonCode")) as AdmissionReasonCode;
    const applicantNotice = optionalFormText(form, "applicantNotice");
    const reviewSummary = optionalFormText(form, "reviewSummary");
    await onSubmit(action, {
      reasonCode,
      ...(applicantNotice ? { applicantNotice } : {}),
      ...(reviewSummary ? { reviewSummary } : {}),
    });
  }

  return (
    <form
      className={styles.decisionForm}
      onSubmit={(event) => void handleSubmit(event)}
    >
      <h3>{title}</h3>
      <label>
        사유 코드
        <select name="reasonCode" aria-label={`${title} 사유 코드`}>
          {options.map((option) => (
            <option key={option} value={option}>
              {reasonLabel[option]}
            </option>
          ))}
        </select>
      </label>
      <label>
        신청자 안내
        <textarea
          name="applicantNotice"
          aria-label={`${title} 신청자 안내`}
        />
      </label>
      <label>
        검토자 내부 메모
        <textarea
          name="reviewSummary"
          aria-label={`${title} 검토자 내부 메모`}
        />
      </label>
      <button
        className={buttonClassName}
        type="submit"
        disabled={busy}
      >
        {busy ? "처리 중" : submitLabel}
      </button>
    </form>
  );
}

export default function ReviewDetailPage() {
  const params = useParams<{ id: string }>();
  const applicationId = params.id;
  const router = useRouter();
  const { session, loading, authedFetch } = useAuth();
  const [application, setApplication] =
    useState<AdmissionApplication | null | undefined>(undefined);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const loadApplication = useCallback(async (signal?: AbortSignal) => {
    setErrorMessage("");
    try {
      const response = await authedFetch(
        `/api/admin/applications/${encodeURIComponent(applicationId)}`,
        signal ? { signal } : undefined,
      );
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (response.status === 403) {
        setPermissionDenied(true);
        setApplication(null);
        return;
      }
      if (response.status === 404) {
        setApplication(null);
        return;
      }
      if (!response.ok) {
        throw new Error("Unable to load application");
      }

      setPermissionDenied(false);
      setApplication(await readJson<AdmissionApplication>(response));
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        router.replace("/login");
      } else if (
        !(error instanceof DOMException && error.name === "AbortError")
      ) {
        setErrorMessage("신청 상세를 불러오지 못했습니다.");
      }
    }
  }, [applicationId, authedFetch, router]);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!session) {
      router.replace("/login");
      return;
    }
    const controller = new AbortController();
    void loadApplication(controller.signal);
    return () => controller.abort();
  }, [loadApplication, loading, router, session]);

  async function runAction(
    action: "review" | DecisionAction,
    body: Record<string, unknown>,
  ) {
    setBusyAction(action);
    setActionMessage("");
    try {
      const response = await authedFetch(
        `/api/admin/applications/${encodeURIComponent(applicationId)}/${action}`,
        {
          method: "POST",
          body: JSON.stringify({
            ...body,
            idempotencyKey: crypto.randomUUID(),
          }),
        },
      );
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (response.status === 403) {
        setPermissionDenied(true);
        return;
      }
      if (response.status === 409) {
        setActionMessage(
          "신청 상태가 이미 변경되었습니다. 최신 상태를 다시 불러왔습니다.",
        );
        await loadApplication();
        return;
      }
      if (!response.ok) {
        setActionMessage("요청을 처리하지 못했습니다.");
        return;
      }

      setActionMessage("변경사항을 반영했습니다.");
      setClipUrl(null);
      await loadApplication();
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        router.replace("/login");
      } else {
        setActionMessage("요청을 처리하지 못했습니다.");
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function loadClip() {
    setBusyAction("clip");
    setActionMessage("");
    try {
      const response = await authedFetch(
        `/api/admin/applications/${encodeURIComponent(applicationId)}/persona-clip-url`,
      );
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (response.status === 403) {
        setPermissionDenied(true);
        return;
      }
      if (response.status === 404) {
        setActionMessage("재생할 Persona Clip을 찾을 수 없습니다.");
        return;
      }
      if (!response.ok) {
        throw new Error("Unable to load clip URL");
      }

      const payload = await readJson<{ readonly url: string }>(response);
      setClipUrl(payload.url);
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        router.replace("/login");
      } else {
        setActionMessage("Persona Clip을 불러오지 못했습니다.");
      }
    } finally {
      setBusyAction(null);
    }
  }

  if (permissionDenied) {
    return (
      <main className="page-main narrow-main">
        <section className={styles.permissionState} role="alert">
          <h1>권한이 없습니다</h1>
          <p>검토자 또는 관리자 계정으로 접근해 주세요.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page-main">
      <header className={styles.detailHeader}>
        <div className="page-heading">
          <p className="eyebrow">Application review</p>
          <h1>신청 상세</h1>
          <p>{applicationId}</p>
        </div>
        <Link className={styles.backLink} href="/admin/applications">
          대기열로 돌아가기
        </Link>
      </header>

      {errorMessage ? (
        <p className="form-message" role="alert">{errorMessage}</p>
      ) : null}

      {application === undefined && !errorMessage ? (
        <p className="loading-line">신청 상세를 불러오는 중입니다.</p>
      ) : null}

      {application === null && !errorMessage ? (
        <section className={styles.emptyState}>
          <h2>신청을 찾을 수 없습니다</h2>
        </section>
      ) : null}

      {application ? (
        <div className={styles.detailGrid}>
          <section className={styles.detailSection}>
            <h2>신청 내용</h2>
            <dl className={styles.detailList}>
              <div>
                <dt>상태</dt>
                <dd>
                  <span className="status-badge">
                    {statusLabel[application.status]}
                  </span>
                </dd>
              </div>
              <div>
                <dt>신청자 ID</dt>
                <dd>{application.applicantId}</dd>
              </div>
              <div>
                <dt>한 문장 소개</dt>
                <dd>{application.applicantStatement ?? "입력 없음"}</dd>
              </div>
              <div>
                <dt>신청 동기</dt>
                <dd>{application.motivation ?? "입력 없음"}</dd>
              </div>
              <div>
                <dt>추천 코드</dt>
                <dd>{application.referralCode ?? "입력 없음"}</dd>
              </div>
              <div>
                <dt>신청자 안내</dt>
                <dd>{application.applicantNotice ?? "입력 없음"}</dd>
              </div>
              <div className={styles.internalNote}>
                <dt>검토자 내부 메모</dt>
                <dd>{application.reviewSummary ?? "입력 없음"}</dd>
              </div>
            </dl>
          </section>

          <section className={styles.detailSection}>
            <h2>검토 정보</h2>
            <dl className={styles.detailList}>
              <div>
                <dt>검토자 ID</dt>
                <dd>{application.reviewerId ?? "미배정"}</dd>
              </div>
              <div>
                <dt>검토 시각</dt>
                <dd>
                  {application.reviewedAt
                    ? formatDate(application.reviewedAt)
                    : "미검토"}
                </dd>
              </div>
              <div>
                <dt>정책 버전</dt>
                <dd>{application.policyVersion}</dd>
              </div>
              <div>
                <dt>생성 시각</dt>
                <dd>{formatDate(application.createdAt)}</dd>
              </div>
              <div>
                <dt>갱신 시각</dt>
                <dd>{formatDate(application.updatedAt)}</dd>
              </div>
            </dl>

            {application.personaClipAssetId ? (
              <div className={styles.clipBlock}>
                <button
                  className="button-secondary"
                  type="button"
                  disabled={busyAction === "clip"}
                  onClick={() => void loadClip()}
                >
                  {busyAction === "clip" ? "불러오는 중" : "클립 재생"}
                </button>
                {clipUrl ? (
                  <video
                    className={styles.clipVideo}
                    controls
                    src={clipUrl}
                    aria-label="Persona Clip 재생"
                  />
                ) : null}
              </div>
            ) : null}
          </section>

          {application.status === "submitted" ? (
            <section className={styles.actionSection}>
              <h2>검토 시작</h2>
              {actionMessage ? (
                <p className={styles.actionMessage} role="status">
                  {actionMessage}
                </p>
              ) : null}
              <button
                className="button"
                type="button"
                disabled={busyAction !== null}
                onClick={() => void runAction("review", {})}
              >
                {busyAction === "review" ? "처리 중" : "검토 시작"}
              </button>
            </section>
          ) : null}

          {application.status === "under_review" ? (
            <section className={styles.actionSection}>
              <h2>검토 결정</h2>
              {actionMessage ? (
                <p className={styles.actionMessage} role="status">
                  {actionMessage}
                </p>
              ) : null}
              <div className={styles.decisionGrid}>
                {decisionConfigs.map((config) => (
                  <DecisionForm
                    key={config.action}
                    {...config}
                    busy={busyAction !== null}
                    onSubmit={async (action, input) => {
                      await runAction(action, input);
                    }}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
