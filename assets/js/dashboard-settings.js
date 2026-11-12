/* CCD account and authentication settings. */
(async function () {
  const CCD = window.CCD;
  const M = CCD && CCD.modules;
  if (!M || !M.requireSession) return;
  const session = await M.requireSession();
  if (!session) return;
  const sb = M.sb();
  const user = session.user;
  const email = document.querySelector('[data-account-email]');
  const provider = document.querySelector('[data-account-provider]');
  if (email) email.textContent = user.email || 'No email on this account';
  if (provider) {
    const providers = user.app_metadata?.providers || [user.app_metadata?.provider || 'email'];
    provider.textContent = providers.map((value) => value === 'google' ? 'Google' : 'Email and password').join(', ');
  }

  CCD.onReady(() => {
    const form = document.querySelector('[data-password-form]');
    if (!form) return;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const notice = document.querySelector('[data-account-notice]');
      const password = form.elements.new_password.value;
      const confirmation = form.elements.confirm_password.value;
      if (password.length < 8) return M.setNotice(notice, 'Use a password with at least 8 characters.', 'error');
      if (password !== confirmation) return M.setNotice(notice, 'The passwords do not match.', 'error');
      const button = form.querySelector('[type="submit"]');
      button.disabled = true;
      M.setNotice(notice, 'Updating password…', '');
      try {
        const { error } = await sb.auth.updateUser({ password });
        if (error) throw error;
        form.reset();
        M.setNotice(notice, 'Password updated successfully.', 'success');
      } catch (error) {
        M.setNotice(notice, error.message || 'Could not update your password. Please try again.', 'error');
      } finally {
        button.disabled = false;
      }
    });
  });
})();
