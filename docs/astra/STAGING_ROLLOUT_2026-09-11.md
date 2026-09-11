# 스테이징 적용 전 점검 — 2026-09-11

현재 대상: Supabase `leyjdpoycglzvybbegrd`, Vercel `soulbound-admin-s-projects/soulbound-staging`, 공개 주소 `https://soulbound-staging.vercel.app/`.

**코드와 격리 DB 검증은 완료됐지만 지금 원격 적용을 실행할 조건은 충족되지 않았다.**

1. **Vercel 접근 복구:** 프로젝트 조회가 403이다. 해당 팀 접근을 가진 연결로 실제 Git 연동·배포 SHA·환경변수를 확인한다. 새 웹의 DB 대상이 위 프로젝트인지 대조하고, Astra 수정 커밋으로 만든 배포를 사용할 수 있어야 한다.
2. **기존 계정 로그인 전환:** 현재 계정 88개의 Auth 이메일이 0010으로 계산한 username의 내부 로그인 주소와 모두 다르다. profiles의 username 추가만으로 기존 계정의 새 방식 로그인이 연결되지 않는다. 실제 유지 대상 계정을 확인하고 UUID·비밀번호·권한·소유 데이터를 보존하는 호환 방식 또는 계정 전환 방식을 별도 설계·검증해야 한다. 계정을 임의 삭제하거나 Auth 테이블의 이메일을 일괄 덮어쓰지 않는다.
3. **데이터 보존 및 재점검:** 현재 profiles 88 / memberships 39 / applications 46 / audit logs 104. 적용 직전 백업·복구 지점을 확보하고 username 형식·충돌 집계를 다시 확인한다. 0009는 감사 로그의 hash/previous_hash를 backfill하고, 0010은 기존 회원 번호·username 및 일부 RPC를 바꾼다. 되돌리기를 단순히 마지막 함수 삭제로 취급하면 안 된다.
4. **DB·웹의 조정된 전환:** 적용 순서는 `0009_audit_hash_chain` → `0010_anonymous_identity` → `0011_board` → `0012_admission_voting` → `0013_admission_resubmit` → `20260911015117_astra_privacy_hardening`. 0010/0012만 적용된 중간 상태를 회원 Data API에 노출하지 않도록 원자 적용 또는 검증된 접근 차단을 준비하고, 마이그레이션 이력을 실제 파일과 일치시킨다. 기존 웹의 영상 route가 서비스 권한으로 직접 조회하므로 DB 수정만으로 영상 만료 문제가 해결되지는 않는다.
5. **실환경 검증:** 새 웹·DB에서 격리된 테스트 사용자로 기존 사용자 로그인, 신규 가입, 회원 명부, 투표/영상 만료, 게시판을 확인한다. 직접 authenticated REST/RPC의 비공개 행·내부 반환값 차단도 확인한다. 생성한 테스트 데이터만 정리하고 기존 기록은 유지한다.
6. **반영 기록:** 사용한 웹 commit/deployment SHA, DB 적용 버전, 테스트 결과와 남은 제한을 Astra 문서 커밋으로 보존한다. 기존 개발 브랜치 병합 여부는 Astra 브랜치의 개발 기록과 별도로 관리한다.

원격에서는 마이그레이션, 사용자 생성·변경·삭제, 테스트 투표 또는 수동 배포를 실행하지 않았다. 필요한 것은 수정 커밋의 추가 승인보다 우선 Vercel 접근 복구와 기존 로그인 연결 문제의 해결이다.
