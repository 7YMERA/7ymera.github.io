/* KLCC in WebGL. The camera orbits the towers as the page scrolls. three.js comes from cdnjs. */
(function(){
  if(!window.THREE)return;
  var T=THREE,root=document.documentElement,cv=document.getElementById('gl');
  var renderer;
  try{renderer=new T.WebGLRenderer({canvas:cv,alpha:true,antialias:true,powerPreference:'low-power'})}catch(e){return}
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var scene=new T.Scene(),cam=new T.PerspectiveCamera(42,1,.3,900);
  var M={},C={},mats=[];
  function css(n){return getComputedStyle(root).getPropertyValue(n).trim()}
  function col(k){return new T.Color(C[k])}
  function readColors(){['far','mid','near','glass','orb','ring','sky1','sky2'].forEach(function(k){C[k]=css('--'+k)})}
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
  // The real model: a SketchUp export of the Petronas Towers, converted by tools/convert-klcc.py into v2/klcc.json
  function b64(str,Type){var bin=atob(str),u=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new Type(u.buffer)}
  var SC=H/444.138; // one scale for every landmark, so their real heights compare truthfully
  var bodyM=mat('near',{side:T.DoubleSide}),bodyM2=mat('mid',{side:T.DoubleSide}),glassModelM=mat('ring',{side:T.DoubleSide,emissive:0xffffff,emissiveIntensity:.3});
  function loadModel(url,x,z,ry,bm,fallback,done){
    fetch(url).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(d){
      var pos=b64(d.positions,Float32Array),out=new T.Group();
      [['body',bm],['glass',glassModelM]].forEach(function(p){
        var geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(pos,3));geo.setIndex(new T.BufferAttribute(b64(d[p[0]],Uint16Array),1));
        geo=geo.toNonIndexed();geo.computeVertexNormals();out.add(new T.Mesh(geo,p[1]))});
      out.scale.setScalar(SC);out.position.set(x,0,z);out.rotation.y=ry;g.add(out);if(done)done();recolor();need=true;
    }).catch(function(){if(fallback)fallback();recolor();need=true});
  }
  loadModel('klcc.json',0,0,0,bodyM,procedural);          // Petronas Twin Towers (SketchUp export, see tools/convert-obj.py)
  loadModel('menara_kl.json',-95,-70,0,bodyM2,null,function(){g.remove(kl)}); // Menara KL; replaces the stand-in cylinder tower below once loaded
  loadModel('merdeka118.json',-10,-95,-.5,bodyM2,null);
  loadModel('exchange106.json',60,-125,.4,bodyM,null);   // The Exchange 106, cropped and simplified (tools/convert-dae-crop.py)  // Merdeka PNB 118 (SketchUp Collada, see tools/convert-dae.py)
  var gr=new T.Mesh(new T.CircleGeometry(520,48),ground);gr.rotation.x=-Math.PI/2;gr.position.y=-.2;g.add(gr);
  // city ring
  var s=11;function rnd(){s=(s*9301+49297)%233280;return s/233280}
  var i;
  // The city: real OpenStreetMap buildings of central Kuala Lumpur (tools/convert-city.py), centred on KLCC, with the satellite photo as the ground.
  // Windows come from two facade textures laid on the walls in the shader: a glass grid by day, lit offices at night.
  var SATURL='kl_ground.jpg',loader=new T.TextureLoader();
  function wrapTex(t){t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;return t}
  var cityU={uNight:{value:0},uDay:{value:wrapTex(loader.load('facade_glass.jpg'))},uNightTex:{value:wrapTex(loader.load('facade_night.jpg'))}};
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
  var cityM=facade(mat('mid'));
  facade(bodyM);facade(bodyM2); // the landmark models share the facade shader
  var cityMesh=null;
  fetch('kl_city.json').then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(d){
    var q=new Int16Array(b64(d.positions,Uint8Array).buffer),pos=new Float32Array(q.length);for(var k=0;k<q.length;k++)pos[k]=q[k]*d.scale;
    var geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(pos,3));geo.setIndex(new T.BufferAttribute(b64(d.indices,Uint16Array),1));
    geo=geo.toNonIndexed();geo.computeVertexNormals(); // flat normals: the lighting needs them
    cityMesh=new T.Mesh(geo,cityM);cityMesh.scale.setScalar(SC);g.add(cityMesh);need=true;
  }).catch(function(){});
  // The FBX ground plane maps the photo with u -0.084..1.102 and v 0.863..0.083 (north to south), so the image is stretched like this:
  var satTex=loader.load(SATURL);satTex.repeat.set(1,.78);satTex.offset.set(0,.083);
  var satM=mat('far',{map:satTex});
  var sat=new T.Mesh(new T.PlaneGeometry(2335*SC,1821*SC),satM);sat.rotation.x=-Math.PI/2;sat.position.set(504*SC,.12,320*SC);g.add(sat);
  // KL Tower
  var kl=new T.Group();kl.position.set(-95,0,-70);
  var shaft=new T.Mesh(new T.CylinderGeometry(2,3.4,120,8),towerB);shaft.position.y=60;
  var pod=new T.Mesh(new T.CylinderGeometry(9,6,9,10),glassM);pod.position.y=118;
  var ant=new T.Mesh(new T.CylinderGeometry(.3,1,50,6),towerB);ant.position.y=148;
  kl.add(shaft,pod,ant);g.add(kl);
  // orb and ring
  var orb=new T.Group();orb.position.set(70,H+30,-60);
  orb.add(new T.Mesh(new T.SphereGeometry(12,18,14),orbM));
  var ring=new T.Mesh(new T.TorusGeometry(21,1.1,6,40),ringM);ring.rotation.x=1.25;ring.rotation.y=.3;orb.add(ring);g.add(orb);
  // drifting specks
  var sp=new T.BufferGeometry(),pts=[];for(i=0;i<90;i++)pts.push((rnd()-.5)*500,20+rnd()*220,(rnd()-.5)*500);
  sp.setAttribute('position',new T.Float32BufferAttribute(pts,3));
  var specks=new T.Points(sp,new T.PointsMaterial({size:2.2,color:C.ring,transparent:true,opacity:.7}));scene.add(specks);
  function recolor(){
    readColors();var dark=root.getAttribute('data-theme')==='dark';
    mats.forEach(function(m){var r=m.userData.role;if(r)m.color.set(C[r])});
    tower.emissive.set(C.glass);tower.emissiveIntensity=dark?1:.28;glassM.emissive.set(C.ring);glassM.emissiveIntensity=dark?.9:.15;
    cityU.uNight.value=dark?1:0;
    if(glassModelM){glassModelM.emissive.set(C.ring);glassModelM.emissiveIntensity=dark?.8:.12}ringM.color.set(C.ring);specks.material.color.set(C.ring);
    var f=col('sky2');scene.fog=new T.Fog(f,dark?260:300,dark?640:680);
    amb.intensity=dark?.45:.5;sun.intensity=dark?.55:.55;sun.color.set(dark?0x9cc8ff:0xffffff)}
  recolor();window.addEventListener('v2theme',function(){recolor();need=true});
  var W=0,Hh=0,mobile=false,need=true,px=0,tx=0,cp=0,tp=0;
  function size(){W=innerWidth;Hh=innerHeight;mobile=W<=820;renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1.5:2));renderer.setSize(W,Hh,false);cam.aspect=W/Hh;cam.updateProjectionMatrix();need=true}
  var enter=document.getElementById('enter'),caps=enter?enter.querySelectorAll('.ride-cap'):[],tr=0,cr=0,roll=0,rideP=null,rideT=null;
  // The page scroll is split in two: first the orbit round the skyline, then (inside #enter) the ride into the masjid.
  function prog(){var m=document.documentElement.scrollHeight-innerHeight;if(!enter)return m>0?Math.min(1,Math.max(0,scrollY/m)):0;var st=Math.max(1,enter.offsetTop-innerHeight);return Math.min(1,Math.max(0,scrollY/st))}
  function rideProg(){if(!enter)return 0;var m=document.documentElement.scrollHeight-innerHeight,st=enter.offsetTop-innerHeight;return m>st?Math.min(1,Math.max(0,(scrollY-st)/(m-st))):0}
  function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
  function orbitPose(p,pxv){var e=Math.sin(p*Math.PI),ang=.55+p*Math.PI*1.7+pxv*.12,rad=(mobile?290:250)-e*30,hgt=(mobile?112:100)+e*60;
    return{pos:new T.Vector3(Math.cos(ang)*rad,hgt,Math.sin(ang)*rad),tgt:new T.Vector3(0,H*(mobile?.5:.52)-e*18,0)}}
  // The flight: out of the orbit, down to the plaza between the Petronas Towers and straight up their sides, across to Merdeka 118,
  // up its face and over the top, then out to a wide shot. All in world units; the towers' axis comes from the model (tools/convert-obj.py output).
  var NRM=new T.Vector3(.665,0,.747);                       // direction across the gap between the twin towers
  var MERDEKA=new T.Vector3(-10,0,-95);                      // where merdeka118.json is placed
  function buildRide(){
    var o=orbitPose(1,0);
    function V(x,y,z){return new T.Vector3(x,y,z)}
    function along(d,y){return V(NRM.x*d,y,NRM.z*d)}
    var M=MERDEKA;
    // 12 waypoints: 0 orbit end | 1-4 sink toward the gap | 5 on the plaza between the towers, looking straight up | 6 rise out | 7-9 climb Merdeka 118 | 10 over the top | 11 wide shot
    rideP=new T.CatmullRomCurve3([o.pos,along(235,125),along(125,98),along(58,58),along(20,16),V(0,11,0),along(-40,30),V(M.x+8,36,M.z+74),V(M.x+14,90,M.z+66),V(M.x+4,168,M.z+40),V(M.x-6,222,M.z+20),V(-150,215,170)],false,'centripetal');
    rideT=new T.CatmullRomCurve3([o.tgt,V(0,50,0),along(-70,42),along(-90,46),along(-60,70),V(-3,150,6),V(-6,80,-40),V(M.x,100,M.z),V(M.x,160,M.z),V(M.x,200,M.z-6),V(0,60,0),V(0,62,-30)],false,'centripetal')}
  function place(time){
    var p=cp;
    if(cr>.0004&&rideP){
      var u=cr*cr*(3-2*cr)*.55+cr*.45;
      cam.position.copy(rideP.getPoint(u));cam.lookAt(rideT.getPoint(u));cam.setViewOffset(W,Hh,0,0,W,Hh);
      // bank into turns like an aircraft
      var q0=rideP.getPoint(Math.max(0,u-.02)),q1=rideP.getPoint(u),q2=rideP.getPoint(Math.min(1,u+.02)),v1=q1.clone().sub(q0),v2=q2.clone().sub(q1);
      var turn=v1.length()*v2.length()>1e-6?v1.cross(v2).y/(v1.length()*v2.length()):0;roll+=(clamp(-turn*5,-.32,.32)-roll)*.08;cam.rotateZ(roll);
    }else{
      var o=orbitPose(p,px);cam.position.copy(o.pos);cam.lookAt(o.tgt);
      var k=Math.min(1,p*5),ox=mobile?0:-W*.2*(1-k),oy=mobile?-Hh*.2*(1-k):Hh*.06*(1-k);
      cam.setViewOffset(W,Hh,ox,oy,W,Hh);
    }
    for(var ci=0;ci<caps.length;ci++){var c=caps[ci],on=cr>=+c.dataset.from&&cr<+c.dataset.to;if(on!==c.classList.contains('on'))c.classList.toggle('on',on)}
    orb.rotation.y=time*.0004;ring.rotation.z=time*.0006;orb.position.y=H+30+Math.sin(time*.0009)*3;
    specks.rotation.y=time*.00003}
  var raf=0,run=true;
  function frame(time){
    cp+=(tp-cp)*.08;px+=(tx-px)*.05;cr+=(tr-cr)*.08;
    if(!reduce||need||Math.abs(tp-cp)>.0005||Math.abs(tr-cr)>.0005){place(reduce?0:time);renderer.render(scene,cam);need=false}
    raf=run?requestAnimationFrame(frame):0}
  addEventListener('scroll',function(){tp=prog();tr=rideProg();need=true},{passive:true});
  addEventListener('resize',function(){size();buildRide();tp=prog();tr=rideProg()});
  addEventListener('pointermove',function(e){tx=e.clientX/innerWidth-.5});
  document.addEventListener('visibilitychange',function(){run=!document.hidden;if(run&&!raf)raf=requestAnimationFrame(frame)});
  root.classList.add('gl'); // first: it makes #enter visible, and the scroll maths below needs its real position
  size();buildRide();tp=cp=prog();tr=cr=rideProg();raf=requestAnimationFrame(frame);
})();
