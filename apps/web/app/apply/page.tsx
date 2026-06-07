"use client";

import type { AdmissionApplication } from "@soulbound/core";
import { useRouter } from "next/navigation";
import React, {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  PersonaClipRecorder,
} from "../../components/admission/persona-clip-recorder";
import type {
  PersonaClipResult,
} from "../../components/admission/use-persona-clip-recorder";
import {
  UnauthenticatedError,
  useAuth,
} from "../../lib/auth-provider";
import { rememberApplicationId } from "../../lib/application-state";
import { readJson, submitErrorMessage } from "../../lib/api-response";

function optionalText(form: FormData, name: string): string | undefined {
  const value = String(form.get(name) ?? "").trim();
  return value || undefined;
}

export default function ApplyPage() {
  const router = useRouter();
  const { authedFetch, loading, session } = useAuth();
  const [clip, setClip] = useState<PersonaClipResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const idempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/login");
    }
  }, [loading, router, session]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");

    const form = new FormData(event.currentTarget);
    const applicantStatement = optionalText(form, "applicantStatement");
    const motivation = optionalText(form, "motivation");
    const referralCode = optionalText(form, "referralCode");
    idempotencyKeyRef.current ??= crypto.randomUUID();

    const body = {
      idempotencyKey: idempotencyKeyRef.current,
      ...(applicantStatement ? { applicantStatement } : {}),
      ...(motivation ? { motivation } : {}),
      ...(referralCode ? { referralCode } : {}),
      ...(clip
        ? {
            personaClipAssetId: clip.assetId,
            personaClipHash: clip.contentHash,
          }
        : {}),
    };

    try {
      const response = await authedFetch("/api/admission/applications", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (!response.ok) {
        setErrorMessage(submitErrorMessage(response.status));
        return;
      }

      const application = await readJson<AdmissionApplication>(response);
      rememberApplicationId(application.id);
      idempotencyKeyRef.current = null;
      router.push("/apply/status");
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        router.replace("/login");
      } else {
        setErrorMessage(
          "서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page-main">
      <header className="page-heading">
        <p className="eyebrow">Admission</p>
        <h1>입장 신청서</h1>
        <p>필요한 만큼만 적어 주세요. Persona Clip은 선택 사항입니다.</p>
      </header>

      <form className="form-panel form-grid" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="applicant-statement">나를 설명하는 한 문장</label>
          <textarea
            id="applicant-statement"
            name="applicantStatement"
            maxLength={1200}
          />
        </div>
        <div className="field">
          <label htmlFor="motivation">이 공간에 들어오려는 이유</label>
          <textarea id="motivation" name="motivation" maxLength={2400} />
        </div>
        <div className="field">
          <label htmlFor="referral-code">추천 코드</label>
          <input
            id="referral-code"
            name="referralCode"
            type="text"
            autoComplete="off"
            maxLength={120}
          />
        </div>

        <div className="recorder-section">
          <PersonaClipRecorder
            authedFetch={authedFetch}
            onComplete={setClip}
            onSkip={() => setClip(null)}
          />
          {clip ? (
            <p className="clip-ready" role="status">
              Persona Clip이 신청서에 연결됩니다.
            </p>
          ) : null}
        </div>

        {errorMessage ? (
          <p className="form-message" role="alert">{errorMessage}</p>
        ) : null}
        <div className="button-row">
          <button className="button" type="submit" disabled={submitting}>
            {submitting ? "제출 중" : "신청서 제출"}
          </button>
        </div>
      </form>
    </main>
  );
}
