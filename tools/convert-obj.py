"""OBJ -> compact mesh json for v2/v2-3d.js (positions float32, body/glass uint16 triangle indices, base64).
Usage: python3 -I convert-obj.py model.obj out.json [glassMaterials] [glassYMin,glassYMax]
  glassMaterials: comma list of material names (or prefixes ending in *) coloured as glass; use "" for none.
  glassYMin,glassYMax: also treat triangles whose centre height (model units) falls in this band as glass.
The model is recentred on its bounding box in x/z and dropped so its lowest point is y = 0. Y is up."""
import numpy as np, base64, json, sys, collections
src, out = sys.argv[1], sys.argv[2]
YB = [float(x) for x in sys.argv[4].split(',')] if len(sys.argv) > 4 else None
V=[]; faces=[]; cur=None
for line in open(src, errors='ignore'):
    t=line.split()
    if not t: continue
    if t[0]=='v': V.append([float(x) for x in t[1:4]])
    elif t[0]=='usemtl': cur=t[1]
    elif t[0]=='f': faces.append((cur,[int(p.split('/')[0])-1 for p in t[1:]]))
V=np.array(V,dtype=np.float64)
def tri(ids):
    if len(ids)==3: return [ids]
    P=V[ids]; n=np.zeros(3)
    for i in range(len(ids)):
        a,b=P[i],P[(i+1)%len(ids)]; n+=np.cross(a,b)
    if np.linalg.norm(n)<1e-12: return []
    ax=np.argmax(np.abs(n)); k=[0,1,2]; k.remove(ax); p2=P[:,k]
    if n[ax]<0: p2=p2[:,[1,0]] if False else p2  # orientation fixed below
    sgn=1 if n[ax]>0 else -1
    idx=list(range(len(ids))); res=[]
    def cross(o,a,b): return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
    guard=0
    while len(idx)>3 and guard<10000:
        guard+=1; ear=False
        for j in range(len(idx)):
            i0,i1,i2=idx[j-1],idx[j],idx[(j+1)%len(idx)]
            a,b,c=p2[i0],p2[i1],p2[i2]
            if sgn*cross(a,b,c)<=1e-12: continue
            ok=True
            for q in idx:
                if q in (i0,i1,i2): continue
                pt=p2[q]; d1=cross(a,b,pt); d2=cross(b,c,pt); d3=cross(c,a,pt)
                if sgn*d1>=-1e-12 and sgn*d2>=-1e-12 and sgn*d3>=-1e-12: ok=False;break
            if ok: res.append([ids[i0],ids[i1],ids[i2]]); idx.pop(j); ear=True; break
        if not ear: break
    if len(idx)==3: res.append([ids[idx[0]],ids[idx[1]],ids[idx[2]]])
    elif len(idx)>3:  # fallback fan
        for j in range(1,len(idx)-1): res.append([ids[idx[0]],ids[idx[j]],ids[idx[j+1]]])
    return res
GLASS=set(x for x in (sys.argv[3].split(',') if len(sys.argv)>3 else []) if x)
cls={0:[],1:[]}
for m,ids in faces:
    c=1 if (m in GLASS or any(g.endswith('*') and (m or '').startswith(g[:-1]) for g in GLASS)) else 0
    for t3 in tri(ids):
        cc=c
        if YB and YB[0]<=V[t3][:,1].mean()<=YB[1]: cc=1
        cls[cc].append(t3)
# recentre: tower centre in x,z, ground at y=0
used0=sorted({i for c in cls.values() for t in c for i in t}); cx=(V[used0,0].min()+V[used0,0].max())/2; cz=(V[used0,2].min()+V[used0,2].max())/2; ymin=V[used0,1].min()
V[:,0]-=cx; V[:,2]-=cz; V[:,1]-=ymin
used=sorted({i for c in cls.values() for t in c for i in t}); remap={o:n for n,o in enumerate(used)}
pos=V[used].astype(np.float32)
def idxb(c): return base64.b64encode(np.array([[remap[i] for i in t] for t in c],dtype=np.uint16).tobytes()).decode()
d={'height':float(V[:,1].max()),'positions':base64.b64encode(pos.tobytes()).decode(),'body':idxb(cls[0]),'glass':idxb(cls[1]),'counts':[len(cls[0]),len(cls[1])]}
json.dump(d,open(out,'w'),separators=(',',':'))
print('verts',len(used),'tris body/glass',len(cls[0]),len(cls[1]),'height',d['height'],'bytes',len(json.dumps(d)))
