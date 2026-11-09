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
  // KLCC: stepped octagons, each step turned 22.5deg so the plan reads as a star
  function klcc(x){
    var h=0,steps=[[11,12,16],[10.4,11,14],[9.8,10.4,14],[9,9.8,12],[8.2,9,12],[7.2,8.2,11],[6,7.2,10],[4.6,6,9],[3.2,4.6,8]];
    steps.forEach(function(s,i){var m=new T.Mesh(new T.CylinderGeometry(s[0],s[1],s[2],8,1),i%3===1?towerB:tower);
      m.rotation.y=(i%2)*Math.PI/8;m.position.set(x,h+s[2]/2,0);g.add(m);h+=s[2]});
    var sp=new T.Mesh(new T.ConeGeometry(1.8,22,6),glassM);sp.position.set(x,h+11,0);g.add(sp);
    var tip=new T.Mesh(new T.CylinderGeometry(.25,.25,16,5),glassM);tip.position.set(x,h+30,0);g.add(tip);
    return h}
  var H=klcc(-16);klcc(16);
  // skybridge, two angled legs
  var br=new T.Mesh(new T.BoxGeometry(24,3,4),glassM);br.position.set(0,H*.45,0);g.add(br);
  [-1,1].forEach(function(s){var l=new T.Mesh(new T.BoxGeometry(1.2,22,1.2),towerB);l.position.set(s*6,H*.45-11,0);l.rotation.z=s*.55;g.add(l)});
  // podium and mall
  var pd=new T.Mesh(new T.BoxGeometry(110,7,54),podium);pd.position.set(0,3.5,0);g.add(pd);
  var pd2=new T.Mesh(new T.BoxGeometry(70,5,34),podium);pd2.position.set(0,9.5,30);g.add(pd2);
  var gr=new T.Mesh(new T.CircleGeometry(520,48),ground);gr.rotation.x=-Math.PI/2;gr.position.y=-.2;g.add(gr);
  // city ring
  var s=11;function rnd(){s=(s*9301+49297)%233280;return s/233280}
  for(var i=0;i<130;i++){var a=rnd()*6.283,d=135+rnd()*240,w=8+rnd()*18,h=8+rnd()*(d<160?55:35);
    var b=new T.Mesh(new T.BoxGeometry(w,h,w*(.7+rnd()*.6)),d<170?city:cityF);b.position.set(Math.cos(a)*d,h/2,Math.sin(a)*d);b.rotation.y=rnd()*3;g.add(b)}
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
    ringM.color.set(C.ring);specks.material.color.set(C.ring);
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
    var k=Math.min(1,p*5),ox=mobile?0:-W*.2*(1-k),oy=mobile?-Hh*.2*(1-k):0;
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
