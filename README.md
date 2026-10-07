# A Portrait in Words — interaction prototype

A frontend-only prototype of the birthday tribute for Dr. Pawan Munjal. It uses plain HTML, CSS and JS, has no build step, and keeps all data local.

**Run:** open `index.html` in a browser, or serve the folder (`npx serve .` / `python3 -m http.server`).

- `js/portrait.js` is the canvas word-portrait renderer. The photo tone map guides where words go, and words are composited with a colour-mapped version of it.
- `js/data.js` holds the facets, the ~190-word curated vocabulary with facet mappings, and the demo messages (fictional).
- `js/portrait-data.js` is the pre-processed tone map of `assets/pawan-munjal.jpg`. It is embedded as a data URI so the canvas works from `file://`.
- `js/app.js` handles the scroll story, the composer, deterministic three-word extraction (no AI), the contribution animation, the word sheet, and Find my words.

Facets 02–07 use abstract placeholder compositions until client photography is supplied.

**Two visual directions** can be switched with the *Look* toggle in the header, or with `?look=poster` / `?look=glow`:
- **Poster** (default) puts each facet on a flat full-bleed colour taken from the earlier pawanmunjal.life site, with the portrait in ink words and heavy uppercase titles. The hero and finale stay dark.
- **Glow** keeps everything dark, with a luminous colour-mapped portrait.
