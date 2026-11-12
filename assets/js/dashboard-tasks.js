/* CCD Dashboard - Tasks module (member) */
(async function () {
  const CCD = window.CCD;
  const M = CCD && CCD.modules;
  if (!M || !M.requireSession) return;
  const session = await M.requireSession();
  if (!session) return;
  const sb = M.sb();
  const user = CCD.user;

  async function load() {
    const tbody = document.querySelector('#tasksTable tbody');
    if (!tbody) return;
    try {
      const { data, error } = await sb.from('tasks').select('id,title,status,due_date,points,teams(name)').or(`assigned_to.eq.${user.id}`).order('due_date', { ascending: true }).limit(50);
      if (error) throw error;
      M.renderList(tbody, data, t => `
        <tr>
          <td><strong>${M.esc(t.title)}</strong></td>
          <td><span class="status ${M.statusClass(t.status)}">${M.esc(t.status)}</span></td>
          <td>${t.due_date || ', '}</td>
          <td>${t.points ?? ''}</td>
          <td>${t.teams ? M.esc(t.teams.name) : ', '}</td>
        </tr>`, M.emptyState('No tasks assigned yet.'));
    } catch (e) {
      tbody.innerHTML = M.emptyState('Could not load tasks. Check Supabase configuration and policies.');
    }
  }

  CCD.onReady(load);
})();
