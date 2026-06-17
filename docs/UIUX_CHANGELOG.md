# SoulBound Phase 1 MVP — UI/UX 개선·변경 추적 (UI/UX Change Tracking)

> 이 문서는 SoulBound `apps/web`의 **UI/UX 개선·변경 사항**을 추적한다.
> 작업 진척도 전반은 `docs/PROGRESS.md`, 설계 캐논은
> `docs/architecture/SoulBound_Phase1_MVP_BuildPlan_v1.3-FROZEN.md`(동결, §4.2 / §7)를 참조.

- **현재 상태**: `apps/web` **미생성**. UI/UX 작업은 전부 **예정(Planned)** 상태다.
- **마지막 갱신**: 2026-06-17 (UTC)

---

## 0. UI/UX 작업의 전제 (Ground Rules)

UI는 "완벽히 돌아가더라도" 아래 가드를 깨면 빌드 실패다. 모든 UI/UX 변경은 이 제약 안에서 이뤄진다.

- **INV-01**: 컴포넌트에서 `supabase.from(...)` / `supabase.storage` 직접 호출 0건. 흐름은
  `component → hook → API route → service → repository → adapter`.
- **INV-02**: UI 레이어에 체인 클라이언트 `signAndExecuteTransaction(...)` 직접 호출 0건 (지갑 connect UI는 예외).
- **INV-20 / INV-24**: 채팅 route(/messages, /chat, /inbox, /conversations) 및 메시지 UI(목록·말풍선·작성창) 0건.
- **Persona Clip (INV-PC-03/06)**: 앱내(in-app) 녹화 only. 업로드/미리보기/재촬영/편집 없음.
  부재가 submit을 막지 않는다. storage 접근은 StoragePort 경유, `supabase.storage` 직접호출 금지.
- **검열저항 카피 경계 (§2.3)**: "법적 의무 없음"을 주장하지 않는다. "애초에 평문·키를 보유하지 않도록 설계"를
  UX 카피·정책 문구로 표현한다.

---

## 1. 화면(Route) 인벤토리 & 상태

BuildPlan §4.2 기준 P0 화면 목록. 각 화면의 구현/UX 상태를 여기서 추적한다.

| 화면 | 경로 | 역할 | 상태 |
| --- | --- | --- | --- |
| Landing | `app/page.tsx` | 잠긴 문 (입장 전) | ⛔ 미생성 |
| Login | `app/login/page.tsx` | 로그인 | ⛔ 미생성 |
| Signup | `app/signup/page.tsx` | 가입 | ⛔ 미생성 |
| Gate Hub | `app/gate/page.tsx` | 입장 절차 안내 허브 | ⛔ 미생성 |
| Apply | `app/apply/page.tsx` | 신청서 작성 | ⛔ 미생성 |
| Apply Status | `app/apply/status/page.tsx` | 내 신청 현황 | ⛔ 미생성 |
| Member Home | `app/member/page.tsx` | 멤버 홈 (승인 후) | ⛔ 미생성 |
| Admin Queue | `app/admin/applications/page.tsx` | 검토 큐 | ⛔ 미생성 |
| Admin Detail | `app/admin/applications/[id]/page.tsx` | 검토 상세 | ⛔ 미생성 |

---

## 2. 컴포넌트 인벤토리 & 상태

BuildPlan §4.2 기준 컴포넌트 디렉토리. UX 변경은 컴포넌트 단위로 기록한다.

| 컴포넌트 그룹 | 경로 | 비고 | 상태 |
| --- | --- | --- | --- |
| admission | `components/admission/` | 신청 폼·상태 표시 | ⛔ 미생성 |
| persona-clip-recorder | `components/admission/persona-clip-recorder.tsx` | **앱내 녹화 only**. supabase.storage 직접호출 금지 | ⛔ 미생성 |
| membership | `components/membership/` | 멤버십 카드/상태 | ⛔ 미생성 |
| admin | `components/admin/` | 검토 큐/상세 액션 | ⛔ 미생성 |
| gate | `components/gate/` | 입장 절차 안내 | ⛔ 미생성 |
| layout | `components/layout/` | 공통 레이아웃 | ⛔ 미생성 |
| shared | `components/shared/` | 공용 UI 프리미티브 | ⛔ 미생성 |

---

## 3. UX 상태 모델 (참고)

신청 lifecycle은 UI 상태/카피의 근간이다. 화면은 이 상태를 정확히 반영해야 한다.

```
draft → submitted → under_review → needs_more_info → approved / rejected
                                                    ↘ withdrawn / expired (terminal)
```

- applicant 노출: `applicant_notice` 만 노출. `review_summary`(관리자 내부 메모)는 **노출 금지** (§7.4).
- admin 액션(approve/reject/needs_more_info)에는 `reasonCode`(enum)만 흐른다. 자유서술 reason 입력 UI 금지 (INV-22).

---

## 4. UI/UX 변경 로그 (Changelog)

> 새 UI/UX 변경마다 아래 테이블 최상단에 한 줄을 추가한다.
> `상태`: 🆕 신규 / ✏️ 개선 / 🐛 수정 / ♻️ 리팩터 / 🗑️ 제거.
> 가드 관련 변경은 `가드 영향` 칼럼에 관련 INV를 명시한다.

| 일자 | 화면/컴포넌트 | 변경 유형 | 요약 | 가드 영향 | 커밋/PR |
| --- | --- | --- | --- | --- | --- |
| 2026-06-17 | — | 📄 문서 | UI/UX 추적 문서 신설. `apps/web` 미생성 — 모든 화면/컴포넌트 Planned 등록 | INV-01/02/20/24, INV-PC-* | (이 PR) |

---

## 5. 향후 UI/UX 작업 진입 시 체크리스트

`apps/web` 생성 단계(BuildPlan 후속 Task)에 진입하면:

- [ ] 위 §1/§2 인벤토리의 `상태`를 ⛔ → 🚧/✅ 로 갱신한다.
- [ ] 화면별로 connected 데이터 흐름이 `component → hook → API route → service`를 따르는지 확인 (INV-01).
- [ ] `scripts/audit.sh`의 SKIP 항목(apps/web 관련)이 OK로 전환되는지 확인.
- [ ] Persona Clip 녹화 UI는 업로드/미리보기/재촬영/편집 없이 인앱 녹화만 제공하는지 확인.
- [ ] applicant 화면에 `review_summary`가 새지 않는지, `reasonCode` enum만 쓰는지 확인.
- [ ] 변경마다 §4 Changelog에 기록한다.
