# CLAUDE.md: start here

Claude Code reads this file at the start of every chat. It is the handoff for
any agent working on this repo, kept short on purpose so it costs little context.

- **What this is:** Muhammad Alif Najmi's portfolio and blog, live at https://7ymera.github.io.
  Plain HTML, CSS and JS on GitHub Pages. No build step, no framework, no npm.
- **Before you change anything, read:**
  1. The top entry of [`docs/claude-log.md`](docs/claude-log.md): what was done last and what's still open.
  2. Only the section of [`README.md`](README.md) you need. It documents every section, every
     component and the rules. Don't read it all.
- **When you finish**, add a dated entry at the top of `docs/claude-log.md`. Use the same format,
  and keep it to a few lines: what changed, why, and anything left open.

## Where things are

| Thing | File |
|---|---|
| Home page (all sections) | `index.html` |
| All styles (later rules override earlier ones, so append, don't hunt) | `assets/site.css` |
| Opening, carousel, skill tree, timeline, dock, before/after sliders | `assets/extras.js` (sliders are inline in `index.html`) |
| Spin reel / Glass folders / Coverflow / Image stream | `assets/curved-reel.js`, `folders.js`, `coverflow.js`, `image-stream.js` |
| SQL playgrounds (sql.js from cdnjs) | `assets/db-playground.js`, `assets/db/*.sqlite` |
| Join Atlas (Jom Al-Quran note) | `assets/join-atlas.js`, `.css` |
| Notes (blog posts) | `notes/*.html`, listed in `notes/index.html`. Edit the HTML directly. |
| README screenshots | `docs/screens/` |
| 3D city, scroll flight, HUD | scene `assets/scene.js`, styles `assets/scene.css` (also skins the notes pages), models and textures `assets/city/` (the page itself is `index.html`) |
| Flight on its own (view and debug) | `/flight/`: `flight/index.html`, panel on **H**. Keep its `#enter` block in step with `index.html`. |
| Smoke test | `tools/check.js` |

## Rules that bite

- **Cache key:** every CSS/JS link carries `?v=YYYYMMDDx`. After any CSS/JS change, bump it everywhere:
  `grep -rl 'v=OLD' index.html notes | xargs sed -i 's/v=OLD/v=NEW/g'`.
  When you replace an image, give it a new file name (e.g. `cover-2.webp`).
- **Performance:** animate only `transform` and `opacity`. No `backdrop-filter` over the moving aurora.
  No `mask-image` or rounded `clip-path` around 3D content. Pause off-screen work with
  IntersectionObserver. Respect `prefers-reduced-motion`. Check fps with CPU throttling ×4 after big changes.
- **21st.dev components** are ported to plain JS, never installed as React. See the README section
  "21st.dev components" for each port and its lessons.
- **`[hidden]` is `display:none !important`** in `site.css`. Overriding it needs `!important`.
- **Light mode is the default** (`<html data-theme="light">`). Check both themes and 390 px width.
- **The owner dislikes small hidden buttons** for major features. Make controls big and obvious.

- **The old flat-aurora site** is commit `f3b9f08` (`git checkout f3b9f08`). There is no `/v2/` any more: the 3D city is the home page.

- **Version history:** on a major overhaul or a notable new feature, add a row to the README's *Version history* table and bump the number (a small fix gets none). Say what changed in one line and give the commit.

## Privacy (public repo, never break these)

- Don't use the owner's work Google account or work Drive for anything on this site.
- Never publish employer client names or project details. Keep the employer as "axrail.ai".
- Blur colleagues' names, emails and phone numbers in screenshots. No SharePoint URLs. Strip photo metadata.
- No classmates' names or student IDs.
- Scrub personal data (names, IC numbers, emails, phones) from any published database.
- `Muhammad-Alif-Najmi-CV.pdf` is the owner's own file. Don't edit it unless asked.

## Git

- `main` is live. Commit straight to `main` unless told otherwise. Never force-push.
  No PRs unless asked.
- Commit as `git -c user.name=Claude -c user.email=noreply@anthropic.com commit ...`.
  End the message with the attribution trailer your session gives you.
- Other sessions may push at the same time. Run `git pull` before you start and again before you push.
  If two sessions both bumped the `?v=` key, keep the newer one.

## Checking your work

```bash
python3 -m http.server 8765 &          # from the repo root
node tools/check.js                    # every page at 1300 px and 390 px: page errors, 404s, broken images, sideways scroll
```

Playwright and Chromium are preinstalled in Claude Code cloud sessions (`require('playwright')`).
