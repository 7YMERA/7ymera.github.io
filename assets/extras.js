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
    var colL = cur.querySelector('.cur-col.left'), colR = cur.querySelector('.cur-col.right'), mid = cur.querySelector('.cur-center');
    var reel = cur.querySelector('.cur-reel'), ch = document.getElementById('cur-hero'), title = document.getElementById('cur-title');
    var clamp = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
    var ease = function (t) { return t * t * (3 - 2 * t); };
    var Hs = 0, R = 0, endY = 0;
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
    function apply(p) {
      var q = p;
      // (No clip: the photo columns run to the screen edges, so nothing gets cut mid-air.)
      var c = ease(clamp(q / .5)), dx = c * innerWidth * .55, sc = 1 + c * .25;
      colL.style.transform = 'translate3d(' + (-dx) + 'px, 0, 0) rotate(' + (-7 - c * 10) + 'deg) scale(' + sc + ')';
      colR.style.transform = 'translate3d(' + dx + 'px, 0, 0) rotate(' + (7 + c * 10) + 'deg) scale(' + sc + ')';
      mid.style.opacity = Math.max(0, 1 - q * 4.5);
      mid.style.transform = 'translate3d(0, ' + (-q * 60) + 'px, 0) scale(' + (1 - q * .08) + ')';
      if (reel) {
        var m = ease(clamp((q - .3) / .4));
        // Faint behind the photos from the start, then full strength as it rises.
        reel.style.opacity = (.32 + .68 * clamp((q - .2) / .24)).toFixed(3);
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
    cta.addEventListener('click', function () { scrollTo({ top: cur.offsetTop + range() * .98, behavior: calm ? 'auto' : 'smooth' }); });
    measure();
    if (calm) {
      // No motion: show the finished state straight away.
      apply(1); addEventListener('resize', function () { measure(); apply(1); });
    } else {
      var busy = false, lastP = -1;
      var tick = function () {
        busy = false;
        var p = clamp(-cur.getBoundingClientRect().top / (range() || 1));
        if (Math.abs(p - lastP) < .001) return; lastP = p; apply(p);
      };
      addEventListener('scroll', function () { if (!busy) { busy = true; requestAnimationFrame(tick); } }, { passive: true });
      addEventListener('resize', function () { measure(); lastP = -1; tick(); }); tick();
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
  function show(i, user) {
    cur = (i + n) % n;
    photos.forEach(function (p, k) {
      p.classList.toggle('on', k === cur);
      p.classList.toggle('prev', k === (cur - 1 + n) % n);
      p.classList.toggle('next', k === (cur + 1) % n);
    });
    slides.forEach(function (s, k) { s.hidden = k !== cur; s.classList.toggle('on', k === cur); });
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
  function act(i) {
    show(i, !calm);
    held = true; sync();
    clearTimeout(holdT);
    holdT = setTimeout(function () { held = false; sync(); }, 20000);
  }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { away = !es[0].isIntersecting; sync(); }, { threshold: .35 }).observe(root);
  else away = false;
  sync(); show(0, false);
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
