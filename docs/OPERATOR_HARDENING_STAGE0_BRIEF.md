# Operator Hardening STAGE-0 — Design Brief (Claude/Cowork)

> **Step 1 of the loop** (Claude 설계 → Codex 계획 → Claude 승인 → Codex 빌드 → Claude 최종 감사). **Builder ≠ approver.**
> **SECURITY 레이어 = full 감사 루프**(surface 아님). 체인 코드 0 · main 위 · `docs/FUTURE_censorship_resistance_icp.md` STAGE-0 실현.
> 목표: 영장/강압 하 **마스터 스켈레톤 키(service-role)**와 **미강제 audit 무결성**이라는 두 chokepoint를, 마이그레이션 위험 없이 *지금* 친다.
> **⚠️ 이 brief는 frozen 표면(0003 RLS·audit 서비스)을 건드린다 → JT의 명시적 GO + 해당 부분 "unfreeze contract" 필요.** 무단 진행 금지.

## 0. Why (grounded @ `92783ef`)
검열저항 워크플로의 **단일 최고-레버리지 near-term** 항목 두 가지(체인 무관, dormant 아님):
- **service-role 슈퍼키**: `0003_rls.sql:3` `grant all privileges on all tables in schema public to service_role` + 모든 특권 RPC(`0004`)가 service_role 실행. **단일 비구획 시크릿 하나가 전 테이블(ciphertext·envelope·그래프·dossier·persona) 읽기 + 특권행위 위조**. 도난/강압 = 전부 노출. (data-min 매트릭스 class e — "이거 전엔 나머지 무의미".)
- **audit hash chain 미강제**: `feature-flags.ts:41 auditHashChainEnabled:false`("columns exist, populated in P1"), `audit_logs.hash/previous_hash`(0001:138-139) 컬럼만 존재. **변조-증거(tamper-evidence)가 설계됐으나 미배선** → 운영자/슈퍼키가 이력을 조용히 고쳐도 탐지 불가.

## 1. Hard boundary (최종 감사 강제)
- **STAGE-0a(audit hash chain)**: `auditHashChainEnabled`를 true로 하고 audit 기록 경로(`packages/core/src/domain/audit/*`, `ports/audit-log-repository.ts`, 이를 호출하는 서비스)에서 **append-only 해시 체인 계산·기록**(`hash = H(payload ‖ previous_hash)`)을 배선. **컬럼·플래그·도메인이 이미 존재** → "P1에 채우기로 설계된 배선 완성"이지 신규 계약 아님(단 audit 도메인이 CONTRACT-FROZEN이면 그 파일 unfreeze 필요 — Codex가 Step-2에서 명시).
- **STAGE-0b(service-role 구획화)**: `0003`의 모놀리식 `grant all ... to service_role`를 **bounded-context별 least-privilege 역할**로 분할(예: admission/membership/messaging/audit 분리), 각 adapter·RPC가 *필요 최소* 역할만. **이건 frozen 0003 RLS + INV-17(3-client 경계)를 광범위하게 건드림 → 더 큰 작업·반드시 unfreeze.** 권장: **0a 먼저(contained), 0b는 후속 라운드** 또는 *부분*(가장 민감한 읽기를 service_role에서 먼저 떼기).
- **0-diff 유지**: `packages/core`의 frozen 시그니처·enum·test assertion, 토크노믹스/체인 코드, PWA, package/lock. **신규 npm dep 0.** main의 `externalLedgerEnabled`/`icpBackendEnabled` HARD-false 불변.
- **불변식 보존**: 어떤 `*.test.ts`도 약화·skip 금지. 3-client 경계(INV-17)·admission_events/audit_logs/reasonCode(HARD RULE 4) 의미 유지. builder≠approver.

## 2. STAGE-0a — audit hash chain 강제 (contained, 권장 먼저)
- audit 기록 시 직전 행의 `hash`를 읽어 `previous_hash`로, 현재 행 정규화 payload와 결합해 `hash` 계산·저장(결정적·정규화된 직렬화; reasonCode/actor/entity/timestamp 포함, **평문/키 절대 미포함 — INV-16**).
- 동시성: 같은 체인에 대한 append는 직렬화(per-chain 순서 보장; RPC 트랜잭션 내 or advisory lock). 멀티-체인 분할 여부는 Codex가 제안.
- `auditHashChainEnabled` true. **검증 테스트(신규, 약화 아님)**: (1) 연속 기록의 hash 연결 정확 (2) 한 행 변조 시 체인 단절 탐지 (3) flag off→on 회귀 없음.
- **frozen 주의**: audit 도메인/서비스가 CONTRACT-FROZEN이면 그 한정 unfreeze를 Step-2에서 명시·범위 최소화.

## 3. STAGE-0b — service-role 구획화 (더 큰 작업, unfreeze 필수)
- 목표: **단일 슈퍼키 제거** → 컨텍스트별 least-privilege 역할. 어떤 단일 자격도 전 테이블 읽기·전 특권행위 위조 불가.
- 0003의 `grant all privileges ... to service_role` 제거/대체 + 각 RPC(`*_tx`)·adapter가 필요 테이블/행위만. **INV-17 server-only 티어가 다수 역할로 분기** — 3-client 경계 의미는 유지하되 "service-role 단일"→"least-privilege 역할군".
- **break-glass/마이그레이션 역할**은 잔존 불가피(§FUTURE 바닥 #2) → 이건 *분리·로깅·가급적 threshold*로 다루고 일상 경로에서 격리.
- **위험이 커서** 부분 도입 권장: 1차로 가장 민감한 읽기(ciphertext/envelope/그래프/dossier)를 service_role 직접 읽기에서 떼어 전용 제한 역할로. 전면 분할은 별도 라운드.

## 4. Acceptance gates (Claude 최종 감사 — full 루프)
- `pnpm -r typecheck` · `pnpm -F @soulbound/core test`(약화 아님) · `pnpm -F web test` · `pnpm -r build` · `bash scripts/audit.sh` · `git diff --check`.
- **🔴 host (DB 변경)**: 로컬 Supabase `db reset` 후 통합/RLS 테스트, **§6 결정성 5x+reset** (security 레이어 = full). 0b는 권한 회귀 테스트(각 역할이 *못 하는* 것 검증) 필수.
- **boundary**: 체인 코드 0·신규 dep 0·토크노믹스/PWA/lock 0-diff. main 플래그 HARD-false 불변.
- **🔴 무결성**: hash chain on 상태에서 변조 탐지 테스트 green. 0b면 "단일 역할로 전 테이블 읽기 불가" 증명.
- **unfreeze 추적**: 어떤 frozen 파일을 왜 unfreeze했는지 Step-2 계획에 명시, 최소 범위.

## 5. Handoff to Codex (Step 2)
계획 제시: (0a) audit 기록 경로의 hash-chain 배선 지점·정규화 직렬화·동시성·flag flip·검증 테스트, 어떤 audit 파일이 frozen이라 unfreeze 필요한지. (0b) service_role 분할의 역할 맵·RPC/adapter별 최소 권한·0003 재작성 범위·INV-17 영향·부분 도입 경계·권한 회귀 테스트. **명시 확인**: 체인 코드 0·신규 dep 0·core frozen 시그니처/테스트 불변·main 플래그 HARD-false 불변·builder≠approver. Claude 승인 전 빌드 금지.

## 6. 권장 시퀀스
**0a(hash chain) 먼저** — contained, 설계된 배선 완성, 변조-증거 즉시 확보. **0b(service-role 분할)는 별도 라운드** 또는 부분 — frozen RLS·INV-17 광범위 영향이라 unfreeze + 신중한 설계 필요. 둘 다 SECURITY = full 감사 루프, builder≠approver.
