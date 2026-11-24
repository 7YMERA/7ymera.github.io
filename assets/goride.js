/* goride.js: Vanilla JS port of GoRide City-Lens Ride Dispatch UI + Kuala Lumpur edition.
 * Exposes window.GoRide = { PRESETS, mount }.
 * Zero external dependencies. Features a genuinely draggable 1.45x magnifying phone lens,
 * 12-vehicle real-time street routing, Hold-to-Book fill bar, and KL / Classic presets. */
(function () {
  'use strict';
  var d = document;
  var NS = 'http://www.w3.org/2000/svg';
  var uidSeq = 0;

  var PRESETS = {
    kl: {
      id: 'kl',
      brand: '7YMERA Ride',
      headline: 'Kuala Lumpur,',
      phrases: ['in your hand.', 'under the lens.', 'tap to dispatch.', 'across the city.'],
      lede: 'Drag the phone across the paper city to scan real KL districts, tap any street to drop a destination flag, then hold to dispatch the nearest ride.',
      currency: { locale: 'en-MY', code: 'MYR' },
      fare: { base: 4.5, perBlock: 0.9, minutesPerBlock: 0.6 },
      roads: ['Jalan Ampang', 'Jalan Tun Razak', 'Jalan Bukit Bintang', 'Jalan Sultan Ismail', 'Jalan Raja Chulan', 'Jalan Imbi', 'Jalan Pudu'],
      districts: [
        { name: 'Kampung Baru', x: 0.52, y: 0.22 },
        { name: 'KLCC', x: 0.80, y: 0.24 },
        { name: 'Bukit Bintang', x: 0.66, y: 0.54 },
        { name: 'TRX', x: 0.88, y: 0.64 },
        { name: 'Pasar Seni', x: 0.48, y: 0.80 },
        { name: 'KL Sentral', x: 0.76, y: 0.89 }
      ],
      parks: [
        { x: 0.60, y: 0.39 },
        { x: 0.82, y: 0.78 },
        { x: 0.44, y: 0.60 },
        { x: 0.72, y: 0.12 }
      ],
      rides: [
        { id: 'car', label: 'Standard', price: 1.0, vehicle: 'White Perodua Myvi' },
        { id: 'xl', label: 'XL', price: 1.45, vehicle: 'Navy Proton X90' },
        { id: 'bike', label: 'Bike', price: 0.55, vehicle: 'KL E-Bike' }
      ],
      driver: { name: 'Hakim Razak', initials: 'HR', rating: '4.9', trips: '1,840 trips', plate: 'WKL 7118', pin: '4821' },
      payment: { method: '7YMERA Pay', note: 'DuitNow · Instant' },
      liveCities: [
        { name: 'KLCC', rides: 418 },
        { name: 'Bukit Bintang', rides: 612 },
        { name: 'TRX', rides: 294 },
        { name: 'KL Sentral', rides: 530 },
        { name: 'Pasar Seni', rides: 347 }
      ]
    },
    classic: {
      id: 'classic',
      brand: 'GoRide',
      headline: 'The city,',
      phrases: ['in your hand.', 'a tap away.', 'moving with you.', 'on your schedule.'],
      lede: 'A paper city map with 12 live vehicles cruising its grid. Drag the phone lens over any district, tap the paper to set a drop-off, and hold Book.',
      currency: { locale: 'en-US', code: 'USD' },
      fare: { base: 4.5, perBlock: 0.85, minutesPerBlock: 0.6 },
      roads: ['Market St', 'Broadway', '5th Ave', 'Lake Ave', 'Park Ave', 'Main St', 'Mission St'],
      districts: [
        { name: 'Old Town', x: 0.55, y: 0.25 },
        { name: 'Harbor', x: 0.86, y: 0.22 },
        { name: 'Market Square', x: 0.66, y: 0.55 },
        { name: 'Riverside', x: 0.89, y: 0.66 },
        { name: 'Tech Park', x: 0.50, y: 0.82 },
        { name: 'Airport Road', x: 0.78, y: 0.90 }
      ],
      parks: [
        { x: 0.60, y: 0.40 },
        { x: 0.84, y: 0.80 },
        { x: 0.44, y: 0.62 },
        { x: 0.74, y: 0.12 }
      ],
      rides: [
        { id: 'car', label: 'Standard', price: 1.0, vehicle: 'White Toyota Camry' },
        { id: 'xl', label: 'XL', price: 1.45, vehicle: 'Black Chevy Suburban' },
        { id: 'bike', label: 'Bike', price: 0.5, vehicle: 'E-bike' }
      ],
      driver: { name: 'Maya Lin', initials: 'ML', rating: '4.9', trips: '2,120 trips', plate: '7GR-428', pin: '6094' },
      payment: { method: 'Apple Pay', note: 'Personal · Default' },
      liveCities: [
        { name: 'Market Square', rides: 384 },
        { name: 'Harbor', rides: 519 },
        { name: 'Tech Park', rides: 642 },
        { name: 'Riverside', rides: 276 }
      ]
    }
  };

  var CITY_CFG = { spacing: 46, spacingSmall: 38, spacingLarge: 56, angle: -12, avenueEvery: 4, centerY: 0.54 };
  var LENS_CFG = { zoom: 1.45, pinY: 0.43 };
  var CARS_CFG = { count: 12, cruise: 0.92, dispatch: 2.5, minutesPerBlock: 0.45, nearby: 6 };
  var BOOKING_CFG = { search: 1.0, pickup: 1.6, hold: 4.5, press: 0.62 };
  var STEPS = [{ i: 1, j: 0 }, { i: -1, j: 0 }, { i: 0, j: 1 }, { i: 0, j: -1 }];

  /* ===================== SVG drawings ===================== */
  function logoSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<rect width="24" height="24" rx="7" fill="var(--gr-accent)"/>' +
      '<path d="M12 4.8a6.4 6.4 0 0 0-1.6 12.6l3.1 2.4.4-2.6A6.4 6.4 0 0 0 12 4.8Z" fill="var(--gr-accent-ink)"/>' +
      '<circle cx="12" cy="11.2" r="2.3" fill="var(--gr-accent)"/></svg>';
  }
  function vehicleSvg(kind, len) {
    if (kind === 'xl') {
      var w = (len * 1.1).toFixed(1), h = (len * 0.57).toFixed(1);
      return '<svg viewBox="0 0 50 26" width="' + w + '" height="' + h + '" fill="none" class="gr-lens-car" aria-hidden="true">' +
        '<rect x="1" y="2" width="48" height="22" rx="6" fill="#182442" stroke="#081124" stroke-opacity="0.5"/>' +
        '<path d="M33 5h5c2.8 0 5 3.6 5 8s-2.2 8-5 8h-5c1-2.3 1.5-5 1.5-8S34 7.3 33 5Z" fill="#6b82ab"/>' +
        '<path d="M8.5 5.5h3c-.8 2.2-1.2 4.8-1.2 7.5s.4 5.3 1.2 7.5h-3C7.3 18.6 6.6 15.9 6.6 13s.7-5.6 1.9-7.5Z" fill="#6b82ab"/>' +
        '<rect x="14" y="6" width="17" height="14" rx="2.5" fill="#263861"/>' +
        '<path d="M15 7.5h15M15 18.5h15" stroke="#9db2d4" stroke-width="1" stroke-linecap="round"/>' +
        '<rect x="46" y="4.5" width="2" height="4" rx="1" fill="#f6b51e"/>' +
        '<rect x="46" y="17.5" width="2" height="4" rx="1" fill="#f6b51e"/></svg>';
    }
    if (kind === 'bike') {
      var bw = (len * 0.84).toFixed(1), bh = (len * 0.42).toFixed(1);
      return '<svg viewBox="0 0 40 20" width="' + bw + '" height="' + bh + '" fill="none" class="gr-lens-car" aria-hidden="true">' +
        '<rect x="3" y="7.5" width="33" height="5" rx="2.5" fill="#14161b"/>' +
        '<path d="M31 2.5v15" stroke="#14161b" stroke-width="2.4" stroke-linecap="round"/>' +
        '<ellipse cx="18" cy="10" rx="6.5" ry="7.5" fill="#2c3a57"/>' +
        '<circle cx="20.5" cy="10" r="4.6" fill="#f6b51e" stroke="#14161b" stroke-opacity="0.35"/>' +
        '<rect x="35" y="8.5" width="3" height="3" rx="1" fill="#ffe7a6"/></svg>';
    }
    var cw = len.toFixed(1), ch = (len * 0.55).toFixed(1);
    return '<svg viewBox="0 0 44 24" width="' + cw + '" height="' + ch + '" fill="none" class="gr-lens-car" aria-hidden="true">' +
      '<rect x="1" y="2" width="42" height="20" rx="8" fill="#ffffff" stroke="#14161b" stroke-opacity="0.25"/>' +
      '<path d="M28 5.5h4.5c2.6 0 4.5 2.9 4.5 6.5s-1.9 6.5-4.5 6.5H28c.9-2 1.4-4.2 1.4-6.5S28.9 7.5 28 5.5Z" fill="#14161b"/>' +
      '<path d="M9.5 6h3.2c-.8 1.8-1.2 3.8-1.2 6s.4 4.2 1.2 6H9.5C8 16.6 7.2 14.4 7.2 12S8 7.4 9.5 6Z" fill="#14161b" fill-opacity="0.85"/>' +
      '<rect x="14" y="6.5" width="12" height="11" rx="3" fill="#e8eef8"/>' +
      '<rect x="40" y="4.5" width="2" height="4" rx="1" fill="#f6b51e"/>' +
      '<rect x="40" y="15.5" width="2" height="4" rx="1" fill="#f6b51e"/></svg>';
  }
  function rideMiniIcon(kind) {
    if (kind === 'xl') return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h14l4 4v4a2 2 0 0 1-2 2h-2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>';
    if (kind === 'bike') return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/></svg>';
    return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L18 10l-2-4H8L6 10l-2.5 1.1C2.7 11.3 2 12.1 2 13v3c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>';
  }
  var PIN_ICO = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';
  var FLAG_ICO = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>';
  var CHECK_ICO = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  var ARROW_ICO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="gr-cta-arrow" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg>';

  /* ===================== City & Fleet simulation ===================== */
  function toneHash(i, j) {
    var n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }
  function same(a, b) { return a.i === b.i && a.j === b.j; }
  function walk(a, b) {
    var steps = [], cur = { i: a.i, j: a.j };
    while (cur.i !== b.i) { cur.i += Math.sign(b.i - cur.i); steps.push({ i: cur.i, j: cur.j }); }
    while (cur.j !== b.j) { cur.j += Math.sign(b.j - cur.j); steps.push({ i: cur.i, j: cur.j }); }
    return steps;
  }
  function riverPath(w, h) {
    return 'M ' + (w * 0.36).toFixed(1) + ' ' + (h * 1.04).toFixed(1) +
      ' C ' + (w * 0.50).toFixed(1) + ' ' + (h * 0.74).toFixed(1) + ', ' +
      (w * 0.60).toFixed(1) + ' ' + (h * 0.66).toFixed(1) + ', ' +
      (w * 0.74).toFixed(1) + ' ' + (h * 0.50).toFixed(1) +
      ' S ' + (w * 0.93).toFixed(1) + ' ' + (h * 0.12).toFixed(1) + ', ' +
      (w * 1.04).toFixed(1) + ' ' + (h * 0.02).toFixed(1);
  }
  function pathFrom(pts) {
    var s = '';
    for (var i = 0; i < pts.length; i++) {
      s += (i ? ' L' : 'M') + pts[i].x.toFixed(1) + ' ' + pts[i].y.toFixed(1);
    }
    return s;
  }

  function createCity(width, height, spacing, preset) {
    var rad = (CITY_CFG.angle * Math.PI) / 180;
    var cos = Math.cos(rad), sin = Math.sin(rad);
    var center = { x: width / 2, y: height * CITY_CFG.centerY };
    var reach = Math.ceil(Math.hypot(width, height) / spacing / 2) + 2;
    function toWorld(i, j) {
      return {
        x: center.x + i * spacing * cos - j * spacing * sin,
        y: center.y + i * spacing * sin + j * spacing * cos
      };
    }
    function nearestNode(x, y) {
      var dx = x - center.x, dy = y - center.y;
      return {
        i: Math.round((dx * cos + dy * sin) / spacing),
        j: Math.round((-dx * sin + dy * cos) / spacing)
      };
    }
    function inside(node, margin) {
      margin = margin == null ? spacing : margin;
      var p = toWorld(node.i, node.j);
      return p.x > -margin && p.x < width + margin && p.y > -margin && p.y < height + margin;
    }
    function districtAt(x, y) {
      var list = preset.districts, best = list[0], bd = Infinity;
      for (var k = 0; k < list.length; k++) {
        var dist = Math.hypot(list[k].x * width - x, list[k].y * height - y);
        if (dist < bd) { bd = dist; best = list[k]; }
      }
      return best.name;
    }
    return { width: width, height: height, spacing: spacing, angle: rad, center: center, reach: reach, toWorld: toWorld, nearestNode: nearestNode, inside: inside, districtAt: districtAt };
  }

  function createFleet(city, rides) {
    var cars = [];
    var state = { assigned: -1, target: null, left: 0, total: 0, arrived: false };
    function randomNode() {
      for (var k = 0; k < 80; k++) {
        var node = {
          i: Math.floor(Math.random() * city.reach * 2) - city.reach,
          j: Math.floor(Math.random() * city.reach * 2) - city.reach
        };
        if (city.inside(node, -city.spacing)) return node;
      }
      return { i: 0, j: 0 };
    }
    function roam(car) {
      var back = { i: car.from.i - car.to.i, j: car.from.j - car.to.j };
      var opts = [];
      for (var s = 0; s < STEPS.length; s++) {
        if (STEPS[s].i === back.i && STEPS[s].j === back.j) continue;
        var n = { i: car.to.i + STEPS[s].i, j: car.to.j + STEPS[s].j };
        if (city.inside(n, -city.spacing * 0.5)) opts.push(n);
      }
      return opts.length ? opts[Math.floor(Math.random() * opts.length)] : { i: car.from.i, j: car.from.j };
    }
    for (var k = 0; k < CARS_CFG.count; k++) {
      var from = randomNode(), stp = STEPS[Math.floor(Math.random() * 4)];
      cars.push({
        kind: rides[k % rides.length].id,
        from: from,
        to: { i: from.i + stp.i, j: from.j + stp.j },
        t: Math.random(),
        heading: 0,
        queue: []
      });
    }
    function position(car) {
      var a = city.toWorld(car.from.i, car.from.j), b = city.toWorld(car.to.i, car.to.j);
      return { x: a.x + (b.x - a.x) * car.t, y: a.y + (b.y - a.y) * car.t };
    }
    function distance(car, node) {
      return (1 - car.t) + Math.abs(node.i - car.to.i) + Math.abs(node.j - car.to.j);
    }
    function nearest(node, kind) {
      var best = { index: -1, blocks: Infinity };
      for (var i = 0; i < cars.length; i++) {
        if (kind && cars[i].kind !== kind) continue;
        var blk = distance(cars[i], node);
        if (blk < best.blocks) best = { index: i, blocks: blk };
      }
      return best;
    }
    function countNear(node, blocks) {
      var n = 0;
      for (var i = 0; i < cars.length; i++) if (distance(cars[i], node) <= blocks) n++;
      return n;
    }
    function dispatch(node, kind) {
      var res = nearest(node, kind);
      if (res.index < 0) return;
      var car = cars[res.index];
      car.queue = walk(car.to, node);
      state.assigned = res.index;
      state.target = node;
      state.left = distance(car, node);
      state.total = state.left;
      state.arrived = false;
    }
    function driveTo(node) {
      if (state.assigned < 0) return;
      var car = cars[state.assigned];
      car.queue = walk(car.from, node);
      car.to = car.queue.shift() || { i: car.from.i, j: car.from.j };
      car.t = 0;
      state.target = node;
      state.arrived = same(car.from, node);
      state.left = distance(car, node);
      state.total = state.left;
    }
    function finish() {
      if (state.assigned < 0 || !state.target) return;
      var car = cars[state.assigned];
      car.from = { i: state.target.i, j: state.target.j };
      car.to = { i: state.target.i, j: state.target.j };
      car.t = 0; car.queue = [];
      state.left = 0; state.arrived = true;
    }
    function release() {
      if (state.assigned >= 0) cars[state.assigned].queue = [];
      state.assigned = -1; state.target = null; state.left = 0; state.total = 0; state.arrived = false;
    }
    function route() {
      if (state.assigned < 0 || !state.target) return [];
      var car = cars[state.assigned];
      var out = [position(car), city.toWorld(car.to.i, car.to.j)];
      for (var i = 0; i < car.queue.length; i++) out.push(city.toWorld(car.queue[i].i, car.queue[i].j));
      return out;
    }
    function step(dt) {
      for (var i = 0; i < cars.length; i++) {
        var car = cars[i], assigned = i === state.assigned;
        if (assigned && state.arrived) continue;
        var move = (assigned ? CARS_CFG.dispatch : CARS_CFG.cruise) * dt;
        while (move > 0) {
          var rem = 1 - car.t;
          if (move < rem) { car.t += move; move = 0; }
          else {
            move -= rem;
            car.from = car.to;
            car.t = 0;
            var next = car.queue.shift();
            if (next) car.to = next;
            else if (assigned) { car.to = { i: car.from.i, j: car.from.j }; state.arrived = true; move = 0; }
            else car.to = roam(car);
          }
        }
        if (!same(car.from, car.to)) {
          var a = city.toWorld(car.from.i, car.from.j), b = city.toWorld(car.to.i, car.to.j);
          var tgt = Math.atan2(b.y - a.y, b.x - a.x);
          var turn = Math.atan2(Math.sin(tgt - car.heading), Math.cos(tgt - car.heading));
          car.heading += turn * Math.min(1, dt * 10);
        }
      }
      if (state.assigned >= 0 && state.target) {
        state.left = state.arrived ? 0 : distance(cars[state.assigned], state.target);
      }
    }
    return { cars: cars, state: state, position: position, nearest: nearest, countNear: countNear, dispatch: dispatch, driveTo: driveTo, finish: finish, release: release, route: route, step: step };
  }

  /* ===================== City Plan SVG Builder ===================== */
  function buildCitySvg(variant, city, river, parks, preset) {
    var app = variant === 'app';
    var sp = city.spacing, far = city.reach * sp, gap = sp * (app ? 0.1 : 0.09);
    var patId = 'gr-pat-' + (++uidSeq);
    var lines = [];
    for (var k = -city.reach; k <= city.reach; k++) lines.push(k);
    var cos = Math.cos(city.angle), sin = Math.sin(city.angle);

    var out = [];
    out.push('<svg width="' + city.width + '" height="' + city.height + '" viewBox="0 0 ' + city.width + ' ' + city.height + '" fill="none" aria-hidden="true">');
    if (!app) {
      out.push('<defs><pattern id="' + patId + '" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="3.5" cy="3.5" r="0.9" fill="var(--gr-ink)" fill-opacity="0.16"/></pattern></defs>');
    } else {
      out.push('<rect width="' + city.width + '" height="' + city.height + '" fill="var(--gr-mapBlock)"/>');
    }

    out.push('<g transform="translate(' + city.center.x.toFixed(1) + ' ' + city.center.y.toFixed(1) + ') rotate(' + CITY_CFG.angle + ')">');
    if (!app) {
      for (var bi = 0; bi < lines.length; bi++) {
        for (var bj = 0; bj < lines.length; bj++) {
          var i = lines[bi], j = lines[bj], sh = toneHash(i, j);
          if (sh <= 0.3) continue;
          var cx = city.center.x + (i + 0.5) * sp * cos - (j + 0.5) * sp * sin;
          var cy = city.center.y + (i + 0.5) * sp * sin + (j + 0.5) * sp * cos;
          if (cx > -sp && cx < city.width + sp && cy > -sp && cy < city.height + sp) {
            out.push('<rect x="' + (i * sp + gap).toFixed(1) + '" y="' + (j * sp + gap).toFixed(1) + '" width="' + (sp - gap * 2).toFixed(1) + '" height="' + (sp - gap * 2).toFixed(1) + '" rx="2" fill="var(--gr-paperBlock)" fill-opacity="' + (0.38 + sh * 0.62).toFixed(2) + '"/>');
          }
        }
      }
    }
    for (var p = 0; p < parks.length; p++) {
      var pk = parks[p];
      var px = (pk.i * sp + gap).toFixed(1), py = (pk.j * sp + gap).toFixed(1);
      var pw = (sp * 2 - gap * 2).toFixed(1), ph = (sp - gap * 2).toFixed(1);
      var rx = app ? (sp * 0.12).toFixed(1) : '3';
      out.push('<rect x="' + px + '" y="' + py + '" width="' + pw + '" height="' + ph + '" rx="' + rx + '" fill="' + (app ? 'var(--gr-mapPark)' : 'var(--gr-paperPark)') + '"/>');
      if (!app) out.push('<rect x="' + px + '" y="' + py + '" width="' + pw + '" height="' + ph + '" rx="3" fill="url(#' + patId + ')"/>');
    }
    out.push('</g>');

    out.push('<path d="' + river + '" stroke-width="' + (sp * 0.8).toFixed(1) + '" stroke-linecap="round" stroke="' + (app ? 'var(--gr-mapWater)' : 'var(--gr-paperWater)') + '"/>');

    out.push('<g transform="translate(' + city.center.x.toFixed(1) + ' ' + city.center.y.toFixed(1) + ') rotate(' + CITY_CFG.angle + ')">');
    for (var l = 0; l < lines.length; l++) {
      var lk = lines[l], ave = lk % CITY_CFG.avenueEvery === 0;
      var sw = app ? (ave ? sp * 0.32 : sp * 0.2) : (ave ? sp * 0.2 : 1);
      var st = (app || ave) ? 'var(--gr-mapRoad)' : 'var(--gr-ink)';
      var op = (app || ave) ? '1' : '0.09';
      var pos = (lk * sp).toFixed(1);
      out.push('<line x1="' + pos + '" x2="' + pos + '" y1="' + (-far) + '" y2="' + far + '" stroke-width="' + sw.toFixed(1) + '" stroke="' + st + '" stroke-opacity="' + op + '"/>');
      out.push('<line x1="' + (-far) + '" x2="' + far + '" y1="' + pos + '" y2="' + pos + '" stroke-width="' + sw.toFixed(1) + '" stroke="' + st + '" stroke-opacity="' + op + '"/>');
    }
    if (!app && preset.roads.length) {
      var aveIdx = 0;
      for (var a = 0; a < lines.length; a++) {
        var ak = lines[a];
        if (ak % CITY_CFG.avenueEvery !== 0 || Math.abs(ak) >= city.reach - 1) continue;
        var fs = (sp * 0.165).toFixed(1);
        var r1 = preset.roads[aveIdx % preset.roads.length].toUpperCase();
        var r2 = preset.roads[(aveIdx + 3) % preset.roads.length].toUpperCase();
        var x1 = (ak * sp).toFixed(1), y1 = ((aveIdx % 2 ? 1.5 : -2.5) * sp).toFixed(1);
        var x2 = ((aveIdx % 2 ? -1.5 : 2.5) * sp).toFixed(1), y2 = (ak * sp).toFixed(1);
        out.push('<text x="' + x1 + '" y="' + y1 + '" transform="rotate(-90 ' + x1 + ' ' + y1 + ')" text-anchor="middle" dominant-baseline="central" fill="var(--gr-ink)" fill-opacity="0.34" font-size="' + fs + '" font-weight="600" letter-spacing="0.14em">' + r1 + '</text>');
        out.push('<text x="' + x2 + '" y="' + y2 + '" text-anchor="middle" dominant-baseline="central" fill="var(--gr-ink)" fill-opacity="0.34" font-size="' + fs + '" font-weight="600" letter-spacing="0.14em">' + r2 + '</text>');
        aveIdx++;
      }
    }
    out.push('</g>');

    if (app) {
      for (var di = 0; di < preset.districts.length; di++) {
        var dist = preset.districts[di];
        out.push('<text x="' + (dist.x * city.width).toFixed(1) + '" y="' + (dist.y * city.height).toFixed(1) + '" text-anchor="middle" fill="var(--gr-ink)" fill-opacity="0.56" font-size="' + (sp * 0.2).toFixed(1) + '" font-weight="700" letter-spacing="0.05em">' + dist.name.toUpperCase() + '</text>');
      }
    }
    out.push('</svg>');
    return out.join('');
  }

  /* ===================== Mount GoRide ===================== */
  function mount(host, opts) {
    var cfg = Object.assign({
      preset: 'kl',
      theme: 'light',
      sound: true,
      embedded: false,
      orbital: false,
      onFrame: null,
      onStatus: null,
      onXrayToggle: null
    }, opts || {});

    var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var preset = PRESETS[cfg.preset] || PRESETS.kl;

    var audioCtx = null;
    function chime(f0, f1, dur) {
      if (!cfg.sound) return;
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audioCtx = audioCtx || new AC();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        var t = audioCtx.currentTime, o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(f0, t);
        if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + (dur || 0.1));
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.09, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.14));
        o.connect(g).connect(audioCtx.destination);
        o.start(t); o.stop(t + (dur || 0.14) + 0.02);
      } catch (e) {}
    }

    var moneyFmt = function (val) {
      try {
        return new Intl.NumberFormat(preset.currency.locale, { style: 'currency', currency: preset.currency.code, minimumFractionDigits: 2 }).format(val);
      } catch (e) { return preset.currency.code + ' ' + val.toFixed(2); }
    };

    var hid = 'gr-h1-' + (++uidSeq);
    var root = d.createElement('div');
    root.className = 'gr-root' + (cfg.embedded ? ' gr-embed' : '') + (cfg.orbital ? ' gr-orbital' : '');
    root.dataset.preset = preset.id;
    root.dataset.theme = cfg.theme;
    host.appendChild(root);

    root.innerHTML =
      '<div class="gr-top">' +
        '<div class="gr-top-bar">' +
          '<a class="gr-brand gr-focus" href="/lab/" data-gr="brand">' + logoSvg() + '<span data-gr="brand-name"></span></a>' +
          '<div class="gr-controls" role="group" aria-label="City lens controls">' +
            '<button type="button" class="gr-pill-btn on" data-gr-preset="kl" aria-pressed="true">Kuala Lumpur</button>' +
            '<button type="button" class="gr-pill-btn" data-gr-preset="classic" aria-pressed="false">GoRide Classic</button>' +
            '<button type="button" class="gr-pill-btn" data-gr-act="random">Random trip</button>' +
            '<button type="button" class="gr-pill-btn" data-gr-act="center">Center phone</button>' +
            '<button type="button" class="gr-pill-btn gr-orb-only" data-gr-act="xray" aria-pressed="false">Orbital X-Ray</button>' +
            '<button type="button" class="gr-pill-btn" data-gr-act="theme" aria-pressed="false">Midnight</button>' +
            '<button type="button" class="gr-pill-btn on" data-gr-act="sound" aria-pressed="true">Sound · On</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<section class="gr-panel" aria-labelledby="' + hid + '">' +
        '<div class="gr-stage" data-gr="stage">' +
          '<div class="gr-plan-wrap" aria-hidden="true">' +
            '<div class="gr-plan" data-gr="paper-plan"></div>' +
            '<div data-gr="districts"></div>' +
            '<svg class="gr-routes" aria-hidden="true">' +
              '<path data-gr="page-preview" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1 9" stroke="var(--gr-ink)" stroke-opacity="0.65"/>' +
              '<path data-gr="page-route" fill="none" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" stroke="var(--gr-accent)"/>' +
            '</svg>' +
          '</div>' +
          '<span class="gr-uplink-ring" data-gr="uplink" aria-hidden="true"></span>' +
          '<div class="gr-flag-wrap" data-gr="flag" hidden>' +
            '<span class="gr-flag"><span class="gr-flag-ic">' + FLAG_ICO + '</span><span data-gr="flag-name"></span><span class="gr-flag-meta" data-gr="flag-meta"></span></span>' +
            '<span class="gr-flag-stem"></span><span class="gr-flag-dot"></span>' +
          '</div>' +
          '<div class="gr-page-car" data-gr="page-car" aria-hidden="true"></div>' +
          '<div class="gr-cursor" data-gr="cursor" aria-hidden="true"><span class="gr-cursor-ring"></span><span class="gr-cursor-tag" data-gr="cursor-tag"></span></div>' +
          '<div class="gr-phone-spot" data-gr="phone-spot">' +
            '<span class="gr-phone-glow" aria-hidden="true"></span>' +
            '<span class="gr-drag-hint" aria-hidden="true">Drag lens across map</span>' +
            '<div class="gr-phone"><div class="gr-bezel"><div class="gr-screen" data-gr="screen">' +
              '<div class="gr-lens-map" data-gr="lens-map"></div>' +
              '<div class="gr-lens-xray" aria-hidden="true">' +
                '<span class="gr-xray-grid"></span>' +
                '<span class="gr-xray-sweep"></span>' +
                '<span class="gr-xray-reticle"></span>' +
              '</div>' +
              '<svg class="gr-routes" aria-hidden="true">' +
                '<path data-gr="lens-preview" fill="none" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1 8" stroke="var(--gr-ink)" stroke-opacity="0.55"/>' +
                '<path data-gr="lens-route" fill="none" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" stroke="var(--gr-accent)"/>' +
              '</svg>' +
              '<div data-gr="lens-cars"></div>' +
              '<div class="gr-pin" data-gr="pin">' +
                '<span class="gr-pin-shadow"></span>' +
                '<div class="gr-pin-body"><span class="gr-pin-chip" data-gr="pin-chip">2 min</span><span class="gr-pin-head"><i></i></span><span class="gr-pin-stem"></span></div>' +
              '</div>' +
              '<span class="gr-screen-top" aria-hidden="true"></span>' +
              '<div class="gr-statusbar" aria-hidden="true"><span>9:41</span><span data-gr="status-r">5G · 100%</span></div>' +
              '<span class="gr-island" aria-hidden="true"></span>' +
              '<div class="gr-app-head">' +
                '<div class="gr-app-bar"><span class="gr-app-bar-l">' + logoSvg() + '<span data-gr="app-brand"></span></span><span class="gr-you" data-gr="sat-badge">You</span></div>' +
                '<div class="gr-search">' +
                  '<div class="gr-srow">' + PIN_ICO + '<span style="min-width:0"><small>Pickup</small><b data-gr="pickup">KLCC</b></span></div>' +
                  '<div class="gr-srow">' + FLAG_ICO + '<b data-gr="dropoff-txt" class="gr-srow-dim">Tap map to add drop-off</b></div>' +
                '</div>' +
              '</div>' +
              '<div class="gr-sheet" data-gr="sheet"></div>' +
            '</div></div></div>' +
          '</div>' +
        '</div>' +
        '<div class="gr-layout">' +
          '<div class="gr-copy" data-gr="copy">' +
            '<p class="gr-ticker">' +
              '<span class="gr-ticker-tag"><span class="gr-live-dot" aria-hidden="true"></span>LIVE</span>' +
              '<span class="gr-ticker-txt"><span class="gr-ticker-num" data-gr="tick-num">418</span> rides live in <span class="gr-ticker-city" data-gr="tick-city">KLCC</span></span>' +
            '</p>' +
            (cfg.embedded ? '<h2 id="' + hid + '" class="gr-title">' : '<h1 id="' + hid + '" class="gr-title">') + '<span data-gr="headline"></span><span class="gr-title-accent" data-gr="phrase"></span>' + (cfg.embedded ? '</h2>' : '</h1>') +
            '<p class="gr-lede" data-gr="lede"></p>' +
            '<div class="gr-sat-deck gr-orb-only" data-gr="sat-deck">' +
              '<div class="gr-sat-hud">' +
                '<span class="gr-sat-hud-l"><i class="gr-sat-dot" aria-hidden="true"></i><b data-gr="hud-sat">GPM-CORE</b><span data-gr="hud-alt">407 KM</span></span>' +
                '<span class="gr-sat-hud-r" data-gr="hud-gps">3.1466° N, 101.7116° E</span>' +
              '</div>' +
              '<div class="gr-sat-slot" data-gr="sat-slot"></div>' +
              '<div class="gr-sat-foot">' +
                '<span data-gr="hud-lock">LOCK: BUKIT BINTANG</span>' +
                '<span data-gr="hud-link">DOWNLINK · 14 MS</span>' +
              '</div>' +
            '</div>' +
            '<div class="gr-tips" aria-label="How to interact">' +
              '<span class="gr-tip"><b>01</b> Drag phone lens</span>' +
              '<span class="gr-tip"><b>02</b> Tap city for drop-off</span>' +
              '<span class="gr-tip"><b>03</b> Hold to dispatch</span>' +
            '</div>' +
            '<div class="gr-actions">' +
              '<button type="button" class="gr-cta gr-focus" data-gr-act="quick-book">' +
                '<span class="gr-cta-fill" aria-hidden="true"></span>' +
                '<span class="gr-cta-labels"><span class="gr-cta-label gr-cta-label-rest">Drop random pin</span><span class="gr-cta-label gr-cta-label-hover" aria-hidden="true">Dispatch in KL</span></span>' +
                '<span class="gr-cta-tile" aria-hidden="true">' + ARROW_ICO + '</span>' +
              '</button>' +
              '<button type="button" class="gr-orb-btn gr-orb-only gr-focus" data-gr-act="xray-cta" aria-pressed="false"><span class="gr-orb-ico" aria-hidden="true"></span><span>Orbital X-Ray</span></button>' +
              '<a class="gr-ghost gr-ghost-back gr-focus" href="/lab/">Back to 7YMERA Lab</a>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>';

    function q(name) { return root.querySelector('[data-gr="' + name + '"]'); }
    var stage = q('stage'), paperPlan = q('paper-plan'), districtsHost = q('districts');
    var pagePreview = q('page-preview'), pageRoute = q('page-route'), pageCar = q('page-car');
    var flagWrap = q('flag'), flagName = q('flag-name'), flagMeta = q('flag-meta');
    var cursorEl = q('cursor'), cursorTag = q('cursor-tag');
    var phoneSpot = q('phone-spot'), screenEl = q('screen'), lensMap = q('lens-map'), lensCarsHost = q('lens-cars');
    var lensPreview = q('lens-preview'), lensRoute = q('lens-route'), pinEl = q('pin'), pinChip = q('pin-chip');
    var pickupEl = q('pickup'), dropoffTxt = q('dropoff-txt'), sheetEl = q('sheet'), copyEl = q('copy');
    var uplinkEl = q('uplink'), satSlotEl = q('sat-slot'), satBadgeEl = q('sat-badge'), statusREl = q('status-r');
    var hudSatEl = q('hud-sat'), hudAltEl = q('hud-alt'), hudGpsEl = q('hud-gps'), hudLockEl = q('hud-lock'), hudLinkEl = q('hud-link');

    var st = {
      city: null,
      fleet: null,
      river: '',
      parks: [],
      status: 'idle', // idle | finding | coming | arrived | trip | dropped
      ride: 0,
      dropoff: null,
      hover: null,
      rating: 0,
      xray: false,
      orbital: !!cfg.orbital,
      satCallsign: 'GPM-CORE',
      satAlt: '407 KM',
      reading: { district: preset.districts[2].name, etas: [2, 3, 2], nearby: 4, minutes: 0, blocks: 0 },
      progress: 0,
      phonePos: { x: 0, y: 0, custom: false },
      drag: { on: false, sx: 0, sy: 0, ox: 0, oy: 0 },
      timers: [],
      raf: 0,
      onScreen: true,
      last: 0,
      lastReadingKey: '',
      destroyed: false
    };
    var carSlots = [], districtEls = [];

    function clearTimers() {
      st.timers.forEach(clearTimeout);
      st.timers = [];
    }
    function schedule(fn, ms) {
      var id = setTimeout(fn, ms);
      st.timers.push(id);
      return id;
    }

    function applyBrandCopy() {
      q('brand-name').textContent = preset.brand;
      q('app-brand').textContent = preset.brand;
      q('headline').textContent = st.orbital ? 'Orbital Dispatch,' : preset.headline;
      q('phrase').textContent = st.orbital ? 'satellite-locked KL.' : preset.phrases[0];
      q('lede').textContent = preset.lede;
      q('tick-num').textContent = String(preset.liveCities[0].rides);
      q('tick-city').textContent = preset.liveCities[0].name;
      if (satBadgeEl) satBadgeEl.textContent = st.orbital ? st.satCallsign.split('-')[0] : 'You';
      if (statusREl) statusREl.textContent = st.xray ? 'SAT · X-RAY' : (st.orbital ? 'ORBITAL · 5G' : '5G · 100%');
    }

    function triggerPulse(x, y) {
      if (!uplinkEl) return;
      var fx = x, fy = y;
      if (fx == null || fy == null) {
        var f = getPhoneFocus();
        fx = f.worldX; fy = f.worldY;
      }
      uplinkEl.style.left = fx.toFixed(1) + 'px';
      uplinkEl.style.top = fy.toFixed(1) + 'px';
      uplinkEl.classList.remove('go');
      void uplinkEl.offsetWidth;
      uplinkEl.classList.add('go');
    }

    function notifyStatus() {
      if (hudLinkEl) {
        var lbl = st.status === 'finding' ? 'ACQUIRING UNIT…'
          : st.status === 'coming' ? 'TRACKING UNIT · LIVE'
          : st.status === 'arrived' ? 'UNIT ON PIN · READY'
          : st.status === 'trip' ? 'ORBITAL ESCORT · LIVE'
          : st.status === 'dropped' ? 'ARRIVAL CONFIRMED'
          : (st.xray ? 'X-RAY SCAN · 14 MS' : 'DOWNLINK · 14 MS');
        hudLinkEl.textContent = lbl;
      }
      if (typeof cfg.onStatus === 'function') {
        try { cfg.onStatus(st.status, { district: st.reading.district, ride: preset.rides[st.ride] }); } catch (e) {}
      }
    }

    function placePhoneDefault() {
      if (!st.city) return;
      var pw = phoneSpot.offsetWidth || 276, ph = phoneSpot.offsetHeight || 560;
      if (st.city.width <= 820) {
        var cb = copyEl.getBoundingClientRect().bottom - stage.getBoundingClientRect().top;
        st.phonePos.x = Math.max(12, Math.round((st.city.width - pw) / 2));
        st.phonePos.y = Math.round(cb + 24);
      } else {
        var rightEdge = Math.min(st.city.width - 28, (st.city.width + Math.min(st.city.width - 56, 1240)) / 2 - 12);
        st.phonePos.x = Math.round(rightEdge - pw);
        st.phonePos.y = Math.max(24, Math.round((st.city.height - ph) / 2));
      }
      st.phonePos.custom = false;
      syncPhoneTransform();
    }

    function clampPhonePos() {
      if (!st.city) return;
      var pw = phoneSpot.offsetWidth || 276, ph = phoneSpot.offsetHeight || 560;
      st.phonePos.x = Math.max(8, Math.min(st.city.width - pw - 8, st.phonePos.x));
      st.phonePos.y = Math.max(12, Math.min(st.city.height - ph - 12, st.phonePos.y));
    }

    function syncPhoneTransform() {
      phoneSpot.style.transform = 'translate3d(' + st.phonePos.x.toFixed(1) + 'px,' + st.phonePos.y.toFixed(1) + 'px,0)';
    }

    function getPhoneFocus() {
      var sw = screenEl.offsetWidth || 250, sh = screenEl.offsetHeight || 520;
      var bezelX = (phoneSpot.offsetWidth - sw) / 2;
      var bezelY = (phoneSpot.offsetHeight - sh) / 2;
      return {
        sw: sw,
        sh: sh,
        pinX: sw / 2,
        pinY: sh * LENS_CFG.pinY,
        worldX: st.phonePos.x + bezelX + sw / 2,
        worldY: st.phonePos.y + bezelY + sh * LENS_CFG.pinY
      };
    }

    function tripInfo() {
      if (!st.dropoff || !st.city) return null;
      var pt = st.city.toWorld(st.dropoff.i, st.dropoff.j);
      var name = st.city.districtAt(pt.x, pt.y);
      var blocks = Math.max(2, st.reading.blocks || 4);
      return {
        name: name,
        point: pt,
        fare: preset.fare.base + blocks * preset.fare.perBlock,
        minutes: Math.max(1, Math.ceil(blocks * preset.fare.minutesPerBlock))
      };
    }

    function updateFlagAndSearch() {
      var trip = tripInfo();
      var riding = st.status === 'trip' || st.status === 'dropped';
      pinEl.hidden = riding;
      pickupEl.textContent = st.reading.district;
      var eta = st.reading.etas[st.ride] || 1;
      pinChip.textContent = (st.status === 'idle' || st.status === 'finding')
        ? (eta + ' min')
        : (st.status === 'arrived' ? 'Here' : (st.reading.minutes + ' min'));
      if (trip) {
        dropoffTxt.textContent = trip.name;
        dropoffTxt.classList.remove('gr-srow-dim');
        flagWrap.hidden = false;
        flagWrap.style.left = trip.point.x.toFixed(1) + 'px';
        flagWrap.style.top = trip.point.y.toFixed(1) + 'px';
        flagName.textContent = trip.name;
        flagMeta.textContent = moneyFmt(trip.fare * preset.rides[st.ride].price) + ' · ' + trip.minutes + ' min';
      } else {
        dropoffTxt.textContent = 'Tap map to add drop-off';
        dropoffTxt.classList.add('gr-srow-dim');
        flagWrap.hidden = true;
      }
      var showCar = st.status === 'coming' || st.status === 'arrived' || st.status === 'trip' || st.status === 'dropped';
      pageCar.classList.toggle('on', showCar);
      pageCar.innerHTML = vehicleSvg(preset.rides[st.ride].id, 28);
    }

    /* ===================== Sheet UI + Hold-to-Book ===================== */
    var barFillEl = null, barCarEl = null;
    function renderSheet() {
      var trip = tripInfo();
      var curRide = preset.rides[st.ride];
      var drv = preset.driver;
      var firstName = drv.name.split(' ')[0];
      barFillEl = null; barCarEl = null;

      if (st.status === 'idle' || st.status === 'finding') {
        var busy = st.status === 'finding';
        var ridesHtml = preset.rides.map(function (r, idx) {
          var sub = trip ? (moneyFmt(trip.fare * r.price) + ' · ' + (st.reading.etas[idx] || 1) + 'm') : ((st.reading.etas[idx] || 1) + ' min');
          return '<button type="button" class="gr-ride-btn gr-focus" role="radio" aria-checked="' + (idx === st.ride) + '" data-ride-idx="' + idx + '"' + (busy ? ' disabled' : '') + '>' +
            rideMiniIcon(r.id) + '<b>' + r.label + '</b><span>' + sub + '</span></button>';
        }).join('');
        var holdLbl = busy ? 'Finding your driver…' : ('Hold to book ' + curRide.label);
        sheetEl.innerHTML =
          '<span class="gr-handle" aria-hidden="true"></span>' +
          '<div class="gr-sh-row"><p class="gr-sh-title">' + (trip ? ('Ride to ' + trip.name) : 'Choose a ride') + '</p>' +
            '<span class="gr-sh-meta">' + (trip ? (trip.minutes + ' min trip') : (st.reading.nearby + ' nearby')) + '</span></div>' +
          '<div class="gr-rides" role="radiogroup" aria-label="Ride type">' + ridesHtml + '</div>' +
          '<div class="gr-pay-row"><span class="gr-pay-badge">' + preset.payment.method + '</span><span>' + preset.payment.note + '</span></div>' +
          '<button type="button" class="gr-hold gr-focus" data-gr-hold' + (busy ? ' disabled' : '') + ' aria-label="' + holdLbl + '. Press and hold or press Enter">' +
            '<span class="gr-hold-fill" data-gr-hfill></span>' +
            '<span class="gr-hold-txt">' + holdLbl + '</span>' +
            '<span class="gr-hold-txt-on" data-gr-htxt aria-hidden="true">' + holdLbl + '</span>' +
            '<span class="gr-hold-car" data-gr-hcar aria-hidden="true">' + vehicleSvg(curRide.id, 22) + '</span>' +
          '</button>';

        sheetEl.querySelectorAll('[data-ride-idx]').forEach(function (b) {
          b.addEventListener('click', function () {
            if (st.status !== 'idle') return;
            st.ride = +b.dataset.rideIdx;
            chime(540, 680, 0.08);
            updateFlagAndSearch();
            renderSheet();
          });
        });

        var holdBtn = sheetEl.querySelector('[data-gr-hold]');
        if (holdBtn && !busy) wireHoldButton(holdBtn);
      } else if (st.status === 'coming' || st.status === 'arrived') {
        sheetEl.innerHTML =
          '<span class="gr-handle" aria-hidden="true"></span>' +
          '<div class="gr-drv-top">' +
            '<span class="gr-drv-av">' + drv.initials + '</span>' +
            '<span><span class="gr-drv-name">' + drv.name + '</span><span class="gr-drv-sub">★ ' + drv.rating + ' · ' + drv.trips + '</span></span>' +
            '<span class="gr-drv-r"><span class="gr-plate">' + drv.plate + '</span><span class="gr-veh">' + curRide.vehicle + '</span></span>' +
          '</div>' +
          '<div class="gr-eta-row"><p class="gr-eta-big" data-gr-eta>' + (st.status === 'arrived' ? 'Your ride is here' : ('Arriving in ' + st.reading.minutes + ' min')) + '</p><span class="gr-pin-code">PIN <b>' + drv.pin + '</b></span></div>' +
          '<div class="gr-bar" aria-hidden="true"><span class="gr-bar-dot"></span><span class="gr-bar-track"><span class="gr-bar-fill" data-gr-bfill></span><span class="gr-bar-car" data-gr-bcar>' + vehicleSvg(curRide.id, 18) + '</span></span>' + PIN_ICO + '</div>' +
          '<div class="gr-mini-acts"><span class="gr-mini-act">Call</span><span class="gr-mini-act">Chat</span><span class="gr-mini-act">Share</span><span class="gr-mini-act">Safety</span></div>';
        barFillEl = sheetEl.querySelector('[data-gr-bfill]');
        barCarEl = sheetEl.querySelector('[data-gr-bcar]');
      } else if (st.status === 'trip') {
        sheetEl.innerHTML =
          '<span class="gr-handle" aria-hidden="true"></span>' +
          '<span style="font:700 9.5px var(--f-mono,monospace);letter-spacing:.08em;text-transform:uppercase;color:var(--gr-grey)">On your trip</span>' +
          '<p class="gr-eta-big" style="margin-top:4px" data-gr-eta>' + st.reading.minutes + ' min to ' + (trip ? trip.name : 'Destination') + '</p>' +
          '<div class="gr-bar" aria-hidden="true"><span class="gr-bar-dot"></span><span class="gr-bar-track"><span class="gr-bar-fill" data-gr-bfill></span><span class="gr-bar-car" data-gr-bcar>' + vehicleSvg(curRide.id, 18) + '</span></span>' + FLAG_ICO + '</div>' +
          '<div class="gr-sh-row" style="margin-top:5px"><span class="gr-sh-meta">' + st.reading.district + '</span><span class="gr-sh-meta">' + (trip ? trip.name : '') + '</span></div>' +
          '<div class="gr-pay-row"><span class="gr-pay-badge">' + preset.payment.method + '</span><b style="color:var(--gr-ink)">' + (trip ? moneyFmt(trip.fare * curRide.price) : '') + '</b><span style="margin-left:auto">' + firstName + '</span></div>';
        barFillEl = sheetEl.querySelector('[data-gr-bfill]');
        barCarEl = sheetEl.querySelector('[data-gr-bcar]');
      } else if (st.status === 'dropped') {
        var starsHtml = '';
        for (var s = 1; s <= 5; s++) {
          starsHtml += '<button type="button" class="gr-star' + (s <= st.rating ? ' on' : '') + '" data-star="' + s + '" aria-label="' + s + ' star' + (s > 1 ? 's' : '') + '">★</button>';
        }
        sheetEl.innerHTML =
          '<span class="gr-handle" aria-hidden="true"></span>' +
          '<div class="gr-done-box">' +
            '<span class="gr-done-ico">' + CHECK_ICO + '</span>' +
            '<p class="gr-eta-big">Welcome to ' + (trip ? trip.name : 'Destination') + '</p>' +
            '<span class="gr-sh-meta">Paid ' + (trip ? moneyFmt(trip.fare * curRide.price) : '') + ' with ' + preset.payment.method + '</span>' +
            '<div class="gr-rate-row"><span data-gr-ratelbl>' + (st.rating ? 'Thanks for riding!' : ('Rate ' + firstName)) + '</span><span class="gr-stars">' + starsHtml + '</span></div>' +
            '<button type="button" class="gr-again-btn gr-focus" data-gr-again>Book another ride</button>' +
          '</div>';
        sheetEl.querySelectorAll('[data-star]').forEach(function (sb) {
          sb.addEventListener('click', function () {
            st.rating = +sb.dataset.star;
            chime(440 + st.rating * 95, 620 + st.rating * 110, 0.11);
            renderSheet();
          });
        });
        var ag = sheetEl.querySelector('[data-gr-again]');
        if (ag) ag.addEventListener('click', resetRide);
      }
      updateFlagAndSearch();
    }

    function wireHoldButton(btn) {
      var fillEl = btn.querySelector('[data-gr-hfill]');
      var txtOn = btn.querySelector('[data-gr-htxt]');
      var carEl = btn.querySelector('[data-gr-hcar]');
      var val = 0, raf = 0, dir = 0, lastT = 0;

      function paint() {
        var pct = (val * 100).toFixed(2);
        fillEl.style.transform = 'scaleX(' + val.toFixed(4) + ')';
        txtOn.style.clipPath = 'inset(0 ' + (100 - val * 100).toFixed(2) + '% 0 0)';
        carEl.style.left = pct + '%';
        carEl.style.opacity = val > 0.04 ? '1' : '0';
      }
      function tick(now) {
        var dt = Math.min((now - lastT) / 1000, 0.05);
        lastT = now;
        if (dir > 0) {
          val = Math.min(1, val + dt / BOOKING_CFG.press);
          paint();
          if (val >= 1) { dir = 0; raf = 0; startBooking(); return; }
        } else if (dir < 0) {
          val = Math.max(0, val - dt / 0.24);
          paint();
          if (val <= 0) { dir = 0; raf = 0; return; }
        }
        if (dir !== 0) raf = requestAnimationFrame(tick);
        else raf = 0;
      }
      function begin(e) {
        if (e.button && e.button !== 0) return;
        e.stopPropagation();
        if (reduceMotion) { startBooking(); return; }
        dir = 1; lastT = performance.now();
        if (!raf) raf = requestAnimationFrame(tick);
      }
      function cancel() {
        if (val >= 1) return;
        dir = -1; lastT = performance.now();
        if (!raf) raf = requestAnimationFrame(tick);
      }
      btn.addEventListener('pointerdown', begin);
      btn.addEventListener('pointerup', cancel);
      btn.addEventListener('pointerleave', cancel);
      btn.addEventListener('pointercancel', cancel);
      btn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startBooking(); }
      });
    }

    function startBooking() {
      if (!st.fleet || !st.city || st.status !== 'idle') return;
      st.status = 'finding';
      st.rating = 0;
      chime(520, 880, 0.14);
      renderSheet();
      var focus = getPhoneFocus();
      triggerPulse(focus.worldX, focus.worldY);
      notifyStatus();
      var pickup = st.city.nearestNode(focus.worldX, focus.worldY);
      var fleetRef = st.fleet;
      schedule(function () {
        if (st.fleet !== fleetRef || st.destroyed) return;
        st.fleet.dispatch(pickup, preset.rides[st.ride].id);
        st.status = 'coming';
        chime(660, 1040, 0.15);
        renderSheet();
        notifyStatus();
      }, BOOKING_CFG.search * 1000);
    }

    function resetRide() {
      clearTimers();
      if (st.fleet) st.fleet.release();
      st.status = 'idle';
      st.dropoff = null;
      st.rating = 0;
      st.progress = 0;
      renderSheet();
      notifyStatus();
    }

    function pickRandomTrip() {
      if (!st.city) return;
      resetRide();
      var focus = getPhoneFocus();
      var curDist = st.city.districtAt(focus.worldX, focus.worldY);
      var pool = preset.districts.filter(function (x) { return x.name !== curDist; });
      var pick = pool[Math.floor(Math.random() * pool.length)] || preset.districts[0];
      st.dropoff = st.city.nearestNode(pick.x * st.city.width, pick.y * st.city.height);
      chime(600, 920, 0.1);
      updateFlagAndSearch();
      renderSheet();
    }

    /* ===================== Rebuild City ===================== */
    function rebuildCity() {
      var w = stage.offsetWidth || window.innerWidth || 1000;
      var h = stage.offsetHeight || 680;
      if (w < 40 || h < 40) return;
      var sp = w >= 1800 ? CITY_CFG.spacingLarge : (w >= 1024 ? CITY_CFG.spacing : CITY_CFG.spacingSmall);
      clearTimers();
      st.city = createCity(w, h, sp, preset);
      st.river = riverPath(w, h);
      st.parks = preset.parks.map(function (p) { return st.city.nearestNode(p.x * w, p.y * h); });
      st.fleet = createFleet(st.city, preset.rides);
      st.status = 'idle';
      st.dropoff = null;

      paperPlan.innerHTML = buildCitySvg('ink', st.city, st.river, st.parks, preset);
      lensMap.innerHTML = buildCitySvg('app', st.city, st.river, st.parks, preset);

      districtsHost.innerHTML = '';
      districtEls = [];
      preset.districts.forEach(function (item) {
        var el = d.createElement('span');
        el.className = 'gr-district';
        el.textContent = item.name;
        el.style.left = (item.x * 100).toFixed(2) + '%';
        el.style.top = (item.y * 100).toFixed(2) + '%';
        districtsHost.appendChild(el);
        districtEls.push({ name: item.name, el: el });
      });

      lensCarsHost.innerHTML = '';
      carSlots = [];
      for (var i = 0; i < CARS_CFG.count; i++) {
        var slot = d.createElement('div');
        slot.className = 'gr-lens-car-slot';
        slot.innerHTML = vehicleSvg(preset.rides[i % preset.rides.length].id, 24);
        lensCarsHost.appendChild(slot);
        carSlots.push(slot);
      }

      if (!st.phonePos.custom) placePhoneDefault();
      else { clampPhonePos(); syncPhoneTransform(); }

      renderSheet();
    }

    /* ===================== Dragging the Phone Lens ===================== */
    sheetEl.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    phoneSpot.addEventListener('pointerdown', function (e) {
      if (e.button && e.button !== 0) return;
      if (e.target.closest && e.target.closest('.gr-sheet')) return;
      st.drag.on = true;
      st.drag.sx = e.clientX;
      st.drag.sy = e.clientY;
      st.drag.ox = st.phonePos.x;
      st.drag.oy = st.phonePos.y;
      st.phonePos.custom = true;
      phoneSpot.classList.add('dragging');
      if (phoneSpot.setPointerCapture) { try { phoneSpot.setPointerCapture(e.pointerId); } catch (err) {} }
    });
    phoneSpot.addEventListener('pointermove', function (e) {
      if (!st.drag.on) return;
      st.phonePos.x = st.drag.ox + (e.clientX - st.drag.sx);
      st.phonePos.y = st.drag.oy + (e.clientY - st.drag.sy);
      clampPhonePos();
      syncPhoneTransform();
    });
    function endDrag(e) {
      if (!st.drag.on) return;
      st.drag.on = false;
      phoneSpot.classList.remove('dragging');
      if (phoneSpot.releasePointerCapture) { try { phoneSpot.releasePointerCapture(e.pointerId); } catch (err) {} }
    }
    phoneSpot.addEventListener('pointerup', endDrag);
    phoneSpot.addEventListener('pointercancel', endDrag);

    /* ===================== Paper Map Hover & Tap-to-Drop-Flag ===================== */
    function isOverCopy(cx, cy) {
      var r = copyEl.getBoundingClientRect();
      return cx > r.left - 24 && cx < r.right + 24 && cy > r.top - 24 && cy < r.bottom + 24;
    }
    stage.addEventListener('pointermove', function (e) {
      if (!st.city || e.pointerType !== 'mouse' || st.drag.on) return;
      var overPhone = !!(e.target.closest && e.target.closest('.gr-phone-spot'));
      var free = !overPhone && st.status === 'idle' && !isOverCopy(e.clientX, e.clientY);
      var box = stage.getBoundingClientRect();
      var px = e.clientX - box.left, py = e.clientY - box.top;
      cursorEl.style.transform = 'translate3d(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px,0)';
      cursorEl.style.opacity = free ? '1' : '0';
      stage.style.cursor = free ? 'crosshair' : '';
      var name = free ? st.city.districtAt(px, py) : null;
      if (name !== st.hover) {
        st.hover = name;
        cursorTag.textContent = name ? ('Go to ' + name) : '';
        districtEls.forEach(function (dObj) {
          dObj.el.classList.toggle('gr-district-hover', dObj.name === name && dObj.name !== st.reading.district);
        });
      }
    });
    stage.addEventListener('pointerleave', function () {
      cursorEl.style.opacity = '0';
      stage.style.cursor = '';
      st.hover = null;
    });
    stage.addEventListener('click', function (e) {
      if (!st.city || st.status !== 'idle') return;
      if (e.target.closest && e.target.closest('.gr-phone-spot')) return;
      if (isOverCopy(e.clientX, e.clientY)) return;
      var box = stage.getBoundingClientRect();
      st.dropoff = st.city.nearestNode(e.clientX - box.left, e.clientY - box.top);
      chime(620, 880, 0.09);
      updateFlagAndSearch();
      renderSheet();
    });

    /* ===================== Top Bar & Quick Actions ===================== */
    root.querySelectorAll('[data-gr-preset]').forEach(function (b) {
      b.addEventListener('click', function () {
        var pid = b.dataset.grPreset;
        if (!PRESETS[pid] || pid === preset.id) return;
        preset = PRESETS[pid];
        root.dataset.preset = pid;
        root.querySelectorAll('[data-gr-preset]').forEach(function (x) {
          var on = x === b;
          x.classList.toggle('on', on);
          x.setAttribute('aria-pressed', String(on));
        });
        applyBrandCopy();
        rebuildCity();
        chime(500, 760, 0.1);
      });
    });

    var themeBtn = root.querySelector('[data-gr-act="theme"]');
    function syncThemeUI() {
      var dark = root.dataset.theme === 'dark';
      themeBtn.textContent = dark ? 'Daylight' : 'Midnight';
      themeBtn.classList.toggle('on', dark);
      themeBtn.setAttribute('aria-pressed', String(dark));
    }
    themeBtn.addEventListener('click', function () {
      root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      syncThemeUI();
      chime(440, 620, 0.08);
    });
    syncThemeUI();

    var soundBtn = root.querySelector('[data-gr-act="sound"]');
    soundBtn.addEventListener('click', function () {
      cfg.sound = !cfg.sound;
      soundBtn.textContent = cfg.sound ? 'Sound · On' : 'Sound · Off';
      soundBtn.classList.toggle('on', cfg.sound);
      soundBtn.setAttribute('aria-pressed', String(cfg.sound));
      if (cfg.sound) chime(660, 990, 0.1);
    });

    var xrayBtns = root.querySelectorAll('[data-gr-act="xray"], [data-gr-act="xray-cta"]');
    function setXray(on, silent) {
      st.xray = !!on;
      root.classList.toggle('gr-xray', st.xray);
      xrayBtns.forEach(function (b) {
        b.classList.toggle('on', st.xray);
        b.setAttribute('aria-pressed', String(st.xray));
      });
      if (statusREl) statusREl.textContent = st.xray ? 'SAT · X-RAY' : (st.orbital ? 'ORBITAL · 5G' : '5G · 100%');
      notifyStatus();
      if (!silent && typeof cfg.onXrayToggle === 'function') {
        try { cfg.onXrayToggle(st.xray); } catch (e) {}
      }
    }
    xrayBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        setXray(!st.xray, false);
        chime(st.xray ? 740 : 480, st.xray ? 1080 : 360, 0.11);
      });
    });

    root.querySelector('[data-gr-act="random"]').addEventListener('click', pickRandomTrip);
    root.querySelector('[data-gr-act="quick-book"]').addEventListener('click', pickRandomTrip);
    root.querySelector('[data-gr-act="center"]').addEventListener('click', function () {
      placePhoneDefault();
      chime(520, 680, 0.08);
    });

    /* ===================== Phrase & Live Ticker Timers ===================== */
    var ORB_PHRASES = ['satellite-locked KL.', 'x-raying the grid.', 'locked from orbit.', 'live street telemetry.'];
    var phraseIdx = 0, cityIdx = 0, liveVal = preset.liveCities[0].rides;
    var tickerTimer = 0, phraseTimer = 0;
    if (!reduceMotion) {
      phraseTimer = setInterval(function () {
        if (!st.onScreen || d.hidden) return;
        var list = st.orbital ? ORB_PHRASES : preset.phrases;
        phraseIdx = (phraseIdx + 1) % list.length;
        var el = q('phrase');
        el.classList.add('swap');
        setTimeout(function () {
          if (st.destroyed) return;
          el.textContent = list[phraseIdx];
          el.classList.remove('swap');
        }, 260);
      }, 3200);

      var tickStep = 0;
      tickerTimer = setInterval(function () {
        if (!st.onScreen || d.hidden) return;
        tickStep++;
        if (tickStep % 3 === 0) {
          cityIdx = (cityIdx + 1) % preset.liveCities.length;
          liveVal = preset.liveCities[cityIdx].rides;
          q('tick-city').textContent = preset.liveCities[cityIdx].name;
        } else {
          liveVal = Math.max(120, liveVal + Math.round(Math.random() * 16) - 6);
        }
        q('tick-num').textContent = liveVal.toLocaleString('en-US');
      }, 1300);
    }

    /* ===================== Main Simulation Loop ===================== */
    function tick(now) {
      if (st.destroyed) { st.raf = 0; return; }
      var dt = Math.min((now - st.last) / 1000, 0.05);
      st.last = now;

      if (st.city && st.fleet) {
        if (!reduceMotion) st.fleet.step(dt);
        else if (st.fleet.state.assigned >= 0 && !st.fleet.state.arrived) st.fleet.finish();

        var focus = getPhoneFocus();
        function toScreen(pt) {
          return {
            x: (pt.x - focus.worldX) * LENS_CFG.zoom + focus.pinX,
            y: (pt.y - focus.worldY) * LENS_CFG.zoom + focus.pinY
          };
        }

        lensMap.style.transform = 'translate3d(' + (focus.pinX - focus.worldX * LENS_CFG.zoom).toFixed(1) + 'px,' +
          (focus.pinY - focus.worldY * LENS_CFG.zoom).toFixed(1) + 'px,0) scale(' + LENS_CFG.zoom + ')';

        for (var i = 0; i < st.fleet.cars.length; i++) {
          var car = st.fleet.cars[i];
          var sc = toScreen(st.fleet.position(car));
          if (carSlots[i]) {
            carSlots[i].style.transform = 'translate3d(' + sc.x.toFixed(1) + 'px,' + sc.y.toFixed(1) + 'px,0) rotate(' + car.heading.toFixed(3) + 'rad)';
          }
        }

        var carPos = null;
        if (st.fleet.state.assigned >= 0) {
          var ac = st.fleet.cars[st.fleet.state.assigned];
          carPos = st.fleet.position(ac);
          pageCar.style.transform = 'translate3d(' + carPos.x.toFixed(1) + 'px,' + carPos.y.toFixed(1) + 'px,0) rotate(' + ac.heading.toFixed(3) + 'rad)';
        }

        var rt = st.fleet.route();
        st.progress = st.fleet.state.total > 0 ? Math.max(0, Math.min(1, 1 - st.fleet.state.left / st.fleet.state.total)) : 0;
        if (barFillEl) barFillEl.style.width = (st.progress * 100).toFixed(1) + '%';
        if (barCarEl) barCarEl.style.left = (st.progress * 100).toFixed(1) + '%';

        lensRoute.setAttribute('d', rt.length > 1 ? pathFrom(rt.map(toScreen)) : '');
        pageRoute.setAttribute('d', rt.length > 1 ? pathFrom(rt) : '');

        var node = st.city.nearestNode(focus.worldX, focus.worldY);
        var planning = st.status === 'idle' || st.status === 'finding';
        var prevPts = (st.dropoff && planning) ? [node].concat(walk(node, st.dropoff)).map(function (n) { return st.city.toWorld(n.i, n.j); }) : [];
        lensPreview.setAttribute('d', prevPts.length > 1 ? pathFrom(prevPts.map(toScreen)) : '');
        pagePreview.setAttribute('d', prevPts.length > 1 ? pathFrom(prevPts) : '');

        var nextDistrict = st.city.districtAt(focus.worldX, focus.worldY);
        var etas = preset.rides.map(function (r) {
          return Math.max(1, Math.ceil(st.fleet.nearest(node, r.id).blocks * CARS_CFG.minutesPerBlock));
        });
        var nearby = st.fleet.countNear(node, CARS_CFG.nearby);
        var mins = Math.max(1, Math.ceil(st.fleet.state.left * CARS_CFG.minutesPerBlock));
        var blks = st.dropoff ? (Math.abs(st.dropoff.i - node.i) + Math.abs(st.dropoff.j - node.j)) : 0;
        var key = nextDistrict + '|' + etas.join(',') + '|' + nearby + '|' + mins + '|' + (planning ? blks : st.reading.blocks);

        if (key !== st.lastReadingKey) {
          st.lastReadingKey = key;
          st.reading = {
            district: nextDistrict,
            etas: etas,
            nearby: nearby,
            minutes: mins,
            blocks: planning ? blks : st.reading.blocks
          };
          districtEls.forEach(function (dObj) {
            dObj.el.classList.toggle('gr-district-on', dObj.name === nextDistrict);
          });
          updateFlagAndSearch();
          var etaNode = sheetEl.querySelector('[data-gr-eta]');
          if (etaNode && st.status === 'coming') etaNode.textContent = 'Arriving in ' + mins + ' min';
          if (etaNode && st.status === 'trip') {
            var tr = tripInfo();
            etaNode.textContent = mins + ' min to ' + (tr ? tr.name : 'Destination');
          }
          if (planning && !st.drag.on) {
            // Update ride button sub-labels lightly without resetting Hold-to-Book
            var trip = tripInfo();
            sheetEl.querySelectorAll('[data-ride-idx]').forEach(function (b, idx) {
              var spn = b.querySelector('span');
              if (spn) spn.textContent = trip ? (moneyFmt(trip.fare * preset.rides[idx].price) + ' · ' + (etas[idx] || 1) + 'm') : ((etas[idx] || 1) + ' min');
            });
          }
        }

        if (st.fleet.state.arrived && st.status === 'coming') {
          st.status = 'arrived';
          chime(784, 1046, 0.18);
          renderSheet();
          notifyStatus();
          schedule(function () {
            if (st.destroyed) return;
            if (st.dropoff && st.fleet) {
              st.fleet.driveTo(st.dropoff);
              st.status = 'trip';
              renderSheet();
              notifyStatus();
            } else {
              resetRide();
            }
          }, BOOKING_CFG.pickup * 1000);
        } else if (st.fleet.state.arrived && st.status === 'trip') {
          st.status = 'dropped';
          chime(880, 1318, 0.24);
          renderSheet();
          notifyStatus();
          schedule(function () {
            if (!st.destroyed && st.status === 'dropped') resetRide();
          }, BOOKING_CFG.hold * 1000);
        }

        if (st.orbital) {
          var nx = (focus.worldX / Math.max(1, st.city.width)) * 2 - 1;
          var ny = (focus.worldY / Math.max(1, st.city.height)) * 2 - 1;
          var lat = (3.1490 - ny * 0.022).toFixed(4);
          var lon = (101.7010 + nx * 0.028).toFixed(4);
          if (hudGpsEl) hudGpsEl.textContent = lat + '° N, ' + lon + '° E';
          if (hudLockEl) hudLockEl.textContent = 'LOCK: ' + nextDistrict.toUpperCase();
          if (typeof cfg.onFrame === 'function') {
            var dropPt = st.dropoff ? st.city.toWorld(st.dropoff.i, st.dropoff.j) : null;
            cfg.onFrame({
              stageRect: stage.getBoundingClientRect(),
              focusWorld: { x: focus.worldX, y: focus.worldY },
              focusNorm: { x: nx, y: ny },
              carWorld: carPos,
              dropoffWorld: dropPt,
              district: nextDistrict,
              status: st.status,
              xray: st.xray
            });
          }
        }
      }

      if (st.onScreen && !d.hidden) st.raf = requestAnimationFrame(tick);
      else st.raf = 0;
    }

    function syncLoop() {
      var run = st.onScreen && !d.hidden && !st.destroyed;
      if (run && !st.raf) { st.last = performance.now(); st.raf = requestAnimationFrame(tick); }
      else if (!run && st.raf) { cancelAnimationFrame(st.raf); st.raf = 0; }
    }

    var io = null, ro = null, lastW = 0;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (es) { st.onScreen = !!es[0].isIntersecting; syncLoop(); });
      io.observe(stage);
    }
    if ('ResizeObserver' in window) {
      ro = new ResizeObserver(function (es) {
        var nw = Math.round(es[0].contentRect.width);
        if (!nw || Math.abs(nw - lastW) < 4) return;
        lastW = nw;
        st.phonePos.custom = false;
        rebuildCity();
      });
      ro.observe(stage);
    }
    d.addEventListener('visibilitychange', syncLoop);

    applyBrandCopy();
    rebuildCity();
    syncLoop();

    return {
      el: root,
      getSatSlot: function () { return satSlotEl; },
      setOrbitalMode: function (on) {
        st.orbital = !!on;
        root.classList.toggle('gr-orbital', st.orbital);
        applyBrandCopy();
        st.phonePos.custom = false;
        setTimeout(function () { if (!st.destroyed) { placePhoneDefault(); } }, 30);
      },
      setXray: setXray,
      setSatTelemetry: function (info) {
        if (!info) return;
        if (info.name) {
          st.satCallsign = info.name;
          if (hudSatEl) hudSatEl.textContent = info.name;
          if (satBadgeEl && st.orbital) satBadgeEl.textContent = info.name.split('-')[0];
        }
        if (info.alt && hudAltEl) {
          st.satAlt = info.alt;
          hudAltEl.textContent = info.alt;
        }
      },
      triggerPulse: triggerPulse,
      recenter: placePhoneDefault,
      setTheme: function (t) { root.dataset.theme = t; syncThemeUI(); },
      setPreset: function (p) {
        var b = root.querySelector('[data-gr-preset="' + p + '"]');
        if (b) b.click();
      },
      destroy: function () {
        st.destroyed = true;
        clearTimers();
        clearInterval(phraseTimer);
        clearInterval(tickerTimer);
        cancelAnimationFrame(st.raf);
        if (io) io.disconnect();
        if (ro) ro.disconnect();
        d.removeEventListener('visibilitychange', syncLoop);
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }

  window.GoRide = { PRESETS: PRESETS, mount: mount };
})();
