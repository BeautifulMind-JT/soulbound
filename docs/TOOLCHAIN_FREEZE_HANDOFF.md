# SoulBound — 0C Toolchain Freeze Handoff

이 묶음은 **Cowork가 검증한 빌드 배관(plumbing)** 입니다. `packages/core/src`(0A/0B 도메인 계약)와 달리 영구 도메인 동결은 아니지만, **Cline이 발명하면 안 되는 고정 배관**입니다. Cline Task 1의 자유도를 "배관 발명"에서 "검증된 배관을 repo에 맞게 연결·통과"로 축소합니다.

## 검증 상태 (Cowork가 실제 toolchain으로 확인)

```text
Node 24 / pnpm 11.1.3 환경 기준:
  pnpm install                         → 성공 (engineStrict로 Node<24는 차단됨을 실측)
  pnpm -F @soulbound/core typecheck    → CLEAN (실제 tsconfig.json, base extends 체인)
  pnpm -F @soulbound/core test         → 19 RED (NOT_IMPLEMENTED) — Task 2 대기 상태
  pnpm -F @soulbound/core build        → dist emit 성공, *.test.ts / test-support 제외 확인
  bash scripts/audit.sh                → PASS (apps/ supabase/ 미존재 시 해당 검사 SKIP)
```

## 동결된 배관 파일 (Cline 수정·발명 금지)

```text
루트:
  package.json              packageManager pnpm@11.1.3, engines node>=24/pnpm>=11, -r 스크립트
  pnpm-workspace.yaml       packages(apps/*, packages/*) + engineStrict + minimumReleaseAge:1440 + blockExoticSubdeps
  tsconfig.base.json        strict + exactOptionalPropertyTypes + noUncheckedIndexedAccess + verbatimModuleSyntax
  .nvmrc                    24
  .npmrc                    (pnpm 11: auth/registry 전용. 다른 설정은 pnpm-workspace.yaml로)
  scripts/audit.sh          정적 감사 (chain-neutral/frozen/persona-clip/no-plaintext; 없는 경로는 SKIP)

packages/core:
  package.json              @soulbound/core, type:module, build/typecheck/test 스크립트
  tsconfig.json             typecheck용 (base extends, noEmit, types: vitest/globals)
  tsconfig.build.json       build용 (dist emit, *.test.ts + test-support 제외)
  vitest.config.ts          src/**/*.test.ts
```

## pnpm 11 주의 (드리프트 방지)

```text
- pnpm 11 은 package.json 의 "pnpm" 필드를 읽지 않는다. 설정은 pnpm-workspace.yaml.
- .npmrc 는 auth/registry 전용. engine-strict 등은 pnpm-workspace.yaml(engineStrict)로.
- minimumReleaseAge:1440(1일) + blockExoticSubdeps:true 는 공급망 방어 기본값. 끄지 말 것.
- pnpm 11 은 Node 22+ 요구. 우리는 Node 24 고정(.nvmrc + engines).
- packageManager 핀은 pnpm@11.1.3 (안정 패치). 최신 11.4.x 같은 bleeding-edge로 바꾸지 말 것.
```

## Cline Task 1 범위 (배관 발명 아님 — 연결·통과만)

```text
검증된 toolchain 파일과 frozen core 파일을 repo 에 배치하고,
pnpm install / pnpm -r typecheck / pnpm -F @soulbound/core build / bash scripts/audit.sh 가 통과하게 하라.
- packages/core/src 수정 금지
- 위 배관 파일들의 shape 수정 금지 (tsconfig 느슨하게 풀기 금지)
- 누락된 wiring 보정만 허용 (예: workspace 가 못 잡는 경로 연결)
- 테스트는 RED 정상. green 은 Task 2.
```

## 실행 순서 (0A/0B/0C 통합)

```text
0A Cowork: core contract files            (packages/core/src — 동결)
0B Cowork: invariant tests, red           (19 RED — 동결)
0C Cowork: verified toolchain plumbing    (이 문서 — 동결)
0D freeze commit
Task 1 Cline: repo 배치 · 스크립트 연결 · typecheck/build/audit 통과만
Task 2 Cline: service body 구현, frozen 19 tests green
```
