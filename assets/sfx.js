/* sfx.js: the site's sound, all synthesised in the browser (no audio files). Off until the visitor asks, and it says so on the button.
   A low drone that brightens as you scroll down, a soft chime when you arrive at a section, glyph blips and a rising tone while text decodes,
   a tick on clicks. The idea (musical decoding, scroll-driven drone) is from my Halcyon project; the "audio meter" button is in the spirit
   of the Mirage study. Other scripts call window.__sfx.* and it does nothing while sound is off. */
(function () {
  'use strict';
  var d = document, Ctx = window.AudioContext || window.webkitAudioContext, btn = d.getElementById('sfx-btn');
  var ac = null, master = null, filter = null, on = false, lastGlyph = 0, lastTick = 0;
  var SCAN = [110, 130.81, 146.83, 164.81, 196, 220, 261.63, 311.13, 349.23, 392, 440, 523.25, 622.25, 698.46, 880];
  var DECODE = [220, 261.63, 311.13, 349.23, 392, 440, 523.25, 587.33, 659.26, 784, 880];
  var PENTA = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.26, 783.99, 880];

  function build() {
    if (!Ctx) return false;
    try {
      ac = new Ctx(); master = ac.createGain(); master.gain.value = 0;
      filter = ac.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 300; filter.Q.value = 6;
      [55, 82.41, 110.3].forEach(function (f, i) { var o = ac.createOscillator(), g = ac.createGain(); o.type = i === 2 ? 'triangle' : 'sine'; o.frequency.value = f; g.gain.value = i === 2 ? .12 : .4; o.connect(g); g.connect(filter); o.start(); });
      var lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = .07; lg.gain.value = 120; lfo.connect(lg); lg.connect(filter.frequency); lfo.start();
      filter.connect(master); master.connect(ac.destination);
      return true;
    } catch (e) { ac = null; return false; }
  }
  function tone(f, vol, len, type, delay, slide) {
    if (!on || !ac || ac.state !== 'running') return;
    var t = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f * slide), t + len);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + len);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + len + .02);
  }
  function sync() {
    if (btn) { btn.setAttribute('aria-pressed', on ? 'true' : 'false'); btn.classList.toggle('on', on); btn.setAttribute('aria-label', on ? 'Sound on. Turn sound off' : 'Sound off. Turn sound on'); }
    d.documentElement.classList.toggle('sfx-on', on);
    d.dispatchEvent(new CustomEvent('sfx-change', { detail: { on: on } }));
  }
  function set(v) {
    if (v && !ac && !build()) return;
    if (!ac) return; on = !!v; var g = master.gain, t = ac.currentTime;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    if (on) { ac.resume(); g.linearRampToValueAtTime(.16, t + 1.4); setTimeout(function () { tone(523.25, .06, .3, 'sine'); tone(783.99, .05, .4, 'sine', .08); }, 120); }
    else { g.linearRampToValueAtTime(0, t + .6); setTimeout(function () { if (!on && ac) ac.suspend(); }, 800); }
    sync();
  }

  var api = {
    get on() { return on; },
    toggle: function () { set(!on); },
    beep: function (f, len, type, vol, slide) { tone(f, vol || .04, len || .1, type || 'square', 0, slide); },
    tick: function () { var n = performance.now(); if (n - lastTick < 60) return; lastTick = n; tone(1320, .018, .035, 'square'); },
    glyph: function () { var n = performance.now(); if (n - lastGlyph < 38) return; lastGlyph = n; tone(SCAN[(Math.random() * SCAN.length) | 0] * (.92 + Math.random() * .16), .02, .022, 'square'); },
    lock: function (p) { var f = DECODE[Math.round(Math.max(0, Math.min(1, p)) * (DECODE.length - 1))]; tone(f, .1, .09, 'sine'); tone(f * 2, .03, .07, 'sine'); },
    done: function () { [523.25, 659.26, 783.99].forEach(function (f, i) { tone(f, .05 - i * .01, .4, 'sine', i * .018); }); },
    chime: function (i) { var f = PENTA[(i | 0) % PENTA.length]; tone(f, .05, .7, 'sine'); tone(f * 1.5, .02, .6, 'sine', .05); },
    ripple: function () { tone(660, .03, .25, 'sine', 0, .5); }
  };
  window.__sfx = api;

  if (btn) btn.addEventListener('click', function () { api.toggle(); });
  d.addEventListener('click', function (e) { if (on && e.target.closest && e.target.closest('a, button, [role=tab], summary')) api.tick(); }, true);
  d.addEventListener('sec-change', function (e) { if (on) api.chime(e.detail && e.detail.index); });
  // the drone brightens as the page goes down, and with the speed of the scroll
  var lastY = scrollY, lastT = performance.now(), pend = 0;
  addEventListener('scroll', function () {
    if (pend) return; pend = requestAnimationFrame(function () {
      pend = 0; if (!on || !ac || ac.state !== 'running') { lastY = scrollY; return; }
      var now = performance.now(), v = Math.abs(scrollY - lastY) / Math.max(16, now - lastT) * 16, h = Math.max(1, d.documentElement.scrollHeight - innerHeight), p = scrollY / h;
      lastY = scrollY; lastT = now;
      var f = 260 + p * 700 + Math.min(v, 40) * 14, fr = filter.frequency, t = ac.currentTime;
      fr.cancelScheduledValues(t); fr.setValueAtTime(fr.value, t); fr.setTargetAtTime(f, t, .4);
    });
  }, { passive: true });
  d.addEventListener('visibilitychange', function () { if (ac && on) { if (d.hidden) ac.suspend(); else ac.resume(); } });
  if (!Ctx && btn) btn.hidden = true;
})();
