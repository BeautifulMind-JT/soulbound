# Store compliance — account deletion / reports / blocks / privacy draft

> **감사 전/미승인.** Builder output on `devin/store-compliance-api-2026-10-06` (base `3eb533a`, PR #6 head).
> Independent audit has not happened yet.
>
> JunTae 승인 2026-10-06: 보호 영역 개방 — 계정삭제/신고/차단

Owner override scope (this task only): `apps/web/app/api`, **new** Supabase migration `0014_store_compliance.sql`,
`packages/adapters` (additive). `packages/core` was **not** changed: the new audit actions are written only inside
SQL RPCs (`resolve_report`, `prepare_account_deletion`), so the frozen `AuditAction` TS union did not need to grow.
No existing migration, existing `*.test.ts`, toolchain file, `sw-security.ts`, `StoragePort`, `NotificationPort` or
INV-PC rule was edited. No new npm dependency.

## Endpoints

All routes use the existing `Authorization: Bearer <supabase access token>` auth (`resolveUserContext` /
`resolveActor`), JSON bodies, and the shared error shape `{ error: { code, message } }`
(401 `UNAUTHORIZED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`, 409 `CONFLICT`/`INVALID_STATE_TRANSITION`,
422 `VALIDATION`, 429 `RATE_LIMITED`, 502 `DEPENDENCY_FAILURE` with no internal detail).

| Method | Path | Auth | Request | Response |
| --- | --- | --- | --- | --- |
| `DELETE` | `/api/account` | any signed-in user (own account only; no id accepted) | `{ "confirm": "DELETE_MY_ACCOUNT" }` (strict, extra keys → 422) | `200 { deleted: true, personaClipsRemoved: n }`; token of an already-deleted user → 401 |
| `POST` | `/api/reports` | active member | `{ targetType: "board_post"\|"board_comment"\|"member", targetId: uuid \| memberNumber string, reason, detail?: string ≤500 }` | `201 ReportView`; dup open → 409; self/own content → 422; unknown target → 404; >10/h → 429 |
| `GET` | `/api/reports` | signed-in | — | `200 { items: ReportView[] }` (own reports only, latest 50) |
| `GET` | `/api/admin/reports?status=open\|resolved\|dismissed\|all&limit=1..100` | reviewer/admin | — | `200 { items: ReviewReportView[] }` (adds `subjectMemberNumber`, `subjectLabel`, `targetExcerpt` ≤200 chars; no user ids) |
| `POST` | `/api/admin/reports/{reportId}/resolve` | reviewer/admin | `{ status: "resolved"\|"dismissed", resolutionCode }` | `200 { id, status, resolutionCode, resolvedAt }`; same decision again → 200 (idempotent); different decision on closed report → 409 |
| `GET` | `/api/blocks` | signed-in | — | `200 { items: [{ memberNumber, label, createdAt }] }` |
| `POST` | `/api/blocks` | active member | `{ memberNumber: number }` | `201 { memberNumber, label, createdAt }` (idempotent); self → 422; unknown → 404 |
| `DELETE` | `/api/blocks/{memberNumber}` | signed-in | — | `200 { unblocked: boolean }` (idempotent) |

`reason` ∈ `spam, harassment, hate, sexual, violence, illegal, impersonation, privacy, other`.
`resolutionCode`: `resolved` → `content_removed | member_sanctioned | warning_issued`;
`dismissed` → `no_violation | duplicate_report | insufficient_information`.

`ReportView = { id, targetType, targetId, reason, detail, status, resolutionCode, resolvedAt, createdAt }`.

Server-side block filtering (blocker's view only) on existing routes — no route code change was needed because the
filter lives in RLS / the board RPCs that those routes already call:

- `GET /api/board` (`list_board_posts`), `GET /api/board/{postId}` (`get_board_post` → 404),
  comments inside the detail (`list_board_comments`) — blocked authors are excluded.
- `GET /api/members` — restrictive RLS on `profiles` hides blocked members from the user-scoped directory read.

Web UI: `/admin/reports` (reviewer/admin list + one-click enum resolution), `/privacy` (draft), links from
`/signup` consent and `/terms`.

Code layout (route → service → repository → adapter):

- `apps/web/app/api/_lib/compliance-schemas.ts`, `compliance-errors.ts`, `member-context.ts`
- `apps/web/app/api/account/**` — `deleteOwnAccount` service + service-role gateway (`account-deletion-context.ts`)
- `apps/web/app/api/reports/**`, `apps/web/app/api/admin/reports/**` — `ReportService` + `SupabaseReportRepository`
- `apps/web/app/api/blocks/**` — `BlockService` + `SupabaseBlockRepository`
- `packages/adapters`: `SupabaseAccountDeletionAdapter` (`prepare_account_deletion` RPC + `auth.admin.deleteUser`,
  404 → `already_deleted`), `SupabaseStorageAdapter.purgeOwnerPersonaClips` (concrete-adapter extension like
  `createUploadUrl`; frozen `StoragePort` untouched).

## Account deletion flow

1. Route authenticates the caller and validates `confirm`. The user id comes only from the verified token.
2. `prepare_account_deletion(user)` (service_role only): writes one codes-only `account.deleted` /
   `user_requested` audit row (once, hash-chained), nulls `applicant_statement`, `motivation`, `referral_code` on the
   user's applications, and returns the user's non-deleted Persona Clip asset ids. Returns nothing if the profile is
   already gone.
3. For each clip: ownership re-checked (`applicant_id = user`), `StoragePort.markForDeletion`, eligibility re-checked
   via `list_deletable_persona_clips`, bytes removed from bucket `persona-clips`, row marked via
   `mark_persona_clip_deleted` (same path as the 9a reaper). Any failure → 502 and **auth user is not deleted**.
4. `auth.admin.deleteUser(user)` → `auth.users` → `profiles` cascade removes all owned rows (matrix below).

Retry safety: every step is idempotent; a retry after partial failure redoes only what is left. After step 4 the old
access token no longer resolves (401).

## Deleted vs anonymized vs retained

| Table | Reference | Treatment | Why |
| --- | --- | --- | --- |
| `auth.users` | id | **Deleted** | credentials |
| `profiles` | id | **Deleted** (cascade) | username, role, member number |
| `memberships` | user_id | **Deleted** (cascade) | personal status |
| `admission_applications` (own) | applicant_id | dossier text **shredded** in step 2, row **deleted** (cascade) | dossier destruction rule |
| `admission_events` of own applications | application_id | **Deleted** (cascade with application) | belongs to deleted dossier |
| `admission_events` where user was actor | actor_id | **Anonymized** (`on delete set null`, 0014) | other people's admission history |
| `admission_applications` reviewed by user | reviewer_id | **Anonymized** (set null, 0014) | other applicants' records |
| `persona_clip_assets` + Storage bytes | applicant_id | bytes **deleted** via StoragePort path, row **deleted** (cascade) | INV-PC raw-media non-retention |
| `board_posts`, `board_comments` | author_id | **Deleted** (cascade) | user content |
| `blocks` (both directions) | blocker_id / blocked_id | **Deleted** (cascade) | personal relation |
| `reports` filed by user | reporter_id | **Anonymized** (set null) | moderation history |
| `reports` about user | subject_user_id | **Anonymized** (set null); `target_ref` (member number / content id) kept | moderation history; member number no longer resolves |
| `reports` resolved by user | resolved_by | **Anonymized** (set null) | moderation history |
| `admission_votes` opened/closed by user | opened_by / closed_by | **Anonymized** (set null, 0014) | vote integrity |
| `admission_vote_turnout` | voter_id | **Retained** as unlinked UUID (FK dropped, 0014) | tally must equal anonymous ballots |
| `admission_vote_ballots` | — (no user column) | Retained | already anonymous |
| `admission_vote_clip_accesses` | voter_id | **Deleted** (cascade) | access log |
| `audit_logs` | actor_id / entity_id | **Retained** as unlinked UUID (FK dropped, 0014) | 0009 hash chain covers `actor_id`; codes-only rows (INV-16); rewriting would break `verify_audit_chain` |
| `outbox_events` | aggregate ids only | Retained | ids-only payload (INV-16), no direct user reference |
| `direct_conversations`, `direct_messages`, `conversation_key_envelopes` | user FKs | **Deleted** (cascade) | schema-only, no routes (HARD RULE 9) |
| `evidence_files`, `soul_balances`, `user_intent_authorizations` | user FKs | **Deleted** (cascade) | schema-only |
| `soul_ledger_events`, `slash_cases` | user FKs | **Anonymized** (set null, pre-existing) | schema-only ledger/case history |

Legal TODO: confirm the retention period/legal basis for `audit_logs`, closed `reports` and turnout rows.

## Tables, RLS and migration

Migration added: `supabase/migrations/0014_store_compliance.sql` (new file only).

- `blocks(blocker_id, blocked_id, created_at)`, PK `(blocker_id, blocked_id)`, check `blocker_id <> blocked_id`.
  RLS: `blocks select own` / `insert own` / `delete own` (`blocker_id = auth.uid()`); no policy exposes rows where
  you are `blocked_id`. RPCs `block_member`, `unblock_member`, `list_my_blocks` (member-number API, no user ids).
  `is_blocked_by(blocker, blocked)` security-definer helper used by restrictive policies on `profiles`, `board_posts`,
  `board_comments` and by the replaced `list_board_posts` / `get_board_post` / `list_board_comments`.
- `reports` — the legacy empty schema-only `reports` (0002) is dropped and recreated; **the migration aborts if the
  legacy table has rows**. Columns: `reporter_id`, `target_type`, `target_ref`, `subject_user_id`, `reason`,
  `detail` (1–500), `status` (`open|resolved|dismissed`), `resolution_code`, `resolved_by`, `resolved_at`,
  timestamps. Partial unique index `(reporter_id, target_type, target_ref) where status = 'open'`.
  RLS: `reports select own`, `reports select reviewer` (reviewer/admin), `reports insert own active`
  (own row + active membership). Column grants: authenticated can insert only target/reason/detail/reporter_id.
  `reports_before_insert` trigger resolves the target, sets `subject_user_id`, rejects self-reports and enforces
  the rate limit. RPCs `list_reports_for_review`, `resolve_report` (reviewer/admin; writes `report.resolved` /
  `report.dismissed` audit row with enum `reason_code` in the same transaction).
- Audit check constraints extended with `report.resolved`, `report.dismissed`, `account.deleted` and the
  resolution / `user_requested` reason codes.
- FK changes for de-identification listed in the matrix above.

## Rate limit

No existing app-level limiter in the repo, so a DB-backed one: `reports_before_insert` takes a per-reporter
`pg_advisory_xact_lock` and counts the reporter's reports in the last rolling hour; the 11th raises SQLSTATE
`SB429` → API 429 `RATE_LIMITED`. Limit = 10 per rolling hour (constant in the trigger). Block calls are not rate limited
(idempotent, own rows only).

## Mobile

See `apps/mobile/README.md` and `docs/mobile/IMPLEMENTATION_NOTES.md`: Settings → 계정 삭제 calls
`DELETE /api/account` then signs out; report menus use a reason picker + optional text (iOS `Alert.prompt`) →
`POST /api/reports`; block/unblock call `/api/blocks` with optimistic secure-store cache; privacy link defaults to
`${EXPO_PUBLIC_API_BASE_URL}/privacy`.

## Tests added

- pgTAP `supabase/tests/store_compliance_rls.sql` — blocks own-only / cross-user denial / self-block / hidden from
  the blocked user, board + profile filtering, reports own-only / cross-user denial / reviewer access / duplicate
  open / validation / rate limit / audit row, account deletion prep + cascade + de-identification + audit-chain verify.
- Web unit: `_lib/compliance-schemas.test.ts`, `_lib/compliance-errors.test.ts`, `account/route.test.ts`,
  `account/_lib/account-deletion-service.test.ts`, `reports/route.test.ts`, `admin/reports/route.test.ts`,
  `blocks/route.test.ts`, `app/admin/reports/page.test.tsx`.
- Web integration: `app/api/compliance-routes.integration.test.ts` (real local Supabase).
- Adapters unit: `supabase-account-deletion-adapter.test.ts`, `supabase-storage-owner-purge.test.ts`;
  integration: `account-deletion.integration.test.ts` (real Storage bytes removed).
- Mobile: `src/__tests__/compliance-api.test.ts`.

## Gate results

Run 2026-10-06, Node 24.21.0, pnpm 11.1.3, local Docker Supabase (CLI 2.119.0) only.

| Gate | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS — "Already up to date" |
| `pnpm -r typecheck` | PASS — core / adapters / mobile / web `Done` |
| `pnpm -F @soulbound/core test` | PASS — 3 files, 26 tests (unchanged) |
| `pnpm -F @soulbound/adapters test` | PASS — 10 files, 32 tests |
| `pnpm -F web test` | PASS — 31 files, 235 tests |
| `bash scripts/audit.sh` | PASS — `AUDIT PASSED` |
| `pnpm -F web build` | PASS — `Compiled successfully`, 28/28 static pages |
| `pnpm -F @soulbound/mobile typecheck` | PASS |
| `pnpm -F @soulbound/mobile test` | PASS — 6 suites, 24 tests |
| `npx expo-doctor` | PASS — 21/21 checks |
| `npx expo export --platform ios` | PASS — `entry-*.hbc` 3.1MB, `Exported: dist` (gitignored) |
| `supabase db reset` (local) | PASS — 0001–0014 applied |
| `supabase test db` | PASS — 8 files, 229 tests |
| `pnpm -F web test:integration` | PASS — 7 files, 13 tests |
| `pnpm -F @soulbound/adapters test:integration` | PASS — 4 files, 6 tests |

Not verified: real iPhone/simulator run, production Supabase/Vercel.

## Remaining blockers

1. `/privacy` is a **draft** — legal review required (TODO items: retention periods, overseas transfer/region,
   privacy officer + contact, rights procedure, effective date).
2. Moderation SLA: Apple 1.2 expects timely action on reports; an operator routine for `/admin/reports` (e.g. daily)
   must be defined. No notification is sent on new reports (NotificationPort unchanged, no push).
3. "Content removed" resolution records the decision only; actual removal uses the existing admin board delete
   routes, and "member_sanctioned" has no automated suspension.
4. Persona Clip on mobile, reviewer/admin mobile screens, Apple/Expo accounts (see mobile docs).

## Steps for JunTae

1. Review/audit this branch, then apply `0014_store_compliance.sql` to production Supabase
   (`supabase db push` against the linked project). It aborts if legacy `public.reports` has rows — check
   `select count(*) from public.reports;` first.
2. Web env is unchanged (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` — the service-role key is required by `DELETE /api/account`). Redeploy Vercel.
3. Mobile: `EXPO_PUBLIC_API_BASE_URL` = deployed web origin; `EXPO_PUBLIC_PRIVACY_POLICY_URL` optional override.
   App Store Connect privacy URL = `<web origin>/privacy` after legal sign-off.
4. Get legal review of `/privacy` and remove the draft banner only after sign-off.
5. Assign reviewer/admin accounts to process `/admin/reports`.
