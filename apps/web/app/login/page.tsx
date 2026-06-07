"use client";

import type { AdmissionApplication, Membership } from "@soulbound/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState, type FormEvent } from "react";
import { useAuth } from "../../lib/auth-provider";
import { rememberApplicationId } from "../../lib/application-state";
import { readJson } from "../../lib/api-response";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, authedFetch } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    try {
      const auth = await signIn(email, password);
      const [applicationResponse, membershipResponse] = await Promise.all([
        authedFetch("/api/admission/applications/me"),
        authedFetch("/api/membership/me"),
      ]);

      if (!applicationResponse.ok || !membershipResponse.ok) {
        throw new Error("Unable to resolve account state");
      }

      const application =
        await readJson<AdmissionApplication | null>(applicationResponse);
      const membership = await readJson<Membership | null>(membershipResponse);
      if (application) {
        rememberApplicationId(application.id);
      }

      if (auth.role === "reviewer" || auth.role === "admin") {
        router.push("/admin/applications");
      } else if (auth.role === "member" || membership?.status === "active") {
        router.push("/member");
      } else {
        router.push("/gate");
      }
    } catch {
      setErrorMessage("이메일 또는 비밀번호를 확인해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page-main narrow-main">
      <section className="auth-panel" aria-labelledby="login-title">
        <h1 id="login-title">다시 문 앞에</h1>
        <p>계정으로 돌아와 현재 입장 상태를 확인합니다.</p>
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="login-email">이메일</label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="login-password">비밀번호</label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          {errorMessage ? (
            <p className="form-message" role="alert">{errorMessage}</p>
          ) : null}
          <div className="button-row">
            <button className="button" type="submit" disabled={submitting}>
              {submitting ? "확인 중" : "로그인"}
            </button>
            <Link className="quiet-link" href="/signup">계정 만들기</Link>
          </div>
        </form>
      </section>
    </main>
  );
}
