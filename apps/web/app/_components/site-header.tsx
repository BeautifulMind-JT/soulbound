"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { useAuth } from "../../lib/auth-provider";

export function SiteHeader() {
  const router = useRouter();
  const { session, loading, signOut } = useAuth();
  const [signOutError, setSignOutError] = useState("");

  async function handleSignOut() {
    setSignOutError("");
    try {
      await signOut();
      router.push("/");
    } catch {
      setSignOutError("로그아웃하지 못했습니다.");
    }
  }

  return (
    <header className="site-header">
      <Link className="brand-link" href="/" aria-label="SoulBound 홈">
        <span className="brand-seal" aria-hidden="true">S</span>
        <span>SoulBound</span>
      </Link>
      <nav className="site-nav" aria-label="주요 탐색">
        {!loading && session ? (
          <>
            <Link href="/gate">입장 절차</Link>
            <button
              className="text-button"
              type="button"
              onClick={() => void handleSignOut()}
            >
              로그아웃
            </button>
          </>
        ) : (
          <>
            <Link href="/login">로그인</Link>
            <Link className="nav-action" href="/signup">가입</Link>
          </>
        )}
      </nav>
      {signOutError ? (
        <p className="header-error" role="alert">{signOutError}</p>
      ) : null}
    </header>
  );
}
