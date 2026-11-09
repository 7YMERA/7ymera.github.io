(function(){
  var root=document.documentElement,cv=document.getElementById('sky'),scene=document.getElementById('scene');
  var ctx=cv.getContext('2d'),W=0,H=0,dpr=1,t=0,vis=true,raf=0,px=0,py=0,tx=0,ty=0;
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var C={};
  function theme(){try{return localStorage.getItem('v2-theme')}catch(e){return null}}
  function setTheme(v){root.setAttribute('data-theme',v);document.getElementById('theme-label').textContent=v==='dark'?'Light':'Dark';try{localStorage.setItem('v2-theme',v)}catch(e){}readColors();draw()}
  function v(n){return getComputedStyle(root).getPropertyValue(n).trim()}
  function readColors(){['far','mid','near','glass','orb','ring','ink','sky1','sky2'].forEach(function(k){C[k]=v('--'+k)})}
  function shade(hex,f){var m=/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);if(!m)return hex;
    var r=[1,2,3].map(function(i){return Math.max(0,Math.min(255,Math.round(parseInt(m[i],16)*f)))});return 'rgb('+r+')'}
  function resize(){var r=scene.getBoundingClientRect();dpr=Math.min(window.devicePixelRatio||1,2);W=r.width;H=r.height;cv.width=W*dpr;cv.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);draw()}
  // prism: front face, darker right face, lighter top
  function prism(x,y,w,h,d,col){
    ctx.fillStyle=col;ctx.fillRect(x,y-h,w,h);
    ctx.fillStyle=shade(col,.78);ctx.beginPath();ctx.moveTo(x+w,y-h);ctx.lineTo(x+w+d,y-h-d*.6);ctx.lineTo(x+w+d,y-d*.6);ctx.lineTo(x+w,y);ctx.fill();
    ctx.fillStyle=shade(col,1.12);ctx.beginPath();ctx.moveTo(x,y-h);ctx.lineTo(x+d,y-h-d*.6);ctx.lineTo(x+w+d,y-h-d*.6);ctx.lineTo(x+w,y-h);ctx.fill()}
  function tower(x,base,w,h,col,steps){
    var sh=h/steps;for(var i=0;i<steps;i++){var k=1-i*(.55/steps);var ww=w*k;prism(x+(w-ww)/2,base-i*sh,ww,sh+1,w*.18*k,col)}}
  function layer(par,col,seed,count,minH,maxH,base){
    var ox=px*par,x=-40+ox,s=seed;
    function rnd(){s=(s*9301+49297)%233280;return s/233280}
    while(x<W+60){var w=24+rnd()*38,h=minH+rnd()*(maxH-minH);prism(x,base,w,h,w*.25,col);x+=w+8+rnd()*14}}
  function draw(){
    if(!W)return;
    var g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,C.sky1);g.addColorStop(1,C.sky2);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    // drifting dots
    ctx.fillStyle=C.ring;ctx.globalAlpha=.6;
    for(var i=0;i<26;i++){var sx=(i*137.5)%W,sy=(i*71.3)%(H*.7),dr=(t*.012*(1+i%3)+i*40)%W;
      ctx.beginPath();ctx.arc((sx+dr+px*6)%W,sy+Math.sin(t*.001+i)*4,1.2+(i%3),0,6.283);ctx.fill()}
    ctx.globalAlpha=1;
    // orb with ring
    var mob=W<=820,ox=W*(mob?.82:.9)+px*14,oy=H*(mob?.46:.26)+py*8+Math.sin(t*.0008)*6,or=Math.min(W,H)*(mob?.07:.1)+10;
    ctx.save();ctx.translate(ox,oy);
    ctx.fillStyle=C.orb;ctx.beginPath();ctx.arc(0,0,or,0,6.283);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.18)';ctx.beginPath();ctx.arc(-or*.3,-or*.3,or*.55,0,6.283);ctx.fill();
    ctx.strokeStyle=C.ring;ctx.lineWidth=Math.max(4,or*.12);ctx.beginPath();ctx.ellipse(0,0,or*1.55,or*.5,-.35,0,6.283);ctx.stroke();
    ctx.restore();
    var base=H-20;
    layer(6,C.far,7,0,40,120,base-30);
    layer(14,C.mid,21,0,50,150,base-10);
    // KL Tower
    var kx=W*(mob?.12:.5)+px*20;prism(kx,base,10,H*.34,4,C.mid);
    ctx.fillStyle=C.glass;ctx.beginPath();ctx.ellipse(kx+7,base-H*.34,16,8,0,0,6.283);ctx.fill();
    prism(kx+4,base-H*.34-6,4,H*.1,2,C.near);
    // twin towers
    var cx=W*(mob?.55:.7)+px*30,th=Math.min(H*(mob?.36:.62),420),tw=Math.min(54,W*.07);
    tower(cx-tw-8,base,tw,th,C.near,9);tower(cx+8,base,tw,th,C.near,9);
    ctx.fillStyle=C.glass;ctx.fillRect(cx-8,base-th*.45,16,8);
    ctx.fillStyle=C.glass;ctx.globalAlpha=.7;
    for(var r=0;r<14;r++){ctx.fillRect(cx-tw-8+tw*.2,base-th*(.08+r*.065),tw*.6,2);ctx.fillRect(cx+8+tw*.2,base-th*(.08+r*.065),tw*.6,2)}
    ctx.globalAlpha=1;
    layer(26,C.near,33,0,30,90,base+14);
    ctx.fillStyle=shade(C.near,.8);ctx.fillRect(0,base,W,H-base)}
  function loop(ts){t=ts;px+=(tx-px)*.06;py+=(ty-py)*.06;draw();raf=vis?requestAnimationFrame(loop):0}
  function start(){if(!reduce&&vis&&!raf)raf=requestAnimationFrame(loop)}
  scene.addEventListener('pointermove',function(e){var r=scene.getBoundingClientRect();tx=(e.clientX-r.left)/r.width-.5;ty=(e.clientY-r.top)/r.height-.5});
  if('IntersectionObserver' in window)new IntersectionObserver(function(es){vis=es[0].isIntersecting;if(vis)start();else{cancelAnimationFrame(raf);raf=0}}).observe(scene);
  document.getElementById('theme-btn').addEventListener('click',function(){setTheme(root.getAttribute('data-theme')==='dark'?'light':'dark')});
  var mail=document.getElementById('copy-mail'),toast=document.getElementById('toast');
  mail.addEventListener('click',function(){var a=mail.getAttribute('data-copy');
    (navigator.clipboard?navigator.clipboard.writeText(a):Promise.reject()).then(function(){toast.textContent='Copied '+a},function(){toast.textContent='Email: '+a})});
  var saved=theme();if(saved==='dark'||saved==='light')root.setAttribute('data-theme',saved);
  document.getElementById('theme-label').textContent=root.getAttribute('data-theme')==='dark'?'Light':'Dark';
  readColors();window.addEventListener('resize',resize);resize();start();
})();
