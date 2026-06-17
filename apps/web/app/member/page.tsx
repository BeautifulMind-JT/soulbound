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
type MemberTab = "members" | "chats" | "more";

const tabs: readonly {
  readonly id: MemberTab;
  readonly label: string;
}[] = [
  { id: "members", label: "멤버" },
  { id: "chats", label: "대화" },
  { id: "more", label: "더보기" },
];

const memberSections: readonly {
  readonly id: string;
  readonly title: string;
  readonly description: string;
}[] = [
  {
    id: "new-members",
    title: "New Members",
    description: "새 멤버가 표시될 자리입니다.",
  },
  {
    id: "active-members",
    title: "Active Members",
    description: "활동 중인 멤버가 표시될 자리입니다.",
  },
  {
    id: "all-members",
    title: "All Members",
    description: "전체 멤버 목록이 표시될 자리입니다.",
  },
];

const moreItems: readonly {
  readonly label: string;
  readonly description: string;
}[] = [
  { label: "내 프로필", description: "내 소개와 공개 범위" },
  { label: "설정", description: "계정과 화면 설정" },
  { label: "알림", description: "새 대화와 멤버 소식" },
  { label: "내 멤버십", description: "멤버 상태" },
];

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
  const [activeTab, setActiveTab] = useState<MemberTab>("members");

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
      <header className={styles.shellHeader}>
        <div>
          <p className="eyebrow">Member</p>
          <h1>멤버</h1>
          <p>승인된 멤버들이 모이는 조용한 공간입니다.</p>
        </div>
      </header>

      {errorMessage ? (
        <p className="form-message" role="alert">{errorMessage}</p>
      ) : null}

      <div className={styles.memberShell} aria-live="polite">
        {membership === undefined && !errorMessage ? (
          <p className="loading-line">멤버십을 확인하는 중입니다.</p>
        ) : null}

        {membership?.status === "active" ? (
          <section className={styles.appShell} aria-label="멤버 홈">
            <div className={styles.tabPanels}>
              {activeTab === "members" ? (
                <div
                  aria-labelledby="members-tab"
                  className={styles.tabPanel}
                  id="members-panel"
                  role="tabpanel"
                >
                  <section className={styles.myPersona}>
                    <div className={styles.avatar} aria-hidden="true">ME</div>
                    <div className={styles.personaBody}>
                      <div className={styles.sectionHeading}>
                        <div>
                          <p className={styles.sectionKicker}>My Persona</p>
                          <h2>내 프로필</h2>
                        </div>
                        <span className="status-badge">멤버</span>
                      </div>
                      <p>
                        입장이 확인된 멤버입니다. 프로필 소개와 공개 설정은
                        다음 단계에서 다듬을 수 있습니다.
                      </p>
                      <dl className={styles.compactMeta}>
                        <div>
                          <dt>시작일</dt>
                          <dd>{formatDate(membership.issuedAt)}</dd>
                        </div>
                        <div>
                          <dt>상태</dt>
                          <dd>활성</dd>
                        </div>
                      </dl>
                    </div>
                  </section>

                  {memberSections.map((section) => (
                    <section
                      className={styles.memberSection}
                      key={section.title}
                      aria-labelledby={`${section.id}-title`}
                    >
                      <div className={styles.sectionHeading}>
                        <h2 id={`${section.id}-title`}>{section.title}</h2>
                        <span className={styles.countBadge}>0</span>
                      </div>
                      <div className={styles.emptyDirectory}>
                        <p>{section.description}</p>
                      </div>
                    </section>
                  ))}
                </div>
              ) : null}

              {activeTab === "chats" ? (
                <section
                  aria-labelledby="chats-tab"
                  className={styles.quietPanel}
                  id="chats-panel"
                  role="tabpanel"
                >
                  <h2 id="chats-title">대화</h2>
                  <p>아직 열린 대화가 없습니다.</p>
                </section>
              ) : null}

              {activeTab === "more" ? (
                <section
                  aria-labelledby="more-tab"
                  className={styles.morePanel}
                  id="more-panel"
                  role="tabpanel"
                >
                  <h2 id="more-title">더보기</h2>
                  <div className={styles.moreList}>
                    {moreItems.map((item) => (
                      <div className={styles.moreItem} key={item.label}>
                        <span>{item.label}</span>
                        <small>{item.description}</small>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>

            <nav
              aria-label="멤버 탐색"
              className={styles.bottomNav}
              role="tablist"
            >
              {tabs.map((tab) => (
                <button
                  aria-controls={`${tab.id}-panel`}
                  aria-selected={activeTab === tab.id}
                  className={activeTab === tab.id ? styles.activeTab : undefined}
                  id={`${tab.id}-tab`}
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  role="tab"
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </section>
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
