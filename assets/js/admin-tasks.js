/* CCD Admin - Tasks module */
(async function () {
  const CCD = window.CCD;
  const A = CCD && CCD.admin;
  if (!A || !A.requireSession) return;
  const session = await A.requireSession();
  if (!session) return;
  const sb = A.sb();

  async function load() {
    const tbody = document.querySelector('#tasksTable tbody');
    if (!tbody) return;
    try {
      const { data, error } = await sb.from('tasks').select('id,title,status,due_date,points,assigned_to,teams(name),profiles(full_name)').order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      A.renderList(tbody, data, t => `
        <tr>
          <td><strong>${A.esc(t.title)}</strong></td>
          <td>${t.profiles ? A.esc(t.profiles.full_name) : 'Unassigned'}</td>
          <td><span class="status ${A.statusClass(t.status)}">${A.esc(t.status)}</span></td>
          <td>${t.due_date || ', '}</td>
          <td>${t.points ?? ''}</td>
        </tr>`, A.emptyState('No tasks yet.'));
    } catch (e) {
      tbody.innerHTML = A.emptyState('Could not load tasks. Check Supabase configuration and policies.');
    }
  }

  document.addEventListener('DOMContentLoaded', load);
})();