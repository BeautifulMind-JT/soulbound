# RC-1 Verification

Status: LOCAL GATE PASS (at candidate) / STAGING DEPLOYED / STAGING SMOKE PENDING

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
- Vercel SSO protection: still ON (must be lifted before the §13 real-signup smoke).

## Staging Smoke (§13)

PENDING — blocked on Supabase Auth staging config (SMTP for email-confirmation ON, site_url/redirect URLs),
then: real new signup → profiles trigger; applicant/reviewer/member role boundaries; Persona Clip
upload → approve/reject → manual `clip:reap` → object absence; INV-17 no service-role in client bundle/network.

## Verdict

LOCAL RC-1 GATE PASS at candidate `fafba30`.
STAGING DEPLOYED at `fafba30` (shallow HTTP smoke only).
RELEASE-READY: **NO**.
Next gate: Supabase Auth (SMTP/site_url) → lift Vercel SSO → §13 staging smoke → Cowork final audit → §17 go/no-go.
`v0.1.0-rc.1` tag target: `fafba30` (after the full record is green).
