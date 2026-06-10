# RC-1 Verification

Status: LOCAL GATE PASS (at candidate) / STAGING DEPLOYED / STAGING SMOKE IN PROGRESS

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

date: 2026-06-10 KST (re-gate at candidate)
runner: JT (toolchain gates) + Opus audit session (live determinism loop + reap, on the same host)
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
- Post-candidate docs-only commits (`dbcd8ec`→`72b8d54` 등): runtime diff from `fafba30` = 0; candidate unchanged.

## Staging Smoke (§13) — IN PROGRESS

**PASS so far (2026-06-10, real device on carrier network):**
- Real new signup (redacted staging test account) → **email-confirmation ON works**: confirmation mail received, link →
  staging origin, then sign-in → `/gate` reached (no-application state + procedure list rendered).
- **profiles provisioning trigger verified ON STAGING**: direct DB query → exactly 1 `public.profiles` row,
  UID matches `auth.users`, `role='applicant'`, `membership_status='none'` (the 0007 trigger, real-signup path).

**🔴 P1 (must fix before alpha): confirmation mail was sent by the DEFAULT Supabase mailer**
(`noreply@mail.app.supabase…`), not real SMTP. The runbook decision is email-confirm ON **with real SMTP**; the
default mailer's hourly send limits cannot support the 5–20-person alpha. Configure real SMTP, then re-verify one
signup end-to-end.

**🟡 FLAG: Supabase Auth rate-limit settings — evidence not yet recorded** (SSO is OFF + signup is open, so the
rate-limit mitigation from runbook §15 must be confirmed/enabled and recorded here).

**REMAINING (§13):**
- applicant: apply → submit (once WITH a real-camera clip [doubles as the 7b manual QA], once skipping) → status.
- reviewer: promote a real signup via §6 (record who/when) → queue → detail → clip playback → approve AND reject.
- member: approved applicant sees `/member` active.
- Persona Clip retention: after approve/reject, run manual `clip:reap` (staging env) → Storage object ABSENT,
  row `status='deleted'` evidence-only.
- INV-17: devtools — no service-role string in bundle/network; all data calls carry the user bearer.

## Secret hygiene

- `/private/tmp` secret-bearing temp files (staging API keys, vercel env JSONs, API headers, CLI strings dump):
  **deleted 2026-06-10** (two sweeps). Non-secret artifacts (deployment metadata, SHA snapshots/tars, page HTML)
  remain; delete at RC close.

## Verdict

LOCAL RC-1 GATE PASS at candidate `fafba30`.
STAGING DEPLOYED at `fafba30`; §13 smoke IN PROGRESS (signup + profiles-trigger PASS).
RELEASE-READY: **NO** — blockers: real SMTP (P1), §13 remainder, Auth rate-limit evidence.
Next: real SMTP → rate-limit record → §13 remainder (roles / clip lifecycle / reap / INV-17) → Cowork final audit →
§17 go/no-go. `v0.1.0-rc.1` tag target: `fafba30` (after the full record is green).
