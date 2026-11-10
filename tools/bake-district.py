"""Bake the KL City Centre SketchUp scene into assets/city/klcc_district.json (the background map).
Two steps (the original model.dae is 69 MB and lives on branch kl-poly-design, not on main):
  python3 -I tools/convert-dae-dump.py model.dae /tmp/kl.pkl ""      # flatten the scene to triangles, metres, Y up
  python3 -I tools/bake-district.py /tmp/kl.pkl assets/city/klcc_district.json [radiusMetres=1100] [weldMetres=1]
Centres on the Petronas Towers (x east, z south), drops triangles that are entirely under ground or farther than the radius,
welds vertices on a grid (finer than the old 3 m weld, which collapsed thin walls and left buildings hollow), raises the weld
until there are at most 65535 vertices (16-bit indices), and writes positions as int16 in 0.1 m units."""
import sys, pickle, json, base64
import numpy as np
src, out = sys.argv[1], sys.argv[2]
R = float(sys.argv[3]) if len(sys.argv) > 3 else 1100.0
w = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0
D = pickle.load(open(src, 'rb'))   # your own output of convert-dae-dump.py: only load pickles you made
a = np.concatenate(list(D.values()))
top = a[a.mean(1)[:, 1] > 430].reshape(-1, 3); cx, cz = top[:, 0].mean(), top[:, 2].mean()
c = a.mean(1); keep = (a[:, :, 1].max(1) > -1) & (np.hypot(c[:, 0] - cx, c[:, 2] - cz) < R)
a = a[keep] - [cx, 0, cz]
print('triangles in range', len(a), 'centre', round(cx, 1), round(cz, 1))
while True:
    q = np.round(a / w).astype(np.int32)
    ok = (q[:, 0] != q[:, 1]).any(1) & (q[:, 1] != q[:, 2]).any(1) & (q[:, 0] != q[:, 2]).any(1)
    q = q[ok]; flat = q.reshape(-1, 3)
    u, inv = np.unique(flat, axis=0, return_inverse=True)
    if len(u) <= 65535: break
    w *= 1.1
tri = inv.reshape(-1, 3)
key = np.sort(tri, axis=1); _, first = np.unique(key, axis=0, return_index=True); tri = tri[np.sort(first)]   # drop duplicate faces
pos = np.round(u * w / 0.1).astype(np.int16)
d = {'scale': 0.1, 'positions': base64.b64encode(pos.tobytes()).decode(), 'indices': base64.b64encode(tri.astype(np.uint16).tobytes()).decode()}
json.dump(d, open(out, 'w'), separators=(',', ':'))
print('weld', round(w, 2), 'verts', len(u), 'tris', len(tri), 'bytes', len(json.dumps(d)))
