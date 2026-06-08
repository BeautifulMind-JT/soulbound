"use client";

import type { Membership } from "@soulbound/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import {
  UnauthenticatedError,
  useAuth,
} from "../../lib/auth-provider";
import { readJson } from "../../lib/api-response";
import styles from "./page.module.css";

type MembershipState = Membership | null | undefined;

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export default function MemberPage() {
  const router = useRouter();
  const { session, loading, authedFetch } = useAuth();
  const [membership, setMembership] = useState<MembershipState>(undefined);
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
    const loadMembership = async () => {
      try {
        const response = await authedFetch("/api/membership/me", {
          signal: controller.signal,
        });
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok) {
          throw new Error("Unable to load membership");
        }

        const nextMembership = await readJson<Membership | null>(response);
        setMembership(nextMembership);
        if (nextMembership?.status !== "active") {
          router.replace("/gate");
        }
      } catch (error) {
        if (error instanceof UnauthenticatedError) {
          router.replace("/login");
        } else if (
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          setErrorMessage("멤버십 정보를 불러오지 못했습니다.");
        }
      }
    };

    void loadMembership();
    return () => controller.abort();
  }, [authedFetch, loading, router, session]);

  return (
    <main className="page-main">
      <header className="page-heading">
        <p className="eyebrow">Member</p>
        <h1>멤버 공간</h1>
        <p>승인된 멤버십 상태를 확인합니다.</p>
      </header>

      {errorMessage ? (
        <p className="form-message" role="alert">{errorMessage}</p>
      ) : null}

      <div className={styles.memberShell} aria-live="polite">
        {membership === undefined && !errorMessage ? (
          <p className="loading-line">멤버십을 확인하는 중입니다.</p>
        ) : null}

        {membership?.status === "active" ? (
          <>
            <section className={styles.membershipBand}>
              <div>
                <h2>입장이 확인되었습니다</h2>
                <p>현재 멤버십은 활성 상태입니다.</p>
              </div>
              <span className="status-badge">활성</span>
            </section>
            <dl className={styles.membershipMeta}>
              <div>
                <dt>등급</dt>
                <dd>{membership.tier}</dd>
              </div>
              <div>
                <dt>발급일</dt>
                <dd>{formatDate(membership.issuedAt)}</dd>
              </div>
              <div>
                <dt>멤버십 ID</dt>
                <dd>{membership.id}</dd>
              </div>
            </dl>
          </>
        ) : null}

        {membership !== undefined && membership?.status !== "active" ? (
          <section className={styles.notMember}>
            <h2>아직 멤버가 아닙니다</h2>
            <p>입장 절차에서 신청 상태와 다음 단계를 확인해 주세요.</p>
            <Link className="button" href="/gate">입장 절차로</Link>
          </section>
        ) : null}
      </div>
    </main>
  );
}
