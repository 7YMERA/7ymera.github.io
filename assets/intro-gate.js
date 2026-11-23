/* intro-gate.js: unique per-tab interactive entry gates that unlock each page's Web Audio soundtrack
   + scroll-driven PC-to-Journal Book Flip transition on /notes/. */
(function () {
  'use strict';
  var d = document, path = (location.pathname || '/').toLowerCase();
  var page = path.indexOf('/play') === 0 ? 'play'
    : path.indexOf('/lab') === 0 ? 'lab'
    : path.indexOf('/portfolio') === 0 ? 'portfolio'
    : path.indexOf('/notes') === 0 && (path === '/notes/' || path === '/notes/index.html') ? 'notes'
    : '';
  if (!page) return;

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function unlockAudio(withSound) {
    if (!withSound || !window.SFX) return;
    try { SFX.set(true); } catch (e) {}
    setTimeout(function () {
      try {
        if (page === 'play') {
          SFX.beep(988, .08, 'square', .07);
          setTimeout(function () { SFX.beep(1319, .24, 'square', .08); }, 85);
        } else if (page === 'lab') {
          SFX.cue('sat-on');
        } else {
          SFX.done();
        }
      } catch (e) {}
    }, 90);
  }

  function buildGate() {
    // Skip fullscreen gate on deep hash links (e.g. /lab/#scorelab or /portfolio/#work) so direct jumps land immediately
    if (location.hash && location.hash.length > 1) return;

    var el = d.createElement('div');
    el.className = 'ig-gate ig-gate--' + page;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');

    if (page === 'play') {
      el.setAttribute('aria-label', 'Enter the Arcade');
      el.innerHTML =
        '<div class="ig-stage"><div class="ig-crt">' +
          '<p class="ig-kicker">PLAYER 1 · 5 CABINETS · ARCADE PULSE 124 BPM</p>' +
          '<div class="ig-coin-rig" aria-hidden="true"><div class="ig-coin">\\7</div><div class="ig-slot"></div></div>' +
          '<h2 class="ig-title">Insert Coin</h2>' +
          '<p class="ig-sub">Drop a token to power up the arcade screen and start the chiptune soundtrack.</p>' +
          '<div class="ig-actions">' +
            '<button type="button" class="ig-btn" data-ig-go>Insert Coin · Play</button>' +
            '<button type="button" class="ig-quiet" data-ig-quiet>Enter quietly (no sound)</button>' +
          '</div>' +
        '</div></div>';
    } else if (page === 'lab') {
      el.setAttribute('aria-label', 'Enter the Lab');
      el.innerHTML =
        '<div class="ig-hatch ig-hatch--top" aria-hidden="true"></div>' +
        '<div class="ig-hatch ig-hatch--bot" aria-hidden="true"></div>' +
        '<div class="ig-stage">' +
          '<div class="ig-core" aria-hidden="true"><div class="ig-ring"></div><div class="ig-ring ig-ring--2"></div><div class="ig-core-dot">L4</div></div>' +
          '<p class="ig-kicker">SECTOR 04 · EXPERIMENTAL LAB · THE GRID 118 BPM</p>' +
          '<h2 class="ig-title">Ignite the Reactor</h2>' +
          '<p class="ig-sub">Unseal the containment hatch to inspect the NASA satellite, live shaders, SQL playgrounds &amp; Score Lab.</p>' +
          '<div class="ig-actions">' +
            '<button type="button" class="ig-btn" data-ig-go>Ignite Reactor · Enter Lab</button>' +
            '<button type="button" class="ig-quiet" data-ig-quiet>Enter quietly (no sound)</button>' +
          '</div>' +
        '</div>';
    } else if (page === 'portfolio') {
      el.setAttribute('aria-label', 'Open Portfolio');
      el.innerHTML =
        '<div class="ig-leaf ig-leaf--l" aria-hidden="true"></div>' +
        '<div class="ig-leaf ig-leaf--r" aria-hidden="true"></div>' +
        '<div class="ig-stage">' +
          '<div class="ig-seal" aria-hidden="true">\\7</div>' +
          '<p class="ig-kicker">ALIF NAJMI · BUSINESS ANALYST · KLCC LOUNGE 78 BPM</p>' +
          '<h2 class="ig-title">Executive Dossier</h2>' +
          '<p class="ig-sub">Unseal the portfolio — shipped projects, SLB &amp; axrail.ai experience, skills, credentials, and live CV.</p>' +
          '<div class="ig-actions">' +
            '<button type="button" class="ig-btn" data-ig-go>Open Portfolio</button>' +
            '<button type="button" class="ig-quiet" data-ig-quiet>Enter quietly (no sound)</button>' +
          '</div>' +
        '</div>';
    } else if (page === 'notes') {
      el.setAttribute('aria-label', 'Boot Notes Workstation');
      el.innerHTML =
        '<div class="ig-stage"><div class="ig-pc">' +
          '<div class="ig-pc-bar" aria-hidden="true"><i></i><i></i><i></i><span>7YMERA OS · WORKSPACE</span></div>' +
          '<div class="ig-pc-scr">' +
            '<div class="ig-pc-icons" aria-hidden="true">' +
              '<div class="ig-pc-ic"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/></svg><span>10 Folders</span></div>' +
              '<div class="ig-pc-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg><span>13 Notes</span></div>' +
              '<div class="ig-pc-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/></svg><span>Quiet Study</span></div>' +
            '</div>' +
            '<h2 class="ig-title">Open the PC</h2>' +
            '<p class="ig-sub">Boot the project files workspace — then scroll down to flip open the field-notes journal.</p>' +
            '<div class="ig-actions">' +
              '<button type="button" class="ig-btn" data-ig-go>Power On · Open PC</button>' +
              '<button type="button" class="ig-quiet" data-ig-quiet>Enter quietly (no sound)</button>' +
            '</div>' +
          '</div>' +
        '</div></div>';
    }

    var done = false;
    function dismiss(withSound) {
      if (done) return;
      done = true;
      unlockAudio(withSound);
      if (reduce) {
        el.remove();
        return;
      }
      el.classList.add('ig-go');
      var delay = page === 'play' ? 760 : 620;
      setTimeout(function () { el.classList.add('ig-out'); }, delay);
      setTimeout(function () { if (el.parentNode) el.remove(); }, delay + 460);
    }

    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-ig-go]')) dismiss(true);
      else if (e.target.closest('[data-ig-quiet]')) dismiss(false);
    });
    d.addEventListener('keydown', function onKey(e) {
      if (done) { d.removeEventListener('keydown', onKey); return; }
      if (e.key === 'Escape') dismiss(false);
    });

    d.body.appendChild(el);
  }

  // On /notes/: wrap the Every Note list (.ni-list .notes-index) in a 3D hardcover journal that flips open on scroll
  function buildNotesJournal() {
    if (page !== 'notes') return;
    var listSec = d.querySelector('.ni-list');
    var idx = listSec && listSec.querySelector('.notes-index');
    if (!idx || listSec.querySelector('.nj-wrap')) return;

    var wrap = d.createElement('div');
    wrap.className = 'nj-wrap' + (reduce ? ' nj-open' : '');

    var book = d.createElement('div');
    book.className = 'nj-book';
    book.innerHTML = '<div class="nj-book-head"><b>Field Notes · Vol. I</b><span>Exited PC Workspace · Journal View · 13 Entries</span></div>';

    var cover = d.createElement('button');
    cover.type = 'button';
    cover.className = 'nj-cover';
    cover.setAttribute('aria-label', 'Flip open Field Notes journal');
    cover.innerHTML =
      '<div class="nj-cover-in">' +
        '<small>ALIF NAJMI · VOL. I</small>' +
        '<strong>Field Notes Journal</strong>' +
        '<span>Exiting the PC file workspace — flipping open all 13 engineering write-ups.</span>' +
        '<em>Click or scroll to flip open</em>' +
      '</div>';

    idx.parentNode.insertBefore(wrap, idx);
    book.appendChild(idx);
    wrap.appendChild(book);
    wrap.appendChild(cover);

    var opened = reduce;
    function openBook() {
      if (opened) return;
      opened = true;
      wrap.classList.add('nj-open');
      if (window.SFX && SFX.on) { try { SFX.chime(2); } catch (e) {} }
    }
    cover.addEventListener('click', openBook);

    if (!reduce && 'IntersectionObserver' in window) {
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting && en.intersectionRatio >= 0.2) {
            openBook();
            obs.disconnect();
          }
        });
      }, { threshold: [0.2] });
      obs.observe(wrap);
    }
  }

  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', function () { buildGate(); buildNotesJournal(); });
  } else {
    buildGate();
    buildNotesJournal();
  }
})();
