# Task RC-1 — Release Candidate 1 runbook (Cowork-authored draft)

> **P0 MVP code-complete ≠ release-ready.** Code-complete was reached at HEAD `f9f1bad`. RC-1 is the gate that turns
> code-complete into a *release candidate*: freeze scope, verify the build at an exact SHA, deploy to **staging**
> (Supabase + Vercel), configure auth, validate with **real** smoke tests + an internal alpha, and only then judge
> release-readiness. **No new features in RC-1** — anything found is a small fix-forward or a deferral.
>
> **Roles:** this is mostly an **ops runbook executed by JT** against real Supabase/Vercel (the sandbox cannot reach
> them). Cowork (me) authored it and **final-audits the recorded staging-smoke results**. Any RC-1 *code/config*
> artifacts (listed in §16) are small builder tasks dispatched to Codex **only after JT approves this plan** —
> per JT's instruction, **nothing is implemented yet**.
>
> **Branch/tag:** cut RC-1 from `phase1-p0-mvp` @ `f9f1bad`; tag `rc1` after the local gate (§4) is recorded.

---

## 1. Scope freeze
- **Frozen at `f9f1bad`.** P0 MVP scope is closed. No feature work in RC-1.
- In-scope for RC-1: deployment config, env/secrets wiring, auth config, staging deploy, smoke validation, the
  internal alpha, and at most **small fix-forwards** (e.g. a Vercel build flag) discovered during staging bring-up.
- A fix-forward is a NEW commit (and, for DB, a NEW migration `0009+`) — **never edit a shipped migration or the
  frozen contract.** Anything larger than a config/flag fix is deferred, not crammed into RC-1.

## 2. Completed Task 1–9 summary (what RC-1 is shipping)
| Task | What | Audit evidence |
|---|---|---|
| 1–2 | monorepo + `packages/core` domain/services; 19 frozen contract tests GREEN | (Task 2 audit) |
| 3 | DB schema + RLS + RPCs (`supabase/migrations/0001–0004`) | TASK3_AUDIT_FINDINGS |
| 4 | Supabase + Noop adapters (3-client boundary) | TASK4_AUDIT_FINDINGS |
| 4.5 | trusted role source (`current_user_role()`, migration 0006) | TASK4_5_AUDIT_FINDINGS |
| 5 / 5.5 | service wiring (`makeCoreContainer`) + seed sign-in fix | TASK5 / TASK5_5 |
| 6a / 6b | API routes — applicant + admin/reviewer | TASK6A / TASK6B |
| 7a / 7b | persona-clip routes + signed-upload adapter; in-app recorder | TASK7A / TASK7B |
| 8a / 8b | UI — auth foundation + applicant pages; member + admin/reviewer pages | TASK8A / TASK8B |
| profiles | `auth.users → profiles` provisioning trigger (migration 0007) | PROFILES_PROVISIONING |
| 9a | persona-clip byte-delete reaper (CLI) + reap RPCs (migration 0008) | TASK9A_AUDIT_FINDINGS |
| 9b | outbox-payload INV-16 regression lock (core test 19→20) | TASK9B_AUDIT_FINDINGS |

End-to-end happy path shipping: **signup → gate → apply (+optional clip) → submit → reviewer review →
approve/reject → member**, with RLS/RPC security, the 3-client boundary, persona-clip retention (reaper), and
audit/outbox hardening.

## 3. Deferred (explicitly NOT in RC-1)
- **Task 9a-2** — an internal cron route wrapping `clip:reap`. RC-1 runs the reaper as a CLI/scheduled job (§14).
- **Task 10** — external-ledger PoC + outbox-drain processor (separate branch; `externalLedgerEnabled=false` on
  main, so the outbox never fires in RC-1).
- **Accepted residuals** (documented, not blocking): the expired-draft TOCTOU window (PC-01-tolerated, no privacy
  leak — TASK9A_AUDIT_FINDINGS); the dormant `reasonCode` display branch on the applicant status page
  (TASK8A_AUDIT_FINDINGS #2). Re-confirm these are acceptable for the alpha; do not "fix" them in RC-1 without a
  decision.

## 4. Final LOCAL gate checklist (run at `f9f1bad`, record results)
Run from a clean checkout at the exact SHA, local Supabase up:
```sh
git rev-parse HEAD            # must be f9f1bad...
pnpm install --frozen-lockfile
pnpm -r typecheck             # CLEAN
pnpm -r build                 # all packages incl. `next build` for web — emit OK
bash scripts/audit.sh         # AUDIT PASSED
pnpm -F @soulbound/core test          # 20 passed
pnpm -F @soulbound/adapters test      # 22 passed
pnpm -F web test                      # 42 passed
supabase db reset             # applies 0001–0008 + seed (LOCAL only)
supabase test db              # Files=3, Tests=73, PASS
# live integration determinism (5x consecutive, post-reset) — the §6-lesson bar:
for i in 1 2 3 4 5; do pnpm -F @soulbound/adapters test:integration && pnpm -F web test:integration || break; done
pnpm -F @soulbound/adapters clip:reap   # scanned=0 deleted=0 failed=0 on a clean reset
```
(`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` from `supabase status -o env` for the integration
runs; see §9.) **Record every result** per §5. Local gate must be fully green before any staging deploy.

## 5. SHA-based verification record (how to record it)
Keep an auditable record (e.g. `docs/RC1_VERIFICATION.md` or the release notes) with this exact shape:
```
RC-1 verification
  commit:        f9f1bad  (git rev-parse HEAD)
  date / by:     <date> / <name>
  host:          <os, node 24.x, pnpm 11.1.3>
  local gate:    typecheck PASS | build PASS | audit PASS | core 20 | adapters 22 | web 42 |
                 pgTAP 73 | integration 5/5×5 | clip:reap scanned=0
  staging deploy: supabase <project-ref> migrations 0001–0008 applied (NO seed) |
                 vercel <deployment-url> build PASS
  staging smoke: signup PASS | roles PASS | clip lifecycle+reap PASS | no service-role leak verified
  verdict:       RC-1 PASS / HOLD  (Cowork final-audit of the smoke evidence)
```
Tie every claim to the SHA. A staging deploy or smoke run from a different SHA invalidates the record.

## 6. Supabase **staging** deployment runbook
1. **Create a dedicated staging project** (separate from any prod; never reuse local). Note its `project-ref`,
   `SUPABASE_URL`, anon key, service-role key.
2. `supabase link --project-ref <staging-ref>`.
3. **Backup first** (even though staging is empty on first deploy — make it the habit; see §10).
4. **Apply migrations only — NO seed:** `supabase db push` (applies `0001–0008`). Do **NOT** run `supabase db reset`
   against staging (reset re-seeds + wipes) and do **NOT** apply `supabase/seed.sql` (see §11).
5. Verify post-migration: the 8 migrations are recorded; `current_user_role()` + the reap RPCs exist and are
   `service_role`-only; RLS is enabled on the protected tables; the `auth.users → profiles` trigger exists; the
   persona-clips bucket is correct (§12).
6. **Provision a staging reviewer/admin WITHOUT seed** (§11): a real person signs up (→ applicant), then promote via
   a one-off service-role update `update public.profiles set role='reviewer' where id='<their auth uid>'` (or
   `'admin'`). Record who/when. (This is the only sanctioned manual role grant.)

## 7. Supabase **Auth** staging config
- **Site URL** = the Vercel staging URL (e.g. `https://soulbound-staging.vercel.app`).
- **Redirect URLs (allow list)** = the staging origin (+ any preview domains you'll use). The app uses
  password auth (`signInWithPassword`) + `signUp`; if email confirmation is ON, confirmation/recovery links must
  redirect to an allowed URL.
- **Email confirmation:** decide explicitly.
  - 8a `signUp` already handles both: it returns `requiresEmailConfirmation` when no session comes back. For a
    **controlled alpha**, either (a) **confirmation ON** with a real SMTP/email provider configured in Supabase
    (users verify via email — closest to prod), or (b) **confirmation OFF** for a tight invite list (immediate
    sign-in; simpler, but anyone with the URL can self-register — pair with signups-disabled-by-default or an allow
    list). **Recommend (a) for realism;** record the choice. Verify the signup page's confirmation branch matches
    the chosen setting.
- Confirm **no role/privilege is ever set from auth metadata** (the trigger hardcodes `applicant`; role changes are
  the §6 manual promotion only).

## 8. Vercel **staging** deployment runbook (monorepo)
- **Framework:** Next.js (16). **Root Directory:** the **repo root** (so Vercel sees `pnpm-workspace.yaml` +
  `packageManager: pnpm@11.1.3`), NOT `apps/web` — the app depends on the `@soulbound/*` workspace packages.
- **Install command:** default pnpm install (Vercel honors `packageManager`; ensure pnpm 11 + **Node 24** — `.nvmrc`
  = 24; set the Vercel Project Node version to 24).
- **Build command:** `pnpm -F web build` (or `pnpm --filter web... build`). **Output:** `apps/web/.next`.
- **⚠️ #1 build risk — workspace TS source.** `@soulbound/core` / `@soulbound/adapters` export `./src/index.ts`
  (TypeScript **source**, not built JS), and `apps/web/next.config.ts` is currently empty (no `transpilePackages`).
  It builds locally (Next 16 transpiles the workspace source), but **verify the Vercel build succeeds**. If Vercel's
  `next build` fails resolving/transpiling the workspace TS, the fix-forward is a new commit adding
  `transpilePackages: ['@soulbound/core', '@soulbound/adapters']` to `next.config.ts`. Validate this on a Vercel
  **preview** deploy before promoting staging.
- **Env vars (§9):** set in the Vercel project. `NEXT_PUBLIC_*` are inlined at **build** time (must be present for
  the build); `SUPABASE_SERVICE_ROLE_KEY` is **server runtime only** — set it as a normal (encrypted) env var,
  **never** `NEXT_PUBLIC_`-prefixed, and confirm it does **not** appear in the client bundle (the INV-17 grep from
  Task 8a, re-run against the deployed `.next/static` or via the build output).

## 9. Env matrix
| Var | Where | Visibility | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Web** (Vercel) | public, build-inlined | staging project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Web** (Vercel) | public, build-inlined | staging anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Web** (Vercel) | **secret, server runtime only** | NEVER `NEXT_PUBLIC_`; never in client bundle |
| `SUPABASE_URL` | **CLI / reaper** (ops host or CI) | secret env | staging URL for `clip:reap` |
| `SUPABASE_SERVICE_ROLE_KEY` | **CLI / reaper** | secret env | same key, server-only |
- (Local integration tests additionally need `SUPABASE_ANON_KEY` — test-only, not a deploy var.)
- Rotate the staging service-role key if it was ever pasted into a shared transcript.

## 10. Migration backup + rollback / forward-fix
- **Before applying migrations to a non-empty DB:** take a backup (Supabase dashboard backup / `pg_dump`). Record
  the backup id + timestamp in the verification record.
- **This project's migrations are forward-only** (no down-migrations). So:
  - **Rollback** = restore from the pre-migration backup (full-DB restore). Use only if a migration corrupts staging.
  - **Forward-fix** = a NEW migration `0009+` that corrects the issue. **Never edit a shipped migration** (`0001–0008`
    are immutable once applied anywhere).
- The 0007 trigger + 0008 unique index/RPCs are forward-only and idempotent-friendly (`0005` bucket upsert,
  `create or replace` RPCs); re-applying the migration set on a fresh staging DB is safe.

## 11. Production seed is FORBIDDEN
- `supabase/seed.sql` inserts **well-known test accounts** (`admin/reviewer/applicant@soulbound.local`, password
  `password123`) for LOCAL dev only. Applying it to staging/prod would create **known-credential accounts** =
  an immediate account-takeover hole.
- **Never** run `supabase db reset` or apply `seed.sql` against staging/prod. Staging gets migrations only (§6).
- The only sanctioned role grant on staging is the manual reviewer/admin promotion of a **real** signup (§6).

## 12. persona-clips bucket / policy / size-limit validation (post-deploy)
Confirm on staging (migration 0005 should have created it):
- bucket `persona-clips` exists, **`public = false`** (private).
- `file_size_limit = 52428800` (50 MiB).
- `allowed_mime_types = {video/webm, video/mp4, audio/webm, audio/mp4}`.
- three `storage.objects` policies (insert/select/delete) scoped to **own path** (`auth.uid()::text =
  (storage.foldername(name))[1]`) for `authenticated`.
- Spot-check: an authenticated user can only read/write under their own `ownerId/...` prefix; the reviewer read +
  the reaper delete go through the **service-role** route/CLI (which bypasses these policies by design).

## 13. Staging smoke validation (REAL, against the deployed staging — the heart of RC-1)
Run these on the live staging URL with real accounts (record pass/fail + screenshots/network notes):
1. **Actual new signup:** a brand-new email signs up → **a `public.profiles` row is auto-created with role
   `applicant`** (the 0007 trigger — this is the exact gap that broke pre-0007; verify it works in staging) → can
   reach `/gate` and `/apply`.
2. **Role smoke (applicant / reviewer / member):**
   - applicant: signup → apply (with + without a clip) → submit → `/apply/status` shows submitted (PC-01: clip
     absence never blocks).
   - reviewer (promoted per §6): `/admin/applications` queue loads; open detail; `reviewSummary` visible to the
     reviewer only; **a non-reviewer hitting `/admin/applications` gets the route 403 / permission state** (no data).
   - member: after the reviewer **approves**, the applicant's `/member` shows active membership.
3. **Persona Clip full lifecycle:** record in-app → signed-upload PUT → attached → reviewer **plays** the clip
   (signed read URL) → **approve OR reject** (RPC marks `delete_after=now()` + `deletion_reason`) → run
   **`clip:reap`** (§14) → **the Storage object is GONE** (download 404) and the row is `status='deleted'` with
   `deleted_at` set, while the DB keeps only the evidence row (assetId/contentHash/status/deleted_at/reason). Confirm
   **no `storage_path`/URL/token leaks** into `audit_logs`/`outbox_events`/any response (INV-PC-06).
4. **3-client / INV-17:** in the browser devtools, confirm the service-role key is **absent** from the client bundle
   + network; all data calls carry a user bearer; the browser Supabase client is used for auth + `current_user_role`
   only (no `.from`/`.storage`).

## 14. Reaper operations (who runs it / cadence / failure)
- **Execution subject:** an ops host or CI job holding the **staging** `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
  (server-only). NOT the browser, NOT an end user. Command: `pnpm -F @soulbound/adapters clip:reap`
  (see `docs/TASK9A_CLIP_REAP_RUNBOOK.md`).
- **Cadence (RC-1, manual/scheduled):** since the cron route (9a-2) is deferred, run it on a schedule — e.g. a
  **scheduled GitHub Action / cron every 1h** (terminal clips are marked `delete_after=now()` at approve/reject, so
  prompt reaping minimizes how long decided-applicant media lives; abandoned drafts have a 24h TTL). For a small
  alpha, even a manual daily run is acceptable **if** documented; privacy expectation should match the cadence.
- **Failure handling:** the reaper is **idempotent + failure-tolerant** — a transient Storage error leaves the row
  unmarked (`failed += 1`) and the **next run retries**. Monitor the CLI summary; if `failed > 0` persists across
  runs, investigate (Storage outage / a stale path). The summary prints **counts + assetIds only** (no path/URL) —
  safe to log.

## 15. Internal alpha (5–20 people) checklist
- [ ] Staging fully deployed + §13 smoke all green + recorded at the SHA.
- [ ] A real **admin/reviewer** provisioned (§6); reviewer trained on the queue/decision UI.
- [ ] Invite list (5–20) prepared; signups limited to the invite list (allow-list or invite-only; otherwise the
      staging URL is open registration — decide + lock down).
- [ ] Each alpha user runs the happy path: signup → apply (try a clip + try skipping) → see status; a few get
      approved → see `/member`; a few rejected → see the applicant notice (NOT the internal reasonCode/reviewSummary).
- [ ] Reaper runs on its cadence during the alpha; spot-check that an approved/rejected clip's bytes are gone.
- [ ] Watch for: client errors, broken redirects, email-confirmation friction, any service-role/secret exposure in
      network/devtools, clip upload failures on real devices/cameras (the 7b manual-QA — real camera/permission/skip).
- [ ] Feedback capture channel + a **kill switch** (how to disable new signups / take staging down fast).
- [ ] No PII beyond what the design intends is logged; `audit_logs`/`outbox_events` spot-checked clean.

## 16. RC-1 code/config artifacts to create (ONLY after JT approves this plan)
Small builder tasks (Codex), each audited:
- (a) `apps/web/next.config.ts` `transpilePackages` — **only if** the Vercel build needs it (§8); otherwise skip.
- (b) A scheduled-reaper config (e.g. a GitHub Action running `clip:reap` against staging) — RC-1's stand-in for 9a-2.
- (c) A `docs/RC1_VERIFICATION.md` template (§5) — or keep the record in release notes.
- (d) (Optional) a one-off SQL snippet doc for the §6 reviewer/admin promotion.
None of these are feature code; they are release wiring. **Do not create them in this draft.**

## 17. Release-readiness decision (the point of RC-1)
RC-1 → **release-ready** only when ALL hold, recorded at the SHA:
1. Local gate green (§4) at `f9f1bad`.
2. Staging deployed: Supabase migrations 0001–0008 (no seed) + Vercel build green (§6/§8).
3. Staging smoke (§13) all green — esp. real signup→profiles trigger, the role boundaries, and the clip
   lifecycle→reap→object-absence.
4. Internal alpha (§15) run without a release-blocking issue.
5. Cowork final-audit of the recorded staging-smoke evidence = PASS.
**JT owns the go/no-go.** Until then: P0 MVP is *code-complete*, not *released*.

---

### Notes (Cowork)
- This is a **draft for review** — no implementation started (per JT). On approval, §16 artifacts get dispatched and
  the staging bring-up (§6–§8) is executed by JT, with Cowork final-auditing the §13 evidence against `f9f1bad`.
- The single most likely surprise is §8's workspace-TS Vercel build — validate it on a preview deploy first.
