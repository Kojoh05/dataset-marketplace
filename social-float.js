// KOJOH floating social buttons (bottom right, every page).
// Black buttons in light mode, white in dark mode, following <html data-theme>.
// Soft navigation swaps <body>, so a small observer puts the buttons back after each swap.
(function () {
  var LINKS = [
    { id: 'instagram', label: 'KOJOH on Instagram', href: 'https://www.instagram.com/kojohhi/',
      svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none"/></svg>' },
    { id: 'linkedin', label: 'KOJOH on LinkedIn', href: 'https://www.linkedin.com/company/kojoh/',
      svg: '<svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.75h4v11H3zM9.5 9.75h3.8v1.6h.06c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.77 2.6 4.77 6v5.45h-4v-4.83c0-1.15-.02-2.63-1.6-2.63-1.6 0-1.85 1.25-1.85 2.55v4.91h-4z"/></svg>' }
  ];

  function css() {
    if (document.getElementById('kSocialCss')) return;
    var st = document.createElement('style');
    st.id = 'kSocialCss';
    st.textContent =
      '.k-social{position:fixed;right:18px;bottom:18px;z-index:60;display:flex;flex-direction:column;gap:10px}' +
      '.k-social a{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#111;color:#fff;' +
      'box-shadow:0 4px 14px rgba(0,0,0,.18);text-decoration:none;transition:transform .15s ease,box-shadow .15s ease}' +
      '.k-social a:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,.25)}' +
      '.k-social a:focus-visible{outline:2px solid #888;outline-offset:3px}' +
      'html[data-theme="dark"] .k-social a{background:#fff;color:#111;box-shadow:0 4px 14px rgba(0,0,0,.45)}' +
      '@media (max-width:640px){.k-social{right:12px;bottom:12px;gap:8px}.k-social a{width:40px;height:40px}}' +
      '@media print{.k-social{display:none}}';
    (document.head || document.documentElement).appendChild(st);
  }

  function ensure() {
    if (!document.body || document.getElementById('kSocial')) return;
    css();
    var box = document.createElement('div');
    box.className = 'k-social';
    box.id = 'kSocial';
    box.innerHTML = LINKS.map(function (l) {
      return '<a href="' + l.href + '" target="_blank" rel="noopener" aria-label="' + l.label + '" title="' + l.label + '" data-social="' + l.id + '">' + l.svg + '</a>';
    }).join('');
    document.body.appendChild(box);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensure); else ensure();
  try {
    new MutationObserver(function () { if (!document.getElementById('kSocial')) ensure(); })
      .observe(document.documentElement, { childList: true });
  } catch (e) {}
})();
