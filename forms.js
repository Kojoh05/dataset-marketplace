// === KOJOH FORM BEHAVIOUR ===
// Two things, applied automatically to every form on the page:
//   1. A show/hide eye button on every password field.
//   2. Enter moves to the next empty field, and on the last one it
//      presses the form's primary button, so a form can be completed
//      without touching the mouse.
// Safe to run more than once (soft navigation re-runs page scripts).

(function () {
  var EYE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.5 20 20.5"/><path d="M9.6 6.1A8.9 8.9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.4 4.1"/><path d="M6.3 8.2A16.6 16.6 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 3.3-.6"/><path d="M10.1 10.3a3 3 0 0 0 4 4.2"/></svg>';

  // ---------- 1. Password reveal ----------
  function addEye(input) {
    if (input.dataset.kPwDone === '1') return;
    input.dataset.kPwDone = '1';

    var wrap = document.createElement('span');
    wrap.className = 'pw-field';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pw-eye';
    btn.tabIndex = -1; // keep it out of the tab/enter order
    btn.setAttribute('aria-label', 'Show password');
    btn.innerHTML = EYE;
    wrap.appendChild(btn);

    btn.addEventListener('click', function () {
      var showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.innerHTML = showing ? EYE : EYE_OFF;
      btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
      input.focus();
      // put the caret back at the end rather than selecting everything
      var v = input.value;
      try { input.setSelectionRange(v.length, v.length); } catch (e) {}
    });
  }

  function decoratePasswords() {
    var inputs = document.querySelectorAll('input[type="password"]');
    Array.prototype.forEach.call(inputs, addEye);
  }

  // ---------- 2. Enter advances / submits ----------
  var BUTTON_SELECTOR = 'button[type="submit"], .auth-submit, .settings-submit, .page-submit';
  var CHOICE_SELECTOR = '.pill-choice, .chip-choice';

  function visible(el) {
    if (!el || el.disabled) return false;
    if (el.closest('[hidden]')) return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function isEmpty(el) {
    return !String(el.value || '').trim();
  }

  function scopeFor(el) {
    return el.closest('form') ||
           el.closest('.auth-panel, .settings-section, .page-card, main') ||
           document.body;
  }

  function fieldsIn(scope) {
    var all = scope.querySelectorAll('input, select, textarea');
    return Array.prototype.filter.call(all, function (el) {
      if (el.type === 'hidden' || el.type === 'submit' || el.type === 'button') return false;
      if (el.type === 'checkbox' || el.type === 'radio') return false;
      return visible(el);
    });
  }

  function primaryButton(scope) {
    var buttons = scope.querySelectorAll(BUTTON_SELECTOR);
    for (var i = 0; i < buttons.length; i++) {
      if (visible(buttons[i])) return buttons[i];
    }
    // The button may sit just outside the scope (e.g. a panel-level submit).
    var outer = scope.parentNode && scope.parentNode.closest
      ? scope.parentNode.closest('.auth-panel, .settings-section, main')
      : null;
    if (outer && outer !== scope) {
      var more = outer.querySelectorAll(BUTTON_SELECTOR);
      for (var j = 0; j < more.length; j++) {
        if (visible(more[j])) return more[j];
      }
    }
    return null;
  }

  function nextChoice(scope) {
    // Steps like gender / professions are buttons, not inputs. If that's
    // what comes next, put focus there so Enter or Space keeps going.
    var choices = scope.querySelectorAll(CHOICE_SELECTOR);
    for (var i = 0; i < choices.length; i++) {
      if (visible(choices[i]) && !choices[i].classList.contains('selected') &&
          !choices[i].classList.contains('active') && !choices[i].classList.contains('on')) {
        return choices[i];
      }
    }
    return null;
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;

    var el = e.target;
    if (!el || !el.tagName) return;
    var tag = el.tagName.toLowerCase();
    if (tag === 'textarea') return;            // Enter should insert a newline
    if (tag !== 'input' && tag !== 'select') return;
    if (el.type === 'submit' || el.type === 'button') return;

    var scope = scopeFor(el);
    var fields = fieldsIn(scope);
    var index = fields.indexOf(el);
    if (index === -1) return;

    e.preventDefault(); // we drive the flow ourselves, no native submit

    // Next field after this one that still needs filling.
    for (var i = index + 1; i < fields.length; i++) {
      if (isEmpty(fields[i])) { fields[i].focus(); return; }
    }

    // Nothing left to fill: press the primary button if it's available.
    var btn = primaryButton(scope);
    if (btn) { btn.click(); return; }

    // Otherwise the next thing to do is a choice step (gender, professions).
    var choice = nextChoice(scope);
    if (choice) { choice.focus(); return; }

    // Last resort: go back and fill the first empty field we skipped.
    for (var k = 0; k < fields.length; k++) {
      if (isEmpty(fields[k]) && fields[k] !== el) { fields[k].focus(); return; }
    }
  });

  function init() {
    decoratePasswords();
  }

  if (window.kReady) window.kReady(init);
  else if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
