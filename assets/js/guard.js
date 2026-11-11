(async function () {
  const CCD = window.CCD;
  if (!CCD) return;
  const requireAuth = document.body.dataset.requireAuth === 'true';
  const requireAdmin = document.body.dataset.requireAdmin === 'true';
  if (!requireAuth && !requireAdmin) return;
  const base = CCD.getBase();
  if (!CCD.isConfigured()) {
    location.href = base + 'login.html?setup=1';
    return;
  }
  const sb = CCD.getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    location.href = base + 'login.html?next=' + encodeURIComponent(location.pathname + location.search);
    return;
  }
  window.CCD.session = session;
  window.CCD.user = session.user;
  if (requireAdmin) {
    const { data: profile } = await sb.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
    const role = profile && profile.role;
    const ok = ['super_admin','administrator'].includes(role);
    if (!ok) location.href = base + 'dashboard/index.html';
    window.CCD.role = role;
  }
  document.documentElement.classList.add('authed');
})();