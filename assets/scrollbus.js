/* ScrollBus: one scroll listener and one pointer-move pump for the whole page.
   Every scroll-linked script used to add its own scroll listener and read its own rect (getBoundingClientRect, offsetTop), so a style write in one
   handler forced the next handler to recompute layout. Here every reader runs first, then every writer, once per scroll event (browsers fire
   scroll once per frame, and doing it inside the event keeps the readers level with the frame; deferring to rAF would put them a frame behind the 3D
   city's own loop).
     ScrollBus.read(fn)   fn() runs in the read phase of each scroll pass. It may return a function, which runs in the write phase.
     ScrollBus.write(fn)  fn() runs in the write phase of each scroll pass.
     ScrollBus.move(fn [, el])  pointermove, coalesced: fn(lastEvent) runs once per animation frame, reads first (it may return a write function),
                          with the last event only. No `el`: pointer anywhere on the page. With `el`: only moves over that element.
     ScrollBus.flush()    run a scroll pass now (a script that scrolls the page by hand calls this).
   Scripts load this first and fall back to their own listeners when it is absent. */
(function () {
  if (window.ScrollBus) return;
  var readers = [], writers = [], movers = [], globals = [], mq = 0, gOn = false, busy = false;

  function flush() {
    if (busy) return; busy = true;
    var w = [], i, r;
    try {
      for (i = 0; i < readers.length; i++) { r = readers[i](); if (typeof r === 'function') w.push(r); }
      for (i = 0; i < w.length; i++) w[i]();
      for (i = 0; i < writers.length; i++) writers[i]();
    } finally { busy = false; }
  }

  function pump() {
    mq = 0;
    var w = [], i, m, e, r;
    for (i = 0; i < movers.length; i++) {
      m = movers[i]; if (!m.ev) continue;
      e = m.ev; m.ev = null; r = m.fn(e); if (typeof r === 'function') w.push(r);
    }
    for (i = 0; i < w.length; i++) w[i]();
  }
  function mark(m, e) { m.ev = e; if (!mq) mq = requestAnimationFrame(pump); }

  function move(fn, el) {
    var m = { fn: fn, ev: null }; movers.push(m);
    if (el) {
      el.addEventListener('pointermove', function (e) { mark(m, e); }, { passive: true });
      el.addEventListener('pointerleave', function () { m.ev = null; }, { passive: true }); // a move still waiting for the frame is dropped, so it cannot undo what the element's own leave handler just reset
    }
    else {
      globals.push(m);
      if (!gOn) { gOn = true; addEventListener('pointermove', function (e) { for (var i = 0; i < globals.length; i++) mark(globals[i], e); }, { passive: true }); }
    }
  }

  addEventListener('scroll', flush, { passive: true });
  window.ScrollBus = {
    read: function (fn) { readers.push(fn); },
    write: function (fn) { writers.push(fn); },
    move: move,
    flush: flush
  };
})();
