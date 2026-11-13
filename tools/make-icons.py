#!/usr/bin/env python3
"""Build the local icon set from the GitHub avatar (pixel art, so NEAREST keeps edges crisp).
Usage: python3 tools/make-icons.py path/to/avatar.png   (writes assets/icons/*)"""
import sys, os
from PIL import Image
src = Image.open(sys.argv[1]).convert('RGB')           # RGB: no alpha, no metadata carried over
out = os.path.join(os.path.dirname(__file__), '..', 'assets', 'icons')
os.makedirs(out, exist_ok=True)
def scaled(n): return src.resize((n, n), Image.NEAREST)
for n in (32, 192, 512):
    scaled(n).save(f'{out}/favicon-{n}.png', optimize=True)
scaled(180).save(f'{out}/apple-touch-icon.png', optimize=True)
scaled(32).save(f'{out}/favicon.ico', format='ICO', sizes=[(16, 16), (32, 32)])
