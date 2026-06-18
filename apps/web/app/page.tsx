"use client";

import Link from "next/link";
import React from "react";
import { useAuth } from "../lib/auth-provider";

export default function LandingPage() {
  const { session, loading } = useAuth();

  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Private messenger</p>
          <h1>SoulBound</h1>
          <p className="hero-lede">
            신뢰가 확인된 사람만 들어오는 비공개 멤버 공간.
            가입하고, 입장을 신청하고, 멤버와 대화하세요.
          </p>
          <div className="hero-actions">
            {!loading && session ? (
              <Link className="button" href="/gate">입장 상태 보기</Link>
            ) : (
              <>
                <Link className="button" href="/signup">가입하기</Link>
                <Link className="button-secondary" href="/login">로그인</Link>
              </>
            )}
          </div>
        </div>
        <div className="hero-phone" aria-hidden="true">
          <div className="hero-phone-bar">
            <span>멤버</span>
            <span>09:12</span>
          </div>
          <div className="hero-phone-list">
            <div className="hero-phone-me">
              <span>ME</span>
              <div>
                <strong>내 프로필</strong>
                <small>입장이 확인된 멤버</small>
              </div>
            </div>
            <div className="hero-phone-row">
              <span />
              <div />
            </div>
            <div className="hero-phone-row">
              <span />
              <div />
            </div>
          </div>
          <div className="hero-phone-tabs">
            <span>멤버</span>
            <span>대화</span>
            <span>더보기</span>
          </div>
        </div>
      </section>

      <section className="intro-band" aria-labelledby="trust-title">
        <div>
          <p className="eyebrow">Members first</p>
          <h2 id="trust-title">승인된 멤버를 먼저 만나는 간단한 홈.</h2>
        </div>
        <ol className="intro-steps">
          <li>
            <span className="step-number">01</span>
            <span>계정을 만들고 메일을 확인합니다.</span>
          </li>
          <li>
            <span className="step-number">02</span>
            <span>짧은 입장 신청을 보냅니다.</span>
          </li>
          <li>
            <span className="step-number">03</span>
            <span>승인 후 멤버, 대화, 더보기를 사용합니다.</span>
          </li>
        </ol>
      </section>
    </main>
  );
}
