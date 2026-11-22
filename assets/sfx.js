/* sfx.js: the site's sound, all synthesised in the browser (Web Audio only, no audio files, no libraries).
   Off until the visitor asks (autoplay rules); the header meter button #sfx-btn switches it, hover or focus it for a volume popover.

   THE SCORE: "Night Drive over Kuala Lumpur", a through-composed piece of about 3 minutes 40 seconds that loops:
     Intro (8 bars) > A (16) > B (16) > Bridge (8) > A' (16) > Outro (8)     (72 bars, tempo 88 / 80 / 70 BPM by time of day)
   Harmony is written per mood (day / golden hour / night) and voice-led by search, so each chord moves the pad the shortest way.
   One 4-bar motif returns and develops: stated in A, ornamented, shifted up in B, inverted, stretched to double length in the bridge,
   doubled in a third in A', and reduced to its head in the intro and outro. A counter-line fills the gaps in B and A'.
   Layers: gliding saw pad, sub, walking bass, FM electric piano arpeggio, glass lead, bells, synthesised kick / brushed hat / rim and clap
   (they come in and leave with the form), a sidechain duck on every kick, a city-hum noise bed at night, a train in the bridge.
   Chain: instruments > buses > (duck) > mix > saturation > tape wow and flutter > shelf > compressor > limiter > fade > soft clip.
   Sends: one long generated reverb and a ping-pong delay that follows the tempo.

   TIME OF DAY: the `scenetime` event (detail.t 0 day, 1 golden hour, 2 night) morphs harmony (open major 9ths, warm suspensions, minor 9ths),
   tempo, brightness, bass depth, reverb and the city hum. PAGE: loudest and busiest during the 3D flight (#enter), quieter under reading.

   Scheduling is a lookahead clock (setTimeout plus AudioContext.currentTime). The whole engine takes a context, so the same code renders
   offline: with ?sfxdebug, SFX.render(seconds, {T:2}) returns an AudioBuffer (see tools in the sound agent's notes).

   Public API (kept from the old sfx.js, also on window.SFX): on, toggle, beep, tick, glyph, lock, done, chime, ripple, _train; new: set, volume, state. */
(function () {
  'use strict';
  var d = document, root = d.documentElement, Ctx = window.AudioContext || window.webkitAudioContext, OCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  var btn = d.getElementById('sfx-btn');
  var DEBUG = /[?&]sfxdebug/.test(location.search);

  /* ================= theory ================= */
  var NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function pcOf(n) { var p = NOTE[n.charAt(0)]; if (n.charAt(1) === 'b') p -= 1; else if (n.charAt(1) === '#') p += 1; return (p + 12) % 12; }
  var Q = {
    maj9: [0, 4, 7, 11, 14], m9: [0, 3, 7, 10, 14], maj7s11: [0, 4, 7, 11, 18], m11: [0, 3, 7, 10, 17], '69': [0, 4, 7, 9, 14],
    sus4: [0, 5, 7, 10, 14], m7: [0, 3, 7, 10], add9: [0, 4, 7, 14], sus2: [0, 2, 7, 9], '7sus': [0, 5, 7, 10, 13]
  };
  function chord(s) { var p = s.split(':'); return { r: pcOf(p[0]), q: Q[p[1]], name: p[0] + p[1] }; }
  // mood 0 day, 1 golden hour, 2 night. Every mood has the same number of chords (two bars each) so the form never moves.
  var PROG = {
    intro: ['C:maj9 F:maj9 C:maj9 G:69', 'C:add9 F:sus2 C:add9 G:sus4', 'A:m9 F:maj7s11 A:m9 E:m11'],
    A: ['C:maj9 E:m7 F:maj9 G:69 A:m9 D:m9 F:maj9 G:sus4', 'C:add9 G:sus4 A:m11 F:maj9 C:add9 F:sus2 D:m11 G:sus4', 'A:m9 F:maj7s11 C:maj9 E:m11 A:m9 F:maj9 D:m9 E:7sus'],
    B: ['F:maj9 G:69 E:m7 A:m9 D:m9 G:sus4 C:maj9 F:maj7s11', 'F:maj7s11 C:add9 D:m11 G:sus4 A:m11 F:sus2 G:sus4 C:sus2', 'D:m9 Bb:maj7s11 F:maj9 G:sus4 A:m9 Bb:maj7s11 D:m11 E:7sus'],
    bridge: ['F:maj9 E:m7 D:m9 G:sus4', 'F:sus2 A:m11 D:m11 G:sus4', 'F:maj7s11 D:m11 Bb:maj7s11 E:7sus'],
    outro: ['F:maj9 E:m7 F:maj9 C:maj9', 'F:sus2 G:sus4 F:sus2 C:add9', 'F:maj7s11 E:m11 D:m9 A:m9']
  };
  var FORM = [
    { n: 'Intro', p: 'intro', b: 8 }, { n: 'A', p: 'A', b: 16 }, { n: 'B', p: 'B', b: 16 },
    { n: 'Bridge', p: 'bridge', b: 8 }, { n: "A'", p: 'A', b: 16 }, { n: 'Outro', p: 'outro', b: 8 }
  ];
  var TOTAL = 0; FORM.forEach(function (s) { s.s0 = TOTAL; TOTAL += s.b; });
  var progCache = {};
  function progOf(name, mood) { var k = name + mood; return progCache[k] || (progCache[k] = PROG[name][mood].split(' ').map(chord)); }
  function locate(bar) { var b = ((bar % TOTAL) + TOTAL) % TOTAL; for (var i = 0; i < FORM.length; i++) if (b < FORM[i].s0 + FORM[i].b) return { seg: FORM[i], bo: b - FORM[i].s0, i: i }; }
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function lerp(a, b, x) { return a + (b - a) * x; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function smooth(a, b, x) { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); }
  function rngFor(seed) { var s = (seed * 2654435761) >>> 0; return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

  // voice leading: four upper voices, every chord tone present once, smallest total movement from the previous voicing
  var VR = [[52, 66], [57, 71], [62, 76], [66, 81]];
  function voice(ch, prev) {
    var tones = [], i;
    ch.q.slice(1).forEach(function (iv) { var p = (ch.r + iv) % 12; if (tones.indexOf(p) < 0) tones.push(p); });
    if (tones.length < 4) tones.push(ch.r);
    var cand = VR.map(function (r) { var a = []; for (var m = r[0]; m <= r[1]; m++) if (tones.indexOf(m % 12) >= 0) a.push(m); return a; });
    prev = prev || [55, 60, 64, 69];
    var best = null, bc = 1e9;
    cand[0].forEach(function (a) { cand[1].forEach(function (b) { if (b < a + 2) return; cand[2].forEach(function (c) { if (c < b + 2) return; cand[3].forEach(function (e) {
      if (e < c + 2) return;
      var u = {}; u[a % 12] = u[b % 12] = u[c % 12] = u[e % 12] = 1; if (Object.keys(u).length < Math.min(4, tones.length)) return;
      var cost = Math.abs(a - prev[0]) + Math.abs(b - prev[1]) + Math.abs(c - prev[2]) + 1.6 * Math.abs(e - prev[3]) + (e - c > 9 ? 3 : 0) + (b - a > 9 ? 2 : 0);
      if (cost < bc) { bc = cost; best = [a, b, c, e]; }
    }); }); }); });
    return best || prev;
  }

  // the motif, in steps of a sixteenth over four bars; pitches are indexes into a C pentatonic (A minor pentatonic) ladder
  var P = [57, 60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84];
  var CALL = [[0, 5, 6], [6, 4, 2], [8, 3, 4], [12, 4, 4], [16, 5, 8], [24, 6, 4], [28, 5, 4]];
  var RESP = [[32, 5, 4], [36, 4, 2], [38, 3, 2], [40, 2, 6], [46, 1, 2], [48, 2, 14]];
  var motifCache = {};
  function motif(kind) {
    if (motifCache[kind]) return motifCache[kind];
    var base = CALL.concat(RESP), out;
    function m(a, f) { return a.map(f); }
    if (kind === 'head') out = m(CALL.slice(0, 4), function (n) { return [n[0], P[n[1]], n[2]]; });
    else if (kind === 'dev1') out = m(base, function (n) { return [n[0], P[clamp(n[1] + 2, 0, 11)], n[2]]; });
    else if (kind === 'dev2') out = m(base, function (n) { return [n[0], P[clamp(10 - n[1], 0, 11)], n[2]]; });
    else if (kind === 'aug') out = m(base, function (n) { return [n[0] * 2, P[n[1]] - 12, n[2] * 2]; });
    else if (kind === 'motif2') { out = []; base.forEach(function (n) { if (n[2] >= 6) { out.push([n[0], P[n[1]], n[2] - 2]); out.push([n[0] + n[2] - 2, P[clamp(n[1] + 1, 0, 11)], 1]); out.push([n[0] + n[2] - 1, P[n[1]], 1]); } else out.push([n[0], P[n[1]], n[2]]); }); }
    else out = m(base, function (n) { return [n[0], P[n[1]], n[2]]; });
    return (motifCache[kind] = out);
  }

  /* ================= the engine (works on a realtime or an offline context) ================= */
  function Engine(ac, env, opts) {
    opts = opts || {};
    var rate = ac.sampleRate, E = {}, live = 0, MAXLIVE = opts.maxLive || 30;
    function g(v) { var n = ac.createGain(); n.gain.value = v; return n; }
    function flt(type, f, q) { var n = ac.createBiquadFilter(); n.type = type; n.frequency.value = f; if (q != null) n.Q.value = q; return n; }
    function pan(v) { if (!ac.createStereoPanner) return g(1); var p = ac.createStereoPanner(); p.pan.value = v; return p; }
    function osc(type, f) { var o = ac.createOscillator(); o.type = type; o.frequency.value = f; return o; }

    /* buffers */
    var white = ac.createBuffer(1, rate * 2, rate), wd = white.getChannelData(0), i, last = 0;
    for (i = 0; i < wd.length; i++) wd[i] = Math.random() * 2 - 1;
    var brown = ac.createBuffer(1, rate * 6, rate), bd = brown.getChannelData(0);
    for (i = 0; i < bd.length; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.5; }
    // a long, dark, wide reverb: pre-delay, a few early taps, then a tail that darkens as it decays
    var irLen = 6.4, irN = Math.floor(rate * irLen), ir = ac.createBuffer(2, irN, rate);
    for (var c = 0; c < 2; c++) {
      var ch = ir.getChannelData(c), lp = 0, pre = Math.floor(rate * .028);
      for (i = pre; i < irN; i++) { var t = (i - pre) / irN, k = lerp(.7, .05, Math.pow(t, .45)); lp += ((Math.random() * 2 - 1) - lp) * k; ch[i] = lp * Math.pow(1 - t, 2.4) * Math.exp(-t * 1.4) * 2.4; }
      [.011, .017, .023, .031, .043, .057].forEach(function (s, j) { var p = Math.floor(rate * (.028 + s + c * .0037)); ch[p] += (j % 2 ? -.5 : .6) * (1 - j * .1); });
    }

    /* master chain */
    var mix = g(1), preSat = g(1), sat = ac.createWaveShaper(), curve = new Float32Array(2048);
    for (i = 0; i < 2048; i++) { var x = i / 1024 - 1; curve[i] = Math.tanh(1.7 * x) / Math.tanh(1.7); }
    sat.curve = curve; sat.oversample = '2x';
    var satTrim = g(.3), tape = ac.createDelay(.05); tape.delayTime.value = .014;
    [[.55, .00065], [6.2, .00004], [.13, .00045]].forEach(function (p) { var o = osc('sine', p[0]), og = g(p[1]); o.connect(og); og.connect(tape.delayTime); o.start(); });
    var hp = flt('highpass', 28, .7), shelf = flt('highshelf', 8500); shelf.gain.value = -3.5;
    var comp = ac.createDynamicsCompressor(); comp.threshold.value = -22; comp.knee.value = 14; comp.ratio.value = 3; comp.attack.value = .03; comp.release.value = .28;
    var lim = ac.createDynamicsCompressor(); lim.threshold.value = -5; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .002; lim.release.value = .09;
    mix.connect(preSat); preSat.connect(sat); sat.connect(satTrim); satTrim.connect(tape); tape.connect(hp); hp.connect(shelf); shelf.connect(comp); comp.connect(lim);
    E.out = lim;

    /* routing */
    var ctxG = g(env.ctx); ctxG.connect(mix);
    var duck = g(1); duck.connect(ctxG);
    var conv = ac.createConvolver(); conv.buffer = ir; var revRet = g(.55); conv.connect(revRet); revRet.connect(ctxG);
    var dIn = g(1), dL = ac.createDelay(2), dR = ac.createDelay(2), fbL = g(.4), fbR = g(.4), lpL = flt('lowpass', 2600), lpR = flt('lowpass', 2600), pL = pan(-.8), pR = pan(.8), dRet = g(.6);
    dIn.connect(dL); dL.connect(pL); dR.connect(pR); dL.connect(lpL); lpL.connect(fbL); fbL.connect(dR); dR.connect(lpR); lpR.connect(fbR); fbR.connect(dL); pL.connect(dRet); pR.connect(dRet); dRet.connect(ctxG);
    function bus(rev, dly) {
      var b = { in: g(1) }, dry = g(1); b.in.connect(dry); dry.connect(duck);
      if (rev) { b.r = g(rev); b.in.connect(b.r); b.r.connect(conv); }
      if (dly) { b.d = g(dly); b.in.connect(b.d); b.d.connect(dIn); }
      return b;
    }
    var bPad = bus(.5, .06), bBass = bus(.02, 0), bKeys = bus(.42, .34), bLead = bus(.55, .46), bAir = bus(.9, .1);
    var bDr = g(.72); bDr.connect(ctxG); var drRev = g(.3); bDr.connect(drRev); drRev.connect(conv);
    function duckAt(t, depth) { var p = duck.gain; p.setValueAtTime(1, t); p.linearRampToValueAtTime(1 - depth, t + .012); p.setTargetAtTime(1, t + .012, .115); }

    /* pad: four voices, two detuned saws each, one slow filter, gliding between voicings; swell layer for the flight */
    var padF = flt('lowpass', 1400, .55), padSw = g(.085), padV = [];
    padF.connect(padSw); padSw.connect(bPad.in);
    var lfo = osc('sine', .045), lg = g(420); lfo.connect(lg); lg.connect(padF.frequency); lfo.start();
    [-.55, -.2, .2, .55].forEach(function (pv, v) {
      var a = osc('sawtooth', 220), b = osc('sawtooth', 220), va = g(.2), vb = g(.2), pa = pan(clamp(pv - .42, -1, 1)), pb = pan(clamp(pv + .42, -1, 1)); a.detune.value = -8; b.detune.value = 8;
      a.connect(va); va.connect(pa); pa.connect(padF); b.connect(vb); vb.connect(pb); pb.connect(padF); a.start(); b.start(); padV.push([a, b]);
    });
    var sub = osc('sine', 55), subG = g(.1); sub.connect(subG); subG.connect(bBass.in); sub.start();
    var swF = flt('lowpass', 900, .4), swG = g(.0), swO = []; swF.connect(swG); swG.connect(bAir.in);
    [0, 1, 2].forEach(function (k) { var o = osc('sawtooth', 110), o2 = osc('sawtooth', 110); o.detune.value = -9 + k * 3; o2.detune.value = 9 - k * 3; o.connect(swF); o2.connect(swF); o.start(); o2.start(); swO.push([o, o2]); });
    // city: distant traffic (brown noise, low pass) and a faint breathing "air" band
    var hum = ac.createBufferSource(); hum.buffer = brown; hum.loop = true; var humF = flt('lowpass', 170), humG = g(0); hum.connect(humF); humF.connect(humG); humG.connect(ctxG); hum.start();
    var city = ac.createBufferSource(); city.buffer = white; city.loop = true; var cityF = flt('bandpass', 1500, .45), cityG = g(0), cl = osc('sine', .09), clg = g(.5), cgate = g(.5);
    city.connect(cityF); cityF.connect(cgate); cl.connect(clg); clg.connect(cgate.gain); cgate.connect(cityG); cityG.connect(ctxG); city.start(); cl.start();

    function padTo(t, vl, glide) { for (var v = 0; v < 4; v++) { var f = hz(vl[v]); padV[v][0].frequency.setTargetAtTime(f, t, glide); padV[v][1].frequency.setTargetAtTime(f, t, glide); } }
    function swTo(t, root, glide) { [0, 7, 16].forEach(function (iv, k) { var f = hz(root + 12 + iv); swO[k][0].frequency.setTargetAtTime(f, t, glide); swO[k][1].frequency.setTargetAtTime(f, t, glide); }); }

    /* instruments (all take an explicit time) */
    function epiano(t, m, vel, pn, dur, b, soft) {
      if (live > MAXLIVE) return; live++; var f = hz(m), cr = osc('sine', f), md = osc('sine', f), mg = g(0), tn = osc('sine', f * 2.01), tg = g(0), e = g(0), p = pan(pn);
      var idx = f * (soft ? .7 : 1.5) * (.45 + .55 * (1 - env.T / 2.6)) * (.5 + vel);
      mg.gain.setValueAtTime(idx, t); mg.gain.exponentialRampToValueAtTime(Math.max(1, idx * .08), t + .42);
      tg.gain.setValueAtTime(.12 * vel, t); tg.gain.exponentialRampToValueAtTime(.0005, t + .25);
      e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(vel * .26, t + .005); e.gain.exponentialRampToValueAtTime(vel * .09, t + .5); e.gain.exponentialRampToValueAtTime(.0002, t + dur);
      md.connect(mg); mg.connect(cr.frequency); cr.connect(e); tn.connect(tg); tg.connect(e); e.connect(p); p.connect(b.in);
      cr.onended = function () { live--; }; cr.start(t); md.start(t); tn.start(t); cr.stop(t + dur + .05); md.stop(t + dur + .05); tn.stop(t + .3);
    }
    var vib = osc('sine', 5.1), vibG = g(9); vib.connect(vibG); vib.start();
    function lead(t, m, dur, vel, pn) {
      if (live > MAXLIVE) return; live++; var f = hz(m), a = osc('triangle', f), b = osc('sawtooth', f), bg = g(.12), lp = flt('lowpass', 500, .6), e = g(0), p = pan(pn || 0);
      a.detune.value = -5; b.detune.value = 6; var br = 900 + 2400 * (1 - env.T / 2.4);
      lp.frequency.setValueAtTime(br * .45, t); lp.frequency.linearRampToValueAtTime(br, t + .18); lp.frequency.linearRampToValueAtTime(br * .6, t + dur);
      e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(vel * .2, t + .06); e.gain.setTargetAtTime(vel * .15, t + .08, .5); e.gain.setTargetAtTime(0, t + dur, .22);
      vibG.connect(a.detune); vibG.connect(b.detune); a.connect(lp); b.connect(bg); bg.connect(lp); lp.connect(e); e.connect(p); p.connect(bLead.in);
      a.onended = function () { live--; try { vibG.disconnect(a.detune); vibG.disconnect(b.detune); } catch (x) {} }; a.start(t); b.start(t); a.stop(t + dur + 1.4); b.stop(t + dur + 1.4);
    }
    function bell(t, m, vel, pn, dur, b) {
      if (live > MAXLIVE) return; live++; var f = hz(m), e = g(0), p = pan(pn); dur = dur || 3;
      e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(vel * .16, t + .008); e.gain.exponentialRampToValueAtTime(.0002, t + dur);
      [1, 2.76, 5.4].forEach(function (r, k) { var o = osc('sine', f * r), og = g([1, .32, .1][k]); o.connect(og); og.connect(e); if (k === 0) o.onended = function () { live--; }; o.start(t); o.stop(t + dur + .1); });
      e.connect(p); p.connect(b ? b.in : bKeys.in);
    }
    function bassNote(t, m, dur, vel) {
      if (live > MAXLIVE) return; live++; var f = hz(m), a = osc('triangle', f), s = osc('sine', f), lp = flt('lowpass', 520 + 380 * (1 - env.T / 2), .5), e = g(0);
      e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(vel * .22, t + .012); e.gain.setTargetAtTime(vel * .13, t + .02, .12); e.gain.setTargetAtTime(0, t + dur, .06);
      a.connect(lp); s.connect(lp); lp.connect(e); e.connect(bBass.in); a.onended = function () { live--; }; a.start(t); s.start(t); a.stop(t + dur + .4); s.stop(t + dur + .4);
    }
    function noiseHit(t, dur, dest, filt, vol, atk) {
      var s = ac.createBufferSource(); s.buffer = white; var e = g(0); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(vol, t + (atk || .002)); e.gain.exponentialRampToValueAtTime(.0002, t + dur);
      s.connect(e); e.connect(filt || dest); if (filt) filt.connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + dur + .02);
    }
    var hatF = flt('highpass', 6800, .5), hatG = g(1), hatP = pan(.22); hatF.connect(hatG); hatG.connect(hatP); hatP.connect(bDr);
    var hatB = flt('bandpass', 9500, .8); hatB.connect(hatF);
    function hat(t, vel, open) { var s = ac.createBufferSource(); s.buffer = white; var e = g(0); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(vel * .22, t + .006); e.gain.exponentialRampToValueAtTime(.0002, t + (open ? .26 : .06)); s.connect(e); e.connect(hatB); s.start(t, Math.random() * 1.5); s.stop(t + (open ? .3 : .1)); }
    var clapF = flt('bandpass', 1500, .9), clapG = g(1); clapF.connect(clapG); clapG.connect(bDr); clapG.connect(drRev);
    function clap(t, vel) { [0, .011, .022].forEach(function (o, k) { var s = ac.createBufferSource(); s.buffer = white; var e = g(0); e.gain.setValueAtTime(0, t + o); e.gain.linearRampToValueAtTime(vel * .26, t + o + .002); e.gain.exponentialRampToValueAtTime(.0002, t + o + (k === 2 ? .2 : .02)); s.connect(e); e.connect(clapF); s.start(t + o, Math.random() * 1.5); s.stop(t + o + .24); }); }
    function rim(t, vel) { var o = osc('triangle', 1750), e = g(0), bp = flt('bandpass', 2400, 2); o.frequency.setValueAtTime(1750, t); o.frequency.exponentialRampToValueAtTime(1180, t + .04); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(vel * .16, t + .001); e.gain.exponentialRampToValueAtTime(.0002, t + .07); o.connect(bp); bp.connect(e); e.connect(bDr); e.connect(drRev); o.start(t); o.stop(t + .1); }
    function kick(t, vel) {
      var o = osc('sine', 140), e = g(0); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(46, t + .11);
      e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(vel * .6, t + .003); e.gain.exponentialRampToValueAtTime(.0003, t + .42); o.connect(e); e.connect(bDr); o.start(t); o.stop(t + .45);
      var cf = flt('highpass', 1800); noiseHit(t, .012, bDr, cf, vel * .05); duckAt(t, .5 * vel);
    }
    function riser(t, dur) {
      var s = ac.createBufferSource(); s.buffer = white; s.loop = true; var bp = flt('bandpass', 300, 1.2), e = g(0);
      bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(7200, t + dur); bp.Q.setValueAtTime(1.2, t); bp.Q.linearRampToValueAtTime(.5, t + dur);
      e.gain.setValueAtTime(.0002, t); e.gain.exponentialRampToValueAtTime(.2 * (.6 + env.flight * .5), t + dur); e.gain.linearRampToValueAtTime(0, t + dur + .06);
      s.connect(bp); bp.connect(e); e.connect(bAir.in); s.start(t); s.stop(t + dur + .1);
    }
    function impact(t, vel) {
      var o = osc('sine', 78), e = g(0); o.frequency.exponentialRampToValueAtTime(34, t + .9); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(vel * .5, t + .01); e.gain.exponentialRampToValueAtTime(.0003, t + 1.6); o.connect(e); e.connect(bBass.in); o.start(t); o.stop(t + 1.7);
      var cf = flt('lowpass', 2400); noiseHit(t, 1.8, bAir.in, cf, vel * .2, .01);
    }
    function train(t, dur, dirn) {
      var s = ac.createBufferSource(); s.buffer = white; s.loop = true; var bp = flt('bandpass', 260, 1.4), e = g(.0002), p = pan(-.9 * dirn);
      bp.frequency.setValueAtTime(260, t); bp.frequency.exponentialRampToValueAtTime(900, t + dur * .5); bp.frequency.exponentialRampToValueAtTime(240, t + dur);
      e.gain.setValueAtTime(.0002, t); e.gain.exponentialRampToValueAtTime(.07, t + dur * .5); e.gain.exponentialRampToValueAtTime(.0002, t + dur);
      if (p.pan) { p.pan.setValueAtTime(-.9 * dirn, t); p.pan.linearRampToValueAtTime(.9 * dirn, t + dur); }
      s.connect(bp); bp.connect(e); e.connect(p); p.connect(bAir.in); s.start(t); s.stop(t + dur + .1);
      for (var k = 0; k * .17 < dur; k++) { var en = Math.sin(Math.PI * k * .17 / dur), cf = flt('bandpass', 1500, 3); noiseHit(t + k * .17, .04, bAir.in, cf, .05 * en * en + .001); }
    }

    /* sequencer state */
    var st = { bar: 0, nextT: 0, bpm: 80, sd: .1875, mood: null, ch: null, vl: null, root: 45, cPrev: 82, spare: 0 };
    function moodNow() {
      var T = env.T, m = T < .5 ? 0 : T < 1.5 ? 1 : 2;
      if (st.mood != null && Math.abs(T - st.mood) < .68) return st.mood;
      return m;
    }
    function tempoFor(T) { return T <= 1 ? lerp(88, 80, T) : lerp(80, 70, T - 1); }
    function bassMidi(pc) { var m = 36 + (((pc - 36) % 12) + 12) % 12; if (env.T > 1.6 && m >= 41) m -= 12; return m; }
    function ctrl(t) {
      var T = env.T, br = 1 - T / 2, fl = env.flight, night = smooth(.9, 2, T), tc = 1.1;
      ctxG.gain.setTargetAtTime(env.ctx, t, 1.4);
      padF.frequency.setTargetAtTime(560 + 1500 * br + 1100 * fl, t, tc);
      lg.gain.setTargetAtTime(220 + 300 * (1 - Math.abs(T - 1)), t, tc);
      revRet.gain.setTargetAtTime(.4 + .32 * (T / 2) + .14 * fl, t, tc);
      humG.gain.setTargetAtTime(.004 + .055 * night, t, 1.2); cityG.gain.setTargetAtTime(.002 + .022 * night, t, 1.2);
      subG.gain.setTargetAtTime(.03 + .07 * (T / 2), t, tc);
      swG.gain.setTargetAtTime(.01 + .075 * fl, t, 1.6); swF.frequency.setTargetAtTime(500 + 900 * fl + 500 * br, t, 1.2);
      fbL.gain.setTargetAtTime(.32 + .12 * (T / 2), t, tc); fbR.gain.setTargetAtTime(.32 + .12 * (T / 2), t, tc);
      shelf.gain.setTargetAtTime(-.5 - 2.5 * (T / 2), t, tc);
    }
    E.ctrl = ctrl;

    function buildBar(bar, t0) {
      var L = locate(bar), seg = L.seg, bo = L.bo, name = seg.n, last = bo === seg.b - 1, sd, sw = .15, i;
      st.bpm = lerp(st.bpm, tempoFor(env.T), .55); sd = st.sd = 60 / st.bpm / 4;
      var beat = sd * 4, delT = beat * .75; dL.delayTime.setTargetAtTime(delT, t0, .05); dR.delayTime.setTargetAtTime(delT * 1.0, t0, .05);
      var rnd = rngFor(bar + 7), en = .4 + .6 * env.energy;
      ctrl(t0);
      // chord
      var chs = progOf(seg.p, st.mood == null ? 0 : st.mood);
      if (bo % 2 === 0 || !st.ch) {
        st.mood = moodNow(); chs = progOf(seg.p, st.mood); st.ch = chs[Math.floor(bo / 2) % chs.length]; st.vl = voice(st.ch, st.vl); st.root = bassMidi(st.ch.r);
        padTo(t0, st.vl, .32); swTo(t0, st.root, .5); sub.frequency.setTargetAtTime(hz(st.root - 12), t0, .12);
        padSw.gain.setTargetAtTime(.052 + .02 * (1 - Math.abs(env.T - 1)), t0, .12); padSw.gain.setTargetAtTime(.088 + .03 * (1 - Math.abs(env.T - 1)), t0 + .5, .7);
      }
      var ch = st.ch, vl = st.vl, root = st.root, nextCh = ch;
      if (bo % 2 === 1) { nextCh = last ? progOf(FORM[(L.i + 1) % FORM.length].p, st.mood)[0] : chs[(Math.floor(bo / 2) + 1) % chs.length]; }
      var nextRoot = bassMidi(nextCh.r);
      function S(s) { return t0 + s * sd; } function W(s) { return t0 + s * sd + ((s & 1) ? sw * sd : 0); }
      var pool = []; vl.concat(vl.map(function (m) { return m + 12; })).forEach(function (m) { if (m >= 62 && m <= 88) pool.push(m); }); pool.sort(function (a, b) { return a - b; });
      var lay = {};
      switch (name) {
        case 'Intro': lay = { bass: bo >= 3 ? 'pedal' : 0, arp: bo >= 6 ? 1 : 0, hat: bo === 7, lead: bo >= 4 ? 'head' : 0, ls: 4, bells: 1 }; break;
        case 'A': lay = { bass: 'walk', arp: 1, kick: bo >= 4, hat: bo >= 4, clap: bo >= 8 ? 'clap' : bo >= 4 ? 'rim' : 0, lead: (bo < 4 || (bo >= 8 && bo < 12)) ? (bo < 4 ? 'motif' : 'motif2') : 0, ls: bo < 4 ? 0 : 8, counter: bo >= 12, fill: last }; break;
        case 'B': lay = { bass: 'walk', arp: 2, kick: 1, hat: 1, clap: 'clap', lead: bo < 4 ? 'dev1' : (bo >= 8 && bo < 12) ? 'dev2' : 0, ls: bo < 4 ? 0 : 8, counter: (bo >= 4 && bo < 8) || bo >= 12, fill: last, imp: bo === 0 }; break;
        case 'Bridge': lay = { bass: 'pedal', kick: bo >= 4 ? 'heart' : 0, lead: 'aug', ls: 0, riser: bo === 7, bells: 1 }; break;
        case "A'": lay = { bass: 'walk', arp: 2, kick: 1, hat: 'full', clap: 'clap', lead: (bo < 4 || (bo >= 8 && bo < 12)) ? 'full' : 0, ls: bo < 4 ? 0 : 8, counter: (bo >= 4 && bo < 8) || bo >= 12, fill: last, imp: bo === 0 }; break;
        case 'Outro': lay = { bass: bo < 4 ? 'walk' : 'pedal', arp: bo < 4 ? 1 : 0, kick: bo < 2, hat: bo < 2, lead: bo < 4 ? 'head' : 0, ls: 0, bells: bo >= 4 }; break;
      }
      if (name === 'A' && last || name === 'B' && last || name === 'Bridge' && last) { lay.riser = true; }
      if (name === "A'" && last) lay.riser = false;
      /* bass */
      if (lay.bass === 'walk') {
        var odd = bo % 2 === 1, five = root + 7, oct = root + 12, appr = nextRoot + (root > nextRoot ? 1 : -1);
        if (!odd) { bassNote(S(0), root, sd * 6, 1); bassNote(W(7), five, sd * 2, .55); bassNote(S(8), root, sd * 3, .8); bassNote(W(11), oct > 52 ? root : oct, sd * 2, .5); bassNote(S(12), ch.q[1] === 3 ? root + 3 : root + 4, sd * 3, .7); }
        else { bassNote(S(0), root, sd * 5, .95); bassNote(S(6), root, sd * 1.5, .5); bassNote(W(9), five, sd * 3, .7); bassNote(S(12), oct > 52 ? five : oct, sd * 2, .6); bassNote(W(15), appr, sd * 1.5, .6); }
      } else if (lay.bass === 'pedal') { bassNote(S(0), root, sd * 12, .6); if (bo % 2) bassNote(S(8), root + 7, sd * 7, .3); }
      /* arpeggio */
      if (lay.arp && pool.length > 5) {
        var pat = lay.arp === 2 ? [[0, 2, 3, 6, 8, 10, 11, 14], [0, 1, 2, 4, 3, 2, 1, 5]] : [[0, 3, 6, 8, 11, 14], [0, 2, 4, 2, 3, 1]], rot = bo % 2, base = 1;
        pat[0].forEach(function (s, k) {
          if (rnd() < (lay.arp === 2 ? .12 : .2) * (1.3 - env.energy)) return;
          var m = pool[Math.min(pool.length - 1, base + (pat[1][k] + rot) % 6)], v = (s % 8 === 0 ? .7 : .42) * (.6 + .4 * en);
          epiano(W(s), m, v, rnd() * 1.1 - .55, 1.3, bKeys);
        });
      }
      /* lead motif */
      if (lay.lead) {
        var rel = bo - (lay.ls || 0), kind = lay.lead, notes = motif(kind === 'full' ? 'motif' : kind), lo = rel * 16 * (kind === 'aug' ? 1 : 1), hi = lo + 16;
        notes.forEach(function (n) {
          if (n[0] < lo || n[0] >= hi) return; var tt = S(n[0] - lo), dur = n[2] * sd * .98, m = n[1];
          if (kind === 'head' && name === 'Intro') bell(tt, m + 12, .75, rnd() * .6 - .3, 4, bLead);
          else if (kind === 'head') lead(tt, m, dur, .55, 0);
          else { lead(tt, m, dur, kind === 'aug' ? .75 : .95, 0); if (kind === 'full') { lead(tt, m - 4 > 0 ? m - 3 : m, dur, .45, -.25); if (n[2] >= 6) bell(tt, m + 12, .5, .3, 3, bLead); } }
        });
      }
      /* counter-melody: stepwise on chord tones, high, in the gaps */
      if (lay.counter) {
        var cp = []; ch.q.forEach(function (iv) { cp.push((ch.r + iv) % 12); });
        [2, 10].forEach(function (s, k) {
          var tgt = st.cPrev - 1.6 + (rnd() * 2 - 1), b = 0, bd = 1e9;
          for (var m = 70; m <= 88; m++) if (cp.indexOf(m % 12) >= 0 && m !== st.cPrev) { var dd = Math.abs(m - tgt); if (dd < bd) { bd = dd; b = m; } }
          st.cPrev = b; if (b > 84) st.cPrev = 79;
          epiano(S(s), b, k ? .5 : .62, .35 * (k ? -1 : 1), 2.6, bKeys, true);
        });
      }
      /* bells: sparse pings from the chord, in the intro, bridge and outro */
      if (lay.bells && pool.length > 3 && (bo % 2 === 0 || name === 'Bridge')) bell(S(rnd() < .5 ? 0 : 6), pool[pool.length - 1 - (rnd() * 3 | 0)] + 12 > 96 ? pool[pool.length - 1] : pool[pool.length - 1 - (rnd() * 3 | 0)] + 12, .55, rnd() * 1.4 - .7, 4);
      /* drums */
      var dv = en;
      if (lay.kick) {
        var kp = lay.kick === 'heart' ? [[0, .5], [8, .4]] : (bo % 2 ? [[0, 1], [7, .45], [10, .85]] : [[0, 1], [10, .85]]);
        if (name === 'B' || name === "A'") kp = bo % 2 ? [[0, 1], [7, .45], [10, .85], [bo % 4 === 3 ? 14 : 12, .35]] : [[0, 1], [6, .3], [10, .85]];
        kp.forEach(function (k) { if (lay.fill && k[0] >= 12) return; kick(W(k[0]), k[1] * (.55 + .45 * dv)); });
      }
      if (lay.hat) {
        var full = lay.hat === 'full';
        for (i = 0; i < 16; i++) {
          var odd16 = i & 1, v;
          if (lay.fill && i >= 8) { hat(W(i), .2 + (i - 8) * .07, false); continue; }
          if (!odd16) v = (i % 4 === 0 ? .55 : .36); else if (rnd() < (full ? .6 : .32)) v = .15 + rnd() * .1; else continue;
          if (lay.hat === true && name === 'Intro') v = .12 + (i / 16) * .2;
          hat(W(i), v * (.5 + .5 * dv), i === 14 && bo % 4 === 3 && !lay.fill);
        }
      }
      if (lay.clap === 'clap') { [4, 12].forEach(function (s) { if (lay.fill && s === 12) return; clap(S(s) + sd * .02, .75 * (.5 + .5 * dv)); }); if (lay.fill) [12, 13, 14, 15].forEach(function (s, k) { clap(S(s), .25 + k * .15); }); }
      else if (lay.clap === 'rim') { rim(S(4), .7 * (.5 + .5 * dv)); if (bo % 2) rim(W(11), .3); rim(S(12), .45); }
      if (lay.riser) riser(t0 + sd * 8, sd * 8);
      if (lay.imp) impact(t0, .7 * (.6 + .4 * env.flight));
      if (name === 'Bridge' && bo === 1 && env.T > .8) train(S(2), 9, 1);
      if (name === 'Bridge' && bo === 4 && env.T > .8) { bell(S(8), 88, .5, .25, 4, bAir); bell(S(14), 84, .5, .25, 4, bAir); }
      if (name === 'Outro' && bo === 5) { bell(S(0), 81, .7, -.2, 6); bell(S(6), 79, .5, .3, 6); bell(S(10), 76, .6, 0, 8); }
      st.bar = bar; st.lastSeg = name; st.lastBo = bo;
      return beat * 4;
    }
    /* schedule every bar that starts before `until` */
    E.start = function (t, bar0) { st.nextT = t; st.bar = bar0 || 0; st.mood = null; st.ch = null; st.vl = null; st.bpm = tempoFor(env.T); ctrl(t); };
    E.pump = function (until) { var n = 0; while (st.nextT < until && n++ < 4) { var len = buildBar(st.bar, st.nextT); st.nextT += len; st.bar++; } };
    E.state = function () { var L = locate(st.bar - 1 < 0 ? 0 : st.bar - 1); return { bar: st.bar, total: TOTAL, section: L.seg.n, bo: L.bo, bpm: Math.round(st.bpm), chord: st.ch ? st.ch.name : '', mood: st.mood, nextT: st.nextT, live: live }; };
    E.train = function (t) { train(t, 8, Math.random() < .5 ? -1 : 1); };
    E.bell = bell; E.bBell = bKeys;
    E.nextBarTime = function () { return st.nextT; };
    return E;
  }

  /* ================= realtime wrapper ================= */
  var env = { T: root.getAttribute('data-theme') === 'light' ? 0 : (root.getAttribute('data-theme') ? 2 : 0), energy: .55, flight: 0, ctx: .78 };
  var on = false, armed = false, ac = null, eng = null, fadeG = null, uiG = null, windG = null, windF = null, an = null, timer = 0, vol = .75, lastGlyph = 0, lastTick = 0, started = 0, sawScene = false;
  var LOOK = .5;
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  var sv = parseFloat(lsGet('sfx-vol')); if (sv >= 0 && sv <= 1) vol = sv;
  function vgain() { return Math.pow(vol, 1.6) * .95; }
  function themeT() { return root.getAttribute('data-theme') === 'light' || !root.getAttribute('data-theme') ? 0 : 2; }
  function sceneT() { var s = window.SceneTime; if (s && typeof s.get === 'function') { var v = +s.get(); if (v >= 0 && v <= 2) return v; } return themeT(); }
  function readPage() {
    var en = d.getElementById('enter'), vh = innerHeight;
    if (en) {
      var r = en.getBoundingClientRect(), inE = r.top < vh * .55 && r.bottom > vh * .45, hero = !inE && r.top > vh * .3;
      env.flight = inE ? 1 : 0; env.ctx = inE ? 1.08 : hero ? .8 : .62; env.energy = inE ? 1 : hero ? .55 : .3;
    } else { env.flight = 0; env.ctx = .78; env.energy = .55; }
    if (eng && ac) eng.ctrl(ac.currentTime);
  }

  function ensure() {
    if (ac) return true;
    if (!Ctx) return false;
    try {
      ac = new Ctx(); env.T = sceneT(); readPage();
      eng = Engine(ac, env);
      fadeG = ac.createGain(); fadeG.gain.value = 0; uiG = ac.createGain(); uiG.gain.value = .9;
      // Subtle scroll-velocity wind layer (active during orbital descent & KL drone flight)
      var wLen = ac.sampleRate * 2, wBuf = ac.createBuffer(1, wLen, ac.sampleRate), wData = wBuf.getChannelData(0), b0 = 0, b1 = 0, b2 = 0;
      for (var wi = 0; wi < wLen; wi++) { var wh = Math.random() * 2 - 1; b0 = .997 * b0 + wh * .029; b1 = .985 * b1 + wh * .032; b2 = .95 * b2 + wh * .048; wData[wi] = (b0 + b1 + b2 + wh * .018) * .3; }
      var wSrc = ac.createBufferSource(); wSrc.buffer = wBuf; wSrc.loop = true;
      windF = ac.createBiquadFilter(); windF.type = 'bandpass'; windF.frequency.value = 320; windF.Q.value = 1.5;
      windG = ac.createGain(); windG.gain.value = .0001;
      wSrc.connect(windF); windF.connect(windG); windG.connect(fadeG); wSrc.start();
      var clip = ac.createWaveShaper(); clip.curve = new Float32Array([-.97, .97]);
      eng.out.connect(fadeG); uiG.connect(fadeG); fadeG.connect(clip); clip.connect(ac.destination);
      an = ac.createAnalyser(); an.fftSize = 256; an.smoothingTimeConstant = .78; clip.connect(an);
      var pos = null; try { pos = JSON.parse(sessionStorage.getItem('sfx-pos') || 'null'); } catch (e) {}
      var bar0 = 0; if (pos && Date.now() - pos.ts < 30000) bar0 = pos.bar % 72;
      eng.start(ac.currentTime + .12, bar0);
      if (DEBUG) { window.__sfxAn = an; window.__sfxEng = eng; window.__sfxEnv = env; }
      return true;
    } catch (e) { ac = null; eng = null; return false; }
  }
  function fadeTo(v, secs) { if (!fadeG) return; var g = fadeG.gain, t = ac.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(v, t + secs); }
  function loop() {
    clearTimeout(timer); if (!ac || !on) return;
    if (ac.state === 'running' && !d.hidden) {
      eng.pump(ac.currentTime + LOOK);
      var s = eng.state(); if (s.bar !== loop.lastBar) { loop.lastBar = s.bar; try { sessionStorage.setItem('sfx-pos', JSON.stringify({ bar: s.bar, ts: Date.now() })); } catch (e) {} }
    }
    timer = setTimeout(loop, 40);
  }
  function closeAc() { if (on || !ac) return; clearTimeout(timer); try { ac.close(); } catch (e) {} ac = null; eng = null; fadeG = null; uiG = null; windG = null; windF = null; an = null; }
  function set(v, quiet) {
    v = !!v;
    if (v) {
      if (!ensure()) { on = false; sync(); return; }
      on = true; armed = false; started = performance.now(); ac.resume(); fadeTo(vgain(), 1.5); loop(); setTimeout(function () { if (on && ac) { tone(523.25, .04, .4, 'sine'); tone(783.99, .03, .5, 'sine', .08); } }, 200);
    } else {
      on = false; armed = false; if (ac) { fadeTo(0, 1.5); setTimeout(closeAc, 1700); }
    }
    if (!quiet) lsSet('sfx-on', v ? '1' : '0');
    sync(); if (v) popShow(3500);
  }
  function tone(f, vol2, len, type, delay, slide) {
    if (!on || !ac || ac.state !== 'running' || !uiG) return;
    var t = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f * slide), t + len);
    g.gain.setValueAtTime(vol2, t); g.gain.exponentialRampToValueAtTime(.0001, t + len);
    o.connect(g); g.connect(uiG); o.start(t); o.stop(t + len + .02);
  }
  var SCAN = [110, 130.81, 146.83, 164.81, 196, 220, 261.63, 311.13, 349.23, 392, 440, 523.25, 622.25, 698.46, 880];
  var DECODE = [220, 261.63, 311.13, 349.23, 392, 440, 523.25, 587.33, 659.26, 784, 880];
  var PENTA = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.26, 783.99, 880];
  var api = {
    get on() { return on; },
    toggle: function () { set(!(on || armed)); },
    set: function (v) { set(v); },
    volume: function (v) { if (v == null) return vol; vol = clamp(+v, 0, 1); lsSet('sfx-vol', String(vol)); if (ac && on && fadeG) { var g = fadeG.gain, t = ac.currentTime; g.cancelScheduledValues(t); g.setTargetAtTime(vgain(), t, .05); } paintPop(); },
    state: function () { return eng ? eng.state() : null; },
    beep: function (f, len, type, v, slide) { tone(f, v || .04, len || .1, type || 'square', 0, slide); },
    tick: function () { var n = performance.now(); if (n - lastTick < 60) return; lastTick = n; tone(1320, .018, .035, 'square'); },
    glyph: function () { var n = performance.now(); if (n - lastGlyph < 38) return; lastGlyph = n; tone(SCAN[(Math.random() * SCAN.length) | 0] * (.92 + Math.random() * .16), .02, .022, 'square'); },
    lock: function (p) { var f = DECODE[Math.round(clamp(p, 0, 1) * (DECODE.length - 1))]; tone(f, .1, .09, 'sine'); tone(f * 2, .03, .07, 'sine'); },
    done: function () { [523.25, 659.26, 783.99].forEach(function (f, i) { tone(f, .05 - i * .01, .4, 'sine', i * .018); }); },
    chime: function (i) { var f = PENTA[(i | 0) % PENTA.length]; tone(f, .05, .7, 'sine'); tone(f * 1.5, .02, .6, 'sine', .05); },
    ripple: function () { tone(660, .03, .25, 'sine', 0, .5); },
    _train: function () { if (on && ac && eng) eng.train(ac.currentTime + .05); }
  };
  window.__sfx = api; window.SFX = api;
  if (DEBUG) api.render = function (sec, o) {
    o = o || {}; var oc = new OCtx(2, Math.floor(44100 * sec), 44100), e2 = { T: o.T == null ? 2 : o.T, energy: o.energy == null ? .7 : o.energy, flight: o.flight || 0, ctx: o.ctx || .8 };
    var en = Engine(oc, e2); en.out.connect(oc.destination); en.start(.1, o.bar || 0); en.ctrl(0);
    var t = 0; while (en.nextBarTime() < sec + 1) { en.pump(en.nextBarTime() + .01); } return oc.startRendering();
  };

  /* ================= UI: button, meter, popover ================= */
  var pop = null, popTimer = 0, popOpen = false, rng = null, outEl = null, secEl = null, bars = btn ? btn.querySelectorAll('.sfx-bars i') : [], reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function sync() {
    if (btn) { var shown = on || armed; btn.setAttribute('aria-pressed', shown ? 'true' : 'false'); btn.classList.toggle('on', shown); btn.classList.toggle('live', on && !reduce); btn.setAttribute('aria-label', armed ? 'Sound on, starts at your next tap. Turn sound off' : on ? 'Sound on. Turn sound off' : 'Sound off. Turn sound on'); }
    root.classList.toggle('sfx-on', on);
    d.dispatchEvent(new CustomEvent('sfx-change', { detail: { on: on } }));
    paintPop(); meterKick();
  }
  function buildPop() {
    if (pop || !btn) return;
    var st = d.createElement('style');
    st.textContent = '.sfxp{position:fixed;z-index:90;width:min(290px,calc(100vw - 24px));padding:14px 14px 12px;border:1px solid var(--line,rgba(128,128,128,.4));border-radius:12px;background:var(--surface,var(--bg,#fff));color:var(--ink,#111);box-shadow:0 16px 44px rgba(0,0,0,.24);font:500 .74rem/1.3 var(--f-mono,ui-monospace,monospace);opacity:0;visibility:hidden;transform:translateY(-6px);transition:opacity .18s,transform .18s,visibility 0s .18s}' +
      '.sfxp.open{opacity:1;visibility:visible;transform:none;transition:opacity .18s,transform .18s}' +
      '.sfxp b{display:block;font-size:.84rem;letter-spacing:.02em}.sfxp .s{display:block;margin-top:3px;color:var(--muted,#667);letter-spacing:.04em;text-transform:uppercase;font-size:.66rem}' +
      '.sfxp .v{display:flex;align-items:center;gap:10px;margin-top:8px}.sfxp .v span{min-width:2.4em;text-align:right;color:var(--muted,#667)}' +
      '.sfxp input[type=range]{-webkit-appearance:none;appearance:none;flex:1;height:38px;margin:0;background:transparent;cursor:pointer}' +
      '.sfxp input[type=range]::-webkit-slider-runnable-track{height:6px;border-radius:3px;background:linear-gradient(90deg,var(--accent,#0a6c74) var(--p,75%),var(--line,rgba(128,128,128,.4)) var(--p,75%))}' +
      '.sfxp input[type=range]::-moz-range-track{height:6px;border-radius:3px;background:var(--line,rgba(128,128,128,.4))}.sfxp input[type=range]::-moz-range-progress{height:6px;border-radius:3px;background:var(--accent,#0a6c74)}' +
      '.sfxp input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:24px;height:24px;margin-top:-9px;border-radius:50%;background:var(--accent,#0a6c74);border:3px solid var(--surface,var(--bg,#fff));box-shadow:0 0 0 1px var(--accent,#0a6c74)}' +
      '.sfxp input[type=range]::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:var(--accent,#0a6c74);border:3px solid var(--surface,var(--bg,#fff))}' +
      '.sfxp button{margin-top:6px;width:100%;min-height:44px;border-radius:9px;border:1px solid var(--accent,#0a6c74);background:transparent;color:var(--ink,#111);font:700 .74rem var(--f-mono,monospace);letter-spacing:.06em;text-transform:uppercase;cursor:pointer}' +
      '.sfxp button[aria-pressed=true]{background:var(--accent,#0a6c74);color:var(--accent-ink,#fff)}';
    d.head.appendChild(st);
    pop = d.createElement('div'); pop.className = 'sfxp'; pop.setAttribute('role', 'group'); pop.setAttribute('aria-label', 'Sound settings');
    pop.innerHTML = '<b>Night Drive over KL</b><span class="s">Generative score, made in your browser</span><label class="v"><input type="range" min="0" max="100" step="1" aria-label="Volume"><span></span></label><button type="button" aria-pressed="false"></button>';
    d.body.appendChild(pop);
    rng = pop.querySelector('input'); outEl = pop.querySelector('.v span'); secEl = pop.querySelector('.s');
    rng.addEventListener('input', function () { api.volume(rng.value / 100); });
    pop.querySelector('button').addEventListener('click', function () { api.toggle(); });
    pop.addEventListener('mouseenter', function () { clearTimeout(popTimer); }); pop.addEventListener('mouseleave', function () { popHide(500); });
    pop.addEventListener('focusin', function () { clearTimeout(popTimer); }); pop.addEventListener('pointerdown', function () { clearTimeout(popTimer); });
    pop.addEventListener('keydown', function (e) { if (e.key === 'Escape') { popOpen = false; pop.classList.remove('open'); btn.focus(); } });
  }
  function paintPop() {
    if (!pop) return; var p = Math.round(vol * 100); rng.value = p; rng.style.setProperty('--p', p + '%'); outEl.textContent = p + '%';
    var b = pop.querySelector('button'); b.setAttribute('aria-pressed', on || armed ? 'true' : 'false'); b.textContent = on ? 'Sound on: tap to stop' : armed ? 'Starts at your next tap' : 'Sound off: tap to play';
    var s = api.state(); if (s && on) secEl.textContent = s.section + ' · bar ' + (((s.bar - 1) % 72 + 72) % 72 + 1) + '/72 · ' + s.bpm + ' bpm · ' + ['day', 'golden hour', 'night'][s.mood == null ? 0 : s.mood]; else secEl.textContent = 'Generative score, made in your browser';
  }
  function popShow(autoHide) {
    if (!btn) return; buildPop(); if (!pop) return; var r = btn.getBoundingClientRect();
    pop.style.top = Math.round(r.bottom + 8) + 'px'; pop.style.right = Math.max(12, Math.round(innerWidth - r.right)) + 'px'; pop.style.left = 'auto';
    paintPop(); popOpen = true; pop.classList.add('open'); clearTimeout(popTimer); if (autoHide) popTimer = setTimeout(function () { pop.classList.remove('open'); popOpen = false; }, autoHide);
  }
  function popHide(ms) { clearTimeout(popTimer); popTimer = setTimeout(function () { if (pop && !pop.contains(d.activeElement)) { pop.classList.remove('open'); popOpen = false; } }, ms || 0); }
  setInterval(function () { if (popOpen && on) paintPop(); }, 1000);

  var mRaf = 0, mBuf = null, mFrame = 0;
  function meter() {
    mRaf = 0; if (!btn || !bars.length) return;
    if (!on || !an || d.hidden || reduce) { for (var i = 0; i < bars.length; i++) bars[i].style.transform = ''; return; }
    if (++mFrame % 2 === 0) {
      mBuf = mBuf || new Uint8Array(an.frequencyBinCount); an.getByteFrequencyData(mBuf);
      var edges = [1, 3, 7, 16, 40];
      for (var b = 0; b < 4; b++) { var s = 0, n = 0; for (var k = edges[b]; k < edges[b + 1]; k++) { s += mBuf[k]; n++; } var lv = clamp(.18 + (s / n / 255) * 1.9, .18, 1); bars[b].style.transform = 'scaleY(' + lv.toFixed(2) + ')'; }
    }
    mRaf = requestAnimationFrame(meter);
  }
  function meterKick() { if (!mRaf && on && !reduce) mRaf = requestAnimationFrame(meter); else if (!on) { for (var i = 0; i < bars.length; i++) bars[i].style.transform = ''; } }

  /* ================= wiring ================= */
  if (btn) {
    btn.addEventListener('click', function () { if (performance.now() - (armGate || 0) < 700) { popShow(3500); return; } api.toggle(); });
    btn.addEventListener('mouseenter', function () { popShow(0); }); btn.addEventListener('mouseleave', function () { popHide(450); });
    btn.addEventListener('focus', function () { if (btn.matches(':focus-visible')) popShow(0); }); btn.addEventListener('blur', function () { popHide(300); });
    btn.addEventListener('keydown', function (e) { if (e.key === 'Escape' && pop) { popOpen = false; pop.classList.remove('open'); } });
  }
  d.addEventListener('click', function (e) { if (on && e.target.closest && e.target.closest('a, button, [role=tab], summary')) api.tick(); }, true);
  d.addEventListener('click', function (e) { if (popOpen && pop && !pop.contains(e.target) && e.target !== btn && !(btn && btn.contains(e.target))) { popOpen = false; pop.classList.remove('open'); } });
  d.addEventListener('sec-change', function (e) { if (on) api.chime(e.detail && e.detail.index); });
  var tPend = 0;
  d.addEventListener('scenetime', function (e) { sawScene = true; env.T = clamp(+(e.detail && e.detail.t) || 0, 0, 2); if (!tPend) tPend = setTimeout(function () { tPend = 0; if (eng && ac) eng.ctrl(ac.currentTime); }, 250); });
  new MutationObserver(function () { if (!sawScene) { env.T = themeT(); if (eng && ac) eng.ctrl(ac.currentTime); } }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  var pend = 0, lastSy = scrollY, lastSt = performance.now(), windCalm = 0;
  function onScroll() {
    if (pend) return;
    pend = requestAnimationFrame(function () {
      pend = 0; readPage();
      var now = performance.now(), dt = Math.max(16, now - lastSt), vel = Math.abs(scrollY - lastSy) / dt;
      lastSy = scrollY; lastSt = now;
      if (on && ac && windG && windF) {
        var ds = d.getElementById('descent'), inDs = false;
        if (ds) { var dr = ds.getBoundingClientRect(); inDs = dr.top < innerHeight && dr.bottom > 0; }
        var activeZone = env.flight > .5 || inDs;
        var v = activeZone ? clamp(vel * .42, 0, 1) : 0;
        var t = ac.currentTime;
        windG.gain.setTargetAtTime(v > .02 ? .004 + v * .11 : .0001, t, .08);
        windF.frequency.setTargetAtTime(240 + v * 920 + (inDs ? 180 : 0), t, .1);
        clearTimeout(windCalm);
        windCalm = setTimeout(function () { if (ac && windG) windG.gain.setTargetAtTime(.0001, ac.currentTime, .22); }, 180);
      }
    });
  }
  addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll);
  d.addEventListener('visibilitychange', function () { if (!ac || !on) return; if (d.hidden) ac.suspend(); else { ac.resume(); meterKick(); } });
  var armGate = 0;
  if (lsGet('sfx-on') === '1' && Ctx) {
    armed = true;   // allowed to play, but browsers need a tap or key first
    var go = function () { if (!armed) return; ['pointerdown', 'keydown', 'touchend'].forEach(function (n) { removeEventListener(n, go, true); }); armGate = performance.now(); set(true, true); };
    ['pointerdown', 'keydown', 'touchend'].forEach(function (n) { addEventListener(n, go, true); });
  }
  if (!Ctx && btn) btn.hidden = true;
  readPage(); sync();
})();
