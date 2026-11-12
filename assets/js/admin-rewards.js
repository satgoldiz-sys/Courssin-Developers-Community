/* CCD Admin - Rewards module */
(async function () {
  const CCD = window.CCD;
  const A = CCD && CCD.admin;
  if (!A || !A.requireSession) return;
  const session = await A.requireSession();
  if (!session) return;
  const sb = A.sb();

  async function load() {
    const tbody = document.querySelector('#rewardsTable tbody');
    if (!tbody) return;
    try {
      const { data, error } = await sb.from('rewards').select('id,title,points_required,eligibility,available').order('points_required').limit(100);
      if (error) throw error;
      A.renderList(tbody, data, r => `
        <tr>
          <td><strong>${A.esc(r.title)}</strong><div class="muted">${A.esc(r.eligibility || '')}</div></td>
          <td>${r.points_required}</td>
          <td>${r.eligibility || 'All'}</td>
          <td>${r.available ? 'Yes' : 'No'}</td>
          <td>
            <button class="btn btn-secondary btn-sm" data-toggle="${r.id}" data-on="${r.available}">${r.available ? 'Disable' : 'Enable'}</button>
            <button class="btn btn-primary btn-sm" data-edit="${r.id}">Edit</button>
          </td>
        </tr>`, A.emptyState('No rewards yet.'));
      tbody.querySelectorAll('[data-toggle]').forEach(btn => btn.addEventListener('click', async () => {
        const res = await A.invoke('admin-secure', { action: 'update', table: 'rewards', record_id: btn.dataset.toggle, payload: { available: btn.dataset.on === 'false' } });
        if (res) load();
      }));
      tbody.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', async () => {
        const id = btn.dataset.edit;
        const points = prompt('Points required:', '');
        if (points === null) return;
        const res = await A.invoke('admin-secure', { action: 'update', table: 'rewards', record_id: id, payload: { points_required: +points } });
        if (res) load();
      }));
    } catch (e) {
      tbody.innerHTML = A.emptyState('Could not load rewards. Check Supabase configuration and policies.');
    }
  }

  CCD.onReady(load);
})();
