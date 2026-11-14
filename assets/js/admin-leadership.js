/* CCD Admin - Leadership module */
(async function () {
  const CCD = window.CCD;
  const A = CCD && CCD.admin;
  if (!A || !A.requireSession) return;
  const session = await A.requireSession();
  if (!session) return;
  const sb = A.sb();

  async function load() {
    const tbody = document.querySelector('#leadershipTable tbody');
    if (!tbody) return;
    try {
      const { data, error } = await sb.from('batch_leadership').select('id,batch_id,user_id,position,responsibilities,active,appointed_at,batches(name),profiles!batch_leadership_user_id_fkey(full_name)').order('appointed_at', { ascending: false }).limit(100);
      if (error) throw error;
      A.renderList(tbody, data, l => `
        <tr>
          <td>${l.batches ? A.esc(l.batches.name) : ', '}</td>
          <td>${l.profiles ? A.esc(l.profiles.full_name) : 'Member'}</td>
          <td>${A.esc(l.position)}</td>
          <td>${l.active ? 'Yes' : 'No'}</td>
          <td>${l.appointed_at || ', '}</td>
        </tr>`, A.emptyState('No leadership appointments yet.'));
    } catch (e) {
      console.error('Could not load leadership records:', e);
      tbody.innerHTML = A.emptyState('Could not load leadership. Check Supabase configuration and policies.');
    }
  }

  async function setupAppointment() {
    const form = document.querySelector('[data-leadership-form]');
    if (!form) return;
    const [membersResult, batchesResult] = await Promise.all([
      sb.functions.invoke('admin-secure', { body: { action: 'members-data' } }),
      sb.from('batches').select('id,name,year').order('year', { ascending: false }).limit(200)
    ]);
    const memberSelect = form.elements.user_id;
    const batchSelect = form.elements.batch_id;
    if (membersResult.error || !membersResult.data?.ok) A.setNotice(document.querySelector('[data-dashboard-notice]'), 'Could not load members for leadership appointments.', 'error');
    memberSelect.innerHTML = '<option value="">Select a member</option>' + (membersResult.data?.profiles || []).map(p => `<option value="${A.esc(p.id)}">${A.esc(p.full_name || p.email || 'Member')} — ${A.esc(p.email || '')}</option>`).join('');
    if (batchesResult.error) A.setNotice(document.querySelector('[data-dashboard-notice]'), 'Could not load batches for leadership appointments.', 'error');
    batchSelect.innerHTML = '<option value="">Select a batch</option>' + (batchesResult.data || []).map(b => `<option value="${A.esc(b.id)}">${A.esc(b.name)} ${A.esc(b.year)}</option>`).join('');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const payload = { user_id: memberSelect.value, batch_id: batchSelect.value, position: form.elements.position.value.trim(), responsibilities: form.elements.responsibilities.value.trim() || null, active: true, appointed_at: new Date().toISOString().slice(0,10) };
      const { data, error } = await sb.functions.invoke('admin-secure', { body: { action: 'insert', table: 'batch_leadership', payload } });
      if (error || !data?.ok) return A.setNotice(document.querySelector('[data-dashboard-notice]'), error?.message || data?.error || 'The appointment could not be saved.', 'error');
      A.setNotice(document.querySelector('[data-dashboard-notice]'), 'Appointment saved. The member received an in-app notification and an email when Resend is configured.', 'success');
      form.reset();
      load();
    });
  }

  CCD.onReady(() => { load(); setupAppointment(); });
})();
