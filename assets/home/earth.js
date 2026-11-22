/* earth.js: a real-imagery Earth seen as a limb from low orbit, in three.js (r128, already on the page). Reusable: the entry gate uses it
 * now; the logo reveal can mount the same thing later.
 *
 *   var e = OrbitEarth.mount(container, { base: '/assets/home/earth/', v: '20261122r', autoStart: true, onReady: fn });
 *   e.setView({ arc: .3, px: 0, py: 0, warp: 0, spin: 1 });   // arc: how high the limb rises (fraction of the screen height, from the bottom)
 *   e.render(dt);          // draw one frame (when autoStart is false; the gate drives it so it can snapshot in the same task)
 *   e.klScreen();          // {x, y, visible} of Kuala Lumpur in CSS px inside the container
 *   e.project(lat, lon);   // {x, y, visible} of any true lat/lon (degrees) in CSS px, from the matrices of the last render (valid at any zoom; see reg())
 *   e.canvas;  e.ready (Promise);  e.dispose();
 *
 * Camera (setView): arc, ax/ay (where Kuala Lumpur sits, NDC; default a spot on the lit limb), zoom (the globe grows about KL, 1 = orbit),
 * tilt (0 = KL on the limb, 1 = looking straight down at it, north up), pin (0 = the globe turns under KL, 1 = KL held still), sunK (swing the
 * sun toward the camera), px/py/warp/spin. The page's orbit stage (orbit.js) animates these from the scroll.
 * Space mode (o.space or e.setSpace(true)): an opaque deep-space backdrop with stars is drawn into the same canvas, so a second WebGL pass (the glass
 * reveal) can take the whole picture as a texture. e.attach(container) moves the canvas (the gate hands its Earth to the page this way);
 * e.render(dt, true) updates the pose and the projection without drawing (zoomed past what the textures can show). e.view is the live view.
 *
 * Layers: day map (NASA Blue Marble, public domain), a drifting cloud sphere, city lights on the night side, a specular ocean glint, a
 * sun terminator, a Fresnel rim on the globe and an analytic atmosphere glow around the limb. Transparent canvas (stars go behind it).
 * Own loop (autoStart) pauses when the tab is hidden or the canvas is off screen. DPR is capped at 1.5. Returns null without THREE/WebGL.
 * Earth: NASA 3D Resources (colour + normal maps, reprojected to equirectangular); clouds, ocean mask and city lights: NASA Visible Earth / Blue Marble.
 */
(function () {
  'use strict';
  var KL = { lat: 3.139, lon: 101.687 };

  /* The NASA colour map is not quite equirectangular: over South-East Asia its land sits up to 4 degrees east and about a degree north of the true
     lat/lon (the Malay peninsula's tip is drawn at 108 E, not 103.5 E; the old pin put Kuala Lumpur on Sumatra). This maps true lat/lon to map
     coordinates by an affine fit to the peninsula's and Borneo's coasts (mean error 0.15 degrees), fading to nothing beyond ~14-44 degrees from
     the fit centre, so pins, the gold outline and the rails all land on the visible map. */
  function reg(lat, lon) {
    var dla = lat - 4, dlo = (lon - 108) * .9, d = Math.sqrt(dla * dla + dlo * dlo), t = Math.min(1, Math.max(0, (d - 14) / 30)), w = 1 - t * t * (3 - 2 * t);
    var tl = 3.1692 - .0296 * lon + 1.1687 * lat, to = -1.5134 + 1.0497 * lon - .0388 * lat;
    return [lat + (tl - lat) * w, lon + (to - lon) * w];
  }

  var VERT = 'varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying vec3 vT; varying vec3 vB;\n' +
    'void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal);\n' +
    '  float a = uv.x * 6.2831853, th = (1.0 - uv.y) * 3.1415927; vec3 T = vec3(sin(a), 0.0, cos(a)), Bn = vec3(cos(a) * cos(th), sin(th), -sin(a) * cos(th));\n' +
    '  vT = normalize(mat3(modelMatrix) * T); vB = normalize(mat3(modelMatrix) * Bn); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
  var COMMON = 'uniform vec3 sun; uniform vec3 sphereC;\n' +
    'vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }\n';
  var EARTH_F = 'precision highp float; varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying vec3 vT; varying vec3 vB;\n' + COMMON +
    'uniform sampler2D dayMap, specMap, lightMap, normMap; uniform float uTime, uRelief;\n' +
    'void main(){\n' +
    '  vec3 N0 = normalize(vN), V = normalize(cameraPosition - vW);\n' +
    '  vec3 nm = texture2D(normMap, vUv).xyz * 2.0 - 1.0; vec3 N = normalize(N0 + (nm.x * vT + nm.y * vB) * uRelief * (1.0 - 0.8 * texture2D(specMap, vUv).r));\n' +
    '  float ndl = dot(N, sun), day = smoothstep(-0.10, 0.22, ndl);\n' +
    '  vec3 alb = lin(texture2D(dayMap, vUv).rgb);\n' +
    '  vec3 col = alb * (0.014 + 1.45 * max(ndl, 0.0)) * day;\n' +
    '  float oc = texture2D(specMap, vUv).r;\n' +
    '  vec3 R = reflect(-sun, N); float sp = pow(max(dot(R, V), 0.0), 48.0) * oc * 0.9 + pow(max(dot(R, V), 0.0), 9.0) * oc * 0.12;\n' +
    '  col += vec3(0.85, 0.93, 1.0) * sp * day;\n' +
    '  float twi = exp(-pow((ndl + 0.02) / 0.09, 2.0));\n' +
    '  col += vec3(1.0, 0.45, 0.16) * twi * 0.10 * (0.35 + alb.b);\n' +                       // sunset band along the terminator
    '  vec3 lights = lin(texture2D(lightMap, vUv).rrr) * vec3(1.6, 1.05, 0.55);\n' +
    '  col += lights * (1.0 - day) * 1.6;\n' +
    '  col += vec3(0.004, 0.009, 0.024) * (1.0 - day);\n' +
    '  float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);\n' +
    '  col += vec3(0.20, 0.50, 1.0) * fr * (0.15 + 1.4 * smoothstep(-0.25, 0.55, ndl)) * 0.95;\n' +
    '  col = col / (1.0 + col * 0.22);\n' +
    '  gl_FragColor = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);\n' +
    '}';
  var CLOUD_F = 'precision highp float; varying vec3 vN; varying vec3 vW; varying vec2 vUv;\n' + COMMON +
    'uniform sampler2D cloudMap;\n' +
    'void main(){\n' +
    '  vec3 N = normalize(vN), V = normalize(cameraPosition - vW);\n' +
    '  float ndl = dot(N, sun), day = smoothstep(-0.12, 0.3, ndl);\n' +
    '  float a = texture2D(cloudMap, vUv).r; a = smoothstep(0.08, 0.95, a);\n' +
    '  float edge = 1.0 - max(dot(N, V), 0.0);\n' +
    '  float lit = 0.05 + 1.15 * max(ndl, 0.0);\n' +
    '  vec3 col = vec3(0.92, 0.96, 1.0) * lit * day + vec3(0.02, 0.035, 0.07) * (1.0 - day);\n' +
    '  col += vec3(1.0, 0.55, 0.3) * exp(-pow((ndl + 0.02) / 0.08, 2.0)) * 0.12;\n' +
    '  gl_FragColor = vec4(col, clamp(a * (0.82 + edge * 0.3), 0.0, 0.95));\n' +
    '}';
  var HALO_F = 'precision highp float; varying vec3 vN; varying vec3 vW; varying vec2 vUv;\n' + COMMON +
    'uniform float uR;\n' +
    'void main(){\n' +
    '  vec3 O = cameraPosition, D = normalize(vW - O);\n' +
    '  float t = dot(sphereC - O, D); vec3 P = O + D * t - sphereC; float b = length(P) / uR;\n' +
    '  float h = max(b - 1.0, 0.0);\n' +
    '  float lit = smoothstep(-0.35, 0.55, dot(normalize(P), sun));\n' +
    '  float g = exp(-h / 0.014) * 0.95 + exp(-h / 0.05) * 0.5 + exp(-h / 0.16) * 0.16;\n' +
    '  vec3 c = mix(vec3(0.16, 0.42, 1.0), vec3(0.62, 0.86, 1.0), exp(-h / 0.02));\n' +
    '  c = mix(c, vec3(1.0, 0.62, 0.35), exp(-pow(dot(normalize(P), sun) / 0.12, 2.0)) * 0.35 * exp(-h / 0.03));\n' +
    '  float a = g * (0.08 + 0.92 * lit) * smoothstep(0.0, 0.004, b - 0.999);\n' +
    '  gl_FragColor = vec4(c * a, a);\n' +
    '}';

  function solveCenter(arc, zc, fov) {
    /* the sphere (radius 1) sits at (0, yc, -zc) below the camera; find yc so its silhouette top lands at `arc` of the screen height */
    var lo = -6, hi = 0, i, tf = Math.tan(fov / 2), want = 2 * arc - 1;
    for (i = 0; i < 40; i++) {
      var yc = (lo + hi) / 2, dist = Math.sqrt(yc * yc + zc * zc), top = Math.atan2(yc, zc) + Math.asin(Math.min(1, 1 / dist));
      var ndc = Math.tan(top) / tf;
      if (ndc > want) hi = yc; else lo = yc;
    }
    return (lo + hi) / 2;
  }

  function mount(container, o) {
    var T = window.THREE; o = o || {};
    if (!T || !container) return null;
    var renderer;
    try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch (e) { return null; }
    if (!renderer || !renderer.getContext()) return null;
    var cv = renderer.domElement; cv.className = (o.className || 'orbit-earth'); cv.setAttribute('aria-hidden', 'true');
    renderer.setClearColor(0x000000, 0); container.appendChild(cv);
    var scene = new T.Scene(), FOV = 40, ZC = 1.45;
    var cam = new T.PerspectiveCamera(FOV, 1, 0.05, 20);
    var base = o.base || '/assets/home/earth/', v = o.v ? '?v=' + o.v : '';
    var loader = new T.TextureLoader(), maxA = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    var pending = 5, failed = false, resolveReady, ready = new Promise(function (r) { resolveReady = r; });
    function tex(name) {
      var t = loader.load(base + name + v, function () { if (--pending === 0) { done(); } }, undefined, function () { failed = true; if (--pending === 0) done(); });
      t.anisotropy = maxA; t.wrapS = T.RepeatWrapping; return t;
    }
    var big = (window.innerWidth >= 900 || o.hd) && renderer.capabilities.maxTextureSize >= 4096, q = big ? '4k' : '2k';
    var day = tex('earth-day-' + q + '-2.webp'), norm = tex('earth-normal-' + q + '-1.webp'), spec = tex('earth-spec-1.webp'), lights = tex('earth-lights-1.webp'), clouds = tex('earth-clouds-1.webp');
    var isReady = false;
    function done() { isReady = true; resolveReady(!failed); if (o.onReady) o.onReady(!failed); if (!failed) kick(); }

    var sun = new T.Vector3(0.72, 0.5, 0.22).normalize(), C = new T.Vector3(0, -1.2, -ZC);
    var shared = { sun: { value: sun }, sphereC: { value: C } };
    function mat(frag, extra, opts) {
      var u = { sun: shared.sun, sphereC: shared.sphereC }, k; for (k in extra) u[k] = extra[k];
      var m = { uniforms: u, vertexShader: VERT, fragmentShader: frag }; for (k in opts) m[k] = opts[k]; return new T.ShaderMaterial(m);
    }
    var group = new T.Group(), earthMesh = new T.Mesh(new T.SphereGeometry(1, 128, 96), mat(EARTH_F, { dayMap: { value: day }, specMap: { value: spec }, lightMap: { value: lights }, normMap: { value: norm }, uTime: { value: 0 }, uRelief: { value: o.relief == null ? .9 : o.relief } }, {}));
    var cloudMesh = new T.Mesh(new T.SphereGeometry(1.012, 128, 96), mat(CLOUD_F, { cloudMap: { value: clouds } }, { transparent: true, depthWrite: false }));
    earthMesh.add(cloudMesh); group.add(earthMesh); scene.add(group);
    var halo = new T.Mesh(new T.SphereGeometry(1.3, 64, 48), mat(HALO_F, { uR: { value: 1 } }, { transparent: true, depthWrite: false, side: T.BackSide, blending: T.AdditiveBlending }));
    scene.add(halo);

    var view = { arc: o.arc == null ? .3 : o.arc, px: 0, py: 0, warp: 0, spin: o.spin == null ? 1 : o.spin, zoom: 1, tilt: 0, pin: 0, ax: null, ay: null, sunK: 0 };
    var sunA = new T.Vector3().copy(sun), sunB = new T.Vector3(0.28, 0.42, 0.86).normalize();
    var klLocal = (function () { var r = reg(KL.lat, KL.lon), u = (r[1] + 180) / 360, la = r[0] * Math.PI / 180; return new T.Vector3(-Math.cos(2 * Math.PI * u) * Math.cos(la), Math.sin(la), Math.sin(2 * Math.PI * u) * Math.cos(la)).normalize(); })();
    var W = 1, H = 1, time = 0, lastT = 0, raf = 0, disposed = false, visible = true, klv = new T.Vector3(), rayTmp = new T.Vector3(), spinA = 0;
    var Y = new T.Vector3(0, 1, 0), vA = new T.Vector3(), vB = new T.Vector3(), vC = new T.Vector3(), vD = new T.Vector3(), vE = new T.Vector3(), kP = new T.Vector3(), tP = new T.Vector3(), mA = new T.Matrix4(), mB = new T.Matrix4();
    var mWorld = new T.Matrix4(), mVP = new T.Matrix4(), hasM = false;

    /* ---- space: an opaque backdrop (vertical gradient + faint nebulae) and a few hundred stars, drawn into the same canvas ---- */
    var space = !!o.space, starPts = null, bgTex = null;
    function buildSpace() {
      if (starPts) return;
      var c = document.createElement('canvas'); c.width = 16; c.height = 256; var g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, '#02040c'); gr.addColorStop(1, '#070d22'); g.fillStyle = gr; g.fillRect(0, 0, 16, 256);
      bgTex = new T.CanvasTexture(c); bgTex.minFilter = bgTex.magFilter = T.LinearFilter; bgTex.generateMipmaps = false;
      var n = 560, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), seed = 17, i;
      function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
      for (i = 0; i < n; i++) {
        var z = 18 + rnd() * 34, b = .3 + .7 * rnd() * rnd() + .1, gold = rnd() < .07;
        pos[i * 3] = (rnd() * 2 - 1) * z * .85; pos[i * 3 + 1] = (rnd() * 2 - 1) * z * .6; pos[i * 3 + 2] = -z;
        col[i * 3] = b * (gold ? 1 : .86); col[i * 3 + 1] = b * (gold ? .82 : .92); col[i * 3 + 2] = b * (gold ? .48 : 1);
      }
      var geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3));
      starPts = new T.Points(geo, new T.PointsMaterial({ size: 1.8, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false }));
      starPts.frustumCulled = false; starPts.material.size = 1.7 * Math.min(window.devicePixelRatio || 1, 1.5); scene.add(starPts);
    }
    function applySpace() {
      if (space) { buildSpace(); scene.background = bgTex; starPts.visible = true; renderer.setClearAlpha(1); }
      else { scene.background = null; if (starPts) starPts.visible = false; renderer.setClearAlpha(0); }
    }
    applySpace();

    /* ---- the pose: the globe (radius s) is placed so that Kuala Lumpur lies on the camera ray through (ax, ay) at the same distance it has in
       the orbit view, so zooming keeps the camera 'altitude' fixed while the planet grows; tilt swings KL's normal from the limb toward the camera ---- */
    function layout() {
      var arc = view.arc - view.warp * .12, fovR = FOV * Math.PI / 180, yc = solveCenter(arc, ZC, fovR), s = Math.max(1, view.zoom);
      var ax = view.ax != null ? view.ax : (W < 640 ? .32 : .2), ay = view.ay != null ? view.ay : (2 * arc - 1) - .17;
      cam.updateMatrixWorld(); rayTmp.set(ax, ay, .5).unproject(cam).sub(cam.position).normalize();
      vA.set(0, yc, -ZC).sub(cam.position);                                     // camera -> base sphere centre
      var b = vA.dot(rayTmp), disc = b * b - (vA.dot(vA) - 1), tt = disc > 0 ? b - Math.sqrt(disc) : b;   // first hit of the ray on the unit orbit sphere
      vB.copy(rayTmp).multiplyScalar(tt).add(cam.position);                       // K: Kuala Lumpur's world position
      vC.copy(vB).sub(vA.set(0, yc, -ZC)).normalize();                            // surface normal there (orbit view)
      if (view.tilt > 0) { vD.copy(rayTmp).negate(); vC.lerp(vD, view.tilt).normalize(); }
      C.copy(vB).addScaledVector(vC, -s);                                         // globe centre
      /* orientation: KL's normal -> vC, KL's north -> screen up (world +Y projected), with the globe's own spin kept (1 - pin) */
      var an = spinA * view.pin;
      kP.copy(klLocal).applyAxisAngle(Y, an); tP.copy(Y).addScaledVector(kP, -Y.dot(kP)).normalize();
      vD.copy(tP).cross(kP);                                                      // east (local)
      mA.makeBasis(vD, tP, kP);
      vE.copy(Y).addScaledVector(vC, -Y.dot(vC)).normalize(); vD.copy(vE).cross(vC);   // east (world)
      mB.makeBasis(vD, vE, vC).multiply(mA.transpose());
      group.quaternion.setFromRotationMatrix(mB); group.scale.setScalar(s); group.position.copy(C);
      halo.position.copy(C); halo.scale.setScalar(s); halo.material.uniforms.uR.value = s;
      cam.far = Math.max(20, s * 3 + 60); cam.updateProjectionMatrix();
      sun.copy(sunA).lerp(sunB, view.sunK || 0).normalize();
    }
    function size() {
      var w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
      W = w; H = h; var pr = Math.min(window.devicePixelRatio || 1, 1.5); renderer.setPixelRatio(pr); renderer.setSize(w, h, false); if (starPts) starPts.material.size = 1.7 * pr;
      cam.aspect = w / h; cam.updateProjectionMatrix(); layout();
    }
    function render(dt, noDraw) {
      if (disposed || !isReady) return;
      time += dt || 0; spinA = time * .0035 * view.spin + spinBase;
      cam.rotation.y = -view.px * .012; cam.rotation.x = view.py * .008;
      earthMesh.rotation.y = spinA; cloudMesh.rotation.y = time * .0048 * view.spin;
      layout();
      group.updateMatrixWorld(true); cam.updateMatrixWorld(); cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
      mWorld.copy(earthMesh.matrixWorld); mVP.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); hasM = true;
      earthMesh.material.uniforms.uTime.value = time;
      if (starPts) { starPts.position.copy(cam.position); starPts.scale.setScalar(1 + Math.min(view.zoom, 12) * .04); }
      if (!noDraw) renderer.render(scene, cam);
    }
    var spinBase = 0;
    function loop(now) {
      raf = 0; if (disposed) return;
      var dt = Math.min(.05, (now - lastT) / 1000); lastT = now; render(dt);
      if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    }
    function kick() { if (o.autoStart === false || raf || disposed || !visible || document.hidden) return; lastT = performance.now(); raf = requestAnimationFrame(loop); }
    var io = null, ro = null;
    function watch() {
      if (io) io.disconnect(); if (ro) ro.disconnect();
      io = window.IntersectionObserver ? new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) kick(); }) : null; if (io) io.observe(container);
      ro = window.ResizeObserver ? new ResizeObserver(function () { size(); if (isReady && o.autoStart === false) render(0); }) : null; if (ro) ro.observe(container);
    }
    watch();
    function vis() { if (!document.hidden) kick(); } document.addEventListener('visibilitychange', vis);
    size();
    cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); });
    var pv = new T.Vector3();
    function projectLL(lat, lon) {
      if (!hasM) return { x: -9999, y: -9999, visible: false };
      var rg = reg(lat, lon), la = rg[0] * Math.PI / 180, lo = (rg[1] + 180) / 360, cl = Math.cos(la);
      pv.set(-Math.cos(2 * Math.PI * lo) * cl, Math.sin(la), Math.sin(2 * Math.PI * lo) * cl).applyMatrix4(mWorld);   // world position of the point
      var nx = pv.x - C.x, ny = pv.y - C.y, nz = pv.z - C.z, s = Math.max(1, view.zoom), cx = cam.position.x, cy = cam.position.y, cz = cam.position.z;
      var front = nx * (cx - pv.x) + ny * (cy - pv.y) + nz * (cz - pv.z) > 0;
      pv.applyMatrix4(mVP);
      return { x: (pv.x * .5 + .5) * W, y: (1 - (pv.y * .5 + .5)) * H, visible: front && pv.z < 1 };
    }

    return {
      canvas: cv, ready: ready, render: render, view: view, project: projectLL,
      setView: function (p) { var k; for (k in p) view[k] = p[k]; },
      setSpace: function (on) { space = !!on; applySpace(); },
      /* move the canvas to another container (and watch that one instead): the gate hands its Earth to the page this way */
      attach: function (c, className) {
        container = c; if (className) cv.className = className; c.appendChild(cv); watch(); size();
      },
      klScreen: function () { return projectLL(KL.lat, KL.lon); },
      dispose: function () {
        if (disposed) return; disposed = true; if (raf) cancelAnimationFrame(raf);
        if (io) io.disconnect(); if (ro) ro.disconnect(); document.removeEventListener('visibilitychange', vis);
        [earthMesh, cloudMesh, halo].forEach(function (m) { m.geometry.dispose(); m.material.dispose(); });
        if (starPts) { starPts.geometry.dispose(); starPts.material.dispose(); } if (bgTex) bgTex.dispose();
        [day, norm, spec, lights, clouds].forEach(function (t) { t.dispose(); });
        renderer.dispose(); try { var x = renderer.getContext().getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } catch (e) { /* gone */ }
        if (cv.parentNode) cv.parentNode.removeChild(cv);
      }
    };
  }
  window.OrbitEarth = { mount: mount };
})();
