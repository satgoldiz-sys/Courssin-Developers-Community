/* CCD client side protection. Real enforcement lives in Supabase (RLS, rate limit SQL, Edge Functions);
   this layer slows abuse, stops accidental double submits and gives clear feedback. Load before supabase-client.js. */
(function () {
  'use strict';
  const CCD = (window.CCD = window.CCD || {});

  // Frame busting fallback (the CSP frame-ancestors header is the primary defence).
  try {
    if (window.top !== window.self) {
      document.documentElement.style.display = 'none';
      window.top.location.replace(window.self.location.href);
    }
  } catch { document.documentElement.style.display = 'none'; }

  const store = {
    get(key) { try { return window.localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { window.localStorage.setItem(key, value); } catch { /* storage unavailable */ } },
    del(key) { try { window.localStorage.removeItem(key); } catch { /* storage unavailable */ } }
  };
  const realFetch = window.fetch ? window.fetch.bind(window) : null;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function limited(message, retrySeconds) {
    return new Response(JSON.stringify({ error: message, message }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(Math.max(1, Math.ceil(retrySeconds || 1))) }
    });
  }

  /* Token bucket: burst 20, refill 8 per second. Requests wait briefly when empty instead of failing. */
  const bucket = { tokens: 20, max: 20, perSecond: 8, last: Date.now() };
  function takeToken() {
    const now = Date.now();
    bucket.tokens = Math.min(bucket.max, bucket.tokens + ((now - bucket.last) / 1000) * bucket.perSecond);
    bucket.last = now;
    if (bucket.tokens >= 1) { bucket.tokens -= 1; return 0; }
    return Math.ceil(((1 - bucket.tokens) / bucket.perSecond) * 1000);
  }

  /* Per endpoint sliding windows. */
  const windows = new Map();
  function allow(key, max, windowMs) {
    const now = Date.now();
    const hits = (windows.get(key) || []).filter((t) => now - t < windowMs);
    if (hits.length >= max) { windows.set(key, hits); return Math.ceil((windowMs - (now - hits[0])) / 1000); }
    hits.push(now);
    windows.set(key, hits);
    return 0;
  }

  /* Progressive login lockout, persisted so a page reload does not reset it. */
  const LOCK_KEY = 'ccd-login-guard';
  function readLock() {
    try { const v = JSON.parse(store.get(LOCK_KEY) || '{}'); return { fails: +v.fails || 0, until: +v.until || 0, level: +v.level || 0 }; }
    catch { return { fails: 0, until: 0, level: 0 }; }
  }
  function writeLock(v) { store.set(LOCK_KEY, JSON.stringify(v)); }
  function lockSecondsLeft() { return Math.max(0, Math.ceil((readLock().until - Date.now()) / 1000)); }
  function registerLoginFailure() {
    const lock = readLock();
    lock.fails += 1;
    if (lock.fails >= 5) {
      lock.level += 1;
      lock.fails = 0;
      lock.until = Date.now() + Math.min(15 * 60, 30 * Math.pow(2, lock.level - 1)) * 1000;
    }
    writeLock(lock);
    if (lock.until > Date.now()) window.dispatchEvent(new CustomEvent('ccd:login-locked'));
  }
  function registerLoginSuccess() { store.del(LOCK_KEY); }

  function isLoginRequest(url, init) {
    if (/\/functions\/v1\/login-lockout/.test(url)) return true;
    return /\/auth\/v1\/token\?(?:[^#]*&)?grant_type=password/.test(url);
  }

  async function watchLogin(response) {
    try {
      if (response.status === 429) return;
      if (!response.ok && response.status !== 400 && response.status !== 401) return;
      const body = await response.clone().json().catch(() => null);
      if (body && body.access_token) registerLoginSuccess();
      else if (body && body.locked) return;
      else if (!response.ok || (body && body.error)) registerLoginFailure();
    } catch { /* never break the request because of bookkeeping */ }
  }

  async function safeFetch(input, init) {
    if (!realFetch) throw new Error('fetch is not available');
    let url = '';
    try { url = typeof input === 'string' ? input : (input && input.url) || String(input); } catch { url = ''; }
    const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();

    const login = isLoginRequest(url, init);
    if (login) {
      const left = lockSecondsLeft();
      if (left > 0) return limited(`Too many sign-in attempts. Try again in ${left} second${left === 1 ? '' : 's'}.`, left);
      const burst = allow('login', 8, 60000);
      if (burst) return limited(`Too many sign-in attempts. Try again in ${burst} second${burst === 1 ? '' : 's'}.`, burst);
    } else if (/\/auth\/v1\/(signup|recover|otp|resend)/.test(url)) {
      const retry = allow('auth-mail', 4, 60000);
      if (retry) return limited(`Please wait ${retry} seconds before trying again.`, retry);
    } else if (/\/functions\/v1\//.test(url)) {
      const name = (url.match(/\/functions\/v1\/([^/?#]+)/) || [])[1] || 'fn';
      const retry = allow('fn:' + name, 12, 60000);
      if (retry) return limited(`Too many requests. Please wait ${retry} seconds.`, retry);
    } else if (method !== 'GET' && method !== 'HEAD' && /\/rest\/v1\//.test(url)) {
      const retry = allow('write', 90, 60000);
      if (retry) return limited(`You are doing that too quickly. Please wait ${retry} seconds.`, retry);
    }

    const delay = takeToken();
    if (delay > 5000) return limited('Too many requests. Please slow down.', 5);
    if (delay > 0) await wait(delay);

    const response = await realFetch(input, init);
    if (login) watchLogin(response);
    return response;
  }
  CCD.safeFetch = safeFetch;

  /* Form guard: honeypot, minimum fill time, double submit lock, login countdown. */
  const GUARDED = 'form[data-auth], form[data-membership-form], form[data-contact-form], form[data-password-form]';
  const seen = new WeakMap();
  const lastSubmit = new WeakMap();

  function addHoneypot(form) {
    if (form.querySelector('input[data-ccd-hp]')) return;
    const wrap = document.createElement('div');
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText = 'position:absolute!important;left:-10000px!important;width:1px;height:1px;overflow:hidden';
    const input = document.createElement('input');
    input.type = 'text';
    input.name = 'ccd_website_hp';
    input.tabIndex = -1;
    input.autocomplete = 'off';
    input.setAttribute('data-ccd-hp', '');
    wrap.appendChild(input);
    form.appendChild(wrap);
  }

  function scan() {
    document.querySelectorAll(GUARDED).forEach((form) => {
      if (seen.has(form)) return;
      seen.set(form, Date.now());
      addHoneypot(form);
    });
    document.querySelectorAll('a[target="_blank"]').forEach((a) => {
      const rel = (a.getAttribute('rel') || '').split(/\s+/).filter(Boolean);
      let changed = false;
      ['noopener', 'noreferrer'].forEach((token) => { if (!rel.includes(token)) { rel.push(token); changed = true; } });
      if (changed) a.setAttribute('rel', rel.join(' '));
    });
  }

  let countdownTimer = null;
  function showCountdown(form) {
    const notice = form.querySelector('[data-notice]');
    const buttons = form.querySelectorAll('[type="submit"]');
    clearInterval(countdownTimer);
    function tick() {
      const left = lockSecondsLeft();
      if (left <= 0) {
        clearInterval(countdownTimer);
        buttons.forEach((b) => { b.disabled = false; });
        if (notice && /Too many sign-in attempts/.test(notice.textContent)) { notice.textContent = ''; notice.className = 'notice'; }
        return;
      }
      buttons.forEach((b) => { b.disabled = true; });
      if (notice) {
        notice.textContent = `Too many sign-in attempts. You can try again in ${left} second${left === 1 ? '' : 's'}.`;
        notice.className = 'notice error';
      }
    }
    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  function loginForm() { return document.querySelector('form[data-auth="login"], form[data-auth="admin-login"]'); }

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.matches(GUARDED)) return;
    const block = () => { event.preventDefault(); event.stopImmediatePropagation(); };

    const hp = form.querySelector('input[data-ccd-hp]');
    if (hp && hp.value) { block(); return; }
    const born = seen.get(form) || Date.now();
    if (Date.now() - born < 1200) { block(); return; }

    const prev = lastSubmit.get(form) || 0;
    if (Date.now() - prev < 800) { block(); return; }
    lastSubmit.set(form, Date.now());

    if (form.matches('form[data-auth="login"], form[data-auth="admin-login"]') && lockSecondsLeft() > 0) {
      block();
      showCountdown(form);
    }
  }, true);

  window.addEventListener('ccd:login-locked', () => { const form = loginForm(); if (form) showCountdown(form); });

  function init() {
    scan();
    const form = loginForm();
    if (form && lockSecondsLeft() > 0) showCountdown(form);
    if (window.MutationObserver) new MutationObserver(() => scan()).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
