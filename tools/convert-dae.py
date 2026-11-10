"""Flatten a SketchUp Collada (.dae) into the compact mesh json used by v2/v2-3d.js.
Usage: python3 -I convert_dae.py model.dae out.json "glassSubstr1,glassSubstr2" ["skipSubstr1,skipSubstr2"] | list"""
import sys, json, base64, collections
import numpy as np
import xml.etree.ElementTree as ET
src, out = sys.argv[1], sys.argv[2]
skip_keys = [k.lower() for k in (sys.argv[4].split(',') if len(sys.argv) > 4 and sys.argv[4] != 'list' else [])]
glass_keys = [k.lower() for k in (sys.argv[3].split(',') if len(sys.argv) > 3 and sys.argv[3] else [])]
root = ET.parse(src).getroot(); NS = root.tag.split('}')[0] + '}'
def f(e, p): return e.find(NS + p)
def fa(e, p): return e.findall('.//' + NS + p)
unit = float((fa(root, 'unit')[0].attrib.get('meter', '1')))
up = (fa(root, 'up_axis') or [None])[0]; up = up.text.strip() if up is not None else 'Y_UP'
# geometries -> list of (positions Nx3, tris Mx3, material symbol)
geoms = {}
for g in fa(root, 'geometry'):
    gid = g.attrib['id']; mesh = f(g, 'mesh')
    if mesh is None: continue
    srcs = {s.attrib['id']: np.array(f(s, 'float_array').text.split(), dtype=np.float64).reshape(-1, 3) for s in mesh.findall(NS + 'source') if f(s, 'float_array') is not None and int(f(s, 'technique_common').find(NS + 'accessor').attrib.get('stride', 3)) == 3}
    vmap = {}
    vert = f(mesh, 'vertices')
    if vert is not None:
        for i in vert.findall(NS + 'input'):
            if i.attrib['semantic'] == 'POSITION': vmap[vert.attrib['id']] = i.attrib['source'][1:]
    parts = []
    for t in mesh.findall(NS + 'triangles'):
        inputs = t.findall(NS + 'input'); stride = max(int(i.attrib['offset']) for i in inputs) + 1
        vi = [i for i in inputs if i.attrib['semantic'] == 'VERTEX'][0]; off = int(vi.attrib['offset'])
        pos = srcs[vmap[vi.attrib['source'][1:]]]
        p = np.array(f(t, 'p').text.split(), dtype=np.int64).reshape(-1, stride)[:, off].reshape(-1, 3)
        parts.append((pos, p, t.attrib.get('material', '')))
    geoms[gid] = parts
# materials: symbol -> name via bind_material at instance sites
matname = {m.attrib['id']: m.attrib.get('name', m.attrib['id']) for m in fa(root, 'material')}
nodes_lib = {n.attrib['id']: n for n in fa(root, 'library_nodes')[0].findall(NS + 'node')} if fa(root, 'library_nodes') else {}
def mat4(n):
    m = np.eye(4)
    for c in n:
        tag = c.tag.replace(NS, '')
        if tag == 'matrix': m = m @ np.array(c.text.split(), dtype=np.float64).reshape(4, 4)
    return m
tris = collections.defaultdict(list)  # material name -> list of (3x3 world tris)
def walk(n, parent):
    m = parent @ mat4(n)
    for ig in n.findall(NS + 'instance_geometry'):
        gid = ig.attrib['url'][1:]; sym = {}
        for im in fa(ig, 'instance_material'): sym[im.attrib['symbol']] = matname.get(im.attrib['target'][1:], im.attrib['target'][1:])
        for pos, p, msym in geoms.get(gid, []):
            w = (np.c_[pos, np.ones(len(pos))] @ m.T)[:, :3]
            tris[sym.get(msym, msym)].append(w[p])
    for inn in n.findall(NS + 'instance_node'):
        t = nodes_lib.get(inn.attrib['url'][1:])
        if t is not None: walk(t, m)
    for c in n.findall(NS + 'node'): walk(c, m)
vs = fa(root, 'visual_scene')[0]
for n in vs.findall(NS + 'node'): walk(n, np.eye(4))
allt = np.concatenate([np.concatenate(v) for v in tris.values()])
allt = allt * unit
if up == 'Z_UP': conv = lambda a: np.stack([a[..., 0], a[..., 2], -a[..., 1]], -1)
else: conv = lambda a: a
allt = conv(allt)
lo = allt.reshape(-1, 3).min(0); hi = allt.reshape(-1, 3).max(0)
shift = np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])
print('materials (tris):', {k: sum(len(x) for x in v) for k, v in tris.items()})
print('size m:', hi - lo)
if 'list' in sys.argv: sys.exit()
cls = {0: [], 1: []}
keep = [t for n_, l_ in tris.items() if not any(k in n_.lower() for k in skip_keys) for t in l_]
kall = conv(np.concatenate(keep) * unit); lo = kall.reshape(-1, 3).min(0); hi = kall.reshape(-1, 3).max(0)
shift = np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])
for name, lst in tris.items():
    if any(k in name.lower() for k in skip_keys): continue
    c = 1 if any(k in name.lower() for k in glass_keys) else 0
    for t in lst: cls[c].append(conv(t * unit) - shift)
verts = []; index = {}
def idx(tt):
    res = []
    for tri in tt:
        row = []
        for v in tri:
            k = (round(float(v[0]), 3), round(float(v[1]), 3), round(float(v[2]), 3))
            if k not in index: index[k] = len(verts); verts.append(k)
            row.append(index[k])
        res.append(row)
    return np.array(res, dtype=np.uint16)
b = idx(np.concatenate(cls[0]) if cls[0] else []) if cls[0] else np.zeros((0, 3), np.uint16)
g = idx(np.concatenate(cls[1])) if cls[1] else np.zeros((0, 3), np.uint16)
pos = np.array(verts, dtype=np.float32)
d = {'height': float(hi[1] - lo[1]), 'positions': base64.b64encode(pos.tobytes()).decode(), 'body': base64.b64encode(b.tobytes()).decode(), 'glass': base64.b64encode(g.tobytes()).decode(), 'counts': [len(b), len(g)]}
json.dump(d, open(out, 'w'), separators=(',', ':'))
print('verts', len(verts), 'tris body/glass', len(b), len(g), 'height', round(d['height'], 1))
