// === PROFILE / SESSION (index.html) ===
// Reads the logged-in user (if any) from Supabase and fills in the nav +
// profile panel with real data. Falls back to a signed-out "Guest" state
// when there's no session, and stays fully inert (no errors) if
// supabase-config.js hasn't been filled in yet.

(function () {
  var LIVE = !!(window.SUPABASE_URL && window.SUPABASE_ANON_KEY && window.supabase);
  var SUPA = LIVE ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY) : null;

  function initials(first, last, username, email) {
    var a = (first || '').trim().charAt(0);
    var b = (last || '').trim().charAt(0);
    if (a || b) return (a + b).toUpperCase() || a.toUpperCase();
    if (username) return username.slice(0, 2).toUpperCase();
    if (email) return email.slice(0, 2).toUpperCase();
    return '?';
  }

  function setGuestState() {
    var navAvatar = document.getElementById('navAvatar');
    var navAvatarMobile = document.getElementById('navAvatarMobile');
    var navName = document.getElementById('navName');
    var panelAvatar = document.getElementById('panelAvatar');
    var nameField = document.getElementById('nameField');
    var panelEmail = document.getElementById('panelEmail');
    var panelAuthBtn = document.getElementById('panelAuthBtn');
    var logoutWrap = document.getElementById('panelLogoutWrap');

    if (navAvatar) navAvatar.textContent = '?';
    if (navAvatarMobile) navAvatarMobile.textContent = '?';
    if (navName) navName.textContent = 'Guest';
    if (panelAvatar) panelAvatar.textContent = '?';
    if (nameField) nameField.value = 'Guest';
    if (panelEmail) panelEmail.textContent = 'Not logged in';
    if (panelAuthBtn) {
      panelAuthBtn.textContent = 'Log in';
      panelAuthBtn.dataset.mode = 'login';
    }
    if (logoutWrap) logoutWrap.hidden = true;
  }

  function setUserState(profile, email) {
    var navAvatar = document.getElementById('navAvatar');
    var navAvatarMobile = document.getElementById('navAvatarMobile');
    var navName = document.getElementById('navName');
    var panelAvatar = document.getElementById('panelAvatar');
    var nameField = document.getElementById('nameField');
    var panelEmail = document.getElementById('panelEmail');
    var panelAuthBtn = document.getElementById('panelAuthBtn');
    var logoutWrap = document.getElementById('panelLogoutWrap');

    var first = profile && profile.first_name;
    var last = profile && profile.last_name;
    var username = profile && profile.username;
    var fullName = [first, last].filter(Boolean).join(' ') || username || 'Member';
    var initialsText = initials(first, last, username, email);

    if (navAvatar) navAvatar.textContent = initialsText;
    if (navAvatarMobile) navAvatarMobile.textContent = initialsText;
    if (navName) navName.textContent = first || username || 'Member';
    if (panelAvatar) panelAvatar.textContent = initialsText;
    if (nameField) nameField.value = fullName;
    if (panelEmail) panelEmail.textContent = email || '';
    if (panelAuthBtn) {
      panelAuthBtn.textContent = 'Change';
      panelAuthBtn.dataset.mode = 'change';
    }
    if (logoutWrap) logoutWrap.hidden = false;
  }

  window.handlePanelAuthBtn = function () {
    var btn = document.getElementById('panelAuthBtn');
    if (btn && btn.dataset.mode === 'login') {
      window.location.href = 'auth.html';
    }
    // "Change" (email) isn't wired up yet — no-op for now.
  };

  window.handleLogout = async function () {
    if (!LIVE) {
      setGuestState();
      return;
    }
    try {
      await SUPA.auth.signOut();
    } catch (e) {
      console.warn('Logout error', e);
    }
    window.location.href = 'index.html';
  };

  async function loadSession() {
    if (!LIVE) {
      setGuestState();
      return;
    }
    try {
      var { data: { session } } = await SUPA.auth.getSession();
      if (!session || !session.user) {
        setGuestState();
        return;
      }
      var user = session.user;
      var { data: profile, error } = await SUPA
        .from('profiles')
        .select('first_name, last_name, username')
        .eq('id', user.id)
        .maybeSingle();
      if (error) console.warn('Profile fetch error', error);
      setUserState(profile, user.email);
    } catch (e) {
      console.warn('Session load error', e);
      setGuestState();
    }
  }

  document.addEventListener('DOMContentLoaded', loadSession);
})();
