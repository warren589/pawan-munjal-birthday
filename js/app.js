(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const body = document.body;
  const FACETS = window.FACETS, CODES = FACETS.map(f => f.code);

  // ---------------- Vocabulary + deterministic word extraction (no AI) ----------------
  const VOCAB = new Map(), ALIAS = new Map();
  window.VOCAB_RAW.forEach(line => {
    const [forms, codes] = line.split('|'), list = forms.split(','), w = list[0];
    const entry = VOCAB.get(w) || { w, facets: new Set() };
    codes.split('').forEach(c => entry.facets.add(c));
    VOCAB.set(w, entry);
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
  const usedWords = new Set();
  function extract(text) {
    const found = new Map(), re = /[A-Za-z’']+/g; let m, i = 0;
    while ((m = re.exec(text))) {
      const tok = m[0].toLowerCase().replace(/[’']s?$/, ''), w = lookup(tok);
      if (w) {
        const f = found.get(w) || { w, count: 0, first: i, spans: [] };
        f.count++; f.spans.push([m.index, m.index + m[0].length]); found.set(w, f);
      }
      i++;
    }
    const ranked = [...found.values()].sort((a, b) =>
      (b.count * 3 + VOCAB.get(b.w).facets.size * 0.6 + (b.w.length > 6 ? 0.5 : 0) - b.first * 0.01) -
      (a.count * 3 + VOCAB.get(a.w).facets.size * 0.6 + (a.w.length > 6 ? 0.5 : 0) - a.first * 0.01));
    const words = ranked.slice(0, 3).map(r => r.w), fallback = new Set();
    // prefer fallback words this visitor hasn't already placed, so repeat visits don't stack duplicates
    const fbs = [...window.FALLBACK_WORDS.filter(f => !usedWords.has(f)), ...window.FALLBACK_WORDS];
    for (const fb of fbs) { if (words.length >= 3) break; if (!words.includes(fb)) { words.push(fb); fallback.add(fb); } }
    return { words, ranked, fallback };
  }
  const facetsOf = (w, fallback) => (fallback && fallback.has(w)) ? ['J'] : [...(VOCAB.get(w)?.facets || ['J'])];

  // ---------------- Messages ----------------
  const messages = window.SAMPLE_MESSAGES.map(s => {
    const ex = extract(s.text);
    return { ...s, words: ex.words, facets: new Set(ex.words.flatMap(w => facetsOf(w, ex.fallback))) };
  });
  const msgsFor = code => messages.map((m, i) => i).filter(i => messages[i].facets.has(code));
  function msgForWord(w, code, R) {
    const hits = messages.map((m, i) => i).filter(i => messages[i].words.includes(w));
    if (hits.length) return hits[Math.floor(R() * hits.length)];
    const pool = msgsFor(code || facetsOf(w)[0]);
    return pool.length ? pool[Math.floor(R() * pool.length)] : 0;
  }
  function seeded(seed) { let a = seed; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; }

  // ---------------- Portrait specs per state ----------------
  // visitor word positions (normalised), spaced so neighbouring words never overlap
  const SLOTS_PHOTO = [[0.5, 0.115], [0.37, 0.665], [0.72, 0.8], [0.82, 0.585], [0.28, 0.87], [0.72, 0.935], [0.2, 0.6], [0.55, 0.735], [0.88, 0.7]];
  const SLOTS_PH = [[0.5, 0.13], [0.32, 0.56], [0.68, 0.74], [0.5, 0.9], [0.27, 0.32], [0.73, 0.4], [0.7, 0.22], [0.3, 0.66], [0.7, 0.58], [0.3, 0.8]];
  // "poster" = flat colour fields + ink words (closer to the earlier site); "glow" = dark + luminous
  let look = new URLSearchParams(location.search).get('look') === 'glow' ? 'glow' : 'poster';
  const shade = (hex, k) => '#' + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');
  const posterStops = paper => [paper, shade(paper, 0.72), shade(paper, 0.32), '#0d0a0b', '#000000'];
  // face, beard and hair stay pure texture so the likeness reads
  const FACE_PROTECT = [[0.46, 0.33, 0.27, 0.25], [0.46, 0.1, 0.24, 0.07]];
  const specs = {};
  function buildSpec(state) {
    const final = state === 'final', fi = final ? -1 : (state === 'hero' ? 0 : +state);
    const ink = look === 'poster' && state !== 'hero' && !final;
    const bold = look === 'poster';
    const sk = state + (ink ? ':ink' : '') + (bold ? ':b' : '');
    if (specs[sk]) return specs[sk];
    const code = final ? null : CODES[fi], R = seeded(final ? 999 : 17 + fi * 31);
    const mIdx = final ? messages.map((m, i) => i) : msgsFor(code);
    const featured = [], seen = new Set();
    const pushF = (t, m) => { if (!seen.has(t)) { seen.add(t); featured.push({ t, m }); } };
    // message words first (the real voices), then the facet's vocabulary
    const order = mIdx.slice().sort(() => R() - 0.5);
    order.forEach(i => messages[i].words.forEach(w => (final || facetsOf(w).includes(code)) && pushF(w, i)));
    order.forEach(i => messages[i].words.forEach(w => pushF(w, i)));
    [...VOCAB.values()].filter(v => final || v.facets.has(code)).sort(() => R() - 0.5).forEach(v => pushF(v.w, msgForWord(v.w, code, R)));
    // then the wider vocabulary, so the small-word layer has enough distinct words
    [...VOCAB.values()].sort(() => R() - 0.5).forEach(v => pushF(v.w, msgForWord(v.w, code, R)));
    const pool = [];
    mIdx.forEach(i => messages[i].words.forEach(w => { for (let k = 0; k < 3; k++) pool.push({ t: w, m: i }); }));
    VOCAB.forEach(v => {
      const n = final ? 1 : (v.facets.has(code) ? 3 : (R() < 0.35 ? 1 : 0));
      for (let k = 0; k < n; k++) pool.push({ t: v.w, m: msgForWord(v.w, code, R) });
    });
    const photo = final || fi === 0;
    return (specs[sk] = {
      key: (final ? 'final' : 'f' + fi) + (ink ? ':ink' : '') + (bold ? ':b' : ''), ink, bold,
      kind: photo ? (ink ? 'ink' : 'photo') : FACETS[fi].shape,
      stops: final ? window.FINAL_STOPS : ink ? posterStops(FACETS[fi].paper) : FACETS[fi].stops,
      featured: featured.slice(0, 124), pool, seed: final ? 4242 : 101 + fi * 7, slots: photo ? SLOTS_PHOTO : SLOTS_PH,
      protect: photo ? FACE_PROTECT : []
    });
  }

  // ---------------- Build chapters, rail, finale chips ----------------
  const chapters = $('.chapters'), rail = $('.rail');
  FACETS.forEach((f, i) => {
    const mi = msgsFor(f.code), quote = messages[mi[0] ?? 0];
    const words = buildSpec(String(i)).featured.slice(0, 7);
    const media = i === 0
      ? `<figure class="chap__media chap__media--photo"><img src="assets/pawan-munjal.jpg" alt="Portrait photograph of Dr. Pawan Munjal"><figcaption>The photograph behind this portrait</figcaption></figure>`
      : `<figure class="chap__media chap__media--ph"><div class="ph-img"><span>Client photography</span></div><figcaption>Final ${f.short.toLowerCase()} photograph will form this facet’s portrait</figcaption></figure>`;
    chapters.insertAdjacentHTML('beforeend', `
      <section class="chapter" data-state="${i}" id="facet-${i}" style="--fc1:${f.c1};--fc2:${f.c2}">
        <div class="card">
          <p class="chap__num"><b>${String(i + 1).padStart(2, '0')}</b><span>/ 07</span><i>Facet</i></p>
          <h2 class="chap__title">${f.name}</h2>
          <p class="chap__kicker">${f.kicker}</p>
          <p class="chap__lede">${f.lede}</p>
          <div class="chips">${words.map(w => `<button class="chip" type="button" data-w="${w.t}" data-m="${w.m}">${w.t}</button>`).join('')}</div>
          <blockquote class="chap__quote"><p>“${quote.text}”</p><cite>— ${quote.name}<span>${quote.rel}</span></cite></blockquote>
          ${media}
        </div>
      </section>`);
    rail.insertAdjacentHTML('beforeend', `<button type="button" data-go="${i}" style="--fc1:${f.c1}"><b>${String(i + 1).padStart(2, '0')}</b><span>${f.name}</span></button>`);
  });
  rail.insertAdjacentHTML('beforeend', `<button type="button" data-go="final" style="--fc1:#fff"><b>✦</b><span>The whole person</span></button>`);
  $('.finale__chips').innerHTML = FACETS.map((f, i) => `<button type="button" class="fchip" data-go="${i}" style="--fc1:${f.c1}">${f.short}</button>`).join('');

  // ---------------- Portrait + geometry ----------------
  const canvas = $('.portrait'), pbox = $('.pbox'), portrait = new window.Portrait(canvas);
  let state = null;
  const MOBILE_MQ = window.matchMedia('(max-width: 819px), (max-width: 1100px) and (orientation: portrait)');
  function geometry() {
    const vw = window.innerWidth, vh = window.innerHeight, mobile = MOBILE_MQ.matches;
    let bh, bw;
    if (!mobile) { bh = vh * 0.92; bw = bh * 2 / 3; if (bw > vw * 0.48) { bw = vw * 0.48; bh = bw * 1.5; } }
    else { const k = vh < 720 ? 0.6 : 0.68; bw = vw; bh = bw * 1.5; if (bh > vh * k) { bh = vh * k; bw = bh / 1.5; } }
    bw = Math.round(bw); bh = Math.round(bh);
    pbox.style.width = bw + 'px'; pbox.style.height = bh + 'px';
    body.classList.toggle('is-mobile', mobile);
    return portrait.resize(bw, bh);
  }

  function setState(s) {
    if (s === state) return;
    state = s;
    const final = s === 'final', fi = s === 'hero' ? 0 : final ? -1 : +s;
    body.dataset.mode = s === 'hero' ? 'hero' : final ? 'final' : 'facet';
    body.dataset.ph = (!final && fi > 0) ? '1' : '0';
    const f = final ? { c1: '#ff2e88', c2: '#ffd23f' } : FACETS[fi];
    body.style.setProperty('--c1', f.c1); body.style.setProperty('--c2', f.c2);
    const light = look === 'poster' && !final && s !== 'hero';
    body.classList.toggle('light', light);
    body.style.setProperty('--bgc', light ? FACETS[fi].paper : '#0b0710');
    const ai = s === 'hero' ? -1 : final ? 7 : fi;
    $$('button', rail).forEach((b, i) => { b.classList.toggle('on', i === ai); b.classList.toggle('done', i < ai); });
    rail.style.setProperty('--p', Math.max(0, ai) / 7);
    $$('.chapter').forEach(c => c.classList.toggle('is-active', c.dataset.state === s));
    portrait.show(buildSpec(s));
  }

  function onScroll() {
    const mid = window.innerHeight * 0.5;
    for (const sec of $$('[data-state]', $('.flow'))) {
      const r = sec.getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) { setState(sec.dataset.state); break; }
    }
    body.classList.toggle('scrolled', window.scrollY > 40);
    body.classList.toggle('on-board', $('#board').getBoundingClientRect().top < window.innerHeight * 0.55);
  }
  let ticking = false;
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; onScroll(); }); } }, { passive: true });
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (geometry() && state) relayout(); }, 180); });

  // Render every state's portrait in the background, one per idle slot, so scrolling never waits on layout.
  let warmGen = 0;
  function warmAll() {
    const gen = ++warmGen, queue = ['1', '2', '3', '4', '5', '6', 'final', '0', 'hero'];
    const idle = window.requestIdleCallback || (cb => setTimeout(cb, 60));
    const step = () => {
      if (gen !== warmGen || !queue.length) return;
      try { portrait.layout(buildSpec(queue.shift())); } catch (e) { /* keep going */ }
      idle(step, { timeout: 400 });
    };
    idle(step, { timeout: 400 });
  }
  function relayout() { const s = state; state = null; portrait.cur = null; setState(s); warmAll(); }

  const goTo = id => { const el = id === 'final' ? $('#final') : id === 'board' ? $('#board') : $('#facet-' + id); el && el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  document.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) goTo(g.dataset.go); });

  // canvas interaction: tap / click a word
  const local = e => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * portrait.W / r.width, (e.clientY - r.top) * portrait.H / r.height]; };
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const h = portrait.hit(...local(e)); portrait.setHover(h); canvas.style.cursor = h ? 'pointer' : 'default';
  });
  canvas.addEventListener('pointerleave', () => portrait.setHover(null));
  canvas.addEventListener('click', e => { const h = portrait.hit(...local(e)); if (h) openSheet(h.t, h.m); });
  chapters.addEventListener('click', e => { const c = e.target.closest('.chip'); if (c) openSheet(c.dataset.w, +c.dataset.m); });

  // ---------------- Word sheet ----------------
  const sheet = $('.sheet'), sheetBody = $('.sheet__body');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function facetChips(codes) {
    return codes.map(c => { const f = FACETS[CODES.indexOf(c)]; return `<span class="tag" style="--fc1:${f.c1}">${f.name}</span>`; }).join('');
  }
  function openSheet(word, mi) {
    const m = messages[mi] || messages[0];
    const codes = m.mine ? [...m.facets] : facetsOf(word);
    const col = m.mine ? m.color : FACETS[CODES.indexOf(codes[0])].c1;
    sheetBody.innerHTML = `
      <div class="tags">${facetChips(codes)}</div>
      <h3 id="sheet-word" class="sheet__word" style="color:${col}">${esc(word)}</h3>
      ${m.mine ? `<p class="pending"><span></span>Your message · pending approval — only you can see it for now</p>` : ''}
      <blockquote class="sheet__quote${m.mine ? ' is-pending' : ''}">“${esc(m.text)}”</blockquote>
      ${m.name || m.rel ? `<p class="sheet__by">— ${esc(m.name || 'Anonymous')}${m.rel ? `<span>${esc(m.rel)}</span>` : ''}</p>` : ''}
      <button class="linkbtn js-related" type="button">Find related messages →</button>
      <button class="linkbtn js-toboard" type="button" data-f="${codes[0]}">See them all on the message board →</button>
      <div class="related"></div>`;
    $('.js-related', sheetBody).onclick = () => {
      const rel = messages.map((x, i) => i).filter(i => i !== mi && !messages[i].mine && (messages[i].words.includes(word) || codes.some(c => messages[i].facets.has(c)))).slice(0, 4);
      $('.related', sheetBody).innerHTML = rel.map(i => `<button type="button" class="relitem" data-i="${i}" data-w="${messages[i].words[0]}"><span class="relitem__w">${messages[i].words.join(' · ')}</span><span class="relitem__t">“${esc(messages[i].text)}”</span><span class="relitem__n">${esc(messages[i].name)}</span></button>`).join('') || '<p class="muted">No related messages yet.</p>';
      $('.js-related', sheetBody).remove();
    };
    $('.js-toboard', sheetBody).onclick = e => { hide(sheet); boardFilter(e.currentTarget.dataset.f); goTo('board'); };
    show(sheet);
  }
  sheet.addEventListener('click', e => {
    const r = e.target.closest('.relitem'); if (r) { openSheet(r.dataset.w, +r.dataset.i); $('.sheet__panel').scrollTop = 0; }
    if (e.target.closest('.js-close-sheet, .sheet__backdrop')) hide(sheet);
  });

  // each overlay keeps its own close timer, so reopening quickly can't be undone by a stale close
  function show(el) { clearTimeout(el._t); el.hidden = false; requestAnimationFrame(() => el.classList.add('open')); body.classList.add('locked'); }
  function hide(el) { el.classList.remove('open'); clearTimeout(el._t); el._t = setTimeout(() => { el.hidden = true; }, 380); if (!$$('.composer.open, .sheet.open').length) body.classList.remove('locked'); }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (sheet.classList.contains('open')) hide(sheet); else if (composer.classList.contains('open')) hide(composer); } });

  // ---------------- Composer ----------------
  const composer = $('.composer'), form = $('.step--write'), stepWords = $('.step--words');
  const sw = $('.swatches');
  window.ACCENTS.forEach((a, i) => sw.insertAdjacentHTML('beforeend',
    `<label class="sw" style="--sw:${a.hex}"><input type="radio" name="color" value="${a.hex}" ${i === 0 ? 'checked' : ''}><span></span><em>${a.name}</em></label>`));
  const ta = form.elements.msg;
  ta.addEventListener('input', () => { $('.js-len').textContent = ta.value.length; ta.classList.remove('err'); });
  $$('.js-write').forEach(b => b.addEventListener('click', () => { form.hidden = false; stepWords.hidden = true; show(composer); setTimeout(() => ta.focus(), 350); }));
  composer.addEventListener('click', e => { if (e.target.closest('.js-close-composer, .composer__backdrop')) hide(composer); });
  $('.js-sample').addEventListener('click', () => {
    ta.value = 'Your vision and humility inspired me to lead with courage. Thank you for believing in young people like me and for every lesson along the way.';
    form.elements.name.value ||= 'Aarav Malhotra'; form.elements.rel.value ||= 'Young engineer, Hero MotoCorp';
    ta.dispatchEvent(new Event('input'));
  });

  let draft = null;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const text = ta.value.trim();
    if (text.length < 3) { ta.classList.add('err'); ta.focus(); return; }
    const ex = extract(text);
    draft = { text, name: form.elements.name.value.trim(), rel: form.elements.rel.value.trim(), color: form.elements.color.value, ...ex, swapping: -1 };
    body.style.setProperty('--accent', draft.color);
    renderWords(); form.hidden = true; stepWords.hidden = false;
  });
  $('.js-back').addEventListener('click', () => { form.hidden = false; stepWords.hidden = true; });

  function renderWords() {
    const { text, words, ranked } = draft;
    // highlight: chosen words solid, other matched vocabulary dotted
    const marks = [];
    ranked.forEach(r => r.spans.forEach(s => marks.push([...s, r.w])));
    marks.sort((a, b) => a[0] - b[0]);
    let html = '', at = 0;
    marks.forEach(([s, e2, w]) => {
      if (s < at) return;
      html += esc(text.slice(at, s));
      html += words.includes(w) ? `<mark data-w="${w}">${esc(text.slice(s, e2))}</mark>` : `<span class="cand" data-w="${w}">${esc(text.slice(s, e2))}</span>`;
      at = e2;
    });
    html += esc(text.slice(at));
    $('.preview').innerHTML = `“${html}”`;
    $('.slots').innerHTML = words.map((w, i) => `
      <button type="button" class="slot${draft.swapping === i ? ' on' : ''}" data-i="${i}">
        <span class="slot__n">0${i + 1}</span><span class="slot__w">${w}</span>
        <span class="slot__f">${facetsOf(w, draft.fallback).map(c => FACETS[CODES.indexOf(c)].short).join(' · ')}</span>
        <span class="slot__s">↻ swap</span>
      </button>`).join('');
    const swap = $('.swap');
    if (draft.swapping >= 0) {
      const alts = [...ranked.map(r => r.w), ...window.FALLBACK_WORDS].filter((w, i, a) => !words.includes(w) && a.indexOf(w) === i);
      $('b', swap).textContent = words[draft.swapping];
      $('.swap__chips', swap).innerHTML = alts.map(w => `<button type="button" class="chip${ranked.some(r => r.w === w) ? '' : ' chip--fb'}" data-w="${w}">${w}</button>`).join('');
      swap.hidden = false;
    } else swap.hidden = true;
  }
  stepWords.addEventListener('click', e => {
    const s = e.target.closest('.slot');
    if (s) { const i = +s.dataset.i; draft.swapping = draft.swapping === i ? -1 : i; renderWords(); return; }
    const c = e.target.closest('.swap .chip');
    if (c) {
      const w = c.dataset.w;
      if (!draft.ranked.some(r => r.w === w)) draft.fallback.add(w);
      draft.words[draft.swapping] = w; draft.swapping = -1; renderWords();
    }
  });

  // ---------------- Contribution moment ----------------
  let mine = 0;
  $('.js-confirm').addEventListener('click', () => {
    const d = draft, words = d.words.slice();
    const m = { text: d.text, name: d.name, rel: d.rel, words, color: d.color, mine: true, pending: true, facets: new Set(words.flatMap(w => facetsOf(w, d.fallback))) };
    messages.push(m); const mi = messages.length - 1;
    words.forEach(w => usedWords.add(w));
    const rect = canvas.getBoundingClientRect(), sc = rect.width / portrait.W;
    const base = portrait.user.length;
    composer.classList.add('flying');
    words.forEach((w, i) => {
      const srcEl = $(`.preview mark[data-w="${w}"]`) || $$('.slot__w')[i];
      const sr = srcEl.getBoundingClientRect(), srcSize = parseFloat(getComputedStyle(srcEl).fontSize);
      const t = portrait.userTarget(base + i), tSize = t.size * sc * (look === 'poster' ? 0.86 : 1);
      const tx = rect.left + t.x * sc, ty = rect.top + (t.y - t.size * 0.3) * sc;
      const fl = document.createElement('span');
      fl.className = 'flyer'; fl.textContent = w; fl.style.color = d.color; fl.style.fontSize = tSize + 'px';
      fl.style.left = tx + 'px'; fl.style.top = ty + 'px';
      document.body.appendChild(fl);
      const dx = sr.left + sr.width / 2 - tx, dy = sr.top + sr.height / 2 - ty, s0 = srcSize / tSize;
      const anim = fl.animate([
        { transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) scale(${s0})`, opacity: 1 },
        { transform: `translate(-50%,-50%) translate(${dx * 0.45}px,${dy * 0.45 - 90}px) scale(${(s0 + 1) * 0.75})`, opacity: 1, offset: 0.55 },
        { transform: 'translate(-50%,-50%) translate(0,0) scale(1)', opacity: 1 }
      ], { duration: 1250, delay: 250 + i * 220, easing: 'cubic-bezier(.65,0,.25,1)', fill: 'forwards' });
      anim.onfinish = () => {
        portrait.addUser([w], d.color, mi);
        fl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' }).onfinish = () => fl.remove();
        if (i === words.length - 1) afterContribution();
      };
    });
    setTimeout(() => { hide(composer); composer.classList.remove('flying'); form.reset(); $('.js-len').textContent = '0'; }, 500);
  });
  function afterContribution() {
    mine++;
    const cnt = $('.js-count'); cnt.textContent = (2418 + mine).toLocaleString('en-IN');
    const toast = $('.toast'); toast.hidden = false; body.classList.add('toasting'); requestAnimationFrame(() => toast.classList.add('open'));
    clearTimeout(toast._t); toast._t = setTimeout(() => hideToast(), 7000);
    toast._y = window.scrollY;
    $('.findpill').hidden = false; $('.js-find-inline').hidden = false;
    renderBoard();
  }
  function hideToast() {
    const t = $('.toast'); if (!t.classList.contains('open')) return;
    body.classList.remove('toasting'); t.classList.remove('open');
    clearTimeout(t._t); t._t = setTimeout(() => { t.hidden = true; }, 400);
  }
  // the toast gets out of the way as soon as the visitor scrolls on
  window.addEventListener('scroll', () => { const t = $('.toast'); if (t.classList.contains('open') && Math.abs(window.scrollY - t._y) > 160) hideToast(); }, { passive: true });

  // ---------------- Look toggle (for design review) ----------------
  function setLook(l) {
    look = l; body.dataset.look = l;
    $$('.look button').forEach(b => b.setAttribute('aria-pressed', b.dataset.look === l));
    const u = new URL(location.href); u.searchParams.set('look', l); history.replaceState(null, '', u);
    if (state) relayout();
  }
  $$('.look button').forEach(b => b.addEventListener('click', () => setLook(b.dataset.look)));
  body.dataset.look = look;
  $$('.look button').forEach(b => b.setAttribute('aria-pressed', b.dataset.look === look));

  // ---------------- Find my words ----------------
  let finding = false;
  function toggleFind(on = !finding) {
    finding = on; portrait.setFind(on); body.classList.toggle('finding', on);
    $('.findpill__label').textContent = on ? 'Showing your words · tap to exit' : 'Find my words';
    $('.js-find-inline').textContent = on ? 'Show everyone’s words' : 'Find my words';
  }
  $('.findpill').addEventListener('click', () => toggleFind());
  $('.js-find-inline').addEventListener('click', () => toggleFind());
  $('.js-find-toast').addEventListener('click', () => { hideToast(); toggleFind(true); });
  $('.js-continue').addEventListener('click', () => { hideToast(); goTo(state === 'hero' ? 0 : state === 'final' ? 'final' : Math.min(6, +state + 1)); });

  // ---------------- Message board ----------------
  const grid = $('.board__grid'), filters = $('.board__filters'), search = $('.board__search input');
  const PAGE = 12;
  let bFacet = 'all', bQuery = '', bShown = PAGE;
  const loved = new Set();
  const primaryFacet = m => facetsOf(m.words[0])[0] || [...m.facets][0] || 'J';
  function highlight(m) {
    const ex = extract(m.text), spans = [];
    ex.ranked.filter(r => m.words.includes(r.w)).forEach(r => r.spans.forEach(sp => spans.push(sp)));
    spans.sort((a, b) => a[0] - b[0]);
    let out = '', at = 0;
    spans.forEach(([a, b]) => { if (a < at) return; out += esc(m.text.slice(at, a)) + `<mark>${esc(m.text.slice(a, b))}</mark>`; at = b; });
    return out + esc(m.text.slice(at));
  }
  function noteHTML(m, i) {
    const code = m.mine ? [...m.facets][0] : primaryFacet(m), f = FACETS[CODES.indexOf(code)];
    const big = !m.mine && (i % 7 === 0 || m.text.length < 70);
    const no = (2418 + mine - i).toLocaleString('en-IN');
    const love = 12 + ((i * 37) % 90) + (loved.has(i) ? 1 : 0);
    return `<article class="note${big ? ' note--big' : ''}${m.mine ? ' note--mine' : ''}" style="--nc:${m.mine ? m.color : f.paper};--nc1:${f.c1}">
      <header class="note__top"><span class="note__facet">${m.mine ? 'Your message' : f.short}</span><span class="note__no">${m.mine ? 'Pending approval' : 'No. ' + no}</span></header>
      <p class="note__word" style="--len:${Math.max(6, m.words[0].length)}">${esc(m.words[0])}</p>
      <p class="note__text">“${highlight(m)}”</p>
      <footer class="note__by">
        <span><b>${esc(m.name || 'Anonymous')}</b>${m.rel ? `<i>${esc(m.rel)}</i>` : ''}</span>
        ${m.mine ? '<em class="note__pending">Only you can see this until it’s approved</em>' : `<button type="button" class="note__love${loved.has(i) ? ' on' : ''}" data-i="${i}" aria-pressed="${loved.has(i)}" aria-label="Appreciate this message"><span>♥</span>${love}</button>`}
      </footer>
    </article>`;
  }
  function renderBoard() {
    const q = bQuery.toLowerCase();
    const all = messages.map((m, i) => ({ m, i })).reverse(); // newest first; visitor's own sits on top
    const list = all.filter(({ m }) => (bFacet === 'all' || m.facets.has(bFacet)) && (!q || (m.text + ' ' + (m.name || '') + ' ' + (m.rel || '') + ' ' + m.words.join(' ')).toLowerCase().includes(q)));
    grid.innerHTML = list.slice(0, bShown).map(({ m, i }) => noteHTML(m, i)).join('');
    $('.board__empty').hidden = list.length > 0;
    $('.js-more').hidden = list.length <= bShown;
    $('.js-bcount').textContent = (2418 + mine).toLocaleString('en-IN');
    filters.innerHTML = [['all', 'All'], ...FACETS.map(f => [f.code, f.short])].map(([c, label]) => {
      const n = c === 'all' ? messages.length : messages.filter(m => m.facets.has(c)).length;
      const f = FACETS[CODES.indexOf(c)];
      return `<button type="button" class="bchip${bFacet === c ? ' on' : ''}" data-f="${c}" style="--nc:${f ? f.paper : '#f7efe4'}" aria-pressed="${bFacet === c}">${label}<span>${n}</span></button>`;
    }).join('');
  }
  function boardFilter(c) { bFacet = c; bShown = PAGE; renderBoard(); }
  filters.addEventListener('click', e => { const b = e.target.closest('.bchip'); if (b) boardFilter(b.dataset.f); });
  search.addEventListener('input', () => { bQuery = search.value.trim(); bShown = PAGE; renderBoard(); });
  $('.js-more').addEventListener('click', () => { bShown += PAGE; renderBoard(); });
  grid.addEventListener('click', e => {
    const b = e.target.closest('.note__love'); if (!b) return;
    const i = +b.dataset.i; loved.has(i) ? loved.delete(i) : loved.add(i); renderBoard();
  });
  renderBoard();

  // ---------------- Boot ----------------
  async function boot() {
    const fonts = Promise.all([
      document.fonts.load('700 20px "Barlow Condensed"'), document.fonts.load('500 20px "Barlow Condensed"'),
      document.fonts.load('400 20px "Barlow Condensed"'), document.fonts.load('italic 600 20px "Fraunces"'),
      document.fonts.load('italic 700 20px "Fraunces"'), document.fonts.load('900 20px "Archivo"')
    ]).catch(() => {});
    await Promise.race([fonts, new Promise(r => setTimeout(r, 2500))]);
    await portrait.init(window.PORTRAIT_TONE, window.PORTRAIT_INK);
    geometry();
    state = null; onScroll(); if (!state) setState('hero');
    body.classList.add('ready');
    setTimeout(warmAll, 600);
  }
  boot();
})();
