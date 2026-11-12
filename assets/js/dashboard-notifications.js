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
      const { count: unreadCount } = await sb.from('notifications').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).is('read_at', null);
      const badge = document.querySelector('[data-header-unread]');
      if (badge) {
        badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount || '');
        badge.hidden = !unreadCount;
      }
      M.renderList(tbody, data, n => {
        const rawBody = String(n.body || '');
        const match = n.type === 'whatsapp' && rawBody.match(/https:\/\/[^\s]+/);
        let inviteUrl = '';
        if (match) {
          try { const url = new URL(match[0].replace(/[),.;]+$/, '')); if (url.protocol === 'https:') inviteUrl = url.href; } catch { /* Ignore invalid stored URLs. */ }
        }
        const intro = inviteUrl ? rawBody.replace(match[0], '').replace(/[:\s]+$/, '') : rawBody;
        const bodyHtml = `${M.esc(intro)}${inviteUrl ? ` <a href="${M.esc(inviteUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">Join WhatsApp group</a>` : ''}`;
        return `
          <tr>
            <td>${M.esc(n.type || 'Update')}</td>
            <td><strong>${M.esc(n.title)}</strong><div class="muted" style="font-size:.85rem">${bodyHtml}</div></td>
            <td>${n.created_at ? new Date(n.created_at).toLocaleDateString() : ', '}</td>
            <td>${n.read_at ? new Date(n.read_at).toLocaleDateString() : '<button class="btn btn-secondary btn-sm" data-mark-notification="' + M.esc(n.id) + '">Mark read</button>'}</td>
          </tr>`;
      }, M.emptyState('No notifications yet.'));
      tbody.querySelectorAll('[data-mark-notification]').forEach((button) => button.addEventListener('click', async () => {
        const { error: updateError } = await sb.from('notifications').update({ read_at: new Date().toISOString() })
          .eq('id', button.dataset.markNotification).eq('user_id', user.id).is('read_at', null);
        if (updateError) M.setNotice(document.querySelector('[data-dashboard-notice]'), 'Could not update this notification.', 'error');
        else load();
      }));
    } catch (e) {
      tbody.innerHTML = M.emptyState('Could not load notifications. Check Supabase configuration and policies.');
    }
  }

  CCD.onReady(() => {
    load();
    document.querySelector('[data-mark-all-read]')?.addEventListener('click', async () => {
      const { error } = await sb.from('notifications').update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id).is('read_at', null);
      if (error) M.setNotice(document.querySelector('[data-dashboard-notice]'), 'Could not mark notifications as read.', 'error');
      else load();
    });
  });
})();
