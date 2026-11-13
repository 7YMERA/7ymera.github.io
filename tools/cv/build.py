# Build the CV PDF: python3 tools/cv/build.py  (needs: pip install weasyprint)
import sys, pathlib
from weasyprint import HTML
d = pathlib.Path(__file__).parent
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else d.parent.parent / 'assets' / 'Muhammad-Alif-Najmi-CV.pdf'
HTML(d / 'cv.html').write_pdf(out)
print('wrote', out)
