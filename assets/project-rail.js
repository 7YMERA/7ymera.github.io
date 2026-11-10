/* Project rail: a plain-JS port of the 21st.dev "Clothing Rail Hero" (product-rail-gallery).
   Hangers on a rail. Hover, focus or tap one and it swings round to face you while its neighbours slide aside.
   Drag a hanger to slide it along the rail. Click the front one to lift it into a big view that flips front and back.
   Narrow screens become a swipeable carousel. Springs run only while something moves, only transform/opacity change.
   Usage: <div data-project-rail data-base="" data-label="Projects"><script type="application/json" class="prail-data">[...]</script></div>
   Item: { id, name, tag, kind, pitch, points:[], stack, image, links:[{label, href, primary}] }  (paths are relative to data-base)
   Styles: assets/project-rail.css. Colours come from --pr-* variables that each page maps to its own theme. */
(function () {
  'use strict';

  var ASPECT = 200 / 310, REST = -70, PERSP = 1100, GAP = 0.035, MAX_H = 400, MIN_WIDE_H = 210, CAR_H = 340, SIDE_W = 0.3;
  var NS = 'http://www.w3.org/2000/svg';

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lambert(a) { var r = a * Math.PI / 180; return 0.66 + 0.34 * Math.max(0, Math.sin(r) * 0.42 + Math.cos(r) * 0.91); }
  function footprint(h, angle) { var e = clamp(1 - angle / REST, 0, 1), s = e * e * (3 - 2 * e); return h * ASPECT * (SIDE_W + (0.94 - SIDE_W) * s); }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function hanger() {
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 200 310'); s.setAttribute('preserveAspectRatio', 'xMidYMin meet');
    s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', 'prail-hanger');
    s.innerHTML =
      '<path class="sh" d="M38,57 Q70,38 100,36 Q130,38 162,57" transform="translate(1 2)"/>' +
      '<path class="bar" d="M38,57 Q70,38 100,36 Q130,38 162,57"/>' +
      '<path class="hi" d="M40,54.5 Q71,35.5 100,33.5 Q129,35.5 160,54.5"/>' +
      '<path class="hook" d="M100,36 L100,-0.4 C100,-3.4 102.2,-4.2 103.9,-2.8 C104.9,-2 105.4,-1.2 105.6,-0.2"/>' +
      '<rect class="clip" x="44" y="46" width="9" height="16" rx="2.5"/><rect class="clip" x="147" y="46" width="9" height="16" rx="2.5"/>';
    return s;
  }

  function cardMedia(item, base) {
    var wrap = el('span', 'prail-media');
    if (item.image) {
      var img = document.createElement('img');
      img.src = base + item.image; img.alt = ''; img.draggable = false; img.decoding = 'async'; img.loading = 'lazy';
      wrap.appendChild(img);
    } else { wrap.classList.add('is-blank'); wrap.appendChild(el('span', 'prail-initial', (item.name || '?').charAt(0))); }
    return wrap;
  }

  function mount(root, items, opt) {
    opt = opt || {};
    var base = opt.base || '', n = items.length;
    if (!n) return;
    var autoplay = opt.autoplay !== false, interval = opt.interval || 3400;
    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    var reduce = mq.matches;
    mq.addEventListener && mq.addEventListener('change', function () { reduce = mq.matches; apply(); });

    root.classList.add('prail');
    root.textContent = '';

    var stage = el('div', 'prail-stage');
    stage.setAttribute('role', 'group'); stage.setAttribute('aria-label', opt.label || 'Projects');
    var rail = el('div', 'prail-rail'); rail.setAttribute('aria-hidden', 'true');
    stage.appendChild(rail);

    var slots = [], swings = [], turns = [], shades = [], tagEls = [];
    items.forEach(function (it, i) {
      var b = el('button', 'prail-slot');
      b.type = 'button'; b.setAttribute('aria-pressed', 'false'); b.dataset.i = i;
      b.setAttribute('aria-label', it.name + (it.tag ? ', ' + it.tag : '') + '. Press Enter to open.');
      var sw = el('span', 'prail-swing'), tu = el('span', 'prail-turn');
      tu.appendChild(hanger());
      var card = el('span', 'prail-card');
      card.appendChild(cardMedia(it, base));
      var meta = el('span', 'prail-meta');
      meta.appendChild(el('b', '', it.name));
      if (it.kind) meta.appendChild(el('small', '', it.kind));
      card.appendChild(meta);
      var shade = el('span', 'prail-shade'); card.appendChild(shade);
      tu.appendChild(card); sw.appendChild(tu);
      if (it.tag) {
        var tw = el('span', 'prail-tagw');
        tw.appendChild(el('span', 'prail-tagline')); tw.appendChild(el('span', 'prail-tagbox', it.tag));
        sw.appendChild(tw); tagEls[i] = tw;
      }
      b.appendChild(sw);
      stage.appendChild(b);
      slots[i] = b; swings[i] = sw; turns[i] = tu; shades[i] = shade;
    });
    root.appendChild(stage);

    var dots = el('div', 'prail-dots'); dots.setAttribute('role', 'group'); dots.setAttribute('aria-label', 'Choose a project');
    var dotEls = items.map(function (it, i) {
      var d = el('button', 'prail-dot'); d.type = 'button'; d.setAttribute('aria-label', 'Show ' + it.name);
      d.addEventListener('click', function () { stopAuto(); choose(i); });
      dots.appendChild(d); return d;
    });
    root.appendChild(dots);

    var cap = el('div', 'prail-cap'); cap.setAttribute('aria-live', 'polite');
    var capTitle = el('p', 'prail-cap-t', opt.caption || ''), capSub = el('p', 'prail-cap-s', '');
    cap.appendChild(capTitle); cap.appendChild(capSub); root.appendChild(cap);

    /* ---------- state ---------- */
    var S = { x: [], vx: [], tx: [], turn: [], vturn: [], tturn: [], swing: [], vswing: [], drag: -1, grab: 0, free: 0, last: 0, raf: 0 };
    var size = { width: 0, h: 300, carousel: false };
    var active = null, carIndex = 0, focusIndex = 0, playing = autoplay, visible = true, openIdx = null;
    var P = { id: -1, index: -1, x: 0, y: 0, moved: false, kind: '', swipe: 0, lastX: 0, lastT: 0, v: 0 };

    function targets(front) {
      var feet = items.map(function (_, i) { return footprint(size.h, i === front ? 0 : REST) + size.h * GAP; });
      var xs = feet.map(function () { return 0; });
      if (size.carousel) {
        var c = front == null ? 0 : front; xs[c] = size.width / 2;
        for (var i = c + 1; i < n; i++) xs[i] = xs[i - 1] + (feet[i - 1] + feet[i]) / 2;
        for (i = c - 1; i >= 0; i--) xs[i] = xs[i + 1] - (feet[i + 1] + feet[i]) / 2;
        return xs;
      }
      var total = feet.reduce(function (a, b) { return a + b; }, 0), cur = (size.width - total) / 2;
      return feet.map(function (f) { var x = cur + f / 2; cur += f; return x; });
    }

    function measure() {
      var w = stage.clientWidth; if (!w) return false;
      var restK = footprint(1, REST) + GAP, actK = footprint(1, 0) + GAP;
      var fit = (w - 24) / (n * restK + (actK - restK));
      var car = fit < MIN_WIDE_H;
      var h = Math.round(car ? Math.min(CAR_H, Math.max(220, w * 0.86)) : Math.min(MAX_H, fit));
      if (Math.abs(size.width - w) < 0.5 && size.carousel === car && size.h === h) return false;
      size.width = w; size.carousel = car; size.h = h;
      var boxW = h * ASPECT, railY = Math.round(h * 0.07) + 10;
      stage.style.height = Math.round(railY + h + h * 0.05 + 12) + 'px';
      stage.style.setProperty('--h', h + 'px');
      rail.style.top = (railY - 5) + 'px';
      slots.forEach(function (s) { s.style.width = boxW + 'px'; s.style.height = h + 'px'; s.style.top = (railY - (4 / 310) * h) + 'px'; });
      root.classList.toggle('is-carousel', car);
      return true;
    }

    function paint(i) {
      var w = size.h * ASPECT, a = S.turn[i], sw = S.swing[i];
      slots[i].style.transform = 'translate3d(' + (S.x[i] - w / 2).toFixed(2) + 'px,0,0)';
      swings[i].style.transform = 'rotate(' + sw.toFixed(3) + 'deg)';
      turns[i].style.transform = 'perspective(' + PERSP + 'px) rotateY(' + a.toFixed(2) + 'deg)';
      shades[i].style.opacity = (1 - lambert(a)).toFixed(3);
      if (tagEls[i]) tagEls[i].style.transform = 'rotate(' + (-12 + sw * 0.6).toFixed(2) + 'deg)';
    }

    function step(now) {
      var dt = S.last ? Math.min(0.034, (now - S.last) / 1000) : 1 / 60; S.last = now;
      var busy = false, sub = 2, sdt = dt / sub, h = size.h, i, k, pass;
      for (k = 0; k < sub; k++) {
        for (i = 0; i < n; i++) {
          var before = S.vx[i];
          if (i !== S.drag) {
            var restoring = now > S.free, stiff = restoring ? 130 : 0, damp = restoring ? 2 * Math.sqrt(130) * 0.86 : 3.2;
            S.vx[i] = before + (-stiff * (S.x[i] - S.tx[i]) - damp * before) * sdt;
            S.x[i] += S.vx[i] * sdt;
          }
          var accel = (S.vx[i] - before) / sdt;
          S.vturn[i] += (-150 * (S.turn[i] - S.tturn[i]) - 2 * Math.sqrt(150) * 0.78 * S.vturn[i]) * sdt;
          S.turn[i] += S.vturn[i] * sdt;
          S.vswing[i] += (-24 * S.swing[i] - 2.1 * S.vswing[i] - clamp(accel, -6000, 6000) * 0.0045) * sdt;
          S.swing[i] = clamp(S.swing[i] + S.vswing[i] * sdt, -12, 12);
        }
        for (pass = 0; pass < 2; pass++) {
          for (i = 0; i < n - 1; i++) {
            var a = S.x[i], b = S.x[i + 1];
            var overlap = (footprint(h, S.turn[i]) + footprint(h, S.turn[i + 1])) / 2 + h * 0.012 - (b - a);
            if (overlap <= 0) continue;
            if (i === S.drag) S.x[i + 1] = b + overlap; else if (i + 1 === S.drag) S.x[i] = a - overlap;
            else { S.x[i] = a - overlap / 2; S.x[i + 1] = b + overlap / 2; }
            var va = S.vx[i], vb = S.vx[i + 1];
            if (va > vb) { var sh = (va + vb) / 2; if (i !== S.drag) S.vx[i] = sh; if (i + 1 !== S.drag) S.vx[i + 1] = sh; }
          }
        }
        if (!size.carousel) {
          var edge = h * 0.06, first = edge + footprint(h, S.turn[0]) / 2, last = size.width - edge - footprint(h, S.turn[n - 1]) / 2;
          if (S.x[0] < first) { S.x[0] = first; S.vx[0] = Math.abs(S.vx[0]) * 0.3; }
          if (S.x[n - 1] > last) { S.x[n - 1] = last; S.vx[n - 1] = -Math.abs(S.vx[n - 1]) * 0.3; }
        }
      }
      for (i = 0; i < n; i++) {
        paint(i);
        if (Math.abs(S.vx[i]) > 0.4 || (now > S.free && Math.abs(S.x[i] - S.tx[i]) > 0.25) || Math.abs(S.turn[i] - S.tturn[i]) > 0.05 || Math.abs(S.vturn[i]) > 0.05 || Math.abs(S.swing[i]) > 0.02 || Math.abs(S.vswing[i]) > 0.05) busy = true;
      }
      if (S.drag >= 0 || now < S.free) busy = true;
      if (busy) S.raf = requestAnimationFrame(step);
      else { S.raf = 0; S.last = 0; for (i = 0; i < n; i++) { if (now > S.free) S.x[i] = S.tx[i]; S.swing[i] = 0; S.vswing[i] = 0; paint(i); } }
    }

    function kick() {
      if (reduce) { for (var i = 0; i < n; i++) { S.x[i] = S.tx[i]; S.turn[i] = S.tturn[i]; S.vx[i] = S.vturn[i] = S.swing[i] = S.vswing[i] = 0; paint(i); } return; }
      if (!S.raf) { S.last = 0; S.raf = requestAnimationFrame(step); }
    }
    function impulse(i, amt) { if (reduce || i < 0 || i >= n) return; S.vswing[i] += amt; kick(); }

    function apply() {
      if (!size.width) return;
      var front = size.carousel ? (active != null ? active : carIndex) : active;
      var xs = targets(front), fresh = S.x.length !== n;
      for (var i = 0; i < n; i++) {
        S.tx[i] = xs[i] + (size.carousel ? P.swipe : 0);
        S.tturn[i] = i === front ? 0 : REST;
        if (fresh) { S.x[i] = S.tx[i]; S.vx[i] = 0; S.turn[i] = S.tturn[i]; S.vturn[i] = 0; S.swing[i] = 0; S.vswing[i] = 0; }
      }
      kick();
    }

    function refresh() {
      var now = active != null ? items[active] : null;
      capTitle.textContent = now ? now.name : (opt.caption || '');
      capSub.textContent = now && now.pitch ? now.pitch : '';
      var cur = size.carousel ? (active != null ? active : carIndex) : active;
      slots.forEach(function (s, i) {
        var on = active === i;
        s.setAttribute('aria-pressed', on ? 'true' : 'false');
        s.style.zIndex = on ? 30 : 10 + i;
        s.tabIndex = i === (active != null ? active : focusIndex) ? 0 : -1;
        dotEls[i].setAttribute('aria-current', cur === i ? 'true' : 'false');
      });
    }

    function choose(index) {
      if (active === index) return;
      if (index != null) { impulse(index - 1, -30); impulse(index + 1, 30); carIndex = index; }
      if (active != null && active !== index) { impulse(active - 1, 14); impulse(active + 1, -14); }
      active = index; refresh(); apply();
    }

    /* ---------- autoplay ---------- */
    var autoT = 0;
    function stopAuto() { playing = false; clearTimeout(autoT); }
    function tick() {
      clearTimeout(autoT);
      if (!playing || reduce || !visible || openIdx != null || !size.width) return;
      autoT = setTimeout(function () { if (!playing || !visible || openIdx != null) return; choose(active == null ? 0 : (active + 1) % n); tick(); }, active == null ? 1100 : interval);
    }
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) tick(); else clearTimeout(autoT); }).observe(root);

    /* ---------- pointer ---------- */
    function nearest(cx, cy) {
      var box = stage.getBoundingClientRect(), x = cx - box.left, y = cy - box.top;
      if (y < 0 || y > size.h + 46) return null;
      var best = null, dist = Infinity;
      for (var i = 0; i < n; i++) {
        var half = footprint(size.h, S.turn[i]) / 2 + 4, d = Math.abs(x - S.x[i]);
        if (d < half && d < dist) { best = i; dist = d; }
      }
      return best;
    }

    stage.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      var hit = nearest(e.clientX, e.clientY), now = performance.now();
      P = { id: e.pointerId, index: hit == null ? -1 : hit, x: e.clientX, y: e.clientY, moved: false, kind: e.pointerType, swipe: 0, lastX: e.clientX, lastT: now, v: 0 };
    });
    stage.addEventListener('pointermove', function (e) {
      var box = stage.getBoundingClientRect(), now = performance.now();
      if (P.id === e.pointerId) {
        var dx = e.clientX - P.x;
        if (!P.moved && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(e.clientY - P.y)) {
          P.moved = true; stopAuto();
          try { stage.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
          if (!size.carousel && P.index >= 0) { S.drag = P.index; S.grab = e.clientX - box.left - S.x[P.index]; }
        }
        if (P.moved) {
          P.v = P.v * 0.6 + ((e.clientX - P.lastX) / Math.max(1, now - P.lastT)) * 0.4; P.lastX = e.clientX; P.lastT = now;
          if (S.drag >= 0) { S.vx[S.drag] = P.v * 1000; S.x[S.drag] = e.clientX - box.left - S.grab; S.free = now + 900; kick(); }
          else if (size.carousel) { P.swipe = dx; var xs = targets(active != null ? active : carIndex); for (var i = 0; i < n; i++) S.tx[i] = xs[i] + dx; kick(); }
        }
        return;
      }
      if (e.pointerType !== 'mouse' || size.carousel || openIdx != null) return;
      var hit = nearest(e.clientX, e.clientY);
      if (active != null && hit !== active) {
        var keep = Math.abs(e.clientX - box.left - S.x[active]) < footprint(size.h, 0) / 2 + 14;
        if (keep && Math.abs(e.clientY - box.top) < size.h + 40) return;
      }
      if (hit != null) { stopAuto(); choose(hit); }
    });
    function finish(e, cancelled) {
      if (P.id !== e.pointerId) return;
      try { if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      var p = P; P = { id: -1, index: -1, x: 0, y: 0, moved: false, kind: '', swipe: 0, lastX: 0, lastT: 0, v: 0 };
      if (S.drag >= 0) { S.drag = -1; S.free = performance.now() + 700; kick(); return; }
      if (p.moved && size.carousel) {
        var dx = e.clientX - p.x, cur = active != null ? active : carIndex;
        var stepBy = Math.abs(dx) > 40 || Math.abs(p.v) > 0.45 ? (dx < 0 ? 1 : -1) : 0;
        choose(clamp(cur + stepBy, 0, n - 1)); apply();
        for (var i = 0; i < n; i++) impulse(i, clamp(-p.v * 22, -30, 30));
        return;
      }
      if (cancelled || p.moved || p.index < 0) return;
      stopAuto();
      if (p.kind !== 'mouse' && active !== p.index) choose(p.index); else open(p.index);
    }
    stage.addEventListener('pointerup', function (e) { finish(e, false); });
    stage.addEventListener('pointercancel', function (e) { finish(e, true); });
    stage.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'mouse' && P.id < 0 && !size.carousel && !stage.querySelector('.prail-slot:focus-visible')) choose(null);
    });
    stage.addEventListener('keydown', function (e) {
      var keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End']; if (keys.indexOf(e.key) < 0) return;
      e.preventDefault(); stopAuto();
      var from = active != null ? active : focusIndex;
      var next = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : clamp(from + (e.key === 'ArrowRight' ? 1 : -1), 0, n - 1);
      focusIndex = next; choose(next); slots[next].focus({ preventScroll: true });
    });
    slots.forEach(function (s, i) {
      s.addEventListener('focus', function () { focusIndex = i; if (P.id < 0) { stopAuto(); choose(i); } });
      s.addEventListener('click', function (e) { if (e.detail === 0) open(i); });
    });

    /* ---------- detail view ---------- */
    var dlg = el('div', 'prail-dlg'); dlg.hidden = true;
    dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'true');
    var titleId = 'prail-t-' + Math.random().toString(36).slice(2, 7); dlg.setAttribute('aria-labelledby', titleId);
    var dim = el('div', 'prail-dim'); dim.setAttribute('aria-hidden', 'true');
    var closeBtn = el('button', 'prail-close', 'Close ✕'); closeBtn.type = 'button';
    var wrap = el('div', 'prail-dwrap'), fig = el('div', 'prail-fig'), spin = el('div', 'prail-spin');
    var front = el('div', 'prail-dface'), back = el('div', 'prail-dface prail-back');
    var fMedia = el('div', 'prail-dmedia'), fMeta = el('div', 'prail-dmeta');
    front.appendChild(fMedia); front.appendChild(fMeta);
    spin.appendChild(front); spin.appendChild(back);
    var figHang = hanger(); fig.appendChild(figHang); fig.appendChild(spin);
    var info = el('div', 'prail-info');
    var count = el('p', 'prail-count'), title = el('h3', '', ''); title.id = titleId;
    var pitch = el('p', 'prail-pitch'), links = el('div', 'prail-links'), flip = el('div', 'prail-flip');
    flip.setAttribute('role', 'group'); flip.setAttribute('aria-label', 'Front or back');
    var bFront = el('button', '', 'Front'), bBack = el('button', '', 'Back');
    bFront.type = bBack.type = 'button'; flip.appendChild(bFront); flip.appendChild(bBack);
    [count, title, pitch, links, flip].forEach(function (c) { info.appendChild(c); });
    wrap.appendChild(fig); wrap.appendChild(info);
    [dim, closeBtn, wrap].forEach(function (c) { dlg.appendChild(c); });
    document.body.appendChild(dlg);

    var A = { value: 0, target: 0, vel: 0, raf: 0, last: 0, dragging: false, sx: 0, sa: 0 }, side = 'front', closing = false, returnTo = -1;
    function spinStep(now) {
      var dt = A.last ? Math.min(0.034, (now - A.last) / 1000) : 1 / 60; A.last = now;
      A.vel += (-90 * (A.value - A.target) - 2 * Math.sqrt(90) * 0.82 * A.vel) * dt; A.value += A.vel * dt;
      spin.style.transform = 'rotateY(' + A.value.toFixed(2) + 'deg)';
      if (Math.abs(A.value - A.target) < 0.05 && Math.abs(A.vel) < 0.05) { A.value = A.target; spin.style.transform = 'rotateY(' + A.value + 'deg)'; A.raf = 0; A.last = 0; return; }
      A.raf = requestAnimationFrame(spinStep);
    }
    function turnTo(s) {
      var base = Math.round(A.value / 360) * 360; A.target = base + (s === 'back' ? 180 : 0);
      if (Math.abs(A.target - A.value) > 180) A.target -= 360 * Math.sign(A.target - A.value);
      side = s; bFront.setAttribute('aria-pressed', s === 'front'); bBack.setAttribute('aria-pressed', s === 'back');
      if (reduce) { A.value = A.target; spin.style.transform = 'rotateY(' + A.value + 'deg)'; return; }
      if (!A.raf) { A.last = 0; A.raf = requestAnimationFrame(spinStep); }
    }
    bFront.addEventListener('click', function () { turnTo('front'); });
    bBack.addEventListener('click', function () { turnTo('back'); });
    fig.addEventListener('pointerdown', function (e) { A.dragging = true; A.sx = e.clientX; A.sa = A.value; cancelAnimationFrame(A.raf); A.raf = 0; A.last = 0; try { fig.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } });
    fig.addEventListener('pointermove', function (e) { if (!A.dragging) return; A.value = clamp(A.sa + (e.clientX - A.sx) * 0.45, A.sa - 220, A.sa + 220); spin.style.transform = 'rotateY(' + A.value.toFixed(2) + 'deg)'; });
    function endDrag() { if (!A.dragging) return; A.dragging = false; var f = ((A.value % 360) + 360) % 360; turnTo(f > 90 && f < 270 ? 'back' : 'front'); }
    fig.addEventListener('pointerup', endDrag); fig.addEventListener('pointercancel', endDrag);

    function fill(i) {
      var it = items[i];
      fMedia.textContent = ''; fMedia.appendChild(cardMedia(it, base));
      fMeta.textContent = ''; fMeta.appendChild(el('b', '', it.name)); if (it.kind) fMeta.appendChild(el('small', '', it.kind));
      back.textContent = ''; back.appendChild(el('h4', '', 'At a glance'));
      var ul = el('ul'); (it.points || []).forEach(function (p) { ul.appendChild(el('li', '', p)); }); back.appendChild(ul);
      if (it.stack) back.appendChild(el('p', 'prail-stack', it.stack));
      count.textContent = pad(i + 1) + ' / ' + pad(n); title.textContent = it.name; pitch.textContent = it.pitch || '';
      links.textContent = '';
      (it.links || []).forEach(function (l) {
        var a = el('a', l.primary ? 'prail-btn primary' : 'prail-btn', l.label + ' →');
        a.href = /^(https?:|#)/.test(l.href) ? l.href : base + l.href;
        if (/^https?:/.test(l.href)) { a.target = '_blank'; a.rel = 'noopener'; }
        links.appendChild(a);
      });
    }

    function open(i) {
      if (openIdx != null) return;
      stopAuto(); choose(i); openIdx = i; returnTo = i; closing = false;
      fill(i); A.value = A.target = 0; A.vel = 0; spin.style.transform = 'rotateY(0deg)'; turnTo('front');
      dlg.hidden = false; document.body.style.overflow = 'hidden';
      requestAnimationFrame(function () { dlg.classList.add('is-in'); closeBtn.focus({ preventScroll: true }); });
      document.addEventListener('keydown', onKey);
    }
    function close() {
      if (openIdx == null || closing) return; closing = true;
      dlg.classList.remove('is-in');
      var done = function () {
        dlg.hidden = true; document.body.style.overflow = ''; openIdx = null; closing = false;
        document.removeEventListener('keydown', onKey);
        cancelAnimationFrame(A.raf); A.raf = 0;
        if (returnTo >= 0) { slots[returnTo].focus({ preventScroll: true }); impulse(returnTo, (returnTo % 2 ? 1 : -1) * 40); }
      };
      if (reduce) done(); else setTimeout(done, 260);
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { if (!dlg.contains(document.activeElement) || document.activeElement === closeBtn || document.activeElement.tagName !== 'A') turnTo(side === 'front' ? 'back' : 'front'); return; }
      if (e.key !== 'Tab') return;
      var c = Array.prototype.filter.call(dlg.querySelectorAll('button, a[href]'), function (x) { return !x.disabled; });
      var first = c[0], last = c[c.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    dim.addEventListener('click', close); closeBtn.addEventListener('click', close);

    /* ---------- go ---------- */
    refresh();
    if (typeof ResizeObserver === 'function') new ResizeObserver(function () { if (measure()) apply(); }).observe(stage);
    else window.addEventListener('resize', function () { if (measure()) apply(); });
    measure(); apply(); refresh();
    if (!reduce) setTimeout(function () { for (var i = 0; i < n; i++) (function (k) { setTimeout(function () { impulse(k, 46 - k * 2.5); }, k * 55); })(i); }, 150);
    tick();
    root._prail = { open: open, choose: choose };
  }

  function auto() {
    var nodes = document.querySelectorAll('[data-project-rail]');
    Array.prototype.forEach.call(nodes, function (root) {
      var tag = root.querySelector('script.prail-data'), items = [];
      try { items = JSON.parse(tag ? tag.textContent : '[]'); } catch (e) { items = []; }
      mount(root, items, { base: root.getAttribute('data-base') || '', label: root.getAttribute('data-label') || 'Projects', caption: root.getAttribute('data-caption') || '' });
    });
  }
  window.ProjectRail = { mount: mount };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else auto();
})();
