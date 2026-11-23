/* scorelab.js: live interactive stem mixer & spectrum visualizer for sfx.js ("Night Drive over Kuala Lumpur").
 * Plain JS + Canvas2D, zero dependencies. Only runs while the Score Lab view is open in /lab/. */
(function () {
  'use strict';
  var d = document, root = d.getElementById('scorelab');
  if (!root) return;
  var cv = d.getElementById('sl-cv'), ctx = cv ? cv.getContext('2d') : null;
  var chordEl = d.getElementById('sl-chord'), formEl = d.getElementById('sl-form'), bpmEl = d.getElementById('sl-bpm');
  var playBtn = d.getElementById('sl-play'), wavBtn = d.getElementById('sl-wav');
  var moodBtns = [].slice.call(root.querySelectorAll('[data-sl-mood]'));
  var stemBtns = [].slice.call(root.querySelectorAll('[data-sl-stem]'));
  var trackBtns = [].slice.call(root.querySelectorAll('[data-sl-track]'));
  var jamBtns = [].slice.call(root.querySelectorAll('[data-sl-jam]'));
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var active = false, raf = 0, bins = null, wave = null, W = 0, H = 0, dpr = 1, lastUiKey = '', prevTrack = null;

  function S() { return window.SFX || window.__sfx || null; }

  function size() {
    if (!cv) return;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = Math.max(300, cv.clientWidth || 760);
    H = Math.max(180, cv.clientHeight || 300);
    var pw = Math.round(W * dpr), ph = Math.round(H * dpr);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
  }

  function syncUI(force) {
    var s = S(), on = !!(s && s.on);
    var st = s && s.state ? s.state() : null;
    var stems = s && s.stems ? s.stems() : null;
    var curTrk = s && s.track ? s.track() : 'home';
    var key = (on ? '1' : '0') + '|' + curTrk + '|' + (st ? st.bar + '|' + st.chord + '|' + st.mood + '|' + st.bpm + '|' + st.section : '') + '|' + (stems ? Object.keys(stems).map(function (k) { return stems[k] ? '1' : '0'; }).join('') : '');
    if (!force && key === lastUiKey) return;
    lastUiKey = key;
    if (playBtn) {
      playBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      playBtn.textContent = on ? 'Pause score' : 'Play score';
    }
    trackBtns.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.slTrack === curTrk ? 'true' : 'false'); });
    if (st && on) {
      var bar = (((st.bar - 1) % st.total) + st.total) % st.total + 1;
      if (chordEl) chordEl.textContent = st.chord || '---';
      if (formEl) formEl.textContent = st.section + ' · Bar ' + bar + (curTrk === 'home' ? ' / ' + st.total : '');
      if (bpmEl) bpmEl.textContent = st.bpm + ' BPM';
      moodBtns.forEach(function (b) { b.setAttribute('aria-pressed', +b.dataset.slMood === st.mood ? 'true' : 'false'); });
    } else {
      if (chordEl) chordEl.textContent = 'STANDBY';
      if (formEl) formEl.textContent = 'Press Play score to start the Web Audio engine';
      if (bpmEl) bpmEl.textContent = curTrk === 'home' ? '72 bars' : 'Live loop';
    }
    if (stems) stemBtns.forEach(function (b) { b.setAttribute('aria-pressed', stems[b.dataset.slStem] !== false ? 'true' : 'false'); });
  }

  function draw(now) {
    raf = 0;
    if (!active || !ctx) return;
    if (!W || !H) size();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Deep studio grid backdrop
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#071022'); bg.addColorStop(1, '#040814');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(127, 211, 255, .07)'; ctx.lineWidth = 1;
    for (var gx = 48; gx < W; gx += 48) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
    for (var gy = 48; gy < H; gy += 48) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

    var s = S(), an = s && s.on && s.analyser ? s.analyser() : null;
    var st = s && s.state ? s.state() : null;
    var mood = st ? st.mood : 2;
    var col = mood === 1 ? '#ffd27a' : (mood === 0 ? '#5bb6ff' : '#7fd3ff');
    var colSoft = mood === 1 ? 'rgba(255, 210, 122, .25)' : 'rgba(127, 211, 255, .22)';

    if (an) {
      if (!bins || bins.length !== an.frequencyBinCount) {
        bins = new Uint8Array(an.frequencyBinCount);
        wave = new Uint8Array(an.fftSize);
      }
      an.getByteFrequencyData(bins);
      an.getByteTimeDomainData(wave);

      // Spectrum bars (first 64 musical bins)
      var n = Math.min(64, bins.length), pad = 24, gap = 3, bw = Math.max(2, (W - pad * 2 - gap * (n - 1)) / n);
      for (var i = 0; i < n; i++) {
        var v = bins[i] / 255, bh = Math.max(3, v * (H * .64));
        var x = pad + i * (bw + gap), y = H - 22 - bh;
        ctx.fillStyle = colSoft;
        ctx.fillRect(x, y, bw, bh);
        ctx.fillStyle = col;
        ctx.fillRect(x, y, bw, Math.min(4, bh));
      }

      // Crisp oscilloscope waveform ribbon
      ctx.beginPath();
      for (var j = 0; j < wave.length; j++) {
        var wx = pad + (j / (wave.length - 1)) * (W - pad * 2);
        var wy = H * .34 + ((wave[j] - 128) / 128) * (H * .24);
        if (j === 0) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
      }
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
    } else {
      // Calm idle sine horizon when paused
      ctx.beginPath();
      var t = (now || 0) * .0014;
      for (var k = 0; k <= 80; k++) {
        var fx = k / 80, px = 24 + fx * (W - 48);
        var py = H * .52 + Math.sin(fx * 9 + t) * (reduce ? 6 : 12) * Math.sin(fx * Math.PI);
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = 'rgba(127, 211, 255, .38)'; ctx.lineWidth = 2; ctx.stroke();
    }

    syncUI();
    if (!reduce && active) raf = requestAnimationFrame(draw);
  }

  if (playBtn) playBtn.addEventListener('click', function () {
    var s = S(); if (!s) return;
    s.toggle();
    setTimeout(function () { syncUI(); if (active && !raf) raf = requestAnimationFrame(draw); }, 60);
  });

  moodBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      var s = S(); if (!s || !s.setMood) return;
      s.setMood(+b.dataset.slMood);
      moodBtns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      setTimeout(syncUI, 60);
    });
  });

  stemBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      var s = S(); if (!s || !s.setStem) return;
      var next = b.getAttribute('aria-pressed') !== 'true';
      s.setStem(b.dataset.slStem, next);
      b.setAttribute('aria-pressed', next ? 'true' : 'false');
      if (window.FlightLog) window.FlightLog.unlock('scorelab');
    });
  });

  trackBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      var s = S(); if (!s || !s.setTrack) return;
      if (!s.on) s.set(true);
      s.setTrack(b.dataset.slTrack);
      syncUI(true);
      if (window.FlightLog) window.FlightLog.unlock('scorelab');
    });
  });

  function hitPad(idx) {
    var s = S(); if (!s || !s.jam) return;
    s.jam(idx);
    var b = jamBtns[idx];
    if (b) { b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit'); }
    if (window.FlightLog) window.FlightLog.unlock('scorelab');
  }
  jamBtns.forEach(function (b) {
    b.addEventListener('pointerdown', function () { hitPad(+b.dataset.slJam); });
  });
  d.addEventListener('keydown', function (e) {
    if (!active || e.ctrlKey || e.metaKey || e.altKey) return;
    var tg = e.target; if (tg && /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName)) return;
    var k = e.key;
    if (k === '1' || k === '2' || k === '3' || k === '4') { e.preventDefault(); hitPad(+k - 1); }
  });

  if (wavBtn) wavBtn.addEventListener('click', function () {
    var s = S(); if (!s || !s.exportWav || wavBtn.disabled) return;
    var orig = wavBtn.textContent;
    wavBtn.disabled = true; wavBtn.textContent = 'Rendering .WAV…';
    s.exportWav(8).then(function (res) {
      var url = URL.createObjectURL(res.blob), a = d.createElement('a');
      a.href = url; a.download = res.filename; a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      wavBtn.textContent = 'Downloaded!';
      if (window.FlightLog) window.FlightLog.unlock('scorelab');
      setTimeout(function () { wavBtn.textContent = orig; wavBtn.disabled = false; }, 1800);
    }).catch(function () {
      wavBtn.textContent = 'Export unavailable';
      setTimeout(function () { wavBtn.textContent = orig; wavBtn.disabled = false; }, 2000);
    });
  });

  d.addEventListener('play-view', function (e) {
    var on = e.detail && e.detail.id === 'scorelab';
    var s = S();
    if (on && !active && s && s.setTrack) {
      prevTrack = s.track ? s.track() : 'lab';
      s.setTrack('home'); // switch to the 72-bar Day/Golden/Night procedural score while Score Lab is open
    } else if (!on && active && s && s.setTrack && prevTrack) {
      s.setTrack(prevTrack);
      prevTrack = null;
    }
    active = on;
    if (on) { size(); syncUI(true); if (!raf) raf = requestAnimationFrame(draw); }
    else if (raf) { cancelAnimationFrame(raf); raf = 0; }
  });
  window.addEventListener('resize', function () { if (active) size(); });
  if (window.ResizeObserver && cv) new ResizeObserver(function () { if (active) size(); }).observe(cv);
})();
