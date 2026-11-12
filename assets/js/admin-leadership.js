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

  CCD.onReady(load);
})();
