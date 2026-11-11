/* CCD Admin - Members module */
(async function () {
  const CCD = window.CCD;
  const A = CCD && CCD.admin;
  if (!A || !A.requireSession) return;
  const session = await A.requireSession();
  if (!session) return;
  const sb = A.sb();
  const base = CCD.getBase() || '';

  async function invoke(fn, body) {
    const { data, error } = await sb.functions.invoke(fn, { body });
    if (error) { A.setNotice(document.querySelector('[data-dashboard-notice]'), error.message || 'Edge Function error', 'error'); return null; }
    return data;
  }

  async function load() {
    const tbody = document.querySelector('#membersTable tbody');
    if (!tbody) return;
    try {
      const { data, error } = await sb.from('profiles').select('id,full_name,email,role,created_at').order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      A.renderList(tbody, data, p => `
        <tr>
          <td>${A.esc(p.full_name || 'Member')}</td>
          <td>${A.esc(p.email || ',')}</td>
          <td><span class="status ${A.statusClass(p.role)}">${A.esc(p.role)}</span></td>
          <td>${p.created_at ? new Date(p.created_at).toLocaleDateString() : ', '}</td>
          <td><button class="btn btn-secondary btn-sm" data-edit="${p.id}">Edit role</button></td>
        </tr>`, A.emptyState('No members yet.'));
      tbody.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', async () => {
        const id = btn.dataset.edit;
        const role = prompt('Set role (super_admin, administrator, batch_lead, team_leader, reviewer_mentor, community_member, alumni):', '');
        if (!role) return;
        const res = await invoke('admin-secure', { action: 'update', table: 'profiles', record_id: id, payload: { role } });
        if (res) load();
      }));
    } catch (e) {
      tbody.innerHTML = A.emptyState('Could not load members. Check Supabase configuration and policies.');
    }
  }

  async function loadApprovals() {
    const container = document.querySelector('[data-approvals]');
    if (!container) return;
    try {
      const { data, error } = await sb.from('memberships').select('id,status,created_at,category,batches(name,year),profiles(full_name,email)').eq('status', 'pending').order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      container.innerHTML = (data || []).map(m => `
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
        if (res) { loadApprovals(); load(); }
      }));
      container.querySelectorAll('[data-reject]').forEach(btn => btn.addEventListener('click', async () => {
        const res = await invoke('membership-approval', { membership_id: btn.dataset.reject, action: 'reject' });
        if (res) { loadApprovals(); load(); }
      }));
    } catch (e) {
      container.innerHTML = '<p class="muted">Could not load approvals. Check Supabase configuration and policies.</p>';
    }
  }

  document.addEventListener('DOMContentLoaded', () => { load(); loadApprovals(); });
})();