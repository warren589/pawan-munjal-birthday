# A Portrait in Words: muted direction

A frontend-only prototype of the birthday tribute for Dr. Pawan Munjal. It's plain HTML, CSS and JS with no build step. Open `index.html`, or serve the folder.

- **Portrait style:** "fine head, uniform body". Every word in an area is the same size: small condensed capitals (Archivo Narrow) across the head, and one slightly larger size across the body. The photo shows through ink tone only, on one warm paper background.
- **Facets:** each facet has its own photograph, cut out to show only him, and its own muted ink. Family and Mentor show a placeholder silhouette until photography arrives.
- **Scrolling:** the portrait stays fixed and crossfades from one facet to the next as you scroll, while the notes scroll past.
- **Messages:** write a message and every matched word flies into the portrait. Words for other facets go to their number on the timeline. Visitor words keep the same size, set in a single accent ink.
- **Files:** `js/portraits.js` holds the prepared photographs (luminance and mask), `js/portrait.js` the renderer, `js/app.js` the story, the message flow and the letters, and `js/data.js` the facets, vocabulary and demo messages.
- **`variations/`:** the earlier portrait style studies.
