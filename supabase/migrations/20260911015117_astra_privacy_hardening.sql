-- A-01: private identity rows stay owner-only, including membership UUIDs.
drop policy if exists "profiles select active public" on public.profiles;
drop policy if exists "memberships select active public" on public.memberships;

create or replace function public.list_active_members(
  p_limit integer default 50,
  p_cursor bigint default null
)
returns table (member_number bigint, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.member_number, p.created_at
  from public.profiles p
  where auth.uid() is not null
    and public.is_active_member(auth.uid())
    and p.membership_status = 'active'
    and p.member_number is not null
    and (p_cursor is null or p.member_number > p_cursor)
  order by p.member_number
  limit least(greatest(p_limit, 1), 51);
$$;

revoke all on function public.list_active_members(integer, bigint) from public, anon, authenticated;
grant execute on function public.list_active_members(integer, bigint) to authenticated;

-- A-02: use caller RLS for the existing ownership helper.
-- Own application checks and service_role retain their existing behavior.
alter function public.is_application_owner(uuid, uuid) security invoker;

-- Return-type changes require replacement; no CASCADE and no legacy leaky RPC.
drop function public.cast_vote_tx(uuid, text);

create or replace function public.cast_vote_tx(
  p_vote_id uuid,
  p_choice text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_voter_id uuid := auth.uid();
  v_vote public.admission_votes%rowtype;
begin
  if v_voter_id is null then
    raise exception 'authenticated voter required' using errcode = '42501';
  end if;

  if p_choice not in ('yes', 'no') then
    raise exception 'invalid vote choice' using errcode = 'P0001';
  end if;

  if not public.is_active_member(v_voter_id) then
    raise exception 'active membership required' using errcode = '42501';
  end if;

  select *
    into v_vote
  from public.admission_votes
  where id = p_vote_id
  for update;

  if not found then
    raise exception 'vote not found' using errcode = 'P0002';
  end if;

  if v_vote.status != 'open' or v_vote.window_ends_at <= now() then
    raise exception 'vote is not open' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.admission_applications app
    where app.id = v_vote.application_id
      and app.status = 'in_vote'
  ) then
    raise exception 'application is not in vote' using errcode = 'P0001';
  end if;

  insert into public.admission_vote_turnout (
    vote_id,
    application_id,
    voter_id
  )
  values (
    p_vote_id,
    v_vote.application_id,
    v_voter_id
  );

  insert into public.admission_vote_ballots (
    vote_id,
    choice
  )
  values (
    p_vote_id,
    p_choice
  );

  return;
exception
  when unique_violation then
    raise exception 'voter already cast a ballot' using errcode = '23505';
end;
$$;

revoke all on function public.cast_vote_tx(uuid, text) from public, anon, authenticated;
grant execute on function public.cast_vote_tx(uuid, text) to authenticated;

-- A-04: the web accepts 50 rows and needs one extra to determine nextCursor.
create or replace function public.list_open_admission_votes(
  p_limit integer default 20,
  p_cursor_opened_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  id uuid,
  candidate_token text,
  applicant_statement text,
  has_clip boolean,
  window_ends_at timestamptz,
  opened_at timestamptz,
  has_voted boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    vote.id,
    'candidate-' || pg_catalog.left(vote.id::text, 8),
    app.applicant_statement,
    app.persona_clip_asset_id is not null,
    vote.window_ends_at,
    vote.opened_at,
    exists (
      select 1
      from public.admission_vote_turnout turnout
      where turnout.vote_id = vote.id
        and turnout.voter_id = auth.uid()
    ) as has_voted
  from public.admission_votes vote
  join public.admission_applications app on app.id = vote.application_id
  where public.is_active_member(auth.uid())
    and vote.status = 'open'
    and vote.window_ends_at > now()
    and app.status = 'in_vote'
    and (
      p_cursor_opened_at is null
      or vote.opened_at < p_cursor_opened_at
      or (
        vote.opened_at = p_cursor_opened_at
        and vote.id < p_cursor_id
      )
    )
  order by vote.opened_at desc, vote.id desc
  limit least(greatest(p_limit, 1), 51);
$$;

-- A-03: service-only authorization; never expose applicant/asset IDs to members.
-- Lock order matches finalize/override: vote, then application. Use actual time
-- after lock acquisition, rather than the transaction's start timestamp.
create or replace function public.authorize_admission_vote_clip(
  p_vote_id uuid,
  p_voter_id uuid,
  p_record_access boolean default true
)
returns table (asset_id uuid, window_ends_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vote public.admission_votes%rowtype;
  v_app public.admission_applications%rowtype;
  v_now timestamptz;
begin
  select * into v_vote
  from public.admission_votes
  where id = p_vote_id
  for update;
  if not found then return; end if;

  select * into v_app
  from public.admission_applications
  where id = v_vote.application_id
  for share;
  if not found then return; end if;

  v_now := clock_timestamp();
  if p_voter_id is null
    or not public.is_active_member(p_voter_id)
    or not exists (
      select 1 from public.memberships m
      where m.user_id = p_voter_id and m.status = 'active'
    )
    or v_vote.status <> 'open'
    or v_vote.window_ends_at <= v_now
    or v_app.status <> 'in_vote'
    or v_app.persona_clip_asset_id is null
  then return; end if;

  if p_record_access then
    insert into public.admission_vote_clip_accesses (
      vote_id, voter_id, issued_at, expires_at
    ) values (
      p_vote_id, p_voter_id, v_now, v_now + interval '5 minutes'
    );
  end if;

  return query select v_app.persona_clip_asset_id, v_vote.window_ends_at;
end;
$$;

revoke all on function public.authorize_admission_vote_clip(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.authorize_admission_vote_clip(uuid, uuid, boolean)
  to service_role;
