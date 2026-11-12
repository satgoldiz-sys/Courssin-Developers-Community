(function () {
  const cfg = window.CCD_CONFIG || {};
  window.CCD = window.CCD || {};

  function getSupabase() {
    if (window.__ccdSupabase) return window.__ccdSupabase;
    if (!window.supabase || !cfg.supabaseUrl || !cfg.supabaseAnonKey) return null;
    window.__ccdSupabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { storage: window.localStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return window.__ccdSupabase;
  }

  function isConfigured() {
    return !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  }

  function setNotice(el, msg, type) {
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'notice' + (type ? ' ' + type : '');
  }

  function getBase() { return document.body.dataset.base || ''; }

  function onReady(callback) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
    else callback();
  }

  window.CCD.getSupabase = getSupabase;
  window.CCD.isConfigured = isConfigured;
  window.CCD.setNotice = setNotice;
  window.CCD.getBase = getBase;
  window.CCD.onReady = onReady;
})();
