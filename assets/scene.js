/* KLCC in WebGL. The camera orbits the towers as the page scrolls. three.js comes from cdnjs. */
(function(){
  // ===== SceneTime: the time of day, shared by every page =====
  // SceneTime.set(t): t is 0 (plain day) to 2 (night), 1 is golden hour; continuous. SceneTime.mode('day'|'golden'|'night') tweens there in about 1.2 s. SceneTime.get() reads it.
  // Each change dispatches `scenetime` on document with detail.t. This part needs no WebGL: it also drives the page colours of pages that have no scene.
  var ST=window.SceneTime;
  if(!ST){(function(){
    var t=0,tw=0,subs=[],rm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function set(v){v=+v;if(v!==v)return t;v=v<0?0:v>2?2:v;if(Math.abs(v-t)<1e-4)return t;t=v;
      for(var i=0;i<subs.length;i++)try{subs[i](t)}catch(e){}
      try{document.dispatchEvent(new CustomEvent('scenetime',{detail:{t:t}}))}catch(e){}return t}
    function mode(n,ms){var to=n==='day'?0:n==='golden'?1:n==='night'?2:+n;if(to!==to)return;to=Math.max(0,Math.min(2,to));
      if(tw){cancelAnimationFrame(tw);tw=0}
      ms=ms==null?1200:ms;var from=t,d=Math.abs(to-from);if(!d)return;ms*=Math.min(1,d/1+.3);
      if(rm||ms<=0){set(to);return}
      var t0=0;(function step(now){if(!t0)t0=now;var k=Math.min(1,(now-t0)/ms);k=k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;set(from+(to-from)*k);tw=k<1?requestAnimationFrame(step):0})(performance.now())}
    ST=window.SceneTime={get:function(){return t},set:function(v){if(tw){cancelAnimationFrame(tw);tw=0}return set(v)},mode:mode,_on:function(f){subs.push(f)},nearest:function(){return t<.5?'day':t<1.5?'golden':'night'}};
  })()}
  var CS=document.currentScript; // read now: it is null once the start is deferred
  if(!window.THREE){document.documentElement.classList.remove('gl');return}
  var DEFER=!document.documentElement.hasAttribute('data-flight-only');
  // The page layout for the scene (panels, plate round the name) must not change after the first paint, so `gl` goes on now; start() removes it again if WebGL turns out to be unavailable.
  if(DEFER)document.documentElement.classList.add('gl');
  function start(){
  var T=THREE,root=document.documentElement,cv=document.getElementById('gl');
  // Where this script lives (assets/), so the models load from any page, whatever its folder.
  var BASE=(((CS||document.querySelector('script[src*="scene.js"]')||{}).src)||'').replace(/scene\.js.*$/,'');
  // data-flight-only on <html> (the /flight/ page): no orbit phase and no page around it, just the flight, driven by scroll.
  var ONLY=root.hasAttribute('data-flight-only'),HOMEDS=!!document.getElementById('descent'); // HOMEDS: the front page, where the flight follows the descent
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
  function bands(){var w=8,h=64,d=new Uint8Array(w*h*4),y,x,p;
    for(y=0;y<h;y++){var v=(y>=8&&y<14)?255:0;for(x=0;x<w;x++){p=(y*w+x)*4;d[p]=d[p+1]=d[p+2]=v;d[p+3]=255}}
    var t=new T.DataTexture(d,w,h,T.RGBAFormat);t.wrapS=t.wrapT=T.RepeatWrapping;t.minFilter=t.magFilter=T.LinearFilter;t.generateMipmaps=false;t.needsUpdate=true;return t}
  var tex=bands();
  var tower=mat('near',{emissiveMap:tex,emissive:0xffffff}),towerB=mat('near'),podium=mat('mid'),city=mat('mid'),cityF=mat('far'),ground=mat('ground'),glassM=mat('ring',{emissive:0xffffff,emissiveIntensity:.5});
  var orbM=mat('orb'),ringM=new T.MeshBasicMaterial({color:C.ring});
  var amb=new T.AmbientLight(0xffffff,.75),sun=new T.DirectionalLight(0xffffff,.8);sun.position.set(80,140,60);scene.add(amb,sun);
  // Three flat tones per face (lit / mid / shade, picked by the face normal against one fixed light) and height-aware haze, both in the existing materials' shaders.
  // The tones are derived from each material's role colour, so the themes and the golden hour keep working. The haze fades towards the CSS sky gradient itself (uSky1/uSky2 at this pixel's screen height), so geometry melts into the sky with no seam.
  var TU={uLight:{value:new T.Vector3(-.42,.74,.52).normalize()},uSunC:{value:sun.color},uLitMul:{value:new T.Vector3(1,1,1)},uLitMix:{value:.7},uShadeMul:{value:new T.Vector3(.4,.6,.95)},uMidMul:{value:new T.Vector3(1,1,1)},
    uSky1:{value:new T.Color()},uSky2:{value:new T.Color()},uSky3:{value:new T.Color()},uStop:{value:1},uRes:{value:new T.Vector2(1,1)},uHazeK:{value:.7},uSunAmt:{value:.5},uEdge:{value:new T.Vector2(620,1250)},uLitC:{value:new T.Color(.97,.99,1)},uWrap:{value:0},uGold:{value:0},uGlint:{value:0}};
  var GLSL=window.SCENE_GLSL; // the shader text lives in assets/scene-glsl.js (loaded just before this file), so it can be read and edited as GLSL
  function toon(sh){
    for(var k in TU)sh.uniforms[k]=TU[k];
    sh.vertexShader=sh.vertexShader.replace('void main() {','varying vec3 vWP;\nvoid main() {').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\n vWP=(modelMatrix*vec4(transformed,1.0)).xyz;');
    sh.fragmentShader=sh.fragmentShader.replace('void main() {','varying vec3 vWP;uniform vec3 uLight,uSunC,uLitMul,uShadeMul,uMidMul,uSky1,uSky2,uSky3,uLitC;uniform float uStop,uWrap,uGold,uGlint;uniform float uLitMix,uHazeK,uSunAmt;uniform vec2 uRes,uEdge;\nvoid main() {')
      .replace('#include <aomap_fragment>',GLSL.toonShade)
      .replace('#include <fog_fragment>',GLSL.toonHaze);
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
  // Front page: the city is not on screen until the end of the descent, so the heavy loads (the district 1.6 MB, the landmark models) wait for the first drawn frame and then
  // go one per idle slot, instead of ~3.5 MB of JSON being parsed and meshed in the first seconds. Other pages show the skyline from the first view, so they load at once.
  var LATER=[],laterOn=false;
  function later(f){if(!HOMEDS||laterOn)f();else LATER.push(f)}
  function startLater(){if(laterOn)return;var ric=window.requestIdleCallback||function(f){return setTimeout(f,60)};
    function step(){var f=LATER.shift();if(!f){laterOn=true;return}f();ric(step,{timeout:1500})}
    ric(step,{timeout:1500})}
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
  loadModel(BASE+'city/exchange106.json',LAY.ex[0],LAY.ex[1],LAY.ex[2],bodyM,null,exEdges);   // The Exchange 106, cropped and simplified (tools/convert-dae-crop.py)  // Merdeka Maybank Tower (formerly Merdeka PNB 118; SketchUp Collada, see tools/convert-dae.py)
  }
  // In the district, the two landmarks baked into its mesh were welded coarsely and have holes: draw the full-detail models over them (1 % larger, so they sit just outside).
  var nightLines=[],lineMats=[],curLines=0; // curLines: how much of the night creases show (0 to 1, from SceneTime)
  // The long creases are only drawn at night, and finding them (EdgesGeometry over every landmark mesh) took about 1.1 s of main thread at load. So the work is queued
  // per mesh and run one mesh per task, and only once it is needed: at once when the page is (or turns) dark, otherwise as idle warm-up long after load (see sciStyle and warmEdges).
  var edgeJobs=[],edgeTimer=0,edgesWanted=false;
  function pumpEdges(){
    if(edgeTimer||!edgeJobs.length)return;
    edgeTimer=setTimeout(function(){edgeTimer=0;var j=edgeJobs.shift();j[0](j[1],j[2]);need=true;pumpEdges()},0)}
  function edgesFor(color,minLen,op){ // night-only lines along a landmark's long creases (Merdeka ice white, Petronas warm white, The Exchange pale cyan)
    var lm=new T.LineBasicMaterial({color:color,transparent:true,opacity:op,blending:T.AdditiveBlending,depthWrite:false});lineMats.push({m:lm,op:op});lm.opacity=op*curLines;
    function build(m,out){var eg=new T.EdgesGeometry(m.geometry,42),pa=eg.attributes.position.array,keep=[],SCm=out.scale.x||1;
      for(var e=0;e<pa.length;e+=6){var ex=pa[e+3]-pa[e],ey=pa[e+4]-pa[e+1],ez=pa[e+5]-pa[e+2];if(Math.sqrt(ex*ex+ey*ey+ez*ez)*SCm>minLen)keep.push(pa[e],pa[e+1],pa[e+2],pa[e+3],pa[e+4],pa[e+5])}
      var kg=new T.BufferGeometry();kg.setAttribute('position',new T.Float32BufferAttribute(keep,3));var ln=new T.LineSegments(kg,lm);ln.scale.set(1.006,1,1.006);ln.visible=curLines>.01;ln.renderOrder=3;m.parent.add(ln);nightLines.push(ln)}
    return function(out){var ms=[];out.traverse(function(m){if(m.isMesh)ms.push(m)});ms.forEach(function(m){edgeJobs.push([build,m,out])});if(edgesWanted)pumpEdges()}}
  function warmEdges(){edgesWanted=true;pumpEdges()}
  var merEdges=edgesFor(0xd4e9ff,24,.4),klccEdges=edgesFor(0xffe7b0,14,.55),exEdges=edgesFor(0xa8ecff,16,.7);
  // In the district all four landmarks are the hand-made models (the district's own baked Menara KL is cleared out below, see CLEAR/BAKED).
  if(DIST){later(function(){loadModel(BASE+'city/klcc.json',LAY.klcc[0],LAY.klcc[1],LAY.klcc[2],bodyM,null,klccEdges)});later(function(){loadModel(BASE+'city/menara_kl.json',LAY.kl[0],LAY.kl[1],LAY.kl[2],bodyM,null,null)});
    later(function(){loadModel(BASE+'city/merdeka118.json',LAY.mer[0],LAY.mer[1],LAY.mer[2],bodyM,null,merEdges)});later(function(){loadModel(BASE+'city/exchange106.json',LAY.ex[0],LAY.ex[1],LAY.ex[2],bodyM,null,exEdges)})}
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
      sh.fragmentShader=sh.fragmentShader.replace('void main() {',GLSL.facadeHead)
        .replace('#include <emissivemap_fragment>',GLSL.facadeBody)};
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
  later(function(){fetch(BASE+(DIST?'city/klcc_district.json':'city/kl_city.json')).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(d){
    var q=new Int16Array(b64(d.positions,Uint8Array).buffer),pos=new Float32Array(q.length);for(var k=0;k<q.length;k++)pos[k]=q[k]*d.scale;
    var geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(pos,3));var ix=b64(d.indices,Uint16Array);
    if(DIST)ix=clearPlots(pos,ix); // make room: the landmarks' plots, and the district's own coarse landmarks, are cut out of the mesh
    geo.setIndex(new T.BufferAttribute(ix,1));
    geo=geo.toNonIndexed();geo.computeVertexNormals(); // flat normals: the lighting needs them
    cityMesh=new T.Mesh(geo,cityM);cityMesh.scale.setScalar(SC);g.add(cityMesh);need=true;
  }).catch(function(){})});
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
    {name:'Petronas Twin Towers',real:452,top:new T.Vector3(crown('klcc')[0],134,crown('klcc')[1]),cta:'Check out my Portfolio ↗',href:'/portfolio/'},
    {name:'Merdeka 118',real:679,top:new T.Vector3(crown('mer')[0],194,crown('mer')[1]),cta:'Projects & Specs ↗',href:'/#projects'},
    {name:'Menara Kuala Lumpur',real:421,top:new T.Vector3(crown('kl')[0],DIST?127:130,crown('kl')[1]),cta:'Notes & Write-ups ↗',href:'/notes/'},
    {name:'The Exchange 106',real:445,top:new T.Vector3(crown('ex')[0],DIST?132:136,crown('ex')[1]),cta:'Open the Lab ↗',href:'/lab/'}]; // tops derived from LAY (crown axis, height as before)
  var fx=[],fxGroup=new T.Group();scene.add(fxGroup);
  function fade(){var w=4,h=64,d=new Uint8Array(w*h*4),y,x,p;
    for(y=0;y<h;y++){var f=y/(h-1),v=Math.round(255*(f<.35?1-(1-.604)*(f/.35):.604*(1-(f-.35)/.65)));
      for(x=0;x<w;x++){p=(y*w+x)*4;d[p]=d[p+1]=d[p+2]=v;d[p+3]=255}}
    var t=new T.DataTexture(d,w,h,T.RGBAFormat);t.minFilter=t.magFilter=T.LinearFilter;t.generateMipmaps=false;t.needsUpdate=true;return t}
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
  function moonTex(){var W2=256,H2=128,d=new Uint8Array(W2*H2*4),i,x,y,p;
    for(i=0;i<d.length;i+=4){d[i]=d[i+1]=d[i+2]=216;d[i+3]=255}
    function disc(cx,cy,r,cr,cg,cb,a){var x0=Math.max(0,Math.floor(cx-r)),x1=Math.min(W2-1,Math.ceil(cx+r)),y0=Math.max(0,Math.floor(cy-r)),y1=Math.min(H2-1,Math.ceil(cy+r));
      for(y=y0;y<=y1;y++)for(x=x0;x<=x1;x++){if((x-cx)*(x-cx)+(y-cy)*(y-cy)<=r*r){p=(y*W2+x)*4;d[p]=d[p]+(cr-d[p])*a;d[p+1]=d[p+1]+(cg-d[p+1])*a;d[p+2]=d[p+2]+(cb-d[p+2])*a}}}
    for(i=0;i<46;i++){var cx=Math.random()*W2,cy=Math.random()*H2,r=3+Math.random()*13;
      disc(cx,cy,r,60,70,90,.1+Math.random()*.2);disc(cx-r*.25,cy-r*.25,r*.7,255,255,255,.14+Math.random()*.12)}
    var t=new T.DataTexture(d,W2,H2,T.RGBAFormat);t.minFilter=t.magFilter=T.LinearFilter;t.generateMipmaps=false;t.needsUpdate=true;return t}
  function radialTex(fn){var S=128,h=S*.5,d=new Uint8Array(S*S*4),y,x,p;
    for(y=0;y<S;y++)for(x=0;x<S;x++){var r=Math.hypot((x+.5-h)/h,(y+.5-h)/h),a=r>=1?0:Math.max(0,Math.min(1,fn(r)));
      p=(y*S+x)*4;d[p]=d[p+1]=d[p+2]=255;d[p+3]=Math.round(a*255)}
    var t=new T.DataTexture(d,S,S,T.RGBAFormat);t.minFilter=t.magFilter=T.LinearFilter;t.generateMipmaps=false;t.needsUpdate=true;return t}
  // Procedural DataTextures (not Canvas2D) so Safari's Canvas2D fingerprinting noise can never speckle the giant additive sun/moon glow sprites.
  function glowTex(){return radialTex(function(r){var u=1-r;return u*u*(.28+.67*u*u)})}
  var mTex=moonTex(),gTex=glowTex();
  var moonM=new T.MeshBasicMaterial({map:mTex,fog:false}),moon=new T.Mesh(new T.SphereGeometry(70,32,20),moonM),moonG=new T.Group();
  moon.renderOrder=-15;moonG.add(moon);
  var moonHalo=new T.Sprite(new T.SpriteMaterial({map:gTex,transparent:true,depthWrite:false,fog:false}));moonHalo.scale.set(300,300,1);moonHalo.renderOrder=-16;moonG.add(moonHalo);
  var ringMat=new T.MeshBasicMaterial({transparent:true,side:T.DoubleSide,depthWrite:false,fog:false});
  var moonRing=new T.Mesh(new T.RingGeometry(104,108,96),ringMat),moonRing2=new T.Mesh(new T.RingGeometry(116,118,96),ringMat);
  moonRing.rotation.x=1.15;moonRing2.rotation.x=1.15;moonRing.renderOrder=moonRing2.renderOrder=-14;moonG.add(moonRing,moonRing2);
  var moon2M=new T.MeshBasicMaterial({map:mTex,fog:false}),moon2=new T.Mesh(new T.SphereGeometry(15,20,14),moon2M);moon2.renderOrder=-14;moonG.add(moon2);
  sci.add(moonG);
  // -- the golden-hour sun: a low warm disc with a wide glow, locked in the sky like the moon (visible only from t 0 to 2 around golden hour, see SceneTime). SUND is also where the golden-hour light comes from.
  function discTex(){return radialTex(function(r){var u=Math.max(0,Math.min(1,(1-r)/.14));return u*u*(3-2*u)})}
  var SUND=new T.Vector3(-.8,.11,-.59).normalize(),sunG=new T.Group(),
    sunDisc=new T.Sprite(new T.SpriteMaterial({map:discTex(),transparent:true,depthWrite:false,fog:false})),
    sunGlow=new T.Sprite(new T.SpriteMaterial({map:gTex,transparent:true,depthWrite:false,depthTest:false,fog:false,blending:T.AdditiveBlending})), // the glow is not depth-tested: it is the sun's glare over the whole picture, so the ground and the sky meet without a seam
    sunGlow2=new T.Sprite(new T.SpriteMaterial({map:gTex,transparent:true,depthWrite:false,depthTest:false,fog:false,blending:T.AdditiveBlending}));
  sunDisc.scale.set(84,84,1);sunGlow.scale.set(760,760,1);sunGlow2.scale.set(2400,2400,1);sunDisc.renderOrder=-12;sunGlow.renderOrder=-13;sunGlow2.renderOrder=-14;
  sunG.add(sunGlow2,sunGlow,sunDisc);sunG.position.copy(SUND).multiplyScalar(1100);sunG.visible=false;sci.add(sunG);
  // -- gyroscope rings round the Petronas crowns and the top of Merdeka 118
  var gyroM=new T.MeshBasicMaterial({transparent:true,depthWrite:false,side:T.DoubleSide}),gyros=[];
  function addGyro(c,r,speed){var g=new T.Group();g.position.copy(c);
    [[r,0,0,1],[r*1.3,1.1,.4,-.8],[r*1.62,.5,1.2,.6]].forEach(function(d,i){
      var ring=new T.Mesh(new T.TorusGeometry(d[0],.32,6,96),gyroM),holder=new T.Group();holder.rotation.set(d[1],d[2],0);holder.add(ring);
      var bead=new T.Mesh(new T.SphereGeometry(1.5,10,8),gyroM);bead.position.set(d[0],0,0);ring.add(bead);g.add(holder);gyros.push({h:holder,ring:ring,sp:d[3]*speed})});
    sci.add(g);return g}
  addGyro(new T.Vector3(crown('klcc')[0],128,crown('klcc')[1]),22,1);
  addGyro(LM[1].top.clone().add(new T.Vector3(0,-14,0)),12,1.4);
  // ===== ADAPTIVE RENDERING GOVERNOR (PERF): keeps 60 fps on phones & laptops without losing visual craft =====
  var PERF=(function(){
    var mobDev=innerWidth<=820||/Mobi|Android|iPhone/i.test(navigator.userAgent||'');
    var cores=navigator.hardwareConcurrency||4,mem=navigator.deviceMemory||4;
    var tier=(mobDev||cores<=4||mem<=4)?'low':((innerWidth<=1440||cores<=8)?'mid':'high');
    return {
      tier:tier, dprCap:tier==='low'?1.05:(tier==='mid'?1.35:1.5),
      tubeMul:tier==='low'?.52:(tier==='mid'?.78:1),
      trails:tier!=='low',
      rainN:tier==='low'?85:(tier==='mid'?170:260),
      simSkip:tier==='low'?2:1,
      emaDt:.016, badFrames:0, goodFrames:0, degraded:0
    };
  })();

  // ===== RAIL: expanded city-wide KL viaduct network (Inner Sky-Line, KLCC Ring, Helix Riser & Wide Outer Metro Loop) =====
  // All paths use LAY/A0 with generous clearance (>14 units) from landmarks and blocks.
  function UW0(x,z){return [.665*x+.747*z,-.747*x+.665*z]}
  function toward(c,d){var L=Math.hypot(c[0],c[1])||1;return [c[0]-c[0]/L*d,c[1]-c[1]/L*d]}
  var kU=UW0(LAY.kl[0],LAY.kl[1]),mU=UW0(LAY.mer[0],LAY.mer[1]),eU=UW0(LAY.ex[0],LAY.ex[1]),kP=toward(kU,38),mP=toward(mU,72),eP=toward(eU,55);
  var skyCurve=new T.CatmullRomCurve3([[41,0,88],[10,95,78],[kP[0],kP[1],62],[mP[0],mP[1],70],[eP[0],eP[1],54],[-20,-105,64],[40,-70,80]].map(function(p){return A0(p[0],p[1],p[2])}),true,'catmullrom',.5);
  var ringPts=[];for(var rgi=0;rgi<16;rgi++){var rga=rgi/16*6.2832;ringPts.push(A0(Math.cos(rga)*52,Math.sin(rga)*52,24))}
  var ringCurve=new T.CatmullRomCurve3(ringPts,true,'catmullrom',.5);
  var hxPts=[];for(var hxi=0;hxi<=32;hxi++){var hxk=hxi/32,hxa=hxk*6.2832,hxr=52-11*hxk;hxPts.push(A0(Math.cos(hxa)*hxr,Math.sin(hxa)*hxr,24+64*hxk))}
  var helixCurve=new T.CatmullRomCurve3(hxPts,false,'catmullrom',.5);
  // Expanded Wide Outer KL Metro Loop: sweeps across the wider Kuala Lumpur basin around all four landmarks
  var outPts=[],ocx=(LAY.klcc[0]+LAY.kl[0]+LAY.mer[0]+LAY.ex[0])/4,ocz=(LAY.klcc[1]+LAY.kl[1]+LAY.mer[1]+LAY.ex[1])/4;
  for(var oi=0;oi<12;oi++){
    var oa=oi/12*6.2832,or2=255+Math.sin(oa*2)*42,oy=42+Math.sin(oa*3+1.1)*18;
    outPts.push(new T.Vector3(ocx+Math.cos(oa)*or2,oy,ocz+Math.sin(oa)*or2));
  }
  var outerCurve=new T.CatmullRomCurve3(outPts,true,'catmullrom',.5);
  var skyLen=skyCurve.getLength(),ringLen=ringCurve.getLength(),helixLen=helixCurve.getLength(),outerLen=outerCurve.getLength();
  var tgtV=new T.Vector3(),chH=new T.Vector3(),chT=new T.Vector3(),chS=new T.Vector3(),chP=new T.Vector3(),chL=new T.Vector3();

  function offsetCurve(curve,segs,lat,dy,closed){
    var pts=[],p=new T.Vector3(),tg=new T.Vector3(),side=new T.Vector3(),up=new T.Vector3(0,1,0);
    for(var i=0;i<(closed?segs:segs+1);i++){
      var u=i/segs;curve.getPointAt(u%1,p);curve.getTangentAt(u%1,tg);
      side.crossVectors(tg,up).normalize();
      pts.push(new T.Vector3(p.x+side.x*lat,p.y+dy,p.z+side.z*lat));
    }
    return new T.CatmullRomCurve3(pts,closed,'catmullrom',.5);
  }
  var railM=new T.MeshBasicMaterial({transparent:true,opacity:.95,fog:true}),
      railM2=new T.MeshBasicMaterial({transparent:true,opacity:.32,fog:true,depthWrite:false}),
      deckM=new T.MeshBasicMaterial({fog:true}),
      portalM=new T.MeshBasicMaterial({transparent:true,opacity:.85,fog:true}),
      trailM=new T.MeshBasicMaterial({transparent:true,opacity:.55,depthWrite:false,fog:true});

  function ts(n){return Math.max(24,Math.round(n*PERF.tubeMul))}
  var skyDeck=new T.Mesh(new T.TubeGeometry(offsetCurve(skyCurve,76,0,-1.05,true),ts(220),1.05,4,true),deckM),
      ringDeck=new T.Mesh(new T.TubeGeometry(offsetCurve(ringCurve,48,0,-1.05,true),ts(112),.95,4,true),deckM),
      helixDeck=new T.Mesh(new T.TubeGeometry(offsetCurve(helixCurve,48,0,-1.05,false),ts(112),.9,4,false),deckM),
      outerDeck=new T.Mesh(new T.TubeGeometry(offsetCurve(outerCurve,84,0,-1.05,true),ts(220),1.05,4,true),deckM);
  var skyRailL=new T.Mesh(new T.TubeGeometry(offsetCurve(skyCurve,76,-1.25,-.25,true),ts(220),.24,3,true),railM),
      skyRailR=new T.Mesh(new T.TubeGeometry(offsetCurve(skyCurve,76,1.25,-.25,true),ts(220),.24,3,true),railM),
      ringRailL=new T.Mesh(new T.TubeGeometry(offsetCurve(ringCurve,48,-1.15,-.25,true),ts(110),.22,3,true),railM),
      ringRailR=new T.Mesh(new T.TubeGeometry(offsetCurve(ringCurve,48,1.15,-.25,true),ts(110),.22,3,true),railM),
      helixRailL=new T.Mesh(new T.TubeGeometry(offsetCurve(helixCurve,48,-1.1,-.25,false),ts(110),.22,3,false),railM),
      helixRailR=new T.Mesh(new T.TubeGeometry(offsetCurve(helixCurve,48,1.1,-.25,false),ts(110),.22,3,false),railM),
      outerRailL=new T.Mesh(new T.TubeGeometry(offsetCurve(outerCurve,84,-1.25,-.25,true),ts(200),.24,3,true),railM),
      outerRailR=new T.Mesh(new T.TubeGeometry(offsetCurve(outerCurve,84,1.25,-.25,true),ts(200),.24,3,true),railM);
  var skyGlow=new T.Mesh(new T.TubeGeometry(offsetCurve(skyCurve,60,0,-1.65,true),ts(160),1.35,3,true),railM2),
      helixGlow=new T.Mesh(new T.TubeGeometry(offsetCurve(helixCurve,40,0,-1.55,false),ts(90),1.25,3,false),railM2);
  scene.add(skyDeck,ringDeck,helixDeck,outerDeck,skyRailL,skyRailR,ringRailL,ringRailR,helixRailL,helixRailR,outerRailL,outerRailR,skyGlow,helixGlow);

  // Instanced sleepers & overhead portal arches across inner sky-line, KLCC ring, and wide outer metro loop
  var tiesSky=Math.round(Math.min(100,skyLen/16)*PERF.tubeMul),tiesRing=Math.round(40*PERF.tubeMul),tiesOut=Math.round(80*PERF.tubeMul),tiesTotal=tiesSky+tiesRing+tiesOut;
  var tieInst=new T.InstancedMesh(new T.BoxGeometry(3.4,.35,.6),deckM,tiesTotal);
  var archSky=Math.round(Math.min(40,skyLen/38)*PERF.tubeMul),archRing=Math.round(14*PERF.tubeMul),archOut=PERF.tier==='low'?12:Math.round(28*PERF.tubeMul),archTotal=archSky+archRing+archOut;
  var archLegG=new T.BoxGeometry(.36,4.8,.45),archTopG=new T.BoxGeometry(4.4,.38,.55),archLitG=new T.BoxGeometry(3.8,.16,.24);
  var archLegL=new T.InstancedMesh(archLegG,portalM,archTotal),archLegR=new T.InstancedMesh(archLegG,portalM,archTotal),
      archTop=new T.InstancedMesh(archTopG,portalM,archTotal),archLit=new T.InstancedMesh(archLitG,railM,archTotal);
  var dm=new T.Object3D(),dp=new T.Vector3(),dtg=new T.Vector3(),dsd=new T.Vector3(),dup=new T.Vector3(0,1,0),dLook=new T.Vector3();
  var ti0=0,ai0=0;
  function populateTrack(curve,nTies,nArch){
    for(var i=0;i<nTies;i++){
      var u=i/nTies;curve.getPointAt(u,dp);curve.getTangentAt(u,dtg);
      dm.position.set(dp.x,dp.y-.75,dp.z);dLook.copy(dm.position).add(dtg);dm.lookAt(dLook);dm.updateMatrix();
      tieInst.setMatrixAt(ti0++,dm.matrix);
    }
    for(var j=0;j<nArch;j++){
      var ua=(j+.5)/nArch;curve.getPointAt(ua,dp);curve.getTangentAt(ua,dtg);dsd.crossVectors(dtg,dup).normalize();
      dm.position.set(dp.x-dsd.x*2.05,dp.y+1.45,dp.z-dsd.z*2.05);dLook.copy(dm.position).add(dtg);dm.lookAt(dLook);dm.updateMatrix();archLegL.setMatrixAt(ai0,dm.matrix);
      dm.position.set(dp.x+dsd.x*2.05,dp.y+1.45,dp.z+dsd.z*2.05);dLook.copy(dm.position).add(dtg);dm.lookAt(dLook);dm.updateMatrix();archLegR.setMatrixAt(ai0,dm.matrix);
      dm.position.set(dp.x,dp.y+3.85,dp.z);dLook.copy(dm.position).add(dtg);dm.lookAt(dLook);dm.updateMatrix();archTop.setMatrixAt(ai0,dm.matrix);
      dm.position.set(dp.x,dp.y+3.6,dp.z);dLook.copy(dm.position).add(dtg);dm.lookAt(dLook);dm.updateMatrix();archLit.setMatrixAt(ai0,dm.matrix);
      ai0++;
    }
  }
  populateTrack(skyCurve,tiesSky,archSky);
  populateTrack(ringCurve,tiesRing,archRing);
  populateTrack(outerCurve,tiesOut,archOut);
  scene.add(tieInst,archLegL,archLegR,archTop,archLit);

  // Tapered viaduct pylons grounding Ring (20), Sky-Line (16), and Wide Outer Metro (22)
  var pillarM=new T.MeshBasicMaterial({transparent:true,opacity:.78,fog:true});
  var nRingP=20,nSkyP=16,nOutP=PERF.tier==='low'?14:22,pTot=nRingP+nSkyP+nOutP;
  var pillars=new T.InstancedMesh(new T.CylinderGeometry(.42,.95,1,5),pillarM,pTot),
      pillarCaps=new T.InstancedMesh(new T.BoxGeometry(3.8,.7,1.4),deckM,pTot),pdm=new T.Object3D(),pIdx=0;
  function addPylons(curve,cnt,sc){
    for(var i=0;i<cnt;i++){
      var pp=curve.getPointAt((i+.5)/cnt),ptg=curve.getTangentAt((i+.5)/cnt),ph=Math.max(6,pp.y-1.45);
      pdm.position.set(pp.x,ph/2,pp.z);pdm.rotation.set(0,0,0);pdm.scale.set(sc,ph,sc);pdm.updateMatrix();pillars.setMatrixAt(pIdx,pdm.matrix);
      pdm.position.set(pp.x,pp.y-1.35,pp.z);pdm.scale.set(sc,sc,sc);dLook.copy(pdm.position).add(ptg);pdm.lookAt(dLook);pdm.updateMatrix();pillarCaps.setMatrixAt(pIdx,pdm.matrix);pIdx++;
    }
  }
  addPylons(ringCurve,nRingP,1);
  addPylons(skyCurve,nSkyP,1.12);
  addPylons(outerCurve,nOutP,1.18);
  scene.add(pillars,pillarCaps);

  // STATIONS: 8 KL architectural transit hubs (6 inner + 2 wide outer perimeter hubs: Sentral & Ampang)
  var CARL=6.4,CARGAP=.7,DWELL=4.5;
  function paramNear(curve,x,z){var b=1e9,r=0,q=new T.Vector3();for(var i=0;i<600;i++){curve.getPointAt(i/600,q);var d=Math.hypot(q.x-x,q.z-z);if(d<b){b=d;r=i/600}}return r}
  var kS=A0(kP[0],kP[1],62),mS=A0(mP[0],mP[1],70),eS=A0(eP[0],eP[1],54);
  var STAT=[
    {c:skyCurve,s:0,n:'KLCC'},{c:skyCurve,s:paramNear(skyCurve,kS.x,kS.z),n:'Bukit Nanas'},
    {c:skyCurve,s:paramNear(skyCurve,mS.x,mS.z),n:'Merdeka'},{c:skyCurve,s:paramNear(skyCurve,eS.x,eS.z),n:'TRX'},
    {c:ringCurve,s:0,n:'Suria KLCC'},{c:ringCurve,s:.5,n:'Ampang Park'},
    {c:outerCurve,s:.12,n:'Sentral'},{c:outerCurve,s:.62,n:'Ampang'}
  ];
  var stPlatM=new T.MeshBasicMaterial({fog:true}),stCanM=new T.MeshBasicMaterial({transparent:true,opacity:.55,depthWrite:false,fog:true}),stPostM=new T.MeshBasicMaterial({fog:true});
  var stLampM=new T.MeshBasicMaterial({fog:true}),stPlatG=new T.BoxGeometry(8.6,.7,30),stEdgeG=new T.BoxGeometry(.22,.16,29.6),stCanG=new T.BoxGeometry(7.6,.24,26),stRibG=new T.BoxGeometry(8.2,.32,.48),stPostG=new T.BoxGeometry(.36,5.2,.44),stLampG=new T.BoxGeometry(7.2,.18,26.4);
  STAT.forEach(function(st){
    var g2=new T.Group(),pp=st.c.getPointAt(st.s),tg=st.c.getTangentAt(st.s);g2.position.copy(pp);g2.lookAt(pp.clone().add(tg));
    st.pos=pp.clone();
    var pl=new T.Mesh(stPlatG,stPlatM);pl.position.y=-1.95;g2.add(pl);
    [-3.95,3.95].forEach(function(ex){var ed=new T.Mesh(stEdgeG,stLampM);ed.position.set(ex,-1.55,0);g2.add(ed)});
    var cn=new T.Mesh(stCanG,stCanM);cn.position.y=3.55;g2.add(cn);
    [-11,-5.5,0,5.5,11].forEach(function(rz){
      var rb=new T.Mesh(stRibG,stPostM);rb.position.set(0,3.72,rz);g2.add(rb);
      [-3.85,3.85].forEach(function(rx){var po=new T.Mesh(stPostG,stPostM);po.position.set(rx,1.1,rz);g2.add(po)});
    });
    var lp=new T.Mesh(stLampG,stLampM);lp.position.y=3.92;g2.add(lp);
    scene.add(g2);
  });

  // TRAINS: Sky-Line Express, KLCC Ring, Helix Shuttle, and Wide Outer Metro Express
  var trains=[
    {c:skyCurve,len:skyLen,cars:5,sp:38,off:0,hero:false,name:'Sky-Line Express'},
    {c:outerCurve,len:outerLen,cars:5,sp:48,off:.1,hero:false,name:'Outer Metro Express'},
    {c:helixCurve,len:helixLen,cars:3,sp:24,off:.15,hero:false,pp:true,name:'KLCC Helix Shuttle'},
    {c:ringCurve,len:ringLen,cars:4,sp:-16,off:0,hero:false,name:'KLCC Ring West'},
    {c:skyCurve,len:skyLen,cars:5,sp:38,off:.5,hero:false,name:'Sky-Line 02'},
    {c:outerCurve,len:outerLen,cars:5,sp:-46,off:.6,hero:false,name:'Outer Metro 02'},
    {c:ringCurve,len:ringLen,cars:4,sp:16,off:.5,hero:false,name:'KLCC Ring East'}
  ];
  if(PERF.tier==='low')trains=trains.slice(0,4);
  else if(PERF.tier==='mid')trains=trains.slice(0,6);
  var nCars=0,nMid=0,TRAIL_N=PERF.trails?6:0;
  trains.forEach(function(t,ti){t.i0=nCars;nCars+=t.cars;t.m0=nMid;nMid+=t.cars-2;t.k0=ti*2;t.t0=ti*TRAIL_N;t.dir=t.sp<0?-1:1;t.headP=new T.Vector3();t.headT=new T.Vector3(0,0,1);
    if(t.pp){t.hh=t.cars*(CARL+CARGAP)/2/t.len;t.D=1-2*t.hh;t.tl=t.D*t.len/t.sp/.85;t.cyc=2*(t.tl+DWELL);t.xs=[];t.seg=[];return}
    var half=t.cars*(CARL+CARGAP)/2/t.len,xs=[];STAT.forEach(function(st){if(st.c===t.c)xs.push((((t.dir>0?st.s:1-st.s)+half)%1+1)%1)});xs.sort(function(a,b){return a-b});t.xs=xs;
    t.seg=xs.map(function(x,i){var d=((xs[(i+1)%xs.length]-x)%1+1)%1||1;return {dx:d,tt:d*t.len/(Math.abs(t.sp)||1)/.85}});t.cyc=0;t.seg.forEach(function(g3){t.cyc+=DWELL+g3.tt})});
  function trainX(tr,t){
    if(!tr.xs.length)return ((tr.off+t*Math.abs(tr.sp)/tr.len)%1+1)%1;
    var tt=(((t+tr.off*tr.cyc)%tr.cyc)+tr.cyc)%tr.cyc;
    for(var i=0;i<tr.xs.length;i++){var sg=tr.seg[i],tot=DWELL+sg.tt;
      if(tt<tot){if(tt<DWELL)return tr.xs[i];var f=(tt-DWELL)/sg.tt;f=f*f*f*(f*(f*6-15)+10);return (tr.xs[i]+sg.dx*f)%1}
      tt-=tot}
    return tr.xs[0]}
  var carBodyM=new T.MeshBasicMaterial({fog:true}),carWinM=new T.MeshBasicMaterial({fog:true}),carStripeM=new T.MeshBasicMaterial({fog:true});
  function cabGeo(){var g=new T.BoxGeometry(2.6,2.7,CARL,2,2,6),pa=g.attributes.position,Z0=CARL/2-1.8;
    for(var i=0;i<pa.count;i++){var z=pa.getZ(i);if(z>Z0){var k=(z-Z0)/1.8;k*=k;pa.setX(i,pa.getX(i)*(1-.52*k));if(pa.getY(i)>0)pa.setY(i,pa.getY(i)-1.05*k)}}return g}
  var carMid=new T.InstancedMesh(new T.BoxGeometry(2.6,2.7,CARL),carBodyM,Math.max(1,nMid)),carCab=new T.InstancedMesh(cabGeo(),carBodyM,trains.length*2),
      carWin=new T.InstancedMesh(new T.BoxGeometry(2.72,.88,CARL-2.1),carWinM,nCars),carStripe=new T.InstancedMesh(new T.BoxGeometry(2.68,.34,CARL-1.2),carStripeM,nCars),
      trailInst=TRAIL_N?new T.InstancedMesh(new T.BoxGeometry(1.6,.22,5.6),trailM,trains.length*TRAIL_N):null;
  carMid.frustumCulled=carCab.frustumCulled=carWin.frustumCulled=carStripe.frustumCulled=false;
  scene.add(carMid,carCab,carWin,carStripe);
  if(trailInst){trailInst.frustumCulled=false;scene.add(trailInst)}
  var headGlowM=new T.SpriteMaterial({map:gTex,transparent:true,depthWrite:false,color:0xfff0c0,opacity:.9}),headGlows=trains.map(function(){var sp=new T.Sprite(headGlowM);sp.scale.set(16,16,1);scene.add(sp);return sp});
  var tailGlowM=new T.SpriteMaterial({map:gTex,transparent:true,depthWrite:false,color:0xff3a2a,opacity:.8}),tailGlows=trains.map(function(){var sp=new T.Sprite(tailGlowM);sp.scale.set(6,6,1);scene.add(sp);return sp});
  var trD=new T.Object3D(),trP=new T.Vector3(),trT=new T.Vector3(),trTarget=new T.Vector3(),trUp=new T.Vector3(0,.3,0),heroS=0,heroOn=false;
  var tK=0,tM=0;(function(){var kp=A0(kU[0],kU[1],62),mp=A0(mU[0],mU[1],70),bk=1e9,bm=1e9,q=new T.Vector3();for(var i=0;i<400;i++){skyCurve.getPointAt(i/400,q);var dk=Math.hypot(q.x-kp.x,q.z-kp.z),dm=Math.hypot(q.x-mp.x,q.z-mp.z);if(dk<bk){bk=dk;tK=i/400}if(dm<bm){bm=dm;tM=i/400}}})();
  function setCar(tr,c,p,tg,flip){
    trD.position.copy(p);trD.scale.set(1,1,1);trTarget.copy(p);if(flip)trTarget.sub(tg);else trTarget.add(tg);trD.lookAt(trTarget);trD.updateMatrix();
    if(c===0)carCab.setMatrixAt(tr.k0,trD.matrix);else if(c===tr.cars-1)carCab.setMatrixAt(tr.k0+1,trD.matrix);else carMid.setMatrixAt(tr.m0+c-1,trD.matrix);
    trD.position.y+=.36;trD.updateMatrix();carWin.setMatrixAt(tr.i0+c,trD.matrix);
    trD.position.y-=1.08;trD.updateMatrix();carStripe.setMatrixAt(tr.i0+c,trD.matrix)}
  function setTrail(idx,p,tg,scale){
    if(!trailInst||!trailInst.visible)return;
    trD.position.copy(p);trD.position.y-=.32;trD.scale.set(scale,scale,scale);trTarget.copy(trD.position).add(tg);trD.lookAt(trTarget);trD.updateMatrix();
    trailInst.setMatrixAt(idx,trD.matrix)}
  // MONSOON RAIN: GPU-light instanced streaks wrapped around camera position (off until toggled in Free Fly)
  var rainOn=false,rainM=new T.MeshBasicMaterial({color:0xc8e4ff,transparent:true,opacity:.42,depthWrite:false,fog:true});
  var rainInst=new T.InstancedMesh(new T.BoxGeometry(.14,7.5,.14),rainM,PERF.rainN),rainDrops=[],rainD=new T.Object3D();
  rainInst.frustumCulled=false;rainInst.visible=false;
  for(var rdi=0;rdi<PERF.rainN;rdi++)rainDrops.push({ox:(Math.random()-.5)*220,oy:(Math.random()-.5)*140,oz:(Math.random()-.5)*220,sp:130+Math.random()*70});
  scene.add(rainInst);
  function rainUpdate(dt){
    if(!rainOn){if(rainInst.visible)rainInst.visible=false;return}
    rainInst.visible=true;
    var cx=cam.position.x,cy=cam.position.y,cz=cam.position.z;
    for(var i=0;i<rainDrops.length;i++){
      var d0=rainDrops[i];d0.oy-=d0.sp*dt;if(d0.oy<-70)d0.oy+=140;
      rainD.position.set(cx+d0.ox,cy+d0.oy,cz+d0.oz);rainD.rotation.set(0,0,.09);rainD.scale.set(1,1,1);rainD.updateMatrix();
      rainInst.setMatrixAt(i,rainD.matrix);
    }
    rainInst.instanceMatrix.needsUpdate=true;
  }
  var railTick=0;
  function railUpdate(time,still){
    if(!still&&PERF.simSkip>1&&!trainCamOn&&(++railTick%PERF.simSkip)!==0)return;
    var t=still?0:time*.001;
    for(var k=0;k<trains.length;k++){var tr=trains[k];
      if(tr.pp){
        var tt=(((t+tr.off*tr.cyc)%tr.cyc)+tr.cyc)%tr.cyc,cc,dd=1,ez=function(f){return f*f*f*(f*(f*6-15)+10)},st2=(CARL+CARGAP)/tr.len,moving=false;
        if(tt<DWELL)cc=tr.hh;else{tt-=DWELL;if(tt<tr.tl){cc=tr.hh+tr.D*ez(tt/tr.tl);moving=true}else{tt-=tr.tl;dd=-1;if(tt<DWELL)cc=1-tr.hh;else{tt-=DWELL;cc=1-tr.hh-tr.D*ez(Math.min(1,tt/tr.tl));moving=true}}}
        for(var c2=0;c2<tr.cars;c2++){var uu=Math.min(1,Math.max(0,cc+dd*((tr.cars-1)/2-c2)*st2));tr.c.getPointAt(uu,trP);tr.c.getTangentAt(uu,trT);if(dd<0)trT.negate();setCar(tr,c2,trP,trT,c2===tr.cars-1)}
        var uf=Math.min(1,Math.max(0,cc+dd*(tr.cars-1)/2*st2));tr.c.getPointAt(uf,trP);tr.c.getTangentAt(uf,trT);if(dd<0)trT.negate();
        tr.headP.copy(trP);tr.headT.copy(trT);
        headGlows[k].visible=true;headGlows[k].position.copy(trP).addScaledVector(trT,CARL*.55).add(trUp);
        var ub=Math.min(1,Math.max(0,cc-dd*(tr.cars-1)/2*st2));tr.c.getPointAt(ub,trP);tr.c.getTangentAt(ub,trT);if(dd<0)trT.negate();tailGlows[k].visible=true;tailGlows[k].position.copy(trP).addScaledVector(trT,-CARL*.55).add(trUp);
        if(trailInst&&trailInst.visible)for(var q2=0;q2<TRAIL_N;q2++){var tu2=Math.min(1,Math.max(0,ub-dd*(q2+1)*5.4/tr.len));tr.c.getPointAt(tu2,trP);tr.c.getTangentAt(tu2,trT);setTrail(tr.t0+q2,trP,trT,moving?Math.max(.08,1-q2/TRAIL_N):0)}
        continue}
      var x=tr.hero?heroS:trainX(tr,t),dir=tr.dir,step=(CARL+CARGAP)/tr.len;
      for(var c=0;c<tr.cars;c++){var xc=(((x-c*step)%1)+1)%1,u=dir>0?xc:(1-xc)%1;tr.c.getPointAt(u,trP);tr.c.getTangentAt(u,trT);if(dir<0)trT.negate();setCar(tr,c,trP,trT,c===tr.cars-1)}
      var uh=dir>0?x%1:(1-x)%1;tr.c.getPointAt(uh,trP);tr.c.getTangentAt(uh,trT);if(dir<0)trT.negate();
      tr.headP.copy(trP);tr.headT.copy(trT);
      headGlows[k].visible=true;headGlows[k].position.copy(trP).addScaledVector(trT,CARL*.55).add(trUp);
      var xt=(((x-(tr.cars-1)*step)%1)+1)%1,ut=dir>0?xt:(1-xt)%1;tr.c.getPointAt(ut,trP);tr.c.getTangentAt(ut,trT);if(dir<0)trT.negate();tailGlows[k].visible=true;tailGlows[k].position.copy(trP).addScaledVector(trT,-CARL*.55).add(trUp);
      if(trailInst&&trailInst.visible){var tStep=5.8/tr.len;for(var q=0;q<TRAIL_N;q++){var tx2=(((xt-(q+1)*tStep)%1)+1)%1,tu=dir>0?tx2:(1-tx2)%1;tr.c.getPointAt(tu,trP);tr.c.getTangentAt(tu,trT);if(dir<0)trT.negate();setTrail(tr.t0+q,trP,trT,Math.max(.12,1-q/TRAIL_N))}}}
    carMid.instanceMatrix.needsUpdate=true;carCab.instanceMatrix.needsUpdate=true;carWin.instanceMatrix.needsUpdate=true;carStripe.instanceMatrix.needsUpdate=true;if(trailInst&&trailInst.visible)trailInst.instanceMatrix.needsUpdate=true}
  // Aircraft warning lights: a red double flash on the tip of every landmark (and on both Petronas spires), instead of lit rooms up there.
  var BEAC=(function(){var a=lp('klcc',11,-10),b=lp('klcc',-11,10),m=crown('mer'),e=crown('ex'),k=crown('kl');return [[a[0],134,a[1]],[b[0],134,b[1]],[m[0],193,m[1]],[e[0],136,e[1]],[k[0],130,k[1]]]})(); // both Petronas spires, then the tips of Merdeka 118, The Exchange 106 and Menara KL
  var beacons=BEAC.map(function(b,i){var m=new T.SpriteMaterial({map:gTex,transparent:true,depthWrite:false,color:0xff3a2a,fog:false,opacity:0}),sp=new T.Sprite(m);sp.scale.set(i===2?22:14,i===2?22:14,1);sp.position.set(b[0],b[1],b[2]);sp.renderOrder=6;g.add(sp);return{m:m,ph:i*.37}});
  function beaconUpdate(time){var t=time/1000;beacons.forEach(function(b){var p=((t/1.7+b.ph)%1+1)%1,a=(p<.09||(p>.2&&p<.29))?1:.08;b.m.opacity=a*beaconK;b.m.blending=beaconAdd?T.AdditiveBlending:T.NormalBlending})}
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
  // ===== TIME OF DAY: SceneTime =====
  // t runs 0 (plain day), 1 (golden hour), 2 (night). Three parameter sets are built ONCE (TB below, one row per parameter: [day, golden, night]; colours as hex, converted to OKLab here).
  // applyTime(t) blends the two neighbouring sets into the shader uniforms and a few dozen material colours: no CSS reads, no material rebuilds, no shader recompiles, at most once per frame
  // and only when t changed. The page's sky gradient (an inline gradient on <body>, mirroring the shader's sky) is written at most 10 times a second, and only when it changed (not at all under <html data-daycycle>, which writes it itself).
  // Day = the old light theme and night = the old dark theme, number for number, so t 0 and t 2 look as they always did.
  function s2l(c){return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4)}
  function l2s(c){c=c<0?0:c>1?1:c;return c<=.0031308?c*12.92:1.055*Math.pow(c,1/2.4)-.055}
  function lab(h){var n=parseInt(h.slice(1),16),r=s2l((n>>16&255)/255),g=s2l((n>>8&255)/255),b=s2l((n&255)/255),
      l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
    return [.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s]}
  function mixc(o,A,B,f){var L=A[0]+(B[0]-A[0])*f,a=A[1]+(B[1]-A[1])*f,b=A[2]+(B[2]-A[2])*f,
      l=L+.3963377774*a+.2158037573*b,m=L-.1055613458*a-.0638541728*b,s=L-.0894841775*a-1.291485548*b;l=l*l*l;m=m*m*m;s=s*s*s;
    o.r=l2s(4.0767416621*l-3.3077115913*m+.2309699292*s);o.g=l2s(-1.2684380046*l+2.6097574011*m-.3413193965*s);o.b=l2s(-.0041960863*l-.7034186147*m+1.707614701*s)}
  // [day, golden hour, night]. Golden hour: dusky blue-violet zenith, an amber sky at the horizon, a low warm sun, pale cream lit faces, violet shade, long amber haze, windows just starting to glow.
  // No magenta or pink anywhere in it (the owner's rule); the day column is the one blue family.
  var TB={
    far:['#b9d0ee','#c2b6d2','#1a1b3a'],mid:['#8ab2e6','#a597ca','#10183a'],near:['#5c92dc','#8a7cb8','#16224d'],ground:['#8ab2e6','#b3a4c4','#0d1230'],glass2:['#5c92dc','#968ac2','#0e1838'],
    ring:['#a2c3f0','#ffc07a','#7fd3ff'],orb:['#2c63c9','#6a5cb4','#3d79e0'],glass:['#e8f1fd','#ffe6c0','#7fd3ff'],line:['#2aa6e8','#f0a444','#3aa0ee'],
    sky1:['#fcfeff','#3a60a2','#050a1a'],skyM:['#e4f0fa','#eea25f','#141f52'],sky3:['#e4f0fa','#ffd79a','#6a4030'],fog:['#e4f0fa','#f1b27c','#3f2f41'],
    sunC:['#ffffff','#ffd9a4','#b0b4ff'],litC:['#f8fcff','#fff1d2','#f8fcff'],sunGlow:['#ffe6b0','#ffae55','#ffae55'],sunDisc:['#fffdf2','#fffbe8','#fffbe8'],
    star:['#5c92dc','#ffffff','#ffffff'],moon:['#5c92dc','#eac9aa','#c4cfee'],moon2:['#8ab2e6','#e2c6ac','#cfd8f2'],halo:['#ffffff','#ffd6a0','#9dbbff'],moonRing:['#5c92dc','#e9c9a4','#bcd2ff'],
    rail:['#2aa6e8','#ffcf8a','#7fd3ff'],deck:['#73a0df','#7d6fa6','#142147'],portal:['#4c82d1','#c29f90','#3d79e0'],trail:['#2aa6e8','#ffbe6b','#ffd480'],
    pillar:['#5c92dc','#8f80b8','#10183a'],stPlat:['#5c92dc','#9a8cbd','#10183a'],stPost:['#5c92dc','#9a8cbd','#7fd3ff'],stCan:['#ffffff','#ffe9c8','#7fd3ff'],
    carBody:['#f6fbff','#fff0da','#1b3d73'],carWin:['#0b2a6b','#5a4a88','#fff1b8'],carStripe:['#1559c9','#e0842a','#7fd3ff'],headGlow:['#ffffff','#ffe2a8','#fff0c0'],
    gyro:['#2aa6e8','#ffc27a','#7fd3ff'],pulse:['#2aa6e8','#ffcf8a','#7fd3ff'],
    stop:[1,.6,.58],fogN:[620,500,520],fogF:[1700,1650,1500],nightU:[0,.24,1],gold:[0,1,0],wrap:[0,.2,0],glint:[0,.5,0],
    light:[[-.42,.74,.52],[.95,.2,-.3],[-.42,.74,.52]],litMul:[[1,1,1],[1.08,1,.9],[3,3,1.9]],midMul:[[1,1,1],[1,.97,1.04],[.95,.95,.95]],litMix:[.42,.5,0],shadeMul:[[.46,.62,.95],[.62,.55,.78],[.45,.5,.7]],hazeK:[.5,.92,.55],sunAmt:[.5,1,1],
    towEm:[.28,.5,1],glassEm:[.15,.45,.9],gmEm:[.04,.2,0],amb:[.5,.5,.45],
    starO:[.38,0,1],moonO:[.85,.3,.38],ringO:[.55,.4,.5],gyroO:[.75,.8,.85],sunO:[0,1,0],lines:[0,0,1],beacon:[.45,.7,1],
    railO2:[.3,.3,.25],trailO:[.22,.48,.78],stCanO:[.65,.5,.32],headO:[.5,.7,.95],tailO:[.35,.6,.9],beamO:[.6,.65,.7],haloO:[.8,.85,.9],polyO:[.7,.75,.8],linkO:[.6,.6,.5]};
  var SET=[{},{},{}],tk,ti,tv0;
  for(tk in TB)for(ti=0;ti<3;ti++){tv0=TB[tk][ti];SET[ti][tk]=typeof tv0==='string'?lab(tv0):tv0}
  var CC={},TA,TBb,TF=0;
  function cc(k){return CC[k]||(CC[k]=new T.Color())}
  function pick(t){if(t<=1){TA=SET[0];TBb=SET[1];TF=t}else{TA=SET[1];TBb=SET[2];TF=t-1}}
  function cmix(k,o){mixc(o||cc(k),TA[k],TBb[k],TF);return o||CC[k]}
  function nn(k){return TA[k]+(TBb[k]-TA[k])*TF}
  function vmix(k,o){var a=TA[k],b=TBb[k];o.set(a[0]+(b[0]-a[0])*TF,a[1]+(b[1]-a[1])*TF,a[2]+(b[2]-a[2])*TF);return o}
  var ROLES=['far','mid','near','ground','glass2','ring','orb'],addNow=null,starSwap=null,beaconK=.45,beaconAdd=false,cssOn=false,cssAt=0,cssTimer=0,cssLast='',tDirty=true,tLast=-1;
  scene.fog=new T.Fog(0xe4f0fa,620,1700);
  var fogN0=620,fogF0=1700; // base fog (applyTime sets them); the finale pushes it back
  function setAdd(add){ // the additive glow materials: normal blending by day and golden hour, additive from t 1.5
    if(add===addNow)return;addNow=add;var b=add?T.AdditiveBlending:T.NormalBlending,L=[railM,railM2,trailM,stCanM,gyroM,beamM,haloM,radarM,polyM];
    for(var i=0;i<L.length;i++)L[i].blending=b;beaconAdd=add}
  function hex3(c){return '#'+c.getHexString()}
  var skyDiv=null;function skyEl(){if(!skyDiv){skyDiv=document.getElementById('skybg');if(!skyDiv){skyDiv=document.createElement('div');skyDiv.id='skybg';skyDiv.setAttribute('aria-hidden','true');document.body.insertBefore(skyDiv,document.body.firstChild)}}return skyDiv} // the sky gradient lives on its own fixed layer (scene.css #skybg): a fixed body background repaints the whole page on every scroll
  if(document.body)skyEl(); // always present (scene.css gives it the day gradient); writeCss only overrides it for golden hour and night
  function writeCss(){cssTimer=0;cssAt=performance.now();if(root.hasAttribute('data-daycycle')||!document.body)return;
    // The sky behind the canvas: one inline gradient on <body>. (Not CSS variables on <html>: a variable change on the root makes the browser recompute the style of every element on the page, 15 to 20 ms on a long page; a background on body alone costs a repaint.)
    var g='linear-gradient('+hex3(cc('sky1'))+','+hex3(cc('skyM'))+' '+(TU.uStop.value*100).toFixed(1)+'%,'+hex3(cc('sky3'))+')';if(g===cssLast)return;cssLast=g;skyEl().style.backgroundImage=g}
  function queueCss(){if(cssTimer)return;var w=100-(performance.now()-cssAt);if(w<=0)writeCss();else cssTimer=setTimeout(writeCss,w)}
  function applyTime(t){
    tLast=t;pick(t);var i,add=t>=1.5,night=t>1;
    for(i=0;i<ROLES.length;i++)cmix(ROLES[i]);
    for(i=0;i<mats.length;i++){var r=mats[i].userData.role;if(r)mats[i].color.copy(CC[r])}
    cmix('sky1');cmix('skyM');cmix('sky3');TU.uSky1.value.copy(CC.sky1);TU.uSky2.value.copy(CC.skyM);TU.uSky3.value.copy(CC.sky3);TU.uStop.value=nn('stop');
    scene.fog.color.copy(cmix('fog'));fogN0=nn('fogN');fogF0=nn('fogF');
    vmix('light',TU.uLight.value).normalize();vmix('litMul',TU.uLitMul.value);vmix('midMul',TU.uMidMul.value);vmix('shadeMul',TU.uShadeMul.value);
    TU.uLitMix.value=nn('litMix');TU.uHazeK.value=nn('hazeK');TU.uSunAmt.value=nn('sunAmt');TU.uGold.value=nn('gold');TU.uWrap.value=nn('wrap');TU.uGlint.value=nn('glint');
    cmix('litC',TU.uLitC.value);cmix('sunC',sun.color);cityU.uNight.value=nn('nightU');
    tower.emissive.copy(cmix('glass'));tower.emissiveIntensity=nn('towEm');glassM.emissive.copy(CC.ring);glassM.emissiveIntensity=nn('glassEm');
    glassModelM.emissive.copy(CC.ring);glassModelM.emissiveIntensity=nn('gmEm');ringM.color.copy(CC.ring);specks.material.color.copy(CC.ring);amb.intensity=nn('amb');
    // sci-fi layer: stars (white and additive from golden hour on; faint blue dots by day), moon, sun, night creases, beacons
    if(night!==starSwap){starSwap=night;starM.blending=night?T.AdditiveBlending:T.NormalBlending;starGeo.setAttribute('color',night?starAD:starAL)}
    starM.color.copy(cmix('star'));starM.opacity=nn('starO');
    moonM.color.copy(cmix('moon'));moon2M.color.copy(cmix('moon2'));moonHalo.material.color.copy(cmix('halo'));moonHalo.material.opacity=nn('moonO');ringMat.color.copy(cmix('moonRing'));ringMat.opacity=nn('ringO');
    var so=nn('sunO');sunG.visible=so>.01;if(sunG.visible){sunGlow.material.color.copy(cmix('sunGlow'));sunGlow.material.opacity=so*.34;sunGlow2.material.color.copy(CC.sunGlow);sunGlow2.material.opacity=so*.16;sunDisc.material.color.copy(cmix('sunDisc'));sunDisc.material.opacity=Math.min(1,so*1.4)}
    var lk=curLines=nn('lines'),lv=lk>.01;for(i=0;i<nightLines.length;i++)nightLines[i].visible=lv;for(i=0;i<lineMats.length;i++)lineMats[i].m.opacity=lineMats[i].op*lk;if(t>.02)warmEdges();
    beaconK=nn('beacon');
    // rail, stations, trains, the light layer
    setAdd(add);
    railM.color.copy(cmix('rail'));railM2.color.copy(CC.rail);baseRailO2=railM2.opacity=nn('railO2');deckM.color.copy(cmix('deck'));portalM.color.copy(cmix('portal'));trailM.color.copy(cmix('trail'));trailM.opacity=nn('trailO');pillarM.color.copy(cmix('pillar'));stLampM.color.copy(CC.rail);stPlatM.color.copy(cmix('stPlat'));stPostM.color.copy(cmix('stPost'));
    stCanM.color.copy(cmix('stCan'));stCanM.opacity=nn('stCanO');carBodyM.color.copy(cmix('carBody'));carWinM.color.copy(cmix('carWin'));carStripeM.color.copy(cmix('carStripe'));
    headGlowM.color.copy(cmix('headGlow'));headGlowM.opacity=nn('headO');tailGlowM.opacity=nn('tailO');
    gyroM.color.copy(cmix('gyro'));baseGyroO=gyroM.opacity=nn('gyroO');
    cmix('line');beamM.color.copy(CC.line);beamM.opacity=nn('beamO');haloM.color.copy(CC.line);haloM.opacity=nn('haloO');radarM.color.copy(CC.line);polyM.color.copy(CC.line);polyM.opacity=nn('polyO');linkM.color.copy(CC.line);linkM.opacity=nn('linkO');pulseM.color.copy(cmix('pulse'));
    if(cssOn)queueCss()}
  // SceneTime listener: remember that t changed, draw on the next frame; and (pages that do not run <html data-daycycle>) keep data-theme in step so the page's own dark rules follow: dark from t 1.5.
  ST._on(function(t){tDirty=true;need=true;if(root.hasAttribute('data-daycycle'))return;cssOn=true;var want=t>=1.5?'dark':'light';if(root.getAttribute('data-theme')!==want)root.setAttribute('data-theme',want)});
  function recolor(){tDirty=true;need=true}
  window.addEventListener('scenetheme',function(){recolor()});
  new MutationObserver(function(){ // the page's own theme button (or the T key) flips data-theme: follow it, unless the day cycle owns the theme
    if(root.hasAttribute('data-daycycle'))return;var dk=root.getAttribute('data-theme')==='dark',t=ST.get();
    if(dk&&t<1.5)ST.mode('night');else if(!dk&&t>=1.5)ST.mode('day')}).observe(root,{attributes:true,attributeFilter:['data-theme']});
  if(ST.get()===0&&root.getAttribute('data-theme')==='dark')ST.set(2); // a page that starts dark (stored choice, ?theme=dark) starts at night
  cssOn=ST.get()>0; // a page that starts at golden hour or night (remembered choice, ?time=) needs its sky gradient written; plain day is already what the stylesheet draws
  applyTime(ST.get());tDirty=false;
  var W=0,Hh=0,mobile=false,need=true,px=0,tx=0,cr=0,tr=0,vr={v:0},vx={v:0},dtF=.016,tgtPose=mob(END),curPose=mob(END),vPose=[{v:0},{v:0},{v:0},{v:0},{v:0},{v:0},{v:0},{v:0}];
  function size(){W=innerWidth;Hh=innerHeight;mobile=W<=820;renderer.setPixelRatio(Math.min(devicePixelRatio||1,PERF.dprCap));renderer.setSize(W,Hh,false);renderer.getDrawingBufferSize(TU.uRes.value);cam.aspect=W/Hh;cam.updateProjectionMatrix();need=true}
  var enter=document.getElementById('enter'),caps=enter?enter.querySelectorAll('.ride-cap'):[],roll=0,rideP=null,rideT=null,rideQ=null;
  // The page scroll is split in two: first the orbit round the skyline, then (inside #enter) the flight.
  // ---- THE DIRECTOR ----
  // Before the flight, every section of the page has its own camera shot. A shot (a "pose") is:
  //   [cx, cz, a, r, y, ty, sx, sy]  = look at (cx, ty, cz) from bearing a (degrees) at radius r and height y,
  //   with the picture pushed right by sx (and down by sy) as a fraction of the screen, so a panel can sit on the other side.
  // Poses are interpolated as bearings and radii, not as straight lines, so the camera sweeps round the building instead of through it.
  // The keys below are placed on the page by section: [section id, fraction down it, viewport offset, pose]. Keys are
  // spaced so a shot holds while its section is read and the move to the next one happens in the gap between them.
  // "Fly it again ...": shown over the finale. It cycles the view (plain, golden hour, night) and goes back to the start of the flight. The big picker in the flight HUD (assets/timeofday.js) does the same by choice.
  // "Hide HUD": one big toggle in the flight that clears every overlay (cockpit, captions, picker, skip, hints) for a clean view of the city.
  // Remembered per browser; the toggle itself always stays.
  (function(){if(root.hasAttribute('data-flight-only'))return; // /flight/ has its own UI switch
    var host=document.getElementById('fly-again');host=host&&host.parentNode;if(!host)return;
    var b=document.createElement('button');b.type='button';b.className='hud-tog';var rt=document.documentElement,K='hud-off';
    function set(v,save){rt.classList.toggle('hud-off',v);b.setAttribute('aria-pressed',v?'true':'false');b.setAttribute('aria-label',v?'Show HUD':'Hide HUD');
      b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(v?'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>':'<path d="M3 3l18 18M10.6 5.1A10.5 10.5 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 4.4-1"/>')+'</svg><b>'+(v?'Show HUD':'Hide HUD')+'</b>';
      if(save)try{localStorage.setItem(K,v?'1':'0')}catch(e){}}
    var st=null;try{st=localStorage.getItem(K)}catch(e){}
    set(st==='1',false);b.addEventListener('click',function(){set(!rt.classList.contains('hud-off'),true)});host.appendChild(b)})();
  var again=document.getElementById('fly-again'),DBGCR=/[?&]dbg/.test(location.search);
  var freeBtn=null,freeHint=null,freeTime=null,freeWp=null,flyMap=null,flyMapCv=null,flyMapOn=false,flyMapAt=0;
  var freeOn=false,freeDrag=false,freeLx=0,freeLy=0,fKeys={},trainCamOn=false,trainCamIdx=0,trainBtn=null,rainBtn=null,mapBtn=null,lapseOn=false,lapseBtn=null,lapsePhase=0,klWx='';
  // Silent live Kuala Lumpur weather telemetry (zero API key, graceful offline fallback)
  (function(){if(!window.fetch)return;fetch('https://api.open-meteo.com/v1/forecast?latitude=3.1579&longitude=101.7116&current=temperature_2m,rain,weather_code').then(function(r){return r.ok?r.json():null}).then(function(d){
    if(!d||!d.current)return;var temp=Math.round(d.current.temperature_2m),wet=(d.current.rain||0)>0||(d.current.weather_code>=51);
    klWx='KL LIVE · '+temp+'°C · '+(wet?'RAIN':'CLEAR');
    if(cp&&cp.gps)cp.gps.textContent=klWx;
    if(wet&&freeOn&&!rainOn&&window.TimeOfDay&&TimeOfDay.current&&TimeOfDay.current()==='live')setRain(true);
  }).catch(function(){})})();
  var freeState={a:48*Math.PI/180,ta:48*Math.PI/180,y:112,ty:112,r:280,tr:280,cx:0,tcx:0,cz:-40,tcz:-40,cy:72,tcy:72};
  function setLapse(v){
    lapseOn=!!v;
    if(lapseBtn)lapseBtn.setAttribute('aria-pressed',lapseOn?'true':'false');
    if(lapseOn)lapsePhase=ST.get()*.5;
    need=true;
  }
  function setTrainCam(v,cycle){
    if(cycle&&trainCamOn){trainCamIdx=(trainCamIdx+1)%Math.min(3,trains.length);if(trainBtn){var s2=trainBtn.querySelector('span');if(s2)s2.textContent=trains[trainCamIdx].name||'Ride Train'}return}
    trainCamOn=!!v;
    if(trainBtn){trainBtn.setAttribute('aria-pressed',trainCamOn?'true':'false');var sp=trainBtn.querySelector('span');if(sp)sp.textContent=trainCamOn?(trains[trainCamIdx].name||'Riding'):'Ride Train'}
    if(trainCamOn&&window.FlightLog)window.FlightLog.unlock('traincam');
    need=true;
  }
  function setRain(v){
    rainOn=!!v;
    if(rainBtn)rainBtn.setAttribute('aria-pressed',rainOn?'true':'false');
    if(window.SFX&&window.SFX.setRain)window.SFX.setRain(rainOn);
    need=true;
  }
  function setMap(v){
    flyMapOn=!!v;
    if(flyMap)flyMap.classList.toggle('on',flyMapOn&&freeOn);
    if(mapBtn)mapBtn.setAttribute('aria-pressed',flyMapOn?'true':'false');
  }
  function drawTransitMap(now){
    if(!flyMapOn||!freeOn||!flyMapCv)return;
    if(now-flyMapAt<62)return; // ~16 fps max: zero perf impact
    flyMapAt=now;
    var g=flyMapCv.getContext('2d'),S=220,cx=S/2,cy=S/2,sc=S/720;
    g.clearRect(0,0,S,S);
    g.fillStyle='rgba(5,11,26,.92)';g.fillRect(0,0,S,S);
    function mx(x){return cx+(x-GC[0])*sc}
    function my(z){return cy+(z-GC[1])*sc}
    function trace(curve,col,w,closed){
      g.beginPath();var p=new T.Vector3();
      for(var i=0;i<=48;i++){curve.getPointAt(i/48,p);var px2=mx(p.x),py2=my(p.z);if(i===0)g.moveTo(px2,py2);else g.lineTo(px2,py2)}
      if(closed)g.closePath();g.strokeStyle=col;g.lineWidth=w;g.stroke();
    }
    trace(outerCurve,'rgba(127,211,255,.35)',1.5,true);
    trace(skyCurve,'rgba(127,211,255,.78)',2,true);
    trace(ringCurve,'rgba(255,210,122,.7)',1.6,true);
    // Live trains
    for(var k=0;k<trains.length;k++){
      var tr=trains[k],tx2=mx(tr.headP.x),ty2=my(tr.headP.z);
      g.beginPath();g.arc(tx2,ty2,trainCamOn&&k===trainCamIdx?4.5:3,0,6.2832);
      g.fillStyle=trainCamOn&&k===trainCamIdx?'#ffffff':'#ffd27a';g.fill();
    }
    // Stations
    g.font='600 8.5px "JetBrains Mono",monospace';g.textAlign='center';
    for(var s=0;s<STAT.length;s++){
      var st=STAT[s],sx2=mx(st.pos.x),sy2=my(st.pos.z);
      g.beginPath();g.arc(sx2,sy2,3.4,0,6.2832);g.fillStyle='#7fd3ff';g.fill();
      g.fillStyle='rgba(234,242,255,.88)';g.fillText(st.n,sx2,sy2-6);
    }
  }
  function setFree(v){
    v=!!v;if(v===freeOn)return;freeOn=v;root.classList.toggle('free-fly',v);
    if(freeBtn){freeBtn.setAttribute('aria-pressed',v?'true':'false');var b=freeBtn.querySelector('b');if(b)b.textContent=v?'Resume scroll':'Take control · Free fly'}
    if(freeHint)freeHint.classList.toggle('on',v);if(freeTime)freeTime.classList.toggle('on',v);if(freeWp)freeWp.classList.toggle('on',v);
    if(flyMap)flyMap.classList.toggle('on',v&&flyMapOn);
    if(!v){fKeys={};setTrainCam(false);setRain(false);setLapse(false)}
    if(v&&!ONLY&&scrollY>pinEnd()-2){var se=document.documentElement.style,sb=se.scrollBehavior;se.scrollBehavior='auto';scrollTo(0,pinEnd()-Math.round(.35*BUFV*innerHeight));se.scrollBehavior=sb} // back onto the pinned stage before the page locks
    if(v){
      if(window.FlightLog)window.FlightLog.unlock('freefly');
      // seed free-fly orbit from the current camera so there is zero jump
      var dx=cam.position.x-GC[0],dz=cam.position.z-GC[1];
      freeState.cx=freeState.tcx=GC[0];freeState.cz=freeState.tcz=GC[1];freeState.cy=freeState.tcy=72;
      freeState.a=freeState.ta=Math.atan2(dz,dx);
      freeState.r=freeState.tr=clamp(Math.hypot(dx,dz),110,480);
      freeState.y=freeState.ty=clamp(cam.position.y,18,260);
      need=true;
    } else { freeDrag=false; fInit=true; need=true; }
  }
  function capturePostcard(btn){
    try{
      renderer.render(scene,cam);
      var src=renderer.domElement,cw=src.width,ch=src.height;
      var out=document.createElement('canvas');out.width=cw;out.height=ch;
      var ctx=out.getContext('2d');
      var gr=ctx.createLinearGradient(0,0,0,ch);
      gr.addColorStop(0,hex3(cc('sky1')));gr.addColorStop(TU.uStop.value,hex3(cc('skyM')));gr.addColorStop(1,hex3(cc('sky3')));
      ctx.fillStyle=gr;ctx.fillRect(0,0,cw,ch);
      ctx.drawImage(src,0,0,cw,ch);
      var pad=Math.round(Math.min(cw,ch)*.032),fh=Math.round(Math.max(36,ch*.055));
      var g2=ctx.createLinearGradient(0,ch-fh*2.4,0,ch);g2.addColorStop(0,'rgba(5,9,20,0)');g2.addColorStop(1,'rgba(5,9,20,.65)');
      ctx.fillStyle=g2;ctx.fillRect(0,ch-fh*2.4,cw,fh*2.4);
      var alt=Math.max(0,Math.round(cam.position.y*3.4)),tmName={day:'DAY',golden:'GOLDEN HOUR',night:'NIGHT'}[ST.nearest()]||'LIVE KL';
      ctx.fillStyle='#eaf2ff';ctx.font='700 '+Math.round(fh*.44)+'px "JetBrains Mono",ui-monospace,monospace';
      ctx.textBaseline='bottom';ctx.textAlign='left';
      ctx.fillText('\\7YMERA  ·  KUALA LUMPUR  ·  '+tmName,pad,ch-pad*.75);
      ctx.textAlign='right';ctx.fillStyle='rgba(234,242,255,.82)';
      ctx.fillText('ALT '+alt+' M  ·  3.1579° N 101.7116° E',cw-pad,ch-pad*.75);
      var a=document.createElement('a');a.download='7ymera-kl-'+ST.nearest()+'.png';a.href=out.toDataURL('image/png');a.click();
      if(window.FlightLog)window.FlightLog.unlock('postcard');
      if(btn){var sp=btn.querySelector('span'),old=sp?sp.textContent:'Postcard';if(sp)sp.textContent='Saved!';setTimeout(function(){if(sp)sp.textContent=old},1800)}
    }catch(e){if(window.console)console.warn('Postcard capture failed',e)}
  }
  if(again){(function(){var lab=again.querySelector('b'),NX={day:'golden',golden:'night',night:'day'},TXT={golden:'Fly it again at golden hour',night:'Fly it again at night',day:'Fly it again by day'};
    function next(){return NX[ST.nearest()]}
    function label(){if(lab)lab.textContent=TXT[next()]}
    label();document.addEventListener('scenetime',label);
    again.addEventListener('click',function(){setFree(false);ST.mode(next());
      var en=document.getElementById('enter');if(en)scrollTo({top:en.getBoundingClientRect().top+scrollY+innerHeight*.15,behavior:'instant'})});
    var parent=again.parentNode;
    if(parent&&!parent.querySelector('.fly-free')){
      freeBtn=document.createElement('button');freeBtn.type='button';freeBtn.className='fly-free';freeBtn.setAttribute('aria-pressed','false');
      freeBtn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="2"/></svg><b>Take control · Free fly</b>';
      freeBtn.addEventListener('click',function(){setFree(!freeOn)});
      parent.insertBefore(freeBtn,again.nextSibling);
      freeHint=document.createElement('p');freeHint.className='fly-free-hint';freeHint.setAttribute('aria-hidden','true');
      freeHint.innerHTML='<span class="ffk"><kbd>W</kbd><span><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span></span><span class="ffl"><b>Move</b>forward, left, back, right</span><span class="ffk"><span><kbd>Q</kbd><kbd>E</kbd></span></span><span class="ffl"><b>Down / up</b>Shift to go faster</span><span class="ffk"><kbd class="wide">Drag</kbd></span><span class="ffl"><b>Look round</b>arrows turn too, wheel zooms</span><span class="ffk"><kbd class="wide">Esc</kbd></span><span class="ffl"><b>Back to the film</b></span>';
      parent.insertBefore(freeHint,freeBtn.nextSibling);
      freeTime=document.createElement('div');freeTime.className='fly-free-time';freeTime.setAttribute('role','group');freeTime.setAttribute('aria-label','Time of day');
      [['day','Day'],['golden','Golden hour'],['night','Night'],['live','Live KL']].forEach(function(m){var b=document.createElement('button');b.type='button';b.dataset.m=m[0];b.innerHTML='<i class="fft-'+m[0]+'" aria-hidden="true"></i><span>'+m[1]+'</span>';b.addEventListener('click',function(){setLapse(false);if(window.TimeOfDay)TimeOfDay.choose(m[0]);else ST.mode(m[0]==='live'?'day':m[0])});freeTime.appendChild(b)});
      function ftSync(){var n=ST.nearest(),bs=freeTime.querySelectorAll('button');for(var q=0;q<bs.length;q++)bs[q].setAttribute('aria-pressed',bs[q].dataset.m===n?'true':'false')}
      document.addEventListener('scenetime',ftSync);ftSync();
      parent.insertBefore(freeTime,freeHint.nextSibling);
      // Waypoints, Train-Cam, Transit Map, Monsoon Rain, Time-Lapse & Postcard bar
      freeWp=document.createElement('div');freeWp.className='fly-free-wp';freeWp.setAttribute('role','group');freeWp.setAttribute('aria-label','Camera waypoints, train cam, map, rain, time-lapse and postcard');
      var WPS=[
        {id:'sky',n:'Skyline',cx:function(){return GC[0]},cz:function(){return GC[1]},cy:78,a:58,r:290,y:125},
        {id:'klcc',n:'Skybridge',cx:function(){return 0},cz:function(){return 0},cy:58,a:48,r:108,y:66},
        {id:'mer',n:'Merdeka 118',cx:function(){return LAY.mer[0]},cz:function(){return LAY.mer[1]},cy:125,a:185,r:165,y:148},
        {id:'kl',n:'Menara KL',cx:function(){return LAY.kl[0]},cz:function(){return LAY.kl[1]},cy:92,a:210,r:128,y:102},
        {id:'ex',n:'Exchange 106',cx:function(){return LAY.ex[0]},cz:function(){return LAY.ex[1]},cy:76,a:300,r:132,y:96}
      ];
      WPS.forEach(function(wp){
        var b=document.createElement('button');b.type='button';b.textContent=wp.n;
        b.addEventListener('click',function(){
          setTrainCam(false);
          freeState.tcx=wp.cx();freeState.tcz=wp.cz();freeState.tcy=wp.cy;
          freeState.ta=wp.a*Math.PI/180;freeState.tr=wp.r;freeState.ty=wp.y;need=true;
          [].forEach.call(freeWp.querySelectorAll('button[data-wp]'),function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});
        });
        b.dataset.wp=wp.id;freeWp.appendChild(b);
      });
      trainBtn=document.createElement('button');trainBtn.type='button';trainBtn.className='ff-train';trainBtn.setAttribute('aria-pressed','false');
      trainBtn.innerHTML='<span>Ride Train</span>';
      trainBtn.addEventListener('click',function(){if(trainCamOn)setTrainCam(true,true);else setTrainCam(true,false)});
      freeWp.appendChild(trainBtn);
      mapBtn=document.createElement('button');mapBtn.type='button';mapBtn.setAttribute('aria-pressed','false');
      mapBtn.textContent='Transit Map';
      mapBtn.addEventListener('click',function(){setMap(!flyMapOn)});
      freeWp.appendChild(mapBtn);
      rainBtn=document.createElement('button');rainBtn.type='button';rainBtn.setAttribute('aria-pressed','false');
      rainBtn.textContent='Monsoon';
      rainBtn.addEventListener('click',function(){setRain(!rainOn)});
      freeWp.appendChild(rainBtn);
      lapseBtn=document.createElement('button');lapseBtn.type='button';lapseBtn.setAttribute('aria-pressed','false');
      lapseBtn.textContent='Time-Lapse';
      lapseBtn.addEventListener('click',function(){setLapse(!lapseOn)});
      freeWp.appendChild(lapseBtn);
      var snapBtn=document.createElement('button');snapBtn.type='button';snapBtn.className='ff-snap';
      snapBtn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg><span>Postcard</span>';
      snapBtn.addEventListener('click',function(){capturePostcard(snapBtn)});
      freeWp.appendChild(snapBtn);
      parent.insertBefore(freeWp,freeTime.nextSibling);
      // Interactive KL Transit Map overlay (click any station to glide the drone right to it)
      flyMap=document.createElement('div');flyMap.className='fly-map';flyMap.setAttribute('role','region');flyMap.setAttribute('aria-label','Interactive Kuala Lumpur transit map');
      flyMap.innerHTML='<div class="fm-head"><b>KL Sky-Rail Live</b><span>Tap a station</span></div><canvas width="220" height="220"></canvas>';
      flyMapCv=flyMap.querySelector('canvas');
      flyMapCv.addEventListener('click',function(ev){
        var r=flyMapCv.getBoundingClientRect(),ux=(ev.clientX-r.left)*(220/Math.max(1,r.width)),uy=(ev.clientY-r.top)*(220/Math.max(1,r.height));
        var best=null,bd=24,sc=220/720;
        for(var s=0;s<STAT.length;s++){
          var sx2=110+(STAT[s].pos.x-GC[0])*sc,sy2=110+(STAT[s].pos.z-GC[1])*sc,dd=Math.hypot(ux-sx2,uy-sy2);
          if(dd<bd){bd=dd;best=STAT[s]}
        }
        if(best){setTrainCam(false);freeState.tcx=best.pos.x;freeState.tcz=best.pos.z;freeState.tcy=best.pos.y+4;freeState.tr=95;freeState.ty=best.pos.y+34;need=true}
      });
      parent.insertBefore(flyMap,freeWp.nextSibling);
      window.addEventListener('pointerdown',function(e){if(!freeOn)return;if(e.target&&e.target.closest&&e.target.closest('button,a,.tod,.fly-map'))return;if(trainCamOn)setTrainCam(false);freeDrag=true;freeLx=e.clientX;freeLy=e.clientY});
      window.addEventListener('pointermove',function(e){if(!freeOn||!freeDrag)return;var dx=e.clientX-freeLx,dy=e.clientY-freeLy;freeLx=e.clientX;freeLy=e.clientY;freeState.ta-=dx*.0055;freeState.ty=clamp(freeState.ty+dy*.45,12,420);need=true},{passive:true});
      window.addEventListener('pointerup',function(){freeDrag=false});
      window.addEventListener('wheel',function(e){if(!freeOn)return;e.preventDefault();freeState.tr=clamp(freeState.tr+e.deltaY*.22,60,520);need=true},{passive:false});
      window.addEventListener('keydown',function(e){if(!freeOn)return;if(e.key==='Escape'){e.preventDefault();setFree(false);return}
        var tg=e.target;if(tg&&(tg.tagName==='INPUT'||tg.tagName==='TEXTAREA'||tg.isContentEditable))return;
        if(e.key===' '||e.key==='PageDown'||e.key==='PageUp'||e.key==='Home'||e.key==='End'){e.preventDefault();return} // the page holds still while you fly
        var k=e.key.length===1?e.key.toLowerCase():e.key;if('wasdqe'.indexOf(k)>=0&&k.length===1||k==='ArrowLeft'||k==='ArrowRight'||k==='ArrowUp'||k==='ArrowDown'||k==='Shift'){fKeys[k]=true;e.preventDefault();need=true}});
      window.addEventListener('keyup',function(e){var k=e.key.length===1?e.key.toLowerCase():e.key;delete fKeys[k]});
      window.addEventListener('blur',function(){fKeys={}});
      window.addEventListener('touchmove',function(e){if(freeOn&&!(e.target.closest&&e.target.closest('button,a')))e.preventDefault()},{passive:false});
    }
  })()}
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
  // The opening shot fills the screen whatever its shape. On a wide screen the four landmarks stand in a row. On a tall one (a phone) a row would be tiny, with empty ground under it,
  // so the camera starts close to the ground and looks up at the towers. As the name card comes in it rises and pulls back to the group (cardPose).
  var TOPF=window.__topf||{r:234,dr:96,y:100,dy:-78,ty:85,dty:22,cx:-15,dcx:6,a0:1.3,span:.8,cr:560,cy:112,cty:80};
  // Behind the name card: on a wide screen the opening shot itself (no move); on a tall one the group of four from higher and farther back, though not so far that it is small.
  function cardPose(){var t=clamp((TOPF.a0-W/Math.max(1,Hh))/TOPF.span,0,1),p=topPose();if(t<=0)return p;var q=P(-15,-11,65,TOPF.cr,TOPF.cy,TOPF.cty,0,0,TOPF.cr);for(var i=0;i<9;i++)q[i]=p[i]+(q[i]-p[i])*t;q[8]=q[3];return q}
  function topPose(){var t=clamp((TOPF.a0-W/Math.max(1,Hh))/TOPF.span,0,1),r=TOPF.r+TOPF.dr*t;return P(TOPF.cx+TOPF.dcx*t,-11,65,r,TOPF.y+TOPF.dy*t,TOPF.ty+TOPF.dty*t,.1*(1-t),0,r)}
  var OVER=P(-15,-11,65,4,1250,0,0,0,4),RIDE_FROM=.88;               // OVER: straight down over the skyline. RIDE_FROM: the share of the descent's scroll at which the drone flight starts (where the clouds clear)
  var DIR=[
    ['top',0,0,function(){return topPose()}],                          // the opening: framed for the shape of the screen (see topPose)
    ['curtain',0,1.8,function(){return cardPose()}],                   // as the name card comes in (1.8 screens down, EST in extras.js): on a tall screen the camera has risen and pulled back to the whole group
    ['spin',0,-1,P(-95,-11,130,230,100,100,0,0,440)],                      // the buffer turns the city about 85 degrees
    ['spin',1,-1,P(-95,-11,150,250,100,100,0,0,390)],
    ['me',.2,-.5,P(-95,-11,150,250,100,100,0,0,390)],
    ['why',.5,-.5,P(-95,-91,190,290,100,100,0,0,550)],
    ['notes',.14,-.5,P(0,0,65,190,34,118,.22)],            // Notes: under the towers, looking up ...
    ['notes',.52,-.5,P(0,0,72,215,70,108,.22)],             // ... then climbing as you read
    ['notes',.9,-.5,P(0,0,82,250,110,92,.22)],
    ['studied',.14,-.5,function(){return UTP[utpIdx]}],   // UTP: the shot follows the group you pick
    ['studied',.9,-.5,function(){return UTP[utpIdx]}],
    // The shots at one landmark look at it from the side away from the group (bearing from the group's middle to the landmark), so the others stand behind it.
    ['merdekastage',.3,-.5,P(MER[0],MER[1],160,135,16,78,-.2)],  // a lead-in all of its own: the tower looming over its label
    ['toolkit',0,-.9,P(MER[0],MER[1],150,125,5,118,.03)],    // Skills: the camera is already on Merdeka Maybank when the heading arrives (the old first key sat after it, so the heading came up over the Petronas shot)
    ['toolkit',.1,-.5,P(MER[0],MER[1],150,125,5,118,.03)],    // Skills: Merdeka 118 between the two columns, base first ...
    ['toolkit',.38,-.5,P(MER[0],MER[1],175,300,95,96,.03)], // ... the whole building ...
    ['toolkit',.66,-.5,P(MER[0],MER[1],205,150,150,150,.03)],// ... the upper half ...
    ['toolkit',.92,-.5,P(MER[0],MER[1],235,240,215,172,.03)],// ... and the spire
    ['workstage',.3,-.5,P(KLT[0],KLT[1],215,205,72,66,.2)],// Work: Menara KL
    ['work',.5,-.5,P(KLT[0],KLT[1],255,215,82,66,.1)],
    ['pulse',.5,-.5,P(-95,-91,235,280,100,100,0,0,700)],
    ['journey',.1,-.5,P(EXC[0],EXC[1],300,78,8,76,-.22)], // Journey: The Exchange 106, climbing as the years go by
    ['journey',.3,-.5,P(EXC[0],EXC[1],335,118,96,122,-.22)],
    ['journey',.62,0,P(-25,9,60,360,190,70,0,0,900)],
    ['halcyon',.5,-.5,P(-25,9,60,360,190,70,0,0,900)],
    ['arcade',.5,-.5,P(-25,9,60,360,190,70,0,0,900)],                 // hold the pulled-back view while the arcade is on screen                 // pull right back (zoom out) ...
    // Front page (#descent): as the clouds clear, the city is seen from straight above the skyline, then the camera drops and tilts into the flight's first shot (END), so the descent runs on into the drone with no cut
    // The straight-down view is held from .6 to the place where the drone flight itself begins (RIDE_FROM of the descent, see homeGeo): from there the flight's own keyframes carry the camera (the first ones are this same pose), so nothing changes hands mid-move.
    ['descent',.6,0,OVER],
    ['descent',function(el){return RIDE_FROM*(el.offsetHeight-innerHeight)/el.offsetHeight},0,OVER],
    HOMEDS?null:['enter',0,-1,END]                                      // ... then in to where the flight starts (zoom in)                                     // the flight starts here
  ].filter(Boolean);
  var KEYS=[],eTop=0,eH=0,BUFV=.7; // BUFV: screens of hold at the end of #enter (see pinEnd)
  function mob(p){if(!mobile)return p;var q=p.slice(0,8);q[6]=0;if(p[8]){q[3]=p[8]}else{q[3]*=1.12;q[4]*=1.08}return q} // a portrait screen is only 0.49 of its height wide: a wide shot of the group stands much farther back there (p[8])
  function layoutKeys(){
    var vh=innerHeight,k=[];
    if(spin){sTop=spin.offsetTop;sH=spin.offsetHeight}
    eTop=enter?enter.offsetTop:0;eH=enter?enter.offsetHeight:0; // #enter's box, read here (load, resize, ResizeObserver) and not on every scroll or frame
    DIR.forEach(function(d){
      var y=0;
      if(d[0]!=='top'){var el=document.getElementById(d[0]);if(!el||el.offsetHeight===0)return;y=el.offsetTop+(typeof d[1]==='function'?d[1](el):d[1])*el.offsetHeight+d[2]*vh}
      k.push({y:Math.max(0,y),p:d[3]})});
    k.sort(function(u,v){return u.y-v.y});
    for(var i=1;i<k.length;i++)if(k[i].y<=k[i-1].y)k[i].y=k[i-1].y+1;
    GEO=homeGeo()||GEO;KEYS=k}
  function poseOf(k){var p=typeof k.p==='function'?k.p():k.p;return mob(p)}
  function dirPose(y){
    if(ONLY||!KEYS.length)return mob(END);
    if(y<=KEYS[0].y)return poseOf(KEYS[0]);
    for(var i=1;i<KEYS.length;i++){
      if(y<=KEYS[i].y){var a=poseOf(KEYS[i-1]),b=poseOf(KEYS[i]),t=(y-KEYS[i-1].y)/Math.max(1,KEYS[i].y-KEYS[i-1].y);t=t*t*(3-2*t);
        var o=[];for(var j=0;j<8;j++)o.push(a[j]+(b[j]-a[j])*t);return o}}
    return poseOf(KEYS[KEYS.length-1])}
  // The front page's drone flight starts inside the descent. homeGeo: st = where the ride starts (88 % through the descent), rv = where the sky stage has scrolled off and the city shows, s0 = top of #enter (the camera is level there, the drone proper), m = end of the ride.
  var USEPRE=HOMEDS&&DIST&&!!enter,GEO=null,CS0=0; // CS0: the ride's progress at the drone-level knot ('start'); 0 where the flight begins the ride (/flight/, /portfolio/)
  // the finale holds pinned for the last BUFV screens of #enter (a buffer before the next section slides in), so the end buttons
  // and free fly always get the whole stage
  function pinEnd(){return eTop+eH-innerHeight}
  function homeGeo(){var d=USEPRE&&document.getElementById('descent');if(!d||!enter||!d.offsetHeight)return null;var vh=innerHeight,sp=Math.max(0,d.offsetHeight-vh),g={st:d.offsetTop+RIDE_FROM*sp,rv:d.offsetTop+sp,s0:enter.offsetTop,m:enter.offsetTop+enter.offsetHeight-vh-BUFV*vh};return g.m>g.s0&&g.s0>g.rv-2&&g.rv>=g.st?g:null}
  function fr(c){return clamp((c-CS0)/Math.max(1e-6,1-CS0),0,1)} // the flight's own progress (0 at the drone-level knot, 1 at the end), what cr was before the descent was folded in
  function rideProg(){if(!enter)return 0;var m=ONLY?document.documentElement.scrollHeight-innerHeight:eTop+eH-innerHeight-BUFV*innerHeight,st=ONLY?0:eTop-(HOMEDS?0:innerHeight);if(GEO&&!ONLY){m=GEO.m;st=GEO.st}return m>st?Math.min(1,Math.max(0,(scrollY-st)/(m-st))):0}
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
  var PREL=false; // set by buildRide: the ride has the overhead opening in front of the flight
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
      KF=[];
      if(PREL){ // THE OVERHEAD OPENING (front page): the flight itself begins looking straight down over the skyline, holds there while the sky stage scrolls away, then falls and tips level into the first beat ('start').
        // Every knot keeps the same heading (the camera sits on a bearing from the skyline's middle and looks at it, bearing 65 degrees easing to 45), so the view tilts from straight down to level without ever passing through the vertical: no flip, no gimbal snap.
        [[65,4,1250,0],[65,4,1250,0],[62,30,900,10],[54,110,480,40],[49,175,250,70]].forEach(function(q,j){var c=poseCam(P(-15,-11,q[0],q[1],q[2],q[3],0,0,q[1]));KF.push(['ov'+j,c.pos,c.tgt,1,0])})}
      KF.push(['start',o.pos,o.tgt,.8,0]);
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
      for(i=0;i<nF;i++){f=i/nF;var th=(fTh0-fSw*(1-Math.pow(1-f,2.1)))*RAD,r=fR1+(fR0-fR1)*Math.pow(1-f,1.6),y=SK[0][0].y+(214-SK[0][0].y)*(1-Math.pow(f,1.7)), /* the turn round the tower comes first, while still high; then the height goes all at once, on a nearly straight line, so it reads as a fall and the turn limit does not slow it */ phi=26*RAD,Lh=60,pit=Math.atan(.9-.55*f);
        var cx=E.u+Math.cos(th)*r,cz=E.w+Math.sin(th)*r;
        KF.push([i?'e'+i:'e0',A(cx,cz,y),A(cx+Lh*(-Math.cos(phi)*Math.cos(th)+Math.sin(phi)*Math.sin(th)),cz+Lh*(-Math.cos(phi)*Math.sin(th)-Math.sin(phi)*Math.cos(th)),Math.max(0,y-Lh*Math.tan(pit))),i<nF-1?.5:1.0,1.2*Math.sin(f*Math.PI)]);
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
  var HOLD0=.86; // the flight itself uses the first 86 % of its scroll; the last 14 % holds the finale (with a slow drift). With the overhead opening buildRide recomputes it for the whole ride
  var KI={},SEG=null,CX=null,CM=null;
  function pchip(X,Y){ // monotone cubic through (X,Y): smooth speed, never runs backwards
    var n=X.length,h=[],d=[],m=[],i;for(i=0;i<n-1;i++){h[i]=X[i+1]-X[i];d[i]=(Y[i+1]-Y[i])/h[i]}
    m[0]=d[0];m[n-1]=0;
    for(i=1;i<n-1;i++){if(d[i-1]*d[i]<=0)m[i]=0;else{var w1=2*h[i]+h[i-1],w2=h[i]+2*h[i-1];m[i]=(w1+w2)/(w1/d[i-1]+w2/d[i])}}
    return function(x){if(x<=X[0])return Y[0];if(x>=X[n-1])return Y[n-1];var k=0;while(x>X[k+1])k++;
      var t=(x-X[k])/h[k],t2=t*t,t3=t2*t;return(2*t3-3*t2+1)*Y[k]+(t3-2*t2+t)*h[k]*m[k]+(-2*t3+3*t2)*Y[k+1]+(t3-t2)*h[k]*m[k+1]}}
  function buildRide(){
    GEO=homeGeo()||null;PREL=!!GEO;
    root.classList.toggle('home-ds',PREL); // front page: the drone's chrome is held back until html.drone-ready (scene.css)
    buildKF();var n=KF.length,i,nP=0;
    if(PREL)for(i=0;i<n;i++)if(KF[i][0]==='start'){nP=i;break}
    rideP=new T.CatmullRomCurve3(KF.map(function(k){return k[1]}),false,'centripetal');
    rideT=new T.CatmullRomCurve3(KF.map(function(k){return k[2]}),false,'centripetal'); // centripetal spline avoids tight-corner overshoot and keeps camera & look target smoothly in step
    // Scroll share of each stretch = its length x its slow factor, so the speed is even and slow where we want to look.
    // With the overhead opening (nP > 0) the stretches before 'start' get their own fixed share of the scroll (they are laid on the page: a hold while the sky stage scrolls away, then the fall), and the flight keeps the length it always had.
    var share=[],tot=0,a,b,k,len,sp=[],preSpan=0,Sf;
    HOLD0=.86;
    if(PREL){var R=GEO.m-GEO.st,Lf=GEO.m-GEO.s0;preSpan=(GEO.s0-GEO.st)/R;HOLD0=1-.14*Lf/R}
    Sf=HOLD0-preSpan;
    for(i=0;i<n-1;i++){len=0;var prev=rideP.getPoint(i/(n-1));for(k=1;k<=20;k++){var q=rideP.getPoint((i+k/20)/(n-1));len+=q.distanceTo(prev);prev=q}
      share[i]=len*KF[i][3];if(i>=nP)tot+=share[i]}
    if(DIST){ // a turn budget: a stretch where the view swings round gets at least enough scroll that the view turns no faster than ROT degrees per unit of scroll (6.5 degrees per 1/400 of it), whatever the slow factors say
      var ROT=2600,an=[],va=new T.Vector3(),vb=new T.Vector3(),it;
      for(i=nP;i<n-1;i++){va.copy(KF[i][2]).sub(KF[i][1]).normalize();vb.copy(KF[i+1][2]).sub(KF[i+1][1]).normalize();an[i]=Math.acos(clamp(va.dot(vb),-1,1))*180/Math.PI}
      for(it=0;it<8;it++){tot=0;for(i=nP;i<n-1;i++)tot+=share[i];for(i=nP;i<n-1;i++){var need=an[i]/ROT/Sf*tot;if(share[i]<need)share[i]=need}}
      tot=0;for(i=nP;i<n-1;i++)tot+=share[i]}
    for(i=nP;i<n-1;i++)sp[i]=share[i]/tot*Sf;
    if(nP){ // the overhead opening: segment 0 is the hold (until the sky stage has gone), the rest fall to the drone-level knot with a slightly slower arrival
      var hold=(GEO.rv-GEO.st)/R,fall=preSpan-hold,wsum=0,w=[];sp[0]=hold;
      for(i=1;i<nP;i++){w[i]=share[i]*(i>=nP-2?1.25:1);wsum+=w[i]}
      for(i=1;i<nP;i++)sp[i]=fall*w[i]/wsum}
    CX=[0];CM=[0];var acc=0;for(i=0;i<n-1;i++){acc+=sp[i];CX.push(acc);CM.push((i+1)/(n-1))}
    rideU=pchip(CX,CM);
    rollK=KF.map(function(k){return k[4]||0});
    KI={};KF.forEach(function(k,j){KI[k[0]]=CX[j]});
    CS0=nP?KI['start']:0;
    flightTabs();
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
    var iS=Math.min(NT-1,Math.ceil(CS0/HOLD0*NT-1e-6)),kS=smooth(kap,16),sS=smooth(spd,14),sorted=sS.slice(iS).sort(function(x,y){return x-y}),nS=sorted.length-1,lo=sorted[Math.floor(nS*.15)],hi=sorted[Math.floor(nS*.92)]; // iS: the first sample of the drone flight proper (the overhead fall before it has no bank and no lens stretch)
    for(i=0;i<=NT;i++){var pre=iS===0?1:i<iS?0:clamp((i-iS)/6,0,1);bankTab[i]=clamp(kS[i]*8,-.105,.105)*pre; // gentle cinema bank into turns, capped at ~12 deg
      var sp=clamp((sS[i]-lo)/Math.max(1e-6,hi-lo),0,1);fovTab[i]=i<iS?0:9*sp*sp*(3-2*sp)}
    bankTab[0]=0;bankTab[NT]=0;fovTab[NT]=0;for(i=iS;i<=iS+4&&i<=NT;i++)fovTab[i]=fovTab[i]*(i-iS)/4}
  function rollAt(u){return 0; /* no barrel roll: the owner tried it twice and turned it off twice. Do not turn it back on unless asked. The drone still banks into turns. */var n=rollK.length;if(n<2)return 0;var f=clamp(u,0,1)*(n-1),i=Math.min(n-2,Math.floor(f)),t=f-i;t=t*t*(3-2*t);return rollK[i]+(rollK[i+1]-rollK[i])*t}
  // ---- HUD (DOM) ----
  var hud=document.getElementById('hud'),hTags=[],hAlt=document.getElementById('h-alt'),hSec=document.getElementById('h-sec'),hFill=document.getElementById('h-fill'),hTicks=[],hLast=-1,hSecLast=-1;
  if(hud){var tg=hud.querySelector('.hud-tags');LM.forEach(function(l){var e=document.createElement('a');e.className='lm-tag';e.href=l.href||'/portfolio/';
    e.setAttribute('aria-label',l.name+' — '+(l.cta||'Explore'));
    e.innerHTML='<i class="lm-dot"></i><b></b><em class="lm-cta"></em><span></span>';
    e.querySelector('b').textContent=l.name;
    var cta=e.querySelector('.lm-cta');if(cta)cta.textContent=l.cta||'Explore ↗';
    e.addEventListener('pointerenter',function(){if(window.SFX&&SFX.tick)SFX.tick()});
    e.addEventListener('click',function(ev){
      if(window.SFX&&SFX.tick)SFX.tick();
      if(l.href==='\/#projects'){var pj=document.getElementById('projects');if(pj){ev.preventDefault();setFree(false);pj.scrollIntoView({behavior:reduce?'auto':'smooth'})}}
    });
    tg.appendChild(e);hTags.push(e)})}
  function hudBuild(){
    if(!hud)return;var rail=hud.querySelector('.hud-ticks');if(!rail)return;rail.textContent='';hTicks=[];
    for(var i=0;i<CAPS.length;i++){var e=document.createElement('li');e.style.top=(clamp((KI[CAPS[i][0]]-CS0)/(HOLD0-CS0),0,1)*100)+'%';e.innerHTML='<i></i><b>'+('0'+(i+1)).slice(-2)+'</b>';rail.appendChild(e);hTicks.push(e)}}
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
    cp.rec=w.querySelector('#cp-rec');cp.batt=w.querySelector('#cp-batt');cp.bat=w.querySelector('#cp-bat');cp.gps=w.querySelector('#cp-gps');if(klWx&&cp.gps)cp.gps.textContent=klWx;cp.ready=true}
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
      var f=clamp((c-CS0)/(HOLD0-CS0),0,1),sec=Math.round(f*150),bat=Math.round(100-42*f);
      cp.rec.textContent='REC '+('0'+Math.floor(sec/60)).slice(-2)+':'+('0'+sec%60).slice(-2);cp.bat.textContent=bat+'%';cp.batt.style.transform='scaleX('+(bat/100).toFixed(2)+')'}}
  var tv=new T.Vector3();
  function hudUpdate(inRide,u,c){
    if(!hud)return;var on=inRide&&(ONLY||flying); /* only once the flight section fills the screen, not while the last Journey cards are still showing */
    // Front page: nothing of the drone's chrome (picker, skip link, gauges, labels) shows while the camera is still coming down from the overhead view. Once it has levelled into the drone angle html.drone-ready fades it all in (scene.css, timeofday.css), with a little hysteresis so it cannot flicker at the edge.
    if(on&&USEPRE&&CS0>0)on=c>=CS0-(droneReady?.012:0);
    if(on!==droneReady){droneReady=on;root.classList.toggle('drone-ready',on);if(on&&HOMEDS&&USEPRE){try{document.dispatchEvent(new CustomEvent('sfx-cue',{detail:{name:'flight-start'}}))}catch(e){}}}
    hud.classList.toggle('on',on);if(!on){cpPrev=null;return}
    if(!cp.ready)cockpitBuild();cockpitUpdate(c,performance.now());
    hFill.style.transform='scaleY('+clamp((c-CS0)/(HOLD0-CS0),0,1).toFixed(4)+')';
    var alt=Math.round(cam.position.y*KU/5)*5;if(alt!==hLast){hLast=alt;hAlt.textContent=alt}
    var sec=0;for(var i=0;i<caps.length;i++)if(c>=+caps[i].dataset.from)sec=i;
    if(sec!==hSecLast){hSecLast=sec;var b=caps[sec]&&caps[sec].querySelector('b');hSec.textContent=b?b.textContent:'';for(i=0;i<hTicks.length;i++)hTicks[i].classList.toggle('on',i<=sec)}
    var ph=W<=700,best=-1,bd=9,vs=[],px_=[],py_=[],ds_=[]; // phones: only the landmark nearest the screen centre keeps its tag, and it stays clear of the compass strip, the Hide HUD button and the caption card
    for(var k=0;k<LM.length;k++){
      tv.copy(LM[k].top);var dist=tv.distanceTo(cam.position);tv.project(cam);
      var yy=(.5-tv.y*.5)*Hh;
      var vis=tv.z<1&&Math.abs(tv.x)<.94&&Math.abs(tv.y)<.9&&yy>(ph?156:mobile?100:116)&&(!ph||yy<Hh-170)&&dist>24&&dist<760; /* a label never rides up into the compass strip at the top */
      vs[k]=vis;ds_[k]=dist;px_[k]=tv.x;py_[k]=tv.y;
      if(ph&&vis){var dd=tv.x*tv.x+tv.y*tv.y;if(dd<bd){bd=dd;best=k}}}
    for(k=0;k<LM.length;k++){
      var e=hTags[k],sv=ph?k===best:vs[k];
      if(sv!==e.classList.contains('show'))e.classList.toggle('show',sv);
      if(sv){e.style.transform='translate3d('+((px_[k]*.5+.5)*W).toFixed(1)+'px,'+((-py_[k]*.5+.5)*Hh).toFixed(1)+'px,0)';
        var fl=ph&&px_[k]>0;if(fl!==e.classList.contains('flip'))e.classList.toggle('flip',fl); // near the right edge the label hangs to the left of its pin
        if(tick%8===0){var sp=e.querySelector('span');if(sp)sp.textContent=Math.round(LM[k].real)+' m · '+Math.round(ds_[k]*KU/10)*10+' m away'}}}}
  var tick=0,droneReady=false;
  // the lead-in sections show their label while they are on screen
  if('IntersectionObserver' in window){var stObs=new IntersectionObserver(function(es){es.forEach(function(e){e.target.classList.toggle('on',e.isIntersecting&&e.intersectionRatio>.55)})},{threshold:[0,.55,1]});document.querySelectorAll('.stage').forEach(function(el){stObs.observe(el)})}
  function ringUpdate(){} // the screens that floated behind the towers (ring, then conveyor) were removed; see docs/claude-log.md
  var flying=false;
  // ONE CAMERA. Above, the director (before the flight) and the flight (inside #enter) each only say where the camera should be.
  // This follower is the only thing that actually moves it: position, rotation, lens and the sideways push all chase their target
  // with the same short lag and a top speed, so a change between the two systems (or anything else) can never show as a snap.
  var fInit=true,fP=new T.Vector3(),fQ=new T.Quaternion(),fF=42,fX=0,fY=0,fD=new T.Vector3();
  var baseRailO2=.32,baseGyroO=.45,audBuf=null;
  function audioReact(){
    if(reduce||!window.SFX||!SFX.on||!SFX.analyser)return;
    var an=SFX.analyser();if(!an)return;
    if(!audBuf||audBuf.length!==an.frequencyBinCount)audBuf=new Uint8Array(an.frequencyBinCount);
    an.getByteFrequencyData(audBuf);
    var lo=0,hi=0,i;
    for(i=0;i<8&&i<audBuf.length;i++)lo+=audBuf[i];
    for(i=16;i<32&&i<audBuf.length;i++)hi+=audBuf[i];
    var bass=lo/(8*255),treb=hi/(16*255);
    railM2.opacity=clamp(baseRailO2+bass*.32,0,1);
    gyroM.opacity=clamp(baseGyroO+treb*.35,0,1);
  }
  function followCam(dt){
    var vo=cam.view,ox=vo&&vo.enabled?vo.offsetX:0,oy=vo&&vo.enabled?vo.offsetY:0;
    if(fInit||reduce){fP.copy(cam.position);fQ.copy(cam.quaternion);fF=cam.fov;fX=ox;fY=oy;fInit=false;return}
    var k=1-Math.exp(-dt*5.4),L=fD.copy(cam.position).sub(fP).length();
    if(L>1e-6)fP.addScaledVector(fD,Math.min(L*k,700*dt)/L);
    fQ.slerp(cam.quaternion,k);fF+=(cam.fov-fF)*k;fX+=(ox-fX)*k;fY+=(oy-fY)*k;
    cam.position.copy(fP);cam.quaternion.copy(fQ);
    if(Math.abs(fF-cam.fov)>.005){cam.fov=fF;cam.updateProjectionMatrix()}
    cam.setViewOffset(W,Hh,fX,fY,W,Hh)}
  function place(time){
    if(enter){var eEnd=eTop+eH-innerHeight+40,pc=scrollY>=eTop-40&&scrollY<=eEnd,pin=GEO?scrollY>=GEO.st-40&&scrollY<=eEnd:pc;if(pin!==flying)flying=pin;if(pc!==root.classList.contains('flying'))root.classList.toggle('flying',pc)} // html.flying hides the dock while the captions are on screen; `flying` itself (the drone's rules: speed limit, idle drift) starts with the ride, inside the descent
    var inRide=cr>.0004&&!!rideP;
    var fc=fr(cr),rMid=inRide&&!freeOn&&fc>.05&&fc<.9;if(rMid!==root.classList.contains('ride-mid'))root.classList.toggle('ride-mid',rMid); // the view picker steps aside mid-flight so the landmark labels at the top of the HUD stay readable (timeofday.css)
    if(freeOn){
      if(lapseOn&&!reduce){
        lapsePhase=(lapsePhase+dtF*.05)%2;
        ST.set(lapsePhase<=1?lapsePhase*2:(2-lapsePhase)*2);
        if(!freeDrag&&!trainCamOn)freeState.ta+=dtF*.16;
      }
      if(trainCamOn&&trains[trainCamIdx]){
        // Train-Cam ("Ride the Sky-Rail"): perch just above the lead cab looking forward along the viaduct through the glowing portal arches
        var trR=trains[trainCamIdx];
        if(fKeys.w||fKeys.a||fKeys.s||fKeys.d){setTrainCam(false)}
        else{
          cam.position.copy(trR.headP).addScaledVector(trR.headT,-2.8);cam.position.y+=3.4;
          tgtV.copy(trR.headP).addScaledVector(trR.headT,46);tgtV.y+=1.4;
          cam.lookAt(tgtV);
          cam.setViewOffset(W,Hh,0,0,W,Hh);
        }
      }
      if(!trainCamOn){
        // WASD: move the point the camera circles (and the camera with it) along the ground, relative to where it faces; Q/E down and up; arrows turn and tilt; Shift is faster
        var fsp=(fKeys.Shift?260:120)*Math.min(dtF,.05),fwx=freeState.cx-cam.position.x,fwz=freeState.cz-cam.position.z,fl=Math.hypot(fwx,fwz)||1;fwx/=fl;fwz/=fl;
        var mf=(fKeys.w?1:0)-(fKeys.s?1:0)+(fKeys.ArrowUp&&false?1:0),ms=(fKeys.d?1:0)-(fKeys.a?1:0);
        if(mf||ms){var nx=freeState.tcx+(fwx*mf-fwz*ms)*fsp,nz=freeState.tcz+(fwz*mf+fwx*ms)*fsp,rr=Math.hypot(nx-GC[0],nz-GC[1]);if(rr>620){nx=GC[0]+(nx-GC[0])*620/rr;nz=GC[1]+(nz-GC[1])*620/rr}freeState.tcx=freeState.cx=nx;freeState.tcz=freeState.cz=nz}
        if(fKeys.q||fKeys.e){var dv=((fKeys.e?1:0)-(fKeys.q?1:0))*(fKeys.Shift?160:80)*Math.min(dtF,.05);freeState.ty=clamp(freeState.ty+dv,12,420);freeState.tcy=freeState.cy=clamp(freeState.tcy+dv*.6,0,300)}
        if(fKeys.ArrowLeft||fKeys.ArrowRight)freeState.ta+=((fKeys.ArrowLeft?1:0)-(fKeys.ArrowRight?1:0))*1.4*Math.min(dtF,.05);
        if(fKeys.ArrowUp||fKeys.ArrowDown)freeState.tr=clamp(freeState.tr+((fKeys.ArrowDown?1:0)-(fKeys.ArrowUp?1:0))*220*Math.min(dtF,.05),60,520);
        var fk=reduce?1:1-Math.exp(-dtF*6.5);
        freeState.cx+=(freeState.tcx-freeState.cx)*fk;
        freeState.cz+=(freeState.tcz-freeState.cz)*fk;
        freeState.cy+=(freeState.tcy-freeState.cy)*fk;
        freeState.a+=(freeState.ta-freeState.a)*fk;
        freeState.y+=(freeState.ty-freeState.y)*fk;
        freeState.r+=(freeState.tr-freeState.r)*fk;
        cam.position.set(freeState.cx+Math.cos(freeState.a)*freeState.r,freeState.y,freeState.cz+Math.sin(freeState.a)*freeState.r);
        cam.lookAt(freeState.cx,freeState.cy,freeState.cz);
        cam.setViewOffset(W,Hh,0,0,W,Hh);
      }
      if(scene.fog){scene.fog.near=fogN0+(rainOn?40:260);scene.fog.far=fogF0+(rainOn?-220:560)}
      hudUpdate(true,1,1);
    } else if(inRide){
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
          skyCurve.getPointAt(((heroS-56/skyLen)%1+1)%1,chP);chP.y-=11;chP.addScaledVector(chS,6*Math.sin((time||0)*.0009)); // 40 units behind the train along the rail (not along its tangent, so a bend in the rail turns the view gradually), 24 below it
          skyCurve.getPointAt((heroS+50/skyLen)%1,chL);chL.y-=1;                                                              // looking 90 units ahead along the rail
          cam.position.lerp(chP,cw);tgtV.lerp(chL,cw)}}else if(cwA!=null&&cwB!=null){heroS=cr>=cwB?chB:chA}
      cam.lookAt(tgtV);cam.setViewOffset(W,Hh,0,0,W,Hh);
      // finale: widen the view (phones a lot, desktop a little) and push the fog back, so the whole skyline is in frame
      var ke=KI['sweep1']!=null?KI['sweep1']:(KI['pass']!=null?KI['pass']:.7),ke2=KI['end']||HOLD0,fs=clamp((cr-ke-.4*(ke2-ke))/(.6*(ke2-ke)),0,1);fs=fs*fs*(3-2*fs);
      var kk=Math.sin(Math.PI*clamp((cr-CS0)/.07,0,1)),fv=42+(mobile?30:10)*fs+26*kk*kk+(reduce?0:tabAt(fovTab,cr)*(1-fs)*(1-kk*kk)); /* speed feel: up to +9 degrees of lens in the fast beats, none at the start, in the finale or in reduced motion */ /* kk: a gentle push-in that starts and ends at the normal lens, so entering the flight never snaps */if(Math.abs(fv-cam.fov)>.01){cam.fov=fv;cam.updateProjectionMatrix()}
      if(scene.fog){scene.fog.near=fogN0+260*fs;scene.fog.far=fogF0+560*fs}
      // Ease the rotation: the view turns towards where it should look with a short lag (time constant about 0.25 s), so a sharp
      // turn in the route can never show as a jolt. Reset when the flight starts, and when snapping.
      if(!rideQ)rideQ=cam.quaternion.clone();else{rideQ.slerp(cam.quaternion,reduce?1:1-Math.exp(-dtF*4.0));cam.quaternion.copy(rideQ)}
      // lean into turns like a drone: the bank follows the path's horizontal curvature (table made in buildRide, at most 12 degrees), eased; none in reduced motion
      roll+=((reduce?0:tabAt(bankTab,cr))-roll)*(1-Math.exp(-dtF*3));cam.rotateZ(roll*(1-fs)+rollAt(u)); // drone bank into turns, the scripted barrel roll, and a level horizon for the finale
      hudUpdate(true,u,cr)
    }else{
      rideQ=null;heroOn=false;heroS=chA;if(cam.fov!==42){cam.fov=42;cam.updateProjectionMatrix()}if(scene.fog){scene.fog.near=fogN0;scene.fog.far=fogF0}
      var q=curPose,ang=(q[2]+px*7+idleK*3*Math.sin(time*.000314))*Math.PI/180,rk=1+idleK*.014*Math.sin(time*.00024); /* idle drift: a few degrees of swing over about 20 s and a slow breath in and out */
      cam.position.set(q[0]+Math.cos(ang)*q[3]*rk,q[4],q[1]+Math.sin(ang)*q[3]*rk);cam.lookAt(q[0],q[5],q[1]);
      cam.setViewOffset(W,Hh,-q[6]*W,-q[7]*Hh,W,Hh);hudUpdate(false)
    }
    followCam(dtF);
    for(var ci=0;ci<caps.length;ci++){var c=caps[ci],on=cr>=+c.dataset.from&&cr<+c.dataset.to;if(on!==c.classList.contains('on'))c.classList.toggle('on',on)}
    if(again){if(DBGCR)again.dataset.cr=cr.toFixed(3);var aOn=(inRide&&fc>.93&&(ONLY||scrollY<=pinEnd()-2))||freeOn;if(aOn!==again.classList.contains('on')){again.classList.toggle('on',aOn);document.documentElement.classList.toggle('fly-end',aOn);if(aOn&&inRide&&window.FlightLog)window.FlightLog.unlock('flight')}if(freeBtn&&aOn!==freeBtn.classList.contains('on'))freeBtn.classList.toggle('on',aOn)}
    if(spin&&sH){var sy=scrollY-(sTop-innerHeight),sf=sy/Math.max(1,sH),sOn=sf>.18&&sf<.95;if(sOn!==spin.classList.contains('on'))spin.classList.toggle('on',sOn)} // the coordinates tag
    ringUpdate(time,inRide);
    orb.rotation.y=time*.0004;ring.rotation.z=time*.0006;orb.position.y=230+Math.sin(time*.0009)*3;
    specks.rotation.y=time*.00003;fxUpdate(time,reduce);sciUpdate(time,reduce,inRide);rainUpdate(dtF);audioReact();drawTransitMap(time)}
  var raf=0,run=true,last=0,lastR=0;
  function snap(){fInit=true;rideQ=null;curPose=tgtPose.slice();cr=tr;px=tx;vr.v=vx.v=0;vPose.forEach(function(v){v.v=0})}
  var shown=false; // the canvas fades in once it has drawn (scene.css, html.gl-on)
  function perfWatch(dt){
    if(reduce||document.hidden||!shown)return;
    PERF.emaDt=PERF.emaDt*.92+dt*.08;
    if(PERF.emaDt>.031){
      PERF.goodFrames=0;
      if(++PERF.badFrames>45&&PERF.degraded<2){
        PERF.badFrames=0;PERF.degraded++;
        if(PERF.degraded===1){PERF.dprCap=Math.max(.85,PERF.dprCap*.8);if(trailInst)trailInst.visible=false;PERF.simSkip=2;size()}
        else if(PERF.degraded===2){PERF.dprCap=.78;size()}
      }
    }else if(PERF.emaDt<.020){PERF.badFrames=0}
  }
  function frame(time){
    var dt=clamp((time-last)/1000,.001,.05);last=time;dtF=dt;tick++;
    if(reduce)snap();else{for(var j=0;j<8;j++)curPose[j]=damp(curPose[j],tgtPose[j],vPose[j],.55,dt);var cr0=cr;cr=clamp(damp(cr,tr,vr,.86,dt),0,1);if(flying){var cap=.085*dt;if(cr-cr0>cap){cr=cr0+cap;vr.v=Math.min(vr.v,cap/dt)}else if(cr0-cr>cap){cr=cr0-cap;vr.v=Math.max(vr.v,-cap/dt)}} /* speed limit: a fast flick can't whip the camera */px=damp(px,tx,vx,.6,dt)}
    // Idle drift: in the drone flight, when the reader has stopped scrolling, the page creeps forward by itself so slow scrolling never shows as a stutter.
    if(flying&&!freeOn&&enter&&!reduce&&!document.hidden&&time-lastUser>900&&scrollY>=(GEO?GEO.rv:0)&&scrollY<eTop+eH-innerHeight-6){
      driftAcc+=(mobile?20:28)*clamp((time-lastUser-900)/1500,0,1)*dt;
      if(driftAcc>=1){var dy=Math.floor(driftAcc);driftAcc-=dy;scrollBy({top:dy,behavior:'instant'})}}
    // Background drift: when the reader is idle outside the flight, the camera slowly swings and breathes (the page itself never moves),
    // drawn at 30 fps. It switches itself off for the session if the device can't keep that up, and never runs with reduced motion,
    // a hidden tab, the flight (which has its own drift) or the text-only brief.
    var dOn=!reduce&&!flying&&!driftOff&&!document.hidden&&!root.classList.contains('brief')&&time-lastUser>900;
    idleK+=((dOn?1:0)-idleK)*Math.min(1,dt*(dOn?.8:4));
    if(idleK<.002)idleK=0;
    var arcOn=root.classList.contains('arc-on'),iv=arcOn?125:idleK>0?33:66; // arc-on: a game in the arcade is running, so the city steps back to ~8 fps and leaves the frame budget to the game
    if(tDirty){tDirty=false;applyTime(ST.get())} // the time of day changed (SceneTime): blend the three parameter sets, once per frame at most
    var moving=freeOn||Math.abs(tr-cr)>(flying?.00002:.0003);for(var j2=0;j2<8;j2++)if(Math.abs(tgtPose[j2]-curPose[j2])>.02){moving=true;break}
    // While the reader is only reading, redraw at about 15 fps (the beams and pulses still drift); while scrolling, every frame.
    if(moving||need||(!reduce&&time-lastR>iv)){if(moving)perfWatch(dt);if(idleK>0&&!moving&&lastR>0&&!arcOn){dIv+=time-lastR;if(++dN>=90){if(dIv/dN>48)driftOff=true;dIv=0;dN=0}}place(reduce?0:time);renderer.render(scene,cam);need=false;lastR=time;if(!shown){shown=true;root.classList.add('gl-on');startLater()}}
    raf=run?requestAnimationFrame(frame):0}
  var lastUser=0,driftAcc=0,idleK=0,driftOff=false,dIv=0,dN=0;
  ['wheel','touchstart','touchmove','keydown','pointerdown'].forEach(function(n){addEventListener(n,function(){lastUser=performance.now();driftAcc=0},{passive:true})});
  function retarget(){tgtPose=dirPose(scrollY);tr=rideProg();need=true}
  // One scroll dispatcher (assets/scrollbus.js) when present. Layout keys are re-measured when the page's size changes (ResizeObserver), not by reading scrollHeight on every scroll.
  var SB=window.ScrollBus||{read:function(f){addEventListener('scroll',f,{passive:true})},move:function(f){addEventListener('pointermove',f,{passive:true})}};
  SB.read(retarget);
  if(window.ResizeObserver)new ResizeObserver(function(){layoutKeys();retarget()}).observe(document.body)
  // the UTP coverflow says which group is in front; the shot follows it
  document.addEventListener('cf-change',function(e){if(e.target&&e.target.closest&&e.target.closest('#studied')){utpIdx=Math.max(0,Math.min(UTP.length-1,e.detail.index|0));retarget()}});
  addEventListener('load',function(){layoutKeys();retarget()});
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){layoutKeys();retarget()});
  addEventListener('resize',function(){if(W<=820&&innerWidth===W&&Math.abs(innerHeight-Hh)<180)return;size();buildRide();layoutKeys();retarget()});
  SB.move(function(e){tx=e.clientX/innerWidth-.5});
  document.addEventListener('visibilitychange',function(){run=!document.hidden;if(run&&!raf){last=performance.now();raf=requestAnimationFrame(frame)}});
  setTimeout(function(){(window.requestIdleCallback||setTimeout)(warmEdges)},12000); // light theme: build the night lines in idle time, so the first switch to dark has them ready
  root.classList.add('gl'); // first: it makes #enter visible, and the scroll maths below needs its real position
  size();buildRide();layoutKeys();tgtPose=dirPose(scrollY);curPose=tgtPose.slice();tr=cr=rideProg();raf=requestAnimationFrame(frame);
  if(ONLY||/[?&]dbg/.test(location.search))window.__scene={TU:TU,sunG:function(){return sunG},SUND:SUND,applyTime:applyTime,hero:function(){var q=new T.Vector3();skyCurve.getPointAt(heroS,q);var v=q.clone().project(cam);return [heroS,heroOn,Math.round(q.distanceTo(cam.position)),+v.x.toFixed(2),+v.y.toFixed(2),+v.z.toFixed(2)]},drift:function(v){if(v===false)driftOff=false;return [Math.round(idleK*100)/100,driftOff]},keys:function(){return KEYS.map(function(k){return k.y})},dirPose:dirPose,scene:scene,cam:cam,g:g,rideP:rideP,rideT:rideT,rideU:function(c){return rideU(c)},snap:snap,place:place,KF:KF,KI:function(){return KI},render:function(){renderer.render(scene,cam)},set:function(c){tr=c;cr=c;vr.v=0},pause:function(){run=false;cancelAnimationFrame(raf);raf=0},lay:LAY,lm:LM,utp:UTP,sky:skyCurve,city:function(){return cityMesh},mob:mob,DIST:DIST,draw:function(c,t){tr=c;cr=c;vr.v=0;tick=0;fInit=true;rideQ=null;dtF=9;place(t||0);renderer.render(scene,cam);tick=0;place(t||0);renderer.render(scene,cam);dtF=.016}};
  } // start
  // Build the scene after the page's first paint, not before it: the curtain's text and photos come first, the canvas fades in after. (/flight/ is only the scene, so it starts at once.)
  if(!DEFER)start();
  else{
    var go=function(){setTimeout(function(){(window.requestIdleCallback||function(f){f()})(start,{timeout:600})},0)};
    if(document.readyState==='complete')go();else addEventListener('load',go,{once:true});
  }
})();
