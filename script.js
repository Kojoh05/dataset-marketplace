(function(){
// === TYPEWRITER + FACE ANIMATION ===
const phrases = [
  "KOJOH",
  "Datasets nobody else's portfolio is built on."
];
const target = document.getElementById('typeTarget');
const heroTitle = document.getElementById('heroTitle');
const faceLayer = document.getElementById('faceLayer');
let phraseIndex = 0, charIndex = 0, deleting = false;

function updateSizeClass(){
  if(!heroTitle) return;
  if(phraseIndex === 0){
    heroTitle.classList.add('brand-size');
  } else {
    heroTitle.classList.remove('brand-size');
  }
}
updateSizeClass();

function renderText(str){
  if(!target) return;
  target.innerHTML = '';
  for(const ch of str){
    if(ch === ' '){
      target.appendChild(document.createTextNode(' '));
    } else {
      const span = document.createElement('span');
      span.className = (ch === 'O') ? 'char-o' : 'char';
      span.textContent = ch;
      target.appendChild(span);
    }
  }
}

function clearFace(){
  if(faceLayer) faceLayer.innerHTML = '';
}

function buildFace(){
  if(!target || !faceLayer) return;
  clearFace();
  const oSpans = target.querySelectorAll('.char-o');
  oSpans.forEach((span, i) => {
    const left = span.offsetLeft;
    const top = span.offsetTop;
    const w = span.offsetWidth;
    const h = span.offsetHeight;

    const brow = document.createElement('div');
    brow.className = 'eyebrow expr-a ' + (i === 0 ? 'side-left' : 'side-right');
    brow.style.width = (w * 0.85) + 'px';
    brow.style.height = Math.max(4, w * 0.12) + 'px';
    brow.style.left = (left + w * 0.075) + 'px';
    brow.style.top = (top + h * 0.12) + 'px';
    faceLayer.appendChild(brow);
    requestAnimationFrame(() => brow.classList.add('show'));

    const pupil = document.createElement('div');
    pupil.className = 'pupil';
    const pSize = w * 0.24;
    pupil.style.width = pSize + 'px';
    pupil.style.height = pSize + 'px';
    pupil.style.left = (left + w / 2 - pSize / 2) + 'px';
    pupil.style.top = (top + h * 0.42) + 'px';
    faceLayer.appendChild(pupil);
    requestAnimationFrame(() => pupil.classList.add('show'));
  });

  // mouth: bold rounded smile, sits right under the letters
  const wordLeft = target.offsetLeft;
  const wordTop = target.offsetTop;
  const wordWidth = target.offsetWidth;
  const wordHeight = target.offsetHeight;

  const mouthW = wordHeight * 0.62;
  const mouthDepth = mouthW * 0.4;
  const strokeW = Math.max(5, wordHeight * 0.095);
  const svgH = mouthDepth + strokeW;
  const svgNS = 'http://www.w3.org/2000/svg';

  const mouth = document.createElementNS(svgNS, 'svg');
  mouth.setAttribute('class', 'mouth');
  mouth.setAttribute('width', mouthW);
  mouth.setAttribute('height', svgH);
  mouth.setAttribute('viewBox', `0 0 ${mouthW} ${svgH}`);
  mouth.style.left = (wordLeft + wordWidth / 2 - mouthW / 2) + 'px';
  mouth.style.top = (wordTop + wordHeight * 0.9) + 'px';

  const mouthPath = document.createElementNS(svgNS, 'path');
  mouthPath.setAttribute('fill', 'none');
  mouthPath.setAttribute('stroke', 'currentColor');
  mouthPath.setAttribute('stroke-width', strokeW);
  mouthPath.setAttribute('stroke-linecap', 'round');
  mouth.appendChild(mouthPath);
  faceLayer.appendChild(mouth);

  const mx1 = strokeW / 2, mx2 = mouthW - strokeW / 2, midX = mouthW / 2;
  const flatY = strokeW / 2;
  const curvedY = flatY + mouthDepth;
  const mouthD = cy => `M ${mx1},${flatY} Q ${midX},${cy} ${mx2},${flatY}`;
  mouthPath.setAttribute('d', mouthD(flatY));
  requestAnimationFrame(() => mouth.classList.add('show'));

  setTimeout(() => {
    faceLayer.querySelectorAll('.eyebrow').forEach(b => {
      b.classList.remove('expr-a', 'side-left', 'side-right');
      b.classList.add('expr-b');
    });

    const start = performance.now();
    const duration = 650;
    function morphSmile(now){
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      mouthPath.setAttribute('d', mouthD(flatY + (curvedY - flatY) * eased));
      if(t < 1) requestAnimationFrame(morphSmile);
    }
    requestAnimationFrame(morphSmile);
  }, 1600);
}

function typeLoop(){
  const current = phrases[phraseIndex];
  if(!deleting){
    charIndex++;
    renderText(current.slice(0, charIndex));
    if(charIndex === current.length){
      deleting = true;
      if(phraseIndex === 0) buildFace();
      setTimeout(() => { clearFace(); typeLoop(); }, 3200);
      return;
    }
    setTimeout(typeLoop, phraseIndex === 0 ? 130 : 50);
  } else {
    charIndex--;
    renderText(current.slice(0, charIndex));
    if(charIndex === 0){
      deleting = false;
      phraseIndex = (phraseIndex + 1) % phrases.length;
      updateSizeClass();
      setTimeout(typeLoop, 600);
      return;
    }
    setTimeout(typeLoop, 30);
  }
}

if (target && heroTitle && faceLayer) {
  const prefersReducedType = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(prefersReducedType){
    phraseIndex = 1;
    renderText(phrases[1]);
    updateSizeClass();
  } else {
    typeLoop();
  }
}

// === SERVICE WORKER (register once per browser session) ===
if('serviceWorker' in navigator && !window.__kojohSwRegistered){
  window.__kojohSwRegistered = true;
  navigator.serviceWorker.register('/sw.js').catch(function(){});
}

// === PWA INSTALL ===
let deferredPrompt = null;
const panelInstallBtn = document.getElementById('panelInstallBtn');

function showInstallBtns(){
  if(panelInstallBtn) panelInstallBtn.style.display = 'flex';
  var btn = document.getElementById('panelInstallBtn');
  if (btn) btn.style.display = 'flex';
}
function hideInstallBtns(){
  var btn = document.getElementById('panelInstallBtn');
  if (btn) btn.style.display = 'none';
  deferredPrompt = null;
}

async function triggerInstall(){
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if(outcome === 'accepted') hideInstallBtns();
  deferredPrompt = null;
}

// These fire on `window` which persists across soft navigations, so only
// attach them once per browser session (not once per script re-execution).
if (!window.__kojohInstallListenersAttached) {
  window.__kojohInstallListenersAttached = true;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBtns();
  });
  window.addEventListener('appinstalled', hideInstallBtns);
}

// === FOLDER VIEW TOGGLE (Datasets vs Practice) ===
function showFolderView(view){
  const jobs = document.getElementById('jobFolders');
  const practice = document.getElementById('practiceFolders');
  const jobsBtn = document.getElementById('jobsToggleBtn');
  const practiceBtn = document.getElementById('practiceToggleBtn');
  const titleEl = document.getElementById('categories');
  const subEl = document.getElementById('foldersSub');
  if (!jobs || !practice) return;

  if(view === 'practice'){
    jobs.style.display = 'none';
    practice.style.display = '';
    if(jobsBtn) jobsBtn.classList.remove('active');
    if(practiceBtn) practiceBtn.classList.add('active');
    if(jobsBtn) jobsBtn.setAttribute('aria-selected', 'false');
    if(practiceBtn) practiceBtn.setAttribute('aria-selected', 'true');
    if(titleEl) titleEl.textContent = 'Practice by tool';
    if(subEl) subEl.textContent = 'Pick a tool. Each folder has Beginner, Intermediate, and Hard tasks.';
  } else {
    jobs.style.display = '';
    practice.style.display = 'none';
    if(jobsBtn) jobsBtn.classList.add('active');
    if(practiceBtn) practiceBtn.classList.remove('active');
    if(jobsBtn) jobsBtn.setAttribute('aria-selected', 'true');
    if(practiceBtn) practiceBtn.setAttribute('aria-selected', 'false');
    if(titleEl) titleEl.textContent = 'Browse by folder';
    if(subEl) subEl.textContent = "Each folder is a job track. Open one to see what's inside.";
  }
}

// === MOBILE MENU ===
function toggleMenu(){
  const btn = document.getElementById('hamburger');
  const menu = document.getElementById('mobileMenu');
  if (!btn || !menu) return;
  btn.classList.toggle('open');
  menu.classList.toggle('open');
}

// === PROFILE PANEL ===
function openPanel(){
  const overlay = document.getElementById('overlay');
  if (!overlay) return;
  overlay.style.display = 'block';
  requestAnimationFrame(() => overlay.classList.add('open'));
}
function closePanel(){
  const overlay = document.getElementById('overlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  setTimeout(() => { overlay.style.display = 'none'; }, 300);
}

// === NAME EDIT (legacy, kept for pages that still have #nameField) ===
function toggleNameEdit(){
  const field = document.getElementById('nameField');
  if (!field) return;
  const isDisabled = field.disabled;
  field.disabled = !isDisabled;
  if(isDisabled){ field.focus(); field.select(); }
}
(function(){
  var nf = document.getElementById('nameField');
  if (!nf) return;
  nf.addEventListener('blur', function(){ this.disabled = true; });
  nf.addEventListener('keydown', function(e){ if(e.key === 'Enter') this.blur(); });
})();

// === HERO THEME SWITCHER ===
function setHeroTheme(theme){
  document.body.setAttribute('data-hero-theme', theme);
  document.querySelectorAll('.hero-theme-swatch').forEach(function(btn){
    btn.classList.toggle('active', btn.dataset.heroTheme === theme);
  });
  try{ localStorage.setItem('kojoh-hero-theme', theme); }catch(e){}
}
(function(){
  var saved = 'space';
  try{ saved = localStorage.getItem('kojoh-hero-theme') || 'space'; }catch(e){}
  setHeroTheme(saved);
})();

// === HERO CHARACTER (GENDER) SWITCHER ===
var wtCurrentCharacter = 'male';
function setHeroCharacter(character){
  wtCurrentCharacter = character;
  for(var i = 1; i <= 3; i++){
    var frame = document.getElementById('wtFrame' + i);
    if(frame){ frame.src = 'icons/scene/person_' + character + '_' + i + '.png'; }
  }
  document.querySelectorAll('.hero-character-grid .hero-theme-swatch').forEach(function(btn){
    btn.classList.toggle('active', btn.dataset.heroCharacter === character);
  });
  try{ localStorage.setItem('kojoh-hero-character', character); }catch(e){}
}
(function(){
  var saved = 'male';
  try{ saved = localStorage.getItem('kojoh-hero-character') || 'male'; }catch(e){}
  setHeroCharacter(saved);
})();

// Cycle the 3 working-pose frames for a subtle idle animation loop.
// Guarded against soft-navigation re-runs: clear any interval from a
// previous execution of this script before starting a new one, otherwise
// repeated visits to index.html would stack multiple concurrent intervals
// all animating the same (or now-detached) frames.
(function(){
  if (window.__kojohFrameInterval) {
    clearInterval(window.__kojohFrameInterval);
    window.__kojohFrameInterval = null;
  }
  var frameIndex = 1;
  var total = 3;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduceMotion) return;
  if (!document.getElementById('wtFrame1')) return; // not on this page
  window.__kojohFrameInterval = setInterval(function(){
    var current = document.getElementById('wtFrame' + frameIndex);
    frameIndex = (frameIndex % total) + 1;
    var next = document.getElementById('wtFrame' + frameIndex);
    if(current) current.classList.remove('active');
    if(next) next.classList.add('active');
  }, 2600);
})();

// === THEME TOGGLE ===
// theme.js owns the stored preference and applies it to <html> before the
// first paint, so there's nothing to restore here: this only flips it and
// updates whatever toggle UI the current page happens to show.
function toggleTheme(){
  var next = window.kojohToggleTheme ? window.kojohToggleTheme() : 'light';
  var toggle = document.getElementById('themeToggle');
  var label = document.getElementById('themeLabel');
  if (toggle) toggle.classList.toggle('on', next === 'dark');
  if (label) label.textContent = next === 'dark' ? 'Dark' : 'Light';
}

// Expose the functions index.html's inline onclick="..." attributes need:
// wrapping this whole file in an IIFE (so it's safe to re-run on every
// soft-navigation visit without "already declared" errors) means these
// would otherwise be invisible to the global scope those attributes run in.
window.toggleMenu = toggleMenu;
window.openPanel = openPanel;
window.closePanel = closePanel;
window.showFolderView = showFolderView;
window.triggerInstall = triggerInstall;
window.toggleTheme = toggleTheme;
window.setHeroTheme = setHeroTheme;
window.setHeroCharacter = setHeroCharacter;
window.toggleNameEdit = toggleNameEdit;

})();
