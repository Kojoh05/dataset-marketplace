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
  if(phraseIndex === 0){
    heroTitle.classList.add('brand-size');
  } else {
    heroTitle.classList.remove('brand-size');
  }
}
updateSizeClass();

function renderText(str){
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
  faceLayer.innerHTML = '';
}

function buildFace(){
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

  // mouth — bold rounded smile, sits right under the letters
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

const prefersReducedType = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if(prefersReducedType){
  phraseIndex = 1;
  renderText(phrases[1]);
  updateSizeClass();
} else {
  typeLoop();
}

// === SERVICE WORKER ===
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}

// === PWA INSTALL ===
let deferredPrompt = null;
const panelInstallBtn = document.getElementById('panelInstallBtn');

function showInstallBtns(){
  panelInstallBtn.style.display = 'flex';
}
function hideInstallBtns(){
  panelInstallBtn.style.display = 'none';
  deferredPrompt = null;
}

async function triggerInstall(){
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if(outcome === 'accepted') hideInstallBtns();
  deferredPrompt = null;
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallBtns();
});

window.addEventListener('appinstalled', hideInstallBtns);

// === FOLDER VIEW TOGGLE (Datasets vs Practice) ===
function showFolderView(view){
  const jobs = document.getElementById('jobFolders');
  const practice = document.getElementById('practiceFolders');
  const jobsBtn = document.getElementById('jobsToggleBtn');
  const practiceBtn = document.getElementById('practiceToggleBtn');
  const titleEl = document.getElementById('categories');
  const subEl = document.getElementById('foldersSub');

  if(view === 'practice'){
    jobs.style.display = 'none';
    practice.style.display = '';
    jobsBtn.classList.remove('active');
    practiceBtn.classList.add('active');
    jobsBtn.setAttribute('aria-selected', 'false');
    practiceBtn.setAttribute('aria-selected', 'true');
    titleEl.textContent = 'Practice by tool';
    subEl.textContent = 'Pick a tool — each folder has Beginner, Intermediate, and Hard tasks.';
  } else {
    jobs.style.display = '';
    practice.style.display = 'none';
    jobsBtn.classList.add('active');
    practiceBtn.classList.remove('active');
    jobsBtn.setAttribute('aria-selected', 'true');
    practiceBtn.setAttribute('aria-selected', 'false');
    titleEl.textContent = 'Browse by folder';
    subEl.textContent = "Each folder is a job track. Open one to see what's inside.";
  }
}

// === MOBILE MENU ===
function toggleMenu(){
  const btn = document.getElementById('hamburger');
  const menu = document.getElementById('mobileMenu');
  btn.classList.toggle('open');
  menu.classList.toggle('open');
}

// === PROFILE PANEL ===
function openPanel(){
  const overlay = document.getElementById('overlay');
  overlay.style.display = 'block';
  requestAnimationFrame(() => overlay.classList.add('open'));
}
function closePanel(){
  const overlay = document.getElementById('overlay');
  overlay.classList.remove('open');
  setTimeout(() => { overlay.style.display = 'none'; }, 300);
}

// === NAME EDIT ===
function toggleNameEdit(){
  const field = document.getElementById('nameField');
  const isDisabled = field.disabled;
  field.disabled = !isDisabled;
  if(isDisabled){ field.focus(); field.select(); }
}
document.getElementById('nameField').addEventListener('blur', function(){ this.disabled = true; });
document.getElementById('nameField').addEventListener('keydown', function(e){ if(e.key === 'Enter') this.blur(); });

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
// For now this is a manual pick in the profile panel. Once signup collects a
// gender field, call setHeroCharacter() with that stored value automatically
// instead of (or in addition to) reading localStorage here.
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
(function(){
  var frameIndex = 1;
  var total = 3;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduceMotion) return;
  setInterval(function(){
    var current = document.getElementById('wtFrame' + frameIndex);
    frameIndex = (frameIndex % total) + 1;
    var next = document.getElementById('wtFrame' + frameIndex);
    if(current) current.classList.remove('active');
    if(next) next.classList.add('active');
  }, 2600);
})();

// === THEME TOGGLE ===
function toggleTheme(){
  const body = document.body;
  const toggle = document.getElementById('themeToggle');
  const label = document.getElementById('themeLabel');
  const isDark = body.getAttribute('data-theme') === 'dark';
  if(isDark){
    body.setAttribute('data-theme','light');
    toggle.classList.remove('on');
    label.textContent = 'Light';
  } else {
    body.setAttribute('data-theme','dark');
    toggle.classList.add('on');
    label.textContent = 'Dark';
  }
}
