(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const body = document.body;
  const FACETS = window.FACETS, CODES = FACETS.map(f => f.code);
  const ACCENT = '#f0643f';            // visitor words: one vermilion, the only colour that isn't the portrait's own
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // a facet's colour lifted towards the light type, for headings and labels on the painting
  const tint = h => '#' + [1, 3, 5].map(i => Math.round(parseInt(h.slice(i, i + 2), 16) * 0.38 + [242, 236, 226][(i - 1) / 2] * 0.62).toString(16).padStart(2, '0')).join('');
  const smooth = (a, b, t) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };

  // ---------------- vocabulary + word extraction (deterministic, no AI) ----------------
  const VOCAB = new Map(), ALIAS = new Map();
  window.VOCAB_RAW.forEach(line => {
    const [forms, codes] = line.split('|'), list = forms.split(','), w = list[0];
    const e = VOCAB.get(w) || { w, facets: new Set() };
    codes.split('').forEach(c => e.facets.add(c)); VOCAB.set(w, e);
    list.forEach(f => ALIAS.set(f, w));
  });
  function lookup(tok) {
    if (ALIAS.has(tok)) return ALIAS.get(tok);
    const tries = [];
    if (tok.endsWith('ies')) tries.push(tok.slice(0, -3) + 'y');
    if (tok.endsWith('es')) tries.push(tok.slice(0, -2));
    if (tok.endsWith('s')) tries.push(tok.slice(0, -1));
    if (tok.endsWith('ed')) tries.push(tok.slice(0, -2), tok.slice(0, -1));
    if (tok.endsWith('ing')) tries.push(tok.slice(0, -3), tok.slice(0, -3) + 'e');
    if (tok.endsWith('ly')) tries.push(tok.slice(0, -2));
    for (const t of tries) if (ALIAS.has(t)) return ALIAS.get(t);
    return null;
  }
  const used = new Set();
  function extract(text) {
    const found = new Map(), re = /[A-Za-z’']+/g; let m;
    while ((m = re.exec(text))) {
      const w = lookup(m[0].toLowerCase().replace(/[’']s?$/, ''));
      if (w) { const f = found.get(w) || { w, spans: [] }; f.spans.push([m.index, m.index + m[0].length]); found.set(w, f); }
    }
    const words = [...found.keys()], fallback = new Set();
    if (!words.length) for (const fb of [...window.FALLBACK_WORDS.filter(f => !used.has(f)), ...window.FALLBACK_WORDS]) {
      if (words.length >= 2) break; if (!words.includes(fb)) { words.push(fb); fallback.add(fb); }
    }
    return { words, found, fallback };
  }
  const facetsOf = (w, fb) => (fb && fb.has(w)) ? ['J'] : [...(VOCAB.get(w)?.facets || ['J'])];

  // ---------------- messages ----------------
  const messages = window.SAMPLE_MESSAGES.map(s => {
    const ex = extract(s.text);
    return { ...s, words: ex.words, facets: new Set(ex.words.flatMap(w => facetsOf(w, ex.fallback))) };
  });
  const forWord = (w, code, R) => {
    const hits = messages.map((m, i) => i).filter(i => messages[i].words.includes(w));
    const pool = hits.length ? hits : messages.map((m, i) => i).filter(i => !code || messages[i].facets.has(code));
    return pool.length ? pool[(R() * pool.length) | 0] : 0;
  };
  const seeded = s => { let a = s; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };

  // ---------------- portrait specs ----------------
  const STATES = ['hero', ...FACETS.map((f, i) => String(i)), 'final'];
  const specs = {};
  function spec(state) {
    if (specs[state]) return specs[state];
    const fi = /^\d$/.test(state) ? +state : -1, f = FACETS[fi], code = f ? f.code : null, R = seeded(31 + STATES.indexOf(state) * 17);
    const words = [];
    messages.forEach((m, i) => { if (!code || m.facets.has(code)) m.words.forEach(w => { for (let k = 0; k < 3; k++) words.push({ t: w, m: i }); }); });
    VOCAB.forEach(v => { const n = !code ? 1 : v.facets.has(code) ? 3 : 0; for (let k = 0; k < n; k++) words.push({ t: v.w, m: forWord(v.w, code, R) }); });
    const S = window.STUDIO;
    return (specs[state] = f
      ? { key: 'f' + fi, code, img: f.img, heads: f.heads, headScale: f.headScale, headWeight: f.headWeight, strokes: f.strokes, ink: f.ink, words, seed: 100 + fi }
      : { key: state, code: null, img: S.img, heads: S.heads, ink: S.ink, inks: null, words, seed: state === 'hero' ? 11 : 99 });
  }

  // ---------------- chapters, rail ----------------
  const chapters = $('.chapters'), rail = $('.rail');
  const quoted = new Set();
  FACETS.forEach((f, i) => {
    // a different voice for every facet: prefer a message whose first word belongs to it
    let qi = messages.findIndex((m, k) => !quoted.has(k) && facetsOf(m.words[0])[0] === f.code);
    if (qi < 0) qi = messages.findIndex((m, k) => !quoted.has(k) && m.facets.has(f.code));
    if (qi < 0) qi = 0; quoted.add(qi); const q = messages[qi];
    chapters.insertAdjacentHTML('beforeend', `
      <section class="sec${f.art ? ' painted' : ''}" data-state="${i}" id="facet-${i}" style="--ink:${tint(f.ink[0])};--ink2:${f.ink[0]}">
        <div class="note fnote">
          <p class="eyebrow"><b>${String(i + 1).padStart(2, '0')}</b> / 07 <span>${f.name}</span></p>
          <h2 class="fline">${f.line}</h2>
          <button class="link js-story" type="button" aria-expanded="false">Read his story</button>
          <div class="story" hidden>${f.story.map(p => `<p>${p}</p>`).join('')}</div>
          ${f.img ? '' : '<p class="pending-photo">Placeholder silhouette · photograph to come</p>'}
        </div>
      </section>`);
    rail.insertAdjacentHTML('beforeend', `<button type="button" data-go="${i}" aria-label="${f.name}" style="--ink:${tint(f.ink[0])}"><span>${f.short}</span><b>${String(i + 1).padStart(2, '0')}</b></button>`);
  });
  rail.insertAdjacentHTML('beforeend', `<button type="button" data-go="final" aria-label="The whole person" style="--ink:#f2ece2"><span>One life</span><b>∗</b></button>`);
  chapters.addEventListener('click', e => {
    const b = e.target.closest('.js-story'); if (!b) return;
    const st = b.nextElementSibling, open = st.hidden;
    st.hidden = !open; b.setAttribute('aria-expanded', open); b.textContent = open ? 'Close' : 'Read his story';
    requestAnimationFrame(() => st.classList.toggle('open', open));
    placeAnnot();
  });
  const goTo = id => { const el = id === 'final' ? $('#final') : id === 'hero' ? $('.hero') : $('#facet-' + id); el && el.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  document.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) goTo(g.dataset.go); });

  // ---------------- stage ----------------
  const wp = new window.WordPortraits(), cv = $('.portrait'), ctx = cv.getContext('2d'), frame = $('.frame'), loupe = $('.loupe');
  let W = 0, H = 0, dpr = 1, ready = false;
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');
  const MOBILE = window.matchMedia('(max-width: 820px), (max-width: 1100px) and (orientation: portrait)');
  function geometry() {
    const vw = innerWidth, vh = innerHeight;
    // the stage box; each portrait fits inside it at its own aspect, bottom-centred
    if (MOBILE.matches) { W = Math.round(vw - 24); H = Math.round(Math.min(vh * (vh < 700 ? 0.46 : vh < 780 ? 0.52 : 0.56), W * 1.4)); }
    else { W = Math.round(vw * 0.54); H = Math.round(vh - 76); }   // from just under the header to the bottom edge; narrow enough that wide photos keep clear of the text
    dpr = Math.min(2, devicePixelRatio || 1);
    frame.style.width = W + 'px'; frame.style.height = H + 'px';
    document.documentElement.style.setProperty('--stageH', H + 'px');   // phones set the text just below the portrait
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
  }
  const layoutFor = s => wp.layout(spec(s), W, H, dpr);

  // ---------------- painted facets: the painting itself, set in words ----------------
  // Some facets are shown differently (the family, the golfer). The subject is cut out of an oil painting and set in close rows of small words in the
  // painting's own colours, with its brushwork faintly between the letters; the faces have their own finer rows, blended
  // in softly, so each one stays recognisable. Its background is only a faint trace, as with the other portraits. On
  // desktop a few larger words for this facet are set into the family's clothes on the same row grid: each one spans
  // whole rows exactly, and the small words on either side are spaced to meet it, so nothing leaves a gap. The group
  // sits level with the text and fades out softly at the bottom. Scrolling in or out, it comes apart into its words.
  // Phone: as tall as the portraits, panning across the family as you scroll.
  const WORD_SCALE = 1.7, WORD_SCALE_MOBILE = 1.15;   // the paintings' words, relative to each painting's row count (artRows); phones' pictures are smaller
  const LARGE_WORDS = false;   // larger words formed inside the paintings (feature lists in data.js); off: every word one size
  const makeArt = (state, f, fi) => {
    const root = document.documentElement, sec = () => $(`.flow [data-state="${state}"]`);
    const el = document.createElement('canvas'), x = el.getContext('2d');
    el.className = 'famart'; el.setAttribute('aria-label', `${f.name}: an oil painting, set in words. Hover or tap a word to read the message behind it.`);
    $('.stage').appendChild(el);
    // a wider view of the painting round the figure (some facets): its own canvas behind, set in faint words over the
    // painting's brushwork and fading out radially, so the figure sits in its scene without a hard edge
    const scn = f.artScene ? document.createElement('canvas') : null, sx2 = scn && scn.getContext('2d'), simg = new Image();
    if (scn) { scn.className = 'famscene'; scn.setAttribute('aria-hidden', 'true'); $('.stage').insertBefore(scn, el); simg.src = f.artScene.src; }
    let sbox = null, sceneOn = false;
    const img = new Image(), mimg = new Image(), bimg = new Image();
    let built = '', box = null, shown = -1, words = [], layers = null, D = 1, hl = null, lastQ = 0, slots = new Map(), stamp = '';
    img.src = f.art; mimg.src = f.artMask; bimg.src = f.artBg;
    const loaded = Promise.all([img.decode(), mimg.decode(), bimg.decode(), scn ? simg.decode() : null]).catch(() => {});
    function place() {
      const vw = innerWidth, vh = innerHeight, ar = (img.naturalWidth / img.naturalHeight) || 1;
      const hdr = parseFloat(getComputedStyle(root).getPropertyValue('--hdr'));
      let w, h, left, top;
      if (MOBILE.matches) { h = H; w = h * ar; if (w > vw * 1.8) { w = vw * 1.8; h = w / ar; } left = Math.max(0, (vw - w) / 2); top = hdr + 2 + (H - h); }   // a wide group: at most a little wider than the screen, standing where the portraits stand
      else {
        // centred in the space left of the text and level with it (the faded lower edge makes the group read a little high)
        const zl = vw * 0.025, zr = vw * (state === 'hero' || state === 'final' ? 0.585 : 0.63);   // the opening note sits a little further left
        w = Math.min(zr - zl, (vh - hdr - 60) * (f.artScale || 1) * ar); h = w / ar;   // artScale: a figure standing smaller in its scene
        left = zl + (zr - zl - w) / 2; top = Math.max(hdr + 12, vh / 2 - h * 0.44);
      }
      box = { w: Math.round(w), h: Math.round(h), top, left };
      Object.assign(el.style, { width: box.w + 'px', height: box.h + 'px', top: top + 'px', left: left + 'px' });
      sceneOn = !!scn;
      if (scn) {
        // the scene's place, cut to the screen
        // the scene's place, cut to the screen (on a phone only top and bottom: it pans sideways with the painting)
        const a = f.artScene, mob = MOBILE.matches, l0 = left + a.x * box.w, r0 = left + (a.x + a.w) * box.w;
        const l = mob ? Math.max(l0, left - vw * 0.5) : Math.max(0, l0), t = Math.max(mob ? hdr : 0, top + a.y * box.h);
        const r = mob ? Math.min(r0, left + box.w + vw * 0.5) : Math.min(vw * (state === 'hero' || state === 'final' ? 0.56 : 0.61), r0), b = Math.min(vh, top + (a.y + a.h) * box.h);   // desktop: ends well short of the text
        sbox = { left: l, top: t, w: Math.max(1, Math.round(r - l)), h: Math.max(1, Math.round(b - t)) };
        Object.assign(scn.style, { left: l + 'px', top: t + 'px', width: sbox.w + 'px', height: sbox.h + 'px', display: sceneOn ? '' : 'none' });
      }
      shown = -1;
    }
    function buildScene(body) {
      if (!sceneOn || !simg.naturalWidth) return;
      const W2 = Math.round(sbox.w * D), H2 = Math.round(sbox.h * D), a = f.artScene;
      scn.width = W2; scn.height = H2;
      const g = sx2, ox = (box.left - sbox.left) * D, oy = (box.top - sbox.top) * D, bw = box.w * D, bh = box.h * D;
      const ix = ox + a.x * bw, iy = oy + a.y * bh, iw = a.w * bw, ih = a.h * bh;
      // words, coloured by the painting (unless the painting itself is shown)
      const wc = document.createElement('canvas'); wc.width = W2; wc.height = H2; const wg = wc.getContext('2d');
      const fs = body * 0.85, R = seeded(fi * 17 + 3), pool = [...new Set(spec(state).words.map(w => w.t.toUpperCase()))];
      wg.font = `700 ${fs}px ${window.WP_FONT}`; wg.fillStyle = '#fff'; wg.textBaseline = 'alphabetic';
      for (let y = fs * 0.75; y < H2 + fs; y += fs * 0.84) { let px = -R() * fs * 4; while (px < W2) { const t = pool[(R() * pool.length) | 0]; wg.fillText(t, px, y); px += wg.measureText(t).width + fs * 0.16; } }
      wg.globalCompositeOperation = 'source-in'; wg.filter = 'brightness(1.05) saturate(0.95)'; wg.drawImage(simg, ix, iy, iw, ih); wg.filter = 'none';
      // the brushwork underneath, darker, then the words over it
      g.clearRect(0, 0, W2, H2);
      if (f.artScene.paint) {
        // the painting itself round him, its brushwork as painted, a step darker than the figure so he stays in front
        g.globalAlpha = 0.84; g.filter = `brightness(0.88) saturate(${f.artScene.sat || 1})`; g.drawImage(simg, ix, iy, iw, ih); g.filter = 'none'; g.globalAlpha = 1;
      } else {
        g.globalAlpha = 0.38; g.filter = 'brightness(0.8) saturate(0.92)'; g.drawImage(simg, ix, iy, iw, ih); g.filter = 'none';
        g.globalAlpha = 0.68; g.drawImage(wc, 0, 0); g.globalAlpha = 1;
      }
      // artHalo: the painting settles back right round him (softer, quieter, a shade darker), so he stands in front of it
      const hl2 = f.artScene.halo;
      if (hl2) {
        const R = Math.round(bh * (hl2.reach || 0.07)), hm = document.createElement('canvas'); hm.width = W2; hm.height = H2;
        const hx = hm.getContext('2d'); hx.filter = `blur(${R}px)`; for (let k = 0; k < 3; k++) hx.drawImage(img, ox, oy, bw, bh); hx.filter = 'none';
        const soft = document.createElement('canvas'); soft.width = W2; soft.height = H2; const sx3 = soft.getContext('2d');
        sx3.filter = `blur(${Math.round((hl2.blur || 0) * D)}px) saturate(${1 - (hl2.desat || 0)}) brightness(${0.88 * (1 - (hl2.dark || 0))})`;
        sx3.drawImage(simg, ix, iy, iw, ih); sx3.filter = 'none';
        sx3.globalCompositeOperation = 'destination-in'; sx3.drawImage(hm, 0, 0);
        g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.84; g.drawImage(soft, 0, 0); g.globalAlpha = 1;
      }
      // a clear margin round the figure
      g.globalCompositeOperation = 'destination-out'; g.filter = `blur(${Math.round(7 * D)}px)`; g.drawImage(img, ox, oy, bw, bh); g.drawImage(img, ox, oy, bw, bh); g.filter = 'none';
      // a soft oval round him, and out at the bottom with the figure
      g.globalCompositeOperation = 'destination-in';
      // the painting's own edges fade too, wherever they fall inside the view
      const edge = (x0, y0, x1, y1) => { const lg2 = g.createLinearGradient(x0, y0, x1, y1); lg2.addColorStop(0, 'rgba(0,0,0,0)'); lg2.addColorStop(1, '#000'); g.fillStyle = lg2; g.fillRect(0, 0, W2, H2); };
      const ex = iw * 0.14, ey = ih * 0.14;
      if (ix > -ex) edge(ix, 0, ix + ex, 0);
      if (ix + iw < W2 + ex) edge(ix + iw, 0, ix + iw - ex, 0);
      if (iy > -ey) edge(0, iy, 0, iy + ey);
      // and the oval stays clear of the screen's edge
      const cx = ox + bw / 2, cy = oy + bh * 0.45, sxl = MOBILE.matches ? 1e9 : (box.left + box.w / 2) * D;
      // the oval fits inside the painting (and the screen), so it is the oval that is seen, never a rectangle
      // oval: [how much larger, how far out it stays solid] — larger and flatter reads less as a spotlight
      if (f.artScene.natural) {
        // natural: the painting simply softens away on every side over a wide margin, the corners a little more, with no
        // centre to it, the way a painted scene fades into a dark wall
        const L = Math.max(ix, 0), Rr = Math.min(ix + iw, W2), T = Math.max(iy, 0), fw = (Rr - L) * 0.24, fh = (oy + bh - T) * 0.26;
        edge(L, 0, L + fw, 0); edge(Rr, 0, Rr - (Rr - L) * 0.4, 0); edge(0, T, 0, T + fh);   // the side towards the text fades out furthest
        const mx = (L + Rr) / 2, my = (T + oy + bh) / 2, rr = Math.hypot(Rr - L, oy + bh - T) * 0.62;
        const cg = g.createRadialGradient(mx, my, 0, mx, my, rr); cg.addColorStop(0, '#000'); cg.addColorStop(0.72, '#000'); cg.addColorStop(1, 'rgba(0,0,0,0.25)');
        g.fillStyle = cg; g.fillRect(0, 0, W2, H2);
      } else {
        const [grow, solidTo] = f.artScene.oval || [1, 0.5];
        const rx = Math.min((bw * 0.44 + bh * 0.4) * grow, sxl * 0.98, Math.min(cx - ix, ix + iw - cx) * 1.02), ry = Math.min((bh * 0.56 + bw * 0.12) * grow, Math.min(cy - iy, iy + ih - cy) * 1.08);
        g.save(); g.translate(cx, cy); g.scale(1, ry / rx);
        const rg = g.createRadialGradient(0, 0, 0, 0, 0, rx); rg.addColorStop(0, '#000'); rg.addColorStop(solidTo, solidTo > 0.5 ? '#000' : 'rgba(0,0,0,0.8)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = rg; g.fillRect(-rx, -rx, rx * 2, rx * 2); g.restore();
      }
      const fy0 = oy + bh * (f.artFade || 0.86) - bh * 0.1, lg = g.createLinearGradient(0, fy0, 0, oy + bh); lg.addColorStop(0, '#000'); lg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = lg; g.fillRect(0, 0, W2, H2);   // whole canvas: the gradient holds solid above the fade and clear below it
      g.globalCompositeOperation = 'source-over';
    }
    const sceneShow = v => { if (!scn) return; const on = sceneOn && v > 0.002; scn.style.visibility = on ? 'visible' : 'hidden'; scn.style.opacity = on ? (v * (1 - 0.6 * find)).toFixed(3) : 0; };
    function build() {
      if (!box || !img.naturalWidth) return;
      D = Math.min(2, dpr);
      const cw = Math.round(box.w * D), ch = Math.round(box.h * D), mob = MOBILE.matches, key = cw + 'x' + ch + mob;
      if (key === built) return; built = key;
      el.width = cw; el.height = ch;
      const R = seeded(fi * 31 + 7), sw = spec(state).words, pool = [...new Set(sw.map(w => w.t.toUpperCase()))];
      // each word stands for a message that contains it, as in the portraits
      const msgs = new Map(); sw.forEach(w => { const k = w.t.toUpperCase(); if (!msgs.has(k)) msgs.set(k, []); msgs.get(k).push(w.m); });
      const msgFor = t => { const l = msgs.get(t) || [0]; return l[(R() * l.length) | 0]; };
      const pick = () => pool[(R() * pool.length) | 0];
      const mk = () => { const c = document.createElement('canvas'); c.width = cw; c.height = ch; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.textBaseline = 'alphabetic'; return [c, g]; };
      const font = fs => `700 ${fs}px ${window.WP_FONT}`;
      const probe = document.createElement('canvas').getContext('2d');
      const widths = new Map(), widthOf = (t, fs) => { const k = fs + t; let w = widths.get(k); if (w === undefined) { probe.font = font(fs); w = probe.measureText(t).width; widths.set(k, w); } return w; };
      probe.font = font(100); const CAP = (probe.measureText('H').actualBoundingBoxAscent || 72) / 100;   // capitals only: a line is its cap height
      // where the family is (a small copy of the cut-out's outline), and where the faces are
      const mc = document.createElement('canvas'); mc.width = mimg.naturalWidth; mc.height = mimg.naturalHeight;
      const mx = mc.getContext('2d'); mx.drawImage(mimg, 0, 0); const md = mx.getImageData(0, 0, mc.width, mc.height).data;
      const onFamily = (px, py) => md[(Math.min(mc.height - 1, Math.max(0, (py / ch * mc.height) | 0)) * mc.width + Math.min(mc.width - 1, Math.max(0, (px / cw * mc.width) | 0))) * 4] > 150;
      const faces = f.artHeads.map(([hx, hy, rx, ry]) => [hx * cw, hy * ch, rx * cw * 1.3, ry * ch * 1.25]);
      const inFace = (px, py, k = 1) => faces.some(([a, b, rx, ry]) => ((px - a) / (rx * k)) ** 2 + ((py - b) / (ry * k)) ** 2 < 1);
      words = [];

      // a line of words from a to b. A side marked tight meets a large word: the line starts or ends exactly there. With
      // both sides tight the words are chosen to fill the space, then spaced (and at most very slightly widened or
      // narrowed) so the line runs exactly from one to the other.
      function line(fs, y, a, b, tightA, tightB, tag) {
        const space = fs * 0.15, put = (t, px, s) => words.push({ t, x: px, y, w: widthOf(t, fs) * s, fs, s, tag });
        if (!tightA && !tightB) { let px = a - R() * fs * 4; while (px < b) { const t = pick(); put(t, px, 1); px += widthOf(t, fs) + space; } return; }
        if (tightA && !tightB) { let px = a; while (px < b) { const t = pick(); put(t, px, 1); px += widthOf(t, fs) + space; } return; }
        if (!tightA) { let px = b; while (px > a) { const t = pick(), w = widthOf(t, fs); px -= w; put(t, px, 1); px -= space; } return; }
        const L = b - a, run = []; let sum = 0;
        for (let miss = 0; miss < 12;) {
          const t = pick(), w = widthOf(t, fs);
          if (sum + w + space * run.length <= L) { run.push(t); sum += w; miss = 0; } else miss++;
        }
        // the last gap: the word that best fills what is left
        const left = L - sum - space * run.length;
        let best = null, bd = Infinity;
        for (const t of pool) { const d = Math.abs(widthOf(t, fs) - left); if (d < bd) { bd = d; best = t; } }
        if (best && widthOf(best, fs) < left * 1.14 + fs * 0.4) { run.push(best); sum += widthOf(best, fs); }
        if (!run.length) return;
        const gaps = run.length - 1, s = Math.min(1.08, Math.max(0.9, (L - space * gaps) / sum));
        const extra = gaps ? Math.max(-space * 0.5, (L - sum * s - space * gaps) / gaps) : 0;
        let px = gaps ? a : a + (L - sum * s) / 2;
        for (const t of run) { put(t, px, s); px += widthOf(t, fs) * s + space + extra; }
      }

      // the row grid: every line the same height
      // every word one size (faces a little finer, so they stay recognisable), set large enough to read
      const body = ch / (mob ? f.artRowsMobile || 72 : f.artRows || 64) * (mob ? WORD_SCALE_MOBILE : WORD_SCALE), step = body * CAP + body * 0.1, y0 = body * CAP;
      // The larger words (desktop) are not laid over the picture: their letters are made of the small words themselves,
      // set finer and closer inside each letter and a step brighter, with the words just round the letters dimmed a little,
      // so a word appears out of the texture from a distance and is all small words close up. One main word per picture,
      // a few at a medium size, each tilted with the body where that helps.
      // feature: [word, centre x, centre y, widest it may be (fractions of the picture), most rows tall, tilt in degrees]
      const big = [];
      if (!mob && LARGE_WORDS) for (const [t, u, v, maxW, maxRows = 7, deg = 0] of f.feature || []) {
        const cx = u * cw, cy = v * ch, mw = maxW * cw, ang = deg * Math.PI / 180, ca = Math.cos(ang), sa = Math.sin(ang);
        for (let n = maxRows; n >= 2; n--) {
          const fs = ((n - 1) * step + body * CAP) / CAP, w = widthOf(t, fs), capH = fs * CAP;
          if (w > mw) continue;
          // the word's frame: centred on (cx, cy), turned by ang
          const at = (lx, ly) => [cx + lx * ca - ly * sa, cy + lx * sa + ly * ca];
          let fits = true;   // every part of it on the figure, clear of every face and of the other large words
          for (let i = 0; i <= 14 && fits; i++) for (const ly of [-capH / 2, 0, capH / 2]) {
            const [qx, qy] = at(-w / 2 + w * i / 14, ly); if (!onFamily(qx, qy) || inFace(qx, qy, 1.08)) { fits = false; break; }
          }
          const hw = (w * Math.abs(ca) + capH * Math.abs(sa)) / 2 + body, hh = (w * Math.abs(sa) + capH * Math.abs(ca)) / 2 + body;
          if (fits && big.some(q => Math.abs(q.cx - cx) < q.hw + hw && Math.abs(q.cy - cy) < q.hh + hh)) fits = false;
          if (!fits) continue;
          big.push({ t, cx, cy, w, fs, capH, ang, hw, hh });
          break;
        }
      }
      // the letter shapes, a hair bolder than the font (and, for the soft margin round them, much bolder)
      const letters = (g, extra) => big.forEach(q => {
        g.setTransform(Math.cos(q.ang), Math.sin(q.ang), -Math.sin(q.ang), Math.cos(q.ang), q.cx, q.cy);
        g.font = font(q.fs); g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = extra;
        g.fillText(q.t, 0, q.capH / 2); if (extra) g.strokeText(q.t, 0, q.capH / 2);
        g.setTransform(1, 0, 0, 1, 0, 0); g.textAlign = 'left';
      });
      const [lc, lg] = mk(); lg.strokeStyle = '#fff'; letters(lg, body * 0.16);
      const ld = big.length ? lg.getImageData(0, 0, cw, ch).data : null;
      const inLetter = (px, py) => { if (!ld) return false; const X = px | 0, Y = py | 0; return X >= 0 && Y >= 0 && X < cw && Y < ch && ld[(Y * cw + X) * 4 + 3] > 100; };

      for (let y = y0; y < ch + step; y += step) line(body, y, -body * 2, cw + body * 2, false, false, 'b');
      // inside the letters: finer, closer rows over each word's area, sized to its letters so every stroke holds a row or two
      big.forEach(q => {
        const fsI = Math.max(body * 0.34, Math.min(body * 0.62, q.fs * 0.12)), stepI = fsI * CAP + fsI * 0.1;
        for (let y = q.cy - q.hh + fsI * CAP; y < q.cy + q.hh + stepI; y += stepI) line(fsI, y, q.cx - q.hw, q.cx + q.hw, false, false, 'i');
      });
      // the faces: their own finer rows, only where a face is
      const fsF = body * (f.artFaceScale || 0.56), stepF = fsF * CAP + fsF * 0.1;
      for (let y = fsF * CAP; y < ch + stepF; y += stepF) {
        const yc = y - fsF * CAP / 2, spans = [];
        faces.forEach(([a, b, rx, ry]) => { const e = (yc - b) / (ry * 1.15); if (Math.abs(e) < 1) { const hw = rx * 1.15 * Math.sqrt(1 - e * e); spans.push([a - hw - fsF * 2, a + hw + fsF * 2]); } });
        spans.sort((p, q) => p[0] - q[0]);
        const merged = []; spans.forEach(s0 => { const m = merged[merged.length - 1]; if (m && s0[0] <= m[1]) m[1] = Math.max(m[1], s0[1]); else merged.push(s0.slice()); });
        merged.forEach(([a, b]) => line(fsF, y, a, b, false, false, 'f'));
      }
      // keep only words that show: on the figure, on the right side of the soft line between face and body, and (for the
      // letter rows) touching a letter, (for the body rows) not wholly inside one
      words = words.filter(w => {
        const my = w.y - w.fs * CAP / 2, on = [0.02, 0.25, 0.5, 0.75, 0.98].some(k => onFamily(w.x + w.w * k, my) || onFamily(w.x + w.w * k, my - w.fs * CAP * 0.4));
        if (!on) return false;
        if (w.tag === 'i') { for (let i = 0; i <= 6; i++) if (inLetter(w.x + w.w * i / 6, my)) return true; return false; }
        if (w.tag === 'f') return inFace(w.x + w.w / 2, my, 1.12) || inFace(w.x, my, 1.12) || inFace(w.x + w.w, my, 1.12);
        if (inLetter(w.x + 1, my) && inLetter(w.x + w.w / 2, my) && inLetter(w.x + w.w - 1, my)) return false;
        return !inFace(w.x + w.w / 2, my, 0.85);
      });
      const solid = (px, py) => md[(Math.min(mc.height - 1, Math.max(0, (py / ch * mc.height) | 0)) * mc.width + Math.min(mc.width - 1, Math.max(0, (px / cw * mc.width) | 0))) * 4] > 235;
      words.forEach(w => {
        if (w.tag !== 'b') return;
        const top = w.y - w.fs * CAP, pad = w.fs * 0.5;
        w.inside = [-pad, 0, 0.25, 0.5, 0.75, 1, 'e'].every(k => { const qx = k === 'e' ? w.x + w.w + pad : k === -pad ? w.x - pad : w.x + w.w * k; return [top - w.fs * 0.3, top + w.fs * CAP * 0.5, w.y + w.fs * 0.3].every(qy => solid(qx, qy) && !inFace(qx, qy, 1.2)); });
      });
      // draw the sets, each coloured by the cut-out painting, and blend body and faces along feathered ellipses
      const [bc, bg] = mk(), [fc, fg] = mk(), [ic, ig] = mk();
      words.forEach(w => { const g = w.tag === 'f' ? fg : w.tag === 'i' ? ig : bg; g.font = font(w.fs); g.setTransform(w.s, 0, 0, 1, w.x, w.y); g.fillText(w.t, 0, 0); });
      for (const g of [bg, fg, ig]) g.setTransform(1, 0, 0, 1, 0, 0);
      const [mkc, mkg] = mk(); mkg.fillStyle = '#000'; mkg.filter = `blur(${Math.round(body * 0.45)}px)`;
      mkg.beginPath(); faces.forEach(([a, b, rx, ry]) => { mkg.moveTo(a + rx, b); mkg.ellipse(a, b, rx, ry, 0, 0, Math.PI * 2); }); mkg.fill(); mkg.filter = 'none';
      fg.globalCompositeOperation = 'destination-in'; fg.drawImage(mkc, 0, 0);
      bg.globalCompositeOperation = 'destination-out'; bg.drawImage(mkc, 0, 0);
      if (big.length) {
        // round the letters the body words step back a little; inside them they give way to the letter rows
        const [hc, hg] = mk(); hg.fillStyle = hg.strokeStyle = '#000'; hg.filter = `blur(${Math.round(body * 0.5)}px)`; letters(hg, body * 1.3); hg.filter = 'none';
        bg.globalCompositeOperation = 'destination-out'; bg.globalAlpha = 0.62; bg.drawImage(hc, 0, 0); bg.globalAlpha = 1; bg.drawImage(lc, 0, 0);
      }
      // a copy of the letter rows in full, for the hover highlight; the picture itself shows them only inside the letters
      const [ifc, ifg] = mk(); ifg.drawImage(ic, 0, 0);
      ig.globalCompositeOperation = 'destination-in'; ig.drawImage(lc, 0, 0);
      for (const g of [bg, fg]) { g.globalCompositeOperation = 'source-in'; g.filter = `brightness(1.03) saturate(${f.artSat || 1.2}) contrast(${f.artContrast || 1})`; g.drawImage(img, 0, 0, cw, ch); g.filter = 'none'; }
      // a floor under the words' colour: words on dark clothes stay legible against the dark ground instead of vanishing
      for (const [c0, g] of [[bc, bg], [fc, fg]]) {
        const [flc, flg] = mk(); flg.fillStyle = 'rgb(108, 103, 100)'; flg.fillRect(0, 0, cw, ch); flg.globalCompositeOperation = 'destination-in'; flg.drawImage(c0, 0, 0);
        g.globalCompositeOperation = 'lighten'; g.drawImage(flc, 0, 0);
      }
      for (const g of [ig, ifg]) {   // the letter rows a clear step brighter, in the painting's colour softened so no dark stroke breaks a letter
        g.globalCompositeOperation = 'source-in'; g.filter = `blur(${Math.round(body * 0.6)}px) brightness(1.58) saturate(1.12)`; g.drawImage(img, 0, 0, cw, ch); g.filter = 'none';
        g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.14; g.fillStyle = '#fff'; g.fillRect(0, 0, cw, ch); g.globalAlpha = 1;
      }
      // the brushwork under the words, on the family only
      // artUnder: how solidly the figure's own painting shows between the words
      const [uc, ug] = mk(); ug.globalAlpha = f.artUnder || 0.48; ug.filter = `saturate(1.12) contrast(${f.artContrast || 1})`; ug.drawImage(img, 0, 0, cw, ch); ug.filter = 'none'; ug.globalAlpha = 1;
      // the surroundings: a faint field of smaller words in the background's muted colours, clear of the family
      const [sc, sg] = mk(); sg.font = font(body * 0.8);
      for (let y = body * 0.8; y < ch + body; y += body * 0.8 * 0.92) { let px = -R() * body * 3; while (px < cw) { const t = pick(); sg.fillText(t, px, y); px += widthOf(t, body * 0.8) + body * 0.17; } }
      sg.globalCompositeOperation = 'source-in'; sg.drawImage(bimg, 0, 0, cw, ch);
      sg.globalCompositeOperation = 'destination-out'; sg.filter = `blur(${Math.round(6 * D)}px)`; sg.drawImage(img, 0, 0, cw, ch); sg.drawImage(img, 0, 0, cw, ch); sg.filter = 'none';
      const fade = (g, x0, y0_, x1, y1, a, b2) => { const gr = g.createLinearGradient(x0, y0_, x1, y1); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(a, '#000'); gr.addColorStop(b2, '#000'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalCompositeOperation = 'destination-in'; g.fillStyle = gr; g.fillRect(0, 0, cw, ch); };
      fade(sg, 0, 0, cw, 0, 0.18, 0.82); fade(sg, 0, 0, 0, ch, 0.3, 0.7);
      // everything fades out softly towards the bottom, rather than ending on a cut
      for (const g of [bg, fg, ig, ifg, ug]) { fade(g, 0, 0, 0, ch, 0, f.artFade || 0.7); if (f.artFadeX) fade(g, 0, 0, cw, 0, f.artFadeX, 1 - f.artFadeX); }   // and at the sides, where the photograph itself cut people off
      for (const g of [bg, fg, ig, ifg, ug, sg]) g.globalCompositeOperation = 'source-over';
      layers = { b: bc, f: fc, i: ic, full: ifc, under: uc, scene: sc };
      buildScene(body);
      // each word's journey when the painting comes apart: a drift up and to the side, the letter rows last
      words.forEach(w => {
        const a = -Math.PI * (0.25 + R() * 0.5) + (R() - 0.5) * 0.6;
        w.dx = Math.cos(a) * (60 + R() * 220) * D; w.dy = Math.sin(a) * (60 + R() * 200) * D; w.rot = (R() - 0.5) * 0.5;
        w.m = msgFor(w.t); w.d = w.tag === 'i' ? 0.3 + R() * 0.15 : R() * 0.4; w.top = w.y - w.fs * (CAP + 0.08); w.h = w.fs * (CAP + 0.16);
      });
      slots = new Map(); shown = -1;
    }
    const easeIO = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    function paint(q) {
      const cw = el.width, ch = el.height;
      x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cw, ch);
      if (!layers) return;
      if (!sceneOn) { x.globalAlpha = 0.16 * (1 - smooth(0, 0.4, q)); x.drawImage(layers.scene, 0, 0); }
      x.globalAlpha = (1 - smooth(0, 0.45, q)) * (1 - 0.6 * find); x.drawImage(layers.under, 0, 0);
      if (q <= 0) {
        const dim = 1 - 0.72 * find;
        x.globalAlpha = dim; x.drawImage(layers.b, 0, 0); x.drawImage(layers.f, 0, 0); x.drawImage(layers.i, 0, 0); x.globalAlpha = 1;
        paintMine(1);
        if (hl) { x.fillStyle = '#f2ece2'; x.globalAlpha = 0.95; x.fillRect(hl.x, hl.y + hl.fs * 0.12, hl.w, Math.max(1.5 * D, hl.fs * 0.08)); x.globalAlpha = 1; }   // the word you are pointing at
        return;
      }
      for (const w of words) {
        const p = Math.min(1, Math.max(0, (q - w.d) / 0.55)), e = easeIO(p), a = 1 - p * p;
        if (a <= 0.01) continue;
        const src = layers[w.tag];
        x.globalAlpha = a;
        if (e === 0) { x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(src, w.x, w.top, w.w, w.h, w.x, w.top, w.w, w.h); continue; }
        const cxw = w.x + w.w / 2 + w.dx * e, cyw = w.top + w.h / 2 + w.dy * e, r = w.rot * e;
        x.setTransform(Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), cxw, cyw);
        x.drawImage(src, w.x, w.top, w.w, w.h, -w.w / 2, -w.h / 2, w.w, w.h);
      }
      x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1;
    }
    // v: how present the painting is (0–1)
    let painted = -1;
    function show(v) {
      v = Math.round(v * 200) / 200;
      const mob = MOBILE.matches, st = Math.round(find * 50) + '|' + mineHere().length;
      if (v === shown && st === stamp && !mob) return; shown = v;
      if (st !== stamp) { stamp = st; painted = -1; }
      el.style.opacity = v > 0.002 ? 1 : 0; el.style.visibility = v > 0.002 ? 'visible' : 'hidden'; sceneShow(v);
      if (v <= 0.002 || !box) return;
      const q = REDUCED.matches ? 0 : 1 - v;
      if (REDUCED.matches) el.style.opacity = v;
      if (q !== painted) { painted = q; paint(q); } lastQ = q;
      el.style.pointerEvents = v > 0.9 ? 'auto' : 'none';   // its words can be read once it has gathered
      pan();
    }
    // on a phone a painting wider than the screen pans across as you scroll through its section
    function pan() {
      // a gentle sweep: from a little left of centre to a little right of it, never edge to edge
      let tr = 'none';
      if (MOBILE.matches && box && box.w > innerWidth) {
        const r = sec().getBoundingClientRect(), p = smooth(0.15, 0.85, (innerHeight * 0.5 - r.top) / r.height);
        tr = `translateX(${(-(box.w - innerWidth) * (0.3 + 0.4 * p)).toFixed(1)}px)`;
      }
      el.style.transform = tr; if (scn) scn.style.transform = tr;
    }
    // while its words are travelling to or from another facet: only the painting's faint ground, at presence p
    function ground(p) {
      if (!layers || !box) return;
      el.style.opacity = 1; el.style.visibility = 'visible'; el.style.pointerEvents = 'none'; pan();
      x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, el.width, el.height);
      if (!sceneOn) { x.globalAlpha = 0.16 * p; x.drawImage(layers.scene, 0, 0); }
      sceneShow(p * p);
      x.globalAlpha = smooth(0.55, 1, p); x.drawImage(layers.under, 0, 0); x.globalAlpha = 1;   // the brushwork comes in only as the words settle
      shown = -1; painted = -1;
    }
    // its words as travellers: each one's sprite (a piece of its layer) and its centre, in CSS pixels within the canvas
    function travellers() {
      if (!layers) return [];
      return words.map(w => ({ c: layers[w.tag], sx: w.x, sy: w.top, sw: w.w, sh: w.h, w: w.w / D, h: w.h / D, ox: -w.w / D / 2, oy: -w.h / D / 2, cx: (w.x + w.w / 2) / D, cy: (w.top + w.h / 2) / D, fs: w.fs / D }));
    }
    // ---- reading its words: hover shows the word, a click or tap opens the message behind it ----
    function hit(cx, cy, pad) {
      const r = el.getBoundingClientRect(); if (!r.width) return null;
      const px = (cx - r.left) * el.width / r.width, py = (cy - r.top) * el.height / r.height, pd = pad * D * 1.5;
      let best = null;
      for (const v of mineHere()) { const sl = slot(v); if (sl && px >= sl.x - pd && px <= sl.x + sl.w + pd && py >= sl.top - pd && py <= sl.top + sl.h + pd) return sl; }   // your own words first
      for (const w of words) if (px >= w.x - pd && px <= w.x + w.w + pd && py >= w.top - pd && py <= w.top + w.h + pd) { if (!best || w.tag !== 'b') best = w; }   // a face or letter word wins over the row beneath it
      return best;
    }
    const rectOf = w => { const r = el.getBoundingClientRect(), k = r.width / el.width; return { left: r.left + w.x * k, top: r.top + w.top * k, width: w.w * k, height: w.h * k }; };
    const highlight = w => { if (w === hl) return; hl = w; painted = -1; paint(lastQ); };
    el.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const w = hit(e.clientX, e.clientY, 1);
      el.style.cursor = w ? 'pointer' : 'default';
      if (w) showLoupe(w.t, rectOf(w), w.mine); else hideLoupe();
      highlight(w || (picked && picked.art === api ? picked.w : null));
    });
    el.addEventListener('pointerleave', () => { hideLoupe(); highlight(picked && picked.art === api ? picked.w : null); });
    el.addEventListener('click', e => {
      const w = hit(e.clientX, e.clientY, e.pointerType === 'mouse' ? 1 : 6);
      if (w) { picked = { state, w, art: api }; highlight(w); hideLoupe(); openSheet(w.t, w.m); } else { closeReader(); highlight(null); }
    });
    // where a visitor's word lives in the painting: one of its body words of similar length, well inside the figure,
    // chosen by the word's id and kept apart from the other visitors' words; the painted word gives it its place
    function slot(v) {
      if (slots.has(v.id)) return slots.get(v.id);
      const n = v.t.length, used = [...slots.values()];
      let cand = words.filter(w => w.inside && Math.abs(w.t.length - n) <= 3 && w.y < el.height * (f.artFade || 0.86) * 0.92);   // wholly inside the figure, above its faded foot
      if (!cand.length) cand = words.filter(w => w.inside);
      if (!cand.length) return null;
      let h = 0; for (const c of v.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
      let best = null, bd = -1;
      for (let k = 0; k < 20; k++) {
        const w = cand[(h + k * 7919) % cand.length], d = used.length ? Math.min(...used.map(u => Math.hypot(u.x - w.x, u.y - w.y))) : 1e9;
        if (d > bd) { bd = d; best = w; }
      }
      const sl = { ...best, t: v.t.toUpperCase(), m: v.m, mine: true, v };
      slots.set(v.id, sl); return sl;
    }
    const mineHere = () => visitor.filter(v => v.landed && showsIn(v, state));
    function spot(id) { const v = visitor.find(q => q.id === id); const sl = v && slot(v); return sl ? rectOf(sl) : null; }
    // the visitors' words, in the one accent colour; while finding, the painting dims and they are marked
    function paintMine(alpha) {
      const mine = mineHere(); if (!mine.length) return;
      const t = document.createElement('canvas'); t.width = el.width; t.height = el.height; const g = t.getContext('2d');
      const marks = [];
      for (const v of mine) {
        const sl = slot(v); if (!sl) continue;
        g.font = `700 ${sl.fs}px ${window.WP_FONT}`;
        const tw = g.measureText(sl.t).width, k = Math.min(1, sl.w / tw), dw = tw * k, dx = sl.x + (sl.w - dw) / 2;
        // the painted word makes way; the brushwork under it stays
        x.save(); x.globalCompositeOperation = 'destination-out'; x.fillRect(sl.x - 1, sl.top, sl.w + 2, sl.h); x.restore();
        x.globalAlpha = 1 - 0.6 * find; x.drawImage(layers.under, sl.x - 1, sl.top, sl.w + 2, sl.h, sl.x - 1, sl.top, sl.w + 2, sl.h); x.globalAlpha = 1;
        g.fillStyle = '#fff'; g.save(); g.translate(dx, sl.y); g.scale(k, 1); g.fillText(sl.t, 0, 0); g.restore();
        marks.push([dx, sl.top, dw, sl.h]);
      }
      // in the painting's own colour, lifted towards a warm light: it reads as one of the portrait's words, a shade brighter
      g.globalCompositeOperation = 'source-in'; g.filter = 'brightness(1.25) saturate(0.9)'; g.drawImage(img, 0, 0, t.width, t.height); g.filter = 'none';
      g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255, 214, 180, 0.3)'; g.fillRect(0, 0, t.width, t.height);
      if (find > 0.01) { g.globalAlpha = find; g.fillStyle = ACCENT; g.fillRect(0, 0, t.width, t.height); g.globalAlpha = 1; }   // finding: the accent
      g.globalCompositeOperation = 'destination-in'; g.drawImage(img, 0, 0, t.width, t.height);   // never past the outline
      if (find > 0.01) { x.globalAlpha = alpha * find * 0.9; x.fillStyle = 'rgba(240,100,63,0.24)'; marks.forEach(([mx, my, mw, mh]) => { x.beginPath(); x.roundRect(mx - 4 * D, my - 2 * D, mw + 8 * D, mh + 4 * D, 3 * D); x.fill(); }); }
      x.globalAlpha = alpha; x.drawImage(t, 0, 0); x.globalAlpha = 1;
    }
    const api = { state, el, loaded, spot, place, build: () => { build(); painted = -1; }, show, ground, travellers, rectOf, unpick: () => highlight(null) };
    return api;
  };
  const ARTS = {}; FACETS.forEach((f, i) => { if (f.art) ARTS[String(i)] = makeArt(String(i), f, i); });
  if (window.HERO_ART) {   // the opening and closing portraits: paintings of their own
    ARTS.hero = makeArt('hero', window.HERO_ART, 11);
    ARTS.final = makeArt('final', window.FINAL_ART || { ...window.HERO_ART, feature: window.HERO_ART.finalFeature || window.HERO_ART.feature }, 12);
  }
  const ART_LIST = Object.values(ARTS);
  const isArt = s => !!ARTS[s];

  // ---------------- words travelling between any two facets ----------------
  // Between two word portraits the shuffle runs inside the portrait's own frame (WordPortraits.drawShuffle). Where a
  // painting is involved the two pictures sit in different places and sizes, so the words travel on a layer over the
  // whole stage instead: every word of one facet is paired with a word of the next (top rows with top rows, loosely),
  // flies to it along a slight arc and turns into it on the way. At either end the travellers sit exactly on their
  // picture's own words, so the hand-over is invisible.
  const travel = document.createElement('canvas'), tctx = travel.getContext('2d');
  travel.className = 'travel'; travel.setAttribute('aria-hidden', 'true'); $('.stage').appendChild(travel);
  let travelOn = false;
  function sizeTravel() { travel.width = Math.round(innerWidth * dpr); travel.height = Math.round(innerHeight * dpr); travel.style.width = innerWidth + 'px'; travel.style.height = innerHeight + 'px'; }
  function travellersOf(s) {
    if (isArt(s)) return ARTS[s].travellers();
    const L = layoutFor(s);
    return L.glyphs.filter(g => g.sp).map(g => ({ c: g.sp.c, sx: g.sp.sx, sy: g.sp.sy, sw: g.sp.sw, sh: g.sp.sh, w: g.sp.w, h: g.sp.h, ox: g.sp.ox, oy: g.sp.oy, cx: L.ox + g.x + g.w / 2, cy: L.oy + g.y + g.h / 2, fs: g.fs }));
  }
  // where a facet's picture sits on the stage right now (paintings on a phone pan with the scroll)
  function originOf(s) { const r = (isArt(s) ? ARTS[s].el : cv).getBoundingClientRect(), st = travel.getBoundingClientRect(); return [r.left - st.left, r.top - st.top]; }
  const travelPairs = new Map();
  function pairsFor(a, b) {
    const key = `${a}>${b}|${innerWidth}x${innerHeight}|${W}x${H}`;
    if (travelPairs.has(key)) return travelPairs.get(key);
    const A = travellersOf(a), B = travellersOf(b); if (!A.length || !B.length) return null;
    const [ax, ay] = originOf(a), [bx, by] = originOf(b), vh = innerHeight, R = seeded(A.length * 31 + B.length * 7);
    // pair by height on the stage (with some noise), so most journeys are short and the picture re-forms top to bottom
    const order = (T, ox, oy) => T.map(t => ({ t, k: oy + t.cy + R() * vh * 0.22 })).sort((p, q) => p.k - q.k).map(o => o.t);
    const oa = order(A, ax, ay), ob = order(B, bx, by), n = Math.max(oa.length, ob.length), P = new Array(n);
    let pa = -1, pb = -1;
    for (let k = 0; k < n; k++) {
      const ia = Math.floor(k * oa.length / n), ib = Math.floor(k * ob.length / n);
      P[k] = { a: oa[ia], b: ob[ib], aMain: ia !== pa, bMain: ib !== pb, d: Math.min(1, Math.max(0, ((by + ob[ib].cy) / vh) * 0.55 + R() * 0.45)), arc: (R() - 0.5) * vh * 0.12 };
      pa = ia; pb = ib;
    }
    travelPairs.set(key, P); if (travelPairs.size > 8) travelPairs.delete(travelPairs.keys().next().value);
    return P;
  }
  function drawTravel(a, b, e, mul) {
    const P = pairsFor(a, b); if (!P) return;
    const [ax, ay] = originOf(a), [bx, by] = originOf(b), span = 0.55;
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0); tctx.clearRect(0, 0, innerWidth, innerHeight); travelOn = true;
    const put = (t, cx, cy, al) => { tctx.globalAlpha = al * mul; tctx.drawImage(t.c, t.sx, t.sy, t.sw, t.sh, cx + t.ox, cy + t.oy, t.w, t.h); };
    for (const p of P) {
      let t = (e - p.d * (1 - span)) / span; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const m = t * t * (3 - 2 * t), bump = Math.sin(Math.PI * m);
      const x0 = ax + p.a.cx, y0 = ay + p.a.cy, x1 = bx + p.b.cx, y1 = by + p.b.cy;
      const cx = x0 + (x1 - x0) * m + bump * p.arc * 0.2, cy = y0 + (y1 - y0) * m + bump * p.arc * 0.6;
      let q = (m - 0.3) / 0.4; q = q < 0 ? 0 : q > 1 ? 1 : q;   // which word it reads as, mid-flight
      const fs = Math.min(p.a.fs, p.b.fs), small = fs >= 11 ? 0 : fs <= 6 ? 1 : (11 - fs) / 5, air = 1 - (0.12 + 0.3 * small) * bump;
      if (p.aMain && q < 0.99) put(p.a, cx, cy, (1 - q) * air);
      if (p.bMain && q > 0.01) put(p.b, cx, cy, q * air);
    }
    tctx.globalAlpha = 1;
  }
  function clearTravel() { if (!travelOn) return; tctx.setTransform(1, 0, 0, 1, 0, 0); tctx.clearRect(0, 0, travel.width, travel.height); travelOn = false; }

  // visitor words: { id, t, facets, m, arrived:{state:time}, landed }
  const visitor = [];
  let find = 0, findTarget = 0, hover = null, picked = null, view = { a: 'hero', b: 'hero', e: 0, state: 'hero' };
  const showsIn = (v, s) => { const sp = spec(s); return !sp.code || v.facets.includes(sp.code); };

  // scroll position → which two portraits are on stage and how far between them
  function blend() {
    const secs = $$('.flow [data-state]'), vc = innerHeight * 0.5;
    const cs = secs.map(s => { const r = s.getBoundingClientRect(); return r.top + r.height / 2; });
    if (vc <= cs[0]) return { a: secs[0].dataset.state, b: secs[0].dataset.state, e: 0 };
    let i = 0; while (i < cs.length - 1 && cs[i + 1] <= vc) i++;
    if (i === cs.length - 1) { const s = secs[i].dataset.state; return { a: s, b: s, e: 0 }; }
    const t = (vc - cs[i]) / (cs[i + 1] - cs[i]);
    // the shuffle gets a wide stretch of scroll, so it can be scrubbed slowly
    return { a: secs[i].dataset.state, b: secs[i + 1].dataset.state, e: Math.min(1, Math.max(0, (t - 0.14) / 0.72)) };
  }

  function drawPortrait(s, alpha, dy, scale, now, noTex) {
    if (alpha <= 0.002) return false;
    const L = layoutFor(s); let anim = false;
    ctx.save();
    ctx.translate(W / 2, H / 2 + dy); ctx.scale(scale, scale); ctx.translate(-W / 2, -H / 2);
    ctx.translate(L.ox, L.oy);
    if (!noTex) {
      if (L.scene) { ctx.globalAlpha = alpha * (1 - 0.7 * find); ctx.drawImage(L.scene, -L.ox, -L.oy, L.BW, L.BH); }
      ctx.globalAlpha = alpha * 0.09 * (1 - find);
      ctx.drawImage(L.shadow, L.W * 0.012, L.H * 0.014, L.W, L.H);
      ctx.globalAlpha = alpha * (1 - 0.78 * find);
      ctx.drawImage(L.tex, 0, 0, L.W, L.H);
    }
    // visitor words sit in the fabric at word size, in the one accent ink
    ctx.textBaseline = 'alphabetic';
    for (const v of visitor) {
      if (!showsIn(v, s)) continue;
      if (!v.arrived[s]) { if (v.landed) v.arrived[s] = now; else continue; }   // first time this facet shows it
      const slot = wp.slotFor(L, v.id, v.t.toUpperCase()); if (!slot) continue;
      const glow = Math.max(0, 1 - (now - v.arrived[s]) / 2400); if (glow > 0) anim = true;
      ctx.font = `700 ${slot.fs}px ${window.WP_FONT}`;
      const tw = ctx.measureText(slot.text).width, sx = Math.min(1, (slot.w + 6) / tw);
      const x = slot.x + slot.w / 2, y = slot.y + slot.fs * 0.74;
      if (find > 0.01 || glow > 0) {
        ctx.globalAlpha = alpha * Math.max(find * 0.9, glow * 0.85);
        ctx.fillStyle = 'rgba(240,100,63,0.22)';
        const pw = tw * sx + 8;
        ctx.fillRect(x - pw / 2, y - slot.fs * 0.86, pw, slot.fs * 1.15);
      }
      ctx.globalAlpha = alpha; ctx.fillStyle = ACCENT;
      ctx.save(); ctx.translate(x, y); ctx.scale(sx, 1); ctx.textAlign = 'center'; ctx.fillText(slot.text, 0, 0); ctx.restore();
    }
    for (const hv of [hover, picked]) if (hv && hv.state === s && hv.w) {
      const w = hv.w; ctx.globalAlpha = alpha; ctx.fillStyle = w.mine ? ACCENT : '#f2ece2';
      ctx.fillRect(w.x - 1, w.y + w.h + 1, w.w + 2, hv === picked ? 1.5 : 1);
    }
    ctx.restore();
    return anim;
  }

  // ---------------- annotation: a hairline from the note's sentence to one detail of the photograph ----------------
  const annot = $('.annot'), apaths = $$('.annot path'), adot = $('.annot circle');
  let annotFor = null;
  function placeAnnot(alpha = 1) {
    const s = view.state, fi = /^\d$/.test(s) ? +s : -1, f = FACETS[fi];
    const on = f && f.anchor && f.img && !f.art && !MOBILE.matches && !body.classList.contains('composing') && !body.classList.contains('reading-word');
    if (!on) { annot.style.opacity = 0; annotFor = null; return; }
    const sec = $('#facet-' + fi), line = sec.querySelector('.fline');
    const L = layoutFor(s), r = cv.getBoundingClientRect(), sc = r.width / W, lr = line.getBoundingClientRect();
    const ax = r.left + (L.ox + f.anchor[0] * L.W) * sc, ay = r.top + (L.oy + f.anchor[1] * L.H) * sc;
    const bx = lr.left - 18, by = lr.top + Math.min(lr.height, 40) * 0.55;
    const mx = (ax + bx) / 2;
    apaths.forEach(p => p.setAttribute('d', `M${bx},${by} C${mx + 40},${by} ${mx - 40},${ay} ${ax + 9},${ay}`));
    adot.setAttribute('cx', ax); adot.setAttribute('cy', ay);
    annot.style.opacity = alpha;
    if (annotFor !== s) {       // a new facet: draw the line in from the sentence to the detail
      annotFor = s;   // pathLength=1, so the draw-in survives the note moving (e.g. when its story opens)
      apaths.forEach(p => { p.style.transition = 'none'; p.style.strokeDasharray = 1; p.style.strokeDashoffset = 1; }); adot.classList.remove('on');
      annot.getBoundingClientRect();
      apaths.forEach(p => { p.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(.6,0,.2,1) .15s'; p.style.strokeDashoffset = 0; });
      setTimeout(() => { if (annotFor === s) adot.classList.add('on'); }, 1050);
    }
  }
  addEventListener('resize', () => placeAnnot());

  let raf = 0, current = null;
  function frameDraw() {
    raf = 0; if (!ready || body.classList.contains('stage-covered')) return;   // the board and letters cover the portrait entirely
    const now = performance.now();
    find += (findTarget - find) * 0.15; if (Math.abs(findTarget - find) < 0.003) find = findTarget;
    const b = blend(); view = { ...b, state: b.e < 0.5 ? b.a : b.b };
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    let anim = find !== findTarget;
    if (isArt(b.a) || isArt(b.b)) {
      // to and from a painting: every word travels into the next facet's picture and becomes one of its words
      const e = Math.min(1, Math.max(0, (b.e - 0.02) / 0.96));
      const parts = b.a === b.b || e <= 0 ? [[b.a, 1]] : e >= 1 ? [[b.b, 1]] : [[b.a, 1 - b.e], [b.b, b.e]];
      if (parts.length === 1 || REDUCED.matches) {
        clearTravel();
        for (const [st, p] of parts) {
          if (isArt(st)) ARTS[st].show(p);
          else anim = drawPortrait(st, p, 0, 1, now) || anim;
        }
      } else {
        // behind the travellers only the grounds crossfade: the paintings' faint surroundings, the portraits' scenes
        const sdim = 1 - 0.7 * find;
        for (const [st, p] of parts) {
          if (isArt(st)) ARTS[st].ground(p);
          else { const L = layoutFor(st); if (L.scene) { ctx.globalAlpha = p * sdim; ctx.drawImage(L.scene, 0, 0, W, H); ctx.globalAlpha = 1; } }
        }
        drawTravel(b.a, b.b, e, 1 - 0.78 * find);
      }
      ART_LIST.forEach(A => { if (!parts.some(([st]) => st === A.state)) A.show(0); });
    } else if (b.b !== b.a && b.e > 0 && b.e < 1 && !REDUCED.matches) {
      // shuffle: every word of one portrait travels into the next and becomes one of its words
      const A = layoutFor(b.a), B = layoutFor(b.b);
      // the scenes simply crossfade behind the shuffling words
      const sdim = 1 - 0.7 * find;
      if (A.scene) { ctx.globalAlpha = (1 - b.e) * sdim; ctx.drawImage(A.scene, 0, 0, W, H); }
      if (B.scene) { ctx.globalAlpha = b.e * sdim; ctx.drawImage(B.scene, 0, 0, W, H); }
      ctx.globalAlpha = 0.09 * (1 - b.e) * (1 - find); ctx.drawImage(A.shadow, A.ox + A.W * 0.012, A.oy + A.H * 0.014, A.W, A.H);
      ctx.globalAlpha = 0.09 * b.e * (1 - find); ctx.drawImage(B.shadow, B.ox + B.W * 0.012, B.oy + B.H * 0.014, B.W, B.H);
      ctx.globalAlpha = 1;
      // the travelling words are cut from the finished portraits and cover them exactly, so the hand-over at either
      // end is invisible: the portrait simply begins to loosen into its words as you scroll, and gathers back the same way
      const dim = 1 - 0.78 * find;
      wp.drawShuffle(ctx, A, B, Math.min(1, Math.max(0, (b.e - 0.02) / 0.96)), dpr, dim);
      // visitor words step aside during the shuffle, unless you are finding them: then they hold their place,
      // highlighted, while the portrait dims and reshuffles around them (handing over to the next portrait mid-way)
      const mid = smooth(0.4, 0.6, b.e);
      const fadeA = Math.max(0, 1 - b.e * 4, find * (1 - mid)), fadeB = Math.max(0, b.e * 4 - 3, find * mid);
      anim = drawPortrait(b.a, fadeA, 0, 1, now, true) || anim;
      anim = drawPortrait(b.b, fadeB, 0, 1, now, true) || anim;
    } else if (b.b !== b.a) {
      anim = drawPortrait(b.a, 1 - b.e, 0, 1, now) || anim;
      anim = drawPortrait(b.b, b.e, 0, 1, now) || anim;
    } else anim = drawPortrait(b.a, 1, 0, 1, now) || anim;
    if (!isArt(b.a) && !isArt(b.b)) { ART_LIST.forEach(A => A.show(0)); clearTravel(); }
    syncState(view.state); placeNotes(b);
    // the line is only there while a facet is settled; it fades through the crossfade
    placeAnnot(b.a === b.b ? 1 : Math.max(0, 1 - Math.min(b.e, 1 - b.e) * 5));
    if (anim) kick();
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(frameDraw); };
  addEventListener('scroll', kick, { passive: true });

  // The text beside (or, on a phone, under) the portrait stays in one place. As you scroll between two facets, the
  // current note fades and drifts up while the portrait reshapes, and the next one rises into place as the new portrait
  // forms; the small vertical drift keeps the feeling of scrolling.
  const notes = $$('.flow .sec').map(sec => ({ s: sec.dataset.state, el: sec.querySelector('.note'), o: -1, y: 0 }));
  function placeNotes(b) {
    const D = MOBILE.matches ? 18 : 26;
    for (const n of notes) {
      let o = 0, y = 0;
      if (n.s === b.a && b.a === b.b) o = 1;
      else if (n.s === b.a) { o = 1 - smooth(0.04, 0.42, b.e); y = -D * smooth(0, 0.5, b.e); }
      else if (n.s === b.b) { o = smooth(0.58, 0.96, b.e); y = D * (1 - smooth(0.5, 1, b.e)); }
      o = Math.round(o * 100) / 100; y = Math.round(y * 2) / 2;
      if (o === n.o && y === n.y) continue;
      n.o = o; n.y = y;
      n.el.style.setProperty('--no', o); n.el.style.setProperty('--ny', y + 'px');
      n.el.classList.toggle('vis', o > 0.02); n.el.classList.toggle('live', o > 0.6);
    }
  }
  function syncState(s) {
    if (s === current) return; current = s;
    const ai = s === 'hero' ? -1 : s === 'final' ? 7 : +s;
    $$('button', rail).forEach((btn, i) => { btn.classList.toggle('on', i === ai); btn.classList.toggle('done', i < ai); });
    rail.style.setProperty('--p', Math.max(0, ai) / 7);
    body.dataset.state = s;
    $$('.flow .sec').forEach(sec => sec.classList.toggle('is-on', sec.dataset.state === s));
    $$('.story:not([hidden])').forEach(st => { if (st.closest('.sec').dataset.state !== s) { st.hidden = true; st.classList.remove('open'); const b = st.previousElementSibling; b.textContent = 'Read his story'; b.setAttribute('aria-expanded', 'false'); } });
  }

  // warm every portrait in idle time so scrolling never waits on layout
  // ---- preparing portraits without ever blocking the page ----
  // Each job is a portrait (laid out in slices, see WordPortraits.prepare) or the pairing of two neighbours' words for the
  // shuffle. run() works through jobs a few milliseconds at a time, so the page keeps scrolling smoothly meanwhile.
  let warmGen = 0;
  function jobsFor(states) {
    const jobs = [];
    states.forEach((st, i) => {
      jobs.push({ gen: () => wp.isReady(spec(st), W, H, dpr) ? null : wp.prepare(spec(st), W, H, dpr) });
      const k = STATES.indexOf(st);
      if (k > 0) jobs.push({ fn: () => wp.pairs(layoutFor(STATES[k - 1]), layoutFor(st)) });
    });
    return jobs;
  }
  function run(jobs, budget, onStep) {
    const gen = warmGen;
    return new Promise(done => {
      let j = 0, it = null;
      const step = () => {
        if (gen !== warmGen) return done(false);
        const t0 = performance.now();
        while (j < jobs.length && performance.now() - t0 < budget) {
          const job = jobs[j];
          if (job.fn) { job.fn(); j++; onStep && onStep(j, jobs.length); continue; }
          if (!it) { it = job.gen(); if (!it) { j++; onStep && onStep(j, jobs.length); continue; } }
          if (it.next().done) { it = null; j++; onStep && onStep(j, jobs.length); }
        }
        if (j < jobs.length) (budget > 20 ? setTimeout(step, 0) : requestAnimationFrame(step)); else done(true);
      };
      step();
    });
  }
  // after the loading screen: the rest of the portraits, in story order, a few milliseconds per frame
  function warm() { warmGen++; run(jobsFor(STATES), 7); }
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { const ow = W, oh = H; geometry(); sizeTravel(); travelPairs.clear(); ART_LIST.forEach(A => { A.place(); A.build(); }); if (W !== ow || H !== oh) warm(); kick(); }, 150); });

  // ---------------- hover loupe + tap to read ----------------
  // The word under the pointer, in a label just above it (below it near the top of the screen), never cut off at the edges.
  $('.stage').appendChild(loupe);
  function showLoupe(text, r, mine) {
    loupe.textContent = text; loupe.classList.toggle('mine', !!mine);
    const st = $('.stage').getBoundingClientRect(), lw = loupe.offsetWidth, lh = loupe.offsetHeight, hdr = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hdr')) || 64;
    const cx = Math.min(innerWidth - 10 - lw / 2, Math.max(10 + lw / 2, r.left + r.width / 2));
    const above = r.top - lh - 8 >= hdr + 6, y = above ? r.top - 8 : r.top + r.height + 8;
    loupe.style.transform = `translate(${(cx - lw / 2 - st.left).toFixed(1)}px, ${(above ? y - lh - st.top : y - st.top).toFixed(1)}px)`;
    loupe.classList.add('on');
  }
  const hideLoupe = () => loupe.classList.remove('on');
  const local = e => { if (isArt(view.state)) return [-1e6, -1e6]; const r = cv.getBoundingClientRect(), L = layoutFor(view.state); return [(e.clientX - r.left) * W / r.width - L.ox, (e.clientY - r.top) * H / r.height - L.oy]; };
  function wordAt(x, y, pad) {
    const s = view.state; if (isArt(s)) return null;   // a painting's words are read from its own canvas
    const L = layoutFor(s);
    for (const v of visitor) {
      const sl = showsIn(v, s) && v.arrived[s] && L.slots.get(v.id);
      if (sl && x >= sl.x - pad && x <= sl.x + sl.w + pad && y >= sl.y - pad && y <= sl.y + sl.h + pad) return { ...sl, t: v.t, m: v.m, mine: true };
    }
    return wp.hit(L, x, y, pad);
  }
  cv.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const [x, y] = local(e), w = wordAt(x, y, 1);
    hover = w ? { state: view.state, w } : null;
    cv.style.cursor = w ? 'pointer' : 'default';
    if (w) {
      const L = layoutFor(view.state), r = cv.getBoundingClientRect(), k = r.width / W;
      showLoupe(w.t, { left: r.left + (L.ox + w.x) * k, top: r.top + (L.oy + w.y) * k, width: w.w * k, height: w.h * k }, w.mine);
    } else hideLoupe();
    kick();
  });
  cv.addEventListener('pointerleave', () => { hover = null; loupe.classList.remove('on'); kick(); });
  cv.addEventListener('click', e => {
    const [x, y] = local(e), w = wordAt(x, y, e.pointerType === 'mouse' ? 1 : 8);
    if (w) { picked = { state: view.state, w }; openSheet(w.t, w.m); kick(); } else closeReader();
  });

  // ---------------- word sheet ----------------
  const sheet = $('.sheet'), sheetBody = $('.sheet__body');
  const reader = $('.reader'), lead = $('.lead');
  function closeReader() {
    if (!body.classList.contains('reading-word')) return;
    body.classList.remove('reading-word'); if (picked && picked.art) picked.art.unpick(); picked = null; lead.classList.remove('on'); annotFor = null; kick();
  }
  function placeLead() {
    if (!picked || !body.classList.contains('reading-word')) return;
    let x1, y1;
    if (picked.art) { const q = picked.art.rectOf(picked.w); x1 = q.left + q.width + 4; y1 = q.top + q.height * 0.55; }
    else {
      const L = layoutFor(picked.state), r = cv.getBoundingClientRect(), sc = r.width / W, w = picked.w;
      x1 = r.left + (L.ox + w.x + w.w) * sc + 4; y1 = r.top + (L.oy + w.y + w.h * 0.6) * sc;
    }
    const rr = reader.getBoundingClientRect(), x2 = rr.left - 18, y2 = rr.top + 64;
    lead.setAttribute('d', `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`);
  }
  addEventListener('scroll', () => { if (body.classList.contains('reading-word') && view.state !== (picked && picked.state)) closeReader(); else placeLead(); }, { passive: true });
  addEventListener('resize', placeLead);
  function readerHTML(word, mi) {
    const m = messages[mi] || messages[0], codes = m.mine ? [...m.facets] : facetsOf(word);
    const rel = messages.map((x, i) => i).filter(i => i !== mi && !messages[i].mine && messages[i].words.includes(word)).slice(0, 3);
    const forms = [...ALIAS].filter(([, v]) => v === word).map(([k]) => k), re = new RegExp(`\\b(${(forms.length ? forms : [word.toLowerCase()]).join('|')})\\w*`, 'gi');   // never an empty pattern, which would mark every word
    const text = esc(m.text).replace(re, '<u>$&</u>');
    return `
      <p class="eyebrow">${codes.map(c => FACETS[CODES.indexOf(c)].name).join(' · ')}</p>
      <h3 id="sheet-word" class="${m.mine ? 'mine' : ''}">${esc(word)}</h3>
      <blockquote${m.mine ? ' class="pending"' : ''}><p>“${text}”</p>
        <cite>${esc(m.name || 'Anonymous')}${m.rel ? `<span>${esc(m.rel)}</span>` : ''}</cite></blockquote>
      ${m.mine ? '<p class="fine">Your message · only you can see it until it has been approved.</p>' : ''}
      ${rel.length ? `<p class="eyebrow">Also said by</p><ul class="rel">${rel.map(i => `<li><button type="button" data-i="${i}">“${esc(messages[i].text)}” <span>${esc(messages[i].name)}</span></button></li>`).join('')}</ul>` : ''}`;
  }
  function openSheet(word, mi) {
    if (!MOBILE.matches) {
      reader.querySelector('.reader__body').innerHTML = readerHTML(word, mi);
      $$('.rel button', reader).forEach(b => b.onclick = () => openSheet(word, +b.dataset.i));
      closeToast(); body.classList.add('reading-word');
      requestAnimationFrame(() => { placeLead(); lead.classList.add('on'); });
      return;
    }
    openMobileSheet(word, mi);
  }
  function openMobileSheet(word, mi) {
    sheetBody.innerHTML = readerHTML(word, mi);
    $$('.rel button', sheetBody).forEach(b => b.onclick = () => openSheet(word, +b.dataset.i));
    show(sheet);
  }
  sheet.addEventListener('click', e => { if (e.target.closest('.js-close-sheet')) hide(sheet); });
  function show(el) { clearTimeout(el._t); el.hidden = false; requestAnimationFrame(() => el.classList.add('open')); body.classList.add('locked'); }
  function hide(el) { el.classList.remove('open'); clearTimeout(el._t); el._t = setTimeout(() => { el.hidden = true; }, 420); if (!$$('.sheet.open').length) body.classList.remove('locked'); }
  $('.js-close-reader').addEventListener('click', closeReader);
  addEventListener('keydown', e => { if (e.key === 'Escape') { closeReader(); if (sheet.classList.contains('open')) hide(sheet); else if (composer.classList.contains('open')) closeComposer(); } });

  // ---------------- composer → words fly into the portrait ----------------
  // The composer sits beside the portrait (no overlay), so the portrait stays in view the whole time.
  // Words are picked out live as you type, and on submit they lift straight out of your text.
  const composer = $('.composer'), form = $('.panel'), ta = form.elements.msg, preview = $('.msgpreview'), found = $('.found');
  function markText(text, ex, extra = '') {
    const spans = []; ex.found.forEach((f, w) => f.spans.forEach(sp => spans.push([...sp, w]))); spans.sort((a, b) => a[0] - b[0]);
    let html = '', at = 0;
    spans.forEach(([a, b, w]) => { if (a < at) return; html += esc(text.slice(at, a)) + `<mark data-w="${w}">${esc(text.slice(a, b))}</mark>`; at = b; });
    return html + esc(text.slice(at)) + extra + '\n';
  }
  function mirror() {
    const ex = extract(ta.value);
    preview.innerHTML = markText(ta.value, ex);
    preview.scrollTop = ta.scrollTop;
    const n = ex.found.size;
    found.textContent = n ? `${n} word${n > 1 ? 's' : ''} for his portrait: ${[...ex.found.keys()].join(', ')}` : '';
  }
  function openComposer() {
    closeReader(); closeToast();
    composer.classList.remove('sending', 'emptied'); clearTimeout(composer._t); composer.hidden = false; body.classList.add('composing'); kick();
    requestAnimationFrame(() => composer.classList.add('open'));
    setTimeout(() => ta.focus({ preventScroll: true }), 420);
  }
  function closeComposer() {
    composer.classList.remove('open'); body.classList.remove('composing'); annotFor = null; kick();
    clearTimeout(composer._t); composer._t = setTimeout(() => { composer.hidden = true; }, 500);
  }
  $$('.js-write').forEach(b => b.addEventListener('click', openComposer));
  composer.addEventListener('click', e => { if (e.target.closest('.js-close')) closeComposer(); });
  $('.js-sample').addEventListener('click', () => {
    ta.value = 'Your vision and humility inspired me to lead with courage. Thank you for believing in young people like me, and for every lesson along the way.';
    form.elements.name.value ||= 'Aarav Malhotra'; form.elements.rel.value ||= 'Young engineer, Hero MotoCorp';
    mirror();
  });
  ta.addEventListener('input', () => { ta.classList.remove('err'); mirror(); });
  ta.addEventListener('scroll', () => { preview.scrollTop = ta.scrollTop; });

  let mine = 0;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const text = ta.value.trim(); if (text.length < 3) { ta.classList.add('err'); ta.focus(); return; }
    const ex = extract(text);
    const m = { text, name: form.elements.name.value.trim(), rel: form.elements.rel.value.trim(), words: ex.words, mine: true, facets: new Set(ex.words.flatMap(w => facetsOf(w, ex.fallback))) };
    messages.push(m); const mi = messages.length - 1;
    ex.words.forEach(w => used.add(w));

    // the text stays exactly where it was typed; everything around it quietly steps back
    preview.innerHTML = markText(text, ex, ex.fallback.size ? ' ' + [...ex.fallback].map(w => `<mark class="fb" data-w="${w}">${w}</mark>`).join(' ') : '');
    ta.blur(); composer.classList.add('sending');

    setTimeout(() => {
      const s = view.state, L = layoutFor(s), here = spec(s).code;
      const rect = cv.getBoundingClientRect(), sc = rect.width / W;
      const entries = ex.words.map(w => ({ id: `${mi}:${w}`, t: w, facets: facetsOf(w, ex.fallback), m: mi, arrived: {}, landed: false }));
      entries.forEach(v => visitor.push(v));
      // each word lifts out of the text, then travels along its own hairline arc into the portrait: the arcs bow the
      // same way and leave one after another, so the words read as one deliberate sweep rather than a scatter
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'flight'); document.body.appendChild(svg);
      const n = entries.length, stagger = Math.min(240, 1600 / Math.max(1, n));
      const LIFT = REDUCED.matches ? 0 : 420, TRAVEL = REDUCED.matches ? 300 : 1500;
      const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const flights = entries.map((v, i) => {
        const srcEl = preview.querySelector(`mark[data-w="${v.t}"]`) || preview;
        const sr = srcEl.getBoundingClientRect(), cs = getComputedStyle(srcEl), fs0 = parseFloat(cs.fontSize);
        const inHere = !here || v.facets.includes(here);
        let tx, ty, size, railBtn = null;
        const art = inHere && isArt(s) && ARTS[s].spot(v.id);
        if (art) { tx = art.left + art.width / 2; ty = art.top + art.height / 2; size = art.height * 0.8; }
        else if (inHere) {
          const slot = wp.slotFor(L, v.id, v.t.toUpperCase());
          tx = rect.left + (L.ox + slot.x + slot.w / 2) * sc; ty = rect.top + (L.oy + slot.y + slot.h / 2) * sc; size = slot.fs * sc;
        } else {
          railBtn = rail.querySelector(`[data-go="${CODES.indexOf(v.facets[0])}"]`);
          const r = railBtn.getBoundingClientRect(); tx = r.right - 6; ty = r.top + r.height / 2; size = 10;
        }
        // the flyer starts as the very word on the page and turns into the portrait's lettering on the way
        const fl = document.createElement('span'); fl.className = 'flyer';
        fl.innerHTML = `<span class="f-a"></span><span class="f-b"></span>`;
        fl.firstChild.textContent = srcEl.textContent; fl.firstChild.style.font = cs.font;
        fl.lastChild.textContent = v.t.toUpperCase(); fl.lastChild.style.fontSize = fs0 + 'px';
        fl.style.color = cs.color; document.body.appendChild(fl);
        // the arc: bowed upwards (or outwards when the trip is mostly vertical), a little wider for each word
        const sx = sr.left + sr.width / 2, sy = sr.top + sr.height / 2 - 10, dx = tx - sx, dy = ty - sy, dl = Math.hypot(dx, dy) || 1;
        let nx = -dy / dl, ny = dx / dl; if (Math.abs(ny) > 0.2 ? ny > 0 : nx > 0) { nx = -nx; ny = -ny; }
        const k = Math.min(190, dl * 0.3) * (0.8 + 0.2 * (i % 3));
        const P = [[sx, sy], [sx + dx * 0.2 + nx * k, sy + dy * 0.2 + ny * k], [sx + dx * 0.8 + nx * k * 0.7, sy + dy * 0.8 + ny * k * 0.7], [tx, ty]];
        const at = t => { const u = 1 - t; return [0, 1].map(j => u * u * u * P[0][j] + 3 * u * u * t * P[1][j] + 3 * u * t * t * P[2][j] + t * t * t * P[3][j]); };
        const pts = [], len = [0];   // arc-length table, so the word moves at an even pace along the curve
        for (let j = 0; j <= 64; j++) { pts.push(at(j / 64)); if (j) len.push(len[j - 1] + Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1])); }
        const total = len[64], byLen = d => { let j = 1; while (j < 64 && len[j] < d) j++; const f = (d - len[j - 1]) / ((len[j] - len[j - 1]) || 1); return [pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * f, pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * f]; };
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        // every word takes its place over the text at once, then waits its turn to leave
        fl.style.transform = `translate(${sx}px, ${sy + 10}px) translate(-50%,-50%)`; srcEl.classList.add('gone');
        path.setAttribute('d', `M${P[0]}C${P[1]} ${P[2]} ${P[3]}`); path.style.strokeDasharray = `0 ${total * 2}`; svg.appendChild(path);
        return { v, i, fl, path, total, byLen, s0: sx, y0: sy + 10, s1: size / fs0, inHere, railBtn, t0: i * stagger, done: false };
      });
      const start = performance.now(); let left = n;
      const step = now => {
        const T = now - start;
        for (const f of flights) {
          if (f.done) continue;
          const t = T - f.t0; if (t < 0) continue;
          if (t < LIFT) {   // the word rises gently out of the line
            const l = 1 - Math.pow(1 - t / LIFT, 3);
            f.fl.style.transform = `translate(${f.s0}px, ${f.y0 - 10 * l}px) translate(-50%,-50%) scale(${1 + 0.06 * l})`;
            continue;
          }
          const r = Math.min(1, (t - LIFT) / TRAVEL), m = ease(r), d = m * f.total, [x, y] = f.byLen(d);
          const sc1 = 1.06 + (f.s1 - 1.06) * m, swap = Math.min(1, Math.max(0, (m - 0.4) / 0.3));
          f.fl.style.transform = `translate(${x}px, ${y}px) translate(-50%,-50%) scale(${sc1})`;
          f.fl.firstChild.style.opacity = 1 - swap; f.fl.lastChild.style.opacity = swap;
          if (!f.inHere) f.fl.style.opacity = 1 - Math.max(0, (m - 0.7) / 0.3);
          // a short tail of the hairline trails the word, then lets go of it
          const tail = f.total * 0.22, a0 = Math.max(0, d - tail);
          f.path.style.strokeDasharray = `0 ${a0} ${d - a0} ${f.total * 2}`;
          f.path.style.opacity = 0.38 * Math.min(1, r * 6) * (1 - Math.max(0, (r - 0.7) / 0.3));   // a faint thread, not a stroke
          if (r >= 1) {
            f.done = true; f.path.remove();
            const v = f.v; v.landed = true; if (f.inHere) v.arrived[s] = performance.now();
            if (f.railBtn) { f.railBtn.classList.remove('ping'); void f.railBtn.offsetWidth; f.railBtn.classList.add('ping'); }
            kick();
            f.fl.animate([{ opacity: f.inHere ? 1 : 0 }, { opacity: 0 }], { duration: 320, fill: 'forwards' }).onfinish = () => f.fl.remove();
            if (--left === 0) {
              svg.remove(); done(entries); closeComposer();
              setTimeout(() => { form.reset(); preview.innerHTML = ''; found.textContent = ''; composer.classList.remove('sending', 'emptied'); }, 520);
            }
          }
        }
        if (left > 0) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      // the rest of the message dissolves as its words leave
      setTimeout(() => composer.classList.add('emptied'), 250);
    }, 380);
  });

  function done(entries) {
    mine++;
    $$('.js-count').forEach(c => { c.textContent = (2418 + mine).toLocaleString('en-IN'); });
    $('.toast__w').innerHTML = FACETS.map(f => {
      const ws = entries.filter(v => v.facets.includes(f.code)).map(v => v.t);
      return ws.length ? `<span><b>${f.short}</b> ${ws.map(esc).join(', ')}</span>` : '';
    }).join('');
    const t = $('.toast'); t.hidden = false; requestAnimationFrame(() => t.classList.add('open'));
    clearTimeout(t._t); t._t = setTimeout(closeToast, 9000);
    $$('.js-find').forEach(b => { b.hidden = false; });
    board.added();
  }
  function closeToast() { const t = $('.toast'); t.classList.remove('open'); clearTimeout(t._t); t._t = setTimeout(() => { t.hidden = true; }, 400); }
  $('.js-close-toast').addEventListener('click', closeToast);
  $('.js-find-toast').addEventListener('click', () => { closeToast(); toggleFind(true); });
  let finding = false;
  function toggleFind(on = !finding) {
    finding = on; findTarget = on ? 1 : 0; body.classList.toggle('finding', on);
    $$('.js-find').forEach(b => { b.textContent = on ? 'Show every word' : 'Find my words'; }); kick();
  }
  $$('.js-find').forEach(b => b.addEventListener('click', () => toggleFind()));

  // ---------------- letters: the long-form demo letters, read on the wall ----------------
  const letters = window.LETTERS.map(l => {
    const text = l.paras.join(' '), ex = extract(text);
    const sentences = l.paras.flatMap(p => p.replace(/\b(Mr|Mrs|Ms|Dr|St)\./g, '$1\u2024').match(/[^.!?]+[.!?]+[”"’]?/g) || [p]).map(t => t.trim().replace(/\u2024/g, '.'));   // titles like “Mr.” don't end a sentence
    const score = t => extract(t).words.length * 10 - Math.max(0, t.length - 150) * 0.4 - (/^(dear|respected|papa|pawan)\b/i.test(t) ? 25 : 0) - (/\b(birthday|wishing|wishes|happy)\b/i.test(t) ? 40 : 0) - (t.length < 40 ? 30 : 0);
    const lead = sentences.slice().sort((x, y) => score(y) - score(x))[0];
    const words = text.split(/\s+/).length;
    return { ...l, text, lead, facets: [...new Set(ex.words.flatMap(w => facetsOf(w, ex.fallback)))].slice(0, 3), mins: Math.max(1, Math.round(words / 200)) };
  });

  // ---------------- the messages: a wall of letters that settles into a grid ----------------
  // A sticky stage holds the letters, scattered in layers around the count. Scrolling on, the letters travel to their
  // places in a masonry grid; then the stage lets go and the grid scrolls on with the page, its columns drifting at
  // slightly different rates. The browser pins the stage itself (position: sticky); the script only sets how far each
  // letter has travelled. In the scattered view a long letter shows a shortened version in a complete card, which opens
  // into the full letter as it settles. Only the letters that land near the top of the grid take part in the scatter;
  // the rest simply fade in at their place, which keeps the number of moving cards small.
  const board = (() => {
    const yearNav = document.createElement('nav'); yearNav.className = 'wyears'; yearNav.setAttribute('aria-label', 'Messages by year'); document.body.appendChild(yearNav);
    const sec = $('.wall'), pin = $('.wall__pin'), stage = $('.wall__stage'), cardsEl = $('.wall__cards'), head = $('.wall__head'), rest = $('.wall__rest');
    let HOLD = 0.4, MORPH = 1.0;              // viewport heights: scattered and held, then the move into the grid (phones: neither, the board straight away)
    let cards = [], heads = [], itemYears = [], vw = 0, vh = 0, gTop = 0, raf = 0, lastW = 0, mob = false, side = 0;
    const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const clamp01 = t => t < 0 ? 0 : t > 1 ? 1 : t;

    // the demo messages carry no dates, so each is given a year here; your own message is this year's
    const THIS_YEAR = new Date().getFullYear(), YEARS = [0, 0, 1, 1, 2, 2, 3];
    const yearOf = (m, i) => m.year || (m.mine ? THIS_YEAR : THIS_YEAR - YEARS[i % YEARS.length]);
    function source() {
      const all = sourceAll().map((m, i) => ({ ...m, year: yearOf(m, i) }));
      return all.map((m, i) => [m, i]).sort((a, b) => b[0].year - a[0].year || a[1] - b[1]).map(e => e[0]);   // newest year first, order kept within a year
    }
    function sourceAll() {
      const mine = messages.filter(m => m.mine).reverse();
      const short = messages.filter(m => !m.mine);
      const long = letters.map(l => ({ name: l.name, rel: l.rel, paras: l.paras }));
      const out = [], a = short.slice(), b = long.slice();
      while (a.length || b.length) { if (a.length) out.push(a.shift()); if (a.length) out.push(a.shift()); if (b.length) out.push(b.shift()); }
      return [...mine, ...out];
    }
    function cardHTML(m, deco) {
      const paras = m.paras || [m.text], sig = `<p class="wcard__sig">— ${esc(m.name || 'Anonymous')}</p>${m.rel ? `<p class="wcard__rel">${esc(m.rel)}${m.mine ? ' · <em>pending approval</em>' : ''}</p>` : ''}`;
      return `<article class="wcard${deco ? ' deco' : ''}${m.mine ? ' mine' : ''}"${deco ? ' aria-hidden="true"' : ''}>
        <div class="wcard__bg"></div>
        <div class="wcard__full"><div class="wcard__body"><p class="wcard__to">Dear Dr. Munjal,</p>${paras.map(p => `<p class="wcard__t">${esc(p)}</p>`).join('')}${sig}</div></div>
        <div class="wcard__short" aria-hidden="true"><div class="wcard__body"><p class="wcard__to">Dear Dr. Munjal,</p><p class="wcard__t clamp">${esc(paras[0])}</p>${sig}</div></div>
      </article>`;
    }
    function build() {
      mob = MOBILE.matches;
      const items = source(), deco = [];   // a few letters only for the scattered view's depth; they fade as the grid forms
      for (let i = 0; i < (mob ? 0 : 6); i++) deco.push(items[(i * 7 + 3) % items.length]);
      const years = [...new Set(items.map(m => m.year))];
      cardsEl.innerHTML = items.map(m => cardHTML(m, false)).join('') + deco.map(m => cardHTML(m, true)).join('')
        + years.map(y => { const n = items.filter(m => m.year === y).length; return `<header class="wyear" data-y="${y}"><h3>${y}</h3><p>${n} ${n === 1 ? 'message' : 'messages'}</p></header>`; }).join('');
      heads = $$('.wyear', cardsEl).map(el => ({ el, year: +el.dataset.y }));
      // the years as a small navigation beside the heading: jump straight to any year's letters
      yearNav.innerHTML = years.map(y => `<button type="button" data-year="${y}">${y}</button>`).join('');
      items.forEach((m, i) => { m._i = i; });
      itemYears = items.map(m => m.year);
      cards = $$('.wcard', cardsEl).map((el, i) => ({ el, deco: i >= items.length, bg: el.querySelector('.wcard__bg'), full: el.querySelector('.wcard__full'), short: el.querySelector('.wcard__short') }));
      layout();
    }

    // ---- the two arrangements, in the stage's own coordinates ----
    function layout() {
      mob = MOBILE.matches; vw = sec.clientWidth; vh = innerHeight; lastW = vw;
      const hdr = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hdr')) || 64;
      const cols = mob ? (vw > 560 ? 2 : 1) : vw > 1500 ? 4 : vw > 980 ? 3 : 2;
      const gap = mob ? 18 : 40, maxW = cols * 380 + (cols - 1) * gap; side = Math.max(mob ? 18 : 56, (vw - maxW) / 2);
      const cw = Math.floor((vw - side * 2 - gap * (cols - 1)) / cols);
      stage.style.height = vh + 'px';
      cards.forEach(c => { c.el.style.width = cw + 'px'; c.el.style.transform = 'none'; });
      HOLD = mob ? 0 : 0.4; MORPH = mob ? 0 : 1.0;
      sec.classList.toggle('direct', mob);
      gTop = mob ? hdr + 20 + head.offsetHeight + 34 : hdr + 56;   // phones: the title, then the board
      const colX = Array.from({ length: cols }, (_, k) => side + k * (cw + gap)), colH = colX.map(() => 0);
      const rates = [-0.05, 0.04, -0.03, 0.05];
      // a year heading opens each group, across the whole width; the group's letters then fill the columns below it
      heads.forEach(h => { h.el.style.width = (vw - side * 2) + 'px'; });
      const HEAD = mob ? 74 : 104;
      let year = null, hi = 0;
      cards.forEach((c, i) => {
        c.h = c.el.offsetHeight; c.sh = Math.min(c.h, c.short.offsetHeight); c.long = c.h - c.sh > 4;
        c.el.classList.toggle('is-long', c.long);
        if (c.deco) return;
        if (itemYears[i] !== year) {
          year = itemYears[i]; const top = hi ? Math.max(...colH) + (mob ? 26 : 48) : 0, h = heads.find(q => q.year === year);
          if (h) h.y = top; hi++; colH.fill(top + HEAD);
        }
        const k = colH.indexOf(Math.min(...colH)); c.gx = colX[k]; c.gy = colH[k]; c.rate = cols > 1 ? rates[k % 4] : 0; colH[k] += c.h + gap;
      });
      const gridH = Math.max(...colH);
      pin.style.height = Math.round(vh * (HOLD + MORPH) + vh) + 'px';
      rest.style.height = Math.max(0, Math.round(gTop + gridH - vh + vh * 0.25)) + 'px';
      // the scatter: a few large letters in front around the count, a handful smaller behind (desktop only), the
      // decorative ones at the back; everything that lands further down the grid just fades in there
      const R = seeded(17), front = mob ? [[0.04, 0.09], [0.5, 0.13], [0.06, 0.7], [0.48, 0.74]]
        : [[0.04, 0.1], [0.27, 0.07], [0.6, 0.08], [0.82, 0.14], [0.02, 0.48], [0.84, 0.5], [0.06, 0.78], [0.31, 0.8], [0.57, 0.8], [0.8, 0.82]];
      const midMax = mob ? 0 : 10;
      const clear = (x, y, w, h) => { const cx = vw / 2, cy = vh * 0.48, rx = vw * (mob ? 0.42 : 0.24), ry = vh * (mob ? 0.15 : 0.19); return Math.abs(x + w / 2 - cx) < rx + w / 2 && Math.abs(y + h / 2 - cy) < ry + h / 2; };
      let f = 0, mid = 0;
      cards.forEach((c, i) => {
        let layer;
        if (c.deco) layer = 0; else if (f < front.length) layer = 2; else if (mid < midMax && c.gy < vh * 1.4) { layer = 1; mid++; } else layer = -1;   // -1: no scatter
        const sc = layer === 2 ? (mob ? 0.6 : 0.8) : layer === 1 ? 0.56 : 0.46;
        let x = c.gx, y = gTop + (c.gy || 0), t = 0;
        if (layer === 2) { const [u, v] = front[f++]; x = u * vw; y = Math.max(hdr, v * vh); }
        else if (layer >= 0) do { x = -cw * 0.2 + R() * (vw + cw * 0.1 - cw * sc); y = hdr - 20 + R() * (vh - hdr - c.sh * sc); } while (t++ < 30 && clear(x, y, cw * sc, c.sh * sc));
        Object.assign(c, { sx: x, sy: y, ss: layer < 0 ? 1 : sc, layer, wash: layer === 0 ? 0.5 : layer === 1 ? 0.32 : 0, blur: mob ? 0 : layer === 0 ? 2.4 : layer === 1 ? 1.2 : 0,
          d: layer === 2 ? 0.15 + (i % 5) * 0.04 : layer === 1 ? (i % 7) / 7 * 0.3 : 0, k: -1 });
        c.el.style.zIndex = Math.max(1, layer + 1);
      });
      draw();
    }

    // ---- every frame: how far each letter has travelled ----
    function draw() {
      raf = 0;
      const r = sec.getBoundingClientRect(), s = -r.top;
      const p = MORPH ? clamp01((s - vh * HOLD) / (vh * MORPH)) : 1;
      const after = Math.max(0, s - vh * (HOLD + MORPH));   // scroll since the stage let go: drives the column drift
      for (const c of cards) {
        let e, a = 1;
        if (c.deco) { e = 0; a = 1 - clamp01(p * 2.2); }
        else if (c.layer < 0) { e = 1; a = clamp01((p - 0.45) / 0.45); }   // fades in at its place in the grid
        else e = REDUCED.matches ? (p > 0.5 ? 1 : 0) : ease(clamp01((p - c.d) / 0.5));
        const x = c.deco ? c.sx : c.sx + (c.gx - c.sx) * e;
        const gy = gTop + c.gy + (c.rate || 0) * (gTop + c.gy - after - vh * 0.5);   // a gentle drift by distance from the middle of the screen
        const y = c.deco ? c.sy - p * 30 : c.layer < 0 ? gy + (1 - a) * 24 : c.sy + (gy - c.sy) * e;
        const sc = c.ss + (1 - c.ss) * e;
        c.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${sc.toFixed(4)})`;
        // the card itself opens from the shortened letter to the full one, in small steps
        const k = Math.round(e * 100) / 100, ka = Math.round(a * 50) / 50;
        if (k !== c.k || ka !== c.ka) {
          c.k = k; c.ka = ka;
          const vis = c.long ? c.sh + (c.h - c.sh) * k : c.h;
          c.el.style.setProperty('--vis', vis.toFixed(0) + 'px');
          // the shortened text leaves quickly and the full text arrives a moment later, so the two never sit on top of each other
          c.el.style.setProperty('--open', c.long ? Math.min(1, Math.max(0, (k - 0.3) / 0.35)).toFixed(2) : 1);
          c.el.style.setProperty('--short', c.long ? Math.max(0, 1 - k / 0.28).toFixed(2) : 0);
          c.el.style.setProperty('--wash', (c.wash * (1 - k)).toFixed(3));
          const bl = Math.round(c.blur * (1 - k) * 4) / 4; c.el.style.filter = bl ? `blur(${bl}px)` : '';
          c.el.style.opacity = ka; c.el.style.visibility = ka <= 0.01 ? 'hidden' : '';
          c.el.style.zIndex = k < 1 ? Math.max(1, c.layer + 1) : 1;
        }
      }
      const ha = clamp01((p - 0.45) / 0.45);
      // each year's heading stays just under the page header while its letters scroll past, until the next year pushes it on
      const hdr = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hdr')) || 64;
      heads.forEach((h, i) => {
        const own = gTop + (h.y || 0), next = heads[i + 1] ? gTop + heads[i + 1].y : Infinity, hh = h.el.offsetHeight;
        let y = Math.max(own, after + hdr + 6); y = Math.min(y, next - hh - 24);
        h.el.classList.toggle('stuck', y > own + 1);
        h.el.style.transform = `translate(${side}px, ${(y + (1 - ha) * 20).toFixed(1)}px)`; h.el.style.opacity = ha; h.el.style.visibility = ha <= 0.01 ? 'hidden' : '';
      });
      // the year navigation rides on the heading row: level with the first heading, then held under the page header
      if (heads.length) {
        const top = Math.max(hdr + 6, gTop + heads[0].y - after) + (1 - ha) * 20, on = ha > 0.05 && r.top < vh * 0.5 && r.bottom > vh * 0.35;   // only while the board is on screen
        let cur = 0; heads.forEach((h, i) => { if (gTop + h.y - after <= hdr + 60) cur = i; });
        yearNav.style.transform = `translateY(${top.toFixed(1)}px)`; yearNav.style.right = side + 'px';
        yearNav.style.opacity = on ? ha : 0; yearNav.classList.toggle('on', on && ha > 0.6);
        if (yearNav.dataset.cur !== String(cur)) {
          yearNav.dataset.cur = cur;
          $$('button', yearNav).forEach((b, i) => { b.classList.toggle('cur', i === cur); if (i === cur) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
        }
      }
      head.style.opacity = MORPH ? 1 - Math.min(1, p * 2.4) : 1;
      head.style.visibility = MORPH && p > 0.45 ? 'hidden' : '';
      body.classList.toggle('on-board', r.top < vh * 0.85 && r.bottom > vh * 0.15);
      const covered = r.top <= 0 && r.bottom >= vh; if (covered !== body.classList.contains('stage-covered')) { body.classList.toggle('stage-covered', covered); if (!covered) kick(); }
    }
    const tick = () => { if (!raf) raf = requestAnimationFrame(draw); };
    addEventListener('scroll', tick, { passive: true });
    // going to a year: its heading comes to rest just under the page header, its letters below
    yearNav.addEventListener('click', e => {
      const b = e.target.closest('[data-year]'); if (!b) return;
      const h = heads.find(q => q.year === +b.dataset.year); if (!h) return;
      const hdr = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hdr')) || 64;
      const start = sec.getBoundingClientRect().top + scrollY + vh * (HOLD + MORPH);   // where the stage lets go of the grid
      scrollTo({ top: start + Math.max(0, gTop + h.y - (hdr + 6)), behavior: REDUCED.matches ? 'auto' : 'smooth' });
    });
    let rt = 0; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (sec.clientWidth !== lastW) build(); }, 200); });
    document.fonts.ready.then(layout);

    build();
    function added() { build(); }
    return { added };
  })();

  // ---------------- splash: the figure lifts away and the portrait comes up out of the same painting ----------------
  // The splash has no ground of its own: the painting behind it is the page's, and stays still. Scrolling, the figure
  // rises a little slower than the page and fades, the words and logos go first, and the opening portrait and its
  // text fade up underneath, so one picture gives way to the other without an edge passing over the screen.
  (() => {
    const sp = $('.splash'), root = document.documentElement; if (!sp) return;
    let raf = 0, last = -1;
    const draw = () => {
      raf = 0;
      const vh = sp.offsetHeight, s = Math.min(scrollY, vh);
      if (s === last) return; last = s;
      const p = s / vh, still = REDUCED.matches;
      sp.style.setProperty('--fy', (still ? 0 : s * 0.38).toFixed(1) + 'px');
      sp.style.setProperty('--fsc', (still ? 1 : 1 + p * 0.06).toFixed(4));
      sp.style.setProperty('--fo', (1 - smooth(0.08, 0.55, p)).toFixed(3));
      sp.style.setProperty('--wy', (still ? 0 : s * 0.12).toFixed(1) + 'px');
      sp.style.setProperty('--wo', (1 - smooth(0, 0.3, p)).toFixed(3));
      sp.style.setProperty('--mk', (smooth(0, 0.25, p) * 45).toFixed(1) + '%');
      const rv = smooth(0.3, 0.85, p);
      root.style.setProperty('--reveal', rv.toFixed(3));
      root.style.setProperty('--rise', (still ? 0 : (1 - rv) * 36).toFixed(1) + 'px');
      body.classList.toggle('on-splash', p < 0.6);
      sp.style.visibility = s >= vh ? 'hidden' : '';
    };
    addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(draw); }, { passive: true });
    addEventListener('resize', () => { last = -1; draw(); });
    draw();
  })();

  // ---------------- boot ----------------
  (async function boot() {
    await Promise.race([Promise.all([document.fonts.load('400 20px "Archivo Narrow"'), document.fonts.load('700 20px "Archivo Narrow"')]).catch(() => {}),
      new Promise(r => setTimeout(r, 2500))]);
    await wp.init(window.PORTRAITS);
    geometry();
    await Promise.all(ART_LIST.map(A => A.loaded)); ART_LIST.forEach(A => { A.place(); A.build(); }); sizeTravel();
    // behind the loading screen: only what the first screens need (the opening portrait and the first two facets, with
    // the shuffles between them); the rest is prepared in the background once the page is open
    const bar = $('.splash__bar i'), order = [...new Set([blend().a, blend().b, ...STATES])];
    // every portrait and every shuffle between neighbours; if a slow device takes too long, the page opens anyway and
    // the rest carries on in the background
    const all = run(jobsFor(order), 150, (j, n) => { bar.style.transform = `scaleX(${j / n})`; });
    await Promise.race([all, new Promise(r => setTimeout(r, 9000))]);
    ready = true; kick();
    await new Promise(r => setTimeout(r, 250));
    body.classList.add('ready'); body.classList.remove('booting'); kick();
  })();
})();
