/* CCD Dashboard - Notifications module (member) */
(async function () {
  const CCD = window.CCD;
  const M = CCD && CCD.modules;
  if (!M || !M.requireSession) return;
  const session = await M.requireSession();
  if (!session) return;
  const sb = M.sb();
  const user = CCD.user;
  const noticeEl = () => document.querySelector('[data-dashboard-notice]');
  let rows = [];
  let filter = 'all';

  const TYPE_LABELS = {
    points: 'XP and points', whatsapp: 'WhatsApp group', leadership: 'Leadership', announcement: 'Announcement',
    task: 'Task', event: 'Event', reward: 'Reward', appointment: 'Appointment', membership: 'Membership', system: 'System'
  };
  function typeLabel(type) {
    const key = String(type || '').toLowerCase();
    if (TYPE_LABELS[key]) return TYPE_LABELS[key];
    return key ? key.charAt(0).toUpperCase() + key.slice(1).replace(/[_-]+/g, ' ') : 'Update';
  }

  function emptyRow(msg) { return `<tr><td colspan="4" class="muted">${M.esc(msg)}</td></tr>`; }

  function updateBadges() {
    M.setUnreadBadges(rows.filter(n => !n.read_at).length);
    const unreadBtn = document.querySelector('[data-notif-filter="unread"]');
    if (unreadBtn) unreadBtn.textContent = `Unread (${rows.filter(n => !n.read_at).length})`;
  }

  function render() {
    const tbody = document.querySelector('#notifTable tbody');
    if (!tbody) return;
    const visible = filter === 'unread' ? rows.filter(n => !n.read_at) : rows;
    M.renderList(tbody, visible, n => {
      const rawBody = String(n.body || '');
      const match = n.type === 'whatsapp' && rawBody.match(/https:\/\/[^\s]+/);
      const inviteUrl = match ? M.safeHttpsUrl(match[0].replace(/[),.;]+$/, '')) : '';
      const intro = inviteUrl ? rawBody.replace(match[0], '').replace(/[:\s]+$/, '') : rawBody;
      const bodyHtml = `${M.esc(intro)}${inviteUrl ? ` <a href="${M.esc(inviteUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">Join WhatsApp group</a>` : ''}${n.type === 'points' ? ' <a href="rewards" class="btn btn-secondary btn-sm">View XP and rewards</a>' : ''}`;
      return `
        <tr${n.read_at ? '' : ' style="font-weight:600"'}>
          <td>${M.esc(typeLabel(n.type))}</td>
          <td><strong>${M.esc(n.title || 'Notification')}</strong><div class="muted" style="font-size:.85rem;font-weight:400">${bodyHtml}</div></td>
          <td>${M.esc(M.fmtDate(n.created_at))}</td>
          <td>${n.read_at ? M.esc(M.fmtDate(n.read_at)) : '<button class="btn btn-secondary btn-sm" type="button" data-mark-notification="' + M.esc(n.id) + '">Mark read</button>'}</td>
        </tr>`;
    }, emptyRow(filter === 'unread' ? 'You have no unread notifications.' : 'No notifications yet.'));
    tbody.querySelectorAll('[data-mark-notification]').forEach((button) => button.addEventListener('click', async () => {
      button.disabled = true;
      const id = button.dataset.markNotification;
      const { error } = await sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id).is('read_at', null);
      if (error) { button.disabled = false; M.setNotice(noticeEl(), `Could not update this notification: ${M.errorText(error)}`, 'error'); return; }
      const row = rows.find(n => n.id === id);
      if (row) row.read_at = new Date().toISOString();
      updateBadges();
      render();
    }));
  }

  async function load() {
    const tbody = document.querySelector('#notifTable tbody');
    if (!tbody) return;
    tbody.innerHTML = emptyRow('Loading...');
    try {
      // One plain GET request. The unread count is derived from these rows, so there is no separate HEAD/count request that can fail silently.
      const { data, error } = await sb.from('notifications').select('id,type,title,body,read_at,created_at')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      rows = data || [];
      M.setNotice(noticeEl(), '', '');
      updateBadges();
      render();
    } catch (e) {
      console.error('Could not load member notifications:', e);
      M.showError(tbody, `Could not load notifications. ${M.errorText(e)}`, load, 4);
    }
  }

  function setupToolbar() {
    document.querySelectorAll('[data-notif-filter]').forEach(btn => btn.addEventListener('click', () => {
      filter = btn.dataset.notifFilter;
      document.querySelectorAll('[data-notif-filter]').forEach(b => {
        b.classList.toggle('btn-primary', b === btn);
        b.classList.toggle('btn-secondary', b !== btn);
        b.setAttribute('aria-pressed', String(b === btn));
      });
      render();
    }));
    document.querySelector('[data-mark-all-read]')?.addEventListener('click', async () => {
      if (!rows.some(n => !n.read_at)) return;
      const { error } = await sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null);
      if (error) { M.setNotice(noticeEl(), `Could not mark notifications as read: ${M.errorText(error)}`, 'error'); return; }
      const now = new Date().toISOString();
      rows.forEach(n => { if (!n.read_at) n.read_at = now; });
      updateBadges();
      render();
    });
  }

  CCD.onReady(() => { setupToolbar(); load(); });
})();
