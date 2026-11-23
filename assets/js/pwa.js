/* CCD PWA: service worker registration, install pop-up and install helpers. */
(function () {
  const CCD = (window.CCD = window.CCD || {});
  const root = document.documentElement;
  const SNOOZE_KEY = 'ccd-pwa-snooze-until';
  const DONE_KEY = 'ccd-pwa-installed';
  const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;
  const SHOW_DELAY_MS = 2500;

  const store = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* storage unavailable */ } }
  };

  const ua = navigator.userAgent || '';
  const isIOS = (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) && !window.MSStream;
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  let deferred = null;
  let card = null;
  let showTimer = null;
  let state = 'unsupported';

  function setState(next) {
    if (state === next && root.dataset.pwa === next) return;
    state = next;
    root.dataset.pwa = next;
    if (CCD.pwa) CCD.pwa.state = next;
    window.dispatchEvent(new CustomEvent('ccd:pwa-state', { detail: { state: next } }));
  }

  function computeState() {
    if (isStandalone()) return 'installed';
    if (deferred) return 'installable';
    if (isIOS) return 'ios';
    return 'unsupported';
  }

  function base() { return document.body ? (document.body.dataset.base || '') : ''; }

  function injectStyles() {
    if (document.getElementById('ccd-pwa-styles')) return;
    const style = document.createElement('style');
    style.id = 'ccd-pwa-styles';
    style.textContent = `
html[data-pwa="installed"] [data-pwa-install]{display:none!important}
.ccd-pwa-popup{position:fixed;z-index:2147483000;right:max(18px,env(safe-area-inset-right));bottom:max(18px,env(safe-area-inset-bottom));width:min(400px,calc(100vw - 28px));padding:16px;border:1px solid #dbe7de;border-radius:20px;color:#18321f;background:#fff;box-shadow:0 22px 60px rgba(10,40,24,.28);font-family:Inter,"Segoe UI",system-ui,sans-serif;animation:ccdPwaIn 320ms cubic-bezier(.2,.8,.2,1) both}
.ccd-pwa-popup:focus{outline:none}
.ccd-pwa-popup:focus-visible{outline:3px solid #087c4b;outline-offset:2px}
.ccd-pwa-row{display:flex;align-items:center;gap:13px}
.ccd-pwa-logo{flex:0 0 46px;width:46px;height:46px;border-radius:13px;object-fit:contain}
.ccd-pwa-copy{flex:1 1 auto;min-width:0}
.ccd-pwa-copy strong{display:block;font-size:1rem;line-height:1.25}
.ccd-pwa-copy span{display:block;margin-top:3px;color:#5a6d60;font-size:.84rem;line-height:1.4}
.ccd-pwa-actions{display:flex;gap:9px;margin-top:14px}
.ccd-pwa-actions button{flex:1 1 0;min-height:42px;padding:0 14px;border-radius:12px;font:700 .9rem/1 Inter,"Segoe UI",system-ui,sans-serif;cursor:pointer}
.ccd-pwa-install{border:0;color:#fff;background:#087c4b}
.ccd-pwa-install:hover{background:#066a40}
.ccd-pwa-later{border:1px solid #d5e2d9;color:#2d4a37;background:#f4f8f5}
.ccd-pwa-later:hover{background:#e9f2ec}
.ccd-pwa-actions button:focus-visible{outline:3px solid #f3d94d;outline-offset:2px}
.ccd-pwa-steps{margin:12px 0 0;padding-left:20px;color:#3d5545;font-size:.86rem;line-height:1.55}
@keyframes ccdPwaIn{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@media(max-width:600px){.ccd-pwa-popup{right:50%;transform:translateX(50%);bottom:max(14px,env(safe-area-inset-bottom));animation-name:ccdPwaInMobile}@keyframes ccdPwaInMobile{from{opacity:0;transform:translate(50%,18px)}to{opacity:1;transform:translateX(50%)}}}
@media(prefers-reduced-motion:reduce){.ccd-pwa-popup{animation:none}}
[data-theme="dark"] .ccd-pwa-popup{border-color:#2d4435;color:#e7f2e9;background:#15231a}
[data-theme="dark"] .ccd-pwa-copy span,[data-theme="dark"] .ccd-pwa-steps{color:#b4c5b8}
[data-theme="dark"] .ccd-pwa-later{border-color:#334c3b;color:#dcebdf;background:#1d3024}
`;
    document.head.appendChild(style);
  }

  function closeCard(snooze) {
    if (card) { card.remove(); card = null; }
    if (snooze) store.set(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
  }

  function iosSteps() {
    return '<ol class="ccd-pwa-steps"><li>Tap the Share button in Safari.</li><li>Scroll down and tap Add to Home Screen.</li><li>Tap Add. CCD opens like an app.</li></ol>';
  }
  function genericSteps() {
    return '<ol class="ccd-pwa-steps"><li>Open your browser menu.</li><li>Choose Install app or Add to Home screen.</li><li>Confirm to add CCD to your device.</li></ol>';
  }

  function openCard(mode) {
    // mode: 'install' (native prompt available) or 'help' (manual steps)
    injectStyles();
    closeCard(false);
    const help = mode === 'help';
    const steps = isIOS ? iosSteps() : genericSteps();
    card = document.createElement('aside');
    card.className = 'ccd-pwa-popup';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'false');
    card.setAttribute('aria-labelledby', 'ccdPwaTitle');
    card.setAttribute('aria-describedby', 'ccdPwaDesc');
    card.tabIndex = -1;
    const text = help
      ? 'Add CCD to your home screen for one tap access.'
      : 'Get faster access to your dashboard, tasks and notifications.';
    card.innerHTML = `<div class="ccd-pwa-row"><img class="ccd-pwa-logo" src="${base()}assets/images/icons/icon-192.png" alt="" width="46" height="46"><div class="ccd-pwa-copy"><strong id="ccdPwaTitle">Install CCD app</strong><span id="ccdPwaDesc">${text}</span></div></div>${help ? steps : ''}<div class="ccd-pwa-actions">${help ? '' : '<button type="button" class="ccd-pwa-install" data-pwa-act="install">Install</button>'}<button type="button" class="ccd-pwa-later" data-pwa-act="later">${help ? 'Got it' : 'Not now'}</button></div>`;
    document.body.appendChild(card);
    card.addEventListener('click', (event) => {
      const act = event.target.closest('[data-pwa-act]');
      if (!act) return;
      if (act.dataset.pwaAct === 'install') api.install();
      else closeCard(true);
    });
    card.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeCard(true); });
    if (!document.activeElement || document.activeElement === document.body) {
      try { card.focus({ preventScroll: true }); } catch { /* ignore */ }
    }
  }

  function snoozed() { return Number(store.get(SNOOZE_KEY) || 0) > Date.now(); }

  function scheduleAutoShow() {
    if (showTimer || card || snoozed() || state === 'installed' || state === 'unsupported') return;
    showTimer = setTimeout(() => {
      showTimer = null;
      if (card || snoozed() || state === 'installed') return;
      if (state === 'installable') openCard('install');
      else if (state === 'ios') openCard('help');
    }, SHOW_DELAY_MS);
  }

  const api = {
    state,
    canInstall() { return !!deferred; },
    async install() {
      if (state === 'installed') return 'installed';
      if (!deferred) { openCard('help'); return 'manual'; }
      const promptEvent = deferred;
      deferred = null;
      closeCard(false);
      try {
        promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice && choice.outcome === 'accepted') { store.set(DONE_KEY, '1'); setState('installed'); return 'accepted'; }
        store.set(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
        setState(computeState());
        return 'dismissed';
      } catch {
        setState(computeState());
        return 'error';
      }
    }
  };
  CCD.pwa = api;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event;
    setState(computeState());
    scheduleAutoShow();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    store.set(DONE_KEY, '1');
    closeCard(false);
    setState('installed');
  });
  const mq = window.matchMedia('(display-mode: standalone)');
  if (mq.addEventListener) mq.addEventListener('change', () => setState(computeState()));

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-pwa-install]');
    if (!trigger) return;
    event.preventDefault();
    api.install();
  });

  injectStyles();
  setState(computeState());

  function start() {
    scheduleAutoShow();
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      const swUrl = new URL(base() + 'service-worker.js', location.href).pathname;
      navigator.serviceWorker.register(swUrl, { scope: '/' }).catch((error) => console.warn('CCD offline shell could not be registered', error));
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
