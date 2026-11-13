/* Reading experience for notes: progress bar, "On this page" contents, click-to-zoom lightbox.
   Plain JS, no dependencies. Does nothing on pages without article.post. Styles: end of site.css. */
(function () {
  'use strict';

  var doc = document;
  var article = doc.querySelector('main article.post');
  if (!article || !doc.querySelector) return;

  var header = doc.querySelector('header.top');
  var root = doc.documentElement;
  var hasIO = 'IntersectionObserver' in window;
  var raf = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function (f) { return setTimeout(f, 16); };

  function make(tag, cls, text) {
    var el = doc.createElement(tag);
    if (cls) el.className = cls;
    if (text) el.textContent = text;
    return el;
  }

  /* Height of the sticky header, shared with the CSS (scroll-margin, bar position, rail offset). */
  function headerHeight() {
    return header ? Math.ceil(header.getBoundingClientRect().bottom) : 0;
  }
  function syncHeaderVar() {
    var h = headerHeight();
    if (h > 0) root.style.setProperty('--reader-top', h + 'px');
    return h;
  }
  syncHeaderVar();

  /* ---------- 1. Reading progress ---------- */
  function initProgress() {
    var bar = make('div', 'rd-progress');
    bar.setAttribute('aria-hidden', 'true');
    var fill = make('div', 'rd-progress-fill');
    bar.appendChild(fill);
    doc.body.appendChild(bar);

    var queued = false, last = -1;
    function update() {
      queued = false;
      var r = article.getBoundingClientRect();
      var span = Math.max(1, r.height - window.innerHeight);
      var p = Math.min(1, Math.max(0, -r.top / span));
      if (p !== last) {
        last = p;
        fill.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      }
    }
    function queue() {
      if (!queued) { queued = true; raf(update); }
    }
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', function () { syncHeaderVar(); queue(); }, { passive: true });
    window.addEventListener('load', queue);
    update();
  }

  /* ---------- 2. Table of contents ---------- */
  function slugify(s) {
    var t = s.toLowerCase().replace(/&/g, ' and ').replace(/['’]/g, '');
    try { t = t.normalize('NFKD').replace(/[̀-ͯ]/g, ''); } catch (e) { /* old browsers */ }
    return t.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
  }

  function initToc() {
    var heads = Array.prototype.filter.call(article.querySelectorAll('h2'), function (h) {
      return !h.closest('[hidden], dialog, details') && h.textContent.trim();
    });
    if (heads.length < 3) return;

    var used = {};
    Array.prototype.forEach.call(doc.querySelectorAll('[id]'), function (el) { used[el.id] = true; });
    heads.forEach(function (h, i) {
      if (h.id) return;
      var base = slugify(h.textContent) || 'section-' + (i + 1), id = base, n = 2;
      while (used[id]) id = base + '-' + n++;
      used[id] = true;
      h.id = id;
    });

    var rail = make('div', 'toc-rail');
    var nav = make('nav', 'toc');
    nav.setAttribute('aria-label', 'On this page');
    var details = make('details', 'toc-box');
    var summary = make('summary', 'toc-title', 'On this page');
    var list = make('ol', 'toc-list');
    var links = heads.map(function (h) {
      var li = make('li'), a = make('a', '', h.textContent.trim());
      a.href = '#' + h.id;
      li.appendChild(a);
      list.appendChild(li);
      return a;
    });
    details.appendChild(summary);
    details.appendChild(list);
    nav.appendChild(details);
    rail.appendChild(nav);
    var head = article.querySelector('.post-head');
    if (head && head.parentNode === article) head.insertAdjacentElement('afterend', rail);
    else article.insertBefore(rail, article.firstChild);

    /* Wide screens: always open, the title is a plain label. Narrow: native disclosure, closed. */
    var wide = window.matchMedia ? window.matchMedia('(min-width: 1180px)') : null;
    function layout() {
      var isWide = !!(wide && wide.matches);
      details.open = isWide;
      details.classList.toggle('is-wide', isWide);
      if (isWide) summary.setAttribute('tabindex', '-1'); else summary.removeAttribute('tabindex');
    }
    summary.addEventListener('click', function (e) { if (details.classList.contains('is-wide')) e.preventDefault(); });
    if (wide) {
      if (wide.addEventListener) wide.addEventListener('change', layout); else if (wide.addListener) wide.addListener(layout);
    }
    layout();

    list.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a');
      if (a && !details.classList.contains('is-wide')) details.open = false;
    });

    /* Current section: the heading nearest above the reading line. */
    if (hasIO) {
      var state = heads.map(function () { return 'below'; });
      var current = -2, io = null, ioTop = -1;
      var setCurrent = function () {
        var idx = state.indexOf('in');
        if (idx < 0) {
          var firstBelow = state.indexOf('below');
          idx = firstBelow < 0 ? heads.length - 1 : firstBelow - 1;
        }
        if (idx === current) return;
        current = idx;
        links.forEach(function (a, i) {
          if (i === idx) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
      };
      var observe = function () {
        var top = headerHeight() + 8;
        if (io && top === ioTop) return;
        if (io) io.disconnect();
        ioTop = top;
        io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            var i = heads.indexOf(en.target);
            if (i < 0) return;
            if (en.isIntersecting) state[i] = 'in';
            else state[i] = en.boundingClientRect.top < (en.rootBounds ? en.rootBounds.top : top) ? 'above' : 'below';
          });
          setCurrent();
        }, { rootMargin: '-' + top + 'px 0px -60% 0px', threshold: 0 });
        heads.forEach(function (h) { io.observe(h); });
      };
      observe();
      window.addEventListener('resize', function () { raf(observe); }, { passive: true });
    }

    /* A hash in the URL: ids were created after parsing, so land on the heading ourselves. */
    /* Pictures and widgets above the heading may still be loading and push it down. For a few
       seconds after we jump to it, keep it in place, unless the reader has scrolled themselves. */
    var pinned = null, pinUntil = 0, userMoved = false;
    ['wheel', 'touchmove', 'keydown', 'mousedown'].forEach(function (t) {
      window.addEventListener(t, function () { userMoved = true; }, { passive: true });
    });
    function align() {
      if (!pinned) return;
      var prev = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      pinned.scrollIntoView();
      root.style.scrollBehavior = prev;
    }
    function pin(target, jump) {
      pinned = target; pinUntil = Date.now() + 3000; userMoved = false;
      if (jump) align();
    }
    function targetOfHash() {
      if (!location.hash || location.hash.length < 2) return null;
      var id;
      try { id = decodeURIComponent(location.hash.slice(1)); } catch (e) { return null; }
      var t = doc.getElementById(id);
      return t && article.contains(t) ? t : null;
    }
    if (window.ResizeObserver) {
      new ResizeObserver(function () { if (pinned && !userMoved && Date.now() < pinUntil) align(); }).observe(article);
    }
    list.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a');
      if (a) pin(doc.getElementById(a.hash.slice(1)), false);
    });
    window.addEventListener('hashchange', function () { var t = targetOfHash(); if (t) pin(t, false); });
    var first = targetOfHash();
    if (first) {
      pin(first, true);
      window.addEventListener('load', function () { if (!userMoved) align(); });
    }
  }

  /* ---------- 3. Click to zoom ---------- */
  var IMG_URL = /\.(webp|png|jpe?g|gif|avif|svg)(\?.*)?$/i;
  /* Anything with its own click behaviour keeps it. */
  var SKIP = '.ba, .dbp, .ja, .stream, .try-cta, .map-scroll, .tour, button, summary, [role="button"], [role="slider"], [contenteditable], [aria-hidden="true"], [hidden]';

  function initZoom() {
    if (!doc.createElement('dialog').showModal) return;
    if (doc.getElementById('shot')) return; /* slb-screens: the screen tour has its own viewer */

    var items = [];
    var imgs = article.querySelectorAll('img');

    Array.prototype.forEach.call(imgs, function (img) {
      if (img.closest(SKIP) || img.closest('.post-head')) return;
      var alt = (img.getAttribute('alt') || '').trim();
      if (!alt && !img.closest('figure')) return;
      var fig = img.closest('figure');
      var link = img.closest('a');
      var full = '', opener = img;
      if (link) {
        var href = link.getAttribute('href') || '';
        if (!IMG_URL.test(href) || link.closest(SKIP)) return; /* an ordinary link around a picture: leave it */
        full = link.href;
        opener = link;
      }
      var item = { img: img, opener: opener, full: full, fig: fig, alt: alt };
      items.push(item);

      if (link) {
        link.setAttribute('aria-haspopup', 'dialog');
        link.setAttribute('data-zoom', '');
        link.addEventListener('click', function (e) {
          if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          open(item);
        });
      } else {
        var activate = function () { open(item); };
        var enable = function () {
          img.setAttribute('role', 'button');
          img.setAttribute('tabindex', '0');
          img.setAttribute('aria-haspopup', 'dialog');
          img.setAttribute('data-zoom', '');
          img.addEventListener('click', activate);
          img.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); activate(); }
          });
        };
        if (fig) enable();
        else {
          /* Outside a figure, only worth zooming when it is shown smaller than it really is. */
          var judge = function () { if (img.naturalWidth > img.clientWidth + 8) enable(); };
          if (img.complete) judge(); else img.addEventListener('load', judge, { once: true });
        }
      }
    });
    if (!items.length) return;

    /* Built on first use. */
    var dlg, stage, big, cap, count, fitBtn, prevBtn, nextBtn, closeBtn, index = 0, actual = false, token = 0;

    function build() {
      dlg = make('dialog', 'lb');
      dlg.setAttribute('aria-label', 'Image viewer');

      var bar = make('div', 'lb-bar');
      count = make('span', 'lb-count');
      count.setAttribute('aria-live', 'polite');
      fitBtn = make('button', 'lb-btn lb-fit', 'Actual size');
      fitBtn.type = 'button';
      closeBtn = make('button', 'lb-btn lb-close', 'Close ✕');
      closeBtn.type = 'button';
      closeBtn.setAttribute('aria-label', 'Close image viewer');
      closeBtn.setAttribute('autofocus', '');
      bar.appendChild(count);
      bar.appendChild(fitBtn);
      bar.appendChild(closeBtn);

      stage = make('div', 'lb-stage');
      big = make('img', 'lb-img');
      big.alt = '';
      stage.appendChild(big);

      cap = make('p', 'lb-cap');
      var nav = make('div', 'lb-nav');
      prevBtn = make('button', 'lb-btn lb-prev', '← Previous');
      prevBtn.type = 'button';
      nextBtn = make('button', 'lb-btn lb-next', 'Next →');
      nextBtn.type = 'button';
      nav.appendChild(prevBtn);
      nav.appendChild(cap);
      nav.appendChild(nextBtn);

      dlg.appendChild(bar);
      dlg.appendChild(stage);
      dlg.appendChild(nav);
      doc.body.appendChild(dlg);

      closeBtn.addEventListener('click', function () { dlg.close(); });
      prevBtn.addEventListener('click', function () { go(-1); });
      nextBtn.addEventListener('click', function () { go(1); });
      fitBtn.addEventListener('click', function () { setActual(!actual); });
      /* Click on the dark area (not the picture or a button) closes. */
      dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target === stage) dlg.close(); });
      dlg.addEventListener('close', onClose);
      dlg.addEventListener('keydown', onKey);
    }

    function visible(btn) { return !btn.hidden && !btn.disabled; }

    function onKey(e) {
      if (e.key === 'Tab') {
        /* Keep Tab inside the dialog even where the browser would hop to its own UI. */
        var f = Array.prototype.filter.call(dlg.querySelectorAll('button, [tabindex="0"]'), visible);
        if (!f.length) return;
        var first = f[0], lastEl = f[f.length - 1];
        if (e.shiftKey && (doc.activeElement === first || doc.activeElement === dlg)) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && doc.activeElement === lastEl) { e.preventDefault(); first.focus(); }
        return;
      }
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      /* A focused, horizontally scrolling picture pans with the arrows instead. */
      if (e.target === stage && stage.scrollWidth > stage.clientWidth) return;
      e.preventDefault();
      go(e.key === 'ArrowRight' ? 1 : -1);
    }

    function captionOf(item) {
      var fc = item.fig && item.fig.querySelector('figcaption');
      var text = fc ? fc.textContent.replace(/\s+/g, ' ').trim() : '';
      if (item.fig && item.fig.querySelectorAll('img').length > 1 && item.alt) return text ? item.alt + '. ' + text : item.alt;
      return text || item.alt;
    }

    function setActual(on) {
      actual = on;
      dlg.classList.toggle('is-actual', on);
      fitBtn.textContent = on ? 'Fit to screen' : 'Actual size';
      fitBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      refreshScrollable();
    }

    function refreshScrollable() {
      var can = stage.scrollWidth > stage.clientWidth + 1 || stage.scrollHeight > stage.clientHeight + 1;
      if (can) { stage.setAttribute('tabindex', '0'); stage.setAttribute('aria-label', 'Image, scrollable'); stage.setAttribute('role', 'group'); }
      else { stage.removeAttribute('tabindex'); stage.removeAttribute('aria-label'); stage.removeAttribute('role'); }
    }

    function show(i) {
      index = (i + items.length) % items.length;
      var item = items[index], mine = ++token;
      var src = item.full || item.img.currentSrc || item.img.src;
      actual = false;
      dlg.classList.remove('is-actual');
      fitBtn.textContent = 'Actual size';
      fitBtn.setAttribute('aria-pressed', 'false');
      fitBtn.hidden = true;
      dlg.classList.add('is-loading');
      stage.scrollTop = 0; stage.scrollLeft = 0;
      big.alt = item.alt;
      big.onload = function () {
        if (mine !== token) return;
        dlg.classList.remove('is-loading');
        /* Offer actual size only when the picture is bigger than the space it has. */
        fitBtn.hidden = !(big.naturalWidth > stage.clientWidth + 2 || big.naturalHeight > stage.clientHeight + 2);
        refreshScrollable();
      };
      big.onerror = function () { if (mine === token) dlg.classList.remove('is-loading'); };
      big.src = src;
      cap.textContent = captionOf(item);
      cap.hidden = !cap.textContent;
      count.textContent = (index + 1) + ' / ' + items.length;
      var many = items.length > 1;
      prevBtn.hidden = nextBtn.hidden = !many;
      /* Warm the neighbours. */
      if (many) [1, -1].forEach(function (d) {
        var n = items[(index + d + items.length) % items.length];
        (new Image()).src = n.full || n.img.currentSrc || n.img.src;
      });
    }

    function go(d) { if (items.length > 1) show(index + d); }

    function open(item) {
      if (!dlg) build();
      if (dlg.open) return;
      show(items.indexOf(item));
      dlg.showModal();
      closeBtn.focus();
    }

    function onClose() {
      big.removeAttribute('src');
      token++;
      var opener = items[index].opener;
      if (opener && opener.focus) opener.focus();
    }
  }

  /* ---------- go ---------- */
  var features = [initProgress, initToc, initZoom];
  features.forEach(function (fn) {
    try { fn(); } catch (err) { if (window.console && console.warn) console.warn('reader:', err); }
  });
})();
