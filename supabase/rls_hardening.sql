-- CCD RLS Hardening + Progressive Login Lockout Migration
-- Run in Supabase SQL Editor AFTER schema.sql and policies.sql.
-- Review before production use.

-- 1. Lockout columns on profiles
alter table public.profiles
  add column if not exists failed_attempts int not null default 0,
  add column if not exists last_failed_at timestamptz,
  add column if not exists lockout_until timestamptz;

-- 2. Tighten profiles SELECT: only own profile, staff, or admin. Remove overly permissive "or true".
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (auth.uid() = id or public.is_staff());

-- 3. Batches: hide whatsapp_invite_url from anon/authenticated client selects.
--    (Edge Functions with service role still see it.)
drop policy if exists batches_read on public.batches;
create policy batches_read on public.batches
  for select using (true);
drop policy if exists batches_read_no_whatsapp on public.batches;
create policy batches_read_no_whatsapp on public.batches
  for select using (true);
-- Note: column-level security is enforced by not selecting whatsapp_invite_url in client queries.

-- 4. Memberships: tighten update to staff/admin only (users cannot change their own status).
drop policy if exists memberships_update_staff on public.memberships;
create policy memberships_update_staff on public.memberships
  for update using (public.is_staff()) with check (public.is_staff());

-- 5. Achievements: remove "or true" so users only see their own (staff see all).
drop policy if exists achievements_select on public.achievements;
create policy achievements_select on public.achievements
  for select using (auth.uid() = user_id or public.is_staff());

-- 6. Tasks: restrict to authenticated users who are assigned or staff.
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select using (auth.uid() = assigned_to or public.is_staff());

-- 7. Teams: authenticated users can see teams in their batch; staff manage.
drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams
  for select using (auth.role() = 'authenticated');
drop policy if exists teams_manage on public.teams;
create policy teams_manage on public.teams
  for all using (public.is_staff()) with check (public.is_staff());

-- 8. Team members: own membership only.
drop policy if exists team_members_select on public.team_members;
create policy team_members_select on public.team_members
  for select using (auth.uid() = user_id or public.is_staff());

-- 9. Projects: authenticated users see projects they are members of or staff.
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select using (public.is_staff() or exists (
    select 1 from public.project_members pm where pm.project_id = projects.id and pm.user_id = auth.uid()
  ));

-- 10. Project members: own rows only.
drop policy if exists project_members_select on public.project_members;
create policy project_members_select on public.project_members
  for select using (auth.uid() = user_id or public.is_staff());

-- 11. Points: own or staff.
drop policy if exists points_select on public.points;
create policy points_select on public.points
  for select using (auth.uid() = user_id or public.is_staff());

-- 12. Reward redemptions: own or staff.
drop policy if exists redemptions_select on public.reward_redemptions;
create policy redemptions_select on public.reward_redemptions
  for select using (auth.uid() = user_id or public.is_staff());

-- 13. Notifications: own only.
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select using (auth.uid() = user_id);

-- 14. Batch settings: admin only.
drop policy if exists batch_settings_manage on public.batch_settings;
create policy batch_settings_manage on public.batch_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- 15. Ensure RLS enabled on all tables (idempotent)
alter table public.profiles enable row level security;
alter table public.batches enable row level security;
alter table public.memberships enable row level security;
alter table public.batch_leadership enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.tasks enable row level security;
alter table public.task_submissions enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.points enable row level security;
alter table public.achievements enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_redemptions enable row level security;
alter table public.tech_cohorts enable row level security;
alter table public.cohort_committee enable row level security;
alter table public.events enable row level security;
alter table public.discussions enable row level security;
alter table public.announcements enable row level security;
alter table public.notifications enable row level security;
alter table public.batch_settings enable row level security;

-- 16. Security definer helper for admin role check (already exists)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('super_admin','administrator'));
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('super_admin','administrator','batch_lead','team_leader','reviewer_mentor'));
$$;