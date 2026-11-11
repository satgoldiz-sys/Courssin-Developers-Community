(function () {
  const BRAND = {
    name: "Community of Courssin Developers",
    short: "CCD",
    tagline: "BUILD • LEARN • INNOVATE • GROW"
  };

  function logoSvg() {
    return `
      <svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <rect width="64" height="64" rx="12" fill="#063B2A"/>
        <rect x="3" y="3" width="58" height="58" rx="10" fill="none" stroke="#FFD21F" stroke-opacity="0.35"/>
        <path d="M20 20h10v6h-4v12h4v6H20zM34 20h10v24h-6V26h-4z" fill="#FFD21F"/>
      </svg>`;
  }

function navLinks(base) {
    return [
      ["About", "about"],
      ["Membership", "membership"],
      ["Activities", "activities"],
      ["Projects", "projects"],
      ["Community", "community"],
      ["Events", "events"],
      ["Tech Cohort", "tech-cohort"]
    ].map(([label, href]) => `<a href="${base}${href}">${label}</a>`).join("");
  }

  function header(base) {
    return `
      <a class="skip-link" href="#main">Skip to main content</a>
      <header class="site-header" data-header>
        <div class="container nav-wrap">
          <a class="brand" href="${base}index.html" aria-label="Community of Courssin Developers home">
            ${logoSvg()}
            <span class="brand-text">
              <strong>${brandWordmark()}</strong>
            </span>
          </a>
          <div class="nav-mobile-controls">
            <button class="btn btn-ghost theme-toggle theme-toggle-sm" type="button" data-theme-toggle aria-label="Toggle dark mode"></button>
            <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="main-nav" data-nav-toggle aria-label="Toggle navigation">
              <span aria-hidden="true">&#9776;</span>
            </button>
          </div>
          <nav id="main-nav" class="nav-links" aria-label="Main navigation">${navLinks(base)}</nav>
          <div class="nav-actions">
            <a class="btn btn-ghost" href="${base}login.html">Log in</a>
            <button class="btn btn-ghost theme-toggle theme-toggle-desktop" type="button" data-theme-toggle aria-label="Toggle dark mode"></button>
            <a class="btn btn-primary" href="${base}register.html">Sign up</a>
          </div>
        </div>
      </header>`;
  }

  function footer(base) {
    const year = new Date().getFullYear();
    return `
      <footer class="site-footer">
        <div class="container footer-top">
          <div class="footer-grid">
            <div class="footer-brand">
              <a class="brand" href="${base}">${logoSvg()}<span class="brand-text"><strong>${brandWordmark()}</strong></span></a>
              <p>A global developer community where programmers, software engineers, and tech creators connect, learn together, build real projects, and grow through collaboration, mentorship, and hands-on experience.</p>
            </div>
            <div class="footer-col">
              <h5>Quick Links</h5>
              <ul>
<li><a href="${base}about">About CCD</a></li>
                <li><a href="${base}membership">Membership</a></li>
                <li><a href="${base}events">Events</a></li>
                <li><a href="${base}tech-cohort">Tech Cohort</a></li>
              </ul>
            </div>
<div class="footer-col">
              <h5>Community</h5>
              <ul>
                <li><a href="${base}activities">Activities</a></li>
                <li><a href="${base}projects">Projects</a></li>
              </ul>
            </div>
            <div class="footer-col">
              <h5>Account</h5>
              <ul>
                <li><a href="${base}login">Log in</a></li>
                <li><a href="${base}register">Sign up</a></li>
                <li><a href="${base}contact">Contact</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div class="footer-bottom">
          <div class="container footer-bottom-inner">
            <span>&copy; ${year} Community of Courssin Developers</span>
            <span class="footer-links">
<a href="${base}about">About</a>
              <a href="${base}contact">Contact</a>
              <span>${BRAND.tagline}</span>
            </span>
          </div>
        </div>
      </footer>`;
  }

function setActiveLinks() {
    const path = location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
    document.querySelectorAll('.nav-links a, .footer-col a, .footer-links a').forEach((a) => {
      const href = (a.getAttribute('href') || '').replace(/\.html$/, '');
      if (!href) return;
      const norm = href.replace(/^\//, '');
      const cur = path.replace(/^\//, '');
      if (norm === cur || (cur === '' && norm === 'index')) a.setAttribute('aria-current', 'page');
    });
  }

  function setupNav() {
    const headerEl = document.querySelector('[data-header]');
    const toggle = document.querySelector('[data-nav-toggle]');
    if (!headerEl || !toggle) return;
    toggle.addEventListener('click', () => {
      const open = headerEl.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  function themeIcon() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return dark
      ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>'
      : '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3c.2 0 .4 0 .6.02A7 7 0 0 0 21 12.79z"/></svg>';
  }

  function syncThemeButtons() {
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      btn.innerHTML = themeIcon();
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      btn.setAttribute('title', dark ? 'Light mode' : 'Dark mode');
    });
  }

  function setupTheme() {
    const key = 'ccd-theme';
    const saved = localStorage.getItem(key);
    if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    syncThemeButtons();
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (isDark) {
          document.documentElement.removeAttribute('data-theme');
          localStorage.removeItem(key);
        } else {
          document.documentElement.setAttribute('data-theme', 'dark');
          localStorage.setItem(key, 'dark');
        }
        syncThemeButtons();
      });
    });
  }

  function setupReveal() {
    const els = document.querySelectorAll('.reveal');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('is-visible'); });
    }, { threshold: 0.12 });
    els.forEach((el) => io.observe(el));
  }

  function brandWordmark(extraClass) {
    return `<span class="brand-wordmark brand-outline ${extraClass || ''}"><span class="w-community">Community</span><span class="w-of">Of Courssin</span><span class="w-developers">Developers</span></span>`;
  }
  function brandCCD() {
    return `<span class="brand-ccd brand-outline" aria-label="CCD"><span class="c1">C</span><span class="c2">C</span><span class="c3">D</span></span>`;
  }

  function decorateCCD(root) {
    const scope = root || document.getElementById('main') || document.body;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || node.nodeValue.indexOf('CCD') === -1) return NodeFilter.FILTER_REJECT;
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (p.closest('.brand-ccd,.brand-wordmark,script,style,textarea,code,pre,noscript,option')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const parts = node.nodeValue.split(/\b(CCD)\b/g);
      if (parts.length < 2) return;
      const frag = document.createDocumentFragment();
      parts.forEach((part) => {
        if (part === 'CCD') {
          const span = document.createElement('span');
          span.className = 'brand-ccd brand-outline';
          span.setAttribute('aria-label', 'CCD');
          span.innerHTML = '<span class="c1">C</span><span class="c2">C</span><span class="c3">D</span>';
          frag.appendChild(span);
        } else if (part) frag.appendChild(document.createTextNode(part));
      });
      node.parentNode.replaceChild(frag, node);
    });
  }

  function sampleEvents() {
    const imgs = ['photos/meetup.jpg','photos/hackathon.jpg','photos/workshop.jpg','photos/cohort.jpg'];
    return [
      { title: 'NextGen Developers Meetup', type: 'Meetup', date: 'Saturday, 26 December 2026', location: 'Zoom', image: imgs[0], desc: 'Kick off the holiday season by connecting with developers, designers, tech enthusiasts, and aspiring professionals from different backgrounds. Expect insightful discussions on emerging technologies, practical learning sessions, networking opportunities, and inspiration for your tech journey in the coming year.' },
      { title: 'TechXperience 2027', type: 'Conference', date: 'Saturday, 30 January 2027', location: 'Venue to be announced soon', image: imgs[1], desc: 'Start the year with a high-impact physical tech experience featuring expert speakers, hands-on demonstrations, interactive sessions, career opportunities, and meaningful networking. Whether you are a beginner or an experienced professional, TechXperience 2027 is designed to help you learn, connect, and grow.' },
      { title: 'Tech Talks & Networking', type: 'Talks', date: 'Saturday, 3 April 2027', location: 'Zoom', image: imgs[2], desc: 'Join an engaging virtual gathering where technology professionals, students, entrepreneurs, and innovators come together to share ideas, discuss industry trends, explore emerging technologies, and build valuable professional connections, all from anywhere in the world.' },
      { title: 'TechFest 2027', type: 'Festival', date: 'Saturday, 31 July 2027', location: 'Venue to be announced soon', image: imgs[3], desc: 'Celebrate innovation at one of the year\'s biggest tech gatherings. TechFest 2027 will feature inspiring keynote sessions, product showcases, exhibitions, workshops, networking opportunities, and interactive experiences designed to bring together the technology community for a day of learning, collaboration, and innovation.' }
    ];
  }

  function mountEvents() {
    document.querySelectorAll('[data-events]').forEach((root) => {
      const limit = parseInt(root.dataset.limit || '3', 10);
      const base = document.body.dataset.base || '';
      const pool = sampleEvents().slice(0, limit);
      root.innerHTML = pool.map((ev) => `
        <article class="card event-card reveal is-visible">
          <img class="event-image" src="${base}assets/images/${ev.image}" alt="" loading="lazy">
          <div class="event-body">
            <span class="chip chip-accent">${ev.type}</span>
            <h3>${ev.title}</h3>
            <p class="event-meta">${ev.date} · ${ev.location}</p>
            <p>${ev.desc}</p>
          </div>
        </article>`).join('');
    });
  }

  function mountLayout() {
    const base = document.body.dataset.base || '';
    const headerMount = document.querySelector('[data-mount="header"]');
    const footerMount = document.querySelector('[data-mount="footer"]');
    if (headerMount) headerMount.outerHTML = header(base);
    if (footerMount) footerMount.outerHTML = footer(base);
    setActiveLinks();
    setupNav();
    setupTheme();
    mountEvents();
    setupReveal();
    decorateCCD(document.body);
  }

  document.addEventListener('DOMContentLoaded', mountLayout);
})();
