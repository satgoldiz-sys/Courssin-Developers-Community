/* CCD Dashboard - Achievements module (member) */
(async function () {
  const CCD = window.CCD;
  const M = CCD && CCD.modules;
  if (!M || !M.requireSession) return;
  const session = await M.requireSession();
  if (!session) return;
  const sb = M.sb();
  const user = CCD.user;

  async function load() {
    const tbody = document.querySelector('#achTable tbody');
    if (!tbody) return;
    try {
      const [{ data: points }, { data: achievements, error: ae }] = await Promise.all([
        sb.from('points').select('points').eq('user_id', user.id),
        sb.from('achievements').select('id,title,description,badge_key,awarded_at').eq('user_id', user.id).order('awarded_at', { ascending: false })
      ]);
      if (ae) throw ae;
      const total = (points || []).reduce((a, r) => a + (r.points || 0), 0);
      const pEl = document.getElementById('achPoints'); if (pEl) pEl.textContent = total;
      const bEl = document.getElementById('achBadges'); if (bEl) bEl.textContent = (achievements || []).length;
      M.renderList(tbody, achievements, a => `
        <tr>
          <td><strong>${M.esc(a.title)}</strong><div class="muted">${M.esc(a.description || '')}</div></td>
          <td>${a.awarded_at ? new Date(a.awarded_at).toLocaleDateString() : ', '}</td>
          <td>${M.esc(a.badge_key || 'Badge')}</td>
        </tr>`, M.emptyState('No achievements yet. Keep contributing to earn recognition.'));
    } catch (e) {
      tbody.innerHTML = M.emptyState('Could not load achievements. Check Supabase configuration and policies.');
    }
  }

  document.addEventListener('DOMContentLoaded', load);
})();