(function () {
  const BRAND = {
    name: "Community of Courssin Developers",
    short: "CCD",
    tagline: "BUILD • LEARN • INNOVATE • GROW"
  };

  function logoSvg(base) {
    return `<img class="brand-mark" src="${base}assets/images/ccd-logo.svg" alt="" aria-hidden="true">`;
  }

  function navLinks(base) {
    return [
      ["About CCD", "about.html"],
      ["Membership", "membership.html"],
      ["Activities", "activities.html"],
      ["Projects", "projects.html"],
      ["Community", "community.html"],
      ["Articles & Media", "articles.html"],
      ["Events", "events.html"],
      ["Tech Cohort", "tech-cohort.html"]
    ].map(([label, href]) => `<a href="${base}${href}">${label}</a>`).join("");
  }

  function header(base) {
    return `
      <a class="skip-link" href="#main">Skip to main content</a>
      <header class="site-header" data-header>
        <div class="container nav-wrap">
          <a class="brand" href="${base}index.html" aria-label="Community of Courssin Developers home">
            ${logoSvg(base)}
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
            <a class="btn btn-ghost" data-header-login href="${base}login.html">Log in</a>
            <button class="btn btn-ghost theme-toggle theme-toggle-desktop" type="button" data-theme-toggle aria-label="Toggle dark mode"></button>
            <a class="btn btn-primary" data-header-signup href="${base}register.html">Sign up</a>
            <a class="dashboard-notification-link" data-header-notifications href="${base}dashboard/notifications" aria-label="Notifications" title="Notifications" hidden>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>
              <span class="notification-badge" data-header-unread hidden></span>
            </a>
            <a class="btn btn-ghost" data-header-account href="${base}dashboard/account" hidden>Account settings</a>
            <a class="btn btn-primary" data-header-dashboard href="${base}dashboard" hidden>Dashboard</a>
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
              <a class="brand" href="${base}index.html" aria-label="Community of Courssin Developers home">${logoSvg(base)}<span class="brand-text"><strong>${brandWordmark()}</strong></span></a>
              <p>A global developer community where programmers, software engineers, and tech creators connect, learn together, build real projects, and grow through collaboration, mentorship, and hands-on experience.</p>
            </div>
            <div class="footer-col">
              <h5>Quick Links</h5>
              <ul>
<li><a href="${base}about.html">About CCD</a></li>
                <li><a href="${base}membership.html">Membership</a></li>
                <li><a href="${base}events.html">Events</a></li>
                <li><a href="${base}tech-cohort.html">Tech Cohort</a></li>
                <li><a href="${base}articles.html">Articles & Media</a></li>
              </ul>
            </div>
<div class="footer-col">
              <h5>Community</h5>
              <ul>
                <li><a href="${base}community.html">Community</a></li>
                <li><a href="${base}activities.html">Activities</a></li>
                <li><a href="${base}projects.html">Projects</a></li>
              </ul>
            </div>
            <div class="footer-col">
              <h5>Account</h5>
              <ul>
                <li><a href="${base}login.html">Log in</a></li>
                <li><a href="${base}register.html">Sign up</a></li>
                <li><a href="${base}contact.html">Contact</a></li>
              </ul>
            </div>
            <div class="footer-col footer-policies">
              <h5>Policies & Help</h5>
              <ul>
                <li><a href="${base}faq.html">FAQ</a></li>
                <li><a href="${base}terms.html">Terms and Conditions</a></li>
                <li><a href="${base}privacy.html">Privacy Policy</a></li>
                <li><a href="${base}cookies.html">Cookie Policy</a></li>
                <li><a href="${base}mentorship-policy.html">Mentorship Policy</a></li>
                <li><a href="${base}open-source-policy.html">Open Source Policy</a></li>
                <li><a href="${base}event-media-policy.html">Event Media Policy</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div class="footer-bottom">
          <div class="container footer-bottom-inner">
            <span>&copy; ${year} Community of Courssin Developers</span>
            <span class="footer-links">
<a href="${base}about.html">About</a>
              <a href="${base}contact.html">Contact</a>
              <span>${BRAND.tagline}</span>
            </span>
              <span class="powered-by"><span class="powered-by-label">Brought to you by</span><a class="footer-credit-brand" href="https://www.courssin.com.ng/" target="_blank" rel="noopener noreferrer"><img src="${base}assets/images/courssin-tech-institute-logo.svg" alt="Courssin Tech Institute logo"><strong>Courssin Tech Institute</strong></a><span class="footer-credit-divider" aria-hidden="true">·</span><a class="footer-credit-brand" href="https://satgoldtechnol.name.ng/" target="_blank" rel="noopener noreferrer"><img src="${base}assets/images/satgold-technol-logo.svg" alt="SatGold Technol logo"><strong>SatGold Technol</strong></a></span>
          </div>
        </div>
      </footer>`;
  }

function setActiveLinks() {
    const normalize = (path) => {
      const clean = path.replace(/\.html$/, '').replace(/\/$/, '') || '/';
      return clean.replace(/\/index$/, '') || '/';
    };
    const current = normalize(location.pathname);
    document.querySelectorAll('.nav-links a, .sidebar a, .footer-col a, .footer-links a').forEach((a) => {
      const href = a.getAttribute('href') || '';
      if (!href || href === '#' || href.startsWith('#') || /^(https?:|mailto:|tel:|javascript:)/i.test(href)) return;
      const target = normalize(new URL(href, location.href).pathname);
    if (target === current || (current === '/' && target === '/index')) a.setAttribute('aria-current', 'page');
    });
  }

  function mountAdminLinks() {
    const nav = document.querySelector('.sidebar[aria-label="Admin"]');
    if (!nav || nav.querySelector('[data-admin-content-links]')) return;
    const marker = nav.querySelector('[data-signout]');
    const group = document.createElement('span');
    group.dataset.adminContentLinks = 'true';
    group.style.display = 'contents';
    group.innerHTML = '<a href="/admin/events">Events</a><a href="/admin/content">Articles &amp; Media</a>';
    nav.insertBefore(group, marker || null);
  }

  function mountAccountLinks() {
    document.querySelectorAll('.sidebar[aria-label="Dashboard"], .sidebar[aria-label="Admin"]').forEach((nav) => {
      if (nav.getAttribute('aria-label') === 'Dashboard') {
        nav.querySelectorAll('a').forEach((link) => {
          if (/\/admin\/(?:index|login)(?:\.html)?$/.test(link.getAttribute('href') || '')) {
            link.remove();
          }
        });
      }
      if (nav.querySelector('[data-sidebar-account]')) return;
      const link = document.createElement('a');
      link.dataset.sidebarAccount = 'true';
      link.href = nav.getAttribute('aria-label') === 'Admin' ? '/dashboard/account' : 'account';
      link.textContent = 'Account settings';
      const marker = nav.querySelector('[data-signout]');
      nav.insertBefore(link, marker || null);
    });
  }

  function normalizeWorkspaceLinks() {
    const shell = document.querySelector('.app-shell');
    const nav = shell && shell.querySelector('.sidebar');
    if (!shell || !nav) return;
    const area = nav.getAttribute('aria-label') === 'Admin' ? 'admin' : 'dashboard';
    shell.querySelectorAll('a[href]').forEach((link) => {
      const href = link.getAttribute('href') || '';
      if (!href || href === '#' || href.startsWith('#') || /^(https?:|mailto:|tel:|javascript:)/i.test(href)) return;
      if (href.startsWith('/')) return;
      if (href.startsWith('../')) {
        link.href = new URL(href, location.href).pathname + new URL(href, location.href).search + new URL(href, location.href).hash;
        return;
      }
      const [path, ...hashParts] = href.split('#');
      const normalizedPath = path.replace(/\.html$/i, '');
      link.href = `/${area}/${normalizedPath}${hashParts.length ? `#${hashParts.join('#')}` : ''}`;
    });
  }

  async function setupAuthenticatedHeader(base) {
    const CCD = window.CCD;
    if (!CCD || typeof CCD.isConfigured !== 'function' || !CCD.isConfigured()) return;
    const sb = CCD.getSupabase();
    if (!sb) return;
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;

    const login = document.querySelector('[data-header-login]');
    const signup = document.querySelector('[data-header-signup]');
    const notification = document.querySelector('[data-header-notifications]');
    const account = document.querySelector('[data-header-account]');
    const dashboard = document.querySelector('[data-header-dashboard]');
    if (login) login.hidden = true;
    if (signup) signup.hidden = true;
    if (notification) notification.hidden = false;
    if (account) account.hidden = false;
    if (dashboard) dashboard.hidden = false;

    const { data: profile } = await sb.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
    const admin = ['super_admin', 'administrator'].includes(profile?.role);
    if (dashboard) {
      dashboard.href = base + (admin ? 'admin' : 'dashboard');
      dashboard.textContent = admin ? 'Admin dashboard' : 'Dashboard';
    }
    if (account) account.href = base + 'dashboard/account';
    if (notification) notification.href = base + 'dashboard/notifications';

    const { count } = await sb.from('notifications').select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id).is('read_at', null);
    const badge = document.querySelector('[data-header-unread]');
    const workspaceBadge = document.querySelector('[data-workspace-unread]');
    if (badge && count > 0) {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.hidden = false;
      notification?.setAttribute('aria-label', `${count} unread notifications`);
    }
    if (workspaceBadge && count > 0) {
      workspaceBadge.textContent = count > 99 ? '99+' : String(count);
      workspaceBadge.hidden = false;
    }
  }

  async function loadWorkspaceUser(topbar, base) {
    const CCD = window.CCD;
    const nameEl = topbar.querySelector('[data-ws-name]');
    const emailEl = topbar.querySelector('[data-ws-email]');
    const avatarEl = topbar.querySelector('[data-ws-avatar]');
    const initials = (value) => String(value || 'CCD').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || 'C';
    try {
      if (!CCD || !CCD.isConfigured()) return;
      const sb = CCD.getSupabase();
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return;
      const user = session.user;
      let name = user.user_metadata?.full_name || user.email || 'Member';
      let avatar = '';
      let role = '';
      const { data: profile } = await sb.from('profiles').select('full_name,avatar_url,role').eq('id', user.id).maybeSingle();
      if (profile) { name = profile.full_name || name; avatar = profile.avatar_url || ''; role = profile.role || ''; }
      if (nameEl) nameEl.textContent = name;
      if (emailEl) emailEl.textContent = user.email || '';
      if (avatarEl) {
        if (/^https:\/\//i.test(avatar)) {
          const img = document.createElement('img');
          img.alt = '';
          img.src = avatar;
          avatarEl.replaceChildren(img);
        } else avatarEl.textContent = initials(name);
      }
      window.CCD.workspaceUser = { id: user.id, name, email: user.email, avatar, role };
      window.dispatchEvent(new CustomEvent('ccd:workspace-user', { detail: window.CCD.workspaceUser }));
      // Unread badge for the bell.
      const { count } = await sb.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('read_at', null);
      const badge = topbar.querySelector('[data-workspace-unread]');
      if (badge && count > 0) { badge.textContent = count > 99 ? '99+' : String(count); badge.hidden = false; }
    } catch (error) {
      console.debug('Workspace user could not be loaded', error);
      if (avatarEl && !avatarEl.textContent) avatarEl.textContent = 'C';
    }
  }

  function setupWorkspaceDrawer() {
    const shell = document.querySelector('.app-shell');
    const nav = shell && shell.querySelector('.sidebar');
    const layout = shell && shell.querySelector('.app-layout');
    if (!shell || !nav || !layout || nav.dataset.drawerReady) return;
    nav.dataset.drawerReady = 'true';
    nav.id = nav.id || 'workspaceSidebar';

    const isAdmin = nav.getAttribute('aria-label') === 'Admin';
    const navIcons = {
      overview: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
      profile: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
      membership: '<path d="M4 5.5h16v13H4zM8 9h8M8 13h5M8 16h3"/>',
      team: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M15 15a5 5 0 0 1 6 4"/>',
      tasks: '<path d="m5 12 4 4L19 6"/><path d="M19 13v6H5V5h9"/>',
      projects: '<path d="M4 7h16v13H4zM8 7V4h8v3M4 11h16M10 11v3h4v-3"/>',
      discussions: '<path d="M4 5h16v12H9l-5 4zM8 9h8M8 13h5"/>',
      achievements: '<path d="M8 4h8v4a4 4 0 0 1-8 0zM8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M12 12v5M8 20h8M9 17h6"/>',
      rewards: '<path d="M5 4h14v16H5zM9 8h6M9 12h6M9 16h3"/>',
      library: '<path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H20v18H7.5A3.5 3.5 0 0 0 4 23zM4 5.5V23"/>',
      notifications: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
      admin: '<path d="M12 3 20 7v5c0 5-3.4 8-8 9-4.6-1-8-4-8-9V7zM9 12l2 2 4-4"/>',
      events: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h3M8 17h6"/>',
      members: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M15 15a5 5 0 0 1 6 4"/>',
      sign: '<path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10"/>',
      log: '<path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10"/>',
      settings: '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.8-.6a8 8 0 0 1-1.7 1l-.3 1.9h-2.8l-.3-1.9a8 8 0 0 1-1.7-1l-1.8.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.8.6a8 8 0 0 1 1.7-1l.3-1.9h2.8l.3 1.9a8 8 0 0 1 1.7 1l1.8-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 2z"/>',
      logout: '<path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10"/>',
      default: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>'
    };
    nav.querySelectorAll('a').forEach((link) => {
      const label = link.textContent.trim();
      if (!label || link.querySelector('.workspace-nav-icon')) return;
      const key = label.toLowerCase().replace(/^my\s+/, '').split(/\s+/)[0];
      const paths = navIcons[key] || navIcons.default;
      link.innerHTML = `<span class="workspace-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${paths}</svg></span><span class="workspace-nav-label">${label}</span>`;
    });
    const base = document.body.dataset.base || '';
    const workspaceName = isAdmin ? 'Admin workspace' : 'Member workspace';
    const drawerHead = document.createElement('div');
    drawerHead.className = 'sidebar-brand';
    drawerHead.innerHTML = `<a class="sidebar-brand-home" href="${base}index.html" aria-label="Go to CCD homepage"><img class="sidebar-brand-mark" src="${base}assets/images/ccd-logo.svg" alt="CCD logo"></a><a class="sidebar-brand-copy" href="${base}index.html" aria-label="CCD home"><strong>Courssin Developers</strong><small>${workspaceName}</small></a>`;
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'sidebar-close';
    closeButton.setAttribute('aria-label', 'Close dashboard menu');
    closeButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
    drawerHead.appendChild(closeButton);
    nav.insertBefore(drawerHead, nav.firstChild);

    // Section labels like the reference design: MENU and GENERAL.
    const firstLabel = nav.querySelector('h5');
    if (firstLabel) firstLabel.textContent = 'Menu';
    const accountLink = nav.querySelector('[data-sidebar-account]');
    if (accountLink) {
      const general = document.createElement('h5');
      general.textContent = 'General';
      nav.insertBefore(general, accountLink);
      const site = document.createElement('a');
      site.href = `${base}index.html`;
      site.innerHTML = `<span class="workspace-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/></svg></span><span class="workspace-nav-label">Main website</span>`;
      nav.insertBefore(site, nav.querySelector('[data-signout]') || null);
    }
    const installCard = document.createElement('div');
    installCard.className = 'ws-install-card';
    installCard.dataset.installCard = '';
    installCard.innerHTML = `<img class="ws-install-logo" src="${base}assets/images/ccd-logo.svg" alt="" aria-hidden="true"><strong>Install our<br>CCD app</strong><span>Get it on your phone or desktop, one tap away.</span><button class="btn btn-sm" type="button" data-pwa-install>Install app</button>`;
    nav.appendChild(installCard);

    const toolbar = document.createElement('div');
    toolbar.className = 'dashboard-toolbar';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'dashboard-menu-toggle';
    toggle.setAttribute('aria-controls', nav.id);
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg><span>Dashboard menu</span>';
    toolbar.appendChild(toggle);

    const icon = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
    const topbar = document.createElement('div');
    topbar.className = 'workspace-topbar ws-topbar';
    topbar.innerHTML = `<a class="ws-mobile-brand" href="${base}index.html" aria-label="Go to CCD homepage"><img src="${base}assets/images/ccd-logo.svg" alt="CCD logo"></a>
      <div class="workspace-search-control ws-search is-open">
        <span class="ws-search-icon" aria-hidden="true">${icon('<circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 5 5"/>')}</span>
        <input class="workspace-search-input" type="search" placeholder="Search pages and tools" aria-label="Search dashboard pages" autocomplete="off" aria-controls="workspaceSearchResults" aria-expanded="false">
        <kbd class="ws-kbd" aria-hidden="true">Ctrl K</kbd>
        <div class="workspace-search-results" id="workspaceSearchResults" role="listbox" hidden></div>
      </div>
      <div class="workspace-topbar-actions ws-actions">
        <button class="ws-icon-btn" type="button" data-theme-toggle aria-label="Toggle dark mode"></button>
        <a class="ws-icon-btn" href="${base}dashboard/discussions" aria-label="Community discussions" title="Community discussions">${icon('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>')}</a>
        <a class="ws-icon-btn workspace-notification-link" href="${base}dashboard/notifications" aria-label="Notifications" title="Notifications">${icon('<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>')}<span class="workspace-unread-badge" data-workspace-unread hidden></span></a>
        <a class="ws-user" href="${base}dashboard/profile" aria-label="My profile"><span class="ws-avatar" data-ws-avatar aria-hidden="true"></span><span class="ws-user-copy"><strong data-ws-name>Member</strong><small data-ws-email></small></span></a>
      </div>`;
    topbar.prepend(toolbar);
    const searchControl = topbar.querySelector('.ws-search');
    const searchResults = topbar.querySelector('.workspace-search-results');
    const workspaceSearchInput = topbar.querySelector('.workspace-search-input');
    const appMain = shell.querySelector('.app-main');
    appMain?.insertBefore(topbar, appMain.firstChild);
    document.body.classList.add('workspace-mode');
    loadWorkspaceUser(topbar, base);
    if (appMain && !appMain.querySelector('.ws-legal')) {
      const legal = document.createElement('div');
      legal.className = 'ws-legal';
      legal.innerHTML = `<span>&copy; ${new Date().getFullYear()} Community of Courssin Developers</span><a href="${base}privacy.html">Privacy</a><a href="${base}terms.html">Terms</a><a href="${base}contact.html">Help</a>`;
      appMain.appendChild(legal);
    }

    const backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.className = 'dashboard-drawer-backdrop';
    backdrop.setAttribute('aria-label', 'Close dashboard menu');
    backdrop.tabIndex = -1;
    shell.appendChild(backdrop);
    const desktop = window.matchMedia('(min-width: 992px)');
    nav.inert = !desktop.matches;
    nav.setAttribute('aria-hidden', String(!desktop.matches));

    function close(restoreFocus = false) {
      document.body.classList.remove('dashboard-drawer-open');
      nav.classList.remove('is-open');
      nav.inert = !desktop.matches;
      nav.setAttribute('aria-hidden', String(!desktop.matches));
      toggle.setAttribute('aria-expanded', 'false');
      backdrop.setAttribute('aria-hidden', 'true');
      if (restoreFocus) toggle.focus();
    }
    function open() {
      document.body.classList.add('dashboard-drawer-open');
      nav.classList.add('is-open');
      nav.inert = false;
      nav.setAttribute('aria-hidden', 'false');
      toggle.setAttribute('aria-expanded', 'true');
      backdrop.setAttribute('aria-hidden', 'false');
      closeButton.focus();
    }

    toggle.addEventListener('click', open);
    const searchInput = workspaceSearchInput;
    const pageIndex = () => [...nav.querySelectorAll('a')]
      .filter(link => !link.closest('.sidebar-brand') && link.getAttribute('href') && !link.hasAttribute('data-signout'))
      .map(link => ({ label: link.textContent.trim(), href: link.href }));
    let activeResult = -1;
    function renderResults() {
      const query = searchInput.value.trim().toLowerCase();
      searchResults.replaceChildren();
      activeResult = -1;
      if (!query) { searchResults.hidden = true; searchInput.setAttribute('aria-expanded', 'false'); return; }
      const matches = pageIndex().filter(item => item.label.toLowerCase().includes(query)).slice(0, 8);
      matches.forEach((item) => {
        const result = document.createElement('a');
        result.className = 'workspace-search-result';
        result.setAttribute('role', 'option');
        result.href = item.href;
        result.textContent = item.label;
        searchResults.appendChild(result);
      });
      if (!matches.length) {
        const empty = document.createElement('span');
        empty.className = 'workspace-search-empty';
        empty.textContent = 'No matching dashboard pages';
        searchResults.appendChild(empty);
      }
      searchResults.hidden = false;
      searchInput.setAttribute('aria-expanded', 'true');
    }
    searchInput.addEventListener('input', renderResults);
    searchInput.addEventListener('keydown', (event) => {
      const items = [...searchResults.querySelectorAll('a')];
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (!items.length) return;
        event.preventDefault();
        activeResult = (activeResult + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach((item, i) => item.classList.toggle('is-active', i === activeResult));
      } else if (event.key === 'Enter' && items.length) {
        event.preventDefault();
        (items[activeResult] || items[0]).click();
      }
    });
    document.addEventListener('click', (event) => { if (!searchControl.contains(event.target)) searchResults.hidden = true; });
    document.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInput.focus({ preventScroll: true });
        searchInput.select();
      }
    });
    closeButton.addEventListener('click', () => close(true));
    backdrop.addEventListener('click', () => close(true));
    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) close(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (!searchResults.hidden) {
        searchResults.hidden = true;
        return;
      }
      if (nav.classList.contains('is-open')) close(true);
    });
    desktop.addEventListener?.('change', (event) => {
      if (event.matches) close(false);
      else {
        nav.inert = true;
        nav.setAttribute('aria-hidden', 'true');
      }
    });
  }

  function setupSignOut() {
    document.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-signout]');
      if (!button) return;
      event.preventDefault();
      if (button.disabled) return;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      try {
        const sb = window.CCD && window.CCD.getSupabase();
        if (!sb) throw new Error('Authentication is not available. Please reload and try again.');
        const { error } = await sb.auth.signOut();
        if (error) throw error;
        location.assign((document.body.dataset.base || '') + 'login');
      } catch (error) {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        const notice = document.querySelector('[data-dashboard-notice]');
        if (notice && window.CCD) window.CCD.setNotice(notice, error.message || 'Could not sign out. Please try again.', 'error');
        else console.error('CCD sign-out failed', error);
      }
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
      { key: 'nextgen-meetup', title: 'NextGen Developers Meetup', type: 'Meetup', date: 'Saturday, 26 December 2026', location: 'Zoom', image: imgs[0], desc: 'Kick off the holiday season by connecting with developers, designers, tech enthusiasts, and aspiring professionals from different backgrounds. Expect insightful discussions on emerging technologies, practical learning sessions, networking opportunities, and inspiration for your tech journey in the coming year.' },
      { key: 'techxperience-2027', title: 'TechXperience 2027', type: 'Conference', date: 'Saturday, 30 January 2027', location: 'Venue to be announced soon', image: imgs[1], desc: 'Start the year with a high-impact physical tech experience featuring expert speakers, hands-on demonstrations, interactive sessions, career opportunities, and meaningful networking. Whether you are a beginner or an experienced professional, TechXperience 2027 is designed to help you learn, connect, and grow.' },
      { key: 'tech-talks-networking', title: 'Tech Talks & Networking', type: 'Talks', date: 'Saturday, 3 April 2027', location: 'Zoom', image: imgs[2], desc: 'Join an engaging virtual gathering where technology professionals, students, entrepreneurs, and innovators come together to share ideas, discuss industry trends, explore emerging technologies, and build valuable professional connections, all from anywhere in the world.' },
      { key: 'techfest-2027', title: 'TechFest 2027', type: 'Festival', date: 'Saturday, 31 July 2027', location: 'Venue to be announced soon', image: imgs[3], desc: 'Celebrate innovation at one of the year\'s biggest tech gatherings. TechFest 2027 will feature inspiring keynote sessions, product showcases, exhibitions, workshops, networking opportunities, and interactive experiences designed to bring together the technology community for a day of learning, collaboration, and innovation.' }
    ];
  }
  window.CCD_SAMPLE_EVENTS = sampleEvents();

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
          <h3><a class="event-title-link" href="event.html?sample=${encodeURIComponent(ev.key)}">${ev.title}</a></h3>
            <p class="event-meta">${ev.date} · ${ev.location}</p>
            <p>${ev.desc}</p>
          <a class="btn btn-secondary btn-sm event-details-link" href="event.html?sample=${encodeURIComponent(ev.key)}">View event details</a>
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
    mountAdminLinks();
    mountAccountLinks();
    normalizeWorkspaceLinks();
    setupWorkspaceDrawer();
    setupSignOut();
    setupAuthenticatedHeader(base);
    setActiveLinks();
    setupNav();
    setupTheme();
    mountEvents();
    setupReveal();
    setupActivityTracking();
    decorateCCD(document.body);
  }

  function setupActivityTracking() {
    if (!window.CCD?.isConfigured?.() || document.body.dataset.requireAuth !== 'true') return;
    const sb = window.CCD.getSupabase();
    sb.auth.getSession().then(({ data }) => {
      const userId = data?.session?.user?.id;
      if (!userId) return;
      const page = location.pathname.replace(/\/$/, '') || '/';
      const last = new Map();
      const record = async (eventType, label) => {
        const key = `${eventType}:${label}`;
        if (Date.now() - (last.get(key) || 0) < 2000) return;
        last.set(key, Date.now());
        const { error } = await sb.from('user_activity').insert({ user_id: userId, event_type: eventType, page_path: page.slice(0, 300), target_label: label.slice(0, 100) });
        if (error) console.debug('Workspace activity was not recorded', error.code);
      };
      record('page_view', document.title || page);
      document.addEventListener('click', event => {
        const target = event.target.closest('a,button,[role="button"]');
        if (!target || target.closest('[data-private],.no-activity-log')) return;
        const label = (target.getAttribute('aria-label') || target.textContent || target.title || target.getAttribute('href') || 'Interaction').trim().replace(/\s+/g, ' ');
        if (label) record(target.matches('a') ? 'navigation' : 'action', label);
      }, { passive: true });
      document.addEventListener('submit', event => {
        const label = event.target.getAttribute('aria-label') || event.target.querySelector('button[type="submit"]')?.textContent || event.target.getAttribute('name') || 'Form submitted';
        record('form_submit', `${document.title}: ${label.trim().replace(/\s+/g, ' ')}`);
      }, true);
    }).catch(error => console.debug('Workspace activity tracking unavailable', error));
  }

  document.addEventListener('DOMContentLoaded', mountLayout);
})();
