/* CCD Dashboard Modules - shared premium UI + live Supabase helpers */
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
    if (['rejected','closed','completed','archived','revision_required'].includes(m)) return 'closed';
    return '';
  }

  function initials(name) {
    const n = (name || '').trim().split(/\s+/);
    return (n[0]?.[0] || '') + (n[1]?.[0] || n[0]?.[1] || '');
  }

  function avatar(user, profile) {
    const name = (profile && profile.full_name) || user?.user_metadata?.full_name || user?.email || 'CCD';
    const src = (profile && profile.avatar_url);
    if (src) return `<img src="${esc(src)}" alt="" style="width:40px;height:40px;border-radius:50%;object-fit:cover">`;
    return `<span style="width:40px;height:40px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:var(--green-gradient);color:#fff;font-weight:700;font-size:.85rem">${esc(initials(name))}</span>`;
  }

  function emptyState(msg) { return `<tr><td colspan="6" class="muted">${esc(msg)}</td></tr>`; }

  CCD.modules = { sb, requireSession, setNotice, renderList, statusClass, initials, avatar, emptyState };
})();