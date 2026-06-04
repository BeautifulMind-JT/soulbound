insert into auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  role,
  raw_app_meta_data,
  raw_user_meta_data
)
values
  (
    'a0000000-0000-0000-0000-000000000001',
    'admin@soulbound.local',
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(),
    'authenticated',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'reviewer@soulbound.local',
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(),
    'authenticated',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'applicant@soulbound.local',
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(),
    'authenticated',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb
  )
on conflict (id) do nothing;

insert into public.profiles (
  id,
  handle,
  display_name,
  bio,
  role,
  membership_status
)
values
  (
    'a0000000-0000-0000-0000-000000000001',
    'admin',
    'Admin User',
    'System administrator',
    'admin',
    'active'
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'reviewer',
    'Reviewer User',
    'Application reviewer',
    'reviewer',
    'active'
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'applicant',
    'Applicant User',
    'Membership applicant',
    'applicant',
    'none'
  )
on conflict (id) do nothing;
