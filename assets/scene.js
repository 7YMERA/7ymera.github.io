/* KLCC in WebGL. The camera orbits the towers as the page scrolls. three.js comes from cdnjs. */
(function(){
  if(!window.THREE)return;
  var T=THREE,root=document.documentElement,cv=document.getElementById('gl');
  // Where this script lives (assets/), so the models load from any page, whatever its folder.
  var BASE=(((document.currentScript||document.querySelector('script[src*="scene.js"]')||{}).src)||'').replace(/scene\.js.*$/,'');
  // data-flight-only on <html> (the /flight/ page): no orbit phase and no page around it, just the flight, driven by scroll.
  var ONLY=root.hasAttribute('data-flight-only');
  // ?bg=district: the compact one-mesh KLCC district (assets/city/klcc_district.json, tools/convert-klcc-dae.js) replaces the OSM city and the four landmark models.
  var DIST=!/[?&]bg=osm/.test(location.search); // the district is the map; ?bg=osm swaps in the OpenStreetMap city. In the district, the landmarks are the hand-made models, not the district's own blocky ones.
  var renderer;
  try{renderer=new T.WebGLRenderer({canvas:cv,alpha:true,antialias:true,powerPreference:'low-power'})}catch(e){return}
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var scene=new T.Scene(),cam=new T.PerspectiveCamera(42,1,.3,1600);
  var M={},C={},mats=[];
  function css(n){return getComputedStyle(root).getPropertyValue(n).trim()}
  function col(k){return new T.Color(C[k])}
  function readColors(){C.line=css('--fx');['far','mid','near','glass','orb','ring','sky1','sky2'].forEach(function(k){C[k]=css('--'+k)})}
  readColors();
  function mat(role,opts){var m=new T.MeshLambertMaterial(Object.assign({flatShading:true},opts||{}));m.userData.role=role;mats.push(m);return m}
  function bands(){var c=document.createElement('canvas');c.width=8;c.height=64;var x=c.getContext('2d');x.fillStyle='#000';x.fillRect(0,0,8,64);x.fillStyle='#fff';x.fillRect(0,50,8,6);
    var t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;return t}
  var tex=bands();
  var tower=mat('near',{emissiveMap:tex,emissive:0xffffff}),towerB=mat('near'),podium=mat('mid'),city=mat('mid'),cityF=mat('far'),ground=mat('mid'),glassM=mat('ring',{emissive:0xffffff,emissiveIntensity:.5});
  var orbM=mat('orb'),ringM=new T.MeshBasicMaterial({color:C.ring});
  var amb=new T.AmbientLight(0xffffff,.75),sun=new T.DirectionalLight(0xffffff,.8);sun.position.set(80,140,60);scene.add(amb,sun);
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
  var bodyM=mat('near',{side:T.DoubleSide}),glassModelM=mat('ring',{side:T.DoubleSide,emissive:0xffffff,emissiveIntensity:.3});
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
  loadModel(BASE+'city/klcc.json',0,0,0,bodyM,procedural);          // Petronas Twin Towers (SketchUp export, see tools/convert-obj.py)
  loadModel(BASE+'city/menara_kl.json',-95,-70,0,bodyM,null,function(){g.remove(kl)}); // Menara KL; replaces the stand-in cylinder tower below once loaded
  loadModel(BASE+'city/merdeka118.json',-10,-95,-.5,bodyM,null);
  loadModel(BASE+'city/exchange106.json',60,-125,.4,bodyM,null);   // The Exchange 106, cropped and simplified (tools/convert-dae-crop.py)  // Merdeka PNB 118 (SketchUp Collada, see tools/convert-dae.py)
  }
  // In the district, the two landmarks baked into its mesh were welded coarsely and have holes: draw the full-detail models over them (1 % larger, so they sit just outside).
  if(DIST){loadModel(BASE+'city/klcc.json',0,0,0,bodyM,null);loadModel(BASE+'city/merdeka118.json',-217.4,303.3,-.5,bodyM,null);loadModel(BASE+'city/exchange106.json',157.4,304.7,.4,bodyM,null)}
  var gr=new T.Mesh(new T.CircleGeometry(1400,64),ground);gr.rotation.x=-Math.PI/2;gr.position.y=-.2;g.add(gr);
  // city ring
  var s=11;function rnd(){s=(s*9301+49297)%233280;return s/233280}
  var i;
  // The city: real OpenStreetMap buildings of central Kuala Lumpur (tools/convert-city.py), centred on KLCC, standing on a plain themed ground.
  // Windows come from two facade textures laid on the walls in the shader: a glass grid by day, lit offices at night.
  var loader=new T.TextureLoader();
  function wrapTex(t){t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;return t}
  var cityU={uNight:{value:0},uDay:{value:wrapTex(loader.load(BASE+'city/facade_glass.jpg'))},uNightTex:{value:wrapTex(loader.load(BASE+'city/facade_night.jpg'))}};
  // Facade shader: windows on the walls, in world space, so every building (the OSM city and the landmark models alike) shows its floors.
  function facade(m){
    m.onBeforeCompile=function(sh){
      sh.uniforms.uNight=cityU.uNight;sh.uniforms.uDay=cityU.uDay;sh.uniforms.uNightTex=cityU.uNightTex;
      sh.vertexShader=sh.vertexShader.replace('void main() {','varying vec3 vWP;\nvoid main() {').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\n vWP=(modelMatrix*vec4(transformed,1.0)).xyz;');
      sh.fragmentShader=sh.fragmentShader.replace('void main() {','varying vec3 vWP;uniform sampler2D uDay;uniform sampler2D uNightTex;uniform float uNight;\nvoid main() {')
        .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        vec3 fn=normalize(cross(dFdx(vWP),dFdy(vWP)));
        float wall=1.0-smoothstep(0.45,0.75,abs(fn.y));
        vec2 fuv=(abs(fn.z)>abs(fn.x)?vWP.xy:vWP.zy)/6.0;
        float dl=dot(texture2D(uDay,fuv).rgb,vec3(0.333));
        diffuseColor.rgb*=mix(1.0,clamp(dl*1.9,0.0,1.3),wall*0.75);
        totalEmissiveRadiance+=texture2D(uNightTex,fuv).rgb*wall*uNight*1.25;`)};
    return m}
  var cityM=facade(mat('mid',DIST?{side:T.DoubleSide}:{}));
  facade(bodyM); // all four landmarks share one material and the facade shader, so none is bluer than the rest
  var cityMesh=null;
  fetch(BASE+(DIST?'city/klcc_district.json':'city/kl_city.json')).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(d){
    var q=new Int16Array(b64(d.positions,Uint8Array).buffer),pos=new Float32Array(q.length);for(var k=0;k<q.length;k++)pos[k]=q[k]*d.scale;
    var geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(pos,3));var ix=b64(d.indices,Uint16Array);
    if(DIST){ // cut the district's own versions of the four landmarks out of the mesh (metres from the Petronas midpoint: x east, z south); the hand-made models stand there instead
      var CUT=[[0,0,150],[-730,1020,200],[530,1026,125]],keep=[];
      for(var t=0;t<ix.length;t+=3){var ia=ix[t]*3,ib=ix[t+1]*3,ic=ix[t+2]*3,mx=(pos[ia]+pos[ib]+pos[ic])/3,mz=(pos[ia+2]+pos[ib+2]+pos[ic+2])/3,cut=false;
        for(var c=0;c<CUT.length;c++){var dx=mx-CUT[c][0],dz=mz-CUT[c][1];if(dx*dx+dz*dz<CUT[c][2]*CUT[c][2]){cut=true;break}}
        if(!cut)keep.push(ix[t],ix[t+1],ix[t+2])}
      ix=new Uint16Array(keep)}
    geo.setIndex(new T.BufferAttribute(ix,1));
    geo=geo.toNonIndexed();geo.computeVertexNormals(); // flat normals: the lighting needs them
    cityMesh=new T.Mesh(geo,cityM);cityMesh.scale.setScalar(SC);g.add(cityMesh);need=true;
  }).catch(function(){});
  // KL Tower
  var kl=new T.Group();kl.position.set(-95,0,-70);
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
    {name:'Petronas Twin Towers',real:452,top:new T.Vector3(0,134,0)},
    {name:'Merdeka PNB 118',real:679,top:new T.Vector3(-6,194,-102)},
    {name:'Menara Kuala Lumpur',real:421,top:new T.Vector3(-95,130,-70)},
    {name:'The Exchange 106',real:445,top:new T.Vector3(61,136,-132)}];
  if(DIST){LM[1].top.set(-217,194,303);LM[2].top.set(-221,127,181);LM[3].top.set(157,132,304)} // the district model puts the landmarks just south of the district, at 60 % of their real offsets
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
  // Stars, a moon with a ring and a small moon of its own, gyroscope rings round the Petronas and Merdeka crowns, and a dragon:
  // a serpentine ribbon of light that loops over the skyline. All are cheap (points, thin rings, one textured sphere); the stars and moons
  // follow the camera's bearing so they are always the backdrop behind the city, whichever way the shot looks.
  var sci=new T.Group();scene.add(sci);
  var SMALL=innerWidth<=820;
  // -- stars
  var starGeo=new T.BufferGeometry(),starPos=[],SN=SMALL?420:900;
  for(var si=0;si<SN;si++){var sa=Math.random()*6.2832,se=Math.acos(1-Math.random()*.92),sr=1150;starPos.push(Math.sin(se)*Math.cos(sa)*sr,Math.cos(se)*sr*.8+60,Math.sin(se)*Math.sin(sa)*sr)}
  starGeo.setAttribute('position',new T.Float32BufferAttribute(starPos,3));
  var starM=new T.PointsMaterial({size:SMALL?2.4:2,sizeAttenuation:false,transparent:true,depthWrite:false,fog:false});
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
  addGyro(new T.Vector3(0,128,0),22,1);
  addGyro(LM[1].top.clone().add(new T.Vector3(0,-14,0)),12,1.4);
  // -- the dragon
  var dragonPts=SMALL?46:72,finEvery=6,dragonCount=dragonPts+2*Math.ceil(dragonPts/finEvery)+5;
  var dPos=new Float32Array(dragonCount*3),dSize=new Float32Array(dragonCount),dAlpha=new Float32Array(dragonCount),dGeo=new T.BufferGeometry();
  dGeo.setAttribute('position',new T.BufferAttribute(dPos,3));dGeo.setAttribute('size',new T.BufferAttribute(dSize,1));dGeo.setAttribute('alpha',new T.BufferAttribute(dAlpha,1));
  var dragonM=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uColor:{value:new T.Color(0x2aa6e8)},uHead:{value:new T.Color(0xffffff)},uScale:{value:400}},
    vertexShader:'attribute float size;attribute float alpha;varying float vA;varying float vH;uniform float uScale;void main(){vA=alpha;vH=size>22.?1.:0.;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=size*uScale/-mv.z;gl_Position=projectionMatrix*mv;}',
    fragmentShader:'uniform vec3 uColor;uniform vec3 uHead;varying float vA;varying float vH;void main(){vec2 p=gl_PointCoord-.5;float d=length(p);if(d>.5)discard;float core=smoothstep(.5,.0,d);vec3 col=mix(uColor,uHead,vH*.9+core*.5);gl_FragColor=vec4(col,vA*(.25+.75*core));}'});
  var dragon=new T.Points(dGeo,dragonM);dragon.frustumCulled=false;sci.add(dragon);
  var dCurve=new T.CatmullRomCurve3([[-90,30,150],[30,-85,185],[190,-45,215],[290,90,170],[235,240,220],[100,320,190],[-50,250,225],[-130,125,180]].map(function(p){return A0(p[0],p[1],p[2])}),true,'catmullrom',.5);
  var dLen=dCurve.getLength(),dT=new T.Vector3(),dP=new T.Vector3(),dB=new T.Vector3(),dN=new T.Vector3(),dUp=new T.Vector3(0,1,0);
  function dragonUpdate(time,still){
    var t=still?0:time*.001,speed=24,head=((t*speed)/dLen+.12)%1,k=0,sp=4.6;
    function put(x,y,z,sz,al){dPos[k*3]=x;dPos[k*3+1]=y;dPos[k*3+2]=z;dSize[k]=sz;dAlpha[k]=al;k++}
    for(var i=0;i<dragonPts;i++){
      var u=((head-i*sp/dLen)%1+1)%1;dCurve.getPointAt(u,dP);dCurve.getTangentAt(u,dT);dB.crossVectors(dT,dUp).normalize();dN.crossVectors(dB,dT).normalize();
      var f=i/dragonPts,wave=Math.sin(i*.3-t*3)*(3+10*f),lift=Math.cos(i*.24-t*2.3)*(2+6*f);
      var x=dP.x+dB.x*wave+dN.x*lift,y=dP.y+dB.y*wave+dN.y*lift,z=dP.z+dB.z*wave+dN.z*lift;
      var taper=i<5?1:(1-f*.8),sz=i===0?30:(i<4?17:10.5*taper+2.4);
      put(x,y,z,sz,i===0?1:(.95-f*.7));
      if(i>6&&i%finEvery===0&&i<dragonPts*.8){var fin=6+12*Math.sin(f*3.14159);put(x+dB.x*fin,y+dB.y*fin+2,z+dB.z*fin,5,.7-f*.4);put(x-dB.x*fin,y-dB.y*fin+2,z-dB.z*fin,5,.7-f*.4)}}
    // head: two horns swept back, and a snout
    dCurve.getPointAt(head,dP);dCurve.getTangentAt(head,dT);dB.crossVectors(dT,dUp).normalize();
    put(dP.x-dT.x*5+dB.x*7,dP.y-dT.y*5+7,dP.z-dT.z*5+dB.z*7,7,.95);put(dP.x-dT.x*5-dB.x*7,dP.y-dT.y*5+7,dP.z-dT.z*5-dB.z*7,7,.95);
    put(dP.x+dT.x*9,dP.y+dT.y*9,dP.z+dT.z*9,11,.9);put(dP.x-dT.x*11-dB.x*13,dP.y-dT.y*11+13,dP.z-dT.z*11-dB.z*13,4.6,.8);put(dP.x-dT.x*11+dB.x*13,dP.y-dT.y*11+13,dP.z-dT.z*11+dB.z*13,4.6,.8);
    for(;k<dragonCount;k++){dPos[k*3+1]=-9999;dAlpha[k]=0;dSize[k]=0}
    dGeo.attributes.position.needsUpdate=true;dGeo.attributes.size.needsUpdate=true;dGeo.attributes.alpha.needsUpdate=true;
    dragonM.uniforms.uScale.value=Hh/(2*Math.tan(cam.fov*Math.PI/360))}
  var sciPos=new T.Vector3();
  function sciUpdate(time,still,inRide){
    var t=still?0:time*.001,cl=Math.hypot(cam.position.x,cam.position.z)||1,dx=cam.position.x/cl,dz=cam.position.z/cl;
    stars.rotation.y=t*.004;
    moonG.position.set(-dx*900+(-dz)*260,330+Math.sin(t*.05)*6,-dz*900+dx*260);
    moon.rotation.y=t*.03;moonRing.rotation.z=t*.02;moonRing2.rotation.z=-t*.015;
    moon2.position.set(Math.cos(t*.22)*170,Math.sin(t*.22)*28,Math.sin(t*.22)*170);
    for(var g=0;g<gyros.length;g++){gyros[g].ring.rotation.z=t*.5*gyros[g].sp;gyros[g].h.rotation.y+=still?0:.0016*gyros[g].sp}
    dragonUpdate(time,still)}
  function sciStyle(dark){
    starM.color.set(dark?0xffffff:C.near);starM.opacity=dark?.9:.38;starM.blending=T.NormalBlending;
    moonM.color.set(dark?0xe6edff:C.near);moon2M.color.set(dark?0xcfd8f2:C.mid);
    moonHalo.material.color.set(dark?0x9dbbff:0xffffff);moonHalo.material.opacity=dark?.5:.85;
    ringMat.color.set(dark?0xbcd2ff:C.near);ringMat.opacity=dark?.5:.55;
    gyroM.color.set(dark?C.glass:C.line);gyroM.opacity=dark?.85:.75;gyroM.blending=dark?T.AdditiveBlending:T.NormalBlending;
    dragonM.uniforms.uColor.value.set(dark?C.glass:C.line);dragonM.uniforms.uHead.value.set(dark?0xffffff:0x0b2f8a);dragonM.blending=dark?T.AdditiveBlending:T.NormalBlending;
    [starM,ringMat,gyroM,dragonM,moonHalo.material].forEach(function(m){m.needsUpdate=true})}
  function fxStyle(dark){
    var bl=dark?T.AdditiveBlending:T.NormalBlending,c=C.line;
    beamM.color.set(c);beamM.blending=bl;beamM.opacity=dark?.7:.6;
    haloM.color.set(c);haloM.blending=bl;haloM.opacity=dark?.9:.8;
    radarM.color.set(c);radarM.blending=bl;
    polyM.color.set(c);polyM.blending=bl;polyM.opacity=dark?.8:.7;polyM.needsUpdate=true;
    linkM.color.set(c);linkM.opacity=dark?.5:.6;pulseM.color.set(dark?C.glass:C.line);
    fx.forEach(function(m){m.needsUpdate=true});sciStyle(dark)}
  var fogN0=300,fogF0=680; // base fog (set by recolor); the finale pushes it back
  function recolor(){
    readColors();var dark=root.getAttribute('data-theme')==='dark';
    mats.forEach(function(m){var r=m.userData.role;if(r)m.color.set(C[r])});
    tower.emissive.set(C.glass);tower.emissiveIntensity=dark?1:.28;glassM.emissive.set(C.ring);glassM.emissiveIntensity=dark?.9:.15;
    cityU.uNight.value=dark?1:0;
    if(glassModelM){glassModelM.emissive.set(C.ring);glassModelM.emissiveIntensity=dark?.8:.12}ringM.color.set(C.ring);specks.material.color.set(C.ring);
    var f=col('sky2');fogN0=dark?260:300;fogF0=dark?640:680;scene.fog=new T.Fog(f,fogN0,fogF0);
    fxStyle(dark);amb.intensity=dark?.45:.5;sun.intensity=dark?.55:.55;sun.color.set(dark?0x9cc8ff:0xffffff)}
  recolor();window.addEventListener('scenetheme',function(){recolor();need=true});
  new MutationObserver(function(){recolor();need=true}).observe(root,{attributes:true,attributeFilter:['data-theme']}); // the page's own theme button flips data-theme
  var W=0,Hh=0,mobile=false,need=true,px=0,tx=0,cr=0,tr=0,vr={v:0},vx={v:0},dtF=.016,tgtPose=mob(END),curPose=mob(END),vPose=[{v:0},{v:0},{v:0},{v:0},{v:0},{v:0},{v:0},{v:0}];
  function size(){W=innerWidth;Hh=innerHeight;mobile=W<=820;renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1.5:2));renderer.setSize(W,Hh,false);cam.aspect=W/Hh;cam.updateProjectionMatrix();need=true}
  var enter=document.getElementById('enter'),caps=enter?enter.querySelectorAll('.ride-cap'):[],roll=0,rideP=null,rideT=null,rideQ=null;
  // The page scroll is split in two: first the orbit round the skyline, then (inside #enter) the flight.
  // ---- THE DIRECTOR ----
  // Before the flight, every section of the page has its own camera shot. A shot (a "pose") is:
  //   [cx, cz, a, r, y, ty, sx, sy]  = look at (cx, ty, cz) from bearing a (degrees) at radius r and height y,
  //   with the picture pushed right by sx (and down by sy) as a fraction of the screen, so a panel can sit on the other side.
  // Poses are interpolated as bearings and radii, not as straight lines, so the camera sweeps round the building instead of through it.
  // The keys below are placed on the page by section: [section id, fraction down it, viewport offset, pose]. Keys are
  // spaced so a shot holds while its section is read and the move to the next one happens in the gap between them.
  var spin=document.getElementById('spin'),SP0=.06,SPW=.28,sTop=0,sH=0; // sTop/sH: the buffer's place (read on layout, not per frame)
  function P(cx,cz,a,r,y,ty,sx,sy){return [cx,cz,a,r,y,ty,sx||0,sy||0]}
  var MER=DIST?[-217,303]:[-10,-95],EXC=DIST?[157,304]:[60,-125],KLT=DIST?[-221,181]:[-95,-70];           // Merdeka 118, The Exchange 106, Menara KL (scene units, Petronas is 0,0)
  var GAP=48.3;                                            // bearing of the gap between the towers (street side)
  var UTP=[                                                // UTP: one shot per group in the coverflow, in the order of its cards
    P(0,0,40,235,85,66,.24),                               // 0 Languages: the whole of the towers
    P(0,0,62,112,122,118,.24),                             // 1 Programming: the crowns
    P(0,0,GAP+180,150,52,56,.24),                          // 2 Computer systems: side-on at the skybridge, from the far side
    P(0,0,45,78,14,100,.24),                               // 3 Maths: the foot of the towers, looking up
    P(0,0,225,118,172,56,.24),                             // 4 Data & AI: down on them from above
    P(0,0,100,175,62,46,.24),                              // 5 Business & people: the podium and Suria KLCC from the south
    P(0,0,335,310,125,82,.24)                              // 6 The big ones: back to take in the skyline
  ];
  var utpIdx=0;
  var END=P(0,0,337.5,250,100,69,0);                       // where the flight takes over (what orbitPose(1) was)
  var DIR=[
    ['top',0,0,P(0,0,31.5,250,100,69,.2)],                 // the opening
    ['spin',0,-1,P(0,0,50,250,110,66,0)],                  // the buffer turns the city about 85 degrees
    ['spin',1,-1,P(0,0,135,224,150,55,0)],
    ['me',.2,-.5,P(0,0,150,236,128,60,0)],
    ['why',.5,-.5,P(0,0,168,240,118,62,0)],
    ['notes',.14,-.5,P(0,0,45,76,12,100,.22)],            // Notes: under the towers, looking up ...
    ['notes',.52,-.5,P(0,0,72,86,50,88,.22)],             // ... then climbing as you read
    ['notes',.9,-.5,P(0,0,98,130,98,74,.22)],
    ['studied',.14,-.5,function(){return UTP[utpIdx]}],   // UTP: the shot follows the group you pick
    ['studied',.9,-.5,function(){return UTP[utpIdx]}],
    ['merdekastage',.3,-.5,P(MER[0],MER[1],125,150,6,122,.22)],  // a lead-in all of its own: the tower looming over its label
    ['toolkit',.1,-.5,P(MER[0],MER[1],120,125,5,118,0)],    // Skills: Merdeka 118 between the two columns, base first ...
    ['toolkit',.38,-.5,P(MER[0],MER[1],140,300,95,96,0)], // ... the whole building ...
    ['toolkit',.66,-.5,P(MER[0],MER[1],172,150,150,150,0)],// ... the upper half ...
    ['toolkit',.92,-.5,P(MER[0],MER[1],205,240,215,172,0)],// ... and the spire
    ['workstage',.3,-.5,P(KLT[0],KLT[1],20,205,72,66,.2)],// Work: Menara KL
    ['work',.5,-.5,P(KLT[0],KLT[1],64,215,82,66,.1)],
    ['pulse',.5,-.5,P(0,0,200,250,110,66,0)],
    ['journey',.1,-.5,P(EXC[0],EXC[1],140,78,8,76,-.22)], // Journey: The Exchange 106, climbing as the years go by
    ['journey',.58,-.5,P(EXC[0],EXC[1],176,118,96,122,-.22)],
    ['enter',0,-1,END]                                     // the flight starts here
  ];
  var KEYS=[],lastLay=-1;
  function mob(p){if(!mobile)return p;var q=p.slice();q[6]=0;q[3]*=1.12;q[4]*=1.08;return q}
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
  function orbitPose(p,pxv){var e=Math.sin(p*Math.PI),ang=.55+p*Math.PI*1.7+pxv*.12*(1-p),rad=(mobile?290:250)-e*30,hgt=(mobile?112:100)+e*60;
    return{pos:new T.Vector3(Math.cos(ang)*rad,hgt,Math.sin(ang)*rad),tgt:new T.Vector3(0,H*(mobile?.5:.52)-e*18,0)}}

  // THE FLIGHT. One direction only, never back on itself:
  //   swing in from the side -> line up with the skybridge head-on -> over the bridge and out through the gap between the towers
  //   -> one slow turn up Merdeka 118 -> over the top and across The Exchange 106 -> pull back to a wide shot of all four.
  // Waypoints are written in (u, w, y): u runs along the gap between the towers (toward the street side), w across it, y up. World units.
  var UX=new T.Vector3(.665,0,.747),WX=new T.Vector3(-.747,0,.665);
  function A(u,w,y){return new T.Vector3(UX.x*u+WX.x*w,y,UX.z*u+WX.z*w)}
  var MC={u:-80,w:-63};                                   // Merdeka 118's axis
  var ENDC={u:120,w:205},ENDN={u:-.5,w:-.866};            // the middle of the four landmarks, and the direction from it to the finale camera
  var MCD={u:82,w:364},EXD={u:331,w:85};                  // the district puts Merdeka 118 and The Exchange 106 south of KLCC, in (u,w)
  function arcAt(deg,r,y,ty){var C=DIST?MCD:MC,a=deg*Math.PI/180;return [A(C.u+Math.cos(a)*r,C.w+Math.sin(a)*r,y),A(C.u,C.w,ty)]}
  // [name, camera position, look-at point, slow factor of the stretch that FOLLOWS it (bigger = more scroll spent there)]
  var KF=null,CAPS=DIST?[['start','front'],['front','over'],['over','turn1'],['turn1','m5'],['m5','pass'],['pass','end']]:[['start','front'],['front','over'],['over','out'],['out','m4'],['m4','pass'],['pass','end']];
  function buildKF(){
    var o=orbitPose(1,0),m1=arcAt(90,55,96,112),m2=arcAt(130,55,116,132),m3=arcAt(180,55,138,150),m4=arcAt(230,55,166,178),m5=arcAt(270,55,200,205);
    if(DIST){var E=EXD,C=MCD,arcD=function(deg,r,y,ty){var q=deg*Math.PI/180;return [A(C.u+Math.cos(q)*r,C.w+Math.sin(q)*r,y),A(C.u,C.w,ty)]};KF=[['start',o.pos,o.tgt,1.0],['swing',A(135,-175,96),A(0,0,64),1.4],['side',A(185,-95,88),A(0,0,62),1.4],['front',A(165,-25,72),A(0,0,56),1.4],
      ['bridge',A(70,0,56),A(0,0,50),1.7],['over',A(30,0,66),A(-20,0,66),1.9],['gap',A(0,0,76),A(-60,-10,84),1.7],
      // out of the gap, rising, with the view turning a little at a time (it used to swing 120 degrees in one step) towards Merdeka
      ['exit',A(-46,-4,104),A(-92,34,104),1.5],['turn1',A(-72,28,132),A(-84,110,126),1.5],['turn2',A(-70,96,160),A(-40,200,140),1.5],
      ['out',A(-30,190,190),A(20,270,150),1.4],['approach',A(C.u-83,C.w-100,160),A(C.u,C.w,120),1.4],
      // the climb round Merdeka starts on the side we arrive from (230 degrees) and goes round the long way, rising
      ['m0',arcD(230,55,96,112)[0],arcD(230,55,96,112)[1],2.4],['m1',arcD(180,55,116,132)[0],arcD(180,55,116,132)[1],2.4],['m2',arcD(130,55,138,150)[0],arcD(130,55,138,150)[1],2.4],
      ['m3',arcD(80,55,166,178)[0],arcD(80,55,166,178)[1],2.4],['m4',arcD(30,55,200,205)[0],arcD(30,55,200,205)[1],2.4],
      // leaving: the view turns a little at a time towards The Exchange
      ['m5',arcD(-15,62,214,208)[0],arcD(-15,62,214,208)[1],1.4],['turnA',A(C.u+98,C.w-8,228),A(C.u+40,C.w-12,204),1.0],['turnB',A(C.u+112,C.w-30,232),A(C.u+82,C.w-72,200),1.0],['turnC',A(C.u+122,C.w-58,236),A(C.u+124,C.w-118,194),1.0],['turn',A(C.u+134,C.w-86,238),A(C.u+190,C.w-156,190),1.0],['cross',A((C.u+E.u)/2+10,(C.w+E.w)/2,240),A(E.u,E.w,160),1.0],
      ['pass',A(E.u-70,E.w+55,205),A(E.u,E.w,128),1.8],
      // The finale. Wide screens: a horizontal shot of the skyline, camera low and far back on the street side so the four landmarks
      // line up across the screen. Portrait phones cannot fit a row, so there it is a full zoom-out: high and far, looking down at the whole district.
      ['end',mobile?A(ENDC.u+ENDN.u*560,ENDC.w+ENDN.w*560,400):A(ENDC.u+ENDN.u*600,ENDC.w+ENDN.w*600,92),A(ENDC.u,ENDC.w,mobile?30:96),1.5]];return}
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
    CX=[0];CM=[0];var acc=0;for(i=0;i<n-1;i++){acc+=share[i]/tot;CX.push(acc*.97);CM.push((i+1)/(n-1))} // the last 3% of the scroll holds the final shot
    rideU=pchip(CX,CM);
    KI={};KF.forEach(function(k,j){KI[k[0]]=CX[j]});
    for(i=0;i<caps.length&&i<CAPS.length;i++){caps[i].dataset.from=Math.max(.012,KI[CAPS[i][0]]);caps[i].dataset.to=i===CAPS.length-1?1.01:KI[CAPS[i][1]]}
    hudBuild()}
  var rideU=function(c){return c};
  // ---- HUD (DOM) ----
  var hud=document.getElementById('hud'),hTags=[],hAlt=document.getElementById('h-alt'),hSec=document.getElementById('h-sec'),hFill=document.getElementById('h-fill'),hTicks=[],hLast=-1,hSecLast=-1;
  if(hud){var tg=hud.querySelector('.hud-tags');LM.forEach(function(l){var e=document.createElement('div');e.className='lm-tag';
    e.innerHTML='<i class="lm-dot"></i><b></b><span></span>';e.querySelector('b').textContent=l.name;tg.appendChild(e);hTags.push(e)})}
  function hudBuild(){
    if(!hud)return;var rail=hud.querySelector('.hud-ticks');if(!rail)return;rail.textContent='';hTicks=[];
    for(var i=0;i<CAPS.length;i++){var e=document.createElement('li');e.style.top=(KI[CAPS[i][0]]/.97*100)+'%';e.innerHTML='<i></i><b>'+('0'+(i+1)).slice(-2)+'</b>';rail.appendChild(e);hTicks.push(e)}}
  var tv=new T.Vector3();
  function hudUpdate(inRide,u,c){
    if(!hud)return;hud.classList.toggle('on',inRide);if(!inRide)return;
    hFill.style.transform='scaleY('+clamp(c/.97,0,1).toFixed(4)+')';
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
  function place(time){
    if(enter){var pin=scrollY>=enter.offsetTop-40&&scrollY<=enter.offsetTop+enter.offsetHeight-innerHeight+40;if(pin!==flying){flying=pin;root.classList.toggle('flying',pin)}} // hides the dock while the captions are on screen
    var inRide=cr>.0004&&!!rideP;
    if(inRide){
      var u=rideU(cr);
      cam.position.copy(rideP.getPoint(u));cam.lookAt(rideT.getPoint(u));cam.setViewOffset(W,Hh,0,0,W,Hh);
      // finale: widen the view (phones a lot, desktop a little) and push the fog back, so the whole skyline is in frame
      var ke=KI['pass']!=null?KI['pass']:.7,fs=clamp((cr-ke-.55*((KI['end']||.97)-ke))/(.45*((KI['end']||.97)-ke)),0,1);fs=fs*fs*(3-2*fs);
      var fv=42+(mobile?30:10)*fs;if(Math.abs(fv-cam.fov)>.01){cam.fov=fv;cam.updateProjectionMatrix()}
      if(scene.fog){scene.fog.near=fogN0+260*fs;scene.fog.far=fogF0+560*fs}
      // Ease the rotation: the view turns towards where it should look with a short lag (time constant about 0.2 s), so a sharp
      // turn in the route can never show as a jolt. Reset when the flight starts, and when snapping.
      if(!rideQ)rideQ=cam.quaternion.clone();else{rideQ.slerp(cam.quaternion,reduce?1:1-Math.exp(-dtF*5));cam.quaternion.copy(rideQ)}
      // lean into turns a little, like a drone, never more than 8 degrees
      var q0=rideP.getPoint(Math.max(0,u-.02)),q1=rideP.getPoint(u),q2=rideP.getPoint(Math.min(1,u+.02)),v1=q1.clone().sub(q0),v2=q2.clone().sub(q1);
      var turn=v1.length()*v2.length()>1e-6?v1.cross(v2).y/(v1.length()*v2.length()):0;roll+=(clamp(-turn*3,-.14,.14)-roll)*(1-Math.exp(-dtF*3));cam.rotateZ(roll*(1-fs)); // level horizon for the finale
      hudUpdate(true,u,cr)
    }else{
      rideQ=null;if(cam.fov!==42){cam.fov=42;cam.updateProjectionMatrix()}if(scene.fog){scene.fog.near=fogN0;scene.fog.far=fogF0}
      var q=curPose,ang=(q[2]+px*7)*Math.PI/180;
      cam.position.set(q[0]+Math.cos(ang)*q[3],q[4],q[1]+Math.sin(ang)*q[3]);cam.lookAt(q[0],q[5],q[1]);
      cam.setViewOffset(W,Hh,-q[6]*W,-q[7]*Hh,W,Hh);hudUpdate(false)
    }
    for(var ci=0;ci<caps.length;ci++){var c=caps[ci],on=cr>=+c.dataset.from&&cr<+c.dataset.to;if(on!==c.classList.contains('on'))c.classList.toggle('on',on)}
    if(spin&&sH){var sy=scrollY-(sTop-innerHeight),sf=sy/Math.max(1,sH),sOn=sf>.18&&sf<.95;if(sOn!==spin.classList.contains('on'))spin.classList.toggle('on',sOn)} // the coordinates tag
    ringUpdate(time,inRide);
    orb.rotation.y=time*.0004;ring.rotation.z=time*.0006;orb.position.y=230+Math.sin(time*.0009)*3;
    specks.rotation.y=time*.00003;fxUpdate(time,reduce);sciUpdate(time,reduce,inRide)}
  var raf=0,run=true,last=0,lastR=0;
  function snap(){rideQ=null;curPose=tgtPose.slice();cr=tr;px=tx;vr.v=vx.v=0;vPose.forEach(function(v){v.v=0})}
  function frame(time){
    var dt=clamp((time-last)/1000,.001,.05);last=time;dtF=dt;tick++;
    if(reduce)snap();else{for(var j=0;j<8;j++)curPose[j]=damp(curPose[j],tgtPose[j],vPose[j],.55,dt);cr=clamp(damp(cr,tr,vr,.75,dt),0,1);px=damp(px,tx,vx,.6,dt)}
    var moving=Math.abs(tr-cr)>.0003;for(var j2=0;j2<8;j2++)if(Math.abs(tgtPose[j2]-curPose[j2])>.02){moving=true;break}
    // While the reader is only reading, redraw at about 15 fps (the beams and pulses still drift); while scrolling, every frame.
    if(moving||need||(!reduce&&time-lastR>66)){place(reduce?0:time);renderer.render(scene,cam);need=false;lastR=time}
    raf=run?requestAnimationFrame(frame):0}
  function retarget(){if(document.documentElement.scrollHeight!==lastLay)layoutKeys();tgtPose=dirPose(scrollY);tr=rideProg();need=true}
  addEventListener('scroll',retarget,{passive:true});
  // the UTP coverflow says which group is in front; the shot follows it
  document.addEventListener('cf-change',function(e){if(e.target&&e.target.closest&&e.target.closest('#studied')){utpIdx=Math.max(0,Math.min(UTP.length-1,e.detail.index|0));retarget()}});
  addEventListener('load',function(){layoutKeys();retarget()});
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){layoutKeys();retarget()});
  addEventListener('resize',function(){size();buildRide();layoutKeys();retarget()});
  addEventListener('pointermove',function(e){tx=e.clientX/innerWidth-.5});
  document.addEventListener('visibilitychange',function(){run=!document.hidden;if(run&&!raf){last=performance.now();raf=requestAnimationFrame(frame)}});
  root.classList.add('gl'); // first: it makes #enter visible, and the scroll maths below needs its real position
  size();buildRide();layoutKeys();tgtPose=dirPose(scrollY);curPose=tgtPose.slice();tr=cr=rideProg();raf=requestAnimationFrame(frame);
  if(ONLY||/[?&]dbg/.test(location.search))window.__scene={scene:scene,cam:cam,g:g,rideP:rideP,rideT:rideT,rideU:function(c){return rideU(c)},snap:snap,place:place,KF:KF,KI:function(){return KI},render:function(){renderer.render(scene,cam)},set:function(c){tr=c;cr=c;vr.v=0},pause:function(){run=false;cancelAnimationFrame(raf);raf=0},draw:function(c,t){tr=c;cr=c;vr.v=0;tick=0;place(t||0);renderer.render(scene,cam);tick=0;place(t||0);renderer.render(scene,cam)}};
})();
