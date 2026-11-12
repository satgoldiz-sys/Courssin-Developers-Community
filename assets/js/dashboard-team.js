/* CCD Dashboard - Team module (member) */
(async function () {
  const CCD = window.CCD;
  const M = CCD && CCD.modules;
  if (!M || !M.requireSession) return;
  const session = await M.requireSession();
  if (!session) return;
  const sb = M.sb();
  const user = CCD.user;

  async function load() {
    const tbody = document.querySelector('#teamTable tbody');
    if (!tbody) return;
    try {
      const { data: members, error: me } = await sb.from('team_members').select('team_id,role,teams(id,name,leader_id,objectives,batches(name))').eq('user_id', user.id);
      if (me) throw me;
      const teams = (members || []).map(m => m.teams).filter(Boolean);
      M.renderList(tbody, teams, t => {
        const leader = t.leader_id ? (t.profiles ? '' : '') : '';
        return `
          <tr>
            <td><strong>${M.esc(t.name)}</strong></td>
            <td>${t.leader_id ? 'Team leader' : 'Member'}</td>
            <td>${(members || []).filter(x => x.team_id === t.id).length}</td>
            <td>${M.esc(t.objectives || 'Not set')}</td>
            <td>${t.batches ? M.esc(t.batches.name) : ', '}</td>
          </tr>`;
      }, M.emptyState('You are not assigned to any team yet.'));
    } catch (e) {
      tbody.innerHTML = M.emptyState('Could not load team data. Check Supabase configuration and policies.');
    }
  }

  CCD.onReady(load);
})();
