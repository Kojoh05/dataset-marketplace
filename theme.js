// === KOJOH THEME ===
// One source of truth for light/dark, shared by every page.
//
// This file must be loaded in <head>, before anything renders: it puts
// data-theme on <html> so the CSS variables are already correct on the
// first paint (no white flash for dark-mode users on page load).
//
// The attribute lives on <html>, not <body>, on purpose. Soft navigation
// replaces the whole body, so a theme stored there would be lost on every
// page change; on <html> it simply survives.

(function () {
  var KEY = 'kojoh-theme';

  function read() {
    var t = null;
    try { t = localStorage.getItem(KEY); } catch (e) {}
    return (t === 'dark' || t === 'light') ? t : 'light';
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    // Legacy safety: if a page still carries its own body attribute, keep
    // it in step rather than letting it fight the root.
    if (document.body && document.body.hasAttribute('data-theme')) {
      document.body.setAttribute('data-theme', theme);
    }
  }

  apply(read());

  window.kojohGetTheme = read;

  window.kojohSetTheme = function (theme) {
    if (theme !== 'dark' && theme !== 'light') theme = 'light';
    apply(theme);
    try { localStorage.setItem(KEY, theme); } catch (e) {}
    return theme;
  };

  window.kojohToggleTheme = function () {
    return window.kojohSetTheme(read() === 'dark' ? 'light' : 'dark');
  };

  // Another tab (or the settings page in a second window) changing the
  // theme should be reflected here too.
  window.addEventListener('storage', function (e) {
    if (e.key === KEY) apply(read());
  });
})();
