# SoulBound — Cowork Freeze Commit (0A + 0B + 0C) 핸드오프

이 묶음은 **Cowork가 동결한 계약 코드 + invariant 테스트**입니다. `packages/core/src/` 를 repo 루트에 그대로 떨구고 freeze commit을 찍으면 됩니다. Cline은 이 파일들의 **시그니처/타입/테스트를 수정할 수 없습니다.**

> 0C revision (v1.3): chain-neutral ledger(Sui 탈명사화), `grantSoul → issueActivationStake`,
> optional Persona Clip 계약 필드 + 테스트. 자세한 diff는 `docs/V1.3_CHANGESET.md` 참조.

---

## 0. 검증 상태 (Cowork가 확인함)

```text
TypeScript strict typecheck: CLEAN
  (strict + exactOptionalPropertyTypes + noUncheckedIndexedAccess + verbatimModuleSyntax)
Vitest: 19 tests, 19 RED — 전부 NOT_IMPLEMENTED 사유
  (기존 15 + Persona Clip 4. 깨진 셋업이 아니라 "구현 대기" 상태 = freeze의 정상 상태.)
```

Task 1 통과 기준 = typecheck/build/audit (테스트 green 요구 X).
Task 2 통과 기준 = 위 19개 테스트 green.

---

## 1. 동결 범위 (Cowork 소유, 수정 금지)

```text
application/result.ts        Result<T,E>, ok/err/isOk/isErr
application/errors.ts        AppError + AppErrorCode taxonomy (hybrid 모델)
application/container.ts     CoreContainer 인터페이스 (wiring은 Task 5)
config/feature-flags.ts      FeatureFlags 형태 + P0 main 리터럴 (externalLedgerEnabled:false) + personaClip* flags
domain/shared/types.ts       UserRole, Actor, ISODateString
domain/admission/types.ts    AdmissionStatus, AdmissionReasonCode, AdmissionApplication, commands
domain/admission/admission-policy.ts   순수 정책 규칙 (구현됨, 동결)
domain/admission/admission-service.ts  AdmissionService 인터페이스 + stub
domain/membership/types.ts   Membership, MembershipStatus, MembershipTier
domain/membership/membership-service.ts  MembershipService 인터페이스 + stub
domain/{audit,outbox,ledger,storage}/types.ts
ports/*.ts                   8개 포트 인터페이스
test-support/mock-ports.ts   mock 팩토리 + 빌더
domain/**/**.test.ts         invariant 테스트 (RED)
index.ts                     공개 surface 배럴
```

## 2. 에러 모델 (hybrid — 동결됨)

```text
예상된 도메인 실패 → Result<T, AppError> 값으로 반환
  VALIDATION / FORBIDDEN / NOT_FOUND / INVALID_STATE_TRANSITION / CONFLICT
진짜 버그·예외 폭발 → throw (경계 핸들러가 잡음)

이유: 403/409/422 같은 도메인 결과를 값으로 만들면 API route가 타입 레벨에서
강제로 처리하게 됨(무시 불가). 버그는 throw로 올려 500 경계에서 처리.
```

## 3. 핵심 설계 결정 (Cline이 반드시 따라야 함)

```text
- 상태전이(approve/reject/requestMoreInfo/submit/startReview)는 admissionRepo의
  *Tx 메서드 1개 호출로 끝난다. 이 *Tx 는 Postgres rpc 1개 = 트랜잭션 1개이며,
  내부에서 admission_events + audit_logs 를 함께 쓴다(INV-05/06/18).
  → 서비스는 audit/event 를 별도 순차 호출로 쓰지 않는다.
- reasonCode(enum)만 흐른다. 자유서술 reason 필드는 타입에 존재하지 않는다(INV-22).
- approve의 사후 outbox/ledger 단계는 flags.externalLedgerEnabled 일 때만, try/catch 안에서.
  실패해도 이미 커밋된 approval/membership 을 롤백하지 않는다(INV-13).
- flags 는 deps 로 주입받는다(import 직접 X). 테스트가 override 가능해야 INV-13 검증됨.
```

서비스 구현 순서(테스트가 강제):
```text
1) role guard   → Err(FORBIDDEN)                if !canReview(actor.role)   (INV-11)
2) load         → Err(NOT_FOUND)                if 없음
3) state guard  → Err(INVALID_STATE_TRANSITION) if 불가 상태
4) 원자 rpc 호출  → admissionRepo.*Tx(...)
5) (approve만) flags ON 시 outbox enqueue, try/catch 로 실패 흡수
```

---

## 4. `.clinerules` 에 추가할 줄

```text
Frozen contract files and frozen service tests are owned by Cowork.
Files under packages/core/src marked "CONTRACT-FROZEN" must not be altered
(signatures, types, enums, test assertions) unless the user explicitly says
"unfreeze contract". Do not .skip or .todo frozen tests.

Chain-neutral: do NOT import any concrete-chain SDK (e.g. @mysten, aleo, aztec,
zcash) on main, and do NOT implement any external-ledger adapter on main.
LedgerPort on main = NoopLedgerAdapter only.

Persona Clip is an admission artifact, not a message/media feature: in-app
recording only; no upload/preview/retake/edit; absence must never block submit;
storage access must go through StoragePort, never supabase.storage directly.
```

`scripts/audit.sh` 에 추가할 검사 (경로를 정확히 분리 — `docs/`의 설명용 historical mention은 제외):
```bash
# frozen core protections
echo "== frozen: no skip/todo in core =="; rg "\.skip\(|\.todo\(" packages/core/src && exit 1 || echo OK
echo "== frozen: no free-text reason field =="; rg "reason\s*[:?]\s*string" packages/core/src && exit 1 || echo OK
# chain-neutral: concrete-chain SDK only checked in CODE, not docs
echo "== chain-neutral: no concrete-chain SDK in code =="; rg -i "@mysten|aleo|aztec|zcash" packages apps 2>/dev/null && exit 1 || echo OK
echo "== chain-neutral: literal 'sui' not in core src =="; rg -ni "\bsui\b" packages/core/src && exit 1 || echo OK
# no plaintext / raw-key columns (precise — conversation_key_envelopes & wrapped_key are LEGIT)
echo "== no plaintext/raw-key columns =="; rg -n "\b(plaintext|body_plain|content_plain|decryption_key|raw_key|plain_key|conversation_key_plain|conversation_key_raw)\b" supabase/migrations 2>/dev/null && exit 1 || echo OK
# persona clip: no direct storage in UI, no storage_path leaking to audit/outbox
echo "== persona clip: no supabase.storage in apps =="; rg "supabase\.storage" apps 2>/dev/null && exit 1 || echo OK
# (docs/V1.3_CHANGESET.md & BuildPlan changelog may mention Sui historically — intentional, NOT audited)
```

---

## 5. Cline Task 1 프롬프트 (복붙)

```text
Use docs/architecture/SoulBound_Phase1_MVP_BuildPlan_v1.3-FROZEN.md as the frozen design contract.
(See also docs/V1.3_CHANGESET.md for the v1.3 delta, and docs/TOOLCHAIN_FREEZE_HANDOFF.md for 0C.)

IMPORTANT — the toolchain plumbing is ALREADY PROVIDED and verified by Cowork (0C). It is NOT
yours to invent. These files already exist in the repo and must NOT be modified or loosened:
  package.json, pnpm-workspace.yaml, tsconfig.base.json, .nvmrc, .npmrc, scripts/audit.sh,
  packages/core/package.json, packages/core/tsconfig.json, packages/core/tsconfig.build.json,
  packages/core/vitest.config.ts
The folder packages/core/src already contains Cowork's FROZEN contract files and tests.

Implement Task 1 ONLY — place the provided files and make the frozen core compile/build/audit:
- verify the provided 0C toolchain files and frozen core are in place (do not recreate them)
- if (and only if) something is missing wiring (a path the workspace can't resolve), add the
  minimal wiring to fix it — do NOT change tsconfig strictness, package scope, scripts, or pnpm settings
- DO NOT create or rewrite pnpm-workspace.yaml, tsconfig.base.json, or any 0C file
- DO NOT change any file under packages/core/src
- DO NOT implement service bodies, adapters, migrations, API routes, or UI
- DO NOT implement any external ledger / settlement chain. LedgerPort on main = Noop only.
- DO NOT import @supabase or ANY concrete-chain SDK anywhere on main (chain-neutral v1.3)

Task 1 acceptance (all must pass):
  pnpm install
  pnpm -r typecheck
  pnpm -F @soulbound/core build
  bash scripts/audit.sh
Note: `pnpm -F @soulbound/core test` will FAIL (19 RED, NOT_IMPLEMENTED) after Task 1 because
frozen tests define Task 2 obligations. That is expected. Do not make tests pass by editing them.
```

## 6. Cline Task 2 프롬프트 (복붙)

```text
Implement Task 2 ONLY — make the frozen core tests green (19 tests).

- implement the bodies of DefaultAdmissionService and DefaultMembershipService
  in packages/core/src so that all tests under packages/core/src/**/*.test.ts pass
- you MAY add private helpers inside packages/core/src
- you MUST NOT edit any *.test.ts file, any port signature, any domain type,
  AdmissionReasonCode, Result, errors, or feature-flags
- you MUST NOT add @supabase or ANY concrete-chain SDK imports
- Persona Clip note: personaClipAssetId / personaClipHash are OPTIONAL. Their absence
  (undefined OR null) MUST NOT fail submit validation, and a clip MUST NOT affect any
  status-transition guard (INV-PC-01, INV-PC-07). The frozen tests already assert this.
- follow the implementation order encoded by the tests:
  role guard (FORBIDDEN) -> load (NOT_FOUND) -> state guard (INVALID_STATE_TRANSITION)
  -> single atomic *Tx call -> (approve only) optional outbox under
     flags.externalLedgerEnabled, try/catch (INV-13)

Task 2 acceptance:
  pnpm -F @soulbound/core test     # all green, 0 skipped
  pnpm -F @soulbound/core build
  pnpm -r typecheck
  bash scripts/audit.sh
```

## 7. Freeze commit

```bash
# packages/core/src 를 repo 에 떨군 뒤:
git add packages/core docs
git commit -m "freeze: v1.3 admission underwriting + persona clip + chain-neutral ledger (19 red)"
```
