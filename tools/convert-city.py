"""Binary FBX of an OpenStreetMap city (blender-osm style) -> compact json for v2/v2-3d.js.
Usage: python3 -I convert-city.py city.fbx out.json
Reads the building meshes (every Geometry except the ground plane), triangulates the polygons, drops buildings inside the
exclusion circles (where hand-made landmark models stand instead), recentres on KLCC and quantises positions to 0.1 m (int16).
Edit CENTER and CLEAR below for a different map. Units are metres, Y is up (the FBX stores scale 100 on cm units, i.e. metres)."""
import sys, struct, zlib, json, base64
import numpy as np

# ---------- minimal binary FBX reader ----------
def read_fbx(path):
    d = open(path, 'rb').read()
    assert d[:20] == b'Kaydara FBX Binary  '
    ver = struct.unpack('<I', d[23:27])[0]; wide = ver >= 7500; pos = 27
    def rec(pos):
        if wide: end, nprops, plen, nlen = struct.unpack('<QQQB', d[pos:pos+25]); pos += 25
        else: end, nprops, plen, nlen = struct.unpack('<IIIB', d[pos:pos+13]); pos += 13
        if end == 0: return None, pos
        name = d[pos:pos+nlen].decode('latin1'); pos += nlen; props = []
        for _ in range(nprops):
            t = chr(d[pos]); pos += 1
            if t in 'YCFDLIB':
                fmt = {'Y': '<h', 'C': '<?', 'F': '<f', 'D': '<d', 'L': '<q', 'I': '<i', 'B': '<B'}[t]
                props.append(struct.unpack(fmt, d[pos:pos+struct.calcsize(fmt)])[0]); pos += struct.calcsize(fmt)
            elif t in 'fdlib':
                n, enc, clen = struct.unpack('<III', d[pos:pos+12]); pos += 12
                raw = d[pos:pos+clen]; pos += clen
                if enc == 1: raw = zlib.decompress(raw)
                props.append(np.frombuffer(raw, dtype={'f': '<f4', 'd': '<f8', 'l': '<i8', 'i': '<i4', 'b': '?'}[t]))
            elif t in 'SR':
                n = struct.unpack('<I', d[pos:pos+4])[0]; pos += 4; raw = d[pos:pos+n]; pos += n
                props.append(raw.decode('latin1') if t == 'S' else raw)
            else: raise ValueError(t)
        kids = []
        while pos < end:
            c, pos = rec(pos)
            if c is None: break
            kids.append(c)
        return (name, props, kids), end
    nodes = []
    while pos < len(d) - 200:
        n, pos = rec(pos)
        if n is None: break
        nodes.append(n)
    return nodes

def triangulate(P, ids):
    if len(ids) == 3: return [ids]
    n = np.zeros(3)
    for i in range(len(ids)): n += np.cross(P[i], P[(i+1) % len(ids)])
    if np.linalg.norm(n) < 1e-12: return []
    ax = int(np.argmax(np.abs(n))); k = [0, 1, 2]; k.remove(ax); p2 = P[:, k]; sg = 1 if n[ax] > 0 else -1
    idx = list(range(len(ids))); res = []
    cross = lambda o, a, b: (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
    guard = 0
    while len(idx) > 3 and guard < 5000:
        guard += 1; ear = False
        for j in range(len(idx)):
            i0, i1, i2 = idx[j-1], idx[j], idx[(j+1) % len(idx)]
            a, b, c = p2[i0], p2[i1], p2[i2]
            if sg*cross(a, b, c) <= 1e-9: continue
            if any(sg*cross(a, b, p2[q]) >= -1e-9 and sg*cross(b, c, p2[q]) >= -1e-9 and sg*cross(c, a, p2[q]) >= -1e-9 for q in idx if q not in (i0, i1, i2)): continue
            res.append([ids[i0], ids[i1], ids[i2]]); idx.pop(j); ear = True; break
        if not ear: break
    if len(idx) == 3: res.append([ids[idx[0]], ids[idx[1]], ids[idx[2]]])
    elif len(idx) > 3:
        for j in range(1, len(idx)-1): res.append([ids[idx[0]], ids[idx[j]], ids[idx[j+1]]])
    return res

CENTER = (-524.5, -320.0)   # KLCC, the midpoint of the twin towers in this map (x, z)
# (x, z, radius) in map metres: KLCC and its mall, plus the spots where Merdeka 118, Exchange 106 and Menara KL are placed in the scene (SC = 132/444.138)
SC = 132 / 444.138
def to_map(wx, wz): return (CENTER[0] + wx / SC, CENTER[1] + wz / SC)
CLEAR = [(CENTER[0], CENTER[1], 150)] + [to_map(wx, wz) + (r,) for wx, wz, r in ((-10, -95, 235), (60, -125, 100), (-95, -70, 50))]

if __name__ == '__main__':
    src, out = sys.argv[1], sys.argv[2]
    obj = {n[0]: n for n in read_fbx(src)}['Objects']
    geoms = [c for c in obj[2] if c[0] == 'Geometry']
    allv = []; alli = []; off = 0; dropped = kept = 0
    for g in geoms:
        ch = {c[0]: c for c in g[2]}
        v = ch['Vertices'][1][0].reshape(-1, 3).astype(np.float64); pi = ch['PolygonVertexIndex'][1][0].astype(np.int64)
        if len(v) > 100000: continue   # the dense ground plane
        polys = []; cur = []
        for i in pi:
            if i < 0: cur.append(~i); polys.append(cur); cur = []
            else: cur.append(i)
        par = list(range(len(v)))
        def f(a):
            while par[a] != a: par[a] = par[par[a]]; a = par[a]
            return a
        for p in polys:
            r = f(p[0])
            for q in p[1:]:
                rq = f(q)
                if rq != r: par[rq] = r
        root = np.array([f(i) for i in range(len(v))])
        cx = {}; 
        for r in np.unique(root): cx[r] = v[root == r][:, [0, 2]].mean(0)
        drop = {r for r, c in cx.items() if any(np.hypot(c[0]-x, c[1]-z) < rad for x, z, rad in CLEAR)}
        tris = []
        for p in polys:
            if f(p[0]) in drop: dropped += 1; continue
            kept += 1; tris += triangulate(v[p], p)
        tris = np.array(tris, dtype=np.int64)
        used = np.unique(tris); remap = -np.ones(len(v), dtype=np.int64); remap[used] = np.arange(len(used)) + off
        allv.append(v[used]); alli.append(remap[tris]); off += len(used)
    V = np.concatenate(allv); I = np.concatenate(alli)
    V[:, 0] -= CENTER[0]; V[:, 2] -= CENTER[1]
    V[:, 1] += 22.79   # the map's ground plane sits at -22.79 m; put it at y = 0
    q = np.round(V / 0.1).astype(np.int16)
    assert len(V) < 65535
    d = {'scale': 0.1, 'positions': base64.b64encode(q.tobytes()).decode(), 'indices': base64.b64encode(I.astype(np.uint16).tobytes()).decode(), 'tris': int(len(I)), 'verts': int(len(V))}
    json.dump(d, open(out, 'w'), separators=(',', ':'))
    print('polys kept/dropped', kept, dropped, 'verts', len(V), 'tris', len(I), 'bytes', len(json.dumps(d)))
