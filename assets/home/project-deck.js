/* Project Deck: a scroll-dealt stack of websites, ported to plain JS.
 * Project Deck by Aakash Mehra, via 21st.dev (the original is React with motion/react springs; this is a rewrite
 * with a small critically damped spring and the same maths for the cards). The images and projects here are the owner's own.
 *
 * Markup (see index.html):  <section class="pd" data-deck> <div class="pd-stage"> <article class="pd-card"> ... </article> ... </div> </section>
 * The section is one 100svh of scroll tall per card; the stage is sticky. As you scroll, the next card rises from below
 * leaning back in 3D (rotateX) and out of focus, flattens and sharpens as it lands; the cards beneath sink, dim and lift so
 * their edges show. One spring-smoothed progress value drives every card. Reduced motion: no travel, no blur; each card
 * simply appears in place when its turn comes.
 */
(function () {
  'use strict';
  var ENTER = .72; // share of each card's screen spent arriving; the rest it rests in place
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function Deck(sec) {
    var me = this;
    this.sec = sec; this.stage = sec.querySelector('.pd-stage');
    this.cards = [].slice.call(sec.querySelectorAll('.pd-card'));
    this.count = this.cards.length;
    this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.small = matchMedia('(max-width: 640px)').matches;
    this.target = 0; this.x = 0; this.v = 0; this.visible = false; this.raf = 0; this.last = 0;
    sec.style.setProperty('--pd-n', this.count);
    this.accents = [];
    this.lastTop = -1;
    // ambient glow + card counter HUD on the sticky stage
    if (this.stage && !this.stage.querySelector('.pd-glow')) {
      this.stage.insertAdjacentHTML('afterbegin', '<i class="pd-glow" aria-hidden="true"></i>');
      this.stage.insertAdjacentHTML('beforeend', '<div class="pd-count" aria-hidden="true"><b class="pd-now">01</b><span>/ ' + String(this.count).padStart(2, '0') + '</span><i class="pd-bar"></i></div>');
    }
    this.nowEl = this.stage ? this.stage.querySelector('.pd-now') : null;
    this.barEl = this.stage ? this.stage.querySelector('.pd-bar') : null;
    this.cards.forEach(function (c, i) {
      c.style.zIndex = i + 1;
      c.dim = c.querySelector('.pd-dim');
      me.accents.push((c.style.getPropertyValue('--pd-accent') || '').trim() || '#1559c9');
      var vis = c.querySelector('.pd-visit');
      if (vis && !vis.querySelector('.pd-corner')) {
        var R = 18, svg = '<svg class="pd-corner" aria-hidden="true" width="' + R + '" height="' + R + '" viewBox="0 0 ' + R + ' ' + R + '"><path d="M' + R + ' 0V' + R + 'H0A' + R + ' ' + R + ' 0 0 0 ' + R + ' 0Z" fill="currentColor"/></svg>';
        vis.insertAdjacentHTML('afterbegin', '<span class="pd-c1">' + svg + '</span><span class="pd-c2">' + svg + '</span>');
      }
      var sbtn = c.querySelector('.pd-spec-btn'), spnl = c.querySelector('.pd-spec');
      if (sbtn && spnl) {
        sbtn.addEventListener('click', function () {
          var open = !c.classList.contains('spec-open');
          c.classList.toggle('spec-open', open);
          sbtn.setAttribute('aria-expanded', open ? 'true' : 'false');
          spnl.setAttribute('aria-hidden', open ? 'false' : 'true');
          if (window.SFX && window.SFX.tick) window.SFX.tick();
        });
      }
    });
    new IntersectionObserver(function (en) { me.visible = en[0].isIntersecting; if (me.visible) { me.read(); me.kick(); } }, { rootMargin: '30% 0px' }).observe(sec);
    if (window.ScrollBus) window.ScrollBus.read(function () { me.read(); return function () { me.kick(); }; });
    else addEventListener('scroll', function () { me.read(); me.kick(); }, { passive: true });
    addEventListener('resize', function () { me.small = matchMedia('(max-width: 640px)').matches; me.read(); me.kick(); });
    this._loop = function (t) { me.frame(t); };
    this.read(); this.x = this.target; this.apply(this.x);
  }
  Deck.prototype.read = function () {
    var r = this.sec.getBoundingClientRect(), span = Math.max(1, r.height - innerHeight);
    this.target = clamp01(-r.top / span);
  };
  Deck.prototype.kick = function () { if (!this.raf) { this.last = 0; this.raf = requestAnimationFrame(this._loop); } };
  Deck.prototype.frame = function (t) {
    this.raf = 0;
    var dt = this.last ? Math.min(.05, (t - this.last) / 1000) : .016; this.last = t;
    if (this.reduce) { this.x = this.target; this.v = 0; }
    else { // critically damped (about the same feel as stiffness 380, damping 48, mass .35)
      var o = 2 / .12, x = o * dt, e = 1 / (1 + x + .48 * x * x + .235 * x * x * x), ch = this.x - this.target, tmp = (this.v + o * ch) * dt;
      this.v = (this.v - o * tmp) * e; this.x = this.target + (ch + tmp) * e;
    }
    this.apply(this.x);
    if (this.visible && (Math.abs(this.x - this.target) > 2e-5 || Math.abs(this.v) > 2e-4)) this.raf = requestAnimationFrame(this._loop);
  };
  Deck.prototype.arrived = function (j, v) {
    if (j <= 0) return 1;
    var span = Math.max(1, this.count - 1);
    return easeOut(clamp01((v * span - (j - 1)) / ENTER));
  };
  Deck.prototype.apply = function (v) {
    var n = this.count, i, j, c, topIdx = 0;
    for (i = 0; i < n; i++) {
      c = this.cards[i];
      var arr = this.arrived(i, v), above = 0;
      for (j = i + 1; j < n; j++) above += this.arrived(j, v);
      if (arr >= .5) topIdx = i;
      above = Math.min(3, above);
      if (this.reduce) {
        c.style.transform = 'translate3d(0,' + (arr >= .5 ? 0 : 110) + 'svh,0)';
        if (c.dim) c.dim.style.opacity = 0;
        c.classList.toggle('pd-top', arr >= .5 && above < .5);
        continue;
      }
      var y = (1 - arr) * 108 - above * 5, rx = -(1 - arr) * 30 + above * 5, sc = .9 + .1 * arr - above * .05;
      c.style.transform = 'translate3d(0,' + y.toFixed(3) + 'svh,0) rotateX(' + rx.toFixed(3) + 'deg) scale(' + sc.toFixed(4) + ')';
      if (c.dim) c.dim.style.opacity = Math.min(.62, (1 - arr) * .35 + above * .18).toFixed(3);
      var isTop = arr > .98 && above < .02;
      c.classList.toggle('pd-top', isTop);
      if (!isTop && c.classList.contains('spec-open')) {
        c.classList.remove('spec-open');
        var sb = c.querySelector('.pd-spec-btn'), sp = c.querySelector('.pd-spec');
        if (sb) sb.setAttribute('aria-expanded', 'false');
        if (sp) sp.setAttribute('aria-hidden', 'true');
      }
    }
    if (topIdx !== this.lastTop) {
      this.lastTop = topIdx;
      var col = this.accents[topIdx] || '#1559c9';
      if (this.stage) this.stage.style.setProperty('--pd-active', col);
      if (this.nowEl) this.nowEl.textContent = String(topIdx + 1).padStart(2, '0');
    }
    if (this.barEl) this.barEl.style.transform = 'scaleX(' + ((topIdx + 1) / Math.max(1, n)).toFixed(4) + ')';
  };
  window.ProjectDeck = Deck;
  document.addEventListener('DOMContentLoaded', function () { [].forEach.call(document.querySelectorAll('[data-deck]'), function (s) { if (!s.__deck) s.__deck = new Deck(s); }); });
  if (document.readyState !== 'loading') [].forEach.call(document.querySelectorAll('[data-deck]'), function (s) { if (!s.__deck) s.__deck = new Deck(s); });
})();
