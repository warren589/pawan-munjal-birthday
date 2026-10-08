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
  const messages = [...window.SAMPLE_MESSAGES, ...(window.CROWD_MESSAGES || [])].map(s => {
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
    messages.forEach((m, i) => { if (!m.crowd && (!code || m.facets.has(code))) m.words.forEach(w => { for (let k = 0; k < 3; k++) words.push({ t: w, m: i }); }); });
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
    raf = 0; if (!ready) return;
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
  let lf = 'all', lq = '', shown = 10;
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
  function renderLetters() {
    const q = lq.toLowerCase();
    const rank = m => m.mine ? 0 : m.crowd ? 2 : 1;
    const list = messages.map((m, i) => ({ m, i })).reverse().sort((a, b) => rank(a.m) - rank(b.m)).filter(({ m }) =>
      (lf === 'all' || m.facets.has(lf)) && (!q || (m.text + ' ' + (m.name || '') + ' ' + (m.rel || '')).toLowerCase().includes(q)));
    lettersBody.innerHTML = list.slice(0, shown).map(({ m }) => `
      <article class="letter${m.mine ? ' mine' : ''}">
        <p>“${marked(m)}”</p>
        <footer><b>${esc(m.name || 'Anonymous')}</b>${m.rel ? ` · ${esc(m.rel)}` : ''}${m.mine ? ' <em>Pending approval · visible only to you</em>' : ''}</footer>
      </article>`).join('');
    $('.letters__empty').hidden = list.length > 0;
    $('.js-more').hidden = list.length <= shown;
    filters.innerHTML = [['all', 'All'], ...FACETS.map(f => [f.code, f.short])].map(([c, l]) =>
      `<button type="button" data-f="${c}" aria-pressed="${lf === c}">${l}</button>`).join('');
  }
  filters.addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { lf = b.dataset.f; shown = 10; renderLetters(); } });
  search.addEventListener('input', () => { lq = search.value.trim(); shown = 10; renderLetters(); });
  $('.js-more').addEventListener('click', () => { shown += 10; renderLetters(); });
  renderLetters();
  new IntersectionObserver(es => es.forEach(e => body.classList.toggle('on-letters', e.isIntersecting)), { rootMargin: '-40% 0px 0px 0px' }).observe($('.letters'));

  // ---------------- message board: letters to him, in layers, one brought forward ----------------
  const board = (() => {
    const sec = $('.board'), stage = $('.board__stage'), fc = $('.field'), fx = fc.getContext('2d'), hc = $('.field-hi'), hx = hc.getContext('2d');
    const card = $('.feature'), fbody = $('.feature__body'), nEl = $('.board__n'), lead = $('.board__lead'), lpath = $('.board__lead path'), ldot = $('.board__lead circle');
    const sPanel = $('.board__search'), sInput = sPanel.querySelector('input'), sFilters = sPanel.querySelector('.filters'), playBtn = $('.js-play'), sBtn = $('.js-bsearch');
    const INK = '#1d1a17', MUTED = '#8a8279', CARD = '#faf7f1', TO = 'Dear Dr. Munjal,';
    let SW = 0, SH = 0, D = 1, layers = null, byI = new Map(), building = null;
    let viewY = 0, drift = 0, reveal = 0, raf = 0;
    let mode = 'field', auto = false, cur = -1, pos = 0, hover = null, q = '', qf = 'all', matches = null, list = [], timer = null, inView = false, paused = false;
    let shuffled = null;
    function fieldOrder() {
      if (!shuffled) { const R = seeded(77); shuffled = messages.map((m, i) => i).filter(i => !messages[i].mine); for (let i = shuffled.length - 1; i > 0; i--) { const j = (R() * (i + 1)) | 0; [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; } }
      return [...messages.map((m, i) => i).filter(i => messages[i].mine).reverse(), ...shuffled];
    }
    // reading order: yours, then the hand-picked messages, then everyone else
    function readOrder() {
      const f = fieldOrder(), rank = i => messages[i].mine ? 0 : messages[i].crowd ? 2 : 1;
      return f.map((i, k) => [i, k]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(a => a[0]);
    }

    // ---- layout: three layers of letter cards. Large ones in front around the title, smaller and fainter behind,
    // running off the edges, so the wall reads as thousands of letters rather than one block of text ----
    const SPEC = () => MOBILE.matches
      ? [{ w: 92, fs: 5.8, lines: 3, a: 0.36, gap: 10, keep: 1, depth: 14 },
         { w: 120, fs: 7.2, lines: 3, a: 0.66, gap: 20, keep: 0.34, depth: 34, sign: true },
         { w: 158, fs: 9.2, lines: 4, a: 1, depth: 60, sign: true, rel: true, spots: [[0.27, 0.2], [0.75, 0.25], [0.24, 0.8], [0.74, 0.86]] }]
      : [{ w: 118, fs: 6.8, lines: 3, a: 0.34, gap: 16, keep: 1, depth: 18 },
         { w: 152, fs: 8.4, lines: 3, a: 0.66, gap: 30, keep: 0.34, depth: 44, sign: true },
         { w: 200, fs: 10.4, lines: 4, a: 1, depth: 80, sign: true, rel: true,
           spots: [[0.11, 0.23], [0.33, 0.15], [0.66, 0.16], [0.88, 0.24], [0.09, 0.55], [0.91, 0.56], [0.13, 0.85], [0.37, 0.84], [0.63, 0.85], [0.87, 0.86]] }];
    const MARGIN = 90;   // each layer is drawn taller than the screen, so it can drift without showing an edge
    function measureCard(m, L) {
      const fs = L.fs, lh = fs * 1.42, pad = fs * 1.15, inner = L.w - pad * 2;
      fx.font = `400 ${fs}px Newsreader`;
      const words = m.text.split(/\s+/), lines = []; let ln = '';
      for (const w of words) {
        const t = ln ? ln + ' ' + w : w;
        if (fx.measureText(t).width > inner && ln) { lines.push(ln); ln = w; if (lines.length === L.lines) break; } else ln = t;
      }
      if (lines.length < L.lines && ln) lines.push(ln);
      const full = lines.join(' ').length >= m.text.length - 1;
      if (!full) { let last = lines[lines.length - 1]; while (last.length && fx.measureText(last + '…').width > inner) last = last.replace(/\s*\S+$/, ''); lines[lines.length - 1] = last.replace(/[,.;:]$/, '') + '…'; }
      const h = pad * 2 + lh * (1.25 + lines.length) + (L.sign ? lh * 1.15 : 0) + (L.rel ? lh * 0.85 : 0);
      return { lines, h, lh, pad };
    }
    function layout() {
      const r = stage.getBoundingClientRect(); SW = r.width; SH = r.height; D = Math.min(2, devicePixelRatio || 1);
      for (const c of [fc, hc]) { c.width = Math.round(SW * D); c.height = Math.round(SH * D); }
      const spec = SPEC(), order = readOrder(), R = seeded(5); let k = 0;
      const hdr = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hdr'));
      byI = new Map();
      layers = spec.slice().reverse().map(L => {   // fill front first, so it gets yours and the hand-picked messages
        const cards = [];
        const add = (x, y) => { if (k >= order.length) return null; const i = order[k++], m = messages[i], mc = measureCard(m, L), c = { i, m, x, y, w: L.w, ...mc, L }; cards.push(c); byI.set(i, c); return c; };
        if (L.spots) {
          for (const [u, v] of L.spots) { const c = add(0, 0); if (!c) break; c.x = u * SW - L.w / 2 + (R() - 0.5) * 24; c.y = Math.max(hdr + 8, v * SH - c.h / 2 + (R() - 0.5) * 20); }
        } else {
          // loose masonry: columns that start at staggered heights and bleed past every edge
          const cols = Math.ceil((SW + L.gap) / (L.w + L.gap)) + 1, x0 = -L.w * 0.35 - R() * L.gap;
          for (let c = 0; c < cols; c++) {
            let y = -MARGIN - R() * 120;
            while (y < SH + MARGIN) {
              const x = x0 + c * (L.w + L.gap) + (R() - 0.5) * L.gap * 0.6;
              if (R() < L.keep) { const cd = add(x, y); if (!cd) break; y += cd.h + L.gap; } else y += L.w * 0.55 + L.gap;
            }
          }
        }
        return { L, cards, canvas: null };
      }).reverse();
      layers.forEach(renderLayer);
      paint();
    }
    function rr(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
    function drawCard(ctx, c, a, hi) {
      const { L } = c, fs = L.fs, x = c.x, y = c.y, front = !!L.spots;
      ctx.globalAlpha = a;
      ctx.shadowColor = `rgba(29,26,23,${hi ? 0.16 : front ? 0.09 : 0.06})`; ctx.shadowBlur = (hi ? 26 : front ? 18 : 8) * D; ctx.shadowOffsetY = (hi ? 10 : front ? 6 : 2) * D;
      ctx.fillStyle = CARD; rr(ctx, x, y, c.w, c.h, fs * 0.45); ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.lineWidth = hi === 'accent' ? 1.2 : 0.6; ctx.strokeStyle = hi === 'accent' ? ACCENT : 'rgba(29,26,23,.1)'; ctx.stroke();
      // a small mark in the facet's ink, like a postage stamp
      const code = [...c.m.facets][0], f = FACETS[CODES.indexOf(code)];
      if (f) { ctx.fillStyle = f.ink[0]; ctx.beginPath(); ctx.arc(x + c.w - c.pad - fs * 0.3, y + c.pad + fs * 0.35, fs * 0.3, 0, Math.PI * 2); ctx.fill(); }
      let ty = y + c.pad + fs * 0.95;
      ctx.textBaseline = 'alphabetic';
      ctx.font = `italic 400 ${fs}px Newsreader`; ctx.fillStyle = MUTED; ctx.fillText(TO, x + c.pad, ty);
      ty += c.lh * 1.25;
      ctx.font = `400 ${fs}px Newsreader`; ctx.fillStyle = INK;
      for (const t of c.lines) { ctx.fillText(t, x + c.pad, ty); ty += c.lh; }
      if (L.sign) {
        ty += c.lh * 0.15;
        ctx.font = `500 ${(fs * 0.74).toFixed(2)}px Archivo`; ctx.fillStyle = INK;
        if ('letterSpacing' in ctx) ctx.letterSpacing = `${(fs * 0.08).toFixed(2)}px`;
        ctx.fillText('— ' + (c.m.name || 'Anonymous').toUpperCase(), x + c.pad, ty);
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
        if (L.rel && c.m.rel) { ty += c.lh * 0.85; ctx.font = `400 ${(fs * 0.74).toFixed(2)}px Archivo`; ctx.fillStyle = MUTED; ctx.fillText(c.m.rel, x + c.pad, ty); }
      }
      ctx.globalAlpha = 1;
    }
    function renderLayer(ly) {
      const c = ly.canvas || (ly.canvas = document.createElement('canvas'));
      c.width = Math.round(SW * D); c.height = Math.round((SH + MARGIN * 2) * D);
      const x = c.getContext('2d'); x.setTransform(D, 0, 0, D, 0, MARGIN * D);
      for (const cd of ly.cards) drawCard(x, cd, matches && !matches.has(cd.i) ? 0.18 : 1);
      // farther layers are washed towards the paper rather than made see-through, so cards overlap like a real stack
      if (ly.L.a < 1) { x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-atop'; x.globalAlpha = 1 - ly.L.a; x.fillStyle = '#f3eee6'; x.fillRect(0, 0, c.width, c.height); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; }
    }
    // where a layer sits right now: its drift with the scroll, the reveal, and (on a phone) the slide that keeps
    // the featured letter above the panel
    const layerY = (n, ly) => viewY + drift * ly.L.depth + (1 - easeOut(Math.min(1, Math.max(0, reveal * 1.6 - n * 0.3)))) * 14 * (n + 1);
    const layerA = n => Math.min(1, Math.max(0, reveal * 1.6 - n * 0.3));
    const easeOut = t => 1 - Math.pow(1 - t, 3);
    function paint() {
      if (!layers) return;
      fx.setTransform(1, 0, 0, 1, 0, 0); fx.clearRect(0, 0, fc.width, fc.height);
      layers.forEach((ly, n) => { const a = layerA(n); if (a > 0.003) { fx.globalAlpha = a; fx.drawImage(ly.canvas, 0, Math.round((layerY(n, ly) - MARGIN) * D)); } });
      fx.globalAlpha = 1;
      // lifted letters (hovered, or the one being read) sit on their own layer, so they stay clear when the wall dims
      hx.setTransform(1, 0, 0, 1, 0, 0); hx.clearRect(0, 0, hc.width, hc.height);
      const lift = (i, kind) => { const c = byI.get(i); if (!c) return; const n = layers.findIndex(l => l.cards.includes(c)); hx.setTransform(D, 0, 0, D, 0, (layerY(n, layers[n]) - (kind === 'hover' ? 3 : 0)) * D); drawCard(hx, c, 1, kind === 'feature' ? 'accent' : true); };
      if (hover != null && hover !== cur) lift(hover, 'hover');
      if (mode === 'feature' && cur >= 0) lift(cur, 'feature');
      placeLead();
    }
    function screenRect(c) { const n = layers.findIndex(l => l.cards.includes(c)); const y = c.y + layerY(n, layers[n]); return { x: c.x, y, w: c.w, h: c.h }; }
    const hit = (px, py) => {
      if (!layers) return null;
      for (let n = layers.length - 1; n >= 0; n--) for (const c of layers[n].cards) {
        const r = screenRect(c); if (px > r.x && px < r.x + r.w && py > r.y && py < r.y + r.h) return c.i;
      }
      return null;
    };
    function slideTo(y, dur = 700) {
      cancelAnimationFrame(raf);
      const from = viewY, t0 = performance.now(), d = REDUCED.matches ? 1 : dur, ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const stepf = now => { const k = Math.min(1, (now - t0) / d); viewY = from + (y - from) * ease(k); paint(); if (k < 1) raf = requestAnimationFrame(stepf); };
      raf = requestAnimationFrame(stepf);
    }
    function setMode(m) { mode = m; sec.classList.toggle('featuring', m === 'feature'); }

    // ---- the letter brought forward ----
    function placeLead() {
      const c = mode === 'feature' && layers && byI.get(cur);
      if (!c || MOBILE.matches) { lead.classList.remove('on'); return; }
      const sr = stage.getBoundingClientRect(), cr = card.getBoundingClientRect(), r = screenRect(c);
      const l = cr.left - sr.left - 18, rt = cr.right - sr.left + 18, t = cr.top - sr.top - 18, b = cr.bottom - sr.top + 18;
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      if (cx > l && cx < rt && cy > t && cy < b) { lead.classList.remove('on'); return; }   // it sits behind the letter
      // from the edge of the letter being read to the nearest edge of its card on the wall
      let ax, ay, tx, ty;
      if (r.x + r.w < l) { ax = l; tx = r.x + r.w; ty = cy; ay = Math.max(t + 30, Math.min(b - 30, cy)); }
      else if (r.x > rt) { ax = rt; tx = r.x; ty = cy; ay = Math.max(t + 30, Math.min(b - 30, cy)); }
      else { tx = cx; ty = cy < t ? r.y + r.h : r.y; ax = Math.max(l + 40, Math.min(rt - 40, cx)); ay = cy < t ? t : b; }
      const horiz = Math.abs(tx - ax) > Math.abs(ty - ay);
      const c1 = horiz ? [ax + (tx - ax) * 0.55, ay] : [ax, ay + (ty - ay) * 0.55], c2 = horiz ? [tx - (tx - ax) * 0.2, ty] : [tx, ty - (ty - ay) * 0.2];
      lpath.setAttribute('d', `M${ax},${ay}C${c1} ${c2} ${tx},${ty}`); ldot.setAttribute('cx', tx); ldot.setAttribute('cy', ty);
      lead.classList.add('on');
    }
    function fill(i) {
      const m = messages[i];
      fbody.innerHTML = `<p class="feature__to">${TO}</p><blockquote>${marked(m)}</blockquote><cite>— ${esc(m.name || 'Anonymous')}<span>${esc(m.rel || '')}${m.mine ? '<em>Pending approval · visible only to you</em>' : ''}</span></cite>`;
      nEl.textContent = matches ? `${pos + 1} of ${list.length} ${list.length === 1 ? 'match' : 'matches'}` : '';
    }
    function feature(i, byScroll) {
      if (!byScroll) auto = false;
      const was = mode === 'feature', k = list.indexOf(i); if (k >= 0) pos = k;
      cur = i; hover = null;
      const show = () => { fill(i); fbody.classList.remove('out'); requestAnimationFrame(paint); };
      if (was) { fbody.classList.add('out'); setTimeout(show, REDUCED.matches ? 0 : 260); } else show();
      setMode('feature');
      // on a phone the panel covers the lower part of the screen, so the wall slides to keep this letter in view above it
      const c = byI.get(i); let y = 0;
      if (MOBILE.matches && c) { const n = layers.findIndex(l => l.cards.includes(c)); y = Math.max(-SH * 0.6, Math.min(SH * 0.3, SH * 0.22 - (c.y + c.h / 2 + drift * layers[n].L.depth))); }
      slideTo(y);
    }
    function step(d) { if (!list.length) return; pos = (pos + d + list.length) % list.length; feature(list[pos]); }
    function toField() { setMode('field'); cur = -1; slideTo(0, 600); }

    // ---- pointer: hover lifts a letter, a click or tap opens it ----
    fc.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const r = stage.getBoundingClientRect(), h = hit(e.clientX - r.left, e.clientY - r.top);
      fc.style.cursor = h != null ? 'pointer' : '';
      if (h !== hover) { hover = h; paint(); }
    });
    fc.addEventListener('pointerleave', () => { if (hover != null) { hover = null; paint(); } });
    fc.addEventListener('click', e => { const r = stage.getBoundingClientRect(), h = hit(e.clientX - r.left, e.clientY - r.top); if (h != null) { stopPlay(); feature(h); } });
    $('.js-next').addEventListener('click', () => { stopPlay(); step(1); });
    $('.js-prev').addEventListener('click', () => { stopPlay(); step(-1); });
    // swipe between letters on the panel
    let sw = null;
    card.addEventListener('pointerdown', e => { if (!e.target.closest('button, input, a')) sw = { x: e.clientX, y: e.clientY }; });
    card.addEventListener('pointerup', e => { if (!sw) return; const dx = e.clientX - sw.x, dy = e.clientY - sw.y; sw = null; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) { stopPlay(); step(dx < 0 ? 1 : -1); } });
    addEventListener('keydown', e => {
      if (!inView || mode !== 'feature' || e.target.closest('input, textarea')) return;
      if (e.key === 'ArrowRight') { stopPlay(); step(1); } else if (e.key === 'ArrowLeft') { stopPlay(); step(-1); }
    });

    // ---- play: a new letter every few seconds, for a screen at the celebration ----
    function stopPlay() { clearInterval(timer); timer = null; playBtn.textContent = 'Play'; }
    playBtn.addEventListener('click', () => {
      if (timer) return stopPlay();
      playBtn.textContent = 'Pause'; timer = setInterval(() => { if (!paused) step(1); }, 7000);
      if (mode !== 'feature') feature(list[pos] ?? list[0]);
    });
    card.addEventListener('mouseenter', () => { paused = true; }); card.addEventListener('mouseleave', () => { paused = false; });

    // ---- search and facet filter, on the wall itself ----
    sBtn.addEventListener('click', () => {
      const open = sPanel.hidden; sPanel.hidden = !open; sBtn.setAttribute('aria-expanded', open);
      if (open) sInput.focus({ preventScroll: true }); else { sInput.value = ''; q = ''; qf = 'all'; chips(); filter(); }
      placeLead();
    });
    function chips() {
      sFilters.innerHTML = [['all', 'All'], ...FACETS.map(f => [f.code, f.short])].map(([c, l]) => `<button type="button" data-f="${c}" aria-pressed="${qf === c}">${l}</button>`).join('');
    }
    sFilters.addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { qf = b.dataset.f; chips(); filter(); } });
    let st = 0; sInput.addEventListener('input', () => { clearTimeout(st); st = setTimeout(() => { q = sInput.value.trim().toLowerCase(); filter(); }, 160); });
    function filter() {
      stopPlay();
      if (!q && qf === 'all') { matches = null; list = readOrder(); }
      else {
        const ok = i => { const m = messages[i]; return (qf === 'all' || m.facets.has(qf)) && (!q || (m.text + ' ' + (m.name || '') + ' ' + (m.rel || '')).toLowerCase().includes(q)); };
        list = readOrder().filter(ok); matches = new Set(list);
      }
      sec.classList.toggle('searching', !!matches);
      if (layers) { layers.forEach(renderLayer); paint(); }
      if (list.length) feature(list[0]); else nEl.textContent = 'No messages match';
    }

    // ---- scroll: the wall of letters first, then one letter ----
    function onScroll() {
      const r = sec.getBoundingClientRect(); inView = r.top < innerHeight && r.bottom > 0;
      body.classList.toggle('on-board', r.top < innerHeight * 0.85 && r.bottom > innerHeight * 0.15);
      if (!inView) { if (timer) stopPlay(); return; }
      if (!layers) { build(); return; }
      const p = -r.top / Math.max(1, r.height - innerHeight);
      // the layers drift apart a little as you scroll in: the front moves most, so the wall has depth
      drift = Math.max(-1, Math.min(1, (Math.min(1, Math.max(-0.6, p)) - 0.15) * -1.2)); paint();
      if (mode === 'field' && p > 0.3) { auto = true; feature(list[pos] ?? list[0], true); }
      else if (mode === 'feature' && auto && p < 0.12) { auto = false; toField(); }
    }
    function arrive() {
      // the letters settle in from the back to the front
      const t0 = performance.now(), d = REDUCED.matches ? 1 : 1600;
      const f = now => { reveal = Math.min(1, (now - t0) / d); paint(); if (reveal < 1) requestAnimationFrame(f); };
      requestAnimationFrame(f);
    }
    function build() {
      if (building) return building;
      building = Promise.race([Promise.all(['400 10px Newsreader', 'italic 400 10px Newsreader', '500 10px Archivo'].map(f => document.fonts.load(f))).catch(() => {}), new Promise(r => setTimeout(r, 1500))])
        .then(() => { list = readOrder(); chips(); layout(); arrive(); onScroll(); });
      return building;
    }
    addEventListener('scroll', onScroll, { passive: true });
    let rt = 0; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (!layers) return; viewY = 0; layout(); if (mode === 'feature') feature(cur); }, 200); });
    // a newly written message joins the wall, in front, and is the first letter you meet there
    function added() { if (!layers) return; list = matches ? list : readOrder(); pos = 0; layout(); }
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
