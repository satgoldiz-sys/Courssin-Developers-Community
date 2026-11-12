/* CCD Admin - Projects module */
(async function () {
  const CCD = window.CCD;
  const A = CCD && CCD.admin;
  if (!A || !A.requireSession) return;
  const session = await A.requireSession();
  if (!session) return;
  const sb = A.sb();

  async function load() {
    const tbody = document.querySelector('#projectsTable tbody');
    if (!tbody) return;
    try {
      const { data, error } = await sb.from('projects').select('id,title,status,deadline,github_url,live_url,teams(name),batches(name)').order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      A.renderList(tbody, data, p => {
        const links = [p.github_url ? `<a class="btn btn-secondary btn-sm" href="${A.esc(p.github_url)}" target="_blank" rel="noopener">Code</a>` : '', p.live_url ? `<a class="btn btn-primary btn-sm" href="${A.esc(p.live_url)}" target="_blank" rel="noopener">Live</a>` : ''];
        return `
          <tr>
            <td><strong>${A.esc(p.title)}</strong></td>
            <td>${p.teams ? A.esc(p.teams.name) : ', '}</td>
            <td><span class="status ${A.statusClass(p.status)}">${A.esc(p.status)}</span></td>
            <td>${p.deadline || ', '}</td>
            <td>${links.join(' ') || ', '}</td>
          </tr>`;
      }, A.emptyState('No projects yet.'));
    } catch (e) {
      tbody.innerHTML = A.emptyState('Could not load projects. Check Supabase configuration and policies.');
    }
  }

  CCD.onReady(load);
})();
