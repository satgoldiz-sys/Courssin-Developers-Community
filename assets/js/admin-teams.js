/* CCD Admin - Teams module */
(async function () {
  const CCD = window.CCD;
  const A = CCD && CCD.admin;
  if (!A || !A.requireSession) return;
  const session = await A.requireSession();
  if (!session) return;
  const sb = A.sb();

  async function load() {
    const tbody = document.querySelector('#teamsTable tbody');
    if (!tbody) return;
    try {
      const { data, error } = await sb.from('teams').select('id,name,batch_id,leader_id,objectives,batches(name),profiles(full_name)').order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      const { count } = await sb.from('team_members').select('*', { count: 'exact', head: true });
      A.renderList(tbody, data, t => `
        <tr>
          <td><strong>${A.esc(t.name)}</strong></td>
          <td>${t.batches ? A.esc(t.batches.name) : ', '}</td>
          <td>${t.profiles ? A.esc(t.profiles.full_name) : 'Unassigned'}</td>
          <td>${count ?? 0}</td>
          <td>${A.esc(t.objectives || 'Not set')}</td>
        </tr>`, A.emptyState('No teams yet.'));
    } catch (e) {
      tbody.innerHTML = A.emptyState('Could not load teams. Check Supabase configuration and policies.');
    }
  }

  CCD.onReady(load);
})();
