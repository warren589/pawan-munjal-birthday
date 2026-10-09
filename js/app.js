(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const body = document.body;
  const FACETS = window.FACETS, CODES = FACETS.map(f => f.code);
  const ACCENT = '#a8452c';            // visitor words: one muted vermilion, the only colour that isn't ink
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
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
      : { key: state, code: null, img: S.img, heads: S.heads, ink: S.ink, inks: state === 'final' ? FACETS.map(x => x.ink) : null, words, seed: state === 'hero' ? 11 : 99 });
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
      <section class="sec" data-state="${i}" id="facet-${i}" style="--ink:${f.ink[1]};--ink2:${f.ink[0]}">
        <div class="note fnote">
          <p class="eyebrow"><b>${String(i + 1).padStart(2, '0')}</b> / 07 <span>${f.name}</span></p>
          <h2 class="fline">${f.line}</h2>
          <button class="link js-story" type="button" aria-expanded="false">Read his story</button>
          <div class="story" hidden>${f.story.map(p => `<p>${p}</p>`).join('')}</div>
          ${f.img ? '' : '<p class="pending-photo">Placeholder silhouette · photograph to come</p>'}
        </div>
      </section>`);
    rail.insertAdjacentHTML('beforeend', `<button type="button" data-go="${i}" style="--ink:${f.ink[1]}"><span>${f.name}</span><b>${String(i + 1).padStart(2, '0')}</b></button>`);
  });
  rail.insertAdjacentHTML('beforeend', `<button type="button" data-go="final" style="--ink:#161311"><span>The whole person</span><b>∗</b></button>`);
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
    if (MOBILE.matches) { W = Math.round(vw - 24); H = Math.round(Math.min(vh * 0.58, W * 1.5)); }
    else { W = Math.round(vw * 0.58); H = Math.round(vh - 76); }   // from just under the header to the bottom edge
    dpr = Math.min(2, devicePixelRatio || 1);
    frame.style.width = W + 'px'; frame.style.height = H + 'px';
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
  }
  const layoutFor = s => wp.layout(spec(s), W, H, dpr);

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
        ctx.fillStyle = 'rgba(168,69,44,0.16)';
        const pw = tw * sx + 8;
        ctx.fillRect(x - pw / 2, y - slot.fs * 0.86, pw, slot.fs * 1.15);
      }
      ctx.globalAlpha = alpha; ctx.fillStyle = ACCENT;
      ctx.save(); ctx.translate(x, y); ctx.scale(sx, 1); ctx.textAlign = 'center'; ctx.fillText(slot.text, 0, 0); ctx.restore();
    }
    for (const hv of [hover, picked]) if (hv && hv.state === s && hv.w) {
      const w = hv.w; ctx.globalAlpha = alpha; ctx.fillStyle = w.mine ? ACCENT : '#2a2622';
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
    const on = f && f.anchor && f.img && !MOBILE.matches && !body.classList.contains('composing') && !body.classList.contains('reading-word');
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
    if (b.b !== b.a && b.e > 0 && b.e < 1 && !REDUCED.matches) {
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
    syncState(view.state);
    // the line is only there while a facet is settled; it fades through the crossfade
    placeAnnot(b.a === b.b ? 1 : Math.max(0, 1 - Math.min(b.e, 1 - b.e) * 5));
    if (anim) kick();
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(frameDraw); };
  addEventListener('scroll', kick, { passive: true });

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
  let warmGen = 0;
  function warm() {
    const gen = ++warmGen, q = STATES.slice(), idle = window.requestIdleCallback || (cb => setTimeout(cb, 40));
    const step = () => { if (gen !== warmGen || !q.length) return; layoutFor(q.shift()); idle(step, { timeout: 300 }); };
    idle(step, { timeout: 300 });
  }
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { const ow = W, oh = H; geometry(); if (W !== ow || H !== oh) warm(); kick(); }, 150); });

  // ---------------- hover loupe + tap to read ----------------
  const local = e => { const r = cv.getBoundingClientRect(), L = layoutFor(view.state); return [(e.clientX - r.left) * W / r.width - L.ox, (e.clientY - r.top) * H / r.height - L.oy]; };
  function wordAt(x, y, pad) {
    const s = view.state, L = layoutFor(s);
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
      loupe.textContent = w.t; loupe.classList.toggle('mine', !!w.mine);
      const L = layoutFor(view.state);
      loupe.style.transform = `translate(${L.ox + w.x + w.w / 2}px, ${L.oy + w.y - 8}px)`;
      loupe.classList.add('on');
    } else loupe.classList.remove('on');
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
    body.classList.remove('reading-word'); picked = null; lead.classList.remove('on'); annotFor = null; kick();
  }
  function placeLead() {
    if (!picked || !body.classList.contains('reading-word')) return;
    const L = layoutFor(picked.state), r = cv.getBoundingClientRect(), sc = r.width / W, w = picked.w;
    const x1 = r.left + (L.ox + w.x + w.w) * sc + 4, y1 = r.top + (L.oy + w.y + w.h * 0.6) * sc;
    const rr = reader.getBoundingClientRect(), x2 = rr.left - 18, y2 = rr.top + 64;
    lead.setAttribute('d', `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`);
  }
  addEventListener('scroll', () => { if (body.classList.contains('reading-word') && view.state !== (picked && picked.state)) closeReader(); else placeLead(); }, { passive: true });
  addEventListener('resize', placeLead);
  function readerHTML(word, mi) {
    const m = messages[mi] || messages[0], codes = m.mine ? [...m.facets] : facetsOf(word);
    const rel = messages.map((x, i) => i).filter(i => i !== mi && !messages[i].mine && messages[i].words.includes(word)).slice(0, 3);
    const re = new RegExp(`\\b(${[...ALIAS].filter(([, v]) => v === word).map(([k]) => k).join('|')})\\w*`, 'gi');
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
        if (inHere) {
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
    renderLetters(); board.added();
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

  // ---------------- letters: every message in one continuous column ----------------
  const lettersBody = $('.letters__body'), filters = $('.letters .filters'), search = $('.letters .search input');
  let lq = '';
  function marked(m) {
    const ex = extract(m.text), spans = [];
    ex.found.forEach((f, w) => { if (m.words.includes(w)) f.spans.forEach(sp => spans.push([...sp, w])); });
    spans.sort((a, b) => a[0] - b[0]);
    let out = '', at = 0;
    spans.forEach(([a, b, w]) => {
      if (a < at) return; const ink = FACETS[CODES.indexOf(facetsOf(w)[0])].ink[0];
      out += esc(m.text.slice(at, a)) + `<u style="--u:${ink}">${esc(m.text.slice(a, b))}</u>`; at = b;
    });
    return out + esc(m.text.slice(at));
  }
  // Long letters, found before they are read: each row leads with the letter's most telling sentence (the one with the
  // most portrait words, since openings are often generic), signed with name, relationship, facet marks and reading time.
  // Every eighth row is set as a larger pull quote, so the list reads like a page rather than an inbox.
  const GROUPS = window.LETTER_GROUPS, COUNTS = window.LETTER_COUNTS;
  const letters = window.LETTERS.map(l => {
    const text = l.paras.join(' '), ex = extract(text);
    const sentences = l.paras.flatMap(p => p.replace(/\b(Mr|Mrs|Ms|Dr|St)\./g, '$1\u2024').match(/[^.!?]+[.!?]+[”"’]?/g) || [p]).map(t => t.trim().replace(/\u2024/g, '.'));   // titles like “Mr.” don't end a sentence
    const score = t => extract(t).words.length * 10 - Math.max(0, t.length - 150) * 0.4 - (/^(dear|respected|papa|pawan)\b/i.test(t) ? 25 : 0) - (/\b(birthday|wishing|wishes|happy)\b/i.test(t) ? 40 : 0) - (t.length < 40 ? 30 : 0);
    const lead = sentences.slice().sort((x, y) => score(y) - score(x))[0];
    const words = text.split(/\s+/).length;
    return { ...l, text, lead, facets: [...new Set(ex.words.flatMap(w => facetsOf(w, ex.fallback)))].slice(0, 3), mins: Math.max(1, Math.round(words / 200)) };
  });
  let lg = 'all', lshown = 12;
  const dots = codes => codes.map(c => `<i style="--c:${FACETS[CODES.indexOf(c)].ink[0]}" title="${FACETS[CODES.indexOf(c)].name}"></i>`).join('');
  function letterHTML(l, i, featured) {
    const full = l.paras ? l.paras.map(p => `<p>${marked({ text: p, words: extract(p).words })}</p>`).join('') : `<p>${marked(l)}</p>`;
    return `<article class="lrow${featured ? ' feat' : ''}${l.mine ? ' mine' : ''}" data-i="${i}">
      <button class="lrow__q" type="button" aria-expanded="false"><span class="lrow__lead">“${esc(l.lead)}”</span></button>
      <div class="lrow__full" hidden><p class="lrow__to">Dear Dr. Munjal,</p>${full}</div>
      <footer class="lrow__sig"><b>${esc(l.name || 'Anonymous')}</b><span>${esc(l.rel || '')}</span>
        ${l.mine ? '<em>Your letter · pending approval</em>' : ''}<span class="lrow__meta"><span class="lrow__dots">${dots(l.facets)}</span>${l.mins} min read</span>
        <span class="lrow__go">Read the letter →</span></footer>
    </article>`;
  }
  function renderLetters() {
    const q = lq.toLowerCase();
    // your own message comes first, then the letters
    const mine = messages.filter(m => m.mine).reverse().map(m => ({ name: m.name, rel: m.rel, cat: 'mine', mine: true, text: m.text, words: m.words, lead: m.text, facets: [...m.facets].slice(0, 3), mins: 1 }));
    const all = [...mine, ...letters];
    const list = all.filter(l => (lg === 'all' || l.cat === lg || l.mine) && (!q || (l.text + ' ' + (l.name || '') + ' ' + (l.rel || '')).toLowerCase().includes(q)));
    let n = 0;
    lettersBody.innerHTML = list.slice(0, lshown).map((l, k) => { const feat = !l.mine && (++n % 8 === 0); return letterHTML(l, all.indexOf(l), feat); }).join('');
    lettersBody._list = all;
    $('.letters__empty').hidden = list.length > 0;
    $('.js-more').hidden = list.length <= lshown;
    const total = Object.values(COUNTS).reduce((a, b) => a + b, 0);
    filters.innerHTML = [['all', 'All', total], ...GROUPS.map(([c, l]) => [c, l, COUNTS[c]])].map(([c, l, k]) =>
      `<button type="button" data-f="${c}" aria-pressed="${lg === c}">${l} <span>${k.toLocaleString('en-IN')}</span></button>`).join('');
  }
  // a row opens in place (the pinned close bar and links from the voices come next)
  lettersBody.addEventListener('click', e => {
    const b = e.target.closest('.lrow__q, .lrow__go'); if (!b) return;
    const lrow = b.closest('.lrow'), full = lrow.querySelector('.lrow__full'), open = full.hidden;
    full.hidden = !open; lrow.classList.toggle('open', open); lrow.querySelector('.lrow__q').setAttribute('aria-expanded', open);
    lrow.querySelector('.lrow__go').textContent = open ? 'Close' : 'Read the letter →';
  });
  filters.addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { lg = b.dataset.f; lshown = 12; renderLetters(); } });
  search.addEventListener('input', () => { lq = search.value.trim(); lshown = 12; renderLetters(); });
  $('.js-more').addEventListener('click', () => { lshown += 12; renderLetters(); });
  // more letters arrive as you reach the end of the list
  new IntersectionObserver(es => { if (es[0].isIntersecting && !$('.js-more').hidden) { lshown += 12; renderLetters(); } }, { rootMargin: '400px' }).observe($('.js-more'));
  renderLetters();
  new IntersectionObserver(es => es.forEach(e => body.classList.toggle('on-letters', e.isIntersecting)), { rootMargin: '-40% 0px 0px 0px' }).observe($('.letters'));

  // ---------------- the messages: one voice emerging from thousands ----------------
  // A sticky stage over a quiet fabric of words, set like the portraits. Scrolling brings a few voices forward: each
  // one's words light up in the fabric in their facet's ink, and the message grows out of one of them. Then the view
  // pulls back, the fabric opens up, and the list of every message follows.
  const board = (() => {
    const sec = $('.voices'), stage = $('.voices__stage'), fab = $('.voices__fabric'), fbx = fab.getContext('2d'), lit = $('.voices__lit'), ltx = lit.getContext('2d');
    const stack = $('.voices__stack'), nEl = $('.voices__n'), bar = $('.voices__bar');
    const SEG = 0.9, LEAD = 0.25;            // viewport heights of scroll per voice; a little scroll before the first one changes
    const PICK = [0, 4, 12, 5];              // four voices: a colleague, family, the shop floor, a partner abroad
    let seq = [], els = [], active = -1, timers = [], built = false, open = -1;
    let words = [], SW = 0, SH = 0, D = 1, glow = new Map(), raf = 0;   // fabric words, and how lit each one is (0–1)
    const pad = n => String(n).padStart(2, '0');
    const clip = (t, max) => { if (t.length <= max) return t; const c = t.slice(0, max); return c.slice(0, c.lastIndexOf(' ')).replace(/[,.;:—-]+$/, '') + '…'; };
    const sequence = () => [...messages.map((m, i) => i).filter(i => messages[i].mine).reverse(), ...PICK.filter(i => i < messages.length)];

    // ---- the fabric: rows of small capitals, the portraits' own texture, very faint ----
    function buildFabric() {
      const r = stage.getBoundingClientRect(); SW = r.width; SH = r.height; D = Math.min(2, devicePixelRatio || 1);
      for (const c of [fab, lit]) { c.width = Math.round(SW * D); c.height = Math.round(SH * D); }
      const mob = MOBILE.matches, fs = mob ? 7.6 : 9.2, lh = fs * 1.42, R = seeded(23), font = `600 ${fs}px ${window.WP_FONT}`;
      const pool = []; messages.forEach(m => m.words.forEach(w => pool.push(w.toUpperCase()))); VOCAB.forEach(v => pool.push(v.w.toUpperCase()));
      fbx.setTransform(D, 0, 0, D, 0, 0); fbx.clearRect(0, 0, SW, SH); fbx.font = font; fbx.fillStyle = '#1d1a17'; fbx.textBaseline = 'alphabetic';
      if ('letterSpacing' in fbx) fbx.letterSpacing = '0.4px';
      words = [];
      for (let y = lh; y < SH + lh; y += lh) {
        let x = -R() * 60;
        while (x < SW) { const t = pool[(R() * pool.length) | 0], w = fbx.measureText(t).width; words.push({ t, x, y, w, fs, a: 0.055 + R() * 0.045 }); x += w + fs * 0.55; }
      }
      ltx.setTransform(D, 0, 0, D, 0, 0); ltx.font = font; if ('letterSpacing' in ltx) ltx.letterSpacing = '0.4px';
      glow = new Map(); drawFabric();
    }
    // ---- nothing in the fabric may sit under foreground text: words touching any line of it are left out ----
    const intro = $('.voices__intro'), meta = $('.voices__meta'), outro = $('.voices__outro');
    let voiceRel = [], prevRel = null, blocked = new Set(), redrawT = 0;
    function textRects(el) {
      const out = [], tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), rg = document.createRange(); let n;
      while ((n = tw.nextNode())) { if (!n.textContent.trim()) continue; rg.selectNodeContents(n); for (const r of rg.getClientRects()) if (r.width > 0) out.push(r); }
      return out;
    }
    // the voice's lines are measured once, untransformed, relative to the centre of its stack (it is centred there)
    function captureVoice(el) {
      const s = stack.getBoundingClientRect(), cx = s.left + s.width / 2, cy = s.top + s.height / 2;
      if (voiceRel.length) { prevRel = voiceRel; clearTimeout(prevRel.t); prevRel.t = setTimeout(() => { prevRel = null; drawFabric(); }, 950); }   // the outgoing voice still fades
      voiceRel = textRects(el).map(r => [r.left - cx, r.top - cy, r.right - cx, r.bottom - cy]);
    }
    function fgRects() {
      const sr = stage.getBoundingClientRect(), out = [], add = r => out.push([r.left - sr.left, r.top - sr.top, r.right - sr.left, r.bottom - sr.top]);
      const pulled = sec.classList.contains('pulled');
      if (!sec.classList.contains('reading') || intro.dataset.fading) textRects(intro).forEach(add);
      if (!pulled) {
        textRects(meta).forEach(add);
        const s = stack.getBoundingClientRect(), cx = s.left + s.width / 2 - sr.left, cy = s.top + s.height / 2 - sr.top;
        [voiceRel, prevRel || []].forEach(rs => rs.forEach(([a, b, c, d]) => out.push([a + cx, b + cy, c + cx, d + cy])));
      } else textRects(outro).forEach(add);
      return out;
    }
    function drawFabric() {
      if (!words.length) return;
      const rs = fgRects(), pad = 5;
      blocked = new Set(words.filter(w => { const x0 = w.x - pad, x1 = w.x + w.w + pad, y0 = w.y - w.fs * 0.8 - pad, y1 = w.y + w.fs * 0.15 + pad; return rs.some(r => x0 < r[2] && x1 > r[0] && y0 < r[3] && y1 > r[1]); }));
      fbx.clearRect(0, 0, SW, SH);
      for (const w of words) { if (blocked.has(w)) continue; fbx.globalAlpha = w.a; fbx.fillText(w.t, w.x, w.y); }
      fbx.globalAlpha = 1; paintLit();
    }
    const redrawSoon = (ms) => { clearTimeout(redrawT); redrawT = setTimeout(drawFabric, ms); };
    // the clear zone around the voice: words there never light up, and a soft veil keeps the fabric back from it
    const inZone = w => { const mob = MOBILE.matches, cx = SW / 2, cy = SH * 0.52, rx = SW * (mob ? 0.6 : 0.36), ry = SH * (mob ? 0.34 : 0.33); return ((w.x + w.w / 2 - cx) / rx) ** 2 + ((w.y - cy) / ry) ** 2 < 1; };
    // the instances of a message's words that light up: a few of each, away from the voice and the screen edges
    function litFor(mi) {
      const out = [], want = new Set(messages[mi].words.map(w => w.toUpperCase())), per = new Map(), R = seeded(mi * 13 + 5);
      const cand = words.filter(w => want.has(w.t) && !inZone(w) && w.x > 12 && w.x + w.w < SW - 12 && w.y > 80 && w.y < SH - 50);
      for (let i = cand.length - 1; i > 0; i--) { const j = (R() * (i + 1)) | 0; [cand[i], cand[j]] = [cand[j], cand[i]]; }
      for (const w of cand) { const n = per.get(w.t) || 0; if (n < 2) { per.set(w.t, n + 1); out.push(w); } }
      return out;
    }
    const inkOf = t => { const f = FACETS[CODES.indexOf(facetsOf(t.toLowerCase())[0])]; return f ? f.ink[0] : ACCENT; };
    function paintLit() {
      ltx.clearRect(0, 0, SW, SH);
      glow.forEach((g, w) => { if (g.v < 0.01 || blocked.has(w)) return; ltx.globalAlpha = g.v * 0.9; ltx.fillStyle = inkOf(w.t); ltx.fillText(w.t, w.x, w.y); });
      ltx.globalAlpha = 1;
    }
    // light a new set of words (and let the rest fade) over ~0.7s
    function lightUp(set) {
      const on = new Set(set);
      words.forEach(w => { if (on.has(w) && !glow.has(w)) glow.set(w, { v: 0, to: 1 }); });
      glow.forEach((g, w) => { g.to = on.has(w) ? 1 : 0; });
      cancelAnimationFrame(raf);
      const step = () => {
        let busy = false;
        glow.forEach((g, w) => { const d = g.to - g.v; if (Math.abs(d) > 0.01) { g.v += d * 0.12; busy = true; } else { g.v = g.to; if (!g.to) glow.delete(w); } });
        paintLit(); if (busy) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }

    // ---- the voices: a shortened version, and the full letter that opens in place ----
    function buildVoices() {
      const max = MOBILE.matches ? 120 : 150;
      stack.innerHTML = seq.map((mi, k) => {
        const m = messages[mi], t = clip(m.text, max), cut = t !== m.text, codes = [...m.facets];
        return `<figure class="voice" data-k="${k}">
          <button class="voice__q" type="button" aria-expanded="false"><blockquote><span class="short">“${esc(t)}”</span><span class="full">“${marked(m)}”</span></blockquote></button>
          <figcaption><cite>${esc(m.name || 'Anonymous')}<span>${esc(m.rel || '')}${m.mine ? ' · <em>Pending approval, visible only to you</em>' : ''}</span></cite>
            <p class="voice__facets">${codes.map(c => FACETS[CODES.indexOf(c)].name).join(' · ')}</p>
            <button class="link voice__open" type="button">${cut ? 'Read the full letter' : 'Read the letter'}</button></figcaption></figure>`;
      }).join('');
      els = $$('.voice', stack);
    }
    function setOpen(k) {
      if (open >= 0 && els[open]) { els[open].classList.remove('open'); els[open].querySelector('.voice__q').setAttribute('aria-expanded', 'false'); els[open].querySelector('.voice__open').textContent = els[open].dataset.label; }
      open = k;
      if (k >= 0) { const e = els[k], b = e.querySelector('.voice__open'); e.dataset.label = b.textContent; e.classList.add('open'); e.querySelector('.voice__q').setAttribute('aria-expanded', 'true'); b.textContent = 'Close'; }
      const e = els[k >= 0 ? k : active]; if (e && words.length) { prevRel = null; voiceRel = []; captureVoice(e); drawFabric(); }
    }
    stack.addEventListener('click', e => {
      const v = e.target.closest('.voice.on'); if (!v || !e.target.closest('.voice__q, .voice__open')) return;
      const k = +v.dataset.k; setOpen(open === k ? -1 : k);
    });

    // ---- one voice emerging: its words light up around the edges, then it grows out of one of them ----
    function activate(k) {
      if (k === active) return;
      timers.forEach(clearTimeout); timers = []; setOpen(-1);
      active = k;
      els.forEach((e, j) => { if (j !== k && e.classList.contains('on')) { e.classList.remove('on', 'sign'); e.classList.add('out'); timers.push(setTimeout(() => e.classList.remove('out'), 900)); } });
      nEl.textContent = pad(k + 1); bar.style.setProperty('--p', (k + 1) / seq.length);
      const el = els[k]; if (!el) return;
      const set = litFor(seq[k]); lightUp(set);
      // grow out of the lit word nearest the centre, so the trip is short and readable
      const src = set.slice().sort((a, b) => Math.hypot(a.x - SW / 2, a.y - SH / 2) - Math.hypot(b.x - SW / 2, b.y - SH / 2))[0];
      if (src && !REDUCED.matches) {
        el.classList.remove('out'); el.style.transition = 'none'; el.style.transform = ''; el.style.opacity = '0';
        captureVoice(el); drawFabric();
        const sr = stage.getBoundingClientRect(), b = el.querySelector('blockquote').getBoundingClientRect(), e = el.getBoundingClientRect();
        const s = Math.max(0.06, Math.min(0.25, src.w / b.width));
        el.style.transform = `translate(${sr.left + src.x + src.w / 2 - (e.left + e.width / 2)}px, ${sr.top + src.y - (b.top + b.height / 2)}px) scale(${s})`;
        void el.offsetWidth;
        timers.push(setTimeout(() => {   // a moment for the lit words to catch the eye, then the voice grows into the centre
          el.style.transition = ''; el.style.transform = ''; el.style.opacity = ''; el.classList.add('on');
          timers.push(setTimeout(() => el.classList.add('sign'), 650));
        }, 320));
      } else { el.classList.add('on'); captureVoice(el); drawFabric(); timers.push(setTimeout(() => el.classList.add('sign'), REDUCED.matches ? 0 : 400)); }
    }

    // ---- scroll drives everything ----
    function size() { sec.style.height = Math.round(innerHeight * (LEAD + seq.length * SEG + 1.4) + innerHeight) + 'px'; }
    let wasPulled = false;
    function onScroll() {
      const r = sec.getBoundingClientRect(), vh = innerHeight;
      body.classList.toggle('on-board', r.top < vh * 0.85 && r.bottom > vh * 0.15);
      const covered = r.top <= 0; if (covered !== body.classList.contains('stage-covered')) { body.classList.toggle('stage-covered', covered); if (!covered) kick(); }
      const u = -r.top / vh, n = seq.length;
      const reading = u > LEAD * 0.6;
      if (reading !== sec.classList.contains('reading')) {
        sec.classList.toggle('reading', reading);
        if (reading) { intro.dataset.fading = 1; setTimeout(() => { delete intro.dataset.fading; drawFabric(); }, 850); }
        drawFabric();
      }
      const pulled = u > LEAD + n * SEG + 0.1;
      sec.classList.toggle('pulled', pulled);
      if (pulled !== wasPulled) {
        wasPulled = pulled; drawFabric(); redrawSoon(1450);
        // in the pull-back every voice's words light up together: they all belong to the same fabric
        if (pulled) { setOpen(-1); lightUp(seq.flatMap(mi => litFor(mi))); } else { active = -1; }
      }
      if (!pulled) activate(Math.max(0, Math.min(n - 1, Math.floor((u - LEAD) / SEG))));
    }
    function build() { seq = sequence(); size(); buildVoices(); buildFabric(); built = true; active = -1; wasPulled = false; onScroll(); }
    // built straight away, so the section has its full height before anyone scrolls near it
    stack.addEventListener('transitionend', e => { if (e.target === stack) drawFabric(); });
    build();
    document.fonts.ready.then(() => { buildFabric(); const k = active; active = -1; if (k >= 0) activate(k); });
    addEventListener('scroll', onScroll, { passive: true });
    let rt = 0; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { size(); buildFabric(); const k = active; active = -1; els.forEach(e => e.classList.remove('on', 'sign', 'out')); if (k >= 0) activate(k); }, 200); });
    // a newly written message becomes the first voice
    function added() { if (built) build(); }
    return { added };
  })();

  // ---------------- boot ----------------
  (async function boot() {
    await Promise.race([Promise.all([document.fonts.load('400 20px "Archivo Narrow"'), document.fonts.load('700 20px "Archivo Narrow"')]).catch(() => {}),
      new Promise(r => setTimeout(r, 2500))]);
    await wp.init(window.PORTRAITS);
    geometry();
    layoutFor(blend().a);
    ready = true; body.classList.add('ready'); kick();
    setTimeout(warm, 300);
  })();
})();
