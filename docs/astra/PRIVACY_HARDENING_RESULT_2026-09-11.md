# Astra 개인정보 경계 수정 결과 — 2026-09-11

기준: `bf7984ac98c4d980bd6ba722b0a9e831a5f2ae58`. 브랜치: `astra/privacy-hardening-2026-09-11`.

**A-01–A-04 수정 및 격리 검증 PASS. 스테이징 적용은 미실행이며, 배포 준비 완료 판정은 아니다.** 원본의 노출 경로를 격리 DB에서 재현한 후 수정 마이그레이션을 적용해 차단을 확인했다. 독립 검토자도 제품 코드·테스트·빌드·PG17 SQL 검증을 별도로 재실행했다.

## 변경과 검증

| 항목 | 수정 | 검증 |
|---|---|---|
| A-01 원본 프로필·회원 UUID | profiles와 memberships의 active-public 정책 제거. 자신의 조회·프로필 수정은 유지. 사용자 JWT로 안전한 회원 명부 RPC 호출 | 직접 authenticated 조회에서 타인 profile/membership 0행, 본인 조회 성공, 명부의 반환 컬럼은 번호·생성 시각뿐 |
| A-02 투표 내부 정보 | `cast_vote_tx` 반환을 void로 변경. 기존 가드·잠금·원자 삽입 보존. 소유관계 helper는 invoker로 기존 신청서 RLS 적용 | 직접 투표 반환형 void, 중복·만료·비회원 거부, ballot/turnout 각 1행, 타인 소유관계 false·본인/서버 조회 유지 |
| A-03 만료 영상 URL | service-only RPC에서 vote→application 잠금 후 DB 현재 시각·상태·회원 자격 검증과 접근 시도 기록. signing 후 기록 없는 재검증 | 만료 open 투표의 허가·신규 기록 0행. closed/terminal/회원 자격 상실/영상 없음 거부. route는 signing 중 만료·허가 소실·영상 교체·조회 오류 시 URL 폐기 |
| A-04 50개 페이지 경계 | SQL 상한 51로 조정하여 추가 1행 조회 지원 | 실제 51개 투표에서 51행 조회, 첫 50개 다음 커서의 나머지 1행, adapter 중복 없는 다음 페이지 |

새 마이그레이션은 CLI 2.117.0의 `migration new astra_privacy_hardening`으로 생성했다. 원본 0001–0013, core, 기존 테스트와 루트 의존성/잠금 파일은 변경하지 않았다. 테스트 하네스는 별도 package/lockfile을 사용한다.

## 실행 결과

| 게이트 | 결과 |
|---|---|
| 전체 단위 테스트 | **177 PASS**, 33개 파일 — core 26 / adapters 26 / web 125 |
| 기존 단위 테스트 | 원본 162개 보존; 신규 15개 추가 |
| 타입 검사·전체 production build | PASS |
| 기존 정적 감사 | PASS |
| core 출력의 테스트 파일 | 0개 |
| 브라우저 정적 파일 서버 canary | 29개 파일에서 0개; 테스트용 service-role/cron 문자열 검사 |
| PostgreSQL 17.5 마이그레이션·seed | 원본 13개 + 신규 1개 PASS |
| 기존 SQL 7개 + 신규 SQL 1개 | **204 assertions PASS × fresh DB 2회** |
| 수정 전 결함 대조 | 원본 0013에서 타인 profile/membership 각 1행, 타인 소유관계 true, 투표 composite 반환, 51행 요청에 50행 재현 |
| PostgreSQL 18.3 초기 탐색 실행 | 204 assertions ×2 PASS; 최종 하네스 기본 엔진은 17.5 |

SQL 세부 개수: 재제출 24 / 입장 투표 30 / 신규 개인정보 경계 46 / 감사 해시 체인 17 / 게시판 14 / 영상 정리 17 / 기존 RPC·RLS smoke 49 / 프로필 생성 7.

빌드는 실제 비밀값 없이 이전 검증과 같은 테스트용 환경값으로 실행했다. `npm test --prefix scripts/astra-db`는 외부 DB URL을 받지 않는 메모리 전용 검증이다. 재실행 방법과 platform fixture 범위는 [하네스 설명](../../scripts/astra-db/README.md)에 기록한다.

최초 하네스에서 public 함수의 service_role 기본 권한을 누락해 기존 감사 해시 테스트가 실패했다. 실제 스테이징의 `pg_default_acl`을 읽어 anon/authenticated/service_role의 테이블·시퀀스·함수 기본 권한을 fixture에 반영했다. 제품 권한이나 기존 테스트를 완화하지 않고 최종 전체 검증을 통과했다. 초기 타입 검사에서 새 테스트의 Vitest 버전 미지원 matcher도 지원되는 동등한 assertion으로 정정했다.

## 실제 스테이징 사전 점검

Supabase `leyjdpoycglzvybbegrd`는 여전히 0008까지만 적용돼 있다. 집계상 profiles 88 / memberships 39 / applications 46 / audit logs 104. 기존 데이터가 있어 신규 DB처럼 초기화할 수 없다.

0010의 username backfill을 읽기 CTE로 계산한 결과, 88개 중 형식 오류와 중복 그룹은 모두 0이고 회원 번호 부여 대상은 39개였다. 하지만 **기존 Auth 이메일과 새 username의 `@soulbound.internal` 로그인 주소가 88개 모두 다르다.** 이는 `auth-provider.tsx`의 새 로그인 방식과 기존 계정 간 연결이 해결되지 않았음을 의미한다. 비밀번호 로그인을 실행하거나 계정을 변경한 것은 아니다. 0010은 profiles만 backfill하고 Auth 이메일을 전환하지 않는다. 이 문제는 최초 A-01–A-04와 별개인 적용 전 차단 항목으로 기록한다.

Vercel 팀 목록은 비어 있고 `soulbound-admin-s-projects/soulbound-staging` 조회는 여전히 403이다. 따라서 배포 SHA·환경변수·새 웹 버전 전환을 확인할 수 없다. **기존 웹의 영상 route와 새 DB를 함께 전환해야 하므로 DB만 먼저 활성화하지 않는다.** 적용 전 조건과 순서는 [스테이징 적용 기록](STAGING_ROLLOUT_2026-09-11.md)을 따른다.

실제 DB Security Advisor에는 기존 server-only 테이블의 RLS/no-policy INFO 11건, authenticated definer 함수 WARN 4건, 유출 비밀번호 검사 비활성 WARN 1건이 남아 있다. 소유관계 함수 경고는 이번 변경의 대상이고, 의도적으로 노출하는 역할/회원 함수는 가드 검토가 필요하다. 이 조회는 미수정 원격 DB 상태이며 격리 DB의 PASS와 혼동하지 않는다. [Definer 함수 경고 설명](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [비밀번호 검사 설정](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## 확인하지 않은 범위

- 실제 Supabase Auth/PostgREST/Storage HTTP와 로그인부터 게시판까지의 E2E.
- 다중 PostgreSQL 연결에서의 잠금 경합. PGlite는 단일 연결이다.
- 마지막 DB 재검증과 응답 전송 사이의 상태 변화 및 이미 전달된 signed URL의 즉시 취소. 기존 5분 TTL 한계는 유지한다.
- 스테이징 적용·계정 전환·기존 브랜치 병합·수동 Vercel 배포.

증적: [evidence/2026-09-11-hardening](evidence/2026-09-11-hardening/). 로그와 읽기 조회 결과의 SHA-256은 해당 폴더의 manifest에 기록한다. 기존 기준 검증의 FAIL 기록은 당시 상태로 보존한다.
