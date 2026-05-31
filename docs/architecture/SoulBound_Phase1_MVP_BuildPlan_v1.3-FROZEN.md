# SoulBound Phase 1 — MVP 기획안 & 바이브코딩 워크플로우

```text
문서: SoulBound Phase 1 MVP Build Plan + Vibe-Coding Workflow
버전: v1.3-FROZEN — Admission Flow Canon + Chain-Neutral Ledger  ★ DESIGN FROZEN — Start Cline Task 1
       (v1.2-FROZEN 기반 surgical patch: Persona Clip + Admission Underwriting +
        Sui 탈명사화(chain-neutral) + grantSoul→issueActivationStake.
        상세 diff: docs/V1.3_CHANGESET.md.)
       ※ Persona Clip retention: terminal admission state(approved/rejected/withdrawn/expired)
         도달 즉시 raw media 삭제, draft 24h 미제출 clip도 삭제 (data minimization / 검열저항 Northstar 정합).
기준 문서: 00_INDEX / L1~L4 Canvas / 05 Northstar / Phase1 Implementation Spec / Executive Summary
대상 범위 (P0): 입장심사 + 멤버십 + Admin 검토
전제: 클린 스타트, 모노레포 신규 생성
파이프라인: Cowork(설계·최종감사) → Cline+GLM(빌드) → Codex(1차 감사) → Cowork(최종 감사)
```

---

## ★ 최우선 원칙 (THE BUILD GATE)

```text
P0에서 기능보다 중요한 산출물은 네 가지다:
  ① DB 권한 경계 (RLS + service-role 분리)
  ② 포트/어댑터 경계 (domain은 인프라를 모른다)
  ③ plaintext 부재 (messages·audit·outbox·log 어디에도 평문/키 없음)
  ④ audit/outbox 흔적 (모든 상태변경과 외부효과는 기록을 남긴다)

UI가 완벽히 돌아가더라도, 이 네 가지 중 하나라도 깨지면 그 빌드는 '실패'다.
"일단 되는 앱"은 P0의 목표가 아니다. "나중에 도망갈 수 있는 앱"이 목표다.
```

---

## 0. 이 문서의 사용법

이 문서는 세 개의 AI 도구가 **각자 다른 장(章)을 입력으로 받도록** 설계되었다.

```text
Cowork (설계자/최종감사):  전체 문서 + §1, §2, §3, §12
Cline + GLM (빌더):       §4, §5, §6, §7, §8, §9 + §11의 Cline 가드레일
Codex (1차 감사자):       §10 감사 체크리스트 + §3 불변식
```

읽는 순서는 §1 → §3 → §4 순이다. §1~§3은 "왜"와 "절대 규칙", §4 이후는 "무엇을 어떻게"다.

---

## 1. P0 범위 확정 — 무엇을 만들고 무엇을 미루는가

### 1.1 P0에서 실제로 구현하는 것

```text
인증/계정:
- 이메일 기반 회원가입 / 로그인 (Supabase Auth)
- 프로필 생성 (persona handle, bio, taste tags)

입장심사 (Admission):
- 입장 신청서 작성/제출
- Persona Profile 작성 / Application Statement 작성
- Persona Clip 선택 제출 (앱내 녹화 only, 업로드·미리보기·재촬영·편집 없음,
  녹화 실패·권한거부 시 건너뛰기 가능, 미제출해도 신청 제출 가능 — INV-PC-01)
- 신청 상태 lifecycle (draft → submitted → under_review → needs_more_info → approved/rejected)
- 신청 상태 조회 페이지

Admin 검토:
- 검토 큐 (review queue)
- 검토 시작 / 추가정보 요청 / 승인 / 거절 (모두 사유 필수)
- 권한 분리 (applicant / member / reviewer / admin)

멤버십:
- 승인 시 membership row 생성
- profiles.membership_status = active 전이
- My Pass / 멤버십 상태 표시

기록/감사 (검열저항의 뼈대):
- admission_events (상태변경 이벤트)
- audit_logs (모든 admin 액션, hash chain 필드 포함)
- outbox_events (외부 연동 큐의 형태만 설치. P0 메인 브랜치는 internal/noop only, 외부 원장은 Task 10 옵션 브랜치)
```

### 1.2 P0에서 "스키마/인터페이스만" 두고 구현은 미루는 것

```text
- E2EE 메시지 (direct_messages + key envelope 테이블은 P0에 ciphertext-only 스키마로 생성,
  송수신 로직·route·API는 P1)
- Support / Challenge (데이터 모델 + UI 슬롯만)
- SOUL / Staking (soul_balances, soul_ledger_events 테이블만)
- Court / SlashCase / DecisionReceipt (테이블 정의만, stub)
- 외부 원장 발급 (LedgerPort 인터페이스 + NoopLedgerAdapter 기본값, chain-neutral)
- Admission Underwriting / Activation SOUL (아래 1.2.3 — schema/interface/policy only)
```

#### 1.2.3 ⚠️ Admission Underwriting / Activation SOUL — 캐논은 박되 경제 로직은 미구현

```text
캐논 (지금 schema/interface/policy 로 박는다):
  - 후보자는 SOUL 없이 맨손으로 가입신청한다 (입장권을 사는 게 아니라 신뢰를 얻는다).
  - 기존 고신뢰·고스테이크 멤버가 Support/Challenge 로 stake-backed review 를 수행한다.
  - 심사 참여자의 Staked SOUL 에서 Review Toll/Bond 가 발생할 수 있다.
  - 승인된 후보자는 Review Toll Pool 에서 Activation SOUL 을 받을 수 있고,
    즉시 DefaultStakedSoul 로 lock 된다.
  - Activation SOUL ≠ 보상/에어드랍/수익/양도토큰. 신규 발행 없음. Review Toll/준비금에서만.

P0 미구현 (스키마·인터페이스·정책으로만 준비):
  - 실제 Review Toll 계산, Support/Challenge Bond lock, Activation SOUL 지급,
    supporter liability slash 는 구현하지 않는다.
  - ReviewPosition / AdmissionTollPool / DefaultStakedSoul 은 stub 테이블/타입으로만 자리를 둔다.
  - LedgerPort.issueActivationStake 는 인터페이스만 존재, 메인 구현체는 Noop.
```

#### 1.2.1 ⚠️ messages 관련 — 테이블만, route/API는 절대 금지

GLM/Cline이 "스키마가 있으니 간단 채팅을 붙이자"로 폭주하는 것을 막는다.

```text
P0에서 만든다:        direct_messages, conversation_key_envelopes 테이블 (ciphertext-only)
P0에서 만들지 않는다: /messages, /chat, /inbox, /conversations 등 모든 채팅 route
P0에서 만들지 않는다: 메시지 송신/수신 API route 일체
P0에서 만들지 않는다: 메시지 관련 UI 컴포넌트 일체 (목록·말풍선·작성창)
```

#### 1.2.2 ⚠️ 외부 원장 — chain-neutral, MVP 필수 루트와 PoC 루트를 물리적으로 분리

```text
P0 기본값 (메인 브랜치):
  - LedgerPort = NoopLedgerAdapter (모든 호출 status:"skipped")
  - externalLedgerEnabled = false
  - flag OFF면 external_ledger outbox event를 아예 enqueue 하지 않는다
    (created_but_not_processed 상태조차 만들지 않음 — 깔끔하게 "없음")
  - 어떤 concrete-chain SDK 도 메인에 import 하지 않는다 (chain-neutral)

P0 옵션 (별도 브랜치, M6 이후에만):
  - ExternalLedgerAdapter 구현 (어떤 체인을 쓸지는 다음 라운드에 결정)
  - externalLedgerEnabled = true 일 때만 outbox enqueue + process
  - 이 브랜치는 메인 MVP 머지 전 절대 합치지 않는다

핵심: P0 는 특정 체인(예: Sui)에 결합하지 않는다. 메인 빌드에서 외부 원장은
      '존재하지 않는 것처럼' 동작한다 (Noop). 체인 선택은 Northstar 결정 사항이다.
```

### 1.3 P0에서 절대 만들지 않는 것 (혼동 방지)

```text
- ICP Canister 백엔드
- Filecoin / IPFS / Arweave 실제 호출
- 실제 토큰 경제, DEX/CEX, 전송
- 자동 슬래싱, 비가역 제재
- 미디어/음성/영상 메시지
  단, Admission Persona Clip은 메시지 기능이 아니라 가입심사 자료이므로 예외로 한다.
  Persona Clip은 선택 제출, 앱내 녹화 only, 업로드/미리보기/재촬영/편집/공개피드 없음 (INV-PC-02).
- 초대코드 / 추천인 시스템
- AI 입장 점수, AI 평문 모더레이션
```

---

## 2. 가장 중요한 단일 제약 — 검열저항을 "기초에 박는다"

JT가 강조한 "빌드 기초에서부터 검열저항 파이널클럽형 메신저/소셜바운딩앱 요소를 반드시 넣어둬야 한다"는 요구는, **나중에 추가할 수 없는 것과 추가할 수 있는 것을 구분**하는 문제다.

원리:

```text
검열저항·E2EE·relayer-not-sovereign 은 '기능'이 아니라 '데이터 형태와 권한 형태'다.
기능은 나중에 붙일 수 있다. 데이터 형태와 권한 형태는 나중에 바꾸려면 전부 갈아엎어야 한다.
따라서 P0에서 기능은 미뤄도, 형태는 미루면 안 된다.
```

### 2.1 P0에서 양보 불가 (Irreversible Foundations)

이 다섯 가지는 P0 첫 커밋부터 강제한다. 하나라도 빠지면 Phase 2 마이그레이션 비용이 비선형적으로 증가한다.

```text
[F1] 평문 부재 원칙 (messages 테이블에 국한되지 않는다)
  - direct_messages 테이블에 plaintext 컬럼이 존재하면 안 된다 (P0에 채팅을 안 만들어도 스키마는 ciphertext-only).
  - 서버가 보관하는 키 관련 데이터는 '각 참여자 public key로 암호화된 conversation key envelope'뿐이다.
    서버는 평문 conversation key / 복호화 키를 절대 보관하지 않는다.
  - ⭐ 평문 부재는 audit_logs / outbox_events / 서버 로그 전체에 적용된다.
    audit_logs.metadata, outbox_events.payload 에 신청서 전문·메시지 평문·AI 인터뷰 원문·
    복호화 키·민감 첨부 원본을 넣지 않는다. (저장 가능: id, status transition, reason_code,
    policy_version, hash/reference 만)

[F2] domain/ports/adapters 경계
  - 모든 외부 인프라(Supabase, 외부 원장)는 adapter 뒤에 숨는다.
  - UI/도메인 로직은 Supabase SDK, 외부 원장 SDK를 직접 호출하지 않는다.
  - 이것이 Phase 2에서 Supabase→ICP 교체를 가능하게 하는 유일한 장치다.

[F3] outbox 기반 사이드이펙트
  - 모든 외부 시스템 호출(외부원장/ICP/Filecoin/Arweave/Notification)은 직접 실행하지 않고 outbox_events를 거친다.
  - P0 메인 브랜치에서는 실제 외부 target을 처리하지 않는다. target=internal 만 noop 처리한다.
  - P0 메인 브랜치의 LedgerPort는 NoopLedgerAdapter이며, target='external_ledger' 이벤트도 기본적으로 생성하지 않는다.
  - target='external_ledger' 처리는 Task 10 옵션 브랜치에서만 활성화한다.
  - ICP/Filecoin/Arweave는 P0 전 구간에서 schema-level placeholder다 (들어오면 dead_letter/failed).

[F4] 이벤트 소싱 흔적 (Admin is not sovereign)
  - 모든 상태 변경은 admission_events 를 남긴다.
  - 모든 admin 액션은 audit_logs 를 남기며, hash/previous_hash 컬럼을 미리 둔다 (append-only chain 준비).
  - admin이 사유 없이 상태를 바꿀 수 있는 경로가 존재하면 안 된다.

[F5] 마이그레이션 필드 + 테이블 선설치
  - policy_version, policy_snapshot_hash, evidence_hash, chain_reference,
    ipfs_cid, filecoin_deal_id, arweave_tx_id, ledger_tx_ref 컬럼을 미리 둔다.
  - conversation_key_envelopes 테이블을 미리 둔다 (E2EE 자연 부착용, §5.2.1).
  - persona_clip_assets 테이블 + admission_applications.persona_clip_asset_id/persona_clip_hash (nullable) 를 둔다.
  - audit_logs.hash / previous_hash 컬럼을 미리 둔다 (chain은 global append-only, §5.4).
  - P0에선 null/미사용이지만 컬럼·테이블은 존재한다. 나중에 ALTER로 추가하면 데이터 이전이 깨진다.
```

### 2.2 P0에서 양보 가능 (Deferrable)

```text
[D1] 실제 E2EE 암호화 구현 → P1 (스키마만 P0)
[D2] Support/Challenge 거버넌스 로직 → P1 (모델+슬롯만 P0)
[D3] 외부 원장 실제 발급 → P0 옵션 (NoopLedgerAdapter가 기본, 켜면 ExternalLedgerAdapter)
[D4] audit hash chain 실제 해싱 → P1 (컬럼은 P0, 채우는 건 P1)
[D5] Court/Slash 절차 → P1+ (테이블 정의만 P0)
```

### 2.3 검열저항 관점에서 P0가 지켜야 할 "법적 표현" 경계

05 Northstar의 핵심 — 우리는 "법적 의무가 없다"고 주장하지 않는다. **애초에 평문과 키를 보유하지 않도록 설계**한다. 이건 코드가 아니라 UX 카피·정책 문서에 반영된다.

```text
하지 말 것 (P0 카피/문서에서 금지):
  "수사기관도 못 잡는 앱" / "법적 제출의무 없음 보장" / "완전 면책"

할 것:
  "SoulBound는 메시지 평문과 복호화키를 보관하지 않도록 설계합니다.
   따라서 운영팀은 대화 내용을 임의로 열람·복구할 수 없습니다."
```

---

## 3. 시스템 불변식 (Invariants) — Codex/Cowork 감사 기준

아래는 코드 리뷰에서 **위반 시 무조건 반려**하는 규칙이다. Codex 1차 감사와 Cowork 최종 감사가 공유하는 단일 진실원이다.

```text
INV-01  React/Vue 컴포넌트에 `supabase.from(...)` / `supabase.storage` 직접 호출 0건.
INV-02  UI 레이어에 `<chain>Client.signAndExecuteTransaction(...)` 직접 호출 0건 (지갑 connect UI 제외).
INV-03  Application Service는 Supabase SDK를 직접 import 하지 않는다. Repository 인터페이스만 의존.
INV-04  direct_messages(또는 messages) 테이블에 plaintext/body_plain 류 컬럼 0개.
INV-05  admission 상태 변경 시 admission_events insert 가 같은 트랜잭션/유스케이스에 포함된다.
INV-06  모든 admin 액션(approve/reject/needs_more_info/role change)에 audit_logs insert + reason 필수.
INV-07  외부 시스템 호출은 outbox_events 를 경유한다. service 안에서 직접 await externalLedgerAdapter... 금지.
INV-08  중요 write(submit/approve/reject/membership issue/ledger issue)에 idempotency_key 존재.
INV-09  API route는 service를 호출한다. route 안에서 supabase.from(...).update() 직접 0건.
INV-10  RLS: audit_logs / outbox_events 는 client 직접 접근 정책이 존재하지 않는다 (server-only).
INV-11  비관리자가 approve/reject API를 호출하면 403. (권한 체크는 service 진입부에서.)
INV-12  비인가 사용자가 타인의 application을 조회하면 RLS가 차단한다.
INV-13  외부 원장 발급 실패가 admission approval 을 롤백하지 않는다 (membership은 active 유지).
INV-14  feature flag: icpBackendEnabled / filecoinStorageEnabled / arweave... 는 코드상 false 고정.
INV-15  마이그레이션 필드(F5 목록)가 스키마에 모두 존재한다 (null 허용이라도 컬럼은 있어야 함).
INV-16  audit_logs.metadata / outbox_events.payload 에 원문(신청서 전문·메시지 평문·AI원문·키) 0건. id/transition/reason_code/policy_version/hash만.
INV-17  service role key 는 NEXT_PUBLIC_ 접두사로 노출되지 않는다. 브라우저 번들에 service role client 0건.
INV-18  approve/reject/requestMoreInfo 의 다단계 write 는 Postgres function(rpc) 한 트랜잭션으로 묶인다 (순차 JS 호출 금지).
INV-19  conversation_key_envelopes 에 평문 conversation key / 복호화 키 컬럼 0개. wrapped envelope만.
INV-20  P0 메인 브랜치에 채팅 route(/messages,/chat,/inbox,/conversations)·메시지 송수신 API 0건. (§1.2.1)
INV-21  P0 메인 브랜치에 ExternalLedgerAdapter 구현 0건. 기본 LedgerPort = Noop. (§1.2.2)
INV-22  audit_logs/admission_events 의 사유는 reason_code(enum)만. 자유서술 reason/review_summary 0건. (§7.4)
INV-23  rpc 함수는 security definer + set search_path='' + anon/authenticated execute REVOKE. 함수 내 COMMIT/ROLLBACK 0건. (§5.3.3)
INV-24  apps/web 코드에서 direct_messages / conversation_key_envelopes 참조 0건 (테이블 존재≠앱 접근). (§1.2.1)
INV-25  chain-neutral: 메인 코드(packages/apps)에 concrete-chain SDK(@mysten/aleo/aztec/zcash) import 0건, packages/core/src에 'sui' 리터럴 0건.
INV-PC-01  Persona Clip 부재(undefined/null)가 신청 제출을 막지 않는다.
INV-PC-02  Persona Clip은 admission artifact이지 message/media 기능이 아니다.
INV-PC-03  녹화는 optional + 앱내(in-app) only.
INV-PC-04  초기 MVP: 업로드 fallback / 미리보기 / 재촬영 / 편집 없음.
INV-PC-05  Persona Clip 저장 접근은 StoragePort/adapter 경계를 거친다 (supabase.storage 직접호출 0건).
INV-PC-06  Persona Clip 원본/transcript/storage_path는 audit_logs / outbox_events / 서버로그 / analytics / reviewer notes / AI payload에 0건. 이들 표면엔 persona_clip_asset_id / content_hash / status / deletion_reason / deleted_at / policy_version 만 허용. signed URL·storage token·raw bytes·base64·screenshot·clip 요약 전부 금지. (storage_path는 persona_clip_assets 또는 StoragePort 경계 안에서만 존재)
INV-PC-07  Persona Clip은 점수 입력이 아니며 자동 승인/거절을 유발하지 않는다.
INV-PC-08  Persona Clip 열람은 applicant + 인가된 reviewer/admin으로 한정 (member/anon 조회 0건).
INV-PC-09  Persona Clip raw media 보존: terminal admission state(approved/rejected/withdrawn/expired) 도달 즉시 삭제 대상. draft 24h 미제출 clip도 삭제 대상. 영구 보존 금지.
```

---

## 4. 기술 스택 & 모노레포 구조

### 4.1 스택 확정 (P0)

```text
Framework:   Next.js 16 (App Router), TypeScript strict
배포:        Vercel
DB/Auth:     Supabase (PostgreSQL + Auth + RLS)
Storage:     Supabase Storage (adapter 뒤에 숨김)
Validation:  zod
Ledger:      LedgerPort → 기본 Noop, 옵션 External(chain-neutral)
패키지매니저: pnpm (모노레포 workspace)
테스트:      vitest (단위) + 수동 QA 체크리스트
```

### 4.2 폴더 구조 (Cline가 그대로 생성해야 함)

```text
soulbound/
  apps/
    web/
      app/
        page.tsx                      # Landing (잠긴 문)
        login/page.tsx
        signup/page.tsx
        gate/page.tsx                 # 입장 절차 안내 허브
        apply/page.tsx                # 신청서
        apply/status/page.tsx         # 내 신청 현황
        member/page.tsx               # 멤버 홈 (승인 후)
        admin/applications/page.tsx           # 검토 큐
        admin/applications/[id]/page.tsx      # 검토 상세
        api/
          admission/applications/route.ts            # POST 생성
          admission/applications/me/route.ts         # GET 내 신청
          admission/applications/[id]/route.ts       # GET 단건
          admission/applications/[id]/submit/route.ts
          admission/persona-clip/route.ts            # Persona Clip 생성/삭제 (StoragePort 경유)
          admin/applications/[id]/review/route.ts
          admin/applications/[id]/approve/route.ts
          admin/applications/[id]/reject/route.ts
          admin/applications/[id]/persona-clip-url/route.ts  # reviewer/admin signed URL 발급
          membership/me/route.ts
          outbox/process/route.ts                    # admin-only 또는 cron
      components/
        admission/  membership/  admin/  gate/  layout/  shared/
        admission/persona-clip-recorder.tsx          # 앱내 녹화 only. supabase.storage 직접호출 금지.

  packages/
    core/                              # ⭐ 프레임워크 비의존 도메인 (이게 자산이다)
      src/
        domain/
          admission/
            types.ts
            admission-service.ts
            admission-policy.ts
          membership/
            types.ts
            membership-service.ts
          audit/
            types.ts
            audit-service.ts
          outbox/
            types.ts
            outbox-service.ts
          ledger/
            types.ts
          storage/
            types.ts
        ports/
          auth-port.ts
          admission-repository.ts
          membership-repository.ts
          audit-log-repository.ts
          outbox-repository.ts
          ledger-port.ts
          storage-port.ts
          notification-port.ts
        application/
          container.ts                 # 의존성 조립 (DI)
          errors.ts
          result.ts                     # Result<T,E> 패턴
        config/
          feature-flags.ts
    adapters/
      src/
        supabase/
          client.ts  server.ts
          supabase-auth-adapter.ts
          supabase-admission-repository.ts
          supabase-membership-repository.ts
          supabase-audit-log-repository.ts
          supabase-outbox-repository.ts
          supabase-storage-adapter.ts
        noop/
          noop-ledger-adapter.ts          # ⭐ P0 메인의 기본 LedgerPort 구현
          noop-notification-adapter.ts
        # ⚠️ external/ 디렉토리는 P0 메인 브랜치에 생성하지 않는다.
        # packages/adapters/src/external/external-ledger-adapter.ts
        #   → Task 10 옵션 브랜치에서만 생성한다 (INV-21).

  supabase/
    migrations/
      0001_phase1_schema.sql
      0002_phase1_rls.sql
    seed.sql

  docs/
    policies/
      admission-policy.phase1-v0.95.md
      membership-policy.phase1-v0.95.md
      reviewer-guideline.phase1-v0.95.md
    architecture/
      phase-1-blueprint.md
```

> **핵심 분리 원칙**: `packages/core`는 React도 Supabase도 모른다. 순수 TypeScript다. 이게 "Supabase가 영원한 왕이 되지 않게" 만드는 물리적 장치다. `apps/web`은 UI와 API route만, `packages/adapters`만 Supabase/외부원장을 안다.

---

## 5. 데이터 모델 (P0 마이그레이션)

`supabase/migrations/0001_phase1_schema.sql` 에 들어갈 핵심 테이블. (Phase1 Spec §5와 동일 골격, F5 필드 포함.)

### 5.1 P0 필수 테이블

```text
profiles               계정 + persona + membership_status + wallet_address
admission_applications 신청서 + status + policy_version + policy_snapshot_hash + ledger_ticket_ref
admission_events       상태변경 이벤트 (actor, from/to, reason, idempotency_key)
memberships            승인 후 멤버십 (tier, source_application_id, ledger_credential_ref)
audit_logs             모든 액션 (actor, action, entity, hash, previous_hash)
outbox_events          외부 연동 큐 (target, status, idempotency_key, attempt_count)
```

### 5.2 P0 스키마-only 테이블 (구현은 P1+, 형태는 지금)

```text
soul_balances              (available/locked, testnet_ledger_object_ref)
soul_ledger_events         (event_type, amount, chain_*, idempotency_key)
evidence_files             (storage_provider, content_hash, ipfs_cid, filecoin_deal_id, arweave_tx_id)
direct_conversations       (status: pending/accepted/declined/expired/blocked/closed)
direct_messages            ⚠️ ciphertext-only. plaintext 컬럼 절대 금지.
conversation_key_envelopes ⚠️ E2EE 준비 — 참여자 public key로 암호화된 conversation key envelope만 보관
reports                    (reason_code, status, evidence 메타)
slash_cases                (state machine, stub)
decision_receipts          (case_id, decision_hash, appeal_deadline, stub)
emergency_actions          (action_type, reason_code, review_required, stub)
user_intent_authorizations (action_type, payload_hash, expires_at, consumed_at, stub)
```

> direct_messages 를 P0에 비워두더라도 만드는 이유: **나중에 만들면 누군가 plaintext 컬럼을 넣을 위험**이 있다. 지금 ciphertext-only로 못 박아두면 그 사고를 구조적으로 막는다. (F1/INV-04)

#### 5.2.1 conversation_key_envelopes — E2EE 자연 부착을 위한 P0 선설치

`direct_messages`만 ciphertext-only로 두면 부족하다. 나중에 E2EE를 붙일 때 "키를 어디에 어떻게 두는가"가 비어 있으면 결국 스키마를 다시 갈아엎게 된다. 서버가 **보관해도 되는 것은 envelope 뿐**이라는 형태를 지금 박는다.

```sql
create table conversation_key_envelopes (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references direct_conversations(id) on delete cascade,
  recipient_id uuid not null references profiles(id) on delete cascade,
  recipient_device_id uuid not null,            -- 한 사용자의 기기 식별 (iPhone/Mac/Web 각각)
  recipient_device_pubkey text not null,        -- 그 기기 공개키
  wrapped_key bytea not null,                    -- 그 공개키로 암호화된 conversation key (envelope)
  algo text not null default 'x25519-xsalsa20-poly1305',
  key_epoch integer not null default 0,          -- 키 회전 대비
  created_at timestamptz not null default now(),
  -- ⚠️ multi-device: 같은 사용자가 여러 기기를 쓰므로 device 차원을 unique에 포함해야 한다.
  unique (conversation_id, recipient_id, recipient_device_id, key_epoch)
);
-- ⚠️ 평문 conversation key / 복호화 키 컬럼은 존재하지 않는다.
-- 서버는 wrapped_key(envelope)만 본다. 풀 수 없다.
```

> P0에서는 이 테이블에 아무것도 쓰지 않는다(채팅 미구현). 그러나 형태가 존재하므로 P1에서 E2EE는 "데이터 모델 변경 없이" 부착된다. (F1)

#### 5.2.2 persona_clip_assets — Persona Clip (선택 admission artifact, 단명)

```sql
create table persona_clip_assets (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references profiles(id) on delete cascade,
  application_id uuid references admission_applications(id) on delete set null,
  storage_provider text not null default 'supabase',
  storage_path text not null,          -- 경로만 기록. raw bytes/transcript는 어디에도 기록 금지 (INV-PC-06)
  content_hash text not null,
  mime_type text not null,
  size_bytes bigint not null,
  duration_seconds integer,
  status text not null default 'attached'
    check (status in ('draft','attached','deleted')),
  deletion_reason text
    check (
      deletion_reason is null or deletion_reason in (
        'draft_abandoned',
        'application_approved',
        'application_rejected',
        'application_withdrawn',
        'application_expired',
        'policy_cleanup'
      )
    ),
  delete_after timestamptz,            -- draft 24h 미제출 / terminal state 도달 시 삭제 대상
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table admission_applications
  add column persona_clip_asset_id uuid null references persona_clip_assets(id),
  add column persona_clip_hash text null;
```

보존정책 (INV-PC-09 — data minimization / 검열저항 Northstar):

```text
- terminal admission state(approved / rejected / withdrawn / expired) 도달 즉시 raw media 삭제 대상.
  → 상태전이 rpc(approve/reject + withdraw + expire 워커)가 해당 clip의 delete_after를 now()로 찍고,
    삭제 워커(또는 동일 트랜잭션 후처리)가 Storage 객체를 제거하고 status='deleted', deleted_at 기록.
  → 가입절차가 끝나면 raw clip은 남지 않는다. ("안 가진 건 유출·제출당할 수 없다")
- draft에서 24h 미제출된 clip도 삭제 대상 (delete_after = created_at + 24h).
- 영구 보존 금지. persona_clip_hash(해시)만 신청서에 남을 수 있고, raw media는 남지 않는다.
- persona_clip_asset_id / persona_clip_hash 는 nullable. 부재는 validation 실패 사유가 아니다 (INV-PC-01).
- deletion_reason (비내용 메타데이터, enum): 삭제 시 기록. 허용값 =
  draft_abandoned / application_approved / application_rejected /
  application_withdrawn / application_expired / policy_cleanup.
  (자유서술 금지 — 내용 누출 방지, INV-PC-06)

storage_path 경계 (INV-PC-06):
- storage_path 는 persona_clip_assets 테이블 또는 StoragePort/adapter boundary 안에서만 존재한다.
- audit_logs / outbox_events / server logs / analytics / reviewer notes 에는 storage_path 를 넣지 않는다.
  이 표면들엔 persona_clip_asset_id / content_hash / status / deletion_reason / deleted_at / policy_version 만 허용.
- signed URL / storage token / raw bytes / base64 / transcript / screenshot / clip 요약 전부 금지.
```



#### 5.3.1 ⭐ 세 종류의 Supabase client 사용처를 분리한다

구현자가 헷갈리지 않게, P0는 client를 세 가지로 못 박는다.

```text
browser client (anon key):
  - 컴포넌트에서 직접 쓰지 않는다 (INV-01). hook/route를 통해서만 간접 사용.
  - RLS 적용 대상. 본인 데이터 read / 본인 draft 일부 필드 update 만 가능.

server user client (요청 사용자 JWT, 서버에서 생성):
  - API route에서 "현재 사용자 권한 내" 읽기에 사용.
  - RLS 적용 대상.

service role client (service role key, 서버 전용):
  - 절대 브라우저로 노출하지 않는다. NEXT_PUBLIC_ 접두사 금지.
  - 다음에만 사용: status transition, memberships 생성, audit_logs insert,
    outbox_events insert/claim/update, reviewer/admin 검토 큐 처리.
  - RLS를 우회하므로, 사용처를 service 계층 + 명시적 admin route 로만 제한.
```

#### 5.3.2 RLS 정책

```text
profiles:
  - 본인 read / 제한적 update (handle, display_name, bio, avatar_url 만)
  - active member는 타인의 공개 persona 필드만 read
  - ⚠️ membership_status, role 은 client update 금지 (service role only)

admission_applications:
  - applicant 본인 read
  - applicant 본인 draft update — 단 applicant_statement, motivation, referral_code 컬럼만
  - ⚠️ status, reviewer_id, reviewed_at, review_summary 는 client update 금지
       → status transition 은 service role route 를 통해서만 수행 (INV-09/INV-11)
  - ⚠️ review_summary 는 client read 도 금지 (관리자 내부 메모, applicant 노출 X). applicant_notice 만 노출. (§7.4)
  - reviewer/admin 큐 read 는 service role route 경유
  - ⚠️ 타인 신청서 read 차단 (INV-12)

memberships:
  - 본인 read, 공개 뱃지 read
  - insert/update/관리 는 service role only

audit_logs / outbox_events:
  - client 직접 접근 정책 자체가 없음 (select/insert/update/delete 모두 deny)
  - service role only (INV-10)

direct_messages / conversation_key_envelopes:
  - 참여자만 ciphertext envelope fetch
  - plaintext 컬럼 부재, 평문 key 컬럼 부재
  - P0에서는 어떤 route도 이 테이블에 접근하지 않음 (§1.2.1)

persona_clip_assets:
  - applicant: 본인 clip row 생성/조회/삭제 가능
  - reviewer/admin: 해당 신청서의 clip 조회 가능 (review 상세, server route 경유)
  - 일반 member / public / anon: 조회 0건 (INV-PC-08)
  - persona-clips Storage bucket = private. signed URL은 reviewer/admin 상세에서 server route로 짧게 발급.
```

#### 5.3.3 ⭐ DB 트랜잭션 경계 — approve는 원자적이어야 한다

Supabase JS 호출을 순차로 나열하면 중간 실패 시 부분 커밋이 남는다(멤버십은 생겼는데 이벤트는 안 남는 식). P0에서는 다단계 상태변경을 **Postgres function(rpc)으로 원자화**한다.

```text
approveApplication 이 건드리는 5개 write 는 하나의 트랜잭션이어야 한다:
  admission_applications update
  → memberships insert
  → profiles.membership_status update
  → admission_events insert
  → audit_logs insert

구현: supabase.rpc('approve_application_tx', {...}) 형태의 Postgres function 으로 묶는다.
주의: function 내부에 BEGIN/COMMIT/ROLLBACK 을 직접 쓰지 않는다.
      Postgres function 의 단일 호출은 하나의 transaction context 에서 실행되므로,
      함수 내부 write 중 하나라도 raise exception 으로 실패하면 전체 호출이 자동 롤백되어
      부분 커밋이 남지 않는다. (트랜잭션 제어 구문을 함수에 넣으면 오히려 꼬인다.)
outbox enqueue: (flag ON일 때만) 같은 함수 안에서, 또는 커밋 후 별도로 — 단 idempotency_key로 보호.
rejectApplication / requestMoreInfo 도 동일하게 status update + event + audit 를 한 함수로.

권장 함수 골격:
  create or replace function public.approve_application_tx(...)
  returns ...
  language plpgsql
  security definer
  set search_path = ''                  -- ⚠️ 빈 search_path 고정
  as $$
  begin
    -- 함수 본문에서는 public.table_name 처럼 schema-qualified name 사용
    -- 실패 시 raise exception → 전체 호출 롤백
  end;
  $$;

권한:
  - execute 권한을 anon / authenticated / public 에서 REVOKE 한다.
  - 필요한 server-side 경로에서만 service role 로 호출한다.
```

> M2에서 `approve_application_tx`, `reject_application_tx`, `request_more_info_tx` 세 함수를 migration에 포함. Repository의 updateStatus 는 이 rpc를 호출한다.
> (선택) 더 빡세게: `submit_application_tx` 도 추가해 submit의 application upsert + admission_events + audit 를 원자화. P0 최소 기준은 approve/reject/request_more_info 세 개면 충분하다.

### 5.4 audit hash chain — P1로 미루되 chain 규칙은 P0에 고정

해시 채우기(실제 해싱)는 P1이지만, **chain의 형태**는 P0에 정해야 나중에 일관되게 채운다.

```text
chain 형태:   global append-only chain  (entity별/actor별 아님)
이유:         조작 탐지가 목적이면 global 단일 체인이 가장 단순하고 검증이 쉽다.
컬럼:         audit_logs.hash, audit_logs.previous_hash (P0에 존재, P1에 채움)
previous_hash 조회 규칙:
  - 새 audit_logs insert 시 previous_hash = "직전(created_at, id 순) 행의 hash"
  - 빠른 조회를 위해 entity_id 에 index, 그리고 (created_at, id) 정렬 보장
  - P1에서 hash = H(previous_hash || canonical(this_row_without_hash))
P0 동작:      hash/previous_hash 는 null 로 둔다. 단 컬럼과 index는 존재한다.
```

---

## 6. 도메인 인터페이스 (포트) — `packages/core/ports`

Cline는 아래 시그니처를 **그대로** 생성한다. (Phase1 Spec §6 기반, 요약)

### 6.1 AdmissionRepository

```ts
export type AdmissionStatus =
  | "draft" | "submitted" | "under_review"
  | "needs_more_info" | "approved" | "rejected" | "withdrawn" | "expired";

// ⭐ 자유서술 reason 금지. enum 만 audit/event 에 흐른다. (§7.4)
export type AdmissionReasonCode =
  | "meets_phase1_policy"
  | "insufficient_context"
  | "mismatch_with_policy"
  | "needs_identity_clarification"
  | "duplicate_identity_suspected"
  | "applicant_withdrew"      // withdraw route
  | "application_expired";    // expire worker

export interface AdmissionRepository {
  create(input: CreateApplicationInput): Promise<AdmissionApplication>;
  findById(id: string): Promise<AdmissionApplication | null>;
  findByApplicantId(applicantId: string): Promise<AdmissionApplication[]>;
  listReviewQueue(input: { status?: AdmissionStatus; limit: number; cursor?: string }): Promise<AdmissionApplication[]>;
  updateStatus(input: {
    applicationId: string;
    actorId: string;
    fromStatus?: AdmissionStatus;
    toStatus: AdmissionStatus;
    reasonCode: AdmissionReasonCode;     // required, enum only
    applicantNotice?: string;            // applicant-facing 안내문 (선택)
    reviewSummary?: string;              // 관리자 내부 메모 (client read 금지, audit로 복사 금지)
    idempotencyKey: string;
  }): Promise<AdmissionApplication>;
}
```

### 6.2 LedgerPort (failure-tolerant)

```ts
export interface ChainReceipt {
  chain: "none" | "external";
  txRef?: string; objectRef?: string;
  status: "succeeded" | "failed" | "skipped";
  raw?: unknown;
}
export interface LedgerPort {
  issueAdmissionTicket(input: IssueAdmissionTicketInput): Promise<ChainReceipt>;
  issueMembershipCredential(input: IssueMembershipCredentialInput): Promise<ChainReceipt>;
  issueActivationStake(input: IssueActivationStakeInput): Promise<ChainReceipt>;
}
// P0 메인 브랜치 구현체: NoopLedgerAdapter only (모두 status:"skipped" 반환)
// ExternalLedgerAdapter 는 P0 메인 브랜치에 만들지 않는다.
// External ledger PoC 는 Task 10 옵션 브랜치에서만 별도 구현한다. (P0 메인에 any concrete-chain SDK import 0건, INV-21)
```

### 6.3 그 외 포트

```text
AuthPort                signUp/signIn/getSession/getUserId
MembershipRepository    create/findByUserId/updateStatus
AuditLogRepository      append(actorId, action, entityType, entityId, metadata, reasonCode, idempotencyKey)  // ⚠️ 자유서술 reason 금지, reasonCode(enum)만
OutboxRepository        enqueue / claimPending / markSucceeded / markFailed
StoragePort             put / getSignedUrl / markForDeletion  (P0: SupabaseStorageAdapter only)
NotificationPort        notify  (P0: NoopNotificationAdapter)
```

---

## 7. 애플리케이션 서비스 — 유스케이스 명세

서비스는 트랜잭션 경계이자 불변식 집행 지점이다. 각 메서드의 **반드시 일어나야 하는 일** 목록.

### 7.1 AdmissionService.submitApplication

```text
1. zod validation (statement/motivation 길이, 금지필드 부재 — orientation/phone 등)
2. 동일 applicant의 활성 application 중복 차단 (1인 1활성 신청)
3. admission_applications upsert, status = submitted, policy_version 기록
4. admission_events insert: application.submitted  (INV-05)
5. audit_logs append: actor=applicant, action=application.submit  (INV-06 적용대상 아님이나 흔적은 남김)
6. (flag on 시) outbox_events enqueue 없음 — submit엔 체인 액션 없음
7. idempotency_key = `application.submit:${applicationId}:${userId}`  (INV-08)
8. Result<AdmissionApplication, AdmissionError> 반환
```

### 7.2 AdmissionService.approveApplication

```text
1. 권한 검증: actor.role ∈ {reviewer, admin}, 아니면 403  (INV-11)
2. 상태 가드: 현재 status가 under_review 또는 needs_more_info 일 때만 approve 허용
3. ⭐ 아래 3~7을 하나의 Postgres 트랜잭션(approve_application_tx rpc)으로 원자 실행:
     - admission_applications.status = approved, reviewer_id/reviewed_at 기록
     - memberships row 생성 (tier=basic, source_application_id)
     - profiles.membership_status = active
     - admission_events insert: application.approved  (INV-05)
     - audit_logs append: reason_code 필수, 원문 금지(id/transition/reason_code/policy_version만) (INV-06/INV-16/§7.4)
   → 중간 실패 시 전부 롤백. 부분 커밋 없음.  (§5.3.3)
4. (flag ON 일 때만) outbox_events enqueue: target=external_ledger, type=external_ledger.credential.issue_requested  (INV-07)
   → flag OFF면 enqueue 자체를 하지 않는다 (§1.2.2)
5. ⚠️ outbox/외부원장 실패가 위 3단계 트랜잭션을 롤백하지 않음  (INV-13)
6. idempotency_key 적용  (INV-08)
```

### 7.3 AdmissionService.rejectApplication / requestMoreInfo

```text
reject:
  - 권한검증 → reject_application_tx(status=rejected, reason_code, applicant_notice?)
    → admission_events(reason_code) → audit_logs(reason_code만)  (§7.4 reason 분리)
requestMoreInfo:
  - 권한검증 → request_more_info_tx(status=needs_more_info, reason_code, applicant_notice)
    → admission_events(reason_code) → audit_logs(reason_code만)
```

### 7.4 ⭐ reason 분리 — 자유서술이 audit/outbox로 새지 않게

"사유 필수(INV-06)"와 "audit/outbox 원문 금지(INV-16)"는 충돌할 수 있다. 관리자가 자유서술 사유를 쓰면 거기에 신청자 신상·민감정보·판단 근거 원문이 섞여 audit_logs로 샌다. 그래서 reason을 **세 갈래로 분리**한다.

```text
reason_code   (enum, required):
  - audit_logs / admission_events 에 저장 가능 (이것만 감사 기록에 들어간다)
  - 예: meets_phase1_policy / insufficient_context / mismatch_with_policy /
        needs_identity_clarification / duplicate_identity_suspected /
        applicant_withdrew (withdraw route) / application_expired (expire worker)
review_summary (관리자 내부 검토 메모):
  - admission_applications 에 저장
  - ⚠️ client read 금지 (RLS deny), applicant 에게 직접 노출하지 않음
  - audit_logs.metadata 에 복사하지 않는다
applicant_notice (applicant-facing 안내문):
  - applicant 에게 보여줄 필요가 있을 때만 별도 컬럼에 저장
  - needs_more_info 시 "무엇을 보완하라"는 안내가 여기 들어감
internal_note (선택, 더 민감한 메모):
  - P0에서는 저장하지 않는다. 저장한다면 encrypted/restricted 별도 테이블로 분리.
```

audit_logs.metadata 에 들어가는 형태(원문 없음):

```json
{ "from_status": "under_review", "to_status": "approved",
  "reason_code": "meets_phase1_policy", "policy_version": "phase1-v0.95" }
```

### 7.5 OutboxProcessor.processPending

#### P0 메인 브랜치 (Noop only — 외부 원장 없음)

```text
1. claimPending(limit) — status=pending 행을 processing 으로 원자적 전환
2. target=internal → noop 처리(기록만). 메인 브랜치에는 실제 외부 호출이 없다.
3. target=external_ledger/icp/filecoin/arweave 이벤트가 들어오면 → 외부 호출하지 않고 dead_letter(또는 failed)로 표시.
   (externalLedgerEnabled=false 이므로 애초에 target=external_ledger 이벤트는 생성되지 않는 게 정상. §1.2.2)
4. 실패 시 attempt_count++ , last_error 기록 , status=failed
5. membership 상태는 절대 건드리지 않음  (INV-13)
6. 기본 LedgerPort = NoopLedgerAdapter. ExternalLedgerAdapter import 0건. (INV-21)
```

#### Task 10 옵션 브랜치 (External Ledger PoC)

```text
1. externalLedgerEnabled=true 일 때만 target=external_ledger 이벤트를 enqueue 한다.
2. 이 브랜치에서만 ExternalLedgerAdapter 를 구현·주입한다.
3. target=external_ledger → ExternalLedgerAdapter 호출 → 성공 시 memberships.ledger_credential_tx_ref update.
4. 외부 원장 실패는 membership active 를 롤백하지 않는다. (INV-13)
5. icp/filecoin/arweave 는 이 브랜치에서도 여전히 미구현(dead_letter).
```

---

## 8. 화면 & 사용자 플로우 (L4 기반, P0 한정)

### 8.1 P0 화면 목록

```text
/                      Landing — "검증된 멤버만 입장할 수 있습니다"
/signup  /login        계정 생성/로그인
/gate                  입장 절차 허브 (현재 단계 카드 + CTA)
/apply                 신청서 (handle, bio, taste tags, motivation, 정책 동의)
/apply/status          내 신청 현황 (status, submitted_at, needs_more_info, policy_version)
/member                멤버 홈 (승인 후) + My Pass 상태
/admin/applications       검토 큐
/admin/applications/[id]  검토 상세 + approve/reject/needs_more_info (사유 입력)
/more/settings         프라이버시/데이터 보관 정책 표시
```

### 8.2 Gate 단계 (P0 현실판)

```text
1. 계정 생성        →  [완료]
2. 이메일 인증      →  [인증하기]
3. (지갑 연결)      →  [나중에] — P0 선택, 강제 안 함
4. 입장 신청        →  [신청서 작성]
5. 심사 중          →  [내 신청 현황 보기]
6. 추가정보 요청    →  [추가정보 제출]   (해당 시)
7. 승인 → 멤버십    →  [Members로 이동]
```

### 8.3 신청서 필드 — 포함/제거 (데이팅앱化 방지)

```text
포함: persona handle 후보, 짧은 bio/신청 진술, taste tags, motivation,
      정책 동의, 프라이버시 동의
제거: orientation, interested_in, 외부 SNS, 전화번호 노출,
      정확한 직장/학교 필드, 소득/지위 과시 필드
```

### 8.4 카피 가드레일 (P0에서도 적용)

```text
금지: 익명 랜덤채팅 / 성인 대화 / 토큰 보상 / 스테이킹 수익 / 투자 업사이드
권장: verified private messenger / admission-governed member network /
      end-to-end encrypted (도래 시) / 사용료 리베이트(수익률 아님)
```

---

## 9. Feature Flags & 환경 경계

`packages/core/src/config/feature-flags.ts` (실제 동결 코드와 일치해야 함)

```ts
export const featureFlags: FeatureFlags = {
  externalLedgerEnabled: false,        // ⭐ P0 메인 고정 false. 외부 원장은 Task10 브랜치에서만. (INV-21/INV-25)
  icpBackendEnabled: false,            // 코드상 고정 false (INV-14)
  filecoinStorageEnabled: false,       // 고정 false
  arweavePolicyArchiveEnabled: false,  // 고정 false
  admissionOutboxEnabled: true,
  auditHashChainEnabled: false,        // 컬럼은 있으나 채우는 건 P1
  realtimeChatEnabled: false,          // P0 비활성
  aiInterviewEnabled: false,
  // Persona Clip (admission artifact, NOT media/message). 과잉구현 가드.
  personaClipRecordingEnabled: true,
  personaClipUploadEnabled: false,     // 업로드 fallback 없음 (INV-PC-04)
  personaClipPreviewEnabled: false,    // 미리보기 없음
  personaClipRetakeEnabled: false,     // 재촬영 없음
};
```

원칙: ICP/Filecoin/Arweave + externalLedger 플래그는 **사용자 환경변수로도 켤 수 없게** 코드 리터럴 false. personaClipUpload/Preview/Retake도 false 리터럴로 박아 Cline의 과잉구현을 차단한다.

---

## 10. 감사 체크리스트 — Codex(1차) & Cowork(최종)

### 10.1 Codex 1차 감사 — 기계적 검사 (grep 가능한 것 위주)

```text
□ INV-01  apps/web 전역에서 `supabase.from(` / `supabase.storage` 검색 0건
□ INV-02  UI 컴포넌트에서 `signAndExecuteTransaction` 검색 0건 (wallet connect 제외)
□ INV-03  packages/core 안에서 `@supabase` import 0건
□ INV-04  migrations에 messages 관련 plaintext/body_plain/content_plain 컬럼 0건
□ INV-09  api/.../route.ts 안에서 `.from(...).update(` / `.insert(` 직접 0건
□ INV-14  feature-flags.ts 에서 icp/filecoin/arweave = false 리터럴 확인
□ INV-15  F5 마이그레이션 필드 전부 스키마에 존재
□ INV-17  `NEXT_PUBLIC_.*SERVICE_ROLE` 검색 0건, 브라우저 번들에 service role client 0건
□ INV-19  migrations에서 평문/원문 키 컬럼 0건 — `rg -n "\b(plaintext|body_plain|content_plain|decryption_key|raw_key|plain_key|conversation_key_plain|conversation_key_raw)\b" supabase/migrations` (정상 테이블명 conversation_key_envelopes·wrapped_key는 오탐 아님)
□ INV-20  apps/web/app 에 messages|chat|inbox|conversations route 디렉토리 0건
□ INV-21  메인 브랜치에서 `ExternalLedgerAdapter` 구현 클래스 0건 (Noop만)
□ INV-23  rpc 함수에 `commit`/`rollback` 0건, `security definer` + `search_path` 존재, anon/authenticated execute revoke 확인
□ INV-24  `rg "direct_messages" apps/web` → 0 hit, `rg "conversation_key_envelopes" apps/web` → 0 hit
□ INV-25  `rg -i "@mysten|aleo|aztec|zcash" packages apps` → 0 hit (docs 제외), `rg -ni "\bsui\b" packages/core/src` → 0 hit
□ INV-PC-05  `rg "supabase\.storage" apps/web` → 0 hit (persona clip은 StoragePort 경유)
□ INV-PC-04  feature-flags: personaClipUpload/Preview/Retake = false 리터럴 확인
□ 빌드/타입체크 통과, vitest 단위테스트 통과 (19 tests)
```

### 10.2 Cowork 최종 감사 — 의미적 검사 (사람/고급추론 필요)

```text
□ INV-05  approve/reject/submit 각 경로에서 admission_events insert가 동일 유스케이스에 묶임
□ INV-06  모든 admin 액션에 reason 강제 + audit_logs append
□ INV-07  service가 externalLedgerAdapter를 직접 await 하지 않고 outbox를 경유
□ INV-08  중요 write에 idempotency_key 실제 생성·사용 (중복요청 테스트)
□ INV-11  비관리자 approve/reject 호출 시 403 (실제 호출 시나리오 검증)
□ INV-12  타인 application 조회 차단 (RLS 시나리오 검증)
□ INV-13  외부 원장 실패 주입 시 membership active 유지되는지 (실패 주입 테스트)
□ INV-16  audit/outbox payload에 원문 흔적 없음 (실제 row 샘플 검사)
□ INV-18  approve/reject가 rpc 한 트랜잭션인지, 중간 실패 시 전부 롤백되는지 (실패 주입)
□ F1      서버 로그/audit/outbox/envelope 어디에도 평문/키 흔적 없음
□ 카피     §8.4 금지표현 없음, §2.3 법적표현 경계 준수
□ 마이그레이션성: AdmissionRepository를 IcpAdmissionRepository로 교체하는 사고실험이 성립하는가
```

### 10.3 P0 수용 기준 (L1+L2 Acceptance 통합)

```text
□ 일반 회원가입이 곧바로 Members/Chats 접근으로 이어지지 않는다
□ 로그인/신청 전 보호 라우트 접근 불가
□ 승인 후에만 멤버 영역 접근 가능
□ 비관리자 admin route 접근 불가
□ Admission 상태전환은 admission_events + audit_logs 를 남긴다
□ 승인/거절은 server-only route 에서만 가능
□ Admin은 임의 주권 행사 불가 (사유 없는 상태변경 경로 부재)
□ direct_messages 에 plaintext 컬럼 없음 (채팅 미구현이어도)
□ Support/Challenge/SOUL/Court 의 데이터 모델·UI 슬롯이 존재 (구현은 아니어도)
□ 외부 원장 발급 실패가 승인 플로우를 막지 않음
```

---

## 11. 바이브코딩 파이프라인 — 단계별 실행 워크플로우

### 11.1 권장 순서 (조정된 흐름)

```text
[0] Cowork: 설계도 + 계약 확정     ← 빌드 전에 와꾸를 먼저 고정
      ↓
[1] Cline + GLM 5.1: 1차 빌드      ← 가드레일 프롬프트와 함께
      ↓
[2] Codex: 1차 감사 + 기계적 수정   ← §10.1 체크리스트
      ↓
[3] Cowork: 최종 감사 + 설계 정합   ← §10.2/§10.3, 반려 시 [1]로 회귀
```

> 원래 제안(빌드→감사→설계)을 (설계→빌드→감사)로 뒤집은 이유는 §2 참조: 검열저항·E2EE는 사후 추가 불가라 설계가 선행해야 한다.

### 11.2 단계 0 — Cowork (설계자)

```text
산출물:
  - docs/architecture/phase-1-blueprint.md (이 문서 §4~§9를 코드베이스 맞춤으로 확정)
  - supabase/migrations/0001, 0002 의 최종 컬럼/타입 확정
  - packages/core/ports/*.ts 의 인터페이스 시그니처 동결(freeze)
  - docs/policies/*.md 초안 (정책 버전 = phase1-v0.95)
역할:
  - 인터페이스는 여기서 동결한다. Cline가 시그니처를 바꾸면 반려.
```

### 11.3 단계 1 — Cline + GLM 5.1 (빌더) 가드레일

Cline 시스템 프롬프트(또는 `.clinerules`)에 **반드시** 박을 내용:

```text
You are building SoulBound Phase 1 MVP. Centralized infra, migration-ready.

HARD RULES (위반 시 그 파일을 다시 작성):
1. React components must NOT call Supabase or any external-ledger SDK directly.
   Flow: Component → hook → API route → service → repository → adapter → Supabase.
2. packages/core must NOT import @supabase or any concrete-chain SDK. Pure TypeScript only.
3. Business logic lives in application services, not in routes or components.
4. Every admission status change MUST insert admission_events in the same use case.
5. Every admin action MUST write audit_logs and require a reason string.
6. External side effects must go through outbox_events, never awaited inline in a service.
   In P0 main branch, NO real external side effect is executed (internal/noop only).
7. direct_messages table: ciphertext-only. NEVER add a plaintext/body_plain column.
8. Add migration fields ipfs_cid, filecoin_deal_id, arweave_tx_id, policy_snapshot_hash,
   chain references now, but leave them unused.
9. Do NOT implement ICP, Filecoin, IPFS, Arweave. Interfaces and DB fields only.
10. LedgerPort must use NoopLedgerAdapter ONLY in P0 main branch.
    Do NOT implement ExternalLedgerAdapter. Do NOT import any concrete-chain SDK in main branch.
11. Implement ONLY: signup/login, profile, application submit, status page,
    admin review queue, approve/reject/needs_more_info, membership create, audit, outbox.
12. Idempotency keys on submit/approve/reject/membership/ledger issue.
13. TEST FIRST. packages/core 의 service 단위테스트를 어댑터/UI보다 먼저 작성한다.
    테스트는 mock repository/port 로 INV-05/06/11/13/18 을 검증한다.
    UI가 돌아가는지보다, 이 테스트가 통과하는지가 우선이다.
14. messages/chat/inbox/conversations route 와 메시지 송수신 API 를 만들지 않는다 (INV-20).
15. ExternalLedgerAdapter 를 메인 브랜치에서 구현하지 않는다. 기본은 NoopLedgerAdapter (INV-21).

Do not overbuild. Do not add real token economics. Do not deploy ICP.
Do not build any chat UI/route. Do not implement any external ledger on main branch.

Build order (TEST-DRIVEN — 테스트가 어댑터·UI보다 먼저다):
  a. packages/core 타입/포트/서비스/errors/result + ⭐서비스 단위테스트(mock) — 테스트 통과가 a의 완료조건
  b. supabase/migrations + RLS + seed + approve/reject/request_more_info 의 rpc function
  c. packages/adapters/supabase + noop (a의 테스트가 통과한 service에 맞춰 어댑터를 붙임)
  d. apps/web API routes (service 호출만, 3-client 경계 준수)
  e. apps/web UI pages
  f. packages/adapters/external — 메인 아님, 별도 브랜치, M6 이후 (옵션)
```

> GLM의 알려진 약점: ① 컴포넌트에 Supabase 직접 박기, ② "편의상" service 우회, ③ UI부터 뽑고 서비스 경계를 무너뜨리기. 위 1·2·3·13을 한 번만 쓰면 무시당하기 쉬우니 .clinerules 상단·하단에 **중복 명시**할 것.

빌드 순서를 a(코어+테스트)부터 시작하는 이유: 어댑터·UI가 먼저 나오면 GLM이 코어를 건너뛰고 직접 호출로 채운다. **서비스 단위테스트를 먼저 통과시키면**, 어댑터와 UI는 그 통과된 경계를 따를 수밖에 없다. 테스트가 곧 경계의 집행자다.

### 11.4 단계 2 — Codex (1차 감사자)

```text
입력:  §10.1 체크리스트 + §3 불변식
작업:
  - grep 기반 기계 검사 자동화 (가능하면 스크립트로):
      rg "supabase\.(from|storage)" apps/web        → 0 hit 기대
      rg "@supabase" packages/core                  → 0 hit 기대
      rg -n "\b(plaintext|body_plain|content_plain|decryption_key|raw_key|plain_key)\b" supabase/migrations → 0 hit 기대 (conversation_key_envelopes/wrapped_key는 정상)
  - 타입체크/빌드/단위테스트 실행, 실패 수정
  - 명백한 INV 위반 직접 패치
출력:  수정 diff + "Cowork가 봐야 할 의미적 의심 지점" 목록
주의:  Codex가 자기 수정한 부분을 자기가 최종 승인하지 않게 — 승인은 Cowork.
```

### 11.5 단계 3 — Cowork (최종 감사자)

```text
입력:  §10.2 + §10.3 + Codex가 넘긴 의심 지점
작업:
  - 의미적 불변식 검증 (실패 주입 테스트 포함: 외부원장 실패 → membership 유지?)
  - 마이그레이션성 사고실험 (Supabase→ICP 교체 가능?)
  - 카피/법적표현 경계 검토
  - 통과 시 phase-1-blueprint.md를 "as-built"로 갱신, 태그 v1.0-P0
  - 미통과 시 구체적 반려 사유 + 단계 1로 회귀
```

### 11.6 도구 조언 (요청하신 부분)

```text
[유지] Cline+GLM 빌드 / Codex 감사 / Cowork 설계·최종 — 역할 분리는 좋다.

[조정 1] 순서 뒤집기: 설계 먼저 (§11.1). 이게 가장 중요한 변경.

[조정 2] 인터페이스 동결: Cowork가 ports/*.ts 시그니처를 단계 0에서 freeze.
         Cline/Codex가 시그니처를 못 바꾸게 하면 3-tool 간 표류(drift)가 사라진다.

[조정 3] grep 자동화: §11.4의 rg 검사를 CI(또는 pre-commit)로 박으면
         Codex 부담이 줄고, 같은 위반이 반복 생성되는 걸 빌드 단계에서 차단.

[선택] Claude Code: VScode에서 Cline 대신/병행으로 Claude Code를 쓰면
       agentic 수정 루프가 더 매끄럽지만, GLM 비용 전략을 이미 세우셨다면 현 구성 유지해도 무방.
       단, '감사자'는 빌더와 다른 모델이어야 한다는 원칙만 지키면 된다.
```

---

## 12. 마일스톤 (P0, 6단계) & Cline 작업 단위 (10 Tasks)

### 12.1 마일스톤

```text
M1  코어 계약 + 서비스 테스트 + 서비스 구현
    - Task 1: packages/core 배관/컴파일 (types/ports/services/errors/result)
    - Task 2: ⭐ frozen service 단위테스트(mock port)를 green 으로. INV-05/06/11/13/18/22 + INV-PC 검증.
    완료기준(Task 1): pnpm -F @soulbound/core build + pnpm -r typecheck + bash scripts/audit.sh 통과.
                      서비스 테스트는 RED/NOT_IMPLEMENTED 상태여도 정상 (test green 요구 X).
    완료기준(Task 2): pnpm -F @soulbound/core test (19 green, 0 skipped) + build + typecheck + audit.

M2  DB 스키마 + RLS + rpc
    - 0001 schema, 0002 RLS, seed.sql
    - approve/reject/request_more_info rpc function (원자 트랜잭션)
    완료기준: 로컬 Supabase migration 성공, F5 필드 전부 존재, 3-client 경계 RLS 적용

M3  어댑터 + Admission 플로우
    - supabase 어댑터(rpc 호출 포함), noop 어댑터, API routes, apply/status 페이지
    완료기준: 사용자가 신청 제출 가능, 상태 조회 가능, M1 테스트 여전히 통과

M4  Admin 검토 + 멤버십
    - 검토 큐/상세, approve/reject/needs_more_info(service role route), membership 생성
    완료기준: 승인 시 membership 생성 + profiles.active 전이가 한 트랜잭션으로

M5  감사 + Outbox
    - admission_events, audit_logs(원문금지), outbox_events 기록
    완료기준: 승인 시 admission_events + audit_logs 기록.
              ⚠️ P0 main 에서 external_ledger outbox event 생성 0건 (externalLedgerEnabled=false).
              outbox 는 internal/noop 형태만 검증. audit/outbox payload 에 원문 없음.

M6  하드닝 + (옵션, 별도 브랜치) External Ledger PoC
    - RLS 점검, 권한 가드, 에러/로딩/빈 상태 UI, Persona Clip 삭제 워커/보존정책 점검
    - ExternalLedgerAdapter는 메인 아닌 별도 브랜치에서만
    완료기준: §10.3 수용 기준 전부 통과, 외부원장 실패가 승인 막지 않음
```

### 12.2 Cline 실제 투입 단위 (한 번에 하나씩 — 과잉구현 방지)

Cline에 M 단위로 통째로 던지면 범위가 커서 폭주한다. 아래처럼 **9개 Task로 쪼개 하나씩** 던진다.

```text
Task 1  monorepo 골격 + packages/core skeleton (types/ports/result/errors, 컴파일만)
Task 2  ⭐ packages/core service 단위테스트 (mock port) — 통과시키기 (19 tests green)
Task 3  Supabase schema + RLS + rpc function only (DB만, 코드 연결 X) — persona_clip_assets + private bucket 포함
Task 4  packages/adapters/supabase + noop only (Task2 테스트가 여전히 green)
Task 5  admission service + membership service 실제 배선 only
Task 6  API routes only (service 호출 + 3-client 경계)
Task 7  ★ Admission Persona Clip route + recorder component only
Task 8  UI pages only (signup/login/gate/apply/status/member/admin)
Task 9  audit/outbox hardening (원문금지·idempotency·실패내성·clip 보존정책 점검)
Task 10 (옵션, 별도 브랜치) External Ledger PoC — 체인 선택은 Northstar 결정

각 Task 사이마다: Codex 1차 감사 → 통과 시 다음 Task.
Task 1~2는 UI 없이 끝난다. 이 단계에서 "되는 화면"이 없다고 불안해하지 말 것 — 경계가 자산이다.
```

### 12.3 Task 7 (Persona Clip) 수용 기준

```text
□ Persona Clip은 optional. 미제출해도 신청 제출 가능 (INV-PC-01)
□ 앱내 녹화만. 업로드 fallback / 미리보기 / 재촬영 / 편집 없음 (INV-PC-04, flags로 가드)
□ 녹화 실패·권한거부 시 clip 없이 계속 진행
□ submit validation에 persona clip 미포함 (clip은 gate 아님)
□ raw media는 private bucket 저장. component는 supabase.storage 직접호출 0건 → StoragePort 경유 (INV-PC-05)
□ reviewer/admin만 해당 신청서 상세에서 재생 (signed URL, server route). member/anon 0건 (INV-PC-08)
□ clip 원본/transcript가 audit_logs/outbox/log에 0건. storage_path만 OK (INV-PC-06)
□ terminal state 도달 즉시 raw media 삭제 대상 + draft 24h 미제출 삭제 대상 (INV-PC-09)
□ clip은 AI score·자동승인·자동거절에 미사용 (INV-PC-07)
```

---

## 13. 최종 선언

```text
P0의 성공 기준은 "기능이 많은 것"도 "탈중앙화된 것"도 아니다.

P0의 성공 기준은:
  나중에 검열저항 E2EE 파이널클럽 메신저로 자랄 수 있는,
  중앙화되었지만 주권을 서버에 주지 않은 입장심사 MVP를 만드는 것.

겉은 카카오톡처럼. 입장은 파이널클럽처럼.
권한 흔적은 감사로그처럼. 서버는 relayer처럼.
평문과 키는 — 처음부터 보유하지 않는다.
```
