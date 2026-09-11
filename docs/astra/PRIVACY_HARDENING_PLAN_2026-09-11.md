# Astra 개인정보 경계 수정 계획 — 2026-09-11

기준: `bf7984ac98c4d980bd6ba722b0a9e831a5f2ae58`. 작업 브랜치: `astra/privacy-hardening-2026-09-11`. 사용자 지시: 이전 검증 결과의 후속 수정 진행. 범위는 검증 보고서 A-01–A-04이며, 기존 계약·core port·기존 테스트·0001–0013 마이그레이션은 보존한다. 작성자와 최종 검토자는 분리한다.

## 수정안

1. **A-01:** `profiles select active public` 및 `memberships select active public` 정책을 제거한다. 타인의 멤버십 UUID·발급 시각을 통한 순번 연결도 차단한다. 자신의 프로필 SELECT/UPDATE, 본인 멤버십 및 서버 역할 조회는 유지한다. 새 `list_active_members` RPC는 인증된 active member에게 `member_number,created_at`만 반환한다. 함수의 소유자 권한은 이 최소 projection과 명시적 호출자 검사에만 사용하며, 비회원·anon 공개를 차단한다. 명부 adapter는 사용자 JWT로 해당 RPC를 호출한다. 기존 명부 DTO·커서 의미는 유지한다.
2. **A-02:** `cast_vote_tx(uuid,text)`를 반환 타입 `void`로 재생성한다. 투표의 기존 가드·행 잠금·turnout/ballot 원자 삽입은 보존한다. 이전 함수는 CASCADE 없이 삭제하고 같은 마이그레이션에서 재생성·EXECUTE 권한 재설정한다. `is_application_owner(uuid,uuid)`는 SECURITY INVOKER로 전환하여 기존 신청서 RLS를 그대로 적용한다. 따라서 타인의 신청 소유관계는 반환하지 않고, 본인의 조회와 service_role 사용은 유지한다.
3. **A-03:** service_role 전용 `authorize_admission_vote_clip` RPC를 추가한다. 서버가 검증한 voter UUID를 전달하고, 함수는 활성 회원 여부·투표 open·신청 in_vote·clip 존재·종료 시각을 검사한다. vote→application 순서로 잠그고 잠금 이후 `clock_timestamp()`로 검증·접근 기록 삽입을 한 트랜잭션에서 처리한다. 거부 시 반환 행과 접근 기록 모두 0개다. route는 허가된 asset ID로만 signing하며, signing 전·후에도 종료 시각을 검사한다. signing 후에는 같은 함수의 기록 없는 검증 모드로 DB 상태·회원 자격·동일 asset을 다시 확인하고, 만료·finalize/override·clip 교체·조회 실패 시 URL을 폐기한다. 두 번째 검증은 접근 기록을 추가하지 않는다. 마지막 검증 후 HTTP 전달 사이의 상태 변화와 이미 전달된 URL을 즉시 취소할 수 없는 기존 5분 TTL 한계는 명시한다.
4. **A-04:** `list_open_admission_votes`의 DB 상한을 51로 조정한다. 웹의 최대 페이지 크기 50과 추가 1행 조회를 일치시킨다. 정렬·커서·권한은 유지한다.

새 마이그레이션은 Supabase CLI의 `migration new`로 생성한다. 기존 0009–0013 미적용 상태에서 새 수정만 적용하면 안 된다. DB 동기화는 전체 적용 순서와 검증 결과를 함께 보고 별도로 실행한다.

## 검증

- 기존 162개 단위 테스트·타입·빌드·정적 감사 및 core/기존 테스트 바이트 보존.
- 추가 route 테스트: 만료/정확한 종료 시각/닫힘/권한 없음/DB 실패 시 URL 미반환, 허가 없음이면 signing 0회, signing 동안 만료·closed·terminal·회원 자격 상실·clip 교체 시 응답 폐기.
- 명부 및 투표 adapter 테스트: 안전한 RPC 호출·응답 shape, 최대 50개 페이지 및 51번째 항목 커서.
- 격리 PostgreSQL에서 원본 마이그레이션 전체와 신규 마이그레이션을 실행하고 실제 authenticated/anon/service_role로 직접 SQL·RPC를 검증한다. 타인 프로필·멤버십·소유관계 접근 차단, 본인 조회 유지, 최소 명부, 투표 void/중복 투표/만료, 영상 허가·접근 기록 원자성과 재검증, 51개 페이지 경계를 확인한다. 기존 pgTAP 검증도 가능한 범위에서 실행하고 reset 후 반복한다.
- 로컬 Docker가 없고 현재 컨테이너에 관련 capability가 없어 PGlite(PostgreSQL WASM) 실행 가능성을 먼저 확인한다. 사용할 경우 Supabase Auth/Storage의 최소 fixture와 실제 구현의 차이, 다중 연결·실제 HTTP 검증 한계를 명시한다. 클라우드에 테스트 데이터를 쓰거나 유료 DB를 생성하지 않는다.
- 새 함수의 EXECUTE·search_path·definer 범위·RLS를 카탈로그에서 검사한다. 독립 계획 검토 및 구현 후 독립 FINAL PASS를 거쳐 변경을 Astra 브랜치에 커밋·푸시한다.

## 적용 전 경계

이번 제품 수정 브랜치는 자동으로 기존 개발 브랜치에 병합하지 않는다. Vercel 관리 접근과 실제 배포 SHA·환경변수는 아직 확인되지 않았다. 검증 결과에 따라 스테이징 적용에 필요한 구체적인 순서와 남은 gate를 기록한다.
