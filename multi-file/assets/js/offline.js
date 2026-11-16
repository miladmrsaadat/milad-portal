/* Phase 4 offline utilities: recycle, undo, encrypted backup, shareable export,
   weekly review, system health, local assistant, knowledge, notifications.
   No live APIs. Finance seed is never rewritten here. */
(function () {
  const K = 'mss_offline_v1';
  const K_DETACH = 'mss_finance_detached';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fa = n => (n == null ? '' : String(n)).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const now = () => Date.now();

  function load() {
    let d = null; try { d = JSON.parse(STORE.getItem(K)); } catch (e) { }
    if (!d || typeof d !== 'object') d = {};
    if (!Array.isArray(d.recycle)) d.recycle = [];
    if (!Array.isArray(d.undo)) d.undo = [];
    if (!Array.isArray(d.knowledge)) d.knowledge = [];
    if (!Array.isArray(d.receivables)) d.receivables = [];
    if (!Array.isArray(d.assets)) d.assets = [];
    if (!Array.isArray(d.weekly)) d.weekly = [];
    d.prefs = d.prefs && typeof d.prefs === 'object' ? d.prefs : { excludeFin: false, subtitle: '' };
    return d;
  }
  let O = load();
  const save = () => { try { STORE.setItem(K, JSON.stringify(O)); } catch (e) { } };

  function jdot(ts) {
    try { if (typeof window.jdot === 'function') return window.jdot(ts); } catch (e) { }
    try {
      const p = {}; new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ts)).forEach(x => p[x.type] = x.value);
      return (p.year || '') + '/' + (p.month || '') + '/' + (p.day || '');
    } catch (e) { return ''; }
  }

  /* ---------- recycle + undo ---------- */
  function trash(kind, title, payload) {
    const rec = { id: 'r' + now().toString(36) + Math.random().toString(36).slice(2, 5), kind, title: String(title || 'مورد').slice(0, 180), at: now(), payload };
    O.recycle.unshift(rec);
    if (O.recycle.length > 200) O.recycle.length = 200;
    pushUndo('بازیابی «' + rec.title + '»', () => restore(rec.id, true));
    save();
    return rec;
  }
  function restore(id, silent) {
    const i = O.recycle.findIndex(x => x.id === id); if (i < 0) return false;
    const rec = O.recycle.splice(i, 1)[0];
    try {
      if (rec.kind === 'project' && rec.payload && (typeof S !== "undefined" ? S : null)) { S.projects.push(rec.payload); if (typeof saveS === 'function') saveS(); }
      else if (rec.kind === 'tx' && rec.payload && window.Finance) { const F = Finance.data(); F.tx.push(rec.payload); F.tx.sort((a, b) => a.date - b.date); Finance.importData ? (STORE.setItem('mss_finance_v1', JSON.stringify(F))) : null; try { STORE.setItem('mss_finance_v1', JSON.stringify(F)); } catch (e) { } }
      else if (rec.kind === 'agent' && rec.payload && window.Agents) { const D = Agents.data(); D.items.push(rec.payload); try { STORE.setItem('mss_agents_v1', JSON.stringify(D)); } catch (e) { } }
    } catch (e) { }
    save();
    if (!silent && window.toast) toast('از سطل بازیافت برگردانده شد ✓', 'ok');
    return true;
  }
  function pushUndo(label, fn) {
    O.undo.push({ at: now(), label: String(label || 'عمل').slice(0, 120) });
    if (O.undo.length > 20) O.undo.shift();
    save();
    window.__undoFns = window.__undoFns || [];
    window.__undoFns.push(fn);
    if (window.__undoFns.length > 20) window.__undoFns.shift();
  }
  function undoLast() {
    const fns = window.__undoFns || [];
    const fn = fns.pop();
    const meta = O.undo.pop();
    save();
    if (typeof fn === 'function') { fn(); if (window.toast) toast('برگردانده شد: ' + (meta && meta.label || ''), 'ok'); return true; }
    if (window.toast) toast('چیزی برای برگرداندن در این نشست نیست');
    return false;
  }

  /* ---------- crypto (Web Crypto, with SHA-based fallback) ---------- */
  function b64e(buf) {
    const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    return btoa(s);
  }
  function b64d(s) {
    const bin = atob(s); const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function sha256bytes(bytes) {
    if (window.FinLock && typeof FinLock.sha256bytes === 'function') return FinLock.sha256bytes(bytes);
    // small sync SHA-256
    const Kp = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
    const arr = bytes instanceof Uint8Array ? bytes : new TextEncoder().encode(String(bytes));
    const len = arr.length; const bit = len * 8;
    const pad = ((len + 9 + 63) >> 6) << 6; const p = new Uint8Array(pad);
    p.set(arr); p[len] = 0x80; new DataView(p.buffer).setUint32(pad - 4, bit, false);
    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a, h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    const w = new Uint32Array(64); const dv = new DataView(p.buffer);
    for (let i = 0; i < pad; i += 64) {
      for (let j = 0; j < 16; j++) w[j] = dv.getUint32(i + j * 4, false);
      for (let j = 16; j < 64; j++) { const s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3); const s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10); w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0; }
      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let j = 0; j < 64; j++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g), t1 = (h + S1 + ch + Kp[j] + w[j]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), maj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
    }
    const out = new Uint8Array(32); const o = new DataView(out.buffer);
    [h0, h1, h2, h3, h4, h5, h6, h7].forEach((v, i) => o.setUint32(i * 4, v, false));
    return out;
  }
  function deriveKey(pass, salt, iter) {
    let u = new Uint8Array(salt.length + new TextEncoder().encode(pass).length);
    const p = new TextEncoder().encode(pass);
    u = new Uint8Array(p.length + salt.length); u.set(p); u.set(salt, p.length);
    let g = sha256bytes(u);
    for (let i = 1; i < iter; i++) g = sha256bytes(g);
    return g;
  }
  function xorStream(data, key) {
    const out = new Uint8Array(data.length);
    let block = key;
    for (let i = 0; i < data.length; i++) {
      if (i % 32 === 0) { const ctr = new Uint8Array(36); ctr.set(key); ctr[32] = (i / 32) & 255; ctr[33] = ((i / 32) >> 8) & 255; ctr[34] = ((i / 32) >> 16) & 255; ctr[35] = 1; block = sha256bytes(ctr); }
      out[i] = data[i] ^ block[i % 32];
    }
    return out;
  }
  async function encryptJson(obj, password) {
    const plain = new TextEncoder().encode(JSON.stringify(obj));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    if (crypto.subtle) {
      try {
        const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
        const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
        const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
        return { app: 'milad-saadat-portal', enc: true, v: 1, alg: 'AES-GCM', kdf: 'PBKDF2-SHA-256', iter: 120000, salt: b64e(salt), iv: b64e(iv), ct: b64e(ct) };
      } catch (e) { /* fall through */ }
    }
    const key = deriveKey(password, salt, 20000);
    const ct = xorStream(plain, key);
    const mac = sha256bytes(new Uint8Array([...key, ...ct]));
    return { app: 'milad-saadat-portal', enc: true, v: 1, alg: 'SHA-CTR', kdf: 'SHA-256', iter: 20000, salt: b64e(salt), iv: b64e(iv), ct: b64e(ct), mac: b64e(mac) };
  }
  async function decryptJson(pack, password) {
    if (!pack || !pack.enc || !pack.ct) throw new Error('این فایل رمزگذاری‌شده نیست');
    const salt = b64d(pack.salt), iv = b64d(pack.iv), ct = b64d(pack.ct);
    if (pack.alg === 'AES-GCM' && crypto.subtle) {
      const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
      const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: pack.iter || 120000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
      return JSON.parse(new TextDecoder().decode(pt));
    }
    const key = deriveKey(password, salt, pack.iter || 20000);
    if (pack.mac) {
      const mac = sha256bytes(new Uint8Array([...key, ...ct]));
      if (b64e(mac) !== pack.mac) throw new Error('رمز نادرست است');
    }
    const pt = xorStream(ct, key);
    return JSON.parse(new TextDecoder().decode(pt));
  }

  function snapshot(opts) {
    opts = opts || {};
    const data = { app: 'milad-saadat-portal', exportedAt: new Date().toISOString(), portal: (typeof S !== "undefined" ? S : null) || null, checklist: (typeof CK !== "undefined" ? CK : null) || null, daily: window.Daily ? Daily.data() : null, agents: window.Agents ? Agents.data() : null, extras: window.Extras ? Extras.data() : null, offline: O, muted: STORE.getItem('mss_muted'), storage: {} };
    if (!opts.excludeFinance) {
      data.finance = window.Finance ? Finance.data() : null;
    } else {
      data.financeOmitted = true;
    }
    try {
      const add = k => { if (!k || k.indexOf('mss_') !== 0) return; if (opts.excludeFinance && (k === 'mss_finance_v1' || k === 'mss_finance_pin' || k === 'mss_fin_ok' || k === 'mss_finance_detached')) return; const v = STORE.getItem(k); if (v != null) data.storage[k] = v; };
      Object.keys(STORE).forEach(add);
      ['mss_portal_v1', 'mss_checklist_v1', 'mss_finance_v1', 'mss_daily_v1', 'mss_agents_v1', 'mss_extras_v1', 'mss_offline_v1', 'mss_muted', 'mss_finance_pin'].forEach(add);
    } catch (e) { }
    return data;
  }
  function downloadJson(name, obj) {
    const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function markBackup() { O.lastBackupAt = now(); save(); }

  function projectsCsv() {
    const rows = [['شناسه', 'دسته', 'عنوان', 'زیرمجموعه', 'پیشرفت', 'اقدام بعدی', 'تعریف پایان', 'برچسب‌ها', 'بایگانی']];
    ((typeof S !== "undefined" ? S : null) && S.projects || []).forEach(p => rows.push([p.id, p.cat || '', p.title || '', p.sub || '', p.progress || 0, p.next || '', p.finish || '', (p.tags || []).join('، '), p.archived ? '1' : '']));
    return '\ufeff' + rows.map(r => r.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(',')).join('\n');
  }

  /* ---------- notifications ---------- */
  function canNotify() { return typeof Notification !== 'undefined' && Notification.permission === 'granted'; }
  function askNotify() {
    if (typeof Notification === 'undefined') { if (window.toast) toast('این مرورگر اعلان ندارد'); return Promise.resolve(false); }
    return Notification.requestPermission().then(p => p === 'granted');
  }
  function notify(title, body, key) {
    const k = key || title;
    O.notify = O.notify || { last: {} };
    if (O.notify.last[k] && now() - O.notify.last[k] < 6 * 3600e3) return;
    O.notify.last[k] = now(); save();
    try { if (canNotify()) new Notification(title || 'پورتال میلاد', { body: body || '' }); else if (window.toast) toast((title || '') + (body ? ' — ' + body : ''), 'ok'); } catch (e) { if (window.toast) toast(body || title, 'ok'); }
  }
  function tickReminders() {
    try {
      if (window.Finance && Finance.data().subs) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        Finance.data().subs.filter(s => s && s.active !== false && s.next).forEach(s => {
          const t = +s.next || 0; if (!t) return;
          const days = Math.round((t - today.getTime()) / 864e5);
          if (days <= 3 && days >= 0) notify('تمدید اشتراک', '«' + s.name + '» تا ' + fa(days) + ' روز دیگر', 'sub-' + s.id);
        });
      }
    } catch (e) { }
  }

  /* ---------- knowledge ---------- */
  function addKnowledge(o) {
    const rec = { id: 'k' + now().toString(36), projectId: o.projectId || '', type: o.type || 'note', title: String(o.title || 'بدون عنوان').slice(0, 160), body: String(o.body || '').slice(0, 8000), at: now(), ver: 1 };
    const prev = O.knowledge.filter(x => x.projectId === rec.projectId && x.title === rec.title);
    if (prev.length) rec.ver = Math.max(...prev.map(x => x.ver || 1)) + 1;
    O.knowledge.unshift(rec); save(); return rec;
  }

  /* ---------- pages ---------- */
  function pageWrap(title, body) {
    const tb = typeof topbar === 'function' ? topbar(title, '') : `<header class="topbar"><h1>${esc(title)}</h1></header>`;
    return `${tb}<main class="page off-page">${body}</main>`;
  }
  function renderRecycle(view) {
    const rows = O.recycle.map(r => `<tr><td>${jdot(r.at)}</td><td>${esc({ project: 'پروژه', tx: 'تراکنش', agent: 'ایجنت', task: 'تسک' }[r.kind] || r.kind)}</td><td>${esc(r.title)}</td><td><button class="fin-chip" data-res="${r.id}">بازیابی</button><button class="x-del" data-forget="${r.id}">✕</button></td></tr>`).join('') || '<tr><td colspan="4">سطل خالی است</td></tr>';
    view.innerHTML = pageWrap('سطل بازیافت', `<section class="glass off-card"><h3>سطل بازیافت</h3><p class="x-sub">حذف نرم است؛ موارد تا ۲۰۰ رکورد اینجا می‌مانند و قابل بازیابی‌اند. در همین نشست، «برگرداندن آخرین کار» هم کار می‌کند.</p>
      <div class="rep-actions"><button class="btn" id="off-undo">↩ برگرداندن آخرین کار</button></div>
      <table class="ftab"><thead><tr><th>تاریخ</th><th>نوع</th><th>عنوان</th><th></th></tr></thead><tbody>${rows}</tbody></table></section>`);
    view.onclick = e => {
      const r = e.target.closest('[data-res]'); if (r) { restore(r.dataset.res); renderRecycle(view); return; }
      const f = e.target.closest('[data-forget]'); if (f) { O.recycle = O.recycle.filter(x => x.id !== f.dataset.forget); save(); renderRecycle(view); return; }
      if (e.target.id === 'off-undo') { undoLast(); renderRecycle(view); }
    };
  }
  function renderHealth(view) {
    let storeN = 0, storeB = 0;
    try { for (let i = 0; i < STORE.length; i++) { const k = STORE.key(i); const v = STORE.getItem(k); storeN++; storeB += (k || '').length + (v || '').length; } } catch (e) { }
    const pin = (() => { try { return !!STORE.getItem('mss_finance_pin'); } catch (e) { return false; } })();
    const det = (() => { try { return STORE.getItem(K_DETACH) === '1'; } catch (e) { return false; } })();
    const sw = (navigator.serviceWorker && navigator.serviceWorker.controller) ? 'فعال' : (location.protocol === 'file:' ? 'روی file:// ثبت نمی‌شود' : 'ثبت نشده');
    view.innerHTML = pageWrap('سلامت سیستم', `<section class="glass off-card"><h3>سلامت سیستم</h3><ul class="off-health">
      <li><b>آخرین پشتیبان معمولی:</b> ${O.lastBackupAt ? jdot(O.lastBackupAt) : 'هنوز گرفته نشده'}</li>
      <li><b>آخرین پشتیبان رمزگذاری‌شده:</b> ${O.lastEncBackupAt ? jdot(O.lastEncBackupAt) : '—'}</li>
      <li><b>حجم ذخیرهٔ مرورگر:</b> ${fa(storeN)} کلید · حدود ${fa(Math.round(storeB / 1024))} کیلوبایت</li>
      <li><b>قفل PIN مالی:</b> ${pin ? 'تنظیم شده' : 'تنظیم نشده'}</li>
      <li><b>جداسازی داده مالی:</b> ${det ? 'فعال — سید داخلی بارگذاری نمی‌شود' : 'غیرفعال (پیش‌فرض)'}</li>
      <li><b>سطل بازیافت:</b> ${fa(O.recycle.length)} مورد</li>
      <li><b>پروتکل:</b> ${esc(location.protocol)} · اعلان: ${canNotify() ? 'مجاز' : 'مجاز نیست'}</li>
      <li><b>سرویس‌ورکر:</b> ${sw}</li>
    </ul>
    <div class="rep-actions"><button class="btn" id="h-notif">اجازهٔ اعلان محلی</button><button class="btn ghost" data-go="recycle">سطل بازیافت</button></div></section>`);
    $('#h-notif', view) && ($('#h-notif', view).onclick = () => askNotify().then(() => renderHealth(view)));
    view.querySelector('[data-go]') && (view.querySelector('[data-go]').onclick = () => go('recycle'));
  }
  function renderReview(view) {
    const stale = ((typeof S !== "undefined" ? S : null) && S.projects || []).filter(p => typeof isStale === 'function' ? isStale(p) : (!p.done && p.progress < 100 && (now() - (p.lastProgressAt || p.createdAt || 0)) > 7 * 864e5));
    const running = ((typeof S !== "undefined" ? S : null) && S.projects || []).filter(p => typeof isRunning === 'function' ? isRunning(p) : (!p.done && p.progress > 0 && p.progress < 100));
    const note = (window.Extras && Extras.data && Extras.data().review) || '';
    const weekKey = jdot(now()).slice(0, 8);
    view.innerHTML = pageWrap('مرور هفتگی', `<section class="glass off-card"><h3>پروژه‌های راکد (بیش از ۷ روز بدون پیشرفت)</h3>
      ${stale.length ? `<ul class="off-list">${stale.map(p => `<li><a href="#/${esc(p.cat)}">${esc(p.title)}</a> · ${fa(p.progress)}٪</li>`).join('')}</ul>` : '<p>مورد راکدی نیست ✓</p>'}
      <h3>در حال اجرا</h3><p>${fa(running.length)} پروژه</p>
      <h3>آخرین مرور شب</h3><blockquote>${esc(note) || 'هنوز مرور شبی ثبت نشده'}</blockquote>
      <h3>خلاصهٔ این هفته</h3>
      <textarea id="wk-note" rows="4" maxlength="2000" placeholder="جمع‌بندی هفته…">${esc((O.weekly.find(w => w.weekKey === weekKey) || {}).text || '')}</textarea>
      <div class="rep-actions"><button class="btn" id="wk-save">ثبت خلاصهٔ هفته</button></div>
      <h4>بایگانی هفته‌ها</h4>
      <ul class="off-list">${O.weekly.slice(0, 12).map(w => `<li>${esc(w.weekKey)} — ${esc((w.text || '').slice(0, 80))}</li>`).join('') || '<li>—</li>'}</ul>
    </section>`);
    $('#wk-save', view).onclick = () => {
      const text = $('#wk-note', view).value.trim();
      const i = O.weekly.findIndex(w => w.weekKey === weekKey);
      const rec = { weekKey, text, at: now() };
      if (i >= 0) O.weekly[i] = rec; else O.weekly.unshift(rec);
      save(); if (window.toast) toast('خلاصهٔ هفته ثبت شد ✓', 'ok');
    };
  }
  function renderAssist(view) {
    const tips = [];
    const stale = ((typeof S !== "undefined" ? S : null) && S.projects || []).filter(p => typeof isStale === 'function' && isStale(p));
    if (stale.length) tips.push('«' + stale.slice(0, 3).map(p => p.title).join('»، «') + '» بیش از یک هفته راکد مانده‌اند.');
    try { if (window.PortalWork && PortalWork.activeWork().length >= 3) tips.push('سقف ۳ پروژهٔ فعال پر است؛ ایدهٔ جدید را در صف بگذار.'); } catch (e) { }
    try { const subs = (window.Finance && Finance.data().subs) || []; const due = subs.filter(s => s.next && s.next - now() < 5 * 864e5 && s.active !== false); if (due.length) tips.push(due.length + ' اشتراک تا ۵ روز دیگر تمدید می‌شود.'); } catch (e) { }
    if (O.recycle.length) tips.push(fa(O.recycle.length) + ' مورد در سطل بازیافت است.');
    if (!O.lastBackupAt || now() - O.lastBackupAt > 7 * 864e5) tips.push('بیش از یک هفته از آخرین پشتیبان گذشته؛ یک خروجی بگیر.');
    view.innerHTML = pageWrap('دستیار محلی', `<section class="glass off-card"><h3>دستیار محلی</h3><p class="x-sub">این دستیار آنلاین نیست و مدل زبانی ندارد؛ فقط از داده‌های همین دستگاه پیشنهاد می‌سازد.</p>
      ${tips.length ? `<ul class="off-list">${tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '<p>الان مورد فوری‌ای نیست ✓</p>'}
      <div class="rep-actions"><button class="btn ghost" data-go="review">مرور هفتگی</button><button class="btn ghost" data-go="health">سلامت سیستم</button></div></section>`);
    view.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  }
  function renderKnowledge(view, pid) {
    const list = O.knowledge.filter(k => !pid || k.projectId === pid);
    view.innerHTML = pageWrap('کتابخانه دانش', `<section class="glass off-card"><h3>کتابخانه دانش</h3>
      <form id="k-form" class="form"><div class="fld"><label>عنوان</label><input name="title" required maxlength="160"></div>
      <div class="fld"><label>نوع</label><select name="type"><option value="prompt">پرامپت</option><option value="decision">تصمیم</option><option value="note">یادداشت</option></select></div>
      <div class="fld full"><label>متن</label><textarea name="body" rows="5" maxlength="8000"></textarea></div>
      <input type="hidden" name="projectId" value="${esc(pid || '')}">
      <button class="btn solid" type="submit">ثبت نسخه</button></form>
      <ul class="off-list">${list.map(k => `<li><b>${esc(k.title)}</b> · ${esc(k.type)} · نسخه ${fa(k.ver)} · ${jdot(k.at)}<div class="dim">${esc((k.body || '').slice(0, 200))}</div></li>`).join('') || '<li>موردی نیست</li>'}</ul>
    </section>`);
    $('#k-form', view).onsubmit = e => { e.preventDefault(); const f = e.target; addKnowledge({ title: f.title.value, type: f.type.value, body: f.body.value, projectId: f.projectId.value }); if (window.toast) toast('نسخه ثبت شد ✓', 'ok'); renderKnowledge(view, pid); };
  }

  /* ---------- finance helpers used by finance.js ---------- */
  function projectCost(p) {
    if (!window.Finance || !p) return { spent: 0, n: 0, hours: +p.hours || 0 };
    const F = Finance.data();
    const txs = (F.tx || []).filter(t => !t.deletedAt && (t.project === p.id || t.project === p.title));
    const spent = txs.filter(t => t.type === 'out' && !Finance.domain.isInternal(t)).reduce((s, t) => s + t.amount, 0);
    return { spent, n: txs.length, hours: +p.hours || 0 };
  }

  function boot() {
    try { tickReminders(); setInterval(tickReminders, 10 * 60 * 1000); } catch (e) { }
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) { e.preventDefault(); undoLast(); }
    });
  }

  window.Offline = {
    data: () => O, save, trash, restore, undoLast, pushUndo,
    encryptJson, decryptJson, snapshot, downloadJson, markBackup, projectsCsv,
    notify, askNotify, canNotify, addKnowledge, projectCost, load,
    lastBackup: () => { O.lastBackupAt = now(); save(); },
    lastEnc: () => { O.lastEncBackupAt = now(); save(); },
    prefs: () => O.prefs,
    setPref(k, v) { O.prefs[k] = v; save(); },
    renderRecycle, renderHealth, renderReview, renderAssist, renderKnowledge,
    detachFlag: K_DETACH, boot
  };

  if (typeof ROUTES !== 'undefined') {
    ROUTES['recycle'] = () => renderRecycle(document.getElementById('view'));
    ROUTES['health'] = () => renderHealth(document.getElementById('view'));
    ROUTES['review'] = () => renderReview(document.getElementById('view'));
    ROUTES['assist'] = () => renderAssist(document.getElementById('view'));
    ROUTES['knowledge'] = () => renderKnowledge(document.getElementById('view'));
  }
  try { boot(); } catch (e) { }
})();
