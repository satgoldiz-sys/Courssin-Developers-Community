/* CCD Admin - shared premium helpers */
(function () {
  const CCD = window.CCD;
  if (!CCD) return;
  const esc = CCD.esc || (s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
  CCD.esc = esc;

  function sb() { return CCD.getSupabase(); }

  async function requireSession() {
    const s = CCD.getSupabase();
    if (!s) return null;
    const { data: { session } } = await s.auth.getSession();
    if (!session) { location.href = (CCD.getBase() || '') + 'login'; return null; }
    CCD.session = session; CCD.user = session.user;
    return session;
  }

  function setNotice(el, msg, type) {
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'notice' + (type ? ' ' + type : '');
  }

  function renderList(container, rows, rowFn, empty) {
    if (!container) return;
    const items = rows || [];
    container.innerHTML = items.length ? items.map(rowFn).join('') : empty;
  }

  function statusClass(s) {
    const m = String(s || '').toLowerCase();
    if (['approved','active','completed','open','verified'].includes(m)) return 'approved';
    if (['pending','upcoming','submitted','in_progress','registration_open'].includes(m)) return 'pending';
    if (['rejected','closed','archived','revision_required'].includes(m)) return 'closed';
    return '';
  }

  function emptyState(msg) { return `<tr><td colspan="6" class="muted">${esc(msg)}</td></tr>`; }

  async function invoke(fn, body) {
    const sb = CCD.getSupabase();
    if (!sb) return null;
    const { data, error } = await sb.functions.invoke(fn, { body });
    if (error) console.error('Edge Function error', fn, error);
    return data;
  }

  CCD.admin = { sb, requireSession, setNotice, renderList, statusClass, emptyState, invoke };
})();