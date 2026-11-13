/* Shader text for the 3D city (assets/scene.js). Plain GLSL in template strings, no interpolation, so each block can be read and edited on its own.
   scene.js patches these into three.js materials with onBeforeCompile; the uniforms they use are set there (TU and cityU). Load this file before scene.js. */
window.SCENE_GLSL={
/* Three flat tones per face, picked by the face normal against one fixed light. Replaces <aomap_fragment> in every scene material (toon() in scene.js). */
toonShade:`#include <aomap_fragment>
        vec3 tn=normalize(cross(dFdx(vWP),dFdy(vWP)));
        float td=dot(tn,uLight);
        float tlit=smoothstep(0.40,0.44,td),tsh=1.0-smoothstep(-0.14,-0.10,td);
        vec3 bc=diffuseColor.rgb;
        vec3 cLit=mix(bc*uLitMul,vec3(0.97,0.99,1.0),uLitMix)*mix(vec3(1.0),uSunC,uSunAmt);
        reflectedLight.directDiffuse=vec3(0.0);
        reflectedLight.indirectDiffuse=mix(mix(bc*uMidMul,cLit,tlit),bc*uShadeMul,tsh);`,

/* Height and distance haze toward the page sky gradient. Replaces <fog_fragment> in every scene material. */
toonHaze:`#ifdef USE_FOG
        float hf=smoothstep(fogNear,fogFar,fogDepth);
        float hy=max(vWP.y,0.0);
        float hz=smoothstep(260.0,1700.0,distance(vWP,cameraPosition))*uHazeK*mix(0.15,1.0,exp(-hy/100.0));
        float he=smoothstep(uEdge.x,uEdge.y,length(vWP.xz))*exp(-hy/70.0);
        float ht=1.0-(1.0-hf)*(1.0-hz)*(1.0-he);
        float sy=1.0-gl_FragCoord.y/uRes.y; /* the CSS gradient: sky1 to sky2 at uStop, then to sky3 (day: uStop is 1, so sky3 never shows) */
        vec3 skyc=mix(mix(uSky1,uSky2,clamp(sy/uStop,0.0,1.0)),uSky3,clamp((sy-uStop)/max(1.0-uStop,0.0001),0.0,1.0));
        gl_FragColor.rgb=mix(gl_FragColor.rgb,skyc,ht);
      #endif`,

/* Uniforms and the hash and noise helpers of the facade shader. Goes before main() (facade() in scene.js). */
facadeHead:`uniform sampler2D uDay;uniform sampler2D uNightTex;uniform float uNight,uGlass;uniform vec4 uCut[4];uniform float uLo[4];
        float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h21(i),h21(i+vec2(1.0,0.0)),f.x),mix(h21(i+vec2(0.0,1.0)),h21(i+vec2(1.0,1.0)),f.x),f.y);}
        void main() {`,

/* The facade itself: the day grid, the night windows, each landmark's own lighting (li 0 Petronas, 1 Merdeka 118, 2 The Exchange 106, 3 Menara KL), street glow and day shade. Replaces <emissivemap_fragment>. */
facadeBody:`#include <emissivemap_fragment>
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
        totalEmissiveRadiance+=uNight*(vec3(1.0,0.95,0.86)*gP*mix(0.16+0.95*mix(smoothstep(0.08,0.24,fract(vWP.y/1.3))*(1.0-smoothstep(0.58,0.78,fract(vWP.y/1.3)))*smoothstep(0.0,0.16,fract(hq/1.15))*(1.0-smoothstep(0.76,0.94,fract(hq/1.15))),0.45,df),0.8,smoothstep(uCut[0].w+17.0,uCut[0].w+22.0,vWP.y))+ /* the crowns keep their windows: smaller floors and bays up the tiers, then the pinnacle's ball and mast lit solid */ gE*(vec3(0.5,0.4,1.0)*0.42+vec3(0.9,0.88,1.0)*mix(max(1.0-smoothstep(0.05,0.12,abs(fract((hq+vWP.y)/3.2)-0.5)),1.0-smoothstep(0.05,0.12,abs(fract((hq-vWP.y)/3.2)-0.5))),0.25,df)*0.85+vec3(1.0)*(1.0-step(uCut[2].w-2.2,vWP.y))*0.9)) /* The Exchange's crown: a violet lantern behind a white diamond lattice, with a bright white rim under it */;`
};
