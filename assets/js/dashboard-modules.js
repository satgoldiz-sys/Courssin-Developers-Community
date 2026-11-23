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
    if (['pending','upcoming','submitted','in_progress','under_review','assigned','planning','registration_open'].includes(m)) return 'pending';
    if (['rejected','closed','archived','revision_required','on_hold'].includes(m)) return 'closed';
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

  function safeHttpsUrl(value) {
    try { const url = new URL(String(value || '').trim()); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; }
  }

  function fmtDate(value, withTime) {
    if (!value) return 'N/A';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return withTime ? d.toLocaleString() : d.toLocaleDateString();
  }

  // Turns any Supabase/PostgREST/network error into text a person can act on.
  // Empty messages (HEAD requests, gateway errors) fall back to code, details, hint, then HTTP status.
  function errorText(e) {
    if (!e) return 'Unknown error.';
    const parts = [e.message, e.details, e.hint].filter(v => typeof v === 'string' && v.trim());
    const code = e.code || e.status || e.statusCode;
    const raw = parts.join(' ');
    const text = (raw || (code ? `Request failed (code ${code})` : 'The request failed without a message')).trim();
    const lower = `${raw} ${code || ''}`.toLowerCase();
    let hint = '';
    if (/42501|permission denied|row-level security|rls|403|401|jwt/.test(lower)) hint = ' Your account is not allowed to read or write this data yet. An administrator needs to run supabase/fix_dashboard_tools.sql in the Supabase SQL Editor.';
    else if (/42p01|pgrst205|pgrst202|does not exist|could not find the (table|function)/.test(lower)) hint = ' A database table or function is missing. Run supabase/fix_dashboard_tools.sql in the Supabase SQL Editor.';
    else if (/failed to fetch|networkerror|network request|load failed/.test(lower)) hint = ' Check your internet connection and try again.';
    return text + hint;
  }

  // Replaces a container's content with an error message and a Retry button (table bodies get a full-width row).
  function showError(container, message, retry, cols) {
    if (!container) return;
    const isBody = container.tagName === 'TBODY';
    const inner = `<div class="notice error load-error" role="alert" style="margin:0;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><span>${esc(message)}</span>${retry ? ' <button class="btn btn-secondary btn-sm" type="button" data-retry>Retry</button>' : ''}</div>`;
    container.innerHTML = isBody ? `<tr><td colspan="${cols || 6}">${inner}</td></tr>` : inner;
    const btn = container.querySelector('[data-retry]');
    if (btn && retry) btn.addEventListener('click', () => { btn.disabled = true; retry(); });
  }

  // Keeps every unread badge on the page in sync.
  function setUnreadBadges(count) {
    const text = count > 99 ? '99+' : String(count || '');
    document.querySelectorAll('[data-header-unread],[data-workspace-unread]').forEach(el => {
      el.textContent = text;
      el.hidden = !count;
    });
  }

  // Names and photos for other members (profiles is private, so this goes through a safe database function).
  async function publicProfiles(ids) {
    const unique = [...new Set((ids || []).filter(Boolean))];
    const map = new Map();
    if (!unique.length) return map;
    try {
      const { data, error } = await sb().rpc('get_public_profiles', { p_ids: unique });
      if (!error) (data || []).forEach(p => map.set(p.id, p));
    } catch { /* fall back to generic names */ }
    return map;
  }

  CCD.modules = { sb, requireSession, setNotice, renderList, statusClass, initials, avatar, emptyState, esc, safeHttpsUrl, fmtDate, errorText, showError, setUnreadBadges, publicProfiles };
})();