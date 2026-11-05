/* Small motion extras, inspired by components on 21st.dev:
 * number ticker, timeline beam, border spotlight and the dock's active link.
 * Everything here is decoration: the page reads the same without it. */
(function () {
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Curtain intro: --p goes 0 -> 1 as you scroll through it; the photo
  // columns part and grow, and the name fades.
  var cur = document.getElementById('curtain');
  if (cur) {
    var cta = document.getElementById('cur-cta');
    var hero = document.querySelector('.hero');
    cta.addEventListener('click', function () { (hero || cur.nextElementSibling).scrollIntoView({ behavior: calm ? 'auto' : 'smooth' }); });
    if (!calm) {
      // Move the two photo columns and fade the title with transforms and
      // opacity only, written straight to the three elements, so the
      // browser never has to recalculate styles for the rest of the page.
      var colL = cur.querySelector('.cur-col.left'), colR = cur.querySelector('.cur-col.right'), mid = cur.querySelector('.cur-center');
      var busy = false, lastP = -1;
      var tick = function () {
        busy = false;
        var r = cur.getBoundingClientRect(), range = r.height - innerHeight * .25;
        var p = Math.max(0, Math.min(1, -r.top / (range || 1)));
        if (Math.abs(p - lastP) < .001) return; lastP = p;
        var dx = p * innerWidth * .48, s = 1 + p * .25;
        colL.style.transform = 'translate3d(' + (-dx) + 'px, -50%, 0) rotate(' + (-7 - p * 10) + 'deg) scale(' + s + ')';
        colR.style.transform = 'translate3d(' + dx + 'px, -50%, 0) rotate(' + (7 + p * 10) + 'deg) scale(' + s + ')';
        mid.style.opacity = Math.max(0, 1 - p * 1.6);
        mid.style.transform = 'translate3d(0, ' + (-p * 40) + 'px, 0) scale(' + (1 - p * .06) + ')';
      };
      addEventListener('scroll', function () { if (!busy) { busy = true; requestAnimationFrame(tick); } }, { passive: true });
      addEventListener('resize', function () { lastP = -1; tick(); }); tick();
    }
  }

  // Number ticker: counts up the first time each number scrolls into view.
  var nums = document.querySelectorAll('[data-count]');
  if (!calm && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        var el = e.target, to = +el.dataset.count, pre = el.dataset.prefix || '', t0 = null;
        function step(ts) {
          if (t0 === null) t0 = ts;
          var k = Math.min((ts - t0) / 1400, 1), ease = 1 - Math.pow(1 - k, 3);
          el.textContent = pre + Math.round(to * ease);
          if (k < 1) requestAnimationFrame(step);
        }
        el.textContent = pre + '0';
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
        var dot = li.querySelector('.rail i');
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
