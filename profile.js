// === PROFILE / SESSION (index.html) ===

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
  function $ (id) { return document.getElementById(id); }
  function setText(id, val){ var el = $(id); if (el) el.textContent = val; }

  function setGuestState() {
    setText('navAvatar', '?');
    setText('navAvatarMobile', '?');
    setText('navName', 'Guest');
    setText('panelAvatar', '?');
    setText('panelDisplayName', 'Guest');
    setText('panelUsername', 'Not signed in');
    setText('panelEmail', 'Sign in to see your email');
    var editLink = $('panelEditLink'); if (editLink) editLink.hidden = true;
    var emailRow = $('panelEmailRow'); if (emailRow) emailRow.style.pointerEvents = 'none';
    var logoutBtn = $('panelLogoutBtn'); if (logoutBtn) logoutBtn.hidden = true;
    var loginBtn = $('panelLoginBtn'); if (loginBtn) loginBtn.hidden = false;
  }

  function setUserState(profile, email) {
    var first = profile && profile.first_name;
    var last = profile && profile.last_name;
    var username = profile && profile.username;
    var displayName = first || username || (email ? email.split('@')[0] : 'Member');
    var initialsText = initials(first, last, username, email);

    setText('navAvatar', initialsText);
    setText('navAvatarMobile', initialsText);
    setText('navName', displayName);
    setText('panelAvatar', initialsText);
    setText('panelDisplayName', [first, last].filter(Boolean).join(' ') || displayName);
    setText('panelUsername', username ? '@' + username : '—');
    setText('panelEmail', email || '');

    var editLink = $('panelEditLink'); if (editLink) editLink.hidden = false;
    var emailRow = $('panelEmailRow'); if (emailRow) emailRow.style.pointerEvents = '';
    var logoutBtn = $('panelLogoutBtn'); if (logoutBtn) logoutBtn.hidden = false;
    var loginBtn = $('panelLoginBtn'); if (loginBtn) loginBtn.hidden = true;
  }

  window.handleLogout = async function () {
    if (!LIVE) { setGuestState(); return; }
    try { await SUPA.auth.signOut(); } catch (e) { console.warn('Logout error', e); }
    try { sessionStorage.removeItem('kojoh_skip_welcome'); } catch (e) {}
    window.location.href = 'welcome.html';
  };

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
      if (pending.professions && pending.professions.length) {
        var jt = await SUPA.from('job_titles').select('id, name').in('name', pending.professions);
        if (jt.data && jt.data.length) {
          var rows = jt.data.map(function(j){ return { profile_id: user.id, job_title_id: j.id }; });
          await SUPA.from('profile_job_titles').insert(rows);
        }
      }
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
      if (!profile) profile = await materializeProfileIfMissing(user);
      setUserState(profile, user.email);
    } catch (e) {
      console.warn('Session load error', e);
      setGuestState();
    }
  }

  document.addEventListener('DOMContentLoaded', loadSession);
})();
