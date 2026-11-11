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

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('a[href]').forEach(a => {
      const orig = a.getAttribute('href');
      if (!orig) return;
      const cleaned = cleanLink(orig);
      if (cleaned !== orig) a.setAttribute('href', cleaned);
    });
  });
})();