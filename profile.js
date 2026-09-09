// === PROFILE / SESSION (index.html) ===
// Reads the logged-in user (if any) from Supabase and fills the nav +
// profile panel with real data. On first login, it also materializes the
// profiles row from user_metadata (needed because email-confirmation
// signup returns no session, so auth.js couldn't insert the row itself).

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
    var els = {
      navAvatar: document.getElementById('navAvatar'),
      navAvatarMobile: document.getElementById('navAvatarMobile'),
      navName: document.getElementById('navName'),
      panelAvatar: document.getElementById('panelAvatar'),
      nameField: document.getElementById('nameField'),
      panelUsername: document.getElementById('panelUsername'),
      panelEmail: document.getElementById('panelEmail'),
      panelAuthBtn: document.getElementById('panelAuthBtn'),
      logoutWrap: document.getElementById('panelLogoutWrap')
    };
    if (els.navAvatar) els.navAvatar.textContent = '?';
    if (els.navAvatarMobile) els.navAvatarMobile.textContent = '?';
    if (els.navName) els.navName.textContent = 'Guest';
    if (els.panelAvatar) els.panelAvatar.textContent = '?';
    if (els.nameField) els.nameField.value = 'Guest';
    if (els.panelUsername) els.panelUsername.textContent = '—';
    if (els.panelEmail) els.panelEmail.textContent = 'Not logged in';
    if (els.panelAuthBtn) {
      els.panelAuthBtn.textContent = 'Log in';
      els.panelAuthBtn.dataset.mode = 'login';
    }
    if (els.logoutWrap) els.logoutWrap.hidden = true;
  }

  function setUserState(profile, email) {
    var first = profile && profile.first_name;
    var last = profile && profile.last_name;
    var username = profile && profile.username;
    var displayName = first || username || (email ? email.split('@')[0] : 'Member');
    var fullName = [first, last].filter(Boolean).join(' ') || username || displayName;
    var initialsText = initials(first, last, username, email);

    var setText = function(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
    var setVal = function(id, val) { var el = document.getElementById(id); if (el) el.value = val; };

    setText('navAvatar', initialsText);
    setText('navAvatarMobile', initialsText);
    setText('navName', displayName);
    setText('panelAvatar', initialsText);
    setVal('nameField', fullName);
    setText('panelUsername', username ? '@' + username : '—');
    setText('panelEmail', email || '');

    var authBtn = document.getElementById('panelAuthBtn');
    if (authBtn) {
      authBtn.textContent = 'Change';
      authBtn.dataset.mode = 'change';
    }
    var logoutWrap = document.getElementById('panelLogoutWrap');
    if (logoutWrap) logoutWrap.hidden = false;
  }

  window.handlePanelAuthBtn = function () {
    var btn = document.getElementById('panelAuthBtn');
    if (btn && btn.dataset.mode === 'login') {
      window.location.href = 'auth.html';
    }
  };

  window.handleLogout = async function () {
    if (!LIVE) { setGuestState(); return; }
    try { await SUPA.auth.signOut(); } catch (e) { console.warn('Logout error', e); }
    try { sessionStorage.removeItem('kojoh_skip_welcome'); } catch (e) {}
    window.location.href = 'welcome.html';
  };

  // If the profiles row is missing for this user (email-confirmation flow),
  // build it from the user_metadata payload auth.js stashed at signup.
  async function materializeProfileIfMissing(user) {
    var pending = user && user.user_metadata && user.user_metadata.kojoh_pending_profile;
    if (!pending) return null;
    try {
      var insertRes = await SUPA.from('profiles').insert({
        id: user.id,
        username: pending.username,
        email: user.email,
        first_name: pending.first_name,
        middle_name: pending.middle_name || null,
        last_name: pending.last_name,
        gender: pending.gender,
        country: pending.country,
        auth_provider: pending.auth_provider || 'email'
      }).select().maybeSingle();
      if (insertRes.error) { console.warn('Profile materialize error', insertRes.error); return null; }

      // Also insert the profession -> job_title links.
      if (pending.professions && pending.professions.length) {
        var jt = await SUPA.from('job_titles').select('id, name').in('name', pending.professions);
        if (jt.data && jt.data.length) {
          var rows = jt.data.map(function(j){ return { profile_id: user.id, job_title_id: j.id }; });
          await SUPA.from('profile_job_titles').insert(rows);
        }
      }
      // Clear the pending payload so this only runs once.
      SUPA.auth.updateUser({ data: { kojoh_pending_profile: null } });
      return insertRes.data;
    } catch (e) {
      console.warn('Profile materialize threw', e);
      return null;
    }
  }

  async function loadSession() {
    if (!LIVE) { setGuestState(); return; }
    try {
      var sessionRes = await SUPA.auth.getSession();
      var session = sessionRes.data && sessionRes.data.session;
      if (!session || !session.user) { setGuestState(); return; }

      var user = session.user;
      var pr = await SUPA.from('profiles')
        .select('first_name, last_name, username')
        .eq('id', user.id)
        .maybeSingle();

      var profile = pr.data;
      if (!profile) {
        // First login after email confirmation — build the row now.
        profile = await materializeProfileIfMissing(user);
      }
      setUserState(profile, user.email);
    } catch (e) {
      console.warn('Session load error', e);
      setGuestState();
    }
  }

  document.addEventListener('DOMContentLoaded', loadSession);
})();
