import assert from 'node:assert/strict';

// Negative control: prove the inherited exposures and 50-row cap exist before
// the hardening migration. All synthetic data is rolled back before migration.
export async function checkBaseline(db) {
  await db.exec(`begin;
    insert into public.memberships(user_id,status,tier)
      values('a0000000-0000-0000-0000-000000000002','active','basic');
    insert into public.admission_applications(id,applicant_id,status,policy_version)
      values('dd000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000003','rejected','fixture');
    do $$ declare i integer; u uuid; a uuid; begin
      for i in 1..51 loop
        u := ('de000000-0000-0000-0000-' || lpad(i::text,12,'0'))::uuid;
        a := ('df000000-0000-0000-0000-' || lpad(i::text,12,'0'))::uuid;
        insert into auth.users(id,email,raw_user_meta_data)
          values(u,'baseline' || i || '@soulbound.internal',jsonb_build_object('username','baseline_' || i));
        insert into public.admission_applications(id,applicant_id,status,policy_version)
          values(a,u,'in_vote','fixture');
        insert into public.admission_votes(application_id,opened_by,window_ends_at,idempotency_key)
          values(a,'a0000000-0000-0000-0000-000000000001',clock_timestamp()+interval '1 hour','baseline-' || i);
      end loop;
    end; $$;
    set local role authenticated;
    select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
  `);
  const { rows: [row] } = await db.query(`select
    (select count(*)::int from public.profiles where id='a0000000-0000-0000-0000-000000000002') as foreign_profiles,
    (select count(*)::int from public.memberships where user_id='a0000000-0000-0000-0000-000000000002') as foreign_memberships,
    public.is_application_owner('dd000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000003') as foreign_ownership,
    pg_get_function_result('public.cast_vote_tx(uuid,text)'::regprocedure) as cast_return_type,
    (select count(*)::int from public.list_open_admission_votes(51)) as lookahead_rows
  `);
  assert.deepEqual(row, {
    foreign_profiles: 1, foreign_memberships: 1, foreign_ownership: true,
    cast_return_type: 'admission_votes', lookahead_rows: 50,
  });
  await db.exec('rollback;');
  console.log(`baseline vulnerabilities reproduced: ${JSON.stringify(row)}`);
}
