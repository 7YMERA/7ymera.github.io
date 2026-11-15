/* Live "skyline log" strip in the opening. Reads skyline.json, which the daily Action in 7YMERA/7YMERA writes.
   The page already contains a snapshot, so a failed fetch just leaves the snapshot in place. */
(function () {
  var box = document.getElementById('cur-sky'); if (!box) return;
  var URL = 'https://raw.githubusercontent.com/7YMERA/7YMERA/main/skyline.json', KEY = 'cs-json', MAX_AGE = 3600000;
  var MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function fmt(iso) { var p = String(iso).split('-'); return +p[2] + ' ' + MON[+p[1] - 1]; }
  function ok(d) { return d && typeof d.metres === 'number' && Array.isArray(d.weeks) && d.weeks.length > 0 && typeof d.line1 === 'string'; }
  function paint(d, live) {
    document.getElementById('cs-m').textContent = d.metres.toLocaleString('en') + ' m';
    document.getElementById('cs-next').textContent = d.line1;
    document.getElementById('cs-src').textContent = (live ? 'Live from GitHub' : 'Snapshot') + ' \u00b7 ' + fmt(d.updated);
    var mx = Math.max.apply(null, d.weeks) || 1, ns = 'http://www.w3.org/2000/svg', svg = document.getElementById('cs-bars');
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    d.weeks.forEach(function (v, i) {
      var h = v ? 3 + v / mx * 27 : 2, r = document.createElementNS(ns, 'rect');
      r.setAttribute('x', i * 5); r.setAttribute('y', (32 - h).toFixed(1)); r.setAttribute('width', 4); r.setAttribute('height', h.toFixed(1)); r.setAttribute('rx', 1);
      if (i === d.weeks.length - 1) r.setAttribute('class', 'cur');
      svg.appendChild(r);
    });
  }
  var cached = null; try { cached = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) {}
  if (cached && ok(cached.d) && Date.now() - cached.t < MAX_AGE) { paint(cached.d, true); return; }
  fetch(URL, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (d) {
    if (!ok(d)) throw 0; paint(d, true); try { sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {}
  }).catch(function () {});
})();
