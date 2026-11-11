/* CCD Dashboard - Discussions module (member) */
(async function () {
  const CCD = window.CCD;
  const M = CCD && CCD.modules;
  if (!M || !M.requireSession) return;
  const session = await M.requireSession();
  if (!session) return;
  const sb = M.sb();
  const user = CCD.user;

  async function load() {
    const tbody = document.querySelector('#discussionsTable tbody');
    if (!tbody) return;
    try {
      const { data, error } = await sb.from('discussions').select('id,category,title,user_id,created_at,profiles(full_name)').order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      M.renderList(tbody, data, d => {
        const author = d.profiles ? M.esc(d.profiles.full_name) : 'Member';
        return `
          <tr>
            <td>${M.esc(d.category)}</td>
            <td><strong>${M.esc(d.title)}</strong></td>
            <td>${author}</td>
            <td>${d.created_at ? new Date(d.created_at).toLocaleDateString() : ', '}</td>
            <td><a class="btn btn-secondary btn-sm" href="#">Open</a></td>
          </tr>`;
      }, M.emptyState('No discussions yet.'));
    } catch (e) {
      tbody.innerHTML = M.emptyState('Could not load discussions. Check Supabase configuration and policies.');
    }
  }

  document.addEventListener('DOMContentLoaded', load);
})();