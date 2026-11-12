/* ============================================================
   EDIT MODE for sdcameron.com
   Visit sdcameron.com/?edit and enter the passcode.
   - Click any text and type.
   - Click any block to get its toolbar: move, add, duplicate,
     delete, replace picture, change link, set map pin.
   - "Save changes" gives you the updated site to put on GitHub.

   This file only runs when ?edit is in the address. It never
   changes the live site by itself.
   ============================================================ */
(() => {
  // A fingerprint (SHA-256) of the passcode, not the passcode itself.
  const PASS_HASH = '5be76673ed84ac240d4dfaf3fcb1604ee38b5c3be2a238434280f924bd828f0d';
  const GH_EDIT = 'https://github.com/seanagain/website/edit/main/index.html';
  const GH_UPLOAD = 'https://github.com/seanagain/website/upload/main';
  const KEY = 'book-edit-unlocked';
  const E = window.BOOK_EDIT;
  if (!E) return;

  const TEMPLATES = {
    'Paragraph': '<p>New paragraph. Click to type.</p>',
    'Heading': '<h3 class="sub">New heading</h3>',
    'Picture': '<figure class="pic" style="width:70%"><div class="ph">Picture</div><figcaption>Caption</figcaption></figure>',
    'Card': '<div class="card"><h3>Title</h3><p>A sentence or two.</p></div>',
    'Quote': '<blockquote class="quote-block"><p>“A memorable line.”</p><p class="meta">Who said it</p></blockquote>',
    'Divider': '<div class="orn">❦</div>',
    'Button': '<a class="btn" href="https://">Button</a>',
    'Slideshow': '<div class="slideshow"><div class="slides">' +
      '<figure class="plate"><div class="ph">Photograph</div><figcaption>Caption</figcaption></figure>'.repeat(3) +
      '</div></div>'
  };

  let srcDoc = null;
  const srcIndex = new Map();      // id -> element in the original index.html
  const undoStack = [];
  const textChanged = new Set();
  const assets = new Map();        // new picture file name -> Blob
  let current = null;              // selected block
  let busy = false;                // dragging / resizing

  const isText = el => (+el.dataset.ek & 4) > 0;
  const isBlock = el => !!el.dataset && (+el.dataset.ek & 2) > 0;
  const src = el => srcIndex.get(el.dataset.eid);
  const liveTracked = () => [...document.querySelectorAll('[data-eid]')].filter(el => !el.closest('.leaf'));

  /* ---------------- styles ---------------- */
  const style = document.createElement('style');
  style.textContent = `
    body.editing .ed-text { outline: 1px dashed rgba(142,43,32,.3); outline-offset: 2px; border-radius: 2px; cursor: text; }
    body.editing .ed-text:hover { outline-color: rgba(142,43,32,.8); }
    body.editing .ed-text:focus { outline: 2px solid #8E2B20; background-color: rgba(255,236,190,.5); }
    body.editing .ed-text.edited { box-shadow: inset 3px 0 0 #3E7D52; }
    body.editing .ed-cur { outline: 2px solid #C9A04E !important; outline-offset: 4px; border-radius: 3px; }
    body.editing .ed-dragging { opacity: .55; }
    .ed-ui[hidden], .ed-ui [hidden] { display: none !important; }
    .ed-ui, .ed-ui button { font: 15px/1.4 "EB Garamond", Georgia, serif; }
    .ed-tools {
      position: fixed; z-index: 1002; display: flex; gap: 2px; padding: 3px; border-radius: 8px;
      background: #2B2118; box-shadow: 0 4px 14px rgba(0,0,0,.45);
    }
    .ed-tools button {
      min-width: 32px; height: 30px; padding: 0 6px; border: 0; border-radius: 5px; cursor: pointer;
      background: transparent; color: #F1E5CB; font-size: 16px; line-height: 1;
    }
    .ed-tools button:hover { background: rgba(212,176,104,.25); }
    .ed-tools [data-a=drag] { cursor: grab; touch-action: none; }
    .ed-tools [data-a=del]:hover { background: #8E2B20; }
    .ed-resize {
      position: fixed; z-index: 1002; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%;
      background: #C9A04E; border: 2px solid #2B2118; cursor: nwse-resize; touch-action: none;
    }
    .ed-menu {
      position: fixed; z-index: 1003; padding: 6px; border-radius: 8px; background: #F1E5CB; color: #2B2118;
      box-shadow: 0 8px 24px rgba(0,0,0,.4); display: grid; gap: 2px; min-width: 150px;
    }
    .ed-menu button { text-align: left; border: 0; background: none; padding: 7px 10px; border-radius: 5px; cursor: pointer; color: #2B2118; font-size: 16px; }
    .ed-menu button:hover { background: rgba(122,46,34,.12); }
    .ed-bar {
      position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); z-index: 1000;
      display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px 10px;
      width: max-content; max-width: calc(100vw - 20px); padding: 10px 14px; border-radius: 10px;
      background: #2B2118; color: #F1E5CB; box-shadow: 0 8px 24px rgba(0,0,0,.45);
    }
    .ed-bar .ed-msg { font-style: italic; opacity: .9; }
    .ed-bar button, .ed-card button {
      font-weight: 600; font-size: 14px; letter-spacing: .03em; cursor: pointer;
      padding: 7px 12px; border-radius: 6px; border: 1px solid #D4B068; background: #D4B068; color: #2B2118;
    }
    .ed-bar button.ghost { background: transparent; color: #F1E5CB; border-color: rgba(241,229,203,.5); }
    .ed-bar button:disabled { opacity: .4; cursor: default; }
    .ed-veil { position: fixed; inset: 0; z-index: 1005; background: rgba(20,12,6,.6); display: grid; place-items: center; padding: 16px; }
    .ed-card { width: min(460px, 100%); max-height: 90vh; overflow: auto; padding: 26px 26px 22px; border-radius: 6px; background: #F1E5CB; color: #2B2118; box-shadow: 0 20px 50px rgba(0,0,0,.5); }
    .ed-card h2 { font: 1.7rem "IM Fell English", Georgia, serif; margin: 0 0 .4rem; }
    .ed-card p, .ed-card li { margin: 0 0 .6rem; }
    .ed-card ol { padding-left: 1.3rem; margin: .4rem 0 1rem; }
    .ed-card input { width: 100%; font: 16px Georgia, serif; padding: 9px 10px; margin: .4rem 0 .6rem; border: 1px solid #A08A68; border-radius: 5px; background: #FFF9EC; color: #2B2118; }
    .ed-card .ed-row { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; margin-top: .6rem; }
    .ed-card button.ghost { background: transparent; color: #2B2118; border-color: #A08A68; }
    .ed-card .ed-err { color: #8E2B20; min-height: 1.3em; margin: 0; font-style: italic; }
    .ed-card a { color: #7A2E22; }
    .ed-toast { position: fixed; left: 50%; bottom: 76px; transform: translateX(-50%); z-index: 1004; background: #F1E5CB; color: #2B2118; padding: 8px 14px; border-radius: 8px; box-shadow: 0 6px 18px rgba(0,0,0,.35); font-style: italic; }
    @media (max-width: 820px) { .stage { padding-bottom: 130px; } }
  `;
  document.head.append(style);

  /* ---------------- small helpers ---------------- */
  function card(html) {
    const veil = document.createElement('div'); veil.className = 'ed-veil ed-ui';
    const c = document.createElement('div'); c.className = 'ed-card'; c.innerHTML = html;
    veil.append(c); document.body.append(veil);
    return { veil, c };
  }
  function notice(title, text) {
    const { veil, c } = card(`<h2></h2><p></p><div class="ed-row"><button type="button">OK</button></div>`);
    c.querySelector('h2').textContent = title; c.querySelector('p').textContent = text;
    c.querySelector('button').onclick = () => veil.remove();
  }
  function ask(title, text, value) {
    return new Promise(resolve => {
      const { veil, c } = card(`<h2></h2><p></p><form><input type="text"><div class="ed-row">
        <button type="button" class="ghost" data-x>Cancel</button><button type="submit">OK</button></div></form>`);
      c.querySelector('h2').textContent = title; c.querySelector('p').textContent = text;
      const input = c.querySelector('input'); input.value = value || '';
      setTimeout(() => { input.focus(); input.select(); }, 30);
      c.querySelector('[data-x]').onclick = () => { veil.remove(); resolve(null); };
      c.querySelector('form').onsubmit = e => { e.preventDefault(); veil.remove(); resolve(input.value.trim()); };
    });
  }
  let toastTimer;
  function toast(text) {
    let t = document.querySelector('.ed-toast');
    if (!t) { t = document.createElement('div'); t.className = 'ed-toast ed-ui'; document.body.append(t); }
    t.textContent = text; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }
  const makeNode = (html, doc) => { const t = doc.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

  /* ---------------- passcode ---------------- */
  function sha256(str) {
    const bytes = new TextEncoder().encode(str);
    const K = []; for (let p = 2; K.length < 64; p++) { let prime = true; for (let q = 2; q * q <= p; q++) if (p % q === 0) { prime = false; break; } if (prime) K.push(((Math.cbrt(p) % 1) * 2 ** 32) >>> 0); }
    const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const len = bytes.length, n = ((len + 9 + 63) >> 6) << 6;
    const m = new Uint8Array(n); m.set(bytes); m[len] = 0x80;
    const dv = new DataView(m.buffer); dv.setUint32(n - 4, (len * 8) >>> 0); dv.setUint32(n - 8, Math.floor(len * 8 / 2 ** 32));
    const w = new Uint32Array(64), r = (x, y) => (x >>> y) | (x << (32 - y));
    for (let o = 0; o < n; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
      for (let i = 16; i < 64; i++) { const s0 = r(w[i-15], 7) ^ r(w[i-15], 18) ^ (w[i-15] >>> 3), s1 = r(w[i-2], 17) ^ r(w[i-2], 19) ^ (w[i-2] >>> 10); w[i] = (w[i-16] + s0 + w[i-7] + s1) >>> 0; }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
        const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
    }
    return [...H].map(x => x.toString(16).padStart(8, '0')).join('');
  }
  const isUnlocked = () => { try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; } };
  const remember = () => { try { sessionStorage.setItem(KEY, '1'); } catch {} };

  function askPasscode() {
    return new Promise(resolve => {
      const { veil, c } = card(`
        <h2>Edit mode</h2>
        <p>Enter the passcode to edit this page.</p>
        <form><input type="password" autocomplete="current-password" aria-label="Passcode" placeholder="Passcode">
        <p class="ed-err" aria-live="polite"></p>
        <div class="ed-row"><button type="button" class="ghost" data-x>Cancel</button><button type="submit">Unlock</button></div></form>`);
      const input = c.querySelector('input'), err = c.querySelector('.ed-err');
      setTimeout(() => input.focus(), 50);
      c.querySelector('[data-x]').onclick = () => leave();
      c.querySelector('form').onsubmit = e => {
        e.preventDefault();
        if (sha256(input.value) === PASS_HASH) { remember(); veil.remove(); resolve(); }
        else { err.textContent = 'That passcode isn’t right. Try again.'; input.select(); }
      };
    });
  }

  /* ---------------- original file ---------------- */
  async function loadSource() {
    const res = await fetch(location.pathname, { cache: 'no-store' });
    if (!res.ok) throw new Error('fetch');
    srcDoc = new DOMParser().parseFromString(await res.text(), 'text/html');
    let k = 0;
    const list = E.tag(srcDoc.body, () => k++);
    if (list.length !== E.count) throw new Error('mismatch');
    list.forEach(el => srcIndex.set(el.dataset.eid, el));
  }

  // Label a newly added live element and its twin in the original file with the same ids
  function tagPair(L, S) {
    const ids = [];
    const ll = E.tag(L, () => { const id = E.next(); ids.push(id); return id; });
    let i = 0;
    const sl = E.tag(S, () => ids[i++]);
    if (ll.length !== sl.length) throw new Error('structure');
    sl.forEach(el => srcIndex.set(el.dataset.eid, el));
    ll.forEach(prepLive);
  }
  function prepLive(el) {
    if (isText(el)) { el.contentEditable = 'true'; el.spellcheck = true; el.classList.add('ed-text'); }
  }

  /* ---------------- positions ---------------- */
  function prevBlock(el) { let p = el.previousElementSibling; while (p && !isBlock(p)) p = p.previousElementSibling; return p; }
  function nextBlock(el) { let p = el.nextElementSibling; while (p && !isBlock(p)) p = p.nextElementSibling; return p; }
  // Keep the saved file tidy: each block on its own line with the same indentation
  const isWS = n => n && n.nodeType === 3 && /^\s*$/.test(n.data);
  const indentOf = el => isWS(el.previousSibling) ? el.previousSibling.data : '\n';
  function srcDetach(S) { if (isWS(S.previousSibling)) S.previousSibling.remove(); S.remove(); }
  function srcAfter(ref, S) { const ws = indentOf(ref); ref.after(S); S.before(srcDoc.createTextNode(ws)); }
  function srcPrepend(box, S) {
    const first = box.firstElementChild;
    if (first) { const ws = indentOf(first); first.before(S); first.before(srcDoc.createTextNode(ws)); }
    else box.append(S);
  }
  function placeSrc(el) {
    const S = src(el), p = prevBlock(el);
    if (S.parentNode) srcDetach(S);
    if (p && src(p)) srcAfter(src(p), S); else srcPrepend(src(el.parentElement), S);
  }
  const where = el => ({ box: el.parentElement, prev: prevBlock(el) });
  function putBack(el, pos) {
    if (pos.prev && pos.prev.parentElement === pos.box) pos.prev.after(el); else pos.box.prepend(el);
    placeSrc(el);
  }
  function record(undo) { undoStack.push(undo); update(); }

  /* ---------------- block actions ---------------- */
  function del(el) {
    const pos = where(el), S = src(el);
    select(null); el.remove(); srcDetach(S);
    record(() => putBack(el, pos));
  }
  function move(el, dir) {
    const other = dir < 0 ? prevBlock(el) : nextBlock(el);
    if (!other) return;
    const pos = where(el);
    if (dir < 0) other.before(el); else other.after(el);
    placeSrc(el);
    record(() => putBack(el, pos));
  }
  function insertPair(after, L, S) {
    after.after(L); srcAfter(src(after), S);
    try { tagPair(L, S); } catch { L.remove(); srcDetach(S); notice('Sorry', 'That couldn’t be added here.'); return false; }
    record(() => { if (current === L) select(null); L.remove(); srcDetach(S); });
    if (document.activeElement && document.activeElement.isContentEditable) document.activeElement.blur();
    select(L);
    return true;
  }
  function dup(el) {
    const L = el.cloneNode(true);
    [L, ...L.querySelectorAll('*')].forEach(x => x.classList.remove('ed-cur', 'edited', 'ed-dragging'));
    if (insertPair(el, L, src(el).cloneNode(true))) toast('Copy added below. Click its text to change it.');
  }
  function addNew(type, after) {
    const html = TEMPLATES[type];
    if (!insertPair(after, makeNode(html, document), makeNode(html, srcDoc))) return;
    if (type === 'Picture') { replacePicture(current); return; }
    if (type === 'Slideshow') { addPictures(current); return; }
    const t = current.matches('.ed-text') ? current : current.querySelector('.ed-text');
    if (t) { t.focus(); selectAll(t); }
  }
  function selectAll(el) {
    const r = document.createRange(); r.selectNodeContents(el);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }

  /* pictures */
  function pickFiles(multiple) {
    return new Promise(resolve => {
      const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.multiple = !!multiple;
      i.onchange = () => resolve([...i.files]);
      i.click();
    });
  }
  let picCounter = 0;
  const newPicName = () => 'pic-' + Date.now().toString(36) + (picCounter++).toString(36) + '.jpg';
  async function shrink(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = url; await img.decode();
      const s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return await new Promise(r => c.toBlob(r, 'image/jpeg', .85));
    } finally { URL.revokeObjectURL(url); }
  }
  const picTarget = el => el.matches('img') ? el : el.querySelector('img, .ph');
  // Put a (shrunk) picture into a block; returns a function that undoes it
  async function setPicture(block, file) {
    const blob = await shrink(file);
    const name = newPicName();
    assets.set(name, blob);
    const url = URL.createObjectURL(blob);
    const alt = ((block.querySelector('figcaption') || {}).textContent || 'Photo').trim();
    const L = picTarget(block), S = picTarget(src(block));
    if (!L || !S) return () => {};
    if (L.matches('img')) {
      const oldL = L.getAttribute('src'), oldS = S.getAttribute('src');
      L.src = url; S.setAttribute('src', name);
      return () => { L.setAttribute('src', oldL); S.setAttribute('src', oldS); };
    }
    const Li = document.createElement('img'); Li.src = url; Li.alt = alt;
    const Si = srcDoc.createElement('img'); Si.setAttribute('src', name); Si.setAttribute('alt', alt);
    L.replaceWith(Li); S.replaceWith(Si);
    return () => { Li.replaceWith(L); Si.replaceWith(S); };
  }
  const BAD_PIC = ['Can’t use that picture', 'Please choose JPG or PNG pictures. (iPhone HEIC photos may need to be saved as JPG first.)'];

  async function replacePicture(block) {
    const [file] = await pickFiles(false);
    if (!file) return;
    try { record(await setPicture(block, file)); } catch { notice(...BAD_PIC); }
  }

  // Slideshows and albums: choose several pictures at once. They fill the empty
  // slots first, then new slots are added at the end.
  async function addPictures(block) {
    const files = await pickFiles(true);
    if (!files.length) return;
    const box = block.querySelector('.slides');
    if (!box) return;
    const undos = [];
    let bad = 0;
    toast('Adding ' + files.length + ' picture' + (files.length === 1 ? '' : 's') + '…');
    for (const file of files) {
      let slot = [...box.children].find(f => isBlock(f) && f.querySelector('.ph'));
      if (!slot) {
        const last = [...box.children].filter(isBlock).pop();
        if (!last) break;
        const L = last.cloneNode(true), S = src(last).cloneNode(true);
        [L, ...L.querySelectorAll('*')].forEach(x => x.classList.remove('ed-cur', 'edited', 'ed-dragging'));
        [L, S].forEach(f => { const c = f.querySelector('figcaption'); if (c) c.textContent = 'Caption'; });
        last.after(L); srcAfter(src(last), S);
        try { tagPair(L, S); } catch { L.remove(); srcDetach(S); break; }
        undos.push(() => { L.remove(); srcDetach(S); });
        slot = L;
      }
      try { undos.push(await setPicture(slot, file)); } catch { bad++; }
    }
    if (undos.length) record(() => undos.reverse().forEach(u => u()));
    if (bad) notice(...BAD_PIC);
    else toast('Done. Click a caption to type, or drag photos to reorder.');
  }

  async function editLink(el) {
    const a = el.matches('a') ? el : el.querySelector('a');
    if (!a) return;
    const v = await ask('Link', 'Where should this button go? A web address (https://…) or an email (mailto:you@…).', a.getAttribute('href'));
    if (v === null) return;
    const S = src(el).matches('a') ? src(el) : src(el).querySelector('a');
    const oldL = a.getAttribute('href'), oldS = S.getAttribute('href');
    a.setAttribute('href', v); S.setAttribute('href', v);
    record(() => { a.setAttribute('href', oldL); S.setAttribute('href', oldS); });
  }

  async function editPin(el) {
    const v = await ask('Map location', 'Paste the coordinates from Google Maps (right-click the place). For example: 25.03, 121.56', el.dataset.lat ? el.dataset.lat + ', ' + el.dataset.lon : '');
    if (v === null) return;
    const m = v.match(/(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/);
    if (!m) { notice('Hmm', 'I couldn’t read those numbers. Try something like 25.03, 121.56'); return; }
    const S = src(el);
    const old = [el.dataset.lat, el.dataset.lon];
    const set = (lat, lon) => [el, S].forEach(x => {
      if (lat == null) { x.removeAttribute('data-lat'); x.removeAttribute('data-lon'); }
      else { x.setAttribute('data-lat', lat); x.setAttribute('data-lon', lon); }
    });
    set(m[1], m[2]);
    record(() => set(old[0], old[1]));
    toast('Saved. The pin moves after you publish your changes.');
  }

  /* dragging to reorder */
  function startDrag(e, el) {
    e.preventDefault();
    busy = true; hideMenu();
    const box = el.parentElement, pos = where(el);
    const scroller = el.closest('.page');
    el.classList.add('ed-dragging');
    const handle = e.currentTarget; handle.setPointerCapture(e.pointerId);
    const onMove = ev => {
      const x = ev.clientX, y = ev.clientY, boxW = box.getBoundingClientRect().width;
      const sibs = [...box.children].filter(c => c !== el && isBlock(c));
      let target = null;
      for (const s of sibs) {
        const r = s.getBoundingClientRect();
        const wide = r.width > boxW * .6;
        if (wide ? y < r.top + r.height / 2 : (y < r.top || (y <= r.bottom && x < r.left + r.width / 2))) { target = s; break; }
      }
      if (target) { if (nextBlock(el) !== target) target.before(el); }
      else if (sibs.length) { const last = sibs[sibs.length - 1]; if (prevBlock(el) !== last || nextBlock(el)) last.after(el); }
      if (scroller) {
        const r = scroller.getBoundingClientRect();
        if (y < r.top + 50) scroller.scrollTop -= 14; else if (y > r.bottom - 50) scroller.scrollTop += 14;
      }
    };
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove); handle.removeEventListener('pointerup', onUp); handle.removeEventListener('pointercancel', onUp);
      el.classList.remove('ed-dragging'); busy = false;
      if (prevBlock(el) !== pos.prev) { placeSrc(el); record(() => putBack(el, pos)); }
    };
    handle.addEventListener('pointermove', onMove); handle.addEventListener('pointerup', onUp); handle.addEventListener('pointercancel', onUp);
  }

  /* resizing pictures */
  function startResize(e) {
    const el = current;
    if (!el) return;
    e.preventDefault(); busy = true;
    const h = e.currentTarget; h.setPointerCapture(e.pointerId);
    const boxW = el.parentElement.getBoundingClientRect().width;
    const w0 = el.getBoundingClientRect().width, x0 = e.clientX;
    const oldL = el.getAttribute('style'), oldS = src(el).getAttribute('style');
    const onMove = ev => {
      const pct = Math.max(15, Math.min(100, (w0 + 2 * (ev.clientX - x0)) / boxW * 100));
      el.style.width = pct.toFixed(0) + '%';
    };
    const onUp = () => {
      h.removeEventListener('pointermove', onMove); h.removeEventListener('pointerup', onUp); h.removeEventListener('pointercancel', onUp);
      busy = false;
      const S = src(el); S.setAttribute('style', 'width:' + el.style.width);
      record(() => { el.setAttribute('style', oldL || ''); if (oldS) S.setAttribute('style', oldS); else S.removeAttribute('style'); });
    };
    h.addEventListener('pointermove', onMove); h.addEventListener('pointerup', onUp); h.addEventListener('pointercancel', onUp);
  }

  /* ---------------- selection & toolbar ---------------- */
  const tools = document.createElement('div'); tools.className = 'ed-tools ed-ui'; tools.hidden = true;
  tools.innerHTML = `
    <button type="button" data-a="parent" title="Select the box around this">⤴</button>
    <button type="button" data-a="drag" title="Drag to move">⠿</button>
    <button type="button" data-a="up" title="Move up">↑</button>
    <button type="button" data-a="down" title="Move down">↓</button>
    <button type="button" data-a="add" title="Add below">＋</button>
    <button type="button" data-a="dup" title="Duplicate">⧉</button>
    <button type="button" data-a="pic" title="Replace picture">🖼</button>
    <button type="button" data-a="link" title="Change link">🔗</button>
    <button type="button" data-a="pin" title="Set map location">📍</button>
    <button type="button" data-a="del" title="Delete">🗑</button>`;
  const resizer = document.createElement('div'); resizer.className = 'ed-resize ed-ui'; resizer.hidden = true; resizer.title = 'Drag to resize';
  const menu = document.createElement('div'); menu.className = 'ed-menu ed-ui'; menu.hidden = true;

  const parentBlock = el => { let p = el.parentElement; while (p && !isBlock(p)) { if (p.matches('.verso, .recto')) return null; p = p.parentElement; } return p; };
  const listLike = el => !el.parentElement.matches('.verso, .recto, .fill, .prose');

  function select(el) {
    if (current) current.classList.remove('ed-cur');
    current = el; hideMenu();
    if (!el) { tools.hidden = true; resizer.hidden = true; return; }
    el.classList.add('ed-cur');
    const has = a => tools.querySelector(`[data-a=${a}]`);
    has('parent').hidden = !parentBlock(el);
    has('dup').hidden = el.matches('.map');
    has('add').title = listLike(el) ? 'Add another like this' : 'Add below';
    has('pic').hidden = !picTarget(el) || !!el.closest('.map') || el.matches('.map');
    has('pic').title = el.matches('.slideshow, .album') ? 'Add pictures (you can choose several)' : 'Replace picture';
    has('link').hidden = !(el.matches('a') || (el.querySelector('a.btn') && el.querySelectorAll('a').length === 1));
    has('pin').hidden = !el.closest('.places');
    tools.hidden = false;
    position();
  }

  function position() {
    if (current && (!current.isConnected || current.closest('.page:not(.active)') || current.getBoundingClientRect().width === 0)) { tools.hidden = true; resizer.hidden = true; }
    else if (current) {
      tools.hidden = false;
      const r = current.getBoundingClientRect();
      const tw = tools.offsetWidth, th = tools.offsetHeight;
      let top = r.top - th - 8; if (top < 4) top = Math.min(r.bottom + 8, innerHeight - th - 70);
      tools.style.top = top + 'px';
      tools.style.left = Math.max(4, Math.min(innerWidth - tw - 4, r.right - tw)) + 'px';
      if (current.matches('.pic')) {
        const ir = (current.querySelector('img, .ph') || current).getBoundingClientRect();
        resizer.hidden = false; resizer.style.left = ir.right + 'px'; resizer.style.top = ir.bottom + 'px';
      } else resizer.hidden = true;
    }
    requestAnimationFrame(position);
  }

  function hideMenu() { menu.hidden = true; }
  function showAddMenu() {
    menu.innerHTML = '';
    Object.keys(TEMPLATES).forEach(k => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = k;
      b.onclick = () => { const at = current; hideMenu(); addNew(k, at); };
      menu.append(b);
    });
    const dupB = document.createElement('button'); dupB.type = 'button'; dupB.textContent = 'Copy of this block';
    dupB.onclick = () => { hideMenu(); dup(current); };
    menu.append(dupB);
    menu.hidden = false;
    const r = tools.getBoundingClientRect();
    menu.style.top = Math.min(r.bottom + 6, innerHeight - menu.offsetHeight - 10) + 'px';
    menu.style.left = Math.max(4, Math.min(innerWidth - menu.offsetWidth - 4, r.right - menu.offsetWidth)) + 'px';
  }

  tools.addEventListener('pointerdown', e => {
    const b = e.target.closest('button');
    if (b && b.dataset.a === 'drag' && current) startDrag(e, current);
  });
  tools.addEventListener('mousedown', e => e.preventDefault());
  tools.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !current) return;
    const el = current;
    switch (b.dataset.a) {
      case 'parent': select(parentBlock(el)); break;
      case 'up': move(el, -1); break;
      case 'down': move(el, 1); break;
      case 'add': listLike(el) ? dup(el) : (menu.hidden ? showAddMenu() : hideMenu()); break;
      case 'dup': dup(el); break;
      case 'pic': el.matches('.slideshow, .album') ? addPictures(el) : replacePicture(el); break;
      case 'link': editLink(el); break;
      case 'pin': editPin(el); break;
      case 'del': del(el); break;
    }
  });
  resizer.addEventListener('pointerdown', startResize);

  function blockOf(t) {
    if (!t.closest || t.closest('.leaf, .ed-ui')) return null;
    let el = t.closest('[data-ek]');
    while (el && !isBlock(el)) el = el.parentElement && el.parentElement.closest('[data-ek]');
    return el;
  }

  /* ---------------- turning it on ---------------- */
  function enable() {
    if (window.bookOpen) window.bookOpen();
    document.body.classList.add('editing');
    liveTracked().forEach(prepLive);
    document.body.append(tools, resizer, menu);

    document.addEventListener('pointerdown', e => {
      if (busy || e.target.closest('.ed-ui')) return;
      if (!menu.hidden) hideMenu();
      const b = blockOf(e.target);
      if (b) { if (b !== current) select(b); }
      else if (!e.target.closest('.tab, .subnav, .folio')) select(null);
    }, true);
    document.addEventListener('input', e => {
      const el = e.target.closest && e.target.closest('.ed-text');
      if (!el || el.closest('.leaf')) return;
      textChanged.add(el.dataset.eid); el.classList.add('edited'); update();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { select(null); if (document.activeElement) document.activeElement.blur(); }
      if (e.key === 'Enter' && !e.shiftKey && e.target.isContentEditable) { e.preventDefault(); e.target.blur(); }
    });
    document.addEventListener('paste', e => {
      if (!e.target.closest || !e.target.closest('.ed-text')) return;
      e.preventDefault();
      document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain'));
    });
    // Links shouldn't navigate away while editing
    window.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a');
      if (a && !a.closest('.ed-ui')) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    window.addEventListener('beforeunload', e => { if (dirty()) { e.preventDefault(); e.returnValue = ''; } });
    bar();
    requestAnimationFrame(position);
    toast('Click any text to type, or click a block for its toolbar.');
  }

  let msg, saveBtn, undoBtn;
  function bar() {
    const b = document.createElement('div'); b.className = 'ed-bar ed-ui';
    b.innerHTML = `<button type="button" class="ghost" data-a="undo">↶ Undo</button>
      <span class="ed-msg"></span>
      <button type="button" data-a="save">Save changes</button>
      <button type="button" class="ghost" data-a="exit">Exit</button>`;
    document.body.append(b);
    msg = b.querySelector('.ed-msg'); saveBtn = b.querySelector('[data-a=save]'); undoBtn = b.querySelector('[data-a=undo]');
    undoBtn.onclick = () => { const u = undoStack.pop(); if (u) { select(null); u(); } update(); };
    saveBtn.onclick = save;
    b.querySelector('[data-a=exit]').onclick = () => {
      if (dirty() && !confirm('You have changes you haven’t saved. Leave edit mode anyway?')) return;
      undoStack.length = 0; textChanged.clear(); leave();
    };
    update();
  }
  const dirty = () => textChanged.size + undoStack.length > 0;
  function update() {
    if (!msg) return;
    const n = textChanged.size + undoStack.length;
    msg.textContent = n ? `${n} change${n === 1 ? '' : 's'}` : 'Edit mode';
    saveBtn.disabled = !n; undoBtn.disabled = !undoStack.length;
  }
  function leave() { location.href = location.pathname + location.hash; }

  /* ---------------- saving ---------------- */
  function cleanHTML(html) {
    return html
      .replace(/&nbsp;/g, ' ')
      .replace(/\s(?:data-eid|data-ek|contenteditable|spellcheck)="[^"]*"/g, '')
      .replace(/(<br\s*\/?>\s*)+$/i, '')
      .trim();
  }
  function build() {
    liveTracked().forEach(el => {
      if (!isText(el)) return;
      const S = src(el); if (!S) return;
      S.innerHTML = cleanHTML(el.innerHTML);
      S.querySelectorAll('.count, .certs-count, #year').forEach(x => { x.textContent = ''; });
    });
    const root = srcDoc.documentElement.cloneNode(true);
    root.querySelectorAll('[data-eid], [data-ek]').forEach(x => { x.removeAttribute('data-eid'); x.removeAttribute('data-ek'); });
    root.querySelectorAll('[class=""]').forEach(x => x.removeAttribute('class'));
    return '<!doctype html>\n' + root.outerHTML + '\n';
  }

  function zip(files) {
    const table = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
    const crc = b => { let c = ~0; for (let i = 0; i < b.length; i++) c = table[(c ^ b[i]) & 255] ^ (c >>> 8); return (~c) >>> 0; };
    const enc = new TextEncoder(), parts = [], central = [];
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name), c = crc(f.bytes), size = f.bytes.length;
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true);
      h.setUint16(12, 0x21, true); h.setUint32(14, c, true); h.setUint32(18, size, true); h.setUint32(22, size, true);
      h.setUint16(26, name.length, true);
      parts.push(h, name, f.bytes);
      const d = new DataView(new ArrayBuffer(46));
      d.setUint32(0, 0x02014b50, true); d.setUint16(4, 20, true); d.setUint16(6, 20, true); d.setUint16(8, 0x0800, true);
      d.setUint16(14, 0x21, true); d.setUint32(16, c, true); d.setUint32(20, size, true); d.setUint32(24, size, true);
      d.setUint16(28, name.length, true); d.setUint32(42, offset, true);
      central.push(d, name);
      offset += 30 + name.length + size;
    }
    const cdSize = central.reduce((s, p) => s + p.byteLength, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end], { type: 'application/zip' });
  }
  function downloadBlob(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    a.className = 'ed-ui'; document.body.append(a); a.click(); a.remove();
  }

  async function save() {
    select(null);
    const html = build();
    const pics = [...assets.keys()].filter(n => html.includes('"' + n + '"'));
    if (pics.length) {
      const files = [{ name: 'index.html', bytes: new TextEncoder().encode(html) }];
      for (const n of pics) files.push({ name: n, bytes: new Uint8Array(await assets.get(n).arrayBuffer()) });
      downloadBlob(zip(files), 'website-update.zip');
      const { veil, c } = card(`
        <h2>Downloaded!</h2>
        <p>Your update (the page plus ${pics.length} new picture${pics.length === 1 ? '' : 's'}) was saved as <b>website-update.zip</b>. To publish it:</p>
        <ol>
          <li>Find <b>website-update.zip</b> in your Downloads and double-click it to unzip it.</li>
          <li>Open <a href="${GH_UPLOAD}" target="_blank" rel="noopener">GitHub's upload page</a> (it opens in a new tab).</li>
          <li>Open the unzipped folder and drag <b>the files inside it</b> onto that page (not the .zip file itself).</li>
          <li>Click the green <b>Commit changes</b> button.</li>
        </ol>
        <p>Your site updates within a minute or two.</p>
        <div class="ed-row"><button type="button" class="ghost" data-k>Keep editing</button><button type="button" data-d>Done</button></div>`);
      c.querySelector('[data-k]').onclick = () => veil.remove();
      c.querySelector('[data-d]').onclick = () => { undoStack.length = 0; textChanged.clear(); leave(); };
      return;
    }
    let ok = false;
    try { await navigator.clipboard.writeText(html); ok = true; } catch {
      const t = document.createElement('textarea'); t.value = html; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.append(t); t.select();
      try { ok = document.execCommand('copy'); } catch {}
      t.remove();
    }
    if (!ok) downloadBlob(new Blob([html], { type: 'text/html' }), 'index.html');
    const { veil, c } = card(`
      <h2>${ok ? 'Copied!' : 'Downloaded!'}</h2>
      <p>${ok ? 'Your updated page is copied.' : 'Your updated page was saved as <b>index.html</b> in your Downloads.'} To publish it:</p>
      <ol>
        <li>Open <a href="${GH_EDIT}" target="_blank" rel="noopener">index.html on GitHub</a> (it opens in a new tab, ready to edit).</li>
        <li>Click inside the code, select everything (<b>Ctrl+A</b>, or <b>Cmd+A</b> on a Mac), then paste (<b>Ctrl+V</b> / <b>Cmd+V</b>).</li>
        <li>Click the green <b>Commit changes</b> button, then <b>Commit changes</b> again.</li>
      </ol>
      <p>Your site updates within a minute or two.</p>
      <div class="ed-row"><button type="button" class="ghost" data-dl>Download file instead</button><button type="button" class="ghost" data-k>Keep editing</button><button type="button" data-d>Done</button></div>`);
    c.querySelector('[data-dl]').onclick = () => downloadBlob(new Blob([html], { type: 'text/html' }), 'index.html');
    c.querySelector('[data-k]').onclick = () => veil.remove();
    c.querySelector('[data-d]').onclick = () => { undoStack.length = 0; textChanged.clear(); leave(); };
  }

  /* ---------------- start ---------------- */
  (isUnlocked() ? Promise.resolve() : askPasscode())
    .then(loadSource)
    .then(enable)
    .catch(e => notice('Edit mode couldn’t start',
      e && e.message === 'mismatch'
        ? 'The website was just updated. Wait a minute, then reload this page.'
        : 'Couldn’t load the page’s original file. Check your internet connection and reload.'));
})();
