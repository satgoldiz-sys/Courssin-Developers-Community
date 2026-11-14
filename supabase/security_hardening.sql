-- CCD security hardening and admin publishing migration.
-- Apply after schema.sql and policies.sql (and after rls_hardening.sql if already used).
-- This migration adds restrictive policies, so it narrows existing policies without
-- deleting custom policies or existing records.

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role::text in ('super_admin','administrator')
  );
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role::text in ('super_admin','administrator','batch_lead','team_leader','reviewer_mentor')
  );
$$;
revoke all on function public.is_admin() from public;
revoke all on function public.is_staff() from public;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;

-- Existing installations receive the same CMS/event columns as fresh installs.
alter table public.events add column if not exists image_url text;
alter table public.events add column if not exists status text not null default 'published';
alter table public.events add column if not exists created_by uuid references public.profiles(id);
alter table public.events add column if not exists updated_at timestamptz not null default now();
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'events_status_allowed') then
    alter table public.events add constraint events_status_allowed check (status in ('draft','published','archived')) not valid;
  end if;
end $$;

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  body text not null,
  cover_image_url text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  author_id uuid references public.profiles(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  object_path text not null unique,
  public_url text not null,
  media_type text not null,
  alt_text text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table if not exists public.event_organizers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  full_name text not null,
  image_url text,
  batch_id uuid references public.batches(id) on delete set null,
  batch_position text not null,
  volunteer_position text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.event_volunteer_positions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  description text,
  slots integer not null default 1 check (slots > 0),
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;
alter table public.articles enable row level security;
alter table public.media_assets enable row level security;
alter table public.event_organizers enable row level security;
alter table public.event_volunteer_positions enable row level security;

-- Role helpers are evaluated on the server. The frontend role check is only navigation.
drop policy if exists ccd_profiles_select_guard on public.profiles;
create policy ccd_profiles_select_guard on public.profiles as restrictive for select to anon, authenticated
  using (auth.uid() = id or public.is_staff());
drop policy if exists ccd_profiles_update_guard on public.profiles;
create policy ccd_profiles_update_guard on public.profiles as restrictive for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- A profile owner may edit profile details, never role/email/identity fields.
revoke update on table public.profiles from anon, authenticated;
grant update (full_name, phone, country, city, avatar_url, bio, github_url, portfolio_url, linkedin_url)
  on table public.profiles to authenticated;

-- Membership status and approval metadata are server-managed. Applicants can only
-- submit their own pending application to a batch that is actually open.
drop policy if exists ccd_memberships_select_guard on public.memberships;
create policy ccd_memberships_select_guard on public.memberships as restrictive for select to anon, authenticated
  using (auth.uid() = user_id or public.is_staff());
drop policy if exists ccd_memberships_insert_guard on public.memberships;
create policy ccd_memberships_insert_guard on public.memberships as restrictive for insert to authenticated
  with check (
    auth.uid() = user_id and terms_accepted is true
    and exists (select 1 from public.batches b where b.id = batch_id and b.is_registration_open is true)
  );
drop policy if exists ccd_memberships_update_guard on public.memberships;
create policy ccd_memberships_update_guard on public.memberships as restrictive for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke insert, update, delete on table public.memberships from anon, authenticated;
grant insert (user_id, batch_id, category, preferred_dev_category, technologies, areas_of_interest,
  why_join, teamwork_experience, availability, terms_accepted)
  on table public.memberships to authenticated;

-- Members cannot assign themselves to teams or change team roles.
drop policy if exists ccd_team_members_select_guard on public.team_members;
create policy ccd_team_members_select_guard on public.team_members as restrictive for select to authenticated
  using (auth.uid() = user_id or public.is_staff());
drop policy if exists ccd_team_members_insert_guard on public.team_members;
create policy ccd_team_members_insert_guard on public.team_members as restrictive for insert to authenticated
  with check (public.is_staff());
drop policy if exists ccd_team_members_update_guard on public.team_members;
create policy ccd_team_members_update_guard on public.team_members as restrictive for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
drop policy if exists ccd_team_members_delete_guard on public.team_members;
create policy ccd_team_members_delete_guard on public.team_members as restrictive for delete to authenticated
  using (public.is_staff());

-- Task and project data is visible to assigned members, project/team members, or staff.
drop policy if exists ccd_tasks_select_guard on public.tasks;
create policy ccd_tasks_select_guard on public.tasks as restrictive for select to anon, authenticated
  using (
    auth.role() = 'authenticated' and (
      assigned_to = auth.uid() or public.is_staff()
      or (team_id is not null and exists (
        select 1 from public.team_members tm where tm.team_id = tasks.team_id and tm.user_id = auth.uid()
      ))
    )
  );
drop policy if exists ccd_tasks_insert_guard on public.tasks;
create policy ccd_tasks_insert_guard on public.tasks as restrictive for insert to authenticated with check (public.is_staff());
drop policy if exists ccd_tasks_update_guard on public.tasks;
create policy ccd_tasks_update_guard on public.tasks as restrictive for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists ccd_tasks_delete_guard on public.tasks;
create policy ccd_tasks_delete_guard on public.tasks as restrictive for delete to authenticated using (public.is_staff());

drop policy if exists ccd_submissions_select_guard on public.task_submissions;
create policy ccd_submissions_select_guard on public.task_submissions as restrictive for select to anon, authenticated
  using (auth.uid() = user_id or public.is_staff());
drop policy if exists ccd_submissions_insert_guard on public.task_submissions;
create policy ccd_submissions_insert_guard on public.task_submissions as restrictive for insert to authenticated
  with check (
    auth.uid() = user_id and exists (
      select 1 from public.tasks t where t.id = task_id and (
        t.assigned_to = auth.uid() or (t.team_id is not null and exists (
          select 1 from public.team_members tm where tm.team_id = t.team_id and tm.user_id = auth.uid()
        ))
      )
    )
  );
drop policy if exists ccd_submissions_update_guard on public.task_submissions;
create policy ccd_submissions_update_guard on public.task_submissions as restrictive for update to authenticated
  using (auth.uid() = user_id or public.is_staff()) with check (auth.uid() = user_id or public.is_staff());
revoke insert, update on table public.task_submissions from anon, authenticated;
grant insert (task_id, user_id, repo_url, live_url, notes) on table public.task_submissions to authenticated;
grant update (repo_url, live_url, notes) on table public.task_submissions to authenticated;

drop policy if exists ccd_teams_select_guard on public.teams;
create policy ccd_teams_select_guard on public.teams as restrictive for select to anon, authenticated
  using (auth.role() = 'authenticated' and (public.is_staff() or exists (
    select 1 from public.team_members tm where tm.team_id = teams.id and tm.user_id = auth.uid()
  )));
drop policy if exists ccd_projects_select_guard on public.projects;
create policy ccd_projects_select_guard on public.projects as restrictive for select to anon, authenticated
  using (auth.role() = 'authenticated' and (public.is_staff() or exists (
    select 1 from public.project_members pm where pm.project_id = projects.id and pm.user_id = auth.uid()
  ) or exists (
    select 1 from public.team_members tm where tm.team_id = projects.team_id and tm.user_id = auth.uid()
  ) or leader_id = auth.uid()));
drop policy if exists ccd_project_members_select_guard on public.project_members;
create policy ccd_project_members_select_guard on public.project_members as restrictive for select to authenticated
  using (auth.uid() = user_id or public.is_staff());

-- Keep user-scoped records private regardless of any older permissive policy.
drop policy if exists ccd_points_select_guard on public.points;
create policy ccd_points_select_guard on public.points as restrictive for select to anon, authenticated
  using (auth.uid() = user_id or public.is_staff());
drop policy if exists ccd_achievements_select_guard on public.achievements;
create policy ccd_achievements_select_guard on public.achievements as restrictive for select to anon, authenticated
  using (auth.uid() = user_id or public.is_staff());
drop policy if exists ccd_redemptions_select_guard on public.reward_redemptions;
create policy ccd_redemptions_select_guard on public.reward_redemptions as restrictive for select to anon, authenticated
  using (auth.uid() = user_id or public.is_staff());
drop policy if exists ccd_redemptions_update_guard on public.reward_redemptions;
create policy ccd_redemptions_update_guard on public.reward_redemptions as restrictive for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke insert, update, delete on table public.reward_redemptions from anon, authenticated;
grant update (status, reviewed_by, reviewed_at) on table public.reward_redemptions to authenticated;

drop policy if exists ccd_notifications_select_guard on public.notifications;
create policy ccd_notifications_select_guard on public.notifications as restrictive for select to anon, authenticated
  using (auth.uid() = user_id);
drop policy if exists ccd_notifications_update_guard on public.notifications;
create policy ccd_notifications_update_guard on public.notifications as restrictive for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke insert, update, delete on table public.notifications from anon, authenticated;
grant update (read_at) on table public.notifications to authenticated;

-- Restrict community role policies from operating on rows owned by other users.
drop policy if exists ccd_discussions_select_guard on public.discussions;
create policy ccd_discussions_select_guard on public.discussions as restrictive for select to anon, authenticated
  using (auth.role() = 'authenticated');
drop policy if exists ccd_discussions_insert_guard on public.discussions;
create policy ccd_discussions_insert_guard on public.discussions as restrictive for insert to authenticated
  with check (auth.uid() = user_id);
drop policy if exists ccd_discussions_update_guard on public.discussions;
create policy ccd_discussions_update_guard on public.discussions as restrictive for update to authenticated
  using (auth.uid() = user_id or public.is_staff()) with check (auth.uid() = user_id or public.is_staff());

-- Admin-only public content and event operations. Published content remains readable.
drop policy if exists ccd_events_select_guard on public.events;
create policy ccd_events_select_guard on public.events as restrictive for select to anon, authenticated
  using (status = 'published' or public.is_admin());
drop policy if exists ccd_events_insert_guard on public.events;
create policy ccd_events_insert_guard on public.events as restrictive for insert to authenticated with check (public.is_admin());
drop policy if exists ccd_events_update_guard on public.events;
create policy ccd_events_update_guard on public.events as restrictive for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists ccd_events_delete_guard on public.events;
create policy ccd_events_delete_guard on public.events as restrictive for delete to authenticated using (public.is_admin());

drop policy if exists ccd_articles_public_read on public.articles;
create policy ccd_articles_public_read on public.articles for select to anon, authenticated using (status = 'published' or public.is_admin());
drop policy if exists ccd_articles_admin_manage on public.articles;
create policy ccd_articles_admin_manage on public.articles for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists ccd_media_public_read on public.media_assets;
create policy ccd_media_public_read on public.media_assets for select to anon, authenticated using (status = 'published' or public.is_admin());
drop policy if exists ccd_media_admin_manage on public.media_assets;
create policy ccd_media_admin_manage on public.media_assets for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists ccd_event_organizers_public_read on public.event_organizers;
create policy ccd_event_organizers_public_read on public.event_organizers for select to anon, authenticated
  using (public.is_admin() or exists (select 1 from public.events e where e.id = event_id and e.status = 'published'));
drop policy if exists ccd_event_organizers_admin_manage on public.event_organizers;
create policy ccd_event_organizers_admin_manage on public.event_organizers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists ccd_event_volunteers_public_read on public.event_volunteer_positions;
create policy ccd_event_volunteers_public_read on public.event_volunteer_positions for select to anon, authenticated
  using (public.is_admin() or exists (select 1 from public.events e where e.id = event_id and e.status = 'published'));
drop policy if exists ccd_event_volunteers_admin_manage on public.event_volunteer_positions;
create policy ccd_event_volunteers_admin_manage on public.event_volunteer_positions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Atomic reward requests derive the user ID and points balance from the authenticated session.
create or replace function public.request_reward_redemption(p_reward_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  caller_id uuid := auth.uid();
  needed_points integer;
  available_points bigint;
  redemption_id uuid;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(caller_id::text, 0));
  select r.points_required into needed_points from public.rewards r where r.id = p_reward_id and r.available is true;
  if not found then raise exception 'Reward unavailable' using errcode = '22023'; end if;
  select coalesce(sum(p.points), 0) into available_points from public.points p where p.user_id = caller_id;
  if available_points < needed_points then raise exception 'Not enough points' using errcode = '22023'; end if;
  if exists (select 1 from public.reward_redemptions rr where rr.user_id = caller_id and rr.reward_id = p_reward_id and rr.status in ('pending','approved','active')) then
    raise exception 'A redemption request already exists' using errcode = '23505';
  end if;
  insert into public.reward_redemptions (user_id, reward_id, status)
  values (caller_id, p_reward_id, 'pending') returning id into redemption_id;
  return redemption_id;
end;
$$;
revoke all on function public.request_reward_redemption(uuid) from public, anon;
grant execute on function public.request_reward_redemption(uuid) to authenticated;

-- Publicly readable media; only administrators can upload or delete objects.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ccd-public-media', 'ccd-public-media', true, 10485760,
  array['image/jpeg','image/png','image/webp','video/mp4','audio/mpeg','application/pdf'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists ccd_public_media_read on storage.objects;
create policy ccd_public_media_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'ccd-public-media');
drop policy if exists ccd_public_media_admin_insert on storage.objects;
create policy ccd_public_media_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'ccd-public-media' and public.is_admin());
drop policy if exists ccd_public_media_admin_update on storage.objects;
create policy ccd_public_media_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'ccd-public-media' and public.is_admin())
  with check (bucket_id = 'ccd-public-media' and public.is_admin());
drop policy if exists ccd_public_media_admin_delete on storage.objects;
create policy ccd_public_media_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'ccd-public-media' and public.is_admin());

-- Profile photos are publicly viewable, but authenticated users can only manage
-- objects stored under their own auth user ID folder.
drop policy if exists ccd_avatars_public_read on storage.objects;
create policy ccd_avatars_public_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'ccd-avatars');
drop policy if exists ccd_avatars_owner_insert on storage.objects;
create policy ccd_avatars_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'ccd-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists ccd_avatars_insert_guard on storage.objects;
create policy ccd_avatars_insert_guard on storage.objects as restrictive for insert to anon, authenticated
  with check (bucket_id <> 'ccd-avatars' or (
    auth.role() = 'authenticated' and (storage.foldername(name))[1] = (select auth.uid())::text
  ));
drop policy if exists ccd_avatars_owner_update on storage.objects;
create policy ccd_avatars_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'ccd-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'ccd-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists ccd_avatars_update_guard on storage.objects;
create policy ccd_avatars_update_guard on storage.objects as restrictive for update to anon, authenticated
  using (bucket_id <> 'ccd-avatars' or (
    auth.role() = 'authenticated' and (storage.foldername(name))[1] = (select auth.uid())::text
  ))
  with check (bucket_id <> 'ccd-avatars' or (
    auth.role() = 'authenticated' and (storage.foldername(name))[1] = (select auth.uid())::text
  ));
drop policy if exists ccd_avatars_owner_delete on storage.objects;
create policy ccd_avatars_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'ccd-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists ccd_avatars_delete_guard on storage.objects;
create policy ccd_avatars_delete_guard on storage.objects as restrictive for delete to anon, authenticated
  using (bucket_id <> 'ccd-avatars' or (
    auth.role() = 'authenticated' and (storage.foldername(name))[1] = (select auth.uid())::text
  ));

-- Avoid stale publication dates and supply a minimal media display index.
create index if not exists articles_published_idx on public.articles (published_at desc) where status = 'published';
create index if not exists events_published_idx on public.events (event_date) where status = 'published';
create index if not exists event_organizers_event_order_idx on public.event_organizers (event_id, sort_order);
create index if not exists event_volunteer_positions_event_idx on public.event_volunteer_positions (event_id, status);
