/* sfx.js: the site's sound, all synthesised in the browser (no audio files). Off until the visitor asks, and the header button says so.
   It is a small generative score about the site's own story, a city seen from orbit:
     SPACE  : a slow pad that glides between chords, a glassy shimmer and soft bell pings, all through a long reverb. Loudest at the top of the page.
     CITY   : a warm sub bass, distant traffic hum, a soft plucked arpeggio, and now and then a train passing (a swept noise band with the rails
              clicking in time) followed by a two-note station chime. These come in as you scroll down into the streets.
     NIGHT / DAY: dark theme plays a moody Lydian progression (Am9 Fmaj7#11 Cmaj9 G6/9), light theme a brighter one (Cmaj9 Em7 Fmaj9 G6).
   Plus UI sounds: a tick on clicks, a chime on arriving at a section, decode tones while text scrambles. Other scripts call window.__sfx.*;
   everything is a no-op while sound is off. The musical decoding idea is from my Halcyon project. */
(function () {
  'use strict';
  var d = document, Ctx = window.AudioContext || window.webkitAudioContext, btn = d.getElementById('sfx-btn'), root = d.documentElement;
  var ac = null, out = null, bus = null, sendG = null, on = false, lastGlyph = 0, lastTick = 0, timer = 0;
  var padVoices = [], sub = null, shim = [], hum = null, humG = null, mix = { city: 0, space: 1 }, mode = 'night', chordI = 0, nextChord = 0, nextBell = 0, nextTrain = 0, nextStep = 0, step = 0, nextChime = 0;
  var SCAN = [110, 130.81, 146.83, 164.81, 196, 220, 261.63, 311.13, 349.23, 392, 440, 523.25, 622.25, 698.46, 880];
  var DECODE = [220, 261.63, 311.13, 349.23, 392, 440, 523.25, 587.33, 659.26, 784, 880];
  var PENTA = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.26, 783.99, 880];
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  // [bass root, four voices] as MIDI notes
  var PROG = {
    night: [[45, [52, 55, 59, 60]], [41, [57, 60, 64, 66]], [48, [55, 59, 62, 64]], [43, [50, 59, 62, 64]]],   // Am9, Fmaj7#11, Cmaj9, G6/9
    day: [[48, [55, 59, 62, 64]], [52, [59, 62, 64, 67]], [41, [57, 60, 64, 67]], [43, [55, 59, 62, 66]]]     // Cmaj9, Em7, Fmaj9, G6
  };
  var BPM = 76, STEP = 60 / BPM / 2, CHORD_LEN = 60 / BPM * 8; // eight beats a chord, about 12.6 s
  function rand(a, b) { return a + Math.random() * (b - a); }
  function smooth(a, b, x) { x = Math.max(0, Math.min(1, (x - a) / (b - a))); return x * x * (3 - 2 * x); }

  function reverbIR(sec) {
    var rate = ac.sampleRate, n = Math.floor(rate * sec), buf = ac.createBuffer(2, n, rate);
    for (var c = 0; c < 2; c++) { var ch = buf.getChannelData(c), lp = 0; for (var i = 0; i < n; i++) { var w = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); lp += (w - lp) * .35; ch[i] = lp * 1.6; } }
    return buf;
  }
  function noiseBuf(sec, brown) {
    var n = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(1, n, ac.sampleRate), ch = b.getChannelData(0), last = 0;
    for (var i = 0; i < n; i++) { var w = Math.random() * 2 - 1; if (brown) { last = (last + .02 * w) / 1.02; ch[i] = last * 3.5; } else ch[i] = w; }
    return b;
  }

  function build() {
    if (!Ctx) return false;
    try {
      ac = new Ctx();
      var comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3.5; comp.attack.value = .02; comp.release.value = .3;
      out = ac.createGain(); out.gain.value = 0; out.connect(comp); comp.connect(ac.destination);
      bus = ac.createGain(); bus.gain.value = 1;
      var dry = ac.createGain(); dry.gain.value = .75; bus.connect(dry); dry.connect(out);
      var conv = ac.createConvolver(); conv.buffer = reverbIR(3.6); sendG = ac.createGain(); sendG.gain.value = .55; bus.connect(sendG); sendG.connect(conv); conv.connect(out);
      // pad: four voices, two detuned saws each, one slow filter shared by all
      var padBus = ac.createGain(); padBus.gain.value = .085; padBus.connect(bus);
      var padF = ac.createBiquadFilter(); padF.type = 'lowpass'; padF.frequency.value = 900; padF.Q.value = .6; padF.connect(padBus); padVoices.filter = padF;
      var lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = .05; lg.gain.value = 380; lfo.connect(lg); lg.connect(padF.frequency); lfo.start();
      for (var v = 0; v < 4; v++) {
        var g = ac.createGain(); g.gain.value = .25; g.connect(padF);
        var a = ac.createOscillator(), b = ac.createOscillator(); a.type = b.type = 'sawtooth'; a.detune.value = -7; b.detune.value = 7; a.connect(g); b.connect(g); a.start(); b.start();
        padVoices.push([a, b]);
      }
      // sub bass
      var sg = ac.createGain(); sg.gain.value = .13; sg.connect(bus); sub = ac.createOscillator(); sub.type = 'sine'; sub.connect(sg); sub.start(); sub.g = sg;
      // shimmer: two high sines with a slow tremolo, the "air" of orbit
      var shG = ac.createGain(); shG.gain.value = .0; shG.connect(bus); shim.g = shG;
      var trem = ac.createOscillator(), tg = ac.createGain(); trem.frequency.value = .13; tg.gain.value = .5; var tgate = ac.createGain(); tgate.gain.value = .5; trem.connect(tg); tg.connect(tgate.gain); tgate.connect(shG); trem.start();
      for (var s = 0; s < 2; s++) { var o = ac.createOscillator(); o.type = 'sine'; o.connect(tgate); o.start(); shim.push(o); }
      // distant traffic: brown noise through a low pass
      hum = ac.createBufferSource(); hum.buffer = noiseBuf(4, true); hum.loop = true; var hf = ac.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 160; humG = ac.createGain(); humG.gain.value = 0; hum.connect(hf); hf.connect(humG); humG.connect(bus); hum.start();
      mode = root.getAttribute('data-theme') === 'light' ? 'day' : 'night';
      if (/[?&]sfxdebug/.test(location.search)) { var an = ac.createAnalyser(); an.fftSize = 2048; comp.connect(an); window.__sfxAn = an; }
      return true;
    } catch (e) { ac = null; return false; }
  }

  function setChord(i, glide) {
    var ch = PROG[mode][i % 4], t = ac.currentTime, tc = glide;
    for (var v = 0; v < 4; v++) { var f = hz(ch[1][v]); padVoices[v][0].frequency.setTargetAtTime(f, t, tc); padVoices[v][1].frequency.setTargetAtTime(f, t, tc); }
    sub.frequency.setTargetAtTime(hz(ch[0] - 12 + 12), t, tc * .6);
    shim[0].frequency.setTargetAtTime(hz(ch[1][2] + 24), t, tc); shim[1].frequency.setTargetAtTime(hz(ch[1][0] + 31), t, tc);
  }
  function out2(node, pan) { if (ac.createStereoPanner && pan) { var p = ac.createStereoPanner(); p.pan.value = pan; node.connect(p); p.connect(bus); } else node.connect(bus); }
  function pluck(f, vol, pan) {
    var t = ac.currentTime + .02, o = ac.createOscillator(), g = ac.createGain(), fl = ac.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.setValueAtTime(2600, t); fl.frequency.exponentialRampToValueAtTime(500, t + .4);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + .55);
    o.connect(fl); fl.connect(g); out2(g, pan); o.start(t); o.stop(t + .6);
  }
  function bell(f, vol, pan) {
    var t = ac.currentTime + .02, g = ac.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + 2.4);
    [1, 2.76, 5.4].forEach(function (m, i) { var o = ac.createOscillator(), og = ac.createGain(); o.type = 'sine'; o.frequency.value = f * m; og.gain.value = [1, .35, .12][i]; o.connect(og); og.connect(g); o.start(t); o.stop(t + 2.5); });
    out2(g, pan);
  }
  // a train going by: a swept band of noise panned across, rails clicking in time, then a two-note station chime
  function train() {
    var t = ac.currentTime + .05, dur = rand(6, 8.5), dir = Math.random() < .5 ? -1 : 1, nb = ac.createBufferSource(); nb.buffer = noiseBuf(dur + 1, false);
    var bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4; bp.frequency.setValueAtTime(260, t); bp.frequency.exponentialRampToValueAtTime(900, t + dur * .5); bp.frequency.exponentialRampToValueAtTime(240, t + dur);
    var g = ac.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.05, t + dur * .5); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    var pan = ac.createStereoPanner ? ac.createStereoPanner() : null; if (pan) { pan.pan.setValueAtTime(dir * -.9, t); pan.pan.linearRampToValueAtTime(dir * .9, t + dur); }
    nb.connect(bp); bp.connect(g); if (pan) { g.connect(pan); pan.connect(bus); } else g.connect(bus); nb.start(t); nb.stop(t + dur + .5);
    // the rails: pairs of short ticks, louder at the middle of the pass
    for (var k = 0; k * .17 < dur; k++) {
      var tt = t + k * .17, env = Math.sin(Math.PI * k * .17 / dur), cb = ac.createBufferSource(); cb.buffer = noiseBuf(.05, false);
      var cf = ac.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = 1500; cf.Q.value = 3; var cg = ac.createGain(); cg.gain.setValueAtTime(.05 * env * env + .001, tt); cg.gain.exponentialRampToValueAtTime(.0001, tt + .04);
      cb.connect(cf); cf.connect(cg); cg.connect(bus); cb.start(tt); cb.stop(tt + .05);
    }
    nextChime = performance.now() / 1000 + dur + 1.2;
  }
  function stationChime() { bell(hz(76), .03, .2); setTimeout(function () { if (on && ac) bell(hz(72), .03, .2); }, 700); }

  function schedule() {
    if (!on || !ac || ac.state !== 'running') return;
    var now = ac.currentTime, nowS = performance.now() / 1000;
    // the chord and its glide
    if (now >= nextChord) { setChord(chordI++, 1.8); nextChord = now + CHORD_LEN; }
    // arpeggio on every eighth note, once the streets come in
    while (nextStep < now + .12) {
      if (nextStep < now) nextStep = now;
      var ch = PROG[mode][(chordI - 1 + 4) % 4], ci = mix.city;
      if (ci > .04 && Math.random() < .35 + .45 * ci) { var tones = ch[1], pat = [0, 2, 1, 3, 2, 1, 3, 0][step % 8], n = hz(tones[pat] + 12 + (Math.random() < .15 ? 12 : 0)); pluck(n, .035 * ci, rand(-.5, .5)); }
      nextStep += STEP; step++;
    }
    // bells, more of them up in space
    if (nowS >= nextBell) { bell(PENTA[(Math.random() * PENTA.length) | 0] * (Math.random() < .5 ? 2 : 4), .014 + .016 * mix.space, rand(-.7, .7)); nextBell = nowS + rand(3, 7) / (.5 + mix.space); }
    // a train now and then, once there is a city to hear it in
    if (mix.city > .2 && nowS >= nextTrain) { train(); nextTrain = nowS + rand(30, 55); }
    if (nextChime && nowS >= nextChime) { nextChime = 0; if (mix.city > .2) stationChime(); }
  }
  function mixTo(p) {
    mix.city = smooth(.06, .4, p); mix.space = 1 - .55 * smooth(.2, .95, p);
    if (!ac) return; var t = ac.currentTime;
    humG.gain.setTargetAtTime(.05 * mix.city, t, .8); shim.g.gain.setTargetAtTime(.05 * mix.space, t, 1); sendG.gain.setTargetAtTime(.35 + .35 * mix.space, t, 1); sub.g.gain.setTargetAtTime(.07 + .08 * mix.city, t, 1);
    padVoices.filter.frequency.setTargetAtTime(700 + 900 * mix.city, t, 1);
  }

  function tone(f, vol, len, type, delay, slide) {
    if (!on || !ac || ac.state !== 'running') return;
    var t = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f * slide), t + len);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + len);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + len + .02);
  }
  function sync() {
    if (btn) { btn.setAttribute('aria-pressed', on ? 'true' : 'false'); btn.classList.toggle('on', on); btn.setAttribute('aria-label', on ? 'Sound on. Turn sound off' : 'Sound off. Turn sound on'); }
    root.classList.toggle('sfx-on', on);
    d.dispatchEvent(new CustomEvent('sfx-change', { detail: { on: on } }));
  }
  function progress() { return scrollY / Math.max(1, root.scrollHeight - innerHeight); }
  function set(v) {
    if (v && !ac && !build()) return;
    if (!ac) return; on = !!v; var g = out.gain, t = ac.currentTime;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    if (on) {
      ac.resume(); mode = root.getAttribute('data-theme') === 'light' ? 'day' : 'night';
      var t0 = ac.currentTime; chordI = 0; setChord(chordI++, .01); nextChord = t0 + CHORD_LEN; nextStep = t0 + .3; step = 0; nextBell = performance.now() / 1000 + 1.5; nextTrain = performance.now() / 1000 + 14; mixTo(progress());
      g.linearRampToValueAtTime(.85, t + 3); clearInterval(timer); timer = setInterval(schedule, 90);
      setTimeout(function () { tone(523.25, .05, .4, 'sine'); tone(783.99, .04, .5, 'sine', .08); }, 150);
    } else { g.linearRampToValueAtTime(0, t + .8); clearInterval(timer); setTimeout(function () { if (!on && ac) ac.suspend(); }, 1000); }
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
    ripple: function () { tone(660, .03, .25, 'sine', 0, .5); },
    _train: function () { if (on && ac) train(); }
  };
  window.__sfx = api;

  if (btn) btn.addEventListener('click', function () { api.toggle(); });
  d.addEventListener('click', function (e) { if (on && e.target.closest && e.target.closest('a, button, [role=tab], summary')) api.tick(); }, true);
  d.addEventListener('sec-change', function (e) { if (on) api.chime(e.detail && e.detail.index); });
  new MutationObserver(function () { var m = root.getAttribute('data-theme') === 'light' ? 'day' : 'night'; if (m !== mode) { mode = m; if (on && ac) { chordI = 0; setChord(chordI++, 2.5); nextChord = ac.currentTime + CHORD_LEN; } } }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  var pend = 0;
  addEventListener('scroll', function () { if (pend) return; pend = requestAnimationFrame(function () { pend = 0; mixTo(progress()); }); }, { passive: true });
  d.addEventListener('visibilitychange', function () { if (ac && on) { if (d.hidden) ac.suspend(); else ac.resume(); } });
  if (!Ctx && btn) btn.hidden = true;
})();
