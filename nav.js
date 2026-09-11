// === KOJOH SHARED SIDEBAR + SOFT NAVIGATION ===
// Injects a persistent left icon-rail (collapsed) that expands into a
// labeled page list on hamburger click — present on every app page.
// Also implements client-side "soft" navigation between app pages so
// clicking a sidebar link swaps content instead of a full page reload.

(function () {
  var PAGES = [
    { group: 'BROWSE', items: [
      { href: 'index.html', label: 'Home', icon: 'home' },
      { href: 'search.html', label: 'Search datasets', icon: 'search' },
      { href: 'recommendations.html', label: 'Recommended', icon: 'star' },
      { href: 'saved.html', label: 'Saved datasets', icon: 'bookmark' },
      { href: 'purchases.html', label: 'Your purchases', icon: 'bag' }
    ]},
    { group: 'MORE', items: [
      { href: 'settings.html', label: 'Settings', icon: 'gear' },
      { href: 'about.html', label: 'About KOJOH', icon: 'info' },
      { href: 'help.html', label: 'Help & contact', icon: 'help' },
      { href: 'suggestions.html', label: 'Suggestions', icon: 'bulb' }
    ]}
  ];

  var ICONS = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/>',
    search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/>',
    star: '<polygon points="12 2 15 8 22 9 17 14 18 21 12 18 6 21 7 14 2 9 9 8 12 2"/>',
    bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    help: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    bulb: '<path d="M12 2 2 22h20L12 2z"/><line x1="12" y1="9" x2="12" y2="14"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
  };

  function svg(name, size) {
    size = size || 18;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || '') + '</svg>';
  }

  function currentFile() {
    var p = window.location.pathname.split('/').pop();
    return p || 'index.html';
  }

  function buildSidebarHTML() {
    var cur = currentFile();
    var html = '';
    html += '<div class="ksb-top">';
    html += '  <button type="button" class="ksb-hamburger" id="ksbToggle" aria-label="Toggle navigation">';
    html += '    <span></span><span></span><span></span>';
    html += '  </button>';
    html += '  <a href="index.html" class="ksb-logo" data-ksb-link>K</a>';
    html += '</div>';
    html += '<nav class="ksb-nav">';
    PAGES.forEach(function (section) {
      html += '<div class="ksb-group-label">' + section.group + '</div>';
      section.items.forEach(function (item) {
        var active = item.href === cur ? ' active' : '';
        html += '<a href="' + item.href + '" class="ksb-item' + active + '" data-ksb-link title="' + item.label + '">';
        html += '<span class="ksb-item-icon">' + svg(item.icon) + '</span>';
        html += '<span class="ksb-item-label">' + item.label + '</span>';
        html += '</a>';
      });
    });
    html += '</nav>';
    return html;
  }

  function ensureSidebar() {
    var existing = document.getElementById('ksbRail');
    if (existing) existing.remove();
    var rail = document.createElement('aside');
    rail.id = 'ksbRail';
    rail.className = 'ksb-rail';
    try {
      if (localStorage.getItem('kojoh-sidebar-expanded') === '1') rail.classList.add('expanded');
    } catch (e) {}
    rail.innerHTML = buildSidebarHTML();
    document.body.insertBefore(rail, document.body.firstChild);
    document.body.classList.add('ksb-has-rail');

    var overlay = document.getElementById('ksbOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'ksbOverlay';
      overlay.className = 'ksb-overlay';
      document.body.appendChild(overlay);
    }

    document.getElementById('ksbToggle').addEventListener('click', function () {
      var isExpanded = rail.classList.toggle('expanded');
      try { localStorage.setItem('kojoh-sidebar-expanded', isExpanded ? '1' : '0'); } catch (e) {}
    });
    overlay.addEventListener('click', function () {
      rail.classList.remove('expanded');
      try { localStorage.setItem('kojoh-sidebar-expanded', '0'); } catch (e) {}
    });
  }

  // ---------- Soft navigation (fetch + swap, no full reload) ----------
  var SKIP_SRC_PATTERNS = [/nav\.js/, /supabase-js/, /supabase-config\.js/, /config\.js/];

  function shouldSkipScript(scriptEl) {
    if (!scriptEl.src) return false;
    return SKIP_SRC_PATTERNS.some(function (re) { return re.test(scriptEl.src); });
  }

  function runScriptsInOrder(scripts, i, done) {
    if (i >= scripts.length) { done(); return; }
    var old = scripts[i];
    if (shouldSkipScript(old)) { runScriptsInOrder(scripts, i + 1, done); return; }
    var s = document.createElement('script');
    for (var j = 0; j < old.attributes.length; j++) {
      var attr = old.attributes[j];
      s.setAttribute(attr.name, attr.value);
    }
    if (old.src) {
      s.onload = function () { runScriptsInOrder(scripts, i + 1, done); };
      s.onerror = function () { runScriptsInOrder(scripts, i + 1, done); };
      document.body.appendChild(s);
    } else {
      s.textContent = old.textContent;
      document.body.appendChild(s);
      runScriptsInOrder(scripts, i + 1, done);
    }
  }

  function swapTo(url, pushHistory) {
    fetch(url, { credentials: 'same-origin' })
      .then(function (res) { return res.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var newBody = doc.body;
        if (!newBody) { window.location.href = url; return; }

        document.title = doc.title || document.title;

        // Pull out this new page's own scripts before wiping the body
        // (querySelectorAll on newBody still works after we detach it).
        var scripts = Array.prototype.slice.call(newBody.querySelectorAll('script'));

        // Replace content
        document.body.innerHTML = newBody.innerHTML;
        document.body.className = newBody.className;

        // Update the URL BEFORE rebuilding the sidebar, so the active-link
        // detection (which reads window.location) reflects the new page.
        if (pushHistory !== false) {
          window.history.pushState({ ksbNav: true }, '', url);
        }

        // Re-attach the sidebar (body content was fully replaced)
        ensureSidebar();

        window.scrollTo(0, 0);

        runScriptsInOrder(scripts, 0, function () { /* done */ });
      })
      .catch(function () {
        window.location.href = url; // fall back to a real navigation on any failure
      });
  }
  window.kojohSoftNav = swapTo;

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-ksb-link]');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#') return;
    e.preventDefault();
    var rail = document.getElementById('ksbRail');
    if (rail) rail.classList.remove('mobile-open');
    if (href === currentFile()) return;
    swapTo(href, true);
  });

  window.addEventListener('popstate', function () {
    swapTo(window.location.pathname.split('/').pop() || 'index.html', false);
  });

  // ---------- Ready helper other page scripts can use so their init logic
  // re-runs correctly after a soft-navigation swap (DOMContentLoaded only
  // fires once per real page load). ----------
  window.kReady = function (fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  };

  window.kReady(ensureSidebar);
})();
