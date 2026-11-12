/* KLCC in WebGL. The camera orbits the towers as the page scrolls. three.js comes from cdnjs. */
(function(){
  if(!window.THREE){document.documentElement.classList.remove('gl');return}
  var CS=document.currentScript; // read now: it is null once the start is deferred
  var DEFER=!document.documentElement.hasAttribute('data-flight-only');
  // The page layout for the scene (panels, plate round the name) must not change after the first paint, so `gl` goes on now; start() removes it again if WebGL turns out to be unavailable.
  if(DEFER)document.documentElement.classList.add('gl');
  function start(){
  var T=THREE,root=document.documentElement,cv=document.getElementById('gl');
  // Where this script lives (assets/), so the models load from any page, whatever its folder.
  var BASE=(((CS||document.querySelector('script[src*="scene.js"]')||{}).src)||'').replace(/scene\.js.*$/,'');
  // data-flight-only on <html> (the /flight/ page): no orbit phase and no page around it, just the flight, driven by scroll.
  var ONLY=root.hasAttribute('data-flight-only');
  // ?bg=district: the compact one-mesh KLCC district (assets/city/klcc_district.json, tools/convert-klcc-dae.js) replaces the OSM city and the four landmark models.
  var DIST=!/[?&]bg=osm/.test(location.search); // the district is the map; ?bg=osm swaps in the OpenStreetMap city. In the district, the landmarks are the hand-made models, not the district's own blocky ones.
  // ===== LAYOUT: the one table every position in this file derives from =====
  // LAY.<landmark> = [x, z, rotation.y] in world units (1 unit = 3.42 m); each model stands on y = 0 at that point. Petronas Twin Towers are the origin.
  // The district (default) is a COMPOSED skyline, not the map: Menara KL, Merdeka 118 and The Exchange 106 are brought in to 110-180 units of the towers,
  // all on the far side of the skybridge gap (the side the flight leaves by), at different bearings and depths so their tops do not line up from the opening view.
  // Each landmark's plot is cleared in the district at load time (CLEAR, below). ?bg=osm keeps the real map positions.
  // Everything else is derived from LAY: model calls, LCUT, glow zones, BEAC, beacons, crease lines, sign, gyros, rail, labels, director shots and flight waypoints
  // (their (u,w) coordinates come from UW(), the gap frame defined by the flight code).
  // CROWN = where each model's crown/spire axis stands, in model-local x,z (before rotation), so the lights and glow follow the model when LAY changes.
  var LAY=/[?&]bg=osm/.test(location.search)?{klcc:[0,0,0],kl:[-95,-70,0],mer:[-10,-95,-.5],ex:[60,-125,.4]}:{klcc:[0,0,0],kl:[-134,9,0],mer:[-124,-83,-.5],ex:[38,-129,.4]};
  var CROWN={klcc:[0,0],kl:[0,0],mer:[8.4,-8.5],ex:[3.9,-7.8]};
  function lp(k,lx,lz){var L=LAY[k],c=Math.cos(L[2]),s=Math.sin(L[2]);return [L[0]+lx*c+lz*s,L[1]-lx*s+lz*c]} // a model-local point in world x,z
  function crown(k){return lp(k,CROWN[k][0],CROWN[k][1])}
  var renderer;
  try{renderer=new T.WebGLRenderer({canvas:cv,alpha:true,antialias:true,powerPreference:'low-power'})}catch(e){root.classList.remove('gl');return}
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Film grain and edge vignette: two fixed, pointer-less layers just above the canvas (see the end of scene.css). The grain tile is drawn once here.
  (function(){
    var dpr=Math.min(2,Math.max(1,Math.round(devicePixelRatio||1))),TS=180*dpr; // one noise pixel per device pixel
    function tile(rgb,amax){var c=document.createElement('canvas');c.width=c.height=TS;var x=c.getContext('2d'),d=x.createImageData(TS,TS),i,r=7;
      for(i=0;i<d.data.length;i+=4){r=(r*16807)%2147483647;var n=r/2147483647;d.data[i]=rgb[0];d.data[i+1]=rgb[1];d.data[i+2]=rgb[2];d.data[i+3]=Math.round(n*n*amax)}
      x.putImageData(d,0,0);return 'url('+c.toDataURL('image/png')+')'}
    try{root.style.setProperty('--grain-l',tile([20,60,140],38));root.style.setProperty('--grain-d',tile([150,200,255],26))}catch(e){}
    ['fx-grain','fx-vig'].forEach(function(id){if(document.getElementById(id))return;var e=document.createElement('div');e.id=id;e.setAttribute('aria-hidden','true');cv.parentNode.insertBefore(e,cv.nextSibling)})
  })();
  var scene=new T.Scene(),cam=new T.PerspectiveCamera(42,1,.3,1600);
  var M={},C={},mats=[];
  function css(n){return getComputedStyle(root).getPropertyValue(n).trim()}
  function col(k){return new T.Color(C[k])}
  function readColors(){C.line=css('--fx');['far','mid','near','glass','orb','ring','sky1','sky2'].forEach(function(k){C[k]=css('--'+k)});
    var dk=root.getAttribute('data-theme')==='dark'; // night: darker silhouettes and a warm haze (--n-*, --sky3, --sky-mid in scene.css); day: the same colours as always
    C.ground=dk?css('--n-ground'):C.mid;C.glass2=dk?css('--n-glass'):C.near;C.skyM=dk?css('--sky-mid'):C.sky2;C.sky3=dk?css('--sky3'):C.sky2;
    if(dk){C.far=css('--n-far');C.mid=css('--n-mid');C.near=css('--n-near')}}
  readColors();
  function mat(role,opts){var m=new T.MeshLambertMaterial(Object.assign({flatShading:true},opts||{}));m.userData.role=role;m.onBeforeCompile=function(sh){toon(sh)};mats.push(m);return m}
  function bands(){var c=document.createElement('canvas');c.width=8;c.height=64;var x=c.getContext('2d');x.fillStyle='#000';x.fillRect(0,0,8,64);x.fillStyle='#fff';x.fillRect(0,50,8,6);
    var t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;return t}
  var tex=bands();
  var tower=mat('near',{emissiveMap:tex,emissive:0xffffff}),towerB=mat('near'),podium=mat('mid'),city=mat('mid'),cityF=mat('far'),ground=mat('ground'),glassM=mat('ring',{emissive:0xffffff,emissiveIntensity:.5});
  var orbM=mat('orb'),ringM=new T.MeshBasicMaterial({color:C.ring});
  var amb=new T.AmbientLight(0xffffff,.75),sun=new T.DirectionalLight(0xffffff,.8);sun.position.set(80,140,60);scene.add(amb,sun);
  // Three flat tones per face (lit / mid / shade, picked by the face normal against one fixed light) and height-aware haze, both in the existing materials' shaders.
  // The tones are derived from each material's role colour, so the themes and the golden hour keep working. The haze fades towards the CSS sky gradient itself (uSky1/uSky2 at this pixel's screen height), so geometry melts into the sky with no seam.
  var shadeBase=new T.Vector3(.3,.52,.92),hazeBase=.5,GSH=new T.Vector3(.52,.47,.68),TU={uLight:{value:new T.Vector3(-.42,.74,.52).normalize()},uSunC:{value:sun.color},uLitMul:{value:new T.Vector3(1,1,1)},uLitMix:{value:.7},uShadeMul:{value:new T.Vector3(.4,.6,.95)},uMidMul:{value:new T.Vector3(1,1,1)},
    uSky1:{value:new T.Color()},uSky2:{value:new T.Color()},uSky3:{value:new T.Color()},uStop:{value:1},uRes:{value:new T.Vector2(1,1)},uHazeK:{value:.7},uSunAmt:{value:.5},uEdge:{value:new T.Vector2(620,1250)}};
  function toon(sh){
    for(var k in TU)sh.uniforms[k]=TU[k];
    sh.vertexShader=sh.vertexShader.replace('void main() {','varying vec3 vWP;\nvoid main() {').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\n vWP=(modelMatrix*vec4(transformed,1.0)).xyz;');
    sh.fragmentShader=sh.fragmentShader.replace('void main() {','varying vec3 vWP;uniform vec3 uLight,uSunC,uLitMul,uShadeMul,uMidMul,uSky1,uSky2,uSky3;uniform float uStop;uniform float uLitMix,uHazeK,uSunAmt;uniform vec2 uRes,uEdge;\nvoid main() {')
      .replace('#include <aomap_fragment>',`#include <aomap_fragment>
        vec3 tn=normalize(cross(dFdx(vWP),dFdy(vWP)));
        float td=dot(tn,uLight);
        float tlit=smoothstep(0.40,0.44,td),tsh=1.0-smoothstep(-0.14,-0.10,td);
        vec3 bc=diffuseColor.rgb;
        vec3 cLit=mix(bc*uLitMul,vec3(0.97,0.99,1.0),uLitMix)*mix(vec3(1.0),uSunC,uSunAmt);
        reflectedLight.directDiffuse=vec3(0.0);
        reflectedLight.indirectDiffuse=mix(mix(bc*uMidMul,cLit,tlit),bc*uShadeMul,tsh);`)
      .replace('#include <fog_fragment>',`#ifdef USE_FOG
        float hf=smoothstep(fogNear,fogFar,fogDepth);
        float hy=max(vWP.y,0.0);
        float hz=smoothstep(260.0,1700.0,distance(vWP,cameraPosition))*uHazeK*mix(0.15,1.0,exp(-hy/100.0));
        float he=smoothstep(uEdge.x,uEdge.y,length(vWP.xz))*exp(-hy/70.0);
        float ht=1.0-(1.0-hf)*(1.0-hz)*(1.0-he);
        float sy=1.0-gl_FragCoord.y/uRes.y; /* the CSS gradient: sky1 to sky2 at uStop, then to sky3 (day: uStop is 1, so sky3 never shows) */
        vec3 skyc=mix(mix(uSky1,uSky2,clamp(sy/uStop,0.0,1.0)),uSky3,clamp((sy-uStop)/max(1.0-uStop,0.0001),0.0,1.0));
        gl_FragColor.rgb=mix(gl_FragColor.rgb,skyc,ht);
      #endif`);
    return sh}
  var g=new T.Group();scene.add(g);
  var H=132;
  // Fallback tower, used only if klcc.json can't load: stepped octagons turned 22.5deg so the plan reads as a star
  function procedural(){
  // KLCC: stepped octagons, each step turned 22.5deg so the plan reads as a star
  function klcc(x){
    var h=0,steps=[[11,12,16],[10.4,11,14],[9.8,10.4,14],[9,9.8,12],[8.2,9,12],[7.2,8.2,11],[6,7.2,10],[4.6,6,9],[3.2,4.6,8]];
    steps.forEach(function(s,i){var m=new T.Mesh(new T.CylinderGeometry(s[0],s[1],s[2],8,1),i%3===1?towerB:tower);
      m.rotation.y=(i%2)*Math.PI/8;m.position.set(x,h+s[2]/2,0);g.add(m);h+=s[2]});
    var sp=new T.Mesh(new T.ConeGeometry(1.8,22,6),glassM);sp.position.set(x,h+11,0);g.add(sp);
    var tip=new T.Mesh(new T.CylinderGeometry(.25,.25,16,5),glassM);tip.position.set(x,h+30,0);g.add(tip);
    return h}
  klcc(-16);klcc(16);
  // skybridge, two angled legs
  var br=new T.Mesh(new T.BoxGeometry(24,3,4),glassM);br.position.set(0,H*.45,0);g.add(br);
  [-1,1].forEach(function(s){var l=new T.Mesh(new T.BoxGeometry(1.2,22,1.2),towerB);l.position.set(s*6,H*.45-11,0);l.rotation.z=s*.55;g.add(l)});
  // podium and mall
  var pd=new T.Mesh(new T.BoxGeometry(110,7,54),podium);pd.position.set(0,3.5,0);g.add(pd);
  var pd2=new T.Mesh(new T.BoxGeometry(70,5,34),podium);pd2.position.set(0,9.5,30);g.add(pd2);
  }
  // The real model: a SketchUp export of the Petronas Towers, converted by tools/convert-obj.py into assets/city/klcc.json
  function b64(str,Type){var bin=atob(str),u=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new Type(u.buffer)}
  var SC=H/444.138; // one scale for every landmark, so their real heights compare truthfully
  var bodyM=mat('near',{side:T.DoubleSide}),glassModelM=mat('glass2',{side:T.DoubleSide,emissive:0xffffff,emissiveIntensity:.3});
  function loadModel(url,x,z,ry,bm,fallback,done){
    fetch(url).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(d){
      var pos=b64(d.positions,Float32Array),out=new T.Group();
      [['body',bm],['glass',glassModelM]].forEach(function(p){
        var geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(pos,3));geo.setIndex(new T.BufferAttribute(b64(d[p[0]],Uint16Array),1));
        geo=geo.toNonIndexed();geo.computeVertexNormals();out.add(new T.Mesh(geo,p[1]))});
      out.scale.setScalar(SC);out.position.set(x,0,z);out.rotation.y=ry;g.add(out);if(done)done(out);recolor();need=true;
    }).catch(function(){if(fallback)fallback();recolor();need=true});
  }
  if(!DIST){
  loadModel(BASE+'city/klcc.json',LAY.klcc[0],LAY.klcc[1],LAY.klcc[2],bodyM,procedural,klccEdges);          // Petronas Twin Towers (SketchUp export, see tools/convert-obj.py)
  loadModel(BASE+'city/menara_kl.json',LAY.kl[0],LAY.kl[1],LAY.kl[2],bodyM,null,function(){g.remove(kl)}); // Menara KL; replaces the stand-in cylinder tower below once loaded
  loadModel(BASE+'city/merdeka118.json',LAY.mer[0],LAY.mer[1],LAY.mer[2],bodyM,null,merEdges);
  loadModel(BASE+'city/exchange106.json',LAY.ex[0],LAY.ex[1],LAY.ex[2],bodyM,null,exEdges);   // The Exchange 106, cropped and simplified (tools/convert-dae-crop.py)  // Merdeka PNB 118 (SketchUp Collada, see tools/convert-dae.py)
  }
  // In the district, the two landmarks baked into its mesh were welded coarsely and have holes: draw the full-detail models over them (1 % larger, so they sit just outside).
  var nightLines=[];
  // The long creases are only drawn at night, and finding them (EdgesGeometry over every landmark mesh) took about 1.1 s of main thread at load. So the work is queued
  // per mesh and run one mesh per task, and only once it is needed: at once when the page is (or turns) dark, otherwise as idle warm-up long after load (see sciStyle and warmEdges).
  var edgeJobs=[],edgeTimer=0,edgesWanted=false;
  function pumpEdges(){
    if(edgeTimer||!edgeJobs.length)return;
    edgeTimer=setTimeout(function(){edgeTimer=0;var j=edgeJobs.shift();j[0](j[1],j[2]);need=true;pumpEdges()},0)}
  function edgesFor(color,minLen,op){ // night-only lines along a landmark's long creases (Merdeka ice white, Petronas warm white, The Exchange pale cyan)
    var lm=new T.LineBasicMaterial({color:color,transparent:true,opacity:op,blending:T.AdditiveBlending,depthWrite:false});
    function build(m,out){var eg=new T.EdgesGeometry(m.geometry,42),pa=eg.attributes.position.array,keep=[],SCm=out.scale.x||1;
      for(var e=0;e<pa.length;e+=6){var ex=pa[e+3]-pa[e],ey=pa[e+4]-pa[e+1],ez=pa[e+5]-pa[e+2];if(Math.sqrt(ex*ex+ey*ey+ez*ez)*SCm>minLen)keep.push(pa[e],pa[e+1],pa[e+2],pa[e+3],pa[e+4],pa[e+5])}
      var kg=new T.BufferGeometry();kg.setAttribute('position',new T.Float32BufferAttribute(keep,3));var ln=new T.LineSegments(kg,lm);ln.scale.set(1.006,1,1.006);ln.visible=beaconDark;ln.renderOrder=3;m.parent.add(ln);nightLines.push(ln)}
    return function(out){var ms=[];out.traverse(function(m){if(m.isMesh)ms.push(m)});ms.forEach(function(m){edgeJobs.push([build,m,out])});if(edgesWanted)pumpEdges()}}
  function warmEdges(){edgesWanted=true;pumpEdges()}
  var merEdges=edgesFor(0xd4e9ff,24,.4),klccEdges=edgesFor(0xffe7b0,14,.55),exEdges=edgesFor(0xa8ecff,16,.7);
  // In the district all four landmarks are the hand-made models (the district's own baked Menara KL is cleared out below, see CLEAR/BAKED).
  if(DIST){loadModel(BASE+'city/klcc.json',LAY.klcc[0],LAY.klcc[1],LAY.klcc[2],bodyM,null,klccEdges);loadModel(BASE+'city/menara_kl.json',LAY.kl[0],LAY.kl[1],LAY.kl[2],bodyM,null,null);
    loadModel(BASE+'city/merdeka118.json',LAY.mer[0],LAY.mer[1],LAY.mer[2],bodyM,null,merEdges);loadModel(BASE+'city/exchange106.json',LAY.ex[0],LAY.ex[1],LAY.ex[2],bodyM,null,exEdges)}
  var gr=new T.Mesh(new T.CircleGeometry(1400,64),ground);gr.rotation.x=-Math.PI/2;gr.position.y=-.2;g.add(gr);
  // city ring
  var s=11;function rnd(){s=(s*9301+49297)%233280;return s/233280}
  var i;
  // The city: real OpenStreetMap buildings of central Kuala Lumpur (tools/convert-city.py), centred on KLCC, standing on a plain themed ground.
  // Windows come from two facade textures laid on the walls in the shader: a glass grid by day, lit offices at night.
  var loader=new T.TextureLoader();
  function wrapTex(t){t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;return t}
  // Where a building has a spire or a bare shaft, no rooms light up above (or below) these heights: [x, z, radius, light up to y] and the lowest lit y. Landmarks: Petronas, Merdeka 118, The Exchange 106, Menara KL.
  var LCUT=(function(){var P=crown('klcc'),Mr=crown('mer'),Ex=crown('ex'),Kl=crown('kl');return [[P[0],P[1],34,106],[Mr[0],Mr[1],24,154],[Ex[0],Ex[1],28,122],[Kl[0],Kl[1],9,99]]})(); // derived from LAY: [crown x, z, radius, light up to y]
  var cityU={uCut:{value:LCUT.map(function(c){return new T.Vector4(c[0],c[1],c[2],c[3])})},uLo:{value:[-1,-1,-1,78]},uNight:{value:0},uDay:{value:wrapTex(loader.load(BASE+'city/facade_glass.jpg'))},uNightTex:{value:wrapTex(loader.load(BASE+'city/facade_night.jpg'))}};
  // Facade shader: windows on the walls, in world space, so every building (the OSM city and the landmark models alike) shows its floors.
  function facade(m,glass){
    m.onBeforeCompile=function(sh){
      sh.uniforms.uNight=cityU.uNight;sh.uniforms.uCut=cityU.uCut;sh.uniforms.uLo=cityU.uLo;sh.uniforms.uDay=cityU.uDay;sh.uniforms.uNightTex=cityU.uNightTex;sh.uniforms.uGlass={value:glass?1:0};
      toon(sh);
      sh.fragmentShader=sh.fragmentShader.replace('void main() {',`uniform sampler2D uDay;uniform sampler2D uNightTex;uniform float uNight,uGlass;uniform vec4 uCut[4];uniform float uLo[4];
        float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h21(i),h21(i+vec2(1.0,0.0)),f.x),mix(h21(i+vec2(0.0,1.0)),h21(i+vec2(1.0,1.0)),f.x),f.y);}
        void main() {`)
        .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        vec3 fn=normalize(cross(dFdx(vWP),dFdy(vWP)));
        float wall=1.0-smoothstep(0.45,0.75,abs(fn.y));
        bool onX=abs(fn.z)>abs(fn.x);
        vec2 fuv=(onX?vWP.xy:vWP.zy)/6.0;
        float hq=onX?vWP.x:vWP.z;
        float dl=dot(texture2D(uDay,fuv).rgb,vec3(0.333));
        float gd=distance(vWP,cameraPosition);float gk=mix(0.3*(1.0-smoothstep(70.0,420.0,gd)),0.75*(1.0-0.6*smoothstep(500.0,1200.0,gd)),uNight)*(1.0-uGlass); /* day: faint grid that clears with distance, so far blocks are clean tones; night keeps its grid. (The glass parts of the landmarks have no day grid.) */
        diffuseColor.rgb*=mix(1.0,clamp(dl*1.9,0.0,1.3),wall*gk);
        /* ---- night: lit windows, per window cell, per building, stable in world space ---- */
        float al=1.0;int li=-1;
        for(int i=0;i<4;i++){vec4 c=uCut[i];if(distance(vWP.xz,c.xy)<c.z){li=i;if(vWP.y>c.w||vWP.y<uLo[i])al=0.0;}} /* spires and shafts have no floors: no lit rooms there */
        float lmF=li>=0?1.0:0.0;
        vec2 bk=floor(vWP.xz/20.0);
        float hb=h21(bk+vec2(1.7,4.1));
        float nl=wall*uNight*al*mix(mix(1.0,0.06,step(0.8,hb)),1.0,lmF); /* about one block in five stands (almost) dark */
        nl*=smoothstep(1.0,9.0,vWP.y); /* street level stays dark */
        float b1=h21(bk+vec2(3.7,9.2)),b2=h21(bk+vec2(17.9,2.3));
        vec2 cell=floor(vec2(hq/3.0,vWP.y/1.5)); /* one window = 3 x 1.5 units, two across and four high in each 6-unit tile of the photo */
        vec2 ck=cell+bk*29.0+(onX?vec2(0.0):vec2(61.0,13.0));
        float rr=h21(ck),rc=h21(ck+vec2(5.3,1.1)),rb=h21(ck+vec2(9.1,4.7));
        float rf=h21(vec2(cell.y*2.3+b1*37.0,bk.x*1.7+bk.y*3.1)); /* the same value for every window on one floor of one building: whole floors light up */
        float pl=mix(0.2,0.46,b1),bandT=0.12,wp=mix(0.12,0.95,b2); /* lit share (a quarter to under half), floor-band share, warm share: each building has its own bias */
        if(li==1){pl=0.07;bandT=0.14;wp=0.7;}
        if(li==2){pl=0.08;bandT=0.2;wp=0.0;}
        float lit=step(rr,pl);
        lit=max(lit,step(rf,bandT)*step(rr,0.94));
        lit*=1.0-step(0.9,h21(vec2(cell.y*1.9+b2*13.0,bk.x+bk.y*5.0)))*0.85; /* the odd dark floor */
        vec3 wc=mix(vec3(0.58,0.84,1.0),vec3(1.0,0.62,0.26),step(rc,wp));
        float df=smoothstep(140.0,520.0,gd); /* far away the per-window detail gives way to the building's average, so nothing shimmers */
        float avgp=pl+(1.0-pl)*bandT*0.94;
        lit=mix(lit,avgp,df);
        float tl=dot(texture2D(uNightTex,fuv).rgb,vec3(0.3333));
        float st=mix(clamp(0.2+2.2*tl,0.0,1.5),0.5,df);
        vec3 wem=wc*(0.55+0.8*rb)*lit*st*nl*1.55;
        if(li==0){ /* Petronas: every floor floodlit cool silver, evenly, in regular bands */
          /* each floor is a strip of bright windows cut by the steel mullions; a few rooms are dark, a few warm; the light builds toward the crowns */
          float f=fract(vWP.y/1.9),bx=fract(hq/1.7);
          float win=mix(smoothstep(0.0,0.14,f)*(1.0-smoothstep(0.6,0.8,f))*smoothstep(0.0,0.14,bx)*(1.0-smoothstep(0.78,0.94,bx)),0.46,df);
          vec2 pc=vec2(floor(hq/1.7),floor(vWP.y/1.9))+(onX?vec2(0.0):vec2(31.0,7.0));
          float pr=h21(pc+vec2(2.3,7.7)),pw=h21(pc+vec2(8.1,3.3));
          float pon=mix(step(pr,0.9)*(0.7+0.5*pw),0.8,df);
          vec3 pcw=mix(vec3(0.82,0.91,1.0),vec3(1.0,0.9,0.72),step(0.8,pw)*(1.0-df));
          wem=pcw*(0.07+0.78*win*pon)*(0.75+0.6*smoothstep(10.0,106.0,vWP.y))*nl;}
        if(li==1){ /* Merdeka 118: dark faceted glass. Every floor is a thin, even line of cool light, a few office floors glow warmer, the crown is a bright white lantern, and the spire is lit white, fading upward */
          float mf=fract(vWP.y/1.5);float mline=mix(smoothstep(0.1,0.3,mf)*(1.0-smoothstep(0.42,0.62,mf)),0.3,df);
          float mup=smoothstep(20.0,uCut[1].w,vWP.y);
          float mcr=smoothstep(uCut[1].w-16.0,uCut[1].w-3.0,vWP.y);
          wem=wem*0.8+vec3(0.72,0.86,1.0)*mline*(0.16+0.26*mup)*nl+vec3(0.95,0.98,1.0)*mcr*(0.35+0.75*mline)*nl;}
        if(li==2){ /* The Exchange 106, from a photo: dark blue glass, with the offices lit in blocks of floors (cool white, mostly in the lower half), a faint line on every other floor */
          float ef=floor(vWP.y/1.5),es=fract(vWP.y/1.5),ebx=fract(hq/1.6);
          float ezone=smoothstep(0.42,0.56,vn(vec2(ef/7.0,4.3)))*(1.0-smoothstep(uCut[2].w*0.6,uCut[2].w*0.85,vWP.y));
          float ewin=mix(smoothstep(0.08,0.24,es)*(1.0-smoothstep(0.6,0.8,es))*smoothstep(0.0,0.14,ebx)*(1.0-smoothstep(0.8,0.94,ebx)),0.42,df);
          float eon=mix(step(h21(vec2(floor(hq/1.6),ef)+(onX?vec2(0.0):vec2(23.0,5.0))),mix(0.04,0.82,ezone)),mix(0.04,0.82,ezone),df);
          wem=vec3(0.84,0.93,1.0)*ewin*eon*(0.6+0.5*rb)*nl*1.05+vec3(0.5,0.68,1.0)*ewin*0.05*nl;}
        wem+=vec3(0.92,0.96,1.0)*(li==1?step(uCut[1].w,vWP.y)*(1.0-smoothstep(uCut[1].w,uCut[1].w+44.0,vWP.y)):0.0)*0.75*wall*uNight;
        /* Menara KL, from photos: the shaft floodlit white (the brightest part, faintly fluted, a pink blush at the foot), the pod dark blue-violet with rings of white lamps, a white crown on top of it, the lower antenna lit */
        float kw=li==3?step(vWP.y,uLo[3]):0.0;
        float kang=atan(vWP.z-uCut[3].y,vWP.x-uCut[3].x);
        float kfl=mix(0.84+0.16*step(0.5,fract(kang*24.0/6.2832)),0.92,df);
        wem+=mix(vec3(1.0,0.7,0.82),vec3(0.9,0.95,1.0),smoothstep(2.0,26.0,vWP.y))*(0.55+0.3*smoothstep(8.0,78.0,vWP.y))*kfl*kw*uNight;
        float kp=li==3?al:0.0;
        float kr=fract(vWP.y/2.1),kd=fract(kang*44.0/6.2832);
        float klamp=mix(smoothstep(0.3,0.5,kr)*(1.0-smoothstep(0.5,0.7,kr))*smoothstep(0.28,0.5,kd)*(1.0-smoothstep(0.5,0.72,kd)),0.16,df);
        float ktop=smoothstep(uCut[3].w-5.5,uCut[3].w-4.0,vWP.y);
        wem=mix(wem,(vec3(0.16,0.2,0.62)*0.55+vec3(0.95,0.97,1.0)*(klamp*1.9+ktop*0.9))*uNight,kp);
        wem+=vec3(0.92,0.96,1.0)*(li==3?step(uCut[3].w,vWP.y)*(1.0-smoothstep(uCut[3].w,uCut[3].w+22.0,vWP.y)):0.0)*0.8*uNight;
        /* sodium street light: amber at the feet of buildings and on the ground near them */
        float low=1.0-smoothstep(0.5,11.0,max(vWP.y,0.0));
        float gnd=(1.0-wall)*(1.0-step(2.5,vWP.y));
        float rad=1.0-smoothstep(120.0,820.0,length(vWP.xz+vec2(60.0,60.0)));
        float pool=smoothstep(0.3,0.9,vn(vWP.xz/16.0))*0.7+0.3*vn(vWP.xz/5.0);
        float pg=mix(pool,0.45,smoothstep(120.0,500.0,gd));
        vec3 sod=vec3(1.0,0.5,0.15)*uNight*(wall*low*(0.3+0.45*h21(vec2(floor(hq/4.0),bk.x*3.0+bk.y)))*0.8+gnd*rad*(0.04+0.2*pg));
        diffuseColor.rgb*=1.0-(1.0-uNight)*(wall*low*0.2+gnd*rad*0.13*pg); /* by day the same shapes are shade, not light: darker feet on every building and soft cloud shadows drifting over the ground */
        /* red aviation lights on a few of the tall flat roofs */
        vec2 rc2=floor(vWP.xz/18.0);
        float rl=step(0.9,fn.y)*step(36.0,vWP.y)*(1.0-lmF)*step(0.8,h21(rc2+vec2(11.3,5.9)))*(1.0-smoothstep(0.7,2.2,length(vWP.xz-(rc2+0.5)*18.0)))*uNight;
        totalEmissiveRadiance+=wem+sod+vec3(1.0,0.1,0.06)*rl*1.8;
        /* night glow of the landmarks: floodlit Petronas pinnacles, the lantern crown of The Exchange 106 */
        float gP=(1.0-step(uCut[0].z,distance(vWP.xz,uCut[0].xy)))*step(uCut[0].w,vWP.y);
        float gE=(1.0-step(uCut[2].z,distance(vWP.xz,uCut[2].xy)))*step(uCut[2].w-4.0,vWP.y);
        totalEmissiveRadiance+=uNight*(vec3(1.0,0.95,0.86)*gP*mix(0.16+0.95*mix(smoothstep(0.08,0.24,fract(vWP.y/1.3))*(1.0-smoothstep(0.58,0.78,fract(vWP.y/1.3)))*smoothstep(0.0,0.16,fract(hq/1.15))*(1.0-smoothstep(0.76,0.94,fract(hq/1.15))),0.45,df),0.8,smoothstep(uCut[0].w+17.0,uCut[0].w+22.0,vWP.y))+ /* the crowns keep their windows: smaller floors and bays up the tiers, then the pinnacle's ball and mast lit solid */ gE*(vec3(0.5,0.4,1.0)*0.42+vec3(0.9,0.88,1.0)*mix(max(1.0-smoothstep(0.05,0.12,abs(fract((hq+vWP.y)/3.2)-0.5)),1.0-smoothstep(0.05,0.12,abs(fract((hq-vWP.y)/3.2)-0.5))),0.25,df)*0.85+vec3(1.0)*(1.0-step(uCut[2].w-2.2,vWP.y))*0.9)) /* The Exchange's crown: a violet lantern behind a white diamond lattice, with a bright white rim under it */;`)};
    return m}
  // The ground stays one plain colour. (Roads and dark patches were tried and removed: owner didn't like them.)
  var cityM=facade(mat('mid',DIST?{side:T.DoubleSide}:{}));
  facade(bodyM); // all four landmarks share one material and the facade shader, so none is bluer than the rest
  facade(glassModelM,1); // their glass parts too (they were a flat cyan at night); the ground takes the shader for its street glow
  facade(ground);
  // ---- CLEARING THE PLOTS (district only) ----
  // The district is one merged mesh, so a plot is cleared by dropping triangles before the geometry is built (deterministic, one pass over the index buffer):
  //   CLEAR: each landmark's footprint as a circle [model-local centre x, z, radius] (the model's enclosing circle plus a margin), placed through LAY, so it follows the layout.
  //   BAKED: where the district's own coarse versions stand (world x, z, radius): Merdeka 118 and The Exchange 106 (welded coarsely, with holes) and Menara KL. They are cut out, the hand-made models stand elsewhere.
  // A small block (under 300 m across) touched by a circle is dropped whole, so no half buildings are left; the three big merged slabs only lose the triangles inside.
  var CLEAR=[['klcc',12.5,12.7,45],['kl',0,0,14],['mer',-2.3,1.9,59],['ex',-.1,-1.7,33]],BAKED=[[-217.4,303.3,59],[157.4,304.7,37],[-221.3,181.6,12]];
  function clearPlots(pos,ix){ // pos in metres (the mesh is scaled by SC afterwards)
    var circ=CLEAR.map(function(c){var p=lp(c[0],c[1],c[2]);return [p[0]/SC,p[1]/SC,c[3]/SC]}).concat(BAKED.map(function(c){return [c[0]/SC,c[1]/SC,c[2]/SC]})),
      nV=pos.length/3,nT=ix.length/3,par=new Int32Array(nV),t,k,c;
    for(k=0;k<nV;k++)par[k]=k;
    function f(a){while(par[a]!==a){par[a]=par[par[a]];a=par[a]}return a}
    for(t=0;t<nT;t++){var a=f(ix[t*3]);k=f(ix[t*3+1]);if(k!==a)par[k]=a;c=f(ix[t*3+2]);a=f(ix[t*3]);if(c!==a)par[c]=a}
    var x0=new Float32Array(nV).fill(1e9),x1=new Float32Array(nV).fill(-1e9),z0=new Float32Array(nV).fill(1e9),z1=new Float32Array(nV).fill(-1e9),rootHit=new Uint8Array(nV),hit=new Uint8Array(nT),i3;
    for(t=0;t<nT;t++){var r=f(ix[t*3]),inside=false,mx=0,mz=0;
      for(k=0;k<3;k++){i3=ix[t*3+k]*3;var px=pos[i3],pz=pos[i3+2];mx+=px/3;mz+=pz/3;if(px<x0[r])x0[r]=px;if(px>x1[r])x1[r]=px;if(pz<z0[r])z0[r]=pz;if(pz>z1[r])z1[r]=pz;
        for(c=0;c<circ.length;c++){var dx=px-circ[c][0],dz=pz-circ[c][1];if(dx*dx+dz*dz<circ[c][2]*circ[c][2])inside=true}}
      for(c=0;c<circ.length;c++){var ex=mx-circ[c][0],ez=mz-circ[c][1];if(ex*ex+ez*ez<circ[c][2]*circ[c][2])inside=true}
      if(inside){hit[t]=1;rootHit[r]=1}}
    // Roofs are often separate pieces that only rest on their walls. When a block is dropped, any piece that does not reach the ground and sits over that block goes with it,
    // so no roof is left floating over a cleared plot.
    var y0=new Float32Array(nV).fill(1e9),gone=[],v;
    for(v=0;v<nV;v++){var rv=f(v);if(pos[v*3+1]<y0[rv])y0[rv]=pos[v*3+1]}
    function small(q){return Math.max(x1[q]-x0[q],z1[q]-z0[q])<300}
    for(v=0;v<nV;v++)if(par[v]===v&&rootHit[v]&&small(v)&&x1[v]>=x0[v])gone.push(v);
    for(v=0;v<nV;v++)if(par[v]===v&&!rootHit[v]&&x1[v]>=x0[v]&&y0[v]>4&&small(v)){var cx=(x0[v]+x1[v])/2,cz=(z0[v]+z1[v])/2;
      for(k=0;k<gone.length;k++){var gq=gone[k];if(cx>x0[gq]-3&&cx<x1[gq]+3&&cz>z0[gq]-3&&cz<z1[gq]+3){rootHit[v]=1;break}}}
    var keep=[];
    for(t=0;t<nT;t++){var q=f(ix[t*3]);if(hit[t]||(rootHit[q]&&small(q)))continue;keep.push(ix[t*3],ix[t*3+1],ix[t*3+2])}
    return new Uint16Array(keep)}
  var cityMesh=null;
  fetch(BASE+(DIST?'city/klcc_district.json':'city/kl_city.json')).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(d){
    var q=new Int16Array(b64(d.positions,Uint8Array).buffer),pos=new Float32Array(q.length);for(var k=0;k<q.length;k++)pos[k]=q[k]*d.scale;
    var geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(pos,3));var ix=b64(d.indices,Uint16Array);
    if(DIST)ix=clearPlots(pos,ix); // make room: the landmarks' plots, and the district's own coarse landmarks, are cut out of the mesh
    geo.setIndex(new T.BufferAttribute(ix,1));
    geo=geo.toNonIndexed();geo.computeVertexNormals(); // flat normals: the lighting needs them
    cityMesh=new T.Mesh(geo,cityM);cityMesh.scale.setScalar(SC);g.add(cityMesh);need=true;
  }).catch(function(){});
  // KL Tower
  var kl=new T.Group();kl.position.set(LAY.kl[0],0,LAY.kl[1]); // stand-in, ?bg=osm only (the district always has the model)
  var shaft=new T.Mesh(new T.CylinderGeometry(2,3.4,120,8),towerB);shaft.position.y=60;
  var pod=new T.Mesh(new T.CylinderGeometry(9,6,9,10),glassM);pod.position.y=118;
  var ant=new T.Mesh(new T.CylinderGeometry(.3,1,50,6),towerB);ant.position.y=148;
  kl.add(shaft,pod,ant);if(!DIST)g.add(kl);
  // orb and ring
  var orb=new T.Group();orb.position.set(-57,230,131);
  orb.add(new T.Mesh(new T.SphereGeometry(12,18,14),orbM));
  var ring=new T.Mesh(new T.TorusGeometry(21,1.1,6,40),ringM);ring.rotation.x=1.25;ring.rotation.y=.3;orb.add(ring);g.add(orb);
  // drifting specks
  var sp=new T.BufferGeometry(),pts=[];for(i=0;i<90;i++)pts.push((rnd()-.5)*500,20+rnd()*220,(rnd()-.5)*500);
  sp.setAttribute('position',new T.Float32BufferAttribute(pts,3));
  var specks=new T.Points(sp,new T.PointsMaterial({size:2.2,color:C.ring,transparent:true,opacity:.7}));scene.add(specks);
  // Sci-fi layer: a light beam and halo on each landmark, glowing links between the crowns with a pulse running along each,
  // and a radar ring that sweeps out from the Petronas Towers. Light mode uses normal blending, dark mode adds the light on.
  var KU=3.42; // metres per world unit (Petronas Towers 132 units = about 452 m)
  var LM=[
    {name:'Petronas Twin Towers',real:452,top:new T.Vector3(crown('klcc')[0],134,crown('klcc')[1])},
    {name:'Merdeka PNB 118',real:679,top:new T.Vector3(crown('mer')[0],194,crown('mer')[1])},
    {name:'Menara Kuala Lumpur',real:421,top:new T.Vector3(crown('kl')[0],DIST?127:130,crown('kl')[1])},
    {name:'The Exchange 106',real:445,top:new T.Vector3(crown('ex')[0],DIST?132:136,crown('ex')[1])}]; // tops derived from LAY (crown axis, height as before)
  var fx=[],fxGroup=new T.Group();scene.add(fxGroup);
  function fade(){var c=document.createElement('canvas');c.width=4;c.height=64;var x=c.getContext('2d'),gr=x.createLinearGradient(0,64,0,0);
    gr.addColorStop(0,'#fff');gr.addColorStop(.35,'#9a9a9a');gr.addColorStop(1,'#000');x.fillStyle=gr;x.fillRect(0,0,4,64);return new T.CanvasTexture(c)}
  var fadeTex=fade();
  function fxMat(opts){var m=new T.MeshBasicMaterial(Object.assign({transparent:true,depthWrite:false,side:T.DoubleSide},opts));fx.push(m);return m}
  var beamM=fxMat({alphaMap:fadeTex}),haloM=fxMat({}),radarM=fxMat({});
  var halos=[];
  LM.forEach(function(l){
    var beam=new T.Mesh(new T.CylinderGeometry(.45,.45,90,10,1,true),beamM);beam.position.set(l.top.x,l.top.y+45,l.top.z);fxGroup.add(beam);
    var halo=new T.Mesh(new T.RingGeometry(9,10,48),haloM);halo.rotation.x=-Math.PI/2;halo.position.set(l.top.x,l.top.y-6,l.top.z);fxGroup.add(halo);halos.push(halo);
  });
  var radar=new T.Mesh(new T.RingGeometry(.975,1,128),radarM);radar.rotation.x=-Math.PI/2;radar.position.y=.4;fxGroup.add(radar);
  var linkPairs=[[0,1],[1,3],[1,2],[0,3]],linkPos=[];
  linkPairs.forEach(function(p){linkPos.push(LM[p[0]].top.x,LM[p[0]].top.y-4,LM[p[0]].top.z,LM[p[1]].top.x,LM[p[1]].top.y-4,LM[p[1]].top.z)});
  var linkGeo=new T.BufferGeometry();linkGeo.setAttribute('position',new T.Float32BufferAttribute(linkPos,3));
  var linkM=new T.LineBasicMaterial({transparent:true,opacity:.55,depthWrite:false});
  fxGroup.add(new T.LineSegments(linkGeo,linkM));
  var pulseGeo=new T.BufferGeometry(),pulsePos=new Float32Array(linkPairs.length*3);pulseGeo.setAttribute('position',new T.BufferAttribute(pulsePos,3));
  var pulseM=new T.PointsMaterial({size:4.5,transparent:true,depthWrite:false,sizeAttenuation:true});
  fxGroup.add(new T.Points(pulseGeo,pulseM));
  // Floating wireframe shapes and one big halo, drifting well away from the flight path (a nod to the reference site's drifting cages).
  var polyM=new T.LineBasicMaterial({transparent:true,opacity:.7,depthWrite:false}),polys=[];
  [[new T.IcosahedronGeometry(1,0),14,-20,70,175],[new T.OctahedronGeometry(1,0),10,45,-70,200],[new T.BoxGeometry(1.5,1.5,1.5),12,-110,25,235],
   [new T.IcosahedronGeometry(1,1),9,110,60,150],[new T.OctahedronGeometry(1,0),8,-150,-40,170],[new T.TorusGeometry(1,.012,6,90),46,-70,110,215]].forEach(function(d,i){
    var geo=i===5?d[0]:new T.EdgesGeometry(d[0]),m=i===5?new T.Mesh(geo,haloM):new T.LineSegments(geo,polyM);
    m.scale.setScalar(d[1]);m.position.copy(A0(d[2],d[3],d[4]));if(i===5)m.rotation.x=1.2;fxGroup.add(m);polys.push(m)});
  function A0(u,w,y){return new T.Vector3(.665*u-.747*w,y,.747*u+.665*w)}
  var fxTmp=new T.Vector3();
  function fxUpdate(time,still){
    var t=still?0:time*.001;
    for(var q=0;q<polys.length;q++){if(q<5){polys[q].rotation.x=t*.15*(q+1)*.4;polys[q].rotation.y=t*.2*(q%2?-1:1);polys[q].position.y+=Math.sin(t*.6+q)*.03}else polys[q].rotation.z=t*.05}
    for(var k=0;k<halos.length;k++){var s=1+.12*Math.sin(t*1.4+k*1.7);halos[k].scale.set(s,s,1);halos[k].rotation.z=t*.25*(k%2?-1:1)}
    var ph=still?.35:(t/7)%1;radar.scale.setScalar(6+ph*330);radarM.opacity=(1-ph)*(1-ph)*.7;
    for(var j=0;j<linkPairs.length;j++){var f=still?.5:((t*.12+j*.27)%1),a=LM[linkPairs[j][0]].top,b=LM[linkPairs[j][1]].top;
      fxTmp.copy(a).lerp(b,f);pulsePos[j*3]=fxTmp.x;pulsePos[j*3+1]=fxTmp.y-4;pulsePos[j*3+2]=fxTmp.z}
    pulseGeo.attributes.position.needsUpdate=true}
  // ===== THE SCI-FI LAYER =====
  // Stars, a moon with a ring and a small moon of its own, and gyroscope rings round the Petronas and Merdeka crowns. (A dragon of light was here;
  // it cost frame rate and was removed.) All are cheap (points, thin rings, one textured sphere); the stars and moons
  // follow the camera's bearing so they are always the backdrop behind the city, whichever way the shot looks.
  var sci=new T.Group();scene.add(sci);
  var SMALL=innerWidth<=820;
  // -- stars
  var starGeo=new T.BufferGeometry(),starPos=[],SN=SMALL?420:900;
  for(var si=0;si<SN;si++){var sa=Math.random()*6.2832,se=Math.acos(1-Math.random()*.92),sr=1150;starPos.push(Math.sin(se)*Math.cos(sa)*sr,Math.cos(se)*sr*.8+60,Math.sin(se)*Math.sin(sa)*sr)}
  starGeo.setAttribute('position',new T.Float32BufferAttribute(starPos,3));
  // Two colour sets: day all white (the stars look as they always did); night dim, tinted, and fading out towards the horizon, where the haze hides them.
  var starCL=new Float32Array(SN*3).fill(1),starCD=new Float32Array(SN*3),starSeed=7;
  for(var sj=0;sj<SN;sj++){starSeed=(starSeed*16807)%2147483647;var sr1=starSeed/2147483647;starSeed=(starSeed*16807)%2147483647;var sr2=starSeed/2147483647,sh=Math.max(0,Math.min(1,(starPos[sj*3+1]-60)/900)),sb=Math.pow(sh,1.3)*(.25+.75*sr1*sr1)*(sr2>.5?1:.7);
    starCD[sj*3]=sb*(sr2>.5?1:.85);starCD[sj*3+1]=sb*.92;starCD[sj*3+2]=sb*(sr2>.5?.9:1)}
  var starAL=new T.BufferAttribute(starCL,3),starAD=new T.BufferAttribute(starCD,3);
  var starM=new T.PointsMaterial({size:SMALL?2.4:2,sizeAttenuation:false,transparent:true,depthWrite:false,fog:false,vertexColors:true});
  var stars=new T.Points(starGeo,starM);stars.renderOrder=-20;stars.frustumCulled=false;sci.add(stars);
  // -- moon: a cratered sphere, a tilted ring, a halo, and a small moon going round it
  function moonTex(){var c=document.createElement('canvas');c.width=256;c.height=128;var x=c.getContext('2d');x.fillStyle='#d8d8d8';x.fillRect(0,0,256,128);
    for(var i=0;i<46;i++){var cx=Math.random()*256,cy=Math.random()*128,r=3+Math.random()*13;x.fillStyle='rgba(60,70,90,'+(.1+Math.random()*.2)+')';x.beginPath();x.arc(cx,cy,r,0,6.2832);x.fill();
      x.fillStyle='rgba(255,255,255,'+(.14+Math.random()*.12)+')';x.beginPath();x.arc(cx-r*.25,cy-r*.25,r*.7,0,6.2832);x.fill()}
    var t=new T.CanvasTexture(c);return t}
  function glowTex(){var c=document.createElement('canvas');c.width=c.height=128;var x=c.getContext('2d'),g=x.createRadialGradient(64,64,10,64,64,64);g.addColorStop(0,'rgba(255,255,255,.95)');g.addColorStop(.35,'rgba(255,255,255,.28)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,128,128);return new T.CanvasTexture(c)}
  var mTex=moonTex(),gTex=glowTex();
  var moonM=new T.MeshBasicMaterial({map:mTex,fog:false}),moon=new T.Mesh(new T.SphereGeometry(70,32,20),moonM),moonG=new T.Group();
  moon.renderOrder=-15;moonG.add(moon);
  var moonHalo=new T.Sprite(new T.SpriteMaterial({map:gTex,transparent:true,depthWrite:false,fog:false}));moonHalo.scale.set(300,300,1);moonHalo.renderOrder=-16;moonG.add(moonHalo);
  var ringMat=new T.MeshBasicMaterial({transparent:true,side:T.DoubleSide,depthWrite:false,fog:false});
  var moonRing=new T.Mesh(new T.RingGeometry(104,108,96),ringMat),moonRing2=new T.Mesh(new T.RingGeometry(116,118,96),ringMat);
  moonRing.rotation.x=1.15;moonRing2.rotation.x=1.15;moonRing.renderOrder=moonRing2.renderOrder=-14;moonG.add(moonRing,moonRing2);
  var moon2M=new T.MeshBasicMaterial({map:mTex,fog:false}),moon2=new T.Mesh(new T.SphereGeometry(15,20,14),moon2M);moon2.renderOrder=-14;moonG.add(moon2);
  sci.add(moonG);
  // -- gyroscope rings round the Petronas crowns and the top of Merdeka 118
  var gyroM=new T.MeshBasicMaterial({transparent:true,depthWrite:false,side:T.DoubleSide}),gyros=[];
  function addGyro(c,r,speed){var g=new T.Group();g.position.copy(c);
    [[r,0,0,1],[r*1.3,1.1,.4,-.8],[r*1.62,.5,1.2,.6]].forEach(function(d,i){
      var ring=new T.Mesh(new T.TorusGeometry(d[0],.32,6,96),gyroM),holder=new T.Group();holder.rotation.set(d[1],d[2],0);holder.add(ring);
      var bead=new T.Mesh(new T.SphereGeometry(1.5,10,8),gyroM);bead.position.set(d[0],0,0);ring.add(bead);g.add(holder);gyros.push({h:holder,ring:ring,sp:d[3]*speed})});
    sci.add(g);return g}
  addGyro(new T.Vector3(crown('klcc')[0],128,crown('klcc')[1]),22,1);
  addGyro(LM[1].top.clone().add(new T.Vector3(0,-14,0)),12,1.4);
  // ===== RAIL: a sky line through the landmarks and a ring round the Petronas Towers, with trains =====
  // Both lines were checked with raycasts against the whole district: nothing within 4.5 units at these heights.
  // The sky line runs Petronas > Menara KL > Merdeka 118 > The Exchange 106 > back. One "hero" train on it is driven by the scroll during the drone
  // flight, so the camera can chase it from Menara KL to Merdeka (see place()); every other train runs on time.
  // The sky line is a closed loop through (u,w,y) points in the gap frame (A0): over the street side of the skybridge, out round the left of the towers, then past each landmark
  // on the side facing the towers (Menara KL at 38 units from its axis, Merdeka 118 at 72, The Exchange 106 at 55: clear of their footprints), and home round the other side.
  // The landmark points come from LAY, so the line follows the layout. Checked against every district and model vertex: the loop stays more than 12 units clear (the old line kept 4.5).
  function UW0(x,z){return [.665*x+.747*z,-.747*x+.665*z]}
  function toward(c,d){var L=Math.hypot(c[0],c[1])||1;return [c[0]-c[0]/L*d,c[1]-c[1]/L*d]} // d units from c towards the towers
  var kU=UW0(LAY.kl[0],LAY.kl[1]),mU=UW0(LAY.mer[0],LAY.mer[1]),eU=UW0(LAY.ex[0],LAY.ex[1]),kP=toward(kU,38),mP=toward(mU,72),eP=toward(eU,55);
  var skyCurve=new T.CatmullRomCurve3([[41,0,88],[10,95,78],[kP[0],kP[1],58],[mP[0],mP[1],58],[eP[0],eP[1],58],[-20,-105,66],[40,-70,76]].map(function(p){return A0(p[0],p[1],p[2])}),true,'catmullrom',.5);
  var ringPts=[];for(var rgi=0;rgi<12;rgi++){var rga=rgi/12*6.2832;ringPts.push(A0(Math.cos(rga)*41,Math.sin(rga)*41,17))}
  var ringCurve=new T.CatmullRomCurve3(ringPts,true,'catmullrom',.5);
  var skyLen=skyCurve.getLength(),ringLen=ringCurve.getLength();
  var tgtV=new T.Vector3(),chH=new T.Vector3(),chT=new T.Vector3(),chS=new T.Vector3(),chP=new T.Vector3(),chL=new T.Vector3();
  var railM=new T.MeshBasicMaterial({transparent:true,opacity:.9,fog:true}),railM2=new T.MeshBasicMaterial({transparent:true,opacity:.35,fog:true});
  var skyTube=new T.Mesh(new T.TubeGeometry(skyCurve,260,.5,5,true),railM),ringTube=new T.Mesh(new T.TubeGeometry(ringCurve,120,.45,5,true),railM);
  var skyGlow=new T.Mesh(new T.TubeGeometry(skyCurve,200,1.6,5,true),railM2);
  scene.add(skyTube,ringTube,skyGlow);
  // short pillars under the ring line
  var pillarM=new T.MeshBasicMaterial({transparent:true,opacity:.7}),pillars=new T.InstancedMesh(new T.CylinderGeometry(.35,.5,17,6),pillarM,24),pdm=new T.Object3D();
  for(var pi=0;pi<24;pi++){var pp=ringCurve.getPointAt(pi/24);pdm.position.set(pp.x,8.5,pp.z);pdm.updateMatrix();pillars.setMatrixAt(pi,pdm.matrix)}
  scene.add(pillars);
  // trains: cars are instanced boxes (long axis Z) plus a lit window strip on each
  var CARL=6.4,CARGAP=.7,trains=[{c:skyCurve,len:skyLen,cars:5,sp:34,off:0,hero:false},{c:skyCurve,len:skyLen,cars:5,sp:34,off:.5,hero:false},{c:skyCurve,len:skyLen,cars:5,sp:0,off:0,hero:true},{c:ringCurve,len:ringLen,cars:4,sp:-15,off:0,hero:false},{c:ringCurve,len:ringLen,cars:4,sp:15,off:.5,hero:false}];
  if(innerWidth<=820)trains.splice(1,1);
  var nCars=0;trains.forEach(function(t){t.i0=nCars;nCars+=t.cars});
  var carBodyM=new T.MeshBasicMaterial({fog:true}),carWinM=new T.MeshBasicMaterial({fog:true}),carStripeM=new T.MeshBasicMaterial({fog:true});
  var carBody=new T.InstancedMesh(new T.BoxGeometry(2.5,2.7,CARL),carBodyM,nCars),carWin=new T.InstancedMesh(new T.BoxGeometry(2.62,.85,CARL-1.2),carWinM,nCars),carStripe=new T.InstancedMesh(new T.BoxGeometry(2.58,.32,CARL),carStripeM,nCars);
  carBody.frustumCulled=carWin.frustumCulled=carStripe.frustumCulled=false;scene.add(carBody,carWin,carStripe);
  var headGlowM=new T.SpriteMaterial({map:gTex,transparent:true,depthWrite:false,color:0xfff0c0,opacity:.9}),headGlows=trains.map(function(){var sp=new T.Sprite(headGlowM);sp.scale.set(15,15,1);scene.add(sp);return sp});
  var trD=new T.Object3D(),trP=new T.Vector3(),trT=new T.Vector3(),trTarget=new T.Vector3(),heroS=0,heroOn=false;
  var tK=0,tM=0;(function(){var kp=A0(kU[0],kU[1],58),mp=A0(mU[0],mU[1],58),bk=1e9,bm=1e9,q=new T.Vector3();for(var i=0;i<400;i++){skyCurve.getPointAt(i/400,q);var dk=Math.hypot(q.x-kp.x,q.z-kp.z),dm=Math.hypot(q.x-mp.x,q.z-mp.z);if(dk<bk){bk=dk;tK=i/400}if(dm<bm){bm=dm;tM=i/400}}})();
  function railUpdate(time,still){
    var t=still?0:time*.001;
    for(var k=0;k<trains.length;k++){var tr=trains[k];if(tr.hero&&!heroOn){headGlows[k].visible=false;for(var z=0;z<tr.cars;z++){trD.position.set(0,-9999,0);trD.updateMatrix();carBody.setMatrixAt(tr.i0+z,trD.matrix);carWin.setMatrixAt(tr.i0+z,trD.matrix);carStripe.setMatrixAt(tr.i0+z,trD.matrix)}continue}
      var head=tr.hero?heroS:(((tr.off+(t*tr.sp)/tr.len)%1)+1)%1;
      for(var c=0;c<tr.cars;c++){var u=(((head-c*(CARL+CARGAP)/tr.len)%1)+1)%1;tr.c.getPointAt(u,trP);tr.c.getTangentAt(u,trT);
        trD.position.copy(trP);trTarget.copy(trP).add(trT);trD.lookAt(trTarget);trD.updateMatrix();
        carBody.setMatrixAt(tr.i0+c,trD.matrix);
        trD.position.y+=.35;trD.updateMatrix();carWin.setMatrixAt(tr.i0+c,trD.matrix);
        trD.position.y-=1.05;trD.updateMatrix();carStripe.setMatrixAt(tr.i0+c,trD.matrix)}
      tr.c.getPointAt(head,trP);tr.c.getTangentAt(head,trT);headGlows[k].visible=true;headGlows[k].position.copy(trP).addScaledVector(trT,CARL*.55).add(new T.Vector3(0,.3,0))}
    carBody.instanceMatrix.needsUpdate=true;carWin.instanceMatrix.needsUpdate=true;carStripe.instanceMatrix.needsUpdate=true}
  function railStyle(dark){
    railM.color.set(dark?C.glass:C.line);railM.blending=dark?T.AdditiveBlending:T.NormalBlending;railM2.color.set(dark?C.glass:C.line);railM2.blending=dark?T.AdditiveBlending:T.NormalBlending;railM2.opacity=dark?.25:.3;pillarM.color.set(dark?C.mid:C.near);
    carBodyM.color.set(dark?0x1b3d73:0xf6fbff);carWinM.color.set(dark?0xfff1b8:0x0b2a6b);carStripeM.color.set(dark?C.glass:0x1559c9);
    headGlowM.opacity=dark?.95:.5;headGlowM.color.set(dark?0xfff0c0:0xffffff);
    [railM,railM2,headGlowM].forEach(function(m){m.needsUpdate=true})}
  // Aircraft warning lights: a red double flash on the tip of every landmark (and on both Petronas spires), instead of lit rooms up there.
  var BEAC=(function(){var a=lp('klcc',11,-10),b=lp('klcc',-11,10),m=crown('mer'),e=crown('ex'),k=crown('kl');return [[a[0],134,a[1]],[b[0],134,b[1]],[m[0],193,m[1]],[e[0],136,e[1]],[k[0],130,k[1]]]})(); // both Petronas spires, then the tips of Merdeka 118, The Exchange 106 and Menara KL
  var beacons=BEAC.map(function(b,i){var m=new T.SpriteMaterial({map:gTex,transparent:true,depthWrite:false,color:0xff3a2a,fog:false,opacity:0}),sp=new T.Sprite(m);sp.scale.set(i===2?22:14,i===2?22:14,1);sp.position.set(b[0],b[1],b[2]);sp.renderOrder=6;g.add(sp);return{m:m,ph:i*.37}});
  var beaconDark=beaconDark||false;
  function beaconUpdate(time){var t=time/1000;beacons.forEach(function(b){var p=((t/1.7+b.ph)%1+1)%1,a=(p<.09||(p>.2&&p<.29))?1:.08;b.m.opacity=a*(beaconDark?1:.45);b.m.blending=beaconDark?T.AdditiveBlending:T.NormalBlending})}
  // Night moon: put in the clearest part of the picture. Each frame, a few candidate spots on the screen are scored by their distance from the projected landmark tops (and their spires),
  // the best one wins (with a bias for the current one, so it does not hop), and the moon eases there, 1100 units out along that ray. Day keeps the old fixed placement.
  var sciPos=new T.Vector3(),MCAND=[[.74,.62],[-.74,.62],[0,.82],[.86,.18],[-.86,.18],[.45,.84],[-.45,.84]],mIdx=0,mX=.74,mY=.62,mP=new T.Vector3(),mTop=[];
  LM.forEach(function(l){mTop.push(l.top.clone(),l.top.clone().add(new T.Vector3(0,40,0)),l.top.clone().add(new T.Vector3(0,-40,0)))});
  function moonPlace(still){
    cam.updateMatrixWorld();var asp=cam.aspect,pts=[],i,j;
    for(i=0;i<mTop.length;i++){mP.copy(mTop[i]).project(cam);if(mP.z<1)pts.push(mP.x*asp,mP.y)}
    var best=-1,bi=mIdx;
    for(j=0;j<MCAND.length;j++){var cx=MCAND[j][0]*asp,cy=MCAND[j][1],sc=9;
      for(i=0;i<pts.length;i+=2){var d=Math.hypot(pts[i]-cx,pts[i+1]-cy);if(d<sc)sc=d}
      if(j===mIdx)sc+=.25;if(sc>best){best=sc;bi=j}}
    mIdx=bi;var k=still?1:.12;mX+=(MCAND[mIdx][0]-mX)*k;mY+=(MCAND[mIdx][1]-mY)*k;
    mP.set(mX,mY,.5).unproject(cam).sub(cam.position).normalize().multiplyScalar(1100).add(cam.position);moonG.position.copy(mP)}
  moonG.position.set(-265,326,-831); // behind the skyline as the page opens, high enough to clear the tops
  function sciUpdate(time,still,inRide){
    beaconUpdate(time);
    var t=still?0:time*.001,cl=Math.hypot(cam.position.x,cam.position.z)||1,dx=cam.position.x/cl,dz=cam.position.z/cl;
    stars.rotation.y=t*.004;
    /* the moon is locked to one place in the sky (owner's call: it used to follow the camera and hop between clear spots) */
    moon.rotation.y=t*.03;moonRing.rotation.z=t*.02;moonRing2.rotation.z=-t*.015;
    moon2.position.set(Math.cos(t*.22)*170,Math.sin(t*.22)*28,Math.sin(t*.22)*170);
    for(var g=0;g<gyros.length;g++){gyros[g].ring.rotation.z=t*.5*gyros[g].sp;gyros[g].h.rotation.y+=still?0:.0016*gyros[g].sp}
    railUpdate(time,still)}
  function sciStyle(dark){
    beaconDark=dark;nightLines.forEach(function(l){l.visible=dark});if(dark)warmEdges();
    starM.color.set(dark?0xffffff:C.near);starM.opacity=dark?1:.38;starM.blending=dark?T.AdditiveBlending:T.NormalBlending;starGeo.setAttribute('color',dark?starAD:starAL);
    moonM.color.set(dark?0xc4cfee:C.near);moon2M.color.set(dark?0xcfd8f2:C.mid);
    moonHalo.material.color.set(dark?0x9dbbff:0xffffff);moonHalo.material.opacity=dark?.38:.85;
    ringMat.color.set(dark?0xbcd2ff:C.near);ringMat.opacity=dark?.5:.55;
    gyroM.color.set(dark?C.glass:C.line);gyroM.opacity=dark?.85:.75;gyroM.blending=dark?T.AdditiveBlending:T.NormalBlending;
    [starM,ringMat,gyroM,moonHalo.material].forEach(function(m){m.needsUpdate=true});railStyle(dark)}
  function fxStyle(dark){
    var bl=dark?T.AdditiveBlending:T.NormalBlending,c=C.line;
    beamM.color.set(c);beamM.blending=bl;beamM.opacity=dark?.7:.6;
    haloM.color.set(c);haloM.blending=bl;haloM.opacity=dark?.9:.8;
    radarM.color.set(c);radarM.blending=bl;
    polyM.color.set(c);polyM.blending=bl;polyM.opacity=dark?.8:.7;polyM.needsUpdate=true;
    linkM.color.set(c);linkM.opacity=dark?.5:.6;pulseM.color.set(dark?C.glass:C.line);
    fx.forEach(function(m){m.needsUpdate=true});sciStyle(dark)}
  function fogColor(){return root.getAttribute('data-theme')==='dark'?col('skyM').lerp(col('sky3'),.5):col('sky2')} // the fog (cars, rails) takes the haze colour at night
  var fogN0=300,fogF0=680; // base fog (set by recolor); the finale pushes it back
  function recolor(){
    root.style.removeProperty('--sky1');root.style.removeProperty('--sky2');goldLast=-1;readColors();var dark=root.getAttribute('data-theme')==='dark';
    mats.forEach(function(m){var r=m.userData.role;if(r)m.color.set(C[r])});
    tower.emissive.set(C.glass);tower.emissiveIntensity=dark?1:.28;glassM.emissive.set(C.ring);glassM.emissiveIntensity=dark?.9:.15;
    cityU.uNight.value=dark?1:0;
    if(glassModelM){glassModelM.emissive.set(C.ring);glassModelM.emissiveIntensity=dark?0:.04}ringM.color.set(C.ring);specks.material.color.set(C.ring);
    var f=fogColor();fogN0=dark?520:620;fogF0=dark?1500:1700; /* thin fog: it used to hide the city */scene.fog=new T.Fog(f,fogN0,fogF0);
    TU.uSky1.value.set(C.sky1);TU.uSky2.value.set(C.skyM);TU.uSky3.value.set(C.sky3);TU.uStop.value=dark?.58:1;
    if(dark){TU.uLitMul.value.set(3,3,1.9);TU.uMidMul.value.set(.95,.95,.95);TU.uLitMix.value=0;TU.uShadeMul.value.set(.45,.5,.7);TU.uHazeK.value=.55} /* night: dark blue-violet silhouettes in three tones, the haze takes the warm horizon colour */
    else{TU.uLitMul.value.set(1,1,1);TU.uMidMul.value.set(1,1,1);TU.uLitMix.value=.42;TU.uShadeMul.value.set(.46,.62,.95);TU.uHazeK.value=.5} /* day: one blue, three steps of it. Lit faces are a pale tint of the base (not white), shade is the same blue deepened, so every building sits in one family and the steps give the depth */
    TU.uSunAmt.value=dark?1:.5;shadeBase.copy(TU.uShadeMul.value);hazeBase=TU.uHazeK.value;
    fxStyle(dark);amb.intensity=dark?.45:.5;sun.intensity=dark?.55:.55;sun.color.set(dark?0xb0b4ff:0xffffff)}
  recolor();window.addEventListener('scenetheme',function(){recolor();need=true});
  new MutationObserver(function(){recolor();need=true}).observe(root,{attributes:true,attributeFilter:['data-theme']}); // the page's own theme button flips data-theme
  var W=0,Hh=0,mobile=false,need=true,px=0,tx=0,cr=0,tr=0,vr={v:0},vx={v:0},dtF=.016,tgtPose=mob(END),curPose=mob(END),vPose=[{v:0},{v:0},{v:0},{v:0},{v:0},{v:0},{v:0},{v:0}];
  function size(){W=innerWidth;Hh=innerHeight;mobile=W<=820;renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1.5:2));renderer.setSize(W,Hh,false);renderer.getDrawingBufferSize(TU.uRes.value);cam.aspect=W/Hh;cam.updateProjectionMatrix();need=true}
  var enter=document.getElementById('enter'),caps=enter?enter.querySelectorAll('.ride-cap'):[],roll=0,rideP=null,rideT=null,rideQ=null;
  // The page scroll is split in two: first the orbit round the skyline, then (inside #enter) the flight.
  // ---- THE DIRECTOR ----
  // Before the flight, every section of the page has its own camera shot. A shot (a "pose") is:
  //   [cx, cz, a, r, y, ty, sx, sy]  = look at (cx, ty, cz) from bearing a (degrees) at radius r and height y,
  //   with the picture pushed right by sx (and down by sy) as a fraction of the screen, so a panel can sit on the other side.
  // Poses are interpolated as bearings and radii, not as straight lines, so the camera sweeps round the building instead of through it.
  // The keys below are placed on the page by section: [section id, fraction down it, viewport offset, pose]. Keys are
  // spaced so a shot holds while its section is read and the move to the next one happens in the gap between them.
  // "Fly it again in dark mode": shown over the finale; it switches the theme and goes back to the start of the flight.
  var again=document.getElementById('fly-again'),DBGCR=/[?&]dbg/.test(location.search);
  if(again){(function(){var H=document.documentElement,lab=again.querySelector('b');
    function isDark(){return H.getAttribute('data-theme')==='dark'}
    function label(){if(lab)lab.textContent=isDark()?'Fly it again in light mode':'Fly it again in dark mode'}
    label();if('MutationObserver' in window)new MutationObserver(label).observe(H,{attributes:true,attributeFilter:['data-theme']});
    again.addEventListener('click',function(){var tb=document.getElementById('theme-btn');
      if(tb)tb.click();else{var nx=isDark()?'light':'dark';H.setAttribute('data-theme',nx);try{localStorage.setItem('theme',nx)}catch(e){}}
      var en=document.getElementById('enter');if(en)scrollTo({top:en.getBoundingClientRect().top+scrollY+innerHeight*.15,behavior:'instant'})})})()}
  var spin=document.getElementById('spin'),SP0=.06,SPW=.28,sTop=0,sH=0; // sTop/sH: the buffer's place (read on layout, not per frame)
  function P(cx,cz,a,r,y,ty,sx,sy,mr){return [cx,cz,a,r,y,ty,sx||0,sy||0,mr||0]} // mr: the radius to use on a phone for a wide shot of the group (0 = the usual 12 % back)
  var MER=[LAY.mer[0],LAY.mer[1]],EXC=[LAY.ex[0],LAY.ex[1]],KLT=[LAY.kl[0],LAY.kl[1]];  // Merdeka 118, The Exchange 106, Menara KL (scene units, Petronas is 0,0), all from LAY
  // GC: the middle of the four landmarks (the finale arc and the wide HUD views look at it). The wide shots below were fitted so all four tops stay on screen:
  // each is [look-at centre x, z, bearing, radius, camera height, look-at height, push, ..., phone radius] (see P). Landmarks stand 100-170 units out, so a wide shot sits 240-300 back.
  var GC=[(LAY.klcc[0]+LAY.kl[0]+LAY.mer[0]+LAY.ex[0])/4,(LAY.klcc[1]+LAY.kl[1]+LAY.mer[1]+LAY.ex[1])/4];
  var GAP=48.3;                                            // bearing of the gap between the towers (street side)
  // Bearings (degrees, world x toward z): Menara KL stands at about 176 from the towers, Merdeka 118 at 214 and The Exchange 106 at 287, so shots that look at the towers from
  // those sides would put the camera inside them (the old UTP 'far side' shot did). The wide shots use bearings where the four silhouettes stay apart (60-65, 130-150, 190, 235; found by scoring every 10 degrees).
  var UTP=[                                                // UTP: one shot per group in the coverflow, in the order of its cards
    P(0,0,40,235,85,66,.24),                               // 0 Languages: the whole of the towers
    P(0,0,62,112,122,118,.24),                             // 1 Programming: the crowns
    P(0,0,GAP+90,150,52,56,.24),                           // 2 Computer systems: along the skybridge, from the south-west
    P(0,0,45,78,14,100,.24),                               // 3 Maths: the foot of the towers, looking up
    P(0,0,125,118,172,56,.24),                             // 4 Data & AI: down on them from above
    P(0,0,100,175,62,46,.24),                              // 5 Business & people: the podium and Suria KLCC from the south
    P(-15,-91,25,310,100,85,.24,0,750)                                   // 6 The big ones: back to take in the skyline
  ];
  var utpIdx=0;
  var END=P(-15,-11,45,240,95,85,0);                           // where the flight takes over (the flight's first key is built from this, see buildKF)
  var DIR=[
    ['top',0,0,P(-15,-11,65,250,100,85,.1,0,680)],                     // the opening
    ['spin',0,-1,P(-95,-11,130,230,100,100,0,0,440)],                      // the buffer turns the city about 85 degrees
    ['spin',1,-1,P(-95,-11,150,250,100,100,0,0,390)],
    ['me',.2,-.5,P(-95,-11,150,250,100,100,0,0,390)],
    ['why',.5,-.5,P(-95,-91,190,290,100,100,0,0,550)],
    ['notes',.14,-.5,P(0,0,45,76,12,100,.22)],            // Notes: under the towers, looking up ...
    ['notes',.52,-.5,P(0,0,72,86,50,88,.22)],             // ... then climbing as you read
    ['notes',.9,-.5,P(0,0,98,130,98,74,.22)],
    ['studied',.14,-.5,function(){return UTP[utpIdx]}],   // UTP: the shot follows the group you pick
    ['studied',.9,-.5,function(){return UTP[utpIdx]}],
    // The shots at one landmark look at it from the side away from the group (bearing from the group's middle to the landmark), so the others stand behind it.
    ['merdekastage',.3,-.5,P(MER[0],MER[1],160,135,16,78,-.2)],  // a lead-in all of its own: the tower looming over its label
    ['toolkit',.1,-.5,P(MER[0],MER[1],150,125,5,118,0)],    // Skills: Merdeka 118 between the two columns, base first ...
    ['toolkit',.38,-.5,P(MER[0],MER[1],175,300,95,96,0)], // ... the whole building ...
    ['toolkit',.66,-.5,P(MER[0],MER[1],205,150,150,150,0)],// ... the upper half ...
    ['toolkit',.92,-.5,P(MER[0],MER[1],235,240,215,172,0)],// ... and the spire
    ['workstage',.3,-.5,P(KLT[0],KLT[1],215,205,72,66,.2)],// Work: Menara KL
    ['work',.5,-.5,P(KLT[0],KLT[1],255,215,82,66,.1)],
    ['pulse',.5,-.5,P(-95,-91,235,280,100,100,0,0,700)],
    ['journey',.1,-.5,P(EXC[0],EXC[1],300,78,8,76,-.22)], // Journey: The Exchange 106, climbing as the years go by
    ['journey',.3,-.5,P(EXC[0],EXC[1],335,118,96,122,-.22)],
    ['journey',.62,0,P(-25,9,60,360,190,70,0,0,900)],                 // pull right back (zoom out) ...
    ['enter',0,-1,END]                                         // ... then in to where the flight starts (zoom in)                                     // the flight starts here
  ];
  var KEYS=[],lastLay=-1;
  function mob(p){if(!mobile)return p;var q=p.slice(0,8);q[6]=0;if(p[8]){q[3]=p[8]}else{q[3]*=1.12;q[4]*=1.08}return q} // a portrait screen is only 0.49 of its height wide: a wide shot of the group stands much farther back there (p[8])
  function layoutKeys(){
    var vh=innerHeight,k=[];
    if(spin){sTop=spin.offsetTop;sH=spin.offsetHeight}
    DIR.forEach(function(d){
      var y=0;
      if(d[0]!=='top'){var el=document.getElementById(d[0]);if(!el||el.offsetHeight===0)return;y=el.offsetTop+d[1]*el.offsetHeight+d[2]*vh}
      k.push({y:Math.max(0,y),p:d[3]})});
    k.sort(function(u,v){return u.y-v.y});
    for(var i=1;i<k.length;i++)if(k[i].y<=k[i-1].y)k[i].y=k[i-1].y+1;
    KEYS=k;lastLay=document.documentElement.scrollHeight}
  function poseOf(k){var p=typeof k.p==='function'?k.p():k.p;return mob(p)}
  function dirPose(y){
    if(ONLY||!KEYS.length)return mob(END);
    if(y<=KEYS[0].y)return poseOf(KEYS[0]);
    for(var i=1;i<KEYS.length;i++){
      if(y<=KEYS[i].y){var a=poseOf(KEYS[i-1]),b=poseOf(KEYS[i]),t=(y-KEYS[i-1].y)/Math.max(1,KEYS[i].y-KEYS[i-1].y);t=t*t*(3-2*t);
        var o=[];for(var j=0;j<8;j++)o.push(a[j]+(b[j]-a[j])*t);return o}}
    return poseOf(KEYS[KEYS.length-1])}
  function rideProg(){if(!enter)return 0;var m=document.documentElement.scrollHeight-innerHeight,st=ONLY?0:enter.offsetTop-innerHeight;return m>st?Math.min(1,Math.max(0,(scrollY-st)/(m-st))):0}
  function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
  // Critically damped follow (no overshoot, no jump when a wheel notch lands): the camera glides to where the scroll bar is.
  function damp(c,t,v,st,dt){var o=2/st,x=o*dt,e=1/(1+x+.48*x*x+.235*x*x*x),ch=c-t,tmp=(v.v+o*ch)*dt;v.v=(v.v-o*tmp)*e;return t+(ch+tmp)*e}
  function poseCam(p){p=mob(p);var a=p[2]*Math.PI/180;return{pos:new T.Vector3(p[0]+Math.cos(a)*p[3],p[4],p[1]+Math.sin(a)*p[3]),tgt:new T.Vector3(p[0],p[5],p[1])}} // camera of a director pose
  function orbitPose(p,pxv){var e=Math.sin(p*Math.PI),ang=.55+p*Math.PI*1.7+pxv*.12*(1-p),rad=(mobile?290:250)-e*30,hgt=(mobile?112:100)+e*60;
    return{pos:new T.Vector3(Math.cos(ang)*rad,hgt,Math.sin(ang)*rad),tgt:new T.Vector3(0,H*(mobile?.5:.52)-e*18,0)}}

  // THE FLIGHT. One direction only, never back on itself:
  //   swing in from the side -> line up with the skybridge head-on -> over the bridge and out through the gap between the towers
  //   -> one slow turn up Merdeka 118 -> over the top and across The Exchange 106 -> pull back to a wide shot of all four.
  // Waypoints are written in (u, w, y): u runs along the gap between the towers (toward the street side), w across it, y up. World units.
  var UX=new T.Vector3(.665,0,.747),WX=new T.Vector3(-.747,0,.665);
  function A(u,w,y){return new T.Vector3(UX.x*u+WX.x*w,y,UX.z*u+WX.z*w)}
  var MC={u:-80,w:-63};                                   // ?bg=osm only: Merdeka 118's axis on the real map
  // THE LANDMARKS IN THE GAP FRAME. Every flight waypoint below is written relative to these, which come from LAY, so moving a landmark in LAY re-aims its spiral and the legs to it.
  //   MCD / EXD / KLD = Merdeka 118, The Exchange 106 and Menara KL (model origin = tower axis); ENDC = what the finale looks at (fitted so all four tops stay in frame, see the wide shots); ENDN = unit direction from ENDC to the finale camera (bearing FB).
  function UW(x,z){return {u:UX.x*x+UX.z*z,w:WX.x*x+WX.z*z}}  // world x,z -> (u,w); a direction maps the same way
  var MCD=UW(LAY.mer[0],LAY.mer[1]),EXD=UW(LAY.ex[0],LAY.ex[1]),KLD=UW(LAY.kl[0],LAY.kl[1]),ENDC=UW(-15,-11),FB=65,ENDN=UW(Math.cos(FB*Math.PI/180),Math.sin(FB*Math.PI/180)); // the finale looks from the opening's bearing, so the film starts and ends on the same view
  function arcAt(deg,r,y,ty){var C=DIST?MCD:MC,a=deg*Math.PI/180;return [A(C.u+Math.cos(a)*r,C.w+Math.sin(a)*r,y),A(C.u,C.w,ty)]}
  // [name, camera position, look-at point, slow factor of the stretch that FOLLOWS it (bigger = more scroll spent there)]
  var KF=null,CAPS=DIST?[['start','bridge'],['bridge','exit'],['exit','sw1'],['sw1','e0'],['e0','sk0'],['sk0','end']]:[['start','front'],['front','over'],['over','out'],['out','m4'],['m4','pass'],['pass','end']];
  function railNear(x,z){var b=1e9,s=0,q=new T.Vector3();for(var i=0;i<600;i++){skyCurve.getPointAt(i/600,q);var d=Math.hypot(q.x-x,q.z-z);if(d<b){b=d;s=i/600}}return s} // the sky rail's parameter nearest to a world point (build time only)
  function buildKF(){
    var o=DIST?poseCam(END):orbitPose(1,0),m1=arcAt(90,55,96,112),m2=arcAt(130,55,116,132),m3=arcAt(180,55,138,150),m4=arcAt(230,55,166,178),m5=arcAt(270,55,200,205);
    if(DIST){
      // THE DRONE FLIGHT, eight beats, each a different kind of move, fast ones between slow ones (the slow factor, last-but-one number, sets the pace: 0.8 fast, 1.4 medium, 2.4 slow):
      //   1 drop-in (fast)      from the opening pose down to street level, rushing over the blocks toward the Petronas Towers
      //   2 Petronas rise       a three-quarter turn climbing round both towers, ending head-on at the skybridge
      //   3 skybridge thread    over the bridge and through the gap (the barrel roll is in the roll column; see BARREL)
      //   4 halo round Menara KL one level orbit at pod height, far enough out for the pod and the antenna to stand whole, the other landmarks sliding behind
      //   5 Merdeka crane-up    in low from Menara KL's side, up the face with the aim tilting up, over the spire tip and nearly straight down at the city floor
      //   6 fall down The Exchange 106 (fast)  from above Merdeka, tip over and dive alongside the glass face, looking down and forward along it
      //   7 street skim         low along the sky rail (under it) through the middle of the group, the hero train ahead (see the chase in place())
      //   8 pull-out            backwards and outward on an arc to the finale pose (rows 'sweep1', 'sweep2', 'end' are what the finale code looks for)
      // Every centre comes from LAY: MCD/EXD/KLD are the model origins, the flight circles the crown axis (crown()). Radii are widened on phones (mr), where the narrow picture crops a subject.
      var P0={u:0,w:0},XIT={u:-46,w:-4},mr=mobile?1.5:1,i,f,RAD=Math.PI/180;
      function dg(a,b){return Math.atan2(b.w-a.w,b.u-a.u)*180/Math.PI}                 // direction a -> b in the gap frame, degrees
      function pt(c,th,r){return {u:c.u+Math.cos(th*RAD)*r,w:c.w+Math.sin(th*RAD)*r}}
      function lerpUW(a,b,f){return {u:a.u+(b.u-a.u)*f,w:a.w+(b.w-a.w)*f}}
      function dist(a,b){return Math.hypot(b.u-a.u,b.w-a.w)}
      function cUW(k){var c=crown(k);return UW(c[0],c[1])}                              // a landmark's crown axis in (u,w)
      function wrap(a){return ((a%360)+360)%360}
      var C=cUW('mer'),E=cUW('ex'),K=cUW('kl');
      // a spiral round a tower: n+1 knots from angle th0 to th1 (degrees; increasing = counter-clockwise), radius r0 to r1, height y0 to y1, looking at the tower's axis (look: height above the camera, or a function y -> absolute aim height)
      function spiral(pre,c,r0,r1,y0,y1,th0,th1,n,look,slow,bank){
        for(var i=0;i<=n;i++){var f=i/n,th=(th0+(th1-th0)*f)*RAD,r=r0+(r1-r0)*f,y=y0+(y1-y0)*f;
          KF.push([pre+i,A(c.u+Math.cos(th)*r,c.w+Math.sin(th)*r,y),A(c.u,c.w,typeof look==='function'?look(y):y+look),slow,(bank||0)*Math.sin(f*Math.PI)])}}
      function row(name,p,y,a,ay,slow,roll){KF.push([name,A(p.u,p.w,y),A(a.u,a.w,ay),slow,roll||0])}
      KF=[['start',o.pos,o.tgt,.8,0]];
      // 1 drop-in: from the opening pose (street side) straight down to street level, then a rush along the free lane at w = -52 (the blocks on both sides streaming past), the towers growing ahead on the right
      var D1=[[170,-30,62,66],[140,-44,34,64],[108,-52,18,62],[74,-52,16,60],[38,-52,22,60]];
      for(i=0;i<D1.length;i++)row('dive'+(i+1),{u:D1[i][0],w:D1[i][1]},D1[i][2],P0,D1[i][3],.8);
      // 2 Petronas rise: three quarters of a turn clockwise (-90 to -330 degrees) round both towers, widening from 50 to 110 and climbing from 36 to 67 (the ring is free of blocks only inside radius 50 at street level), ending at skybridge height on the front side
      var RS=[[-90,54,38,70],[-120,59,50,72],[-150,63,64,74],[-180,72,74,76],[-210,80,80,78],[-240,90,82,80],[-270,100,82,80],[-300,106,74,78],[-330,110,62,76]];
      for(i=0;i<RS.length;i++){var rk=1+(mobile?.35:0)*clamp((-RS[i][0]-150)/150,0,1),pp=pt(P0,RS[i][0],RS[i][1]*rk);row('p'+i,pp,RS[i][2],P0,RS[i][3],2.3)}
      // the turn that lines the camera up with the gap (a right turn of radius about 45, ending head-on on the street side)
      row('q1',{u:106,w:22},60,P0,64,1.9);row('q2',{u:94,w:-12},58,P0,60,1.9);
      var Bq={u:66,w:-10};
      // 3 skybridge thread: head-on, over the bridge, through the gap (roll column: cumulative radians, 0 -> pi -> 2 pi)
      row('bridge',Bq,56,P0,50,2.0);row('over',{u:30,w:0},66,{u:-20,w:0},66,2.1,Math.PI);row('gap',P0,76,lerpUW(P0,K,.5),90,1.7,Math.PI*2);
      // 4 halo round Menara KL: the camera enters the circle on the tangent from the gap and leaves on the tangent toward Merdeka, one level orbit (about 300 degrees clockwise) at pod height
      var hr=62,hz=dist(K,XIT),hTh0=dg(K,XIT)-Math.acos(Math.min(.98,hr/hz))/RAD,
          hTh1=dg(K,C)+Math.acos(Math.min(.98,hr/dist(K,C)))/RAD,hSw=wrap(hTh0-hTh1),hAim=function(y){return 97};
      row('exit',XIT,104,lerpUW(XIT,K,.7),104,1.4);
      var hS=pt(K,hTh0,hr);row('hin1',lerpUW(XIT,hS,.38),103,K,104,1.4);row('hin2',lerpUW(XIT,hS,.7),101,K,104,1.4);
      function sm(x){x=clamp(x,0,1);return x*x*(3-2*x)}
      function mixAim(j,v,w){KF[j][2]=KF[j][2].clone().lerp(v,sm(w))}   // slide a knot's aim toward a point (so the view turns gradually into the next beat)
      spiral('h',K,hr,hr,102,98,hTh0,hTh0-hSw,16,hAim,1.5,0);
      // 5 Merdeka crane-up: swoop down to a low start on the Menara KL side, climb the face (the aim climbs faster than the camera, so the spire stays in frame) clockwise round the side away from Menara KL (radius about 95), then over the tip and look nearly straight down
      var cr0=96,cr1=90,hEnd=pt(K,hTh0-hSw,hr),
          cT0=dg(C,hEnd)-Math.acos(Math.min(.98,cr0/dist(C,hEnd)))/RAD,cT1=dg(E,C),cSw=wrap(cT0-cT1),cS=pt(C,cT0,cr0),swA=A(lerpUW(hEnd,C,.9).u,lerpUW(hEnd,C,.9).w,70);
      for(i=KF.length-5;i<KF.length;i++)mixAim(i,swA,(i-(KF.length-6))/5*1.1-.3);  // the last halo knots already turn their aim toward Merdeka
      row('sw1',lerpUW(hEnd,cS,.45),64,lerpUW(hEnd,C,.9),70,1.0);
      for(i=0;i<=10;i++){f=i/10;var cth=(cT0-cSw*f)*RAD,crr=(cr0+(cr1-cr0)*f)*(1-.2*Math.exp(-Math.pow((((cT0-cSw*f+180)%360+360)%360-180+62)/18,2))),cy=74+124*f; // dips inward where a block stands close to the circle (bearing -62 degrees from Merdeka, checked with the clearance oracle)
        KF.push(['c'+i,A(C.u+Math.cos(cth)*crr,C.w+Math.sin(cth)*crr,cy),A(C.u,C.w,70+.65*(cy-74)),2.3,0])} // near the top the aim eases down a little, so the city fills the lower part of the frame
      row('top0',pt(C,cT1,64),216,C,150,2.0);row('top1',pt(C,cT1,44),236,C,70,2.0);row('top2',pt(C,cT1,20),248,C,0,2.0);
      // tip over and fly to The Exchange, still heading the same way (the camera sits behind Merdeka's axis, looking along the line to The Exchange), the aim coming up from the floor to the horizon
      var fE=function(f){return lerpUW(C,E,f)};
      row('fl1',fE(.14),246,fE(.34),40,1.0);row('fl2',fE(.3),236,fE(.54),50,.9);row('fl3',fE(.46),222,fE(.7),62,.9);row('fl4',fE(.6),205,fE(.84),78,.9);
      // 6 fall down The Exchange: clockwise round its glass face from the Merdeka side, radius 100 closing to the rail, height 214 to the street; the aim is ahead and down, turned so the tower stands on the right third of the frame
      // 7 street skim rows first (the fall ends where the skim starts)
      var eR=A(pt(E,16,46).u,pt(E,16,46).w,0),sA=railNear(eR.x,eR.z),sB=sA,SK=[],qv=new T.Vector3(),tg=new T.Vector3();
      for(i=1;i<400;i++){var ss=(sA+i/400)%1;skyCurve.getPointAt(ss,qv);if(Math.hypot(qv.x,qv.z)<=50){sB=sA+i/400;break}}
      if(sB===sA)sB=sA+.22;
      chA=sA%1;chB=sB%1;var nS=12;
      for(i=0;i<=nS;i++){var s0=(sA+(sB-sA)*i/nS)%1,s1=(s0+85/skyLen)%1;skyCurve.getPointAt(s0,qv);skyCurve.getTangentAt(s0,tg);
        var cp=new T.Vector3(qv.x-tg.z*8,Math.max(30,qv.y-26),qv.z+tg.x*8);skyCurve.getPointAt(s1,qv);
        SK.push([cp,new T.Vector3(qv.x,qv.y-20,qv.z)])}
      var s0u=UW(SK[0][0].x,SK[0][0].z),fr=(mobile?1.3:1),fTh0=dg(E,C),fTh1=dg(E,s0u),fSw=wrap(fTh0-fTh1),fR0=100*fr,fR1=dist(E,s0u),nF=10,fk0=KF.length;
      for(i=0;i<nF;i++){f=i/nF;var th=(fTh0-fSw*f)*RAD,r=fR1+(fR0-fR1)*Math.pow(1-f,1.6),y=SK[0][0].y+(214-SK[0][0].y)*Math.pow(1-f,1.35),phi=26*RAD,Lh=60,pit=Math.atan(.9-.55*f);
        var cx=E.u+Math.cos(th)*r,cz=E.w+Math.sin(th)*r;
        KF.push([i?'e'+i:'e0',A(cx,cz,y),A(cx+Lh*(-Math.cos(phi)*Math.cos(th)+Math.sin(phi)*Math.sin(th)),cz+Lh*(-Math.cos(phi)*Math.sin(th)-Math.sin(phi)*Math.cos(th)),Math.max(0,y-Lh*Math.tan(pit))),i<nF-1?.8:1.1,1.2*Math.sin(f*Math.PI)]);
        mixAim(KF.length-1,SK[0][1],(f-.45)/.5);if(f<.3)mixAim(KF.length-1,KF[fk0-1][2],1-f/.3)}   // the first fall knots keep the aim of the flight in, the last ones turn it to where the skim looks
      var skEndAim=A(ENDC.u,ENDC.w,90);for(i=nS-4;i<=nS;i++)SK[i][1]=SK[i][1].clone().lerp(skEndAim,sm((i-(nS-5))/5));  // the last skim knots turn their aim toward the group, ready for the pull-out
      SK.forEach(function(s,j){KF.push([j?(j===nS?'skEnd':'sk'+j):'sk0',s[0],s[1],j===nS?3.4:1.2,0])});
      // 8 pull-out: from the end of the skim, outward and up on an arc round the middle of the group (ENDC) to the finale camera
      var sEu=UW(SK[nS][0].x,SK[nS][0].z),bS=dg(ENDC,sEu),dB=((dg(P0,ENDN)-bS+540)%360)-180,rS=dist(ENDC,sEu);
      function arc(f,r,y,ty){var p=pt(ENDC,bS+dB*f,r);return [A(p.u,p.w,y),A(ENDC.u,ENDC.w,ty)]}
      var pu=arc(.3,rS+(225-rS)*.4,118,90),s1=arc(.6,185,128,90),s2=arc(.85,208,108,92);
      KF.push(['pull',pu[0],pu[1],2.3,0],['sweep1',s1[0],s1[1],2.3,0],['sweep2',s2[0],s2[1],1.8,0],
      // The finale. Wide screens: a horizontal shot of the skyline, camera low and far back (on the opening's bearing) so the four landmarks
      // stand in a row across the screen. Portrait phones cannot fit a row, so there it is a full zoom-out: high and far, looking down at the whole group.
              ['end',mobile?A(ENDC.u+ENDN.u*380,ENDC.w+ENDN.w*380,250):A(ENDC.u+ENDN.u*225,ENDC.w+ENDN.w*225,92),A(ENDC.u,ENDC.w,mobile?60:92),1.5,0]);
      for(i=0;i<KF.length;i++)if(KF[i][0]==='exit'){for(f=i;f<KF.length;f++)KF[f][4]+=Math.PI*2;break} // after the barrel roll the horizon stays level (2 pi is level)
      return}
    KF=[
      ['start',o.pos,o.tgt,1.0],
      ['swing',A(135,-175,96),A(0,0,64),1.4],
      ['side',A(185,-95,88),A(0,0,62),1.4],
      ['front',A(165,-25,72),A(0,0,56),1.4],
      ['bridge',A(70,0,56),A(0,0,50),1.7],
      ['over',A(30,0,66),A(-20,0,66),1.9],
      ['gap',A(0,0,76),A(-60,-10,84),1.7],
      ['out',A(-34,-6,100),A(MC.u,MC.w,130),1.3],
      ['m0',m1[0],m1[1],1.9],
      ['m1',m2[0],m2[1],1.9],
      ['m2',m3[0],m3[1],1.9],
      ['m3',m4[0],m4[1],1.9],
      ['m4',m5[0],m5[1],1.9],
      ['turn',A(-56,-122,216),A(-68,-72,195),1.8],
      ['pass',A(-30,-125,226),A(-30,-60,150),2.6],
      ['end',A(175,-250,330),A(-55,-45,70),1.5]];
  }
  var HOLD0=.86; // the flight itself uses the first 86 % of the scroll; the last 14 % holds the finale (with a slow drift)
  var KI={},SEG=null,CX=null,CM=null;
  function pchip(X,Y){ // monotone cubic through (X,Y): smooth speed, never runs backwards
    var n=X.length,h=[],d=[],m=[],i;for(i=0;i<n-1;i++){h[i]=X[i+1]-X[i];d[i]=(Y[i+1]-Y[i])/h[i]}
    m[0]=d[0];m[n-1]=0;
    for(i=1;i<n-1;i++){if(d[i-1]*d[i]<=0)m[i]=0;else{var w1=2*h[i]+h[i-1],w2=h[i]+2*h[i-1];m[i]=(w1+w2)/(w1/d[i-1]+w2/d[i])}}
    return function(x){if(x<=X[0])return Y[0];if(x>=X[n-1])return Y[n-1];var k=0;while(x>X[k+1])k++;
      var t=(x-X[k])/h[k],t2=t*t,t3=t2*t;return(2*t3-3*t2+1)*Y[k]+(t3-2*t2+t)*h[k]*m[k]+(-2*t3+3*t2)*Y[k+1]+(t3-t2)*h[k]*m[k+1]}}
  function buildRide(){
    buildKF();var n=KF.length,i;
    rideP=new T.CatmullRomCurve3(KF.map(function(k){return k[1]}),false,'catmullrom',.5);
    rideT=new T.CatmullRomCurve3(KF.map(function(k){return k[2]}),false,'catmullrom',.5); // same knot spacing as the camera path, so the two stay in step
    // Scroll share of each stretch = its length x its slow factor, so the speed is even and slow where we want to look.
    var share=[],tot=0,a,b,k;
    for(i=0;i<n-1;i++){var len=0,prev=rideP.getPoint(i/(n-1));for(k=1;k<=20;k++){var q=rideP.getPoint((i+k/20)/(n-1));len+=q.distanceTo(prev);prev=q}
      share[i]=len*KF[i][3];tot+=share[i]}
    if(DIST){ // a turn budget: a stretch where the view swings round gets at least enough scroll that the view turns no faster than ROT degrees per unit of scroll (6.5 degrees per 1/400 of it), whatever the slow factors say
      var ROT=2600,an=[],va=new T.Vector3(),vb=new T.Vector3(),it;
      for(i=0;i<n-1;i++){va.copy(KF[i][2]).sub(KF[i][1]).normalize();vb.copy(KF[i+1][2]).sub(KF[i+1][1]).normalize();an[i]=Math.acos(clamp(va.dot(vb),-1,1))*180/Math.PI}
      for(it=0;it<8;it++){tot=0;for(i=0;i<n-1;i++)tot+=share[i];for(i=0;i<n-1;i++){var need=an[i]/ROT/HOLD0*tot;if(share[i]<need)share[i]=need}}
      tot=0;for(i=0;i<n-1;i++)tot+=share[i]}
    CX=[0];CM=[0];var acc=0;for(i=0;i<n-1;i++){acc+=share[i]/tot;CX.push(acc*HOLD0);CM.push((i+1)/(n-1))} // the last 3% of the scroll holds the final shot
    rideU=pchip(CX,CM);
    rollK=KF.map(function(k){return k[4]||0});
    flightTabs();
    KI={};KF.forEach(function(k,j){KI[k[0]]=CX[j]});
    for(i=0;i<caps.length&&i<CAPS.length;i++){caps[i].dataset.from=Math.max(.012,KI[CAPS[i][0]]);caps[i].dataset.to=i===CAPS.length-1?1.01:KI[CAPS[i][1]]}
    hudBuild()}
  var rideU=function(c){return c},rollK=[];
  // BANK AND SPEED TABLES, made once per build (no per-frame work beyond a lookup): over the flight's scroll range, the path's signed horizontal curvature gives the bank angle,
  // and the path speed (distance per unit of scroll) gives the extra lens width. Both are smoothed so neither can jitter.
  var NT=480,bankTab=new Float32Array(NT+1),fovTab=new Float32Array(NT+1),chA=0,chB=0;
  function tabAt(t,c){var x=clamp(c/HOLD0,0,1)*NT,i=Math.min(NT-1,Math.floor(x)),f=x-i;return t[i]+(t[i+1]-t[i])*f}
  function flightTabs(){
    var i,j,P=[],V=new T.Vector3(),a=new T.Vector3(),b=new T.Vector3();
    for(i=0;i<=NT;i++)P.push(rideP.getPoint(rideU(HOLD0*i/NT)));
    var kap=[],spd=[];
    for(i=0;i<=NT;i++){var i0=Math.max(0,i-2),i1=Math.min(NT,i+2);
      a.copy(P[Math.max(0,i-1)]).sub(P[i0]);b.copy(P[i1]).sub(P[Math.min(NT,i+1)]);
      var la=Math.hypot(a.x,a.z),lb=Math.hypot(b.x,b.z),ds=V.copy(P[i1]).sub(P[i0]).length()/2+1e-6;
      var cr2=(la>1e-4&&lb>1e-4)?(a.z*b.x-a.x*b.z)/(la*lb):0; // sin of the heading change; > 0 is a turn to the left
      kap.push(Math.asin(clamp(cr2,-1,1))/ds);spd.push(V.copy(P[i1]).sub(P[i0]).length()/((i1-i0)*HOLD0/NT))}
    function smooth(arr,w){var o=[];for(var i=0;i<arr.length;i++){var s=0,n=0;for(var j=-w;j<=w;j++){var k=i+j;if(k>=0&&k<arr.length){var wt=w+1-Math.abs(j);s+=arr[k]*wt;n+=wt}}o.push(s/n)}return o}
    var kS=smooth(kap,10),sS=smooth(spd,8),sorted=sS.slice().sort(function(x,y){return x-y}),lo=sorted[Math.floor(NT*.15)],hi=sorted[Math.floor(NT*.92)];
    for(i=0;i<=NT;i++){bankTab[i]=clamp(kS[i]*9,-.13,.13); // 0.0125 per unit (a circle of radius 80) leans about 14 degrees; at most 18
      var sp=clamp((sS[i]-lo)/Math.max(1e-6,hi-lo),0,1);fovTab[i]=9*sp*sp*(3-2*sp)}
    bankTab[0]=0;bankTab[NT]=0;fovTab[NT]=0;for(i=0;i<=4;i++)fovTab[i]=fovTab[i]*i/4}
  function rollAt(u){if(reduce)return 0; /* the barrel roll through the skybridge gap (back on, owner's call); none with reduced motion */var n=rollK.length;if(n<2)return 0;var f=clamp(u,0,1)*(n-1),i=Math.min(n-2,Math.floor(f)),t=f-i;t=t*t*(3-2*t);return rollK[i]+(rollK[i+1]-rollK[i])*t}
  // ---- HUD (DOM) ----
  var hud=document.getElementById('hud'),hTags=[],hAlt=document.getElementById('h-alt'),hSec=document.getElementById('h-sec'),hFill=document.getElementById('h-fill'),hTicks=[],hLast=-1,hSecLast=-1;
  if(hud){var tg=hud.querySelector('.hud-tags');LM.forEach(function(l){var e=document.createElement('div');e.className='lm-tag';
    e.innerHTML='<i class="lm-dot"></i><b></b><span></span>';e.querySelector('b').textContent=l.name;tg.appendChild(e);hTags.push(e)})}
  function hudBuild(){
    if(!hud)return;var rail=hud.querySelector('.hud-ticks');if(!rail)return;rail.textContent='';hTicks=[];
    for(var i=0;i<CAPS.length;i++){var e=document.createElement('li');e.style.top=(KI[CAPS[i][0]]/HOLD0*100)+'%';e.innerHTML='<i></i><b>'+('0'+(i+1)).slice(-2)+'</b>';rail.appendChild(e);hTicks.push(e)}}
  // ---- COCKPIT: what a drone pilot sees ----
  // Built into #hud (so the home page and /flight/ both get it): compass tape, artificial horizon, speed and vertical speed, REC timer and battery,
  // a crosshair and the drone's status. Everything moves with transform or text only.
  var cp={},cpPrev=null,cpPrevT=0,spdS=0,vsS=0,PPD=3,cpFwd=new T.Vector3(),cpRight=new T.Vector3(),cpUp=new T.Vector3();
  function cockpitBuild(){
    if(!hud||hud.querySelector('.cp'))return;
    var w=document.createElement('div');w.className='cp';w.setAttribute('aria-hidden','true');
    var tape='';for(var d=-360;d<=720;d+=15){var m=((d%360)+360)%360,lab=m===0?'N':m===90?'E':m===180?'S':m===270?'W':('0'+Math.round(m/10)).slice(-2);tape+='<i class="'+(m%90===0?'card':'')+'" style="left:'+(d*PPD)+'px"><b>'+lab+'</b></i>'}
    var adi='<svg viewBox="0 0 120 120" class="cp-adi-svg"><defs><clipPath id="cp-clip"><circle cx="60" cy="60" r="54"/></clipPath></defs>'+
      '<g clip-path="url(#cp-clip)"><g id="cp-hz"><rect x="-120" y="-200" width="360" height="260" class="cp-sky"/><rect x="-120" y="60" width="360" height="260" class="cp-gnd"/><path d="M-120 60H240" class="cp-hl"/>'+
      '<g class="cp-pl">'+[-30,-20,-10,10,20,30].map(function(p){var y=60-p*2.2,wd=Math.abs(p)%20===0?28:16;return '<path d="M'+(60-wd/2)+' '+y+'H'+(60+wd/2)+'"/>'}).join('')+'</g></g></g>'+
      '<circle cx="60" cy="60" r="54" class="cp-ring"/><path d="M60 6V14M60 106V114M6 60H14M106 60H114" class="cp-tick"/><path d="M36 60H52L60 68L68 60H84" class="cp-ac"/><circle cx="60" cy="60" r="2" class="cp-dot"/></svg>';
    w.innerHTML='<div class="cp-compass"><div class="cp-tape"><div class="cp-track">'+tape+'</div></div><span class="cp-caret"></span><b class="cp-hdg" id="cp-hdg">HDG 000</b></div>'+
      '<div class="cp-spd"><span>SPD</span><b id="cp-spd">0</b><small>km/h</small><span class="cp-sp2">V/S</span><b id="cp-vs">0</b><small>m/s</small></div>'+
      '<div class="cp-adi">'+adi+'</div>'+
      '<div class="cp-cross"><i></i><i></i><i></i><i></i></div>'+
      '<div class="cp-id"><b>DRONE-01</b><span>FPV &middot; STAB ON</span><span id="cp-gps">GPS &#9679; 14 SAT</span></div>'+
      '<div class="cp-rec"><span class="cp-dot2"></span><b id="cp-rec">REC 00:00</b><span class="cp-batt"><i id="cp-batt"></i></span><small id="cp-bat">100%</small></div>';
    hud.appendChild(w);cp.track=w.querySelector('.cp-track');cp.hdg=w.querySelector('#cp-hdg');cp.spd=w.querySelector('#cp-spd');cp.vs=w.querySelector('#cp-vs');cp.hz=w.querySelector('#cp-hz');
    cp.rec=w.querySelector('#cp-rec');cp.batt=w.querySelector('#cp-batt');cp.bat=w.querySelector('#cp-bat');cp.gps=w.querySelector('#cp-gps');cp.ready=true}
  var cpTick=0;
  function cockpitUpdate(c,time){
    if(!cp.ready)return;
    cpFwd.set(0,0,-1).applyQuaternion(cam.quaternion);cpRight.set(1,0,0).applyQuaternion(cam.quaternion);cpUp.set(0,1,0).applyQuaternion(cam.quaternion);
    var hdg=(Math.atan2(cpFwd.x,-cpFwd.z)*180/Math.PI+360)%360,pitch=Math.asin(clamp(cpFwd.y,-1,1))*180/Math.PI,roll=Math.atan2(cpRight.y,cpUp.y)*180/Math.PI;
    cp.track.style.transform='translate3d('+(-(hdg*PPD)+0).toFixed(1)+'px,0,0)';
    cp.hz.setAttribute('transform','rotate('+roll.toFixed(1)+' 60 60) translate(0 '+(pitch*2.2).toFixed(1)+')');
    var dt=Math.max(.001,(time-cpPrevT)/1000);
    if(cpPrev&&dt<.5){var dx=cam.position.distanceTo(cpPrev)*KU/dt,dy=(cam.position.y-cpPrev.y)*KU/dt;spdS+=(clamp(dx*3.6,0,260)-spdS)*.15;vsS+=(clamp(dy,-90,90)-vsS)*.15}
    if(!cpPrev)cpPrev=new T.Vector3();cpPrev.copy(cam.position);cpPrevT=time;
    if(cpTick++%3===0){
      cp.hdg.textContent='HDG '+('00'+Math.round(hdg)).slice(-3)+'°';cp.spd.textContent=Math.round(spdS);cp.vs.textContent=(vsS>=0?'+':'')+Math.round(vsS);
      var f=clamp(c/HOLD0,0,1),sec=Math.round(f*150),bat=Math.round(100-42*f);
      cp.rec.textContent='REC '+('0'+Math.floor(sec/60)).slice(-2)+':'+('0'+sec%60).slice(-2);cp.bat.textContent=bat+'%';cp.batt.style.transform='scaleX('+(bat/100).toFixed(2)+')'}}
  var tv=new T.Vector3();
  function hudUpdate(inRide,u,c){
    if(!hud)return;var on=inRide&&(ONLY||flying); /* only once the flight section fills the screen, not while the last Journey cards are still showing */ hud.classList.toggle('on',on);if(!on){cpPrev=null;return}
    if(!cp.ready)cockpitBuild();cockpitUpdate(c,performance.now());
    hFill.style.transform='scaleY('+clamp(c/HOLD0,0,1).toFixed(4)+')';
    var alt=Math.round(cam.position.y*KU/5)*5;if(alt!==hLast){hLast=alt;hAlt.textContent=alt}
    var sec=0;for(var i=0;i<caps.length;i++)if(c>=+caps[i].dataset.from)sec=i;
    if(sec!==hSecLast){hSecLast=sec;var b=caps[sec]&&caps[sec].querySelector('b');hSec.textContent=b?b.textContent:'';for(i=0;i<hTicks.length;i++)hTicks[i].classList.toggle('on',i<=sec)}
    for(var k=0;k<LM.length;k++){
      tv.copy(LM[k].top);var dist=tv.distanceTo(cam.position);tv.project(cam);
      var vis=tv.z<1&&Math.abs(tv.x)<.94&&Math.abs(tv.y)<.9&&dist>24&&dist<760,e=hTags[k];
      if(vis!==e.classList.contains('show'))e.classList.toggle('show',vis);
      if(vis){e.style.transform='translate3d('+((tv.x*.5+.5)*W).toFixed(1)+'px,'+((-tv.y*.5+.5)*Hh).toFixed(1)+'px,0)';
        if(tick%8===0)e.lastChild.textContent=Math.round(LM[k].real)+' m · '+Math.round(dist*KU/10)*10+' m away'}}}
  var tick=0;
  // the lead-in sections show their label while they are on screen
  if('IntersectionObserver' in window){var stObs=new IntersectionObserver(function(es){es.forEach(function(e){e.target.classList.toggle('on',e.isIntersecting&&e.intersectionRatio>.55)})},{threshold:[0,.55,1]});document.querySelectorAll('.stage').forEach(function(el){stObs.observe(el)})}
  function ringUpdate(){} // the screens that floated behind the towers (ring, then conveyor) were removed; see docs/claude-log.md
  var flying=false;
  // Golden hour: for the finale skyline the light turns to a hazy sunrise (reference photo: warm orange sky, golden haze over the towers). Light theme only.
  var goldLast=-1,goldF=new T.Color(),goldC=new T.Color(),G1=new T.Color('#ffe2a8'),G2=new T.Color('#f3a95a'),G3=new T.Color('#f0b676');
  function goldHour(k){
    var dark=root.getAttribute('data-theme')==='dark';if(dark)k=0;k=Math.round(k*50)/50;if(k===goldLast)return;goldLast=k;
    if(k===0){mats.forEach(function(m){var r=m.userData.role;if(r)m.color.set(C[r])});root.style.removeProperty('--sky1');root.style.removeProperty('--sky2');if(scene.fog)scene.fog.color.copy(fogColor());TU.uSky1.value.set(C.sky1);TU.uSky2.value.set(C.skyM);TU.uShadeMul.value.copy(shadeBase);TU.uHazeK.value=hazeBase;sun.color.set(dark?0xb0b4ff:0xffffff);return}
    mats.forEach(function(m){var r=m.userData.role;if(r==='far'||r==='mid'||r==='near'||r==='ground')m.color.set(C[r]).lerp(G3,k*.38)}); /* the ground and towers take the warm haze */
    goldC.set(C.sky1).lerp(G1,k);root.style.setProperty('--sky1','#'+goldC.getHexString());TU.uSky1.value.copy(goldC);TU.uShadeMul.value.copy(shadeBase).lerp(GSH,k);TU.uHazeK.value=hazeBase*(1-.5*k); /* golden hour: dusky violet shadows, pale cream lit faces, less haze so the skyline stays crisp */
    goldC.set(C.sky2).lerp(G2,k);root.style.setProperty('--sky2','#'+goldC.getHexString());TU.uSky2.value.copy(goldC);
    if(scene.fog)scene.fog.color.copy(goldC);sun.color.set(0xffffff).lerp(new T.Color('#ffd08a'),k)}
  // ONE CAMERA. Above, the director (before the flight) and the flight (inside #enter) each only say where the camera should be.
  // This follower is the only thing that actually moves it: position, rotation, lens and the sideways push all chase their target
  // with the same short lag and a top speed, so a change between the two systems (or anything else) can never show as a snap.
  var fInit=true,fP=new T.Vector3(),fQ=new T.Quaternion(),fF=42,fX=0,fY=0,fD=new T.Vector3();
  function followCam(dt){
    var vo=cam.view,ox=vo&&vo.enabled?vo.offsetX:0,oy=vo&&vo.enabled?vo.offsetY:0;
    if(fInit||reduce){fP.copy(cam.position);fQ.copy(cam.quaternion);fF=cam.fov;fX=ox;fY=oy;fInit=false;return}
    var k=1-Math.exp(-dt*7),L=fD.copy(cam.position).sub(fP).length();
    if(L>1e-6)fP.addScaledVector(fD,Math.min(L*k,700*dt)/L);
    fQ.slerp(cam.quaternion,k);fF+=(cam.fov-fF)*k;fX+=(ox-fX)*k;fY+=(oy-fY)*k;
    cam.position.copy(fP);cam.quaternion.copy(fQ);
    if(Math.abs(fF-cam.fov)>.005){cam.fov=fF;cam.updateProjectionMatrix()}
    cam.setViewOffset(W,Hh,fX,fY,W,Hh)}
  function place(time){
    if(enter){var pin=scrollY>=enter.offsetTop-40&&scrollY<=enter.offsetTop+enter.offsetHeight-innerHeight+40;if(pin!==flying){flying=pin;root.classList.toggle('flying',pin)}} // hides the dock while the captions are on screen
    var inRide=cr>.0004&&!!rideP;
    if(inRide){
      var u=rideU(cr);
      rideP.getPoint(u,cam.position);
      if(cr>HOLD0){ // the hold: the scene drifts slowly sideways as you scroll, so the whole map is shown while the page moves on
        var hf=clamp((cr-HOLD0)/(1-HOLD0),0,1),tg0=rideT.getPoint(u,chL);tv.copy(tg0).sub(cam.position).normalize();tv.cross(cam.up);cam.position.addScaledVector(tv,(hf-.5*Math.min(1,hf*6))*(mobile?70:150));cam.position.y+=hf*(mobile?-40:14)}
      // THE CHASE: along the street skim (knots 'sk0' to 'skEnd') the "hero" train on the sky line is driven by the scroll (from chA to chB on the rail)
      // and the camera blends onto a chase position behind and below it, so the train runs ahead of the camera along the rail overhead.
      var cwA=KI['sk0'],cwE=KI['skEnd'],cwB=KI['pull'],cw=0;heroOn=false;rideT.getPoint(u,tgtV);
      if(cwA!=null&&cwB!=null&&cr>cwA&&cr<cwB){
        var cf=clamp((cr-cwA)/(cwE-cwA),0,1),csm=function(x){x=clamp(x,0,1);return x*x*(3-2*x)},cwO=cwE-.15*(cwE-cwA);cw=csm((cr-cwA)/(.25*(cwE-cwA)))*csm((cwB-cr)/(cwB-cwO)); // in over the first quarter of the skim, out between just before its end and the start of the pull-out
        var cd=chB-chA;if(cd<0)cd+=1;heroS=((chA+cd*(.5*cf+.5*csm(cf)))%1+1)%1;heroOn=cw>.02;
        if(heroOn){skyCurve.getPointAt(heroS,chH);skyCurve.getTangentAt(heroS,chT);chS.crossVectors(chT,cam.up).normalize();
          skyCurve.getPointAt(((heroS-40/skyLen)%1+1)%1,chP);chP.y-=24;chP.addScaledVector(chS,6*Math.sin((time||0)*.0009)); // 40 units behind the train along the rail (not along its tangent, so a bend in the rail turns the view gradually), 24 below it
          skyCurve.getPointAt((heroS+90/skyLen)%1,chL);chL.y-=8;                                                              // looking 90 units ahead along the rail
          cam.position.lerp(chP,cw);tgtV.lerp(chL,cw)}}
      cam.lookAt(tgtV);cam.setViewOffset(W,Hh,0,0,W,Hh);
      // finale: widen the view (phones a lot, desktop a little) and push the fog back, so the whole skyline is in frame
      var ke=KI['sweep1']!=null?KI['sweep1']:(KI['pass']!=null?KI['pass']:.7),ke2=KI['end']||HOLD0,fs=clamp((cr-ke-.4*(ke2-ke))/(.6*(ke2-ke)),0,1);fs=fs*fs*(3-2*fs);
      var kk=Math.sin(Math.PI*clamp(cr/.07,0,1)),fv=42+(mobile?30:10)*fs+26*kk*kk+(reduce?0:tabAt(fovTab,cr)*(1-fs)*(1-kk*kk)); /* speed feel: up to +9 degrees of lens in the fast beats, none at the start, in the finale or in reduced motion */ /* kk: a gentle push-in that starts and ends at the normal lens, so entering the flight never snaps */if(Math.abs(fv-cam.fov)>.01){cam.fov=fv;cam.updateProjectionMatrix()}
      if(scene.fog){scene.fog.near=fogN0+260*fs;scene.fog.far=fogF0+560*fs}
      goldHour(fs);
      // Ease the rotation: the view turns towards where it should look with a short lag (time constant about 0.2 s), so a sharp
      // turn in the route can never show as a jolt. Reset when the flight starts, and when snapping.
      if(!rideQ)rideQ=cam.quaternion.clone();else{rideQ.slerp(cam.quaternion,reduce?1:1-Math.exp(-dtF*5));cam.quaternion.copy(rideQ)}
      // lean into turns like a drone: the bank follows the path's horizontal curvature (table made in buildRide, at most 18 degrees), eased; none in reduced motion
      roll+=((reduce?0:tabAt(bankTab,cr))-roll)*(1-Math.exp(-dtF*3));cam.rotateZ(roll*(1-fs)+rollAt(u)); // drone bank into turns, the scripted barrel roll, and a level horizon for the finale
      hudUpdate(true,u,cr)
    }else{
      rideQ=null;heroOn=false;goldHour(0);if(cam.fov!==42){cam.fov=42;cam.updateProjectionMatrix()}if(scene.fog){scene.fog.near=fogN0;scene.fog.far=fogF0}
      var q=curPose,ang=(q[2]+px*7)*Math.PI/180;
      cam.position.set(q[0]+Math.cos(ang)*q[3],q[4],q[1]+Math.sin(ang)*q[3]);cam.lookAt(q[0],q[5],q[1]);
      cam.setViewOffset(W,Hh,-q[6]*W,-q[7]*Hh,W,Hh);hudUpdate(false)
    }
    followCam(dtF);
    for(var ci=0;ci<caps.length;ci++){var c=caps[ci],on=cr>=+c.dataset.from&&cr<+c.dataset.to;if(on!==c.classList.contains('on'))c.classList.toggle('on',on)}
    if(again){if(DBGCR)again.dataset.cr=cr.toFixed(3);var aOn=inRide&&cr>.93;if(aOn!==again.classList.contains('on'))again.classList.toggle('on',aOn)}
    if(spin&&sH){var sy=scrollY-(sTop-innerHeight),sf=sy/Math.max(1,sH),sOn=sf>.18&&sf<.95;if(sOn!==spin.classList.contains('on'))spin.classList.toggle('on',sOn)} // the coordinates tag
    ringUpdate(time,inRide);
    orb.rotation.y=time*.0004;ring.rotation.z=time*.0006;orb.position.y=230+Math.sin(time*.0009)*3;
    specks.rotation.y=time*.00003;fxUpdate(time,reduce);sciUpdate(time,reduce,inRide)}
  var raf=0,run=true,last=0,lastR=0;
  function snap(){fInit=true;rideQ=null;curPose=tgtPose.slice();cr=tr;px=tx;vr.v=vx.v=0;vPose.forEach(function(v){v.v=0})}
  var shown=false; // the canvas fades in once it has drawn (scene.css, html.gl-on)
  function frame(time){
    var dt=clamp((time-last)/1000,.001,.05);last=time;dtF=dt;tick++;
    if(reduce)snap();else{for(var j=0;j<8;j++)curPose[j]=damp(curPose[j],tgtPose[j],vPose[j],.55,dt);var cr0=cr;cr=clamp(damp(cr,tr,vr,.75,dt),0,1);if(flying){var cap=.085*dt;if(cr-cr0>cap){cr=cr0+cap;vr.v=Math.min(vr.v,cap/dt)}else if(cr0-cr>cap){cr=cr0-cap;vr.v=Math.max(vr.v,-cap/dt)}} /* speed limit: a fast flick can't whip the camera */px=damp(px,tx,vx,.6,dt)}
    // Idle drift: in the drone flight, when the reader has stopped scrolling, the page creeps forward by itself so slow scrolling never shows as a stutter.
    if(flying&&enter&&!reduce&&!document.hidden&&time-lastUser>900&&scrollY<enter.offsetTop+enter.offsetHeight-innerHeight-6){
      driftAcc+=(mobile?20:28)*clamp((time-lastUser-900)/1500,0,1)*dt;
      if(driftAcc>=1){var dy=Math.floor(driftAcc);driftAcc-=dy;scrollBy({top:dy,behavior:'instant'})}}
    var moving=Math.abs(tr-cr)>(flying?.00002:.0003);for(var j2=0;j2<8;j2++)if(Math.abs(tgtPose[j2]-curPose[j2])>.02){moving=true;break}
    // While the reader is only reading, redraw at about 15 fps (the beams and pulses still drift); while scrolling, every frame.
    if(moving||need||(!reduce&&time-lastR>66)){place(reduce?0:time);renderer.render(scene,cam);need=false;lastR=time;if(!shown){shown=true;root.classList.add('gl-on')}}
    raf=run?requestAnimationFrame(frame):0}
  var lastUser=0,driftAcc=0;
  ['wheel','touchstart','touchmove','keydown','pointerdown'].forEach(function(n){addEventListener(n,function(){lastUser=performance.now();driftAcc=0},{passive:true})});
  function retarget(){if(document.documentElement.scrollHeight!==lastLay)layoutKeys();tgtPose=dirPose(scrollY);tr=rideProg();need=true}
  addEventListener('scroll',retarget,{passive:true});
  // the UTP coverflow says which group is in front; the shot follows it
  document.addEventListener('cf-change',function(e){if(e.target&&e.target.closest&&e.target.closest('#studied')){utpIdx=Math.max(0,Math.min(UTP.length-1,e.detail.index|0));retarget()}});
  addEventListener('load',function(){layoutKeys();retarget()});
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){layoutKeys();retarget()});
  addEventListener('resize',function(){size();buildRide();layoutKeys();retarget()});
  addEventListener('pointermove',function(e){tx=e.clientX/innerWidth-.5});
  document.addEventListener('visibilitychange',function(){run=!document.hidden;if(run&&!raf){last=performance.now();raf=requestAnimationFrame(frame)}});
  setTimeout(function(){(window.requestIdleCallback||setTimeout)(warmEdges)},12000); // light theme: build the night lines in idle time, so the first switch to dark has them ready
  root.classList.add('gl'); // first: it makes #enter visible, and the scroll maths below needs its real position
  size();buildRide();layoutKeys();tgtPose=dirPose(scrollY);curPose=tgtPose.slice();tr=cr=rideProg();raf=requestAnimationFrame(frame);
  if(ONLY||/[?&]dbg/.test(location.search))window.__scene={keys:function(){return KEYS.map(function(k){return k.y})},dirPose:dirPose,scene:scene,cam:cam,g:g,rideP:rideP,rideT:rideT,rideU:function(c){return rideU(c)},snap:snap,place:place,KF:KF,KI:function(){return KI},render:function(){renderer.render(scene,cam)},set:function(c){tr=c;cr=c;vr.v=0},pause:function(){run=false;cancelAnimationFrame(raf);raf=0},lay:LAY,lm:LM,utp:UTP,sky:skyCurve,city:function(){return cityMesh},mob:mob,DIST:DIST,draw:function(c,t){tr=c;cr=c;vr.v=0;tick=0;fInit=true;rideQ=null;dtF=9;place(t||0);renderer.render(scene,cam);tick=0;place(t||0);renderer.render(scene,cam);dtF=.016}};
  } // start
  // Build the scene after the page's first paint, not before it: the curtain's text and photos come first, the canvas fades in after. (/flight/ is only the scene, so it starts at once.)
  if(!DEFER)start();
  else{
    var go=function(){setTimeout(function(){(window.requestIdleCallback||function(f){f()})(start,{timeout:600})},0)};
    if(document.readyState==='complete')go();else addEventListener('load',go,{once:true});
  }
})();
