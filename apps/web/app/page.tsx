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
          <p className="eyebrow">The locked door</p>
          <h1>SoulBound</h1>
          <p className="hero-lede">
            신뢰가 먼저 확인된 사람만 들어오는 비공개 커뮤니티.
            문은 닫혀 있지만, 입장 절차는 분명합니다.
          </p>
          <div className="hero-actions">
            {!loading && session ? (
              <Link className="button" href="/gate">입장 절차 계속하기</Link>
            ) : (
              <>
                <Link className="button" href="/signup">입장 신청 시작</Link>
                <Link className="button-secondary" href="/login">로그인</Link>
              </>
            )}
          </div>
        </div>
        <div className="door-visual" aria-hidden="true">
          <div className="door-panel">
            <span className="keyhole" />
          </div>
        </div>
      </section>

      <section className="intro-band" aria-labelledby="trust-title">
        <div>
          <p className="eyebrow">Admission before access</p>
          <h2 id="trust-title">가입보다 먼저, 서로를 믿을 근거를 만듭니다.</h2>
        </div>
        <ol className="intro-steps">
          <li>
            <span className="step-number">01</span>
            <span>선택 정보와 신청 동기를 제출합니다.</span>
          </li>
          <li>
            <span className="step-number">02</span>
            <span>인가된 검토자가 정책에 따라 확인합니다.</span>
          </li>
          <li>
            <span className="step-number">03</span>
            <span>승인된 멤버만 잠긴 공간으로 이동합니다.</span>
          </li>
        </ol>
      </section>
    </main>
  );
}
