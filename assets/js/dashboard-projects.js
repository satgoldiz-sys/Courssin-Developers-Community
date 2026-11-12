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
      const { data, error } = await sb.from('projects').select('id,title,status,deadline,github_url,live_url,teams(name),batches(name)')
        .or(`team_id.in(select team_id from team_members where user_id = eq.${user.id})`).order('deadline', { ascending: true }).limit(50);
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
      tbody.innerHTML = M.emptyState('Could not load projects. Check Supabase configuration and policies.');
    }
  }

  CCD.onReady(load);
})();
