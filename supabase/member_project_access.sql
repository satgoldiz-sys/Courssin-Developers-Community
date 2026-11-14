-- Let members see projects assigned to them directly, through their team, or as project lead.
-- Apply in Supabase SQL Editor to update existing deployments.
drop policy if exists ccd_projects_select_guard on public.projects;
create policy ccd_projects_select_guard on public.projects as restrictive for select to anon, authenticated
  using (
    auth.role() = 'authenticated' and (
      public.is_staff()
      or leader_id = auth.uid()
      or exists (
        select 1 from public.project_members pm
        where pm.project_id = projects.id and pm.user_id = auth.uid()
      )
      or exists (
        select 1 from public.team_members tm
        where tm.team_id = projects.team_id and tm.user_id = auth.uid()
      )
    )
  );

grant select on public.projects, public.project_members, public.team_members to authenticated;
