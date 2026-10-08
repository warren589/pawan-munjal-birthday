// Word-portrait renderer ("fine head, uniform body").
// Every word in an area is the same size: small condensed caps across the head for detail,
// one slightly larger size across the body. The photograph shows through ink tone only —
// each pixel inside the letters takes its colour from the tone-mapped photo — so no word is
// emphasised over another.
(function () {
  const PAPER = '#f3eee6';
  const FONT = '"Archivo Narrow", "Arial Narrow", sans-serif';

  function rng(seed) { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; }
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const toHex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');

  // tone 0 = highlight, 1 = deep shadow. S-curve keeps highlights clean and features deep;
  // the floor keeps every part of the silhouette made of (light) words.
  const toneOf = l => { const k = Math.min(1, Math.max(0, (0.88 - l) / 0.72)); return 0.07 + 0.93 * k * k * (3 - 2 * k); };

  function ramp(mid, dark) {
    const m = hex(mid), d = hex(dark), floor = hex('#d6cbbd');
    const deep = mix(d, [12, 10, 9], 0.45);
    const stops = [[0, floor], [0.1, mix(floor, m, 0.5)], [0.28, m], [0.5, mix(m, d, 0.65)], [0.74, d], [1, deep]];
    return t => {
      let k = 0; while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
      const [t0, c0] = stops[k], [t1, c1] = stops[k + 1];
      return mix(c0, c1, Math.min(1, Math.max(0, (t - t0) / (t1 - t0))));
    };
  }

  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  async function load(src) { const i = new Image(); i.src = src; await i.decode(); return i; }
  function field(img, ch = 0) {
    const c = canvas(img.width, img.height), x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data, out = new Float32Array(c.width * c.height);
    for (let i = 0; i < out.length; i++) out[i] = d[i * 4 + ch] / 255;
    return { w: c.width, h: c.height, d: out, img: c };
  }
  // a real alpha mask (the PNG itself is opaque), so trimming leaves a clean anti-aliased contour
  function alphaOf(f, blur = 0) {
    const c = canvas(f.w, f.h), x = c.getContext('2d'), id = x.createImageData(f.w, f.h);
    for (let i = 0; i < f.d.length; i++) { id.data[i * 4 + 3] = Math.round(f.d[i] * 255); }
    x.putImageData(id, 0, 0);
    if (!blur) return c;
    const b = canvas(f.w, f.h), bx = b.getContext('2d'); bx.filter = `blur(${blur}px)`; bx.drawImage(c, 0, 0); return b;
  }
  const sample = f => (u, v) => f.d[Math.min(f.h - 1, Math.max(0, (v * f.h) | 0)) * f.w + Math.min(f.w - 1, Math.max(0, (u * f.w) | 0))];

  class WordPortraits {
    constructor() { this.src = {}; this.cache = new Map(); }

    async init(portraits) {
      // decode every photograph in parallel; the heavier per-pixel preparation happens on first use
      this.raw = {};
      await Promise.all(Object.entries(portraits).map(async ([k, v]) => {
        const [lum, mask, scene] = await Promise.all([load(v.lum), load(v.mask), v.scene ? load(v.scene.src) : null]);
        this.raw[k] = { lum, mask, aspect: lum.width / lum.height, scene, sceneBox: v.scene };
      }));
    }

    get(k) {
      if (this.src[k]) return this.src[k];
      if (k === 'ghost') {
        // placeholder: a soft, featureless silhouette of the studio portrait, for facets awaiting photography
        const s = this.get('studio'), gl = canvas(s.mask.w, s.mask.h), gx = gl.getContext('2d');
        gx.filter = 'blur(14px)'; gx.drawImage(s.alpha, 0, 0); gx.filter = 'none';
        gx.globalCompositeOperation = 'source-in';
        const gr = gx.createLinearGradient(0, 0, 0, gl.height); gr.addColorStop(0, '#d8d8d8'); gr.addColorStop(1, '#9a9a9a');
        gx.fillStyle = gr; gx.fillRect(0, 0, gl.width, gl.height);
        gx.globalCompositeOperation = 'destination-over'; gx.fillStyle = '#fff'; gx.fillRect(0, 0, gl.width, gl.height);
        return (this.src.ghost = { ...s, lum: field(gl), ghost: true });
      }
      const r = this.raw[k], m = field(r.mask, 0);
      return (this.src[k] = { scene: r.scene ? field(r.scene) : null, sceneBox: r.sceneBox, lum: field(r.lum), mask: m, depth: field(r.mask, 1), alpha: alphaOf(m), shadow: alphaOf(m, Math.round(m.w / 70)), aspect: r.aspect });
    }

    aspect(spec) { return this.raw[spec.img || 'studio'].aspect; }

    // spec: { key, img, heads:[[cx,cy,rx,ry]...]|null, ink:[mid,dark], words:[{t,m}], seed }
    // W x H is the box the portrait must fit; the portrait keeps its photograph's aspect and sits bottom-centre.
    layout(spec, BW, BH, dpr) {
      const ar = this.aspect(spec);
      let W = BW, H = BW / ar; if (H > BH) { H = BH; W = BH * ar; }
      W = Math.round(W); H = Math.round(H);
      const ck = `${spec.key}|${BW}x${BH}@${dpr}`;
      if (this.cache.has(ck)) return this.cache.get(ck);
      const src = this.get(spec.img || 'ghost'), L = sample(src.lum), M = sample(src.mask), D = sample(src.depth);
      const heads = spec.img ? (spec.heads || []) : [];
      const inHead = (u, v) => heads.some(h => ((u - h[0]) / h[2]) ** 2 + ((v - h[1]) / h[3]) ** 2 < 1);
      const cw = Math.round(W * dpr), chh = Math.round(H * dpr), R = rng(spec.seed || 7);
      const words = [], glyphs = [];   // glyphs: every word set, kept as a sprite for the shuffle between facets

      // two full layers, one per word size; the head ellipse decides which one shows where
      const layer = (rows, region) => {
        const c = canvas(cw, chh), x = c.getContext('2d');
        x.setTransform(dpr, 0, 0, dpr, 0, 0); x.fillStyle = '#000'; x.textBaseline = 'alphabetic';
        const lh = H / rows, fs = lh * 1.2, space = fs * 0.28;
        // rows arch over the body like contour lines: lifted where the figure is deep, flat at its edges
        const amp = lh * 2.2, base = (px, y) => y - amp * D(Math.min(1, Math.max(0, px / W)), Math.min(1, Math.max(0, y / H)));
        const font = wt => `${wt} ${fs}px ${FONT}`;
        const widths = new Map();
        const measure = (w, wt) => { const k = wt + w; let v = widths.get(k); if (v === undefined) { x.font = font(wt); v = x.measureText(w).width; widths.set(k, v); } return v; };
        for (let y = lh * 0.92, row = 0; y < H + amp + lh; y += lh, row++) {
          let px = -R() * fs * 5;
          while (px < W) {
            const pick = spec.words[(R() * spec.words.length) | 0], text = pick.t.toUpperCase();
            const yb = base(px + fs * 2, y);
            const u0 = Math.min(1, Math.max(0, (px + fs * 2) / W)), v0 = (yb - fs * 0.35) / H;
            let wt = 400 + Math.round(3 * Math.min(1, toneOf(L(u0, v0)) * 1.25)) * 100;   // 400–700, reaching full weight in dark hair and cloth
            // small faces in group photos: heavier letters cover more of the face, so its features carry through the ink
            if (region === 'head' && spec.headWeight) wt = Math.max(wt, spec.headWeight);
            const w = measure(text, wt);
            const u = (px + w / 2) / W;
            // any word touching the silhouette is set; the smoothed outline trims it afterwards
            const inside = M(u, v0) > 0.5 || M(Math.min(1, (px + w) / W), v0) > 0.5 || M(Math.max(0, px / W), v0) > 0.5;
            if (inside) {
              const y0 = base(px, y), y1 = base(px + w, y), ang = Math.atan2(y1 - y0, w);
              x.font = font(wt);
              x.setTransform(dpr * Math.cos(ang), dpr * Math.sin(ang), -dpr * Math.sin(ang), dpr * Math.cos(ang), dpr * px, dpr * y0);
              x.fillText(text, 0, 0);
              x.setTransform(dpr, 0, 0, dpr, 0, 0);
              if ((region === 'head') === !!inHead(u, v0)) {
                // axis-aligned box around the (slightly rotated) word: baseline to cap height
                const c = Math.cos(ang), sn = Math.sin(ang), cap = fs * 0.78, d = fs * 0.06;
                const xs = [px, px + c * w, px + sn * cap, px + c * w + sn * cap, px - sn * d, px + c * w - sn * d];
                const ys = [y0, y0 + sn * w, y0 - c * cap, y0 + sn * w - c * cap, y0 + c * d, y0 + sn * w + c * d];
                const bx = Math.min(...xs), by = Math.min(...ys);
                glyphs.push({ x: bx, y: by, w: Math.max(...xs) - bx, h: Math.max(...ys) - by, text, wt, fs, ang });
              }
              if (M(u, v0) > 0.5 && Math.abs(ang) < 0.12 && (region === 'head') === !!inHead(u, v0))
                words.push({ x: px, y: (y0 + y1) / 2 - fs * 0.74, w, h: fs * 0.8, fs, wt, t: pick.t, m: pick.m, region, tone: toneOf(L(u, v0)), ang });
            }
            px += w + space;
          }
        }
        return c;
      };

      const tex = canvas(cw, chh), tx = tex.getContext('2d');
      // word size follows the portrait's height so a wide group photo keeps the same type size as a tall one
      const bodyRows = Math.round(152 * H / BH), headRows = Math.round(224 * (spec.headScale || 1) * H / BH);   // group photos: finer words in their small faces
      const body = layer(heads.length ? bodyRows : 160, 'body');
      if (heads.length) {
        const fine = layer(headRows, 'head'), fx = fine.getContext('2d'), bx = body.getContext('2d');
        const ell = (ctx, op) => {
          // feathered edge, so fine and body words blend instead of meeting at a hard line
          ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = op; ctx.fillStyle = '#000'; ctx.filter = `blur(${Math.round(4 * dpr)}px)`;
          ctx.beginPath(); heads.forEach(h => { ctx.moveTo(h[0] * cw + h[2] * cw, h[1] * chh); ctx.ellipse(h[0] * cw, h[1] * chh, h[2] * cw, h[3] * chh, 0, 0, Math.PI * 2); }); ctx.fill();
          ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over';
        };
        ell(fx, 'destination-in'); ell(bx, 'destination-out');
        tx.drawImage(body, 0, 0); tx.drawImage(fine, 0, 0);
      } else tx.drawImage(body, 0, 0);

      // colour every letter pixel from the tone-mapped photograph, then cut to the silhouette
      tx.globalCompositeOperation = 'source-in'; tx.drawImage(this.paint(spec, src), 0, 0, cw, chh);
      // trim to the silhouette with an anti-aliased edge, so letters end along a clean contour
      tx.imageSmoothingQuality = 'high';
      tx.globalCompositeOperation = 'destination-in'; tx.drawImage(src.alpha, 0, 0, cw, chh);
      tx.globalCompositeOperation = 'source-over';
      // thin details a row of words can't hold (a golf club): one line of tiny words set along the stroke
      (spec.strokes || []).forEach(([u0, v0, u1, v1], si) => {
        const x0 = u0 * W, y0 = v0 * H, x1 = u1 * W, y1 = v1 * H, len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
        const fs = H / 165, col = hex(spec.ink[1]);
        tx.setTransform(dpr * Math.cos(ang), dpr * Math.sin(ang), -dpr * Math.sin(ang), dpr * Math.cos(ang), dpr * x0, dpr * y0);
        tx.font = `700 ${fs}px ${FONT}`; tx.fillStyle = toHex(mix(col, [10, 10, 10], 0.3)); tx.textBaseline = 'middle';
        let p = 0, k = si;
        while (p < len) { const t = spec.words[(k++ * 7) % spec.words.length].t.toUpperCase(); tx.fillText(t, p, 0); p += tx.measureText(t).width + fs * 0.3; }
        tx.setTransform(1, 0, 0, 1, 0, 0);
      });

      const scene = src.scene && !src.ghost ? this.sceneLayer(spec, src, W, H, BW, BH, dpr, R) : null;
      // a soft shadow on the paper, so the figure sits slightly above the page
      const shadow = canvas(cw, chh), sx = shadow.getContext('2d');
      sx.drawImage(src.shadow, 0, 0, cw, chh); sx.globalCompositeOperation = 'source-in';
      sx.fillStyle = spec.ink[1]; sx.fillRect(0, 0, cw, chh);
      // each travelling word keeps its tone from the portrait (sampled at its centre); shown through opacity in flight
      for (const g of glyphs) {
        g.tone = toneOf(L((g.x + g.w / 2) / W, (g.y + g.h / 2) / H));
        g.font = `${g.wt} ${g.fs}px ${FONT}`;
        g.sp = this.sprite(g.text, g.font, g.fs, dpr, spec.ink[1]);   // prepared now, in this portrait's ink, so the shuffle never pauses
      }
      const out = { key: spec.key, ink: spec.ink[1], tex, shadow, scene, words, glyphs, W, H, BW, BH, ox: Math.round((BW - W) / 2), oy: BH - H, dpr, slots: new Map(), used: new Set() };
      this.cache.set(ck, out);
      if (this.cache.size > 24) this.cache.delete(this.cache.keys().next().value);
      return out;
    }

    // The photograph's surroundings, also set in words: smaller, lighter and faded, so the subject stays in focus.
    // Covers the whole stage box; positioned relative to the subject the same way the original photo was.
    sceneLayer(spec, src, W, H, BW, BH, dpr, R) {
      const ox = Math.round((BW - W) / 2), oy = BH - H, b = src.sceneBox, S = sample(src.scene);
      const sx = ox + b.x * W, sy = oy + b.y * H, sw = b.w * W, sh = b.h * H;
      const cw = Math.round(BW * dpr), ch = Math.round(BH * dpr);
      const c = canvas(cw, ch), x = c.getContext('2d');
      x.setTransform(dpr, 0, 0, dpr, 0, 0); x.fillStyle = '#000'; x.textBaseline = 'alphabetic';
      const lh = Math.max(4, BH / 150), fs = lh * 1.15, space = fs * 0.3;
      const x0 = Math.max(0, sx), x1 = Math.min(BW, sx + sw), y0 = Math.max(0, sy), y1 = Math.min(BH, sy + sh);
      const widths = new Map();
      for (let y = y0 + lh; y < y1 + lh; y += lh) {
        let px = x0 - R() * fs * 5;
        while (px < x1) {
          const t = spec.words[(R() * spec.words.length) | 0].t.toUpperCase();
          const tone = toneOf(S((px + fs * 2 - sx) / sw, (y - sy) / sh));
          const wt = tone > 0.55 ? 600 : 400, k = wt + t;
          let w = widths.get(k); if (w === undefined) { x.font = `${wt} ${fs}px ${FONT}`; w = x.measureText(t).width; widths.set(k, w); }
          x.font = `${wt} ${fs}px ${FONT}`; x.fillText(t, px, y);
          px += w + space;
        }
      }
      x.setTransform(1, 0, 0, 1, 0, 0);
      // colour from the scene photo in the facet's ink
      const pc = canvas(src.scene.w, src.scene.h), pcx = pc.getContext('2d'), id = pcx.createImageData(pc.width, pc.height), rmp = ramp(spec.ink[0], spec.ink[1]);
      for (let i = 0; i < src.scene.d.length; i++) {
        const col = rmp(toneOf(src.scene.d[i]));
        id.data[i * 4] = col[0]; id.data[i * 4 + 1] = col[1]; id.data[i * 4 + 2] = col[2]; id.data[i * 4 + 3] = 255;
      }
      pcx.putImageData(id, 0, 0);
      x.globalCompositeOperation = 'source-in'; x.drawImage(pc, sx * dpr, sy * dpr, sw * dpr, sh * dpr);
      // keep it faint
      x.globalCompositeOperation = 'destination-in'; x.fillStyle = 'rgba(0,0,0,0.42)'; x.fillRect(0, 0, cw, ch);
      // clear a soft margin around the subject so the two never blur together
      x.globalCompositeOperation = 'destination-out';
      x.filter = `blur(${Math.round(10 * dpr)}px)`; x.drawImage(src.alpha, ox * dpr, oy * dpr, W * dpr, H * dpr); x.drawImage(src.alpha, ox * dpr, oy * dpr, W * dpr, H * dpr); x.filter = 'none';
      // and dissolve towards the edges of the scene and of the stage
      const fade = (gx0, gy0, gx1, gy1) => { const g = x.createLinearGradient(gx0, gy0, gx1, gy1); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, cw, ch); };
      const L0 = x0 * dpr, R0 = x1 * dpr, T0 = y0 * dpr, B0 = y1 * dpr, mX = (R0 - L0) * 0.22, mY = (B0 - T0) * 0.22;
      fade(L0, 0, L0 + mX, 0); fade(R0, 0, R0 - mX, 0); fade(0, T0, 0, T0 + mY); fade(0, B0, 0, B0 - mY * 0.25);
      x.globalCompositeOperation = 'source-over';
      return c;
    }

    paint(spec, src) {
      const key = 'paint|' + spec.key; if (this.cache.has(key)) return this.cache.get(key);
      const f = src.lum, c = canvas(f.w, f.h), x = c.getContext('2d'), id = x.createImageData(f.w, f.h);
      const inks = spec.inks || [spec.ink];
      const ramps = inks.map(i => ramp(i[0], i[1]));
      for (let i = 0; i < f.d.length; i++) {
        let t = toneOf(f.d[i]); if (src.ghost) t = 0.05 + t * 0.35;
        // depth: a soft rim of shade where the figure turns away, so the flat photo reads as a rounded form
        const dep = src.depth.d[i]; t = Math.min(1, t + 0.2 * Math.pow(1 - dep, 2) - 0.05 * dep);
        // the closing portrait drifts through every facet's ink from top to bottom
        let col;
        if (ramps.length === 1) col = ramps[0](t);
        else {   // continuous blend between neighbouring inks, no bands
          const y = ((i / f.w) | 0) / f.h * (ramps.length - 1), k = Math.min(ramps.length - 2, y | 0), e = y - k, s = e * e * (3 - 2 * e);
          col = mix(ramps[k](t), ramps[k + 1](t), s);
        }
        id.data[i * 4] = col[0]; id.data[i * 4 + 1] = col[1]; id.data[i * 4 + 2] = col[2]; id.data[i * 4 + 3] = 255;
      }
      x.putImageData(id, 0, 0);
      this.cache.set(key, c); return c;
    }

    // Reserve a word position for a visitor's word: a readable body word of similar length in mid tones.
    // The texture word underneath is erased so the visitor's word takes its place in the fabric.
    slotFor(L, id, text) {
      if (L.slots.has(id)) return L.slots.get(id);
      const n = text.length, R = rng(id.length * 131 + L.slots.size * 977);
      const cand = L.words.filter((w, i) => !L.used.has(i) && w.region === 'body' && w.tone > 0.3 && w.tone < 0.85 && Math.abs(w.t.length - n) <= 3 && w.y > L.H * 0.12 && w.y < L.H * 0.9);
      const pool = cand.length ? cand : L.words.filter((w, i) => !L.used.has(i));
      if (!pool.length) return null;
      // spread visitor words apart from each other
      let best = null, bestD = -1;
      for (let k = 0; k < 24; k++) {
        const w = pool[(R() * pool.length) | 0];
        let d = 1e9; L.slots.forEach(s => { d = Math.min(d, Math.hypot(s.x - w.x, s.y - w.y)); });
        if (d > bestD) { bestD = d; best = w; }
      }
      L.used.add(L.words.indexOf(best));
      const ctx = L.tex.getContext('2d');
      ctx.clearRect((best.x - 1) * L.dpr, (best.y - best.fs * 0.1) * L.dpr, (best.w + 2) * L.dpr, best.fs * 1.08 * L.dpr);
      const slot = { ...best, text };
      L.slots.set(id, slot);
      return slot;
    }

    // Pair the words of two portraits for the shuffle. Pairing by (noisy) height keeps most journeys short,
    // so the words reflow from one photograph into the next instead of exploding.
    pairs(A, B) {
      const key = A.key + '>' + B.key + '|' + A.BW + 'x' + A.BH;
      if (this.cache.has(key)) return this.cache.get(key);
      const R = rng(A.glyphs.length * 31 + B.glyphs.length * 7);
      const order = (L, ox, oy) => L.glyphs.map(g => ({ g, cx: ox + g.x + g.w / 2, cy: oy + g.y + g.h / 2, k: oy + g.y + R() * L.BH * 0.22 }))
        .sort((p, q) => p.k - q.k);
      const a = order(A, A.ox, A.oy), b = order(B, B.ox, B.oy), n = Math.max(a.length, b.length);
      const out = new Array(n); let pa = -1, pb = -1;
      for (let k = 0; k < n; k++) {
        const ia = Math.floor(k * a.length / n), ib = Math.floor(k * b.length / n);
        const ga = a[ia], gb = b[ib];
        out[k] = {
          a: ga, b: gb, aMain: ia !== pa, bMain: ib !== pb,
          // re-form top to bottom, with some randomness so it never moves as one block
          d: Math.min(1, Math.max(0, (gb.cy / B.BH) * 0.55 + R() * 0.45)),
          arc: (R() - 0.5) * B.BH * 0.12, rot: (R() - 0.5) * 0.6
        };
        pa = ia; pb = ib;
      }
      this.cache.set(key, out);
      return out;
    }

    // e: 0 → portrait A, 1 → portrait B. Each word travels to its partner's place and becomes that word on the way.
    // Each distinct word (text + weight + size) drawn once, in black, into shared sheets; the shuffle copies from these.
    sprite(text, font, fs, dpr, ink = '#000') {
      const A = this.atlas || (this.atlas = { pages: [], map: new Map() });
      const key = dpr + '|' + ink + '|' + font + '|' + text; let sp = A.map.get(key);
      if (sp) return sp;
      let pg = A.pages[A.pages.length - 1];
      if (!pg || pg.dpr !== dpr) { pg = { c: canvas(2048, 2048), x: 0, y: 0, row: 0, dpr }; pg.x2 = pg.c.getContext('2d'); A.pages.push(pg); }
      const x = pg.x2; x.font = font;
      const w = Math.ceil(x.measureText(text).width) + 2, h = Math.ceil(fs * 1.3) + 2, pw = Math.ceil(w * dpr), ph = Math.ceil(h * dpr);
      if (pg.x + pw > 2048) { pg.x = 0; pg.y += pg.row + 1; pg.row = 0; }
      if (pg.y + ph > 2048) { pg = { c: canvas(2048, 2048), x: 0, y: 0, row: 0, dpr }; pg.x2 = pg.c.getContext('2d'); A.pages.push(pg); return this.sprite(text, font, fs, dpr, ink); }
      x.setTransform(dpr, 0, 0, dpr, pg.x, pg.y); x.font = font; x.fillStyle = ink; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(text, w / 2, h / 2); x.setTransform(1, 0, 0, 1, 0, 0);
      sp = { c: pg.c, sx: pg.x, sy: pg.y, sw: pw, sh: ph, w, h };
      pg.x += pw + 1; pg.row = Math.max(pg.row, ph);
      A.map.set(key, sp); return sp;
    }

    // e: 0 → portrait A, 1 → portrait B. Each word travels to its partner's place and becomes that word on the way.
    // Words are drawn as words (one sprite each), darkness from opacity, then each portrait's travellers are tinted in its ink.
    drawShuffle(ctx, A, B, e, dpr, mul = 1) {
      const P = this.pairs(A, B), span = 0.55;
      ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const put = (g, cx, cy, a) => {
        const sp = g.sp; ctx.globalAlpha = a * mul * (0.35 + 0.65 * g.tone);
        ctx.drawImage(sp.c, sp.sx, sp.sy, sp.sw, sp.sh, cx - sp.w / 2, cy - sp.h / 2, sp.w, sp.h);
      };
      for (let k = 0; k < P.length; k++) {
        const p = P[k];
        let t = (e - p.d * (1 - span)) / span; if (t <= 0) t = 0; else if (t >= 1) t = 1;
        const m = t * t * (3 - 2 * t), bump = Math.sin(Math.PI * m);
        const cx = p.a.cx + (p.b.cx - p.a.cx) * m + bump * p.arc * 0.2;
        const cy = p.a.cy + (p.b.cy - p.a.cy) * m + bump * p.arc * 0.6;
        let q = (m - 0.3) / 0.4; q = q < 0 ? 0 : q > 1 ? 1 : q;   // which word it reads as, mid-flight
        // lighter in flight so the cloud stays airy; the tiny head words most of all, or they pile into smudges
        const fs = p.a.g.fs < p.b.g.fs ? p.a.g.fs : p.b.g.fs, small = fs >= 11 ? 0 : fs <= 6 ? 1 : (11 - fs) / 5;
        const air = 1 - (0.3 + 0.5 * small) * bump;
        if (p.aMain && q < 0.99) put(p.a.g, cx, cy, (1 - q) * air);
        if (p.bMain && q > 0.01) put(p.b.g, cx, cy, q * air);
      }
      ctx.restore();
    }

    hit(L, x, y, pad = 0) {
      let best = null, bd = Infinity;
      for (const w of L.words) {
        if (x >= w.x - pad && x <= w.x + w.w + pad && y >= w.y - pad && y <= w.y + w.h + pad) {
          const d = Math.abs(x - (w.x + w.w / 2)) + Math.abs(y - (w.y + w.h / 2)) * 2;
          if (d < bd) { bd = d; best = w; }
        }
      }
      return best;
    }
  }

  window.WordPortraits = WordPortraits;
  window.WP_PAPER = PAPER;
  window.WP_FONT = FONT;
})();
