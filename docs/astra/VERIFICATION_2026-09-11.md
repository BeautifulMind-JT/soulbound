# Astra 기준 검증 — 2026-09-11

## 결론

**판정: 개발 기준 코드의 익명성·영상 접근 제한 FAIL, 스테이징 DB와 개발 코드의 동기화 FAIL.** 기존 자동 검증은 통과했지만, 별도 코드 검토에서 P1 3건과 P2 1건을 확인했다. Supabase 연결 후 실제 DB에는 마이그레이션 0008까지만 적용돼 있고 0009–0013이 미적용임을 확인했다. 이번 변경의 범위는 검증 기록과 증적 추가다. 제품 수정은 다음 작업으로 분리한다.

아래 A-01–A-04는 **기준 커밋의 소스에서 확인한 결함**이다. 실제 DB의 기존 UUID·persona 읽기 권한과 소유관계 함수는 확인했지만, 회원 번호 컬럼과 투표 기능은 아직 없다. 따라서 회원 번호 연결과 투표 RPC 결함이 현재 DB에서 이미 작동한다는 의미는 아니다. 실제 회원 데이터 조회나 공격 재현은 하지 않았다.

## 기준과 무결성

| 항목 | 값 |
|---|---|
| 저장소 | `soulbounddao-ADMIN/soulbound` |
| 개발 기준 브랜치 | `phase1-p0-mvp` |
| 기준 커밋 | `1e9e2257a6dcc5e731619752630e0004b6dc89c4` |
| 기준 Git tree | `91cafccf195033553a25c203bcf23743733237c0` |
| Astra 작업 브랜치 | `astra/verification-2026-09-11` |
| 원본 파일 | 291개, 모든 Git blob SHA 및 전체 tree SHA 일치 |
| Node / pnpm | `v24.19.0` / `11.1.3` |
| 검증 환경 | Linux, GitHub 연결 API로 원본을 가져와 정확한 commit object까지 재현한 shallow 작업 사본 |

의존성 설치와 검증 이후 제품 소스·기존 테스트·마이그레이션·잠금 파일의 diff는 비어 있었다. 신규 검증 문서 및 증적만 이 브랜치에 커밋한다.

## 실행 결과

| 검증 | 결과 | 의미와 한계 |
|---|---|---|
| `pnpm install --frozen-lockfile` | PASS | 정확한 pnpm 11.1.3; lockfile·공급망 설정 유지 |
| `pnpm -r typecheck` | PASS | core/adapters/web |
| `pnpm -r test` | PASS | core 26 + adapters 25 + web 111 = **162**, 30개 테스트 파일 |
| `pnpm -r build` | PASS | core/adapters + Next.js 16.2.7 production build |
| `bash scripts/audit.sh` | PASS | 검증 전·후 실행; 독립 검토자도 재실행 |
| core 출력의 `*.test.*` | PASS | 0개 |
| 브라우저 정적 출력의 서버 비밀값 canary | PASS | `.next/static` 29개 파일에서 fake service-role/cron canary 0개; 실제 운영 비밀값 검사가 아님 |
| `git diff --check` 및 기존 파일 무변경 | PASS | 제품·테스트·마이그레이션·설정의 기존 바이트 보존 |
| 공개 화면 3개 GET | PASS | `/`, `/signup`, `/terms` HTTP 200; 비공개 멤버 공간 문구·R4 약관 표시 확인 |
| 인증 없는 API GET 6개 | PASS | 아래 6개 모두 HTTP 401 및 정확히 `{"error":{"code":"UNAUTHORIZED"}}` |
| 로컬 DB 통합/pgTAP·반복 실행+reset | BLOCKED | Docker와 Supabase CLI 부재; 실행하지 않음 |
| 배포 DB·마이그레이션 상태 | FAIL — 불일치 확인 | 대상 `leyjdpoycglzvybbegrd` 읽기 조회 성공; 적용 이력 0001–0008, 코드의 0009–0013 미적용 |
| Vercel 배포 SHA·로그 | BLOCKED | 연결 팀 목록 0개 및 해당 프로젝트 조회 403; 이전 연결 점검 결과 |
| 실제 가입→심사/투표→입장→게시판 흐름 | NOT RUN | 인증된 테스트 사용자와 격리·정리 가능한 DB 환경 미확보 |

인증 없는 API 확인 경로: `/api/membership/me`, `/api/members`, `/api/board`, `/api/vote/applications`, `/api/admin/applications`, `/api/admission/applications/me`.

401은 인증 없는 요청의 초기 거부를 증명한다. 이 경로는 DB를 조회하기 전에 응답할 수 있어 DB 연결이나 RLS/RPC의 정상 실행을 증명하지 않는다.

공개 페이지의 첫 요청 3건은 검증 환경의 프록시 CONNECT 시간 초과가 발생했다. 연결 제한 시간을 늘려 각 1회 재시도했고 모두 200 및 문구 검사를 통과했다. 최초 오류와 재시도를 함께 보존했다. 가입 페이지의 이번 재시도 검사는 HTML의 `signup-terms`, `required`, 약관 동의 문구 및 `/terms` 링크 존재 확인이며 브라우저 폼 제출 검증을 대체하지 않는다.

배포된 약관 화면은 Alpha R4 변경이 반영됐음을 보여준다. 정확한 배포 commit SHA, 다른 코드와 DB의 동기화 여부는 이 화면만으로 확정할 수 없다. 기존 `PROJECT_STATE.md`의 R4 배포 대기 기록은 이 관찰보다 이전 상태다.

## D-01 — 스테이징 DB에 후속 마이그레이션 5개 미적용

사용자의 Supabase 재연결 이후 `soulbound-staging` (`leyjdpoycglzvybbegrd`)의 마이그레이션 이력과 PostgreSQL 카탈로그를 읽었다. 초기 권한 오류는 해소됐다. 해당 프로젝트는 저장소의 스테이징 대상과 일치한다. Vercel의 실제 환경변수 및 배포 SHA는 관리 접근 제한으로 대조하지 못했다.

| 미적용 파일 | 코드가 기대하는 변경 | 이번 DB 확인 |
|---|---|---|
| `0009_audit_hash_chain.sql` | 감사 로그 해시 체인 | 적용 이력 없음; 관련 객체 전체 대조는 미실행 |
| `0010_anonymous_identity.sql` | username·익명 회원 번호 | 적용 이력 없음; `profiles.username`, `profiles.member_number` 컬럼 없음 |
| `0011_board.sql` | 게시판 | 적용 이력 없음; `board_posts`, `board_comments` 테이블 없음 |
| `0012_admission_voting.sql` | 입장 투표 | 적용 이력 없음; 투표 테이블 및 `cast_vote_tx`, `list_open_admission_votes`, `get_admission_vote` 함수 없음 |
| `0013_admission_resubmit.sql` | 신청 재제출 | 적용 이력 없음; `admission_resubmit` 함수 없음 |

`profiles`, `admission_applications`, `memberships`의 RLS는 활성 상태다. `profiles.id`와 기존 persona 컬럼에 대한 authenticated SELECT 및 `profiles select active public` 정책도 남아 있다. `is_application_owner(uuid,uuid)`는 security-definer이며 authenticated EXECUTE가 허용돼 있다. 이는 A-01/A-02의 기존 권한 전제가 남아 있다는 증거이고, 아직 없는 회원 번호·투표 객체까지 포함한 공격 재현은 아니다.

기준 코드의 회원 명부·게시판·투표·재제출 기능은 이 DB 스키마로 정상 검증할 수 없다. 공개 화면 200과 미인증 API 401만으로 해당 기능의 정상 동작을 판정하면 안 된다. 먼저 아래 결함을 수정하고 격리된 DB에서 검증한 뒤, 스테이징의 적용 계획을 검토해야 한다. 이번 작업은 DB 쓰기·계정 생성·마이그레이션 적용·수동 배포를 수행하지 않았다.

정확한 읽기 SQL과 반환 메타데이터: [database-verification.json](evidence/2026-09-11/database-verification.json). 최초 카탈로그 조회는 재제출 함수명을 잘못 지정했다. 독립 검토에서 이를 발견해 실제 소스의 `admission_resubmit`로 [추가 조회](evidence/2026-09-11/database-resubmit-recheck.json)했고 결과 0행으로 부재를 확인했다. 최초 기록은 그대로 보존한다.

## 확인된 결함

### A-01 · P1 — 직접 DB 조회에서 익명 멤버 번호와 사용자 UUID 연결 가능

근거:

- `supabase/migrations/0003_rls.sql`의 `grant select`는 `profiles.id`, `handle`, `display_name`, `bio`, `avatar_url` 등을 authenticated에 허용한다.
- 같은 파일의 `profiles select active public` RLS 정책은 활동 중인 멤버가 다른 활동 멤버 행을 읽을 수 있게 한다.
- `supabase/migrations/0010_anonymous_identity.sql`은 `member_number` SELECT를 추가하면서 기존 UUID·persona 컬럼 권한을 회수하지 않는다. 이후 마이그레이션에도 해당 회수가 없다.

따라서 이 마이그레이션들이 그대로 적용된 DB에서는 활동 멤버의 직접 Data API 요청 `profiles?select=id,member_number,handle,display_name,bio,avatar_url`이 멤버 번호와 auth UUID, 값이 남아 있는 persona 필드를 연결할 수 있다. `/api/members`의 안전한 응답 필터만으로 직접 DB 호출을 제한할 수 없다. UUID 자체가 실명이라는 뜻은 아니며, A-02의 추가 호출 경로와 결합하면 신청 당시 자료와 승인 후 멤버 번호를 연결할 수 있다. 현재 DB에는 기존 읽기 권한이 있지만 `member_number` 컬럼은 아직 없다.

수정 목표: 회원에게 공개할 컬럼과 행을 DB 경계에서 명확히 분리하고 멤버 번호 명부를 안전한 projection으로 제공한다. 기존 자신의 상태 조회 및 역할 확인을 보존한다.

필수 회귀 검증: 실 authenticated active-member 세션에서 명부 읽기는 성공하지만 타 회원의 UUID·기존 persona 필드는 직접 REST/SQL로 읽을 수 없음을 검증한다.

### A-02 · P1 — 직접 투표 RPC가 내부 신청·운영자 식별정보 반환

근거:

- `supabase/migrations/0012_admission_voting.sql`의 `cast_vote_tx(uuid,text)`는 `returns public.admission_votes`이며 `return v_vote`로 전체 행을 반환한다.
- 이 함수는 `security definer`이고 authenticated에 EXECUTE가 허용돼 있다.
- 반환 타입에는 `application_id`, `opened_by`, `idempotency_key` 등이 포함된다.
- `supabase/migrations/0003_rls.sql`의 `is_application_owner(p_application_id,p_user_id)`도 authenticated에 공개된 security-definer 함수이며 임의의 사용자 UUID에 대한 소유 관계를 검사한다.

0012가 그대로 적용된 경우 활동 멤버가 직접 RPC로 정상 투표하면 웹 저장소가 버리는 원래 결과를 직접 받을 수 있다. 테이블 자체의 SELECT 회수는 함수 반환값을 제거하지 않는다. A-01의 UUID 명부와 `is_application_owner`를 조합하면, 투표 중 보았던 후보의 신청 자료와 승인 후 멤버 번호 사이의 연결을 알아낼 수 있는 경로가 남는다. 현재 DB에는 소유관계 함수만 있고 투표 RPC는 없다. 실제 투표 쓰기는 실행하지 않았다.

수정 목표: 투표 함수 반환을 최소한의 안전한 결과로 축소하고, 임의의 제3자에 대한 신청 소유관계 조회를 차단한다. 웹 DTO와 직접 DB RPC 모두 동일한 익명성 경계를 만족해야 한다.

필수 회귀 검증: 직접 authenticated RPC의 정확한 반환 shape를 검증하고, 후보→신청서→임의 UUID→승인 멤버 번호 연결이 거부되는지 실 DB로 확인한다.

### A-03 · P1 — 투표 시간 종료 후에도 신규 영상 URL 발급 가능

근거: `apps/web/app/api/vote/applications/[voteId]/persona-clip-url/route.ts`는 `id,status,admission_applications(status,persona_clip_asset_id)`만 조회하고 투표 `open`, 신청 `in_vote` 여부를 검사한다. `window_ends_at`을 조회하거나 검사하지 않는다.

투표 스키마가 적용된 환경에서 투표 시간이 끝났지만 아직 finalize되지 않은 행은 위 조건을 만족하므로 활동 멤버에게 새로운 signed URL과 접근 기록을 발급할 수 있다. 투표 목록과 `cast_vote_tx`는 같은 상태에서 시간 종료를 검사한다. 이미 발급된 URL이 짧은 TTL 동안 유지되는 허용된 한계와 별도로, 여기서는 **시간 종료 후 신규 발급**이 문제다. 현재 DB에는 투표 테이블이 없어 이 경로를 실환경에서 재현하지 않았다.

수정 목표: 서버에서 투표 시간과 상태를 함께 검증하고, 만료 시 URL 발급과 접근 기록 생성을 중단한다. 처리 중 상태 변경과 동시성도 검토한다.

필수 회귀 검증: `window_ends_at`이 과거이고 투표 `open`·신청 `in_vote`·영상 존재 조건에서 요청을 거부하고, signing 호출 및 접근 기록 INSERT가 모두 0회인지 확인한다.

### A-04 · P2 — 투표 목록 limit=50에서 다음 페이지 소실

근거:

- `apps/web/app/api/_lib/schemas.ts`의 `voteListQuerySchema`는 최대 50을 허용한다.
- `apps/web/app/api/vote/_lib/supabase-vote-repository.ts`의 `listOpenVotes`는 다음 페이지 판별을 위해 `p_limit=input.limit+1`로 요청한다.
- `0012_admission_voting.sql`의 `list_open_admission_votes`는 SQL LIMIT를 50으로 제한한다.

투표가 51개 이상일 때 limit=50 요청은 최대 50행만 받아 `nextCursor=null`이 된다. 기본 limit=20에서는 동일한 상한 충돌이 생기지 않는다.

수정 목표 및 회귀 검증: API 허용 최대값과 DB의 lookahead 범위를 맞추고, 51개 투표를 limit=50으로 읽을 때 다음 커서와 남은 1개가 중복 없이 반환되는지 확인한다.

## 검토 범위와 다음 순서

독립 검토자는 인증·역할 해석, 멤버 명부, 게시판, 입장 투표와 관련 SQL 0009–0013 및 그 권한을 상속한 0003을 읽고 위 결함을 확인했다. 주 작업자도 해당 권한·함수 반환·영상 가드·페이지 상한을 별도로 대조했다. 기존 허용 한계(IP 로깅, 운영자 권한, 사용자의 자발적 신원 노출, 투표 중 영상 노출, 이미 발급된 URL의 짧은 TTL, 기존 문서에 기록된 board INSERT grant nit)는 신규 결함에 중복 산입하지 않았다.

1. A-01/A-02를 하나의 익명성 경계 수정 계획으로 설계하고 독립 검토한다.
2. A-03의 영상 접근 종료 조건을 수정하고 만료·상태전이 회귀 검증을 추가한다.
3. A-04의 최대 페이지 크기 경계를 수정한다.
4. 격리된 DB에서 마이그레이션·직접 authenticated REST/RPC·기존 통합/pgTAP 및 반복+reset 검증을 수행한다.
5. 독립 최종 검토 후 Astra 브랜치에 제품 수정 커밋을 올리고, 미적용 0009–0013 및 수정 마이그레이션의 적용 계획과 Vercel 연동을 확인한 뒤 통합·배포 여부를 결정한다.

이 검증으로 기존 동결 계약의 변경 승인을 새로 부여하지 않는다. 수정 계획은 관련 계약과 정책에 맞춰 별도로 검토한다.

## 재실행 명령과 증적

Node 24에서 저장소 루트 기준:

```bash
npx --yes pnpm@11.1.3 install --frozen-lockfile
npx --yes pnpm@11.1.3 -r typecheck
npx --yes pnpm@11.1.3 -r test
NEXT_TELEMETRY_DISABLED=1 \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=ASTRA_BUILD_ONLY_PUBLIC_PLACEHOLDER \
SUPABASE_SERVICE_ROLE_KEY=ASTRA_BUILD_ONLY_SECRET_SENTINEL_20260911 \
CRON_SECRET=ASTRA_BUILD_ONLY_CRON_SENTINEL_20260911 \
npx --yes pnpm@11.1.3 -r build
bash scripts/audit.sh
git diff --check
```

빌드는 위의 테스트용 환경값으로 실행했으며 실제 DB 접속을 검증하지 않는다. 공개 HTTP 확인은 `curl`로 지정된 GET 경로만 호출했고, 요청에 계정·쿠키·토큰을 사용하지 않았다.

증적 폴더: [evidence/2026-09-11](evidence/2026-09-11/). 원본 로그, 공개 요청 결과(최초 오류 포함), 소스 무결성, bundle canary 검사 결과, DB 읽기 SQL과 반환 메타데이터를 보존한다. 각 파일의 SHA-256은 `manifest.json`에 기록한다.
