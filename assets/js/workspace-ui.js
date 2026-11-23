/* CCD workspace UI helpers shared by the member and admin overview pages. */
(function () {
  const CCD = (window.CCD = window.CCD || {});
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initials = (name) => String(name || 'CCD').trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || 'C';
  const icons = {
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>',
    video: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="12" height="12" rx="2.5"/><path d="m15 10 6-3v10l-6-3"/></svg>',
    task: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    stop: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>'
  };

  function avatar(name, url) {
    const safe = /^https:\/\//i.test(url || '') ? `<img src="${esc(url)}" alt="">` : esc(initials(name));
    return `<span class="ws-avatar" aria-hidden="true">${safe}</span>`;
  }

  // Seven pill bars, Sunday first like the reference design. counts: array of 7 numbers.
  function weekBars(host, counts, noun) {
    if (!host) return;
    const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const max = Math.max(1, ...counts);
    const top = counts.indexOf(Math.max(...counts));
    const today = new Date().getDay();
    host.innerHTML = counts.map((count, i) => {
      const height = count ? 44 + Math.round((count / max) * 70) : 96;
      const cls = !count ? 'is-empty' : i === today ? 'is-today' : i === top ? 'is-top' : '';
      const tip = count && i === today ? `<span class="ov-bar-tip">${count}</span>` : '';
      return `<div class="ov-bar-col" role="img" aria-label="${count} ${esc(noun || 'items')} on ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][i]}">${tip}<div class="ov-bar ${cls}" style="height:${height}px"></div><span class="ov-bar-label">${labels[i]}</span></div>`;
    }).join('');
  }

  // Semicircle gauge. parts: {done, active, pending}
  function gauge(host, parts) {
    if (!host) return;
    const done = parts.done || 0, active = parts.active || 0, pending = parts.pending || 0;
    const total = done + active + pending;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const cx = 125, cy = 120, r = 98;
    const point = (frac) => { const a = Math.PI * (1 - frac); return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; };
    const arc = (from, to) => {
      if (to - from <= 0.001) return '';
      const [x1, y1] = point(from), [x2, y2] = point(to);
      return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    };
    const a = total ? done / total : 0, b = total ? (done + active) / total : 0;
    host.innerHTML = `<svg viewBox="0 0 250 130" role="img" aria-label="${pct}% complete"><defs><pattern id="ovHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="none"/><rect width="2.4" height="6" fill="#9aa8a0"/></pattern></defs>
      <path d="${arc(0, 1)}" fill="none" stroke="url(#ovHatch)" stroke-width="30" stroke-linecap="butt" opacity="${total ? 1 : .6}"/>
      ${arc(a, b) ? `<path d="${arc(a, b)}" fill="none" stroke="var(--ws-green-dark)" stroke-width="30" stroke-linecap="butt"/>` : ''}
      ${arc(0, a) ? `<path d="${arc(0, a)}" fill="none" stroke="var(--ws-green)" stroke-width="30" stroke-linecap="butt"/>` : ''}</svg>
      <div class="ov-gauge-value"><strong>${pct}%</strong><span>${esc(parts.caption || 'Completed')}</span></div>`;
  }

  // Focus timer: start/pause/stop, remembered in localStorage so a refresh does not lose it.
  function timer(root) {
    if (!root) return;
    const display = root.querySelector('[data-timer-display]');
    const toggle = root.querySelector('[data-timer-toggle]');
    const stop = root.querySelector('[data-timer-stop]');
    const note = root.querySelector('[data-timer-note]');
    const KEY = 'ccd-focus-timer';
    const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
    const write = (value) => { try { value ? localStorage.setItem(KEY, JSON.stringify(value)) : localStorage.removeItem(KEY); } catch { /* storage unavailable */ } };
    let state = read() || { elapsed: 0, startedAt: null };
    let tick = null;
    const total = () => state.elapsed + (state.startedAt ? Date.now() - state.startedAt : 0);
    const fmt = (ms) => { const s = Math.floor(ms / 1000); return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, '0')).join(':'); };
    function paint() {
      display.textContent = fmt(total());
      const running = !!state.startedAt;
      toggle.innerHTML = running ? icons.pause : icons.play;
      toggle.setAttribute('aria-label', running ? 'Pause timer' : 'Start timer');
      if (note) note.textContent = running ? 'Focus session running' : total() ? 'Paused' : 'Ready when you are';
    }
    function loop() { clearInterval(tick); if (state.startedAt) tick = setInterval(paint, 1000); }
    toggle.addEventListener('click', () => {
      if (state.startedAt) { state = { elapsed: total(), startedAt: null }; }
      else state = { elapsed: state.elapsed, startedAt: Date.now() };
      write(state); paint(); loop();
    });
    stop.addEventListener('click', () => { state = { elapsed: 0, startedAt: null }; write(null); paint(); loop(); });
    paint(); loop();
  }

  function statusKind(status) {
    const s = String(status || '').toLowerCase();
    if (['completed', 'complete', 'done', 'approved', 'verified', 'active'].includes(s)) return 'done';
    if (['in_progress', 'in progress', 'submitted', 'review', 'revision_required'].includes(s)) return 'active';
    return 'pending';
  }

  function legalLine() {
    const main = document.querySelector('.app-main');
    if (!main || main.querySelector('.ws-legal')) return;
    const base = document.body.dataset.base || '';
    const el = document.createElement('div');
    el.className = 'ws-legal';
    el.innerHTML = `<span>&copy; ${new Date().getFullYear()} Community of Courssin Developers</span><a href="${base}privacy.html">Privacy</a><a href="${base}terms.html">Terms</a><a href="${base}contact.html">Help</a>`;
    main.appendChild(el);
  }

  CCD.ui = { esc, initials, icons, avatar, weekBars, gauge, timer, statusKind, legalLine };
})();
