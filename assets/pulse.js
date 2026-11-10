var PULSE_BASE=(document.currentScript&&document.currentScript.src||'').replace(/[^\/]*$/,'')||'assets/';
/* Pulse: status board, 17-week activity map and a live GitHub feed.
   Static snapshot comes from assets/pulse-data.json; the live feed is a public-events call that falls back silently. */
(function () {
  var root = document.getElementById('pulse'); if (!root) return;
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function fmt(iso) { var p = iso.split('-'); return +p[2] + ' ' + MON[+p[1] - 1]; }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }

  function counters() {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return; io.unobserve(en.target);
        var n = en.target, to = +n.dataset.to; if (calm) { n.textContent = to; return; }
        var t0 = performance.now();
        (function f(t) { var k = Math.min(1, (t - t0) / 900); n.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(f); })(t0);
      });
    }, { threshold: .6 });
    root.querySelectorAll('[data-to]').forEach(function (n) { io.observe(n); });
  }

  function heat(rows) {
    var host = document.getElementById('pl-heat'); if (!host) return;
    var max = Math.max.apply(null, rows.map(function (r) { return r[1]; })), total = 0;
    var lvl = function (c) { if (!c) return 0; var q = c / max; return q > .5 ? 4 : q > .2 ? 3 : q > .06 ? 2 : 1; };
    var first = new Date(rows[0][0] + 'T00:00:00'), pad = (first.getDay() + 6) % 7;
    for (var i = 0; i < pad; i++) host.appendChild(el('i', 'h-pad'));
    rows.forEach(function (r, i) {
      var c = el('i', 'h-c l' + lvl(r[1])); total += r[1];
      c.style.setProperty('--i', Math.floor((i + pad) / 7)); c.title = fmt(r[0]) + ': ' + r[1] + ' commit' + (r[1] === 1 ? '' : 's');
      host.appendChild(c);
    });
    var t = document.getElementById('pl-heat-total'); if (t) t.textContent = total;
  }

  function list(host, items) {
    host.textContent = '';
    items.forEach(function (it) {
      var li = el('li', 'pl-item');
      li.appendChild(el('span', 'pl-when', it.when));
      var b = el('div', 'pl-txt'); b.appendChild(el('b', null, it.repo)); b.appendChild(el('span', null, it.msg)); li.appendChild(b);
      host.appendChild(li);
    });
  }
  function ago(ts) {
    var s = (Date.now() - new Date(ts)) / 1000;
    return s < 3600 ? Math.max(1, Math.round(s / 60)) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : s < 604800 ? Math.round(s / 86400) + ' d ago' : fmt(ts.slice(0, 10));
  }

  var feed = document.getElementById('pl-feed'), tag = document.getElementById('pl-src');
  function snapshot(d) {
    list(feed, d.recent.map(function (r) { return { when: fmt(r[0]), repo: r[1], msg: r[2] }; }));
    if (tag) { tag.textContent = 'Snapshot · ' + fmt(d.updated); tag.className = 'pill'; }
  }
  function live(d) {
    var KEY = 'pl-ev', cached; try { cached = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) {}
    var go = function (ev) {
      var out = [];
      ev.forEach(function (e) {
        var repo = e.repo.name.split('/')[1];
        if (e.type === 'PushEvent' && e.payload.commits && e.payload.commits.length) {
          var m = e.payload.commits[e.payload.commits.length - 1].message.split('\n')[0];
          if (/^(Merge|Revert)/.test(m)) return;
          out.push({ when: ago(e.created_at), repo: repo, msg: m.slice(0, 110) });
        } else if (e.type === 'PullRequestEvent' && e.payload.action === 'opened') {
          out.push({ when: ago(e.created_at), repo: repo, msg: 'Opened PR: ' + e.payload.pull_request.title.slice(0, 100) });
        }
      });
      if (!out.length) return snapshot(d);
      list(feed, out.slice(0, 10));
      if (tag) { tag.textContent = 'Live from GitHub'; tag.className = 'pill live'; }
    };
    if (cached && Date.now() - cached.t < 600000) return go(cached.ev);
    fetch('https://api.github.com/users/7YMERA/events/public?per_page=40', { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (ev) { try { sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), ev: ev })); } catch (e) {} go(ev); })
      .catch(function () {});
  }

  fetch(PULSE_BASE+'pulse-data.json?v=20261108b').then(function (r) { return r.json(); }).then(function (d) {
    heat(d.heat); snapshot(d); live(d);
  }).catch(function () { if (feed) feed.appendChild(el('li', 'pl-item', 'Activity is unavailable right now.')); });
  counters();
})();
