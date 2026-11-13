/* Route a completed Google OAuth sign-in into the correct role workspace. */
(async function () {
  const CCD = window.CCD;
  if (!CCD || !CCD.isConfigured()) return;
  const status = document.querySelector('[data-auth-routing-status]');
  const notice = document.querySelector('[data-auth-routing-notice]');
  const retry = document.querySelector('[data-auth-retry]');
  const sb = CCD.getSupabase();
  try {
    const { data: { session }, error: sessionError } = await sb.auth.getSession();
    if (sessionError || !session) throw new Error('Your sign-in could not be completed. Please sign in again.');
    const { error: securityNoticeError } = await sb.functions.invoke('auth-security-notice', { body: { action: 'sign_in' } });
    if (securityNoticeError) console.warn('Sign-in succeeded, but device security notification could not be checked.', securityNoticeError.message);
    const { data: profile, error: profileError } = await sb.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
    if (profileError) throw new Error('Your account could not be verified right now. Please try again.');
    const isAdmin = ['super_admin', 'administrator'].includes(profile?.role);
    const siteUrl = (window.CCD_CONFIG?.siteUrl || location.origin).replace(/\/+$/, '');
    location.replace(`${siteUrl}/${isAdmin ? 'admin' : 'dashboard'}`);
  } catch (error) {
    if (status) status.textContent = 'We could not route your sign-in automatically.';
    if (CCD) CCD.setNotice(notice, error.message || 'Please return to sign in and try again.', 'error');
    if (retry) retry.hidden = false;
  }
})();
