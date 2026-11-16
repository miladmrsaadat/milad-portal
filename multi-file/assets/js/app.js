/* ================= Core ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const view = $('#view');
const K_PORTAL = 'mss_portal_v1', K_CK = 'mss_checklist_v1';
function load(key, seed, ok) {
  // stale / corrupted storage is never fatal: anything unreadable or malformed is replaced by the seed
  try { const v = JSON.parse(STORE.getItem(key)); if (v && v.version && (!ok || ok(v))) return v; } catch (e) { }
  const s = seed(); STORE.setItem(key, JSON.stringify(s)); return s;
}
let S = load(K_PORTAL, seedPortal, v => Array.isArray(v.projects) && v.projects.every(p => p && typeof p === 'object') && v.notes && typeof v.notes === 'object');
let CK = load(K_CK, seedChecklist, v => v && typeof v === 'object');
const saveS = () => STORE.setItem(K_PORTAL, JSON.stringify(S));
const saveCK = () => STORE.setItem(K_CK, JSON.stringify(CK));

const JF = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric' });
const jdate = ts => JF.format(new Date(ts)).replace(/[^\d/]/g, '').split('/').join('.');
const JLONG = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
const faNum = n => Number(n).toLocaleString('fa-IR');

const now = () => Date.now();
const staleDays = p => Math.floor((now() - (p.lastProgressAt || p.createdAt)) / DAY);
const isStale = p => !p.done && p.progress < 100 && staleDays(p) > 7;
const isRunning = p => !p.done && p.progress > 0 && p.progress < 100;
const MAX_ACTIVE = 3;
const isQueuedIdea = p => !!(p && !p.done && !p.convertedAt && (p.kind === 'idea' || ((+p.progress || 0) <= 10 && p.sub === STARTED_SUB)));
const isActiveWork = p => !!(p && !p.done && p.progress > 0 && p.progress < 100 && !isQueuedIdea(p));
const activeWork = () => S.projects.filter(isActiveWork);
function askActivate(title, onYes, onNo) {
  const n = activeWork().length;
  if (n < MAX_ACTIVE) { onYes && onYes(false); return; }
  openModal(`<h3>سقف پروژه‌های فعال</h3>
    <p>سقف ۳ پروژهٔ فعال پر است (الان ${faNum(n)} پروژه در حال اجراست). «${esc(title || 'این مورد')}» می‌تواند در صف ایده بماند یا با تأیید شما فعال شود.</p>
    <div class="form-actions"><button type="button" class="btn solid" id="cap-queue" data-snd="1">در صف ایده بماند</button><button type="button" class="btn ghost" id="cap-force" data-snd="1">با این حال فعال کن</button></div>`);
  $('#cap-queue').onclick = () => { closeModal(); onNo && onNo(); };
  $('#cap-force').onclick = () => { closeModal(); onYes && onYes(true); };
}
function convertIdea(p) {
  if (!p) return p;
  p.history = Array.isArray(p.history) ? p.history : [];
  p.history.push({ at: now(), ev: 'converted', from: { sub: p.sub, progress: p.progress, kind: p.kind || 'idea' } });
  if (p.sub === STARTED_SUB && CATS[p.cat] && CATS[p.cat].subs[1]) p.sub = CATS[p.cat].subs[1];
  p.kind = 'project';
  p.convertedAt = now();
  saveS();
  return p;
}
function wouldActivate(p, patch) {
  const n = Object.assign({}, p, patch || {});
  n.progress = Math.max(0, Math.min(100, +n.progress || 0));
  if (n.progress >= 100) n.done = true;
  return isActiveWork(n) && !isActiveWork(p);
}
const catOf = p => CATS[p.cat] || RUNNING;
const progColor = v => v <= 25 ? '#ff7a00' : v <= 50 ? '#ffc107' : v <= 75 ? '#22c55e' : '#3b82f6';

function badge(p, size) {
  const st = size ? `style="--s:${size}"` : '';
  if (p.cat === 'company') return `<span class="aib img" style="--c:#14c8d8;${size ? '--s:' + size : ''}" title="فتوگرافی پزشکی تهران"><img src="${ASSET('logo-company-flat.png')}" alt=""></span>`;
  if (p.cat === 'personal') return `<span class="aib img milad" style="--c:#f5b53d;${size ? '--s:' + size : ''}" title="میلاد سعادت"><img src="${ASSET('logo-milad-v2-256.png')}" alt=""></span>`;
  return aiBadge(p.ai, size);
}
function aiBadge(ai, size) {
  const a = AIS[ai];
  if (!a) return `<span class="aib none" ${size ? `style="--s:${size}"` : ''} title="بدون هوش مصنوعی"><span>—</span></span>`;
  return `<span class="aib" style="--c:${a.color};${size ? '--s:' + size : ''}" title="${a.name}"><svg><use href="#sym-${ai}"/></svg></span>`;
}
const bar = (v, c) => `<div class="bar" style="--p:${v}%;--c:${c || progColor(v)}"><i></i></div>`;
const pnum = (v, c) => `<span class="pnum" style="--c:${c || progColor(v)}">${v}%</span>`;
const staleBadge = p => isStale(p) ? `<span class="stale-badge" title="بیش از ۷ روز بدون پیشرفت">${faNum(staleDays(p))} روز بدون پیشرفت</span>` : '';
const ICON = {
  link: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M10.6 13.4a1 1 0 0 1 0-1.4l3.5-3.5a3 3 0 1 1 4.2 4.2l-2 2a1 1 0 1 1-1.4-1.4l2-2a1 1 0 1 0-1.4-1.4l-3.5 3.5a1 1 0 0 1-1.4 0ZM13.4 10.6a1 1 0 0 1 0 1.4l-3.5 3.5a3 3 0 1 1-4.2-4.2l2-2a1 1 0 0 1 1.4 1.4l-2 2a1 1 0 1 0 1.4 1.4l3.5-3.5a1 1 0 0 1 1.4 0Z"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 17.3V20h2.7l8-8-2.7-2.7-8 8Zm12.7-7.9a.9.9 0 0 0 0-1.3l-1.8-1.8a.9.9 0 0 0-1.3 0l-1.3 1.3 3.1 3.1 1.3-1.3Z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  back: '<svg viewBox="0 0 24 24"><defs><linearGradient id="bkG" x1="0" x2="1"><stop offset="0" stop-color="#7cb4ff"/><stop offset="1" stop-color="#ff6b81"/></linearGradient></defs><path fill="none" stroke="url(#bkG)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="M4 12h15M13 6l6 6-6 6"/></svg>',
};

/* ---------- toasts & modal ---------- */
function toast(msg, type = '') {
  const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg;
  $('#toast-wrap').appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 450); }, 2600);
}
function lockScrollForModal() {
  if (document.body.classList.contains('modal-open')) return;
  const y = window.scrollY || window.pageYOffset || 0;
  document.body.dataset.scrollY = String(y);
  document.body.classList.add('modal-open');
  document.body.style.top = '-' + y + 'px';
}
function unlockScrollForModal() {
  if (!document.body.classList.contains('modal-open')) return;
  const y = +document.body.dataset.scrollY || 0;
  document.body.classList.remove('modal-open');
  document.body.style.top = '';
  document.body.removeAttribute('data-scroll-y');
  window.scrollTo(0, y);
}
function openModal(inner, cls = '') {
  const prev = $('#modal-root .overlay'); if (prev) prev.remove();
  lockScrollForModal();
  const o = document.createElement('div'); o.className = 'overlay';
  o.innerHTML = `<div class="modal glass ${cls}"><button class="icon-btn m-x" data-close>✕</button>${inner}</div>`;
  o.addEventListener('mousedown', e => { if (e.target === o) closeModal(); });
  o.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(); });
  $('#modal-root').appendChild(o); SFX.open();
  return o.firstElementChild;
}
function closeModal() {
  const o = $('#modal-root .overlay'); if (o) o.remove();
  if (!$('#modal-root .overlay')) unlockScrollForModal();
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ---------- shared header ---------- */
function topbar(pageName, backTo, extra = '') {
  return `<header class="topbar glass">
    <button class="back-btn" data-back="${backTo}" data-snd="1" aria-label="بازگشت">${ICON.back}</button>
    <img class="t-logo" src="${ASSET('logo-milad-v2.png')}" alt="لوگو">
    <div class="t-text">
      <div class="brand-title">مدیریت پروژه‌ها و امور اجرایی</div>
      <div class="brand-sub">Ai Ideas <span class="amp">&amp;</span> Projects</div>
      <div class="brand-en">${brandSubtitle()}</div>
    </div>
    ${extra}
    <div class="t-owner" ${extra ? 'style="margin-inline-start:2rem"' : ''}><span class="brand-owner">Milad Saadat</span><span class="t-page">${esc(pageName)}</span></div>
  </header>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-back]');
  if (b) { SFX.back(); b.classList.add('go'); setTimeout(() => go(b.dataset.back), 260); return; }
  const btn = e.target.closest('button, .clickable');
  if (btn && !btn.dataset.snd && !btn.closest('[data-snd]')) { const t0 = SFX.lastAt || 0; setTimeout(() => { if ((SFX.lastAt || 0) === t0) SFX.click(); }, 0); }
});

/* ---------- router ---------- */
const ROUTES = {};
let currentRoute = '';
function go(r) { if (location.hash === '#/' + r || (r === '' && (location.hash === '' || location.hash === '#/'))) render(); else location.hash = '#/' + r; }
function render() {
  const r = (location.hash.replace(/^#\/?/, '') || '').split('?')[0];
  const key = ROUTES[r] ? r : /^agent\/[a-z]+$/.test(r) ? 'agent' : '';
  currentRoute = key;
  closeModal(); view.onclick = null;
  document.body.className = 'route-' + (key || 'landing');
  const fixed = key === '' || key === 'dashboard';
  document.body.classList.toggle('noscroll', fixed);
  Sky.setMode(key === 'checklist' ? 'checklist' : 'default');
  window.scrollTo(0, 0);
  if (window._crewOrbit && _crewOrbit.destroy) { try { _crewOrbit.destroy(); } catch (e) { } window._crewOrbit = null; }
  if (window.Finance && Finance.destroy) Finance.destroy();
  if (window.Daily && Daily.destroy) Daily.destroy();
  if (window.Agents && Agents.destroy) Agents.destroy();
  ROUTES[key]();
  updateRocket();
}
window.addEventListener('hashchange', render);

/* ---------- rocket ---------- */
const rocket = $('#rocket');
function updateRocket() {
  const scrollPage = !['', 'dashboard'].includes(currentRoute);
  rocket.classList.toggle('hidden', !(scrollPage && window.scrollY > 300));
}
window.addEventListener('scroll', updateRocket, { passive: true });
rocket.dataset.snd = '1';
rocket.addEventListener('click', () => {
  SFX.rocket(); rocket.classList.add('launch');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => { rocket.classList.remove('launch'); updateRocket(); }, 1100);
});

/* ---------- global controls ---------- */
const sndBtn = $('#btn-sound');
const paintSnd = () => sndBtn.textContent = SFX.muted ? '🔇' : '🔊';
paintSnd(); sndBtn.dataset.snd = '1';
sndBtn.addEventListener('click', () => { SFX.toggle(); paintSnd(); toast(SFX.muted ? 'صدا خاموش شد' : 'صدا روشن شد'); });
$('#btn-menu').addEventListener('click', e => { e.stopPropagation(); $('#menu').classList.toggle('hidden'); });
document.addEventListener('click', e => { if (!e.target.closest('#menu') && !e.target.closest('#btn-menu')) $('#menu').classList.add('hidden'); });
$('#menu').addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const act = a.dataset.act; $('#menu').classList.add('hidden');
  if (act === 'export') {
    const data = { app: 'milad-saadat-portal', exportedAt: new Date().toISOString(), portal: S, checklist: CK, finance: window.Finance ? Finance.data() : null, daily: window.Daily ? Daily.data() : null, agents: window.Agents ? Agents.data() : null, extras: window.Extras ? Extras.data() : null, muted: STORE.getItem('mss_muted'), storage: collectStorage() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const u = URL.createObjectURL(blob), l = document.createElement('a');
    l.href = u; l.download = 'portal-backup-' + jdate(now()) + '.json'; l.click(); setTimeout(() => URL.revokeObjectURL(u), 2000);
    toast('فایل پشتیبان ذخیره شد', 'ok');
    if (window.Offline) Offline.lastBackup();
  } else if (act === 'export-share') {
    const data = window.Offline ? Offline.snapshot({ excludeFinance: true }) : { financeOmitted: true, portal: S };
    Offline ? Offline.downloadJson('portal-shareable-' + jdate(now()) + '.json', data) : null;
    toast('خروجی قابل اشتراک بدون داده مالی ذخیره شد', 'ok');
    if (window.Offline) Offline.lastBackup();
  } else if (act === 'export-fin') {
    const data = { app: 'milad-saadat-portal-finance', exportedAt: new Date().toISOString(), finance: window.Finance ? Finance.data() : null };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const u = URL.createObjectURL(blob), l = document.createElement('a');
    l.href = u; l.download = 'finance-only-' + jdate(now()) + '.json'; l.click(); setTimeout(() => URL.revokeObjectURL(u), 2000);
    toast('خروجی جداگانه مالی ذخیره شد', 'ok');
    if (confirm('داده مالی از حافظهٔ این مرورگر حذف شود و از این به بعد سید داخلی بارگذاری نشود؟ (اختیاری — پیش‌فرض فعلی تغییر نمی‌کند مگر تأیید کنی)')) {
      try { STORE.setItem('mss_finance_detached', '1'); STORE.removeItem('mss_finance_v1'); } catch (e) { }
      if (window.Finance && Finance.importData) Finance.importData({ version: 2, unit: 'تومان', tx: [], sources: [], statements: [] });
      toast('داده مالی از این مرورگر جدا شد. برای بازگردانی، فایل مالی را وارد کن.', 'ok');
    }
  } else if (act === 'export-enc') {
    const pw = prompt('رمز پشتیبان را وارد کن (حداقل ۴ کاراکتر). این رمز فقط نزد تو می‌ماند.');
    if (!pw || pw.length < 4) { toast('رمز نامعتبر است'); }
    else {
      const snap = window.Offline ? Offline.snapshot({ excludeFinance: false }) : { portal: S };
      Offline.encryptJson(snap, pw).then(pack => { Offline.downloadJson('portal-backup-enc-' + jdate(now()) + '.json', pack); Offline.lastEnc(); toast('پشتیبان رمزگذاری‌شده ذخیره شد', 'ok'); }).catch(err => toast('رمزگذاری ممکن نشد'));
    }
  } else if (act === 'export-csv') {
    const csv = window.Offline ? Offline.projectsCsv() : '';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const u = URL.createObjectURL(blob), l = document.createElement('a'); l.href = u; l.download = 'projects-' + jdate(now()) + '.csv'; l.click();
    toast('CSV پروژه‌ها ذخیره شد', 'ok');
  } else if (act === 'recycle') go('recycle');
  else if (act === 'health') go('health');
  else if (act === 'review') go('review');
  else if (act === 'assist') go('assist');
  else if (act === 'knowledge') go('knowledge');
  else if (act === 'subtitle') {
    const cur = (window.Offline && Offline.prefs().subtitle) || '';
    const v = prompt('متن زیرعنوان صفحهٔ ورود (خالی = متن پیش‌فرض)', cur);
    if (v != null && window.Offline) { Offline.setPref('subtitle', v.trim()); toast('زیرعنوان ذخیره شد', 'ok'); if (!location.hash || location.hash === '#/') render(); }
  } else if (act === 'import') $('#import-file').click();
  else if (act === 'reset-samples') {
    if (!confirm('پورتال و چک‌لیست به نسخه نمونه برگردند و امور مالی به داده اصلی صورت‌حساب‌ها؟ (ردیف‌های دستی/آپلودی مالی پاک می‌شوند)')) return;
    S = seedPortal(); CK = seedChecklist(); saveS(); saveCK(); if (window.Finance) Finance.reset(); if (window.Daily) Daily.reset(); if (window.Agents) Agents.reset();
    toast('بازنشانی انجام شد', 'ok'); render();
  } else if (act === 'clear-samples') {
    const n = S.projects.filter(p => p.sample).length;
    S.projects = S.projects.filter(p => !p.sample); saveS();
    const f = window.Finance ? Finance.clearSamples() : 0;
    const dl = window.Daily ? Daily.clearSamples() : 0;
    const ag = window.Agents ? Agents.clearSamples() : 0;
    toast(`${faNum(n)} پروژه نمونه${f ? ' و ' + faNum(f) + ' تراکنش نمونه' : ''}${dl ? ' و ' + faNum(dl) + ' مورد نمونهٔ امور روزانه' : ''}${ag ? ' و ' + faNum(ag) + ' کار نمونهٔ ایجنت‌ها' : ''} حذف شد`, 'ok'); render();
  }
});
$('#import-file').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    let d = JSON.parse(await f.text());
    if (d && d.enc) {
      const pw = prompt('رمز این پشتیبان را وارد کن');
      if (!pw) { toast('بازیابی لغو شد'); e.target.value = ''; return; }
      d = await Offline.decryptJson(d, pw);
    }
    if (d.offline && window.Offline) { try { STORE.setItem('mss_offline_v1', JSON.stringify(d.offline)); Offline.load && null; } catch (ex) { } }
    if (d.storage && typeof d.storage === 'object') {
      Object.keys(d.storage).forEach(k => { if (k && k.indexOf('mss_') === 0) STORE.setItem(k, d.storage[k]); });
    }
    if (d.portal && d.portal.projects) { S = d.portal; saveS(); }
    if (d.checklist && d.checklist.groups) { CK = d.checklist; saveCK(); }
    if (d.finance && window.Finance) Finance.importData(d.finance);
    if (d.daily && window.Daily) Daily.importData(d.daily);
    if (d.agents && window.Agents) Agents.importData(d.agents);
    if (d.extras && window.Extras) Extras.importData(d.extras);
    if (d.muted != null) STORE.setItem('mss_muted', d.muted);
    SFX.save(); toast('پشتیبان بازیابی شد', 'ok');
    if (STORE.persistent) location.reload(); else render();
  } catch (err) { SFX.error(); toast('فایل پشتیبان معتبر نیست'); }
  e.target.value = '';
});

function collectStorage() {
  const out = {}, add = k => { if (!k || k.indexOf('mss_') !== 0 || out[k] != null) return; const v = STORE.getItem(k); if (v != null) out[k] = v; };
  try { (STORE.keys ? STORE.keys() : []).forEach(add); } catch (e) { }
  try { if (STORE.persistent) { for (let i = 0; i < localStorage.length; i++) add(localStorage.key(i)); } } catch (e) { }
  ['mss_portal_v1', 'mss_checklist_v1', 'mss_finance_v1', 'mss_daily_v1', 'mss_agents_v1', 'mss_extras_v1', 'mss_offline_v1', 'mss_muted', 'mss_finance_pin', 'mss_finance_detached'].forEach(add);
  try { Object.keys(CATS || {}).concat('running').forEach(k => add('mss_view_' + k)); } catch (e) { }
  return out;
}

/* ---------- project helpers ---------- */
function nextNo(cat) {
  const list = S.projects.filter(p => p.cat === cat && !p.ideaId);
  const base = cat === 'music' ? 300 : 0;
  return Math.max(base, ...list.map(p => p.no < 900 ? p.no : 0)) + 1;
}
function defaultMusic(title) {
  return { singer: 'milad', reference: '', referenceName: '', referenceLink: '', referenceOn: false, structure: '[Intro]\n[Verse 1]\n[Chorus]\n[Verse 2]\n[Chorus]\n[Bridge]\n[Outro]', style: '', negative: '', lyrics: '', vocal: 'male', lyricsMode: 'manual', weirdness: 50, styleInfluence: 50, variety: 50, audioInfluence: 25, maxMode: false, personalize: false, myTaste: false, instrumental: false, duration: 'auto', model: 'V6', build: 'new', audioHas: false, clones: [], inspoHas: false, inspoNote: '', inspoLink: '', songTitle: title || '', savePath: '' };
}
function createProject(o) {
  const t = now();
  const p = Object.assign({ id: 'p' + t.toString(36) + Math.random().toString(36).slice(2, 6), no: o.no || nextNo(o.cat), sub: STARTED_SUB, desc: '', link: '', ai: null, progress: 10, done: false, sample: false, createdAt: t, lastProgressAt: t }, o);
  if (p.cat === 'music' && !p.music) p.music = defaultMusic(p.title);
  S.projects.push(p); saveS(); return p;
}
function updateProject(p, patch) {
  if (patch.progress != null && +patch.progress !== +p.progress) { patch.lastProgressAt = now(); }
  const watch = ['title', 'progress', 'sub', 'next', 'finish', 'desc', 'paused', 'archived', 'tags', 'hours', 'dependsOn'];
  const before = {};
  watch.forEach(k => { if (k in (patch || {})) before[k] = p[k]; });
  Object.assign(p, patch);
  p.progress = Math.max(0, Math.min(100, +p.progress || 0));
  if (p.progress >= 100 && !p.done && !document.body.classList.contains('lowpower')) { try { Sky.meteorShower(10); } catch (e) { } }
  if (p.progress >= 100) p.done = true;
  const ch = {};
  watch.forEach(k => { if (k in before && JSON.stringify(before[k]) !== JSON.stringify(p[k])) ch[k] = { from: before[k], to: p[k] }; });
  if (Object.keys(ch).length) { p.history = Array.isArray(p.history) ? p.history : []; p.history.push({ at: now(), ev: 'edit', ch }); }
  if (!S.projects.includes(p)) S.projects.push(p);
  saveS();
}
function taskProgressOf(p) {
  if (!p || !window.Daily) return null;
  try {
    const D = Daily.data(); let n = 0, d = 0;
    Object.values(D.days || {}).forEach(day => (day.tasks || []).forEach(t => { if (t.pid === p.id) { n++; if (t.done) d++; } }));
    return n ? Math.round(d / n * 100) : null;
  } catch (e) { return null; }
}
function projectLane(p) {
  if (p.archived) return 'archive';
  if (p.done) return 'done';
  if (p.paused) return 'paused';
  if (typeof isQueuedIdea === 'function' && isQueuedIdea(p)) return 'idea';
  if (!(+p.progress)) return 'ready';
  return 'doing';
}
function canShowProjectCost() {
  if (window.__SHAREABLE) return false;
  try {
    const lock = (typeof FinLock !== 'undefined' && FinLock) || window.FinLock;
    if (lock && typeof lock.ok === 'function') return !!lock.ok();
    return true;
  } catch (e) { return false; }
}
function projectCostLine(p) {
  if (!canShowProjectCost() || !p || !window.Offline || !Offline.projectCost) return '';
  let c; try { c = Offline.projectCost(p); } catch (e) { return ''; }
  if (!c || !c.n) return '';
  const shown = (window.Finance && typeof Finance.dispAmt === 'function') ? Finance.dispAmt(c.spent || 0) : null;
  if (shown == null) return '';
  const txt = (typeof Finance.fmt === 'function') ? Finance.fmt(shown) : faNum(shown);
  return `<div class="i-fin i-cost" data-stop><b>هزینهٔ مرتبط</b><span>${txt} تومان · ${faNum(c.n)} تراکنش</span></div>`;
}
function softDeleteProject(p) {
  if (window.Offline) Offline.trash('project', p.title, p);
  S.projects = S.projects.filter(x => x !== p);
  saveS();
}
const byDateDesc = (a, b) => b.createdAt - a.createdAt;
const byDateAsc = (a, b) => a.createdAt - b.createdAt;

/* ================= Page 1: Landing ================= */
function brandSubtitle() {
  try { const s = (window.Offline && Offline.prefs().subtitle) || (window.Extras && Extras.data && (Extras.data().prefs || {}).subtitle); if (s) return esc(s); } catch (e) {}
  return 'Company Executive Management, as Well as Personal Artificial Intelligence Ideas And Projects';
}
ROUTES[''] = () => {
  view.innerHTML = `<section class="landing">
    <div class="l-logo-wrap l-orbit-wrap" id="crewOrbitHome" dir="rtl"></div>
    <h1 class="brand-title">مدیریت پروژه‌ها و امور اجرایی</h1>
    <div class="brand-sub">Ai Ideas <span class="amp">&amp;</span> Projects</div>
    <div class="brand-en">${brandSubtitle()}</div>
    <div class="divider"></div>
    <div class="sig">Milad Saadat</div>
    <div class="l-btns">
      <button class="enter-btn" id="enter" data-snd="1">ورود</button>
      <button class="fin-btn" id="fin-enter" data-snd="1"><span class="fb-coins"><i></i><i></i><i></i></span><span class="fb-ic"><svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M3 17l5-5 4 4 8-8M15 8h5v5"/></svg></span><span>مدیریت امور مالی</span></button>
      <button class="day-btn" id="day-enter" data-snd="1"><span class="db-orbit"><i></i><i></i></span><span class="db-ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path class="db-h" d="M12 12V7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path class="db-m" d="M12 12l4 2.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span><span class="db-tx"><b>مدیریت امور روزانه</b><small>هفته · تسک · تمرکز</small></span></button>
      <button class="ag-orb-btn" id="ag-enter" data-snd="1" aria-label="مدیریت ایجنت‌ها"><span class="ao-stage"><span class="ao-core"><i></i></span>${agentOrbits()}</span><span class="ao-label"><b>مدیریت ایجنت‌ها</b><small>Agents Command Center</small></span></button>
    </div>
    <div class="hint">پورتال شخصی و اجرایی میلاد سعادت</div>
  </section>`;
  const land = $('.landing');
  $('#enter').onclick = () => {
    SFX.unlock(); SFX.enter(); land.classList.add('opening'); Sky.meteorShower(16);
    const w = $('#warp'); w.classList.remove('on', 'gold', 'violet'); void w.offsetWidth; w.classList.add('on');
    setTimeout(() => go('dashboard'), 1150);
  };
  $('#fin-enter').onclick = () => {
    SFX.unlock(); SFX.cash(); land.classList.add('opening', 'fin-open'); Sky.meteorShower(8);
    const w = $('#warp'); w.classList.remove('on', 'violet'); w.classList.add('gold'); void w.offsetWidth; w.classList.add('on');
    setTimeout(() => { w.classList.remove('gold'); go('finance'); }, 1100);
  };
  $('#day-enter').onclick = () => {
    SFX.unlock(); SFX.daily(); land.classList.add('opening', 'day-open'); Sky.meteorShower(12);
    const w = $('#warp'); w.classList.remove('on', 'gold'); w.classList.add('violet'); void w.offsetWidth; w.classList.add('on');
    setTimeout(() => { w.classList.remove('violet'); go('daily'); }, 1100);
  };
  $('#ag-enter').onclick = () => {
    SFX.unlock(); SFX.click(); land.classList.add('opening', 'ag-open'); Sky.meteorShower(14);
    const w = $('#warp'); w.classList.remove('on', 'gold', 'violet'); w.classList.add('agents'); void w.offsetWidth; w.classList.add('on');
    setTimeout(() => { w.classList.remove('agents'); go('agents'); }, 1150);
  };
  mountCrewOrbit('#crewOrbitHome', { radius: 0.27 });
};
function agentOrbits() {
  if (!window.Agents) return '';
  const A = Agents.AG, rings = [A.filter(a => a.grok).slice(0, 5), A.filter(a => a.grok).slice(5), A.filter(a => a.ext)];
  return rings.map((l, ri) => `<span class="ao-ring r${ri + 1}"><span class="ao-spd">${l.map((a, i) => `<span class="ao-sat" style="--i:${i};--n:${l.length};--c:${a.c}"><span class="ao-up"><span class="ao-up2">${a.ext ? `<svg><use href="#sym-${a.id}"/></svg>` : `<img src="${ASSET('agents/' + a.id + '.webp')}" alt="">`}</span></span></span>`).join('')}</span></span>`).join('');
}
ROUTES['agents'] = () => window.Agents ? Agents.renderMain(view) : (view.innerHTML = '<div class="empty">ماژول ایجنت‌ها بارگذاری نشد</div>');
ROUTES['agent'] = () => { const id = (location.hash.match(/agent\/([a-z]+)/) || [])[1]; window.Agents ? Agents.renderAgent(view, id) : (view.innerHTML = '<div class="empty">ماژول ایجنت‌ها بارگذاری نشد</div>'); };

/* ================= Daily planner (assets/js/daily.js) ================= */
ROUTES['daily'] = () => { if (window.Daily) Daily.render(view); else { view.innerHTML = '<div class="page"><p>ماژول امور روزانه بارگذاری نشد.</p></div>'; } };

/* ================= Page 2: Dashboard ================= */
ROUTES['dashboard'] = () => {
  const active = S.projects.filter(p => !p.done);
  const running = S.projects.filter(isRunning);
  const stale = active.filter(isStale);
  const avg = running.length ? Math.round(running.reduce((a, p) => a + p.progress, 0) / running.length) : 0;
  const notes = NOTE_AIS.map(ai => `<div class="note ${ai}" data-ai="${ai}">
      <div class="note-head">${aiBadge(ai, '2.3rem')}<span>${AIS[ai].name}</span><small>Enter = ثبت</small></div>
      <textarea placeholder="ایده یا کار جدید را بنویس و Enter بزن…" data-note="${ai}">${esc(S.notes[ai] || '')}</textarea>
    </div>`).join('');
  const catBox = k => {
    const c = CATS[k], list = S.projects.filter(p => p.cat === k && !p.done);
    const run = list.filter(isRunning), st = list.filter(isStale).length;
    const a = run.length ? Math.round(run.reduce((s, p) => s + p.progress, 0) / run.length) : 0;
    const started = list.filter(p => p.sub === STARTED_SUB).length;
    const icon = k === 'company' ? '<img src="' + ASSET('logo-company-flat.png') + '" alt="">' : k === 'personal' ? '<img class="milad-logo" src="' + ASSET('logo-milad-v2-256.png') + '" alt="">' : c.icon;
    return `<div class="cat-box glass clickable" data-go="${k}" style="--c:${c.color}">
      <div class="cb-top"><span class="cb-icon">${icon}</span><h4>${c.name}</h4><span class="cb-n">${list.length}</span></div>
      <div class="cb-meta"><span>در حال اجرا <b>${run.length}</b></span><span>ایده‌های شروع‌شده <b>${started}</b></span>${st ? `<span class="stale-badge">${faNum(st)} هشدار</span>` : ''}</div>
      ${bar(a, c.color)}
    </div>`;
  };
  view.innerHTML = `<div class="dash">
    <div class="d-head">${topbar('داشبورد اصلی', '', `<button class="exec-btn" id="exec" data-snd="1" style="margin-inline-start:auto"><span class="ck">✔</span>پروژه‌های اجرایی</button><button class="btn ghost sm" id="dash-cfg" data-snd="1" title="تنظیم نمایش داشبورد">چیدمان</button>`)}</div>
    <div class="d-cap" id="d-cap"></div>
    <section class="d-notes" data-w="notes">${notes}</section>
    <section class="d-feat feat glass clickable" data-w="feat" data-go="running">
      <span class="f-icon">🚀</span>
      <div><h3>مدیریت پروژه‌های در حال اجرا</h3><p>همه پروژه‌های فعال از چهار بخش، مرتب‌شده بر اساس تاریخ</p><div style="margin-top:.6rem;max-width:34rem">${bar(avg, '#ff2e4d')}</div></div>
      <div class="f-stats"><div class="f-stat blue"><b>${running.length}</b><span>در حال اجرا</span></div><div class="f-stat"><b>${avg}%</b><span>میانگین پیشرفت</span></div><div class="f-stat red"><b>${stale.length}</b><span>بدون پیشرفت +۷ روز</span></div></div>
    </section>
    <section class="d-cats" data-w="cats">${['ai', 'music', 'company', 'personal'].map(catBox).join('')}</section>
    <section class="d-bottom" data-w="bottom">
      <div class="d-list glass"><div class="panel-title"><span class="dot" style="--c:#2f7bff"></span>پروژه‌های فعال<small>جدیدترین بالا · ${faNum(running.length)} پروژه</small></div><div class="act-list" id="act-list"></div></div>
      <div class="d-chart glass"><div class="panel-title"><span class="dot" style="--c:#ff2e4d"></span>تفکیک بر اساس هوش مصنوعی<small>پروژه‌های فعال Ai و موزیک</small></div><div class="ai-chart">${aiChart()}</div></div>
    </section>
  </div>`;
  renderActList(running.sort(byDateDesc));
  $$('[data-go]').forEach(el => el.addEventListener('click', () => { SFX.nav(); go(el.dataset.go); }));
  $('#exec').onclick = () => { SFX.special(); Sky.meteorShower(6); go('checklist'); };
  const dashPref = () => {
    const d = (window.Extras && Extras.data && Extras.data().prefs && Extras.data().prefs.dash) || {};
    return Object.assign({ notes: true, feat: true, cats: true, bottom: true }, d);
  };
  const applyDash = () => { const pr = dashPref(); $$('[data-w]').forEach(el => el.hidden = pr[el.dataset.w] === false); };
  applyDash();
  const cap = $('#d-cap'); if (cap) { const n = activeWork().length; cap.innerHTML = n > MAX_ACTIVE ? `<span>الان ${faNum(n)} پروژهٔ فعال دارید — سقف پیشنهادی ۳ است.</span>` : (n ? `<span>${faNum(n)} از ۳ پروژهٔ فعال</span>` : ''); cap.hidden = !n; }
  $('#dash-cfg').onclick = ev => {
    ev.stopPropagation();
    const pr = dashPref();
    const labels = { notes: 'یادداشت‌های سریع', feat: 'کارت پروژه‌های در حال اجرا', cats: 'دسته‌ها', bottom: 'فهرست و نمودار' };
    openModal(`<h3>چیدمان داشبورد</h3><p class="x-sub">بخش‌هایی که می‌خواهید در صفحهٔ اول دیده شوند.</p><form id="dash-form" class="x-form">${Object.keys(labels).map(k => `<label class="tog-row"><span>${labels[k]}</span><input type="checkbox" name="${k}" ${pr[k] !== false ? 'checked' : ''}></label>`).join('')}<div class="form-actions"><button class="btn solid" type="submit">ذخیره</button></form>`);
    $('#dash-form').onsubmit = e => { e.preventDefault(); const next = {}; $$('#dash-form input[type=checkbox]').forEach(i => next[i.name] = i.checked); if (window.Extras && Extras.setPref) Extras.setPref('dash', next); closeModal(); SFX.save(); toast('چیدمان ذخیره شد', 'ok'); render(); };
  };

  $$('.note textarea').forEach(bindNote);
};
function actRow(p) {
  const c = catOf(p);
  return `<div class="act ${isStale(p) ? 'is-stale' : ''}" data-open="${p.id}" style="--c:${c.color}">
    <span class="a-no">${p.no}</span>
    <div class="a-mid">
      <div class="a-row"><span class="a-title">${esc(p.title)}</span><span class="a-cat" style="--cc:${c.color}">${c.short}</span>${staleBadge(p)}<span class="a-date" style="margin-inline-start:auto">${jdate(p.createdAt)}</span></div>
      <div class="a-bar">${badge(p, '1.7rem')}${bar(p.progress, c.color)}</div>
    </div>
    ${pnum(p.progress, c.color)}
  </div>`;
}
function renderActList(list) {
  const box = $('#act-list'); if (!box) return;
  if (!list.length) { box.innerHTML = '<div class="empty">هنوز پروژه فعالی نیست — از یادداشت‌های بالا شروع کن ✨</div>'; return; }
  box.innerHTML = list.map(actRow).join('') + '<div class="more-chip hidden clickable" data-go="running"></div>';
  const rows = $$('.act', box), chip = $('.more-chip', box);
  let hidden = 0;
  for (let i = rows.length - 1; i > 0 && box.scrollHeight > box.clientHeight + 1; i--) {
    rows[i].classList.add('hidden'); hidden++;
    chip.classList.remove('hidden'); chip.textContent = `+ ${faNum(hidden)} پروژه دیگر — مشاهده همه`;
  }
  // chip itself might overflow
  for (let i = rows.length - hidden - 1; i > 0 && box.scrollHeight > box.clientHeight + 1; i--) { rows[i].classList.add('hidden'); hidden++; chip.textContent = `+ ${faNum(hidden)} پروژه دیگر — مشاهده همه`; }
  chip.onclick = () => { SFX.nav(); go('running'); };
  $$('[data-open]', box).forEach(el => el.onclick = () => { const p = S.projects.find(x => x.id === el.dataset.open); sessionStorage.setItem('openId', p.id); SFX.nav(); go(p.cat); });
}
let fitTimer;
window.addEventListener('resize', () => { clearTimeout(fitTimer); fitTimer = setTimeout(() => { if (currentRoute === 'dashboard') renderActList(S.projects.filter(isRunning).sort(byDateDesc)); }, 150); });

function aiChart() {
  const list = S.projects.filter(p => !p.done && AIS[p.ai]);
  const total = list.length || 1;
  const counts = NOTE_AIS.map(ai => ({ ai, n: list.filter(p => p.ai === ai).length, avg: (l => l.length ? Math.round(l.reduce((s, p) => s + p.progress, 0) / l.length) : 0)(list.filter(p => p.ai === ai)), st: list.filter(p => p.ai === ai && isStale(p)).length }));
  let acc = 0; const R = 42, C = 2 * Math.PI * R;
  const arcs = counts.map(c => { const len = c.n / total * C; const s = `<circle cx="60" cy="60" r="${R}" fill="none" stroke="${AIS[c.ai].color}" stroke-width="14" stroke-dasharray="${Math.max(0, len - 1.5)} ${C}" stroke-dashoffset="${-acc}" transform="rotate(-90 60 60)" style="filter:drop-shadow(0 0 4px ${AIS[c.ai].color})"/>`; acc += len; return s; }).join('');
  return `<div class="donut-wrap"><svg class="donut" viewBox="0 0 120 120"><circle cx="60" cy="60" r="${R}" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="14"/>${arcs}<text x="60" y="58" text-anchor="middle" font-size="20" font-weight="800">${list.length}</text><text x="60" y="75" text-anchor="middle" font-size="8" fill="#8f9bc4" style="font-family:Vazirmatn">پروژه فعال</text></svg>
    <div class="legend">${counts.map(c => `<div class="lg">${aiBadge(c.ai)}<span>${AIS[c.ai].name}</span>${c.st ? '<span class="alarm-dot" title="هشدار بی‌تحرکی"></span>' : ''}<b>${c.n}</b></div>`).join('')}</div></div>
    <div class="hbar-list">${counts.map(c => `<div class="hbar"><span>${AIS[c.ai].name}</span>${bar(c.avg, AIS[c.ai].color)}<em>${c.avg}%</em></div>`).join('')}</div>`;
}

/* sticky note flow: type → Enter → category → (AI) → saved */
function bindNote(ta) {
  const ai = ta.dataset.note, note = ta.closest('.note');
  ta.addEventListener('input', () => { S.notes[ai] = ta.value; saveS(); });
  ta.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    const txt = ta.value.trim();
    if (!txt) { SFX.error(); toast('اول ایده را بنویس ✍️'); return; }
    SFX.open(); showPick(note, ai, txt);
  });
}
function showPick(note, defAi, txt) {
  $('.note-pick', note)?.remove();
  const pk = document.createElement('div'); pk.className = 'note-pick';
  const title = txt.split('\n')[0];
  const step1 = () => {
    pk.innerHTML = `<button class="np-x" data-x>✕</button><div class="np-title">«${esc(title)}»</div><div class="np-t">در کدام بخش ثبت شود؟</div>
      <div class="np-row">${['ai', 'music', 'company', 'personal'].map((k, i) => `<button class="np-btn" data-cat="${k}" style="--c:${CATS[k].color};animation-delay:${i * 60}ms">${CATS[k].icon} ${CATS[k].short}</button>`).join('')}</div>`;
  };
  const step2 = cat => {
    pk.innerHTML = `<button class="np-x" data-x>✕</button><div class="np-t">${CATS[cat].icon} ${CATS[cat].short} — با کدام هوش مصنوعی؟</div>
      <div class="np-row">${NOTE_AIS.map((a, i) => `<button class="np-btn ${a === defAi ? 'def' : ''}" data-ai="${a}" data-cat="${cat}" style="--c:${AIS[a].color};animation-delay:${i * 60}ms">${aiBadge(a)} ${AIS[a].name}</button>`).join('')}</div>`;
  };
  step1();
  pk.addEventListener('click', e => {
    if (e.target.closest('[data-x]')) { pk.remove(); SFX.close(); return; }
    const b = e.target.closest('.np-btn'); if (!b) return;
    const cat = b.dataset.cat;
    if (!b.dataset.ai && CATS[cat].hasAi) { SFX.pick(); step2(cat); return; }
    const lines = txt.split('\n');
    const p = createProject({ cat, title: lines[0].slice(0, 140), desc: lines.slice(1).join(' ').trim() || 'ثبت‌شده از یادداشت ' + AIS[defAi].name, ai: CATS[cat].hasAi ? b.dataset.ai : null, progress: 10 });
    S.notes[defAi] = ''; saveS();
    SFX.save(); Sky.meteorShower(5);
    toast(`«${p.title}» در ${CATS[cat].short} ثبت شد ✓`, 'ok');
    note.classList.add('note-flash');
    setTimeout(() => ROUTES.dashboard(), 380);
  });
  note.appendChild(pk);
}

/* ================= Pages 3–7: category pages ================= */
const catState = {};
function vchart(list, color) {
  if (!list.length) return '<div class="empty">داده‌ای برای نمودار نیست</div>';
  return `<div class="vchart"><div class="grid-l"></div>${list.map((p, i) => {
    const c = p.cat && CATS[p.cat] ? CATS[p.cat].color : color;
    return `<div class="vbar ${isStale(p) ? 'st' : ''}" data-jump="${p.id}" style="--p:${Math.max(p.progress, 2)}%;--bc:${c}" title="${esc(p.title)} — ${p.progress}%">
      <span class="vb-val">${p.progress}%</span>${isStale(p) ? '<span style="position:absolute;top:-.2rem;font-size:.9rem">⚠️</span>' : ''}
      <div class="vb-fill" style="animation-delay:${i * 40}ms"></div><span class="vb-lbl">${esc(p.title.slice(0, 26))}<br><b style="direction:ltr;display:inline-block">${jdate(p.createdAt)}</b></span></div>`;
  }).join('')}</div>`;
}
const daysAgo = t => { if (!t) return ''; const d = Math.floor((now() - t) / 864e5); return d <= 0 ? 'امروز' : d === 1 ? 'دیروز' : faNum(d) + ' روز پیش'; };
const lastHTML = p => `<div class="i-last ${p.lastStatus ? '' : 'empty'}" data-stop><b>📍 آخرین وضعیت</b><span>${p.lastStatus ? esc(p.lastStatus) : 'ثبت نشده'}</span>${p.lastStatusAt ? `<time>${daysAgo(p.lastStatusAt)}</time>` : ''}<button type="button" class="ls-e" data-last title="به‌روزرسانی آخرین وضعیت">✎</button></div>`;
function editLast(box, p, after) {
  if (box.classList.contains('editing')) return;
  box.classList.add('editing'); box.classList.remove('empty');
  box.innerHTML = `<b>📍 آخرین وضعیت</b><input maxlength="200" value="${esc(p.lastStatus || '')}" placeholder="الان کجای کاری؟"><button type="button" class="ls-e" data-ls-ok>✓</button><button type="button" class="ls-e" data-ls-no>✕</button>`;
  const inp = $('input', box); inp.focus();
  const fin = ok => { if (ok) { const v = inp.value.trim(); if (v !== (p.lastStatus || '')) { updateProject(p, { lastStatus: v, lastStatusAt: v ? now() : 0 }); SFX.save(); toast('آخرین وضعیت ثبت شد ✓', 'ok'); } } after(); };
  inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); fin(true); } if (e.key === 'Escape') fin(false); };
  inp.onclick = e => e.stopPropagation();
  $('[data-ls-ok]', box).onclick = e => { e.stopPropagation(); fin(true); };
  $('[data-ls-no]', box).onclick = e => { e.stopPropagation(); fin(false); };
}
function itemHTML(p, idx) {
  const c = catOf(p);
  const hasLink = !!p.link;
  return `<article class="item ${p.done ? 'done-item' : ''} ${isStale(p) ? 'is-stale' : ''}" id="it-${p.id}" data-id="${p.id}" style="--c:${c.color};--c2:${c.color2};animation-delay:${Math.min(idx, 12) * 35}ms">
    <div class="i-row">
      <div class="i-right">${badge(p, '3.4rem')}<a class="link-btn ${hasLink ? '' : 'off'}" href="${hasLink ? esc(p.link) : '#'}" target="_blank" rel="noopener" title="${hasLink ? 'باز کردن لینک' : 'لینکی ثبت نشده'}" data-stop>${ICON.link}</a></div>
      <div class="i-mid">
        <div class="i-top"><span class="i-no">${p.no}</span><span class="i-title">${esc(p.title)}</span>${p.sub ? `<span class="i-sub">${esc(p.sub)}</span>` : ''}${currentRoute === 'running' ? `<span class="i-sub" style="color:${c.color}">${c.short}</span>` : ''}${p.sample ? '<span class="i-sample">نمونه</span>' : ''}${isQueuedIdea(p) ? '<span class="i-idea">ایده · صف</span>' : ''}${p.convertedAt ? '<span class="i-sub">تبدیل‌شده از ایده</span>' : ''}${p.paused ? '<span class="i-sub">متوقف</span>' : ''}${p.archived ? '<span class="i-sub">بایگانی</span>' : ''}${(p.tags || []).map(tg => `<span class="i-sub i-tag">#${esc(tg)}</span>`).join('')}${p.done ? '<span class="i-sub" style="color:#4ade80">✓ تکمیل‌شده</span>' : ''}${staleBadge(p)}</div>
        <div class="i-desc">${esc(p.desc || '—')}</div>
        ${lastHTML(p)}
        ${p.next ? `<div class="i-next" data-stop><b>▶ اقدام بعدی</b><span>${esc(p.next)}</span></div>` : ''}
        ${p.finish ? `<div class="i-fin" data-stop><b>✓</b><span>${esc(p.finish)}</span></div>` : ''}
        ${p.hours ? `<div class="i-fin" data-stop><b>⏱ زمان</b><span>${faNum(p.hours)} ساعت</span></div>` : ''}
        ${projectCostLine(p)}
        ${p.dependsOn ? `<div class="i-fin" data-stop><b>⛓ وابستگی</b><span>${esc(p.dependsOn)}</span></div>` : ''}
        ${(p.milestones || []).length ? `<div class="i-fin" data-stop><b>نقطه عطف</b><span>${esc(p.milestones.filter(m => !m.done).map(m => m.title).join('، ') || 'همه انجام شد')}</span></div>` : ''}
        <div class="i-date"><span>ثبت: <b>${jdate(p.createdAt)}</b></span><span>آخرین پیشرفت: <b>${jdate(p.lastProgressAt)}</b></span></div>
      </div>
      <div class="i-left">
        <button class="icon-btn" data-edit title="ویرایش">${ICON.edit}</button>
        ${isQueuedIdea(p) ? '<button class="btn sm solid" data-convert data-snd="1" data-stop>تبدیل به پروژه</button>' : ''}
        <button class="icon-btn ok ${p.done ? 'on' : ''}" data-done data-snd="1" title="${p.done ? 'برگرداندن به فعال' : 'تکمیل پروژه'}">${ICON.check}</button>
        <div class="i-prog"><div class="pp"><span>پیشرفت دستی</span>${pnum(p.progress, c.color)}</div>${bar(p.progress, c.color)}${(() => { const tp = taskProgressOf(p); return tp != null ? `<small class="i-tprog">از تسک‌ها: ${faNum(tp)}٪</small>` : (isQueuedIdea(p) ? '<small class="i-tprog">۱۰٪ نمایشی ایده</small>' : ''); })()}</div>
        <span class="chev">⌄</span>
      </div>
    </div>
    <div class="acc"><div><div class="acc-in"></div></div></div>
  </article>`;
}

const LANES = [['idea', 'ایده'], ['ready', 'آماده'], ['doing', 'در حال اجرا'], ['paused', 'متوقف'], ['done', 'تکمیل'], ['archive', 'بایگانی']];
function projectKanban(list) {
  const by = {}; LANES.forEach(([k]) => by[k] = []);
  list.forEach(p => { const k = projectLane(p); (by[k] || by.doing).push(p); });
  return `<div class="p-kb" id="p-kb">${LANES.map(([k, n]) => `<div class="p-kb-col" data-lane="${k}"><h4>${n} <small>${faNum(by[k].length)}</small></h4><div class="p-kb-list">${by[k].map(p => `<article class="item p-kb-card" draggable="true" data-id="${p.id}"><b>${esc(p.title)}</b><span>${faNum(p.progress)}٪</span>${p.next ? `<small>${esc(p.next)}</small>` : ''}</article>`).join('') || '<div class="empty">—</div>'}</div></div>`).join('')}</div>`;
}
function bindProjectKanban() {
  const root = document.getElementById('p-kb'); if (!root) return;
  let dragId = '';
  root.querySelectorAll('.p-kb-card').forEach(c => {
    c.addEventListener('dragstart', e => { dragId = c.dataset.id; e.dataTransfer.setData('text/plain', dragId); });
    c.addEventListener('touchstart', () => { dragId = c.dataset.id; }, { passive: true });
  });
  root.querySelectorAll('.p-kb-col').forEach(col => {
    const drop = () => {
      const p = S.projects.find(x => x.id === dragId); if (!p) return;
      const lane = col.dataset.lane;
      const patch = { paused: lane === 'paused', archived: lane === 'archive', done: lane === 'done' || (lane === 'archive' && p.done) };
      if (lane === 'idea') { patch.kind = 'idea'; patch.progress = Math.min(+p.progress || 10, 10); patch.done = false; patch.paused = false; patch.archived = false; if (!p.sub) patch.sub = STARTED_SUB; }
      else if (lane === 'ready') { patch.progress = 0; patch.done = false; patch.paused = false; patch.archived = false; }
      else if (lane === 'doing') { if (!(+p.progress) || +p.progress >= 100) patch.progress = Math.max(+p.progress || 25, 15); patch.done = false; patch.paused = false; patch.archived = false; }
      else if (lane === 'done') { patch.progress = 100; patch.done = true; patch.paused = false; }
      else if (lane === 'paused') { patch.paused = true; patch.done = false; patch.archived = false; }
      else if (lane === 'archive') { patch.archived = true; }
      updateProject(p, patch); SFX.pick && SFX.pick(); render();
    };
    col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('over'); });
    col.addEventListener('dragleave', () => col.classList.remove('over'));
    col.addEventListener('drop', e => { e.preventDefault(); col.classList.remove('over'); dragId = e.dataTransfer.getData('text/plain') || dragId; drop(); });
    col.addEventListener('touchend', ev => { if (dragId && ev.target.closest && ev.target.closest('.p-kb-col') === col) drop(); }, { passive: true });
  });
}

function renderCatPage(key) {
  const isRun = key === 'running';
  const c = isRun ? RUNNING : CATS[key];
  const st = catState[key] = catState[key] || { sub: 'all', q: '', showDone: false, view: (() => { try { return STORE.getItem('mss_view_' + key) || 'list'; } catch (e) { return 'list'; } })() };
  const all = isRun ? S.projects.filter(isRunning) : S.projects.filter(p => p.cat === key);
  const subs = isRun ? ['ai', 'music', 'company', 'personal'] : c.subs;
  view.innerHTML = `<div class="page cat-page" style="--c:${c.color};--c2:${c.color2}">
    ${topbar(c.name, key === 'music' ? 'dashboard' : 'dashboard')}
    ${isRun ? '<div class="crew-orbit co-projects" id="crewOrbitProjects" dir="rtl"></div>' : ''}
    <div class="page-heading" style="--c:${c.color};--c2:${c.color2}"><span class="ph-icon">${c.icon}</span><h2>${c.name}</h2><span class="ph-count" id="ph-count"></span>
      <span style="margin-inline-start:auto;display:flex;gap:.6rem">${isRun ? '' : `<button class="btn solid" id="add-btn">＋ افزودن پروژه</button>`}${key === 'music' ? `<button class="btn ghost" data-go2="music100">🎼 لیست ۱۰۰ موزیک</button>` : ''}</span></div>
    <section class="chart-box glass"><div class="panel-title"><span class="dot"></span>نمودار پیشرفت بر اساس تاریخ ثبت<small><span class="chart-legend"><span><span class="alarm-dot"></span> بیش از ۷ روز بدون پیشرفت</span><span>قدیمی‌ترین ← جدیدترین</span></span></small></div><div id="chart"></div></section>
    <section class="toolbar glass">
      <div class="chips" id="chips"><button class="chip ${st.sub === 'all' ? 'on' : ''}" data-sub="all">همه</button>${subs.map(s => `<button class="chip ${st.sub === s ? 'on' : ''}" data-sub="${esc(s)}">${isRun ? CATS[s].icon + ' ' + CATS[s].short : esc(s)}</button>`).join('')}</div>
      ${isRun ? '' : `<button class="chip ${st.showDone ? 'on' : ''}" id="show-done">✓ نمایش تکمیل‌شده‌ها</button><button class="chip ${st.showArch ? 'on' : ''}" id="show-arch">بایگانی</button>`}
      <div class="chips" id="type-chips"><button class="chip ${!st.kind || st.kind === 'all' ? 'on' : ''}" data-kind="all">همه انواع</button><button class="chip ${st.kind === 'idea' ? 'on' : ''}" data-kind="idea">ایده</button><button class="chip ${st.kind === 'project' ? 'on' : ''}" data-kind="project">پروژه</button></div>
      <div class="vmodes" id="vmodes">${[['list', '☰ فهرست'], ['grid', '▦ کارت‌ها'], ['compact', '≡ فشرده'], ['kanban', '▥ کانبان']].map(([k, n]) => `<button class="${(st.view || 'list') === k ? 'on' : ''}" data-view="${k}">${n}</button>`).join('')}</div>
      <label class="search"><span>🔍</span><input type="search" id="q" placeholder="جستجو در عنوان و توضیحات…" value="${esc(st.q)}"></label>
    </section>
    <section class="items" id="items"></section>
    ${key === 'music' ? `<button class="music100-fab" data-go2="music100" data-snd="1"><span class="eq"><i></i><i></i><i></i><i></i></span>۱۰۰ موزیک</button>` : ''}
  </div>`;
  const paint = () => {
    let list = all.filter(p => (st.sub === 'all' || (isRun ? p.cat === st.sub : p.sub === st.sub)) && (isRun || st.showDone || !p.done) && (isRun || st.showArch || !p.archived));
    if (st.kind === 'idea') list = list.filter(p => typeof isQueuedIdea === 'function' && isQueuedIdea(p));
    if (st.kind === 'project') list = list.filter(p => !(typeof isQueuedIdea === 'function' && isQueuedIdea(p)));
    if (st.q) { const q = st.q.toLowerCase(); list = list.filter(p => (p.title + ' ' + p.desc + ' ' + (p.tags || []).join(' ')).toLowerCase().includes(q)); }
    $('#chart').innerHTML = vchart(list.filter(p => !p.done && !p.archived).slice().sort(byDateAsc), c.color);
    const sorted = list.slice().sort((a, b) => (a.done - b.done) || byDateDesc(a, b));
    $('#items').className = 'items v-' + (st.view || 'list');
    if (st.view === 'kanban') $('#items').innerHTML = projectKanban(sorted);
    else $('#items').innerHTML = sorted.length ? sorted.map(itemHTML).join('') : '<div class="empty glass">موردی پیدا نشد</div>';
    if (st.view === 'kanban') bindProjectKanban();
    $('#ph-count').textContent = `${faNum(list.filter(p => !p.done).length)} فعال · ${faNum(list.filter(isStale).length)} هشدار`;
    $$('.vbar').forEach(v => v.onclick = () => openItem(v.dataset.jump, true));
  };
  paint();
  $('#chips').onclick = e => { const b = e.target.closest('[data-sub]'); if (!b) return; st.sub = b.dataset.sub; $$('#chips .chip').forEach(x => x.classList.toggle('on', x === b)); paint(); };
  $('#show-done') && ($('#show-done').onclick = e => { st.showDone = !st.showDone; e.currentTarget.classList.toggle('on', st.showDone); paint(); });
  $('#show-arch') && ($('#show-arch').onclick = e => { st.showArch = !st.showArch; e.currentTarget.classList.toggle('on', st.showArch); paint(); });
  $('#type-chips') && ($('#type-chips').onclick = e => { const b = e.target.closest('[data-kind]'); if (!b) return; st.kind = b.dataset.kind; $$('#type-chips .chip').forEach(x => x.classList.toggle('on', x === b)); paint(); });
  $('#q').oninput = e => { st.q = e.target.value.trim(); paint(); };
  $('#vmodes').onclick = e => { const b = e.target.closest('[data-view]'); if (!b) return; st.view = b.dataset.view; try { STORE.setItem('mss_view_' + key, st.view); } catch (er) { } $$('#vmodes button').forEach(x => x.classList.toggle('on', x === b)); paint(); };
  $('#add-btn') && ($('#add-btn').onclick = () => addModal(key, () => renderCatPage(key)));
  if (isRun) mountCrewOrbit('#crewOrbitProjects');
  $$('[data-go2]').forEach(b => b.onclick = () => { SFX.nav(); go(b.dataset.go2); });
  $('#items').addEventListener('click', e => {
    const ls = e.target.closest('[data-last]');
    if (ls) { e.stopPropagation(); const pp = S.projects.find(x => x.id === ls.closest('.item').dataset.id); if (pp) editLast(ls.closest('.i-last'), pp, () => paint()); return; }
    const convBtn = e.target.closest('[data-convert]');
    if (convBtn) {
      e.stopPropagation();
      const art = convBtn.closest('.item');
      const p = S.projects.find(x => x.id === art.dataset.id);
      const goConv = () => { convertIdea(p); SFX.save(); toast('با همان شناسه به پروژه تبدیل شد ✓', 'ok'); renderCatPage(key); };
      if (activeWork().length >= MAX_ACTIVE) askActivate(p.title, goConv, () => toast('در صف ایده ماند'));
      else goConv();
      return;
    }
    if (e.target.closest('[data-stop]')) { e.stopPropagation(); return; }
    const art = e.target.closest('.item'); if (!art) return;
    const p = S.projects.find(x => x.id === art.dataset.id);
    if (e.target.closest('[data-done]')) {
      if (p.done) {
        const patch = { done: false, progress: Math.min(p.progress || 90, 90) };
        const run = () => { updateProject(p, patch); SFX.undo(); toast('پروژه دوباره فعال شد'); renderCatPage(key); };
        if (wouldActivate(p, patch) && activeWork().length >= MAX_ACTIVE) askActivate(p.title, run, () => toast('فعال نشد؛ سقف ۳ پروژه پر است'));
        else run();
      } else { updateProject(p, { done: true, progress: 100 }); SFX.done(); toast('پروژه تکمیل شد 🎉', 'ok'); renderCatPage(key); }
      return;
    }
    if (e.target.closest('.acc')) return;
    if (e.target.closest('[data-edit]')) { openItem(p.id, true, true); return; }
    if (e.target.closest('.i-row')) toggleItem(art, p);
  });
  const oid = sessionStorage.getItem('openId');
  if (oid) { sessionStorage.removeItem('openId'); setTimeout(() => openItem(oid, true), 250); }
}
function toggleItem(art, p, force) {
  const open = force != null ? force : !art.classList.contains('open');
  $$('.item.open').forEach(x => { if (x !== art) x.classList.remove('open'); });
  if (open) {
    const box = $('.acc-in', art);
    if (!box.dataset.built) { buildPanel(box, p, () => renderCatPage(currentRoute)); box.dataset.built = 1; }
    art.classList.add('open'); SFX.open();
  } else { art.classList.remove('open'); SFX.close(); }
}
function openItem(id, scroll, focus) {
  const art = $('#it-' + id); if (!art) return;
  const p = S.projects.find(x => x.id === id);
  toggleItem(art, p, true);
  if (scroll) setTimeout(() => art.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  if (focus) setTimeout(() => $('input[name=title]', art)?.focus(), 500);
}

/* ---------- panels ---------- */
const subOptions = (cat, val) => CATS[cat].subs.map(s => `<option ${s === val ? 'selected' : ''}>${esc(s)}</option>`).join('');
const aiSeg = (val, allowNone) => `<div class="seg" data-seg="ai">${allowNone ? `<button type="button" data-v="" class="${!val ? 'on' : ''}">بدون</button>` : ''}${NOTE_AIS.map(a => `<button type="button" data-v="${a}" class="${val === a ? 'on' : ''}" style="--c:${AIS[a].color}">${aiBadge(a)} ${AIS[a].name}</button>`).join('')}</div>`;
const rangeFld = (name, label, v, c) => `<div class="fld"><label>${label}</label><div class="range-row"><input type="range" name="${name}" min="0" max="100" value="${v}" style="--v:${v}%;${c ? '--c:' + c : ''}"><output>${v}%</output></div></div>`;
function bindCharCounts(root) {
  $$('[data-count]', root).forEach(el => {
    const out = root.querySelector('.char-count[data-for="' + el.name + '"]');
    const cap = +el.dataset.count || 0;
    const paint = () => { const n = (el.value || '').length; if (out) out.textContent = cap ? `${n.toLocaleString('fa-IR')} / ${cap.toLocaleString('fa-IR')}` : n.toLocaleString('fa-IR') + ' نویسه'; if (cap && n >= cap) out && out.classList.add('over'); else out && out.classList.remove('over'); };
    el.addEventListener('input', paint); paint();
  });
}
function syncAudioInf(root) {
  const paint = () => {
    const off = togVal(root, 'instrumental');
    const r = root.querySelector('input[name=audioInfluence]');
    if (!r) return;
    r.disabled = off;
    const fld = r.closest('.fld'); if (fld) fld.classList.toggle('dimmed', off);
  };
  root.addEventListener('click', e => { if (e.target.closest('[data-tog=instrumental]')) setTimeout(paint, 0); });
  paint();
}

function wireForm(root) {
  root.addEventListener('input', e => { if (e.target.type === 'range') { e.target.style.setProperty('--v', e.target.value + '%'); const o = e.target.parentElement.querySelector('output'); if (o) o.textContent = e.target.value + '%'; const num = root.querySelector(`input[type=number][data-for="${e.target.name}"]`); if (num) num.value = e.target.value; } if (e.target.type === 'number' && e.target.dataset.for) { const r = root.querySelector(`input[name="${e.target.dataset.for}"]`); r.value = e.target.value; r.dispatchEvent(new Event('input', { bubbles: true })); } });
  root.addEventListener('click', e => {
    const b = e.target.closest('.seg button'); if (b) { e.preventDefault(); const seg = b.parentElement; $$('button', seg).forEach(x => x.classList.toggle('on', x === b)); SFX.pick(); }
    const t = e.target.closest('.tog'); if (t) { e.preventDefault(); t.classList.toggle('on'); SFX.tick(); }
    const mh = e.target.closest('.msec > .mh'); if (mh) { e.preventDefault(); mh.parentElement.classList.toggle('open'); SFX.open(); }
  });
}
const segVal = (root, name) => { const b = root.querySelector(`[data-seg="${name}"] button.on`); return b ? b.dataset.v : ''; };
const togVal = (root, name) => !!root.querySelector(`.tog[data-tog="${name}"].on`);
const fv = (root, name) => { const el = root.querySelector(`[name="${name}"]`); return el ? el.value : ''; };

function buildPanel(box, p, after) {
  if (p.cat === 'music') return musicPanel(box, p, after);
  const c = CATS[p.cat];
  box.innerHTML = `<form class="form" style="--c:${c.color}">
    <div class="fld"><label>عنوان پروژه</label><input type="text" name="title" value="${esc(p.title)}"></div>
    <div class="fld"><label>زیرمجموعه</label><select name="sub">${subOptions(p.cat, p.sub)}</select></div>
    <div class="fld full"><label>توضیح کوتاه</label><textarea name="desc" rows="2">${esc(p.desc)}</textarea></div>
    ${c.hasAi ? `<div class="fld full"><label>هوش مصنوعی</label>${aiSeg(p.ai)}</div><div class="fld full"><label>🔗 لینک چت / پروژه در هوش مصنوعی</label><input type="url" class="ltr" name="link" value="${esc(p.link)}" placeholder="https://…"></div>` : `<div class="fld full"><label>🔗 لینک (اختیاری)</label><input type="url" class="ltr" name="link" value="${esc(p.link)}" placeholder="https://…"></div>`}
    ${rangeFld('progress', 'درصد پیشرفت', p.progress, c.color)}
    <div class="fld"><label>عدد پیشرفت</label><input type="number" min="0" max="100" data-for="progress" value="${p.progress}"></div>
    <div class="fld full"><label>اقدام بعدی</label><input type="text" name="next" maxlength="200" value="${esc(p.next || '')}" placeholder="قدم روشن بعدی…"></div>
    <div class="fld full"><label>تعریف پایان</label><input type="text" name="finish" maxlength="200" value="${esc(p.finish || '')}" placeholder="خروجی قابل تحویل چیست؟"></div>
    <div class="fld"><label>زمان صرف‌شده (ساعت)</label><input type="number" name="hours" min="0" step="0.5" value="${esc(p.hours || '')}"></div>
    <div class="fld"><label>برچسب‌ها (با ویرگول)</label><input type="text" name="tags" value="${esc((p.tags || []).join('، '))}" placeholder="مثلاً: فوری، مشتری"></div>
    <div class="fld full"><label>وابستگی / پروژهٔ بالادست</label><input type="text" name="dependsOn" value="${esc(p.dependsOn || '')}" placeholder="نام یا شناسه پروژه وابسته"></div>
    <div class="fld full"><label>نقاط عطف (هر خط یکی)</label><textarea name="milestones" rows="2" placeholder="عنوان نقطه عطف">${esc((p.milestones || []).map(m => (m.done ? '✓ ' : '') + m.title).join('\n'))}</textarea></div>
    <div class="fld"><label>زیرپروژهٔ</label><select name="parentId"><option value="">— مستقل —</option>${S.projects.filter(x => x.id !== p.id && x.cat === p.cat).map(x => `<option value="${x.id}" ${p.parentId === x.id ? 'selected' : ''}>${esc(x.title)}</option>`).join('')}</select></div>
    <div class="tog-row"><span>متوقف</span><button type="button" class="tog ${p.paused ? 'on' : ''}" data-tog="paused"></button></div>
    <div class="tog-row"><span>بایگانی</span><button type="button" class="tog ${p.archived ? 'on' : ''}" data-tog="archived"></button></div>
    <div class="form-actions"><button class="btn solid" data-save data-snd="1">💾 ذخیره تغییرات</button><button type="button" class="btn ghost" data-cancel>انصراف</button><span class="sp"></span><button type="button" class="btn red sm" data-del data-snd="1">🗑 حذف</button></div>
  </form>`;
  const f = $('form', box); wireForm(f);
  f.addEventListener('click', e => { const b = e.target.closest('[data-tog]'); if (b) { e.preventDefault(); b.classList.toggle('on'); } });
  f.onsubmit = e => {
    e.preventDefault();
    const title = fv(f, 'title').trim(); if (!title) { SFX.error(); toast('عنوان خالی است'); return; }
    const ms = fv(f, 'milestones').split(/\n/).map(s => s.trim()).filter(Boolean).map(s => ({ title: s.replace(/^✓\s*/, ''), done: /^✓/.test(s) }));
    const patch = { title, sub: fv(f, 'sub'), desc: fv(f, 'desc').trim(), link: fv(f, 'link').trim(), progress: +fv(f, 'progress'), next: fv(f, 'next').trim(), finish: fv(f, 'finish').trim(), ai: c.hasAi ? (segVal(f, 'ai') || p.ai) : null, sample: false, hours: fv(f, 'hours') === '' ? '' : +fv(f, 'hours'), tags: fv(f, 'tags').split(/[،,]+/).map(s => s.trim()).filter(Boolean), dependsOn: fv(f, 'dependsOn').trim(), milestones: ms, parentId: fv(f, 'parentId'), paused: togVal(f, 'paused'), archived: togVal(f, 'archived') };
    const save = () => { updateProject(p, patch); SFX.save(); toast('ذخیره شد ✓', 'ok'); after && after(); };
    if (wouldActivate(p, patch) && activeWork().length >= MAX_ACTIVE) askActivate(title, save, () => toast('ذخیره نشد؛ سقف ۳ پروژهٔ فعال پر است'));
    else save();
  };
  $('[data-cancel]', f).onclick = () => toggleItem(box.closest('.item'), p, false);
  $('[data-del]', f).onclick = () => { if (!confirm('این پروژه به سطل بازیافت برود؟')) return; softDeleteProject(p); SFX.back(); toast('به سطل بازیافت رفت'); after && after(); };
}

const SINGERS = [['milad', 'میلاد'], ['clone', 'کلون صدا'], ['reference', 'رفرنس'], ['iranian', 'خواننده ایرانی'], ['suno', 'انتخاب سونو']];
function musicPanel(box, p, after, isNew) {
  const m = p.music = Object.assign(defaultMusic(p.title), p.music || {});
  const sec = (ic, t, body, open) => `<div class="msec ${open ? 'open' : ''}"><button type="button" class="mh"><span class="ic">${ic}</span>${t}<span class="plus">+</span></button><div class="mb"><div><div class="mb-in">${body}</div></div></div></div>`;
  const tog = (name, label, on) => `<div class="tog-row"><span>${label}</span><button type="button" class="tog ${on ? 'on' : ''}" data-tog="${name}"></button></div>`;
  box.innerHTML = `<form class="mpanel">
    ${sec('🎤', 'ترانه', `
      <div class="fld"><label>نام آهنگ (Song Title)</label><input type="text" name="songTitle" value="${esc(m.songTitle)}"></div>
      <div class="fld"><label>حالت متن (Lyrics)</label><div class="seg" data-seg="lyricsMode">${[['manual', 'متن دستی'], ['auto', 'تولید خودکار'], ['instrumental', 'بی‌کلام']].map(([v, l]) => `<button type="button" data-v="${v}" class="${m.lyricsMode === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="fld full"><label>متن ترانه</label><textarea class="lyrics" name="lyrics" data-count="0" placeholder="[Verse 1]&#10;…">${esc(m.lyrics)}</textarea><small class="char-count" data-for="lyrics"></small></div>`, true)}
    ${sec('🎼', 'سبک و استراکچر', `
      ${tog('referenceOn', 'ویس رفرنس دارد', m.referenceOn)}
      <div class="fld"><label>نام رفرنس</label><input type="text" name="referenceName" value="${esc(m.referenceName || '')}" placeholder="نام نمایشی"></div>
      <div class="fld"><label>لینک رفرنس</label><input type="url" class="ltr" name="referenceLink" value="${esc(m.referenceLink || m.reference || '')}" placeholder="https://…"></div>
      <div class="fld full"><label>توضیح رفرنس</label><input type="text" name="reference" value="${esc(m.reference)}" placeholder="حال‌وهوا یا توضیح کوتاه"></div>
      <div class="fld full"><label>استراکچر آهنگ</label><textarea name="structure" rows="5" class="ltr">${esc(m.structure)}</textarea></div>`)}
    ${sec('🎨', 'پرامپت / استایل', `
      <div class="fld full"><label>Style Prompt</label><textarea name="style" rows="4" class="ltr" maxlength="1000" data-count="1000" placeholder="persian pop, cinematic strings, warm male vocal…">${esc(m.style)}</textarea><small class="char-count" data-for="style"></small></div>
      <div class="fld full"><label>Negative Prompt / Exclude styles</label><textarea name="negative" rows="2" class="ltr" placeholder="no autotune, no EDM drops…">${esc(m.negative)}</textarea></div>
      <div class="form-actions"><button type="button" class="btn sm ghost" data-copy>📋 کپی پرامپت کامل برای سونو</button></div>`)}
    ${sec('🎙️', 'خواننده', `
      <div class="fld full"><label>انتخاب خواننده</label><div class="seg" data-seg="singer">${SINGERS.map(([v, l]) => `<button type="button" data-v="${v}" class="${m.singer === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="fld full"><label>Vocal Gender</label><div class="seg" data-seg="vocal">${[['male', 'Male / مرد'], ['female', 'Female / زن'], ['duet', 'Duet / دوصدایی']].map(([v, l]) => `<button type="button" data-v="${v}" class="${m.vocal === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>`)}
    ${sec('⚙️', 'جزئیات سونو', `
      <div class="fld"><label>ساخت</label><div class="seg" data-seg="build">${[['new', 'New Creator'], ['cover', 'Cover']].map(([v, l]) => `<button type="button" data-v="${v}" class="${(m.build || 'new') === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="fld"><label>مدل / ورژن</label><select name="model">${['V6', 'Wild', 'Mini'].concat(['v5', 'v4.5+', 'v4.5', 'v4'].filter(v => v === m.model)).filter((v,i,a)=>a.indexOf(v)===i).map(v => `<option ${m.model === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="fld"><label>Duration</label><div class="seg" data-seg="duration">${[['auto', 'Auto'], ['custom', 'Custom']].map(([v, l]) => `<button type="button" data-v="${v}" class="${m.duration === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      ${tog('audioHas', 'Audio دارد', m.audioHas)}
      <div class="fld full"><label>فهرست کلون‌ها (هر خط یک نام)</label><textarea name="clones" rows="2" placeholder="نام کلون">${esc((m.clones || []).join('\n'))}</textarea></div>
      ${tog('inspoHas', 'Inspo دارد', m.inspoHas)}
      <div class="fld"><label>مشخصات Inspo</label><input type="text" name="inspoNote" value="${esc(m.inspoNote || '')}"></div>
      <div class="fld"><label>لینک Inspo</label><input type="url" class="ltr" name="inspoLink" value="${esc(m.inspoLink || '')}" placeholder="https://…"></div>
      ${tog('instrumental', 'Instrumental (بی‌کلام)', m.instrumental)}${tog('maxMode', 'Max Mode', m.maxMode)}
      ${tog('personalize', 'Personalize', m.personalize)}${tog('myTaste', 'My Taste', m.myTaste)}
      ${rangeFld('weirdness', 'Weirdness', m.weirdness)}${rangeFld('styleInfluence', 'Style Influence', m.styleInfluence)}
      <div class="fld ai-range">${rangeFld('audioInfluence', 'Audio Influence', m.audioInfluence)}</div>${rangeFld('variety', 'Variety', m.variety)}`)}
    ${sec('📈', 'پیشرفت پروژه', `
      <div class="name-box fld full"><label>نام پروژه و محل ذخیره</label><input type="text" name="title" value="${esc(p.title)}" placeholder="نام پروژه"><input type="text" name="savePath" class="ltr" value="${esc(m.savePath || '')}" placeholder="محل ذخیره (پوشه یا مسیر)"></div>
      <div class="fld"><label>دسته (زیرمجموعه)</label><select name="sub">${subOptions('music', p.sub)}</select></div>
      <div class="fld full"><label>توضیح کوتاه</label><input type="text" name="desc" value="${esc(p.desc)}"></div>
      <div class="fld full"><label>هوش مصنوعی همکار</label>${aiSeg(p.ai)}</div>
      <div class="fld full"><label>🔗 لینک (چت AI / آهنگ در سونو)</label><input type="url" class="ltr" name="link" value="${esc(p.link)}" placeholder="https://suno.com/song/…"></div>
      ${rangeFld('progress', 'درصد پیشرفت', p.progress)}
      <div class="fld"><label>عدد پیشرفت</label><input type="number" min="0" max="100" data-for="progress" value="${p.progress}"></div>
      <div class="fld full"><label>اقدام بعدی</label><input type="text" name="next" maxlength="200" value="${esc(p.next || '')}" placeholder="قدم روشن بعدی…"></div>
      <div class="fld full"><label>تعریف پایان</label><input type="text" name="finish" maxlength="200" value="${esc(p.finish || '')}" placeholder="خروجی قابل تحویل چیست؟"></div>`, isNew)}
    <div class="form-actions"><button class="btn solid" data-save data-snd="1" style="background:linear-gradient(135deg,#ff2d8b,#7a0c4a 60%,#2f7bff)">💾 ذخیره پروژه موزیک</button><button type="button" class="btn ghost" data-cancel>انصراف</button><span class="sp"></span>${S.projects.includes(p) ? '<button type="button" class="btn red sm" data-del data-snd="1">🗑 حذف</button>' : ''}</div>
  </form>`;
  const f = $('form', box); wireForm(f); bindCharCounts(f); syncAudioInf(f);
  $('[data-copy]', f).onclick = () => {
    const txt = `Style: ${fv(f, 'style')}\nExclude: ${fv(f, 'negative')}\nWeirdness: ${fv(f, 'weirdness')}% | Style Influence: ${fv(f, 'styleInfluence')}% | Audio Influence: ${fv(f, 'audioInfluence')}%\n\n${fv(f, 'lyrics')}`;
    navigator.clipboard?.writeText(txt).then(() => toast('پرامپت کپی شد 📋', 'ok'), () => toast('کپی ممکن نشد'));
  };
  f.onsubmit = e => {
    e.preventDefault();
    const title = fv(f, 'title').trim() || p.title;
    Object.assign(m, { songTitle: fv(f, 'songTitle'), lyrics: fv(f, 'lyrics'), reference: fv(f, 'reference'), referenceName: fv(f, 'referenceName'), referenceLink: fv(f, 'referenceLink'), referenceOn: togVal(f, 'referenceOn'), structure: fv(f, 'structure'), style: fv(f, 'style'), negative: fv(f, 'negative'), model: fv(f, 'model'), build: segVal(f, 'build') || m.build, audioHas: togVal(f, 'audioHas'), clones: fv(f, 'clones').split(/\n/).map(s => s.trim()).filter(Boolean), inspoHas: togVal(f, 'inspoHas'), inspoNote: fv(f, 'inspoNote'), inspoLink: fv(f, 'inspoLink'), weirdness: +fv(f, 'weirdness'), styleInfluence: +fv(f, 'styleInfluence'), audioInfluence: +fv(f, 'audioInfluence'), variety: +fv(f, 'variety'), lyricsMode: segVal(f, 'lyricsMode') || m.lyricsMode, singer: segVal(f, 'singer') || m.singer, vocal: segVal(f, 'vocal') || m.vocal, duration: segVal(f, 'duration') || m.duration, instrumental: togVal(f, 'instrumental'), maxMode: togVal(f, 'maxMode'), personalize: togVal(f, 'personalize'), myTaste: togVal(f, 'myTaste'), savePath: fv(f, 'savePath').trim() });
    updateProject(p, { title, sub: fv(f, 'sub'), desc: fv(f, 'desc'), link: fv(f, 'link').trim(), progress: +fv(f, 'progress'), next: fv(f, 'next').trim(), finish: fv(f, 'finish').trim(), ai: segVal(f, 'ai') || p.ai, music: m, sample: false });
    SFX.save(); toast('پروژه موزیک ذخیره شد 🎵', 'ok'); after && after();
  };
  $('[data-cancel]', f).onclick = () => { const it = box.closest('.item'); if (it) toggleItem(it, p, false); else closeModal(); };
  $('[data-del]', f) && ($('[data-del]', f).onclick = () => { if (!confirm('این پروژه موزیک به سطل بازیافت برود؟')) return; softDeleteProject(p); SFX.back(); toast('به سطل بازیافت رفت'); closeModal(); after && after(); });
}

function addModal(cat, after) {
  const c = CATS[cat];
  const m = openModal(`<h3 style="color:${c.color}">${c.icon} افزودن پروژه — ${c.short}</h3>
    <form class="form" style="--c:${c.color}">
      <div class="fld full"><label>عنوان پروژه</label><input type="text" name="title" placeholder="عنوان…" required></div>
      <div class="fld"><label>زیرمجموعه</label><select name="sub">${subOptions(cat, c.subs[1])}</select></div>
      <div class="fld"><label>عدد پیشرفت (۰ تا ۱۰۰)</label><input type="number" name="progress" min="0" max="100" value="10"></div>
      <div class="fld full"><label>توضیح کوتاه</label><textarea name="desc" rows="2"></textarea></div>
      ${c.hasAi ? `<div class="fld full"><label>هوش مصنوعی</label>${aiSeg('chatgpt')}</div><div class="fld full"><label>🔗 لینک هوش مصنوعی</label><input type="url" class="ltr" name="link" placeholder="https://…"></div>` : ''}
      <div class="form-actions"><button class="btn solid" data-snd="1">＋ ثبت پروژه</button><button type="button" class="btn ghost" data-close>انصراف</button></div>
    </form>`);
  const f = $('form', m); wireForm(f); setTimeout(() => $('[name=title]', f).focus(), 60);
  f.onsubmit = e => {
    e.preventDefault();
    const title = fv(f, 'title').trim(); if (!title) return;
    const sub = fv(f, 'sub'), progress = Math.max(0, Math.min(100, +fv(f, 'progress') || 0));
    const asIdea = () => {
      const p = createProject({ cat, title, sub: STARTED_SUB, kind: 'idea', desc: fv(f, 'desc').trim(), progress: 10, ai: c.hasAi ? segVal(f, 'ai') : null, link: c.hasAi ? fv(f, 'link').trim() : '' });
      closeModal(); SFX.save(); toast(`«${p.title}» به‌صورت ایده در صف ثبت شد`, 'ok'); after && after();
    };
    const asProj = () => {
      const p = createProject({ cat, title, sub, kind: 'project', convertedAt: now(), desc: fv(f, 'desc').trim(), progress, ai: c.hasAi ? segVal(f, 'ai') : null, link: c.hasAi ? fv(f, 'link').trim() : '' });
      closeModal(); SFX.save(); Sky.meteorShower(5); toast(`«${p.title}» ثبت شد ✓`, 'ok'); after && after();
    };
    const draft = { done: false, progress, sub, kind: 'project' };
    if (isActiveWork(draft) && activeWork().length >= MAX_ACTIVE) { closeModal(); askActivate(title, asProj, asIdea); }
    else asProj();
  };
}
['running', 'ai', 'music', 'company', 'personal'].forEach(k => ROUTES[k] = () => renderCatPage(k));

/* ================= Music 100 list ================= */
ROUTES['music100'] = () => {
  const st = catState.m100 = catState.m100 || { q: '' };
  const projByIdea = {}; S.projects.filter(p => p.cat === 'music' && p.ideaId).forEach(p => projByIdea[p.ideaId] = p);
  const runningMusic = S.projects.filter(p => p.cat === 'music' && p.progress > 0 && !p.done).sort(byDateDesc);
  const extra = S.projects.filter(p => p.cat === 'music' && !p.ideaId);
  const ideaCard = (i, cat) => {
    const p = projByIdea[i.id];
    return `<div class="idea ${p ? 'has' : ''} ${p && isStale(p) ? 'is-stale' : ''}" data-idea="${i.id}" data-cat="${esc(cat)}"><div class="id-top"><span class="id-no">#${i.id}</span>${p ? aiBadge(p.ai, '1.5rem') : ''}${p && p.done ? '<span class="i-sub" style="color:#4ade80">✓</span>' : ''}${p ? staleBadge(p) : ''}</div><b>${esc(i.title)}</b><p>${esc(i.desc)}</p>${p ? `<div class="id-prog">${bar(p.progress)}${pnum(p.progress)}</div>` : ''}</div>`;
  };
  const projCard = p => `<div class="idea has ${isStale(p) ? 'is-stale' : ''}" data-pid="${p.id}"><div class="id-top"><span class="id-no">#${p.no}</span>${aiBadge(p.ai, '1.5rem')}<span class="new-tag">از پورتال</span>${staleBadge(p)}</div><b>${esc(p.title)}</b><p>${esc(p.desc)}</p><div class="id-prog">${bar(p.progress)}${pnum(p.progress)}</div></div>`;
  const total = MUSIC_CATEGORIES.reduce((a, c) => a + c.ideas.length, 0) + extra.length;
  view.innerHTML = `<div class="page m100" style="--c:#ff2d8b">
    ${topbar('لیست ۱۰۰ موزیک', 'music')}
    <div class="page-heading" style="--c:#ff2d8b;--c2:#ffd0e6"><span class="ph-icon">🎼</span><h2>لیست ۱۰۰ ایده موزیک</h2><span class="ph-count">${faNum(total)} ایده · ${faNum(Object.keys(projByIdea).length + extra.length)} پروژه</span>
      <label class="search" style="margin-inline-start:auto"><span>🔍</span><input type="search" id="q" placeholder="جستجوی ایده…" value="${esc(st.q)}"></label></div>
    <section class="glass chart-box" style="border-color:rgba(255,45,139,.4)"><div class="panel-title"><span class="dot" style="--c:#ff2d8b"></span>پروژه‌های موزیک در حال اجرا<small>${faNum(runningMusic.length)} پروژه · همگام با بخش موزیک</small></div>
      <div class="m100-run">${runningMusic.length ? runningMusic.map(p => `<div class="act ${isStale(p) ? 'is-stale' : ''}" data-pid="${p.id}" style="--c:#ff2d8b"><span class="a-no">${p.no}</span><div class="a-mid"><div class="a-row"><span class="a-title">${esc(p.title)}</span>${staleBadge(p)}</div><div class="a-bar">${aiBadge(p.ai, '1.7rem')}${bar(p.progress, '#ff2d8b')}</div></div>${pnum(p.progress, '#ff2d8b')}</div>`).join('') : '<div class="empty">هنوز پروژه‌ای شروع نشده</div>'}</div></section>
    <div id="m100-list" style="display:flex;flex-direction:column;gap:var(--gap)"></div>
  </div>`;
  const paint = () => {
    const q = st.q.toLowerCase(); const match = (t, d) => !q || (t + ' ' + d).toLowerCase().includes(q);
    const blocks = MUSIC_CATEGORIES.map(c => {
      const ideas = c.ideas.filter(i => match(i.title, i.desc));
      const ex = extra.filter(p => p.sub === c.name && match(p.title, p.desc));
      if (!ideas.length && !ex.length) return '';
      return `<section class="m100-cat glass"><h3>${esc(c.name)} <small>${faNum(c.ideas.length + extra.filter(p => p.sub === c.name).length)} ایده</small></h3><div class="idea-grid">${ideas.map(i => ideaCard(i, c.name)).join('')}${ex.map(projCard).join('')}</div></section>`;
    });
    const started = extra.filter(p => !MUSIC_CATEGORIES.some(c => c.name === p.sub) && match(p.title, p.desc));
    if (started.length) blocks.unshift(`<section class="m100-cat glass"><h3>✨ ${STARTED_SUB} <small>ثبت‌شده از پورتال</small></h3><div class="idea-grid">${started.map(projCard).join('')}</div></section>`);
    $('#m100-list').innerHTML = blocks.join('') || '<div class="empty glass">ایده‌ای پیدا نشد</div>';
  };
  paint();
  $('#q').oninput = e => { st.q = e.target.value.trim(); paint(); };
  view.onclick = e => {
    const pc = e.target.closest('[data-pid]');
    const ic = e.target.closest('[data-idea]');
    let p;
    if (pc) p = S.projects.find(x => x.id === pc.dataset.pid);
    else if (ic) {
      const id = +ic.dataset.idea; p = projByIdea[id];
      if (!p) {
        const idea = MUSIC_CATEGORIES.flatMap(c => c.ideas).find(i => i.id === id);
        p = { id: 'p' + now().toString(36) + id, no: id, ideaId: id, cat: 'music', title: idea.title, desc: idea.desc, sub: ic.dataset.cat, ai: 'chatgpt', link: '', progress: 0, done: false, sample: false, createdAt: now(), lastProgressAt: now(), music: defaultMusic(idea.title) };
      }
    }
    if (!p) return;
    const m = openModal(`<h3 style="color:#ff8ac4">🎵 <span class="i-no" style="--c:#ff2d8b">${p.no}</span> ${esc(p.title)}</h3><div class="acc-in" style="padding:0"></div>`);
    m.style.width = 'min(70rem,100%)';
    musicPanel($('.acc-in', m), p, () => { closeModal(); ROUTES.music100(); }, true);
  };
};

/* ================= Executive checklist (separate data) ================= */
const ckState = { tab: 'all', q: '' };
const ckAll = () => CK.groups.flatMap(g => g.tasks.map(t => { Object.defineProperty(t, '_g', { value: g, enumerable: false, configurable: true, writable: true }); return t; }));
const tProg = t => t.done ? 100 : (t.progress || 0);
const tRunning = t => !t.done && (t.status === 'running' || (t.progress > 0));
ROUTES['checklist'] = () => {
  view.innerHTML = `<div class="page ck-page">
    <header class="ck-card ck-head">
      <div class="ck-r">
        <button class="back-btn" data-back="dashboard" data-snd="1" aria-label="بازگشت">${ICON.back}</button>
        <div class="ck-date">${JLONG.format(new Date())}</div>
        <div class="ck-tag"><b>هر روز، یک قدم جلوتر</b></div>
      </div>
      <div class="ck-center">
        <div class="ck-logo"><img src="${ASSET('logo-milad-v2.png')}" alt="میلاد سعادت"></div>
        <h1 class="ck-title">چک لیست آنلاین اختصاصی میلاد سعادت</h1>
        <div class="ck-tag">ذهن آرام‌تر، مسیر روشن‌تر. کارهایت را مرتب کن و قدم‌به‌قدم پیش برو.</div>
      </div>
      <div class="ck-l">
        <button class="ck-home" id="ck-home"><span class="hm">🏠</span> صفحه اول پورتال</button>
        <div class="ck-clock" id="ck-clock"></div>
        <div class="ck-tag">مدیریت زمان و برنامه زندگی</div>
      </div>
    </header>
    <div class="ck-top">
      <section class="ck-card ck-stats" id="ck-stats"></section>
      <section class="ck-card ck-chart"><h3>📊 تعداد کارها در هر دسته</h3><div class="ck-bars" id="ck-bars"></div></section>
    </div>
    <section class="ck-card ck-tools">
      <div class="ck-tabs" id="ck-tabs">${[['all', 'همه کارها'], ['left', 'باقی‌مانده'], ['done', 'انجام‌شده']].map(([v, l]) => `<button data-tab="${v}" class="${ckState.tab === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      <label class="ck-search"><span>🔍</span><input type="search" id="ck-q" placeholder="جستجوی سراسری: کارها و پروژه‌های پورتال…" value="${esc(ckState.q)}"></label>
      <div class="ck-legend">${Object.values(CK_STATUS).map(s => `<span><i class="sdot" style="--sc:${s.color}"></i>${s.name}</span>`).join('')}</div>
      <button class="ck-add" id="ck-add" data-snd="1">＋ افزودن کار</button>
    </section>
    <section class="ck-card ck-results hidden" id="ck-res"></section>
    <section class="ck-groups" id="ck-groups"></section>
  </div>`;
  const clock = () => { const el = $('#ck-clock'); if (!el) return clearInterval(ROUTES.checklist._t); el.textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); };
  clearInterval(ROUTES.checklist._t); ROUTES.checklist._t = setInterval(clock, 1000); clock();
  $('#ck-home').onclick = () => { SFX.back(); go(''); };
  $('#ck-add').onclick = ckAddModal;
  $('#ck-tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (!b) return; ckState.tab = b.dataset.tab; $$('#ck-tabs button').forEach(x => x.classList.toggle('on', x === b)); ckPaint(); };
  $('#ck-q').oninput = e => { ckState.q = e.target.value.trim(); ckPaint(); };
  $('#ck-groups').onclick = ckClick;
  $('#ck-res').onclick = e => {
    const r = e.target.closest('.res'); if (!r) return;
    if (r.dataset.task) { ckState.q = ''; $('#ck-q').value = ''; ckState.tab = 'all'; ckPaint(); const el = $('#tk-' + r.dataset.task); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 900); }
    else if (r.dataset.pid) { const p = S.projects.find(x => x.id === r.dataset.pid); sessionStorage.setItem('openId', p.id); SFX.nav(); go(p.cat); }
  };
  ckPaint();
};
function ckPaint() {
  if (currentRoute !== 'checklist' || !$('#ck-q')) return; // late timer after leaving the page
  const all = ckAll();
  const done = all.filter(t => t.done).length, run = all.filter(tRunning).length, tot = all.length;
  const pct = tot ? Math.round(all.reduce((a, t) => a + tProg(t), 0) / tot) : 0;
  const R = 44, C = 2 * Math.PI * R;
  $('#ck-stats').innerHTML = `<h3>🌿 پیشرفت کارهای من</h3>
    <svg class="ck-ring" viewBox="0 0 110 110"><defs><linearGradient id="ckG" x1="0" x2="1"><stop offset="0" stop-color="#22c55e"/><stop offset="1" stop-color="#e9c46a"/></linearGradient></defs><circle cx="55" cy="55" r="${R}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="10"/><circle cx="55" cy="55" r="${R}" fill="none" stroke="url(#ckG)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${C * pct / 100} ${C}" transform="rotate(-90 55 55)" style="transition:stroke-dasharray .8s;filter:drop-shadow(0 0 5px #22c55e)"/><text x="55" y="60" text-anchor="middle" font-size="22" font-weight="800" fill="#fff4d0">${pct}%</text><text x="55" y="76" text-anchor="middle" font-size="8" fill="#a7c7bd" style="font-family:Vazirmatn">پیشرفت کل</text></svg>
    <div class="ck-nums"><div class="ck-num t"><b>${tot}</b><span>کل کارها</span></div><div class="ck-num r"><b>${run}</b><span>در حال انجام</span></div><div class="ck-num d"><b>${done}</b><span>انجام‌شده</span></div>
      <div class="ck-num" style="grid-column:1/-1"><span>باقی‌مانده: </span><b style="display:inline;font-size:1.3rem;color:#ff8a9b">${tot - done}</b></div></div>`;
  const maxT = Math.max(1, ...CK.groups.map(g => g.tasks.length));
  $('#ck-bars').innerHTML = CK.groups.map(g => { const d = g.tasks.filter(t => t.done).length; return `<div class="ck-bar"><span>${esc(g.name)}</span><div class="track"><i class="tot" style="--t:${g.tasks.length / maxT * 100}%"></i><i class="dn" style="--d:${d / maxT * 100}%"></i></div><em>${d}/${g.tasks.length}</em></div>`; }).join('');
  // global search
  const res = $('#ck-res'); const q = ckState.q.toLowerCase();
  if (q) {
    const hl = s => esc(s).replace(new RegExp(esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => `<mark>${m}</mark>`);
    const ts = all.filter(t => t.title.toLowerCase().includes(q)).slice(0, 12);
    const ps = S.projects.filter(p => (p.title + ' ' + p.desc).toLowerCase().includes(q)).slice(0, 12);
    res.innerHTML = `<div class="panel-title" style="color:#fff4d0">🔎 نتایج جستجو<small>${faNum(ts.length)} کار · ${faNum(ps.length)} پروژه پورتال</small></div>` +
      ts.map(t => `<div class="res" data-task="${t.id}"><i class="sdot" style="--sc:${CK_STATUS[t.status].color}"></i>${hl(t.title)}<small>چک‌لیست · ${esc(t._g.name)}</small></div>`).join('') +
      ps.map(p => `<div class="res" data-pid="${p.id}">${badge(p, '1.6rem')}${hl(p.title)}<small>پورتال · ${catOf(p).short} · ${p.progress}%</small></div>`).join('') || '<div class="empty">نتیجه‌ای نیست</div>';
    res.classList.remove('hidden');
  } else res.classList.add('hidden');
  const filt = t => (ckState.tab === 'all' || (ckState.tab === 'done' ? t.done : !t.done)) && (!q || t.title.toLowerCase().includes(q));
  $('#ck-groups').innerHTML = CK.groups.map(g => {
    const ts = g.tasks.filter(filt); if (!ts.length && (q || ckState.tab !== 'all')) return '';
    const d = g.tasks.filter(t => t.done).length, gp = g.tasks.length ? Math.round(d / g.tasks.length * 100) : 0;
    return `<section class="ck-card ck-group ${g.wide ? 'wide' : ''}"><div class="ck-gh"><h3>${esc(g.name)}</h3><span class="gbar" style="--p:${gp}%"><i></i></span><span class="gcount">${d}/${g.tasks.length}</span></div>
      <div class="ck-tasks">${ts.map(t => `<div class="task ${t.done ? 'done' : ''}" id="tk-${t.id}" data-t="${t.id}" style="--sc:${CK_STATUS[t.status].color}" title="${CK_STATUS[t.status].name}">
        <span class="box">${ICON.check}</span><span class="tt">${esc(t.title)}</span>
        <span class="tp">${t.custom ? '<button class="tdel" data-del title="حذف">✕</button>' : ''}<button class="tpc" data-pc data-snd="1" style="--pc:${progColor(tProg(t))}" title="کلیک: افزایش ۲۵٪">${tProg(t)}%</button></span></div>`).join('') || '<div class="empty">—</div>'}</div></section>`;
  }).join('') || '<div class="ck-card empty">کاری در این فیلتر نیست</div>';
}
function ckClick(e) {
  const el = e.target.closest('.task'); if (!el) return;
  const t = ckAll().find(x => x.id === el.dataset.t);
  if (e.target.closest('[data-del]')) { if (!confirm('این کار حذف شود؟')) return; t._g.tasks = t._g.tasks.filter(x => x !== t); saveCKclean(); SFX.back(); ckPaint(); return; }
  if (e.target.closest('[data-pc]')) {
    if (t.done) { t.done = false; t.progress = 0; } else { t.progress = (t.progress || 0) + 25; if (t.progress >= 100) { t.done = true; t.progress = 100; } }
    t.done ? SFX.done() : SFX.tick(); saveCKclean(); ckPaint(); return;
  }
  t.done = !t.done; if (!t.done && t.progress >= 100) t.progress = 75;
  if (t.done) { SFX.done(); el.classList.add('done'); } else { SFX.undo(); el.classList.remove('done'); }
  saveCKclean(); setTimeout(ckPaint, 520);
}
function saveCKclean() { const raw = JSON.stringify(CK, (k, v) => k === '_g' ? undefined : v); STORE.setItem(K_CK, raw); }
function ckAddModal() {
  const m = openModal(`<h3>🌱 یک قدم تازه</h3>
    <form class="form" style="grid-template-columns:1fr">
      <div class="fld"><label>عنوان کار</label><input type="text" name="title" placeholder="چه کاری می‌خواهی انجام بدهی؟" required></div>
      <div class="fld"><label>دسته‌بندی</label><select name="g">${CK.groups.map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}<option value="__new">＋ دسته جدید…</option></select></div>
      <div class="fld hidden" id="ng"><label>نام دسته جدید</label><input type="text" name="newg"></div>
      <div class="fld"><label>وضعیت و اهمیت کار</label><div class="seg" data-seg="st">${Object.entries(CK_STATUS).map(([k, s], i) => `<button type="button" data-v="${k}" class="${i === 0 ? 'on' : ''}" style="--sc:${s.color};--c:${s.color}"><i class="sdot" style="--sc:${s.color}"></i>${s.name}</button>`).join('')}</div></div>
      <div class="form-actions"><button class="btn ck-submit" data-snd="1">افزودن به چک‌لیست</button><button type="button" class="btn ghost" data-close>انصراف</button></div>
    </form>`, 'ck-modal');
  const f = $('form', m); wireForm(f); setTimeout(() => $('[name=title]', f).focus(), 60);
  $('[name=g]', f).onchange = e => $('#ng', f).classList.toggle('hidden', e.target.value !== '__new');
  f.onsubmit = e => {
    e.preventDefault();
    const title = fv(f, 'title').trim(); if (!title) return;
    let gid = fv(f, 'g'), g;
    if (gid === '__new') { const n = fv(f, 'newg').trim() || 'دسته جدید'; g = { id: 'g' + now().toString(36), name: n, tasks: [] }; CK.groups.push(g); }
    else g = CK.groups.find(x => x.id === gid);
    g.tasks.push({ id: 't' + now().toString(36), title, status: segVal(f, 'st') || 'normal', done: false, progress: 0, createdAt: now(), custom: true });
    saveCKclean(); closeModal(); SFX.save(); toast('یک قدم تازه اضافه شد 🌱', 'ok'); ckPaint();
  };
}

/* ================= Boot ================= */
ROUTES['finance'] = () => {
  if (!FinLock.ok()) { FinLock.gate(view); return; }
  if (window.Finance) Finance.render(view); else view.innerHTML = '<div class="empty">ماژول مالی بارگذاری نشد</div>';
  FinLock.toolbar();
};
document.addEventListener('pointerdown', () => SFX.unlock(), { once: true });
render();

function mountCrewOrbit(sel, extra) {
  if (!window.CrewOrbit || !document.querySelector(sel)) return;
  const low = document.body.classList.contains('lowpower');
  window._crewOrbit = CrewOrbit.mount(sel, Object.assign({
    assetsBase: 'assets/orbit/',
    hrefPrefix: '#/agent/',
    logo: { src: 'logo/milad-logo-512.webp', fallback: 'logo/milad-logo-512.png', alt: 'میلاد سعادت — Milad Saadat', href: null },
    navigate: href => { const r = String(href || '').replace(/^#\//, ''); go(r); },
    sound: (window.SFX && SFX.muted) || low ? false : 'synth',
    idleSecondsPerTurn: low ? 0 : 90
  }, extra || {}));
}

/* SHA-256 (sync) so the finance PIN works on file:// as well as https */
function sha256hex(str) {
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  function bytes(s) { const e = new TextEncoder().encode(s), n = e.length, tot = ((((n + 8) >> 6) + 1) << 6), b = new Uint8Array(tot); b.set(e); b[n] = 0x80; new DataView(b.buffer).setUint32(tot - 4, n * 8, false); return b; }
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
  const data = bytes(str), w = new Uint32Array(64);
  for (let i = 0; i < data.length; i += 64) {
    for (let j = 0; j < 16; j++) w[j] = (data[i+j*4]<<24)|(data[i+j*4+1]<<16)|(data[i+j*4+2]<<8)|data[i+j*4+3];
    for (let j = 16; j < 64; j++) { const s0=rotr(w[j-15],7)^rotr(w[j-15],18)^(w[j-15]>>>3), s1=rotr(w[j-2],17)^rotr(w[j-2],19)^(w[j-2]>>>10); w[j]=(w[j-16]+s0+w[j-7]+s1)|0; }
    let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
    for (let j = 0; j < 64; j++) { const S1=rotr(e,6)^rotr(e,11)^rotr(e,25), ch=(e&f)^(~e&g), t1=(h+S1+ch+K[j]+w[j])|0, S0=rotr(a,2)^rotr(a,13)^rotr(a,22), maj=(a&b)^(a&c)^(b&c), t2=(S0+maj)|0; h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0; }
    h0=(h0+a)|0;h1=(h1+b)|0;h2=(h2+c)|0;h3=(h3+d)|0;h4=(h4+e)|0;h5=(h5+f)|0;h6=(h6+g)|0;h7=(h7+h)|0;
  }
  return [h0,h1,h2,h3,h4,h5,h6,h7].map(x => (x>>>0).toString(16).padStart(8,'0')).join('');
}

const FinLock = (() => {
  const K = 'mss_finance_pin', SK = 'mss_fin_ok';
  const fa = s => String(s).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  const rec = () => { try { return JSON.parse(STORE.getItem(K) || 'null'); } catch (e) { return null; } };
  const setRec = o => STORE.setItem(K, JSON.stringify(o));
  const sess = v => { try { if (v) sessionStorage.setItem(SK, '1'); else sessionStorage.removeItem(SK); } catch (e) { } };
  const sessOn = () => { try { return sessionStorage.getItem(SK) === '1'; } catch (e) { return false; } };
  const hash = pin => { const r = rec() || { salt: Math.random().toString(36).slice(2) + Date.now().toString(36) }; return sha256hex(r.salt + '|' + fa(pin).trim()); };
  const ok = () => !rec() || sessOn();
  function gate(view) {
    view.innerHTML = `<div class="fin-lock"><div class="fl-card glass">
      <div class="fl-ic">🔐</div><h2>قفل امور مالی</h2>
      <p>برای ورود، پین را وارد کنید. دادهٔ مالی نمایش داده نمی‌شود.</p>
      <input id="fl-pin" class="fl-in" type="password" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="پین">
      <div class="fl-err" id="fl-err" hidden>پین نادرست است</div>
      <button class="btn solid" id="fl-go" data-snd="1">ورود</button>
      <button class="btn ghost" data-back="" data-snd="1">بازگشت</button>
    </div></div>`;
    const goIn = () => {
      const r = rec(), pin = fa($('#fl-pin').value || '');
      if (!r || sha256hex(r.salt + '|' + pin) !== r.hash) { $('#fl-err').hidden = false; SFX.error(); $('#fl-pin').value = ''; $('#fl-pin').focus(); return; }
      sess(true); SFX.unlock ? SFX.unlock() : SFX.click(); render();
    };
    $('#fl-go').onclick = goIn;
    $('#fl-pin').addEventListener('keydown', e => { if (e.key === 'Enter') goIn(); });
    setTimeout(() => $('#fl-pin').focus(), 50);
  }
  function form(title, fields, onok) {
    const m = openModal(`<h3>${title}</h3><form class="fl-form">${fields}<div class="fl-err" id="fl-ferr" hidden></div><button class="btn solid" type="submit">تأیید</button></form>`);
    $('form', m).onsubmit = e => {
      e.preventDefault();
      const v = Object.fromEntries([...e.target.querySelectorAll('input')].map(i => [i.name, fa(i.value || '').trim()]));
      const err = onok(v);
      if (err) { const el = $('#fl-ferr'); el.hidden = false; el.textContent = err; SFX.error(); return; }
      closeModal(); SFX.save(); toast('ذخیره شد', 'ok'); render();
    };
  }
  function setPin() {
    form('تنظیم پین مالی',
      '<label>پین جدید (۴ تا ۸ رقم)<input name="a" type="password" inputmode="numeric" maxlength="8" required></label><label>تکرار پین<input name="b" type="password" inputmode="numeric" maxlength="8" required></label>',
      v => {
        if (!/^\d{4,8}$/.test(v.a)) return 'پین باید ۴ تا ۸ رقم باشد';
        if (v.a !== v.b) return 'دو پین یکسان نیستند';
        const salt = Math.random().toString(36).slice(2) + Date.now().toString(36);
        setRec({ v: 1, salt, hash: sha256hex(salt + '|' + v.a) }); sess(true); return null;
      });
  }
  function changePin() {
    form('تغییر پین مالی',
      '<label>پین فعلی<input name="old" type="password" inputmode="numeric" maxlength="8" required></label><label>پین جدید (۴ تا ۸ رقم)<input name="a" type="password" inputmode="numeric" maxlength="8" required></label><label>تکرار پین جدید<input name="b" type="password" inputmode="numeric" maxlength="8" required></label>',
      v => {
        const r = rec(); if (!r || sha256hex(r.salt + '|' + v.old) !== r.hash) return 'پین فعلی نادرست است';
        if (!/^\d{4,8}$/.test(v.a)) return 'پین جدید باید ۴ تا ۸ رقم باشد';
        if (v.a !== v.b) return 'دو پین یکسان نیستند';
        const salt = Math.random().toString(36).slice(2) + Date.now().toString(36);
        setRec({ v: 1, salt, hash: sha256hex(salt + '|' + v.a) }); sess(true); return null;
      });
  }
  function toolbar() {
    const box = document.querySelector('.fh-actions'); if (!box || box.querySelector('#fin-pin')) return;
    const has = !!rec();
    const b = document.createElement('button');
    b.className = 'fin-chip'; b.id = 'fin-pin'; b.dataset.snd = '1';
    b.textContent = has ? '🔒 قفل / پین' : '🔐 تنظیم پین';
    b.onclick = () => {
      if (!has) { setPin(); return; }
      const m = openModal(`<h3>قفل مالی</h3><div class="fl-actions"><button class="btn solid" id="fl-lock" data-snd="1">قفل همین حالا</button><button class="btn ghost" id="fl-chg" data-snd="1">تغییر پین</button><button class="btn ghost" id="fl-off" data-snd="1">حذف پین</button></div>`);
      $('#fl-lock').onclick = () => { sess(false); closeModal(); render(); };
      $('#fl-chg').onclick = () => { closeModal(); changePin(); };
      $('#fl-off').onclick = () => {
        closeModal();
        form('حذف پین', '<label>پین فعلی<input name="old" type="password" inputmode="numeric" maxlength="8" required></label>',
          v => { const r = rec(); if (!r || sha256hex(r.salt + '|' + v.old) !== r.hash) return 'پین نادرست است'; STORE.removeItem(K); sess(false); return null; });
      };
    };
    box.appendChild(b);
  }
  return { ok, gate, toolbar };
})();
window.FinLock = FinLock;


window.PortalWork = { MAX_ACTIVE, isQueuedIdea, isActiveWork, activeWork, convertIdea, askActivate, wouldActivate };

/* PWA install (https/http only; hidden on file://) */
(function () {
  let deferred = null;
  const btn = () => document.querySelector('[data-act=install]');
  const show = on => { const b = btn(); if (b) b.classList.toggle('hidden', !on); };
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; show(true); });
  window.addEventListener('appinstalled', () => { deferred = null; show(false); toast('پورتال نصب شد ✓', 'ok'); });
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-act=install]'); if (!b) return;
    ev.preventDefault(); ev.stopPropagation();
    if (deferred) { deferred.prompt(); deferred = null; show(false); }
    else if (!/^https?:$/.test(location.protocol)) toast('نصب پورتال فقط روی http یا https ممکن است (نه از فایل).');
    else toast('اگر مرورگر دکمهٔ نصب نشان نداد، از منوی مرورگر «نصب برنامه» را بزنید.');
  });
})();

window.__booted = true;
