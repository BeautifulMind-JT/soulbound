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
        <ol className="landing-steps" aria-label="입장 순서">
          <li>
            계정을 만들고 메일을 확인합니다.
          </li>
          <li>
            짧은 입장 신청을 보냅니다.
          </li>
          <li>
            승인 후 멤버, 대화, 더보기를 사용합니다.
          </li>
        </ol>
      </section>
    </main>
  );
}
