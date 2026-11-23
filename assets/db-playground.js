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

  /* Plain-English -> Live SQL Query Builder (reads real tables & columns via sqlite_master + PRAGMA table_info) */
  function mountBuilder() {
    if (!db || root.querySelector('.dbp-ask')) return;
    var tRes = [];
    try { tRes = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"); } catch (e) { return; }
    if (!tRes.length || !tRes[0].values.length) return;
    var tables = tRes[0].values.map(function (r) { return String(r[0]); });

    if (!document.getElementById('dbp-ask-css')) {
      var st = document.createElement('style');
      st.id = 'dbp-ask-css';
      st.textContent =
        '.dbp-ask{margin:12px 0;padding:12px 14px;border-radius:12px;border:1px solid var(--line,rgba(120,150,190,.3));background:color-mix(in srgb,var(--accent,#1559c9) 6%,var(--surface,#fff));display:grid;gap:10px;}' +
        ':root[data-theme="dark"] .dbp-ask{background:rgba(15,32,64,.55);border-color:rgba(127,211,255,.26);}' +
        '.dbp-ask-eye{font:600 11px/1 var(--f-mono,monospace);letter-spacing:.14em;text-transform:uppercase;color:var(--accent,#1559c9);}' +
        ':root[data-theme="dark"] .dbp-ask-eye{color:#ffd27a;}' +
        '.dbp-ask-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px;}' +
        '.dbp-ask select,.dbp-ask input{min-height:42px;padding:6px 10px;border-radius:9px;border:1px solid var(--line,rgba(120,150,190,.35));background:var(--surface,#fff);color:var(--ink,#0f1e24);font:500 .86rem var(--f-body,system-ui);max-width:100%;}' +
        ':root[data-theme="dark"] .dbp-ask select,:root[data-theme="dark"] .dbp-ask input{background:#091428;color:#eaf1ff;border-color:rgba(127,211,255,.32);}' +
        '.dbp-ask-go{min-height:44px;padding:0 16px;border-radius:9px;border:0;background:var(--accent,#1559c9);color:#fff;font:600 .82rem var(--f-mono,monospace);letter-spacing:.05em;text-transform:uppercase;cursor:pointer;}' +
        ':root[data-theme="dark"] .dbp-ask-go{background:#ffd27a;color:#050912;}' +
        '.dbp-ask-go:hover{opacity:.9;}' +
        '.dbp-ask-lbl{font:500 .82rem var(--f-body,system-ui);color:var(--muted,#52636a);}';
      document.head.appendChild(st);
    }

    function qi(id) { return '"' + String(id).replace(/"/g, '""') + '"'; }
    function colsFor(tbl) {
      try {
        var r = db.exec('PRAGMA table_info(' + qi(tbl) + ');');
        if (r.length && r[0].values.length) return r[0].values.map(function (row) { return String(row[1]); });
      } catch (e) {}
      return [];
    }

    var box = document.createElement('div');
    box.className = 'dbp-ask';
    box.setAttribute('aria-label', 'Plain-English SQL query builder');
    box.innerHTML =
      '<span class="dbp-ask-eye">Plain-English → Live SQL Builder (' + tables.length + ' tables)</span>' +
      '<div class="dbp-ask-row">' +
        '<select data-ask="act" aria-label="Query intent">' +
          '<option value="group">Group &amp; count</option>' +
          '<option value="inspect">Show rows from</option>' +
          '<option value="top">Top values in</option>' +
          '<option value="distinct">Unique values in</option>' +
          '<option value="count">Count total rows in</option>' +
        '</select>' +
        '<select data-ask="tbl" aria-label="Database table">' +
          tables.map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + '</option>'; }).join('') +
        '</select>' +
        '<span class="dbp-ask-lbl" data-ask="by-lbl">by</span>' +
        '<select data-ask="col" aria-label="Table column"></select>' +
        '<input type="search" data-ask="flt" placeholder="filter contains… (optional)" aria-label="Optional text filter">' +
        '<select data-ask="lim" aria-label="Row limit">' +
          '<option value="10">limit 10</option>' +
          '<option value="25" selected>limit 25</option>' +
          '<option value="50">limit 50</option>' +
          '<option value="100">limit 100</option>' +
        '</select>' +
        '<button type="button" class="dbp-ask-go" data-ask="go">Build &amp; Run SQL</button>' +
      '</div>';

    var edParent = editor.parentElement;
    if (edParent && edParent.parentElement === root) root.insertBefore(box, edParent);
    else editor.parentElement.insertBefore(box, editor);

    var sAct = box.querySelector('[data-ask="act"]');
    var sTbl = box.querySelector('[data-ask="tbl"]');
    var sCol = box.querySelector('[data-ask="col"]');
    var sBy  = box.querySelector('[data-ask="by-lbl"]');
    var sFlt = box.querySelector('[data-ask="flt"]');
    var sLim = box.querySelector('[data-ask="lim"]');
    var bGo  = box.querySelector('[data-ask="go"]');

    function fillCols() {
      var cols = colsFor(sTbl.value);
      sCol.innerHTML = cols.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join('');
      if (cols.length > 1) sCol.selectedIndex = 1; // often more descriptive than primary ID
    }
    function syncUi() {
      var a = sAct.value;
      var needCol = a !== 'count';
      sCol.hidden = !needCol; sBy.hidden = !needCol;
      sBy.textContent = a === 'group' ? 'grouped by' : a === 'top' ? 'ordered by' : a === 'distinct' ? 'column' : 'sorted by';
      sFlt.hidden = !(a === 'inspect' || a === 'distinct');
      sLim.hidden = a === 'count';
    }
    function buildAndRun() {
      var a = sAct.value, t = sTbl.value, c = sCol.value, lim = parseInt(sLim.value, 10) || 25;
      var flt = (sFlt.value || '').trim().replace(/'/g, "''");
      var sql = '';
      if (a === 'count') {
        sql = '-- Plain English: Count total rows in ' + t + '\nSELECT COUNT(*) AS total_rows\nFROM ' + qi(t) + ';';
      } else if (a === 'group') {
        sql = '-- Plain English: Group ' + t + ' by ' + c + ' and count rows\nSELECT ' + qi(c) + ', COUNT(*) AS rows_count\nFROM ' + qi(t) + '\nGROUP BY ' + qi(c) + '\nORDER BY rows_count DESC\nLIMIT ' + lim + ';';
      } else if (a === 'top') {
        sql = '-- Plain English: Top ' + lim + ' rows in ' + t + ' by highest ' + c + '\nSELECT *\nFROM ' + qi(t) + '\nWHERE ' + qi(c) + ' IS NOT NULL\nORDER BY ' + qi(c) + ' DESC\nLIMIT ' + lim + ';';
      } else if (a === 'distinct') {
        var whD = flt ? '\nWHERE CAST(' + qi(c) + " AS TEXT) LIKE '%" + flt + "%'" : '';
        sql = '-- Plain English: Unique values of ' + c + ' in ' + t + (flt ? ' matching "' + flt + '"' : '') + '\nSELECT DISTINCT ' + qi(c) + '\nFROM ' + qi(t) + whD + '\nORDER BY ' + qi(c) + ' ASC\nLIMIT ' + lim + ';';
      } else {
        var whI = flt ? '\nWHERE CAST(' + qi(c) + " AS TEXT) LIKE '%" + flt + "%'" : '';
        sql = '-- Plain English: Show ' + lim + ' rows from ' + t + (flt ? ' where ' + c + ' contains "' + flt + '"' : ' sorted by ' + c) + '\nSELECT *\nFROM ' + qi(t) + whI + '\nORDER BY ' + qi(c) + ' ASC\nLIMIT ' + lim + ';';
      }
      root.querySelectorAll('[data-q]').forEach(function (x) { x.classList.remove('on'); });
      load(sql, true);
    }

    fillCols(); syncUi();
    sTbl.addEventListener('change', fillCols);
    sAct.addEventListener('change', syncUi);
    bGo.addEventListener('click', buildAndRun);
    sFlt.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); buildAndRun(); } });
  }

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
        mountBuilder();
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
