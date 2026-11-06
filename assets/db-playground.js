/* SQL playground: loads the company database into SQLite running in the
 * browser (sql.js), so visitors can run the original queries or their own.
 * Nothing leaves the page, and changes vanish on reload. */
(function () {
  var root = document.getElementById('dbp'); if (!root) return;
  var CDN = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/';
  var editor = root.querySelector('#dbp-sql'), out = root.querySelector('#dbp-out');
  var status = root.querySelector('#dbp-status'), run = root.querySelector('#dbp-run');
  var db = null;

  function say(t, bad) { status.textContent = t; status.classList.toggle('bad', !!bad); }
  function esc(v) { return String(v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function show(res, ms) {
    if (!res.length) { out.innerHTML = '<p class="dbp-empty">Done. That statement doesn\'t return rows.</p>'; say('Ran in ' + ms + ' ms'); return; }
    var r = res[res.length - 1], cap = 200, rows = r.values.slice(0, cap);
    var h = '<div class="dbp-table"><table><thead><tr>' + r.columns.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
    h += rows.map(function (row) { return '<tr>' + row.map(function (v) { return '<td>' + (v === null ? '<i>null</i>' : esc(v)) + '</td>'; }).join('') + '</tr>'; }).join('');
    out.innerHTML = h + '</tbody></table></div>';
    say(r.values.length + ' row' + (r.values.length === 1 ? '' : 's') + (r.values.length > cap ? ' (showing ' + cap + ')' : '') + ' in ' + ms + ' ms');
  }
  function exec() {
    if (!db) return;
    var t0 = performance.now();
    try { show(db.exec(editor.value), Math.max(1, Math.round(performance.now() - t0))); }
    catch (e) { out.innerHTML = ''; say(e.message, true); }
  }
  function load(sql, go) { editor.value = sql.trim(); if (go) exec(); }

  root.querySelectorAll('[data-q]').forEach(function (b) {
    b.addEventListener('click', function () {
      root.querySelectorAll('[data-q]').forEach(function (x) { x.classList.toggle('on', x === b); });
      var t = document.getElementById(b.dataset.q); load((t.content || t).textContent, true);
    });
  });
  root.querySelectorAll('[data-table]').forEach(function (b) {
    b.addEventListener('click', function () {
      root.querySelectorAll('[data-q]').forEach(function (x) { x.classList.remove('on'); });
      load('SELECT * FROM "' + b.dataset.table + '" LIMIT 20;', true);
    });
  });
  run.addEventListener('click', exec);
  editor.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); exec(); } });

  // Load sql.js and the database only when the playground gets close to view.
  var started = false;
  function start() {
    if (started) return; started = true; say('Loading the database…');
    var s = document.createElement('script'); s.src = CDN + 'sql-wasm.js';
    s.onload = function () {
      Promise.all([
        window.initSqlJs({ locateFile: function (f) { return CDN + f; } }),
        fetch(root.dataset.db).then(function (r) { if (!r.ok) throw new Error('db ' + r.status); return r.arrayBuffer(); })
      ]).then(function (v) {
        db = new v[0].Database(new Uint8Array(v[1]));
        run.disabled = false; root.classList.add('ready');
        var first = root.querySelector('[data-q]'); if (first) first.click(); else say('Ready');
      }).catch(function (e) { say('Couldn\'t load the database: ' + e.message, true); });
    };
    s.onerror = function () { say('Couldn\'t load SQLite. Check your connection and reload.', true); };
    document.head.appendChild(s);
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); start(); } }, { rootMargin: '600px' });
    io.observe(root);
  } else start();
})();
