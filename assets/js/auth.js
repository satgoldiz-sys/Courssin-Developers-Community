(function () {
  const CCD = window.CCD;
  const googleIcon = '<svg viewBox="0 0 18 18" aria-hidden="true" focusable="false"><path fill="#EA4335" d="M9 3.48c1.69 0 2.83.73 3.48 1.34l2.54-2.48C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.91 2.26C4.6 5.05 6.62 3.48 9 3.48z"/><path fill="#4285F4" d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.1.83-.64 2.08-1.84 2.92l2.84 2.2c1.7-1.57 2.68-3.88 2.68-6.62z"/><path fill="#FBBC05" d="M3.87 10.78A5.54 5.54 0 0 1 3.58 9c0-.62.11-1.22.29-1.78L.96 4.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.91-2.26z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.84-2.2c-.76.53-1.78.9-3.12.9-2.38 0-4.4-1.57-5.12-3.74L.97 13.04C2.45 15.98 5.48 18 9 18z"/></svg>';

  function ensureConfigured(notice) {
    if (CCD.isConfigured()) return true;
    CCD.setNotice(notice, 'Supabase is not configured. Add your public Supabase URL and anon key in assets/js/config.js, enable Google provider in Supabase Auth, and reload.', 'error');
    return false;
  }

  async function signInWithGoogle(notice) {
    if (!ensureConfigured(notice)) return;
    const sb = CCD.getSupabase();
    const redirectTo = location.origin + location.pathname.replace(/\/[^/]*$/, '') + '/' + CCD.getBase() + 'dashboard';
    CCD.setNotice(notice, 'Redirecting to Google...', '');
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (error) CCD.setNotice(notice, error.message, 'error');
  }

  async function handleLogin(form) {
    const notice = form.querySelector('[data-notice]');
    const lockoutNotice = document.getElementById('lockoutNotice');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (lockoutNotice) { lockoutNotice.style.display = 'none'; lockoutNotice.textContent = ''; }
      if (!ensureConfigured(notice)) return;
      const sb = CCD.getSupabase();
      const email = form.email.value.trim();
      const password = form.password.value;
      CCD.setNotice(notice, 'Signing in...', '');

      // Server-side progressive lockout via Edge Function
      try {
        const { data, error } = await sb.functions.invoke('login-lockout', { body: { email, password } });
        if (error) {
          CCD.setNotice(notice, error.message || 'Sign-in failed.', 'error');
          return;
        }
        if (data && data.locked) {
          CCD.setNotice(notice, '', '');
          if (lockoutNotice) {
            lockoutNotice.textContent = `Account temporarily locked. Try again in ${data.lockout_remaining_minutes} minute(s).`;
            lockoutNotice.style.display = 'block';
          }
          return;
        }
        if (data && data.access_token) {
          // Persist session returned by the Edge Function
          const { error: setErr } = await sb.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token
          });
          if (setErr) CCD.setNotice(notice, setErr.message, 'error');
          else location.href = CCD.getBase() + 'dashboard';
          return;
        }
      } catch (err) {
        CCD.setNotice(notice, err.message || 'Sign-in failed.', 'error');
        return;
      }

      // Fallback: direct Supabase Auth (if Edge Function not deployed)
      const { data: direct, error: directErr } = await sb.auth.signInWithPassword({ email, password });
      if (directErr) return CCD.setNotice(notice, directErr.message, 'error');
      if (direct && direct.user) location.href = CCD.getBase() + 'dashboard';
    });
    const g = form.querySelector('[data-google]');
    if (g) g.addEventListener('click', () => signInWithGoogle(notice));
  }

  async function handleRegister(form) {
    const notice = form.querySelector('[data-notice]');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!ensureConfigured(notice)) return;
      const fullName = form.fullName.value.trim();
      const email = form.email.value.trim();
      const password = form.password.value;
      const confirm = form.confirmPassword.value;
      if (password !== confirm) return CCD.setNotice(notice, 'Passwords do not match.', 'error');
      if (password.length < 8) return CCD.setNotice(notice, 'Password must be at least 8 characters.', 'error');
      const sb = CCD.getSupabase();
      CCD.setNotice(notice, 'Creating your account...', '');
      const redirectTo = location.origin + location.pathname.replace(/\/[^/]*$/, '') + '/' + CCD.getBase() + 'login.html';
      const { data, error } = await sb.auth.signUp({
        email, password,
        options: { data: { full_name: fullName }, emailRedirectTo: redirectTo }
      });
      if (error) return CCD.setNotice(notice, error.message, 'error');
      if (data && data.user && !data.session) {
        CCD.setNotice(notice, 'Account created. Check your email to verify your address, then log in to complete membership registration.', 'success');
        form.reset();
      } else if (data && data.session) {
        location.href = CCD.getBase() + 'dashboard';
      }
    });
    const g = form.querySelector('[data-google]');
    if (g) g.addEventListener('click', () => signInWithGoogle(notice));
  }

  function mountGoogleButtons() {
    document.querySelectorAll('[data-google]').forEach((btn) => {
      if (btn.dataset.ready) return;
      btn.dataset.ready = '1';
      btn.innerHTML = googleIcon + '<span>' + (btn.dataset.label || 'Continue with Google') + '</span>';
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!window.CCD) return;
    mountGoogleButtons();
    const login = document.querySelector('[data-auth="login"]');
    const register = document.querySelector('[data-auth="register"]');
    if (login) handleLogin(login);
    if (register) handleRegister(register);
  });
})();