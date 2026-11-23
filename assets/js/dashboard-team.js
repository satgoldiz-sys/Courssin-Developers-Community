/* CCD Dashboard - Team module (member): teams with real rosters. */
(async function () {
  const CCD = window.CCD;
  const M = CCD && CCD.modules;
  if (!M || !M.requireSession) return;
  const session = await M.requireSession();
  if (!session) return;
  const sb = M.sb();
  const user = CCD.user;

  async function roster(teamId) {
    const { data, error } = await sb.rpc('get_team_roster', { p_team_id: teamId });
    if (error) { console.warn('Team roster unavailable', error); return null; }
    return data || [];
  }

  async function load() {
    const tbody = document.querySelector('#teamTable tbody');
    if (!tbody) return;
    try {
      const { data: members, error: me } = await sb.from('team_members').select('team_id,role,teams(id,name,leader_id,objectives,batches(name))').eq('user_id', user.id);
      if (me) throw me;
      const teams = (members || []).map(m => ({ ...m.teams, myRole: m.role })).filter(t => t && t.id);
      const rosters = await Promise.all(teams.map(t => roster(t.id)));
      M.renderList(tbody, teams, (t) => {
        const list = rosters[teams.indexOf(t)];
        const leader = list ? list.find(r => r.is_leader) : null;
        const leaderText = t.leader_id === user.id ? 'You' : (leader ? leader.full_name || 'Team leader' : (t.leader_id ? 'Assigned' : 'Not set'));
        const names = list
          ? `<strong>${list.length}</strong><div class="muted" style="font-size:.82rem">${list.map(r => M.esc(r.user_id === user.id ? 'You' : (r.full_name || 'Member'))).join(', ')}</div>`
          : '<span class="muted">Roster unavailable</span>';
        return `
          <tr>
            <td><strong>${M.esc(t.name)}</strong><div class="muted" style="font-size:.82rem">Your role: ${M.esc(t.myRole || 'member')}</div></td>
            <td>${M.esc(leaderText)}</td>
            <td>${names}</td>
            <td>${M.esc(t.objectives || 'Not set')}</td>
            <td>${t.batches ? M.esc(t.batches.name) : 'N/A'}</td>
          </tr>`;
      }, M.emptyState('You are not assigned to any team yet.'));
    } catch (e) {
      console.error('Member team could not be loaded', e);
      M.showError(tbody, `Could not load team data. ${M.errorText(e)}`, load, 5);
    }
  }

  CCD.onReady(load);
})();
