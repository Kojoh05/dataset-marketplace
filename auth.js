// === KOJOH AUTH PAGE LOGIC ===
// Works in two modes automatically:
//  - PREVIEW mode: supabase-config.js has empty URL/key -> every step of the
//    UI works (validation, progressive reveal, username-format checks) but
//    "Create account" / "Log in" just show what WOULD happen, no network call.
//  - LIVE mode: once SUPABASE_URL + SUPABASE_ANON_KEY are filled in, the same
//    buttons call the real Supabase Auth + profiles table.

var SUPA = null;
var LIVE = false;
if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY && window.supabase) {
  SUPA = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  LIVE = true;
}

var googleMode = false;
var googleProfile = null; // { email, name } once Google sign-in resolves
var selectedGender = null;
var selectedProfessions = [];

// ---------- Tabs ----------
function switchTab(which){
  document.getElementById('tabLogin').classList.toggle('active', which === 'login');
  document.getElementById('tabSignup').classList.toggle('active', which === 'signup');
  document.getElementById('loginPanel').classList.toggle('active', which === 'login');
  document.getElementById('signupPanel').classList.toggle('active', which === 'signup');
}

// ---------- Country list + IP-based default ----------
var COUNTRIES = ["Afghanistan","Albania","Algeria","Argentina","Armenia","Australia","Austria","Azerbaijan","Bahrain","Bangladesh","Belarus","Belgium","Bolivia","Bosnia and Herzegovina","Brazil","Bulgaria","Cambodia","Cameroon","Canada","Chile","China","Colombia","Costa Rica","Croatia","Cuba","Cyprus","Czechia","Denmark","Dominican Republic","Ecuador","Egypt","Estonia","Ethiopia","Finland","France","Georgia","Germany","Ghana","Greece","Guatemala","Honduras","Hong Kong","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kuwait","Latvia","Lebanon","Lithuania","Luxembourg","Malaysia","Malta","Mexico","Mongolia","Morocco","Myanmar","Nepal","Netherlands","New Zealand","Nigeria","North Macedonia","Norway","Oman","Pakistan","Panama","Paraguay","Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia","Saudi Arabia","Serbia","Singapore","Slovakia","Slovenia","South Africa","South Korea","Spain","Sri Lanka","Sweden","Switzerland","Taiwan","Tanzania","Thailand","Tunisia","Turkey","Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan","Venezuela","Vietnam","Yemen","Zimbabwe"];

function populateCountries(defaultCountry){
  var sel = document.getElementById('suCountry');
  sel.innerHTML = '';
  COUNTRIES.forEach(function(c){
    var opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    sel.appendChild(opt);
  });
  if (defaultCountry && COUNTRIES.indexOf(defaultCountry) !== -1) {
    sel.value = defaultCountry;
  } else {
    sel.value = 'India'; // sensible default for this audience
  }
}
populateCountries('India');

(function detectCountry(){
  var controller = new AbortController();
  var timeout = setTimeout(function(){ controller.abort(); }, 3000);
  fetch('https://ipapi.co/json/', { signal: controller.signal })
    .then(function(r){ return r.json(); })
    .then(function(data){
      clearTimeout(timeout);
      if (data && data.country_name) populateCountries(data.country_name);
    })
    .catch(function(){ /* offline or blocked - keep default */ });
})();

// ---------- Progressive reveal (signup) ----------
function reveal(id){
  var el = document.getElementById(id);
  if (el.hidden) el.hidden = false;
}

var emailValid = false, usernameValid = false, usernameChecking = false, usernameTaken = null;
var pwValid = false;

document.getElementById('suEmail').addEventListener('input', function(){
  var v = this.value.trim();
  emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  document.getElementById('emailHint').textContent = v && !emailValid ? 'Enter a valid email address.' : '';
  if (emailValid) reveal('stepUsername');
});

var usernameTimer = null;
document.getElementById('suUsername').addEventListener('input', function(){
  var v = this.value.trim();
  var statusEl = document.getElementById('usernameStatus');
  var formatOk = /^[a-zA-Z0-9_]{3,20}$/.test(v) && /[a-zA-Z]/.test(v) && /[0-9]/.test(v);
  clearTimeout(usernameTimer);
  usernameValid = false;
  if (!v) { statusEl.textContent = ''; statusEl.className = 'input-status'; return; }
  if (!formatOk) {
    statusEl.textContent = 'invalid format';
    statusEl.className = 'input-status taken';
    return;
  }
  statusEl.textContent = 'checking…';
  statusEl.className = 'input-status checking';
  usernameTimer = setTimeout(function(){ checkUsername(v, statusEl); }, 450);
});

function checkUsername(username, statusEl){
  if (!LIVE) {
    // preview mode - simulate an availability check
    setTimeout(function(){
      statusEl.textContent = 'available (preview)';
      statusEl.className = 'input-status available';
      usernameValid = true;
      reveal('stepPassword');
    }, 350);
    return;
  }
  SUPA.rpc('is_username_available', { p_username: username }).then(function(res){
    if (res.error) {
      statusEl.textContent = 'error checking';
      statusEl.className = 'input-status taken';
      return;
    }
    if (res.data) {
      statusEl.textContent = 'available';
      statusEl.className = 'input-status available';
      usernameValid = true;
      reveal('stepPassword');
    } else {
      statusEl.textContent = 'already taken';
      statusEl.className = 'input-status taken';
      usernameValid = false;
    }
  });
}

document.getElementById('suPassword').addEventListener('input', function(){
  var v = this.value;
  var checks = {
    pwLen: v.length >= 8,
    pwUpper: /[A-Z]/.test(v),
    pwNum: /[0-9]/.test(v),
    pwSpecial: /[^A-Za-z0-9]/.test(v)
  };
  Object.keys(checks).forEach(function(id){
    document.getElementById(id).classList.toggle('met', checks[id]);
  });
  pwValid = checks.pwLen && checks.pwUpper && checks.pwNum && checks.pwSpecial;
  if (pwValid) {
    reveal('stepCountry');
    reveal('stepName');
  }
});

function checkNameStep(){
  var first = document.getElementById('suFirstName').value.trim();
  var last = document.getElementById('suLastName').value.trim();
  if (first && last) reveal('stepGender');
}
document.getElementById('suFirstName').addEventListener('input', checkNameStep);
document.getElementById('suLastName').addEventListener('input', checkNameStep);

function selectGender(value){
  selectedGender = value;
  document.querySelectorAll('#genderGroup .pill-choice').forEach(function(btn){
    btn.classList.toggle('selected', btn.dataset.value === value);
  });
  reveal('stepProfessions');
}

function toggleProfession(btn){
  var value = btn.dataset.value;
  var idx = selectedProfessions.indexOf(value);
  if (idx === -1) { selectedProfessions.push(value); btn.classList.add('selected'); }
  else { selectedProfessions.splice(idx, 1); btn.classList.remove('selected'); }
  document.getElementById('createAccountBtn').hidden = selectedProfessions.length === 0;
}

// ---------- Google (sign up) ----------
function handleGoogleSignup(){
  if (LIVE) {
    SUPA.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/auth.html?google=1' } });
    return;
  }
  // Preview mode: simulate what Google would hand back, then skip straight
  // to the username step just like the real flow would.
  googleMode = true;
  googleProfile = { email: 'you@gmail.com (preview)', firstName: '', lastName: '' };
  document.getElementById('googleConfirmText').textContent = 'Continuing as ' + googleProfile.email;
  document.getElementById('googleConfirmChip').hidden = false;
  document.getElementById('googleSignupBtn').hidden = true;
  document.getElementById('signupDivider').hidden = true;
  document.getElementById('stepEmail').hidden = true;
  emailValid = true;
  reveal('stepUsername');
  document.getElementById('passwordLabel').textContent = 'Create a password for KOJOH (used alongside Google sign-in)';
}
function undoGoogle(){
  googleMode = false; googleProfile = null;
  document.getElementById('googleConfirmChip').hidden = true;
  document.getElementById('googleSignupBtn').hidden = false;
  document.getElementById('signupDivider').hidden = false;
  document.getElementById('stepEmail').hidden = false;
  document.getElementById('passwordLabel').textContent = 'Password';
}
function handleGoogleLogin(){
  if (LIVE) {
    SUPA.auth.signInWithOAuth({ provider: 'google' });
    return;
  }
  document.getElementById('loginError').textContent = 'Preview mode — connect Supabase to enable real Google login.';
  document.getElementById('loginError').style.color = 'var(--muted)';
}

// ---------- Submit: sign up ----------
function handleSignup(){
  var errEl = document.getElementById('signupError');
  errEl.textContent = '';

  var payload = {
    email: googleMode ? googleProfile.email : document.getElementById('suEmail').value.trim(),
    username: document.getElementById('suUsername').value.trim(),
    password: document.getElementById('suPassword').value,
    country: document.getElementById('suCountry').value,
    firstName: document.getElementById('suFirstName').value.trim(),
    middleName: document.getElementById('suMiddleName').value.trim(),
    lastName: document.getElementById('suLastName').value.trim(),
    gender: selectedGender,
    professions: selectedProfessions.slice(),
    provider: googleMode ? 'google' : 'email'
  };

  if (!usernameValid) { errEl.textContent = 'Please choose an available username.'; return; }
  if (!pwValid) { errEl.textContent = 'Password does not meet the requirements yet.'; return; }
  if (!payload.firstName || !payload.lastName) { errEl.textContent = 'Please enter your first and last name.'; return; }
  if (!selectedGender) { errEl.textContent = 'Please select a gender.'; return; }
  if (selectedProfessions.length === 0) { errEl.textContent = 'Pick at least one interested profession.'; return; }

  if (!LIVE) {
    console.log('[KOJOH signup - preview payload]', payload);
    var note = document.getElementById('backendNote');
    note.hidden = false;
    note.textContent = 'Preview mode: no account was created (Supabase isn\'t connected yet). Your form data was logged to the browser console so you can see exactly what will be sent once the backend is live.';
    return;
  }

  SUPA.auth.signUp({ email: payload.email, password: payload.password })
    .then(function(res){
      if (res.error) { errEl.textContent = res.error.message; return; }
      var userId = res.data.user.id;
      return SUPA.from('profiles').insert({
        id: userId,
        username: payload.username,
        email: payload.email,
        first_name: payload.firstName,
        middle_name: payload.middleName || null,
        last_name: payload.lastName,
        gender: payload.gender,
        country: payload.country,
        auth_provider: payload.provider
      }).then(function(profileRes){
        if (profileRes.error) { errEl.textContent = profileRes.error.message; return; }
        return SUPA.from('job_titles').select('id, name').in('name', payload.professions)
          .then(function(jtRes){
            if (jtRes.error || !jtRes.data || jtRes.data.length === 0) return;
            var rows = jtRes.data.map(function(jt){ return { profile_id: userId, job_title_id: jt.id }; });
            return SUPA.from('profile_job_titles').insert(rows);
          });
      }).then(function(){
        var note = document.getElementById('backendNote');
        note.hidden = false;
        note.textContent = 'Account created! Check your email to verify before logging in.';
      });
    });
}

// ---------- Submit: log in ----------
function handleLogin(){
  var errEl = document.getElementById('loginError');
  errEl.textContent = '';
  errEl.style.color = '';
  var id = document.getElementById('loginId').value.trim();
  var password = document.getElementById('loginPassword').value;

  if (!id || !password) { errEl.textContent = 'Enter your email/username and password.'; return; }

  if (!LIVE) {
    console.log('[KOJOH login - preview payload]', { id: id, password: password });
    errEl.style.color = 'var(--muted)';
    errEl.textContent = 'Preview mode: connect Supabase to enable real login. Payload logged to console.';
    return;
  }

  var isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id);
  var loginWithEmail = function(email){
    SUPA.auth.signInWithPassword({ email: email, password: password }).then(function(res){
      if (res.error) { errEl.textContent = res.error.message; return; }
      window.location.href = 'index.html';
    });
  };

  if (isEmail) {
    loginWithEmail(id);
  } else {
    SUPA.rpc('get_email_by_username', { p_username: id }).then(function(res){
      if (res.error || !res.data) { errEl.textContent = 'No account found with that username.'; return; }
      loginWithEmail(res.data);
    });
  }
}
