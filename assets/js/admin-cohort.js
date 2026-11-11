/* CCD Admin - Tech Cohort module */
(async function () {
  const CCD = window.CCD;
  const A = CCD && CCD.admin;
  if (!A || !A.requireSession) return;
  const session = await A.requireSession();
  if (!session) return;
  const sb = A.sb();

  async function load() {
    const tbody = document.querySelector('#cohortTable tbody');
    if (!tbody) return;
    try {
      const { data, error } = await sb.from('tech_cohorts').select('id,title,theme,event_date,venue,format,batches(name)').order('event_date', { ascending: false }).limit(100);
      if (error) throw error;
      A.renderList(tbody, data, c => `
        <tr>
          <td><strong>${A.esc(c.title)}</strong></td>
          <td>${c.batches ? A.esc(c.batches.name) : ', '}</td>
          <td>${c.event_date || ', '}</td>
          <td>${A.esc(c.venue || 'TBD')}</td>
          <td>${A.esc(c.format || 'hybrid')}</td>
        </tr>`, A.emptyState('No Tech Cohorts yet.'));
    } catch (e) {
      tbody.innerHTML = A.emptyState('Could not load Tech Cohorts. Check Supabase configuration and policies.');
    }
  }

  document.addEventListener('DOMContentLoaded', load);
})();