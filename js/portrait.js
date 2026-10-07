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
  function field(img) {
    const c = canvas(img.width, img.height), x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data, out = new Float32Array(c.width * c.height);
    for (let i = 0; i < out.length; i++) out[i] = d[i * 4] / 255;
    return { w: c.width, h: c.height, d: out, img: c };
  }
  const sample = f => (u, v) => f.d[Math.min(f.h - 1, Math.max(0, (v * f.h) | 0)) * f.w + Math.min(f.w - 1, Math.max(0, (u * f.w) | 0))];

  class WordPortraits {
    constructor() { this.src = {}; this.cache = new Map(); }

    async init(portraits) {
      for (const [k, v] of Object.entries(portraits)) {
        const [lum, mask] = await Promise.all([load(v.lum), load(v.mask)]);
        this.src[k] = { lum: field(lum), mask: field(mask), aspect: lum.width / lum.height };
      }
      // placeholder: a soft, featureless silhouette of the studio portrait, for facets awaiting photography
      const s = this.src.studio, gl = canvas(s.mask.w, s.mask.h), gx = gl.getContext('2d');
      gx.filter = 'blur(14px)'; gx.drawImage(s.mask.img, 0, 0); gx.filter = 'none';
      gx.globalCompositeOperation = 'source-in';
      const gr = gx.createLinearGradient(0, 0, 0, gl.height); gr.addColorStop(0, '#d8d8d8'); gr.addColorStop(1, '#9a9a9a');
      gx.fillStyle = gr; gx.fillRect(0, 0, gl.width, gl.height);
      gx.globalCompositeOperation = 'destination-over'; gx.fillStyle = '#fff'; gx.fillRect(0, 0, gl.width, gl.height);
      this.src.ghost = { lum: field(gl), mask: s.mask, ghost: true, aspect: s.aspect };
    }

    aspect(spec) { return this.src[spec.img || 'ghost'].aspect; }

    // spec: { key, img, heads:[[cx,cy,rx,ry]...]|null, ink:[mid,dark], words:[{t,m}], seed }
    // W x H is the box the portrait must fit; the portrait keeps its photograph's aspect and sits bottom-centre.
    layout(spec, BW, BH, dpr) {
      const ar = this.aspect(spec);
      let W = BW, H = BW / ar; if (H > BH) { H = BH; W = BH * ar; }
      W = Math.round(W); H = Math.round(H);
      const ck = `${spec.key}|${BW}x${BH}@${dpr}`;
      if (this.cache.has(ck)) return this.cache.get(ck);
      const src = this.src[spec.img || 'ghost'], L = sample(src.lum), M = sample(src.mask);
      const heads = spec.img ? (spec.heads || []) : [];
      const inHead = (u, v) => heads.some(h => ((u - h[0]) / h[2]) ** 2 + ((v - h[1]) / h[3]) ** 2 < 1);
      const cw = Math.round(W * dpr), chh = Math.round(H * dpr), R = rng(spec.seed || 7);
      const words = [];

      // two full layers, one per word size; the head ellipse decides which one shows where
      const layer = (rows, region) => {
        const c = canvas(cw, chh), x = c.getContext('2d');
        x.setTransform(dpr, 0, 0, dpr, 0, 0); x.fillStyle = '#000'; x.textBaseline = 'alphabetic';
        const lh = H / rows, fs = lh * 1.2, space = fs * 0.28;
        const font = wt => `${wt} ${fs}px ${FONT}`;
        const widths = new Map();
        const measure = (w, wt) => { const k = wt + w; let v = widths.get(k); if (v === undefined) { x.font = font(wt); v = x.measureText(w).width; widths.set(k, v); } return v; };
        for (let y = lh * 0.92, row = 0; y < H + lh; y += lh, row++) {
          let px = -R() * fs * 5;
          while (px < W) {
            const pick = spec.words[(R() * spec.words.length) | 0], text = pick.t.toUpperCase();
            const u0 = Math.min(1, Math.max(0, (px + fs * 2) / W)), v0 = (y - fs * 0.35) / H;
            const wt = 400 + Math.round(3 * toneOf(L(u0, v0))) * 100;         // 400–700, heavier in shadow
            const w = measure(text, wt);
            const u = (px + w / 2) / W;
            // any word touching the silhouette is set; the smoothed outline trims it afterwards
            const inside = M(u, v0) > 0.5 || M(Math.min(1, (px + w) / W), v0) > 0.5 || M(Math.max(0, px / W), v0) > 0.5;
            if (inside) {
              x.font = font(wt); x.fillText(text, px, y);
              if (M(u, v0) > 0.5 && (region === 'head') === !!inHead(u, v0))
                words.push({ x: px, y: y - fs * 0.74, w, h: fs * 0.8, fs, wt, t: pick.t, m: pick.m, region, tone: toneOf(L(u, v0)) });
            }
            px += w + space;
          }
        }
        return c;
      };

      const tex = canvas(cw, chh), tx = tex.getContext('2d');
      // word size follows the portrait's height so a wide group photo keeps the same type size as a tall one
      const bodyRows = Math.round(140 * H / BH), headRows = Math.round(200 * H / BH);
      const body = layer(heads.length ? bodyRows : 150, 'body');
      if (heads.length) {
        const fine = layer(headRows, 'head'), fx = fine.getContext('2d'), bx = body.getContext('2d');
        const ell = (ctx, op) => {
          ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = op; ctx.fillStyle = '#000';
          ctx.beginPath(); heads.forEach(h => { ctx.moveTo(h[0] * cw + h[2] * cw, h[1] * chh); ctx.ellipse(h[0] * cw, h[1] * chh, h[2] * cw, h[3] * chh, 0, 0, Math.PI * 2); }); ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
        };
        ell(fx, 'destination-in'); ell(bx, 'destination-out');
        tx.drawImage(body, 0, 0); tx.drawImage(fine, 0, 0);
      } else tx.drawImage(body, 0, 0);

      // colour every letter pixel from the tone-mapped photograph, then cut to the silhouette
      tx.globalCompositeOperation = 'source-in'; tx.drawImage(this.paint(spec, src), 0, 0, cw, chh);
      // trim to the silhouette with an anti-aliased edge, so letters end along a clean contour
      tx.imageSmoothingQuality = 'high';
      tx.globalCompositeOperation = 'destination-in'; tx.drawImage(src.mask.img, 0, 0, cw, chh);
      tx.globalCompositeOperation = 'source-over';

      const out = { key: spec.key, tex, words, W, H, BW, BH, ox: Math.round((BW - W) / 2), oy: BH - H, dpr, slots: new Map(), used: new Set() };
      this.cache.set(ck, out);
      if (this.cache.size > 24) this.cache.delete(this.cache.keys().next().value);
      return out;
    }

    paint(spec, src) {
      const key = 'paint|' + spec.key; if (this.cache.has(key)) return this.cache.get(key);
      const f = src.lum, c = canvas(f.w, f.h), x = c.getContext('2d'), id = x.createImageData(f.w, f.h);
      const inks = spec.inks || [spec.ink];
      const ramps = inks.map(i => ramp(i[0], i[1]));
      for (let i = 0; i < f.d.length; i++) {
        let t = toneOf(f.d[i]); if (src.ghost) t = 0.05 + t * 0.35;
        // the closing portrait drifts through every facet's ink from top to bottom
        const y = ((i / f.w) | 0) / f.h, k = Math.min(ramps.length - 1, (y * ramps.length) | 0);
        const col = ramps[k](t);
        id.data[i * 4] = col[0]; id.data[i * 4 + 1] = col[1]; id.data[i * 4 + 2] = col[2]; id.data[i * 4 + 3] = 255;
      }
      x.putImageData(id, 0, 0);
      if (ramps.length > 1) { const b = canvas(f.w, f.h), bx = b.getContext('2d'); bx.filter = 'blur(40px)'; bx.drawImage(c, 0, 0); bx.filter = 'none';
        // soften the bands between inks but keep detail from the sharp version
        bx.globalAlpha = 0.6; bx.drawImage(c, 0, 0); this.cache.set(key, b); return b; }
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
