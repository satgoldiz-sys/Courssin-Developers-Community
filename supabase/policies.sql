-- CCD RLS Policies (Phase 2+). Run after schema.sql.
-- IMPORTANT: review and test with your auth roles before production.

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

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('super_admin','administrator'));
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('super_admin','administrator','batch_lead','team_leader','reviewer_mentor'));
$$;

-- Profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (auth.uid() = id or public.is_staff() or true); -- adjust to restrict public fields
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update using (auth.uid() = id or public.is_admin()) with check (auth.uid() = id or public.is_admin());

-- Batches: readable; admin-managed. WhatsApp URL should be fetched via Edge Function; avoid selecting it in public client queries.
drop policy if exists batches_read on public.batches;
create policy batches_read on public.batches for select using (true);
drop policy if exists batches_admin_write on public.batches;
create policy batches_admin_write on public.batches for all using (public.is_admin()) with check (public.is_admin());

-- Memberships
drop policy if exists memberships_select on public.memberships;
create policy memberships_select on public.memberships for select using (auth.uid() = user_id or public.is_staff());
drop policy if exists memberships_insert_self on public.memberships;
create policy memberships_insert_self on public.memberships for insert with check (auth.uid() = user_id);
drop policy if exists memberships_update_staff on public.memberships;
create policy memberships_update_staff on public.memberships for update using (auth.uid() = user_id or public.is_staff()) with check (auth.uid() = user_id or public.is_staff());

-- Admin-managed tables
drop policy if exists admin_all_leadership on public.batch_leadership;
create policy admin_all_leadership on public.batch_leadership for all using (public.is_admin() or public.is_staff()) with check (public.is_admin() or public.is_staff());
drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams for select using (auth.role() = 'authenticated');
drop policy if exists teams_manage on public.teams;
create policy teams_manage on public.teams for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists team_members_select on public.team_members;
create policy team_members_select on public.team_members for select using (auth.role() = 'authenticated');
drop policy if exists team_members_manage on public.team_members;
create policy team_members_manage on public.team_members for all using (public.is_staff() or auth.uid() = user_id) with check (public.is_staff() or auth.uid() = user_id);

-- Tasks/submissions
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select using (auth.role() = 'authenticated');
drop policy if exists tasks_manage on public.tasks;
create policy tasks_manage on public.tasks for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists submissions_select on public.task_submissions;
create policy submissions_select on public.task_submissions for select using (auth.uid() = user_id or public.is_staff());
drop policy if exists submissions_insert on public.task_submissions;
create policy submissions_insert on public.task_submissions for insert with check (auth.uid() = user_id);
drop policy if exists submissions_update on public.task_submissions;
create policy submissions_update on public.task_submissions for update using (auth.uid() = user_id or public.is_staff()) with check (auth.uid() = user_id or public.is_staff());

-- Projects
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select using (auth.role() = 'authenticated');
drop policy if exists projects_manage on public.projects;
create policy projects_manage on public.projects for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists project_members_select on public.project_members;
create policy project_members_select on public.project_members for select using (auth.role() = 'authenticated');
drop policy if exists project_members_manage on public.project_members;
create policy project_members_manage on public.project_members for all using (public.is_staff()) with check (public.is_staff());

-- Points/achievements/rewards
drop policy if exists points_select on public.points;
create policy points_select on public.points for select using (auth.uid() = user_id or public.is_staff());
drop policy if exists points_manage on public.points;
create policy points_manage on public.points for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists achievements_select on public.achievements;
create policy achievements_select on public.achievements for select using (auth.uid() = user_id or public.is_staff() or true);
drop policy if exists achievements_manage on public.achievements;
create policy achievements_manage on public.achievements for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists rewards_read on public.rewards;
create policy rewards_read on public.rewards for select using (true);
drop policy if exists rewards_manage on public.rewards;
create policy rewards_manage on public.rewards for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists redemptions_select on public.reward_redemptions;
create policy redemptions_select on public.reward_redemptions for select using (auth.uid() = user_id or public.is_staff());
drop policy if exists redemptions_insert on public.reward_redemptions;
create policy redemptions_insert on public.reward_redemptions for insert with check (auth.uid() = user_id);
drop policy if exists redemptions_manage on public.reward_redemptions;
create policy redemptions_manage on public.reward_redemptions for update using (public.is_staff()) with check (public.is_staff());

-- Cohorts/events/community
drop policy if exists cohorts_read on public.tech_cohorts;
create policy cohorts_read on public.tech_cohorts for select using (true);
drop policy if exists cohorts_manage on public.tech_cohorts;
create policy cohorts_manage on public.tech_cohorts for all using (public.is_admin() or public.is_staff()) with check (public.is_admin() or public.is_staff());
drop policy if exists committee_read on public.cohort_committee;
create policy committee_read on public.cohort_committee for select using (true);
drop policy if exists committee_manage on public.cohort_committee;
create policy committee_manage on public.cohort_committee for all using (public.is_admin() or public.is_staff()) with check (public.is_admin() or public.is_staff());
drop policy if exists events_read on public.events;
create policy events_read on public.events for select using (true);
drop policy if exists events_manage on public.events;
create policy events_manage on public.events for all using (public.is_admin() or public.is_staff()) with check (public.is_admin() or public.is_staff());
drop policy if exists discussions_read on public.discussions;
create policy discussions_read on public.discussions for select using (auth.role() = 'authenticated' or public.is_staff());
drop policy if exists discussions_insert on public.discussions;
create policy discussions_insert on public.discussions for insert with check (auth.uid() = user_id);
drop policy if exists discussions_update on public.discussions;
create policy discussions_update on public.discussions for update using (auth.uid() = user_id or public.is_staff()) with check (auth.uid() = user_id or public.is_staff());
drop policy if exists announcements_read on public.announcements;
create policy announcements_read on public.announcements for select using (true);
drop policy if exists announcements_manage on public.announcements;
create policy announcements_manage on public.announcements for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select using (auth.uid() = user_id);
drop policy if exists notifications_insert_staff on public.notifications;
create policy notifications_insert_staff on public.notifications for insert with check (public.is_staff() or public.is_admin());
drop policy if exists notifications_update_self on public.notifications;
create policy notifications_update_self on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists batch_settings_manage on public.batch_settings;
create policy batch_settings_manage on public.batch_settings for all using (public.is_admin()) with check (public.is_admin());

-- NOTE: For production, avoid selecting batches.whatsapp_invite_url from browser clients.
-- Use an Edge Function that verifies auth/membership and returns only the correct invite URL.
