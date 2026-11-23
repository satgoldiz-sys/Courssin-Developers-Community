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
      let teamProjects = [];
      if (teamIds.length) {
        const res = await sb.from('projects').select('id').in('team_id', teamIds);
        if (res.error) throw res.error;
        teamProjects = res.data || [];
      }
      const projectIds = [...new Set([...(membershipRows || []).map(row => row.project_id), ...(ledRows || []).map(row => row.id), ...teamProjects.map(row => row.id)])];
      if (!projectIds.length) {
        M.renderList(tbody, [], () => '', M.emptyState('No projects assigned yet.'));
        return;
      }
      const { data, error } = await sb.from('projects').select('id,title,status,deadline,github_url,live_url,teams(name),batches(name)')
        .in('id', projectIds).order('deadline', { ascending: true, nullsFirst: false }).limit(50);
      if (error) throw error;
      M.renderList(tbody, data, p => {
        const code = M.safeHttpsUrl(p.github_url), live = M.safeHttpsUrl(p.live_url);
        const links = [code ? `<a class="btn btn-secondary btn-sm" href="${M.esc(code)}" target="_blank" rel="noopener noreferrer">Code</a>` : '', live ? `<a class="btn btn-primary btn-sm" href="${M.esc(live)}" target="_blank" rel="noopener noreferrer">Live</a>` : ''].filter(Boolean);
        return `
          <tr>
            <td><strong>${M.esc(p.title)}</strong></td>
            <td>${p.teams ? M.esc(p.teams.name) : 'N/A'}</td>
            <td><span class="status ${M.statusClass(p.status)}">${M.esc(String(p.status || 'N/A').replace(/_/g, ' '))}</span></td>
            <td>${M.esc(p.deadline || 'N/A')}</td>
            <td>${links.join(' ') || 'N/A'}</td>
          </tr>`;
      }, M.emptyState('No projects assigned yet.'));
    } catch (e) {
      console.error('Member projects could not be loaded', e);
      M.showError(tbody, `Could not load projects. ${M.errorText(e)}`, load, 5);
    }
  }

  CCD.onReady(load);
})();
