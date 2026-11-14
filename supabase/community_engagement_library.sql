-- CCD existing-project migration: 50 XP for all active batch members, weekly team XP,
-- membership activity visibility, and a private resource library for batch members.
create table if not exists public.weekly_team_xp_awards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create unique index if not exists points_award_dedupe_idx
  on public.points(user_id, source_type, source_id) where source_id is not null;

create or replace function public.award_batch_registration_xp()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('active','verified','completed') then
    insert into public.points(user_id,batch_id,source_type,source_id,points,reason)
    values(new.user_id,new.batch_id,'batch_registration',new.id,50,'Batch registration welcome bonus')
    on conflict (user_id,source_type,source_id) where source_id is not null do nothing;
    insert into public.notifications(user_id,type,title,body)
    values(new.user_id,'points','50 XP welcome bonus','You earned 50 XP for registering for a CCD batch.');
  end if;
  return new;
end;
$$;
drop trigger if exists memberships_award_registration_xp on public.memberships;
create trigger memberships_award_registration_xp after insert on public.memberships
for each row execute function public.award_batch_registration_xp();

-- Backfill existing active members once. The stable membership ID makes this idempotent.
with awarded as (
  insert into public.points(user_id,batch_id,source_type,source_id,points,reason)
  select m.user_id,m.batch_id,'batch_registration',m.id,50,'Batch registration welcome bonus'
  from public.memberships m where m.status in ('active','verified','completed')
  on conflict (user_id,source_type,source_id) where source_id is not null do nothing
  returning user_id
)
insert into public.notifications(user_id,type,title,body)
select user_id,'points','50 XP welcome bonus','You earned 50 XP for registering for a CCD batch.' from awarded;

create or replace function public.award_weekly_team_member_xp(p_week_start date default date_trunc('week', now())::date)
returns integer language plpgsql security definer set search_path = '' as $$
declare awarded integer := 0; item record; award_id uuid;
begin
  for item in
    select distinct tm.user_id from public.team_members tm
    join public.memberships m on m.user_id=tm.user_id and m.status in ('active','verified','completed')
  loop
    insert into public.weekly_team_xp_awards(user_id,week_start) values(item.user_id,p_week_start)
    on conflict(user_id,week_start) do nothing returning id into award_id;
    if award_id is not null then
      insert into public.points(user_id,source_type,source_id,points,reason)
      values(item.user_id,'weekly_team_bonus',award_id,40,'Weekly active team member bonus');
      insert into public.notifications(user_id,type,title,body)
      values(item.user_id,'points','40 XP weekly team bonus','You earned 40 XP for being an active CCD team member this week.');
      awarded := awarded + 1;
    end if;
    award_id := null;
  end loop;
  return awarded;
end;
$$;
revoke all on function public.award_weekly_team_member_xp(date) from public, anon, authenticated;
grant execute on function public.award_weekly_team_member_xp(date) to service_role;

-- Schedule weekly at Sunday 23:59 UTC when pg_cron is enabled on the Supabase project.
do $$ begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname='ccd-weekly-team-xp';
    perform cron.schedule('ccd-weekly-team-xp','59 23 * * 0',
      $job$select public.award_weekly_team_member_xp(date_trunc('week',now())::date);$job$);
  end if;
exception when others then
  raise notice 'Weekly XP job was not scheduled; enable pg_cron and schedule public.award_weekly_team_member_xp() in Supabase.';
end $$;

create table if not exists public.library_resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null default 'General',
  resource_type text not null check(resource_type in ('link','file')),
  resource_url text,
  storage_path text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  active boolean not null default true,
  check ((resource_type='link' and resource_url is not null) or (resource_type='file' and storage_path is not null))
);

create table if not exists public.user_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check(event_type in ('page_view','navigation','action','form_submit')),
  page_path text not null,
  target_label text,
  created_at timestamptz not null default now()
);
create index if not exists user_activity_created_idx on public.user_activity(created_at desc);
alter table public.user_activity enable row level security;
drop policy if exists ccd_activity_self_insert on public.user_activity;
create policy ccd_activity_self_insert on public.user_activity for insert to authenticated with check(auth.uid()=user_id);
drop policy if exists ccd_activity_admin_read on public.user_activity;
create policy ccd_activity_admin_read on public.user_activity for select to authenticated using(public.is_admin());
grant insert on public.user_activity to authenticated;
grant select on public.user_activity to authenticated;
alter table public.library_resources enable row level security;
drop policy if exists ccd_library_member_read on public.library_resources;
create policy ccd_library_member_read on public.library_resources for select to authenticated using (
  active and (public.is_admin() or exists(select 1 from public.memberships m where m.user_id=auth.uid() and m.status in ('active','verified','completed')))
);
drop policy if exists ccd_library_admin_manage on public.library_resources;
create policy ccd_library_admin_manage on public.library_resources for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select on public.library_resources to authenticated;
grant insert,update,delete on public.library_resources to authenticated;

insert into public.library_resources(title,description,category,resource_type,resource_url)
select 'Digital Marketing Learning Library','Curated learning resources for CCD members.','Digital Marketing','link','https://drive.google.com/drive/folders/1qrtljeRUhfrCEKs18By819im0Wp1ApOl?usp=drive_link'
where not exists(select 1 from public.library_resources where resource_url='https://drive.google.com/drive/folders/1qrtljeRUhfrCEKs18By819im0Wp1ApOl?usp=drive_link');

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('ccd-member-library','ccd-member-library',false,52428800,array['application/pdf','image/jpeg','image/png','image/webp','video/mp4','text/plain','application/zip'])
on conflict(id) do update set public=false,file_size_limit=52428800;
drop policy if exists ccd_library_files_member_read on storage.objects;
create policy ccd_library_files_member_read on storage.objects for select to authenticated using (
  bucket_id='ccd-member-library' and (public.is_admin() or exists(select 1 from public.memberships m where m.user_id=auth.uid() and m.status in ('active','verified','completed')))
);
drop policy if exists ccd_library_files_admin_insert on storage.objects;
create policy ccd_library_files_admin_insert on storage.objects for insert to authenticated with check(bucket_id='ccd-member-library' and public.is_admin());
drop policy if exists ccd_library_files_admin_delete on storage.objects;
create policy ccd_library_files_admin_delete on storage.objects for delete to authenticated using(bucket_id='ccd-member-library' and public.is_admin());
