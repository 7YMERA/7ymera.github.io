# Claude's corner: the work log

Every agent that works on this site adds an entry **at the top**: the date, what changed and why,
and anything left open. Keep each entry short. The commits hold the details
(`git log --oneline`), and the README holds how things work. This file is for picking up
where the last chat stopped without re-reading everything.

---

## Open items (keep this list current)

- **UTP subject descriptions** in `#studied` are drafts written from coursework files. The owner hasn't confirmed them yet.
- **DENDROBYTES** (media / community outreach, in Journey) still needs its year from the owner.
- **REQ cards in the opening's outer columns** (REQ-014, 022, 031, 040): the owner hasn't checked the wording yet.
- **Tumble Deck** (`assets/tumble-deck.js`) is no longer used on the page. It's kept because the README documents it as a port.
- **Jom Al-Quran raw project data** (the Database-2024-Project-Uplift zip) contains real-looking personal data.
  Only the scrubbed `assets/db/jom-al-quran.sqlite` is published. Never commit the raw data.

---

## 2026-11-09 · /v2/ scroll-driven KLCC
- `/v2/` now has a fixed WebGL background (`v2/v2-3d.js`, three.js r128 from cdnjs): low-poly KLCC twin towers, skybridge, KL Tower, city ring and orb. The camera orbits and rises/falls with scroll. Light/dark recolors it.
- Falls back to the 2D canvas skyline in `v2.js` when WebGL or the CDN script is missing (`html.gl` class marks 3D on). Windows stay opaque, no backdrop-filter. Reduced motion renders only on scroll/resize.
- Tested only with software GL in headless Chromium (no page errors, no sideways scroll at 1300 and 390 px). Real-device fps is untested; check on a phone.

## 2026-11-09 · /v2/ preview
- New preview at `/v2/` (`v2/index.html`, `v2.css`, `v2.js`): low-poly KL skyline hero on a canvas, floating aqua windows (About, Work, Notes, Skills, Journey, Why, Contact), light/dark toggle, big buttons. Inspired by a reference site; all code and text are original.
- Self-contained: doesn't touch `site.css` or `extras.js`, so no cache-key bump. Links back to the main site and notes with `../`.
- Open: owner to review `/v2/`, then decide whether to swap it in as the homepage. Add a card for UTP studies if wanted. Pixelify Sans loads from Google Fonts; self-host if that matters. The main site gained Pulse and the Roblox card in the meantime; `/v2/` doesn't have them yet.

## 2026-11-08 · Pulse status report, Roblox card
- New `#pulse` section before Journey: stat tiles, project board, commit map and a recent-activity feed (live GitHub events with a snapshot fallback). Code in `assets/pulse.js`, data in `assets/pulse-data.json`.
- Added the EagleSan Sandbox (Roblox) card to Work (now a row of three minis) and a Journey entry. The repo is private, so it has no repo link.
- Open: refresh `pulse-data.json` (commit counts, `heat`, `recent`) and the board text in `index.html` when projects move. Axrail work is left off on purpose; it lives on LinkedIn.

## 2026-11-08 · Handoff setup
- Added `CLAUDE.md` (auto-read by Claude Code), this log, and `tools/check.js`, a smoke test of every page at 1300 and 390 px.
- Why: so a new chat can start from these files instead of a long conversation.

## 2026-11-07 · REQ-001 carousel, Join Atlas
- "Why hire me" is now **slide 2 of the REQ-001 carousel**: a spec sheet in the photo stack, and the acceptance criteria beside it.
  That slide's timer is 12 s (`style="--dur:12s"` on its dot). The flip card and its Photos | Why hire me switch were removed
  because the owner wanted one carousel, not a separate flip. Hidden slides keep their height, so the card doesn't jump.
- Another session added the **Join Atlas** and the original EER diagram to `notes/jom-al-quran.html`.
- Earlier the same day:
  - Glass folders replaced the Notes coverflow.
  - The README now documents the whole site and every 21st.dev port.
  - Outer columns in the opening: spec on the left, built on the right, with REQ cards.
  - The faint spin reel shows from the first frame again.
  - The opening no longer clips photos.
  - "Axrail" became "axrail.ai".
  - KunKwan is named and linked.
  - The UTP coverflow opens on Languages.

## 2026-11-07 · Big revamp
- New section order:
  1. Opening: reel behind the curtain
  2. *This is me*: REQ-001 card with photos, and six fact tiles
  3. Goals
  4. Notes
  5. UTP
  6. Skill tree
  7. Work: reworked `.pj` cards, with before/after sliders on TaskMatch, MyLokalEvent and SLB
  8. Journey
  9. Contact
- Removed: the Mobile Legends awards, "Off the clock" as a section (DENDROBYTES moved into Journey), and the SURVIVED stamp.
- Notes with live SQL playgrounds: the company database (49 tables) and Jom Al-Quran (56 tables). Both databases are scrubbed.

## 2026-11-06 · Content and components
- UTP section: 42 subjects matched to the transcript, with what was done in each.
- Skill tree, with where each skill came from.
- Coverflows for UTP; Image Stream on the Notes page header.
- The *This is me* carousel moves every 5 s and pauses 20 s after a manual move.
- The GitHub avatar is now the logo and favicon.
- Notes added: SMK Subang, MyLokalEvent v2, KakiLima, JumaatFinder, SLB design, AWS TEB3033.
- Light mode is the default; a colourful aurora now runs across the whole site.
- The opening reel was fixed from 21 fps to 57–60 fps: no mask or clip around it, and 8 slices.

## 2026-11-04 → 05 · Foundations
- Curved screenshot reel, aurora, number ticker, timeline beam, mobile dock (can be hidden), and the curtain of convocation photos.
- SLB IT Asset Disposal gallery and note; the TaskMatch note; the CV viewer and download.

## 2026-10-25 · First version
- One static page: a manifesto, the REQ-001 card, three case studies and a timeline.
  Screenshot: `docs/screens/2026-10-first-version.webp`.
