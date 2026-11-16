/* ================= «مدیریت امور روزانه» — Daily command center =================
   Original implementation for Milad Saadat's portal. Vanilla JS, offline, data only in STORE (localStorage shim).
   Week = Saturday→Friday · Jalali calendar 1402–1410 (own converter, no network) · pointer-based drag&drop (mouse + touch) */
window.Daily = (() => {
  'use strict';
  const K = 'mss_daily_v1';
  const MINY = 1402, MAXY = 1410;
  const q = (s, r = document) => r.querySelector(s), qa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const FD = '۰۱۲۳۴۵۶۷۸۹';
  const fa = v => String(v).replace(/\d/g, d => FD[d]);
  const pad = n => String(n).padStart(2, '0');
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const sfx = n => { try { window.SFX && SFX[n] && SFX[n](); } catch (e) { } };
  const say = (m, t) => { try { window.toast ? toast(m, t) : console.log(m); } catch (e) { } };
  const nowMs = () => Date.now();

  /* ---------- Jalali <-> JDN (arithmetic, Borkowski/jalaali algorithm) ---------- */
  const div = (a, b) => ~~(a / b), mod = (a, b) => a - ~~(a / b) * b;
  const BR = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  function jalCal(jy) {
    let gy = jy + 621, leapJ = -14, jp = BR[0], jm, jump = 0, n, i;
    for (i = 1; i < BR.length; i++) { jm = BR[i]; jump = jm - jp; if (jy < jm) break; leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4); jp = jm; }
    n = jy - jp; leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
    const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150, march = 20 + leapJ - leapG;
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    let leap = mod(mod(n + 1, 33) - 1, 4); if (leap === -1) leap = 4;
    return { leap, gy, march };
  }
  function g2d(gy, gm, gd) { let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408; return d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752; }
  function d2g(jdn) { let j = 4 * jdn + 139361631; j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908; const i = div(mod(j, 1461), 4) * 5 + 308; const gd = div(mod(i, 153), 5) + 1, gm = mod(div(i, 153), 12) + 1; return [div(j, 1461) - 100100 + div(8 - gm, 6), gm, gd]; }
  function j2d(jy, jm, jd) { const r = jalCal(jy); return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1; }
  function d2j(jdn) {
    const gy = d2g(jdn)[0]; let jy = gy - 621; const r = jalCal(jy); let k = jdn - g2d(gy, 3, r.march), jm, jd;
    if (k >= 0) { if (k <= 185) { return [jy, 1 + div(k, 31), mod(k, 31) + 1]; } k -= 186; }
    else { jy -= 1; k += 179; if (r.leap === 1) k += 1; }
    jm = 7 + div(k, 30); jd = mod(k, 30) + 1; return [jy, jm, jd];
  }
  const isLeap = jy => jalCal(jy).leap === 0;
  const mLen = (jy, jm) => jm <= 6 ? 31 : jm <= 11 ? 30 : (isLeap(jy) ? 30 : 29);
  const todayJ = () => { const d = new Date(); return g2d(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
  const sat = jdn => mod(jdn + 2, 7);               // 0 = Saturday ... 6 = Friday
  const weekStart = jdn => jdn - sat(jdn);
  const MINJ = j2d(MINY, 1, 1), MAXJ = j2d(MAXY + 1, 1, 1) - 1;
  const clampJ = j => Math.max(MINJ, Math.min(MAXJ, j));
  const keyOf = jdn => { const [y, m, d] = d2j(jdn); return `${y}-${pad(m)}-${pad(d)}`; };
  const jOf = k => { const [y, m, d] = k.split('-').map(Number); return j2d(y, m, d); };
  const MN = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  const WD = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
  const WDS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
  const fmtD = (jdn, o = {}) => { const [y, m, d] = d2j(jdn); return `${o.wd === false ? '' : WD[sat(jdn)] + ' '}${fa(d)} ${MN[m - 1]}${o.y === false ? '' : ' ' + fa(y)}`; };

  /* ---------- time formatting ---------- */
  const hms = sec => { sec = Math.max(0, Math.round(sec)); const H = div(sec, 3600), M = div(sec % 3600, 60), S2 = sec % 60; return fa(H ? `${H}:${pad(M)}:${pad(S2)}` : `${pad(M)}:${pad(S2)}`); };
  const mins = m => { m = Math.round(m); if (m < 60) return `${fa(m)} دقیقه`; const H = div(m, 60), M = m % 60; return `${fa(H)} ساعت${M ? ' و ' + fa(M) + ' دقیقه' : ''}`; };

  /* ---------- model ---------- */
  const PRIO = { norm: { n: 'عادی', c: '#7cb4ff', w: 0 }, imp: { n: 'مهم', c: '#f5c55a', w: 1 }, urg: { n: 'فوری', c: '#ff2e4d', w: 2 } };
  const COLORS = ['#2f7bff', '#a78bfa', '#22d3ee', '#22c55e', '#f5c55a', '#ff6b81', '#ff8a3d', '#e879f9', '#84cc16', '#ff2e4d'];
  function seed() {
    const B = (title, cat, m, prio, routine) => ({ id: uid(), title, cat, mins: m, prio: prio || 'norm', routine: routine || [], sample: true });
    return {
      version: 1, createdAt: nowMs(),
      cats: [
        { id: 'work', name: 'کار و پروژه', icon: '💼', color: '#2f7bff' },
        { id: 'ai', name: 'AI و تولید محتوا', icon: '🤖', color: '#a78bfa' },
        { id: 'learn', name: 'مطالعه و رشد فردی', icon: '📚', color: '#22d3ee' },
        { id: 'health', name: 'ورزش و سلامت', icon: '💪', color: '#22c55e' },
        { id: 'home', name: 'خانه و خانواده', icon: '🏡', color: '#f5c55a' },
        { id: 'me', name: 'شخصی', icon: '✨', color: '#ff6b81' }],
      bank: [
        B('مرور اولویت‌های امروز (نمونه)', 'work', 15, 'imp', [0, 1, 2, 3, 4]),
        B('بلوک تمرکز روی پروژهٔ اصلی (نمونه)', 'work', 90, 'urg', [0, 1, 2, 3]),
        B('پاسخ به پیام‌ها و ایمیل‌ها (نمونه)', 'work', 20),
        B('تست یک ایدهٔ AI جدید (نمونه)', 'ai', 45),
        B('مطالعه — ۲۰ صفحه (نمونه)', 'learn', 30, 'norm', [0, 1, 2, 3, 4, 5, 6]),
        B('پیاده‌روی یا ورزش سبک (نمونه)', 'health', 30, 'norm', [0, 2, 4]),
        B('وقت آزاد با خانواده (نمونه)', 'home', 60),
        B('مرور هفته و برنامهٔ هفتهٔ بعد (نمونه)', 'me', 30, 'imp', [6])],
      goals: [
        { id: uid(), title: 'مطالعهٔ کتاب (نمونه)', unit: 'صفحه', target: 300, value: 0, step: 10, color: '#22d3ee', sample: true, log: {} },
        { id: uid(), title: 'جلسات ورزش (نمونه)', unit: 'جلسه', target: 20, value: 0, step: 1, color: '#22c55e', sample: true, log: {} }],
      days: {}, timer: null,
      pomo: { len: 25, mode: 'focus', running: false, endsAt: 0, remain: 1500, link: '', log: {} },
      ui: { tab: 'desk', view: 'day' }
    };
  }
  function valid(v) {
    if (!v || v.version !== 1 || !Array.isArray(v.cats) || !Array.isArray(v.bank) || !Array.isArray(v.goals) || !v.days || typeof v.days !== 'object') return false;
    if (!v.cats.length || !v.cats.every(c => c && c.id && c.name)) return false;
    if (!v.bank.every(b => b && b.id && typeof b.title === 'string') || !v.goals.every(g => g && g.id && typeof g.title === 'string')) return false;
    for (const k in v.days) { const d = v.days[k]; if (!/^\d{4}-\d\d-\d\d$/.test(k) || !d || !Array.isArray(d.tasks) || !d.tasks.every(t => t && typeof t.title === 'string')) return false; }
    return true;
  }
  function normalize(v) {
    const s = seed();
    v.pomo = Object.assign(s.pomo, v.pomo && typeof v.pomo === 'object' ? v.pomo : {}); if (!v.pomo.log || typeof v.pomo.log !== 'object') v.pomo.log = {};
    v.ui = Object.assign(s.ui, v.ui && typeof v.ui === 'object' ? v.ui : {});
    if (v.timer && !(v.timer.k && v.timer.id && v.timer.since)) v.timer = null;
    v.goals.forEach(g => { if (!g.log || typeof g.log !== 'object') g.log = {}; g.target = +g.target || 1; g.value = +g.value || 0; g.step = +g.step || 1; });
    v.bank.forEach(b => { if (!Array.isArray(b.routine)) b.routine = []; b.mins = +b.mins || 0; if (!PRIO[b.prio]) b.prio = 'norm'; });
    for (const k in v.days) { if (typeof v.days[k].note !== 'string') v.days[k].note = ''; v.days[k].tasks.forEach(t => { t.spent = +t.spent || 0; t.target = +t.target || 0; if (!PRIO[t.prio]) t.prio = 'norm'; if (!t.id) t.id = uid(); }); }
    return v;
  }
  function loadD() {
    try { const v = JSON.parse(STORE.getItem(K)); if (valid(v)) return normalize(v); } catch (e) { }
    const s = seed(); try { STORE.setItem(K, JSON.stringify(s)); } catch (e) { } return s;
  }
  let D = loadD();
  const save = () => { for (const k in D.days) { const d = D.days[k]; if (!d.tasks.length && !d.note) delete D.days[k]; } STORE.setItem(K, JSON.stringify(D)); };
  const catOf = id => D.cats.find(c => c.id === id) || { id: '?', name: 'بدون دسته', icon: '•', color: '#8f9bc4' };
  const day = (jdn, make) => { const k = keyOf(jdn); if (!D.days[k] && make) D.days[k] = { tasks: [], note: '' }; return D.days[k] || { tasks: [], note: '' }; };
  const runSec = (k, t) => (D.timer && D.timer.k === k && D.timer.id === t.id) ? (nowMs() - D.timer.since) / 1000 : 0;
  const spentOf = (k, t) => (t.spent || 0) + runSec(k, t);
  const findTask = (k, id) => { const d = D.days[k]; return d ? d.tasks.find(t => t.id === id) : null; };
  const projects = () => { try { return (typeof S !== 'undefined' && S && Array.isArray(S.projects)) ? S.projects : []; } catch (e) { return []; } };
  const projCats = () => { try { return typeof CATS !== 'undefined' ? CATS : {}; } catch (e) { return {}; } };

  function dayStats(k) {
    const d = D.days[k]; if (!d) return { n: 0, done: 0, sec: 0, target: 0 };
    let sec = 0, target = 0, done = 0;
    d.tasks.forEach(t => { sec += spentOf(k, t); target += (t.target || 0); if (t.done) done++; });
    return { n: d.tasks.length, done, sec, target };
  }
  const activeKey = k => { const d = D.days[k]; return !!(d && d.tasks.some(t => t.done)) || !!(D.pomo.log[k] && D.pomo.log[k].s); };
  function streaks() {
    const t = todayJ(); let cur = 0, j = activeKey(keyOf(t)) ? t : t - 1;
    while (j >= MINJ && activeKey(keyOf(j))) { cur++; j--; }
    const act = [...new Set(Object.keys(D.days).concat(Object.keys(D.pomo.log)))].filter(activeKey).map(jOf).sort((a, b) => a - b);
    let best = 0, run = 0, prev = null; act.forEach(x => { run = (prev !== null && x === prev + 1) ? run + 1 : 1; best = Math.max(best, run); prev = x; });
    return { cur, best: Math.max(best, cur) };
  }

  /* ---------- timer (one live timer at a time) ---------- */
  function stopTimer(silent) {
    const T = D.timer; if (!T) return; const t = findTask(T.k, T.id);
    if (t) t.spent = (t.spent || 0) + (nowMs() - T.since) / 1000;
    D.timer = null; save(); if (!silent) sfx('close');
  }
  function startTimer(k, id) { if (D.timer) stopTimer(true); D.timer = { k, id, since: nowMs() }; save(); sfx('open'); }

  /* ---------- pomodoro ---------- */
  const P = () => D.pomo;
  const pRemain = () => P().running ? Math.max(0, (P().endsAt - nowMs()) / 1000) : P().remain;
  const pTotal = () => P().mode === 'break' ? 300 : P().len * 60;
  function credit(sec) {
    const L = P().link; const k = keyOf(todayJ());
    const lg = P().log[k] || (P().log[k] = { s: 0, m: 0 }); lg.m += Math.round(sec / 60);
    if (!L) return null; const [lk, id] = L.split('|'); const t = findTask(lk, id); if (!t) return null; t.spent = (t.spent || 0) + sec; return t;
  }
  function pomoFinish() {
    const p = P();
    if (p.mode === 'focus') {
      const t = credit(pTotal()); P().log[keyOf(todayJ())].s++;
      p.mode = 'break'; p.remain = 300; p.running = true; p.endsAt = nowMs() + 300000;
      sfx('done'); try { Sky.meteorShower(6); } catch (e) { }
      say(`جلسهٔ تمرکز تمام شد 🎉${t ? ' — زمان به «' + t.title + '» اضافه شد' : ''} · ۵ دقیقه استراحت`, 'ok');
    } else { p.mode = 'focus'; p.remain = p.len * 60; p.running = false; p.endsAt = 0; sfx('save'); say('استراحت تمام شد؛ آمادهٔ جلسهٔ بعدی ☕', 'ok'); }
    save(); if (active()) paint();
  }

  /* ---------- UI state ---------- */
  let root = null, sel = clampJ(todayJ()), charts = [], heatYear = null, heatMetric = 'min', range = 'week', bankQ = '', bankCat = 'all', lastPaintKey = '';
  const active = () => !!(root && document.body.contains(root));
  const ui = () => D.ui;

  /* ---------- global 1s tick (clock, live timers, pomodoro) ---------- */
  setInterval(() => {
    try {
      if (P().running && P().endsAt <= nowMs()) pomoFinish();
      if (!active()) return;
      const c = q('#dl-clock', root); if (c) c.textContent = fa(new Date().toLocaleTimeString('en-GB', { hour12: false }));
      if (keyOf(todayJ()) !== lastPaintKey) { lastPaintKey = keyOf(todayJ()); const td = q('#dl-today', root); if (td) td.textContent = 'امروز: ' + fmtD(todayJ()); }
      if (D.timer) {
        const T = D.timer, t = findTask(T.k, T.id);
        if (!t) { D.timer = null; save(); } else {
          const v = hms(spentOf(T.k, t));
          qa(`[data-sp="${T.k}|${T.id}"]`, root).forEach(e => e.textContent = v);
          const lv = q('#dl-live-t', root); if (lv) lv.textContent = v;
          const mb = q(`[data-mini="${T.k}|${T.id}"]`, root); if (mb && t.target) mb.style.width = Math.min(100, spentOf(T.k, t) / (t.target * 60) * 100) + '%';
        }
      }
      paintPomoClock();
    } catch (e) { console.warn('daily tick', e); }
  }, 1000);

  /* ---------- drag & drop (Pointer Events: mouse, pen, touch) ---------- */
  function dndStart(e, payload, src) {
    if (e.button > 0) return;
    if (e.pointerType === 'touch' && !e.target.closest('.dl-handle')) return;
    if (e.target.closest('button,input,select,textarea,a,.chip[data-a]') && !e.target.closest('.dl-handle')) return;
    if (e.pointerType === 'touch') e.preventDefault();
    const sx = e.clientX, sy = e.clientY; let ghost = null, zone = null, ins = null, ox = 0, oy = 0;
    const clear = () => { qa('.dz-on', root).forEach(x => x.classList.remove('dz-on')); qa('.ins-b,.ins-a', root).forEach(x => x.classList.remove('ins-b', 'ins-a')); };
    const move = ev => {
      if (!ghost) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
        const r = src.getBoundingClientRect(); ox = sx - r.left; oy = sy - r.top;
        ghost = src.cloneNode(true); ghost.classList.add('dl-ghost'); ghost.style.width = r.width + 'px';
        document.body.appendChild(ghost); src.classList.add('dragging'); document.body.classList.add('dl-dragging'); sfx('pick');
      }
      ev.preventDefault();
      ghost.style.transform = `translate(${ev.clientX - ox}px, ${ev.clientY - oy}px) rotate(-1.5deg)`;
      clear(); ins = null;
      const el = document.elementFromPoint(ev.clientX, ev.clientY); zone = el && el.closest('[data-drop]');
      if (zone && !root.contains(zone)) zone = null;
      if (zone) {
        zone.classList.add('dz-on');
        if (zone.dataset.drop.startsWith('list:')) {
          const items = qa(':scope > [data-tid]', zone).filter(x => x !== src);
          let idx = items.length;
          for (let i = 0; i < items.length; i++) { const r = items[i].getBoundingClientRect(); if (ev.clientY < r.top + r.height / 2) { idx = i; items[i].classList.add('ins-b'); break; } }
          if (idx === items.length && items.length) items[items.length - 1].classList.add('ins-a');
          ins = { idx, before: items[idx] ? items[idx].dataset.tid : null };
        }
      }
      const H = window.innerHeight, scr = ev.clientY < 70 ? -18 : ev.clientY > H - 70 ? 18 : 0;
      if (scr) window.scrollBy(0, scr);
    };
    const end = ev => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end);
      if (!ghost) return;
      ghost.remove(); src.classList.remove('dragging'); document.body.classList.remove('dl-dragging'); clear();
      const blk = x => { x.stopPropagation(); x.preventDefault(); }; window.addEventListener('click', blk, { capture: true, once: true }); setTimeout(() => window.removeEventListener('click', blk, true), 60);
      if (ev.type === 'pointerup' && zone) drop(payload, zone.dataset.drop, ins);
    };
    window.addEventListener('pointermove', move, { passive: false }); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
  }
  function newTaskFromBank(b) { return { id: uid(), title: b.title, cat: b.cat, target: b.mins || 0, spent: 0, done: false, prio: b.prio || 'norm', start: b.start || '', bankId: b.id, pid: b.pid || '' }; }
  function drop(pl, target, ins) {
    const [kind, j] = target.split(':'); const jdn = +j; const tk = keyOf(jdn);
    let t;
    if (pl.type === 'bank') { const b = D.bank.find(x => x.id === pl.id); if (!b) return; t = newTaskFromBank(b); }
    else {
      const from = D.days[pl.k]; if (!from) return; const i = from.tasks.findIndex(x => x.id === pl.id); if (i < 0) return;
      t = from.tasks.splice(i, 1)[0];
      if (D.timer && D.timer.id === t.id) D.timer.k = tk;
      if (P().link === pl.k + '|' + t.id) P().link = tk + '|' + t.id;
    }
    const list = day(jdn, true).tasks;
    let idx = list.length;
    if (kind === 'list' && ins && ins.before) { const bi = list.findIndex(x => x.id === ins.before); if (bi >= 0) idx = bi; }
    list.splice(idx, 0, t); save(); sfx('save');
    if (pl.type === 'bank') say(`«${t.title}» به ${fmtD(jdn, { y: false })} اضافه شد`, 'ok');
    else if (pl.k !== tk) say(`به ${fmtD(jdn, { y: false })} منتقل شد`, 'ok');
    paint();
  }

  /* ---------- render ---------- */
  function render(view) {
    destroy(); sel = clampJ(sel);
    const back = (typeof ICON !== 'undefined' && ICON.back) || '→';
    view.innerHTML = `<div class="page dl-page" id="dl-root">
      <header class="dl-card dl-head">
        <button class="back-btn" data-back="" data-snd="1" aria-label="بازگشت به صفحهٔ اول">${back}<span class="lbl">صفحهٔ اول</span></button>
        <div class="dl-brand">
          <div class="dl-emb"><img src="${ASSET('logo-milad-v2.png')}" alt=""><svg class="dl-orb" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46"/></svg></div>
          <div class="dl-bt"><h1 class="dl-title">مدیریت امور روزانه</h1>
          <div class="dl-sub">روز و هفته · تمرکز و زمان · عادت‌ها و اهداف <span class="dl-en">Daily Command Center · Milad Saadat</span></div></div>
        </div>
        <div class="dl-now"><div class="dl-clock" id="dl-clock">${fa(new Date().toLocaleTimeString('en-GB', { hour12: false }))}</div><div class="dl-today" id="dl-today">امروز: ${fmtD(todayJ())}</div></div>
        <div class="dl-hbtns">
          <span class="dl-streak" id="dl-streak"></span>
          <button class="dl-btn cy" data-a="today">◎ امروز</button>
          <button class="dl-btn" data-a="export" title="خروجی JSON فقط همین بخش">⬇️ پشتیبان</button>
          <button class="dl-btn" data-a="import" title="ورود فایل JSON">⬆️ بازیابی</button>
          <input type="file" id="dl-file" accept="application/json,.json" hidden>
        </div>
      </header>
      <div class="dl-live hidden" id="dl-live"></div>
      <section class="dl-card dl-week" id="dl-week"></section>
      <nav class="dl-tabs" id="dl-tabs">${[['desk', '🗓️', 'میز کار'], ['bank', '🗂️', 'بانک تسک و روتین'], ['goals', '🎯', 'اهداف و عادت‌ها'], ['focus', '⏱️', 'تمرکز (پومودورو)'], ['stats', '📊', 'آمار و تقویم سالانه']].map(([k, i, n]) => `<button data-a="tab" data-v="${k}"><span>${i}</span>${n}</button>`).join('')}</nav>
      <div id="dl-body"></div>
    </div>`;
    root = q('#dl-root', view); lastPaintKey = keyOf(todayJ());
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    root.addEventListener('pointerdown', onDown);
    root.addEventListener('submit', onSubmit);
    root.addEventListener('input', e => {
      if (e.target.id === 'bk-q') { bankQ = e.target.value.trim(); paintBankList(); }
      if (e.target.hasAttribute('data-note')) { const d = day(sel, true); d.note = e.target.value; save(); }
    });
    q('#dl-file', root).addEventListener('change', onImport);
    root.addEventListener('mouseover', e => { const c = e.target.closest('.hc[data-t]'), tip = q('#hm-tip', root); if (!tip) return; if (!c) { tip.classList.remove('on'); return; } tip.textContent = c.dataset.t; const r = c.getBoundingClientRect(); tip.style.left = Math.max(8, Math.min(window.innerWidth - tip.offsetWidth - 8, r.left + r.width / 2 - tip.offsetWidth / 2)) + 'px'; tip.style.top = (r.top - 36) + 'px'; tip.classList.add('on'); });
    paint();
  }
  function paint() {
    if (!active()) return;
    destroyCharts();
    const st = streaks(); q('#dl-streak', root).innerHTML = `🔥 <b>${fa(st.cur)}</b> روز پیوسته <small>رکورد ${fa(st.best)}</small>`;
    qa('#dl-tabs [data-v]', root).forEach(b => b.classList.toggle('on', b.dataset.v === ui().tab));
    root.dataset.tab = ui().tab;
    paintLive(); paintWeek();
    const B = q('#dl-body', root);
    const T = ui().tab;
    if (T === 'desk') B.innerHTML = ui().view === 'board' ? boardHTML() : deskHTML();
    else if (T === 'bank') B.innerHTML = bankTabHTML();
    else if (T === 'goals') B.innerHTML = goalsHTML();
    else if (T === 'focus') B.innerHTML = focusHTML();
    else B.innerHTML = statsHTML();
    if (T === 'desk' && ui().view !== 'board') paintBankList();
    paintPomoClock();
    if (T === 'stats') drawCharts();
  }
  function paintLive() {
    const L = q('#dl-live', root); const T = D.timer; const t = T && findTask(T.k, T.id);
    if (!t) { L.classList.add('hidden'); L.innerHTML = ''; return; }
    L.classList.remove('hidden');
    L.innerHTML = `<span class="lv-dot"></span><span>تایمر زنده:</span><b class="lv-tt">${h(t.title)}</b><small>${fmtD(jOf(T.k), { y: false })}</small><span class="lv-t" id="dl-live-t">${hms(spentOf(T.k, t))}</span><button class="dl-btn red" data-a="timer-stop">■ توقف و ثبت</button>`;
  }
  function paintWeek() {
    const ws = weekStart(sel), we = ws + 6, tj = todayJ(), [sy, sm, sd] = d2j(sel);
    const yrs = []; for (let y = MINY; y <= MAXY; y++) yrs.push(y);
    let days = '';
    for (let i = 0; i < 7; i++) {
      const j = ws + i, k = keyOf(j), s = dayStats(k), p = s.n ? Math.round(s.done / s.n * 100) : 0;
      const out = j < MINJ || j > MAXJ;
      days += `<button class="wk-day ${j === sel ? 'sel' : ''} ${j === tj ? 'today' : ''} ${j < tj ? 'past' : ''} ${i === 6 ? 'fri' : ''} ${s.n && s.done === s.n ? 'full' : ''}" data-a="pick" data-j="${j}" ${out ? 'disabled' : `data-drop="day:${j}"`}>
        <span class="wd-n">${WD[i]}</span>${j === tj ? '<i class="wd-now">امروز</i>' : ''}
        <span class="wd-d">${fmtD(j, { wd: false, y: false })}</span>
        <span class="wd-ring"><svg viewBox="0 0 36 36"><circle class="bg" cx="18" cy="18" r="15.5"/><circle class="fg" cx="18" cy="18" r="15.5" pathLength="100" style="stroke-dasharray:${p} 100"/></svg><b>${fa(s.done)}/${fa(s.n)}</b></span>
        <span class="wd-min">${s.sec >= 60 ? mins(s.sec / 60) : s.n ? 'زمانی ثبت نشده' : 'خالی'}</span>
      </button>`;
    }
    q('#dl-week', root).innerHTML = `<div class="wk-top">
        <div class="wk-range"><span class="dl-h3">هفته:</span> ${fmtD(ws, { wd: false, y: d2j(ws)[0] !== d2j(we)[0] })} تا ${fmtD(we, { wd: false })}<small>تسک‌ها را از بانک بکشید و روی هر روز رها کنید</small></div>
        <div class="wk-nav">
          <button class="dl-btn" data-a="nav" data-d="-7">« هفته قبل</button><button class="dl-btn" data-a="nav" data-d="-1">‹ روز قبل</button>
          <span class="wk-sel">${fmtD(sel)}</span>
          <button class="dl-btn" data-a="nav" data-d="1">روز بعد ›</button><button class="dl-btn" data-a="nav" data-d="7">هفته بعد »</button>
        </div>
        <div class="wk-jump"><span>پرش به:</span>
          <select id="jp-d" aria-label="روز">${Array.from({ length: mLen(sy, sm) }, (_, i) => `<option value="${i + 1}" ${i + 1 === sd ? 'selected' : ''}>${fa(i + 1)}</option>`).join('')}</select>
          <select id="jp-m" aria-label="ماه">${MN.map((n, i) => `<option value="${i + 1}" ${i + 1 === sm ? 'selected' : ''}>${n}</option>`).join('')}</select>
          <select id="jp-y" aria-label="سال">${yrs.map(y => `<option value="${y}" ${y === sy ? 'selected' : ''}>${fa(y)}</option>`).join('')}</select>
        </div>
        <div class="wk-acts">
          <button class="dl-btn vi" data-a="routines">⚡ چیدمان خودکار روتین‌ها در این هفته</button>
          <div class="dl-seg"><button data-a="view" data-v="day" class="${ui().view !== 'board' ? 'on' : ''}">نمای روزانه</button><button data-a="view" data-v="board" class="${ui().view === 'board' ? 'on' : ''}">برد کل هفته</button></div>
        </div>
      </div>
      <div class="wk-days">${days}</div>`;
  }

  /* ---------- desk (day view) ---------- */
  const catOpts = cur => D.cats.map(c => `<option value="${h(c.id)}" ${c.id === cur ? 'selected' : ''}>${c.icon} ${h(c.name)}</option>`).join('');
  const projOpts = cur => `<option value="">— بدون پروژه —</option>` + projects().map(p => `<option value="${h(p.id)}" ${p.id === cur ? 'selected' : ''}>${h(p.title || p.name || 'پروژه')}</option>`).join('');
  const prioSeg = (name, cur) => `<div class="dl-seg prio">${Object.entries(PRIO).map(([k, v]) => `<label><input type="radio" name="${name}" value="${k}" ${k === (cur || 'norm') ? 'checked' : ''}><span style="--pc:${v.c}">${v.n}</span></label>`).join('')}</div>`;
  function taskLi(k, t, i, n, compact) {
    const c = catOf(t.cat), sp = spentOf(k, t), run = D.timer && D.timer.k === k && D.timer.id === t.id;
    const pct = t.target ? Math.min(100, sp / (t.target * 60) * 100) : 0, over = t.target && sp > t.target * 60;
    const pr = projects().find(p => p.id === t.pid);
    return `<li class="tk ${t.done ? 'done' : ''} ${run ? 'run' : ''} p-${t.prio}" data-tid="${h(t.id)}" data-k="${k}" style="--cc:${c.color}">
      <span class="dl-handle" title="بکشید و جابه‌جا کنید" aria-label="جابه‌جایی">⋮⋮</span>
      <button class="tk-chk" data-a="toggle" aria-label="انجام شد">${t.done ? '✓' : ''}</button>
      <div class="tk-main">
        <div class="tk-t">${h(t.title)}</div>
        <div class="tk-meta"><span class="chip" style="--cc:${c.color}">${c.icon} ${h(c.name)}</span>
          ${t.prio !== 'norm' ? `<span class="chip pr" style="--cc:${PRIO[t.prio].c}">${t.prio === 'urg' ? '🔥' : '⭐'} ${PRIO[t.prio].n}</span>` : ''}
          ${t.start ? `<span class="chip">🕘 ${fa(t.start)}</span>` : ''}
          ${pr ? `<span class="chip pj" data-a="proj" data-pid="${h(pr.id)}" title="رفتن به پروژه">🔗 ${h(pr.title || pr.name)}</span>` : ''}
          ${t.carried ? '<span class="chip">↪︎ منتقل‌شده</span>' : ''}
          ${t.note ? `<span class="chip" title="${h(t.note)}">📝</span>` : ''}</div>
        ${compact ? '' : `<div class="tk-bar"><i data-mini="${k}|${h(t.id)}" class="${over ? 'over' : ''}" style="width:${pct}%"></i></div>`}
      </div>
      <div class="tk-time"><b data-sp="${k}|${h(t.id)}" class="${over ? 'over' : ''}">${hms(sp)}</b><small>${t.target ? 'هدف ' + fa(t.target) + '′' : 'بدون هدف'}</small></div>
      <div class="tk-acts">
        <button class="ic ${run ? 'on' : ''}" data-a="timer" title="${run ? 'توقف تایمر' : 'شروع تایمر'}">${run ? '■' : '▶'}</button>
        ${compact ? '' : `<button class="ic" data-a="up" ${i === 0 ? 'disabled' : ''} title="بالا">▲</button><button class="ic" data-a="down" ${i === n - 1 ? 'disabled' : ''} title="پایین">▼</button>`}
        <button class="ic" data-a="edit" title="ویرایش">✎</button><button class="ic del" data-a="del" title="حذف">✕</button>
      </div></li>`;
  }
  function deskHTML() {
    const k = keyOf(sel), d = day(sel), s = dayStats(k), p = s.n ? Math.round(s.done / s.n * 100) : 0;
    const tj = todayJ(), rel = sel === tj ? 'امروز' : sel === tj - 1 ? 'دیروز' : sel === tj + 1 ? 'فردا' : '';
    return `<div class="dl-desk">
      <section class="dl-card dl-day">
        <div class="dy-head">
          <div><h2 class="dl-h2">${WD[sat(sel)]} ${rel ? `<em>${rel}</em>` : ''}</h2><div class="dy-date">${fmtD(sel, { wd: false })}</div></div>
          <div class="dy-sum"><span><b>${fa(s.done)}</b> از <b>${fa(s.n)}</b> انجام شد</span><span>⏱ ${hms(s.sec)} ثبت‌شده</span><span>🎯 ${s.target ? mins(s.target) : '—'} برنامه</span></div>
          <div class="dy-prog"><i style="width:${p}%"></i><b>${fa(p)}٪</b></div>
        </div>
        <div class="dy-tools">
          <select data-a2="sort" id="dy-sort" aria-label="مرتب‌سازی"><option value="">↕ مرتب‌سازی…</option><option value="start">بر اساس ساعت شروع</option><option value="prio">بر اساس اولویت</option><option value="cat">بر اساس دسته</option><option value="done">انجام‌نشده‌ها اول</option><option value="target">بیشترین زمان هدف</option></select>
          <button class="dl-btn" data-a="copy-next">📑 کپی به روز بعد</button>
          <button class="dl-btn" data-a="carry">↪︎ انتقال ناتمام‌ها به فردا</button>
          <button class="dl-btn red" data-a="clear-day">🧹 پاک‌کردن روز</button>
        </div>
        <form class="qadd" id="qadd" autocomplete="off">
          <input name="title" placeholder="تسک جدید برای ${h(WD[sat(sel)])}… (Enter)" maxlength="120" required>
          <select name="cat" aria-label="دسته">${catOpts(D.cats[0].id)}</select>
          <label class="qa-n"><input name="mins" type="number" min="0" max="1440" step="5" value="30" aria-label="دقیقهٔ هدف"><span>دقیقه</span></label>
          <input name="start" type="time" aria-label="ساعت شروع">
          ${prioSeg('prio')}
          <select name="pid" aria-label="لینک به پروژه">${projOpts('')}</select>
          <label class="qa-bank"><input type="checkbox" name="tobank"> ذخیره در بانک</label>
          <button class="dl-btn vi" type="submit">＋ افزودن</button>
        </form>
        <ul class="tlist" data-drop="list:${sel}">${d.tasks.length ? d.tasks.map((t, i) => taskLi(k, t, i, d.tasks.length)).join('') : `<li class="tl-empty">هنوز تسکی برای این روز نیست — از بانک تسک بکشید، روی ＋ بزنید یا بالا بنویسید ✨</li>`}</ul>
        <label class="dy-note"><span>📝 یادداشت روز</span><textarea data-note rows="3" placeholder="نکته‌ها، حس امروز، درس‌ها…">${h(d.note || '')}</textarea></label>
      </section>
      <aside class="dl-side">
        <section class="dl-card dl-bank">
          <div class="bk-head"><h3 class="dl-h3">🗂️ بانک تسک</h3><button class="dl-btn sm" data-a="tab" data-v="bank">مدیریت</button></div>
          <input id="bk-q" placeholder="جستجو در بانک…" value="${h(bankQ)}">
          <div class="bk-pills" id="bk-pills"></div>
          <div class="bk-list" id="bk-list"></div>
          <small class="bk-hint">بکشید و روی روز یا فهرست رها کنید · ＋ برای افزودن به روز انتخاب‌شده</small>
        </section>
        ${weekSummaryHTML()}
        ${miniPomoHTML()}
      </aside>
    </div>`;
  }
  function paintBankList() {
    const L = q('#bk-list', root), Pp = q('#bk-pills', root); if (!L) return;
    Pp.innerHTML = [['all', 'همه', '#8b5cf6']].concat(D.cats.map(c => [c.id, c.icon + ' ' + c.name, c.color])).map(([id, n, c]) => `<button class="pill ${bankCat === id ? 'on' : ''}" data-a="bkcat" data-v="${h(id)}" style="--cc:${c}">${h(n)}</button>`).join('');
    const ql = bankQ.toLowerCase();
    const items = D.bank.filter(b => (bankCat === 'all' || b.cat === bankCat) && (!ql || b.title.toLowerCase().includes(ql)));
    L.innerHTML = items.length ? items.map(b => { const c = catOf(b.cat); return `<div class="bk" data-bid="${h(b.id)}" style="--cc:${c.color}"><span class="dl-handle">⋮⋮</span><span class="bk-i">${c.icon}</span><span class="bk-t">${h(b.title)}${b.routine.length ? ' <i title="روتین">⚡</i>' : ''}</span><small>${b.mins ? fa(b.mins) + '′' : ''}</small><button class="ic" data-a="bk-add" title="افزودن به ${h(fmtD(sel, { y: false }))}">＋</button></div>`; }).join('') : '<div class="tl-empty">موردی پیدا نشد</div>';
  }
  function weekSummaryHTML() {
    const ws = weekStart(sel); let n = 0, done = 0, sec = 0, target = 0, best = null, bestSec = -1; const byCat = {};
    for (let i = 0; i < 7; i++) { const k = keyOf(ws + i), s = dayStats(k); n += s.n; done += s.done; sec += s.sec; target += s.target; if (s.sec > bestSec && s.sec > 0) { bestSec = s.sec; best = ws + i; } (D.days[k] ? D.days[k].tasks : []).forEach(t => byCat[t.cat] = (byCat[t.cat] || 0) + spentOf(k, t)); }
    const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    const g = D.goals.reduce((a, x) => a + Math.min(1, x.value / x.target), 0) / (D.goals.length || 1);
    return `<section class="dl-card dl-wsum"><h3 class="dl-h3">📋 خلاصهٔ این هفته</h3>
      <div class="ws-grid">
        <div><b>${fa(done)}/${fa(n)}</b><span>تسک انجام‌شده</span></div>
        <div><b>${n ? fa(Math.round(done / n * 100)) + '٪' : '—'}</b><span>نرخ تکمیل</span></div>
        <div><b>${hms(sec)}</b><span>زمان واقعی</span></div>
        <div><b>${target ? mins(target) : '—'}</b><span>زمان هدف</span></div>
        <div><b>${best !== null ? WD[sat(best)] : '—'}</b><span>پربارترین روز</span></div>
        <div><b>${top && top[1] > 0 ? catOf(top[0]).icon + ' ' + h(catOf(top[0]).name) : '—'}</b><span>بیشترین زمان</span></div>
      </div>
      <div class="ws-goal"><span>پیشرفت کلی اهداف</span><div class="dy-prog"><i style="width:${Math.round(g * 100)}%"></i><b>${fa(Math.round(g * 100))}٪</b></div></div>
    </section>`;
  }
  function boardHTML() {
    const ws = weekStart(sel); let cols = '';
    for (let i = 0; i < 7; i++) {
      const j = ws + i, k = keyOf(j), d = day(j), s = dayStats(k), out = j < MINJ || j > MAXJ;
      cols += `<section class="dl-card bd-col ${j === sel ? 'sel' : ''} ${j === todayJ() ? 'today' : ''}">
        <header data-a="pick" data-j="${j}"><b>${WD[i]}</b><small>${fmtD(j, { wd: false, y: false })}</small><span>${fa(s.done)}/${fa(s.n)}</span></header>
        <ul class="tlist compact" ${out ? '' : `data-drop="list:${j}"`}>${d.tasks.map((t, x) => taskLi(k, t, x, d.tasks.length, true)).join('') || '<li class="tl-empty">رها کنید</li>'}</ul>
      </section>`;
    }
    return `<div class="dl-board">${cols}</div><section class="dl-card dl-bank wide"><div class="bk-head"><h3 class="dl-h3">🗂️ بانک تسک — بکشید روی هر ستون</h3></div><div class="bk-list row">${D.bank.map(b => { const c = catOf(b.cat); return `<div class="bk" data-bid="${h(b.id)}" style="--cc:${c.color}"><span class="dl-handle">⋮⋮</span><span class="bk-i">${c.icon}</span><span class="bk-t">${h(b.title)}</span><small>${b.mins ? fa(b.mins) + '′' : ''}</small></div>`; }).join('')}</div></section>`;
  }

  /* ---------- bank tab ---------- */
  function bankTabHTML() {
    const cards = D.bank.map(b => { const c = catOf(b.cat); return `<div class="bt-card" data-bid="${h(b.id)}" style="--cc:${c.color}">
        <div class="bt-top"><span class="bk-i">${c.icon}</span><b>${h(b.title)}</b></div>
        <div class="tk-meta"><span class="chip" style="--cc:${c.color}">${h(c.name)}</span>${b.mins ? `<span class="chip">🎯 ${fa(b.mins)} دقیقه</span>` : ''}${b.prio !== 'norm' ? `<span class="chip" style="--cc:${PRIO[b.prio].c}">${PRIO[b.prio].n}</span>` : ''}</div>
        <div class="bt-rt">${WDS.map((w, i) => `<i class="${b.routine.includes(i) ? 'on' : ''}" title="${WD[i]}">${w}</i>`).join('')}<small>${b.routine.length ? 'روتین' : 'بدون روتین'}</small></div>
        <div class="bt-acts"><button class="dl-btn sm" data-a="bk-add">＋ به ${h(fmtD(sel, { y: false }))}</button><button class="ic" data-a="bk-edit" title="ویرایش">✎</button><button class="ic del" data-a="bk-del" title="حذف">✕</button></div>
      </div>`; }).join('');
    const catRows = D.cats.map(c => `<div class="ct-row" data-cid="${h(c.id)}"><span class="ct-sw" style="background:${c.color}"></span><span>${c.icon} ${h(c.name)}</span><small>${fa(D.bank.filter(b => b.cat === c.id).length)} تسک</small><button class="ic del" data-a="cat-del" title="حذف دسته" ${D.cats.length < 2 ? 'disabled' : ''}>✕</button></div>`).join('');
    return `<div class="dl-banktab">
      <section class="dl-card"><div class="bk-head"><h2 class="dl-h2">🗂️ بانک تسک و روتین‌ها</h2><button class="dl-btn vi" data-a="bk-new">＋ تسک جدید در بانک</button></div>
        <p class="dl-p">تسک‌های تکراری را یک بار بسازید. روزهای روتین را مشخص کنید تا دکمهٔ «⚡ چیدمان خودکار» آن‌ها را در هفته بچیند.</p>
        <div class="bt-grid">${cards || '<div class="tl-empty">بانک خالی است</div>'}</div></section>
      <section class="dl-card"><h3 class="dl-h3">🏷️ دسته‌ها</h3><div class="ct-list">${catRows}</div>
        <form id="cat-add" class="cat-add" autocomplete="off"><input name="icon" maxlength="3" placeholder="🙂" aria-label="آیکن"><input name="name" maxlength="30" placeholder="نام دستهٔ جدید" required><input name="color" type="color" value="${COLORS[D.cats.length % COLORS.length]}" aria-label="رنگ"><button class="dl-btn" type="submit">＋ افزودن دسته</button></form></section>
    </div>`;
  }

  /* ---------- goals ---------- */
  function goalsHTML() {
    const k = keyOf(todayJ());
    const cards = D.goals.map(g => { const p = Math.min(100, Math.round(g.value / g.target * 100)), td = g.log[k] || 0;
      return `<div class="dl-card gl" data-gid="${h(g.id)}" style="--cc:${g.color || '#a78bfa'}">
        <div class="gl-ring"><svg viewBox="0 0 36 36"><circle class="bg" cx="18" cy="18" r="15.5"/><circle class="fg" cx="18" cy="18" r="15.5" pathLength="100" style="stroke-dasharray:${p} 100"/></svg><b>${fa(p)}٪</b></div>
        <div class="gl-main"><h3 class="dl-h3">${h(g.title)}</h3><div class="gl-v"><b>${fa(g.value)}</b> / ${fa(g.target)} ${h(g.unit)}</div><small>امروز: ${fa(td)} ${h(g.unit)}${p >= 100 ? ' · 🏆 به هدف رسیدید' : ''}</small></div>
        <div class="gl-acts"><button class="dl-btn vi" data-a="goal-inc">＋${fa(g.step)}</button><button class="dl-btn" data-a="goal-dec">−${fa(g.step)}</button><button class="ic" data-a="goal-edit" title="ویرایش">✎</button><button class="ic del" data-a="goal-del" title="حذف">✕</button></div>
      </div>`; }).join('');
    return `<div class="dl-goals"><div class="bk-head"><h2 class="dl-h2">🎯 اهداف شمارشی و عادت‌ها</h2><button class="dl-btn vi" data-a="goal-new">＋ هدف جدید</button></div>
      <p class="dl-p">برای هر هدف «گام» تعیین کنید (مثلاً ۱۰ صفحه یا ۱ جلسه) و با هر بار انجام، ＋ بزنید. ثبت روزانه در تاریخچه می‌ماند.</p>
      <div class="gl-grid">${cards || '<div class="tl-empty">هنوز هدفی ندارید</div>'}</div></div>`;
  }

  /* ---------- pomodoro views ---------- */
  function linkOpts() {
    const k = keyOf(sel), d = day(sel), tk = keyOf(todayJ()), td = day(todayJ());
    const opts = [['', '— بدون اتصال به تسک —']];
    td.tasks.filter(t => !t.done).forEach(t => opts.push([tk + '|' + t.id, '(امروز) ' + t.title]));
    if (k !== tk) d.tasks.filter(t => !t.done).forEach(t => opts.push([k + '|' + t.id, `(${WD[sat(sel)]}) ` + t.title]));
    if (P().link && !opts.some(o => o[0] === P().link)) { const [lk, id] = P().link.split('|'); const t = findTask(lk, id); if (t) opts.push([P().link, t.title]); }
    return opts.map(([v, n]) => `<option value="${h(v)}" ${v === P().link ? 'selected' : ''}>${h(n)}</option>`).join('');
  }
  const ringSVG = n => `<svg viewBox="0 0 120 120" class="pm-svg"><defs><linearGradient id="pmg${n}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs><circle cx="60" cy="60" r="52" class="bg"/><circle cx="60" cy="60" r="52" class="fg" id="pm-arc${n}" pathLength="100" stroke="url(#pmg${n})"/></svg><div class="pm-c"><b id="pm-time${n}">${hms(pRemain())}</b><small>${P().mode === 'break' ? 'استراحت' : 'تمرکز'}</small></div>`;
  function pomoCtl(big) {
    const p = P();
    return `<div class="pm-ctl">${big ? `<div class="dl-seg">${[25, 45, 60].map(m => `<button data-a="pm-len" data-v="${m}" class="${p.len === m ? 'on' : ''}">${fa(m)} دقیقه</button>`).join('')}</div>` : ''}
      <button class="dl-btn ${p.running ? 'red' : 'cy'}" data-a="pm-go">${p.running ? '⏸ مکث' : '▶ شروع'}</button>
      <button class="dl-btn" data-a="pm-reset">↺ ریست</button>${big ? `<button class="dl-btn" data-a="pm-break">☕ استراحت ۵′</button><button class="dl-btn" data-a="pm-skip">⏭ پایان جلسه و ثبت</button>` : ''}</div>`;
  }
  function miniPomoHTML() {
    return `<section class="dl-card dl-pm mini ${P().mode}"><div class="bk-head"><h3 class="dl-h3">⏱️ پومودورو</h3><button class="dl-btn sm" data-a="tab" data-v="focus">بزرگ‌نمایی</button></div>
      <div class="pm-ring">${ringSVG(0)}</div><select id="pm-link0" class="pm-link" aria-label="اتصال به تسک">${linkOpts()}</select>${pomoCtl(false)}</section>`;
  }
  function focusHTML() {
    const k = keyOf(todayJ()), lg = P().log[k] || { s: 0, m: 0 }; let ws = 0, wm = 0, all = 0, allm = 0;
    const w0 = weekStart(todayJ()); for (let i = 0; i < 7; i++) { const x = P().log[keyOf(w0 + i)]; if (x) { ws += x.s; wm += x.m; } }
    Object.values(P().log).forEach(x => { all += x.s; allm += x.m; });
    return `<div class="dl-focus"><section class="dl-card dl-pm big ${P().mode}"><h2 class="dl-h2">⏱️ اتاق تمرکز</h2>
        <div class="pm-ring">${ringSVG(1)}</div>
        <label class="pm-lbl">جلسه به این تسک وصل شود (زمان به «زمان واقعی» آن اضافه می‌شود):<select id="pm-link1" class="pm-link">${linkOpts()}</select></label>
        ${pomoCtl(true)}<p class="dl-p">بعد از هر جلسهٔ تمرکز، ۵ دقیقه استراحت خودکار شروع می‌شود. تایمر حتی اگر به صفحهٔ دیگری بروید ادامه می‌دهد.</p></section>
      <section class="dl-card"><h3 class="dl-h3">📈 آمار تمرکز</h3><div class="ws-grid">
        <div><b>${fa(lg.s)}</b><span>جلسهٔ امروز</span></div><div><b>${mins(lg.m)}</b><span>تمرکز امروز</span></div>
        <div><b>${fa(ws)}</b><span>جلسهٔ این هفته</span></div><div><b>${mins(wm)}</b><span>تمرکز این هفته</span></div>
        <div><b>${fa(all)}</b><span>کل جلسات</span></div><div><b>${mins(allm)}</b><span>کل تمرکز</span></div></div></section></div>`;
  }
  function paintPomoClock() {
    if (!active()) return; const r = pRemain(), tot = pTotal(), pct = tot ? (1 - r / tot) * 100 : 0;
    [0, 1].forEach(n => { const t = q('#pm-time' + n, root), a = q('#pm-arc' + n, root); if (t) t.textContent = hms(r); if (a) a.style.strokeDasharray = `${pct} 100`; });
  }

  /* ---------- stats: heatmap + analytics ---------- */
  function heatVal(k) { const s = dayStats(k); return heatMetric === 'done' ? s.done : Math.round(s.sec / 60); }
  function heatHTML() {
    const tj = todayJ(); let a, b, label;
    if (heatYear === null || heatYear === 'last') { b = Math.min(tj, MAXJ); a = Math.max(MINJ, b - 364); label = '۳۶۵ روز اخیر'; }
    else { a = j2d(heatYear, 1, 1); b = j2d(heatYear + 1, 1, 1) - 1; label = 'سال ' + fa(heatYear); }
    const vals = []; let mx = 0, tot = 0, act = 0;
    for (let j = a; j <= b; j++) { const v = heatVal(keyOf(j)); vals.push(v); mx = Math.max(mx, v); tot += v; if (v > 0) act++; }
    const lvl = v => !v ? 0 : mx <= 4 ? Math.min(4, v) : Math.min(4, Math.ceil(v / mx * 4));
    const lead = sat(a), cells = [], months = [];
    for (let i = 0; i < lead; i++) cells.push('<i class="hc pad"></i>');
    let lastM = 0;
    for (let j = a; j <= b; j++) {
      const v = vals[j - a], [, m, dd] = d2j(j), col = Math.floor((j - a + lead) / 7) + 1;
      if (m !== lastM) { months.push(`<span style="grid-column:${col}">${MN[m - 1]}</span>`); lastM = m; }
      cells.push(`<i class="hc l${lvl(v)} ${j === tj ? 'now' : ''} ${j > tj ? 'fut' : ''}" data-a="heat" data-j="${j}" data-t="${h(fmtD(j))} — ${heatMetric === 'done' ? fa(v) + ' تسک انجام‌شده' : v ? mins(v) : 'بدون فعالیت'}"></i>`);
    }
    const ncol = Math.ceil((b - a + 1 + lead) / 7), st = streaks();
    const yrs = ['last'].concat(Array.from({ length: MAXY - MINY + 1 }, (_, i) => MINY + i));
    return `<section class="dl-card dl-heat"><div class="bk-head"><h2 class="dl-h2">🟩 تقویم فعالیت — ${label}</h2>
        <div class="hm-ctl"><select id="hm-y">${yrs.map(y => `<option value="${y}" ${String(y) === String(heatYear ?? 'last') ? 'selected' : ''}>${y === 'last' ? '۳۶۵ روز اخیر' : 'سال ' + fa(y)}</option>`).join('')}</select>
        <select id="hm-m"><option value="min" ${heatMetric === 'min' ? 'selected' : ''}>دقیقهٔ ثبت‌شده</option><option value="done" ${heatMetric === 'done' ? 'selected' : ''}>تسک انجام‌شده</option></select></div></div>
      <div class="hm-sum"><div><b>${fa(act)}</b><span>روز فعال</span></div><div><b>${heatMetric === 'done' ? fa(tot) : mins(tot)}</b><span>${heatMetric === 'done' ? 'تسک انجام‌شده' : 'زمان کل'}</span></div><div><b>${fa(st.cur)}</b><span>استریک فعلی</span></div><div><b>${fa(st.best)}</b><span>بهترین استریک</span></div></div>
      <div class="hm-wrap"><div class="hm-wd">${WD.map((w, i) => `<span>${i % 2 === 0 ? w : ''}</span>`).join('')}</div>
        <div class="hm-scroll"><div class="hm-months" style="grid-template-columns:repeat(${ncol},var(--hc))">${months.join('')}</div><div class="hm-grid" style="grid-template-columns:repeat(${ncol},var(--hc))">${cells.join('')}</div></div></div>
      <div class="hm-leg"><span>کمتر</span>${[0, 1, 2, 3, 4].map(l => `<i class="hc l${l}"></i>`).join('')}<span>بیشتر</span><small>روی هر خانه بزنید تا به آن روز بروید</small></div>
      <div class="hm-tip" id="hm-tip"></div></section>`;
  }
  function rangeDays() {
    const tj = todayJ();
    if (range === 'day') return [sel, sel];
    if (range === 'week') { const w = weekStart(sel); return [w, w + 6]; }
    if (range === 'month') { const [y, m] = d2j(sel); return [j2d(y, m, 1), j2d(y, m, mLen(y, m))]; }
    if (range === 'year') { const [y] = d2j(sel); return [j2d(y, 1, 1), j2d(y + 1, 1, 1) - 1]; }
    const ks = Object.keys(D.days).map(jOf); return ks.length ? [Math.min(...ks), Math.max(...ks, tj)] : [tj, tj];
  }
  function statsHTML() {
    const [a, b] = rangeDays(); const byCat = {}, byTitle = {}; let n = 0, done = 0, sec = 0, target = 0;
    for (const k in D.days) { const j = jOf(k); if (j < a || j > b) continue; D.days[k].tasks.forEach(t => { const s = spentOf(k, t); n++; if (t.done) done++; sec += s; target += t.target * 60; byCat[t.cat] = (byCat[t.cat] || 0) + s; const x = byTitle[t.title] || (byTitle[t.title] = { s: 0, n: 0, cat: t.cat }); x.s += s; x.n++; }); }
    const top = Object.entries(byTitle).sort((x, y) => y[1].s - x[1].s).slice(0, 6);
    const rl = { day: 'روز', week: 'هفته', month: 'ماه', year: 'سال', all: 'کل' };
    return `<div class="dl-stats">${heatHTML()}
      <section class="dl-card"><div class="bk-head"><h2 class="dl-h2">📊 تحلیل زمان</h2><div class="dl-seg">${Object.entries(rl).map(([k, v]) => `<button data-a="range" data-v="${k}" class="${range === k ? 'on' : ''}">${v}</button>`).join('')}</div></div>
        <div class="dl-p">${a === b ? fmtD(a) : fmtD(a, { wd: false }) + ' تا ' + fmtD(b, { wd: false })}</div>
        <div class="hm-sum"><div><b>${fa(done)}/${fa(n)}</b><span>تسک انجام‌شده</span></div><div><b>${hms(sec)}</b><span>زمان واقعی</span></div><div><b>${target ? mins(target / 60) : '—'}</b><span>زمان هدف</span></div><div><b>${target ? fa(Math.round(sec / target * 100)) + '٪' : '—'}</b><span>واقعی به هدف</span></div></div>
        <div class="ch-grid">
          <div class="ch-box"><h3 class="dl-h3">زمان به تفکیک دسته</h3><div class="ch-c"><canvas id="dl-donut"></canvas></div>${sec ? '' : '<div class="ch-empty">هنوز زمانی در این بازه ثبت نشده</div>'}</div>
          <div class="ch-box"><h3 class="dl-h3">هدف در برابر واقعی — هفتهٔ انتخاب‌شده (دقیقه)</h3><div class="ch-c"><canvas id="dl-wk"></canvas></div></div>
          <div class="ch-box"><h3 class="dl-h3">نرخ تکمیل ۳۰ روز اخیر (٪)</h3><div class="ch-c"><canvas id="dl-line"></canvas></div></div>
          <div class="ch-box"><h3 class="dl-h3">🏅 تسک‌های پرزمان</h3><ol class="top-l" id="top-l">${top.length && top[0][1].s > 0 ? top.filter(x => x[1].s > 0).map(([t, x]) => `<li><span>${catOf(x.cat).icon} ${h(t)}</span><b>${hms(x.s)}</b><small>${fa(x.n)} بار</small></li>`).join('') : '<li class="tl-empty">هنوز داده‌ای نیست</li>'}</ol></div>
        </div></section></div>`;
  }
  function destroyCharts() { charts.forEach(c => { try { c.destroy(); } catch (e) { } }); charts = []; }
  function drawCharts() {
    if (typeof Chart === 'undefined') return;
    const font = { family: 'Estedad, Vazirmatn, sans-serif' }, grid = 'rgba(160,170,255,.12)', tick = '#b9c2ea';
    Chart.defaults.color = tick; Chart.defaults.font.family = font.family;
    const [a, b] = rangeDays(); const byCat = {};
    for (const k in D.days) { const j = jOf(k); if (j < a || j > b) continue; D.days[k].tasks.forEach(t => byCat[t.cat] = (byCat[t.cat] || 0) + spentOf(k, t)); }
    const cs = D.cats.filter(c => byCat[c.id] > 0);
    const dn = q('#dl-donut', root);
    if (dn && cs.length) charts.push(new Chart(dn, { type: 'doughnut', data: { labels: cs.map(c => c.icon + ' ' + c.name), datasets: [{ data: cs.map(c => Math.round(byCat[c.id] / 60)), backgroundColor: cs.map(c => c.color), borderColor: '#0b0d1f', borderWidth: 3 }] }, options: { maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom', rtl: true }, tooltip: { rtl: true, callbacks: { label: x => ` ${x.label}: ${mins(x.raw)}` } } } } }));
    const ws = weekStart(sel), tg = [], ac = [];
    for (let i = 0; i < 7; i++) { const s = dayStats(keyOf(ws + i)); tg.push(s.target); ac.push(Math.round(s.sec / 60)); }
    const wk = q('#dl-wk', root);
    if (wk) charts.push(new Chart(wk, { type: 'bar', data: { labels: WD, datasets: [{ label: 'هدف', data: tg, backgroundColor: 'rgba(139,92,246,.55)', borderRadius: 6 }, { label: 'واقعی', data: ac, backgroundColor: 'rgba(34,211,238,.8)', borderRadius: 6 }] }, options: { maintainAspectRatio: false, scales: { x: { reverse: true, grid: { color: grid } }, y: { beginAtZero: true, grid: { color: grid } } }, plugins: { legend: { rtl: true }, tooltip: { rtl: true } } } }));
    const tj = todayJ(), ll = [], lv = [];
    for (let j = tj - 29; j <= tj; j++) { const s = dayStats(keyOf(j)); const [, m, d] = d2j(j); ll.push(fa(d) + ' ' + MN[m - 1].slice(0, 3)); lv.push(s.n ? Math.round(s.done / s.n * 100) : null); }
    const ln = q('#dl-line', root);
    if (ln) charts.push(new Chart(ln, { type: 'line', data: { labels: ll, datasets: [{ label: 'نرخ تکمیل', data: lv, borderColor: '#22d3ee', backgroundColor: 'rgba(34,211,238,.15)', fill: true, tension: .35, spanGaps: true, pointRadius: 3, pointBackgroundColor: '#a78bfa' }] }, options: { maintainAspectRatio: false, scales: { x: { reverse: true, grid: { color: grid }, ticks: { maxTicksLimit: 8 } }, y: { min: 0, max: 100, grid: { color: grid } } }, plugins: { legend: { display: false }, tooltip: { rtl: true } } } }));
  }

  /* ---------- actions ---------- */
  function setSel(j) { sel = clampJ(j); paint(); }
  function taskCtx(el) { const li = el.closest('[data-tid]'); if (!li) return null; const k = li.dataset.k, t = findTask(k, li.dataset.tid); return t ? { k, t, li, list: D.days[k].tasks } : null; }
  function addTask(jdn, t) { day(jdn, true).tasks.push(t); save(); }
  function cloneTask(t) { return { id: uid(), title: t.title, cat: t.cat, target: t.target, spent: 0, done: false, prio: t.prio, start: t.start, bankId: t.bankId || '', pid: t.pid || '', note: t.note || '' }; }
  function fillRoutines() {
    const ws = weekStart(sel); let n = 0;
    for (let i = 0; i < 7; i++) {
      const j = ws + i; if (j < MINJ || j > MAXJ) continue;
      D.bank.filter(b => b.routine.includes(i)).forEach(b => { const d = day(j, true); if (!d.tasks.some(t => t.bankId === b.id)) { d.tasks.push(newTaskFromBank(b)); n++; } });
    }
    save(); n ? (sfx('special'), say(`${fa(n)} تسک روتین در این هفته چیده شد ⚡`, 'ok')) : say('همهٔ روتین‌های این هفته از قبل چیده شده‌اند');
    paint();
  }
  function onClick(e) {
    const el = e.target.closest('[data-a]'); if (!el || !root.contains(el)) return;
    const a = el.dataset.a; const c = taskCtx(el);
    switch (a) {
      case 'pick': if (!el.disabled) { sfx('tick'); setSel(+el.dataset.j); } break;
      case 'nav': setSel(sel + (+el.dataset.d)); break;
      case 'today': setSel(todayJ()); break;
      case 'tab': ui().tab = el.dataset.v; save(); sfx('nav'); paint(); window.scrollTo({ top: q('#dl-tabs', root).offsetTop - 10, behavior: 'smooth' }); break;
      case 'view': ui().view = el.dataset.v; ui().tab = 'desk'; save(); paint(); break;
      case 'routines': fillRoutines(); break;
      case 'export': exportJSON(); break;
      case 'import': q('#dl-file', root).click(); break;
      case 'timer-stop': stopTimer(); paint(); break;
      case 'toggle': if (c) { c.t.done = !c.t.done; c.t.doneAt = c.t.done ? nowMs() : 0; if (c.t.done && D.timer && D.timer.id === c.t.id) stopTimer(true); save(); if (c.t.done) { sfx('done'); const s = dayStats(c.k); if (s.n && s.done === s.n) { try { Sky.meteorShower(10); } catch (x) { } say('همهٔ تسک‌های این روز انجام شد 🎉', 'ok'); } } else sfx('undo'); paint(); } break;
      case 'timer': if (c) { (D.timer && D.timer.id === c.t.id) ? stopTimer() : startTimer(c.k, c.t.id); paint(); } break;
      case 'up': case 'down': if (c) { const i = c.list.indexOf(c.t), j = a === 'up' ? i - 1 : i + 1; if (j >= 0 && j < c.list.length) { c.list.splice(i, 1); c.list.splice(j, 0, c.t); save(); paint(); } } break;
      case 'edit': if (c) editTask(c.k, c.t); break;
      case 'del': if (c && confirm(`«${c.t.title}» حذف شود؟`)) { if (D.timer && D.timer.id === c.t.id) D.timer = null; c.list.splice(c.list.indexOf(c.t), 1); save(); sfx('back'); paint(); } break;
      case 'proj': { const p = projects().find(x => x.id === el.dataset.pid); if (p && typeof go === 'function') { try { sessionStorage.setItem('openId', p.id); } catch (x) { } sfx('nav'); go(p.cat); } break; }
      case 'copy-next': { const d = day(sel); if (!d.tasks.length) { say('این روز تسکی ندارد', 'err'); break; } if (sel + 1 > MAXJ) break; d.tasks.forEach(t => addTask(sel + 1, cloneTask(t))); sfx('save'); say(`${fa(d.tasks.length)} تسک به ${fmtD(sel + 1, { y: false })} کپی شد`, 'ok'); paint(); break; }
      case 'carry': { const d = day(sel), un = d.tasks.filter(t => !t.done); if (!un.length) { say('تسک ناتمامی نیست 👌'); break; } if (sel + 1 > MAXJ) break; un.forEach(t => { const x = cloneTask(t); x.carried = true; x.spent = 0; addTask(sel + 1, x); d.tasks.splice(d.tasks.indexOf(t), 1); if (D.timer && D.timer.id === t.id) D.timer = null; }); save(); sfx('save'); say(`${fa(un.length)} تسک ناتمام به ${fmtD(sel + 1, { y: false })} منتقل شد`, 'ok'); paint(); break; }
      case 'clear-day': { const d = D.days[keyOf(sel)]; if (!d || !d.tasks.length) break; if (!confirm(`همهٔ ${fa(d.tasks.length)} تسک ${fmtD(sel)} پاک شود؟`)) break; if (D.timer && D.timer.k === keyOf(sel)) D.timer = null; d.tasks = []; save(); sfx('back'); paint(); break; }
      case 'bkcat': bankCat = el.dataset.v; paintBankList(); break;
      case 'bk-add': { const b = D.bank.find(x => x.id === el.closest('[data-bid]').dataset.bid); if (b) { addTask(sel, newTaskFromBank(b)); sfx('save'); say(`«${b.title}» به ${fmtD(sel, { y: false })} اضافه شد`, 'ok'); paint(); } break; }
      case 'bk-new': editBank(null); break;
      case 'bk-edit': editBank(D.bank.find(x => x.id === el.closest('[data-bid]').dataset.bid)); break;
      case 'bk-del': { const b = D.bank.find(x => x.id === el.closest('[data-bid]').dataset.bid); if (b && confirm(`«${b.title}» از بانک حذف شود؟ (تسک‌های ثبت‌شده در روزها می‌مانند)`)) { D.bank = D.bank.filter(x => x !== b); save(); sfx('back'); paint(); } break; }
      case 'cat-del': { const id = el.closest('[data-cid]').dataset.cid; if (D.cats.length < 2) break; const used = D.bank.some(b => b.cat === id) || Object.values(D.days).some(d => d.tasks.some(t => t.cat === id)); if (!confirm(used ? 'این دسته استفاده شده؛ موارد آن به دستهٔ اول منتقل می‌شوند. حذف شود؟' : 'این دسته حذف شود؟')) break; D.cats = D.cats.filter(x => x.id !== id); const f = D.cats[0].id; D.bank.forEach(b => { if (b.cat === id) b.cat = f; }); Object.values(D.days).forEach(d => d.tasks.forEach(t => { if (t.cat === id) t.cat = f; })); save(); paint(); break; }
      case 'goal-inc': case 'goal-dec': { const g = D.goals.find(x => x.id === el.closest('[data-gid]').dataset.gid); if (!g) break; const s = a === 'goal-inc' ? g.step : -g.step; const was = g.value >= g.target; g.value = Math.max(0, g.value + s); const k = keyOf(todayJ()); g.log[k] = Math.max(0, (g.log[k] || 0) + s); save(); if (!was && g.value >= g.target) { sfx('special'); try { Sky.meteorShower(14); } catch (x) { } say(`🏆 هدف «${g.title}» کامل شد!`, 'ok'); } else sfx(s > 0 ? 'done' : 'undo'); paint(); break; }
      case 'goal-new': editGoal(null); break;
      case 'goal-edit': editGoal(D.goals.find(x => x.id === el.closest('[data-gid]').dataset.gid)); break;
      case 'goal-del': { const g = D.goals.find(x => x.id === el.closest('[data-gid]').dataset.gid); if (g && confirm(`هدف «${g.title}» حذف شود؟`)) { D.goals = D.goals.filter(x => x !== g); save(); sfx('back'); paint(); } break; }
      case 'pm-len': if (!P().running) { P().len = +el.dataset.v; P().mode = 'focus'; P().remain = P().len * 60; save(); paint(); } else say('اول تایمر را متوقف کنید'); break;
      case 'pm-go': { const p = P(); if (p.running) { p.remain = pRemain(); p.running = false; sfx('close'); } else { if (p.remain <= 0) p.remain = pTotal(); p.endsAt = nowMs() + p.remain * 1000; p.running = true; sfx('open'); } save(); paint(); break; }
      case 'pm-reset': { const p = P(); p.running = false; p.mode = 'focus'; p.remain = p.len * 60; save(); paint(); break; }
      case 'pm-break': { const p = P(); p.mode = 'break'; p.remain = 300; p.running = true; p.endsAt = nowMs() + 300000; save(); sfx('toggle'); paint(); break; }
      case 'pm-skip': { const p = P(); if (p.mode !== 'focus') break; const done = pTotal() - pRemain(); if (done < 60) { say('کمتر از یک دقیقه — چیزی ثبت نشد'); break; } const t = credit(done); P().log[keyOf(todayJ())].s++; p.running = false; p.remain = p.len * 60; save(); sfx('save'); say(`${mins(done / 60)} تمرکز ثبت شد${t ? ' برای «' + t.title + '»' : ''}`, 'ok'); paint(); break; }
      case 'range': range = el.dataset.v; paint(); break;
      case 'heat': setSel(+el.dataset.j); ui().tab = 'desk'; save(); paint(); window.scrollTo({ top: 0, behavior: 'smooth' }); break;
    }
  }
  function onChange(e) {
    const t = e.target;
    if (t.id === 'jp-d' || t.id === 'jp-m' || t.id === 'jp-y') { const y = +q('#jp-y', root).value, m = +q('#jp-m', root).value; const d = Math.min(+q('#jp-d', root).value, mLen(y, m)); sfx('tick'); setSel(j2d(y, m, d)); }
    else if (t.id === 'dy-sort' && t.value) { const d = day(sel); const by = t.value; const W = x => PRIO[x.prio].w;
      d.tasks.sort(by === 'start' ? (a, b) => (a.start || '99') .localeCompare(b.start || '99') : by === 'prio' ? (a, b) => W(b) - W(a) : by === 'cat' ? (a, b) => D.cats.findIndex(c => c.id === a.cat) - D.cats.findIndex(c => c.id === b.cat) : by === 'done' ? (a, b) => (a.done - b.done) : (a, b) => b.target - a.target);
      save(); sfx('toggle'); paint(); }
    else if (t.id === 'pm-link0' || t.id === 'pm-link1') { P().link = t.value; save(); sfx('pick'); }
    else if (t.id === 'hm-y') { heatYear = t.value === 'last' ? 'last' : +t.value; paint(); }
    else if (t.id === 'hm-m') { heatMetric = t.value; paint(); }
  }
  function onDown(e) {
    const li = e.target.closest('.tk[data-tid]'); if (li && root.contains(li)) return dndStart(e, { type: 'task', k: li.dataset.k, id: li.dataset.tid }, li);
    const bk = e.target.closest('.bk[data-bid]'); if (bk && root.contains(bk)) return dndStart(e, { type: 'bank', id: bk.dataset.bid }, bk);
  }
  function onSubmit(e) {
    e.preventDefault(); const f = e.target, fd = new FormData(f);
    if (f.id === 'qadd') {
      const title = String(fd.get('title') || '').trim(); if (!title) return;
      const t = { id: uid(), title, cat: fd.get('cat'), target: Math.max(0, Math.min(1440, +fd.get('mins') || 0)), spent: 0, done: false, prio: fd.get('prio') || 'norm', start: fd.get('start') || '', pid: fd.get('pid') || '' };
      if (fd.get('tobank')) { const b = { id: uid(), title, cat: t.cat, mins: t.target, prio: t.prio, start: t.start, pid: t.pid, routine: [] }; D.bank.push(b); t.bankId = b.id; }
      addTask(sel, t); sfx('save'); say('تسک اضافه شد ✓', 'ok'); paint(); const ni = q('#qadd [name=title]', root); ni && ni.focus();
    } else if (f.id === 'cat-add') {
      const name = String(fd.get('name') || '').trim(); if (!name) return;
      D.cats.push({ id: 'c' + uid(), name, icon: String(fd.get('icon') || '').trim() || '🏷️', color: fd.get('color') || '#8b5cf6' }); save(); sfx('save'); paint();
    }
  }

  /* ---------- modals ---------- */
  function modal(html, onSave) {
    const m = (typeof openModal === 'function') ? openModal(`<form class="dl-form" autocomplete="off">${html}<div class="form-actions"><button class="dl-btn vi" type="submit" data-snd="1">💾 ذخیره</button><button type="button" class="dl-btn" data-close>انصراف</button></div></form>`, 'dl-modal') : null;
    if (!m) return; const f = m.querySelector('form');
    f.addEventListener('submit', e => { e.preventDefault(); if (onSave(new FormData(f), f) !== false) { save(); sfx('save'); if (typeof closeModal === 'function') closeModal(); paint(); } });
    f.addEventListener('click', e => { const b = e.target.closest('[data-rt]'); if (b) { e.preventDefault(); b.classList.toggle('on'); sfx('toggle'); } });
    const i = f.querySelector('input[name=title]'); i && setTimeout(() => i.focus(), 30);
  }
  const fld = (lbl, inner) => `<label class="dl-fld"><span>${lbl}</span>${inner}</label>`;
  function editTask(k, t) {
    modal(`<h2 class="dl-h2">✎ ویرایش تسک</h2><div class="dl-p">${fmtD(jOf(k))}</div>
      ${fld('عنوان', `<input name="title" maxlength="120" required value="${h(t.title)}">`)}
      <div class="dl-row">${fld('دسته', `<select name="cat">${catOpts(t.cat)}</select>`)}${fld('ساعت شروع', `<input name="start" type="time" value="${h(t.start || '')}">`)}</div>
      <div class="dl-row">${fld('زمان هدف (دقیقه)', `<input name="target" type="number" min="0" max="1440" step="5" value="${t.target || 0}">`)}${fld('زمان واقعی (دقیقه)', `<input name="spent" type="number" min="0" max="1440" step="1" value="${Math.round(spentOf(k, t) / 60)}">`)}</div>
      ${fld('اولویت', prioSeg('prio', t.prio))}
      ${fld('لینک به پروژهٔ پورتال', `<select name="pid">${projOpts(t.pid)}</select>`)}
      ${fld('یادداشت', `<textarea name="note" rows="3">${h(t.note || '')}</textarea>`)}`, fd => {
      const title = String(fd.get('title') || '').trim(); if (!title) return false;
      if (D.timer && D.timer.k === k && D.timer.id === t.id) stopTimer(true);
      Object.assign(t, { title, cat: fd.get('cat'), start: fd.get('start') || '', target: Math.max(0, +fd.get('target') || 0), spent: Math.max(0, +fd.get('spent') || 0) * 60, prio: fd.get('prio') || 'norm', pid: fd.get('pid') || '', note: String(fd.get('note') || '') });
    });
  }
  function editBank(b) {
    const isNew = !b; b = b || { id: uid(), title: '', cat: D.cats[0].id, mins: 30, prio: 'norm', routine: [], start: '', pid: '' };
    modal(`<h2 class="dl-h2">${isNew ? '＋ تسک جدید در بانک' : '✎ ویرایش تسک بانک'}</h2>
      ${fld('عنوان', `<input name="title" maxlength="120" required value="${h(b.title)}">`)}
      <div class="dl-row">${fld('دسته', `<select name="cat">${catOpts(b.cat)}</select>`)}${fld('زمان هدف (دقیقه)', `<input name="mins" type="number" min="0" max="1440" step="5" value="${b.mins || 0}">`)}${fld('ساعت شروع', `<input name="start" type="time" value="${h(b.start || '')}">`)}</div>
      ${fld('اولویت', prioSeg('prio', b.prio))}
      ${fld('روزهای روتین (چیدمان خودکار)', `<div class="rt-days">${WD.map((w, i) => `<button type="button" data-rt="${i}" class="${b.routine.includes(i) ? 'on' : ''}">${w}</button>`).join('')}</div>`)}
      ${fld('لینک به پروژهٔ پورتال', `<select name="pid">${projOpts(b.pid)}</select>`)}`, (fd, f) => {
      const title = String(fd.get('title') || '').trim(); if (!title) return false;
      Object.assign(b, { title, cat: fd.get('cat'), mins: Math.max(0, +fd.get('mins') || 0), start: fd.get('start') || '', prio: fd.get('prio') || 'norm', pid: fd.get('pid') || '', routine: qa('[data-rt].on', f).map(x => +x.dataset.rt) });
      delete b.sample; if (isNew) D.bank.push(b);
    });
  }
  function editGoal(g) {
    const isNew = !g; g = g || { id: uid(), title: '', unit: 'بار', target: 30, value: 0, step: 1, color: '#a78bfa', log: {} };
    modal(`<h2 class="dl-h2">${isNew ? '＋ هدف / عادت جدید' : '✎ ویرایش هدف'}</h2>
      ${fld('عنوان', `<input name="title" maxlength="80" required value="${h(g.title)}">`)}
      <div class="dl-row">${fld('واحد', `<input name="unit" maxlength="20" value="${h(g.unit)}">`)}${fld('هدف', `<input name="target" type="number" min="1" value="${g.target}">`)}${fld('گام هر ＋', `<input name="step" type="number" min="1" value="${g.step}">`)}</div>
      <div class="dl-row">${fld('مقدار فعلی', `<input name="value" type="number" min="0" value="${g.value}">`)}${fld('رنگ', `<input name="color" type="color" value="${h(g.color || '#a78bfa')}">`)}</div>`, fd => {
      const title = String(fd.get('title') || '').trim(); if (!title) return false;
      Object.assign(g, { title, unit: String(fd.get('unit') || '').trim() || 'بار', target: Math.max(1, +fd.get('target') || 1), step: Math.max(1, +fd.get('step') || 1), value: Math.max(0, +fd.get('value') || 0), color: fd.get('color') || '#a78bfa' });
      delete g.sample; if (isNew) D.goals.push(g);
    });
  }

  /* ---------- backup ---------- */
  function exportJSON() {
    if (D.timer) stopTimer(true);
    const blob = new Blob([JSON.stringify({ app: 'milad-portal', module: 'daily', version: 1, exportedAt: new Date().toISOString(), daily: D }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); const [y, m, d] = d2j(todayJ());
    a.download = `daily-backup-${y}-${pad(m)}-${pad(d)}.json`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    sfx('save'); say('فایل پشتیبان امور روزانه ساخته شد ⬇️', 'ok'); paint();
  }
  function importData(obj) {
    const v = obj && obj.daily ? obj.daily : obj; if (!valid(v)) return false;
    D = normalize(JSON.parse(JSON.stringify(v))); save(); return true;
  }
  function onImport(e) {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    const r = new FileReader();
    r.onload = () => { let ok = false; try { ok = importData(JSON.parse(r.result)); } catch (x) { ok = false; } if (ok) { sfx('upload'); say('اطلاعات امور روزانه بازیابی شد ✓', 'ok'); paint(); } else { sfx('error'); say('فایل معتبر نیست', 'err'); } };
    r.readAsText(f);
  }

  function destroy() { destroyCharts(); const g = document.querySelector('.dl-ghost'); g && g.remove(); document.body.classList.remove('dl-dragging'); root = null; }
  function reset() { D = seed(); save(); }
  function clearSamples() {
    const n = D.bank.filter(b => b.sample).length + D.goals.filter(g => g.sample).length;
    const ids = new Set(D.bank.filter(b => b.sample).map(b => b.id));
    D.bank = D.bank.filter(b => !b.sample); D.goals = D.goals.filter(g => !g.sample);
    for (const k in D.days) D.days[k].tasks = D.days[k].tasks.filter(t => !(ids.has(t.bankId) && !t.spent && !t.done));
    save(); return n;
  }
  return { api: { day: (j, m) => day(j, m), save: () => save(), cats: () => D.cats, newTask: (title, cat) => ({ id: uid(), title, cat: cat || (D.cats[0] && D.cats[0].id) || 'work', target: 0, spent: 0, done: false, prio: 'norm', start: '', pid: '' }) }, render, destroy, data: () => D, importData, reset, clearSamples, _t: { j2d, d2j, g2d, d2g, isLeap, mLen, keyOf, sat, todayJ, fmtD } };
})();
