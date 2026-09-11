// === KOJOH SETTINGS PAGE ===

var LIVE = !!(window.SUPABASE_URL && window.SUPABASE_ANON_KEY && window.supabase);
var SUPA = LIVE ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY) : null;

var currentUser = null;
var currentProfile = null;

function $(id){ return document.getElementById(id); }
function showNote(id, msg, kind){
  var el = $(id);
  el.hidden = false;
  el.textContent = msg;
  el.classList.remove('error','ok');
  if (kind) el.classList.add(kind);
}

// ---------- Guard: must be logged in ----------
async function loadUser(){
  if (!LIVE) {
    showNote('usernameNote', 'Preview mode. Connect Supabase to use settings.', 'error');
    return;
  }
  var res = await SUPA.auth.getSession();
  var session = res.data && res.data.session;
  if (!session || !session.user) { window.location.href = 'auth.html'; return; }
  currentUser = session.user;
  var pr = await SUPA.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
  currentProfile = pr.data || null;
  if (currentProfile) $('settingsUsername').value = currentProfile.username || '';
  $('settingsEmail').placeholder = currentUser.email || 'new@example.com';
}

// ---------- Appearance toggle (shared with index.html localStorage) ----------
(function initTheme(){
  var saved = 'light';
  try { saved = localStorage.getItem('kojoh-theme') || 'light'; } catch(e){}
  applyTheme(saved);
  $('themeToggle').addEventListener('click', function(){
    var next = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem('kojoh-theme', next); } catch(e){}
  });
})();
function applyTheme(theme){
  document.body.setAttribute('data-theme', theme);
  $('themeToggle').classList.toggle('on', theme === 'dark');
  $('themeLabel').textContent = theme === 'dark' ? 'Dark' : 'Light';
}

// ---------- Hero theme (shared with index.html localStorage) ----------
(function initHeroTheme(){
  var saved = 'space';
  try { saved = localStorage.getItem('kojoh-hero-theme') || 'space'; } catch(e){}
  markHeroTheme(saved);
})();
function markHeroTheme(theme){
  document.querySelectorAll('.hero-theme-swatch').forEach(function(b){
    b.classList.toggle('active', b.dataset.heroTheme === theme);
  });
}
window.setHeroThemeSetting = function(theme){
  markHeroTheme(theme);
  try { localStorage.setItem('kojoh-hero-theme', theme); } catch(e){}
};

// ---------- Username: live availability + save ----------
var usernameStatusEl = $('settingsUsernameStatus');
var usernameDebounce = null;
$('settingsUsername').addEventListener('input', function(){
  var v = this.value.trim();
  var format = /^[a-zA-Z0-9_]{3,20}$/.test(v) && /[a-zA-Z]/.test(v) && /[0-9]/.test(v);
  if (!v) { usernameStatusEl.className = 'input-status'; usernameStatusEl.textContent = ''; return; }
  if (!format) { usernameStatusEl.className = 'input-status taken'; usernameStatusEl.textContent = 'invalid'; return; }
  if (currentProfile && v.toLowerCase() === (currentProfile.username || '').toLowerCase()) {
    usernameStatusEl.className = 'input-status'; usernameStatusEl.textContent = 'current';
    return;
  }
  usernameStatusEl.className = 'input-status checking'; usernameStatusEl.textContent = 'checking…';
  clearTimeout(usernameDebounce);
  usernameDebounce = setTimeout(function(){
    if (!LIVE) return;
    SUPA.rpc('is_username_available', { p_username: v }).then(function(r){
      if (r.error) { usernameStatusEl.className = 'input-status'; usernameStatusEl.textContent = ''; return; }
      usernameStatusEl.className = 'input-status ' + (r.data ? 'available' : 'taken');
      usernameStatusEl.textContent = r.data ? 'available' : 'taken';
    });
  }, 350);
});

$('usernameForm').addEventListener('submit', async function(e){
  e.preventDefault();
  var v = $('settingsUsername').value.trim();
  var format = /^[a-zA-Z0-9_]{3,20}$/.test(v) && /[a-zA-Z]/.test(v) && /[0-9]/.test(v);
  if (!format) { showNote('usernameNote', 'Username must be 3–20 chars and include letters + numbers.', 'error'); return; }
  if (currentProfile && v.toLowerCase() === (currentProfile.username || '').toLowerCase()) {
    showNote('usernameNote', 'That is already your username.', 'error'); return;
  }
  var avail = await SUPA.rpc('is_username_available', { p_username: v });
  if (avail.error || !avail.data) { showNote('usernameNote', 'That username is not available.', 'error'); return; }
  var upd = await SUPA.from('profiles').update({ username: v }).eq('id', currentUser.id);
  if (upd.error) { showNote('usernameNote', upd.error.message, 'error'); return; }
  currentProfile.username = v;
  showNote('usernameNote', 'Username updated.', 'ok');
});

// ---------- Email change (requires current password) ----------
$('emailForm').addEventListener('submit', async function(e){
  e.preventDefault();
  var newEmail = $('settingsEmail').value.trim();
  var pw = $('settingsEmailPw').value;
  if (!newEmail || !pw) { showNote('emailNote', 'Enter a new email and your current password.', 'error'); return; }

  // Verify current password by re-signing-in with the old email.
  var reauth = await SUPA.auth.signInWithPassword({ email: currentUser.email, password: pw });
  if (reauth.error) { showNote('emailNote', 'Current password is incorrect.', 'error'); return; }

  var upd = await SUPA.auth.updateUser({ email: newEmail });
  if (upd.error) { showNote('emailNote', upd.error.message, 'error'); return; }
  var pupd = await SUPA.from('profiles').update({ email: newEmail }).eq('id', currentUser.id);
  if (pupd.error) console.warn('profile email sync failed', pupd.error);
  showNote('emailNote', 'Confirmation email sent to your new address. Click the link there to finish the change.', 'ok');
});

// ---------- Password change (requires current password) ----------
var newPwEl = $('settingsNewPw');
newPwEl.addEventListener('input', function(){
  var v = this.value;
  $('spwLen').classList.toggle('met', v.length >= 8);
  $('spwUpper').classList.toggle('met', /[A-Z]/.test(v));
  $('spwNum').classList.toggle('met', /[0-9]/.test(v));
  $('spwSpecial').classList.toggle('met', /[^A-Za-z0-9]/.test(v));
});

$('passwordForm').addEventListener('submit', async function(e){
  e.preventDefault();
  var oldPw = $('settingsOldPw').value;
  var newPw = $('settingsNewPw').value;
  if (!oldPw || !newPw) { showNote('passwordNote', 'Fill in both password fields.', 'error'); return; }
  var pwValid = newPw.length >= 8 && /[A-Z]/.test(newPw) && /[0-9]/.test(newPw) && /[^A-Za-z0-9]/.test(newPw);
  if (!pwValid) { showNote('passwordNote', 'New password doesn\'t meet all requirements.', 'error'); return; }

  var reauth = await SUPA.auth.signInWithPassword({ email: currentUser.email, password: oldPw });
  if (reauth.error) { showNote('passwordNote', 'Current password is incorrect.', 'error'); return; }
  var upd = await SUPA.auth.updateUser({ password: newPw });
  if (upd.error) { showNote('passwordNote', upd.error.message, 'error'); return; }
  $('settingsOldPw').value = ''; $('settingsNewPw').value = '';
  document.querySelectorAll('#settingsPwChecklist li').forEach(function(li){ li.classList.remove('met'); });
  showNote('passwordNote', 'Password updated.', 'ok');
});

window.kReady(loadUser);
