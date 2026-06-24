"use client";

import type { Membership, Persona } from "@soulbound/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { type ReactNode, useEffect, useState } from "react";
import { InstallPrompt } from "../../components/pwa/install-prompt";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Field,
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
type PersonaState = Persona | undefined;
type MemberTab = "members" | "chats" | "more";

interface PersonaFormState {
  readonly handle: string;
  readonly displayName: string;
  readonly bio: string;
}

interface PublicMemberPersona extends Persona {
  readonly handle: string;
  readonly isMe: boolean;
}

interface MemberDirectoryResponse {
  readonly items: readonly PublicMemberPersona[];
  readonly nextCursor: string | null;
}

function MembersIcon() {
  return (
    <svg fill="none" height="22" viewBox="0 0 24 24" width="22">
      <path
        d="M8.5 11.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M15.75 10.75a2.75 2.75 0 1 0 0-5.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M3.75 18.75c.68-2.75 2.36-4.25 4.75-4.25s4.07 1.5 4.75 4.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M14.5 14.75c1.95.22 3.31 1.57 3.75 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function ChatsIcon() {
  return (
    <svg fill="none" height="22" viewBox="0 0 24 24" width="22">
      <path
        d="M5.25 6.25h13.5v8.5H9.4L5.25 18.25v-12Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M8.5 9.5h7M8.5 12h4.75"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg fill="none" height="22" viewBox="0 0 24 24" width="22">
      <path
        d="M6.5 12h.01M12 12h.01M17.5 12h.01"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
    </svg>
  );
}

const tabs: readonly {
  readonly id: MemberTab;
  readonly label: string;
  readonly icon: ReactNode;
}[] = [
  { id: "members", label: "멤버", icon: <MembersIcon /> },
  { id: "chats", label: "대화", icon: <ChatsIcon /> },
  { id: "more", label: "더보기", icon: <MoreIcon /> },
];

const disabledMoreGroups: readonly {
  readonly title: string;
  readonly rows: readonly {
    readonly label: string;
    readonly description: string;
    readonly badge?: string;
  }[];
}[] = [
  {
    title: "소통",
    rows: [
      {
        label: "대화 / 다이렉트 메시지 (E2EE)",
        description: "멤버와 안전하게 이야기하는 공간",
      },
      { label: "알림", description: "새 대화와 멤버 소식" },
    ],
  },
  {
    title: "커뮤니티",
    rows: [],
  },
  {
    title: "신원 & 자산",
    rows: [
      {
        label: "소울바운드 신원 / 온체인 크리덴셜",
        description: "검증된 신원을 안전하게 보관",
      },
      {
        label: "SOUL 잔액 · 스테이킹 · 원장",
        description: "참여 상태와 원장 기록",
      },
      { label: "지갑 연결", description: "지갑과 멤버십 연결" },
    ],
  },
  {
    title: "신뢰 & 안전",
    rows: [
      { label: "신고 · 모더레이션", description: "문제 상황을 안전하게 알리기" },
      {
        label: "Support / Challenge (stake review)",
        description: "스테이크 기반 이의 제기와 지원",
      },
      {
        label: "심사 권한",
        description: "심사 역할을 얻으면 사용할 수 있습니다.",
        badge: "자격 획득 필요",
      },
    ],
  },
  {
    title: "개인정보·보안 & 설정",
    rows: [
      {
        label: "프라이버시 / 데이터 보관 정책",
        description: "개인정보와 보관 기준 확인",
      },
      { label: "E2EE 보안 설명", description: "대화 보안 구조 안내" },
      { label: "설정 (계정/화면)", description: "계정과 화면 설정" },
    ],
  },
];

const appInfo: readonly {
  readonly label: string;
  readonly description: string;
  readonly badge: string;
}[] = [
  {
    label: "앱 정보 / 버전",
    description: "Pre-alpha staging shell",
    badge: "pre-alpha",
  },
];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formFromPersona(persona: Persona | undefined): PersonaFormState {
  return {
    handle: persona?.handle ?? "",
    displayName: persona?.displayName ?? "",
    bio: persona?.bio ?? "",
  };
}

function personaMark(persona: Persona | undefined): string {
  const source = persona?.displayName ?? persona?.handle ?? "";
  const letters = Array.from(source.replace(/[^\p{L}\p{N}]/gu, ""));
  return letters.slice(0, 2).join("").toUpperCase() || "ME";
}

function personaTitle(persona: Persona | undefined): string {
  if (persona === undefined) {
    return "프로필을 불러오는 중입니다.";
  }
  return persona.displayName ?? "익명 멤버";
}

function personaDescription(persona: Persona | undefined): string {
  if (persona === undefined) {
    return "잠시만 기다려 주세요.";
  }
  const handle = persona.handle ? `@${persona.handle}` : "handle 설정 전";
  const bio = persona.bio ?? "아직 소개가 없습니다.";
  return `${handle} · ${bio}`;
}

function memberTitle(member: PublicMemberPersona): string {
  return member.displayName ?? "익명 멤버";
}

function memberDescription(member: PublicMemberPersona): string {
  return `@${member.handle}${member.bio ? ` · ${member.bio}` : ""}`;
}

function DisabledMoreRow({
  label,
  description,
  badge = "준비 중",
}: {
  readonly label: string;
  readonly description: string;
  readonly badge?: string;
}) {
  return (
    <div aria-disabled="true" className={styles.moreDisabledRow}>
      <ListRow
        title={label}
        description={description}
        trailing={<Badge>{badge}</Badge>}
      />
    </div>
  );
}

export default function MemberPage() {
  const router = useRouter();
  const { session, loading, authedFetch, signOut } = useAuth();
  const [membership, setMembership] = useState<MembershipState>(undefined);
  const [persona, setPersona] = useState<PersonaState>(undefined);
  const [personaForm, setPersonaForm] = useState<PersonaFormState>({
    handle: "",
    displayName: "",
    bio: "",
  });
  const [isEditingPersona, setIsEditingPersona] = useState(false);
  const [personaSaving, setPersonaSaving] = useState(false);
  const [personaMessage, setPersonaMessage] = useState("");
  const [personaError, setPersonaError] = useState("");
  const [members, setMembers] = useState<readonly PublicMemberPersona[]>([]);
  const [membersNextCursor, setMembersNextCursor] = useState<string | null>(
    null,
  );
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersLoadingMore, setMembersLoadingMore] = useState(false);
  const [membersError, setMembersError] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [signOutError, setSignOutError] = useState("");
  const [activeTab, setActiveTab] = useState<MemberTab>("members");

  async function handleSignOut() {
    setSignOutError("");
    try {
      await signOut();
      router.push("/");
    } catch {
      setSignOutError("로그아웃하지 못했습니다.");
    }
  }

  async function loadMemberDirectory(
    cursor: string | null = null,
    signal?: AbortSignal,
  ) {
    const isFirstPage = cursor === null;
    if (isFirstPage) {
      setMembersLoading(true);
    } else {
      setMembersLoadingMore(true);
    }
    setMembersError("");

    try {
      const query = new URLSearchParams({ limit: "50" });
      if (cursor) {
        query.set("cursor", cursor);
      }
      const init: RequestInit = signal ? { signal } : {};
      const response = await authedFetch(
        `/api/members?${query.toString()}`,
        init,
      );
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (response.status === 403) {
        router.replace("/gate");
        return;
      }
      if (!response.ok) {
        throw new Error("Unable to load members");
      }

      const directory = await readJson<MemberDirectoryResponse>(response);
      setMembers((current) =>
        isFirstPage ? directory.items : [...current, ...directory.items]
      );
      setMembersNextCursor(directory.nextCursor);
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        router.replace("/login");
      } else if (
        !(error instanceof DOMException && error.name === "AbortError")
      ) {
        setMembersError("멤버 목록을 불러오지 못했습니다.");
      }
    } finally {
      if (isFirstPage) {
        setMembersLoading(false);
      } else {
        setMembersLoadingMore(false);
      }
    }
  }

  function openPersonaEditor() {
    setPersonaError("");
    setPersonaMessage("");
    setPersonaForm(formFromPersona(persona));
    setActiveTab("members");
    setIsEditingPersona(true);
  }

  function closePersonaEditor() {
    setPersonaError("");
    setPersonaMessage("");
    setPersonaForm(formFromPersona(persona));
    setIsEditingPersona(false);
  }

  async function handlePersonaSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPersonaSaving(true);
    setPersonaError("");
    setPersonaMessage("");
    try {
      const response = await authedFetch("/api/profile/me", {
        method: "PATCH",
        body: JSON.stringify(personaForm),
      });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (response.status === 403) {
        router.replace("/gate");
        return;
      }
      if (response.status === 409) {
        setPersonaError("이미 사용 중인 handle입니다.");
        return;
      }
      if (response.status === 422) {
        setPersonaError("프로필 내용을 확인해 주세요.");
        return;
      }
      if (!response.ok) {
        throw new Error("Unable to update persona");
      }

      const nextPersona = await readJson<Persona>(response);
      setPersona(nextPersona);
      setPersonaForm(formFromPersona(nextPersona));
      setIsEditingPersona(false);
      setPersonaMessage("프로필을 저장했습니다.");
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        router.replace("/login");
      } else {
        setPersonaError("프로필을 저장하지 못했습니다.");
      }
    } finally {
      setPersonaSaving(false);
    }
  }

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
          setPersona(undefined);
          setIsEditingPersona(false);
          return;
        }

        const personaResponse = await authedFetch("/api/profile/me", {
          signal: controller.signal,
        });
        if (personaResponse.status === 401) {
          router.replace("/login");
          return;
        }
        if (personaResponse.status === 403) {
          router.replace("/gate");
          return;
        }
        if (!personaResponse.ok) {
          throw new Error("Unable to load persona");
        }

        const nextPersona = await readJson<Persona>(personaResponse);
        setPersona(nextPersona);
        setPersonaForm(formFromPersona(nextPersona));
        await loadMemberDirectory(null, controller.signal);
      } catch (error) {
        if (error instanceof UnauthenticatedError) {
          router.replace("/login");
        } else if (
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          setErrorMessage("멤버십 또는 프로필 정보를 불러오지 못했습니다.");
        }
      }
    };

    void loadMembership();
    return () => controller.abort();
  }, [authedFetch, loading, router, session]);

  const memberCountLabel = membersNextCursor
    ? `${members.length}+`
    : String(members.length);

  return (
    <main className={`page-main ${styles.memberPage}`}>
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
                    action={
                      isEditingPersona ? (
                        <Button
                          type="button"
                          tone="ghost"
                          onClick={closePersonaEditor}
                        >
                          취소
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          tone="secondary"
                          onClick={openPersonaEditor}
                          disabled={persona === undefined}
                        >
                          편집
                        </Button>
                      )
                    }
                  >
                    {isEditingPersona ? (
                      <form
                        className={styles.personaForm}
                        onSubmit={(event) => void handlePersonaSubmit(event)}
                      >
                        <Field
                          label="핸들"
                          htmlFor="persona-handle"
                          hint="3-24자, 영문 소문자·숫자·_·-"
                        >
                          <input
                            id="persona-handle"
                            maxLength={24}
                            value={personaForm.handle}
                            onChange={(event) =>
                              setPersonaForm((current) => ({
                                ...current,
                                handle: event.target.value,
                              }))
                            }
                          />
                        </Field>
                        <Field
                          label="표시 이름"
                          htmlFor="persona-display-name"
                          hint="40자 이내"
                        >
                          <input
                            id="persona-display-name"
                            maxLength={40}
                            value={personaForm.displayName}
                            onChange={(event) =>
                              setPersonaForm((current) => ({
                                ...current,
                                displayName: event.target.value,
                              }))
                            }
                          />
                        </Field>
                        <Field
                          label="소개"
                          htmlFor="persona-bio"
                          hint="160자 이내, 본인이 직접 쓴 짧은 소개"
                        >
                          <textarea
                            id="persona-bio"
                            maxLength={160}
                            value={personaForm.bio}
                            onChange={(event) =>
                              setPersonaForm((current) => ({
                                ...current,
                                bio: event.target.value,
                              }))
                            }
                          />
                        </Field>
                        <div className={styles.personaActions}>
                          <Button type="submit" disabled={personaSaving}>
                            {personaSaving ? "저장 중" : "저장"}
                          </Button>
                          <Button
                            type="button"
                            tone="ghost"
                            onClick={closePersonaEditor}
                            disabled={personaSaving}
                          >
                            취소
                          </Button>
                        </div>
                        {personaError ? (
                          <p className="form-message" role="alert">
                            {personaError}
                          </p>
                        ) : null}
                      </form>
                    ) : (
                      <>
                        <ListRow
                          leading={<Avatar label={personaMark(persona)} />}
                          title={personaTitle(persona)}
                          description={personaDescription(persona)}
                          meta={`시작일 ${formatDate(membership.issuedAt)}`}
                        />
                        {personaMessage ? (
                          <p
                            className="form-message success-message"
                            role="status"
                          >
                            {personaMessage}
                          </p>
                        ) : null}
                      </>
                    )}
                  </Section>

                  <Section
                    title="Members"
                    description="활성 멤버의 공개 페르소나"
                    action={<Badge>{memberCountLabel}</Badge>}
                  >
                    {membersLoading ? (
                      <EmptyState>멤버를 불러오는 중입니다.</EmptyState>
                    ) : null}
                    {!membersLoading && membersError ? (
                      <div className={styles.directoryState}>
                        <p className="form-message" role="alert">
                          {membersError}
                        </p>
                        <Button
                          type="button"
                          tone="secondary"
                          onClick={() => void loadMemberDirectory()}
                        >
                          다시 시도
                        </Button>
                      </div>
                    ) : null}
                    {!membersLoading && !membersError && members.length === 0 ? (
                      <EmptyState>표시할 멤버가 아직 없습니다.</EmptyState>
                    ) : null}
                    {!membersLoading && !membersError && members.length > 0 ? (
                      <>
                        <div className={styles.directoryList}>
                          {members.map((member) => (
                            <ListRow
                              key={member.handle}
                              title={memberTitle(member)}
                              description={memberDescription(member)}
                              meta={member.isMe ? "내 프로필" : undefined}
                              trailing={
                                member.isMe ? (
                                  <Badge tone="success">나</Badge>
                                ) : (
                                  <Link
                                    className={styles.rowAction}
                                    href={`/member/${
                                      encodeURIComponent(member.handle)
                                    }`}
                                  >
                                    보기
                                  </Link>
                                )
                              }
                            />
                          ))}
                        </div>
                        {membersNextCursor ? (
                          <div className={styles.directoryActions}>
                            <Button
                              type="button"
                              tone="secondary"
                              onClick={() =>
                                void loadMemberDirectory(membersNextCursor)}
                              disabled={membersLoadingMore}
                            >
                              {membersLoadingMore ? "불러오는 중" : "더 보기"}
                            </Button>
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </Section>
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
                      <ListRow
                        title="로그아웃"
                        description="이 기기에서 계정을 닫습니다."
                        trailing={
                          <button
                            className={styles.rowAction}
                            type="button"
                            onClick={() => void handleSignOut()}
                          >
                            로그아웃
                          </button>
                        }
                      />
                      <ListRow
                        title="입장 현황"
                        description="신청 상태와 다음 단계를 확인합니다."
                        trailing={
                          <Link className={styles.rowAction} href="/gate">
                            열기
                          </Link>
                        }
                      />
                      <ListRow
                        title="내 멤버십"
                        description={`활성 · ${membership.tier} · 시작일 ${
                          formatDate(membership.issuedAt)
                        }`}
                        trailing={<Badge tone="success">활성</Badge>}
                      />
                      <ListRow
                        title="내 프로필 (페르소나)"
                        description="내 소개와 공개 범위"
                        trailing={
                          <button
                            className={styles.rowAction}
                            type="button"
                            onClick={openPersonaEditor}
                            disabled={persona === undefined}
                          >
                            편집
                          </button>
                        }
                      />
                      <ListRow
                        title="멤버 디렉터리"
                        description="활성 멤버의 공개 프로필을 봅니다."
                        trailing={
                          <button
                            className={styles.rowAction}
                            type="button"
                            onClick={() => setActiveTab("members")}
                          >
                            열기
                          </button>
                        }
                      />
                    </div>
                    {signOutError ? (
                      <p className="form-message" role="alert">
                        {signOutError}
                      </p>
                    ) : null}
                  </Section>

                  {disabledMoreGroups.filter((group) => group.rows.length > 0)
                    .map((group) => (
                    <Section key={group.title} title={group.title}>
                      <div className={styles.moreList}>
                        {group.rows.map((row) => (
                          <DisabledMoreRow
                            key={row.label}
                            label={row.label}
                            description={row.description}
                            {...(row.badge ? { badge: row.badge } : {})}
                          />
                        ))}
                      </div>
                    </Section>
                  ))}

                  <Section title="앱">
                    <div className={styles.moreList}>
                      <ListRow
                        title="앱 설치"
                        description="홈 화면에 SoulBound를 추가합니다."
                        trailing={<InstallPrompt />}
                      />
                      {appInfo.map((item) => (
                        <ListRow
                          key={item.label}
                          title={item.label}
                          description={item.description}
                          trailing={<Badge>{item.badge}</Badge>}
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
