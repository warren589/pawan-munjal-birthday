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
      if (A.scene) { ctx.globalAlpha = 1 - b.e; ctx.drawImage(A.scene, 0, 0, W, H); }
      if (B.scene) { ctx.globalAlpha = b.e; ctx.drawImage(B.scene, 0, 0, W, H); }
      ctx.globalAlpha = 0.09 * (1 - b.e); ctx.drawImage(A.shadow, A.ox + A.W * 0.012, A.oy + A.H * 0.014, A.W, A.H);
      ctx.globalAlpha = 0.09 * b.e; ctx.drawImage(B.shadow, B.ox + B.W * 0.012, B.oy + B.H * 0.014, B.W, B.H);
      ctx.globalAlpha = 1;
      // the finished portraits hand over to the moving words at the very start and end, so nothing jumps
      const inA = 1 - smooth(0, 0.1, b.e), inB = smooth(0.9, 1, b.e);
      if (inA > 0.002) { ctx.globalAlpha = inA; ctx.drawImage(A.tex, A.ox, A.oy, A.W, A.H); }
      if (inB > 0.002) { ctx.globalAlpha = inB; ctx.drawImage(B.tex, B.ox, B.oy, B.W, B.H); }
      ctx.globalAlpha = 1;
      wp.drawShuffle(ctx, A, B, b.e, dpr, 1 - Math.max(inA, inB));
      const fadeA = Math.max(0, 1 - b.e * 4), fadeB = Math.max(0, b.e * 4 - 3);   // visitor words step aside during the shuffle
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
      let left = entries.length;
      entries.forEach((v, i) => {
        const srcEl = preview.querySelector(`mark[data-w="${v.t}"]`) || preview;
        const sr = srcEl.getBoundingClientRect();
        const inHere = !here || v.facets.includes(here);
        let tx, ty, size, railBtn = null;
        if (inHere) {
          const slot = wp.slotFor(L, v.id, v.t.toUpperCase());
          tx = rect.left + (L.ox + slot.x + slot.w / 2) * sc; ty = rect.top + (L.oy + slot.y + slot.h / 2) * sc; size = slot.fs * sc;
        } else {
          railBtn = rail.querySelector(`[data-go="${CODES.indexOf(v.facets[0])}"]`);
          const r = railBtn.getBoundingClientRect(); tx = r.right - 6; ty = r.top + r.height / 2; size = 10;
        }
        // the flyer starts as the very word on the page (same font, size, place), then becomes a portrait word
        const cs = getComputedStyle(srcEl);
        const fl = document.createElement('span');
        fl.className = 'flyer'; fl.textContent = srcEl.textContent;
        Object.assign(fl.style, { left: sr.left + sr.width / 2 + 'px', top: sr.top + sr.height / 2 + 'px', font: cs.font, color: getComputedStyle(srcEl).color });
        document.body.appendChild(fl);
        const delay = i * 90;
        setTimeout(() => srcEl.classList.add('gone'), delay);
        const dx = tx - (sr.left + sr.width / 2), dy = ty - (sr.top + sr.height / 2), s1 = size / parseFloat(cs.fontSize);
        const lift = Math.min(80, Math.abs(dx) * 0.12 + 30);
        fl.animate([
          { transform: 'translate(-50%,-50%)', opacity: 1, letterSpacing: '0em' },
          { transform: `translate(-50%,-50%) translate(${dx * 0.35}px, ${dy * 0.35 - lift}px) scale(${(1 + s1) / 2})`, opacity: 1, offset: 0.45 },
          { transform: `translate(-50%,-50%) translate(${dx}px, ${dy}px) scale(${s1})`, opacity: inHere ? 1 : 0 }
        ], { duration: 1150, delay, easing: 'cubic-bezier(.55,0,.25,1)', fill: 'forwards' });
        // swap to the portrait's own letterforms just before landing
        setTimeout(() => { fl.textContent = v.t.toUpperCase(); fl.classList.add('landing'); }, delay + 700);
        setTimeout(() => {
          v.landed = true; if (inHere) v.arrived[s] = performance.now();
          if (railBtn) { railBtn.classList.remove('ping'); void railBtn.offsetWidth; railBtn.classList.add('ping'); }
          kick();
          fl.animate([{ opacity: inHere ? 1 : 0 }, { opacity: 0 }], { duration: 220, fill: 'forwards' }).onfinish = () => fl.remove();
          if (--left === 0) {
            done(entries);
            closeComposer();
            setTimeout(() => { form.reset(); preview.innerHTML = ''; found.textContent = ''; composer.classList.remove('sending', 'emptied'); }, 520);
          }
        }, delay + 1150);
      });
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
    renderLetters();
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
  const lettersBody = $('.letters__body'), filters = $('.filters'), search = $('.search input');
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
    const list = messages.map((m, i) => ({ m, i })).reverse().filter(({ m }) =>
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
