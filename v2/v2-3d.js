/* KLCC in WebGL. The camera orbits the towers as the page scrolls. three.js comes from cdnjs. */
(function(){
  if(!window.THREE)return;
  var T=THREE,root=document.documentElement,cv=document.getElementById('gl');
  var renderer;
  try{renderer=new T.WebGLRenderer({canvas:cv,alpha:true,antialias:true,powerPreference:'low-power'})}catch(e){return}
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var scene=new T.Scene(),cam=new T.PerspectiveCamera(42,1,1,900);
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
  // Masjid Negara, built from code (no model file): 18-fold umbrella dome, smaller pleated dome, slender minaret,
  // waffle-coffered roof slabs, sawtooth hall and reflecting pool. Units here are metres; the group is scaled up a little so it reads beside the towers.
  (function(){
    var mq=new T.Group();
    var cv=document.createElement('canvas');cv.width=cv.height=32;var cx=cv.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,32,32);cx.fillStyle='#c9c9c9';cx.fillRect(5,5,22,22);cx.fillStyle='#f2f2f2';cx.fillRect(8,8,16,16);
    var waffle=new T.CanvasTexture(cv);waffle.wrapS=waffle.wrapT=T.RepeatWrapping;
    var slabSide=mat('far'),slabTop=mat('far',{map:waffle}),domeM=mat('orb',{side:T.DoubleSide}),pale=mat('glass'),glassD=mat('ring',{side:T.DoubleSide,emissive:0xffffff,emissiveIntensity:.2});
    var flagRed=new T.MeshLambertMaterial({color:0xcc0001,flatShading:true}),flagYellow=new T.MeshLambertMaterial({color:0xffcc00,flatShading:true,emissive:0x6b5200});
    function slab(x0,x1,z0,z1,y0,y1){
      var w=x1-x0,d=z1-z0,geo=new T.BoxGeometry(w,y1-y0,d),uv=geo.attributes.uv;
      for(var i=8;i<12;i++)uv.setXY(i,uv.getX(i)*w/9,uv.getY(i)*d/9);
      var m=new T.Mesh(geo,[slabSide,slabSide,slabTop,slabSide,slabSide,slabSide]);m.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);mq.add(m);return m}
    function pleat(N,R,H,h0,rings,mt){
      var per=2*N,pos=[],idx=[],i,j;
      for(j=0;j<=rings;j++){var t=j/rings,y=h0+(H-h0)*(1-Math.pow(t,2.1));
        for(i=0;i<per;i++){var ridge=i%2===0,a=Math.PI*i/N,r=R*t*(ridge?1:1-0.22*t);pos.push(Math.cos(a)*r,y-(ridge?0:(H-h0)*0.06*t),Math.sin(a)*r)}}
      for(j=0;j<rings;j++)for(i=0;i<per;i++){var a0=j*per+i,b0=j*per+(i+1)%per,c0=(j+1)*per+i,d0=(j+1)*per+(i+1)%per;idx.push(a0,c0,b0,b0,c0,d0)}
      var geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo=geo.toNonIndexed();geo.computeVertexNormals();
      return new T.Mesh(geo,mt)}
    // roof slabs (a cross-shaped complex around the main hall)
    slab(-60,60,-26,26,0,9);slab(-105,40,10,28,0,6);slab(20,112,-38,-12,0,6);slab(-45,-8,-64,-24,0,6);slab(55,85,18,50,0,5);
    // main dome: glass drum, red band, 18-fold umbrella, yellow star finial
    var drum=new T.Mesh(new T.CylinderGeometry(24,24,7,36,1,true),glassD);drum.position.set(0,12.5,0);mq.add(drum);
    var band=new T.Mesh(new T.CylinderGeometry(24.6,24.6,1.6,36,1,true),flagRed);band.position.set(0,16.4,0);mq.add(band);
    var dome=pleat(18,27,46,16,8,domeM);dome.position.y=0;mq.add(dome);
    var fin=new T.Mesh(new T.ConeGeometry(1.4,10,5),flagYellow);fin.position.set(0,16+46-16+5,0);fin.position.y=62+3;mq.add(fin);
    // smaller pleated dome on the west wing
    var d2=pleat(12,15,22,6,6,domeM);d2.position.set(-122,0,-4);mq.add(d2);
    var drum2=new T.Mesh(new T.CylinderGeometry(13.5,13.5,6,24,1,true),glassD);drum2.position.set(-122,3,-4);mq.add(drum2);
    var fin2=new T.Mesh(new T.ConeGeometry(.9,6,5),flagYellow);fin2.position.set(-122,25,-4);mq.add(fin2);
    // minaret: tapered shaft, lantern, spire, yellow tip
    var sh=new T.Mesh(new T.CylinderGeometry(1.5,2.4,52,6),pale);sh.position.set(32,26,22);mq.add(sh);
    var lan=new T.Mesh(new T.CylinderGeometry(3.6,2.2,5,8),pale);lan.position.set(32,53,22);mq.add(lan);
    var sp=new T.Mesh(new T.CylinderGeometry(.25,.9,18,5),pale);sp.position.set(32,65,22);mq.add(sp);
    var tip=new T.Mesh(new T.ConeGeometry(.9,3,5),flagYellow);tip.position.set(32,75,22);mq.add(tip);
    // sawtooth hall on the south-west
    var hall=new T.Mesh(new T.BoxGeometry(44,9,26),slabSide);hall.position.set(-70,4.5,52);mq.add(hall);
    for(var k=0;k<6;k++){var saw=new T.Mesh(new T.CylinderGeometry(4.6,4.6,26,3),pale);saw.rotation.x=Math.PI/2;saw.rotation.z=Math.PI/2;saw.position.set(-88+k*7.2,11.2,52);mq.add(saw)}
    // reflecting pool
    var pool=new T.Mesh(new T.PlaneGeometry(70,26),glassD);pool.rotation.x=-Math.PI/2;pool.position.set(10,.4,62);mq.add(pool);
    var MQ=1.35;mq.scale.setScalar(SC*MQ);mq.position.set(58,0,-4);mq.rotation.y=2.6;g.add(mq);
  })();
  var gr=new T.Mesh(new T.CircleGeometry(520,48),ground);gr.rotation.x=-Math.PI/2;gr.position.y=-.2;g.add(gr);
  // city ring
  var s=11;function rnd(){s=(s*9301+49297)%233280;return s/233280}
  for(var i=0;i<130;i++){var a=rnd()*6.283,d=135+rnd()*240,w=8+rnd()*18,h=8+rnd()*(d<160?55:35);
    if(Math.hypot(Math.cos(a)*d+10,Math.sin(a)*d+95)<62||Math.hypot(Math.cos(a)*d-60,Math.sin(a)*d+125)<58||Math.hypot(Math.cos(a)*d-58,Math.sin(a)*d+4)<58)continue;var b=new T.Mesh(new T.BoxGeometry(w,h,w*(.7+rnd()*.6)),d<170?city:cityF);b.position.set(Math.cos(a)*d,h/2,Math.sin(a)*d);b.rotation.y=rnd()*3;g.add(b)}
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
    if(glassModelM){glassModelM.emissive.set(C.ring);glassModelM.emissiveIntensity=dark?.8:.12}ringM.color.set(C.ring);specks.material.color.set(C.ring);
    var f=col('sky2');scene.fog=new T.Fog(f,dark?300:360,dark?720:800);
    amb.intensity=dark?.45:.5;sun.intensity=dark?.55:.55;sun.color.set(dark?0x9cc8ff:0xffffff)}
  recolor();window.addEventListener('v2theme',function(){recolor();need=true});
  var W=0,Hh=0,mobile=false,need=true,px=0,tx=0,cp=0,tp=0;
  function size(){W=innerWidth;Hh=innerHeight;mobile=W<=820;renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1.5:2));renderer.setSize(W,Hh,false);cam.aspect=W/Hh;cam.updateProjectionMatrix();need=true}
  function prog(){var m=document.documentElement.scrollHeight-innerHeight;return m>0?Math.min(1,Math.max(0,scrollY/m)):0}
  function place(time){
    var p=cp,e=Math.sin(p*Math.PI);
    var ang=.55+p*Math.PI*1.7+px*.12,rad=(mobile?270:230)-e*30,hgt=(mobile?55:40)+e*80;
    cam.position.set(Math.cos(ang)*rad,hgt,Math.sin(ang)*rad);cam.lookAt(0,H*(mobile?.5:.52)-e*18,0);
    var k=Math.min(1,p*5),ox=mobile?0:-W*.2*(1-k),oy=mobile?-Hh*.2*(1-k):Hh*.06*(1-k);
    cam.setViewOffset(W,Hh,ox,oy,W,Hh);
    orb.rotation.y=time*.0004;ring.rotation.z=time*.0006;orb.position.y=H+30+Math.sin(time*.0009)*3;
    specks.rotation.y=time*.00003}
  var raf=0,run=true;
  function frame(time){
    cp+=(tp-cp)*.08;px+=(tx-px)*.05;
    if(!reduce||need||Math.abs(tp-cp)>.0005){place(reduce?0:time);renderer.render(scene,cam);need=false}
    raf=run?requestAnimationFrame(frame):0}
  addEventListener('scroll',function(){tp=prog();need=true},{passive:true});
  addEventListener('resize',function(){size();tp=prog()});
  addEventListener('pointermove',function(e){tx=e.clientX/innerWidth-.5});
  document.addEventListener('visibilitychange',function(){run=!document.hidden;if(run&&!raf)raf=requestAnimationFrame(frame)});
  size();tp=cp=prog();root.classList.add('gl');raf=requestAnimationFrame(frame);
})();
