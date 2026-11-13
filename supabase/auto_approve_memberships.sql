-- Atomically approve new batch registrations while respecting a hard 500-member ceiling.
-- Apply after schema.sql, policies.sql, rls_hardening.sql, and security_hardening.sql.

alter table public.memberships
  add column if not exists employment_status text check (employment_status is null or employment_status in ('student','employed','freelance')),
  add column if not exists institution_type text check (institution_type is null or institution_type in ('university','polytechnic','college','other')),
  add column if not exists institution_name text,
  add column if not exists institution_country text,
  add column if not exists study_year text;

drop function if exists public.register_batch_membership(
  uuid, public.skill_level, text, text, text, text, text, text, boolean
);

create or replace function public.register_batch_membership(
  p_batch_id uuid,
  p_category public.skill_level,
  p_preferred_dev_category text,
  p_technologies text,
  p_areas_of_interest text,
  p_why_join text,
  p_teamwork_experience text,
  p_availability text,
  p_terms_accepted boolean,
  p_employment_status text,
  p_institution_type text,
  p_institution_name text,
  p_institution_country text,
  p_study_year text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_batch public.batches%rowtype;
  v_limit integer;
  v_member_count integer;
  v_membership_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_terms_accepted is distinct from true then
    raise exception 'Community terms must be accepted' using errcode = '22023';
  end if;
  if p_batch_id is null then
    raise exception 'A batch is required' using errcode = '22023';
  end if;
  if p_employment_status is null or p_employment_status not in ('student', 'employed', 'freelance') then
    raise exception 'Choose student, employed, or freelance' using errcode = '22023';
  end if;
  if p_employment_status = 'student' and (
    p_institution_type is null or p_institution_type not in ('university', 'polytechnic', 'college', 'other')
    or nullif(trim(p_institution_name), '') is null
    or nullif(trim(p_institution_country), '') is null
    or nullif(trim(p_study_year), '') is null
  ) then
    raise exception 'Student registrations require institution type, school, country, and year' using errcode = '22023';
  end if;

  -- Serializes registrations and admin approvals for this batch.
  select b.* into v_batch
  from public.batches b
  where b.id = p_batch_id
  for update;

  if not found then
    raise exception 'Batch not found' using errcode = 'P0002';
  end if;
  if v_batch.is_registration_open is not true then
    raise exception 'Batch registration is closed' using errcode = 'P0001';
  end if;
-- Administrators may configure a smaller batch capacity, but never more than 500.
  v_limit := least(500, greatest(0, coalesce(v_batch.capacity, 500)));
  select count(*)::integer into v_member_count
  from public.memberships m
  where m.batch_id = p_batch_id
    and m.status in ('active', 'verified', 'completed');

  if v_member_count >= v_limit then
    update public.batches
      set is_registration_open = false, status = 'registration_closed'
      where id = p_batch_id;
    return jsonb_build_object('status', 'full', 'capacity', v_limit);
  end if;

  insert into public.memberships (
    user_id, batch_id, category, status, preferred_dev_category, technologies,
    areas_of_interest, why_join, teamwork_experience, availability,
    employment_status, institution_type, institution_name, institution_country,
    study_year, terms_accepted, approved_at
  ) values (
    v_user_id, p_batch_id, p_category, 'active', p_preferred_dev_category, p_technologies,
    p_areas_of_interest, p_why_join, p_teamwork_experience, p_availability, p_employment_status,
    case when p_employment_status = 'student' then p_institution_type else null end,
    case when p_employment_status = 'student' then trim(p_institution_name) else null end,
    case when p_employment_status = 'student' then trim(p_institution_country) else null end,
    case when p_employment_status = 'student' then trim(p_study_year) else null end,
    true, now()
  ) returning id into v_membership_id;

  if v_member_count + 1 >= v_limit then
    update public.batches
      set is_registration_open = false, status = 'registration_closed'
      where id = p_batch_id;
  end if;

  return jsonb_build_object(
    'status', 'active',
    'membership_id', v_membership_id,
    'capacity', v_limit,
    'approved_count', v_member_count + 1
  );
end;
$$;

create or replace function public.approve_membership_with_capacity(
  p_membership_id uuid,
  p_approved_by uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership public.memberships%rowtype;
  v_batch public.batches%rowtype;
  v_limit integer;
  v_member_count integer;
begin
  select m.* into v_membership
  from public.memberships m
  where m.id = p_membership_id;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  select b.* into v_batch
  from public.batches b
  where b.id = v_membership.batch_id
  for update;
  if not found then
    return jsonb_build_object('status', 'batch_not_found');
  end if;

  select m.* into v_membership
  from public.memberships m
  where m.id = p_membership_id
  for update;
  if v_membership.status <> 'pending' then
    return jsonb_build_object('status', 'not_pending');
  end if;

v_limit := least(500, greatest(0, coalesce(v_batch.capacity, 500)));
  select count(*)::integer into v_member_count
  from public.memberships m
  where m.batch_id = v_batch.id
    and m.status in ('active', 'verified', 'completed');

  if v_member_count >= v_limit then
    update public.batches
      set is_registration_open = false, status = 'registration_closed'
      where id = v_batch.id;
    return jsonb_build_object('status', 'full', 'capacity', v_limit);
  end if;

  update public.memberships
  set status = 'active', approved_by = p_approved_by, approved_at = now()
  where id = p_membership_id;

  if v_member_count + 1 >= v_limit then
    update public.batches
      set is_registration_open = false, status = 'registration_closed'
      where id = v_batch.id;
  end if;

  return jsonb_build_object(
    'status', 'active', 'capacity', v_limit, 'approved_count', v_member_count + 1
  );
end;
$$;

revoke all on function public.register_batch_membership(
  uuid, public.skill_level, text, text, text, text, text, text, boolean,
  text, text, text, text, text
) from public, anon;
grant execute on function public.register_batch_membership(
  uuid, public.skill_level, text, text, text, text, text, text, boolean,
  text, text, text, text, text
) to authenticated;

revoke all on function public.approve_membership_with_capacity(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.approve_membership_with_capacity(uuid, uuid)
  to service_role;

-- Registrations must pass through the authenticated, capacity-checking RPC.
revoke insert on public.memberships from anon, authenticated;
revoke insert (
  user_id, batch_id, category, preferred_dev_category, technologies,
  areas_of_interest, why_join, teamwork_experience, availability, terms_accepted
) on public.memberships from authenticated;
