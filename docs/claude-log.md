# Claude's corner: the work log

Every agent that works on this site adds an entry **at the top**: the date, what changed and why,
and anything left open. Keep each entry short. The commits hold the details
(`git log --oneline`), and the README holds how things work. This file is for picking up
where the last chat stopped without re-reading everything.

---

## Open items (keep this list current)

- **UTP subject descriptions** in `#studied` are drafts written from coursework files. The owner hasn't confirmed the descriptions yet. (The subject *names and counts* were checked against the owner's transcript on 13 Nov 2026: all 42 match.)
- **DENDROBYTES** (media / community outreach, in Journey) still needs its year from the owner.
- **REQ cards in the opening's outer columns** (REQ-014, 022, 031, 040): the owner hasn't checked the wording yet.
- **Tumble Deck** (`assets/tumble-deck.js`) is no longer used on the page. It's kept because the README documents it as a port.
- **Jom Al-Quran raw project data** (the Database-2024-Project-Uplift zip) contains real-looking personal data.
  Only the scrubbed `assets/db/jom-al-quran.sqlite` is published. Never commit the raw data.









---

## 2026-11-18 · Phone: "Why I do this" lost its top part
- Owner's screen recording (iPhone): while the panel was pinned, its top (heading and the start of card 01) was cut off at a line that moved as they scrolled. Cause (most likely, I cannot run WebKit here): `html.fork-side #why { overflow-x: clip }` also cut off the part of the pinned panel lying above the section's own top edge. The clip now sits on `<main>` (`site.css`), which covers the whole page, so nothing pinned can leave it. Also: a tall panel on a phone is pinned just high enough that its bottom stays on screen (`Tc` in `extras.js`). Checked in Chromium at 390 and 1300 px: no sideways overflow, panel pinned and visible. Key `20261114m`.
- Open: confirm on the iPhone; if the top is still cut, the next suspect is WebKit and `will-change` on `#why > .wrap`.

## 2026-11-17 · "Why I do this": centred, fades in, holds
- Owner: put it in the middle, fade it in (not a plain block), and hold it. `extras.js` fork tick: the panel is pinned at the vertical centre of the screen (top = (viewport - panel height) / 2 + 24, at least 84), slides in from the right while fading 0 to 1 over the first 0.6 of a screen of scrolling, then holds about 600 px of scroll (from 62svh of empty padding above `#why`, `site.css` end) before the page carries it up. Measured at 1300x800: top fixed at 242, left 1370 to 70, opacity 0 to 1, hold from 500 to 1100 px. Key `20261114k`.
- Not checked on a real phone (panel is taller there).

## 2026-11-16 · Idle drift for the background camera (whole site)
- `scene.js`: outside the flight, after 0.9 s without input the background camera swings about 3 degrees (period about 20 s) and breathes about 1.4 % in radius; the page itself never moves. Idle redraw goes from about 15 to 30 fps while it runs (`idleK`, `iv` in `frame()`). Safeguards: off with reduced motion, hidden tab, the flight (its own drift), or the text-only brief; and it switches itself off for the session if the average idle frame takes over 48 ms (`driftOff`, checked every 90 frames). Debug hook `__scene.drift()`. Key `20261114j`.
- Checked in the browser: the camera moves while `scrollY` stays put, and a wheel event ramps it down. Not tested on a real phone (battery and heat are the thing to watch). To tune: amplitude is the `3` and period the `.000314` in `place()`.

## 2026-11-16 · "Why I do this" slides straight in from the right
- Owner: the reveal had an entry angle and faded in ghosted. Cause (`extras.js`, the fork tick): the section slid in sideways from 60vw while the page was also scrolling it up from below (a diagonal), with opacity 0 to 1. Now it is held at one height (like a sticky, 84 px from the top) while it slides in from the right edge of the screen at full opacity, then the normal scroll carries it up. Measured: panel top constant at 84 while its left goes 1370 to 70. Key `20261114i`.
- Not checked on a real phone; reduced-motion visitors still get no slide.

## 2026-11-15 · Landing day/night switch is icon-only
- `#op-theme` on the opening is now a 48 px round icon (moon in day, sun in night), still faint, `aria-label` kept. Key `20261114h`.
- Owner asked whether visitors could leave a "review". Answered in chat (needs an outside service; options Giscus, Supabase, a form service). Nothing built yet.

## 2026-11-14 · Opening card redesign, Menu label, skip link
- The curtain card (name and details) now matches the HUD look of the rest of the site: corner ticks, an ONLINE status bar with KLCC coordinates, pixel-font eyebrow, a segmented pixel rule, a Role / Focus / Shipped readout table, and a solid CTA bar (`scene.css`, end of file; markup in `index.html`). Gotcha: `--fx` is a LENGTH inside `.cur-frame` (site.css), so colours there use the new `--hud` variable. The old card's `var(--fx)` border was silently invalid for that reason.
- Phone "Menu" label was clipping over the search icon: the `.icon-btn::after` hit-area rule clashed with `.k-btn::after{content:"Menu"}`. Now a real `<span class="k-label">` (index.html) shown at 760 px and below; the notes pages no longer get a stray "Menu" on their theme button.
- A "Skip to my work" under the chevrons was added, then REMOVED at the owner's request: the "This is me" hero already has "See my work" and the fork card. Do not add skip links to the bare opening. Key `20261114g`.
- Open: not checked on a real phone.

## 2026-11-13 · Top bar stuck after the theme switch; day/night on the landing screen
- Bug (owner): scroll down, press the day/night button, scroll back up, and the top bar stayed visible over the bare opening. Cause: `html.gl.op-bare .top:focus-within` kept the bar open because the clicked theme button still had focus. Now only keyboard focus (`:has(:focus-visible)`) reopens it, and a mouse click on the theme button blurs it (`index.html`, `site.css`). Checked: switch, scroll up, bar hides again.
- New: a faint day / night pill (`#op-theme`, under the chevrons) on the opening screen, 55 % opacity, full on hover or focus, fades with the rest of the opening. It presses the same switch as the top bar. Key `20261114d`.

## 2026-11-14 · Phone opening: from below first, the group behind the name card

- **What:** on a tall screen `topPose()` is now a view from street level looking up at the towers (camera height 22, radius 330), not a zoom. A new director key at 1.8 screens down (`['curtain',0,1.8,cardPose]`) rises and pulls back to the group of four (radius 560), so that is what sits behind the *Alif Najmi* card. Wide screens are unchanged: `cardPose` equals `topPose` there. Cache key `20261114c`.
- **Why:** the owner wanted either a zoom or a view from below at the start, and the name card over the full skyline, not over a far zoom-out.

## 2026-11-14 · The opening shot fills the screen on every shape

- **What:** the opening pose is now `topPose()` in `scene.js`, a function of the screen's width over height. Wide screens keep the row of four landmarks, a little closer (radius 234). Tall screens come in close and low and look up (radius up to 404, camera at 70, aim at 110), so the towers run the height of a phone and blocks fill the bottom; the outer landmarks may leave the sides. The next shots are farther back, so the page zooms out as you scroll. The pixel arrow is darker with a halo, since it now sits over buildings. Cache key `20261114b`.
- **Why:** on the owner's phone the skyline was a small band with empty ground under it.
- **Checked:** screenshots at 360x780, 390x844, 430x932, 768x1024, 820x1180, 1024x768, 1280x720, 1366x768, 1536x864, 1920x1080 (light theme).

## 2026-11-14 · CV updated to today, shown on the site

- **What:** new two-page CV built from `tools/cv/cv.html` (WeasyPrint, same look as before). Added: Weekly Poster Automation (private repo), MyLokalEvent 2.0, KakiLima, Jom Al-Quran Join Atlas, this portfolio, TaskMatch at 14 releases, SMK dashboard at v2.20, Roblox as a side interest. Axrail, Handshake, SLB, education and certifications are unchanged.
- **Site:** new `/resume.html` (generated by `tools/cv/web.py` from the same source), linked from the Contact CV chip as *Read*, in Ctrl K, in `sitemap.xml` and in `tools/check.js`. The PDF links use the key `?v=cv20261114a`. The Pulse board is refreshed (14 repos, new poster row).
- **Open:** the CV's Axrail wording is from the earlier CV, nothing new from the owner. Photo is the one already in the old PDF. Outcome numbers for projects are still the owner's to give.

## 2026-11-14 · Two routes, the /7ymera sign, no gold hour, no roll (version 2.13)

- **What:** a fork after *This is me* (`#fork`): keep scrolling for the full story (the card leaves sideways) or press *Just the highlights* (`html.brief` hides the story-only sections; a chip brings them back). The first screen has the handle `/7ymera` lit like a rooftop sign and a bare pixel arrow; the round button and the short-lived *Skip to my work* link are gone. Page title is `/7ymera · Alif Najmi`. Golden hour removed (it stuttered on phones in light mode), barrel roll off again, The Exchange fall reshaped (turn first, then one drop). Shader text moved to `assets/scene-glsl.js`. The opening eases by the clock and snaps on a jump. Accessibility block appended to `site.css` (`A11Y PASS`): 3 px focus rings, `--fx-ink` for small accent text, 44 px tap areas on phones. Cache key `20261114a`.
- **Why:** the owner's list of 13 Nov, then his notes of 14 Nov.
- **Open:** the accessibility fixes come from an audit that was cut short: axe was not re-run after them, and text sitting on the scene was not measured. Analytics needs the owner's GoatCounter code. Outcome numbers for the projects are the owner's to give. The fall takes 7.5 % of the flight's scroll, a little more than before, though the drop itself is quicker.

## 2026-11-13 · UTP subjects checked against the transcript

- **What:** the owner shared his transcript. Every subject in `#studied` matches it: 42 subjects (5 programming, 5 systems, 4 maths, 5 data and AI, 9 business, 5 big ones, 9 side). Three corrections: "nine semesters" is ten (May 2023 to May 2026), *The big ones* is 5 subjects (Final Year Project I and II are two), and *Engineering Mathematics* is *Engineering Mathematics I*.
- **Privacy:** the transcript is not in the repo. Nothing from it but subject names is on the site: no grades, CGPA, matric or IC number.

## 2026-11-13 · New share image, no photo

- **What:** `assets/og-skyline-3.jpg` (1200 x 630): the site's whole night skyline, all four landmarks, full width, with the pixel mark, "Alif Najmi" alone, the one-line role and the address (the owner did not want the spec headline on it). It replaces `og-card.jpg` (the convocation photo) on the home page and on every note that used the home card; notes with their own card keep it. `og-card.jpg` stays in the repo, unused.
- **Why:** the owner wanted a more modern thumbnail without his photo.
- **How:** a 2x capture of `/flight/` at `draw(0)` in dark, then an HTML card (the first attempt, `og-city.jpg`, cropped to Petronas behind the text; the owner wanted the whole skyline, so it was replaced and deleted) (Bricolage Grotesque, JetBrains Mono) rendered by Playwright. Sources are not in the repo.
- **Open:** social sites cache previews; the old one may show until they re-fetch.

## 2026-11-12 · Barrel roll back on

- **What:** `rollAt` no longer returns 0: the flight rolls one full turn through the skybridge gap (measured 7, 108, 176, -92, 0 degrees across it, level after). Off in reduced motion. The skybridge caption says so again. Cache key `20261113y`.
- **Why:** the owner asked for it back.

## 2026-11-12 · Notes screenshots retaken; contents rail no longer shows through the Join Atlas

- **What:** `sql-playground.webp` and `join-atlas.webp` retaken from the notes pages (Original join 1 run; report query 4 selected). Taking them showed the *On this page* rail printing through the wide Join Atlas: `article.post .ja` now sits above the rail (`site.css`). Cache key `20261113x`.
- **How:** the playground needs sql.js from cdnjs, so launch Chromium with `proxy: {server: process.env.HTTPS_PROXY, bypass: 'localhost'}`.

## 2026-11-12 · README screenshots retaken

- **What:** twelve images in `docs/screens/` retaken at 1300 x 800 from the current site (opening, the six sections, Journey, three flight shots, two dark opening shots); three captions updated. Not retaken: `sql-playground.webp` and `join-atlas.webp` (notes pages), `2026-10-first-version.webp` (history), and the unreferenced `goals`, `opening`, `phone`.
- **How:** Playwright on `/?dbg`; for flight shots, scroll to the progress and call `__scene.set(p)` so the camera does not take a minute to catch up in software rendering.

## 2026-11-12 · Floating roof fixed, README brought up to date (version 2.12)

- **What:** `clearPlots` now also drops separate pieces that do not reach the ground and sit over a dropped block, so no roof floats near Merdeka 118. README: version 2.12 row, and the opening, night, flight, moon and light-palette notes rewritten to match today's changes. CLAUDE.md lists the owner's scene colour rules. Cache key `20261113w`.
- **Open:** the owner has not yet confirmed the *Fly it again* button on screen, or frame rate on a real GPU.

## 2026-11-12 · Opening wordmark removed

- **What:** the "Alif Najmi · Portfolio · Kuala Lumpur" line (`.op-mark`) is gone from `index.html`, so the first screen is the city and the chevron cue only. Its CSS rules are left in `site.css`, unused.
- **Why:** owner's request.

## 2026-11-12 · Bare opening: no top bar, chevrons for the cue; The Exchange matches Petronas

- **What:** while the city has the first screen to itself, `extras.js` sets `html.op-bare`: the top bar is hidden (it returns as the curtain starts in, or on keyboard focus) and the cue is a 64 px round button with two down chevrons (label kept as `aria-label`). Reduced motion never gets `op-bare`. In light mode the landmarks' glass takes the `near` tone, so The Exchange 106 is as deep as Petronas. Cache key `20261113v`.
- **Why:** the owner wanted the opening view free of buttons, and the Exchange still read paler than the rest.

## 2026-11-12 · Light mode: one blue, three steps

- **What:** the light palette in `scene.css` is one hue (`--far`, `--mid`, `--near`, `--ring`, `--glass` re-picked around the same blue; no cyan). The landmarks' glass takes the `mid` tone instead of the cyan `ring`. In `scene.js` the lit faces are a pale tint of the base (`uLitMix` .42, not near white) and the shade is the same blue deepened (`uShadeMul` .46/.62/.95). Cache key `20261113u`.
- **Why:** the owner found the mix of cyan glass, grey-blue bodies and white faces patchy, but one flat colour dull: the depth now comes from value steps and haze, not hue.

## 2026-11-12 · Petronas crowns textured, Maybank sign removed

- **What:** the Petronas crowns (above the window cut-off) keep a window pattern up the tiers instead of a flat white glow; the ball and mast stay lit solid. The Maybank sign on Merdeka 118 is removed entirely (canvas, mesh and `placeSign`). Cache key `20261113t`.
- **Why:** the owner pointed at the untextured crowns. The sign could not sit cleanly on the model's faceted crown (the real one is a flat box), and the owner decided the yellow does not suit the look. Do not add it back unless asked.

## 2026-11-12 · The Exchange 106 at night, from a photo

- **What:** in the `facade` shader (`li==2`) the tower is dark blue glass with offices lit in blocks of floors (cool white, mostly the lower two thirds). The crown is a violet lantern behind a white diamond lattice with a bright white rim under it, replacing the pink bands. Cache key `20261113s`.
- **Why:** the owner asked for the same rework as Menara KL and Merdeka 118.

## 2026-11-12 · Merdeka 118 at night, reworked

- **What:** no magenta. In the `facade` shader (`li==1`) every floor is a thin, even line of cool light, a few office floors glow warmer, the crown is a bright white lantern and the spire is lit white, fading upward. The crease lines (`merEdges`) are ice white, fewer (only creases over 24 units) and fainter. Cache key `20261113r`.
- **Why:** the owner found the magenta lines out of place next to the relit Menara KL and Petronas.

## 2026-11-12 · Menara KL at night, from the owner's photos

- **What:** the magenta pod is gone. The shaft is floodlit white (faintly fluted, a pink blush at the foot), the pod is dark blue-violet with rings of white lamps and a white crown, the lower antenna is lit. All in the `facade` shader (`li==3`). Cache key `20261113q`.
- **Why:** the owner found the purple pod unrealistic and sent two reference photos.

## 2026-11-12 · Hold on the city tag, sign on the wall, towers lit, moon locked, fly again

- **What:** `#spin` ("Where I work and build") is 300vh (260vh on phones), twice as long. The Maybank sign is a plane fixed to Merdeka 118's facade by a ray at load (`placeSign`), shown in both themes, no longer a floating sprite. Petronas at night has real windows (floor strips cut by mullions, a few dark or warm rooms, brighter toward the crowns). Light mode gets shade at building feet and soft cloud shadows on the ground (the day side of the night street glow). The moon is locked at one world position. A "Fly it again in dark/light mode" button shows over the finale (`#fly-again`), switches theme and returns to the flight's start. Cache key `20261113p`.
- **Why:** owner's notes on the live site.
- **Open:** the button was click-tested but not seen on screen in a headless run (the flight eases too slowly there to reach the finale); the owner should confirm it and the day shade on a real device.

## 2026-11-12 · Opening slower and eased, flight levelled

- **What:** the opening's scroll budget is now 690svh (`EST`, `HOLD1`, `ACTS` in `extras.js`): 1.2 screens of bare city, the name card held, the acts over 2.2 screens, the headline held about 1.5 screens. The opening eases toward the scroll position (`glide`) instead of jumping per wheel step. Flight bank cut from 18 to about 7 degrees; the Merdeka climb starts at y 74 and looks across, so the skyline is behind the tower. Cache key `20261113o`.
- **Why:** the owner found the reveal too fast, too short-lived and choppy, and sent a screenshot of a tilted wall of Merdeka.
- **Open:** the owner has not yet judged the new pacing on a real wheel or phone.

## 2026-11-12 · Skyline, opening, flight and night (version 2.11), on branch `claude/eager-ride-vi416b`

- **What:** landmarks grouped by a `LAY` table; the page opens on the bare city and the curtain comes in on scroll; the flight is eight beats (`buildKF`), with banking and a speed FOV; night windows, haze and landmark lighting redone from photos; the Maybank sign shows (a `//` comment had swallowed it). Flight captions rewritten, cache key `20261113n`.
- **Why:** the owner found the map-true spacing dull, wanted a moment of pure city first, a livelier flight and a night that looks like the real skyline.
- **Open:** not merged to `main` (owner to approve). Not measured on a real GPU: fps with the new night shader. Weak flight frames: the start of the Merdeka crane is a flat wall, the Exchange fall is only about 1.4x faster than the slow beats. Gold hour is still light-only. The ground edge at night reads as a purple cloud.

## 2026-11-12 · The polish pass (version 2.10), on branch `claude/eager-ride-vi416b`
- **Not on `main` yet.** This session was told to work on the branch `claude/eager-ride-vi416b`. The owner should look at it on a real GPU, then merge. Work was split by model: small models audited, mid models edited, the lead reviewed every diff and re-ran the checks.
- **Background** (`scene.js` `toon()`, end of `scene.css`): three flat tones per face, near-white day sky, height haze with no horizon seam, day facade grid fades by 420 m, fine grain and vignette layers below all content. Inspired by 0z5a.github.io. README section "The look" has the details.
- **Notes:** `assets/reader.js` (progress bar, contents list, click-to-zoom dialog), page cross-fades, canonical links, BlogPosting data, "All notes" links, index newest first (now lists the app tour), previous/next follow the index. New root files: `sitemap.xml`, `feed.xml`, `robots.txt` (hand-written: update when adding a note).
- **Home page:** Person/WebSite data, social tags, skip link, full keyboard support on the before/after tabs, focus trap in quick jump, footer landmark, dead script blocks removed, three.js integrity hash. Scene starts after `load` and fades in (phone LCP 3.0 s to 2.3 s, measured throttled).
- **Plumbing:** `404.html`, local icons in `assets/icons/` with `site.webmanifest`, and `tools/check.js` now has a static pass (titles, canonicals, headings, alt text, names, ids, links, sitemap, one `?v=` key). Key `20261113m`.
- Open, for the owner to judge on a real screen: grain strength on a high-DPI display; frame rate (not measurable in software GL); golden hour is close to two tones (cream ground, violet buildings); curved landmarks may look faceted under the new shading.
- Open, facts only the owner knows: `#studied` says "42 subjects across nine semesters" but the cards do not add up to 42; the Jom Al-Quran note says "three typos" then lists a different number of problems; the app tour (`slb-screens.html`) has a card date of 10 Nov 2026 (from its first commit) but no date on the page.
- Screenshot tip: headless Chromium needs `--use-angle=swiftshader`; `--use-gl=swiftshader` draws a false band along the bottom.
---

## 2026-11-16 · Night look for the other landmarks
- Same idea as Merdeka (`scene.js`): `edgesFor()` draws each landmark's long creases at night (Merdeka magenta, Petronas warm white, The Exchange pale cyan). Shader glow zones: Petronas spires floodlit white above y=106, The Exchange crown warm gold above y=118, Menara KL pod warm amber (y 78 to 99). Red aircraft lights from the earlier entry stay.
- No reference photos for these three, so colours are from general knowledge of how they are lit. Owner to correct with photos if wanted. Key `20261113j`.
---

## 2026-11-16 · Merdeka 118 at night, from the owner's photos
- Owner's real photos of Merdeka 118 at night: magenta LED lines tracing its facets, lit office bands, dark spire, yellow Maybank sign on the crown. In `scene.js` (night only): the model's long creases (edges over 16 units, 42 degree threshold, via `EdgesGeometry`, `merEdges`) are drawn as additive magenta lines; a yellow "Maybank" sprite sits on the roof (roof at y about 152, centre -214,295 in district coordinates); Merdeka's lit rooms now stop at 154 (the roof). Shader-based crease detection did not work (normals come from derivatives, constant per pixel quad), hence real line geometry.
- Roads and ground patches stay removed. Key `20261113i`.
- Open: the sign is a canvas-text sprite (always faces the camera); the real one is on the faces of the crown.
---

## 2026-11-15 · Night mode: spires, roads, dark blocks
- Facade shader (`scene.js`): no lit rooms on spires or bare shafts. `LCUT` lists, per landmark, the centre, radius and the height above which rooms stay dark (Petronas 106, Merdeka 148, The Exchange 122; Menara KL lit only on the pod, 78 to 99). About one block in five stands dark (not the landmarks), and street level stays unlit.
- Aircraft warning lights: red double flash sprites on both Petronas spires, Merdeka 118, The Exchange 106 and Menara KL (`BEAC`, `beaconUpdate`); dimmer by day.
- Ground: roads with sodium lights and dark patches were tried and both REMOVED at the owner's request (didn't fit the design). The ground is one plain colour again.
- Checked light and dark at 1000 px and dark at 390 px, no console errors, smoke test clean. Key `20261113h`.
- Open: `LCUT` heights are estimates from the model tops (Merdeka spire starts about 148, The Exchange about 122); adjust if the owner sees lit rooms on a crown or a dark top floor.
---

## 2026-11-14 · One camera (the follower)
- Owner's idea: make every movement one system so a change of mode can't snap. `scene.js`: the director (before the flight) and the flight each still compute where the camera should be, but a single follower (`followCam`) is now the only thing that moves it: position, rotation, lens and sideways push all chase their target with the same short lag (about 0.14 s) and a top speed of 700 units/s. Snap, reduced motion and the first frame skip the lag.
- Checked by sampling the real camera every frame while scrolling through the Journey-to-flight entry: no jumps after warm-up. Smoke test clean. Key `20261113e`.
- Open: owner to feel-test. If the flight feels slightly floaty, raise the 7 in `followCam` (higher = tighter).
---

## 2026-11-14 · Golden-hour finale, thin fog, no barrel roll
- Owner's reference photo (hazy sunrise over KL): the finale skyline in light theme now fades to a golden-hour sky and warm haze (`goldHour()` in `scene.js`, driven by the finale factor `fs`; dark theme untouched).
- Fog pushed back (near 620 / far 1700, was 300 / 680) because it hid the city. Barrel roll removed (`rollAt` returns 0); the drone still banks into turns.
- Checked the Journey-to-flight entry: the last pre-flight shot and the first flight frame are the same camera, lens included, and the zoom-out is spread over about 1000 px each way. Idle drift is 28 px/s by formula; software GL here can't show real speed, so the owner should feel-test.
- The two flight repos the owner linked (AndriiShramko/ShramkoGSFPV, chenlong2019/drone-camera) are full simulators (physics FPV, mission/orbit survey planners). No code to reuse: our scripted path already uses the same ideas (waypoints, spiral orbits, eased follow camera, speed limit). Key `20261113d`.
---

## 2026-11-13 · Flight entry no longer snaps, metro lines as a backdrop, slower idle drift
- Owner's video (a phone-camera clip of the page; no speech tool here, so I read the frames plus their description): scrolling past "Started at UTP" the camera snapped out, then snapped in. Two causes: the Journey zoom-out key sat 150 px after the Exchange shot (a 400-unit move in one wheel notch), and the flight began with the lens jumping from 42 to 72 degrees. Fix in `scene.js`: zoom-out key moved to 62% of Journey (about 1000 px each way), and the flight's push-in now starts and ends at the normal lens.
- Idle drift slowed to 28 px/s (20 on phones).
- Metro map is now only a faint SVG backdrop behind the original skill tree (`.mm-bgs` in `index.html`, styles at the end of `site.css`, hidden on phones). Merdeka 118 stays in the middle. Key `20261113c`.
- Open: owner to feel-test the entry transition and the drift speed.
---

## 2026-11-13 · Lower sky rail, calmer slow scrolling (metro-map skill tree tried, then reverted)
- REVERTED at the owner's request (didn't like it): `assets/metro-map.js` built the skill tree as a metro map from the existing `.st-branch` lists (they stay in the page, hidden visually, for screen readers): 6 lines, one station per skill, 5 interchanges (capsules), origin dots, two trains. Sideways scroll on phones. Fun-fact card: the owner is a train and metro freak.
- Sky rail lowered from y=95 to y=58 (88 only over the one tower at the start); raycast-checked against building tops.
- Flight: after 0.9 s without input the page creeps forward by itself (about 42 px/s, 30 on phones) so slow scrolling doesn't show as stutter; camera progress is speed-limited (0.085 per second) so a fast flick can't whip the map. Redraw is every frame while flying. Key `20261113a`.
- Open: phone frame rate untested on a real device; the idle drift and the speed cap need the owner's feel-test.
---

## 2026-11-13 · Trains and the chase
- `scene.js`: a lit rail ring round the Petronas Towers (y=17) and a long sky line (y=95) over the city, with 5 instanced trains and headlight glows. Both routes were raycast-checked against the buildings.
- The drone now chases the hero train between Menara KL and Merdeka 118 (behind and above, gentle sway). Merdeka lead-in shot moved so there is less empty sky.
- Smoke test passes. Key `20261112m`.
- Open: the skill tree as a metro map (owner asked); train style (monorail / metro map / high-speed) not answered; frame rate on a real phone untested.
---

## 2026-11-11 · Compact one-mesh city background (branch, off by default)
- Owner supplied a SketchUp export of central KL (`model.dae`, 69 MB, about 419k triangles). New `tools/convert-klcc-dae.js` (Node, no Python) flattens it, welds vertices on a 3 m grid and writes `assets/city/klcc_district.json`: 36k vertices, 75k triangles, 890 KB, in metres, centred on the Petronas Towers, same int16 format as `kl_city.json`. The towers line up with the existing scene frame.
- `scene.js`: `?bg=district` (works on `/` and `/flight/`) loads that one file in place of the OSM city and the four landmark models (about 1.8 MB). The SketchUp model has no Merdeka 118 or Exchange 106 (they stand outside it), so the converter adds the existing hand-made models into the same file, just south of the built-up area at 60 % of their real offsets from Petronas (file is now 1.14 MB, 46k vertices). The flight route in this mode is a shortened one and is untuned (owner said to leave the flight to the reviewing agent). Without the parameter nothing changes. Cache key `20261111f`.
- Checked in the browser: `/flight/?bg=district` runs with no console errors, facade shader and beams work, end shot is good; `/` unchanged. `tools/check.js` not run.
- Open: the leg after the gap flies close past a tower on its way to Menara KL; the route is untuned. Making this the default means rewriting the Merdeka/Exchange captions, which is the owner's call. The mesh has no textures or colours.

## 2026-11-12 · Dragon removed (frame rate)
- Owner: the dragon was costing frame rate. The whole dragon block (points, shader, loop, update) is removed from `assets/scene.js` (`sciUpdate` no longer calls it, `sciStyle` no longer styles it); stars, the moon pair and the gyroscope rings stay. README 2.5 row and 3D section updated. Cache key `20261112k`. Not measured on a device; the dragon rewrote 120 point positions per frame plus a shader.

## 2026-11-12 · Phones: dock removed, Menu button instead
- Owner (iPhone): the page felt too narrow with the bottom dock and the grey side tab that brings it back; asked to remove it or repurpose it. On screens 760 px and narrower `.dock` and `.dock-show` are `display:none` (`assets/scene.css`), and the top bar's search button now reads "Menu" (`.k-btn::after`); it opens the existing quick-jump dialog. The quick-jump list now starts with the main sections in page order (This is me, Notes, UTP, Skill tree, Selected work, Status report, Journey, Fly over Kuala Lumpur, Contact), then projects, notes and links (`items` in `index.html`). The desktop dock behaviour is unchanged. Cache key `20261112j`.
- Checked at 390 px: no dock or tab, Menu opens the list, a tap on an item jumps; smoke test 30/30. Open: the notes pages' top bar has no Menu list (they never had the dock either).

## 2026-11-12 · Phone: skip button no longer covers the compass
- Owner (iPhone screenshot): "Skip the flight" sat on top of the compass tape. On phones (600 px and narrower) the skip button now sits bottom-left just above the caption and the "Keep scrolling" hint bottom-right beside it (`.fly-skip`, `.ride-hint` in `scene.css`). Also the cockpit (`#hud.on`) now only appears once the flight section fills the screen (`ONLY||flying`), instead of as soon as its top edge enters the view, so it no longer overlaps the last Journey cards. Cache key `20261112h`. Checked at 390 px at three scroll points; smoke test 30/30.

## 2026-11-12 · Drone flight: spirals up every landmark, cockpit, longer finale
- Owner asked for a content-creator FPV drone feel, climbs up every building, a smoother Journey-to-flight entry, an aeroplane-style control overlay, and a longer skyline hold. `assets/scene.js` (`DIST` branch of `buildKF`): new route built with a `spiral()` helper: dive in, two turns up the Petronas Towers, a barrel roll through the skybridge gap (new per-knot `roll` column, `rollAt`), a cruise out of the gap, two turns up Menara KL, two and a half turns up Merdeka 118, then a spiral dive down The Exchange 106 and a sweep round the district to the finale. Bank into turns up to 0.42 rad. `.enter` is now 1250vh. Captions and HUD ticks re-mapped (`CAPS` names `p14`, `exit`, `kEnd`, `eStart`, `rise`, `end`); caption text rewritten in `index.html` and `flight/index.html`.
- Measured with the route diagnostic (901 samples, raycasts): nothing closer than 6 units to a wall, no speed spikes; the spins show as sustained 6 to 9 degrees per step (intended) and one fast turn into the Exchange spiral that the rotation easing covers.
- Finale: the flight is the first 86 % of the scroll (`HOLD0`), the last 14 % holds the skyline (desktop horizontal shot, phone zoom-out) with a slow sideways drift.
- Journey to flight: new `journey` key pulls back to a wide shot, then the `enter` key zooms in to the start; the flight begins with a field-of-view punch-in (`kk`).
- Cockpit overlay (`cockpitBuild`, `cockpitUpdate`, `.cp` styles): compass tape and heading, artificial horizon (roll and pitch), speed and vertical speed, REC timer and battery, crosshair, drone ID. Phones: compass, horizon and REC. Cache key `20261112g`. README version 2.6.
- Open: not tried on a real phone; the Exchange spiral entry is the sharpest turn; some spiral frames are very close to facades (that is the tight-angle look, but tell me if it is too much).

## 2026-11-12 · The sci-fi layer, and a version history
- **Sci-fi layer** (`assets/scene.js`, `THE SCI-FI LAYER`): 900 stars (420 on phones), a cratered moon with two rings and a halo plus a small moon orbiting it (both placed opposite the camera's bearing, so they are always the backdrop behind the city), gyroscope rings (three tilted tori with a bead each) round the Petronas crowns and Merdeka's top, and a dragon: 72 points (46 on phones) along a closed Catmull-Rom loop over the district with a travelling wave, fins every sixth point and a horned head, drawn by a small `ShaderMaterial` (soft round points, head brighter). Styled for light (blue, normal blending) and dark (cyan and white, additive). Camera far plane is 1600; the finale (zoom-out) still works. Cache key `20261112d`.
- Checked: stars, moon, rings and dragon in the opening, spin, finale and a Merdeka shot, light and dark; no page errors. Not checked on a real phone; the dragon is small in some close shots and a blob when the camera is right beside its head.
- **Version history** added to the README (1.0 to 2.5, with the rules for numbering) and a one-line rule in `CLAUDE.md` to add a row on a major overhaul or notable feature.
- Open: the dragon is a ribbon of light, not a modelled creature; more could be added (shooting stars, an aurora), but it is a lot already.

## 2026-11-12 · New finale: a horizontal skyline, or a full zoom-out on phones
- Owner: end the flight on a horizontal shot of the skyline on wide screens; on a portrait phone (a row cannot fit) a full zoom-out. `assets/scene.js`: the district `end` waypoint is now `ENDC` (middle of the four landmarks, (120, 205) in the flight's (u, w) frame) plus 600 units along `ENDN` at height 92 looking level at it (wide), or 560 units back at height 400 looking down at the district (when `mobile`, 820 px or narrower). During the last stretch of the ride (`fs`, from 55 % of the way between `pass` and `end`): the field of view widens (+10 degrees wide, +30 on phones), fog is pushed back (+260 near, +560 far) so the whole skyline is in frame, and the bank-into-turns lean fades out so the horizon is level. Camera far plane is 1600 (was 900). HUD landmark tags show up to 760 units away (was 430).
- Bug caught while testing: I used `c` (undefined there) instead of `cr` for the scroll position, which made fog and camera NaN and blanked the scene; fixed before pushing. Cache key `20261112c`.
- Checked at 1300 px light and dark and 390 px (last two frames). Open: not tried on a real phone; the choice of phone vs wide is made at load and on resize (`mobile`).

## 2026-11-12 · Flight reworked: no clipping, no whips, captions in step
- Owner: the flight "seems buggy as hell". Measured it first (Playwright, `__scene` debug hooks: 389 samples along the route, raycasts from the camera, per-step speed and look-direction change). Found: a 30 degree whip per scroll step at the gap exit (view swung 120 degrees toward Merdeka in one stretch), a wall clip at about 36 % (the path ran through a building), another whip entering the Merdeka circle (it began on the far side of the tower), and a speed spike over the Exchange.
- Fixes in `assets/scene.js`: the district route (`DIST` branch of `buildKF`) now leaves the gap rising with the view turning a little at a time (`exit`, `turn1`, `turn2`, `out`), approaches Merdeka from the near side (`approach`, circle starts at 230 degrees and goes the long way, `arcD`), leaves it with extra turning points (`m5`, `turnA` to `turnC`, `turn`, `cross`), then `pass` looks at the Exchange rather than at the ground. Camera rotation is now eased in the ride (`rideQ`, slerp with about a 0.2 s time constant, reset on snap and when leaving the flight), so any remaining sharp turn cannot show as a jolt. The captions (`CAPS`, district only) were re-mapped to the new waypoints: `over to turn1`, `turn1 to m5`, `m5 to pass`.
- Result: zero samples within 6 units of a wall (was 4 within 1.4), worst route turn 15 degrees per step (was 30), worst per-frame camera rotation 6.5 degrees at full scrub speed, no speed spikes except a mild one over the Exchange; right caption at every point checked.
- Not done yet (owner said later): the extra sci-fi layer (moons, circles, dragons, stars). Open: real-device feel is unchecked. Cache key `20261112b`.

## 2026-11-12 · More Merdeka 118
- Owner: Merdeka 118 is their favourite building. (1) In the district version the flight never visited it (it ended on a wide shot). The district route in `assets/scene.js` (`buildKF`, `DIST` branch) now mirrors the OSM one: out through the gap, a slow climb round Merdeka (`m0`..`m4`, slow factor 2.4, centre `MCD` = (82, 364) in the flight's (u, w) frame), then across to The Exchange (`turn`, `pass`, centre `EXD` = (331, 85)) and the wide `end` shot. Captions are the same six as before (the old district caption hack is gone). `arcAt` takes the district centre when `DIST`.
- (2) A lead-in of its own before Skills: `#merdekastage` ("My favourite building", "679 m, the tallest in Malaysia"), camera low at the base looking up with Menara KL and the Petronas Towers small beside it; label on the right (`.stage-r`). The skill-tree shots still climb it base to spire. Cache key `20261112a`.
- Checked flight points (out, m0 to m4, turn, pass, end) and the lead-in at 1300 px and 390 px; no page errors. Open: the flight now has more scroll spent on Merdeka (`.enter` is still 780vh); the end shot is a rough guess.

## 2026-11-12 · Phones see the city behind the content
- Owner (iPhone screenshot): solid panels hid the whole scene. The "no panels" rules in `assets/scene.css` now apply at every width, not only 1000 px and up: sections and the hero have no panel, headings and loose text keep small plates, cards stay solid. Notes also has no panel on phones (two folder columns are still desktop only). On phones the gaps between blocks are 84 px (were 28) so more of the city shows. The left/right layout and the skill-tree split stay desktop only. Cache key `20261111s`.
- Checked 390 px: me, notes, UTP, journey; smoke test 30/30. Open: legibility of the glass Notes folders over the busy city on a phone; real-phone speed.

## 2026-11-11 · Phone version: the 3D city is the default again, loading note removed
- Owner: the poly city on a phone "ain't so bad", so the lite mode (no 3D, 5 second "use desktop" screen) was removed again: head script, `#lite-load`, the inline loader and the `.lite` CSS are gone; three.js and `scene.js` are plain deferred scripts as before. Phones run the same scene as desktop (with the existing phone camera tweaks in `scene.js`: `mobile` poses, no side offset). Cache key `20261111r`.
- Open: real-phone frame rate is still untested; the lite version is in git history (`e549069`) if it is wanted as a fallback for slow devices.

## 2026-11-11 · Light phone version with a loading note
- Screens up to 820 px wide get the lite version. A small script in the head adds `html.lite` (and `gl`, so the panel styles apply) before first paint. In lite mode three.js, `scene.js` and all of `assets/city/` are never requested (the scripts are now injected by an inline loader that returns early on phones); the canvas, flight, spin and stage sections are hidden; the body has a still sky-blue gradient. The page is about 2.3 MB on a phone against 5.4 MB on desktop (measured by response sizes in Playwright).
- Loading screen (`#lite-load`, styles in `scene.css`): the name, a pulsing block, "Use desktop for the best experience" and a 5 second bar, then it fades out. A big Continue button skips it. Shown once per visit (sessionStorage `lite-seen`; reloading in the same tab skips it). Reduced motion removes the animation. Cache key `20261111q`.
- The decision is made once at load; rotating or resizing a phone later does not switch versions. `/flight/` is unchanged (it always runs the 3D scene).
- Checked 390 px (loading, opening, Notes) and 1300 px (unchanged, 8 scene requests); smoke test 30/30. Open: real-phone speed untested; the opening's reel and the glass folders still run on phones.

## 2026-11-11 · Content goes behind the top bar
- Owner: the Notes folders overflowed on top of the top bar instead of going behind it. The glass folders use `z-index: 10`, the bar only 5. `assets/scene.css`: `.top` is now `z-index: 18` and a solid `var(--bg)` (below the Ctrl+K dialog at 20); this applies to the notes pages too. Cache key `20261111p`. Checked at 1300 px: folders scroll behind the bar, Ctrl+K still opens above it, smoke test 30/30.
- Parked for later (owner's request): lighter phone version, plus a roughly 5 second loading screen that fades out saying "use desktop for the best experience". Not started.

## 2026-11-11 · No panels behind any block on wide screens
- Owner liked how Notes works (no panel, cards straight on the city) and asked for the same everywhere. `assets/scene.css`: at 1000 px and wider, every `main>section.block` and the hero lose their background, border and shadow; section headings (`.sec-head`), the hero's text, the goal cards, fact tiles and the journey legend get their own small plate; the cards that used to sit on the panel (`.jr-card`, `.cf-details`, `.uni-card`, `.st-branch`, `.card`, etc.) are made solid so the city does not ghost through. Phones are unchanged (still panels) at the owner's request ("leave the phone for now"). Cache key `20261111o`.
- Checked 1300 px: me, goals, UTP, work, pulse, journey, contact. Open: some inner text with no card of its own may still sit directly on the city in places; tell me where it is hard to read.

## 2026-11-11 · Floating screens removed entirely
- Owner did not like the floating panel (the conveyor of screens) behind the towers. The code is gone from `assets/scene.js` (`ringUpdate` is a no-op); nothing floats behind the towers any more. The opening keeps its own flat spin reel. Git history has both versions (`dc09e21`, `d1665c5` for the conveyor). Cache key `20261111m`.
- Owner confirmed the landmark zips are the same files as before and that the district's own KL Tower stays (no cut-out for Menara KL).

## 2026-11-11 · District re-baked from the original, Exchange 106 re-cropped, bigger conveyor
- Owner pushed the original KL City Centre to branch `kl-poly-design` (`model.dae`, 69 MB SketchUp 8). Nothing from it is on `main`. `tools/bake-district.py` re-bakes it (after `tools/convert-dae-dump.py`): 413k triangles within 1100 m of the towers, entirely-underground faces dropped, duplicate front/back faces removed, welded at 0.8 m (the weld rises until it fits 65535 vertices) instead of the old 3 m weld that dropped thin walls and many whole buildings. New `assets/city/klcc_district.json` is 1.59 MB (was 1.14 MB), 64.5k vertices, 134k triangles. The district material is now double-sided (SketchUp faces have no consistent winding).
- The ugly Exchange 106 was my own doing: I had clustered it to a 2.5 m grid. Re-cropped at 0.7 m with `tools/convert-dae-crop.py` (now `assets/city/exchange106.json` 765 KB, was 306 KB): clean taper, no shards.
- Conveyor of screens (behind the towers, follows the camera bearing) is now live and bigger (66 x 40, 7 screens). It was meant to be reviewed first; the owner then asked for it bigger and moved on, so it shipped with this. Cache key `20261111l`.
- Open: page weight is up about 1 MB. Real-phone frame rate is untested with 134k triangles. The district's own landmarks inside the cut circles (Petronas 150 m, Merdeka 200 m, Exchange 125 m) are still replaced by the hand-made models.

## 2026-11-11 · Conveyor of screens (branch only, awaiting the owner's look)
- Replaces the removed ring: flat project screens on a belt that always sits behind the towers as the camera sees them (follows the camera bearing, faces it), slides sideways at about 4.5 units/s and fades at the two wrap points. Hidden in the flight. Code: `THE CONVEYOR OF SCREENS` in `assets/scene.js`. Committed to branch `claude/wonderful-galileo-bgrct6` only, not `main`, because the owner asked to see it first.
- Open: the owner thinks some district buildings look hollow (probably the 3 m weld dropping thin faces). The owner may send the original district folder so it can be re-baked at a finer weld.

## 2026-11-11 · District map kept, its ugly landmarks swapped for the hand-made models; ring removed
- Owner: the district looked ugly, but meant only the ugly parts (the blocky landmarks), not the whole map. `assets/scene.js` now cuts the district mesh's own versions of the Petronas Towers (150 m round the midpoint), Merdeka 118 (200 m) and The Exchange 106 (125 m) out when it loads, and stands the hand-made models there (`klcc.json`, `merdeka118.json`, `exchange106.json`); Menara KL and the rest of the district stay as the district has them. `?bg=osm` still gives the full OpenStreetMap city.
- The ring of screens was removed (bent slivers, one clipping into a tower); the opening's flat spin reel is shown again. Cache key `20261111j`.
- Open: "remove background pls" was ambiguous. I took it as the ring and the ugly landmark meshes; if it meant no 3D city at all, say so.

## 2026-11-11 · Ring of screens removed
- Owner: "bro whats this LMAO". The ring of project screens (added earlier the same day) rendered as bent, tilted slivers crowded beside one tower, one clipping into it. Removed from `assets/scene.js` (`ringUpdate` is now a no-op) and the opening's flat spin reel is shown again (the CSS that hid it is gone). Cache key `20261111i`.
- If screens behind the towers are wanted again: build them as flat, camera-facing quads on one fixed side (a slow conveyor behind the crowns) instead of a rotating cylinder.

## 2026-11-11 · Section director, ring of screens, the district as the default city
- **Section director** (`assets/scene.js`, `DIR` keys): before the flight every section has its own camera shot, smoothed by a spring. Notes: under the Petronas Towers looking up, climbing as you read. UTP: the shot follows the coverflow group (`cf-change` event added to `coverflow.js`; 7 shots: whole, crowns, side-on, foot, from above, podium, back). Skills: Merdeka 118 base to spire. Work: Menara KL (new `#workstage` lead-in). Journey: The Exchange 106. Panels keep to one side on wide screens (`side-l`, `side-r`, `tree-split` in `scene.css`); the skill tree splits left and right of the building. Notes has no panel, folders two per row.
- **Ring of screens**: the project screenshots (the old flat reel's list) hang on a ring round the towers' crowns and turn slowly; near-side screens fade so they never block the view; hidden in the flight. The old flat reel is hidden when WebGL runs.
- **District background** (another session's branch `compact-district-background`, merged): one welded mesh of KLCC and its surroundings, far richer than the OSM city, one draw call. It is now the default; `?bg=osm` brings the old city and hand-placed landmarks back. In the district Merdeka 118, Exchange 106 and Menara KL stand just south of KLCC (so `MER`, `EXC`, `KLT` and the flight differ under `DIST`). Its baked Exchange and Merdeka were welded coarsely and had holes, so the full-detail models are drawn over them (1 % larger).
- Checked 1300 px: notes, UTP groups, skills, work, journey and `/flight/` at five points, no page errors. Real-phone frame rate untested. Cache key `20261111h`.
- Open: UTP shots 1 to 6 and the Journey shot were tuned on the old layout and checked only briefly on the district; the left/right layout is wide screens only (phones keep the stacked panels). Not yet reviewed by the owner.

## 2026-11-11 · A scroll buffer after the opening where the city turns
- Owner asked for a scrolling buffer after "I write the spec. Then I build it." where the background rotates a bit before the details start. New `<section id="spin">` between the opening and *This is me* (150vh, 130vh on phones, no panel). In `assets/scene.js` `prog()` now maps the orbit in three parts: slow before, a fast eased turn of about 85 degrees (28 % of the orbit) while `#spin` is on screen, then the old slow drift (the end pose is unchanged, so the flight still starts where it did). A "Kuala Lumpur, 3.158 N 101.712 E" tag fades in mid-buffer. Spin metrics are read on scroll only, not per frame.
- Checked 1300 px light and dark and 390 px: camera bearing goes about 48 to 133 degrees through the buffer, no errors, no sideways scroll; `tools/check.js` 30/30. Cache key `20261111e`.
- Open: the amount and length are guesses; `SPW` and the `.spin` height tune them. Not tried on a real phone.

## 2026-11-11 · Notes pages re-skinned to match, and a flight-only page
- Notes pages (`notes/*.html`) now load `assets/scene.css` too: same blues, article on a hard-shadow panel, and the aurora is replaced by a still, lightly blurred picture of the city (`assets/city-light.webp` 19 KB, `assets/city-dark.webp` 49 KB). No WebGL on notes. The pictures come from `node tools/make-note-backdrops.js` (re-run it if the scene changes). Theme-colour is the blue on notes. Cache key `20261111d`.
- New `/flight/` (`flight/index.html`): the scene with no floating UI, for viewing and debugging. Scroll flies the route; **H** (or `?panel`) opens a panel with a scrub slider, auto-fly with speed, captions + HUD toggle, theme and a link to the current moment (`#t=0.42`). `scene.js` got `BASE` (loads models relative to itself, so it works from any folder) and a `data-flight-only` mode (no orbit phase). Documented in the README. Not linked from the site, noindex.
- Bug found while testing: auto-fly stuck because `site.css` has `scroll-behavior: smooth`; per-frame scrolling is now instant and keeps its own fractional position.
- Checked: notes index, a long note, the slb-screens tour and a phone note in light/dark; `/flight/` clean, with panel, dark and at 390 px; keyboard (H, Space, arrows, T, U) and wheel-stops-auto-fly. `tools/check.js` now includes `/flight/`. Real-phone frame rate still untested.
- Open: `/flight/` has its own copy of the `#enter` markup; if captions change on the home page, change them there too.

## 2026-11-11 · One site: the 3D city is the home page, no more /v2/
- Owner asked to merge v1 and v2 into a single site with no version name. The old flat-aurora site is commit **`f3b9f08`** (a tag could not be pushed to GitHub from here); to get it back: `git checkout f3b9f08`.
- `/` is now the 3D city version: `index.html` carries the canvas, the flight section and the three.js / `scene.js` scripts directly (no generator). Moved: `v2/v2-3d.js` to `assets/scene.js`, `v2/merge.css` to `assets/scene.css`, models and facade textures to `assets/city/`. Removed: `v2/`, `tools/build-v2.py`, `tools/v2-flight.html`, the "Classic site" nav link, the noindex tag and the before/after screenshots. The og/twitter tags are back (the preview had stripped them). Theme colour is now the blue. `tools/check.js` no longer lists `v2/`; the screenshots were renamed `city-*`. README section is now "The 3D city and the flight"; `CLAUDE.md` updated. Cache key `20261111c` everywhere.
- Fixed a miss from my last push: `main` still had the DevFest slide and its (deleted) photo, so the live page had a broken image. That commit had only updated the generated page. Both the DevFest removal and the curtain photos are now in `index.html`.
- Notes pages keep the plain aurora look (they use only `site.css`); the home page is blue. Open: re-skin the notes pages to match if wanted.
- Checked 1300 px light/dark and 390 px: no page errors, no sideways scroll; `tools/check.js` 28/28. Real-phone frame rate still untested. Old links to `/v2/` now 404.

## 2026-11-11 · Photos into the curtain, DevFest slide removed
- Owner: the DevFest photo is just their lanyard, not an event they took part in, so the "At DevFest" slide (claim) and `assets/me/devfest-lanyard.webp` are removed (the carousel is back to 7 slides). `portrait-white-wall.webp` joins the left curtain column and `on-a-call.webp` the right one: a fifth photo in each repeat group (`--k:4`), so they cycle in with the graduation photos. `v2/index.html` regenerated.
- Checked 1300 px and 390 px: all new images load, no errors; `tools/check.js` 30/30. No CSS or JS changed, so no cache-key bump.
- Open: the curtain's "I write the spec" reel act and the earlier reel-wrap change (0e8cf40) were not touched. If the reel change was unwanted, say so and it is a quick revert.

## 2026-11-11 · Spin reel wraps further round on phones
- On narrow screens (under 600 px wide) `assets/curved-reel.js` now uses tiles at 62% of the size, a narrower width cap (30% of the screen) and a deeper bend (85 degrees instead of the page's 70). The reel shows about three tiles curving away on both sides, instead of one flat banner. Desktop is unchanged. Checked on `/v2/` at 390 px (the opening's reel act) and the classic page at 390 px and 1300 px. Cache key `20261111b`.
- Open: not tried on a real phone. If it is too small or too curved, the two numbers are `0.62` and `85` in `render()`.

## 2026-11-11 · Three new photos in the "This is me" card
- Added three photos as slides 6 to 8 of the REQ-001 carousel (photo, title, one line each): `portrait-white-wall.webp` ("Straight on"), `devfest-lanyard.webp` ("At DevFest") and `on-a-call.webp` ("Between meetings"). `index.html` edited, `v2/index.html` regenerated with `tools/build-v2.py`. The card's steady height is unchanged (the new quotes are short).
- Privacy (public repo): the call photo is the webcam frame only, cropped out of a screenshot, so none of the tabs, the work email, the meeting title or colleague names are in it. The DevFest mirror selfie is cropped above the Menara Maxis visitor badge (a client name) and shows only the DevFest lanyard. Metadata stripped (re-encoded, 0 EXIF tags); originals are not in the repo.
- Not used: the fourth upload, a phone photo of a laptop screen showing the same call. It is skewed and shows work tabs, client names and the work email; the cropped webcam frame covers it. A clean screenshot or a normal photo would work.
- Open: the captions are my wording, so the owner should check them (especially "At DevFest" and "Between meetings"). The webcam frame is low resolution, so a better photo would look sharper.

## 2026-11-11 · "This is me" card no longer reserves the tallest slide's height
- Owner's phone screenshots showed a big empty gap under the short slides (the card kept the height of "Why hire me", because hidden slides stayed in layout).
- Now hidden slides are `display:none`, and `extras.js` (`fit()`) sets `--ms-h` on `.ms-slides` to the height of the short slides (never under about 11em). The longer "Why hire me" slide scrolls inside that box (thin scrollbar, soft fade at the bottom while there is more, `overscroll-behavior: contain`). Scrolling inside a slide pauses the auto-advance like any other touch. Works on the classic page and on `/v2/`: same shared `site.css` and `extras.js`.
- Checked on the classic page and `/v2/` at 390 px and 1300 px: the box height is the same on all five slides and the hire slide scrolls (396 px of content in a 215 px box on a phone). `tools/check.js`: 30/30 OK. Cache key is now `20261111a`.
- Open: not yet tried on a real phone (touch scroll inside the card while the page also scrolls).

## 2026-11-10 · /v2/ is now v1 + v2 merged
- Owner asked for both worlds in one: v1's content, readability, components and way of delivering a portfolio, with v2's 3D city background and look. Info boxes and v2's fonts are not needed.
- `tools/build-v2.py` generates `v2/index.html` from `index.html` (paths to `../`, canvas instead of the aurora, `merge.css`, flight section, three.js). `v2/merge.css` remaps v1's tokens to v2's blues (light paper-blue, v2's night navy for dark), makes each section an opaque panel with a hard shadow, plates the opening's words, and holds the flight HUD styles. Fonts stay v1's (readable); Pixelify Sans only on the HUD.
- The flight moved to between Journey and Contact, with a big *Skip the flight* button; the dock hides while it plays. Scene redraws at ~15 fps while only reading. `pulse.js` now finds its data next to itself. Old stand-alone v2 (`v2.css`, `v2.js`, floating windows) removed; it lives at `c5ca5b5`.
- `tools/check.js` now covers `v2/`: no errors, 404s or sideways scroll at 1300 px and 390 px. Screenshots checked light and dark. Real-phone frame rate and scroll feel still untested.
- Open: notes pages are still plain v1. The v2 page loads about 3 MB of models on top of v1's images.

## 2026-11-10 · /v2/ flight v8: calmer route, smoother camera, sci-fi layer
- Owner feedback: Merdeka part too fast, awkward angles, the camera clipped into Suria KLCC near the skybridge, the spin under the bridge and back felt repetitive, only two buildings looked highlighted (Petronas and Exchange used a different material), the motion was rougher than v1.
- New route (one direction, no loop): swing in, head-on at the skybridge, over the bridge and through the gap, one slow turn up Merdeka 118, over The Exchange 106, wide shot of all four. `#enter` is 780vh. Camera never goes below the bridge level near the towers; raycast sweep: nothing closer than 7 units (the gap itself).
- Smoothness: spring-damped follow instead of a per-frame lerp, scroll map built from path length x slow factor with a monotone cubic (no speed jumps), gentler banking, in-between look-at waypoint so the view never whips.
- All four landmarks share one material. The orb moved out of the flight path.
- Sci-fi layer, inspired by 0z5a.github.io: HUD corners, altitude read-out, progress rail with six sector ticks, landmark tags with distance, beams and halos on each crown, glowing links with pulses, radar ring, floating wireframe shapes.
- Cache key for `/v2/` is `20261110c`. Checked 1100 px light/dark and 390 px by screenshots, no page errors. Real-phone frame rate still untested. Owner says the models are free to download; authors still unrecorded.
- Open: Menara KL is only tagged, not flown past. A real scroll-feel check on a phone is still needed.

## 2026-11-10 · Motion ideas lab (branch only)
- `lab/ideas/index.html`: one self-contained page with four playgrounds from the dropped rail's mechanics: a spine-out notes shelf (turn-to-front), skill flip cards (lift and flip view), a draggable journey strip (springs and bumping) and swinging status hang-tags. Real notes, skills, journey and project data; no images.
- Kept on branch `claude/wonderful-galileo-bgrct6` only, not merged to `main`, and not linked from the site. A private artifact copy was published for previewing.
- Open: owner picks which ideas (if any) to port into the site.

## 2026-11-10 · Project rail dropped
- The owner didn't like the clothes-rail look, so the project rail (commit `5c68a02`) was reverted from the home page and `/v2/`. The cache key is back to `20261108b`.
- The code is still in git history if the spring physics, turn-to-front or flip view are wanted for something else.

## 2026-11-10 · /v2/ flight slowed down, map removed, README story
- Owner asked for a slower flight with more time between the towers, no satellite map, and the history in the README.
- Flight: `#enter` is now 620vh (was 340vh). New 15-waypoint path: sink into the gap, look straight up, rise level with the skybridge, up to the crowns, then Merdeka 118 and over the top. `RT`/`rideU()` give the towers about half of the whole scroll. Six captions. Camera and look-at paths now use uniform Catmull-Rom (centripetal drifted apart).
- Satellite plane and `v2/kl_ground.jpg` removed (the look-at map was disliked). Ground is a plain themed disc (radius 1400) that the fog fades out; the real building footprints stay.
- README: new section "The /v2/ preview: a flight over Kuala Lumpur" with the version history (low-poly canvas to now), how it works, how to rebuild the data, how to change the flight, gotchas and the licence caveat.
- Checked 1300 px light/dark and 390 px: no page errors. Frame rate on a real phone untested.
- Open: model and texture licences still unconfirmed (see README).

## 2026-11-10 · /v2/ real KL city, and the ride becomes a flight
- The owner supplied a Kuala Lumpur city FBX (blender-osm: OpenStreetMap footprints extruded to their tagged heights, plus a 4608x3072 satellite photo and four facade textures). `tools/convert-city.py` parses the binary FBX, ear-clips the polygons, drops the OSM stand-ins where the hand-made landmarks stand (KLCC, Merdeka 118, Exchange 106, Menara KL), recentres on KLCC and writes `v2/kl_city.json` (about 535 KB, 34k vertices, int16 at 0.1 m). It replaces the old random block ring. The ground is the satellite photo (`v2/kl_ground.jpg`, downscaled to 2048 px) on a plane trimmed to the part of the map the photo covers, using the FBX's own UV stretch (u 0..1, v 0.083..0.863).
- Windows come from a shader (`facade()` in `v2/v2-3d.js`): the owner's glass texture gives a window grid by day, the night-office texture lights the windows in dark mode. It is applied to the city and to the landmark models, so floors are readable as the camera climbs.
- The scroll ride is now a flight (the masjid was dropped): down to the plaza between the Petronas Towers, straight up their sides ("Look up"), across to Merdeka 118 and up its face, over the top, then a wide shot. The orbit camera is higher (about 330 m) so it clears the real skyline. Bug fixed: `html.gl` must be set before the scroll maths runs, or `#enter` is `display:none` and the ride starts partway in.
- The city is the real layout, but Merdeka 118, Exchange 106 and Menara KL are not at their true places (they are outside this map), so they are placed beside KLCC. Merdeka 118 is not marked as such in the city file.
- Checked 1300 px light and dark and 390 px: no page errors. Frame rate on a real phone is untested; the page now loads about 3 MB of models and textures.
- Open: author and licence of the supplied models and textures are unknown (no readmes); confirm before keeping them public, or delete the `.json` / `.jpg` files in `v2/`.

## 2026-11-10 · /v2/ scroll ride into Masjid Negara
- New `#enter` section at the end of `/v2/` (340vh, sticky captions). The page scroll is now split: the first part still orbits the skyline, then the camera flies along a Catmull-Rom path (`buildRide()` in `v2/v2-3d.js`) over the pool, through the entrance, along the prayer hall toward the mihrab, then up under the dome. `cam.near` is now 0.3 so interior walls don't clip.
- The masjid now has a real interior: hollow hall with an entrance, carpet rows, ring of columns, mihrab niche, coffered ceiling with a round opening under the 18-fold dome (dome and finial heights also fixed). Dark mode adds a warm interior lamp and a dome glow.
- Without WebGL the section is hidden (`html.gl .enter`). Checked 1300 px light/dark and 390 px: no page errors. Real-device frame rate untested.
- Open: the interior is simple geometry; add arches, a minbar or chandeliers if wanted. A taller or longer ride is one CSS value (`.enter` height).

## 2026-11-10 · /v2/ skyline: KL Tower, Exchange 106, Masjid Negara
- Added the owner's Menara KL model (`v2/menara_kl.json`, from an OBJ) and The Exchange 106 (`v2/exchange106.json`, cropped out of a 55 MB SketchUp Collada precinct and simplified by vertex clustering to about 20k triangles). They replace the stand-in cylinder tower. Tools: `tools/convert-obj.py` (replaces `convert-klcc.py`; takes glass materials or a glass height band), `convert-dae-dump.py` + `convert-dae-crop.py` for big Collada files.
- Masjid Negara is built from code in `v2/v2-3d.js` (no model): 18-fold pleated umbrella dome in the flag's blue with a red band and yellow finial, smaller pleated dome, minaret, waffle-coffered roof slabs, sawtooth hall, reflecting pool. It sits at the foot of the towers in the hero. Hero is a little taller (`min(88vh,720px)`) and the camera raised slightly so it shows.
- Checked at 1300 px light/dark and 390 px: no page errors. Frame rate on a real phone is untested; total model data is about 1.1 MB.
- Open: author and licence of all supplied models are unknown. Confirm they can be published, or delete the `.json` files (the page then falls back to the built Petronas tower and the stand-in KL Tower).

## 2026-11-10 · Merdeka PNB 118 added to /v2/
- Added the owner's Merdeka PNB 118 model (SketchUp Collada, zip) to the `/v2/` skyline behind and to the right of the Petronas Towers. `tools/convert-dae.py` flattens the Collada scene graph (inches, Z-up, instanced nodes) into `v2/merdeka118.json` (about 58 KB, 1.2k vertices). Both landmarks share one scale, so Merdeka 118 stands taller than the towers, as in life. `v2-3d.js` now loads both through one `loadModel()`.
- The raw `.skp` upload can't be read here, so the Collada export was used instead.
- Open: author and licence of both models are unknown (no readme). Confirm they may be redistributed, or delete `v2/klcc.json` / `v2/merdeka118.json`; the page falls back to the built tower, or just omits Merdeka.

## 2026-11-10 · /v2/ uses the real Petronas Towers model
- The owner supplied a SketchUp export of the Petronas Twin Towers (OBJ in a zip). `tools/convert-klcc.py` ear-clips it to triangles, splits it into body and glass, recentres it and writes `v2/klcc.json` (about 520 KB, 16.7k vertices). `v2/v2-3d.js` loads it and scales it to the scene; the old hand-built towers remain as a fallback if the file fails to load.
- Merdeka 118 (`.skp`) was also supplied but SketchUp's own format can't be read here. It needs exporting from SketchUp as OBJ, DAE or glTF first.
- Open: the model's author and licence are unknown (the zip came with no readme). Confirm it may be redistributed, or remove `v2/klcc.json` (the page falls back to the built tower).

## 2026-11-09 · /v2/ scroll-driven KLCC
- `/v2/` now has a fixed WebGL background (`v2/v2-3d.js`, three.js r128 from cdnjs): low-poly KLCC twin towers, skybridge, KL Tower, city ring and orb. The camera orbits and rises/falls with scroll. Light/dark recolors it.
- Falls back to the 2D canvas skyline in `v2.js` when WebGL or the CDN script is missing (`html.gl` class marks 3D on). Windows stay opaque, no backdrop-filter. Reduced motion renders only on scroll/resize.
- Tested only with software GL in headless Chromium (no page errors, no sideways scroll at 1300 and 390 px). Real-device fps is untested; check on a phone.

## 2026-11-09 · /v2/ preview
- New preview at `/v2/` (`v2/index.html`, `v2.css`, `v2.js`): low-poly KL skyline hero on a canvas, floating aqua windows (About, Work, Notes, Skills, Journey, Why, Contact), light/dark toggle, big buttons. Inspired by a reference site; all code and text are original.
- Self-contained: doesn't touch `site.css` or `extras.js`, so no cache-key bump. Links back to the main site and notes with `../`.
- Open: owner to review `/v2/`, then decide whether to swap it in as the homepage. Add a card for UTP studies if wanted. Pixelify Sans loads from Google Fonts; self-host if that matters. The main site gained Pulse and the Roblox card in the meantime; `/v2/` doesn't have them yet.

## 2026-11-10 · Glass lab prototype
- `lab/glass.html` (not linked from the site) and `assets/glass.js`: a reeded-glass panel in one WebGL shader, no library. Sliders for ribs, bend and frost; Aurora or app screenshot as the picture.
- Draws only on screen and in a visible tab; reduced motion = one still frame. Not yet checked at 4x CPU throttle on a real phone.
- Open: decide whether it goes on the page (hero or Notes header) or stays a lab.

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
