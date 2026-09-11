create extension if not exists pgtap with schema extensions;
begin;
set search_path = public, extensions;
select no_plan();

create function pg_temp.astra_user(p_id uuid, p_name text, p_number bigint default null)
returns void language plpgsql as $$
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (p_id, p_name || '@soulbound.internal', jsonb_build_object('username', p_name));
  update public.profiles set member_number = p_number,
    handle = p_name, display_name = p_name, bio = 'private persona',
    membership_status = case when p_number is null then 'none' else 'active' end,
    role = case when p_number is null then 'applicant' else 'member' end
  where id = p_id;
  if p_number is not null then
    insert into public.memberships(user_id, status, tier) values (p_id, 'active', 'basic');
  end if;
end;
$$;
create function pg_temp.astra_sqlstate(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return '00000';
exception when others then return sqlstate;
end;
$$;

select pg_temp.astra_user('c9000000-0000-0000-0000-000000000001', 'astra_member_a', 99001);
select pg_temp.astra_user('c9000000-0000-0000-0000-000000000002', 'astra_member_b', 99002);
select pg_temp.astra_user('c9000000-0000-0000-0000-000000000003', 'astra_applicant');
insert into public.admission_applications(id, applicant_id, status, policy_version)
values ('c9100000-0000-0000-0000-000000000001', 'c9000000-0000-0000-0000-000000000003', 'in_vote', 'phase1-v0.95');
insert into public.persona_clip_assets(id, applicant_id, application_id, storage_path, content_hash, mime_type, size_bytes)
values ('c9200000-0000-0000-0000-000000000001', 'c9000000-0000-0000-0000-000000000003',
  'c9100000-0000-0000-0000-000000000001', 'fixture/clip', 'fixture-hash', 'video/webm', 1);
update public.admission_applications set persona_clip_asset_id = 'c9200000-0000-0000-0000-000000000001'
where id = 'c9100000-0000-0000-0000-000000000001';
insert into public.admission_votes(id, application_id, opened_by, window_ends_at, idempotency_key)
values ('c9300000-0000-0000-0000-000000000001', 'c9100000-0000-0000-0000-000000000001',
  'c9000000-0000-0000-0000-000000000001', clock_timestamp() + interval '1 hour', 'astra-fixture-vote');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c9000000-0000-0000-0000-000000000001', true);
select is((select count(*)::int from public.profiles where id = 'c9000000-0000-0000-0000-000000000002'), 0,
  'active member cannot select another profile UUID or persona');
select is((select count(*)::int from public.profiles where id = auth.uid()), 1, 'own profile remains readable');
select is((select member_number from public.profiles where id = auth.uid()), 99001::bigint, 'own member number remains readable');
select lives_ok($$update public.profiles set bio = 'own edited bio' where id = auth.uid()$$, 'own safe profile update remains allowed');
select is((select count(*)::int from public.memberships where user_id = 'c9000000-0000-0000-0000-000000000002'), 0,
  'active member cannot select another membership UUID or issuance time');
select is((select count(*)::int from public.memberships where user_id = auth.uid()), 1, 'own membership remains readable');
select is(public.current_user_role(), 'member', 'server-owned role resolution is unchanged');
select is(public.is_application_owner('c9100000-0000-0000-0000-000000000001', 'c9000000-0000-0000-0000-000000000003'), false,
  'ownership RPC does not answer third-party ownership questions');
select is((select count(*)::int from public.list_active_members(51, 99000)), 2, 'active member can read the anonymous directory');
select is((select array_agg(member_number) from public.list_active_members(51, 99001)), array[99002::bigint], 'directory cursor excludes earlier members');
select is((select array_agg(k order by k) from jsonb_object_keys((select to_jsonb(m) from public.list_active_members(1, 99000) m)) k),
  array['created_at','member_number']::text[], 'directory RPC exposes exactly the public projection');
select is(pg_temp.astra_sqlstate('select id from public.list_active_members()'), '42703', 'directory cannot project a hidden UUID');
select is(pg_temp.astra_sqlstate('select username from public.profiles where id = auth.uid()'), '42501', 'username SELECT grant is not broadened');
select is(pg_temp.astra_sqlstate('select * from public.admission_votes'), '42501', 'vote table is still inaccessible to members');
select is(pg_temp.astra_sqlstate($$select * from public.authorize_admission_vote_clip('c9300000-0000-0000-0000-000000000001', auth.uid())$$),
  '42501', 'member cannot call service-only clip authorization with an arbitrary voter');
select is(pg_typeof(public.cast_vote_tx('c9300000-0000-0000-0000-000000000001', 'yes'))::text, 'void',
  'successful direct cast RPC returns no application, operator or idempotency fields');
select is(pg_temp.astra_sqlstate($$select public.cast_vote_tx('c9300000-0000-0000-0000-000000000001', 'no')$$),
  '23505', 'duplicate vote is still rejected');

select set_config('request.jwt.claim.sub', 'c9000000-0000-0000-0000-000000000003', true);
select is(public.is_application_owner('c9100000-0000-0000-0000-000000000001', auth.uid()), true, 'applicant can still check own application ownership');
select is((select count(*)::int from public.list_active_members()), 0, 'nonmember cannot read directory');
select is(pg_temp.astra_sqlstate($$select public.cast_vote_tx('c9300000-0000-0000-0000-000000000001', 'yes')$$), '42501', 'nonmember cannot cast a vote');
select set_config('request.jwt.claim.sub', '', true);
select is((select count(*)::int from public.list_active_members()), 0, 'authenticated role without a subject sees no directory');
reset role;
set local role anon;
select is(pg_temp.astra_sqlstate('select * from public.list_active_members()'), '42501', 'anon cannot execute directory RPC');
select is(pg_temp.astra_sqlstate($$select public.cast_vote_tx('c9300000-0000-0000-0000-000000000001', 'yes')$$), '42501', 'anon cannot execute vote RPC');
select is(pg_temp.astra_sqlstate($$select * from public.authorize_admission_vote_clip('c9300000-0000-0000-0000-000000000001', 'c9000000-0000-0000-0000-000000000001')$$),
  '42501', 'anon cannot execute clip authorization RPC');
reset role;
select is((select count(*)::int from public.admission_vote_turnout where vote_id = 'c9300000-0000-0000-0000-000000000001'), 1, 'valid vote records one turnout');
select is((select count(*)::int from public.admission_vote_ballots where vote_id = 'c9300000-0000-0000-0000-000000000001'), 1, 'valid vote records one ballot atomically');

set local role service_role;
select is(public.is_application_owner('c9100000-0000-0000-0000-000000000001', 'c9000000-0000-0000-0000-000000000003'), true, 'service role retains ownership lookup');
select is((select count(*)::int from public.authorize_admission_vote_clip('c9300000-0000-0000-0000-000000000001', 'c9000000-0000-0000-0000-000000000001')), 1, 'eligible clip access is authorized');
select is((select count(*)::int from public.admission_vote_clip_accesses where vote_id = 'c9300000-0000-0000-0000-000000000001'), 1, 'authorization records one access');
select is((select count(*)::int from public.authorize_admission_vote_clip('c9300000-0000-0000-0000-000000000001', 'c9000000-0000-0000-0000-000000000001', false)), 1, 'post-signing recheck succeeds while eligible');
select is((select count(*)::int from public.admission_vote_clip_accesses where vote_id = 'c9300000-0000-0000-0000-000000000001'), 1, 'post-signing recheck does not duplicate access records');

update public.admission_votes set window_ends_at = clock_timestamp() - interval '1 second' where id = 'c9300000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.authorize_admission_vote_clip('c9300000-0000-0000-0000-000000000001', 'c9000000-0000-0000-0000-000000000001')), 0,
  'expired but unfinalized open vote cannot issue clip access');
select is((select count(*)::int from public.admission_vote_clip_accesses where vote_id = 'c9300000-0000-0000-0000-000000000001'), 1, 'expired request creates no access record');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c9000000-0000-0000-0000-000000000002', true);
select is(pg_temp.astra_sqlstate($$select public.cast_vote_tx('c9300000-0000-0000-0000-000000000001', 'yes')$$), 'P0001', 'expired voting is still rejected');
reset role;
set local role service_role;
update public.admission_votes set window_ends_at = clock_timestamp() + interval '1 hour', status = 'closed' where id = 'c9300000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.authorize_admission_vote_clip('c9300000-0000-0000-0000-000000000001', 'c9000000-0000-0000-0000-000000000001', false)), 0, 'closed vote fails post-signing recheck');
update public.admission_votes set status = 'open' where id = 'c9300000-0000-0000-0000-000000000001';
update public.admission_applications set status = 'rejected' where id = 'c9100000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.authorize_admission_vote_clip('c9300000-0000-0000-0000-000000000001', 'c9000000-0000-0000-0000-000000000001', false)), 0, 'terminal application fails post-signing recheck');
update public.admission_applications set status = 'in_vote', persona_clip_asset_id = null where id = 'c9100000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.authorize_admission_vote_clip('c9300000-0000-0000-0000-000000000001', 'c9000000-0000-0000-0000-000000000001')), 0, 'missing clip cannot authorize access');
update public.admission_applications set persona_clip_asset_id = 'c9200000-0000-0000-0000-000000000001' where id = 'c9100000-0000-0000-0000-000000000001';
update public.profiles set membership_status = 'revoked' where id = 'c9000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.authorize_admission_vote_clip('c9300000-0000-0000-0000-000000000001', 'c9000000-0000-0000-0000-000000000001', false)), 0, 'revoked profile fails post-signing recheck');
update public.profiles set membership_status = 'active' where id = 'c9000000-0000-0000-0000-000000000001';
update public.memberships set status = 'revoked' where user_id = 'c9000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.authorize_admission_vote_clip('c9300000-0000-0000-0000-000000000001', 'c9000000-0000-0000-0000-000000000001', false)), 0, 'revoked membership fails post-signing recheck');
select is((select count(*)::int from public.admission_vote_clip_accesses where vote_id = 'c9300000-0000-0000-0000-000000000001'), 1, 'denials and rechecks leave access count unchanged');
reset role;

-- Isolate the maximum-size pagination case from seed/existing votes.
update public.admission_votes set status = 'closed' where status = 'open';
do $$
declare i integer; u uuid; a uuid;
begin
  for i in 1..51 loop
    u := ('ca000000-0000-0000-0000-' || lpad(i::text,12,'0'))::uuid;
    a := ('cb000000-0000-0000-0000-' || lpad(i::text,12,'0'))::uuid;
    perform pg_temp.astra_user(u, 'astra_candidate_' || i);
    insert into public.admission_applications(id, applicant_id, status, policy_version)
      values(a,u,'in_vote','phase1-v0.95');
    insert into public.admission_votes(id,application_id,opened_by,window_ends_at,opened_at,idempotency_key)
      values(('cc000000-0000-0000-0000-' || lpad(i::text,12,'0'))::uuid,a,
        'c9000000-0000-0000-0000-000000000002',clock_timestamp()+interval '1 hour',
        '2026-09-11T00:00:00Z','astra-page-' || i);
  end loop;
end;
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c9000000-0000-0000-0000-000000000002', true);
select is((select count(*)::int from public.list_open_admission_votes(51)), 51, 'maximum page can request the 51st lookahead vote');
select is((select count(*)::int from public.list_open_admission_votes(1000)), 51, 'direct RPC still has a bounded maximum');
select is((select array_agg(id) from public.list_open_admission_votes(51,'2026-09-11T00:00:00Z','cc000000-0000-0000-0000-000000000002')),
  array['cc000000-0000-0000-0000-000000000001'::uuid], 'cursor after first 50 rows returns the remaining vote');
reset role;

select is((select count(*)::int from pg_policies where schemaname='public' and tablename in ('profiles','memberships') and policyname like '%active public'), 0,
  'no inherited public identity-row policy remains');
select is((select prosecdef from pg_proc where oid='public.is_application_owner(uuid,uuid)'::regprocedure), false, 'ownership helper uses invoker privileges');
select is((select proconfig from pg_proc where oid='public.authorize_admission_vote_clip(uuid,uuid,boolean)'::regprocedure), array['search_path=""']::text[], 'clip definer uses an empty search path');
select * from finish();
rollback;
