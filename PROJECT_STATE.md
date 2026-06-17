# SoulBound — PROJECT_STATE (설계자/감사자 인수인계)

> 이 문서는 **설계·감사 역할(Architect/Auditor)** 의 인수인계 문서입니다.
> 여러 Cowork 세션 / 채팅이 이 프로젝트를 이어받을 때, **이 파일 + repo 파일이 진실의 원천**입니다.
> 자기 기억이 아니라 여기 적힌 결정과 그 *이유*를 기준으로 판단하세요.
> 결정을 바꾸면 반드시 이 파일을 갱신하고 커밋하세요(머릿속에만 두지 말 것).

마지막 갱신: Task 4 adapters = Cowork 3라운드 감사 **PASS**, 커밋됨(4899ca8 feat + 4de4513 docs, pushed). Task 1–4 커밋 완료. **pre-Task-5 rpc/RLS smoke test = Opus 감사세션 최종 PASS**(Codex 빌드, 41 pgTAP green; 증적 docs/PRE_TASK5_SMOKE_TEST_AUDIT.md). 커밋 = JT(`test(db)`+`docs`). **Task 4.5(신뢰 role 소스, carry-forward ②) = Opus 감사세션 PASS**(0006 `current_user_role()` + adapter RPC 해석 + seed 정리 + smoke 41→49; 증적 docs/TASK4_5_AUDIT_FINDINGS.md). 커밋 = JT. **Task 5(service 배선) = Opus 감사세션 PASS**(makeCoreContainer + 실 reviewer 승인경로 live 통합테스트; 증적 docs/TASK5_AUDIT_FINDINGS.md). 커밋 = JT. **Task 5.5(seed sign-in 수정) = Opus 감사세션 PASS**(seed에 auth.identities + aud/instance_id/'' token 보강[role은 metadata에 안 넣음], 시드 유저 실 sign-in 런타임 게이트; 증적 docs/TASK5_5_AUDIT_FINDINGS.md). 커밋 = JT. **Task 6a = Opus 감사세션 PASS**(apps/web 스캐폴드 + applicant 라우트). 최초 PASS는 flaky 통합테스트로 성급(§6 교훈) → HOLD → **corrective(4fa4755: fixture-auth bounded retry, fixture 전용·route/단언 무손상, tsbuildinfo 정리)** → **JT 호스트 5/5 연속 + db reset 후 green = 결정성 확정** → 최종 PASS. audit.sh 빌드아티팩트 보정(1c243c1) 별개 유효. 증적 docs/TASK6A_AUDIT_FINDINGS.md. **Task 6b(admin/reviewer 라우트) = Opus 감사세션 PASS**(reviewer 큐/상세 read + 4전이; route 역할게이트가 service-role read의 유일 보호막, review_summary 경계 양방향; RLS 정책 미추가=service-role route, BuildPlan §5.3.2; 증적 docs/TASK6B_AUDIT_FINDINGS.md). 커밋 = JT. **Task 6(API routes) 완료**. **Task 7a(persona-clip routes + signed-upload adapter) = Opus 감사세션 PASS**(adapter `createUploadUrl`[core StoragePort frozen 유지·concrete adapter 확장]·reviewer signed-read-url·submit-attach시 retention clear corrective; INV-PC-06 누수 0 런타임검증; 호스트 5/5+reset 결정성; 증적 docs/TASK7A_AUDIT_FINDINGS.md). 커밋 = JT. **Task 7b(persona-clip-recorder 컴포넌트) = Opus 감사세션 PASS**(Codex 빌드[§6 표면 예외·안정성]; INV-PC-05 components에 supabase/createClient/service-role **0**·upload-before-onComplete[7a 잔여#2 차단]·라이브 viewfinder/녹화후 no-preview·retake; mocked 단위테스트 6개 결정성[flaky 위험 0]; 증적 docs/TASK7B_AUDIT_FINDINGS.md). 커밋 = JT. **Task 7 완료**. **§8 빌더정책 공식화(2026-06-05, JT 승인): Codex가 전 레이어 빌드, GLM/Claude Code는 빌더 은퇴 — 5개 정본(WORKFLOW/CLAUDE/AGENTS/.clinerules/PROJECT_STATE) 동기화, 개정 배너 + 스테일 GLM-배정 0 검증.** **Task 8(UI) = 8a/8b 분할(JT 승인).** 다음 **Task 8a(auth foundation + 공개/신청 UI) = Opus 감사세션 PASS**(Codex 빌드; browser anon 클라이언트 persistSession·authedFetch bearer·current_user_role 역할해석[새 라우트 0]·7b recorder bearer 배선보정·페이지 7; INV-17 service-role 0[소스+`.next` 번들 재확인]·PC-01·idempotency; 결정성 단위 29/29[내 재실행]·audit.sh PASS; 증적 docs/TASK8A_AUDIT_FINDINGS.md). 커밋 = JT. 🔴 **HIGH carry-forward: 신규 browser signup이 public.profiles 행 미생성 → submit FK 막힘**(8a 범위 밖 정당; §4 — profiles-provisioning 트리거 태스크를 8b 전에 권장). **profiles provisioning(migration 0007 트리거 + seed/fixtures upsert + 7 pgTAP[anti-escalation 포함, 49→56]) = Opus 감사세션 PASS**(**JT 호스트 5x+reset green 2026-06-08: `supabase test db` 56 + `test:integration` 5/5 ×5, flake 0 — 최종확정**; 증적 docs/PROFILES_PROVISIONING_AUDIT_FINDINGS.md). 커밋 = JT. **Task 8b(member + admin/reviewer) = Opus 감사세션 PASS**(Codex; 순수 클라이언트·새 라우트/adapters/core/db 0·보호표면 EMPTY; 권한 라우트403 위임[role-race 버그 빌더 발견+수정]·reviewSummary reviewer전용·clip 클릭재생·결정 reasonCode enum+idempotency·409 graceful; createClient/service_role/.from 0; web test 42/42 + audit.sh 내 재실행; 결정성 mocked·5x 불요; 증적 docs/TASK8B_AUDIT_FINDINGS.md). 커밋 = JT. **🎉 Task 8(UI) 완료** — signup→gate→apply→submit→(reviewer)approve→member happy-path end-to-end. **Task 9a(persona-clip byte-delete worker, CLI) = Opus 감사세션 FINAL PASS**(Codex 빌드; 1차감사 3×P1 FAIL → 보정 → PASS). unique `owner/assetId` path + DB unique index[#1] · DB-now() reap RPC 2개(list/mark, security-definer·service_role-only·DB COALESCE·원자 predicate 재검사)[#2/#3] · remove-first/no-leak/멱등/StoragePort frozen 유지. **동일-hash safeguard 통합테스트가 공유-hash인데도 protected 바이트 생존 증명**(make-or-break). **호스트 5x+reset green**(run-2서 §6 게이트가 cross-package 테스트격리 누수[web가 남긴 approved clip] 잡음 → web afterEach 정리 → 5x 재증명). pgTAP 56→73, adapters unit 22, audit.sh 내 재실행. 증적 docs/TASK9A_AUDIT_FINDINGS.md. 커밋 = JT. **🎉 P0 MVP 기능 완성**(마지막 실기능=clip 보존 worker). **Task 9b(audit/outbox 하드닝 회귀-lock) = Opus 감사세션 PASS** — 유일 갭(outbox payload ids-only)을 core 단위테스트로 lock(INV-16; **순수 additive·기존 19 무손상·skip 0**, Cowork 계약확장 인가 → **core 19→20**); 나머지 불변식은 이미 잠김(coverage-map docs/TASK9B_AUDIT_FINDINGS.md). 커밋 = JT. **✅ Task 9 완료 = P0 MVP 기능 + 하드닝 완성.** 잔여(deferred/옵션): **Task 9a-2**(internal cron route) · **Task 10**(external ledger PoC, 별도 브랜치). **RC-1 진행 중**(docs/RC1_RELEASE_RUNBOOK.md + docs/RC1_VERIFICATION.md): 결정 = email-confirm ON·open signup·manual CLI reaper·자동화 deferred·CAPTCHA deferred(코드 미지원). **candidate_sha = `fafba30`**(baseline f9f1bad + fix-forward 2: c07fe98 pnpm allowBuilds[JT-authorized 0C wiring] + fafba30 next 16.2.7/react 19.2.7) — **로컬 게이트 + 5x 결정성 + reap 전부 candidate서 재게이트 green(2026-06-10)**. 스테이징 배포됨(Vercel soulbound-staging[새 계정] apps/web-root+Corepack, Supabase 마이그 0001–0008 **no seed**, 1차 HTTP 스모크만). 잔여: SMTP/site_url → Vercel SSO 해제 → §13 본 스모크 → Opus 최종감사 → §17 go/no-go → `v0.1.0-rc.1` 태그(fafba30). **RELEASE-READY: NO.** **`v0.1.0-rc.1` 태그됨 @ fafba30.** **RC-2 후보 = `e517ec3`**(persona-clip recorder MIME fallback — Samsung/Safari MP4 경로, Chrome/webm 보존; recorder 2파일만·계약 무손상). **코드 = Opus 최종감사 PASS**(독립 적대검증 워크플로 3 lens 전부 holds·P0/P1 0; uploadMimeType 유니온 리터럴로 bare MIME만 API/Storage 도달; mutation test로 테스트 non-vacuity 증명; 증적 docs/RC2_MIME_FALLBACK_AUDIT.md). **CODE PASS + Samsung Internet 실기기 스모크 PASS → `v0.1.0-rc.2` 태그가능**(JT가 GO 시 e517ec3에 태그). **Safari = 후속 호환성 스모크(non-블로커)** — 미지원 시 graceful PC-01 degradation(클립 없이 제출). 단 RC-2 태그 ≠ 제품 release-ready: RC-1 §13 전체 스테이징 스모크(역할·clip 라이프사이클→reap→object absence·INV-17·실 SMTP)는 별도 PENDING(docs/RC1_VERIFICATION.md). 거버넌스 교훈: 한 세션의 build→push→deploy 혼재를 JT가 교정 — 제품코드는 독립 최종감사 GO 후에만 commit/tag/deploy. 브랜치 `phase1-p0-mvp`.

---

## 0. 한 줄 요약

trust-first, 입장심사 기반 비공개 메신저(SoulBound) Phase 1 MVP를, **설계를 먼저 동결(freeze)하고
빌드하는 4-actor 파이프라인**으로 만든다. 중앙화(Supabase+Vercel+Next.js)지만 검열저항/E2EE/탈중앙은
*데이터·권한 형태*로 day 1에 박아 migration-ready로 간다. 원칙: **"기능은 나중에 붙일 수 있다,
데이터·권한 형태는 못 바꾼다."**

---

## 1. 4-ACTOR 파이프라인 (역할 분리 — 절대 섞지 말 것)

> **운영 루프 정본 = `docs/WORKFLOW.md`** (2026-06-01 채택, **2026-06-05 개정**, JT 승인). **개정: Codex가
> 전 레이어(표면+보안) 빌드, GLM/Claude Code는 빌더 은퇴(미사용).** 레이어 위험도는 이제 *감사 깊이*만 좌우
> (표면=fast loop, 보안=full loop). 불변식(최종 승인자 ≠ 짠/보수한 주체)은 **Codex 빌드 → Opus/Cowork 최종**으로 보존.
> HARD RULES는 CLAUDE.md/.clinerules/AGENTS.md/이 문서 네 곳을 함께 갱신(드리프트 금지, §6).

```text
[0] Architect/Auditor  설계 동결 + 최종 의미감사   ← Cowork 한 세션 OR 채팅 (단, 하나로 고정)
[1] Builder            Codex (전 레이어, 06-05 개정)  ← 코드를 짠다 (GLM/Claude Code 은퇴)
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
Task 4 (Codex)   ✅ adapters(@soulbound/adapters). Cowork 감사 3라운드 끝 **PASS**. 커밋됨 4899ca8(feat)+4de4513(docs), pushed.
                    R1 P1(read 컬럼) → admission/membership 안전컬럼 분리로 수정. R2 P1(보안: auth role이
                    user_metadata 폴백 → 자가승격) → app_metadata 전용으로 수정, 테스트가 위조 user_metadata 무시 단언.
                    증적 docs/TASK4_AUDIT_FINDINGS.md(R1~R3).
                    이월(Task 4 비차단): ① approve composite 라이브 shape → **smoke test로 종결**(composite .application
                    +.membership 직접 단언). ② 신뢰 role 소스 → **Task 4.5로 종결**(0006 current_user_role + adapter RPC).
Pre-Task5 게이트  ✅ supabase/tests/pre_task5_rpc_rls_smoke.sql (49 pgTAP, Task 4.5에서 41→49 확장). Opus PASS —
                    R1 빌더 자가수정 P0(partial-unique 충돌), R2 Cowork findings #2(storage_path vacuous)·
                    #3(composite membership 미검증)·#4(auth.uid 양성), R3 clean. 증적 docs/PRE_TASK5_SMOKE_TEST_AUDIT.md.
                    런타임 그린(db reset/test db)은 host 전용 → JT가 커밋 시 재확인.
Task 4.5 (Codex) ✅ 신뢰 role 소스(carry-forward ②). 0006 current_user_role() security-definer + adapter가
                    app_metadata→RPC로 role 해석(claim 무신뢰, fail-closed) + seed user_metadata.role 제거 +
                    smoke 49(role 증명·anti-escalation·anon 거부). Opus 1라운드 clean PASS. 증적 docs/TASK4_5_AUDIT_FINDINGS.md.
Task 5 (Codex)   ✅ service wiring. makeCoreContainer(service-role repos + NoopLedger + featureFlags, AuthPort 분리)
                    + live-Supabase 통합테스트(실 reviewer signIn→current_user_role→canReview→approve RPC→membership,
                    applicant→FORBIDDEN). unit↔integration vitest 분리(pnpm test 스택-free 유지). Opus 1라운드 PASS.
                    증적 docs/TASK5_AUDIT_FINDINGS.md. ⚠️ seed 유저 GoTrue sign-in 불가 발견(§4) — Task 5.5서 종결.
Task 5.5 (Codex) ✅ seed sign-in 수정(auth-plumbing only). seed에 auth.identities + aud/instance_id/'' token +
                    created/updated 보강(role은 어느 metadata에도 안 넣음 → smoke 49 유지). read-only 게이트: 시드
                    admin/reviewer/applicant 실 password sign-in + current_user_role 해석 증명(재실행 안전).
                    full-flow는 throwaway 유지. Opus 1라운드 clean PASS. 증적 docs/TASK5_5_AUDIT_FINDINGS.md.
Task 6a (Codex)  ✅ apps/web 스캐폴드 + 요청인증(resolveActor: getUser 실검증 + current_user_role, claim 무신뢰,
                    fail-closed) + applicant 라우트(POST applications=submit / GET me·[id] / membership/me). 3-client:
                    읽기=user-scoped repo(RLS), 쓰기=service-role container. service-role 키 server-only(INV-17),
                    applicantId=actor(body 위조 차단), 타인 [id]→404, 무세션/invalid→401, Result→HTTP 매핑 누수 0.
                    route-handler 통합테스트(실 토큰 invoke, body주입 능동검증, 재실행) + unit 7. Opus PASS.
                    증적 docs/TASK6A_AUDIT_FINDINGS.md. +audit.sh GREP() .next/dist/node_modules 제외 보정(JT 승인).
                    create-as-submitted 확정(P0 draft 생성경로 없음 — [id]/submit 라우트 미구현).
                    [flaky→해결] 통합테스트가 fixture(createUser/signIn) AuthRetryableFetchError로 비결정적이었음
                    → corrective(4fa4755) fixture-auth bounded retry(retryable-only, fixture 전용, route/단언 무손상)
                    → JT 호스트 5/5 + reset 후 green으로 결정성 확정. route 보안로직은 처음부터 정상(원인=fixture transport).
Task 6b (Codex)  ✅ admin/reviewer 라우트(큐 list/상세 GET + review/approve/reject/request-more-info). 모든 reviewer
                    READ에 requireReviewer(applicant→403; RLS-우회 service-role read의 유일 보호막), 쓰기=service(canReview
                    재검사), actor/id=resolved actor·URL(body 위조 차단), frozen-enum zod. **review_summary 경계 양방향**
                    증명(reviewer 상세=노출 / 같은 신청서 applicant 본인 라우트=비노출). RLS 정책 미추가(BuildPlan §5.3.2 =
                    service-role route + route gate). 결정성: 호스트 5/5 + (reset 컨테이너 실패→stop/start 복구 후) 깨끗한
                    reset→smoke49→integration 4/4. 그 1회 실패는 `db reset` 인프라 실패(broken stack)였고 테스트가 fail-loud로
                    정직히 surfaced(masking 아님, non-retryable "DB error"). Opus PASS. 증적 docs/TASK6B_AUDIT_FINDINGS.md.
                    (minor cosmetic: retry 에러메시지가 non-retryable에도 "after 4 attempts" 표기 — 후속 정리.)
Task 7a (Codex)  ✅ persona-clip routes + signed-upload(보안층, mixed Task 7의 7a). adapter `createUploadUrl`
                    (draft+24h delete_after, provider-TTL 미주장, plain-fetch contract {url,PUT,headers}) +
                    clearSubmittedRetention(corrective) — **core StoragePort frozen 무수정**(concrete adapter 확장).
                    routes: POST/DELETE persona-clip(ownerId=actor, own-draft만; DELETE는 service-role+owner필터,
                    authenticated가 update grant 없어서) + reviewer persona-clip-url(requireReviewer→403, 5min read).
                    submit-with-clip → status='attached' + delete_after=null(corrective). **INV-PC-06**: storage_path·
                    signed upload/read url·token이 audit/outbox/admission_app 텍스트·clip non-path 컬럼에 **0건**(실쿼리).
                    upload→store→reviewer-read 바이트 라운드트립 + PC-01(부재 submit OK). 호스트 5/5+reset 결정성. Opus PASS.
                    증적 docs/TASK7A_AUDIT_FINDINGS.md. (잔여: ①비원자 submit+clear[502 honest·idempotent self-heal·
                    Task9 draft-scope로 무해] ②un-uploaded clip edge=7b가 upload-before-submit 보장.)
Task 7b (Codex)  ✅ persona-clip-recorder 컴포넌트(표면, §6 예외로 Codex 빌드·안정성, JT 승인). 훅
                    usePersonaClipRecorder(getUserMedia/MediaRecorder→blob→sha256→POST persona-clip→upload PUT) +
                    thin shell(라이브 viewfinder, 녹화후 미리보기/재촬영/편집 없음). **INV-PC-05**: components에
                    supabase/createClient/service-role **0**(grep+audit "no direct supabase client in components" OK).
                    **upload-before-onComplete**: onComplete가 upload 2xx 후에만(7a 잔여#2 차단) — 훅 코드+테스트 검증.
                    PC-01 skip/unavailable graceful. 6 hook 단위테스트(media/fetch/crypto 모킹·결정성, flaky 위험 0).
                    실카메라=manual-qa.md(Task8 마운트 시 JT). Opus PASS. 증적 docs/TASK7B_AUDIT_FINDINGS.md.
Task 8a (Codex)  ✅ auth foundation + 공개/신청 UI(§8 개정: Codex 전 레이어). adapters createBrowserSupabaseClient
                    (anon키·persistSession) + AuthProvider(브라우저 anon 클라이언트=auth+current_user_role만, authedFetch가
                    bearer 주입·no-session throw, 역할=신뢰 RPC) + 페이지 7(landing/login/signup/gate/apply/status +layout)
                    + 7b recorder bearer 배선보정(authedFetch 주입; route POST만 bearer, upload PUT은 plain; 6테스트 무변+1).
                    **INV-17**: service-role **0**(클라이언트 소스 + `.next` 번들 둘 다 — 내가 재확인)·createClient 0(components)
                    ·브라우저 .from/.storage 0. PC-01(skip→clip필드 생략·제출 진행, 테스트)·idempotencyKey(1회·재사용·성공시 클리어).
                    게이트=결정성 단위테스트(내 재실행 `pnpm -F web test` 29/29)+audit.sh PASS(내 재실행)+번들 grep. Opus PASS.
                    증적 docs/TASK8A_AUDIT_FINDINGS.md. 🔴 carry-forward(HIGH): 신규 signup이 profiles 행 미생성→submit FK
                    막힘(8a 범위 밖, §4 참조).
profiles provision (Codex)  ✅ Task 8a 발견#1 종결. migration 0007 handle_new_user() 트리거(after insert on auth.users
                    → profiles(id,'applicant') on conflict do nothing; role 리터럴·metadata 무시·security definer+
                    search_path=''·EXECUTE 전부 revoke[definer라 트리거 정상 발동]) + seed profiles upsert(시드 elevated
                    role 생존) + 통합fixtures 4개 insert→upsert(웹3 + adapters container[빌더 정직 scope확장, 정확·필요]) +
                    7 pgTAP(provision·defaults·**anti-escalation** forged{role:admin}→applicant·seed roles; 49→56).
                    보호표면(core/route로직/_lib/lib/UI) EMPTY. audit.sh 내 재실행 PASS. Opus PASS(JT 호스트 5x+reset
                    재현 후 최종확정). 증적 docs/PROFILES_PROVISIONING_AUDIT_FINDINGS.md.
Task 8b (Codex)  ✅ member + admin/reviewer UI(§8 Codex 전레이어). 순수 클라이언트 — 새 라우트/adapters/core/db **0**
                    (보호표면 EMPTY). 페이지 3(member·admin queue·admin detail[id]) + 기존 6b/7a 라우트를 8a authedFetch로
                    소비. **권한=라우트 403 위임**(role 안 읽음 — transient applicant role redirect 버그 빌더 발견+수정,
                    make-or-break #2 정수). reviewSummary=reviewer 상세만(non-reviewer 403→데이터0). clip=클릭 시 signed
                    url fetch→<video>. 결정폼 reasonCode enum(free-text reason 0)+idempotencyKey 매번신규·409→reload·
                    terminal read-only. createClient/service_role/.from 0. audit.sh + web test 42/42 내 재실행 PASS.
                    Opus PASS(결정성 mocked·5x 불필요). 증적 docs/TASK8B_AUDIT_FINDINGS.md. **→ Task 8(UI) 완료.**
Task 9a (Codex)  ✅ persona-clip byte-delete worker(CLI `pnpm -F @soulbound/adapters clip:reap`). 1차감사 3×P1 FAIL
                    → 보정 → FINAL PASS. **#1** unique `owner/assetId` path(createUploadUrl: randomUUID→id 삽입) + DB
                    unique index → row↔객체 1:1(공유-hash safeguard 우회 차단). **#2/#3** migration 0008 reap RPC 2개
                    (list_deletable/mark, **DB now()**·**DB COALESCE**·원자 predicate 재검사·security-definer·search_path=''
                    ·**service_role-only**) → worker 시각/stale-reason 제거. remove-first·반환{error}처리·no-leak·멱등·
                    StoragePort frozen 유지. 통합테스트: 동일-hash 2업로드→distinct path→due reap시 **protected 바이트
                    생존**(make-or-break) + 6상태/absent/멱등. unit: transient 양쪽(반환/throw)·CLI no-leak. pgTAP 56→73.
                    **호스트 5x+reset green**(run-2서 §6가 cross-package web 테스트격리 누수 잡음→web afterEach 정리→재증명).
                    보호표면(core/0004 admission RPC/web 비테스트) EMPTY. audit.sh+adapters unit 22 내 재실행. Opus FINAL
                    PASS. 증적 docs/TASK9A_AUDIT_FINDINGS.md. (잔여: 9b 하드닝 회귀·9a-2 cron route·Task10 ledger.)
Task 9b (Codex)  ✅ audit/outbox 하드닝 회귀-lock(thin·HARD RULE 10 준수). 유일 갭=outbox payload shape 미잠금(INV-13
                    테스트는 enqueue reject mock이라 payload 미검사) → core 단위테스트 1개 추가: flag-on approve의 enqueue
                    payload 키셋이 정확히 {applicationId,membershipId,userId,policyVersion}·free-text/PII/storage_path 부재
                    (application에 실 PII 실어 non-vacuous). **순수 additive(deletions 0/insertions 63)·기존 19 contract
                    무손상·skip 0** → Cowork가 additive 계약확장 인가(**core 19→20**, freeze 목적 준수·literal diff-empty만
                    트립). 나머지(idempotency·INV-13·audit 원문금지·reason enum)는 smoke pgTAP/core/7a에 이미 잠김 — 재구현
                    안 함. core test 20 내 재실행·scope 테스트파일만·audit.sh PASS. Opus PASS. 증적 docs/TASK9B_AUDIT_FINDINGS.md.
                    **→ ✅ Task 9 완료(9a+9b) = P0 MVP 기능+하드닝 완성.**
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

- **✅ [완료 — Task 5 직전 필수 게이트] 재현가능한 rpc/RLS smoke test.** `supabase/tests/pre_task5_rpc_rls_smoke.sql`
  (41 pgTAP, Codex 빌드, Opus 감사세션 최종 PASS). R1 교훈(`db reset` 통과는 함정 — plpgsql 오류는 *호출 시* 터짐)을
  닫음: 실제 `authenticated` 세션 RLS·컬럼거부 + RPC 런타임 흐름 + approve composite 양쪽(.application/.membership) +
  idempotency 무중복 + P0001/P0002 + content-minimization + persona clip terminal 마킹을 *호출 시점*에 단언.
  커밋 = JT(`test(db)`). 증적 docs/PRE_TASK5_SMOKE_TEST_AUDIT.md.
- **✅ [완료 — carry-forward ②, Task 4.5] 신뢰 role 소스.** `supabase/migrations/0006_role_source.sql`의
  security-definer `current_user_role()`(profiles.role를 auth.uid 키로 서버사이드 해석). adapter가 JWT
  claim(user_metadata/app_metadata) 대신 이 RPC로 role 해석(fail-closed to applicant), seed에서
  user_metadata.role 제거(profiles.role 단일 진실원). smoke 49 pgTAP가 실 `authenticated` 세션서 admin/
  reviewer/applicant role 증명 + anti-escalation(위조 claim 무시) + anon 거부. Opus 1라운드 clean PASS.
  증적 docs/TASK4_5_AUDIT_FINDINGS.md. (escalation-proof: applicant는 profiles.role 못 씀 — 42501 증명됨.)
- **✅ [완료 — Task 5.5] seed auth.users GoTrue password sign-in 수정됨.** Task 5 통합테스트가 발견(빌더 정직
  보고 → Opus 검증), Task 5.5서 종결. 진단(실측): 시드 유저가 `auth.identities` 행 부재 + `aud`/`instance_id`/
  NULL token 컬럼 결여로 GoTrue 로그인 불가였음(admin-API 유저만 로그인). 수정: `supabase/seed.sql`에
  `auth.identities`(provider=email, identity_data {sub,email}) + `aud`/`instance_id`/`''` token + created/updated
  보강 — **role은 어느 metadata에도 안 넣음**(Task 4.5 불변식 + smoke 49 "claim에 role 없음" 유지). 게이트:
  read-only 통합테스트가 시드 admin/reviewer/applicant **실 password sign-in + current_user_role 해석**을 런타임
  증명(재실행 안전); full-flow 테스트는 throwaway 유지. Opus 1라운드 clean PASS. 증적 docs/TASK5_5_AUDIT_FINDINGS.md.
- ✅ **[완료 — profiles provisioning task, Task 8a 발견#1 종결] 신규 signup profiles 자동 provision.** 종결:
  migration 0007 `handle_new_user()`(role 리터럴 applicant·metadata 무시·`security definer`+`search_path=''`·EXECUTE
  전부 revoke) + `after insert on auth.users` 트리거 + seed/통합fixtures(웹3+adapters) upsert + 7 pgTAP
  (anti-escalation forged{role:admin}→applicant + seed regression 포함, 49→56). Opus PASS(JT 호스트 5x+reset 재현 후
  최종). 증적 docs/PROFILES_PROVISIONING_AUDIT_FINDINGS.md. (이하 원래 발견 기록:)
- 🔴 **[원기록 — Task 8a서 발견] 신규 signup profiles 자동 provision 부재.**
  `admission_applications.applicant_id NOT NULL → profiles(id)`, profiles→`auth.users(id)`, 그러나 `on auth.users`
  트리거 없음(grep 0). 브라우저 `signUp`은 auth.users 행만 만들고 profiles 행 미생성 → `submitApplication` FK 위반.
  시드 유저(`*@soulbound.local`)는 profiles 보유라 빌더 수동테스트가 갭을 가림. **신규 applicant happy-path 차단.**
  → 전용 보안태스크(Codex): security-definer `handle_new_user()` + `after insert on auth.users` 트리거
  (→`public.profiles(id, role='applicant')`) 마이그레이션 + pgTAP(신규 auth user → applicant profile 단언). 8a는
  supabase/·신규라우트 금지라 정당히 미수정. 증적 docs/TASK8A_AUDIT_FINDINGS.md #1.
- **[Task 8a 잔여, LOW/latent] status 페이지가 reasonCode를 신청자에게 표시하도록 배선됨**(현재 dormant — applicant
  AdmissionApplication에 reasonCode 없어 렌더 안 됨, 실누수 0). reasonCode는 내부 분류 enum, 신청자-대면은 applicantNotice.
  의도 확인 필요: 신청자 비노출이면 dormant 분기 제거(미래 API 변경 시 내부 분류 우발노출 방지). 증적 #2.
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

- **게이트 비결정성 — audit.sh가 빌드 아티팩트를 grep (Task 6a):** apps/web 도입 후 `bash scripts/audit.sh`가
  머신마다 다르게 동작 — `rg` 있으면 .gitignore 존중해 PASS, 없으면 `grep -rEn`가 gitignore된 `apps/web/.next`
  (번들된 supabase-js)까지 훑어 `supabase.storage` **false-FAIL**. 빌더는 rg로 PASS·감사자는 rg 없이 FAIL → 발견.
  → `GREP()`에서 `.next/dist/node_modules` 제외(rg glob + grep `--exclude-dir`)로 결정적화. 교훈: 정적 게이트는
  **소스만** 스캔하고 빌드/deps 출력을 배제해야 한다(안 그러면 false-FAIL이 진짜 위반을 가리는 습관을 만든다).
  JT 승인 하 frozen audit.sh 보정.
- **flaky 런타임 게이트를 'passed twice'로 통과 (Task 6a):** web 통합테스트가 빌더 환경 + 호스트 1회 PASS → Opus가
  PASS 판정. 그러나 fixture(`createUser`/`signInWithPassword`)가 비결정적(`AuthRetryableFetchError`)이라 반복 실행/
  `db reset` 후 계속 실패. (b)게이트의 존재이유 = *신뢰성 있는* 런타임 증명인데 1~2회 통과는 결정성 증거가 아니다.
  → 교훈: **호스트 전용 런타임 게이트는 "passed N times" 보고가 아니라 *연속 다회 + reset 후* 재현된 green을 봐야 PASS.**
  fixture 불안정은 bounded retry/유니크화/정리로 닫되, assertion·route 호출은 결정적으로 유지(retry로 가리지 말 것).
- **시드 데이터 수동 QA가 신규-유저 provisioning 갭을 가린다 (Task 8a):** 빌더가 시드 applicant로 login→gate→apply
  수동확인=통과. 그러나 시드 유저는 `seed.sql`이 profiles 행을 미리 박음. 실제 브라우저 `signUp`은 profiles 트리거
  부재로 행을 안 만들어 submit이 FK에서 막힘(§4 HIGH). → 교훈: **수동/통합 QA의 happy-path는 시드 픽스처가 아니라
  *제품이 실제로 만드는* 신규 엔티티로 최소 1회 통과시켜라**(provisioning/트리거/기본값 누락은 시드가 항상 가린다).
- **결정성 5x가 cross-package 테스트격리 누수를 잡았다 (Task 9a):** clip reap의 동일-hash 테스트가 `scanned:1`(전역
  카운트) 단언인데, **다른 패키지(web) 통합테스트가 같은 로컬 DB에 남긴 due clip**(approved/policy_cleanup 2건)을
  reap이 주워 run-2서 `scanned:3` FAIL. run-1 단일통과만 봤으면 **거짓 PASS**. → 교훈: **공유 DB 위 통합테스트는
  서로 격리(각자 afterEach 정리)해야 하고, 전역 상태에 의존하는 단언은 5x+reset로만 신뢰**(§6 5x 고집의 정당성 재확인).
  보정: web 테스트 afterEach가 fixture clip 행/객체/참조 정리; reap의 강한 단언은 canary로 유지.
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
