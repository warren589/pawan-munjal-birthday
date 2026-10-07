// Typographic portrait renderer.
// A grayscale "tone" source (the supplied photograph, or a placeholder shape) guides
// where words go; small words are composited with a colour-mapped version of the tone
// so the letters themselves carry the image. Larger featured words and the visitor's
// own words sit on top and tween between facet states.
(function () {
  const GW = 600, GH = 900;
  const TEX_FONT = '"Barlow Condensed", "Arial Narrow", sans-serif';
  const SERIF = '"Fraunces", Georgia, serif';

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function buildLUT(stops) {
    const cols = stops.map(hexRgb), lut = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) {
      const v = Math.pow(i / 255, 1.2) * (cols.length - 1);
      const k = Math.min(cols.length - 2, Math.floor(v)), f = v - k;
      for (let c = 0; c < 3; c++) lut[i * 3 + c] = lerp(cols[k][c], cols[k + 1][c], f);
    }
    return lut;
  }
  const lutColor = (lut, v) => {
    const i = Math.max(0, Math.min(255, Math.round(v * 255))) * 3;
    return [lut[i], lut[i + 1], lut[i + 2]];
  };

  function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  function grayFromCanvas(c) {
    const d = c.getContext('2d').getImageData(0, 0, GW, GH).data, g = new Float32Array(GW * GH);
    for (let i = 0; i < g.length; i++) g[i] = d[i * 4] / 255;
    // coarse detail map (gradient magnitude) used to keep big words off eyes/mouth
    const DW = 100, DH = 150, det = new Float32Array(DW * DH);
    for (let y = 1; y < DH - 1; y++) for (let x = 1; x < DW - 1; x++) {
      const s = (xx, yy) => g[Math.floor(yy * GH / DH) * GW + Math.floor(xx * GW / DW)];
      det[y * DW + x] = Math.abs(s(x + 1, y) - s(x - 1, y)) + Math.abs(s(x, y + 1) - s(x, y - 1));
    }
    return { gray: g, det, DW, DH };
  }

  async function loadPhotoSource(src) {
    const img = new Image(); img.src = src; await img.decode();
    const c = makeCanvas(GW, GH); c.getContext('2d').drawImage(img, 0, 0, GW, GH);
    return grayFromCanvas(c);
  }

  // Abstract placeholder compositions for facets awaiting client photography.
  function shapeSource(kind) {
    const c = makeCanvas(GW, GH), x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, GW, GH);
    const disc = (cx, cy, r, a, b) => {
      const g = x.createRadialGradient(cx, cy - r * 0.3, r * 0.1, cx, cy, r);
      g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, `rgba(255,255,255,${b})`);
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    };
    x.globalCompositeOperation = 'lighter';
    if (kind === 'golf') {
      disc(330, 300, 175, 0.95, 0.35);
      x.fillStyle = 'rgba(255,255,255,0.32)';
      x.beginPath(); x.moveTo(0, 900); x.lineTo(0, 700); x.quadraticCurveTo(300, 520, 600, 640); x.lineTo(600, 900); x.fill();
      x.strokeStyle = 'rgba(255,255,255,0.45)'; x.lineWidth = 34; x.lineCap = 'round';
      x.beginPath(); x.moveTo(40, 860); x.quadraticCurveTo(260, 600, 540, 780); x.stroke();
    } else if (kind === 'family') {
      disc(190, 360, 150, 0.55, 0.3); disc(410, 340, 165, 0.55, 0.3); disc(300, 560, 140, 0.55, 0.3);
      disc(300, 780, 70, 0.6, 0.25);
    } else if (kind === 'mentor') {
      disc(370, 360, 210, 0.7, 0.25); disc(190, 640, 110, 0.95, 0.4);
      x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 18;
      x.beginPath(); x.moveTo(230, 560); x.quadraticCurveTo(280, 470, 320, 520); x.stroke();
    } else if (kind === 'global') {
      disc(300, 440, 250, 0.85, 0.3);
      x.globalCompositeOperation = 'source-over';
      x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = 10;
      for (let i = 1; i < 5; i++) { x.beginPath(); x.ellipse(300, 440, 250 * i / 5, 250, 0, 0, Math.PI * 2); x.stroke(); }
      for (let i = -2; i <= 2; i++) { const yy = 440 + i * 90, rr = Math.sqrt(250 * 250 - (i * 90) ** 2); x.beginPath(); x.moveTo(300 - rr, yy); x.lineTo(300 + rr, yy); x.stroke(); }
    } else if (kind === 'humanitarian') {
      for (let i = 9; i >= 1; i--) {
        x.globalCompositeOperation = 'source-over';
        x.fillStyle = `rgba(255,255,255,${i % 2 ? 0.22 + (9 - i) * 0.07 : 0.06})`;
        x.beginPath(); x.arc(300, 600, i * 48, 0, Math.PI * 2); x.fill();
      }
    } else if (kind === 'journey') {
      x.strokeStyle = 'rgba(255,255,255,0.75)'; x.lineCap = 'round';
      for (let i = 0; i < 40; i++) {
        const t0 = i / 40, t1 = (i + 1) / 40, w = lerp(150, 14, t0);
        const p = t => [300 + Math.sin(t * 7.5) * lerp(220, 60, t), 900 - t * 840];
        x.lineWidth = w; x.beginPath(); x.moveTo(...p(t0)); x.lineTo(...p(t1)); x.stroke();
      }
      disc(300, 80, 70, 0.9, 0.2);
    }
    x.globalCompositeOperation = 'source-over';
    const v = x.createRadialGradient(300, 450, 200, 300, 450, 620);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.7)');
    x.fillStyle = v; x.fillRect(0, 0, GW, GH);
    const out = makeCanvas(GW, GH), o = out.getContext('2d');
    o.filter = 'blur(5px)'; o.drawImage(c, 0, 0);
    // Lift the floor slightly so the whole frame reads as a portrait area
    const id = o.getImageData(0, 0, GW, GH), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const val = 0.07 + 0.93 * d[i] / 255; d[i] = d[i + 1] = d[i + 2] = val * 255; }
    o.putImageData(id, 0, 0);
    return grayFromCanvas(out);
  }

  function colorize(src, lut) {
    const c = makeCanvas(GW, GH), x = c.getContext('2d'), id = x.createImageData(GW, GH), d = id.data;
    for (let i = 0; i < src.gray.length; i++) {
      const k = Math.round(src.gray[i] * 255) * 3;
      d[i * 4] = lut[k]; d[i * 4 + 1] = lut[k + 1]; d[i * 4 + 2] = lut[k + 2]; d[i * 4 + 3] = 255;
    }
    x.putImageData(id, 0, 0);
    return c;
  }

  class Portrait {
    constructor(canvas) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d');
      this.sources = {}; this.cache = new Map(); this.widths = new Map();
      this.cur = null; this.prev = null; this.tStart = 0; this.dur = 1100;
      this.user = []; this.find = 0; this.findTarget = 0; this.hover = null;
      this.mctx = makeCanvas(1, 1).getContext('2d');
      this._loop = this._loop.bind(this);
    }

    async init(photoSrc) { this.sources.photo = await loadPhotoSource(photoSrc); }
    source(kind) { return this.sources[kind] || (this.sources[kind] = shapeSource(kind)); }

    resize(w, h) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (this.W === w && this.H === h && this.dpr === dpr) return false;
      this.W = w; this.H = h; this.dpr = dpr;
      this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
      this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
      this.cache.clear();
      return true;
    }

    measure(word, font) {
      const k = font + '|' + word;
      let v = this.widths.get(k);
      if (v === undefined) { this.mctx.font = font.replace('$', '100px'); v = this.mctx.measureText(word).width / 100; this.widths.set(k, v); }
      return v;
    }

    // spec: { key, kind, stops, pool:[{t,m}], featured:[{t,m}], seed, slots }
    layout(spec) {
      if (this.cache.has(spec.key)) { const v = this.cache.get(spec.key); this.cache.delete(spec.key); this.cache.set(spec.key, v); return v; }
      const { W, H, dpr } = this, R = rng(spec.seed), src = this.source(spec.kind), lut = buildLUT(spec.stops);
      const tone = (x, y) => src.gray[Math.min(GH - 1, Math.max(0, Math.floor(y / H * GH))) * GW + Math.min(GW - 1, Math.max(0, Math.floor(x / W * GW)))];
      const det = (x, y) => src.det[Math.min(src.DH - 1, Math.max(0, Math.floor(y / H * src.DH))) * src.DW + Math.min(src.DW - 1, Math.max(0, Math.floor(x / W * src.DW)))];
      const rects = [];
      const hits = (r, pad) => rects.some(q => r.x < q.x + q.w + pad && r.x + r.w + pad > q.x && r.y < q.y + q.h + pad && r.y + r.h + pad > q.y);

      // reserve visitor slots so featured words keep clear of them
      spec.slots.slice(0, 3).forEach(([sx, sy]) => rects.push({ x: sx * W - W * 0.2, y: sy * H - H * 0.035, w: W * 0.4, h: H * 0.07, reserved: true }));

      // ---- featured words (greedy placement guided by tone + detail) ----
      const tiers = spec.tiers || [[3, 0.048, 'serif'], [5, 0.032, 'sans'], [8, 0.024, 'sans'], [14, 0.018, 'sans']];
      const featured = []; let fi = 0; const prot = spec.protect || [];
      for (const [n, rel, style] of tiers) {
        for (let i = 0; i < n && fi < spec.featured.length; i++, fi++) {
          const item = spec.featured[fi], size = H * rel;
          const text = style === 'serif' ? item.t : item.t.toUpperCase();
          const font = style === 'serif' ? `italic 600 $ ${SERIF}` : `700 $ ${TEX_FONT}`;
          const w = this.measure(text, font) * size, h = size * (style === 'serif' ? 0.9 : 0.78);
          let best = null, bestCost = Infinity;
          for (let k = 0; k < 160; k++) {
            const r = { x: W * 0.04 + R() * (W * 0.92 - w), y: H * 0.04 + R() * (H * 0.92 - h), w, h };
            if (hits(r, size * 0.25)) continue;
            let tsum = 0, dsum = 0, tmin = 1;
            for (let a = 0; a < 5; a++) for (let b = 0; b < 3; b++) {
              const px = r.x + w * (a + 0.5) / 5, py = r.y + h * (b + 0.5) / 3, t = tone(px, py);
              tsum += t; tmin = Math.min(tmin, t); dsum += det(px, py);
            }
            const tm = tsum / 15;
            if (tmin < 0.035 || tm > 0.62) continue;
            if (prot.some(([cx, cy, rx, ry]) => {
              const nx = Math.max(Math.abs(r.x + w / 2 - cx * W) - w / 2, 0) / (rx * W), ny = Math.max(Math.abs(r.y + h / 2 - cy * H) - h / 2, 0) / (ry * H);
              return nx * nx + ny * ny < 1;
            })) continue;
            const cost = dsum * 2.5 + Math.abs(tm - 0.3) * 1.0 + R() * 0.35;
            if (cost < bestCost) { bestCost = cost; best = { r, tm }; }
          }
          if (!best) continue;
          rects.push(best.r);
          featured.push({
            t: item.t, m: item.m, text, font, size, x: best.r.x, y: best.r.y + h, w, h: h,
            col: lutColor(lut, Math.min(1, 0.3 + 1.05 * best.tm))
          });
        }
      }

      // ---- texture words, row by row, composited with the tone image ----
      const tex = makeCanvas(Math.round(W * dpr), Math.round(H * dpr)), tx = tex.getContext('2d');
      tx.scale(dpr, dpr); tx.fillStyle = '#fff'; tx.textBaseline = 'alphabetic';
      const fs = Math.max(5, H / 128), lh = fs * 0.98, gap = fs * 0.32, rows = [];
      const pool = spec.pool;
      const blockers = rects.filter(r => !r.reserved);
      for (let y = 0, ri = 0; y < H + lh; y += lh, ri++) {
        const band = blockers.filter(q => q.y - fs * 0.3 < y + lh && q.y + q.h + fs * 0.3 > y).sort((a, b) => a.x - b.x);
        const items = []; let x = -R() * fs * 4;
        while (x < W) {
          const pick = pool[Math.floor(R() * pool.length)], word = pick.t.toUpperCase();
          const t = tone(x + fs, y + lh * 0.5);
          const weight = t > 0.5 ? 700 : t > 0.28 ? 600 : t > 0.15 ? 500 : 400;
          const font = `${weight} $ ${TEX_FONT}`, w = this.measure(word, font) * fs;
          const blk = band.find(q => x < q.x + q.w + gap && x + w + gap > q.x);
          if (blk) { x = blk.x + blk.w + gap * 1.5; continue; }
          if (t < 0.09 && R() < 0.6) { x += w + gap; continue; } // sparser in the dark
          tx.font = font.replace('$', fs + 'px');
          tx.fillText(word, x, y + lh * 0.82);
          items.push(x, w, pick.m, pick.t);
          x += w + gap;
        }
        rows.push(items);
      }
      tx.setTransform(1, 0, 0, 1, 0, 0);
      tx.globalCompositeOperation = 'source-in';
      tx.drawImage(colorize(src, lut), 0, 0, tex.width, tex.height);
      // feather the frame so the portrait dissolves into the page
      tx.globalCompositeOperation = 'destination-in';
      const gx = tx.createLinearGradient(0, 0, tex.width, 0);
      gx.addColorStop(0, 'rgba(0,0,0,0)'); gx.addColorStop(0.1, '#000'); gx.addColorStop(0.9, '#000'); gx.addColorStop(1, 'rgba(0,0,0,0)');
      tx.fillStyle = gx; tx.fillRect(0, 0, tex.width, tex.height);
      const gy = tx.createLinearGradient(0, 0, 0, tex.height);
      gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(0.06, '#000'); gy.addColorStop(0.93, '#000'); gy.addColorStop(1, 'rgba(0,0,0,0)');
      tx.fillStyle = gy; tx.fillRect(0, 0, tex.width, tex.height);

      const out = { key: spec.key, tex, rows, lh, fs, featured, slots: spec.slots, lut };
      this.cache.set(spec.key, out);
      while (this.cache.size > 4) this.cache.delete(this.cache.keys().next().value);
      return out;
    }

    show(spec, instant) {
      const next = this.layout(spec);
      if (this.cur && this.cur.key === next.key) return;
      this.prev = instant ? null : this.cur; this.cur = next; this.tStart = performance.now();
      this.user.forEach(u => { u.from = u.pos || null; });
      this.kick();
    }

    userTarget(i) {
      const s = this.cur.slots[i % this.cur.slots.length];
      return { x: s[0] * this.W, y: s[1] * this.H, size: this.H * 0.05 };
    }

    addUser(words, color, m) {
      const base = this.user.length, now = performance.now();
      words.forEach((t, i) => this.user.push({ t, color, m, idx: base + i, born: now + i * 140, pos: null, from: null }));
      this.kick();
    }

    setFind(on) { this.findTarget = on ? 1 : 0; this.kick(); }
    setHover(h) { if ((h && h.t) !== (this.hover && this.hover.t) || (h && h.x) !== (this.hover && this.hover.x)) { this.hover = h; this.kick(); } }

    hit(px, py) {
      const L = this.cur; if (!L) return null;
      for (const u of this.user) if (u.box && px >= u.box.x && px <= u.box.x + u.box.w && py >= u.box.y && py <= u.box.y + u.box.h) return { t: u.t, m: u.m, box: u.box, mine: true };
      for (const f of L.featured) if (px >= f.x - 4 && px <= f.x + f.w + 4 && py >= f.y - f.h - 4 && py <= f.y + 6)
        return { t: f.t, m: f.m, box: { x: f.x, y: f.y - f.h, w: f.w, h: f.h }, f };
      const ri = Math.floor(py / L.lh), row = L.rows[ri];
      if (row) for (let i = 0; i < row.length; i += 4) if (px >= row[i] && px <= row[i] + row[i + 1])
        return { t: row[i + 3], m: row[i + 2], x: row[i], box: { x: row[i], y: ri * L.lh, w: row[i + 1], h: L.lh }, small: true };
      return null;
    }

    kick() { if (!this.raf) this.raf = requestAnimationFrame(this._loop); }

    _loop(now) {
      this.raf = 0;
      const animating = this._draw(now);
      if (animating) this.kick();
    }

    _draw(now) {
      const { ctx, W, H, dpr, cur, prev } = this; if (!cur) return false;
      let anim = false;
      const raw = Math.min(1, (now - this.tStart) / this.dur), p = ease(raw);
      if (raw < 1) anim = true;
      this.find += (this.findTarget - this.find) * 0.14;
      if (Math.abs(this.findTarget - this.find) > 0.002) anim = true; else this.find = this.findTarget;
      const dim = 1 - 0.8 * this.find;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      // texture crossfade, with a gentle zoom on the incoming state
      if (prev && raw < 1) {
        ctx.globalAlpha = dim * (1 - p); ctx.drawImage(prev.tex, 0, 0, W, H);
        const s = 1.04 - 0.04 * p;
        ctx.globalAlpha = dim * p; ctx.drawImage(cur.tex, W * (1 - s) / 2, H * (1 - s) / 2, W * s, H * s);
      } else { ctx.globalAlpha = dim; ctx.drawImage(cur.tex, 0, 0, W, H); }

      // featured words tween between states
      ctx.textBaseline = 'alphabetic';
      const prevMap = new Map(); if (prev && raw < 1) prev.featured.forEach(f => prevMap.set(f.t, f));
      const draw = (f, x, y, size, col, a) => {
        if (a <= 0.01) return;
        ctx.globalAlpha = a * (1 - 0.82 * this.find);
        ctx.font = f.font.replace('$', size + 'px');
        ctx.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`;
        ctx.fillText(f.text, x, y);
      };
      for (const f of cur.featured) {
        const o = prevMap.get(f.t);
        if (o) { prevMap.delete(f.t); draw(f, lerp(o.x, f.x, p), lerp(o.y, f.y, p), lerp(o.size, f.size, p), o.col.map((c, i) => lerp(c, f.col[i], p)), 1); }
        else draw(f, f.x, f.y, f.size, f.col, prev && raw < 1 ? p : 1);
      }
      prevMap.forEach(o => draw(o, o.x, o.y, o.size, o.col, 1 - p));

      // hover highlight
      if (this.hover && this.hover.box && !this.hover.mine) {
        const b = this.hover.box; ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1;
        ctx.strokeRect(b.x - 3, b.y - 2, b.w + 6, b.h + 4);
        if (this.hover.small) {
          ctx.font = `700 ${cur.fs * 2.2}px ${TEX_FONT}`; ctx.fillStyle = '#fff';
          ctx.fillText(this.hover.t.toUpperCase(), b.x, b.y - 6);
        }
      }

      // visitor words — larger, in their chosen colour, knocked out of the texture
      for (const u of this.user) {
        const tgt = this.userTarget(u.idx);
        let x = tgt.x, y = tgt.y;
        if (u.from && raw < 1) { x = lerp(u.from.x, tgt.x, p); y = lerp(u.from.y, tgt.y, p); }
        u.pos = { x: tgt.x, y: tgt.y };
        const age = now - u.born; if (age < 0) { anim = true; continue; }
        const land = Math.min(1, age / 900); if (land < 1) anim = true;
        const sc = 1 + 0.35 * Math.pow(1 - land, 3);
        const size = tgt.size * sc;
        ctx.font = `italic 700 ${size}px ${SERIF}`;
        const w = ctx.measureText(u.t).width;
        u.box = { x: x - w / 2, y: y - size * 0.75, w, h: size };
        ctx.globalAlpha = Math.min(1, land * 2);
        ctx.textAlign = 'center'; ctx.lineJoin = 'round';
        if (land < 1) { // landing ring
          ctx.strokeStyle = u.color; ctx.globalAlpha = 1 - land; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(x, y - size * 0.3, w * 0.5 + 60 * land + 10, size * 0.6 + 40 * land, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = Math.min(1, land * 2);
        }
        if (this.find > 0.01) {
          const pulse = 0.5 + 0.5 * Math.sin(now / 260); anim = true;
          ctx.save(); ctx.globalAlpha = this.find * (0.35 + 0.35 * pulse);
          ctx.shadowColor = u.color; ctx.shadowBlur = 40;
          ctx.fillStyle = u.color; ctx.fillRect(x - w / 2 - 12, y - size * 0.82, w + 24, size * 1.12);
          ctx.restore();
          ctx.globalAlpha = this.find;
          ctx.font = `600 11px ${TEX_FONT}`; ctx.fillStyle = '#fff';
          ctx.fillText('YOUR WORD', x, y - size * 0.95);
          ctx.font = `italic 700 ${size}px ${SERIF}`; ctx.globalAlpha = 1;
        }
        ctx.lineWidth = size * 0.22; ctx.strokeStyle = 'rgba(11,7,16,0.92)';
        ctx.strokeText(u.t, x, y);
        ctx.shadowColor = u.color; ctx.shadowBlur = 18;
        ctx.fillStyle = this.find > 0.5 ? '#fff' : u.color; ctx.fillText(u.t, x, y);
        ctx.shadowBlur = 0;
        if (this.hover && this.hover.mine && this.hover.t === u.t) {
          ctx.fillStyle = u.color; ctx.fillRect(x - w / 2, y + size * 0.14, w, 2);
        }
        ctx.textAlign = 'start';
      }
      ctx.globalAlpha = 1;
      return anim;
    }
  }

  window.Portrait = Portrait;
})();
