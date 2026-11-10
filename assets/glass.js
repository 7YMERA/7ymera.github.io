/* Reeded-glass panel: one WebGL canvas, one fragment shader. No library.
   Draws only while on screen and while the tab is visible. Reduced motion = one still frame.
   Usage: Glass.mount(canvas, { src, flutes, strength, frost }) -> { set(k, v), swap(src), pause(bool) } */
(function () {
  var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var FS = [
    'precision mediump float;',
    'uniform sampler2D tex;uniform vec2 res,texRes,mouse;uniform float t,flutes,strength,frost,drift;',
    'float h(vec2 v){return fract(sin(dot(v,vec2(127.1,311.7)))*43758.5453);}',
    'vec2 cover(vec2 uv){float ra=res.x/res.y,ta=texRes.x/texRes.y;vec2 s=ra>ta?vec2(1.,ta/ra):vec2(ra/ta,1.);return (uv-.5)*s+.5;}',
    'vec3 grab(vec2 uv){return texture2D(tex,clamp(cover(uv),.001,.999)).rgb;}',
    'void main(){',
    ' vec2 uv=gl_FragCoord.xy/res;',
    ' float f=uv.x*flutes+drift;',            // flute coordinate: the glass slides slowly over the picture
    ' float loc=fract(f)-.5;',                // -.5..+.5 across one flute
    ' float lens=-loc*strength;',             // each flute is a cylinder lens: flips and squeezes the picture
    ' vec2 par=(mouse-.5)*.035;',
    ' vec2 base=uv+vec2(lens,0.)+par;',
    ' vec3 c=vec3(0.);',
    ' for(int i=0;i<8;i++){',                 // frost: eight taps on a spiral disc, a touch of noise to hide banding
    '  float a=float(i)*2.399+h(gl_FragCoord.xy)*.5;',
    '  vec2 o=vec2(cos(a),sin(a))*sqrt((float(i)+.5)/8.)*frost;',
    '  c.r+=grab(base+o+vec2(.004*strength,0.)).r;',   // slight colour fringe
    '  c.g+=grab(base+o).g;',
    '  c.b+=grab(base+o-vec2(.004*strength,0.)).b;',
    ' }',
    ' c/=8.;',
    ' vec3 n=normalize(vec3(loc*2.2,0.,1.));',        // flute surface normal
    ' vec3 L=normalize(vec3((mouse.x-.5)*2.,(mouse.y-.5)*2.,.7));',
    ' float spec=pow(max(dot(n,L),0.),14.)*.35;',
    ' float edge=smoothstep(.46,.5,abs(loc))*.22;',   // dark seam between flutes
    ' c=mix(c,vec3(1.),.06)-edge+spec;',
    ' vec2 g=abs(fract(gl_FragCoord.xy/18.)-.5);',     // fine grid
    ' float grid=smoothstep(.47,.5,max(g.x,g.y))*.10;',
    ' c+=grid;',
    ' gl_FragColor=vec4(c,1.);',
    '}'
  ].join('\n');

  function sh(gl, type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }

  function mount(cv, opt) {
    var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) { cv.dispatchEvent(new Event('glass-unsupported')); return null; }
    var st = { flutes: opt.flutes || 18, strength: opt.strength || .35, frost: opt.frost || .02, drift: 0, mx: .5, my: .5, tx: .5, ty: .5, on: false, paused: false, vis: true, raf: 0 };
    var pr = gl.createProgram(); gl.attachShader(pr, sh(gl, gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl, gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var U = {}; ['tex', 'res', 'texRes', 'mouse', 't', 'flutes', 'strength', 'frost', 'drift'].forEach(function (k) { U[k] = gl.getUniformLocation(pr, k); });
    var tex = gl.createTexture(), texSize = [1, 1], t0 = performance.now();
    function size() { var d = Math.min(devicePixelRatio || 1, 1.5), w = Math.round(cv.clientWidth * d), h = Math.round(cv.clientHeight * d); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); } }
    function draw(now) {
      size(); st.mx += (st.tx - st.mx) * .08; st.my += (st.ty - st.my) * .08;
      if (!calm && !st.paused) st.drift = (now - t0) / 1000 * .06;
      gl.uniform1i(U.tex, 0); gl.uniform2f(U.res, cv.width, cv.height); gl.uniform2f(U.texRes, texSize[0], texSize[1]);
      gl.uniform2f(U.mouse, st.mx, st.my); gl.uniform1f(U.t, now / 1000);
      gl.uniform1f(U.flutes, st.flutes); gl.uniform1f(U.strength, st.strength); gl.uniform1f(U.frost, st.frost); gl.uniform1f(U.drift, st.drift);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function loop(now) { st.raf = 0; draw(now); if (!calm && !st.paused && st.vis && !document.hidden) st.raf = requestAnimationFrame(loop); }
    function kick() { if (!st.raf) st.raf = requestAnimationFrame(loop); }
    function swap(src) {
      var im = new Image(); im.onload = function () {
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        texSize = [im.naturalWidth, im.naturalHeight]; cv.dataset.ready = '1'; kick();
      }; im.src = src;
    }
    cv.addEventListener('pointermove', function (e) { var r = cv.getBoundingClientRect(); st.tx = (e.clientX - r.left) / r.width; st.ty = 1 - (e.clientY - r.top) / r.height; if (calm) draw(performance.now()); else kick(); });
    cv.addEventListener('pointerleave', function () { st.tx = .5; st.ty = .5; });
    new IntersectionObserver(function (es) { st.vis = es[0].isIntersecting; if (st.vis) kick(); }).observe(cv);
    document.addEventListener('visibilitychange', kick);
    addEventListener('resize', function () { draw(performance.now()); });
    swap(opt.src);
    return {
      set: function (k, v) { st[k] = v; if (calm || st.paused) draw(performance.now()); else kick(); },
      swap: swap,
      pause: function (p) { st.paused = p; if (!p) kick(); }
    };
  }
  window.Glass = { mount: mount };
})();
