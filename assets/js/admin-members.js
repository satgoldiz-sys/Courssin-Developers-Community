/* CCD Admin - Members module */
(async function () {
  const CCD = window.CCD;
  const A = CCD && CCD.admin;
  if (!A || !A.requireSession) return;
  const session = await A.requireSession();
  if (!session) return;
  const sb = A.sb();
  const base = CCD.getBase() || '';
  let membersDataRequest;

  async function getMembersData() {
    if (!membersDataRequest) {
      membersDataRequest = (async () => {
        const { data, error } = await sb.functions.invoke('admin-secure', { body: { action: 'members-data' } });
        if (error) {
          let detail = error.message || 'Admin data service failed';
          const response = error.context;
          if (response && typeof response.clone === 'function') {
            try {
              const body = await response.clone().json();
              if (typeof body?.error === 'string') detail = body.error;
            } catch { /* retain the Edge Function error */ }
          }
          throw new Error(detail);
        }
        if (!data?.ok) throw new Error('Admin data service returned an invalid response');
        return data;
      })().catch(error => {
        membersDataRequest = null;
        throw error;
      });
    }
    return membersDataRequest;
  }

  async function invoke(fn, body) {
    const { data, error } = await sb.functions.invoke(fn, { body });
    if (error) { A.setNotice(document.querySelector('[data-dashboard-notice]'), error.message || 'Edge Function error', 'error'); return null; }
    return data;
  }

  async function load() {
    const tbody = document.querySelector('#membersTable tbody');
    if (!tbody) return;
    try {
      const { profiles } = await getMembersData();
      A.renderList(tbody, profiles, p => `
        <tr>
          <td>${A.esc(p.full_name || 'Member')}</td>
          <td>${A.esc(p.email || ',')}</td>
          <td><span class="status ${A.statusClass(p.role)}">${A.esc(p.role)}</span></td>
          <td>${p.created_at ? new Date(p.created_at).toLocaleDateString() : ', '}</td>
          <td><div class="member-admin-actions"><button class="btn btn-secondary btn-sm" data-edit="${p.id}">Role</button><button class="btn btn-secondary btn-sm" data-badge="${p.id}">Badge</button><button class="btn btn-secondary btn-sm" data-points="${p.id}">Points</button><button class="btn btn-secondary btn-sm" data-task="${p.id}">Task</button><button class="btn btn-primary btn-sm" data-reward="${p.id}">Reward</button></div></td>
        </tr>`, A.emptyState('No members yet.'));
      tbody.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', async () => {
        const id = btn.dataset.edit;
        const role = prompt('Set role (super_admin, administrator, batch_lead, team_leader, reviewer_mentor, community_member, alumni):', '');
        if (!role) return;
        const res = await invoke('admin-secure', { action: 'update', table: 'profiles', record_id: id, payload: { role } });
        if (res) refreshMembers();
      }));
      tbody.querySelectorAll('[data-badge]').forEach(btn => btn.addEventListener('click', async () => {
        const title = prompt('Badge or contribution title (for example: Event Organiser or Project Lead):');
        if (!title?.trim()) return;
        const description = prompt('Short note shown with this badge (optional):', '') || '';
        const res = await invoke('admin-secure', { action: 'insert', table: 'achievements', payload: { user_id: btn.dataset.badge, title: title.trim(), description, badge_key: title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') } });
        if (res) A.setNotice(document.querySelector('[data-dashboard-notice]'), 'Badge added to the member profile.', 'success');
      }));
      tbody.querySelectorAll('[data-points]').forEach(btn => btn.addEventListener('click', async () => {
        const amount = Number(prompt('Points to award (whole number):'));
        if (!Number.isInteger(amount) || amount < 1 || amount > 10000) return;
        const reason = prompt('Reason for this award:');
        if (!reason?.trim()) return;
        const res = await invoke('admin-secure', { action: 'insert', table: 'points', payload: { user_id: btn.dataset.points, points: amount, reason: reason.trim(), source_type: 'admin_award' } });
        if (res) A.setNotice(document.querySelector('[data-dashboard-notice]'), 'Points awarded to the member.', 'success');
      }));
      tbody.querySelectorAll('[data-task]').forEach(btn => btn.addEventListener('click', async () => {
        const title = prompt('Task title:');
        if (!title?.trim()) return;
        const description = prompt('Task instructions:') || '';
        const res = await invoke('admin-secure', { action: 'insert', table: 'tasks', payload: { assigned_to: btn.dataset.task, title: title.trim(), description, status: 'assigned', points: 0 } });
        if (res) A.setNotice(document.querySelector('[data-dashboard-notice]'), 'Task assigned to the member.', 'success');
      }));
      tbody.querySelectorAll('[data-reward]').forEach(btn => btn.addEventListener('click', async () => {
        const { data: rewards, error } = await sb.from('rewards').select('id,title,available').eq('available', true).order('title').limit(100);
        if (error || !rewards?.length) return A.setNotice(document.querySelector('[data-dashboard-notice]'), 'No available rewards were found.', 'error');
        const choice = prompt(`Choose a reward by number:\n${rewards.map((reward, index) => `${index + 1}. ${reward.title}`).join('\n')}`);
        if (!choice) return;
        const selected = rewards[Number(choice) - 1];
        if (!selected) return A.setNotice(document.querySelector('[data-dashboard-notice]'), 'Choose a valid reward number.', 'error');
        const res = await invoke('admin-secure', { action: 'insert', table: 'reward_redemptions', payload: { user_id: btn.dataset.reward, reward_id: selected.id, status: 'approved' } });
        if (res) A.setNotice(document.querySelector('[data-dashboard-notice]'), `${selected.title} granted to the member.`, 'success');
      }));
    } catch (e) {
      console.error('Could not load member list:', e);
      tbody.innerHTML = A.emptyState(`Could not load members: ${e.message || 'unknown error'}`);
    }
  }

  async function loadApprovals() {
    const container = document.querySelector('[data-approvals]');
    if (!container) return;
    try {
      const { approvals } = await getMembersData();
      container.innerHTML = (approvals || []).map(m => `
        <div class="card" style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
            <div>
              <strong>${A.esc(m.profiles?.full_name || 'Member')}</strong>
              <span class="muted"> · ${A.esc(m.batches ? `${m.batches.name} ${m.batches.year}` : 'Batch')}</span>
              <div class="muted" style="font-size:.85rem">Category: ${A.esc(m.category)} · ${m.created_at ? new Date(m.created_at).toLocaleDateString() : ''}</div>
            </div>
            <div class="toolbar">
              <button class="btn btn-primary btn-sm" data-approve="${m.id}">Approve</button>
              <button class="btn btn-secondary btn-sm" data-reject="${m.id}">Reject</button>
            </div>
          </div>
        </div>`).join('') || '<p class="muted">No pending registrations.</p>';
      container.querySelectorAll('[data-approve]').forEach(btn => btn.addEventListener('click', async () => {
        const res = await invoke('membership-approval', { membership_id: btn.dataset.approve, action: 'approve' });
        if (res) refreshMembers();
      }));
      container.querySelectorAll('[data-reject]').forEach(btn => btn.addEventListener('click', async () => {
        const res = await invoke('membership-approval', { membership_id: btn.dataset.reject, action: 'reject' });
        if (res) refreshMembers();
      }));
    } catch (e) {
      console.error('Could not load registration approvals:', e);
      container.innerHTML = `<p class="muted">Could not load approvals: ${A.esc(e.message || 'unknown error')}</p>`;
    }
  }

  async function refreshMembers() {
    membersDataRequest = null;
    await Promise.all([load(), loadApprovals()]);
  }

  CCD.onReady(() => { load(); loadApprovals(); });
})();
