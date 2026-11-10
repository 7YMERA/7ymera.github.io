#!/usr/bin/env python3
"""Build v2/index.html from the home page (index.html).

/v2/ is the home page of the main site (every section, every component, all its scripts)
over the 3D Kuala Lumpur scene and its scroll flight. Run this after changing index.html:

    python3 tools/build-v2.py

It rewrites relative paths so they work from /v2/, swaps the aurora background for the
WebGL canvas, adds merge.css, a link back to the classic site, the flight section
(tools/v2-flight.html) and the three.js scripts. Nothing else is changed.
"""
import re, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
src = (root / 'index.html').read_text()
flight = (root / 'tools' / 'v2-flight.html').read_text()
KEY = '20261110d'  # cache key for the v2-only files

html = src

# 1. relative paths: assets/ and notes/ live one folder up
html = re.sub(r'(?<=["\'(])(assets|notes)/', r'../\1/', html)
html = html.replace('href="./"', 'href="../"')

# 2. head: preview title, no indexing, v2 stylesheet, pixel font for the HUD labels
html = re.sub(r'<title>.*?</title>', '<title>Alif Najmi · v2 preview</title>', html, 1)
html = re.sub(r'<meta property="og:[^>]*>\n?|<meta name="twitter:[^>]*>\n?', '', html)
html = html.replace('<meta name="theme-color" content="#0a6c74">', '<meta name="robots" content="noindex">\n<meta name="theme-color" content="#0b2a6b">')
html = html.replace('family=JetBrains+Mono:wght@400;500&display=swap', 'family=JetBrains+Mono:wght@400;500&family=Pixelify+Sans:wght@500;600&display=swap')
html = re.sub(r'(<link rel="stylesheet" href="\.\./assets/site\.css\?v=[^"]*">)', r'\1\n<link rel="stylesheet" href="merge.css?v=%s">' % KEY, html, 1)

# 3. the aurora sky becomes the WebGL canvas
assert '<div class="sky" aria-hidden="true"></div>' in html
html = html.replace('<div class="sky" aria-hidden="true"></div>', '<canvas id="gl" aria-hidden="true"></canvas>')

# 4. a way back to the classic site, in the top nav
html = html.replace('<a href="#contact">Contact</a>\n    </nav>', '<a href="#contact">Contact</a>\n      <a class="nav-v1" href="../">Classic site</a>\n    </nav>', 1)

# 5. the flight goes between the journey and the contact band
assert '<section class="contact" id="contact">' in html
html = html.replace('<section class="contact" id="contact">', flight.rstrip() + '\n\n  <section class="contact" id="contact">', 1)

# 6. three.js and the scene
html = html.replace('</body>', '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js" defer></script>\n<script src="v2-3d.js?v=%s" defer></script>\n</body>' % KEY, 1)

(root / 'v2' / 'index.html').write_text(html)
print('wrote v2/index.html', len(html), 'bytes')
