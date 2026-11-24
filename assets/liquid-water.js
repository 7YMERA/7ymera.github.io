/* liquid-water.js: Vanilla JS + WebGL1 port of Nimbus UI "Tidepool" (guglielmogiannattasio.it).
 * Exposes window.LiquidWater = { CARD_THEMES, WaterCard, Waterline, Checkout }.
 * Zero external dependencies. Pauses off-screen via IntersectionObserver, respects
 * prefers-reduced-motion, and falls back to CSS if WebGL1 is unavailable or lost. */
(function () {
  'use strict';
  var d = document;
  var uidSeq = 0;
  function nextId(prefix) { return (prefix || 'lw') + '-' + (++uidSeq); }

  /* ===================== themes (blue family + champagne gold, zero magenta/pink) ===================== */
  var CARD_THEMES = {
    sky: {
      a: [0.16, 0.46, 0.96],
      b: [0.04, 0.20, 0.68],
      w: [0.40, 0.70, 1.00],
      fg: '#ffffff',
      soft: 'rgba(255,255,255,.74)',
      back: 'linear-gradient(160deg,#2572f5,#08329e)'
    },
    glass: {
      a: [0.92, 0.95, 1.00],
      b: [0.74, 0.84, 0.98],
      w: [0.22, 0.50, 0.94],
      fg: '#0b1d45',
      soft: 'rgba(11,29,69,.64)',
      back: 'linear-gradient(160deg,#eef5ff,#bed6fa)'
    },
    deep: {
      a: [0.07, 0.13, 0.30],
      b: [0.02, 0.04, 0.12],
      w: [0.14, 0.48, 0.96],
      fg: '#f1f7ff',
      soft: 'rgba(241,247,255,.68)',
      back: 'linear-gradient(160deg,#14234a,#050a1c)'
    },
    gold: {
      a: [0.07, 0.11, 0.24],
      b: [0.02, 0.04, 0.11],
      w: [0.95, 0.76, 0.38],
      fg: '#fff8e6',
      soft: 'rgba(255,230,175,.74)',
      back: 'linear-gradient(160deg,#182442,#070b18)'
    }
  };

  /* ===================== WebGL1 helpers ===================== */
  function compileProgram(canvas, vertSrc, fragSrc, uniformNames) {
    var gl = null;
    try {
      gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    } catch (e) { return null; }
    if (!gl) return null;
    function sh(type, src) {
      var s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    }
    var vs = sh(gl.VERTEX_SHADER, vertSrc);
    var fs = sh(gl.FRAGMENT_SHADER, fragSrc);
    var p = gl.createProgram();
    if (!vs || !fs || !p) return null;
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
    gl.useProgram(p);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(p, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var u = {};
    for (var i = 0; i < uniformNames.length; i++) u[uniformNames[i]] = gl.getUniformLocation(p, uniformNames[i]);
    return { gl: gl, u: u };
  }

  /* ===================== 3D WaterCard shader ===================== */
  var CARD_VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  var CARD_FRAG = [
    'precision highp float;',
    'uniform vec2 uRes;uniform float uDpr;uniform float uTime;uniform vec2 uTilt;uniform float uLevel;uniform float uSlope;uniform float uWave;',
    'uniform vec3 uA;uniform vec3 uB;uniform vec3 uW;uniform float uR;uniform float uBub;uniform float uOk;uniform vec4 uRip[4];',
    'float sdRB(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}',
    'float caus(vec2 p,float t){vec2 q=p;float c=0.;for(int i=0;i<3;i++){q+=vec2(sin(q.y*1.1+t),cos(q.x*1.3-t*.7))*.6;c+=1./(1.+16.*abs(sin(q.x)*sin(q.y)));}return c/3.;}',
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float surfY(float x){',
    '  float rip=0.;for(int i=0;i<4;i++){vec4 R=uRip[i];if(R.w>0.){float dx=abs(x-R.x)-R.z*240.;rip+=R.w*exp(-R.z*1.8)*sin(dx*.13)*exp(-dx*dx/700.);}}',
    '  return uRes.y*(1.-uLevel)+uSlope*(x-uRes.x*.5)+uWave*sin(x*.045+uTime*2.6)+(.9+uWave*.25)*sin(x*.11-uTime*1.7)+rip*4.;}',
    'void main(){',
    '  vec2 p=vec2(gl_FragCoord.x,uRes.y*uDpr-gl_FragCoord.y)/uDpr;',
    '  vec2 c=uRes*.5;float d=sdRB(p-c,c-.5,uR);float m=smoothstep(.8,-.8,d);',
    '  if(m<=0.){gl_FragColor=vec4(0.);return;}',
    '  vec2 uv=p/uRes;',
    '  vec3 col=mix(uA,uB,clamp(uv.y*.75+uv.x*.4,0.,1.));',
    '  vec2 lp=vec2(.22-uTilt.x*.3,.15-uTilt.y*.3);vec2 q=(uv-lp)*vec2(1.5,2.3);',
    '  col+=.16*exp(-dot(q,q)*2.5);',
    '  float s=surfY(p.x);',
    '  float sd=p.y-s;',
    '  float under=smoothstep(-.8,.8,sd);',
    '  float depth=clamp(sd/uRes.y,0.,1.);',
    '  vec3 wc=mix(uW,uW*vec3(.42,.58,.86),depth*1.3);',
    '  float cs=caus(p*.042+vec2(uSlope*3.,uTime*.05),uTime*.9);',
    '  wc+=vec3(.88,.95,1.)*smoothstep(.55,1.,cs)*.38*(1.-depth*.7);',
    '  float bub=0.;',
    '  for(int i=0;i<7;i++){float fi=float(i);float bx=uRes.x*(.1+.8*hash(vec2(fi,3.1)));float sp=30.+40.*hash(vec2(fi,7.7));',
    '    float by=uRes.y-mod(uTime*sp+hash(vec2(fi,1.3))*uRes.y,uRes.y*1.2);float br=1.2+2.2*hash(vec2(fi,9.1));',
    '    vec2 bp=p-vec2(bx+sin(uTime*2.+fi)*3.,by);float bd=length(bp)-br;',
    '    bub+=(smoothstep(.8,-.8,bd)*.25+smoothstep(.8,0.,abs(bd))*.5)*step(s+br,by);}',
    '  wc+=vec3(1.)*bub*uBub;',
    '  col=mix(col,mix(col,wc,.74),under);',
    '  col+=vec3(1.)*(exp(-pow(sd+1.,2.)/2.)*.75+exp(-pow(sd-3.5,2.)/12.)*.14);',
    '  col=mix(col,col+vec3(-.02,.06,.03),uOk);',
    '  float ang=dot(uv-.5,normalize(vec2(1.,.55)))+uTilt.x*.32-uTilt.y*.22;',
    '  vec3 irid=mix(vec3(.56,.78,1.),vec3(1.,.93,.76),.5+.5*cos(6.2831*(ang*1.4+uTime*.03)));',
    '  float sheen=exp(-pow((ang-.06)/.07,2.))*.2+exp(-pow((ang+.3)/.025,2.))*.1;',
    '  col+=mix(vec3(1.),irid,.5)*sheen;',
    '  float rim=smoothstep(-7.,0.,d);',
    '  col=mix(col,mix(vec3(1.),irid,.62),rim*.16);',
    '  col+=smoothstep(-1.6,0.,d)*.35*(.35+.65*(1.-uv.y));',
    '  col+=(hash(p+fract(uTime))-.5)*.014;',
    '  gl_FragColor=vec4(col*m,m);',
    '}'
  ].join('\n');

  var CARD_UNIFORMS = ['uRes', 'uDpr', 'uTime', 'uTilt', 'uLevel', 'uSlope', 'uWave', 'uA', 'uB', 'uW', 'uR', 'uBub', 'uOk', 'uRip'];

  /* ===================== Waterline drop shader ===================== */
  var PAD = 14;
  var WL_VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  var WL_FRAG = [
    'precision highp float;',
    'uniform vec2 uRes;uniform float uDpr;uniform float uTime;uniform vec4 uCard;uniform float uCardR;',
    'uniform vec4 uBox[2];uniform float uBoxR[2];uniform vec4 uSat[4];uniform vec4 uRip[6];uniform vec3 uMouse;uniform vec3 uFront;',
    'uniform float uDark;uniform float uAmb;uniform float uBlue;uniform float uPanelRim;',
    'float sdRB(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}',
    'float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}',
    'float dropD(vec2 p){float d=1e4;',
    '  for(int i=0;i<2;i++){vec4 B=uBox[i];if(B.z>.5){vec2 q=p;',
    '    if(i==0){float f=exp(-pow(q.x-uFront.x,2.)/200.);q.x+=f*uFront.y*(sin(q.y*.2+uTime*7.)+.5*sin(q.y*.37-uTime*5.));}',
    '    d=smin(d,sdRB(q-B.xy,B.zw,uBoxR[i]),12.);}}',
    '  for(int i=0;i<4;i++){vec4 S=uSat[i];if(S.z>.5){d=smin(d,length(p-S.xy)-S.z,12.);}}',
    '  return d;}',
    'float cardD(vec2 p){vec2 h=uCard.zw*.5;return sdRB(p-uCard.xy-h,h,uCardR);}',
    'float lens(float d,float w){float t=clamp(-d/w,0.,1.);return sqrt(1.-(1.-t)*(1.-t));}',
    'float waves(vec2 p){float w=0.;',
    '  for(int i=0;i<6;i++){vec4 R=uRip[i];if(R.w>0.){float x=length(p-R.xy)-R.z*240.;w+=R.w*exp(-R.z*1.7)*sin(x*.3)*exp(-x*x/700.);}}',
    '  vec2 m=p-uMouse.xy;w+=uMouse.z*3.6*exp(-dot(m,m)/1400.);',
    '  w+=uAmb*(sin(p.x*.04+p.y*.02+uTime*1.1)*.45+sin(p.x*.11-uTime*.8+p.y*.13)*.25);return w;}',
    'float H(vec2 p){float dc=cardD(p);return lens(dc,18.)*2.4*uPanelRim+lens(dropD(p),11.)*7.5+waves(p)*smoothstep(0.,9.,-dc);}',
    'float caus(vec2 p,float t){vec2 q=p;float c=0.;for(int i=0;i<3;i++){q+=vec2(sin(q.y*1.1+t),cos(q.x*1.3-t*.7))*.6;c+=1./(1.+16.*abs(sin(q.x)*sin(q.y)));}return c/3.;}',
    'void main(){',
    '  vec2 p=vec2(gl_FragCoord.x,uRes.y*uDpr-gl_FragCoord.y)/uDpr;',
    '  float dp=cardD(p);if(dp>16.){gl_FragColor=vec4(0.);return;}',
    '  float dd=dropD(p);',
    '  float h0=H(p);vec3 n=normalize(vec3(h0-H(p+vec2(1.,0.)),h0-H(p+vec2(0.,1.)),1.));',
    '  vec3 V=vec3(0.,0.,1.);',
    '  float spec=pow(max(dot(reflect(-normalize(vec3(-.45,-.8,.85)),n),V),0.),70.);',
    '  float spec2=pow(max(dot(reflect(-normalize(vec3(.6,.75,.7)),n),V),0.),22.)*.3;',
    '  float fres=clamp((1.-n.z)*4.,0.,1.);',
    '  vec3 irid=mix(vec3(.58,.80,1.),vec3(1.,.93,.76),.5+.5*cos(6.2831*(fres*.75+p.x*.0024+p.y*.0014+uTime*.03)));',
    '  float pm=smoothstep(1.,-1.,dp);float dm=smoothstep(1.,-1.,dd)*smoothstep(1.,-2.,dp);',
    '  float sh=smoothstep(9.,-9.,dropD(p-vec2(0.,5.)))*(1.-dm)*pm*(.10+.07*uDark+.08*uBlue);',
    '  vec3 c=vec3(0.,.12,.38)*sh;float a=sh;',
    '  float pa=clamp(pm*(fres*.5+spec*.9+spec2)*uPanelRim,0.,1.);',
    '  c=mix(vec3(1.),irid,.5*fres)*pa+c*(1.-pa);a=pa+a*(1.-pa);',
    '  float th=lens(dd,11.);',
    '  float cs=caus((p+n.xy*th*18.)*.085,uTime*.9);',
    '  vec3 tint=mix(vec3(.78,.89,1.),vec3(.45,.72,1.),uDark);',
    '  float rim=dm*(1.-smoothstep(0.,8.,-dd));',
    '  float cres=dm*smoothstep(.12,.55,dot(n.xy,normalize(vec2(.55,.85))))*smoothstep(0.,3.,-dd);',
    '  float body=.5+.5*clamp(-n.y*3.,-1.,1.);',
    '  float da=dm*(.24+.13*body)*(1.-.3*uDark);vec3 dc=mix(tint,vec3(1.),body*.58);',
    '  vec3 bw=mix(vec3(.28,.66,1.),vec3(.04,.32,.88),clamp(.5-n.y*2.+th*.3,0.,1.));',
    '  dc=mix(dc,bw,uBlue);da=mix(da,dm*.92,uBlue);',
    '  float la=rim*.22;vec3 lc=mix(vec3(.04,.34,.82),vec3(.18,.52,.98),uDark);dc=lc*la+dc*da*(1.-la);da=la+da*(1.-la);',
    '  la=clamp(cres*.68+smoothstep(.6,1.,cs)*(.26+.24*uBlue)*th*dm,0.,1.);dc=vec3(1.)*la+dc*(1.-la);da=la+da*(1.-la);',
    '  la=clamp(dm*(spec*1.2+spec2*.5),0.,1.);dc=vec3(1.)*la+dc*(1.-la);da=la+da*(1.-la);',
    '  la=dm*smoothstep(-2.,0.,dd)*.38;dc=mix(vec3(1.),irid,.35)*la+dc*(1.-la);da=la+da*(1.-la);',
    '  c=dc+c*(1.-da);a=da+a*(1.-da);',
    '  gl_FragColor=vec4(c,a);',
    '}'
  ].join('\n');

  var WL_UNIFORMS = ['uRes', 'uDpr', 'uTime', 'uCard', 'uCardR', 'uBox', 'uBoxR', 'uSat', 'uRip', 'uMouse', 'uFront', 'uDark', 'uAmb', 'uBlue', 'uPanelRim'];

  /* ===================== tiny SVGs (unique IDs per instance) ===================== */
  function chipSvg(id) {
    return '<svg viewBox="0 0 40 30" width="100%" height="100%" aria-hidden="true">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F6E7B0"/><stop offset=".5" stop-color="#D9B865"/><stop offset="1" stop-color="#F3DE98"/></linearGradient></defs>' +
      '<rect x=".5" y=".5" width="39" height="29" rx="6" fill="url(#' + id + ')" stroke="rgba(120,90,20,.35)"/>' +
      '<path d="M14 .5v29M26 .5v29M.5 10h13.5M26 10h13.5M.5 20h13.5M26 20h13.5M14 15h12" stroke="rgba(120,90,20,.38)" fill="none"/></svg>';
  }
  var CONTACTLESS_SVG = '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M7.5 8.5a5 5 0 0 1 0 7M11 6a8.5 8.5 0 0 1 0 12M14.5 3.5a12 12 0 0 1 0 17"/></svg>';
  var CLOUD_SVG = '<svg viewBox="0 0 28 18" width="100%" height="100%" aria-hidden="true"><path d="M7.5 17h13.2a5.3 5.3 0 0 0 .8-10.5A7.2 7.2 0 0 0 7.8 5.4 5.8 5.8 0 0 0 7.5 17Z" fill="currentColor" opacity=".92"/></svg>';
  var LOCK_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  var CHECK_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="lc-check" d="m5.5 12.5 4.2 4.2L18.5 7.8"/></svg>';
  var CHECK_SM_SVG = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5.5 12.5 4.2 4.2L18.5 7.8"/></svg>';

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function barcodeHtml(seed) {
    var html = '<div class="nc-barcode" aria-hidden="true">';
    for (var i = 0; i < 34; i++) {
      var w = ((i * 7 + (seed || 3) * 3) % 3 === 0) ? 3 : 1.5;
      html += '<i style="width:' + w + 'px;flex:0 0 auto"></i>';
    }
    return html + '</div>';
  }

  /* ===================== WaterCard ===================== */
  function WaterCard(host, opts) {
    var cfg = Object.assign({
      mode: 'payment', // 'payment' | 'contact' | 'pilot'
      theme: 'sky',
      number: '•••• •••• •••• ••••',
      name: 'Your name',
      expiry: 'MM/YY',
      cvc: '•••',
      brand: '',
      // contact / pilot fields
      kicker: '7YMERA',
      badge: 'KL · MYT',
      title: 'Muhammad Alif Najmi',
      subtitle: 'Business Analyst · axrail.ai',
      metaLeftLabel: 'Base',
      metaLeftVal: 'Kuala Lumpur, MY',
      metaRightLabel: 'Focus',
      metaRightVal: 'BA · Systems · AI',
      backHead: '\\7YMERA · DIRECT CARD',
      backRows: [
        ['Email', 'alifnajmx@gmail.com'],
        ['Web', '7ymera.github.io'],
        ['Coords', '3.139° N · 101.687° E'],
        ['Role', 'BA @ axrail.ai']
      ],
      backFine: 'Click card to flip · splash the water',
      seed: 7,
      flipped: false,
      level: 0.42,
      bubbles: false,
      success: false,
      interactive: true,
      live: true,
      width: 340,
      clickFlip: false,
      onFlip: null
    }, opts || {});

    var chipId = nextId('nc-chip');
    var scene = d.createElement('div');
    scene.className = 'nc-scene';

    var shadow = d.createElement('div');
    shadow.className = 'nc-shadow';
    shadow.setAttribute('aria-hidden', 'true');

    var card = d.createElement('div');
    card.className = 'nc-card';

    var edge = d.createElement('div');
    edge.className = 'nc-edge';
    edge.setAttribute('aria-hidden', 'true');

    var front = d.createElement('div');
    front.className = 'nc-face nc-front';

    var canvas = d.createElement('canvas');
    canvas.className = 'nc-water';
    canvas.setAttribute('aria-hidden', 'true');

    var fallback = d.createElement('div');
    fallback.className = 'nc-fallback';
    fallback.setAttribute('aria-hidden', 'true');
    var fbWater = d.createElement('span');
    fallback.appendChild(fbWater);

    var ui = d.createElement('div');
    ui.className = 'nc-ui';

    var back = d.createElement('div');
    back.className = 'nc-face nc-back';
    back.setAttribute('aria-hidden', 'true');

    front.appendChild(canvas);
    front.appendChild(fallback);
    front.appendChild(ui);
    card.appendChild(edge);
    card.appendChild(front);
    card.appendChild(back);
    scene.appendChild(shadow);
    scene.appendChild(card);
    if (host) host.appendChild(scene);

    var refs = {};
    function buildMarkup() {
      if (cfg.mode === 'payment') {
        ui.innerHTML =
          '<div class="nc-top"><span class="nc-logo"><span class="nc-cloud">' + CLOUD_SVG + '</span>nimbus</span><span class="nc-cl">' + CONTACTLESS_SVG + '</span></div>' +
          '<span class="nc-chip">' + chipSvg(chipId) + '</span>' +
          '<div class="nc-num" data-nc="num"></div>' +
          '<div class="nc-bottom">' +
            '<div class="nc-field"><span class="nc-lbl">Card holder</span><span class="nc-val nc-name" data-nc="name"></span></div>' +
            '<div class="nc-field"><span class="nc-lbl">Expires</span><span class="nc-val" data-nc="exp"></span></div>' +
            '<span class="nc-brand" data-nc="brand"></span>' +
          '</div>';
        back.innerHTML =
          '<div class="nc-stripe"></div>' +
          '<div class="nc-sigrow"><div class="nc-sig"></div><div class="nc-cvc" data-nc="cvc"></div></div>' +
          '<p class="nc-fine">Tidepool demo card · ported to vanilla WebGL1</p>';
        refs.num = ui.querySelector('[data-nc="num"]');
        refs.name = ui.querySelector('[data-nc="name"]');
        refs.exp = ui.querySelector('[data-nc="exp"]');
        refs.brand = ui.querySelector('[data-nc="brand"]');
        refs.cvc = back.querySelector('[data-nc="cvc"]');
      } else {
        ui.innerHTML =
          '<div class="nc-top">' +
            '<span class="nc-logo"><span class="nc-mark7">\\7</span><span data-nc="kicker"></span></span>' +
            '<span class="nc-pill" data-nc="badge"></span>' +
          '</div>' +
          '<div class="nc-title-lg" data-nc="title"></div>' +
          '<div class="nc-subtitle" data-nc="subtitle"></div>' +
          '<div class="nc-bottom">' +
            '<div class="nc-field"><span class="nc-lbl" data-nc="mll"></span><span class="nc-val" data-nc="mlv"></span></div>' +
            '<div class="nc-field"><span class="nc-lbl" data-nc="mrl"></span><span class="nc-val" data-nc="mrv"></span></div>' +
            '<span class="nc-hint-flip">Flip &#8635;</span>' +
          '</div>';
        back.innerHTML =
          '<div class="nc-back-pad">' +
            '<div class="nc-back-head"><span class="nc-back-k" data-nc="bhead"></span><span class="nc-mark7">\\7</span></div>' +
            '<div class="nc-back-rows" data-nc="brows"></div>' +
            '<div data-nc="bbar"></div>' +
            '<p class="nc-fine" style="position:static" data-nc="bfine"></p>' +
          '</div>';
        refs.kicker = ui.querySelector('[data-nc="kicker"]');
        refs.badge = ui.querySelector('[data-nc="badge"]');
        refs.title = ui.querySelector('[data-nc="title"]');
        refs.subtitle = ui.querySelector('[data-nc="subtitle"]');
        refs.mll = ui.querySelector('[data-nc="mll"]');
        refs.mlv = ui.querySelector('[data-nc="mlv"]');
        refs.mrl = ui.querySelector('[data-nc="mrl"]');
        refs.mrv = ui.querySelector('[data-nc="mrv"]');
        refs.bhead = back.querySelector('[data-nc="bhead"]');
        refs.brows = back.querySelector('[data-nc="brows"]');
        refs.bbar = back.querySelector('[data-nc="bbar"]');
        refs.bfine = back.querySelector('[data-nc="bfine"]');
      }
    }
    buildMarkup();

    var st = {
      tilt: { x: 0, y: 0, vx: 0, vy: 0 },
      aim: { x: 0, y: 0, on: false },
      flip: { a: cfg.flipped ? 180 : 0, v: 0 },
      slope: { s: 0, v: 0 },
      lvl: { l: cfg.level, v: 0 },
      ok: cfg.success ? 1 : 0,
      rips: [],
      time: Math.random() * 10,
      last: 0,
      raf: 0,
      visible: true,
      reduce: !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches),
      glc: null,
      destroyed: false
    };

    var W = 340, H = 214, R = 18;
    function applyLayout() {
      var T = CARD_THEMES[cfg.theme] || CARD_THEMES.sky;
      W = Math.round(cfg.width || 340);
      H = Math.round(W / 1.586);
      R = Math.round(W * 0.052);
      scene.dataset.theme = cfg.theme;
      scene.style.width = W + 'px';
      scene.style.height = H + 'px';
      scene.style.fontSize = (W * 0.042).toFixed(2) + 'px';
      scene.style.setProperty('--nc-fg', T.fg);
      scene.style.setProperty('--nc-soft', T.soft);
      scene.style.setProperty('--nc-back', T.back);
      scene.style.setProperty('--nc-r', R + 'px');

      fallback.style.background = 'linear-gradient(160deg,rgb(' + T.a.map(function (v) { return Math.round(v * 255); }).join(',') + '),rgb(' + T.b.map(function (v) { return Math.round(v * 255); }).join(',') + '))';
      fbWater.style.height = '100%';
      fbWater.style.transform = 'scaleY(' + Math.max(0, Math.min(1, cfg.level)).toFixed(3) + ')';
      fbWater.style.background = 'rgba(' + T.w.map(function (v) { return Math.round(v * 255); }).join(',') + ',.55)';

      var dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      var cw = Math.round(W * dpr), ch = Math.round(H * dpr);
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
      }

      if (cfg.mode === 'payment') {
        refs.num.textContent = cfg.number;
        refs.name.textContent = cfg.name;
        refs.exp.textContent = cfg.expiry;
        refs.brand.textContent = cfg.brand;
        refs.cvc.textContent = cfg.cvc;
      } else {
        refs.kicker.textContent = cfg.kicker;
        refs.badge.textContent = cfg.badge;
        refs.title.textContent = cfg.title;
        refs.subtitle.textContent = cfg.subtitle;
        refs.mll.textContent = cfg.metaLeftLabel;
        refs.mlv.textContent = cfg.metaLeftVal;
        refs.mrl.textContent = cfg.metaRightLabel;
        refs.mrv.textContent = cfg.metaRightVal;
        refs.bhead.textContent = cfg.backHead;
        refs.brows.innerHTML = (cfg.backRows || []).map(function (r) {
          return '<div class="nc-back-row"><span>' + escHtml(r[0]) + '</span><b>' + escHtml(r[1]) + '</b></div>';
        }).join('');
        refs.bbar.innerHTML = cfg.mode === 'pilot' ? barcodeHtml(cfg.seed) : '';
        refs.bfine.textContent = cfg.backFine;
      }
    }

    function draw() {
      var tx = st.tilt.x, ty = st.tilt.y;
      var roll = tx * 2.2;
      card.style.transform = 'rotateX(' + (-ty * 13).toFixed(3) + 'deg) rotateY(' + (tx * 17 + st.flip.a).toFixed(3) + 'deg) rotateZ(' + roll.toFixed(3) + 'deg)';
      shadow.style.transform = 'translate(' + (tx * 14).toFixed(2) + 'px,' + (18 + ty * 8).toFixed(2) + 'px) scale(' + (0.92 - Math.abs(ty) * 0.04).toFixed(3) + ')';
      var g = st.glc;
      if (!g) return;
      var T = CARD_THEMES[cfg.theme] || CARD_THEMES.sky;
      var c = g.gl, u = g.u;
      var dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      c.viewport(0, 0, c.drawingBufferWidth, c.drawingBufferHeight);
      c.uniform2f(u.uRes, W, H);
      c.uniform1f(u.uDpr, dpr);
      c.uniform1f(u.uTime, st.time);
      c.uniform2f(u.uTilt, tx, ty);
      c.uniform1f(u.uLevel, st.lvl.l);
      c.uniform1f(u.uSlope, st.slope.s);
      c.uniform1f(u.uWave, st.reduce ? 0 : Math.min(1.2 + Math.abs(st.slope.v) * 6 + Math.abs(st.lvl.v) * 30, 6));
      c.uniform3fv(u.uA, T.a);
      c.uniform3fv(u.uB, T.b);
      c.uniform3fv(u.uW, T.w);
      c.uniform1f(u.uR, R);
      c.uniform1f(u.uBub, cfg.bubbles && !st.reduce ? 1 : 0);
      c.uniform1f(u.uOk, st.ok);
      var rips = new Float32Array(16);
      var recent = st.rips.slice(-4);
      for (var i = 0; i < recent.length; i++) {
        rips.set([recent[i].x, 0, recent[i].age, recent[i].amp], i * 4);
      }
      c.uniform4fv(u.uRip, rips);
      c.clearColor(0, 0, 0, 0);
      c.clear(c.COLOR_BUFFER_BIT);
      c.drawArrays(c.TRIANGLES, 0, 3);
    }

    function step(dt) {
      st.time += dt;
      var ax = st.aim.on ? st.aim.x : (st.reduce ? 0 : Math.sin(st.time * 0.7) * 0.18);
      var ay = st.aim.on ? st.aim.y : (st.reduce ? 0 : Math.sin(st.time * 0.53 + 1) * 0.12);
      if (st.reduce) {
        st.tilt.x = ax; st.tilt.y = ay;
      } else {
        st.tilt.vx += (60 * (ax - st.tilt.x) - 11 * st.tilt.vx) * dt;
        st.tilt.vy += (60 * (ay - st.tilt.y) - 11 * st.tilt.vy) * dt;
        st.tilt.x += st.tilt.vx * dt;
        st.tilt.y += st.tilt.vy * dt;
      }
      var fa = cfg.flipped ? 180 : 0;
      if (st.reduce) {
        st.flip.a = fa;
      } else {
        var before = st.flip.a;
        st.flip.v += (150 * (fa - st.flip.a) - 17 * st.flip.v) * dt;
        st.flip.a += st.flip.v * dt;
        if (Math.abs(fa - before) > 1) st.slope.v += (st.flip.v > 0 ? 1 : -1) * dt * 1.4;
      }
      var slopeT = -st.tilt.x * 0.075;
      if (st.reduce) {
        st.slope.s = slopeT;
      } else {
        st.slope.v += (26 * (slopeT - st.slope.s) - 1.6 * st.slope.v) * dt;
        st.slope.s += st.slope.v * dt;
      }
      st.slope.s = Math.max(-0.35, Math.min(0.35, st.slope.s));
      if (st.reduce) {
        st.lvl.l = cfg.level;
      } else {
        st.lvl.v += (14 * (cfg.level - st.lvl.l) - 5 * st.lvl.v) * dt;
        st.lvl.l += st.lvl.v * dt;
      }
      st.ok += ((cfg.success ? 1 : 0) - st.ok) * Math.min(1, dt * 4);
      for (var i = st.rips.length - 1; i >= 0; i--) {
        st.rips[i].age += dt;
        if (st.rips[i].age >= 2) st.rips.splice(i, 1);
      }
    }

    function loop() {
      if (st.raf || st.destroyed) return;
      st.last = performance.now();
      function tick(now) {
        if (st.destroyed) { st.raf = 0; return; }
        var dt = Math.min((now - st.last) / 1000, 1 / 30);
        st.last = now;
        step(dt);
        draw();
        var settling = Math.abs(st.flip.v) > 0.5 || Math.abs(st.lvl.v) > 0.002 || st.rips.length > 0 || st.aim.on;
        if (st.visible && cfg.live && (!st.reduce || settling)) st.raf = requestAnimationFrame(tick);
        else st.raf = 0;
      }
      st.raf = requestAnimationFrame(tick);
    }

    st.glc = compileProgram(canvas, CARD_VERT, CARD_FRAG, CARD_UNIFORMS);
    scene.dataset.gl = st.glc ? 'on' : 'off';
    function onLost(e) { e.preventDefault(); st.glc = null; scene.dataset.gl = 'off'; }
    canvas.addEventListener('webglcontextlost', onLost);

    var io = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (entries) {
        st.visible = !!entries[0].isIntersecting;
        if (st.visible) loop();
      });
      io.observe(scene);
    }

    function onMove(e) {
      if (!cfg.interactive || e.pointerType === 'touch') return;
      var r = scene.getBoundingClientRect();
      if (!r.width || !r.height) return;
      st.aim.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
      st.aim.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
      st.aim.on = true;
      loop();
    }
    function onLeave() { st.aim.on = false; loop(); }
    function onDown(e) {
      if (!cfg.interactive) return;
      var r = scene.getBoundingClientRect();
      st.rips.push({ x: e.clientX - r.left, age: 0, amp: 0.85 });
      if (cfg.clickFlip) {
        cfg.flipped = !cfg.flipped;
        if (typeof cfg.onFlip === 'function') cfg.onFlip(cfg.flipped);
      }
      loop();
    }
    scene.addEventListener('pointermove', onMove);
    scene.addEventListener('pointerleave', onLeave);
    scene.addEventListener('pointerdown', onDown);

    applyLayout();
    draw();
    loop();

    return {
      el: scene,
      update: function (next) {
        if (!next) return;
        Object.assign(cfg, next);
        applyLayout();
        draw();
        loop();
      },
      splash: function (x, amp) {
        if (st.reduce) return;
        st.rips.push({ x: x == null ? W / 2 : x, age: 0, amp: amp == null ? 1 : amp });
        st.lvl.v += 0.25 * (amp == null ? 1 : amp);
        loop();
      },
      flip: function (val) {
        cfg.flipped = typeof val === 'boolean' ? val : !cfg.flipped;
        if (typeof cfg.onFlip === 'function') cfg.onFlip(cfg.flipped);
        loop();
        return cfg.flipped;
      },
      destroy: function () {
        st.destroyed = true;
        cancelAnimationFrame(st.raf);
        if (io) io.disconnect();
        canvas.removeEventListener('webglcontextlost', onLost);
        scene.removeEventListener('pointermove', onMove);
        scene.removeEventListener('pointerleave', onLeave);
        scene.removeEventListener('pointerdown', onDown);
        if (scene.parentNode) scene.parentNode.removeChild(scene);
      }
    };
  }

  /* ===================== Waterline drop engine ===================== */
  function mkBox() { return { x: 0, y: 0, w: 0, h: 0, vx: 0, vy: 0, vw: 0, vh: 0 }; }

  function Waterline(panelEl, opts) {
    var cfg = Object.assign({
      getTarget: function () { return null; },
      tone: 'light',       // 'light' | 'dark'
      cardRadius: 28,
      panelRim: true,      // true for full glass panel, false for segmented control bars
      zIndex: -1,
      canvasClass: 'lc-water'
    }, opts || {});

    var canvas = d.createElement('canvas');
    canvas.className = cfg.canvasClass;
    canvas.setAttribute('aria-hidden', 'true');
    if (cfg.zIndex != null) canvas.style.zIndex = String(cfg.zIndex);
    panelEl.appendChild(canvas);

    var st = {
      a: mkBox(),
      b: mkBox(),
      lead: 0,
      lagUntil: 0,
      sats: [],
      rips: [],
      mouse: { x: 0, y: 0, s: 0, on: false },
      blue: 0,
      blueT: 0,
      moving: false,
      split: false,
      ready: false,
      w: 0,
      h: 0,
      ch: 0,
      visible: true,
      reduce: !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches),
      raf: 0,
      last: 0,
      time: 0,
      glc: null,
      destroyed: false
    };

    function draw() {
      var g = st.glc;
      if (!g || !st.w || !st.h) return;
      var head = st.lead === 0 ? st.a : st.b;
      var tail = st.lead === 0 ? st.b : st.a;
      var gap = Math.hypot(head.x - tail.x, head.y - tail.y) - (Math.min(head.w, head.h) + Math.min(tail.w, tail.h));
      var thin = Math.max(0, Math.min(1, (gap + 40) / 60));
      var T = cfg.getTarget();
      var R0 = T && T.r != null ? T.r : 14;
      function shape(B, k) {
        var w = B.w * (1 - k * thin), h = B.h * (1 - k * 0.4 * thin);
        return { w: w, h: h, r: Math.max(0, Math.min(R0 + (Math.min(w, h) - R0) * thin, w, h)) };
      }
      var hs = shape(head, 0.25), ts = shape(tail, 0.55);
      var c = g.gl, u = g.u;
      var dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      c.viewport(0, 0, c.drawingBufferWidth, c.drawingBufferHeight);
      c.uniform2f(u.uRes, st.w + PAD * 2, st.ch);
      c.uniform1f(u.uDpr, dpr);
      c.uniform1f(u.uTime, st.time);
      c.uniform4f(u.uCard, PAD, PAD, st.w, st.h);
      c.uniform1f(u.uCardR, cfg.cardRadius);
      var hon = hs.w > 1 && hs.h > 1, ton = ts.w > 1 && ts.h > 1;
      c.uniform4fv(u.uBox, new Float32Array([head.x, head.y, hon ? hs.w : 0, hs.h, tail.x, tail.y, ton ? ts.w : 0, ts.h]));
      c.uniform1fv(u.uBoxR, new Float32Array([hs.r, ts.r]));
      var sats = new Float32Array(16);
      for (var i = 0; i < Math.min(4, st.sats.length); i++) {
        sats.set([st.sats[i].x, st.sats[i].y, st.sats[i].r, 0], i * 4);
      }
      c.uniform4fv(u.uSat, sats);
      var rips = new Float32Array(24);
      var recent = st.rips.slice(-6);
      for (var j = 0; j < recent.length; j++) {
        rips.set([recent[j].x, recent[j].y, recent[j].age, recent[j].amp], j * 4);
      }
      c.uniform4fv(u.uRip, rips);
      c.uniform3f(u.uMouse, st.mouse.x, st.mouse.y, st.mouse.s);
      c.uniform3f(u.uFront, head.x + head.w, st.reduce ? 0 : Math.min(Math.abs(head.vw) * 0.01, 3.5), 0);
      c.uniform1f(u.uDark, cfg.tone === 'dark' ? 1 : 0);
      c.uniform1f(u.uAmb, st.reduce ? 0 : (cfg.panelRim ? 1 : 0.45));
      c.uniform1f(u.uBlue, st.blue);
      c.uniform1f(u.uPanelRim, cfg.panelRim ? 1 : 0);
      c.clearColor(0, 0, 0, 0);
      c.clear(c.COLOR_BUFFER_BIT);
      c.drawArrays(c.TRIANGLES, 0, 3);
    }

    function step(dt, now) {
      st.time += dt;
      var T = cfg.getTarget();
      var still = true;
      st.blue += (st.blueT - st.blue) * Math.min(1, dt * 5);
      if (Math.abs(st.blueT - st.blue) > 0.01) still = false;
      if (T) {
        if (!st.ready) { Object.assign(st.a, T); Object.assign(st.b, T); st.ready = true; }
        var bodies = [st.a, st.b];
        if (st.reduce) {
          for (var b = 0; b < 2; b++) Object.assign(bodies[b], { x: T.x, y: T.y, w: T.w, h: T.h, vx: 0, vy: 0, vw: 0, vh: 0 });
          st.sats = [];
        } else {
          for (var i = 0; i < 2; i++) {
            var B = bodies[i];
            var lead = i === st.lead;
            var k = lead ? 210 : 60, damp = lead ? 25 : 13;
            var f = !lead && now < st.lagUntil ? 0.04 : 1;
            B.vx += (k * (T.x - B.x) - damp * B.vx) * dt * f;
            B.vy += (k * (T.y - B.y) - damp * B.vy) * dt * f;
            B.vw += (k * (T.w - B.w) - damp * B.vw) * dt * f;
            B.vh += (k * (T.h - B.h) - damp * B.vh) * dt * f;
            B.x += B.vx * dt; B.y += B.vy * dt;
            B.w = Math.max(0, B.w + B.vw * dt); B.h = Math.max(0, B.h + B.vh * dt);
            if (Math.abs(T.x - B.x) + Math.abs(T.y - B.y) + Math.abs(T.w - B.w) + Math.abs(T.h - B.h) > 0.6 ||
                Math.abs(B.vx) + Math.abs(B.vy) + Math.abs(B.vw) > 4) still = false;
          }
          var head = bodies[st.lead], tail = bodies[1 - st.lead];
          var dist = Math.hypot(head.x - tail.x, head.y - tail.y);
          if (!st.split && st.moving && dist > Math.min(head.w, head.h) + Math.min(tail.w, tail.h) + 6) {
            st.split = true;
            [0.3, 0.55, 0.8].forEach(function (t, idx) {
              st.sats.push({
                x: tail.x + (head.x - tail.x) * t + (Math.random() - 0.5) * 18,
                y: tail.y + (head.y - tail.y) * t + (Math.random() - 0.5) * 10,
                vx: (head.vx + tail.vx) * 0.3,
                vy: (head.vy + tail.vy) * 0.3,
                r: 7.2 - idx * 1.2 + Math.random() * 1.4,
                k: 60 + Math.random() * 70
              });
            });
          }
          st.sats = st.sats.filter(function (s) {
            s.vx += (s.k * (head.x - s.x) - 9 * s.vx) * dt;
            s.vy += (s.k * (head.y - s.y) - 9 * s.vy) * dt;
            s.x += s.vx * dt; s.y += s.vy * dt;
            if (Math.abs(head.x - s.x) < head.w * 0.8 && Math.abs(head.y - s.y) < head.h * 0.9) s.r -= dt * 30;
            return s.r > 0.6;
          });
          if (st.sats.length) still = false;
        }
        if (st.moving && still) {
          st.moving = false;
          if (!st.reduce) st.rips.push({ x: T.x, y: T.y, age: 0, amp: st.split ? 1 : 0.5 });
        }
      }
      for (var r = st.rips.length - 1; r >= 0; r--) {
        st.rips[r].age += dt;
        if (st.rips[r].age >= 2.4) st.rips.splice(r, 1);
      }
      st.mouse.s += ((st.mouse.on ? 1 : 0) - st.mouse.s) * Math.min(1, dt * 7);
    }

    function loop() {
      if (st.raf || st.destroyed) return;
      st.last = performance.now();
      function tick(now) {
        if (st.destroyed) { st.raf = 0; return; }
        var dt = Math.min((now - st.last) / 1000, 1 / 30);
        st.last = now;
        step(dt, now);
        draw();
        var busy = st.moving || st.rips.length > 0 || st.sats.length > 0 || st.mouse.s > 0.01 || Math.abs(st.blueT - st.blue) > 0.01;
        if (st.visible && (!st.reduce || busy)) st.raf = requestAnimationFrame(tick);
        else st.raf = 0;
      }
      st.raf = requestAnimationFrame(tick);
    }

    function resize() {
      if (st.destroyed) return;
      st.w = panelEl.offsetWidth;
      st.h = panelEl.offsetHeight;
      if (!st.w || !st.h) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      var W = st.w + PAD * 2;
      var Hc = Math.ceil((st.h + PAD * 2) / 64) * 64;
      if (Hc !== st.ch || canvas.width !== Math.round(W * dpr)) {
        st.ch = Hc;
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(Hc * dpr);
        canvas.style.width = W + 'px';
        canvas.style.height = Hc + 'px';
      }
      loop();
    }

    st.glc = compileProgram(canvas, WL_VERT, WL_FRAG, WL_UNIFORMS);
    panelEl.dataset.wlGl = st.glc ? 'on' : 'off';
    function onLost(e) { e.preventDefault(); st.glc = null; panelEl.dataset.wlGl = 'off'; }
    canvas.addEventListener('webglcontextlost', onLost);

    var io = null, ro = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (entries) {
        st.visible = !!entries[0].isIntersecting;
        if (st.visible) loop();
      });
      io.observe(panelEl);
    }
    if ('ResizeObserver' in window) {
      ro = new ResizeObserver(resize);
      ro.observe(panelEl);
    }
    resize();

    return {
      gl: !!st.glc,
      canvas: canvas,
      PAD: PAD,
      relOf: function (el, radius, grow) {
        if (!el) return null;
        grow = grow || 0;
        var pr = panelEl.getBoundingClientRect();
        var b = el.getBoundingClientRect();
        if (!b.width || !b.height) return null;
        var h = b.height / 2 + grow;
        return {
          x: PAD + b.left - pr.left + b.width / 2,
          y: PAD + b.top - pr.top + b.height / 2,
          w: b.width / 2 + grow,
          h: h,
          r: radius === 'pill' ? h : (radius == null ? 14 : radius)
        };
      },
      flow: function (lag) {
        var T = cfg.getTarget();
        if (T) {
          st.lead = Math.hypot(T.x - st.a.x, T.y - st.a.y) <= Math.hypot(T.x - st.b.x, T.y - st.b.y) ? 0 : 1;
        }
        st.lagUntil = performance.now() + (lag == null ? 90 : lag);
        st.moving = true;
        st.split = false;
        loop();
      },
      snap: function () {
        var T = cfg.getTarget();
        if (T) {
          Object.assign(st.a, T);
          Object.assign(st.b, T);
          st.ready = true;
        }
        loop();
      },
      ripple: function (x, y, amp) {
        if (st.reduce) return;
        st.rips.push({ x: x, y: y, age: 0, amp: amp == null ? 0.8 : amp });
        loop();
      },
      shake: function () {
        if (st.reduce) return;
        var head = st.lead === 0 ? st.a : st.b;
        head.vx += 420;
        head.vw -= 160;
        st.moving = true;
        loop();
      },
      setBlue: function (v) { st.blueT = v; loop(); },
      setTone: function (t) { cfg.tone = t; loop(); },
      pointer: function (x, y, on) { st.mouse.x = x; st.mouse.y = y; st.mouse.on = !!on; loop(); },
      loop: loop,
      resize: resize,
      destroy: function () {
        st.destroyed = true;
        cancelAnimationFrame(st.raf);
        if (io) io.disconnect();
        if (ro) ro.disconnect();
        canvas.removeEventListener('webglcontextlost', onLost);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    };
  }

  /* ===================== Checkout helpers ===================== */
  var DEFAULT_CARDS = [
    { id: 'sky', label: '7YMERA Sky', theme: 'sky', brand: 'VISA', last4: '4242', holder: 'ALIF NAJMI', expiry: '09/29' },
    { id: 'glass', label: '7YMERA Glass', theme: 'glass', brand: 'Mastercard', last4: '4444', holder: 'ALIF NAJMI', expiry: '12/28' },
    { id: 'deep', label: '7YMERA Deep', theme: 'deep', brand: 'AMEX', last4: '0005', holder: 'ALIF NAJMI', expiry: '01/30' }
  ];

  function brandOf(digits) {
    if (/^3[47]/.test(digits)) return { name: 'AMEX', theme: 'deep', groups: [4, 6, 5], cvc: 4 };
    if (/^(5[1-5]|2[2-7])/.test(digits)) return { name: 'Mastercard', theme: 'glass', groups: [4, 4, 4, 4], cvc: 3 };
    if (/^4/.test(digits)) return { name: 'VISA', theme: 'sky', groups: [4, 4, 4, 4], cvc: 3 };
    return { name: '', theme: 'sky', groups: [4, 4, 4, 4], cvc: 3 };
  }
  function maxLen(b) { return b.groups.reduce(function (a, n) { return a + n; }, 0); }
  function groupDigits(digits, b, fill) {
    var out = [], i = 0;
    for (var k = 0; k < b.groups.length; k++) {
      var n = b.groups[k], g = digits.slice(i, i + n);
      if (fill) while (g.length < n) g += fill;
      if (g) out.push(g);
      i += n;
    }
    return out.join(' ');
  }
  function luhn(dig) {
    var sum = 0;
    for (var i = 0; i < dig.length; i++) {
      var n = +dig[dig.length - 1 - i];
      if (i % 2) { n *= 2; if (n > 9) n -= 9; }
      sum += n;
    }
    return dig.length > 11 && sum % 10 === 0;
  }
  function expiryOk(v) {
    var m = /^(\d{2})\/(\d{2})$/.exec(v);
    if (!m) return false;
    var mm = +m[1], yy = 2000 + +m[2];
    if (mm < 1 || mm > 12) return false;
    var now = new Date();
    return yy > now.getFullYear() || (yy === now.getFullYear() && mm >= now.getMonth() + 1);
  }

  /* ===================== Tidepool Checkout ===================== */
  function Checkout(host, opts) {
    var cfg = Object.assign({
      amount: 42,
      currency: 'MYR',
      locale: 'en-MY',
      merchant: '7YMERA Tidepool',
      cards: DEFAULT_CARDS,
      layout: 'auto', // 'auto' | 'form' | 'wallet'
      tone: 'light',
      resetAfter: 3200,
      sound: true,
      note: null,
      onPay: null
    }, opts || {});

    var uid = nextId('lc');
    var root = d.createElement('div');
    root.className = 'nimbus-pay';
    root.dataset.tone = cfg.tone;
    host.appendChild(root);

    var state = {
      width: 900,
      mode: 'form',
      num: '',
      name: '',
      exp: '',
      cvc: '',
      focus: 'number',
      phase: 'edit',
      errors: {},
      declined: '',
      order: cfg.cards.map(function (c) { return c.id; }),
      flipped: false,
      lastBrand: '',
      prog: 0,
      progRaf: 0,
      resetTimer: 0
    };

    var audioCtx = null;
    function plip(f0, f1) {
      if (!cfg.sound) return;
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audioCtx = audioCtx || new AC();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        var t = audioCtx.currentTime, o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(f1, t + 0.08);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.12, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.connect(g).connect(audioCtx.destination);
        o.start(t); o.stop(t + 0.2);
      } catch (e) {}
    }

    function fmtMoney() {
      try { return new Intl.NumberFormat(cfg.locale, { style: 'currency', currency: cfg.currency }).format(cfg.amount); }
      catch (e) { return cfg.amount.toFixed(2) + ' ' + cfg.currency; }
    }

    var activeCard = null;
    var walletCards = [];
    var water = null;
    var dom = {};

    function computeMode() {
      return cfg.layout === 'auto' ? (state.width < 740 ? 'wallet' : 'form') : cfg.layout;
    }

    function getTarget() {
      if (!dom.panel || !water) return null;
      var pr = dom.panel.getBoundingClientRect();
      if (state.phase === 'processing' || state.phase === 'success') {
        if (!dom.payBtn) return null;
        var b = dom.payBtn.getBoundingClientRect();
        var hh = b.height / 2;
        if (state.phase === 'success') {
          var rr = hh * 0.92;
          return { x: PAD + b.left - pr.left + b.width / 2, y: PAD + b.top - pr.top + hh, w: rr, h: rr, r: rr };
        }
        var w = Math.max(hh, (b.width / 2) * state.prog);
        return { x: PAD + b.left - pr.left + w, y: PAD + b.top - pr.top + hh, w: w, h: hh, r: hh };
      }
      if (state.mode === 'wallet') return water.relOf(dom.walletRow, 16, 0);
      return water.relOf(dom.boxes[state.focus] || dom.boxes.number, 14, 2);
    }

    function destroyViews() {
      if (activeCard) { activeCard.destroy(); activeCard = null; }
      walletCards.forEach(function (w) { w.destroy(); });
      walletCards = [];
      if (water) { water.destroy(); water = null; }
    }

    function syncCard() {
      var b = brandOf(state.num);
      var level = state.phase === 'processing' ? 0.9 : 0.42;
      if (state.mode === 'form' && activeCard) {
        activeCard.update({
          theme: b.theme,
          number: state.num ? groupDigits(state.num, b, '•') : '•••• •••• •••• ••••',
          name: state.name || 'Your name',
          expiry: state.exp || 'MM/YY',
          cvc: state.cvc || '•'.repeat(b.cvc),
          brand: b.name,
          flipped: state.flipped,
          level: level,
          bubbles: state.phase === 'processing',
          success: state.phase === 'success'
        });
      } else if (state.mode === 'wallet') {
        var cw = Math.min(350, Math.max(240, state.width - 32));
        var ch = Math.round(cw / 1.586);
        var peek = Math.round(ch * 0.24);
        cfg.cards.forEach(function (c, idx) {
          var pos = state.order.indexOf(c.id);
          var front = pos === 0;
          var slot = dom.slots[idx];
          if (slot) {
            slot.setAttribute('aria-checked', String(front));
            slot.tabIndex = front ? 0 : -1;
            slot.style.zIndex = String(front ? cfg.cards.length : pos);
            slot.style.transform = 'translateY(' + (front ? peek * (cfg.cards.length - 1) : (pos - 1) * peek) + 'px)';
          }
          if (walletCards[idx]) {
            walletCards[idx].update({
              level: front ? level : 0.42,
              bubbles: front && state.phase === 'processing',
              success: front && state.phase === 'success',
              live: front,
              interactive: front
            });
            if (front) activeCard = walletCards[idx];
          }
        });
        var sel = cfg.cards.find(function (c) { return c.id === state.order[0]; }) || cfg.cards[0];
        if (dom.walletCardVal) {
          var T = CARD_THEMES[sel.theme] || CARD_THEMES.sky;
          dom.walletCardVal.innerHTML = '<span class="lc-mini" style="background:' + T.back + '"></span>' + escHtml(sel.label) + ' ·· ' + escHtml(sel.last4);
        }
      }
    }

    function syncUI() {
      var busy = state.phase === 'processing' || state.phase === 'success';
      var money = fmtMoney();
      if (dom.status) {
        dom.status.textContent = state.phase === 'processing' ? 'Processing payment' :
          state.phase === 'success' ? ('Payment of ' + money + ' complete') : state.declined;
      }
      if (dom.payBtn) {
        dom.payBtn.dataset.phase = state.phase;
        dom.payBtn.setAttribute('aria-busy', String(state.phase === 'processing'));
        dom.payBtn.setAttribute('aria-disabled', String(busy));
        dom.payBtn.innerHTML = state.phase === 'processing'
          ? '<span class="lc-pay-label">Processing<span class="lc-dots" aria-hidden="true"><i></i><i></i><i></i></span></span>'
          : state.phase === 'success'
            ? '<span class="lc-pay-label">' + CHECK_SVG + '</span>'
            : '<span class="lc-pay-label">Pay ' + escHtml(money) + '</span>';
      }
      if (dom.foot) {
        dom.foot.dataset.ok = String(state.phase === 'success');
        dom.foot.innerHTML = state.phase === 'success'
          ? '<span class="lc-ok-ico">' + CHECK_SM_SVG + '</span>Paid ' + escHtml(money) + ' to ' + escHtml(cfg.merchant)
          : LOCK_SVG + escHtml(cfg.note || (state.mode === 'wallet' ? 'Tap a card to switch, then pay' : 'Demo checkout · no real payment'));
      }
      if (dom.declined) {
        dom.declined.textContent = state.declined;
        dom.declined.hidden = !state.declined;
      }
      if (state.mode === 'form') {
        var b = brandOf(state.num);
        if (dom.inputs.number) {
          dom.inputs.number.value = state.num ? groupDigits(state.num, b) : '';
          dom.inputs.number.disabled = busy;
        }
        if (dom.inputs.name) { dom.inputs.name.value = state.name; dom.inputs.name.disabled = busy; }
        if (dom.inputs.exp) { dom.inputs.exp.value = state.exp; dom.inputs.exp.disabled = busy; }
        if (dom.inputs.cvc) {
          dom.inputs.cvc.value = state.cvc;
          dom.inputs.cvc.placeholder = b.cvc === 4 ? '1234' : '123';
          dom.inputs.cvc.disabled = busy;
        }
        if (dom.brandTag) {
          dom.brandTag.textContent = b.name;
          dom.brandTag.dataset.on = String(!!b.name);
        }
        ['number', 'name', 'exp', 'cvc'].forEach(function (k) {
          var err = state.errors[k] || '';
          if (dom.boxes[k]) dom.boxes[k].dataset.invalid = String(!!err);
          if (dom.inputs[k]) dom.inputs[k].setAttribute('aria-invalid', String(!!err));
          if (dom.errs[k]) { dom.errs[k].textContent = err; dom.errs[k].hidden = !err; }
        });
      }
      syncCard();
      if (water) water.loop();
    }

    function runProgress(to, ms, done) {
      cancelAnimationFrame(state.progRaf);
      var from = state.prog, t0 = performance.now();
      function tick(now) {
        var t = Math.min(1, (now - t0) / ms);
        var e = 1 - Math.pow(1 - t, 3);
        state.prog = from + (to - from) * e;
        if (water) water.loop();
        if (t < 1) state.progRaf = requestAnimationFrame(tick);
        else { state.progRaf = 0; if (done) done(); }
      }
      state.progRaf = requestAnimationFrame(tick);
    }

    function validate() {
      var b = brandOf(state.num), e = {};
      if (!luhn(state.num) || state.num.length < maxLen(b) - (b.name === '' ? 3 : 0)) e.number = 'Check the card number';
      if (state.name.trim().length < 2) e.name = 'Add the name on the card';
      if (!expiryOk(state.exp)) e.exp = 'Invalid date';
      if (state.cvc.length !== b.cvc) e.cvc = b.cvc + ' digits';
      return e;
    }

    function pay() {
      if (state.phase === 'processing' || state.phase === 'success') return;
      state.declined = '';
      var details;
      if (state.mode === 'form') {
        var e = validate();
        state.errors = e;
        var first = ['number', 'name', 'exp', 'cvc'].find(function (k) { return e[k]; });
        if (first) {
          state.focus = first;
          syncUI();
          if (dom.inputs[first]) dom.inputs[first].focus();
          if (water) { water.flow(90); setTimeout(function () { if (water) water.shake(); }, 60); }
          plip(300, 220);
          return;
        }
        var b = brandOf(state.num);
        details = { method: 'card', number: state.num, name: state.name.trim(), expiry: state.exp, cvc: state.cvc, brand: b.name || 'Card' };
      } else {
        var sel = cfg.cards.find(function (c) { return c.id === state.order[0]; }) || cfg.cards[0];
        details = { method: 'wallet', card: sel };
      }
      if (d.activeElement && d.activeElement.blur) d.activeElement.blur();
      state.flipped = false;
      state.prog = 0;
      state.phase = 'processing';
      syncUI();
      if (water) { water.setBlue(1); water.flow(140); }
      plip(420, 1300);
      runProgress(0.88, 1400);

      var started = performance.now();
      var p;
      try {
        p = Promise.resolve(cfg.onPay ? cfg.onPay(details) : new Promise(function (r) { setTimeout(r, 1450); }));
      } catch (err) {
        p = Promise.reject(err);
      }

      p.then(function () {
        var wait = Math.max(0, 1100 - (performance.now() - started));
        return new Promise(function (r) { setTimeout(r, wait); });
      }).then(function () {
        runProgress(1, 260, function () {
          state.phase = 'success';
          syncUI();
          if (water) water.flow(90);
          plip(660, 1760);
          if (dom.payBtn && dom.panel && water) {
            var b = dom.payBtn.getBoundingClientRect(), pr = dom.panel.getBoundingClientRect();
            water.ripple(PAD + b.left - pr.left + b.width / 2, PAD + b.top - pr.top + b.height / 2, 1.6);
          }
          if (activeCard) activeCard.splash(null, 1.4);
          try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) {}
          if (cfg.resetAfter > 0) {
            clearTimeout(state.resetTimer);
            state.resetTimer = setTimeout(function () {
              state.phase = 'edit';
              state.prog = 0;
              if (water) { water.setBlue(0); water.flow(90); }
              syncUI();
            }, cfg.resetAfter);
          }
        });
      }).catch(function (err) {
        runProgress(0, 380, function () {
          state.phase = 'edit';
          state.declined = (err && err.message) ? err.message : 'Payment declined. Try another card.';
          if (water) water.setBlue(0);
          syncUI();
          setTimeout(function () { if (water) water.shake(); }, 40);
          plip(280, 190);
        });
      });
    }

    function renderLayout() {
      destroyViews();
      state.mode = computeMode();
      root.dataset.layout = state.mode;
      root.dataset.tone = cfg.tone;
      var cw = Math.min(350, Math.max(240, state.width - 32));
      var ch = Math.round(cw / 1.586);
      var peek = Math.round(ch * 0.24);
      root.style.setProperty('--lc-cw', cw + 'px');
      root.innerHTML = '';

      dom = { boxes: {}, inputs: {}, errs: {}, slots: [] };

      var status = d.createElement('span');
      status.className = 'lc-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      dom.status = status;
      root.appendChild(status);

      if (state.mode === 'form') {
        var stage = d.createElement('div');
        stage.className = 'lc-stage';
        root.appendChild(stage);
        var cardW = Math.min(340, Math.max(250, state.width - 460));
        activeCard = WaterCard(stage, {
          mode: 'payment',
          theme: brandOf(state.num).theme,
          width: cardW
        });
      } else {
        var stack = d.createElement('div');
        stack.className = 'lc-stack';
        stack.setAttribute('role', 'radiogroup');
        stack.setAttribute('aria-label', 'Choose a card');
        stack.style.height = (ch + peek * (cfg.cards.length - 1) + 4) + 'px';
        root.appendChild(stack);

        function selectCard(id) {
          if (state.phase === 'processing' || state.phase === 'success' || id === state.order[0]) return;
          state.order = [id].concat(state.order.filter(function (x) { return x !== id; }));
          syncUI();
          if (water) water.flow(90);
          plip(520, 900);
          setTimeout(function () { if (activeCard) activeCard.splash(null, 0.9); }, 200);
        }

        stack.addEventListener('keydown', function (e) {
          if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].indexOf(e.key) < 0) return;
          e.preventDefault();
          var i = cfg.cards.findIndex(function (c) { return c.id === state.order[0]; });
          var next = cfg.cards[(i + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : cfg.cards.length - 1)) % cfg.cards.length];
          selectCard(next.id);
        });

        cfg.cards.forEach(function (c) {
          var slot = d.createElement('button');
          slot.type = 'button';
          slot.className = 'lc-slot';
          slot.setAttribute('role', 'radio');
          slot.setAttribute('aria-label', c.label + ', ' + c.brand + ' ending in ' + c.last4);
          slot.addEventListener('click', function () { selectCard(c.id); });
          stack.appendChild(slot);
          dom.slots.push(slot);
          var wc = WaterCard(slot, {
            mode: 'payment',
            theme: c.theme,
            number: '•••• •••• •••• ' + c.last4,
            name: c.holder,
            expiry: c.expiry,
            cvc: '•••',
            brand: c.brand,
            width: cw
          });
          walletCards.push(wc);
        });
      }

      var panel = d.createElement('div');
      panel.className = 'lc-panel';
      if (state.mode === 'wallet') panel.style.width = Math.min(380, cw + 20) + 'px';
      dom.panel = panel;

      var glass = d.createElement('span');
      glass.className = 'lc-glass';
      glass.setAttribute('aria-hidden', 'true');
      panel.appendChild(glass);

      var money = fmtMoney();
      var head = d.createElement('div');
      head.className = 'lc-head';
      head.innerHTML = '<div class="lc-merchant"><span class="lc-kicker">Pay to</span><span class="lc-mname">' + escHtml(cfg.merchant) + '</span></div><div class="lc-amount">' + escHtml(money) + '</div>';
      panel.appendChild(head);

      var payBtn = d.createElement('button');
      payBtn.type = state.mode === 'form' ? 'submit' : 'button';
      payBtn.className = 'lc-pay';
      dom.payBtn = payBtn;

      var declinedEl = d.createElement('span');
      declinedEl.className = 'lc-err';
      declinedEl.id = uid + '-declined';
      declinedEl.setAttribute('role', 'alert');
      declinedEl.style.textAlign = 'center';
      declinedEl.hidden = true;
      dom.declined = declinedEl;

      if (state.mode === 'form') {
        var form = d.createElement('form');
        form.className = 'lc-form';
        form.noValidate = true;
        form.addEventListener('submit', function (e) { e.preventDefault(); pay(); });

        var fields = [
          { k: 'number', label: 'Card number', wide: true, inputMode: 'numeric', autoComplete: 'cc-number', placeholder: '1234 1234 1234 1234' },
          { k: 'name', label: 'Name on card', wide: true, autoComplete: 'cc-name', placeholder: 'Alif Najmi' },
          { k: 'exp', label: 'Expiry', wide: false, inputMode: 'numeric', autoComplete: 'cc-exp', placeholder: 'MM/YY' },
          { k: 'cvc', label: 'CVC', wide: false, inputMode: 'numeric', autoComplete: 'cc-csc', placeholder: '123' }
        ];

        fields.forEach(function (f) {
          var wrap = d.createElement('div');
          wrap.className = 'lc-f' + (f.wide ? ' lc-wide' : '');
          var lbl = d.createElement('label');
          lbl.className = 'lc-l';
          lbl.htmlFor = uid + '-' + f.k;
          lbl.textContent = f.label;
          var box = d.createElement('div');
          box.className = 'lc-box';
          var inp = d.createElement('input');
          inp.id = uid + '-' + f.k;
          inp.name = f.k;
          inp.className = 'lc-in';
          inp.placeholder = f.placeholder;
          inp.autocomplete = f.autoComplete;
          if (f.inputMode) inp.inputMode = f.inputMode;

          inp.addEventListener('focus', function () {
            state.focus = f.k;
            state.flipped = f.k === 'cvc';
            syncCard();
            if (water) water.flow(90);
          });
          inp.addEventListener('blur', function () {
            if (f.k === 'cvc') { state.flipped = false; syncCard(); }
          });
          inp.addEventListener('input', function () {
            var v = inp.value;
            if (f.k === 'number') {
              var dig = v.replace(/\D/g, ''), br = brandOf(dig);
              state.num = dig.slice(0, maxLen(br));
              state.errors.number = '';
              if (br.name && br.name !== state.lastBrand && activeCard) activeCard.splash(null, 1);
              state.lastBrand = br.name;
            } else if (f.k === 'name') {
              state.name = v.slice(0, 26);
              state.errors.name = '';
            } else if (f.k === 'exp') {
              var ed = v.replace(/\D/g, '').slice(0, 4);
              if (ed.length === 1 && +ed > 1) ed = '0' + ed;
              var del = v.length < state.exp.length;
              state.exp = (ed.length > 2 || (ed.length === 2 && !del)) ? (ed.slice(0, 2) + '/' + ed.slice(2)) : ed;
              state.errors.exp = '';
            } else if (f.k === 'cvc') {
              state.cvc = v.replace(/\D/g, '').slice(0, brandOf(state.num).cvc);
              state.errors.cvc = '';
            }
            syncUI();
          });

          box.appendChild(inp);
          if (f.k === 'number') {
            var tag = d.createElement('span');
            tag.className = 'lc-tag';
            tag.dataset.on = 'false';
            box.appendChild(tag);
            dom.brandTag = tag;
          }

          var err = d.createElement('span');
          err.className = 'lc-err';
          err.id = uid + '-' + f.k + '-err';
          err.hidden = true;

          wrap.appendChild(lbl);
          wrap.appendChild(box);
          wrap.appendChild(err);
          form.appendChild(wrap);

          dom.boxes[f.k] = box;
          dom.inputs[f.k] = inp;
          dom.errs[f.k] = err;
        });

        var payWrap = d.createElement('div');
        payWrap.className = 'lc-f lc-wide';
        payWrap.appendChild(payBtn);
        payWrap.appendChild(declinedEl);
        form.appendChild(payWrap);
        panel.appendChild(form);
      } else {
        var rows = d.createElement('div');
        rows.className = 'lc-rows';
        var r1 = d.createElement('div');
        r1.className = 'lc-row';
        r1.innerHTML = '<span class="lc-row-k">Card</span><span class="lc-row-v"></span>';
        dom.walletRow = r1;
        dom.walletCardVal = r1.lastChild;
        var r2 = d.createElement('div');
        r2.className = 'lc-row';
        r2.innerHTML = '<span class="lc-row-k">Total</span><span class="lc-row-v">' + escHtml(money) + '</span>';
        rows.appendChild(r1);
        rows.appendChild(r2);
        panel.appendChild(rows);
        payBtn.addEventListener('click', pay);
        panel.appendChild(payBtn);
        declinedEl.style.display = 'block';
        panel.appendChild(declinedEl);
      }

      var foot = d.createElement('div');
      foot.className = 'lc-foot';
      dom.foot = foot;
      panel.appendChild(foot);
      root.appendChild(panel);

      water = Waterline(panel, {
        getTarget: getTarget,
        tone: cfg.tone,
        cardRadius: 28,
        panelRim: true,
        zIndex: -1,
        canvasClass: 'lc-water'
      });
      root.dataset.gl = water.gl ? 'on' : 'off';

      panel.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse' || !water) return;
        var pr = panel.getBoundingClientRect();
        water.pointer(e.clientX - pr.left + PAD, e.clientY - pr.top + PAD, true);
      });
      panel.addEventListener('pointerleave', function () { if (water) water.pointer(0, 0, false); });
      panel.addEventListener('pointerdown', function (e) {
        if (!water) return;
        var pr = panel.getBoundingClientRect();
        water.ripple(e.clientX - pr.left + PAD, e.clientY - pr.top + PAD, 0.6);
      });

      syncUI();
      if (water) water.snap();
    }

    var ro = null;
    if ('ResizeObserver' in window) {
      ro = new ResizeObserver(function (entries) {
        var nw = entries[0].contentRect.width;
        if (!nw) return;
        var prevMode = state.mode;
        state.width = nw;
        if (computeMode() !== prevMode) renderLayout();
        else if (state.mode === 'form' && activeCard) {
          activeCard.update({ width: Math.min(340, Math.max(250, state.width - 460)) });
        }
      });
      ro.observe(root);
    }
    state.width = root.getBoundingClientRect().width || window.innerWidth || 900;
    renderLayout();

    return {
      el: root,
      setTone: function (t) {
        cfg.tone = t;
        root.dataset.tone = t;
        if (water) water.setTone(t);
      },
      setLayout: function (l) {
        cfg.layout = l;
        renderLayout();
      },
      setSound: function (on) { cfg.sound = !!on; },
      fillCard: function (preset) {
        if (state.phase === 'processing' || state.phase === 'success') return;
        state.num = (preset.number || '').replace(/\D/g, '');
        state.name = preset.name || 'Alif Najmi';
        state.exp = preset.expiry || '09/29';
        state.cvc = preset.cvc || '424';
        state.errors = {};
        state.declined = '';
        state.flipped = false;
        state.lastBrand = brandOf(state.num).name;
        if (state.mode === 'wallet' && preset.id) {
          state.order = [preset.id].concat(state.order.filter(function (x) { return x !== preset.id; }));
        }
        syncUI();
        if (activeCard) activeCard.splash(null, 1.15);
        if (water) water.flow(90);
        plip(500, 960);
      },
      splash: function () {
        if (activeCard) activeCard.splash(null, 1.3);
        if (water && dom.panel) {
          water.ripple(dom.panel.offsetWidth / 2 + PAD, dom.panel.offsetHeight / 2 + PAD, 1.2);
        }
        plip(440, 880);
      },
      flipCard: function () {
        if (state.mode !== 'form') return;
        state.flipped = !state.flipped;
        syncCard();
        plip(380, 620);
      },
      pay: pay,
      destroy: function () {
        clearTimeout(state.resetTimer);
        cancelAnimationFrame(state.progRaf);
        if (ro) ro.disconnect();
        destroyViews();
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }

  window.LiquidWater = {
    CARD_THEMES: CARD_THEMES,
    WaterCard: WaterCard,
    Waterline: Waterline,
    Checkout: Checkout
  };
})();
