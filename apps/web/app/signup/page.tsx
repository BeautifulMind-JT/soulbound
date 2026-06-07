"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState, type FormEvent } from "react";
import { useAuth } from "../../lib/auth-provider";

export default function SignupPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setIsError(false);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    try {
      const result = await signUp(email, password);
      if (result.requiresEmailConfirmation) {
        setMessage("확인 메일의 링크를 연 뒤 로그인해 주세요.");
      } else {
        router.push("/gate");
      }
    } catch {
      setIsError(true);
      setMessage("계정을 만들지 못했습니다. 입력 내용을 확인해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page-main narrow-main">
      <section className="auth-panel" aria-labelledby="signup-title">
        <h1 id="signup-title">문 앞에 서기</h1>
        <p>계정을 만든 뒤 입장 신청을 시작할 수 있습니다.</p>
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="signup-email">이메일</label>
            <input
              id="signup-email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="signup-password">비밀번호</label>
            <input
              id="signup-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>
          {message ? (
            <p
              className={`form-message${isError ? "" : " success-message"}`}
              role={isError ? "alert" : "status"}
            >
              {message}
            </p>
          ) : null}
          <div className="button-row">
            <button className="button" type="submit" disabled={submitting}>
              {submitting ? "생성 중" : "계정 만들기"}
            </button>
            <Link className="quiet-link" href="/login">이미 계정이 있어요</Link>
          </div>
        </form>
      </section>
    </main>
  );
}
