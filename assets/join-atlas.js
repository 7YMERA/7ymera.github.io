/* Join Atlas (from github.com/7YMERA/database-project-uplift): loads the Jom Al-Quran database into SQLite in the browser (sql.js),
 * reads its foreign keys, draws the 20 main tables with the 36 link tables as the
 * dots between them, and writes the JOINs for any set of tables you pick.
 * Everything is derived from the database itself; only the map positions are fixed. */
(function () {
  'use strict';
  var root = document.getElementById('ja'); if (!root) return;
  var CDN = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/';
  var SVGNS = 'http://www.w3.org/2000/svg';
  var $ = function (id) { return document.getElementById(id); };
  var map = $('ja-map'), sqlBox = $('ja-sql'), runBtn = $('ja-run'), status = $('ja-status'), out = $('ja-out'), route = $('ja-route');

  // Two layouts for the 20 main tables (viewBox 1000 x 660). "tidy" comes from an
  // offline search that minimises crossing links; "eer" follows where each box sits
  // in the team's 2024 EER diagram, nudged apart just enough not to overlap.
  var LAYOUTS = {};
  LAYOUTS.tidy = {
    Social_Media: [85, 45], Digital_Platforms: [255, 45], Schedule: [595, 45],
    Staff: [85, 175], Support: [255, 175], Website: [425, 175], Attendance: [595, 175], Teacher: [765, 175], Student: [915, 175],
    Employee: [85, 330], Salary: [255, 330], Payment: [425, 330], Course: [765, 330], Guardian: [915, 330],
    EmergencyContacts: [85, 485], Transactions: [425, 485], Invoice: [595, 485], Client: [765, 485],
    Location: [425, 615], Bank: [765, 615]
  };
  LAYOUTS.eer = {
    Client: [869, 45], EmergencyContacts: [408, 46], Location: [677, 46],
    Guardian: [747, 159], Digital_Platforms: [128, 163], Student: [915, 163],
    Employee: [596, 272], Social_Media: [85, 276], Website: [253, 276], Invoice: [421, 279],
    Staff: [513, 396], Teacher: [682, 396], Course: [912, 398],
    Support: [126, 482], Transactions: [356, 510], Schedule: [912, 515], Bank: [526, 521],
    Attendance: [824, 611], Payment: [269, 615], Salary: [438, 615]
  };
  var POS = LAYOUTS.tidy;
  // The columns a person would want to see for each table.
  var LABELS = {
    Attendance: ['Att_Date', 'Att_Status'], Bank: ['Bank_Name', 'Bank_Branch'], Client: ['Client_Name'],
    Course: ['C_Selected_Course', 'C_Course_Level'], Digital_Platforms: ['DP_ID', 'DP_Engagements'],
    EmergencyContacts: ['EC_FullName', 'EC_Relationship'], Employee: ['E_FullName', 'E_Jobscope'],
    Guardian: ['G_ID', 'G_Relationship'], Invoice: ['Invoice_ID', 'I_Amount', 'I_Status'], Location: ['L_City', 'L_State'],
    Payment: ['Pay_ID', 'Pay_Approval_Status'], Salary: ['Sal_ID', 'Sal_Current'], Schedule: ['Sch_DayOfWeek', 'Sch_StartTime'],
    Social_Media: ['SM_Platform'], Staff: ['Staff_Position'], Student: ['S_ID', 'S_MasteryLevel'],
    Support: ['Support_Title', 'Support_Status'], Teacher: ['T_ID', 'T_Course'], Transactions: ['Tran_Date', 'Tran_Amount'],
    Website: ['W_URL']
  };
  var PRESETS = [
    { label: 'A guardian’s child’s teacher', pick: ['Guardian', 'Student', 'Teacher', 'Employee'] },
    { label: 'Which bank each client uses', pick: ['Client', 'Bank'] },
    { label: 'Where each teacher lives', pick: ['Employee', 'Teacher', 'Location'] },
    { label: 'Courses and their websites', pick: ['Course', 'Website'] },
    { label: 'Report query 4: when shortest is wrong', pick: ['Student', 'Client', 'Guardian', 'Bank', 'Invoice', 'Transactions', 'Payment', 'Support'], report: 'v_guardian_billing',
      note: 'The shortest route finds nothing. In the 2024 diagram Student and Guardian are both subtypes of Client, so each has its own Client row. Joining them through Client asks for a guardian who is also the student. The report goes through StudentGuardian instead, at the cost of a thirteenth table. A shorter join is a different question, so read the path before trusting the rows.' }
  ];
  var KIND_TEXT = { isa: 'subtype (EER specialisation)', one: 'one-to-one in the data', many1: 'really one-to-many', nm: 'genuinely many-to-many' };

  var RESERVED = { as: 1, at: 1, by: 1, do: 1, if: 1, in: 1, is: 1, no: 1, of: 1, on: 1, or: 1, to: 1 };
  var db = null, T = {}, names = [], adj = {}, edges = [], picked = [], activeNote = null, activeReport = null, drift = null;

  function say(t, bad) { status.textContent = t; status.classList.toggle('bad', !!bad); }
  function esc(v) { return String(v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function q(sql) { var r = db.exec(sql); return r.length ? r[0].values : []; }
  function el(tag, attrs, parent) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  // ---------- read the schema out of the database ----------
  function introspect() {
    names = q("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").map(function (r) { return r[0]; });
    var lower = {}; names.forEach(function (n) { lower[n.toLowerCase()] = n; });
    names.forEach(function (n) {
      var cols = q('PRAGMA table_info("' + n + '")').map(function (r) { return { name: r[1], pk: r[5] > 0 }; });
      var fks = q('PRAGMA foreign_key_list("' + n + '")').map(function (r) { return { col: r[3], parent: lower[r[2].toLowerCase()], pcol: r[4] }; });
      T[n] = { cols: cols, fks: fks, rows: q('SELECT count(*) FROM "' + n + '"')[0][0] };
      T[n].link = cols.length === 2 && fks.length === 2;
      adj[n] = adj[n] || [];
    });
    names.forEach(function (n) {
      T[n].fks.forEach(function (f) {
        adj[n].push({ to: f.parent, mine: f.col, theirs: f.pcol });
        adj[f.parent].push({ to: n, mine: f.pcol, theirs: f.col });
      });
    });
    names.forEach(function (n) {
      var t = T[n];
      if (t.link) {
        var a = t.fks[0], b = t.fks[1];
        var d = q('SELECT count(DISTINCT "' + a.col + '"), count(DISTINCT "' + b.col + '") FROM "' + n + '"')[0];
        t.kind = d[0] === t.rows && d[1] === t.rows ? 'one' : (d[0] === t.rows || d[1] === t.rows ? 'many1' : 'nm');
        edges.push({ a: a.parent, b: b.parent, link: n, kind: t.kind });
      } else {
        t.fks.forEach(function (f) { edges.push({ a: n, b: f.parent, link: null, kind: 'isa' }); });
      }
    });
    names.forEach(function (n) { adj[n].sort(function (x, y) { return x.to < y.to ? -1 : 1; }); });
  }

  // ---------- draw ----------
  var nodeEls = {}, edgeEls = [];
  // Where a line from p towards box centre r meets that box's border (plus a gap),
  // so a subtype arrow ends on the supertype's edge instead of under it.
  function toEdge(p, r) {
    var dx = p[0] - r[0], dy = p[1] - r[1], hw = 84, hh = 31;
    var k = Math.min(hw / Math.abs(dx || 1e-9), hh / Math.abs(dy || 1e-9));
    return [r[0] + dx * k, r[1] + dy * k];
  }
  function drawMap() {
    map.textContent = ''; nodeEls = {}; edgeEls = [];
    var defs = el('defs', {}, map);
    [['ja-ah', 'arrow'], ['ja-ah-hot', 'arrow hot']].forEach(function (m) {
      var mk = el('marker', { id: m[0], viewBox: '0 0 10 10', refX: 9, refY: 5, markerUnits: 'userSpaceOnUse', markerWidth: 14, markerHeight: 14, orient: 'auto-start-reverse' }, defs);
      el('path', { d: 'M0,0 L10,5 L0,10 z', class: m[1] }, mk);
    });
    var gE = el('g', {}, map), gL = el('g', {}, map), gN = el('g', {}, map);
    edges.forEach(function (e) {
      var p = POS[e.a], r = POS[e.b]; if (!p || !r) return;
      var end = e.kind === 'isa' ? toEdge(p, r) : r;
      var line = el('line', { x1: p[0], y1: p[1], x2: end[0], y2: end[1], class: 'e ' + e.kind }, gE);
      if (e.kind === 'isa') el('title', {}, line).textContent = e.a + ' is a ' + e.b + ' (specialisation in the 2024 EER)';
      var rec = { e: e, line: line, dot: null };
      if (e.link) {
        var mx = (p[0] + r[0]) / 2, my = (p[1] + r[1]) / 2;
        var g = el('g', {}, gL);
        rec.dot = el('rect', { x: mx - 5, y: my - 5, width: 10, height: 10, rx: 2, transform: 'rotate(45 ' + mx + ' ' + my + ')', class: 'lk ' + e.kind }, g);
        var hit = el('circle', { cx: mx, cy: my, r: 11, class: 'lk-hit' }, g);
        el('title', {}, hit).textContent = e.link + ' · ' + T[e.link].rows + ' rows · ' + KIND_TEXT[e.kind];
        hit.addEventListener('click', function () { showDetail(e.link); });
      }
      edgeEls.push(rec);
    });
    Object.keys(POS).forEach(function (n) {
      if (!T[n]) return;
      var x = POS[n][0], y = POS[n][1];
      var g = el('g', { class: 'n', tabindex: 0, role: 'button', 'aria-pressed': 'false', 'aria-label': n + ', ' + T[n].rows + ' rows' }, gN);
      el('rect', { x: x - 80, y: y - 27, width: 160, height: 54, rx: 12 }, g);
      el('text', { x: x, y: y - 1, 'text-anchor': 'middle', class: 'nm-t' }, g).textContent = n.replace('_', ' ');
      el('text', { x: x, y: y + 17, 'text-anchor': 'middle', class: 'ct-t' }, g).textContent = T[n].rows + ' rows';
      g.addEventListener('click', function () { toggle(n); });
      g.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(n); } });
      nodeEls[n] = g;
    });
  }

  function draw() {
    drawMap();
    var pk = $('ja-picker'); pk.textContent = '';
    Object.keys(POS).sort().forEach(function (n) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = n; b.dataset.t = n;
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () { toggle(n); });
      pk.appendChild(b);
    });

    var ps = $('ja-presets'); ps.textContent = '';
    PRESETS.forEach(function (p, i) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = p.label; b.dataset.i = i;
      b.addEventListener('click', function () {
        picked = p.pick.slice(); activeNote = p.note || null; activeReport = p.report || null; update(true);
        ps.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
      });
      ps.appendChild(b);
    });

    var links = names.filter(function (n) { return T[n].link; });
    var oneSided = links.filter(function (n) { return T[n].kind !== 'nm'; }).length;
    $('ja-lens-note').textContent = oneSided + ' of ' + links.length + ' link tables have one side unique in the data, so a plain foreign key column would do the same job with one join fewer.' +
      (drift && drift.missing.length ? ' The 2024 report also lists ' + drift.missing.map(function (m) { return m.name; }).join(', ') + ', which was never created.' : '');
  }

  // ---------- routing ----------
  // Grow a tree from the first pick: each further pick joins via the cheapest
  // path from anything already in the tree. Passing through a main table you
  // didn't pick costs a little extra, so link tables are preferred.
  function solve(list) {
    var inTree = {}, tree = [];
    if (!list.length) return { nodes: [], tree: [] };
    inTree[list[0]] = true;
    var sel = {}; list.forEach(function (n) { sel[n] = true; });
    for (var i = 1; i < list.length; i++) {
      var target = list[i]; if (inTree[target]) continue;
      var dist = {}, prev = {}, done = {}, frontier = [];
      Object.keys(inTree).forEach(function (n) { dist[n] = 0; frontier.push(n); });
      while (frontier.length) {
        frontier.sort(function (a, b) { return dist[a] - dist[b] || (a < b ? -1 : 1); });
        var u = frontier.shift(); if (done[u]) continue; done[u] = true;
        if (u === target) break;
        adj[u].forEach(function (ed) {
          var v = ed.to, w = 1 + (!T[v].link && !sel[v] ? 0.25 : 0);
          if (dist[v] === undefined || dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = { from: u, ed: ed }; frontier.push(v); }
        });
      }
      if (!done[target]) return null;
      var v = target;
      while (!inTree[v]) { var p = prev[v]; tree.push({ from: p.from, to: v, ed: p.ed }); inTree[v] = true; v = p.from; }
    }
    return { nodes: Object.keys(inTree), tree: tree };
  }

  function aliasFor(name, used) {
    var parts = name.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').split(' ');
    var a = parts.map(function (p) { return p[0].toLowerCase(); }).join('');
    if (a.length === 1) a = name.slice(0, 2).toLowerCase();
    if (RESERVED[a]) a = name.slice(0, 3).toLowerCase();
    var base = a, k = 2; while (used[a] || RESERVED[a]) a = base + k++;
    used[a] = true; return a;
  }

  function buildSql(list, sol) {
    var used = {}, alias = {}, start = list[0];
    alias[start] = aliasFor(start, used);
    var children = {}; sol.tree.forEach(function (t) { (children[t.from] = children[t.from] || []).push(t); (children[t.to] = children[t.to] || []).push({ from: t.to, to: t.from, ed: { to: t.from, mine: t.ed.theirs, theirs: t.ed.mine } }); });
    var order = [], seen = {}, queue = [start]; seen[start] = true;
    var joins = [];
    while (queue.length) {
      var u = queue.shift(); order.push(u);
      (children[u] || []).forEach(function (t) {
        if (seen[t.to]) return; seen[t.to] = true; queue.push(t.to);
        alias[t.to] = aliasFor(t.to, used);
        joins.push({ table: t.to, on: alias[t.to] + '.' + t.ed.theirs + ' = ' + alias[u] + '.' + t.ed.mine });
      });
    }
    var cols = [];
    list.forEach(function (n) {
      var have = T[n].cols.map(function (c) { return c.name; });
      (LABELS[n] || have.slice(0, 2)).forEach(function (c) { if (have.indexOf(c) >= 0) cols.push(alias[n] + '.' + c); });
    });
    var w = Math.max.apply(null, [start].concat(joins.map(function (j) { return j.table; })).map(function (n) { return n.length + alias[n].length; })) + 2;
    var pad = function (n) { var s = n + ' ' + alias[n]; while (s.length < w) s += ' '; return s; };
    var s = 'SELECT DISTINCT\n  ' + cols.join(',\n  ') + '\nFROM ' + pad(start).trimEnd();
    joins.forEach(function (j) { s += '\nJOIN ' + pad(j.table) + 'ON ' + j.on; });
    s += '\nORDER BY 1\nLIMIT 200;';
    return { sql: s, order: order, joins: joins.length };
  }

  // ---------- state ----------
  function toggle(n) {
    var i = picked.indexOf(n);
    if (i >= 0) picked.splice(i, 1); else picked.push(n);
    activeNote = null; activeReport = null;
    $('ja-presets').querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); });
    update(true);
  }

  function update(go) {
    var sol = solve(picked);
    var hotNodes = {}, hotPairs = {};
    if (sol) sol.tree.forEach(function (t) {
      hotNodes[t.from] = hotNodes[t.to] = true;
      hotPairs[t.from + '|' + t.to] = hotPairs[t.to + '|' + t.from] = true;
    });
    map.classList.toggle('routing', picked.length > 1);
    Object.keys(nodeEls).forEach(function (n) {
      var on = picked.indexOf(n) >= 0;
      nodeEls[n].classList.toggle('sel', on);
      nodeEls[n].classList.toggle('via', !on && !!hotNodes[n]);
      nodeEls[n].setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    $('ja-picker').querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', picked.indexOf(b.dataset.t) >= 0 ? 'true' : 'false'); });
    edgeEls.forEach(function (r) {
      var e = r.e, hot = e.link ? (hotPairs[e.a + '|' + e.link] && hotPairs[e.link + '|' + e.b]) : hotPairs[e.a + '|' + e.b];
      r.line.classList.toggle('hot', !!hot); if (r.dot) r.dot.classList.toggle('hot', !!hot);
    });

    if (!picked.length) {
      route.innerHTML = '<p class="hint">Tap two or more tables on the map, or try one of the questions above it.</p>';
      sqlBox.value = '-- Pick tables on the map and the JOINs appear here.'; out.textContent = ''; say('Ready'); return;
    }
    if (picked.length === 1) { showDetail(picked[0], true); if (go) exec(); return; }
    if (!sol) { route.innerHTML = '<p class="note">No route connects those tables.</p>'; return; }

    var built = buildSql(picked, sol);
    var linkCount = built.order.filter(function (n) { return T[n].link; }).length;
    var h = '<div class="ja-chips">' + picked.map(function (n) { return '<span class="ja-chip">' + esc(n) + '<button type="button" data-x="' + esc(n) + '" aria-label="Remove ' + esc(n) + '">×</button></span>'; }).join('') +
      '<button type="button" class="clear" id="ja-clear">Clear</button></div>';
    h += '<p class="path">' + describe(sol) + '</p>';
    h += '<div class="stats"><span><strong>' + built.order.length + '</strong> tables</span><span><strong>' + built.joins + '</strong> joins</span><span><strong>' + linkCount + '</strong> of them link tables</span></div>';
    if (activeNote) h += '<p class="note">' + esc(activeNote) + (activeReport ? ' <button type="button" class="clear" id="ja-report">Run the report’s version</button>' : '') + '</p>';
    var nameless = picked.filter(function (n) { return n === 'Teacher' || n === 'Guardian'; }).filter(function (n) { return picked.indexOf(n === 'Teacher' ? 'Employee' : 'Client') < 0; });
    if (nameless.length) h += '<p class="note">' + nameless.map(function (n) { var sup = n === 'Teacher' ? 'Employee' : 'Client'; return esc(n) + ' is a subtype of ' + sup + ', so its name lives on ' + sup + '.'; }).join(' ') + ' Add ' + nameless.map(function (n) { return n === 'Teacher' ? 'Employee' : 'Client'; }).join(' and ') + ' to see who they are.</p>';
    route.innerHTML = h;
    wireRoute();
    sqlBox.value = built.sql;
    if (go) exec();
  }

  // Readable route: walk the tree from the first pick, collapsing each link
  // table into a small "via" label between two main tables.
  function describe(sol) {
    var nb = {}; sol.tree.forEach(function (t) { (nb[t.from] = nb[t.from] || []).push(t.to); (nb[t.to] = nb[t.to] || []).push(t.from); });
    var parts = [], seen = {};
    (function walk(u, depth) {
      seen[u] = true;
      (nb[u] || []).forEach(function (v) {
        if (seen[v]) return;
        var via = '';
        if (T[v].link) { seen[v] = true; via = v; var w = (nb[v] || []).filter(function (x) { return !seen[x]; })[0]; if (!w) return; v = w; }
        if (!via) { var isa = edges.filter(function (e) { return e.kind === 'isa' && ((e.a === u && e.b === v) || (e.a === v && e.b === u)); })[0]; if (isa) via = isa.a === u ? 'is a' : 'has subtype'; }
        parts.push('<b>' + esc(u) + '</b><span class="arrow">→</span>' + (via ? '<span class="via-t">' + esc(via) + '</span><span class="arrow">→</span>' : '') + '<b>' + esc(v) + '</b>');
        walk(v, depth + 1);
      });
    })(picked[0], 0);
    return parts.join('<br>');
  }

  function wireRoute() {
    route.querySelectorAll('[data-x]').forEach(function (b) { b.addEventListener('click', function () { toggle(b.dataset.x); }); });
    var c = $('ja-clear'); if (c) c.addEventListener('click', function () { picked = []; activeNote = null; activeReport = null; update(false); });
    var r = $('ja-report'); if (r) r.addEventListener('click', function () {
      var def = q("SELECT sql FROM sqlite_master WHERE name = '" + activeReport + "'")[0][0];
      sqlBox.value = def.replace(/^CREATE VIEW \S+ AS\s*/i, '') + ';'; exec();
    });
  }

  function showDetail(n, inRoute) {
    var t = T[n], fkCols = {}; t.fks.forEach(function (f) { fkCols[f.col] = f.parent; });
    var h = '';
    if (inRoute) h += '<div class="ja-chips"><span class="ja-chip">' + esc(n) + '<button type="button" data-x="' + esc(n) + '" aria-label="Remove ' + esc(n) + '">×</button></span><span class="hint" style="font-size:.8125rem;color:var(--muted)">Pick another table to join to.</span></div>';
    h += '<div class="detail"><h3>' + esc(n) + '</h3><p>' + t.rows + ' rows' + (t.link ? ' · link table, ' + KIND_TEXT[t.kind] : '') + ' · connects to ' + adj[n].length + ' table' + (adj[n].length === 1 ? '' : 's') + '</p><div class="cols">' +
      t.cols.map(function (c) { return '<code class="' + (c.pk ? 'pk' : fkCols[c.name] ? 'fk' : '') + '" title="' + (c.pk ? 'primary key' : fkCols[c.name] ? 'foreign key to ' + esc(fkCols[c.name]) : '') + '">' + esc(c.name) + '</code>'; }).join('') + '</div>' + driftHtml(n, fkCols) + '</div>';
    route.innerHTML = h; wireRoute();
    sqlBox.value = 'SELECT *\nFROM "' + n + '"\nLIMIT 20;';
    if (!inRoute) exec();
  }

  // What the 2024 report's attribute list (section 4.0) says about this table,
  // compared with what was actually built.
  function driftHtml(n, fkCols) {
    var d = drift && drift.tables[n]; if (!d) return '';
    var lines = [], code = function (x) { return '<code>' + esc(x) + '</code>'; };
    if (d.doc.replace(/ /g, '') !== n.replace(/_/g, '')) lines.push('Documented as ' + code(d.doc) + '.');
    var docOnly = d.onlyDoc.slice(), dbOnly = d.onlyDb.filter(function (c) { return !fkCols[c]; });
    var added = d.onlyDb.filter(function (c) { return fkCols[c]; });
    var renamed = [];
    while (docOnly.length && dbOnly.length) renamed.push(code(docOnly.shift()) + ' → ' + code(dbOnly.shift()));
    if (renamed.length) lines.push('Changed: ' + renamed.join(', ') + '.');
    if (docOnly.length) lines.push('In the report but not the database: ' + docOnly.map(code).join(', ') + '.');
    if (dbOnly.length) lines.push('In the database but not the report: ' + dbOnly.map(code).join(', ') + '.');
    if (added.length) lines.push('Foreign key' + (added.length > 1 ? 's' : '') + ' added so the diagram’s links work: ' + added.map(code).join(', ') + '.');
    return '<div class="drift"><h4>Against the 2024 report</h4>' + (lines.length ? '<p>' + lines.join('<br>') + '</p>' : '<p>Matches the report exactly.</p>') + '</div>';
  }

  // ---------- run ----------
  function exec() {
    if (!db) return;
    var t0 = performance.now();
    try {
      var res = db.exec(sqlBox.value), ms = Math.max(1, Math.round(performance.now() - t0));
      if (!res.length) {
        var isQuery = /^\s*(select|with)\b/i.test(sqlBox.value.replace(/^\s*--.*$/gm, ''));
        out.innerHTML = '<p class="empty">' + (isQuery ? 'No rows match.' : 'Done. That statement doesn’t return rows.') + '</p>';
        say((isQuery ? '0 rows in ' : 'Ran in ') + ms + ' ms'); return;
      }
      var r = res[res.length - 1], cap = 200;
      var h = '<div class="tbl"><table><thead><tr>' + r.columns.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
      h += r.values.slice(0, cap).map(function (row) { return '<tr>' + row.map(function (v) { return '<td>' + (v === null ? '<i>null</i>' : esc(v)) + '</td>'; }).join('') + '</tr>'; }).join('');
      out.innerHTML = h + '</tbody></table></div>';
      say(r.values.length + ' row' + (r.values.length === 1 ? '' : 's') + ' in ' + ms + ' ms');
    } catch (e) { out.textContent = ''; say(e.message, true); }
  }
  runBtn.addEventListener('click', exec);
  sqlBox.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); exec(); } });
  $('ja-lens').addEventListener('change', function (e) { map.classList.toggle('lensed', e.target.checked); $('ja-legend').classList.toggle('lensed', e.target.checked); });
  root.querySelectorAll('[data-layout]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (!db) return;
      POS = LAYOUTS[b.dataset.layout];
      root.querySelectorAll('[data-layout]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      drawMap(); update(false);
    });
  });

  // ---------- boot ----------
  // Load sql.js only when the atlas gets close to view, and share it with the
  // SQL playground on the same page if that has already pulled it in.
  function withSql(cb) {
    if (window.initSqlJs) return cb();
    var src = CDN + 'sql-wasm.js', s = document.querySelector('script[src="' + src + '"]');
    if (!s) { s = document.createElement('script'); s.src = src; document.head.appendChild(s); }
    s.addEventListener('load', cb);
    s.addEventListener('error', function () { say('Couldn’t load SQLite. Check your connection and reload.', true); });
  }
  var started = false;
  function start() {
    if (started) return; started = true; say('Loading the database…');
    withSql(function () {
      Promise.all([
        window.initSqlJs({ locateFile: function (f) { return CDN + f; } }),
        fetch(root.dataset.db).then(function (r) { if (!r.ok) throw new Error('database ' + r.status); return r.arrayBuffer(); }),
        fetch(root.dataset.drift).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
      ]).then(function (v) {
        db = new v[0].Database(new Uint8Array(v[1])); drift = v[2];
        introspect(); draw();
        runBtn.disabled = false; root.classList.add('ready');
        $('ja-presets').querySelector('button').click();
      }).catch(function (e) { say('Couldn’t load the database: ' + e.message, true); });
    });
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); start(); } }, { rootMargin: '600px' });
    io.observe(root);
  } else start();
})();
