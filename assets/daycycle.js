/* Day cycle: on a page with <html data-daycycle>, scrolling turns the day to golden hour to night.
   - the scroll progress (0 at the top, 1 at the bottom) becomes a time of day t (0 day, 1 golden hour, 2 night) through an eased curve (CURVE below) and goes to window.SceneTime (assets/scene.js), which lights the 3D city;
   - the page's own colour tokens (--bg, --surface, --ink, --accent ... the names site.css and scene.css define) are crossfaded in OKLab between the day values, a golden-hour set (GOLD below) and the night values, which are read from the page's own light and dark themes at load;
   - data-theme flips to "dark" at the point the text turns light-on-dark (t 1.5), so the page's existing dark rules (color-scheme, per-component overrides) apply; #theme-btn is hidden (daycycle.css);
   - a small sun-and-moon window (bottom left) shows the time of day, and an optional horizon glow layer (opacity only) warms the page at golden hour.
   Works without WebGL (no SceneTime then: the same sky variables and the `scenetime` event are produced here) and with prefers-reduced-motion (colours still change, nothing eases or animates).
   Cost: a change of a variable on <html> makes the browser recompute the style of every element (about 15 ms on a 2,000-element page, more on a phone), so the tokens are written only while t is moving, only the ones that changed, and no more often than that cost allows (the gap adapts: about 4 times what the last write cost, 60 to 500 ms).
   The sky behind the 3D canvas is an inline gradient on <body> instead of variables, which costs a repaint, not a recalculation. */
(function () {
  'use strict';
  var root = document.documentElement;
  if (!root.hasAttribute('data-daycycle')) return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- colour: hex or rgb(a) <-> OKLab ----------
  function s2l(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function l2s(c) { c = c < 0 ? 0 : c > 1 ? 1 : c; return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }
  function parse(s) { // -> [L, a, b, alpha] or null
    s = (s || '').trim(); var r, g, b, a = 1, m;
    if ((m = /^#([0-9a-f]{3,8})$/i.exec(s))) {
      var h = m[1]; if (h.length === 3 || h.length === 4) h = h.replace(/./g, '$&$&');
      r = parseInt(h.slice(0, 2), 16) / 255; g = parseInt(h.slice(2, 4), 16) / 255; b = parseInt(h.slice(4, 6), 16) / 255; if (h.length === 8) a = parseInt(h.slice(6, 8), 16) / 255;
    } else if ((m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i.exec(s))) {
      r = +m[1] / 255; g = +m[2] / 255; b = +m[3] / 255; if (m[4] != null) a = m[4].slice(-1) === '%' ? parseFloat(m[4]) / 100 : +m[4];
    } else return null;
    r = s2l(r); g = s2l(g); b = s2l(b);
    var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), mm = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), ss = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * mm - 0.0040720468 * ss, 1.9779984951 * l - 2.428592205 * mm + 0.4505937099 * ss, 0.0259040371 * l + 0.7827717662 * mm - 0.808675766 * ss, a];
  }
  function mix(A, B, f) { // OKLab mix -> [r,g,b,a] in 0..1 sRGB
    var L = A[0] + (B[0] - A[0]) * f, a = A[1] + (B[1] - A[1]) * f, b = A[2] + (B[2] - A[2]) * f,
      l = L + 0.3963377774 * a + 0.2158037573 * b, m = L - 0.1055613458 * a - 0.0638541728 * b, s = L - 0.0894841775 * a - 1.291485548 * b;
    l = l * l * l; m = m * m * m; s = s * s * s;
    return [l2s(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), l2s(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), l2s(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s), A[3] + (B[3] - A[3]) * f];
  }
  function hx(v) { var n = Math.round(v * 255); return (n < 16 ? '0' : '') + n.toString(16); }
  function str(c) { return c[3] >= 0.999 ? '#' + hx(c[0]) + hx(c[1]) + hx(c[2]) : 'rgba(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ',' + c[3].toFixed(3) + ')'; }
  function lum(c) { return 0.2126 * s2l(c[0]) + 0.7152 * s2l(c[1]) + 0.0722 * s2l(c[2]); }
  function sstep(a, b, x) { x = (x - a) / (b - a); x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); }

  // ---------- the tokens ----------
  // The page tokens that carry the colour of the UI (names from assets/site.css and assets/scene.css). Day and night are read from the page's own themes at load.
  var NAMES = ['--bg', '--surface', '--sunk', '--ink', '--muted', '--line', '--accent', '--accent-ink', '--accent-soft', '--glow', '--fx', '--hud', '--hard', '--gold', '--gold-soft', '--bad', '--bad-soft', '--far', '--mid', '--near', '--glass', '--orb', '--ring', '--fx-ink'];
  // Golden hour: cream paper, violet ink, burnt-orange accent, violet hard shadows. (No pink or magenta.) Tokens not listed here take the middle of day and night.
  var GOLD = { '--bg': '#fbf0dd', '--surface': '#fff8ec', '--sunk': '#f3e1c4', '--ink': '#2b1b3f', '--muted': '#6b5278', '--line': '#ecd2a6', '--accent': '#b4481a', '--accent-ink': '#ffffff', '--accent-soft': '#fbdcb4',
    '--glow': 'rgba(240,150,60,.18)', '--fx': '#d9772a', '--hud': '#d9772a', '--hard': '#3a2358', '--fx-ink': '#9a4a12', '--gold': '#a86d12', '--gold-soft': '#f6ead3' };
  // The sky gradient (the page background and the haze of the 3D city). KEEP IN STEP with TB in assets/scene.js: day, golden hour, night.
  var SKY = { s1: ['#fcfeff', '#3a60a2', '#050a1a'], s2: ['#e4f0fa', '#eea25f', '#141f52'], s3: ['#e4f0fa', '#ffd79a', '#6a4030'] }, STOP = [1, 0.6, 0.58];
  var tok = [], sky = [];
  (function read() { // the day and night values come from the page itself: flip the theme twice, in one synchronous task (no paint between)
    var was = root.getAttribute('data-theme'), cs, d = {}, n = {};
    root.setAttribute('data-theme', 'light'); cs = getComputedStyle(root); NAMES.forEach(function (x) { d[x] = cs.getPropertyValue(x).trim(); });
    root.setAttribute('data-theme', 'dark'); cs = getComputedStyle(root); NAMES.forEach(function (x) { n[x] = cs.getPropertyValue(x).trim(); });
    if (was) root.setAttribute('data-theme', was); else root.removeAttribute('data-theme');
    NAMES.forEach(function (x) {
      var D = parse(d[x]), N = parse(n[x]); if (!D || !N) return;
      var G = GOLD[x] ? parse(GOLD[x]) : null; if (!G) { var m = mix(D, N, 0.5); G = parse(str(m)); }
      tok.push({ name: x, set: [D, G, N], last: '' });
    });
    // --shadow: two soft layers, colour and strength crossfaded (day: blue ink, night: black)
    tok.push({ name: '--shadow', shadow: true, set: [[0.3, 0, 0, 0], [0.3, 0, 0, 0], [0.3, 0, 0, 0]], last: '' });
    sky = ['s1', 's2', 's3'].map(function (x) { return SKY[x].map(parse); });
  })();
  var SH = [[[11, 42, 107], .08, .10], [[58, 30, 70], .12, .16], [[0, 0, 0], .4, .4]]; // --shadow colours and strengths at day, golden hour, night

  // ---------- time of day from scroll ----------
  var CURVE = [[0, 0], [0.22, 0], [0.40, 1], [0.60, 1], [0.78, 2], [1, 2]]; // [scroll progress, t]: day on top, golden hour in the middle, night at the bottom, eased between
  function curve(p) {
    for (var j = 1; j < CURVE.length; j++) if (p <= CURVE[j][0]) { var a = CURVE[j - 1], b = CURVE[j], f = b[0] === a[0] ? 1 : (p - a[0]) / (b[0] - a[0]); f = f * f * (3 - 2 * f); return a[1] + (b[1] - a[1]) * f; }
    return CURVE[CURVE.length - 1][1];
  }
  function progress() { var h = Math.max(1, root.scrollHeight - innerHeight); return Math.max(0, Math.min(1, (window.pageYOffset || root.scrollTop || 0) / h)); }

  // ---------- the dial and the glow ----------
  var dial, wins = {}, glow, ringC, lab, pinBtn, labTxt = '', gl = root.classList.contains('gl'), pinned = false;
  try { pinned = sessionStorage.getItem('dc-pin') === '1'; } catch (e) {}
  function build() {
    var b = document.body; if (!b || document.querySelector('.dc-dial')) return;
    glow = document.createElement('div'); glow.className = 'dc-glow'; glow.setAttribute('aria-hidden', 'true'); b.appendChild(glow);
    dial = document.createElement('div'); dial.className = 'dc-dial';
    dial.innerHTML = '<div class="dc-win" aria-hidden="true"><i class="dc-sky dc-d"></i><i class="dc-sky dc-g"></i><i class="dc-sky dc-n"></i><span class="dc-stars"><i class="dc-st a"></i><i class="dc-st b"></i><i class="dc-st c"></i></span><i class="dc-sun"></i><i class="dc-moon"></i>' +
      '<svg class="dc-sk" viewBox="0 0 120 40" preserveAspectRatio="none" focusable="false"><path d="M0 40V30h9v-6h7v6h6V20h5v10h8V27h6v13h4V12l2-8 2 8v28h5V12l2-8 2 8v28h4V25h7v-9h6v9h5v15z"/></svg></div>' +
      '<svg class="dc-ring" viewBox="0 0 76 76" aria-hidden="true" focusable="false"><circle cx="38" cy="38" r="35" class="dc-ring-bg"/><circle cx="38" cy="38" r="35" class="dc-ring-p" transform="rotate(-90 38 38)"/></svg>' +
      '<button type="button" class="dc-pin" aria-pressed="' + (pinned ? 'true' : 'false') + '" aria-label="Pin daylight theme for reading" title="Pin daylight"></button>' +
      '<span class="dc-lab" aria-hidden="true">Day · 10:00</span>';
    b.appendChild(dial);
    ['d', 'g', 'n'].forEach(function (x) { wins[x] = dial.querySelector('.dc-' + x); });
    wins.sun = dial.querySelector('.dc-sun'); wins.stars = dial.querySelector('.dc-stars'); wins.moon = dial.querySelector('.dc-moon'); wins.sk = dial.querySelector('.dc-sk'); ringC = dial.querySelector('.dc-ring-p'); lab = dial.querySelector('.dc-lab'); pinBtn = dial.querySelector('.dc-pin');
    pinBtn.addEventListener('click', function () {
      pinned = !pinned;
      pinBtn.setAttribute('aria-pressed', pinned ? 'true' : 'false');
      dial.classList.toggle('is-pinned', pinned);
      try { sessionStorage.setItem('dc-pin', pinned ? '1' : '0'); } catch (e) {}
      kick();
    });
    dial.classList.toggle('is-pinned', pinned);
    if (reduce) dial.classList.add('dc-still');
  }
  function clockFor(p) {
    var mins = Math.round(10 * 60 + p * (13.5 * 60));
    var hh = String(Math.floor(mins / 60) % 24).padStart(2, '0'), mm = String(mins % 60).padStart(2, '0');
    return hh + ':' + mm + ' MYT';
  }
  function paintDial(t, p) {
    if (!dial) return;
    wins.d.style.opacity = t < 1 ? 1 : 0; // the day sky stays underneath and the others fade over it
    wins.g.style.opacity = Math.max(0, 1 - Math.abs(t - 1)).toFixed(3);
    wins.n.style.opacity = t > 1 ? t - 1 : 0;
    var sy = t <= 1 ? 8 + 40 * sstep(0, 1, t) : 48 + 62 * sstep(0, 1, (t - 1) / 0.55), sx = 36 + 18 * Math.min(1, t / 1.4);
    var my = t < 1.3 ? 84 : 84 - 66 * sstep(0, 1, (t - 1.3) / 0.7);
    wins.sun.style.transform = 'translate3d(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px,0)';
    wins.moon.style.transform = 'translate3d(46px,' + my.toFixed(1) + 'px,0)';
    wins.sun.style.opacity = t > 1.5 ? 0 : 1;
    var fs = t <= 1 ? mix(SKL[0], SKL[1], t) : mix(SKL[1], SKL[2], t - 1), fl = str(fs); if (fl !== lastFill) { lastFill = fl; wins.sk.style.fill = fl; }
    wins.stars.style.opacity = Math.max(0, Math.min(1, (t - 1.3) / 0.7)).toFixed(3);
    ringC.style.strokeDashoffset = (220 * (1 - p)).toFixed(1);
    var l = pinned ? 'Daylight pinned' : ((t < 0.5 ? 'Day' : t < 1.5 ? 'Golden hour' : 'Night') + ' · ' + clockFor(p));
    if (l !== labTxt) { labTxt = l; lab.textContent = l; }
    if (glow) { var g = 1 - Math.abs(t - 1); g = g < 0 ? 0 : g; glow.style.opacity = ((gl ? 0.5 : 0.9) * g * g * (3 - 2 * g)).toFixed(3); }
  }

  // ---------- applying ----------
  var SKL = ['#5c92dc', '#6a5a98', '#16224d'].map(parse), lastFill = '';
  var gap = 80, t = 0, target = 0, prog = 0, written = -1, lastW = 0, wTimer = 0, raf = 0, lastF = 0, theme = '';
  var INK_TOKS = { '--ink': 1, '--muted': 1, '--accent-ink': 1, '--fx-ink': 1 };
  function write() {
    wTimer = 0; lastW = performance.now(); written = t;
    // Contrast-locked crossover: ink tokens flip rapidly across t 1.46..1.54 so text never reads grey-on-grey near t 1.5.
    var seg = t <= 1 ? 0 : 1, F = t <= 1 ? t : t - 1, FU = seg ? sstep(0.36, 0.64, F) : F, FInk = seg ? sstep(0.46, 0.54, F) : F, st = root.style, j, c, s;
    for (j = 0; j < tok.length; j++) {
      c = tok[j];
      if (c.shadow) { var a = SH[seg], b = SH[seg + 1], col = [0, 1, 2].map(function (q) { return Math.round(a[0][q] + (b[0][q] - a[0][q]) * FU); }), o1 = a[1] + (b[1] - a[1]) * FU, o2 = a[2] + (b[2] - a[2]) * FU;
        s = '0 1px 2px rgba(' + col + ',' + o1.toFixed(3) + '),0 10px 30px rgba(' + col + ',' + o2.toFixed(3) + ')'; }
      else s = str(mix(c.set[seg], c.set[seg + 1], INK_TOKS[c.name] ? FInk : FU));
      if (s !== c.last) { c.last = s; st.setProperty(c.name, s); }
    }
    if (root.classList.contains('gl')) { // the sky behind the canvas, mirrored by the city's shader (the same three colours and stop, mixed the same way)
      var sp = ((STOP[seg] + (STOP[seg + 1] - STOP[seg]) * F) * 100).toFixed(1) + '%', gr = 'linear-gradient(' + str(mix(sky[0][seg], sky[0][seg + 1], F)) + ',' + str(mix(sky[1][seg], sky[1][seg + 1], F)) + ' ' + sp + ',' + str(mix(sky[2][seg], sky[2][seg + 1], F)) + ')';
      if (gr !== lastGrad && document.body) { lastGrad = gr; var bs = document.body.style; bs.backgroundImage = gr; bs.backgroundAttachment = 'fixed'; bs.backgroundRepeat = 'no-repeat'; }
    } else if (lastGrad && document.body) { lastGrad = ''; document.body.style.backgroundImage = ''; }
    var th = t >= 1.5 ? 'dark' : 'light'; if (th !== theme) { theme = th; root.setAttribute('data-theme', th); }
    paintDial(t, prog);
    var c0 = performance.now(); void getComputedStyle(root).getPropertyValue('--bg'); // forces the recalculation now (it would happen on the next frame anyway) to learn what it costs
    gap = Math.max(60, Math.min(500, gap * 0.5 + (performance.now() - c0) * 4 * 0.5));
  }
  var lastGrad = '';
  function queue() { if (wTimer) return; var w = gap - (performance.now() - lastW); if (w <= 0) write(); else wTimer = setTimeout(write, w); }
  function publish() {
    if (window.SceneTime) window.SceneTime.set(t);
    else try { document.dispatchEvent(new CustomEvent('scenetime', { detail: { t: t } })); } catch (e) {}
  }
  function tick(now) {
    raf = 0; prog = progress(); target = pinned ? 0 : curve(prog);
    var d = target - t;
    if (reduce || Math.abs(d) < 0.0015) t = target; else t += d * (1 - Math.exp(-Math.max(0.004, Math.min(0.1, (now - lastF) / 1000 || 0.016)) / 0.12));
    lastF = now;
    if (Math.abs(t - written) > 0.0008) { queue(); publish(); }
    else paintDial(t, prog);
    if (Math.abs(target - t) > 0.0008) raf = requestAnimationFrame(tick);
  }
  function kick() { if (!raf) { lastF = performance.now(); raf = requestAnimationFrame(tick); } }
  function init() { build(); prog = progress(); t = target = curve(prog); write(); publish(); kick(); }
  // Cost control: a token change on <html> restyles every element, so the long sections are given content-visibility:auto, which makes the browser skip the ones off screen.
  // Their remembered size is set to the real measured content size, so nothing moves (checked: scroll height and every section top identical before, after and after scrolling through).
  // Remeasured after a resize. Opt out with <html data-daycycle="nocv">.
  var cvT = 0;
  function cvApply() {
    var els = document.querySelectorAll('main > section, main > .hero'), j, e, cs, h, rows = [];
    for (j = 0; j < els.length; j++) { e = els[j]; e.style.contentVisibility = ''; e.style.containIntrinsicSize = ''; }
    for (j = 0; j < els.length; j++) { e = els[j]; if (e.offsetHeight < 400) continue; cs = getComputedStyle(e);
      h = e.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth); rows.push([e, h]); }
    rows.forEach(function (r) { r[0].style.containIntrinsicSize = 'auto ' + r[1].toFixed(2) + 'px'; r[0].style.contentVisibility = 'auto'; });
  }
  function cvLater() { if (root.getAttribute('data-daycycle') === 'nocv') return; clearTimeout(cvT); cvT = setTimeout(cvApply, 400); }
  addEventListener('load', cvLater); addEventListener('resize', cvLater);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(cvLater);
  new MutationObserver(function () { if (theme && root.getAttribute('data-theme') !== theme) root.setAttribute('data-theme', theme); }).observe(root, { attributes: true, attributeFilter: ['data-theme'] }); // the page's own theme key or button cannot override the cycle
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', kick);
  addEventListener('load', kick);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(kick);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(kick).observe(root);
  window.DayCycle = { get: function () { return t; }, progress: function () { return prog; }, refresh: kick, curve: curve };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
