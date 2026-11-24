/* Shader text for the 3D city (assets/scene.js). Plain GLSL in template strings, no interpolation, so each block can be read and edited on its own.
   scene.js patches these into three.js materials with onBeforeCompile; the uniforms they use are set there (TU and cityU). Load this file before scene.js. */
window.SCENE_GLSL={
/* Three flat tones per face, picked by the face normal against one fixed light. Replaces <aomap_fragment> in every scene material (toon() in scene.js). */
toonShade:`#include <aomap_fragment>
        vec3 tn=normalize(cross(dFdx(vWP),dFdy(vWP)));
        float td=dot(tn,uLight)+uWrap;
        float tlit=smoothstep(0.40,0.44,td),tsh=1.0-smoothstep(-0.14,-0.10,td);
        vec3 bc=diffuseColor.rgb;
        vec3 cLit=mix(bc*uLitMul,uLitC,uLitMix)*mix(vec3(1.0),uSunC,uSunAmt);
        reflectedLight.directDiffuse=vec3(0.0);
        reflectedLight.indirectDiffuse=mix(mix(bc*uMidMul,cLit,tlit),bc*uShadeMul,tsh);
        /* golden hour (uGold 0 by day and at night): the low sun only reaches the upper floors, so the street canyons sink into dusk while the crowns catch amber light */
        float cgh=smoothstep(25.0,210.0,vWP.y);
        reflectedLight.indirectDiffuse*=mix(1.0,mix(0.74,1.0,smoothstep(0.0,130.0,vWP.y)),uGold);
        reflectedLight.indirectDiffuse+=uSunC*uGlint*cgh*(0.3+0.7*tlit);`,

/* Height and distance haze toward the page sky gradient. Replaces <fog_fragment> in every scene material. */
toonHaze:`#ifdef USE_FOG
        float hf=smoothstep(fogNear,fogFar,fogDepth);
        float hy=max(vWP.y,0.0);
        float hz=smoothstep(260.0,1700.0,distance(vWP,cameraPosition))*uHazeK*mix(0.15,1.0,exp(-hy/100.0));
        float he=smoothstep(uEdge.x,uEdge.y,length(vWP.xz))*exp(-hy/70.0);
        float ht=1.0-(1.0-hf)*(1.0-hz)*(1.0-he);
        float sy=1.0-gl_FragCoord.y/uRes.y; /* the CSS gradient: sky1 to sky2 at uStop, then to sky3 (day: uStop is 1 and sky3 equals sky2, so the third stop never shows). Blended by SceneTime between day, golden hour and night. */
        vec3 skyc=mix(mix(uSky1,uSky2,clamp(sy/uStop,0.0,1.0)),uSky3,clamp((sy-uStop)/max(1.0-uStop,0.0001),0.0,1.0));
        gl_FragColor.rgb=mix(gl_FragColor.rgb,skyc,ht);
      #endif`,

/* Uniforms and the hash and noise helpers of the facade shader. Goes before main() (facade() in scene.js). */
facadeHead:`uniform sampler2D uDay;uniform sampler2D uNightTex;uniform sampler2D uTerrCol;uniform sampler2D uTerrAO;uniform float uNight,uGlass,uTime,uRain,uGoldF;uniform vec4 uCut[4];uniform float uLo[4];
        float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h21(i),h21(i+vec2(1.0,0.0)),f.x),mix(h21(i+vec2(0.0,1.0)),h21(i+vec2(1.0,1.0)),f.x),f.y);}
        void main() {`,

/* The facade itself: the day grid, real stitched PBR terrain flooring (Sahne 20-tile forest/rock atlas + Mixed AO across Klang Valley foothills, 3D Bukit Nanas Forest Eco Park hill, KLCC Park, Klang River & Lake Symphony basin), night windows, each landmark's own lighting (li 0 Petronas, 1 Merdeka 118, 2 The Exchange 106, 3 Menara KL), street glow and day shade. Replaces <emissivemap_fragment>. */
facadeBody:`#include <emissivemap_fragment>
        vec3 fn=normalize(cross(dFdx(vWP),dFdy(vWP)));
        float wall=1.0-smoothstep(0.45,0.75,abs(fn.y));
        bool onX=abs(fn.z)>abs(fn.x);
        vec2 fuv=(onX?vWP.xy:vWP.zy)/6.0;
        float hq=onX?vWP.x:vWP.z;
        float dl=dot(texture2D(uDay,fuv).rgb,vec3(0.333));
        float gd=distance(vWP,cameraPosition);float gk=mix(0.3*(1.0-smoothstep(70.0,420.0,gd)),0.75*(1.0-0.6*smoothstep(500.0,1200.0,gd)),uNight)*(1.0-uGlass); /* day: faint grid that clears with distance, so far blocks are clean tones; night keeps its grid. (The glass parts of the landmarks have no day grid.) */
        float bktDist=distance(vWP.xz,uCut[3].xy);
        float bktHill=smoothstep(50.0,42.0,bktDist)*smoothstep(6.0,10.5,bktDist)*(1.0-step(24.5,vWP.y))*smoothstep(0.18,0.45,abs(fn.y));
        float bktTop=smoothstep(12.0,8.0,bktDist)*smoothstep(20.0,22.2,vWP.y)*(1.0-step(24.5,vWP.y))*(1.0-wall);
        float hillG=smoothstep(385.0,460.0,length(vWP.xz))*smoothstep(0.18,0.45,abs(fn.y));
        float terrMask=clamp(max(max((1.0-wall)*(1.0-step(2.5,vWP.y)),hillG),max(bktHill,bktTop)),0.0,1.0);
        wall*=(1.0-clamp(bktHill+hillG,0.0,1.0));
        diffuseColor.rgb*=mix(1.0,clamp(dl*1.9,0.0,1.3),wall*gk);
        float low=1.0-smoothstep(0.5,11.0,max(vWP.y,0.0));
        float gnd=(1.0-wall)*(1.0-step(2.5,vWP.y));
        float rad=1.0-smoothstep(120.0,820.0,length(vWP.xz+vec2(60.0,60.0)));
        float pool=smoothstep(0.3,0.9,vn(vWP.xz/16.0))*0.7+0.3*vn(vWP.xz/5.0);
        float pg=mix(pool,0.45,smoothstep(120.0,500.0,gd));
        /* ---- natural KL terrain flooring using baked 20-tile PBR Sahne atlas (uTerrCol + uTerrAO) ---- */
        if(terrMask>0.01){
          float macroN=vn(vWP.xz/110.0)*0.6+vn(vWP.xz/36.0)*0.4;
          vec2 tuvMacro=clamp((vWP.xz+vec2(1350.0))/2700.0,0.002,0.998);
          vec2 tuvHi=fract(vWP.xz/260.0+vec2(0.37,0.19));
          vec3 tcMacro=texture2D(uTerrCol,tuvMacro).rgb;
          vec3 tcHi=texture2D(uTerrCol,tuvHi).rgb;
          float tao=mix(texture2D(uTerrAO,tuvMacro).r,texture2D(uTerrAO,tuvHi).r,0.45);
          vec3 rawTerr=mix(tcMacro,tcHi,0.42*(1.0-smoothstep(140.0,520.0,gd)))*(0.68+0.48*tao);
          /* harmonize real forest/rock PBR texture with Day, Golden Hour & Night palettes (zero pink) */
          vec3 terrDay=mix(rawTerr*1.55+vec3(0.08,0.14,0.14),vec3(0.36,0.56,0.50),0.22);
          vec3 terrGold=rawTerr*vec3(1.55,1.25,0.95)+vec3(0.10,0.07,0.04);
          vec3 terrNight=rawTerr*vec3(0.24,0.34,0.48)+vec3(0.02,0.04,0.09);
          vec3 terrCol=mix(mix(terrDay,terrGold,uGoldF),terrNight,uNight);
          /* KLCC Park (open plaza around (72,62)) + 3D Bukit Nanas hill + Titiwangsa mountain rim get full rich PBR forest/rock */
          float dKlccP=length((vWP.xz-vec2(68.0,60.0))/vec2(48.0,38.0))+macroN*0.24-0.12;
          float parkK=clamp(max(1.0-smoothstep(0.62,1.18,dKlccP),max(bktHill+bktTop,hillG)),0.0,1.0);
          /* subtle urban valley ground grain blended softly with macro terrain texture */
          vec3 urbBase=mix(diffuseColor.rgb*(0.90+0.16*tao),terrCol,0.34);
          vec3 floorTint=mix(urbBase,terrCol,parkK*0.92);
          /* subtle stone plaza aprons around Petronas, Merdeka & Exchange 106 (leaving Bukit Nanas forested) */
          float plz=0.0;
          for(int pi=0;pi<3;pi++){float dp=distance(vWP.xz,uCut[pi].xy);plz=max(plz,1.0-smoothstep(uCut[pi].z*0.78,uCut[pi].z*1.32,dp));}
          vec3 plazaCol=mix(mix(vec3(0.76,0.85,0.95),vec3(0.76,0.69,0.78),uGoldF),vec3(0.09,0.14,0.28),uNight);
          floorTint=mix(floorTint,plazaCol,plz*0.45*(1.0-hillG));
          /* Klang River meandering naturally across the west side of the city */
          float rCenter=-78.0+26.0*sin(vWP.z*0.0085)+11.0*cos(vWP.z*0.021);
          float rDist=abs(vWP.x-rCenter);
          float rBank=1.0-smoothstep(12.0,20.0,rDist);
          float rWater=(1.0-smoothstep(7.5,12.5,rDist))*(1.0-hillG)*(1.0-bktHill);
          float rip=vn(vec2(vWP.x*0.35,vWP.z*0.18-uTime*0.65))*0.5+vn(vec2(vWP.x*0.7+uTime*0.3,vWP.z*0.4))*0.5;
          vec3 watDay=vec3(0.32,0.60,0.86),watGold=vec3(0.82,0.58,0.42),watNight=vec3(0.04,0.11,0.24);
          vec3 watCol=mix(mix(watDay,watGold,uGoldF),watNight,uNight)+(0.08+0.12*uGoldF)*smoothstep(0.55,0.92,rip)*(1.0-uNight*0.5);
          floorTint=mix(floorTint,terrCol*0.86,rBank*0.55*(1.0-rWater)*(1.0-bktHill));
          floorTint=mix(floorTint,watCol,rWater);
          /* KLCC Symphony Lake basin in the open park plaza at (72, 62) */
          float lakeD=length((vWP.xz-vec2(72.0,62.0))/vec2(15.5,13.5));
          float lakeK=(1.0-smoothstep(0.86,1.06,lakeD))*(1.0-hillG);
          floorTint=mix(floorTint,watCol*1.08,lakeK);
          /* wet monsoon rain darkening & shimmer on the ground */
          float wetRip=uRain*(0.06+0.12*smoothstep(0.52,0.88,vn(vWP.xz*0.28+vec2(uTime*0.4,-uTime*0.25))));
          floorTint*=mix(1.0,0.82,uRain*terrMask);
          diffuseColor.rgb=mix(diffuseColor.rgb,floorTint,terrMask);
          totalEmissiveRadiance+=(rWater+lakeK)*uNight*vec3(0.18,0.34,0.58)*(0.22+0.35*rip)+wetRip*terrMask*mix(vec3(0.35,0.55,0.85),vec3(0.95,0.68,0.36),uNight*0.65)*rad;
        }
        diffuseColor.rgb*=1.0-(1.0-uNight)*(wall*low*0.2+gnd*rad*0.13*pg); /* by day the same shapes are shade, not light: darker feet on every building and soft cloud shadows drifting over the ground */
        /* ---- night: lit windows, per window cell, per building, stable in world space (skipped entirely in full daylight) ---- */
        if(uNight>0.001){
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
        /* Menara KL: the shaft floodlit crisp white with a warm ivory foot (no pink/magenta), the pod deep blue-indigo with rings of white lamps, white crown, lit lower antenna */
        float kw=li==3?step(vWP.y,uLo[3]):0.0;
        float kang=atan(vWP.z-uCut[3].y,vWP.x-uCut[3].x);
        float kfl=mix(0.84+0.16*step(0.5,fract(kang*24.0/6.2832)),0.92,df);
        wem+=mix(vec3(1.0,0.9,0.76),vec3(0.9,0.95,1.0),smoothstep(2.0,26.0,vWP.y))*(0.55+0.3*smoothstep(8.0,78.0,vWP.y))*kfl*kw*uNight;
        float kp=li==3?al:0.0;
        float kr=fract(vWP.y/2.1),kd=fract(kang*44.0/6.2832);
        float klamp=mix(smoothstep(0.3,0.5,kr)*(1.0-smoothstep(0.5,0.7,kr))*smoothstep(0.28,0.5,kd)*(1.0-smoothstep(0.5,0.72,kd)),0.16,df);
        float ktop=smoothstep(uCut[3].w-5.5,uCut[3].w-4.0,vWP.y);
        wem=mix(wem,(vec3(0.16,0.2,0.62)*0.55+vec3(0.95,0.97,1.0)*(klamp*1.9+ktop*0.9))*uNight,kp);
        wem+=vec3(0.92,0.96,1.0)*(li==3?step(uCut[3].w,vWP.y)*(1.0-smoothstep(uCut[3].w,uCut[3].w+22.0,vWP.y)):0.0)*0.8*uNight;
        /* sodium street light: amber at the feet of buildings and on the ground near them */
        vec3 sod=vec3(1.0,0.5,0.15)*uNight*(wall*low*(0.3+0.45*h21(vec2(floor(hq/4.0),bk.x*3.0+bk.y)))*0.8+gnd*rad*(0.04+0.2*pg));
        /* red aviation lights on a few of the tall flat roofs */
        vec2 rc2=floor(vWP.xz/18.0);
        float rl=step(0.9,fn.y)*step(36.0,vWP.y)*(1.0-lmF)*step(0.8,h21(rc2+vec2(11.3,5.9)))*(1.0-smoothstep(0.7,2.2,length(vWP.xz-(rc2+0.5)*18.0)))*uNight;
        totalEmissiveRadiance+=wem+sod+vec3(1.0,0.1,0.06)*rl*1.8;
        /* night glow of the landmarks: floodlit Petronas pinnacles, the lantern crown of The Exchange 106 */
        float gP=(1.0-step(uCut[0].z,distance(vWP.xz,uCut[0].xy)))*step(uCut[0].w,vWP.y);
        float gE=(1.0-step(uCut[2].z,distance(vWP.xz,uCut[2].xy)))*step(uCut[2].w-4.0,vWP.y);
        totalEmissiveRadiance+=uNight*(vec3(1.0,0.95,0.86)*gP*mix(0.16+0.95*mix(smoothstep(0.08,0.24,fract(vWP.y/1.3))*(1.0-smoothstep(0.58,0.78,fract(vWP.y/1.3)))*smoothstep(0.0,0.16,fract(hq/1.15))*(1.0-smoothstep(0.76,0.94,fract(hq/1.15))),0.45,df),0.8,smoothstep(uCut[0].w+17.0,uCut[0].w+22.0,vWP.y))+ /* the crowns keep their windows: smaller floors and bays up the tiers, then the pinnacle's ball and mast lit solid */ gE*(vec3(0.45,0.52,1.0)*0.42+vec3(0.9,0.88,1.0)*mix(max(1.0-smoothstep(0.05,0.12,abs(fract((hq+vWP.y)/3.2)-0.5)),1.0-smoothstep(0.05,0.12,abs(fract((hq-vWP.y)/3.2)-0.5))),0.25,df)*0.85+vec3(1.0)*(1.0-step(uCut[2].w-2.2,vWP.y))*0.9));
        }`
};
