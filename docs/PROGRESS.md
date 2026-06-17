# SoulBound Phase 1 MVP — 작업 진척도 트래커 (Work Progress Tracker)

> 이 문서는 SoulBound Phase 1 MVP의 **현재 작업 진척도**를 추적한다.
> 설계는 `docs/architecture/SoulBound_Phase1_MVP_BuildPlan_v1.3-FROZEN.md`(동결)을 기준으로 한다.
> UI/UX 변경 추적은 별도 문서 `docs/UIUX_CHANGELOG.md`를 참조.

- **현재 버전**: v1.3-FROZEN (0A + 0B + 0C 동결 + 0D freeze commit)
- **마지막 검증 일자**: 2026-06-17 (UTC)
- **검증 환경**: Node 24.16.0 / pnpm 11.1.3
- **현재 브랜치**: `main` (freeze commit `991dc5d`)

---

## 1. 한눈에 보는 현황 (Snapshot)

| 게이트 | 결과 | 비고 |
| --- | --- | --- |
| `typecheck` (strict) | ✅ CLEAN | strict + exactOptionalPropertyTypes + noUncheckedIndexedAccess + verbatimModuleSyntax |
| `build` (@soulbound/core) | ✅ EMIT | `dist/` 생성 확인 (index.js, *.d.ts, domain/ports/config/application) |
| `test` (vitest) | ⏳ 19 RED | 전부 `NOT_IMPLEMENTED` — **freeze의 정상 상태** (Task 2 대기) |
| `audit` (scripts/audit.sh) | ✅ PASSED | apps/supabase 미존재 검사는 SKIP |

> 19개 RED 테스트는 "깨진 셋업"이 아니라 **"구현 대기"** 상태다. 계약(types/ports/test)이 먼저 동결되고
> 서비스 본문 구현(Task 2)이 이 테스트들을 GREEN으로 바꾸는 구조다.

---

## 2. 단계별 진척 (Phase / Task Progress)

### 동결 단계 (Cowork 소유 — 완료)

| 단계 | 내용 | 상태 |
| --- | --- | --- |
| 0A | core 계약 파일 (types/ports/policy/service 인터페이스) | ✅ 완료 (동결) |
| 0B | invariant 테스트 19개 (RED) | ✅ 완료 (동결) |
| 0C | 검증된 toolchain plumbing (package.json, pnpm-workspace, tsconfig, audit.sh, core configs) | ✅ 완료 (동결) |
| 0D | freeze commit | ✅ 완료 (`991dc5d`) |

### 구현 단계 (Cline 소유)

| Task | 내용 | 통과 기준 | 상태 |
| --- | --- | --- | --- |
| **Task 1** | repo 배치 · 스크립트 연결 · typecheck/build/audit 통과 | typecheck/build/audit PASS (test는 RED 허용) | ✅ **검증됨** (현재 트리에서 모두 통과) |
| **Task 2** | `DefaultAdmissionService` / `DefaultMembershipService` 본문 구현 → 19 tests GREEN | `pnpm -F @soulbound/core test` 0 fail / 0 skip | ⏳ **다음 작업** |
| Task 3+ | adapters (Supabase/noop), migrations, RLS, API routes, apps/web UI | (BuildPlan 참조) | ⛔ 미착수 |

> ⚠️ `.clinerules`: **명시적으로 요청된 task만 구현**한다. Task 2를 끝내기 전에 adapters/migrations/UI로 넘어가지 않는다.

---

## 3. 모듈별 구현 현황 (Module Status)

`packages/core` (순수 TypeScript 도메인) 만 존재한다. `apps/`, `packages/adapters`, `supabase/` 는 아직 생성되지 않음.

| 모듈 | 경로 | 상태 |
| --- | --- | --- |
| Result / errors / container | `packages/core/src/application/` | ✅ 계약 동결 (container wiring은 Task 5) |
| feature-flags | `packages/core/src/config/feature-flags.ts` | ✅ 동결 (P0 main: `externalLedgerEnabled:false`) |
| shared types | `packages/core/src/domain/shared/types.ts` | ✅ 동결 |
| admission types/policy | `packages/core/src/domain/admission/{types,admission-policy}.ts` | ✅ 동결 (policy 구현됨) |
| admission service | `packages/core/src/domain/admission/admission-service.ts` | ⏳ stub (Task 2에서 본문 구현) |
| membership service | `packages/core/src/domain/membership/membership-service.ts` | ⏳ stub (Task 2에서 본문 구현) |
| audit/outbox/ledger/storage types | `packages/core/src/domain/*/types.ts` | ✅ 동결 |
| ports (8개) | `packages/core/src/ports/*.ts` | ✅ 동결 |
| mock-ports (test-support) | `packages/core/src/test-support/mock-ports.ts` | ✅ 동결 |
| adapters (Supabase/noop) | `packages/adapters/` | ⛔ 미생성 |
| API routes | `apps/web/app/api/**` | ⛔ 미생성 |
| UI (apps/web) | `apps/web/app/**`, `apps/web/components/**` | ⛔ 미생성 → `docs/UIUX_CHANGELOG.md` 참조 |
| DB migrations / RLS | `supabase/migrations/**` | ⛔ 미생성 |

---

## 4. 테스트 RED 인벤토리 (Task 2 완료 정의)

총 19개 테스트가 `NOT_IMPLEMENTED`로 RED. 이들이 전부 GREEN이 되면 Task 2 완료.

| 테스트 파일 | 대상 서비스 | 상태 |
| --- | --- | --- |
| `src/domain/admission/admission-service.test.ts` | `DefaultAdmissionService` (submit / startReview / approve / reject / requestMoreInfo 등) | ⏳ RED |
| `src/domain/membership/membership-service.test.ts` | `DefaultMembershipService` (getMyMembership 등) | ⏳ RED |

**구현 순서 (테스트가 강제):**
1. role guard → `Err(FORBIDDEN)` (INV-11)
2. load → `Err(NOT_FOUND)`
3. state guard → `Err(INVALID_STATE_TRANSITION)`
4. 원자 rpc 호출 → `admissionRepo.*Tx(...)` (INV-18)
5. (approve만) `flags.externalLedgerEnabled` 일 때만 outbox enqueue, try/catch로 실패 흡수 (INV-13)

**Task 2 제약:**
- `*.test.ts`, port 시그니처, 도메인 타입, `AdmissionReasonCode`, `Result`, `errors`, `feature-flags` 수정 금지.
- `@supabase` / concrete-chain SDK import 금지.
- Persona Clip: `personaClipAssetId` / `personaClipHash` 는 OPTIONAL — 부재(undefined/null)가 submit 검증 또는 상태전이 guard에 영향을 주면 안 됨 (INV-PC-01, INV-PC-07).

---

## 5. 불변식 게이트 (Invariant Gate) 현황

`scripts/audit.sh` 정적 감사 기준. 현재 트리에서 모두 통과 또는 (경로 미존재) SKIP.

| 검사 | 현황 |
| --- | --- |
| FROZEN: core에 skip/todo 없음 | ✅ OK |
| FROZEN: free-text reason 필드 없음 (INV-22) | ✅ OK |
| chain-neutral: concrete-chain SDK import 0건 (INV-25) | ✅ OK |
| chain-neutral: core src에 'sui' 리터럴 0건 | ✅ OK |
| core에 @supabase import 0건 | ✅ OK |
| persona clip: apps에 supabase.storage 직접호출 | ⏭️ SKIP (apps 미존재) |
| components에 직접 supabase client 0건 (INV-01) | ⏭️ SKIP (apps/web/components 미존재) |
| plaintext/raw-key 컬럼 0건 (INV-19) | ⏭️ SKIP (supabase/migrations 미존재) |
| chat/messages route 0건 (INV-20) | ⏭️ SKIP (apps/web/app 미존재) |
| rpc migration에 COMMIT/ROLLBACK 없음 | ⏭️ SKIP (supabase/migrations 미존재) |

> ⏭️ SKIP 항목은 해당 레이어(apps/adapters/supabase)가 생성되는 후속 Task에서 OK로 활성화되어야 한다.

---

## 6. 다음 작업 (Next Up)

1. **Task 2 구현**: `DefaultAdmissionService` / `DefaultMembershipService` 본문 작성 → 19 tests GREEN.
   - 통과 기준: `pnpm -F @soulbound/core test` (0 skip) + build + typecheck + audit 전부 PASS.
2. 이후 (BuildPlan 순서): adapters → migrations/RLS → API routes → `apps/web` UI.
   - UI 단계 진입 시 `docs/UIUX_CHANGELOG.md`에 화면/컴포넌트 변경을 기록한다.

---

## 7. 검증 재현 절차 (How to Re-verify)

```bash
# Node 24 필요 (engineStrict). nvm 사용 시:
nvm use 24            # 또는 nvm install 24
corepack enable && corepack prepare pnpm@11.1.3 --activate

pnpm install
pnpm -r typecheck                  # CLEAN 기대
pnpm -F @soulbound/core build      # dist emit 기대
pnpm -F @soulbound/core test       # 현재 19 RED (Task 2 완료 시 GREEN)
bash scripts/audit.sh              # AUDIT PASSED 기대
```

> 참고: 현재 환경에서 `pnpm install`이 `esbuild` 빌드 스크립트를 무시(`ERR_PNPM_IGNORED_BUILDS`)하여
> 비-0 종료할 수 있다. `pnpm-workspace.yaml`의 `allowBuilds.esbuild` 값은 동결 파일 내 플레이스홀더이며,
> 검증 자체(typecheck/build/test/audit)는 `packages/core/node_modules/.bin`의 로컬 바이너리로 직접 실행해 통과를 확인했다.

---

## 8. 변경 로그 (이 트래커 자체)

| 일자 | 변경 |
| --- | --- |
| 2026-06-17 | 트래커 최초 작성. freeze 상태(typecheck/build/audit PASS, 19 RED) 검증 및 기록. |
