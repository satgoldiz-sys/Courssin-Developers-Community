-- CCD Platform Schema (Phase 2+ foundation)
-- Run in Supabase SQL Editor. Review before production use.

create extension if not exists "pgcrypto";

-- Enums
do $$ begin create type public.app_role as enum ('super_admin','administrator','batch_lead','team_leader','reviewer_mentor','community_member','alumni'); exception when duplicate_object then null; end $$;
do $$ begin create type public.batch_status as enum ('upcoming','registration_open','registration_closed','active','closing_soon','completed','archived'); exception when duplicate_object then null; end $$;
do $$ begin create type public.membership_status as enum ('pending','verified','active','completed','rejected','withdrawn'); exception when duplicate_object then null; end $$;
do $$ begin create type public.skill_level as enum ('beginner','intermediate','advanced'); exception when duplicate_object then null; end $$;
do $$ begin create type public.task_status as enum ('assigned','in_progress','submitted','under_review','revision_required','approved','completed'); exception when duplicate_object then null; end $$;

-- Profiles (linked to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  country text,
  city text,
  avatar_url text,
  role public.app_role not null default 'community_member',
  bio text,
  github_url text,
  portfolio_url text,
  linkedin_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Batches
create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  year int not null,
  start_date date,
  end_date date,
  registration_open_date date,
  registration_close_date date,
  whatsapp_invite_url text, -- stored server-side access pattern; never expose publicly
  capacity int,
  description text,
  status public.batch_status not null default 'upcoming',
  is_registration_open boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, year)
);

-- Memberships (one user can have records across batches)
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  category public.skill_level not null,
  status public.membership_status not null default 'pending',
  preferred_dev_category text,
  technologies text,
  areas_of_interest text,
  why_join text,
  teamwork_experience text,
  availability text,
  terms_accepted boolean not null default false,
  whatsapp_sent boolean not null default false,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, batch_id)
);

-- Leadership
create table if not exists public.batch_leadership (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  position text not null,
  responsibilities text,
  appointed_by uuid references public.profiles(id),
  appointed_at date default current_date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Teams
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  name text not null,
  leader_id uuid references public.profiles(id),
  objectives text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, name)
);
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text default 'member',
  joined_at timestamptz not null default now(),
  unique (team_id, user_id)
);

-- Tasks & submissions
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.batches(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  assigned_to uuid references public.profiles(id),
  title text not null,
  description text,
  instructions text,
  difficulty text,
  status public.task_status not null default 'assigned',
  start_date date,
  due_date date,
  points int not null default 10,
  reference_materials text,
  submission_requirements text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.task_submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  repo_url text,
  live_url text,
  notes text,
  status public.task_status not null default 'submitted',
  reviewer_id uuid references public.profiles(id),
  feedback text,
  points_awarded int,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);

-- Projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.batches(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  leader_id uuid references public.profiles(id),
  title text not null,
  description text,
  status text default 'planning',
  deadline date,
  github_url text,
  live_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text default 'member',
  primary key (project_id, user_id)
);

-- Points, achievements, rewards
create table if not exists public.points (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete set null,
  source_type text,
  source_id uuid,
  points int not null,
  reason text,
  awarded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  badge_key text,
  awarded_at timestamptz not null default now()
);
create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  points_required int not null default 0,
  eligibility text,
  available boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references public.rewards(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz
);

-- Events / Tech Cohort
create table if not exists public.tech_cohorts (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.batches(id) on delete set null,
  title text not null,
  theme text,
  event_date date,
  venue text,
  description text,
  format text default 'hybrid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.cohort_committee (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.tech_cohorts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  appointed_at timestamptz not null default now()
);
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid references public.tech_cohorts(id) on delete set null,
  title text not null,
  description text,
  event_type text,
  event_date timestamptz,
  venue text,
  created_at timestamptz not null default now()
);

-- Community / comms
create table if not exists public.discussions (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.batches(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null default 'General Discussions',
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.batches(id) on delete set null,
  title text not null,
  body text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  type text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.batch_settings (
  batch_id uuid primary key references public.batches(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- updated_at helper
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- Apply updated_at triggers where useful
do $$ begin
  if not exists (select 1 from pg_trigger where tgname='profiles_updated_at') then create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at(); end if;
  if not exists (select 1 from pg_trigger where tgname='batches_updated_at') then create trigger batches_updated_at before update on public.batches for each row execute function public.set_updated_at(); end if;
  if not exists (select 1 from pg_trigger where tgname='memberships_updated_at') then create trigger memberships_updated_at before update on public.memberships for each row execute function public.set_updated_at(); end if;
end $$;

-- Auto-create profile on signup
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), new.email, new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do update set email = excluded.email, full_name = coalesce(public.profiles.full_name, excluded.full_name), updated_at = now();
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Indexes
create index if not exists memberships_user_id_idx on public.memberships(user_id);
create index if not exists memberships_batch_id_idx on public.memberships(batch_id);
create index if not exists tasks_assigned_to_idx on public.tasks(assigned_to);
create index if not exists points_user_id_idx on public.points(user_id);
create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists discussions_category_idx on public.discussions(category);
