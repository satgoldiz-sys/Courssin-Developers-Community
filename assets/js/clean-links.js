/* CCD Clean URL linker - converts .html links to clean URLs */
(function () {
  const CCD = window.CCD;
  if (!CCD) return;

  function cleanLink(href) {
    if (!href) return href;
    if (/^(https?:|mailto:|tel:|javascript:|#)/i.test(href)) return href;
    if (/\.html$/i.test(href)) return href.replace(/\.html$/i, '');
    return href;
  }

  function localLink(anchor) {
    const href = anchor.getAttribute('href');
    if (!href || /^(https?:|mailto:|tel:|javascript:|#)/i.test(href)) return;
    const siteRoot = new URL(document.body.dataset.base || './', location.href);
    const target = new URL(href, href.startsWith('/') ? siteRoot : location.href);
    if (/\/(?:dashboard|admin)$/.test(target.pathname)) target.pathname += '/index.html';
    else if (!/\.[a-z0-9]+$/i.test(target.pathname)) target.pathname += '.html';
    if (anchor.href !== target.href) anchor.href = target.href;
  }

  function normalizeAnchor(anchor) {
    const localPreview = location.protocol === 'file:' || ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
    if (localPreview) return localLink(anchor);
    const original = anchor.getAttribute('href');
    const cleaned = cleanLink(original);
    if (cleaned !== original) anchor.setAttribute('href', cleaned);
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('a[href]').forEach(normalizeAnchor);
    // Content cards and dashboard controls are rendered after the initial page load.
    new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (node.matches?.('a[href]')) normalizeAnchor(node);
      node.querySelectorAll?.('a[href]').forEach(normalizeAnchor);
    }))).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
  });
})();
