/* Small motion extras, inspired by components on 21st.dev:
 * number ticker, timeline beam, border spotlight and the dock's active link.
 * Everything here is decoration: the page reads the same without it. */
(function () {
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Curtain intro: --p goes 0 -> 1 as you scroll through it; the photo
  // columns part and grow, and the name fades.
  var cur = document.getElementById('curtain');
  // Split the name into letters so they can rise in one after another.
  var nm = document.getElementById('cur-name');
  if (nm && !calm) {
    var txt = nm.textContent, i = 0;
    nm.innerHTML = txt.split('').map(function (c) {
      if (c === ' ') return '<span class="sp" aria-hidden="true"> </span>';
      return '<span class="ch' + (c === '.' ? ' dot' : '') + '" aria-hidden="true" style="--i:' + (i++) + '">' + c + '</span>';
    }).join('');
  }
  // A soft spotlight follows the cursor around the curtain (mouse only).
  var spot = document.getElementById('cur-spot'), fr = document.getElementById('cur-frame');
  if (spot && fr && !calm && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var sx = 0, sy = 0, sq = false;
    fr.addEventListener('pointermove', function (e) {
      var r = fr.getBoundingClientRect(); sx = e.clientX - r.left; sy = e.clientY - r.top;
      fr.classList.add('lit');
      if (!sq) { sq = true; requestAnimationFrame(function () { sq = false; spot.style.transform = 'translate3d(' + sx + 'px,' + sy + 'px,0)'; }); }
    });
    fr.addEventListener('pointerleave', function () { fr.classList.remove('lit'); });
  }
  if (cur) {
    // The opening, in three acts as you scroll through it:
    //  1. the framed card grows to fill the screen,
    //  2. the photo columns part and the name fades, while the spinning reel
    //     behind them comes forward and rises to the top,
    //  3. "I write the spec. Then I build it." arrives under the reel.
    // Everything moves with transform and opacity only.
    var cta = document.getElementById('cur-cta');
    var frame = document.getElementById('cur-frame'), stage = cur.querySelector('.cur-stage');
    var colL = cur.querySelector('.cur-col.left:not(.outer)'), colR = cur.querySelector('.cur-col.right:not(.outer)'), outL = cur.querySelector('.cur-col.left.outer'), outR = cur.querySelector('.cur-col.right.outer'), mid = cur.querySelector('.cur-center');
    var reel = cur.querySelector('.cur-reel'), ch = document.getElementById('cur-hero'), title = document.getElementById('cur-title');
    var clamp = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
    var ease = function (t) { return t * t * (3 - 2 * t); };
    var Hs = 0, R = 0, endY = 0;
    // OPENING: establishing stage. On the 3D page the first ~0.9 screen of scroll shows the bare city; the
    // curtain (cards, name card, reel) comes in over it, driven by the same scroll position as the old acts.
    // e: 0 -> 1 across that first stretch (E px); p: 0 -> 1 across the rest, exactly as before.
    var root = document.documentElement, intro = document.getElementById('op-intro'), cue = document.getElementById('op-cue');
    function hasGl() { return root.classList.contains('gl'); }
    // Scroll budget of the opening, in screen heights (the CSS height of .curtain is 100svh + their sum):
    // EST bare city (the curtain comes in over its last third), HOLD1 the name card stays, ACTS the columns part and the
    // reel and headline arrive, HOLD2 the finished headline stays.
    var EST = 1.8, HOLD1 = .8, ACTS = 2.2;
    function estLen() { return hasGl() && !calm ? Math.round(innerHeight * EST) : 0; }
    function measure() {
      Hs = stage.clientHeight; R = reel ? reel.offsetHeight : 0;
      // Centre the reel and the headline as one block, a little above middle.
      var gap = innerWidth < 760 ? 14 : 22, hh = ch ? ch.offsetHeight : 0;
      // Centre the reel and headline as one block (a touch above middle).
      var top = Math.max(Hs * .04, (Hs - (R * .85 + gap + hh)) / 2 - Hs * .03);
      endY = top + R * .85 / 2 - Hs / 2;           // where the reel's centre ends up
      if (ch) ch.style.top = (top + R * .85 + gap) + 'px';
    }
    // Progress runs over the time the stage is pinned, so every act plays
    // while it's on screen; the last stretch holds the finished headline.
    function range() { return cur.offsetHeight - innerHeight; }
    function apply(p, e) {
      var q = p;
      if (e === undefined) e = 1;
      var en = ease(clamp(e)), ex = (1 - en) * innerWidth * .5, ey = (1 - en) * 80;
      stage.style.setProperty('--en', en.toFixed(3));
      // (No clip: the photo columns run to the screen edges, so nothing gets cut mid-air.)
      var c = ease(clamp(q / .5)), dx = c * innerWidth * .55, sc = 1 + c * .25;
      colL.style.transform = 'translate3d(' + (-dx - ex) + 'px, 0, 0) rotate(' + (-7 - c * 10) + 'deg) scale(' + sc + ')';
      colR.style.transform = 'translate3d(' + (dx + ex) + 'px, 0, 0) rotate(' + (7 + c * 10) + 'deg) scale(' + sc + ')';
      // The outer columns part a little faster, for depth.
      if (outL) outL.style.transform = 'translate3d(' + (-dx * 1.35 - ex * 1.3) + 'px, 0, 0) rotate(' + (-5 - c * 8) + 'deg) scale(' + (.86 + c * .2) + ')';
      if (outR) outR.style.transform = 'translate3d(' + (dx * 1.35 + ex * 1.3) + 'px, 0, 0) rotate(' + (5 + c * 8) + 'deg) scale(' + (.86 + c * .2) + ')';
      mid.style.opacity = (Math.max(0, 1 - q * 4.5) * en).toFixed(3);
      mid.style.transform = 'translate3d(0, ' + (-q * 60 + ey) + 'px, 0) scale(' + (1 - q * .08) + ')';
      mid.style.pointerEvents = en > .6 ? 'auto' : 'none';
      if (reel) {
        var m = ease(clamp((q - .3) / .4));
        // Faint behind the photos from the start, then full strength as it rises.
        reel.style.opacity = ((.32 + .68 * clamp((q - .2) / .24)) * en).toFixed(3);
        reel.style.transform = 'translate3d(0, ' + (m * endY).toFixed(1) + 'px, 0) scale(' + (1 - .15 * m).toFixed(3) + ')';
      }
      if (ch) {
        var o = clamp((q - .62) / .22);
        ch.style.opacity = o.toFixed(3);
        ch.style.transform = 'translate3d(0, ' + ((1 - o) * 26).toFixed(1) + 'px, 0)';
        ch.style.pointerEvents = o > .5 ? 'auto' : 'none';
        if (o > .05 && title && !title.classList.contains('reveal')) title.classList.add('reveal');
      }
    }
    cta.addEventListener('click', function () { scrollTo({ top: cur.offsetTop + (estLen() ? estLen() + innerHeight * (HOLD1 + ACTS + .5) : range() * .98), behavior: calm ? 'auto' : 'smooth' }); });
    // The scroll cue: bring the curtain fully in (end of the establishing stretch).
    function curtainInY() {
      var E = estLen();
      if (E) return cur.getBoundingClientRect().top + scrollY + E + innerHeight * HOLD1 * .4;
      return stage.getBoundingClientRect().top + scrollY - (header ? header.offsetHeight : 0);
    }
    var header = document.querySelector('.top');
    if (cue) cue.addEventListener('click', function () { scrollTo({ top: Math.ceil(curtainInY()), behavior: calm ? 'auto' : 'smooth' }); });
    // Tabbing from the cue into the curtain's own button brings the curtain in, so focus is never on something unseen.
    mid.addEventListener('focusin', function () {
      var E = estLen();
      if (E && scrollY < curtainInY() - 2) scrollTo({ top: Math.ceil(curtainInY()), behavior: 'auto' });
    });
    // Cue + wordmark: visible only over the bare city; fades out as the curtain comes in (hidden from tabbing once gone).
    function cueState(e) {
      if (!intro) return;
      var o = clamp(1 - e / .3);
      // the top bar stays out of the way while the city has the screen to itself; it returns as the curtain starts in
      var bare = e <= .02 && hasGl();
      if (root.classList.contains('op-bare') !== bare) root.classList.toggle('op-bare', bare);
      intro.style.opacity = o.toFixed(3);
      var away = o <= 0;
      if (intro.classList.contains('away') !== away) intro.classList.toggle('away', away);
    }
    measure();
    if (calm) {
      // No motion: show the finished state straight away. The cue just disappears once you have scrolled off the first screen.
      apply(1);
      var cb = false;
      var calmTick = function () { cb = false; var gone = scrollY > innerHeight * .35; if (intro) { intro.style.opacity = ''; intro.classList.toggle('away', gone); } };
      addEventListener('scroll', function () { if (!cb) { cb = true; requestAnimationFrame(calmTick); } }, { passive: true });
      addEventListener('resize', function () { measure(); apply(1); calmTick(); }); calmTick();
    } else {
      var busy = false, lastP = -1, lastE = -1;
      var tick = function () {
        busy = false;
        var E = estLen(), s = Math.max(0, -cur.getBoundingClientRect().top), rg = range();
        // the city alone for the first two thirds of EST, then the curtain comes in over the last third
        var e = E ? clamp((s - E * .66) / (E * .34)) : 1;
        // with the establishing stage: hold the name card, play the acts (they finish at p = .86), hold the headline
        var p = E ? .86 * clamp((s - E - innerHeight * HOLD1) / (innerHeight * ACTS)) : clamp(s / (rg || 1));
        if (!hasGl() && intro) intro.classList.add('away');
        tgP = p; tgE = e;
        if (lastP < 0 || Math.abs(s - lastS) > innerHeight * 1.2) { curP = p; curE = e; }   // first frame, resize, or a jump (a link to a section): no glide
        lastS = s;
        if (!gliding) { gliding = true; lastT = 0; requestAnimationFrame(glide); }
      };
      // Scroll arrives in steps (a wheel notch, a key press). The opening eases toward the scroll position
      // instead of jumping to it, so the motion is continuous between steps.
      var tgP = 0, tgE = 0, curP = 0, curE = 0, gliding = false, lastT = 0, lastS = 0;
      var glide = function (now) {
        var dt = lastT ? Math.min(250, now - lastT) : 16; lastT = now;   // by the clock, so a slow device eases over the same time, not over more frames
        var k = 1 - Math.exp(-dt / 130);
        curP += (tgP - curP) * k; curE += (tgE - curE) * k;
        if (Math.abs(tgP - curP) < .0004 && Math.abs(tgE - curE) < .0004) { curP = tgP; curE = tgE; gliding = false; }
        if (Math.abs(curP - lastP) > .0002 || Math.abs(curE - lastE) > .0002 || !gliding) { lastP = curP; lastE = curE; apply(curP, curE); cueState(curE); }
        if (gliding) requestAnimationFrame(glide);
      };
      addEventListener('scroll', function () { if (!busy) { busy = true; requestAnimationFrame(tick); } }, { passive: true });
      addEventListener('resize', function () { measure(); lastP = -1; tick(); }); tick();
      // scene.js drops the `gl` class if WebGL turns out to be missing: fall back to the plain curtain.
      if ('MutationObserver' in window) new MutationObserver(function () { measure(); lastP = -1; tick(); }).observe(root, { attributes: true, attributeFilter: ['class'] });
    }
  }

  // Number ticker: counts up the first time each number scrolls into view.
  var nums = document.querySelectorAll('[data-count]');
  if (!calm && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        var el = e.target, to = +el.dataset.count, pre = el.dataset.prefix || '', suf = el.dataset.suffix || '', t0 = null;
        var fmt = function (v) { return pre + v.toLocaleString('en-US') + suf; };
        function step(ts) {
          if (t0 === null) t0 = ts;
          var k = Math.min((ts - t0) / (to > 999 ? 2200 : 1400), 1), ease = 1 - Math.pow(1 - k, 3);
          el.textContent = fmt(Math.round(to * ease));
          if (k < 1) requestAnimationFrame(step);
        }
        el.textContent = fmt(0);
        requestAnimationFrame(step);
      });
    }, { threshold: .6 });
    nums.forEach(function (n) { io.observe(n); });
  }

  // Timeline beam: a gold line fills down the timeline as you scroll,
  // lighting each dot it passes.
  var tl = document.getElementById('timeline');
  if (tl) {
    var beam = tl.querySelector('.beam i'), items = tl.querySelectorAll('li');
    var ticking = false;
    function update() {
      ticking = false;
      var r = tl.getBoundingClientRect(), mark = innerHeight * .6;
      var p = Math.max(0, Math.min(1, (mark - r.top) / r.height));
      beam.style.height = (p * 100) + '%';
      items.forEach(function (li) {
        var dot = li.querySelector('.jr-dot, .rail i');
        if (dot) li.classList.toggle('lit', dot.getBoundingClientRect().top < mark);
      });
    }
    if (calm) { beam.style.height = '100%'; items.forEach(function (li) { li.classList.add('lit'); }); }
    else {
      addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
      addEventListener('resize', update);
      update();
    }
  }

  // Border spotlight: the card edge lights up under the cursor. The card
  // spotlight script on the page already sets --mx and --my; this covers
  // the before/after "earlier work" boxes too.
  document.querySelectorAll('.earlier article').forEach(function (c) {
    c.addEventListener('pointermove', function (e) {
      var r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  // Pause the looping animations while they're off-screen, to save battery.
  if ('IntersectionObserver' in window) {
    var vis = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.target.classList.toggle('offscreen', !e.isIntersecting); });
    });
    document.querySelectorAll('.reel, .marquee, .curtain').forEach(function (el) { vis.observe(el); });
  }

  // Dock: can be tucked away; the choice is remembered on this device.
  var dock = document.getElementById('dock'), show = document.getElementById('dock-show');
  if (dock && show) {
    function setHidden(h) {
      dock.classList.toggle('tucked', h); show.hidden = !h;
      try { localStorage.setItem('dockHidden', h ? '1' : '0'); } catch (e) {}
    }
    var start = false; try { start = localStorage.getItem('dockHidden') === '1'; } catch (e) {}
    setHidden(start);
    document.getElementById('dock-hide').addEventListener('click', function () { setHidden(true); show.focus(); });
    show.addEventListener('click', function () { setHidden(false); });
  }

  // Dock: highlight the section you're in.
  var links = document.querySelectorAll('.dock a[href^="#"]');
  if (links.length && 'IntersectionObserver' in window) {
    var map = {};
    links.forEach(function (a) { var s = document.querySelector(a.getAttribute('href')); if (s) map[s.id] = a; });
    var so = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.classList.remove('on'); });
        if (map[e.target.id]) map[e.target.id].classList.add('on');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(map).forEach(function (id) { so.observe(document.getElementById(id)); });
  }
})();

/* This is me: circular photo carousel. Photos and text change together;
 * it moves on by itself every 5 seconds while visible. Any manual move
 * (arrows, dots, swipe, keys) pauses it for 20 seconds, then it carries on. */
(function () {
  var root = document.getElementById('me-show'); if (!root) return;
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var photos = root.querySelectorAll('.ms-photo'), slides = root.querySelectorAll('.ms-slide');
  var dots = root.querySelectorAll('.ms-dots button'), n = photos.length, cur = 0;
  // Split each quote into words so they can blur in one after another.
  slides.forEach(function (s) {
    var q = s.querySelector('.ms-quote'); if (!q) return;
    var words = q.textContent.trim().split(/\s+/);
    q.setAttribute('aria-label', q.textContent.trim());
    q.innerHTML = words.map(function (w, i) { return '<span class="w" aria-hidden="true" style="--i:' + i + '">' + w + '</span>'; }).join(' ');
  });
  // One steady card height: the height of the short slides. The longer "Why hire me" slide scrolls inside it,
  // with a soft fade at the bottom while there is more to read.
  var slidesBox = root.querySelector('.ms-slides');
  function edge() {
    var on = slidesBox.querySelector('.ms-slide.on');
    slidesBox.classList.toggle('more', !!on && on.scrollHeight - on.clientHeight - on.scrollTop > 6);
  }
  function fit() {
    var w = slidesBox.clientWidth; if (!w) return;
    var h = parseFloat(getComputedStyle(root).fontSize) * 11;   // never shorter than about 11em
    slides.forEach(function (s) {
      if (s.classList.contains('ms-hire')) return;
      var was = s.hidden, st = s.style.cssText;
      s.hidden = false;
      s.style.cssText = 'position:absolute;left:0;top:0;width:' + w + 'px;visibility:hidden;max-height:none;overflow:visible';
      h = Math.max(h, s.offsetHeight);
      s.style.cssText = st; s.hidden = was;
    });
    slidesBox.style.setProperty('--ms-h', Math.ceil(h + 4) + 'px');
    edge();
  }
  function show(i, user) {
    cur = (i + n) % n;
    photos.forEach(function (p, k) {
      p.classList.toggle('on', k === cur);
      p.classList.toggle('prev', k === (cur - 1 + n) % n);
      p.classList.toggle('next', k === (cur + 1) % n);
    });
    slides.forEach(function (s, k) { s.hidden = k !== cur; s.classList.toggle('on', k === cur); });
    slides[cur].scrollTop = 0; edge();
    dots.forEach(function (d, k) {
      d.classList.toggle('on', k === cur);
      if (k === cur) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
      var bar = d.querySelector('i'); bar.style.display = 'none'; bar.offsetWidth; bar.style.display = '';
    });
    if (user) root.classList.add('anim');
  }
  if (!calm) root.classList.add('anim'); else root.classList.add('still');
  root.querySelectorAll('.ms-btn').forEach(function (b) { b.addEventListener('click', function () { act(cur + +b.dataset.dir); }); });
  dots.forEach(function (d, k) {
    d.addEventListener('click', function () { act(k); });
    // The bar filling up is the timer: when it finishes, move on.
    d.querySelector('i').addEventListener('animationend', function () { if (d.classList.contains('on')) show(cur + 1, true); });
  });
  photos.forEach(function (p, k) { p.addEventListener('click', function () { if (p.classList.contains('prev')) act(cur - 1); else if (p.classList.contains('next')) act(cur + 1); }); });
  root.addEventListener('keydown', function (e) {
    if (e.target.closest('.ms-dots')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); act(cur + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); act(cur - 1); }
  });
  // Swipe on the photos.
  var x0 = null, box = root.querySelector('.ms-photos');
  box.addEventListener('pointerdown', function (e) { x0 = e.clientX; });
  box.addEventListener('pointerup', function (e) { if (x0 === null) return; var dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 40) act(cur + (dx < 0 ? 1 : -1)); });
  // Pause while you're reading, and while it's off-screen.
  // Pause while it's off-screen, and for 20 seconds after you move it yourself.
  var held = false, away = true, holdT = null;
  function sync() { root.classList.toggle('paused', held || away); }
  function hold() {
    held = true; sync();
    clearTimeout(holdT);
    holdT = setTimeout(function () { held = false; sync(); }, 20000);
  }
  function act(i) { show(i, !calm); hold(); }
  // Reading a long slide: scrolling inside it pauses the auto-advance too.
  slides.forEach(function (s) { s.addEventListener('scroll', function () { edge(); hold(); }, { passive: true }); });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { away = !es[0].isIntersecting; sync(); }, { threshold: .35 }).observe(root);
  else away = false;
  sync(); show(0, false);
  fit();
  if (typeof ResizeObserver === 'function') new ResizeObserver(fit).observe(slidesBox); else addEventListener('resize', fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
})();

/* Showcase switch: flip between the tumble deck and the spinning reel.
 * The choice is remembered on this device. */
(function () {
  var deck = document.getElementById('deck'), reel = document.getElementById('reel-wrap');
  if (!deck || !reel) return;
  var btns = document.querySelectorAll('.vswitch button');
  function set(view, jump, initial) {
    deck.hidden = view !== 'deck'; reel.hidden = view !== 'reel';
    btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.view === view)); });
    if (!initial) { try { localStorage.setItem('showcaseView', view); } catch (e) {} }
    if (jump) {
      var shown = view === 'deck' ? deck : reel;
      scrollTo({ top: scrollY + shown.getBoundingClientRect().top - 60, behavior: 'auto' });
      var b = shown.querySelector('.vswitch button[data-view="' + view + '"]'); if (b) b.focus({ preventScroll: true });
    }
    dispatchEvent(new Event('scroll'));
  }
  // Default: Spin on wide screens, Tumble on phones. A choice made with the
  // switch is remembered and wins over the default.
  var start = matchMedia('(min-width: 900px)').matches ? 'reel' : 'deck', saved = null;
  try { saved = localStorage.getItem('showcaseView'); } catch (e) {}
  if (saved === 'reel' || saved === 'deck') start = saved;
  set(start, false, true);
  btns.forEach(function (b) { b.addEventListener('click', function (e) { e.stopPropagation(); if (b.getAttribute('aria-pressed') !== 'true') set(b.dataset.view, true); }); });
})();

/* Skill tree: every branch open on wide screens; on phones only the first,
 * so the section stays short and you tap to open the rest. */
(function () {
  var br = document.querySelectorAll('.st-branch'); if (!br.length) return;
  if (matchMedia('(max-width: 900px)').matches) br.forEach(function (d, i) { d.open = i === 0; });
  else br.forEach(function (d) { d.addEventListener('toggle', function () { if (!d.open && innerWidth > 900) d.open = true; }); });
})();

/* What I know: switch between the skill tree and UTP. Links to #studied
 * (from quick jump or elsewhere) open the UTP tab. */
(function () {
  var tabs = document.querySelectorAll('.kt-tabs [role="tab"]'); if (!tabs.length) return;
  function pick(id, focus) {
    tabs.forEach(function (t) {
      var on = t.getAttribute('aria-controls') === id;
      t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      if (on && focus) t.focus();
    });
    // A coverflow measures itself; give it a nudge now it's visible.
    dispatchEvent(new Event('resize'));
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { pick(t.getAttribute('aria-controls')); });
    t.addEventListener('keydown', function (e) {
      var k = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!k) return;
      e.preventDefault(); var n = tabs[(i + k + tabs.length) % tabs.length]; pick(n.getAttribute('aria-controls'), true);
    });
  });
  function fromHash() { if (location.hash === '#studied') { pick('studied'); document.getElementById('toolkit').scrollIntoView(); } }
  pick('kt-skills'); fromHash();
  addEventListener('hashchange', fromHash);
})();


/* THE FORK (after "This is me"): two routes through the page.
   Story: keep scrolling. The card slides off to the left and the next section comes in from the right, so the page reads as turning aside into the detail.
   Highlights: the button sets html.brief, which removes the story-only sections (site.css), then goes down to the work. A chip brings everything back. */
(function () {
  var root = document.documentElement, fork = document.getElementById('fork'), card = document.getElementById('fork-card'),
      go = document.getElementById('fork-go'), exit = document.getElementById('brief-exit'), why = document.getElementById('why');
  if (!fork || !card || !go) return;
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches, whyWrap = why && why.querySelector('.wrap');
  function relayout() { dispatchEvent(new Event('resize')); }   // scene.js re-reads where each section is
  function setBrief(on, then) {
    if (root.classList.contains('brief') === on) { if (then) then(); return; }
    root.classList.toggle('brief', on); relayout();
    requestAnimationFrame(function () { relayout(); if (then) then(); });
  }
  function goTo(el, smooth) { if (el) scrollTo({ top: el.getBoundingClientRect().top + scrollY - 70, behavior: smooth && !calm ? 'smooth' : 'instant' }); }
  go.addEventListener('click', function () { setBrief(true, function () { goTo(document.getElementById('work'), true); }); });
  if (exit) exit.addEventListener('click', function () {
    // stay on the section being read
    var ids = ['contact', 'journey', 'work', 'workstage', 'me'], cur = null, i, e;
    for (i = 0; i < ids.length; i++) { e = document.getElementById(ids[i]); if (e && e.getBoundingClientRect().top < innerHeight * .6) { cur = e; break; } }
    var off = cur ? cur.getBoundingClientRect().top : 0;
    setBrief(false, function () { if (cur) scrollTo({ top: cur.getBoundingClientRect().top + scrollY - off, behavior: 'instant' }); });
  });
  // a link to a section that highlights mode has removed brings everything back first
  function hidden(id) { var e = id && document.getElementById(id); return !!e && e.offsetHeight === 0; }
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('a[href^="#"]'); if (!a || !root.classList.contains('brief')) return;
    var id = a.getAttribute('href').slice(1); if (!hidden(id)) return;
    ev.preventDefault(); setBrief(false, function () { goTo(document.getElementById(id), false); history.replaceState(null, '', '#' + id); });
  }, true);
  addEventListener('hashchange', function () { var id = location.hash.slice(1); if (root.classList.contains('brief') && hidden(id)) setBrief(false, function () { goTo(document.getElementById(id), false); }); });
  // the sideways move, driven by the scroll through the fork
  if (calm) return;
  var busy = false, on = false;
  function tick() {
    busy = false;
    if (!root.classList.contains('gl') || root.classList.contains('brief')) { if (on) { on = false; root.classList.remove('fork-side'); card.style.transform = ''; card.style.opacity = ''; if (whyWrap) { whyWrap.style.transform = ''; whyWrap.style.opacity = ''; } } return; }
    if (!on) { on = true; root.classList.add('fork-side'); }
    var r = fork.getBoundingClientRect(), vh = innerHeight, range = r.height - vh;
    if (r.bottom < -vh || r.top > vh * 2) return;
    var p = range > 0 ? Math.min(1, Math.max(0, -r.top / range)) : 0;          // 0 -> 1 while the card is pinned
    var t = Math.min(1, Math.max(0, (p - .58) / .42)); t = t * t * (3 - 2 * t);  // it holds for the first 58 %, then leaves
    card.style.transform = 'translate3d(' + (-t * 115).toFixed(2) + 'vw, 0, 0)'; card.style.opacity = (1 - t * .6).toFixed(3);
    if (whyWrap) { var w = why.getBoundingClientRect(), u = Math.min(1, Math.max(0, (vh - w.top) / (vh * .7))); u = u * u * (3 - 2 * u);
      whyWrap.style.transform = 'translate3d(' + ((1 - u) * 60).toFixed(2) + 'vw, 0, 0)'; whyWrap.style.opacity = u.toFixed(3); }
  }
  addEventListener('scroll', function () { if (!busy) { busy = true; requestAnimationFrame(tick); } }, { passive: true });
  addEventListener('resize', tick); tick();
})();
