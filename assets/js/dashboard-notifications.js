/* CCD Dashboard - Notifications module (member) */
(async function () {
  const CCD = window.CCD;
  const M = CCD && CCD.modules;
  if (!M || !M.requireSession) return;
  const session = await M.requireSession();
  if (!session) return;
  const sb = M.sb();
  const user = CCD.user;

  async function load() {
    const tbody = document.querySelector('#notifTable tbody');
    if (!tbody) return;
    try {
      const { data, error } = await sb.from('notifications').select('id,type,title,body,read_at,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      M.renderList(tbody, data, n => {
        const isLink = n.type === 'whatsapp' && n.body && n.body.startsWith('http');
        const bodyHtml = isLink ? `<a href="${M.esc(n.body)}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">Join WhatsApp group</a>` : M.esc(n.body || '');
        return `
          <tr>
            <td>${M.esc(n.type || 'Update')}</td>
            <td><strong>${M.esc(n.title)}</strong><div class="muted" style="font-size:.85rem">${bodyHtml}</div></td>
            <td>${n.created_at ? new Date(n.created_at).toLocaleDateString() : ', '}</td>
            <td>${n.read_at ? new Date(n.read_at).toLocaleDateString() : 'Unread'}</td>
          </tr>`;
      }, M.emptyState('No notifications yet.'));
    } catch (e) {
      tbody.innerHTML = M.emptyState('Could not load notifications. Check Supabase configuration and policies.');
    }
  }

  document.addEventListener('DOMContentLoaded', load);
})();