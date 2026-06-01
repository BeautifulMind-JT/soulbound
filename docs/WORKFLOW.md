# SoulBound — Operating Workflow (canonical)

> This is the **canonical** definition of who builds, who audits, who approves, and who commits for
> SoulBound Phase 1 P0. The HARD RULES in `CLAUDE.md`, `.clinerules`, and `AGENTS.md`, plus the pipeline
> section of `PROJECT_STATE.md`, point here. **If you change roles here, change those four together**
> (drift across charters is a documented failure mode — PROJECT_STATE §6).
>
> Adopted 2026-06-01 after the Task 3 episode (GLM output rejected → Codex reimplemented → Cowork PASS).
> Builder selection is **risk-tiered** (JT-approved).

---

## 1. Actors

| Actor | Role | One line |
|---|---|---|
| **Cowork** | Architect / Final Auditor / Judge | Designs contract, invariants, Task prompts, acceptance gates; final semantic approval. Does **not** mass-implement. |
| **Codex** | Security-layer Builder *and* first-pass Auditor / precision repair | Builds the constitutional layer; or audits + surgically patches another builder's work. Never both for the **same** change. |
| **GLM / Claude Code** | Surface-layer Builder (bounded labor) | UI, boilerplate, repetitive edits, mechanical wiring, scaffolding, logs, command execution. |
| **JT** | Site lead / commit authority | Runs host commands; sole `git add/commit/push`. Approves exceptions. |

---

## 2. The load-bearing invariant (do not violate)

> **The final approver of a change is never the actor that built or patched it.**

Everything else (who builds, who audits, who patches) is flexible. This one is not. Concretely:
- A builder never self-approves their own build.
- Codex **may** do first-pass audit **and** the minimal surgical patch of its own findings — but the
  **final** gate on that change is always **Cowork**, or a **separate Codex session that did not build it**.
- Cowork approves; Cowork does not build the thing it will be the sole approver of. If Cowork builds, a
  different model audits.

---

## 3. Risk-tiered builder selection

Choose the builder by the **layer** the task touches, not by a fixed default.

**Security / constitutional layer → Codex is the default builder.** GLM/Claude Code must **not** be the
primary builder here (bounded scaffolding / logs / command execution only).
- DB schema, RLS, RPC, storage policies
- Supabase **adapter boundaries** (service_role vs anon/auth client separation), 3-client boundary
- authorization, state-transition guards, idempotency, audit trail, retention/deletion
- anything touching or adjacent to a frozen contract

**Surface / bulk layer → GLM / Claude Code is the default builder.** Codex audits; Cowork finals.
- UI pages and components, forms, loading/error states
- boilerplate, repetitive file generation, mechanical route/wiring scaffolds
- log collection, running acceptance commands

> Rationale: Task 3 showed GLM's failure in the constitutional layer is **systematic, not bad luck** —
> it produces output that passes mechanical gates (`db reset`, `audit.sh`) but is semantically wrong
> (invented enum values, RLS-row-policy mistaken for column protection, schema/RPC column mismatch,
> corrupted prompt doc). GLM is strong at "syntactically plausible structure," weak at the
> permission / state-transition / audit / idempotency layer. So security-layer Codex is a **rule**, not
> a recurring ad-hoc "exception."

---

## 4. Loops

### 4a. Standard loop — surface-layer tasks (fast path)
```
[0] JT: name the Task
[1] Cowork: Task prompt — scope, forbidden list, acceptance gates, expected failure points
[2] GLM/Claude Code: implement (this Task only; stop, do not advance)
[3] Codex: first-pass audit (scope, regressions, typecheck/build/test, invariants)
[4] GLM/Claude Code: fix the findings
[5] Cowork: final semantic review (independent — see §5)
[6] JT: commit / push
```

### 4b. Full loop — security/constitutional-layer tasks
```
[0] JT: name the Task
[1] Cowork: Task prompt + invariants + acceptance gates
[2] Codex (Builder session): implement the security layer
[3] Codex (separate Auditor session) OR Cowork: first-pass audit
[4] Codex (Patch): surgical patch of findings only — no design change, no scope creep
[5] Cowork: final semantic review (independent — see §5); the builder/patcher does NOT approve here
[6] Codex: repatch only Cowork's blocking findings
[7] Cowork: final approval (PASS/FAIL)
[8] JT: commit / push
```

Proportionality: do not run the full 7-hop loop on low-risk surface work; do not shortcut it on the
security layer.

---

## 5. Cowork must not rubber-stamp (self-binding)

"Tests passed per the report" is **not** approval. Cowork final approval requires:
- re-derive state **from git and the working tree**, not from memory or a handoff narrative;
- re-run every gate Cowork **can** run independently (e.g. `audit.sh`, static column/enum cross-checks,
  scope diffs);
- for **runtime-only** claims that the sandbox cannot reproduce (RLS actually enforced under real roles,
  RPC executes without column/type error), require a **committed, reproducible smoke test**
  (e.g. `supabase/tests/`) rather than accepting a one-time manual claim. A green `supabase db reset`
  is **not** sufficient — plpgsql errors surface only at call time.

---

## 6. Exception protocol (builder reassignment)

Reassigning a task's builder away from the risk-tier default (e.g. Codex reimplementing a surface task
GLM botched, or GLM touching a security task) requires, every time:
1. explicit **JT** authorization;
2. a one-line documented reason (audit findings link);
3. builder ≠ final auditor preserved;
4. the exception **does not generalize** to future tasks.

Task 3 was such an exception and is the worked precedent: see `docs/TASK3_REIMPLEMENTATION_DECISION.md`
and `docs/TASK3_AUDIT_FINDINGS.md` (Round 2).

---

## 7. Commits (JT only, on host)

- Builder/audit/patch commits are **separated** for a clean audit trail:
  - implementation: `feat(...): implement Task N ...`
  - audit-finding repair: `fix(...): address Task N audit findings`
  - audit evidence/decision: `docs: record Task N audit pass`
- JT is the sole commit authority; sandbox agents never `git add/commit/push`.
- Repo identity: `soulbounddao-ADMIN`, not a personal identity.

---

## 8. Per-task builder assignment (Phase 1 P0)

| Task | Layer | Default builder | Auditor |
|---|---|---|---|
| 3 — DB schema / RLS / RPC | security | Codex *(done, exception-authorized)* | Cowork |
| 4 — Supabase + noop adapters | security (3-client boundary) | **Codex** | Cowork (+ separate Codex pass) |
| 5 — service wiring / container | security (no business logic in container) | **Codex** | Cowork |
| 6 — API routes | security (route→service, no direct supabase, no key leak) | **Codex** | Cowork |
| 7 — Persona Clip route + recorder | mixed | Codex (route/retention) + GLM (recorder UI) | Cowork (security/retention) |
| 8 — UI pages | surface | **GLM / Claude Code** | Codex → Cowork |
| 9 — audit/outbox hardening | security | **Codex** | Cowork |
| 10 — external ledger PoC (옵션) | security | **Codex** | Cowork |

GLM/Claude Code must **not** be the primary builder for DB/RLS/RPC, authorization, idempotency, audit,
retention, adapter client boundaries, or frozen-contract work — even when "assisting."
