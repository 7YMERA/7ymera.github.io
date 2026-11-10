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
  // The real model: a SketchUp export of the Petronas Towers, converted by tools/convert-klcc.py into v2/klcc.json
  function b64(str,Type){var bin=atob(str),u=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new Type(u.buffer)}
  var SC=H/444.138; // one scale for every landmark, so their real heights compare truthfully
  var bodyM=mat('near',{side:T.DoubleSide}),glassModelM=mat('ring',{side:T.DoubleSide,emissive:0xffffff,emissiveIntensity:.3});
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
  loadModel('menara_kl.json',-95,-70,0,bodyM,null,function(){g.remove(kl)}); // Menara KL; replaces the stand-in cylinder tower below once loaded
  loadModel('merdeka118.json',-10,-95,-.5,bodyM,null);
  loadModel('exchange106.json',60,-125,.4,bodyM,null);   // The Exchange 106, cropped and simplified (tools/convert-dae-crop.py)  // Merdeka PNB 118 (SketchUp Collada, see tools/convert-dae.py)
  var gr=new T.Mesh(new T.CircleGeometry(1400,64),ground);gr.rotation.x=-Math.PI/2;gr.position.y=-.2;g.add(gr);
  // city ring
  var s=11;function rnd(){s=(s*9301+49297)%233280;return s/233280}
  var i;
  // The city: real OpenStreetMap buildings of central Kuala Lumpur (tools/convert-city.py), centred on KLCC, standing on a plain themed ground.
  // Windows come from two facade textures laid on the walls in the shader: a glass grid by day, lit offices at night.
  var loader=new T.TextureLoader();
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
  facade(bodyM); // all four landmarks share one material and the facade shader, so none is bluer than the rest
  var cityMesh=null;
  fetch('kl_city.json').then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(d){
    var q=new Int16Array(b64(d.positions,Uint8Array).buffer),pos=new Float32Array(q.length);for(var k=0;k<q.length;k++)pos[k]=q[k]*d.scale;
    var geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(pos,3));geo.setIndex(new T.BufferAttribute(b64(d.indices,Uint16Array),1));
    geo=geo.toNonIndexed();geo.computeVertexNormals(); // flat normals: the lighting needs them
    cityMesh=new T.Mesh(geo,cityM);cityMesh.scale.setScalar(SC);g.add(cityMesh);need=true;
  }).catch(function(){});
  // KL Tower
  var kl=new T.Group();kl.position.set(-95,0,-70);
  var shaft=new T.Mesh(new T.CylinderGeometry(2,3.4,120,8),towerB);shaft.position.y=60;
  var pod=new T.Mesh(new T.CylinderGeometry(9,6,9,10),glassM);pod.position.y=118;
  var ant=new T.Mesh(new T.CylinderGeometry(.3,1,50,6),towerB);ant.position.y=148;
  kl.add(shaft,pod,ant);g.add(kl);
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
  function fxStyle(dark){
    var bl=dark?T.AdditiveBlending:T.NormalBlending,c=C.line;
    beamM.color.set(c);beamM.blending=bl;beamM.opacity=dark?.7:.6;
    haloM.color.set(c);haloM.blending=bl;haloM.opacity=dark?.9:.8;
    radarM.color.set(c);radarM.blending=bl;
    polyM.color.set(c);polyM.blending=bl;polyM.opacity=dark?.8:.7;polyM.needsUpdate=true;
    linkM.color.set(c);linkM.opacity=dark?.5:.6;pulseM.color.set(dark?C.glass:C.line);
    fx.forEach(function(m){m.needsUpdate=true})}
  function recolor(){
    readColors();var dark=root.getAttribute('data-theme')==='dark';
    mats.forEach(function(m){var r=m.userData.role;if(r)m.color.set(C[r])});
    tower.emissive.set(C.glass);tower.emissiveIntensity=dark?1:.28;glassM.emissive.set(C.ring);glassM.emissiveIntensity=dark?.9:.15;
    cityU.uNight.value=dark?1:0;
    if(glassModelM){glassModelM.emissive.set(C.ring);glassModelM.emissiveIntensity=dark?.8:.12}ringM.color.set(C.ring);specks.material.color.set(C.ring);
    var f=col('sky2');scene.fog=new T.Fog(f,dark?260:300,dark?640:680);
    fxStyle(dark);amb.intensity=dark?.45:.5;sun.intensity=dark?.55:.55;sun.color.set(dark?0x9cc8ff:0xffffff)}
  recolor();window.addEventListener('v2theme',function(){recolor();need=true});
  new MutationObserver(function(){recolor();need=true}).observe(root,{attributes:true,attributeFilter:['data-theme']}); // the page's own theme button flips data-theme
  var W=0,Hh=0,mobile=false,need=true,px=0,tx=0,cp=0,tp=0,cr=0,tr=0,vp={v:0},vr={v:0},vx={v:0},dtF=.016;
  function size(){W=innerWidth;Hh=innerHeight;mobile=W<=820;renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1.5:2));renderer.setSize(W,Hh,false);cam.aspect=W/Hh;cam.updateProjectionMatrix();need=true}
  var enter=document.getElementById('enter'),caps=enter?enter.querySelectorAll('.ride-cap'):[],roll=0,rideP=null,rideT=null;
  // The page scroll is split in two: first the orbit round the skyline, then (inside #enter) the flight.
  function prog(){var m=document.documentElement.scrollHeight-innerHeight;if(!enter)return m>0?Math.min(1,Math.max(0,scrollY/m)):0;var st=Math.max(1,enter.offsetTop-innerHeight);return Math.min(1,Math.max(0,scrollY/st))}
  function rideProg(){if(!enter)return 0;var m=document.documentElement.scrollHeight-innerHeight,st=enter.offsetTop-innerHeight;return m>st?Math.min(1,Math.max(0,(scrollY-st)/(m-st))):0}
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
  function arcAt(deg,r,y,ty){var a=deg*Math.PI/180;return [A(MC.u+Math.cos(a)*r,MC.w+Math.sin(a)*r,y),A(MC.u,MC.w,ty)]}
  // [name, camera position, look-at point, slow factor of the stretch that FOLLOWS it (bigger = more scroll spent there)]
  var KF=null,CAPS=[['start','front'],['front','over'],['over','out'],['out','m4'],['m4','pass'],['pass','end']];
  function buildKF(){
    var o=orbitPose(1,0),m1=arcAt(90,55,96,112),m2=arcAt(130,55,116,132),m3=arcAt(180,55,138,150),m4=arcAt(230,55,166,178),m5=arcAt(270,55,200,205);
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
      var vis=tv.z<1&&Math.abs(tv.x)<.94&&Math.abs(tv.y)<.9&&dist>24&&dist<430,e=hTags[k];
      if(vis!==e.classList.contains('show'))e.classList.toggle('show',vis);
      if(vis){e.style.transform='translate3d('+((tv.x*.5+.5)*W).toFixed(1)+'px,'+((-tv.y*.5+.5)*Hh).toFixed(1)+'px,0)';
        if(tick%8===0)e.lastChild.textContent=Math.round(LM[k].real)+' m · '+Math.round(dist*KU/10)*10+' m away'}}}
  var tick=0;
  var flying=false;
  function place(time){
    if(enter){var pin=scrollY>=enter.offsetTop-40&&scrollY<=enter.offsetTop+enter.offsetHeight-innerHeight+40;if(pin!==flying){flying=pin;root.classList.toggle('flying',pin)}} // hides the dock while the captions are on screen
    var p=cp,inRide=cr>.0004&&!!rideP;
    if(inRide){
      var u=rideU(cr);
      cam.position.copy(rideP.getPoint(u));cam.lookAt(rideT.getPoint(u));cam.setViewOffset(W,Hh,0,0,W,Hh);
      // lean into turns a little, like a drone, never more than 8 degrees
      var q0=rideP.getPoint(Math.max(0,u-.02)),q1=rideP.getPoint(u),q2=rideP.getPoint(Math.min(1,u+.02)),v1=q1.clone().sub(q0),v2=q2.clone().sub(q1);
      var turn=v1.length()*v2.length()>1e-6?v1.cross(v2).y/(v1.length()*v2.length()):0;roll+=(clamp(-turn*3,-.14,.14)-roll)*(1-Math.exp(-dtF*3));cam.rotateZ(roll);
      hudUpdate(true,u,cr)
    }else{
      var o=orbitPose(p,px);cam.position.copy(o.pos);cam.lookAt(o.tgt);
      var k=Math.min(1,p*5),ox=mobile?0:-W*.2*(1-k),oy=mobile?-Hh*.2*(1-k):Hh*.06*(1-k);
      cam.setViewOffset(W,Hh,ox,oy,W,Hh);hudUpdate(false)
    }
    for(var ci=0;ci<caps.length;ci++){var c=caps[ci],on=cr>=+c.dataset.from&&cr<+c.dataset.to;if(on!==c.classList.contains('on'))c.classList.toggle('on',on)}
    orb.rotation.y=time*.0004;ring.rotation.z=time*.0006;orb.position.y=230+Math.sin(time*.0009)*3;
    specks.rotation.y=time*.00003;fxUpdate(time,reduce)}
  var raf=0,run=true,last=0,lastR=0;
  function snap(){cp=tp;cr=tr;px=tx;vp.v=vr.v=vx.v=0}
  function frame(time){
    var dt=clamp((time-last)/1000,.001,.05);last=time;dtF=dt;tick++;
    if(reduce)snap();else{cp=damp(cp,tp,vp,.4,dt);cr=clamp(damp(cr,tr,vr,.75,dt),0,1);px=damp(px,tx,vx,.6,dt)}
    var moving=Math.abs(tp-cp)>.0003||Math.abs(tr-cr)>.0003;
    // While the reader is only reading, redraw at about 15 fps (the beams and pulses still drift); while scrolling, every frame.
    if(moving||need||(!reduce&&time-lastR>66)){place(reduce?0:time);renderer.render(scene,cam);need=false;lastR=time}
    raf=run?requestAnimationFrame(frame):0}
  addEventListener('scroll',function(){tp=prog();tr=rideProg();need=true},{passive:true});
  addEventListener('resize',function(){size();buildRide();tp=prog();tr=rideProg()});
  addEventListener('pointermove',function(e){tx=e.clientX/innerWidth-.5});
  document.addEventListener('visibilitychange',function(){run=!document.hidden;if(run&&!raf){last=performance.now();raf=requestAnimationFrame(frame)}});
  root.classList.add('gl'); // first: it makes #enter visible, and the scroll maths below needs its real position
  size();buildRide();tp=cp=prog();tr=cr=rideProg();raf=requestAnimationFrame(frame);
  if(/[?&]dbg/.test(location.search))window.__v2={scene:scene,cam:cam,g:g,rideP:rideP,rideT:rideT,rideU:function(c){return rideU(c)},snap:snap,place:place,KF:KF,KI:function(){return KI},render:function(){renderer.render(scene,cam)},set:function(c){tr=c;cr=c;vr.v=0},pause:function(){run=false;cancelAnimationFrame(raf);raf=0},draw:function(c,t){tr=c;cr=c;vr.v=0;tick=0;place(t||0);renderer.render(scene,cam);tick=0;place(t||0);renderer.render(scene,cam)}};
})();
