# RC-1 Verification

Status: LOCAL GATE PASS / STAGING PENDING

## SHA

baseline_sha: f9f1bad
candidate_sha: c8903b681c5f7f2e1d21fd12c1d98faa755200b6

## Date / Runner

date: 2026-06-09 KST
runner: JT
host: local Mac
pnpm: 11.1.3
node: 24.13.1

## Local gate

- `pnpm install --frozen-lockfile`: PASS
- `pnpm -r typecheck`: PASS
- `pnpm -r build`: PASS
- `bash scripts/audit.sh`: PASS / AUDIT PASSED
- `pnpm -F @soulbound/core test`: PASS / 20 tests
- `pnpm -F @soulbound/adapters test`: PASS / 22 tests
- `pnpm -F web test`: PASS / 42 tests
- `supabase db reset`: PASS
- `supabase test db`: PASS / Files=3, Tests=73

## Live Integration Determinism

5 consecutive local live runs: PASS

Each run included:

- `pnpm -F @soulbound/adapters test:integration`: PASS / 4 tests
- `pnpm -F web test:integration`: PASS / 5 tests

## Persona Clip Reaper

Command:

```sh
pnpm -F @soulbound/adapters clip:reap
```

Result:

```text
scanned=0 deleted=0 failed=0 deletedAssetIds=[]
```

## Staging Deploy

PENDING

## Staging Smoke

PENDING

## Verdict

LOCAL RC-1 GATE PASS.

RELEASE-READY: NO.

Next gate: Supabase/Vercel staging deployment + staging smoke.
