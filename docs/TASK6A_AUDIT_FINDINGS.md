# Task 6a — apps/web scaffold + applicant API routes — Audit Findings (final auditor record)

> Builder: **Codex** (route↔service boundary / 3-client / auth = security layer). Final auditor: **Opus audit
> session** (separate). Verdict: **PASS.** Includes a JT-authorized minimal `audit.sh` toolchain fix surfaced by
> this task. Commit by **JT** (host). Builder ≠ final approver preserved (WORKFLOW §2). Spec:
> `docs/TASK6A_API_ROUTES_PROMPT.md`. Gate = route-handler integration tests (JT's choice).

First web tier in the project. 6a = `apps/web` scaffold + server request-auth (session → Actor) + the 3-client
boundary + the applicant-facing API routes. Admin/reviewer routes = 6b.

## Audit method (re-derived from the working tree — not a rubber stamp)

Read the server helpers (env/auth/container/admission/http/schemas), all 4 route handlers, and the integration
test; grepped for service-role-key leaks and direct-supabase usage; independently re-ran `audit.sh` (and caught
the build-artifact false-FAIL below); confirmed scope + core/adapters/supabase/frozen-0C untouched. The live
runs are host-only — corroborated statically; JT confirms green on the host.

## Verified (6a code — each point independently re-derived)

- **① service-role key server-only (INV-17).** `SUPABASE_SERVICE_ROLE_KEY` (not `NEXT_PUBLIC_*`) is read only in
  server `_lib`/route code; `getContainer()` (the only service-role user) is imported solely by route handlers;
  **no `use client` file exists**, and Next never inlines non-`NEXT_PUBLIC_` env into any bundle → no client leak.
  `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` are the only public vars.
- **② applicantId from the resolved actor, never the body.** `POST /applications` sets `applicantId: actor.id`;
  `optionalProps` is typed `Omit<…,"applicantId"|"idempotencyKey">` and the zod schema has no `applicantId` field
  (unknown keys stripped). The integration test ACTIVELY attacks this (submits with another user's id in the body)
  and asserts the created row's `applicantId === actor.id`.
- **③ no business logic / role decision / direct DB write in routes (INV-09).** Writes go through
  `container.admissionService.submitApplication`; applicant reads go through the **user-scoped repo**
  (`makeUserScopedAdmissionRepository`, RLS own-only); membership via `membershipService.getMyMembership`. Routes
  only: resolve actor → validate (zod) → call service/repo → map Result→HTTP.
- **④ auth is real, not decoded.** `resolveActor` validates identity with `client.auth.getUser(token)`
  (GoTrue-verified) and resolves role via `current_user_role()` (trusted table, NOT JWT claims), fail-closed to
  `applicant`. Another applicant's `[id]` → **404** (RLS own-only, no existence leak); no session **401**;
  invalid token **401** (proven in the test — a bogus token fails `getUser`).
- **⑤ gate is non-vacuous + re-runnable + fail-loud.** The integration test invokes the actual handler functions
  with a REAL bearer token (live sign-in of a per-run throwaway applicant), exercising the real
  auth→service/repo→DB path; covers submit/me/[id]-own/[id]-other-404/membership-null/401/body-injection. Unit
  tests (7) cover resolveActor/toHttp/zod stack-free. Env missing → throws.
- **⑥ apps/web source clean** for the audit invariants: no `supabase.storage`, no direct `createClient`/
  `@supabase/supabase-js`, no chat/messages routes (verified by grep excluding build dirs). `http.ts`
  `dependencyFailure` is generic (`void error`) — no DB/internal leak; the status map is exhaustive
  (`Record<AppErrorCode, number>`: 422/403/404/409/409/502, +401).

Scope: `apps/web/**` + `pnpm-lock.yaml` (+ the `audit.sh` fix). `packages/core/src`, `packages/adapters/src`,
`supabase/**`, and the frozen 0C root configs are untouched.

## Grounded scoping decision (recorded)

**P0 has no client-side draft creation**, so `POST /api/admission/applications` = `submitApplication`
(create-as-submitted) and the BuildPlan folder diagram's `[id]/submit` route is **not implemented in P0**.
Grounds: frozen `submit_application_tx` inserts `status='submitted'` directly; `SubmitApplicationCommand` has no
`applicationId`; `0003_rls.sql` gives `authenticated` no INSERT on `admission_applications`. The `draft` enum
exists only for future draft-editing + the clip-24h cleanup. (A real draft step would require unfreezing the
contract — not done.)

## Toolchain finding (surfaced by 6a) + fix — both PASS

**`audit.sh` false-FAILed on build artifacts.** Re-running `audit.sh` after a build FAILed
("supabase.storage in apps") on `apps/web/.next/**` (gitignored Next build output bundling supabase-js) — NOT
source. Root cause: `GREP()` used `rg` when present (honors `.gitignore` → PASS) but `grep -rEn` otherwise (ignores
`.gitignore` → scans `.next` → FAIL). So the gate was non-deterministic across machines (builder had `rg`,
auditor didn't). **The 6a source is clean** (`.next` is gitignored / not committed; CI fresh-checkout passes).
**JT-authorized minimal fix** (frozen 0C, correctness not weakening): `GREP()` now excludes
`**/.next/**`, `**/dist/**`, `**/node_modules/**` on BOTH the `rg` and `grep` branches. Audited: diff is the
`GREP()` function only; `audit.sh` now PASSES with `.next` present on both `rg` and forced-`grep` paths; source
coverage intact (a known source token still matches under the new excludes; builder's probe confirmed a real
source `supabase.storage` still FAILs). Recorded as a failure mode in PROJECT_STATE §6.

## Out of scope (unchanged)
- Admin/reviewer routes + review-queue list + reviewer/admin RLS read policies = **6b**.
- `[id]/submit` (no P0 draft path), persona-clip + persona-clip-url = **Task 7**, outbox/process = **Task 9**,
  UI pages/components = **Task 8**.

## Runtime confirmation (host-only)
Auditor corroborated statically + re-ran `audit.sh` (caught the build-artifact issue) + verified the fix on the
grep fallback. Builder-reported green: `supabase test db` 49, apps/web `test:integration` (run twice),
`test` 7 unit, adapters 14, core 19, `typecheck`, `build`. The live runs are host-only; **JT re-confirms on the
host at commit** (WORKFLOW §5) — including `audit.sh` on a tree where `apps/web/.next` exists.
