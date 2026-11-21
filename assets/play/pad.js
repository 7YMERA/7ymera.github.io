/* pad.js: game controller support for /play/. It turns a gamepad into the keyboard events the games already understand,
   so every game works with a pad without knowing about it.
     A (0)            Space (jump, drop, confirm). If nothing took the key and a button has focus, that button is clicked.
     B (1)            Escape (close the stage)
     Start (9)        P (pause), or in the hall: open Skyline Stack
     D-pad, left stick Arrow keys, with key repeat
   Polling runs only while a pad is connected and the tab is visible. Nothing happens without a pad. */
(function () {
  'use strict';
  var d = document, pads = 0, raf = 0, held = {}, nextAt = {}, chip = d.getElementById('pad-chip');
  function key(k, type) {
    var ev = new KeyboardEvent(type || 'keydown', { key: k, code: k === ' ' ? 'Space' : k, bubbles: true, cancelable: true });
    (d.body || d).dispatchEvent(ev); return ev;
  }
  function press(name) {
    if (name === 'A') {
      var ev = key(' ');
      if (!ev.defaultPrevented) { var a = d.activeElement; if (a && a !== d.body && a.click && /^(BUTTON|A)$/.test(a.tagName)) a.click(); }
      key(' ', 'keyup');
    } else if (name === 'B') key('Escape');
    else if (name === 'Start') { var ev2 = key('p'); if (!ev2.defaultPrevented) d.dispatchEvent(new CustomEvent('play-pad-start')); key('p', 'keyup'); }
    else key(name);
  }
  function tick(now) {
    raf = 0; if (!pads || d.hidden) return;
    var gp = navigator.getGamepads ? navigator.getGamepads() : [], g = null;
    for (var i = 0; i < gp.length; i++) if (gp[i] && gp[i].connected) { g = gp[i]; break; }
    if (g) {
      var b = g.buttons, ax = g.axes, st = {
        A: b[0] && b[0].pressed, B: b[1] && b[1].pressed, Start: b[9] && b[9].pressed,
        ArrowUp: (b[12] && b[12].pressed) || ax[1] < -.55, ArrowDown: (b[13] && b[13].pressed) || ax[1] > .55,
        ArrowLeft: (b[14] && b[14].pressed) || ax[0] < -.55, ArrowRight: (b[15] && b[15].pressed) || ax[0] > .55
      };
      Object.keys(st).forEach(function (n) {
        if (st[n]) {
          if (!held[n]) { held[n] = true; nextAt[n] = now + 360; press(n); }
          else if (/^Arrow/.test(n) && now >= nextAt[n]) { nextAt[n] = now + 130; press(n); }
        } else held[n] = false;
      });
    }
    raf = requestAnimationFrame(tick);
  }
  function wake() { if (!raf && pads) raf = requestAnimationFrame(tick); }
  addEventListener('gamepadconnected', function () { pads++; if (chip) chip.hidden = false; d.documentElement.classList.add('has-pad'); wake(); });
  addEventListener('gamepaddisconnected', function () { pads = Math.max(0, pads - 1); if (!pads) { if (chip) chip.hidden = true; d.documentElement.classList.remove('has-pad'); } });
  d.addEventListener('visibilitychange', function () { if (!d.hidden) wake(); });
  // a pad that was already plugged in shows up on the first press, with no event in some browsers
  if (navigator.getGamepads) { var p0 = navigator.getGamepads(); for (var i = 0; i < p0.length; i++) if (p0[i]) { pads++; if (chip) chip.hidden = false; d.documentElement.classList.add('has-pad'); } wake(); }
  window.__pad = { press: press };
})();
