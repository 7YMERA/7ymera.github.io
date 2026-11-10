// Usage: node convert-klcc.js model.dae out.json [cellMetres=3]
// Flattens the SketchUp Collada (model.dae) to one welded mesh, in metres, Y up, centred on the Petronas Towers,
// in the same int16/uint16 base64 format as assets/city/kl_city.json (scale 0.1 m).
const fs=require('fs');
const src=process.argv[2],out=process.argv[3],cell=+process.argv[4]||3;
const s=fs.readFileSync(src,'utf8');let m;
const geoms={};
const gre=/<geometry id="([^"]+)"[^>]*>([\s\S]*?)<\/geometry>/g;
while((m=gre.exec(s))){const body=m[2],fa=/<float_array[^>]*>([^<]*)<\/float_array>/.exec(body);if(!fa)continue;
 const pos=Float64Array.from(fa[1].trim().split(/\s+/),Number),parts=[],tre=/<triangles[^>]*>([\s\S]*?)<\/triangles>/g;let t;
 while((t=tre.exec(body))){const inp=(t[1].match(/<input /g)||[]).length,p=/<p>([^<]*)<\/p>/.exec(t[1]);if(!p)continue;
  const idx=Int32Array.from(p[1].trim().split(/\s+/),Number),vi=new Int32Array(idx.length/inp);for(let i=0;i<vi.length;i++)vi[i]=idx[i*inp];parts.push(vi)}
 geoms[m[1]]={pos,parts}}
function parseNodes(txt){const re=/<(\/?)(node|matrix|instance_geometry|instance_node)\b([^>]*?)(\/?)>([^<]*)/g,root={kids:[],geo:[],inst:[],mat:null},st=[root];let t;
 while((t=re.exec(txt))){const [,close,tag,attrs,self,text]=t;
  if(tag==='node'){if(close){st.pop();continue}const n={id:(/id="([^"]*)"/.exec(attrs)||[])[1],mat:null,geo:[],inst:[],kids:[]};st[st.length-1].kids.push(n);if(!self)st.push(n)}
  else if(close)continue;
  else if(tag==='matrix')st[st.length-1].mat=Float64Array.from(text.trim().split(/\s+/),Number);
  else if(tag==='instance_geometry')st[st.length-1].geo.push(/url="#([^"]*)"/.exec(attrs)[1]);
  else if(tag==='instance_node')st[st.length-1].inst.push(/url="#([^"]*)"/.exec(attrs)[1])}
 return root}
const a=s.indexOf('<library_nodes>'),b=s.indexOf('</library_nodes>'),c=s.indexOf('<visual_scene'),d=s.indexOf('</visual_scene>');
const lib={};parseNodes(s.slice(a,b)).kids.forEach(k=>lib[k.id]=k);
const scene=parseNodes(s.slice(c,d));
const mul=(A,B)=>{const r=new Float64Array(16);for(let i=0;i<4;i++)for(let j=0;j<4;j++){let v=0;for(let k=0;k<4;k++)v+=A[i*4+k]*B[k*4+j];r[i*4+j]=v}return r};
const U=0.0254,tris=[];  // inches to metres
(function walk(n,P){const M=n.mat?mul(P,n.mat):P;
 for(const g of n.geo){const G=geoms[g];if(!G)continue;for(const vi of G.parts){const w=new Float32Array(vi.length*3);
  for(let i=0;i<vi.length;i++){const v=vi[i]*3,x=G.pos[v],y=G.pos[v+1],z=G.pos[v+2];
   w[i*3]=(M[0]*x+M[1]*y+M[2]*z+M[3])*U;w[i*3+1]=(M[8]*x+M[9]*y+M[10]*z+M[11])*U;w[i*3+2]=-(M[4]*x+M[5]*y+M[6]*z+M[7])*U}  // Z up -> Y up
  tris.push(w)}}
 for(const u of n.inst)if(lib[u])walk(lib[u],M);for(const k of n.kids)walk(k,M)})(scene,Float64Array.from([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]));
// centre on the two tallest spires (the Petronas Towers)
const peaks=[];for(const w of tris)for(let i=0;i<w.length;i+=3)if(w[i+1]>440)peaks.push(w[i],w[i+2]);
let cx=0,cz=0;for(let i=0;i<peaks.length;i+=2){cx+=peaks[i];cz+=peaks[i+1]}cx/=peaks.length/2;cz/=peaks.length/2;
const vmap=new Map(),verts=[],seen=new Set(),idx=[];
const vid=(x,y,z)=>{const i=Math.round((x-cx)/cell),j=Math.round(y/cell),k=Math.round((z-cz)/cell),key=i+','+j+','+k;let v=vmap.get(key);if(v===undefined){v=verts.length/3;vmap.set(key,v);verts.push(i*cell,j*cell,k*cell)}return v};
for(const w of tris)for(let o=0;o<w.length;o+=9){
 if(w[o+1]<-1&&w[o+4]<-1&&w[o+7]<-1)continue;                       // below ground
 const p=vid(w[o],w[o+1],w[o+2]),q=vid(w[o+3],w[o+4],w[o+5]),r=vid(w[o+6],w[o+7],w[o+8]);
 if(p===q||q===r||p===r)continue;                                  // collapsed by the weld
 const key=[p,q,r].sort((x,y)=>x-y).join(',');if(seen.has(key))continue;seen.add(key);idx.push(p,q,r)}
if(verts.length/3>65535)throw new Error('over 65535 vertices; raise the cell size');
const scale=0.1,pos=new Int16Array(verts.length);for(let i=0;i<verts.length;i++)pos[i]=Math.round(verts[i]/scale);
fs.writeFileSync(out,JSON.stringify({scale,positions:Buffer.from(pos.buffer).toString('base64'),indices:Buffer.from(new Uint16Array(idx).buffer).toString('base64')}));
console.log('centre',cx.toFixed(1),cz.toFixed(1),'| verts',verts.length/3,'tris',idx.length/3,'| bytes',fs.statSync(out).size);
