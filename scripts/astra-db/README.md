# Isolated SQL verification

From the repository root, Node 24:

```bash
npm ci --prefix scripts/astra-db --ignore-scripts
npm test --prefix scripts/astra-db
```

This harness always creates two fresh **in-memory PostgreSQL 17.5** databases using the pinned `pglite-pg17` alias (`@electric-sql/pglite@0.3.16`). It accepts no database URL or cloud credentials. The separate lockfile keeps test tooling outside the application workspace/dependencies. `@electric-sql/pglite@0.5.8` satisfies the pgTAP package's declared peer dependency; the executing engine is the explicit PG17 alias. The pgTAP extension bundle contains SQL/control files, and its installation and all tests are verified on that engine.

Each cycle applies the original migrations unchanged. Immediately before the hardening migration it seeds the original schema, reproduces the prior identity exposures and pagination cap, then rolls back those synthetic probes. It applies the hardening migration, seeds again, and executes **every** SQL test in `supabase/tests`, requiring a matching pgTAP plan and zero failed assertions. Test files retain their own transaction/rollback boundaries. Any failure makes the command exit nonzero.

`bootstrap.sql` supplies only the platform objects needed by these migrations: roles, `auth.users`, `auth.identities`, `auth.uid()`, storage metadata and its path helper. Its public-schema default privileges match the staging project's `pg_default_acl`, checked read-only on 2026-09-11: tables, sequences and functions grant to anon/authenticated/service_role. This matters for detecting inherited permissions. An early run without those defaults failed the existing audit-chain test; the fixture was corrected, without changing the test or product permissions.

These are real PostgreSQL privilege/RLS/PLpgSQL/trigger tests under `SET ROLE`, with real pgcrypto and pgTAP extensions. They do **not** run GoTrue, PostgREST, Storage signing, a browser, or multiple concurrent PostgreSQL connections. They do not validate JWT signatures, Vercel environment variables, remote deployment state or end-to-end Supabase HTTP behavior. Staging is PostgreSQL 17.6; this harness is 17.5 compiled to WASM. A PG18.3 exploratory run also passed, but the committed default uses PG17.

The web route tests separately cover denial before signing, expiration during signing, denial after a DB recheck, changed assets and dependency failures. Finalization races after the last authorization check and URLs already handed to a client retain the documented five-minute signed-URL limitation.
