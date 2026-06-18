"use client";

import type { Membership } from "@soulbound/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import {
  AppBar,
  Avatar,
  Badge,
  EmptyState,
  ListRow,
  Section,
  TabBar,
} from "../../components/ui";
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
    <main className={`page-main ${styles.memberPage}`}>
      <AppBar
        eyebrow="Member"
        title="멤버"
        description="승인된 멤버들이 모이는 조용한 공간입니다."
      />

      {errorMessage ? (
        <p className="form-message" role="alert">{errorMessage}</p>
      ) : null}

      <div className={styles.memberShell} aria-live="polite">
        {membership === undefined && !errorMessage ? (
          <p className="loading-line">멤버십을 확인하는 중입니다.</p>
        ) : null}

        {membership?.status === "active" ? (
          <section className={styles.appShell} aria-label="멤버 홈">
            <div className={styles.phoneTop}>
              <span>SoulBound</span>
              <Badge tone="success">멤버</Badge>
            </div>
            <div className={styles.tabPanels}>
              {activeTab === "members" ? (
                <div
                  aria-labelledby="members-tab"
                  className={styles.tabPanel}
                  id="members-panel"
                  role="tabpanel"
                >
                  <Section
                    title="My Persona"
                    description="내가 이 공간에서 보이는 첫 모습"
                    action={<Badge tone="success">활성</Badge>}
                  >
                    <ListRow
                      leading={<Avatar label="ME" />}
                      title="내 프로필"
                      description="입장이 확인된 멤버입니다."
                      meta={`시작일 ${formatDate(membership.issuedAt)}`}
                    />
                  </Section>

                  {memberSections.map((section) => (
                    <Section
                      key={section.title}
                      title={section.title}
                      action={<Badge>0</Badge>}
                    >
                      <EmptyState>{section.description}</EmptyState>
                    </Section>
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
                  <Section title="대화">
                    <EmptyState>아직 열린 대화가 없습니다.</EmptyState>
                  </Section>
                </section>
              ) : null}

              {activeTab === "more" ? (
                <section
                  aria-labelledby="more-tab"
                  className={styles.morePanel}
                  id="more-panel"
                  role="tabpanel"
                >
                  <Section title="더보기">
                    <div className={styles.moreList}>
                    {moreItems.map((item) => (
                      <ListRow
                        key={item.label}
                        title={item.label}
                        description={item.description}
                        trailing={<span aria-hidden="true">›</span>}
                      />
                    ))}
                    </div>
                  </Section>
                </section>
              ) : null}
            </div>

            <TabBar
              activeId={activeTab}
              items={tabs}
              label="멤버 탐색"
              onChange={setActiveTab}
            />
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
