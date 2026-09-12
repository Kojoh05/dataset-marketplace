// === KOJOH ICON SET ===
// Line icons drawn in the same language as the sidebar: 24x24 box,
// currentColor stroke, 1.75 weight, round caps. Used anywhere the UI
// needs a pictogram, so the app never falls back to system emoji
// (which render differently on every OS and don't match the brand).

(function () {
  var PATHS = {
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>',
    linkedin: '<rect x="3" y="3" width="18" height="18" rx="3"/><line x1="8" y1="11" x2="8" y2="16.5"/><circle cx="8" cy="7.8" r="1" fill="currentColor" stroke="none"/><path d="M12 16.5V12a2.2 2.2 0 0 1 4.4 0v4.5"/>',

    plug: '<path d="M9 2v6"/><path d="M15 2v6"/><path d="M6 8h12v2.5a6 6 0 0 1-12 0z"/><path d="M12 16.5V22"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    alert: '<path d="M12 3.5 2.8 19.5h18.4z"/><line x1="12" y1="9.5" x2="12" y2="14"/><circle cx="12" cy="16.8" r="0.9" fill="currentColor" stroke="none"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
    inbox: '<path d="M3 13h4l2 3h6l2-3h4"/><path d="M5.5 5h13l2.5 8v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z"/>',
    bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
    search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/>',
    bulb: '<path d="M9 18h6"/><path d="M10 21.5h4"/><path d="M12 2.5a6 6 0 0 0-3.5 10.9c.6.45.9 1 .9 1.6v.5h5.2v-.5c0-.6.3-1.15.9-1.6A6 6 0 0 0 12 2.5z"/>',
    folder: '<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.5h9A1.5 1.5 0 0 1 21 10v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5.2-5.2 2 2-5.2z"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M4 4.5 20 20.5"/><path d="M9.6 6.1A8.9 8.9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.4 4.1"/><path d="M6.3 8.2A16.6 16.6 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 3.3-.6"/><path d="M10.1 10.3a3 3 0 0 0 4 4.2"/>'
  };

  function icon(name, size, strokeWidth) {
    size = size || 24;
    strokeWidth = strokeWidth || 1.75;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="' + strokeWidth + '" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' + (PATHS[name] || '') + '</svg>';
  }

  window.KOJOH_ICON_PATHS = PATHS;
  window.kIcon = icon;
})();
