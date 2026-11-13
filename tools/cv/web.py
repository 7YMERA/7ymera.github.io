# Build resume.html (the on-site CV) from tools/cv/cv.html so the PDF and the page never drift.
# Run after editing cv.html:  python3 tools/cv/build.py && python3 tools/cv/web.py
import re, pathlib
d = pathlib.Path(__file__).parent; root = d.parent.parent
src = (d / 'cv.html').read_text()
body = src[src.index('<h2>Summary</h2>'):src.index('</body>')]
body = body.replace('<h2>', '<h2 class="cv-h">').replace('class="job"', 'class="cv-job"')
body = re.sub(r'<small>(.*?)</small>', r'<small class="cv-sm">\1</small>', body)
V = re.search(r'site\.css\?v=(\w+)', (root / 'index.html').read_text()).group(1)
CV_V = 'cv' + V
html = f'''<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Résumé · Alif Najmi</title>
<meta name="description" content="Muhammad Alif Najmi Md Hisamudin: Business Analyst, Data and AI solutions. Experience, projects, education and skills.">
<meta property="og:title" content="Résumé · Alif Najmi">
<meta property="og:description" content="Business Analyst, Data and AI solutions. Computer Science (Hons), Universiti Teknologi PETRONAS.">
<meta property="og:image" content="https://7ymera.github.io/assets/og-skyline-3.jpg">
<meta property="og:url" content="https://7ymera.github.io/resume.html">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="https://7ymera.github.io/resume.html">
<meta name="theme-color" content="#0b2a6b">
<link rel="icon" href="/assets/icons/favicon.ico" sizes="32x32">
<link rel="icon" type="image/png" sizes="192x192" href="/assets/icons/favicon-192.png">
<link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Albert+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="assets/site.css?v={V}">
<link rel="stylesheet" href="assets/scene.css?v={V}">
<style>
.cv-page {{ max-width: 860px; margin: 0 auto; padding: 28px 0 64px; }}
.cv-top {{ display: grid; gap: 10px; margin-bottom: 8px; }}
.cv-top h1 {{ font-size: var(--step-4, clamp(2rem, 6vw, 3rem)); line-height: 1.05; letter-spacing: -.02em; font-weight: 800; }}
.cv-top .tag {{ color: var(--muted); }}
.cv-top .cv-contact {{ color: var(--muted); font-size: .95rem; }}
.cv-actions {{ display: flex; gap: 10px; flex-wrap: wrap; margin: 6px 0 4px; }}
.cv-btn {{ display: inline-flex; align-items: center; min-height: 44px; padding: 0 18px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font: 600 .95rem var(--f-body); text-decoration: none; cursor: pointer; }}
.cv-btn.primary {{ background: var(--accent); color: var(--accent-ink); border-color: var(--accent); }}
.cv-btn:hover {{ border-color: var(--accent); }}
.cv-body {{ background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 8px 28px 28px; }}
.cv-h {{ font-family: var(--f-mono); font-size: .8rem; letter-spacing: .08em; text-transform: uppercase; color: var(--accent); border-bottom: 1px solid var(--line); padding: 0 0 6px; margin: 28px 0 10px; display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; }}
.cv-sm {{ font: 400 .75rem var(--f-body); text-transform: none; letter-spacing: 0; color: var(--muted); }}
.cv-job {{ margin: 14px 0 0; }}
.cv-job .row {{ display: flex; justify-content: space-between; gap: 12px; font-weight: 700; flex-wrap: wrap; }}
.cv-job .row span:last-child {{ font-weight: 400; color: var(--muted); font-family: var(--f-mono); font-size: .8rem; }}
.cv-job .org {{ color: var(--muted); font-size: .95rem; }}
.cv-body ul {{ margin: 6px 0 0; padding-left: 1.2em; display: grid; gap: 4px; }}
.cv-body p {{ margin: 0 0 8px; }}
.cv-body a {{ color: var(--accent); }}
@media (max-width: 560px) {{ .cv-body {{ padding: 4px 16px 20px; }} }}
@media print {{ .sky, .top, .cv-actions {{ display: none !important; }} .cv-body {{ border: 0; padding: 0; }} }}
</style>
</head>
<body>
<div class="sky" aria-hidden="true"></div>

<header class="top">
  <div class="wrap">
    <a class="mark" href="./" aria-label="Alif Najmi, home"><span class="badge av"><img src="/assets/icons/favicon-192.png" alt="" width="32" height="32" decoding="async"></span>Alif Najmi</a>
    <nav class="nav" aria-label="Sections">
      <a href="./#me">Me</a>
      <a href="./#work">Work</a>
      <a href="./#journey">Journey</a>
      <a href="./#contact">Contact</a>
    </nav>
    <button class="icon-btn k-btn" id="theme-btn" type="button" aria-label="Switch light or dark theme">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
    </button>
  </div>
</header>

<main class="wrap">
  <div class="cv-page">
    <div class="cv-top">
      <span class="eyebrow">Résumé · Updated Nov 2026</span>
      <h1>Muhammad Alif Najmi Md Hisamudin</h1>
      <div class="tag">Business Analyst | Data &amp; AI Solutions | Computer Science (Hons) Graduate</div>
      <div class="cv-contact">Shah Alam, Selangor · <a href="https://www.linkedin.com/in/muhammad-alif-najmi-md-hisamudin" target="_blank" rel="noopener">LinkedIn</a> · <a href="https://github.com/7YMERA" target="_blank" rel="noopener">GitHub</a> · <a href="./">Portfolio</a></div>
      <div class="cv-actions">
        <a class="cv-btn primary" href="assets/Muhammad-Alif-Najmi-CV.pdf?v={CV_V}" target="_blank" rel="noopener">View PDF</a>
        <a class="cv-btn" href="assets/Muhammad-Alif-Najmi-CV.pdf?v={CV_V}" download="Muhammad-Alif-Najmi-CV.pdf">Download PDF</a>
        <button class="cv-btn" type="button" data-copy="alifnajmx@gmail.com">Copy email</button>
      </div>
    </div>
    <div class="cv-body">
{body}
    </div>
  </div>
</main>

<script>
(function () {{
  var root = document.documentElement;
  try {{ var saved = localStorage.getItem('theme'); if (saved) root.setAttribute('data-theme', saved); }} catch (e) {{}}
  document.getElementById('theme-btn').addEventListener('click', function () {{
    var cur = root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var next = cur === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try {{ localStorage.setItem('theme', next); }} catch (e) {{}}
  }});
  document.querySelectorAll('[data-copy]').forEach(function (b) {{
    b.addEventListener('click', function () {{
      var t = b.dataset.copy, old = b.textContent;
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () {{ b.textContent = 'Copied'; setTimeout(function () {{ b.textContent = old; }}, 1500); }}).catch(function () {{}});
    }});
  }});
}})();
</script>
</body>
</html>
'''
(root / 'resume.html').write_text(html)
print('wrote resume.html, cv key', CV_V)
