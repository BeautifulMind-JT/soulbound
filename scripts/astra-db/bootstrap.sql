-- Test-only Supabase platform fixtures for an in-memory PostgreSQL database.
-- This is not the Auth/Storage service, nor a replacement for their integration tests.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema storage;
create schema extensions;
grant usage on schema auth, storage, extensions to anon, authenticated, service_role;

-- Match the staging project's pg_default_acl (read-only catalog check 2026-09-11).
-- Migrations must revoke these inherited grants explicitly; omitting them would
-- hide accidental Data API exposure and misrepresent service_role permissions.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key,
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  confirmation_token text,
  recovery_token text,
  email_change text,
  email_change_token_new text,
  aud text,
  role text,
  instance_id uuid,
  raw_app_meta_data jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table auth.identities (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade,
  provider_id text,
  provider text,
  identity_data jsonb,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  unique(provider_id, provider)
);
create function auth.uid() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid;
$$;
create table storage.buckets (
  id text primary key,
  name text,
  public boolean,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated;
grant all on all tables in schema storage to service_role;
create function storage.foldername(name text) returns text[]
language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1)-1];
$$;
