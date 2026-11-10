/* Skill tree as a metro map. Built from the existing .st-branch lists (they stay in the page for screen readers).
   One line per group, one station per skill, an interchange where one skill ties two lines together. */
(function(){
  var tree=document.querySelector('#toolkit .skilltree'),box=tree&&tree.querySelector('.st-branches');if(!tree||!box)return;
  var NS='http://www.w3.org/2000/svg',COL=['#e11d48','#f59e0b','#0ea5e9','#16a34a','#9333ea','#64748b'];
  var ORIG={'o-w':'Work','o-s':'SLB internship','o-p':'Side projects','o-u':'UTP','o-c':'Certification'};
  // draw order top to bottom, with the group's index in the page; start = first column; links tie a station to the line below
  var ORDER=[{g:0,start:2},{g:1,start:2,first:['SQL','PostgreSQL','Data modelling (3NF)']},{g:3,start:0},{g:2,start:3},{g:4,start:3},{g:5,start:0}];
  var LINKS=[['Process mapping','Data modelling (3NF)'],['PostgreSQL','Supabase'],['Vercel','Next.js'],['Python','Claude'],['Edge-case analysis','Statistics']];
  var groups=[].slice.call(box.querySelectorAll('.st-branch')).map(function(d){
    var b=d.querySelector('.st-t b');
    return{name:b?b.textContent:'',sub:(d.querySelector('.st-t small')||{}).textContent||'',st:[].slice.call(d.querySelectorAll('.st-leaves li')).map(function(li){
      return{n:li.firstChild.textContent.trim(),o:[].slice.call(li.querySelectorAll('.st-o i')).map(function(i){return i.className})}})}});
  if(groups.length<6)return;
  var DX=100,X0=250,ROW=126,Y0=150,W=X0+DX*10+130,H=Y0+ROW*5+60,pos={};
  function el(n,a,p){var e=document.createElementNS(NS,n);for(var k in a)e.setAttribute(k,a[k]);if(p)p.appendChild(e);return e}
  var svg=el('svg',{viewBox:'0 0 '+W+' '+H,role:'img','aria-label':'Skill tree drawn as a metro map: six lines, one per skill group, with interchanges where skills connect two lines. The same skills are listed below.',class:'mm-svg'});
  var back=el('g',{},svg),mid=el('g',{},svg),front=el('g',{},svg);
  ORDER.forEach(function(r){if(r.first){var st=groups[r.g].st,f=r.first.map(function(n){return st.filter(function(s){return s.n===n})[0]});groups[r.g].st=f.concat(st.filter(function(s){return f.indexOf(s)<0}))}});
  ORDER.forEach(function(r,ri){var g=groups[r.g],y=Y0+ri*ROW,c=COL[ri],x1=X0+r.start*DX,x2=X0+(r.start+g.st.length-1)*DX;
    // the line, with a 45 degree stub into the line badge
    el('path',{d:'M'+(x1-DX*.55)+' '+y+'H'+x2,class:'mm-line',stroke:c},back);
    el('path',{d:'M'+x2+' '+y+'l26 0',class:'mm-line',stroke:c},back);
    var tm=el('circle',{cx:x2+26,cy:y,r:9,class:'mm-term',stroke:c},back);
    var bx=x1-DX*.55-8;
    var lab=el('g',{class:'mm-badge',transform:'translate('+bx+' '+y+')'},mid);
    var tw=g.name.length*8.2+22;
    el('rect',{x:-tw,y:-15,width:tw,height:30,rx:15,fill:c},lab);var t=el('text',{x:-tw/2,y:5,'text-anchor':'middle'},lab);t.textContent=g.name;
    g.st.forEach(function(s,i){var x=X0+(r.start+i)*DX;pos[s.n]={x:x,y:y,c:c,r:ri};s.x=x;s.y=y;s.c=c});
  });
  // interchange capsules first so the stations sit on top
  var links=LINKS.filter(function(l){return pos[l[0]]&&pos[l[1]]&&pos[l[0]].x===pos[l[1]].x}).map(function(l){return{a:pos[l[0]],b:pos[l[1]],upper:l[0],lower:l[1]}});
  links.forEach(function(l){el('rect',{x:l.a.x-9,y:l.a.y-9,width:18,height:l.b.y-l.a.y+18,rx:9,class:'mm-x'},mid)});
  var linked={};links.forEach(function(l){linked[l.upper]=linked[l.lower]=1});
  ORDER.forEach(function(r,ri){groups[r.g].st.forEach(function(s,i){
    var isX=!!linked[s.n],gEl=el('g',{class:'mm-st'+(isX?' x':''),tabindex:0,role:'img','aria-label':s.n+(s.o.length?' · '+s.o.map(function(c){return ORIG[c.replace(/\s.*/,'')]||''}).join(', '):'')},front);
    if(!(isX&&linked[s.n]&&pos[s.n]&&links.some(function(l){return l.upper===s.n})))
      el('circle',{cx:s.x,cy:s.y,r:isX?9:7,class:'mm-dot',stroke:isX?'':s.c},gEl);
    else el('circle',{cx:s.x,cy:s.y,r:6,class:'mm-dot',stroke:s.c},gEl);
    if(isX&&!links.some(function(l){return l.upper===s.n}))el('circle',{cx:s.x,cy:s.y,r:6,class:'mm-dot',stroke:s.c},gEl);
    // label: tilted above the station. An interchange is labelled once, on its lower line.
    if(links.some(function(l){return l.upper===s.n})){var up=el('text',{x:s.x-15,y:s.y+30,class:'mm-lab mm-up','text-anchor':'end'},gEl);up.textContent=s.n}
    else{var tx=el('text',{x:s.x+6,y:s.y-16,class:'mm-lab',transform:'rotate(-38 '+(s.x+6)+' '+(s.y-16)+')'},gEl);tx.textContent=s.n}
    // where the skill came from, as small dots under the station
    s.o.forEach(function(cl,k){el('circle',{cx:s.x-(s.o.length-1)*4+k*8,cy:s.y+(isX?22:16),r:3.2,class:cl.replace(/\s.*/,'')+' mm-o'},gEl)});
  })});
  // two trains ride the Code and Foundations lines
  [[3,0],[5,1]].forEach(function(a){var ri=a[0],r=ORDER[ri],g=groups[r.g],y=Y0+ri*ROW,x1=X0+r.start*DX-DX*.55,x2=X0+(r.start+g.st.length-1)*DX+26;
    var tr=el('g',{class:'mm-train'},front);el('rect',{x:-26,y:-6,width:52,height:12,rx:6,fill:COL[ri],stroke:'#fff','stroke-width':2},tr);
    [-14,0,14].forEach(function(dx){el('rect',{x:dx-4,y:-3,width:8,height:4,rx:1,fill:'#fff'},tr)});
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches){var am=el('animateMotion',{dur:(a[1]?15:19)+'s',repeatCount:'indefinite',path:'M'+x1+' '+y+'H'+x2+'L'+x1+' '+y,keyPoints:'0;1;1;0;0',keyTimes:'0;.46;.5;.96;1',calcMode:'linear'},tr)}});
  var wrap=document.createElement('div');wrap.className='metro';
  var sc=document.createElement('div');sc.className='mm-scroll';sc.tabIndex=0;sc.setAttribute('aria-label','Metro map of skills, scroll sideways on a small screen');sc.appendChild(svg);wrap.appendChild(sc);
  var hint=document.createElement('p');hint.className='mm-hint';hint.innerHTML='Swipe sideways to ride the lines. A white capsule is an <b>interchange</b>: a skill that ties two lines together. Small dots show where each skill came from.';wrap.appendChild(hint);
  var fact=document.createElement('aside');fact.className='mm-fact';
  fact.innerHTML='<span class="mm-tkt" aria-hidden="true"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="14" rx="3.5"/><path d="M5 11h14M9 17l-2.5 4M15 17l2.5 4"/><circle cx="9" cy="14" r=".6"/><circle cx="15" cy="14" r=".6"/></svg></span><div><b>Fun fact: this is me.</b> I\'m a huge train and metro freak. That is why the skill tree is a metro map, and why trains run over the city behind you.</div>';
  wrap.appendChild(fact);
  tree.insertBefore(wrap,box);tree.classList.add('has-metro');
})();
