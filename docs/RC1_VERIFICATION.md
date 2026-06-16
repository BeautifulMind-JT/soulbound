# RC-1 Verification

Status: LOCAL GATE PASS (at candidate) / STAGING DEPLOYED / STAGING SMOKE EVIDENCE CAPTURED / FINAL AUDIT PENDING

## SHA

baseline_sha: f9f1bad
candidate_sha: fafba308929544daebf2f10311117dfd6f7c8191

### Candidate history (fix-forwards after baseline)

| SHA | What | Authorization |
|---|---|---|
| `c8903b6` | docs: RC-1 runbook decisions finalized (docs-only) | — |
| `dbcd8ec` | docs: first verification record (docs-only) | — |
| `c07fe98` | **fix(build)**: `pnpm-workspace.yaml` build-script allowlist `allowBuilds: esbuild+sharp` (sharp = Next.js build requirement on Vercel). **0C-frozen file — JT-authorized minimal wiring fix** (precedent: audit.sh fix 1c243c1). | JT (committed directly) |
| `fafba30` | **fix(web)**: Next 16.0.0→16.2.7, React 19.2.0→19.2.7 security patches (+lockfile). | JT |

Per the runbook §4 ("re-run after any fix-forward"), the FULL local gate was re-run at `fafba30`
(the first record at `c8903b6` is superseded by the run below).

## Date / Runner

date: 2026-06-10 KST (re-gate at candidate); staging smoke updated 2026-06-16 KST
runner: JT (toolchain gates + real-device smoke) + Codex (staging role/decision/clip/reap smoke automation)
host: local Mac
pnpm: 11.1.3
node: 24.13.1

## Local gate — at candidate_sha `fafba30`

- `pnpm install --frozen-lockfile`: PASS
- `pnpm -r typecheck`: PASS
- `pnpm -r build`: PASS (web: Next 16.2.7 build OK, all routes emitted)
- `bash scripts/audit.sh`: PASS / AUDIT PASSED
- `pnpm -F @soulbound/core test`: PASS / 20 tests
- `pnpm -F @soulbound/adapters test`: PASS / 22 tests
- `pnpm -F web test`: PASS / 42 tests
- `supabase db reset`: PASS (migrations 0001–0008 + local seed)
- `supabase test db`: PASS / Files=3, Tests=73

## Live Integration Determinism — at candidate_sha `fafba30`

5 consecutive live runs (post-reset): PASS

Each run included:

- `pnpm -F @soulbound/adapters test:integration`: PASS / 4 tests
- `pnpm -F web test:integration`: PASS / 5 tests

## Persona Clip Reaper — at candidate_sha `fafba30`

Command:

```sh
pnpm -F @soulbound/adapters clip:reap
```

Result:

```text
scanned=0 deleted=0 failed=0 deletedAssetIds=[]
```

## Staging Deploy

- Vercel: NEW account `soulbounddao-admin` / team `soulbound-admin-s-projects`, project **soulbound-staging**.
  Settings per runbook §8: framework=nextjs, Root Directory=`apps/web` + include-source-outside-root, Node 24,
  build `cd ../.. && pnpm -F web build`, output not overridden, `ENABLE_EXPERIMENTAL_COREPACK=1` (pnpm 11.1.3).
- Preview deployment: READY, **git SHA metadata = `fafba30`** (matches candidate).
- Supabase staging: migrations **0001–0008 applied, NO seed** (runbook §6/§11).
- First HTTP smoke (shallow): `/` 200, `/signup` 200, unauthenticated API 401. (NOT the §13 smoke.)
- Vercel SSO / Deployment Protection: **OFF since 2026-06-10 16:08:30 KST** (lifted for the §13 smoke; staging is publicly
  reachable — open-signup decision applies). External reachability verified from a real mobile device (carrier
  network), no Vercel login prompt.
- Post-candidate documentation-only commits after `fafba30`: runtime diff from `fafba30` = 0; candidate unchanged.

## Staging Smoke (§13) — EVIDENCE CAPTURED, FINAL AUDIT PENDING

**PASS so far (2026-06-10, real device on carrier network):**
- Real new signup (redacted staging test account) → **email-confirmation ON works**: confirmation mail received, link →
  staging origin, then sign-in → `/gate` reached (no-application state + procedure list rendered).
- **profiles provisioning trigger verified ON STAGING**: direct DB query → exactly 1 `public.profiles` row,
  UID matches `auth.users`, `role='applicant'`, `membership_status='none'` (the 0007 trigger, real-signup path).
- **Custom SMTP proof captured**: confirmation mail sender shown as `noreply@soulbound.co.kr` (no longer the default
  `noreply@mail.app.supabase...` sender). This satisfies the RC-1 "email-confirm ON with real SMTP" requirement.
- **Applicant no-clip / skip path verified on a real mobile device**: Persona Clip unavailable/skip path → submit →
  `/apply/status` shows `제출됨` (PC-01: clip absence does not block submission).

**PASS (2026-06-16, staging smoke automation with synthetic staging actors):**
- Created isolated staging smoke actors for clip-applicant, reject-applicant, and reviewer (service-role setup;
  real signup/email/profiles path is covered separately above).
- Clip application path: created signed Persona Clip upload, uploaded bytes, submitted application with clip asset.
- No-clip rejection path: submitted a second application without a clip.
- Role boundary: reviewer queue contains both applications; applicant access to admin queue returns **403**.
- Reviewer detail: clip asset present; signed clip playback/download succeeds and bytes match the uploaded clip.
- Decisions: reviewer approves the clip application and rejects the no-clip application; approved applicant sees
  `/api/membership/me` with `status='active'`; applicant response does not expose `reviewSummary`.
- No-leak checks: `audit_logs` + `outbox_events` for the smoke applications contain no `storage_path` or signed URL;
  public HTML/JS bundle scan contains neither the service-role key value nor the literal `SUPABASE_SERVICE_ROLE_KEY`.
- Persona Clip retention before reaper: approved clip row has `status='attached'`, `deletion_reason='application_approved'`,
  `delete_after` present, and `deleted_at` absent.
- Manual staging `clip:reap`:
  ```text
  persona-clip reap scanned=1 deleted=1 failed=0 deletedAssetIds=["23768a28-bcbc-4df8-997d-222a50f564ad"]
  ```
- Post-reaper evidence: target row is `status='deleted'`, `deletion_reason='application_approved'`, `deleted_at`
  present, and the Storage object is absent (`storageFetchStatus=400`). The storage path was read only internally for
  verification and was not printed in the CLI output or this record.

**✅ Supabase Auth rate-limits — recorded (2026-06-10, staging dashboard):**
sign-ups/sign-ins **30 req/5min/IP** (the §15 open-signup mitigation, active); token refreshes 150/5min/IP;
token verifications 30/5min/IP; anonymous + Web3 locked (unused). Custom SMTP evidence is now captured above; re-check
the email-send limit in the dashboard before a larger alpha if the provider-specific cap needs to be recorded.

**Residual evidence notes for final audit:**
- The clip-included smoke used a synthetic uploaded `video/webm` object through the real signed-upload route and
  Supabase Storage, not a real camera recording. The real-device mobile evidence covers signup and the no-clip/skip
  path. If final audit requires literal real-camera QA, capture one additional device recording before alpha.
- INV-17 evidence is an automated deployed-bundle/API smoke (no service-role key in public HTML/JS; user-data calls
  use bearer tokens in the smoke harness), not a screenshot of browser devtools. Capture a devtools screenshot if the
  final audit wants that exact artifact.

## Secret hygiene

- `/private/tmp` secret-bearing temp files (staging API keys, vercel env JSONs, API headers, CLI strings dump):
  **deleted 2026-06-10** (two sweeps). Non-secret artifacts (deployment metadata, SHA snapshots/tars, page HTML)
  remain; delete at RC close.

## Verdict

LOCAL RC-1 GATE PASS at candidate `fafba30`.
STAGING DEPLOYED at `fafba30`; §13 evidence captured: signup/profiles, custom SMTP, applicant no-clip submit,
reviewer role boundary, approve/reject, member active, clip playback, no-leak checks, manual reap, and object absence.
RELEASE-READY: **PENDING FINAL AUDIT / JT GO-NO-GO** — no current blocking product failure recorded. Final audit should
decide whether the two residual evidence notes (literal real-camera clip; browser devtools screenshot) are required
before alpha. `v0.1.0-rc.1` tag target: `fafba30` if final audit accepts this evidence package.
