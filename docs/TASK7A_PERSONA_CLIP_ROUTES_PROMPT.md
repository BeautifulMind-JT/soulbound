# Task 7a — Persona Clip routes + StoragePort upload (security) — spec + Codex builder prompt

> First slice of Task 7 (JT chose the 7a/7b split). **7a = the security layer**: the persona-clip create/delete
> route, the reviewer signed-URL route, and the signed-upload-URL capability on the storage adapter + the apps/web
> storage wiring. **7b = the recorder UI** (GLM, separate). Gate = route-handler integration tests (deterministic,
> reusing the 6a/6b bounded-auth-retry + throwaway-applicant pattern).
>
> **Architecture decision (Cowork, this round):** JT's frozen Persona Clip design stores bytes in private storage
> during review and lets the reviewer PLAY the clip, but the frozen `StoragePort` (`put`/`getSignedUrl`/
> `markForDeletion`) has no byte-upload path and the recorder must not call `supabase.storage` (INV-PC-05). So 7a
> adds a **signed UPLOAD URL** capability to **`SupabaseStorageAdapter` (packages/adapters — NOT frozen)**; the
> recorder will `fetch`-PUT the blob to that URL (no Supabase SDK → INV-PC-05 + audit OK). **`packages/core`
> StoragePort stays frozen-untouched** (P0 is single-provider per its own comment; absorb into the port when a 2nd
> provider arrives). This is symmetric to the signed-READ-url JT endorsed.
>
> **Workflow:** storage boundary / retention / authz = security layer → **Codex builds**, **Opus audits**
> (separate), **JT commits**. Builder does not self-approve.

---

## 0. Grounded contract (verified from the working tree at HEAD `e019cc6` — NOT memory)

- **Frozen `StoragePort`** = `put(PutEvidenceInput)→EvidenceReceipt`, `getSignedUrl(evidenceId)→string` (5-min TTL),
  `markForDeletion(evidenceId)→void` (`ports/storage-port.ts`, `domain/storage/types.ts`). `SupabaseStorageAdapter`
  (Task 4) implements them: `put` inserts a `persona_clip_assets` row (metadata only), `getSignedUrl` issues a
  5-min signed READ url for `storage_path`, `markForDeletion` sets `delete_after`+`deletion_reason`. **Do NOT edit
  `packages/core/src`** — add the upload method to the ADAPTER only.
- **`persona_clip_assets`** (`0002`): `id, applicant_id, application_id, storage_provider, storage_path,
  content_hash, mime_type, size_bytes, duration_seconds, status('draft'|'attached'|'deleted'),
  deletion_reason, delete_after, created_at, deleted_at`. **RLS (`0003`)**: `authenticated` may `select/insert/
  delete` OWN rows (insert-own / select-own / delete-own policies, `applicant_id = auth.uid()`). **Storage (`0005`)**:
  bucket `persona-clips` is **private**; `authenticated` may insert/select/delete objects only under their own
  path (`auth.uid()::text = (storage.foldername(name))[1]`). `buildObjectPath = {ownerId}/{contentHash}` → the
  owner folder = the applicant uid, so a USER-scoped client can issue/upload to its own path.
- **Retention is already wired** — `approve`/`reject` rpcs (`0004`) set `delete_after=now()` +
  `deletion_reason='application_approved'|'application_rejected'` on the clip. The actual Storage byte-delete worker
  is **Task 9**. So 7a adds NO retention marking.
- **INV-PC invariants (frozen, BuildPlan):** PC-01 absence never blocks submit; PC-05 storage access only via
  StoragePort/adapter (no `supabase.storage` anywhere in `apps/`); PC-06 `storage_path` / signed-URL / raw bytes /
  transcript / summary appear in `audit_logs` / `outbox_events` / logs / analytics / reviewer-notes = **0**
  (only `persona_clip_asset_id`/`content_hash`/`status`/`deletion_reason`/`deleted_at`/`policy_version` allowed);
  PC-08 clip read = applicant(own) + authorized reviewer/admin only (member/anon = 0). Routes from BuildPlan §4.2.

---

## 1. COPY-PASTE PROMPT (paste into the Codex builder)

```text
Codex Task 7a — Persona Clip routes + signed-upload adapter (security). Implement ONLY this; do NOT build the
recorder UI (7b), the storage delete worker (Task 9), or any other UI.

Read first: packages/core/src/ports/storage-port.ts + domain/storage/types.ts (FROZEN — do not edit),
packages/adapters/src/supabase/supabase-storage-adapter.ts (+mappers), supabase/migrations 0002/0003/0005,
apps/web/app/api/_lib/{auth,http,admin,container}.ts, and the 6a/6b integration tests (reuse their bounded
auth-retry + throwaway-applicant pattern).

A) Adapter (packages/adapters/src/supabase/supabase-storage-adapter.ts) — ADD a signed-upload capability; do NOT
   change the frozen StoragePort interface in packages/core:
   - createUploadUrl(input: { ownerId, contentHash, mimeType, durationSeconds? }):
       Promise<{ assetId: string; uploadUrl: string; path: string }>
     -> insert a DRAFT persona_clip_assets row (applicant_id=ownerId, storage_path={ownerId}/{contentHash},
        content_hash, mime_type, status='draft'); call this.client.storage.from('persona-clips')
        .createSignedUploadUrl(path) (short TTL); return { assetId=row.id, uploadUrl, path }.
   - Export it via the make* factory's concrete type (or a small adapters-local interface) so apps/web can call it.
   - The recorder will PUT the blob to uploadUrl by plain fetch — the adapter NEVER returns raw bytes, and no
     storage_path / signed url is logged.

B) apps/web storage helpers (app/api/_lib/storage.ts):
   - userScopedStorageAdapter(request): makeSupabaseStorageAdapter(<user client from the request session>) — for
     applicant create/delete (RLS enforces own path/own row).
   - serviceRoleStorageAdapter(): makeSupabaseStorageAdapter(createServiceRoleSupabaseClient(env)) — for the
     reviewer read-url (reviewer reads any application's clip; route-gated). Server-only key (INV-17).

C) Routes:
   - POST api/admission/persona-clip: resolveActor->401; zod body { contentHash, mimeType, durationSeconds? };
     ownerId = actor.id (NEVER from body); userScopedStorageAdapter(req).createUploadUrl({ownerId, ...}); 200
     { assetId, uploadUrl }. (The recorder uploads to uploadUrl, then references assetId in submitApplication.)
   - DELETE api/admission/persona-clip?assetId=...: resolveActor->401; mark the caller's OWN draft clip for
     deletion (markForDeletion) — own-only (user-scoped RLS or verify applicant_id=actor.id); 200/404.
   - GET api/admin/applications/[id]/persona-clip-url: resolveActor->401; requireReviewer->403; load the
     application (service-role admission repo) -> if no persona_clip_asset_id, 404; serviceRoleStorageAdapter()
     .getSignedUrl(assetId) -> 200 { url } (short TTL). Return the url in the RESPONSE only — NEVER log it, NEVER
     write it/the storage_path to audit_logs/outbox (INV-PC-06).

D) Gate — route-handler integration tests (live Supabase, deterministic 5x+reset, fail-loud, reuse 6a/6b fixtures):
   - applicant POST persona-clip -> 200 {assetId, uploadUrl}; fetch-PUT a tiny blob to uploadUrl -> 2xx;
   - applicant submitApplication with personaClipAssetId=assetId (+personaClipHash=contentHash) -> 201;
   - reviewer (seeded) startReview; reviewer GET persona-clip-url -> 200 {url}; fetch(url) -> 2xx and returns the
     uploaded bytes (proves upload->store->reviewer-read end to end);
   - applicant GET persona-clip-url -> 403; non-owner cannot create a clip as someone else (ownerId=actor);
   - INV-PC-06: after the flow + an approve, assert (service-role query) that audit_logs.metadata and outbox_events
     contain NO storage_path and NO signed-url substring (only asset_id/hash/status/deletion_reason/etc.);
   - INV-PC-01: submitApplication with NO clip -> 201 (absence never blocks);
   - retention: after approve, the clip row has delete_after set + deletion_reason='application_approved'
     (already done by the rpc — assert it holds through this path).

FORBIDDEN (violation = redo):
 - editing packages/core/src/** (StoragePort/types stay frozen) or supabase/** (RLS/storage already exist);
 - any supabase.storage usage in apps/web (must go through the adapter — INV-PC-05; audit greps apps for it);
 - writing storage_path / signed url / raw bytes / transcript / summary into audit_logs / outbox / logs (INV-PC-06);
 - trusting a body-supplied ownerId/applicant; exposing the service-role key as NEXT_PUBLIC_*;
 - building the recorder UI (7b), the delete worker (Task 9), upload fallback / preview / retake / edit (INV-PC-02/04);
 - weakening assertions; skip/todo/only; silent skip.

ACCEPTANCE (report each verbatim):
 - `supabase db reset` then `supabase test db` -> 49 pgTAP green (unchanged);
 - `supabase start`, then apps/web `test:integration` -> 7a cases green; 5x consecutive + once after `db reset`;
 - apps/web `test` unit green stack-free; adapters test green (incl. any new createUploadUrl unit test); core test 19 unchanged;
 - `pnpm -r typecheck` clean; `pnpm -r build` ok; `bash scripts/audit.sh` PASS with `.next` present
   (esp. "persona clip: no supabase.storage in apps" still OK);
 - `git status --short` shows ONLY apps/web/** and packages/adapters/src/supabase/** (adapter + its test);
 - `git diff --stat packages/core/src supabase` empty.
STOP and report. Do not self-approve — the Opus audit session audits (separate), JT commits.
```

---

## 2. Dispatch + commit (JT, host)
1. Commit this prompt doc: `docs: add Task 7a persona-clip routes builder prompt`.
2. Paste §1 into Codex. Codex builds the adapter method + storage helpers + 3 routes + tests, runs the gates, STOPS.
3. Opus audit (separate): `packages/core` StoragePort untouched (frozen); NO `supabase.storage` anywhere in apps;
   storage_path/signed-url NEVER in audit/outbox/logs (INV-PC-06 — the make-or-break data-minimization check);
   ownerId from actor not body; reviewer read-url gated by requireReviewer + applicant→403; absence never blocks
   submit (PC-01); upload→store→reviewer-read proven; integration deterministic (5x+reset on host) + fail-loud.
4. On PASS, JT commits: `feat(web): Task 7a persona-clip routes + signed-upload adapter` → `docs: record Task 7a
   audit pass`. Then **Task 7b** (GLM): the in-app `persona-clip-recorder` component (record → POST persona-clip →
   PUT blob to uploadUrl → pass assetId to apply). 

## 3. Out of scope (explicit)
- The recorder component = **7b (GLM)**. The Storage byte-delete worker = **Task 9**. Withdraw/expire workers = later.
- Editing the frozen StoragePort interface (kept in adapters for P0). No upload fallback/preview/retake/edit (INV-PC-02/04).
