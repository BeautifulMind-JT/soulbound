"use client";

import type { Persona } from "@soulbound/core";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import {
  Badge,
  EmptyState,
  LinkButton,
  ListRow,
  Section,
} from "../../../components/ui";
import {
  UnauthenticatedError,
  useAuth,
} from "../../../lib/auth-provider";
import { readJson } from "../../../lib/api-response";
import styles from "../page.module.css";

interface MemberPersona extends Persona {
  readonly handle: string;
  readonly isMe: boolean;
}

function memberTitle(member: MemberPersona): string {
  return member.displayName ?? "익명 멤버";
}

function memberDescription(member: MemberPersona): string {
  return `@${member.handle}${member.bio ? ` · ${member.bio}` : ""}`;
}

export default function MemberDetailPage() {
  const params = useParams<{ handle: string }>();
  const router = useRouter();
  const { session, loading, authedFetch } = useAuth();
  const [member, setMember] = useState<MemberPersona | null>(null);
  const [isLoadingMember, setIsLoadingMember] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!session) {
      router.replace("/login");
      return;
    }

    const handle = params.handle;
    if (!handle) {
      setErrorMessage("멤버를 찾을 수 없습니다.");
      setIsLoadingMember(false);
      return;
    }

    const controller = new AbortController();
    const loadMember = async () => {
      setIsLoadingMember(true);
      setErrorMessage("");
      try {
        const response = await authedFetch(
          `/api/members/${encodeURIComponent(handle)}`,
          { signal: controller.signal },
        );
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (response.status === 403) {
          router.replace("/gate");
          return;
        }
        if (response.status === 404) {
          setMember(null);
          setErrorMessage("멤버를 찾을 수 없습니다.");
          return;
        }
        if (!response.ok) {
          throw new Error("Unable to load member");
        }

        setMember(await readJson<MemberPersona>(response));
      } catch (error) {
        if (error instanceof UnauthenticatedError) {
          router.replace("/login");
        } else if (
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          setErrorMessage("멤버 정보를 불러오지 못했습니다.");
        }
      } finally {
        setIsLoadingMember(false);
      }
    };

    void loadMember();
    return () => controller.abort();
  }, [authedFetch, loading, params.handle, router, session]);

  return (
    <main className={`page-main ${styles.memberDetail}`}>
      <div className={styles.memberDetailShell}>
        <div className={styles.detailActions}>
          <LinkButton href="/member" tone="secondary">멤버로 돌아가기</LinkButton>
        </div>

        <Section
          title="멤버"
          description="공개 페르소나"
          action={member?.isMe ? <Badge tone="success">나</Badge> : null}
        >
          {isLoadingMember && !errorMessage ? (
            <EmptyState>멤버 정보를 불러오는 중입니다.</EmptyState>
          ) : null}
          {!isLoadingMember && errorMessage ? (
            <EmptyState>{errorMessage}</EmptyState>
          ) : null}
          {!isLoadingMember && member && !errorMessage ? (
            <ListRow
              title={memberTitle(member)}
              description={memberDescription(member)}
              meta="공개 페르소나"
            />
          ) : null}
        </Section>
      </div>
    </main>
  );
}
