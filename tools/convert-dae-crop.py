"""Crop one tower out of a big flattened Collada dump and simplify it by vertex clustering.
Usage: python3 -I crop_cluster.py dump.pkl out.json grid_m x0,x1,z0,z1 "glassSubstrs" "skipSubstrs" """
import sys, pickle, json, base64, numpy as np
D = pickle.load(open(sys.argv[1], 'rb')); out = sys.argv[2]; grid = float(sys.argv[3])
x0, x1, z0, z1 = [float(v) for v in sys.argv[4].split(',')]
glass_k = [k.lower() for k in sys.argv[5].split(',') if k]; skip_k = [k.lower() for k in sys.argv[6].split(',') if k]
cls = {0: [], 1: []}
for name, t in D.items():
    if any(k in name.lower() for k in skip_k): continue
    c = t.mean(1); m = (c[:, 0] >= x0) & (c[:, 0] <= x1) & (c[:, 2] >= z0) & (c[:, 2] <= z1)
    cls[1 if any(k in name.lower() for k in glass_k) else 0].append(t[m])
allv = np.concatenate([x.reshape(-1, 3) for l in cls.values() for x in l if len(x)])
lo = allv.min(0); hi = allv.max(0); shift = np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])
verts = {}; vl = []
def q(v):
    k = tuple(np.round((v - shift) / grid).astype(np.int64))
    if k not in verts: verts[k] = len(vl); vl.append(k)
    return verts[k]
res = {}
for c, l in cls.items():
    seen = set(); tr = []
    for arr in l:
        for t in arr:
            a, b, d = q(t[0]), q(t[1]), q(t[2])
            if a == b or b == d or a == d: continue
            key = tuple(sorted((a, b, d)))
            if key in seen: continue
            seen.add(key); tr.append([a, b, d])
    res[c] = np.array(tr, dtype=np.uint16) if tr else np.zeros((0, 3), np.uint16)
pos = (np.array(vl, dtype=np.float64) * grid).astype(np.float32)
if len(sys.argv) > 7 and sys.argv[7] == 'dry':
    print('grid', grid, 'verts', len(vl), 'tris body/glass', len(res[0]), len(res[1])); sys.exit()
d = {'height': float(pos[:, 1].max() - pos[:, 1].min()), 'positions': base64.b64encode(pos.tobytes()).decode(), 'body': base64.b64encode(res[0].tobytes()).decode(), 'glass': base64.b64encode(res[1].tobytes()).decode(), 'counts': [len(res[0]), len(res[1])]}
pos[:, 1] -= pos[:, 1].min()
d['positions'] = base64.b64encode(pos.tobytes()).decode()
json.dump(d, open(out, 'w'), separators=(',', ':')); print('wrote', out, 'verts', len(vl), 'tris', d['counts'], 'height', round(d['height'], 1))
