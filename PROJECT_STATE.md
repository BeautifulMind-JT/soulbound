# SoulBound — PROJECT_STATE (설계자/감사자 인수인계)

> 이 문서는 **설계·감사 역할(Architect/Auditor)** 의 인수인계 문서입니다.
> 여러 Cowork 세션 / 채팅이 이 프로젝트를 이어받을 때, **이 파일 + repo 파일이 진실의 원천**입니다.
> 자기 기억이 아니라 여기 적힌 결정과 그 *이유*를 기준으로 판단하세요.
> 결정을 바꾸면 반드시 이 파일을 갱신하고 커밋하세요(머릿속에만 두지 말 것).

마지막 갱신: Task 4 adapters 구현(Codex) + Cowork R1 감사 = **HOLD**(P1 applicant read-path, 패치 대기). Task 3는 커밋됨(2583f6f·bd052b0). 빌드 브랜치 `phase1-p0-mvp`.

---

## 0. 한 줄 요약

trust-first, 입장심사 기반 비공개 메신저(SoulBound) Phase 1 MVP를, **설계를 먼저 동결(freeze)하고
빌드하는 4-actor 파이프라인**으로 만든다. 중앙화(Supabase+Vercel+Next.js)지만 검열저항/E2EE/탈중앙은
*데이터·권한 형태*로 day 1에 박아 migration-ready로 간다. 원칙: **"기능은 나중에 붙일 수 있다,
데이터·권한 형태는 못 바꾼다."**

---

## 1. 4-ACTOR 파이프라인 (역할 분리 — 절대 섞지 말 것)

> **운영 루프 정본 = `docs/WORKFLOW.md`** (2026-06-01, JT 승인). 빌더는 **레이어 위험도**로 선택:
> 보안층(DB/RLS/RPC/adapter 경계/auth/idempotency/audit/retention/frozen 인접) = **Codex 디폴트 빌더**,
> 표면층(UI/boilerplate/반복/기계적 wiring) = **GLM/Claude Code**. 불변식: 최종 승인자 ≠ 그걸 짠/보수한 주체.
> HARD RULES는 CLAUDE.md/.clinerules/AGENTS.md/이 문서 네 곳을 함께 갱신(드리프트 금지, §6).

```text
[0] Architect/Auditor  설계 동결 + 최종 의미감사   ← Cowork 한 세션 OR 채팅 (단, 하나로 고정)
[1] Builder            Claude Code + GLM 5.1       ← 코드를 짠다
[2] First-pass Auditor Codex                       ← read-only 기계감사 (AGENTS.md)
[3] Final Auditor      = [0]                        ← 의미적 불변식 검증, 반려 시 [1]로
```

철칙:
- **빌더와 감사자는 다른 모델.** 자기가 짠 걸 자기가 최종승인 금지.
- **설계 판단(Architect)은 한 곳에서만.** 설계 세션이 둘이면 도면이 둘 나와 드리프트 난다.
  (이 프로젝트는 stale-아티팩트 드리프트로 여러 번 데였다 — §6 참고.)
- 빌더 목줄: `.clinerules`(Cline) / `CLAUDE.md`(Claude Code). 감사관 헌장: `AGENTS.md`(Codex).
  이 셋의 HARD RULES는 항상 동일해야 한다. 규칙 바꾸면 셋 다 + 이 문서 갱신.

### 멀티 세션 규칙 (Cowork 세션이 여러 개일 때)
- source of truth = **repo의 파일** (`docs/architecture/...FROZEN.md`, frozen `packages/core/src`, 이 문서).
- 어느 세션도 *기억*으로 계약을 재구성하지 말 것. 파일을 열어 확인.
- 설계 결정은 파일+커밋으로 남긴다. 구두/세션-로컬 결정 금지.

---

## 2. 지금 상태 (어디까지 왔나)

```text
작업장 세팅      ✅ (Node24/pnpm11.1.3, repo=github.com/soulbounddao-ADMIN/soulbound private,
                    브랜치 phase1-p0-mvp, git 신원=soulbounddao-ADMIN)
0A 계약 코드     ✅ packages/core/src (동결)
0B 불변식 테스트  ✅ 19개
0C toolchain     ✅ (검증됨: typecheck CLEAN / build emit / audit PASS / engineStrict Node<24 차단 실측)
Task 1 게이트    ✅ typecheck/build/audit 통과, 19 RED 정상
Task 2 구현      ✅ admission-service.ts + membership-service.ts 바디만 구현, 19 GREEN
                    Codex 1차 + Cowork 최종 감사 통과. (커밋은 JT가 진행 중)
Task 3 (R1 GLM)  ❌ 반려. Codex 1차 + Cowork 최종 둘 다 FAIL (P0 2건/P1 4건). 산출물 폐기.
                    증적: docs/TASK3_AUDIT_FINDINGS.md, docs/TASK3_REIMPLEMENTATION_DECISION.md (커밋 910b85f)
Task 3 (R2 Codex)✅ DB레이어 재구현. Cowork 최종 감사 PASS. 커밋됨 2583f6f + 감사증적 bd052b0.
                    예외: 이 Task만 Codex가 빌더, Cowork가 감사(자기승인 금지). supabase/ 만 변경, core/docs 무손상.
Task 4 (Codex)   ✅ adapters(@soulbound/adapters). Cowork 감사 3라운드 끝 **PASS**(uncommitted).
                    R1 P1(read 컬럼) → admission/membership 안전컬럼 분리로 수정. R2 P1(보안: auth role이
                    user_metadata 폴백 → 자가승격) → app_metadata 전용으로 수정, 테스트가 위조 user_metadata 무시 단언.
                    증적 docs/TASK4_AUDIT_FINDINGS.md(R1~R3). → JT 2커밋(feat adapters / docs audit).
                    이월(Task 4 비차단): ① approve composite 라이브 shape = pre-Task5 smoke test. ② 신뢰 role 소스
                    (security definer `current_user_role()` rpc 권장) + 시드 role을 user_metadata→신뢰소스로 = Task 6 전.
```

빌드 순서(10 Task, 하나씩 / 사이마다 Codex→Cowork 감사):
```
1 monorepo+core skeleton  2 core test 19 green  3 supabase schema+RLS+rpc(DB only)
4 supabase+noop adapter   5 service 배선        6 API routes
7 Persona Clip route+recorder  8 UI pages       9 audit/outbox hardening
10 (옵션·별도 브랜치) External Ledger PoC — 체인 선택은 그때 결정
```

---

## 3. 핵심 설계 결정 + *이유* (이게 문서의 핵심 — 파일엔 결정만, 여기엔 이유가 있다)

### 3.1 Chain-neutral (Sui 탈명사화)
- **무엇:** P0는 어떤 concrete chain에도 결합하지 않는다. `LedgerPort` + `NoopLedgerAdapter`만.
  `externalLedgerEnabled=false` 고정. F5 마이그레이션 필드는 `ledger_*_ref`(체인명 없음).
- **왜:** Sui mainnet이 2026-05 stall. 특정 체인에 영혼 박으면 그 체인 죽을 때 같이 죽는다.
  추상 경계(LedgerPort)만 두면 나중에 Zcash/Aleo/Aztec 중 뭐든 꽂을 수 있다.
- **중요:** Sui를 *다른 체인 이름으로 교체한 게 아니라* 이름 자체를 들어냈다. 그래야 다음 라운드에
  자유롭게 고른다. 체인 선택(Zcash ZSA vs Aleo vs Aztec)은 **다음 라운드 Northstar 결정** — P0 아님.
  (ZSA는 ZIP 226/227이 아직 Draft라 MVP 핵심 의존성으론 위험하다고 결론.)
- audit: `packages/core/src`에 `sui` 0건, `packages/apps`에 `@mysten|aleo|aztec|zcash` 0건.
  docs의 historical mention은 예외.

### 3.2 Persona Clip (입장심사용 영상, optional)
- **무엇:** 선택 제출. 앱내 녹화 only. 업로드/미리보기/재촬영/편집/공개피드/영상메시지 전부 없음.
  부재가 submit을 막지 않는다. StoragePort 경유(절대 supabase.storage 직접호출 금지).
- **보존(중요):** terminal admission state(approved/rejected/withdrawn/expired) 도달 **즉시 raw media 삭제**.
  draft 24h 미제출도 삭제. 영구보존 금지. `persona_clip_hash`(해시)만 남고 raw는 안 남는다.
  - **왜:** "안 가진 건 유출·제출당할 수 없다" = data minimization / 검열저항 Northstar 정합.
  - rpc는 `delete_after`+`deletion_reason` *마킹만*. 실제 Storage 삭제 worker는 Task 9.
- **storage_path 경계(INV-PC-06):** `persona_clip_assets`/StoragePort 안에서만. audit_logs/outbox/log/
  analytics/reviewer-notes엔 `persona_clip_asset_id`/`content_hash`/`status`/`deletion_reason`/
  `deleted_at`/`policy_version`만. signed URL/token/raw bytes/base64/transcript/screenshot/요약 전부 금지.

### 3.3 Admission Underwriting / Activation SOUL (캐논만, 경제로직 미구현)
- 후보자는 SOUL 없이 맨손 신청(입장권 구매 아님). 기존 고신뢰 멤버가 stake-backed review.
  승인자는 Review Toll 재원에서 Activation SOUL 받아 즉시 DefaultStakedSoul로 lock.
- Activation SOUL ≠ 보상/에어드랍/수익/양도토큰. 신규발행 없음.
- **P0:** schema/interface/policy로만. 실제 Review Toll 계산/Bond lock/지급/slash는 **구현 안 함**.
  `LedgerPort.issueActivationStake`(구 `grantSoul`에서 개명 — 보상 어감 제거)는 인터페이스만, 구현은 Noop.

### 3.4 에러 모델 (HYBRID)
- 예상된 도메인 실패 → `Result<T, AppError>` (코드: VALIDATION/FORBIDDEN/NOT_FOUND/
  INVALID_STATE_TRANSITION/CONFLICT/DEPENDENCY_FAILURE → 422/403/404/409/409/502).
- 진짜 버그 → throw.

### 3.5 상태전이 = 단일 원자 rpc
- approve/reject/requestMoreInfo는 Postgres rpc 하나(`*Tx`)가 admission_events + audit_logs를
  **한 트랜잭션 안에서** 기록. 서비스가 별도 호출로 나눠 쓰지 않는다. (INV-05/06/18)
- reason은 enum(`AdmissionReasonCode`)만 audit/event로 흐른다. free-text 금지. (INV-22)

### 3.6 AdmissionStatus / ReasonCode (v1.3 최종)
- status: draft|submitted|under_review|needs_more_info|approved|rejected|withdrawn|**expired**
- reason: meets_phase1_policy|insufficient_context|mismatch_with_policy|needs_identity_clarification|
  duplicate_identity_suspected|**applicant_withdrew**|**application_expired**
  (뒤 2개는 withdraw route / expire worker용 — status만 추가하고 reason 빠뜨리면 INV-22 깨짐)

### 3.7 보안 경계 (RLS 3-client)
- browser=anon / server=user-JWT / server-only=service-role. service-role은 절대 `NEXT_PUBLIC_` 금지(INV-17).
- audit_logs/outbox_events엔 client policy 0 (service-role만, RLS가 모두 deny) (INV-10).
- React 컴포넌트가 Supabase 직접 호출 금지. component→hook→route→service→repo→adapter.
- direct_messages는 ciphertext-only. plaintext/key 컬럼 영구 금지(INV-04/19).
- rpc: security definer + `set search_path=''` + anon/authenticated/public EXECUTE REVOKE.
  함수 안에 COMMIT/ROLLBACK 0건(이미 한 트랜잭션; 되돌릴 땐 raise exception). (INV-23)

---

## 4. 미결 항목 (잊으면 안 됨 — 기록 안 하면 사라진다)

- **[Task 5 직전 필수 게이트 — 2026-06-01 JT 결정] 재현가능한 rpc/RLS smoke test 커밋.** R1 교훈 =
  `supabase db reset` 통과는 함정(plpgsql 컬럼/타입 오류는 *호출 시* 터짐). Codex의 smoke test는
  ad-hoc/uncommitted였음. `supabase/tests/`에 submit→start_review→approve/reject/more_info 구동 +
  RLS 거부(applicant가 review_summary 못 읽음, role 못 바꿈) 단언하는 SQL/pgTAP를 커밋해 CI/감사에서
  재실행 가능하게 할 것. **결정:** Task 4 어댑터(순수 mapper/Noop 단위테스트, 런타임 RPC 미실행)는 이것 없이
  진행; 어댑터가 실제로 DB를 치는 **Task 5(wiring) 직전에 필수 게이트**로 커밋한다.
- **[Task 10-1] outbox vs ledger 직접호출 책임 분리.** 현재 approve 후처리가 `outbox.enqueue` +
  `ledger.issueMembershipCredential`를 *둘 다* 직접 실행(INV-13 테스트가 그렇게 강제). P0는
  `externalLedgerEnabled=false`라 안 돌지만, Task 10에서 outbox processor가 `external_ledger`
  이벤트를 처리하면 **중복 발급** 위험. → Task 10 전에 "서비스는 enqueue만, ledger 호출은
  processor/adapter에서 1회"로 단일화 결정. INV-13(실패내성)은 유지. (Codex P2 finding, Cowork 동의.)
- **[다음 라운드] privacy ledger 선택** (Zcash ZSA / Aleo / Aztec) + **ICP 앱체인 전환** — Northstar,
  P0 계약 아님. LedgerPort 추상 경계가 이미 이걸 수용함.

---

## 5. 감사 체크리스트 (Cowork 최종 감사 시 — 의미 불변식)

Task별로 Codex 1차(AGENTS.md, 기계검사) 통과 후, 설계세션이 코드를 *읽고* 확인:
- INV-11 가드 순서: role(FORBIDDEN)→load(NOT_FOUND)→state(INVALID_STATE_TRANSITION)→원자 *Tx→side effect
- INV-12 cross-tenant: 남의 application/clip 못 읽음
- INV-13 실패내성: outbox/ledger 실패가 커밋된 승인을 롤백 안 함 (try/catch, flag 안에서만)
- INV-16 audit/outbox에 원문/raw payload/storage_path 0건 (코드/ids/refs만)
- INV-18 원자성: 상태전이+event+audit가 한 트랜잭션
- INV-22 reason enum only
- INV-PC-09 clip 보존: terminal 즉시 마킹삭제 + worker(Task9)
- frozen 무수정: `git diff --stat packages/core/src` 가 해당 Task에서 바뀌면 안 되는 것 안 바뀜
- tests-not-weakened: `*.test.ts` diff 없음, `.skip/.todo/.only` 0건

---

## 6. 반복된 실패 모드 (같은 실수 반복 금지)

- **stale 아티팩트 드리프트:** 산출물 여러 버전이 떠다녀 옛 버전을 받아 작업 → 여러 번 사고.
  → 대응: 단일 번들 + `MANIFEST.txt`(version assertion + grep + sha256). 받으면 MANIFEST부터 확인.
- **"했다고 말한 것" ≠ "실제 파일":** 보고는 v1.3인데 zip 안은 v1.2였던 적 다수.
  → 대응: 항상 grep/typecheck로 working tree를 실측하고 주장. shipped tar 내부를 풀어서 재확인.
- **git 신원 사고:** 샌드박스 git이 host 전역신원을 못 봐서 잘못된 local 신원(JT/justice.parkit)을
  박을 뻔. → repo 신원은 soulbounddao-ADMIN <soulbound.dao@gmail.com>로 고정. 커밋 author 확인 습관.
- **샌드박스 .git 락:** Cowork 샌드박스가 `.git/*.lock`을 못 지워 커밋 실패 → commit/push는 **호스트
  터미널**에서. 락 걸리면 `rm -f .git/index.lock .git/HEAD.lock`.
- **빌더 폭주(GLM):** 컴포넌트서 Supabase 직접호출 / service 우회 / UI부터 / overbuild.
  → HARD RULES 1·2·3 + BUILD ORDER가 항상 이김. 가드레일 상·하단 중복 명시.
- **`db reset` 통과 함정 + GLM의 DB/RLS 한계 (Task 3 R1):** GLM의 Task 3가 mechanical 게이트(db reset/
  typecheck/test/audit)는 다 통과했는데 의미가 깨져 있었다 — rpc가 없는 컬럼(audit_logs.idempotency_key)에
  insert, frozen enum 밖 reason code, RLS로 컬럼 못 숨김(review_summary 노출 + role 자가승격 가능), approve
  from_status 오기록, prompt doc 손상. plpgsql 오류는 *호출 시* 터지므로 apply-only 검증은 불충분.
  → 대응: (a) DB/RLS/rpc 같은 보안경계 고정밀 작업은 **Task 3 한정 Codex 빌더 예외**(자기승인 금지, Cowork 감사).
  (b) 감사는 apply뿐 아니라 실제 rpc 호출 + RLS 역할 단언까지. (c) 재현가능 smoke test 커밋(§4 권고).
  R2(Codex 재구현)는 6건 전부 수정 + Cowork PASS. 증적: docs/TASK3_AUDIT_FINDINGS.md "Round 2".

---

## 7. 환경/사실 메모

- Node 24, pnpm 11.1.3(`packageManager` 핀), corepack이 폴더 안에서 자동으로 핀 버전 사용.
- pnpm 11: 설정은 `pnpm-workspace.yaml`(`.npmrc` 아님). engineStrict/minimumReleaseAge:1440/
  blockExoticSubdeps:true/onlyBuiltDependencies:[esbuild].
- Supabase 로컬 = Docker. `supabase db reset`은 **로컬 Docker만** 초기화(클라우드 아님).
  클라우드는 배포 시점에 `supabase link`+`db push`로 한 번만(지금 미리 연결 안 함 — 실험단계엔 위험).
- 빌더는 Cline 또는 Claude Code+GLM. Claude Code는 `.clinerules` 안 읽고 `CLAUDE.md` 읽음(미러됨).
```
