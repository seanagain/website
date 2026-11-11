/* ============================================================
   EDIT MODE for sdcameron.com
   Visit sdcameron.com/?edit, enter the passcode, click any text
   on the page and type. Then "Copy updated page" and paste it
   into index.html on GitHub.

   This file only runs when ?edit is in the address. It can never
   change the live site by itself: it only gives you an updated
   copy of index.html to save on GitHub.
   ============================================================ */
(() => {
  // A fingerprint (SHA-256) of the passcode, not the passcode itself.
  const PASS_HASH = '5be76673ed84ac240d4dfaf3fcb1604ee38b5c3be2a238434280f924bd828f0d';
  const GITHUB_EDIT = 'https://github.com/seanagain/website/edit/main/index.html';
  const SEL = window.BOOK_EDITABLE;
  const TOTAL = window.BOOK_EDIT_TOTAL;
  const KEY = 'book-edit-unlocked';
  const changed = new Map();

  /* ---------- styles for edit mode ---------- */
  const style = document.createElement('style');
  style.textContent = `
    body.editing [data-eid] { outline: 1px dashed rgba(142,43,32,.35); outline-offset: 2px; border-radius: 2px; cursor: text; }
    body.editing [data-eid]:hover { outline-color: rgba(142,43,32,.85); background-color: rgba(255,236,190,.35); }
    body.editing [data-eid]:focus { outline: 2px solid #8E2B20; background-color: rgba(255,236,190,.55); }
    body.editing [data-eid].edited { box-shadow: inset 3px 0 0 #3E7D52; }
    .ed-bar, .ed-card { font: 15px/1.4 "EB Garamond", Georgia, serif; color: #2B2118; }
    .ed-bar {
      position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); z-index: 1000;
      display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px 10px;
      width: max-content; max-width: calc(100vw - 20px); padding: 10px 14px; border-radius: 10px;
      background: #2B2118; color: #F1E5CB; box-shadow: 0 8px 24px rgba(0,0,0,.45);
    }
    .ed-bar .ed-msg { font-style: italic; opacity: .9; }
    .ed-bar button, .ed-card button {
      font: 600 14px "EB Garamond", Georgia, serif; letter-spacing: .03em; cursor: pointer;
      padding: 7px 12px; border-radius: 6px; border: 1px solid #D4B068; background: #D4B068; color: #2B2118;
    }
    .ed-bar button.ghost, .ed-card button.ghost { background: transparent; color: inherit; border-color: rgba(241,229,203,.5); }
    .ed-bar button:disabled { opacity: .45; cursor: default; }
    .ed-veil { position: fixed; inset: 0; z-index: 1001; background: rgba(20,12,6,.6); display: grid; place-items: center; padding: 16px; }
    .ed-card {
      width: min(440px, 100%); padding: 26px 26px 22px; border-radius: 6px; background: #F1E5CB;
      box-shadow: 0 20px 50px rgba(0,0,0,.5);
    }
    .ed-card h2 { font: 1.7rem "IM Fell English", Georgia, serif; margin: 0 0 .4rem; color: #2B2118; }
    .ed-card p, .ed-card li { margin: 0 0 .7rem; }
    .ed-card ol { padding-left: 1.3rem; margin: .4rem 0 1rem; }
    .ed-card input {
      width: 100%; font: 16px Georgia, serif; padding: 9px 10px; margin: .4rem 0 .6rem;
      border: 1px solid #A08A68; border-radius: 5px; background: #FFF9EC; color: #2B2118;
    }
    .ed-card .ed-row { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; margin-top: .6rem; }
    .ed-card .ed-row button.ghost { color: #2B2118; border-color: #A08A68; }
    .ed-card .ed-err { color: #8E2B20; min-height: 1.3em; margin: 0; font-style: italic; }
    .ed-card a { color: #7A2E22; }
    @media (max-width: 820px) { .stage { padding-bottom: 120px; } }
  `;
  document.head.append(style);

  /* ---------- passcode ---------- */
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

  function card(html) {
    const veil = document.createElement('div'); veil.className = 'ed-veil';
    const c = document.createElement('div'); c.className = 'ed-card'; c.innerHTML = html;
    veil.append(c); document.body.append(veil);
    return { veil, c };
  }

  function askPasscode() {
    return new Promise(resolve => {
      const { veil, c } = card(`
        <h2>Edit mode</h2>
        <p>Enter the passcode to edit this page.</p>
        <form><input type="password" autocomplete="current-password" aria-label="Passcode" placeholder="Passcode">
        <p class="ed-err" aria-live="polite"></p>
        <div class="ed-row"><button type="button" class="ghost" data-act="cancel">Cancel</button><button type="submit">Unlock</button></div></form>`);
      const input = c.querySelector('input'), err = c.querySelector('.ed-err');
      setTimeout(() => input.focus(), 50);
      c.querySelector('[data-act=cancel]').onclick = () => leave();
      c.querySelector('form').onsubmit = e => {
        e.preventDefault();
        if (sha256(input.value) === PASS_HASH) { remember(); veil.remove(); resolve(); }
        else { err.textContent = 'That passcode isn’t right. Try again.'; input.select(); }
      };
    });
  }

  /* ---------- editing ---------- */
  function enable() {
    if (window.bookOpen) window.bookOpen();
    document.body.classList.add('editing');
    document.querySelectorAll('[data-eid]').forEach(el => { el.contentEditable = 'true'; el.spellcheck = true; });

    document.addEventListener('input', e => {
      const el = e.target.closest && e.target.closest('[data-eid]');
      if (!el || el.closest('.leaf')) return;
      changed.set(el.dataset.eid, el); el.classList.add('edited'); update();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey && e.target.isContentEditable) { e.preventDefault(); e.target.blur(); }
    });
    document.addEventListener('paste', e => {
      if (!e.target.closest || !e.target.closest('[data-eid]')) return;
      e.preventDefault();
      document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain'));
    });
    // Links inside editable text shouldn't navigate away while editing
    window.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a');
      if (a && a.closest('[data-eid], .chapter') && !a.closest('.ed-bar, .ed-card')) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    window.addEventListener('beforeunload', e => { if (changed.size) { e.preventDefault(); e.returnValue = ''; } });
    bar();
  }

  let msg, copyBtn, dlBtn;
  function bar() {
    const b = document.createElement('div'); b.className = 'ed-bar';
    b.innerHTML = `<span class="ed-msg"></span>
      <button type="button" data-act="copy">Copy updated page</button>
      <button type="button" class="ghost" data-act="download">Download</button>
      <button type="button" class="ghost" data-act="exit">Exit</button>`;
    document.body.append(b);
    msg = b.querySelector('.ed-msg'); copyBtn = b.querySelector('[data-act=copy]'); dlBtn = b.querySelector('[data-act=download]');
    copyBtn.onclick = copy; dlBtn.onclick = download;
    b.querySelector('[data-act=exit]').onclick = () => {
      if (changed.size && !confirm('You have changes you haven’t copied. Leave edit mode anyway?')) return;
      changed.clear(); leave();
    };
    update();
  }

  function update() {
    const n = changed.size;
    msg.textContent = n ? `${n} change${n === 1 ? '' : 's'}` : 'Edit mode: click any outlined text to change it';
    copyBtn.disabled = dlBtn.disabled = !n;
  }

  function leave() { location.href = location.pathname + location.hash; }

  /* ---------- building the updated index.html ---------- */
  function cleanHTML(html) {
    return html
      .replace(/&nbsp;/g, ' ')
      .replace(/\s(contenteditable|spellcheck)="[^"]*"/g, '')
      .replace(/(<br\s*\/?>\s*)+$/i, '')
      .trim();
  }

  async function build() {
    const res = await fetch(location.pathname, { cache: 'no-store' });
    if (!res.ok) throw new Error('fetch');
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    const els = [...doc.querySelectorAll(SEL)].filter(el => !el.querySelector(SEL));
    if (els.length !== TOTAL) throw new Error('mismatch');
    changed.forEach((live, eid) => {
      const target = els[+eid];
      target.innerHTML = cleanHTML(live.innerHTML);
      // numbers the page fills in by itself are put back empty
      target.querySelectorAll('.count, .certs-count, #year').forEach(x => { x.textContent = ''; });
    });
    return '<!doctype html>\n' + doc.documentElement.outerHTML + '\n';
  }

  function failed(e) {
    card(`<h2>Something went wrong</h2>
      <p>${e && e.message === 'mismatch'
        ? 'The website was updated since you opened edit mode. Copy your new wording somewhere safe, reload this page, and make your changes again.'
        : 'Couldn’t load the page’s original file. Check your internet connection and try again.'}</p>
      <div class="ed-row"><button type="button" onclick="this.closest('.ed-veil').remove()">OK</button></div>`);
  }

  async function copy() {
    let html;
    try { html = await build(); } catch (e) { failed(e); return; }
    let ok = false;
    try { await navigator.clipboard.writeText(html); ok = true; } catch {
      const t = document.createElement('textarea'); t.value = html; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.append(t); t.select();
      try { ok = document.execCommand('copy'); } catch {}
      t.remove();
    }
    if (!ok) { download(); return; }
    const { veil, c } = card(`
      <h2>Copied!</h2>
      <p>Your updated page is copied. To publish it:</p>
      <ol>
        <li>Open <a href="${GITHUB_EDIT}" target="_blank" rel="noopener">index.html on GitHub</a> (it opens in a new tab, ready to edit).</li>
        <li>Click inside the code, select everything (<b>Ctrl+A</b>, or <b>Cmd+A</b> on a Mac), then paste (<b>Ctrl+V</b> / <b>Cmd+V</b>).</li>
        <li>Click the green <b>Commit changes</b> button, then <b>Commit changes</b> again.</li>
      </ol>
      <p>Your site updates within a minute or two.</p>
      <div class="ed-row"><button type="button" class="ghost" data-act="keep">Keep editing</button><button type="button" data-act="done">Done</button></div>`);
    c.querySelector('[data-act=keep]').onclick = () => veil.remove();
    c.querySelector('[data-act=done]').onclick = () => { changed.clear(); leave(); };
  }

  async function download() {
    let html;
    try { html = await build(); } catch (e) { failed(e); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    a.download = 'index.html'; document.body.append(a); a.click(); a.remove();
  }

  (isUnlocked() ? Promise.resolve() : askPasscode()).then(enable);
})();
