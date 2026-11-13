/* CCD Dashboard - Projects module (member) */
(async function () {
  const CCD = window.CCD;
  const M = CCD && CCD.modules;
  if (!M || !M.requireSession) return;
  const session = await M.requireSession();
  if (!session) return;
  const sb = M.sb();
  const user = CCD.user;

  async function load() {
    const tbody = document.querySelector('#projectsTable tbody');
    if (!tbody) return;
    try {
      const [{ data: membershipRows, error: membershipError }, { data: teamRows, error: teamError }, { data: ledRows, error: ledError }] = await Promise.all([
        sb.from('project_members').select('project_id').eq('user_id', user.id),
        sb.from('team_members').select('team_id').eq('user_id', user.id),
        sb.from('projects').select('id').eq('leader_id', user.id)
      ]);
      if (membershipError) throw membershipError;
      if (teamError) throw teamError;
      if (ledError) throw ledError;
      const teamIds = (teamRows || []).map(row => row.team_id);
      const [{ data: teamProjects, error: teamProjectsError }] = teamIds.length
        ? await Promise.all([sb.from('projects').select('id').in('team_id', teamIds)])
        : [{ data: [], error: null }];
      if (teamProjectsError) throw teamProjectsError;
      const projectIds = [...new Set([...(membershipRows || []).map(row => row.project_id), ...(ledRows || []).map(row => row.id), ...(teamProjects || []).map(row => row.id)])];
      if (!projectIds.length) {
        M.renderList(tbody, [], () => '', M.emptyState('No projects assigned yet.'));
        return;
      }
      const { data, error } = await sb.from('projects').select('id,title,status,deadline,github_url,live_url,teams(name),batches(name)')
        .in('id', projectIds).order('deadline', { ascending: true }).limit(50);
      if (error) throw error;
      M.renderList(tbody, data, p => {
        const links = [p.github_url ? `<a class="btn btn-secondary btn-sm" href="${M.esc(p.github_url)}" target="_blank" rel="noopener">Code</a>` : '', p.live_url ? `<a class="btn btn-primary btn-sm" href="${M.esc(p.live_url)}" target="_blank" rel="noopener">Live</a>` : ''];
        return `
          <tr>
            <td><strong>${M.esc(p.title)}</strong></td>
            <td>${p.teams ? M.esc(p.teams.name) : ', '}</td>
            <td><span class="status ${M.statusClass(p.status)}">${M.esc(p.status)}</span></td>
            <td>${p.deadline || ', '}</td>
            <td>${links.join(' ') || ', '}</td>
          </tr>`;
      }, M.emptyState('No projects assigned yet.'));
    } catch (e) {
      console.error('Member projects could not be loaded', e);
      tbody.innerHTML = M.emptyState(`Could not load projects: ${M.esc(e?.message || e?.details || 'Check Supabase policies and project assignments.')}`);
    }
  }

  CCD.onReady(load);
})();
