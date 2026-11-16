/* ===========================================================
   مدیریت امور مالی — Finance dashboard (single page, #/finance)
   Data: localStorage 'mss_finance_v1' (separate from portal)
   Libs (local): Chart.js (eager), SheetJS + pdf.js (lazy on upload)
   =========================================================== */
(function () {
  const K_FIN = 'mss_finance_v1';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DAYMS = 864e5;
  const C = { in: '#1fe0a0', out: '#ff4d6d', net: '#f5c55a', blue: '#4f8cff', violet: '#a46bff' };
  const PALETTE = ['#ff4d6d', '#4f8cff', '#f5c55a', '#1fe0a0', '#a46bff', '#ff8a3d', '#22d3ee', '#ec4899', '#84cc16', '#94a3b8', '#eab308', '#6366f1'];
  const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  const WEEK = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

  /* ---------- Jalali helpers (Intl based, cached) ---------- */
  const JFP = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric' });
  const jCache = new Map();
  function toJ(ts) {
    const d = new Date(ts); const k = d.getFullYear() * 1e4 + d.getMonth() * 100 + d.getDate();
    let v = jCache.get(k);
    if (!v) { const p = {}; JFP.formatToParts(d).forEach(x => p[x.type] = +x.value); v = [p.year, p.month, p.day]; jCache.set(k, v); }
    return v;
  }
  const jOrd = (y, m, d) => y * 372 + (m - 1) * 31 + d;
  function fromJ(jy, jm, jd) {
    if (!(jy > 1200 && jm >= 1 && jm <= 12 && jd >= 1 && jd <= 31)) return null;
    let g = new Date(jy + 621, 2, 21, 12).getTime() + ((jm <= 6 ? (jm - 1) * 31 : 186 + (jm - 7) * 30) + jd - 1) * DAYMS;
    for (let i = 0; i < 20; i++) {
      const [y, m, d] = toJ(g); const diff = jOrd(jy, jm, jd) - jOrd(y, m, d);
      if (!diff) return noon(g);
      g += Math.sign(diff) * Math.max(1, Math.min(Math.abs(diff), 40) - (Math.abs(diff) > 31 ? 5 : 0)) * DAYMS;
    }
    return null; // invalid day (e.g. 31 in a 30-day month)
  }
  const noon = ts => { const d = new Date(ts); d.setHours(12, 0, 0, 0); return d.getTime(); };
  const jstr = ts => toJ(ts).join('/');
  const jdot = ts => { const [y, m, d] = toJ(ts); return `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`.replace(/\d/g, x => '۰۱۲۳۴۵۶۷۸۹'[x]); };
  const weekdayIdx = ts => (new Date(ts).getDay() + 1) % 7; // 0 = شنبه

  /* ---------- numbers ---------- */
  const FA = '۰۱۲۳۴۵۶۷۸۹', AR = '٠١٢٣٤٥٦٧٨٩';
  const normDigits = s => String(s ?? '').replace(/[۰-۹]/g, d => FA.indexOf(d)).replace(/[٠-٩]/g, d => AR.indexOf(d));
  // ⚠ TEMPORARY TEST (Milad, 1405/08/01): every displayed amount is multiplied by this. Stored data, dedupe and
  // statement reconciliation stay on true values. Set back to 1 to revert. Counts are never multiplied.
  const DISPLAY_TEST_MULTIPLIER = 10;
  const dispAmt = n => n * DISPLAY_TEST_MULTIPLIER;
  const dispTx = t => {
    const x = Object.assign({}, t, { amount: dispAmt(t.amount) });
    if (t.bal != null) x.bal = dispAmt(t.bal);
    if (t.usd != null) x.usd = dispAmt(t.usd);
    if (t.fee != null) x.fee = dispAmt(t.fee);
    if (t.principal != null && t.currency === 'USD') x.principal = dispAmt(t.principal);
    return x;
  };
  const HOLDER_NAME = 'میلاد سعادت'; // account holder shown everywhere in the UI
  const PURCHASES = 'خریدها (خرید کارتی)';
  const CAT_RENAME = { 'خرید کارتی (پذیرنده نامشخص)': PURCHASES, 'خرید و سایر فروشگاه‌ها': PURCHASES };
  const fmt = n => (Math.round(n * 10) / 10).toLocaleString('fa-IR', { maximumFractionDigits: 1 });
  const fmtShort = n => { const a = Math.abs(n); const s = n < 0 ? '−' : ''; if (a >= 1e9) return s + (a / 1e9).toLocaleString('fa-IR', { maximumFractionDigits: 1 }) + ' میلیارد'; if (a >= 1e6) return s + (a / 1e6).toLocaleString('fa-IR', { maximumFractionDigits: 1 }) + ' میلیون'; if (a >= 1e3) return s + (a / 1e3).toLocaleString('fa-IR', { maximumFractionDigits: 0 }) + ' هزار'; return s + fmt(a); };
  const pct = n => (isFinite(n) ? n : 0).toLocaleString('fa-IR', { maximumFractionDigits: 1 }) + '٪';

  /* ---------- Phase 2: FX, domains, budgets, reports (offline) ---------- */
  const roundToman = n => Math.round(Number(n) || 0);
  const roundUsd = n => Math.round((Number(n) || 0) * 100) / 100;
  const fmtUsd = n => (isFinite(n) ? n : 0).toLocaleString('fa-IR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' دلار';
  const INTERNAL_CAT = 'جابه‌جایی بین حساب‌های خودم';
  const COMPANY_CATS = ['خدمات', 'حقوق', 'اجاره', 'تجهیزات', 'تبلیغات', 'نرم‌افزار'];
  const PERSONAL_CATS = ['خانواده', 'خانه', 'آموزش', 'سلامت', 'تفریح', 'اشتراک‌ها'];
  const MARKET_DEFS = [
    { id: 'USD', name: 'دلار', unit: 'تومان', icon: '$' },
    { id: 'EUR', name: 'یورو', unit: 'تومان', icon: '€' },
    { id: 'TRY', name: 'لیر', unit: 'تومان', icon: '₺' },
    { id: 'BTC', name: 'بیت‌کوین', unit: 'دلار', icon: '₿' },
    { id: 'ETH', name: 'اتریوم', unit: 'دلار', icon: 'Ξ' },
    { id: 'USDT', name: 'تتر', unit: 'دلار', icon: '₮' },
    { id: 'BRENT', name: 'برنت', unit: 'دلار', icon: '🛢' }
  ];
  const isInternal = t => !!(t && (t.transferId || t.kind === 'transfer' || t.category === INTERNAL_CAT));
  const txDomain = t => (t && t.domain) || 'personal';
  const accountOf = t => (t && (t.account || t.source)) || (F && F.account) || '';
  const cashRows = list => FS.domain === 'combined' ? list.filter(t => !isInternal(t)) : list;
  function ensureP2(d) {
    if (!d || typeof d !== 'object') d = { version: 2, unit: 'تومان', tx: [], sources: [], statements: [] };
    d.fx = d.fx && typeof d.fx === 'object' ? d.fx : { usdToman: null, at: null, source: 'دستی', history: [], markets: [] };
    if (!Array.isArray(d.fx.history)) d.fx.history = [];
    const prev = new Map((d.fx.markets || []).map(m => [m.id, m]));
    d.fx.markets = MARKET_DEFS.map(def => {
      const o = prev.get(def.id) || {};
      return { id: def.id, name: def.name, unit: def.unit, icon: def.icon, value: o.value != null ? +o.value : null, at: o.at || null, source: o.source || 'دستی' };
    });
    if (!Array.isArray(d.budgets)) d.budgets = [];
    if (!Array.isArray(d.reports)) d.reports = [];
    if (!Array.isArray(d.subs)) d.subs = [];
    if (!d.catList || typeof d.catList !== 'object') d.catList = { personal: PERSONAL_CATS.slice(), company: COMPANY_CATS.slice() };
    if (!Array.isArray(d.catList.personal)) d.catList.personal = PERSONAL_CATS.slice();
    if (!Array.isArray(d.catList.company)) d.catList.company = COMPANY_CATS.slice();
    return d;
  }
  const currentRate = () => (F && F.fx && +F.fx.usdToman > 0) ? +F.fx.usdToman : null;
  function rateForDate(ts) {
    const hist = (F.fx && F.fx.history) || [];
    const cut = ts || Date.now();
    let best = null;
    hist.forEach(h => { if (h && +h.rate > 0 && (h.at == null || h.at <= cut) && (!best || (h.at || 0) > (best.at || 0))) best = h; });
    if (best) return { rate: +best.rate, at: best.at, source: best.source || 'دستی', fromHistory: true };
    const r = currentRate();
    if (r) return { rate: r, at: F.fx.at, source: F.fx.source || 'دستی', fromHistory: false };
    return null;
  }
  function setRate(val, at, source) {
    const n = +normDigits(val);
    if (!(n > 0)) return { ok: false, err: 'نرخ نامعتبر است' };
    ensureP2(F);
    const when = at ? (typeof at === 'number' ? at : (parseJInput(at) || Date.now())) : Date.now();
    F.fx.usdToman = n;
    F.fx.at = when;
    F.fx.source = source || 'دستی';
    F.fx.history.push({ rate: n, at: when, source: F.fx.source });
    const usdM = F.fx.markets.find(m => m.id === 'USD');
    if (usdM) { usdM.value = n; usdM.at = when; usdM.source = F.fx.source; }
    saveF();
    return { ok: true, rate: n, at: when };
  }
  function setMarket(id, val, at) {
    ensureP2(F);
    const m = F.fx.markets.find(x => x.id === id);
    if (!m) return { ok: false, err: 'بازار ناشناخته' };
    const n = +normDigits(val);
    if (!(n > 0)) return { ok: false, err: 'نرخ نامعتبر است' };
    const when = at ? (typeof at === 'number' ? at : (parseJInput(at) || Date.now())) : Date.now();
    m.value = n; m.at = when; m.source = 'دستی';
    if (id === 'USD') setRate(n, when, 'دستی');
    else saveF();
    return { ok: true };
  }
  function usdOf(toman, rate) {
    const r = rate || currentRate();
    if (!(r > 0)) return null;
    return roundUsd((Number(toman) || 0) / r);
  }
  function tomanOf(usd, rate) {
    const r = rate || currentRate();
    if (!(r > 0)) return null;
    return roundToman((Number(usd) || 0) * r);
  }
  /* locked USD if stored; otherwise estimated from the current manual rate (never rewritten onto the row) */
  function usdFor(t) {
    if (t && t.rateLocked && t.usd != null) return { usd: +t.usd, locked: true, est: false };
    const r = currentRate();
    if (!r || !t) return { usd: null, locked: false, est: false };
    return { usd: usdOf(t.amount, r), locked: false, est: true };
  }
  function usdHtml(t, opts) {
    const u = t && t.amount != null && t.usd == null && t.rateLocked == null ? usdFor(t) : (t && t.rateLocked && t.usd != null ? { usd: +t.usd, locked: true, est: false } : usdFor(t));
    if (u.usd == null) return '';
    const cls = u.est ? 'k-usd est' : 'k-usd';
    const title = u.locked ? 'معادل قفل‌شده با نرخ ثبت‌شده' : 'معادل برآوردی با نرخ دستی جاری — روی تراکنش قفل نشده';
    const tag = u.est ? ' <small>برآوردی</small>' : '';
    return `<span class="${cls}" title="${title}">≈ ${fmtUsd(u.usd)}${tag}</span>`;
  }
  function attachFx(t, o) {
    o = o || {};
    t.occurDate = o.occurDate || t.date;
    t.entryAt = o.entryAt || Date.now();
    t.domain = o.domain || t.domain || 'personal';
    if (o.account) t.account = o.account;
    if (o.project) t.project = o.project;
    t.currency = o.currency || t.currency || 'IRR';
    if (o.actualRate) t.actualRate = +o.actualRate;
    if (o.fee) t.fee = Math.abs(+o.fee);
    const info = o.rate ? { rate: +o.rate, at: o.rateAt || Date.now(), source: o.rateSource || 'دستی', fromHistory: !!o.rate } : rateForDate(t.occurDate || t.date);
    if (info && info.rate > 0) {
      t.rate = info.rate;
      t.rateAt = info.at;
      t.rateSource = info.source || 'دستی';
      t.rateLocked = true;
      if (!info.fromHistory && o.warnIfNoHist !== false) t.rateNote = (rateForDate(t.occurDate || t.date) && rateForDate(t.occurDate || t.date).fromHistory) ? '' : (F.fx.history || []).some(h => h.at && t.occurDate && h.at <= t.occurDate) ? '' : 'نرخ این تاریخ در سابقه نبود؛ نرخ دستی جاری قفل شد';
      if (t.currency === 'USD') {
        const usd = roundUsd(Math.abs(o.principal != null ? o.principal : (o.usd != null ? o.usd : t.amount)));
        t.principal = usd;
        t.usd = usd;
        t.amount = tomanOf(usd, t.rate);
      } else {
        t.principal = t.amount;
        t.usd = usdOf(t.amount, t.rate);
      }
      t.fxSnap = { rate: t.rate, at: t.rateAt, source: t.rateSource };
    }
    return t;
  }
  function setBudget(o) {
    ensureP2(F);
    const jy = +o.jy, jm = +o.jm, category = String(o.category || '').trim(), amount = Math.abs(+o.amount || 0);
    const domain = o.domain || 'all';
    if (!(jy > 1200) || !(jm >= 1 && jm <= 12) || !category || !amount) return { ok: false, err: 'بودجه نامعتبر است' };
    const i = F.budgets.findIndex(b => b.jy === jy && b.jm === jm && b.category === category && (b.domain || 'all') === domain);
    const row = { id: (i >= 0 && F.budgets[i].id) || newId(), jy, jm, category, amount: roundToman(amount), domain };
    if (i >= 0) F.budgets[i] = row; else F.budgets.push(row);
    saveF();
    return { ok: true, budget: row };
  }
  function budgetProgress(b, list) {
    const src = F.tx; /* always raw stored amounts, never display-multiplied rows */
    const spent = src.filter(t => {
      if (t.type !== 'out' || isInternal(t)) return false;
      if (t.category !== b.category) return false;
      const [y, m] = toJ(t.date);
      if (y !== b.jy || m !== b.jm) return false;
      if (b.domain && b.domain !== 'all' && txDomain(t) !== b.domain) return false;
      return true;
    }).reduce((s, t) => s + t.amount, 0);
    const ratio = b.amount ? spent / b.amount : 0;
    const alert = ratio >= 1 ? 'over' : ratio >= 0.8 ? 'warn' : '';
    const msg = alert === 'over' ? 'بودجه تمام شده یا فراتر رفته' : alert === 'warn' ? '۸۰٪ بودجه مصرف شده' : '';
    return { spent, remain: b.amount - spent, ratio, alert, msg };
  }
  function monthRows(list) {
    const map = new Map();
    list.forEach(t => {
      if (isInternal(t) && FS.domain === 'combined') return;
      const [y, m] = toJ(t.date);
      const k = y * 100 + m;
      const r = map.get(k) || { jy: y, jm: m, inn: 0, out: 0, usdIn: 0, usdOut: 0, n: 0, usdLocked: 0, usdEst: 0 };
      r.n++;
      const u = usdFor(t);
      if (t.type === 'in') { r.inn += t.amount; if (u.usd != null) r.usdIn += u.usd; }
      else { r.out += t.amount; if (u.usd != null) r.usdOut += u.usd; }
      if (u.locked && u.usd != null) r.usdLocked += (t.type === 'in' ? u.usd : -u.usd);
      else if (u.est && u.usd != null) r.usdEst += (t.type === 'in' ? u.usd : -u.usd);
      map.set(k, r);
    });
    return [...map.values()].sort((a, b) => a.jy - b.jy || a.jm - b.jm).map(r => Object.assign(r, { net: r.inn - r.out, usdNetLocked: r.usdLocked }));
  }
  function catRows(list) {
    const map = new Map();
    list.forEach(t => {
      if (isInternal(t) && FS.domain === 'combined') return;
      const k = (t.type || '') + '|' + (t.category || '—');
      const r = map.get(k) || { type: t.type, category: t.category || '—', amount: 0, usdLocked: 0, n: 0 };
      r.n++; r.amount += t.amount;
      if (t.rateLocked && t.usd != null) r.usdLocked += t.usd;
      map.set(k, r);
    });
    return [...map.values()].sort((a, b) => (a.type === b.type ? b.amount - a.amount : a.type === 'out' ? -1 : 1));
  }
  const periodLabel = (jy, jm) => jm ? `${MONTHS[jm - 1]} ${String(jy).replace(/\d/g, d => FA[d])}` : String(jy).replace(/\d/g, d => FA[d]);
  function reportCsv(kind, rows) {
    const bom = '\ufeff';
    if (kind === 'monthly') {
      const head = ['سال', 'ماه', 'درآمد', 'هزینه', 'خالص', 'معادل دلار قفل‌شده'];
      const body = rows.map(r => [r.jy, MONTHS[r.jm - 1], roundToman(r.inn), roundToman(r.out), roundToman(r.net), r.usdNetLocked != null ? roundUsd(r.usdNetLocked) : '']);
      return bom + [head, ...body].map(a => a.join(',')).join('\n');
    }
    const head = ['نوع', 'دسته', 'تعداد', 'جمع تومان', 'معادل دلار قفل‌شده'];
    const body = rows.map(r => [r.type === 'in' ? 'درآمد' : 'هزینه', r.category, r.n, roundToman(r.amount), r.usdLocked ? roundUsd(r.usdLocked) : '']);
    return bom + [head, ...body].map(a => a.join(',')).join('\n');
  }
  function downloadText(name, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function reportXlsx(kind, rows) {
    await needXLSX();
    const aoa = kind === 'monthly'
      ? [['سال', 'ماه', 'درآمد', 'هزینه', 'خالص', 'معادل دلار قفل‌شده'], ...rows.map(r => [r.jy, MONTHS[r.jm - 1], roundToman(r.inn), roundToman(r.out), roundToman(r.net), r.usdNetLocked != null ? roundUsd(r.usdNetLocked) : ''])]
      : [['نوع', 'دسته', 'تعداد', 'جمع تومان', 'معادل دلار قفل‌شده'], ...rows.map(r => [r.type === 'in' ? 'درآمد' : 'هزینه', r.category, r.n, roundToman(r.amount), r.usdLocked ? roundUsd(r.usdLocked) : ''])];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), kind === 'monthly' ? 'ماهانه' : 'دسته');
    XLSX.writeFile(wb, kind === 'monthly' ? 'گزارش-ماهانه.xlsx' : 'گزارش-دسته.xlsx');
    return true;
  }
  function archiveReport(kind, rows, title) {
    ensureP2(F);
    const rec = { id: newId(), kind, title: title || (kind === 'monthly' ? 'گزارش ماهانه' : 'گزارش دسته‌ای'), at: Date.now(), domain: FS.domain, rows };
    F.reports.unshift(rec);
    saveF();
    return rec;
  }
  function addCat(domain, name) {
    ensureP2(F);
    name = String(name || '').trim();
    if (!name || (domain !== 'personal' && domain !== 'company')) return { ok: false };
    const list = F.catList[domain];
    if (!list.includes(name)) list.push(name);
    saveF();
    return { ok: true };
  }


  /* ---------- categories by keyword ---------- */
  const RULES = [
    ['in', 'درآمد پروژه‌ها', /پروژه|قرارداد|پیش ?پرداخت|تسویه|فاکتور|invoice|project/i],
    ['in', 'حقوق و دستمزد', /حقوق|دستمزد|salary|payroll/i],
    ['in', 'فروش و خدمات', /فروش|عکاسی|آتلیه|خدمات|sale/i],
    ['in', 'سود و سرمایه', /سود|بهره|سپرده|interest|dividend/i],
    ['out', 'اجاره و مسکن', /اجاره|رهن|شارژ ساختمان|rent/i],
    ['out', 'قبوض', /قبض|برق|آب|گاز|تلفن|اینترنت|همراه اول|ایرانسل|bill/i],
    ['out', 'خوراک و رستوران', /رستوران|کافه|غذا|فست|سوپر|هایپر|میوه|نان|اسنپ ?فود|food|cafe/i],
    ['out', 'حمل‌ونقل', /اسنپ|تپسی|تاکسی|بنزین|سوخت|پارکینگ|عوارض|مترو|snapp|taxi|fuel/i],
    ['out', 'اشتراک‌های AI و نرم‌افزار', /chatgpt|openai|claude|gemini|grok|suno|midjourney|adobe|اشتراک|نرم ?افزار|subscription|vpn/i],
    ['out', 'تبلیغات و بازاریابی', /تبلیغ|اینستاگرام|کمپین|ads|marketing/i],
    ['out', 'تجهیزات و فناوری', /دوربین|لنز|لپ ?تاپ|کامپیوتر|مانیتور|تجهیزات|camera|lens/i],
    ['out', 'آموزش و خانواده', /مدرسه|کلاس|آموزش|شهریه|کتاب|school/i],
    ['out', 'سلامت', /پزشک|دکتر|دارو|داروخانه|بیمارستان|آزمایش|بیمه|clinic|pharm/i],
    ['out', 'خرید و پوشاک', /خرید|پوشاک|لباس|کفش|دیجی ?کالا|shop/i],
    ['out', 'کارمزد و بانک', /کارمزد|fee|commission/i],
  ];
  /* ---------- bank-statement description cleanup (Vipad / Pasargad style + generic) ---------- */
  const fixAr = s => String(s || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/\s+/g, ' ').trim();
  const last4 = n => '****' + String(n).slice(-4);
  const maskCards = s => s.replace(/\b(\d{4})[- ]?(\d{4})[- ]?(\d{4})[- ]?(\d{4})\b/g, (m, a, b, c, d) => '****' + d).replace(/\bIR\d{20}(\d{4})\b/gi, (m, d) => 'شبا ****' + d);
  const MW = ['سوپرمارکت', 'سوپر', 'مارکت', 'آرایشگاه', 'مردانه', 'میوه', 'فروشی', 'مالک', 'اشتر', 'اسباب', 'بازی', 'مرکز', 'ارتباط', 'ایرانسل', 'لبنیات', 'سنتی', 'میشان', 'کباب', 'کبابی', 'پاسارگاد', 'جاسبی', 'میلاد', 'رستوران', 'چهارفصل', 'غذاهای', 'آماده', 'سازمان', 'نانوایی', 'داروخانه', 'فروشگاه', 'بستنی', 'شرکت', 'مخابرات', 'دخانیات', 'قبض', 'فتحی'];
  const mKey = s => s.replace(/[\sیيى‌]/g, '');
  const dictHits = s => { const k = mKey(s); return MW.filter(w => k.includes(mKey(w))).length; };
  const isBroken = m => { const fr = m.split(' '); return fr.some((f, i) => f.length === 1 && /[\u0600-\u06FF]/.test(f) || i && !MW.includes(fr[i - 1]) && !MW.includes(f) && MW.some(x => mKey(x) === mKey(fr[i - 1] + f))); };
  function fixMerchant(m, known) {
    m = fixAr(String(m).replace(/\u0000/g, 'آ')); if (!m) return m; // this PDF's font has no Unicode mapping for «آ»
    const dbl = m.match(/^(\S{3,})\1$/); if (dbl) m = dbl[1]; // «خرازیخرازی» → «خرازی»
    const broken = isBroken(m);
    const rev = [...m].reverse().join('');
    let cand = m;
    if (/[\u0600-\u06FF]/.test(m) && dictHits(rev) > dictHits(m)) cand = rev.replace(/^ی /, '').replace(/آ(?=\S)/g, 'آ'); // glyph order reversed in the PDF text layer
    const k = mKey(cand); const hit = known && known.get(k);
    if (hit) return hit;
    if (!broken && cand === m) return m;
    // re-join split fragments («س وپرمارکت» → «سوپرمارکت»)
    const t = cand.split(' '); const out = [];
    for (let i = 0; i < t.length; i++) {
      let w = t[i];
      const join = (a, b) => MW.some(x => mKey(x) === mKey(a + b) || mKey(x).startsWith(mKey(a + b)) && (a + b).length < x.length);
      if (out.length && (w.length === 1 && !MW.includes(out[out.length - 1]) || join(out[out.length - 1], w))) { out[out.length - 1] += w; continue; }
      if (w.length === 1 && i + 1 < t.length) { t[i + 1] = w + t[i + 1]; continue; }
      out.push(w);
    }
    return out.join(' ');
  }
  const fixMerchantN = (m, known) => { const r = fixMerchant(m, known); return r && r.replace(/^سوپر مارکت /, 'سوپرمارکت '); };
  // categories for merchants / bank operations (first match wins)
  const MCAT = [
    ['رستوران و غذای آماده', /رستوران|کباب|جوجه|غذا|snapp ?food|اسنپ ?فود|فست|پیتزا|کافه|بستنی|آبمیوه|ساندویچ/i],
    ['نان، میوه و لبنیات', /نانوایی|میوه|لبنیات|تره ?بار|بارفروشان/],
    ['سوپرمارکت و خواربار', /سوپر|مارکت|مواد غذایی|خواربار|هایپر|کوروش|بروفه|borofe|افق/i],
    ['دخانیات', /دخانیات/],
    ['سلامت و دارو', /داروخانه|دکتر|پزشک|درمان|بیمارستان|آزمایشگاه/],
    ['آرایشگاه و مراقبت شخصی', /آرایشگاه|پیرایش|سالن زیبایی/],
    ['قبوض و ارتباطات', /مخابرات|ایرانسل|همراه اول|رایتل|قبض|تلفن/],
    ['لوازم‌التحریر و آموزش', /التحریر|مدرسه|کتاب|آموزش/],
    [PURCHASES, /اسباب|خرازی|موبایل|پوشاک|لباس|کفش|مال|فروشگاه/],
  ];
  let HOLDER = '';
  const sameName = (a, b) => { a = mKey(fixAr(a)); b = mKey(fixAr(b)); return a && b && (a.startsWith(b) || b.startsWith(a)) && Math.min(a.length, b.length) >= 8; };
  function holderFrom(descs) {
    const c = new Map(); descs.forEach(d => { const m = fixAr(d).match(/از کارت \d{16} متعلق به (.+?) (?:به کارت|از )/); if (m) c.set(m[1], (c.get(m[1]) || 0) + 1); });
    return [...c].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  }
  // clean merchant spellings already seen (this file + stored data) → canonical names for broken text-layer variants
  function knownMerchants(descs) {
    const k = new Map(); const add = m => { m = fixAr(m); if (m && !isBroken(m) && !k.has(mKey(m))) k.set(mKey(m), m); };
    (typeof F !== 'undefined' && F ? F.tx : []).forEach(t => t.merchant && add(t.merchant));
    descs.forEach(d => { const m = fixAr(d).match(/خرید کالا و خدمات با کارت .*?پذیرنده (.+?) - /); if (m) add(m[1]); });
    return k;
  }
  function tidyDesc(raw, type, known) {
    const s = fixAr(raw); let m;
    const R = (desc, cat, extra) => Object.assign({ desc: maskCards(desc), cat }, extra || {});
    if (/^سند کارمزد تراکنش کارت/.test(s)) return R('کارمزد تراکنش کارت', 'کارمزدهای بانکی');
    if ((m = s.match(/خرید کالا و خدمات با کارت .*?پذیرنده (.+?) - ([^-]*)/))) {
      const mer = /^not( available)?$/i.test(m[1].trim()) ? `پذیرنده بی‌نام (${m[2].replace(/شماره.*$|پرداخت الکترونیک|[()\d]/g, '').trim() || 'نامشخص'})` : fixMerchantN(m[1], known); const unk = /^(پایانه|پذیرنده بی‌نام|پرداخت الکترونیک|zarin|ای بیکام|ariyana)/i.test(mer);
      let cat = PURCHASES;
      if (!unk) for (const [c, re] of MCAT) if (re.test(mer)) { cat = c; break; }
      return R(unk ? `خرید کارتی — ${mer}` : `خرید از ${mer}`, cat, { merchant: mer });
    }
    if (/پرداخت قبض ([^-]+)/.test(s)) return R('پرداخت قبض ' + s.match(/پرداخت قبض ([^-]+)/)[1].trim(), 'قبوض و ارتباطات');
    if (/پرداخت اقساط/.test(s)) return R('پرداخت قسط تسهیلات' + ((m = s.match(/قرارداد شماره (\d+)/)) ? ` (قرارداد ${m[1]})` : ''), 'اقساط و تسویه وام');
    if (/تسویه تسهیلات/.test(s)) return R('تسویه تسهیلات' + ((m = s.match(/قرارداد شماره (\d+)/)) ? ` (قرارداد ${m[1]})` : ''), 'اقساط و تسویه وام');
    if (/کارمزد تمدید مهلت بازپرداخت/.test(s)) return R('کارمزد تمدید مهلت بازپرداخت تسهیلات', 'کارمزدهای بانکی');
    if (/استعلام اعتبارسنجی/.test(s)) return R('کارمزد استعلام اعتبارسنجی', 'کارمزدهای بانکی');
    if (/کارمزد ارائه خدمات دیجیتال/.test(s)) return R('کارمزد ارائه خدمات دیجیتال (ویپاد)', 'کارمزدهای بانکی');
    if (/ضمانت نامه مانده بدهی|ضمانت مانده بدهی/.test(s)) return R('ضمانت‌نامه مانده بدهی', 'کارمزدهای بانکی');
    if ((m = s.match(/اعطای تسهیلات به شماره (\d+)/))) return R(`دریافت تسهیلات (وام) شماره ${m[1]}`, 'دریافت تسهیلات (وام)');
    if ((m = s.match(/از کارت (\d{16})(?: متعلق به (.+?))? به کارت (\d{16})(?: متعلق به (.+?))?(?= از | - |\]|$)/))) {
      const vm = s.match(/ از (خودپرداز|اینترنت|کیوسک|پایانه|موبایل)[^-]*- پذیرنده (.+?) - /); m[5] = vm ? vm[1] : ''; m[6] = vm ? vm[2] : '';
      const note = (s.match(/شماره پیگیری \d+ - ([^\]\[]+)\]?\s*$/) || [])[1];
      if (type === 'out') {
        const self = m[4] && sameName(m[4], HOLDER);
        return R(`${self ? 'انتقال به کارت دیگر خودم' : 'انتقال به ' + (m[4] || 'کارت')} (کارت ${last4(m[3])})${note ? ' — ' + note.trim() : ''}`, self ? 'جابه‌جایی بین حساب‌های خودم' : 'انتقال به اشخاص', { party: self ? '' : m[4] || '' });
      }
      const self = m[2] && sameName(m[2], HOLDER);
      const via = m[5] === 'خودپرداز' ? ` — خودپرداز ${m[6]}` : m[5] === 'اینترنت' ? ' — اینترنتی' : '';
      return R(`واریز کارت‌به‌کارت از کارت ${last4(m[1])}${m[2] ? ' (' + m[2] + ')' : ''}${via}`, self ? 'جابه‌جایی بین حساب‌های خودم' : 'واریز کارت‌به‌کارت');
    }
    if ((m = s.match(/انتقال وجه از سپرده [\d.]+ به نام (.+?) بابت (.+?)(?: \)|$)/))) return R(`واریز از ${m[1]} — بابت ${m[2].replace(/[()]/g, '').trim()}`, sameName(m[1], HOLDER) ? 'جابه‌جایی بین حساب‌های خودم' : 'واریز از سپرده اشخاص', { party: m[1] });
    if ((m = s.match(/انتقال وجه به سپرده [\d.]+ به نام (.+?) بابت (.+)$/))) return R(`انتقال به ${m[1]} — بابت ${m[2].trim()}`, sameName(m[1], HOLDER) ? 'جابه‌جایی بین حساب‌های خودم' : 'انتقال به اشخاص', { party: m[1] });
    if (/برداشت پل/.test(s)) { const sh = s.match(/شبای مقصد (IR\d{24})/i), sh2 = (s.match(/به شرح (.+?) - /) || [])[1]; return R(`انتقال پل به حساب دیگر${sh ? ' (' + sh[1] + ')' : ''}${sh2 ? ' — ' + sh2 : ''}`, 'انتقال پل به حساب دیگر'); }
    if (/واریز پل/.test(s)) { const ob = (s.match(/متعهد (.+?) با شماره/) || [])[1], sh = s.match(/(IR\d{24})/i); const self = ob && sameName(ob, HOLDER); return R(`واریز پل${self ? ' از حساب دیگر خودم' : ob ? ' از ' + ob : ''}${sh ? ' (' + sh[1] + ')' : ''}`, self ? 'جابه‌جایی بین حساب‌های خودم' : 'واریز پل از حساب دیگر'); }
    if (/سند واریز داخلی|انتقال اعتبار از کسب و ?کار ?بانک/.test(s)) return R('واریز داخلی بانک پاسارگاد' + (/هزینه عمومی/.test(s) ? ' — هزینه عمومی و امور روزمره' : ''), 'واریز داخلی بانک');
    if (/^سند افزایش اعتبار کاربر$/.test(s)) return R('افزایش اعتبار کیف پول', 'سایر واریزها');
    // generic: drop bank tracking noise, mask card / IBAN numbers
    const g = s.replace(/شماره (مرجع|پیگیری|پيگيري) \d+/g, '').replace(/[\[\]()]/g, ' ').replace(/\s+-\s+(?=-|$)/g, ' ').replace(/\s+/g, ' ').trim();
    return R(g.length > 140 ? g.slice(0, 138) + '…' : g, null);
  }
  function guessCatInfo(desc, type) {
    for (const [t, name, re] of RULES) if ((t === type) && re.test(desc)) return { name, conf: 90, review: false };
    if (/کارت ?به ?کارت|انتقال|پایا|ساتنا|transfer/i.test(desc)) return { name: type === 'in' ? 'واریز / انتقال' : 'انتقال وجه', conf: 70, review: false };
    return { name: type === 'in' ? 'سایر درآمدها' : 'سایر هزینه‌ها', conf: 30, review: true };
  }
  function guessCat(desc, type) { return guessCatInfo(desc, type).name; }

  /* ---------- data ---------- */
  let uid = 0; const newId = () => 'f' + Date.now().toString(36) + (uid++).toString(36);
    // v2: real statement seed (window.FIN_SEED from finance-seed.js). Old v1 data = the fake «نمونه» sample → replaced,
  // but anything the user added himself (uploads / manual rows) is kept and merged on top (deduped).
  function realSeed() {
    const S = window.FIN_SEED;
    if (!S || !Array.isArray(S.tx)) return { version: 2, unit: 'تومان', tx: [], sources: [], statements: [] };
    const now = Date.now();
    return { version: 2, unit: S.unit || 'تومان', account: S.account, statements: S.statements || [], tx: S.tx.map(t => Object.assign({}, t, CAT_RENAME[t.category] ? { category: CAT_RENAME[t.category] } : {})), sources: S.sources.map(x => Object.assign({}, x, { at: x.at || now })) };
  }
  const renameCats = d => { (d.tx || []).forEach(t => { if (CAT_RENAME[t.category]) t.category = CAT_RENAME[t.category]; }); return d; };
  function loadF() {
    let d = null; try { d = JSON.parse(STORE.getItem(K_FIN)); } catch (e) { }
    const sane = x => x && Array.isArray(x.tx) && x.tx.every(t => t && typeof t === 'object' && isFinite(t.date) && isFinite(t.amount) && (t.type === 'in' || t.type === 'out'));
    if (d && !sane(d)) d = null; // corrupted / foreign data → start from the real seed instead of crashing
    if (d && !Array.isArray(d.sources)) d.sources = [];
    let detached = false; try { detached = STORE.getItem('mss_finance_detached') === '1'; } catch (e) { }
    if (d && d.version === 2 && Array.isArray(d.tx)) { renameCats(d); STORE.setItem(K_FIN, JSON.stringify(d)); return d; }
    if (detached) return { version: 2, unit: 'تومان', tx: [], sources: [], statements: [], detached: true };
    const n = realSeed();
    if (d && Array.isArray(d.tx)) { // migrate v1: drop sample rows, keep the user's own rows
      const ks = new Set(n.tx.map(txKey));
      d.tx.filter(t => !t.sample).forEach(t => { const k = txKey(t); if (!ks.has(k)) { ks.add(k); n.tx.push(t); } });
      (d.sources || []).filter(x => !x.sample).forEach(x => n.sources.push(x));
      n.tx.sort(byTime);
    }
    STORE.setItem(K_FIN, JSON.stringify(n)); return n;
  }
  const byTime = (a, b) => a.date - b.date || String(a.time || '').localeCompare(String(b.time || ''));
  const saveF = () => STORE.setItem(K_FIN, JSON.stringify(F));
  // ref (bank transaction id) when present → exact dedupe even for identical same-day fees
  let F;
  const txKey = t => t.ref ? `R|${t.ref}|${t.type}` : `${jstr(t.date)}|${t.time || ''}|${Math.round(t.amount)}|${t.type}|${String(t.desc || '').replace(/\s+/g, ' ').trim().slice(0, 40)}`;
  F = ensureP2(loadF());

  /* ---------- filters ---------- */
  const FS = { year: 'all', month: 'all', from: '', to: '', type: 'all', q: '', domain: 'all', account: 'all', project: 'all' };
  function parseJInput(s) {
    s = normDigits(s).trim(); if (!s) return null;
    const m = s.match(/^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})$/); if (!m) return undefined;
    return fromJ(+m[1], +m[2], +m[3]) || undefined;
  }
  function filtered(opts = {}) {
    const from = parseJInput(FS.from), to = parseJInput(FS.to);
    return F.tx.filter(t => {
      const [y, m] = toJ(t.date);
      if (FS.year !== 'all' && y !== +FS.year) return false;
      if (FS.month !== 'all' && m !== +FS.month) return false;
      if (from && t.date < from) return false;
      if (to && t.date > to + DAYMS - 1) return false;
      if (!opts.ignoreType && FS.type !== 'all' && t.type !== FS.type) return false;
      if (FS.domain === 'personal' || FS.domain === 'company') { if (txDomain(t) !== FS.domain) return false; }
      if (FS.account !== 'all' && accountOf(t) !== FS.account) return false;
      if (FS.project !== 'all' && (t.project || '') !== FS.project) return false;
      if (FS.q && !(t.desc + ' ' + t.category).toLowerCase().includes(FS.q.toLowerCase())) return false;
      return true;
    }).map(dispTx);
  }

  /* ---------- render ---------- */
  let charts = [];
  function destroy() { charts.forEach(c => { try { c.destroy(); } catch (e) { } }); charts = []; }

  function render(view) {
    destroy();
    const years = [...new Set(F.tx.map(t => toJ(t.date)[0]))].sort();
    const accounts = [...new Set(F.tx.map(accountOf).filter(Boolean))].sort();
    const projects = [...new Set(F.tx.map(t => t.project).filter(Boolean))].sort();
    const fxRate = currentRate();
    const fxDate = F.fx && F.fx.at ? jstr(F.fx.at) : jstr(Date.now());
    view.innerHTML = `<div class="page fin-page">
      <header class="fin-head">
        <button class="back-btn fin-back" data-back="" data-snd="1" aria-label="بازگشت">${typeof ICON !== 'undefined' ? ICON.back : '‹'}</button>
        <div class="fh-logo"><img src="${ASSET('logo-milad-v2.png')}" alt=""><span class="fh-ring"></span></div>
        <div class="fh-text"><div class="fh-kicker">Milad Saadat · Finance Center</div><h1>مدیریت امور مالی</h1><div class="fh-sub">داشبورد درآمد و هزینه — ${esc(F.unit || 'تومان')} · <span id="fh-range"></span></div></div>
        <div class="fh-actions">
          <label class="fin-up" data-snd="1"><input type="file" id="fin-file" accept=".xlsx,.xls,.csv,.pdf" hidden><span class="up-ic">⬆</span><span><b>آپلود فایل اکسل / PDF</b><small>صورت‌حساب بانکی یا لیست تراکنش‌ها</small></span></label>
          <button class="fin-chip" id="fin-addtx">＋ تراکنش دستی</button>
          <button class="fin-chip" id="fin-sources">🗂 منابع داده (${F.sources.length})</button>
          <button class="fin-chip" id="fin-cats">🏷 دسته‌ها</button>
          <button class="fin-chip" id="fin-class">⚖ تفکیک شخصی/شرکت</button>
          <button class="fin-chip" id="fin-subs-btn">🔁 اشتراک‌ها</button>
        </div>
      </header>
      <div class="fin-drop hidden" id="fin-drop"><div>فایل را اینجا رها کن ⬇</div></div>
      <section class="fin-filters fin-card">
        <div class="ff"><label>سال</label><select id="f-year"><option value="all">همه سال‌ها</option>${years.map(y => `<option value="${y}" ${FS.year == y ? 'selected' : ''}>${y.toLocaleString('fa-IR', { useGrouping: false })}</option>`).join('')}</select></div>
        <div class="ff"><label>ماه</label><select id="f-month"><option value="all">همه ماه‌ها</option>${MONTHS.map((n, i) => `<option value="${i + 1}" ${FS.month == i + 1 ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div class="ff"><label>از تاریخ</label><input id="f-from" class="ltr" placeholder="1405/01/01" value="${esc(FS.from)}"></div>
        <div class="ff"><label>تا تاریخ</label><input id="f-to" class="ltr" placeholder="1405/08/01" value="${esc(FS.to)}"></div>
        <div class="ff"><label>نوع</label><div class="fin-seg" id="f-type">${[['all', 'همه'], ['in', 'درآمد'], ['out', 'هزینه']].map(([v, l]) => `<button data-v="${v}" class="${FS.type === v ? 'on' : ''} t-${v}">${l}</button>`).join('')}</div></div>
        <div class="ff"><label>حوزه</label><div class="fin-seg" id="f-domain">${[['all', 'همه'], ['personal', 'شخصی'], ['company', 'شرکت'], ['combined', 'تجمیعی']].map(([v, l]) => `<button type="button" data-v="${v}" class="${FS.domain === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        <div class="ff"><label>حساب</label><select id="f-account"><option value="all">همه حساب‌ها</option>${accounts.map(a => `<option value="${esc(a)}" ${FS.account === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></div>
        <div class="ff"><label>پروژه</label><select id="f-project"><option value="all">همه پروژه‌ها</option>${projects.map(a => `<option value="${esc(a)}" ${FS.project === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></div>
        <div class="ff grow"><label>جستجو در شرح</label><input id="f-q" type="search" placeholder="مثلاً: اجاره، اسنپ، پروژه…" value="${esc(FS.q)}"></div>
        <div class="ff quick"><label>بازه سریع</label><div class="fin-seg" id="f-quick"><button data-q="m">این ماه</button><button data-q="3">۳ ماه</button><button data-q="y">امسال</button><button data-q="all">همه</button></div></div>
      </section>
      <section class="fin-card fx-bar" id="fx-bar">
        <div class="fx-main">
          <div class="fx-title">نرخ دلار دستی (آفلاین)</div>
          <p class="fx-help">معادل دلاری کنار مبلغ تومان می‌آید. نرخ با تاریخ ذخیره می‌شود و تراکنش‌های قفل‌شده با بالا و پایین رفتن نرخ عوض نمی‌شوند. اتصال زنده به بازار هنوز فعال نیست.</p>
          <div class="fx-row">
            <label>یک دلار = <input id="fx-rate" class="ltr" inputmode="decimal" placeholder="تومان" value="${fxRate ? esc(String(fxRate)) : ''}"> تومان</label>
            <label>تاریخ نرخ <input id="fx-date" class="ltr" placeholder="1405/08/01" value="${esc(fxDate)}"></label>
            <button type="button" class="fin-chip" id="fx-save">ثبت نرخ</button>
            <span class="fx-meta" id="fx-meta">${fxRate ? `آخرین نرخ دستی: ${fmt(fxRate)} تومان · ${F.fx.at ? jdot(F.fx.at) : '—'} · ${esc(F.fx.source || 'دستی')}` : 'نرخ ثبت نشده — معادل دلاری پس از ثبت نرخ نمایش داده می‌شود'}</span>
          </div>
        </div>
      </section>
      <section class="fin-markets" id="fx-markets"></section>
      <section class="fin-kpis" id="fin-kpis"></section>
      <section class="fin-card" id="fin-budgets"></section>
      <section class="fin-card" id="fin-reports"></section>
      <section class="fin-card" id="fin-subs"></section>
      <section class="fin-card" id="fin-extra"></section>
      <section class="fin-grid">
        <div class="fin-card span2"><div class="fc-h"><span class="fc-dot" style="--c:${C.in}"></span>درآمد و هزینه ماهانه<small>ماه‌های شمسی</small></div><div class="cv tall"><canvas id="ch-month"></canvas></div></div>
        <div class="fin-card"><div class="fc-h"><span class="fc-dot" style="--c:${C.out}"></span><span id="donut-title">سهم دسته‌های هزینه</span></div><div class="cv tall"><canvas id="ch-donut"></canvas></div></div>
        <div class="fin-card span2"><div class="fc-h"><span class="fc-dot" style="--c:${C.net}"></span><span id="bal-title">روند مانده (تجمعی)<small>درآمد منهای هزینه در طول زمان</small></span></div><div class="cv"><canvas id="ch-bal"></canvas></div></div>
        <div class="fin-card"><div class="fc-h"><span class="fc-dot" style="--c:${C.blue}"></span>الگوی روزهای هفته<small>میانگین هر روز</small></div><div class="cv"><canvas id="ch-week"></canvas></div></div>
        <div class="fin-card span2"><div class="fc-h"><span class="fc-dot" style="--c:${C.violet}"></span>بزرگ‌ترین هزینه‌ها بر اساس دسته</div><div class="cv"><canvas id="ch-top"></canvas></div></div>
        <div class="fin-card insights"><div class="fc-h"><span class="fc-dot" style="--c:${C.net}"></span>بینش‌ها</div><ul id="fin-ins"></ul></div>
        <div class="fin-card span3"><div class="fc-h"><span class="fc-dot" style="--c:${C.blue}"></span>روند روزانه<small>درآمد و هزینه روزبه‌روز در بازه انتخابی</small></div><div class="cv"><canvas id="ch-daily"></canvas></div></div>
      </section>
      <section class="fin-tables">
        <div class="fin-card"><div class="fc-h"><span class="fc-dot" style="--c:${C.out}"></span>بزرگ‌ترین تراکنش‌ها</div><div id="t-big"></div></div>
        <div class="fin-card"><div class="fc-h"><span class="fc-dot" style="--c:${C.net}"></span>خلاصه بر اساس دسته</div><div id="t-cat"></div></div>
        <div class="fin-card span2"><div class="fc-h"><span class="fc-dot" style="--c:${C.in}"></span>تراکنش‌های اخیر<small id="t-recent-n"></small></div><div id="t-recent"></div><div class="fin-more"><button class="fin-chip" id="t-more">نمایش بیشتر</button></div></div>
      </section>
      <div class="fin-foot">صاحب حساب: ${esc(HOLDER_NAME)} · ${esc(F.account || "")}${F.account ? " · " : ""}داده‌ها از صورت‌حساب‌های واقعی خوانده شده‌اند (ریال ÷۱۰ = تومان) و فقط در همین مرورگر (localStorage) ذخیره می‌شوند — چیزی به بیرون ارسال نمی‌شود.</div>
    </div>`;
    bind(view);
    paint();
  }

  let recentN = 15;
  function bind(view) {
    const re = () => { recentN = 15; paint(); };
    $('#f-year').onchange = e => { FS.year = e.target.value; re(); };
    $('#f-month').onchange = e => { FS.month = e.target.value; re(); };
    const dateIn = (el, k) => { el.oninput = () => { FS[k] = el.value; const v = parseJInput(el.value); el.classList.toggle('bad', v === undefined); if (v !== undefined) re(); }; };
    dateIn($('#f-from'), 'from'); dateIn($('#f-to'), 'to');
    $('#f-type').onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; FS.type = b.dataset.v; $$('#f-type button').forEach(x => x.classList.toggle('on', x === b)); window.SFX && SFX.pick(); re(); };
    $('#f-q').oninput = e => { FS.q = e.target.value.trim(); re(); };
    $('#f-quick').onclick = e => {
      const b = e.target.closest('[data-q]'); if (!b) return;
      const [y, m] = toJ(Date.now()); FS.year = 'all'; FS.month = 'all'; FS.from = ''; FS.to = '';
      if (b.dataset.q === 'm') { FS.year = String(y); FS.month = String(m); }
      if (b.dataset.q === 'y') FS.year = String(y);
      if (b.dataset.q === '3') { let mm = m - 2, yy = y; if (mm < 1) { mm += 12; yy--; } FS.from = `${yy}/${String(mm).padStart(2, '0')}/01`; }
      $('#f-year').value = FS.year; $('#f-month').value = FS.month; $('#f-from').value = FS.from; $('#f-to').value = FS.to;
      re();
    };
    $('#fin-file').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) handleFile(f); };
    $('#fin-addtx').onclick = manualTx;
    $('#fin-sources').onclick = sourcesModal;
    const catsBtn = $('#fin-cats'); if (catsBtn) catsBtn.onclick = catsModal;
    const clBtn = $('#fin-class'); if (clBtn) clBtn.onclick = classifyModal;
    const sbBtn = $('#fin-subs-btn'); if (sbBtn) sbBtn.onclick = () => { const el = document.getElementById('fin-subs'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
    const fd = $('#f-domain');
    if (fd) fd.onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; FS.domain = b.dataset.v; $$('#f-domain button').forEach(x => x.classList.toggle('on', x === b)); window.SFX && SFX.pick(); re(); };
    const fa = $('#f-account'); if (fa) fa.onchange = e => { FS.account = e.target.value; re(); };
    const fp = $('#f-project'); if (fp) fp.onchange = e => { FS.project = e.target.value; re(); };
    const fxSave = $('#fx-save');
    if (fxSave) fxSave.onclick = () => {
      const r = setRate($('#fx-rate').value, $('#fx-date').value, 'دستی');
      if (!r.ok) { window.SFX && SFX.error(); toast(r.err || 'نرخ نامعتبر است'); return; }
      window.SFX && SFX.save && SFX.save(); toast('نرخ دستی ثبت شد ✓', 'ok'); render(document.getElementById('view'));
    };
    $('#t-more').onclick = () => { recentN += 30; paintRecent(filtered()); };
    // drag & drop on the whole page
    const drop = $('#fin-drop');
    view.ondragover = e => { e.preventDefault(); drop.classList.remove('hidden'); };
    view.ondragleave = e => { if (e.target === drop) drop.classList.add('hidden'); };
    view.ondrop = e => { e.preventDefault(); drop.classList.add('hidden'); const f = e.dataTransfer.files[0]; if (f) handleFile(f); };
    view.onclick = e => {
      const del = e.target.closest('[data-deltx]');
      if (del) { if (!confirm('این تراکنش به سطل بازیافت برود؟')) return; const row = F.tx.find(t => t.id === del.dataset.deltx); if (row && window.Offline) Offline.trash('tx', row.desc || 'تراکنش', row); F.tx = F.tx.filter(t => t.id !== del.dataset.deltx); saveF(); paint(); }
      const cat = e.target.closest('[data-cat]');
      if (cat) { FS.q = cat.dataset.cat; $('#f-q').value = FS.q; re(); $('#t-recent').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    };
  }

  function sumBy(list, keyFn, valFn = t => t.amount) { const m = new Map(); list.forEach(t => { const k = keyFn(t); m.set(k, (m.get(k) || 0) + valFn(t)); }); return m; }

  function paint() {
    destroy();
    const allRaw = filtered({ ignoreType: true });
    const all = cashRows(allRaw);
    const list = filtered();
    const inc = all.filter(t => t.type === 'in'), exp = all.filter(t => t.type === 'out');
    const tIn = inc.reduce((a, t) => a + t.amount, 0), tOut = exp.reduce((a, t) => a + t.amount, 0), net = tIn - tOut;
    const monthsKey = t => { const [y, m] = toJ(t.date); return y * 100 + m; };
    const months = [...new Set(all.map(monthsKey))].sort((a, b) => a - b);
    const nM = Math.max(1, months.length);
    const minD = all.length ? Math.min(...all.map(t => t.date)) : 0, maxD = all.length ? Math.max(...all.map(t => t.date)) : 0;
    const days = all.length ? Math.round((maxD - minD) / DAYMS) + 1 : 1;
    $('#fh-range').textContent = all.length ? `${jdot(minD)} تا ${jdot(maxD)}` : 'بدون داده';
    const expCat = [...sumBy(exp, t => t.category)].sort((a, b) => b[1] - a[1]);
    const incCat = [...sumBy(inc, t => t.category)].sort((a, b) => b[1] - a[1]);
    const biggest = exp.slice().sort((a, b) => b.amount - a.amount)[0];
    const save = tIn ? net / tIn * 100 : 0;
    /* compare last month in the current filter with the one before it */
    const lastM = months.length ? months[months.length - 1] : 0, prevM = months.length > 1 ? months[months.length - 2] : 0;
    const netOf = k => all.filter(t => { const [y, m] = toJ(t.date); return y * 100 + m === k; }).reduce((s, t) => s + (t.type === 'in' ? t.amount : -t.amount), 0);
    const lastNet = lastM ? netOf(lastM) : 0, prevNet = prevM ? netOf(prevM) : 0;
    const mom = prevM ? (lastNet - prevNet) : 0;
    const momTxt = prevM ? (`نسبت به ماه قبل: ${mom >= 0 ? '+' : '−'}${fmtShort(Math.abs(mom))}`) : 'ماه قبلی در این بازه نیست';
    const usdK = toman => {
      const r = currentRate();
      if (!r) return '';
      return `<div class="k-usd est" title="معادل برآوردی با نرخ دستی جاری">≈ ${fmtUsd(usdOf(toman, r))} <small>برآوردی</small></div>`;
    };
    const usdLockedNet = () => {
      let locked = 0, nLock = 0, est = 0;
      all.forEach(t => {
        const u = usdFor(t);
        if (u.usd == null) return;
        const s = t.type === 'in' ? u.usd : -u.usd;
        if (u.locked) { locked += s; nLock++; } else est += s;
      });
      if (nLock) return `<div class="k-usd" title="جمع معادل دلاری قفل‌شده، بدون تبدیل دوباره با نرخ امروز">قفل‌شده: ${fmtUsd(locked)}${est ? ` · برآوردیِ بقیه: ${fmtUsd(est)}` : ''}</div>`;
      return usdK(net);
    };
    const kpi = (cls, ic, label, val, sub, usd) => `<div class="kpi ${cls}"><span class="k-ic">${ic}</span><div class="k-l">${label}</div><div class="k-v">${val}</div>${usd || ''}<div class="k-s">${sub}</div></div>`;
    $('#fin-kpis').innerHTML = [
      kpi('k-in', '↗', 'کل درآمد', fmtShort(tIn), `${fmt(tIn)} · ${fmt(inc.length)} تراکنش`, usdK(tIn)),
      kpi('k-out', '↘', 'کل هزینه', fmtShort(tOut), `${fmt(tOut)} · ${fmt(exp.length)} تراکنش`, usdK(tOut)),
      kpi('k-net ' + (net < 0 ? 'neg' : ''), '⚖', 'خالص / مانده', fmtShort(net), `${`نرخ پس‌انداز ${pct(save)}`} · ${momTxt}`, usdLockedNet()),
      kpi('k-avg', '∅', 'میانگین درآمد ماهانه', fmtShort(tIn / nM), `میانگین هزینه ${fmtShort(tOut / nM)} · ${fmt(nM)} ماه`, usdK(tIn / nM)),
      kpi('k-top', '★', 'بیشترین دسته هزینه', expCat[0] ? esc(expCat[0][0]) : '—', expCat[0] ? `${fmtShort(expCat[0][1])} · ${pct(expCat[0][1] / tOut * 100)} از کل` : '', expCat[0] ? usdK(expCat[0][1]) : ''),
      kpi('k-big', '◆', 'بزرگ‌ترین هزینه', biggest ? fmtShort(biggest.amount) : '—', biggest ? `${esc(biggest.desc.slice(0, 28))} · ${jdot(biggest.date)}` : '', biggest ? usdHtml(biggest) : ''),
      kpi('k-day', '☀', 'میانگین هزینه روزانه', fmtShort(tOut / days), `در ${fmt(days)} روز`, usdK(tOut / days)),
      kpi('k-src', '⛁', 'منبع اصلی درآمد', incCat[0] ? esc(incCat[0][0]) : '—', incCat[0] ? `${pct(incCat[0][1] / tIn * 100)} از درآمد` : '', incCat[0] ? usdK(incCat[0][1]) : ''),
    ].join('');
    if (!window.Chart) { $$('.cv').forEach(c => c.innerHTML = '<div class="empty">Chart.js بارگذاری نشد</div>'); }
    else drawCharts(all, list, months, expCat, incCat);
    insights(all, months, expCat, tIn, tOut);
    tables(list, exp, inc, tOut, tIn);
    paintMarkets();
    paintBudgets(allRaw);
    paintReports(allRaw);
    paintSubs();
    paintExtraFin(allRaw);
  }

  function baseOpts(extra = {}) {
    return Object.assign({
      responsive: true, maintainAspectRatio: false, animation: { duration: 400, easing: 'easeOutQuart' },
      plugins: { legend: { labels: { color: '#cfd6ee', font: { family: 'Vazirmatn', size: 12 }, usePointStyle: true, boxWidth: 8 }, rtl: true },
        tooltip: { rtl: true, textDirection: 'rtl', backgroundColor: 'rgba(8,10,24,.95)', borderColor: 'rgba(245,197,90,.5)', borderWidth: 1, titleFont: { family: 'Vazirmatn' }, bodyFont: { family: 'Vazirmatn' }, padding: 10,
          callbacks: { label: c => ` ${c.dataset.label || c.label}: ${fmt(c.parsed.y ?? c.parsed.x ?? c.parsed)}` } } },
      scales: {
        x: { ticks: { color: '#8f9bc4', font: { family: 'Vazirmatn', size: 11 } }, grid: { color: 'rgba(255,255,255,.04)' } },
        y: { ticks: { color: '#8f9bc4', font: { family: 'Vazirmatn', size: 11 }, callback: v => fmtShort(v) }, grid: { color: 'rgba(255,255,255,.06)' } }
      }
    }, extra);
  }
  const grad = (ctx, c1, c2) => { const g = ctx.createLinearGradient(0, 0, 0, ctx.canvas.clientHeight || 300); g.addColorStop(0, c1); g.addColorStop(1, c2); return g; };

  function drawCharts(all, list, months, expCat, incCat) {
    Chart.defaults.font.family = 'Vazirmatn';
    const mk = (id, cfg) => { const el = document.getElementById(id); if (!el) return; charts.push(new Chart(el, cfg)); };
    const mLabel = k => `${MONTHS[k % 100 - 1]} ${String(Math.floor(k / 100)).slice(2).replace(/\d/g, d => FA[d])}`;
    const mKey = t => { const [y, m] = toJ(t.date); return y * 100 + m; };
    const inM = sumBy(all.filter(t => t.type === 'in'), mKey), outM = sumBy(all.filter(t => t.type === 'out'), mKey);
    const showIn = FS.type !== 'out', showOut = FS.type !== 'in';
    const c1 = document.getElementById('ch-month').getContext('2d');
    mk('ch-month', { type: 'bar', data: { labels: months.map(mLabel), datasets: [
      showIn && { label: 'درآمد', data: months.map(k => inM.get(k) || 0), backgroundColor: grad(c1, 'rgba(31,224,160,.95)', 'rgba(31,224,160,.15)'), borderColor: C.in, borderWidth: 1, borderRadius: 8, maxBarThickness: 42 },
      showOut && { label: 'هزینه', data: months.map(k => outM.get(k) || 0), backgroundColor: grad(c1, 'rgba(255,77,109,.95)', 'rgba(255,77,109,.15)'), borderColor: C.out, borderWidth: 1, borderRadius: 8, maxBarThickness: 42 },
      { type: 'line', label: 'خالص', data: months.map(k => (inM.get(k) || 0) - (outM.get(k) || 0)), borderColor: C.net, backgroundColor: C.net, tension: .35, pointRadius: 4, pointHoverRadius: 7, borderWidth: 2.5 }
    ].filter(Boolean) }, options: baseOpts() });

    // cumulative balance
    const sorted = all.slice().sort(byTime); const byDay = new Map();
    const realBal = sorted.length && sorted.every(t => t.bal != null); // statement rows carry the bank's own balance-after
    let run = 0; sorted.forEach(t => { run += t.type === 'in' ? t.amount : -t.amount; byDay.set(jdot(t.date), realBal ? t.bal : run); });
    const bt = document.getElementById('bal-title'); if (bt) bt.innerHTML = realBal ? 'مانده واقعی حساب<small>مانده پایان هر روز طبق صورت‌حساب بانک</small>' : 'روند مانده (تجمعی)<small>درآمد منهای هزینه در طول زمان</small>';
    const c2 = document.getElementById('ch-bal').getContext('2d');
    mk('ch-bal', { type: 'line', data: { labels: [...byDay.keys()], datasets: [{ label: realBal ? 'مانده حساب' : 'مانده تجمعی', data: [...byDay.values()], borderColor: C.net, borderWidth: 2.5, fill: true, backgroundColor: grad(c2, 'rgba(245,197,90,.45)', 'rgba(245,197,90,0)'), tension: .3, pointRadius: 0, pointHoverRadius: 5 }] },
      options: baseOpts({ plugins: { legend: { display: false }, tooltip: baseOpts().plugins.tooltip }, scales: { x: { ticks: { color: '#8f9bc4', maxTicksLimit: 10, font: { family: 'Vazirmatn', size: 10 } }, grid: { display: false } }, y: baseOpts().scales.y } }) });

    // donut
    const donutData = FS.type === 'in' ? incCat : expCat;
    $('#donut-title').textContent = FS.type === 'in' ? 'سهم منابع درآمد' : 'سهم دسته‌های هزینه';
    const top = donutData.slice(0, 8); const rest = donutData.slice(8).reduce((a, x) => a + x[1], 0); if (rest) top.push(['سایر', rest]);
    mk('ch-donut', { type: 'doughnut', data: { labels: top.map(x => x[0]), datasets: [{ data: top.map(x => x[1]), backgroundColor: PALETTE, borderColor: '#070912', borderWidth: 3, hoverOffset: 14 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '64%', plugins: { legend: { position: 'bottom', rtl: true, labels: { color: '#cfd6ee', font: { family: 'Vazirmatn', size: 11 }, usePointStyle: true, boxWidth: 8, padding: 10 } }, tooltip: { rtl: true, bodyFont: { family: 'Vazirmatn' }, callbacks: { label: c => ` ${c.label}: ${fmt(c.parsed)} (${pct(c.parsed / c.dataset.data.reduce((a, b) => a + b, 0) * 100)})` } } } } });

    // weekday pattern (average per weekday occurrence)
    const wkList = FS.type === 'in' ? all.filter(t => t.type === 'in') : all.filter(t => t.type === 'out');
    const wsum = Array(7).fill(0), wdays = Array(7).fill(0);
    if (all.length) { const min = Math.min(...all.map(t => t.date)), max = Math.max(...all.map(t => t.date)); for (let d = noon(min); d <= max; d += DAYMS) wdays[weekdayIdx(d)]++; }
    wkList.forEach(t => wsum[weekdayIdx(t.date)] += t.amount);
    const wavg = wsum.map((s, i) => wdays[i] ? s / wdays[i] : 0); const wmax = Math.max(...wavg);
    mk('ch-week', { type: 'bar', data: { labels: WEEK, datasets: [{ label: FS.type === 'in' ? 'میانگین درآمد' : 'میانگین هزینه', data: wavg, backgroundColor: wavg.map(v => v === wmax ? (FS.type === 'in' ? C.in : C.out) : 'rgba(79,140,255,.55)'), borderRadius: 7 }] }, options: baseOpts({ plugins: { legend: { display: false }, tooltip: baseOpts().plugins.tooltip } }) });

    // top expense categories (horizontal)
    const t10 = (FS.type === 'in' ? incCat : expCat).slice(0, 10);
    mk('ch-top', { type: 'bar', data: { labels: t10.map(x => x[0]), datasets: [{ label: 'جمع', data: t10.map(x => x[1]), backgroundColor: t10.map((_, i) => PALETTE[i % PALETTE.length] + 'cc'), borderRadius: 6 }] },
      options: baseOpts({ indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { rtl: true, bodyFont: { family: 'Vazirmatn' }, callbacks: { label: c => ' ' + fmt(c.parsed.x) } } }, scales: { x: { position: 'top', ticks: { color: '#8f9bc4', callback: v => fmtShort(v), font: { family: 'Vazirmatn', size: 10 } }, grid: { color: 'rgba(255,255,255,.05)' }, reverse: true }, y: { position: 'right', ticks: { color: '#dfe5ff', font: { family: 'Vazirmatn', size: 12 } }, grid: { display: false } } } }) });

    // daily
    const dIn = sumBy(all.filter(t => t.type === 'in'), t => noon(t.date)), dOut = sumBy(all.filter(t => t.type === 'out'), t => noon(t.date));
    const dk = [...new Set([...dIn.keys(), ...dOut.keys()])].sort((a, b) => a - b);
    if (dk.length > 1 && (dk[dk.length - 1] - dk[0]) / DAYMS < 800) { const full = []; for (let k = dk[0]; k <= dk[dk.length - 1] + 3600e3; k = noon(k + DAYMS)) full.push(k); dk.splice(0, dk.length, ...full); }
    const c3 = document.getElementById('ch-daily').getContext('2d');
    mk('ch-daily', { type: 'line', data: { labels: dk.map(jdot), datasets: [
      showIn && { label: 'درآمد روزانه', data: dk.map(k => dIn.get(k) || 0), borderColor: C.in, backgroundColor: grad(c3, 'rgba(31,224,160,.3)', 'rgba(31,224,160,0)'), fill: true, tension: .25, pointRadius: 0, borderWidth: 1.8 },
      showOut && { label: 'هزینه روزانه', data: dk.map(k => dOut.get(k) || 0), borderColor: C.out, backgroundColor: grad(c3, 'rgba(255,77,109,.3)', 'rgba(255,77,109,0)'), fill: true, tension: .25, pointRadius: 0, borderWidth: 1.8 }
    ].filter(Boolean) }, options: baseOpts({ scales: { x: { ticks: { color: '#8f9bc4', maxTicksLimit: 14, font: { family: 'Vazirmatn', size: 10 } }, grid: { display: false } }, y: baseOpts().scales.y } }) });
  }


  function paintMarkets() {
    const box = document.getElementById('fx-markets'); if (!box) return;
    ensureP2(F);
    const usdR = currentRate();
    box.innerHTML = `<div class="fc-h"><span class="fc-dot" style="--c:${C.net}"></span>بازارها (نرخ دستی آفلاین)<small>بدون اتصال زنده — هر کارت را دستی وارد کن</small></div>
      <div class="fx-cards">${F.fx.markets.map(m => {
        const tomanEq = (m.unit === 'دلار' && usdR && m.value) ? roundToman(m.value * usdR) : null;
        return `<div class="fx-card" data-mk="${m.id}">
          <div class="fx-ic">${m.icon}</div>
          <div class="fx-nm">${esc(m.name)}</div>
          <div class="fx-un">${esc(m.unit)}</div>
          <input class="ltr fx-val" data-mk="${m.id}" inputmode="decimal" placeholder="—" value="${m.value != null ? esc(String(m.value)) : ''}">
          <div class="fx-at">${m.at ? jdot(m.at) : 'تاریخ ندارد'} · ${esc(m.source || 'دستی')}</div>
          ${tomanEq != null ? `<div class="fx-eq">≈ ${fmt(tomanEq)} تومان <small>محاسبه‌شده</small></div>` : ''}
        </div>`;
      }).join('')}</div>`;
    box.querySelectorAll('.fx-val').forEach(inp => {
      inp.addEventListener('change', () => {
        if (!inp.value.trim()) return;
        const r = setMarket(inp.dataset.mk, inp.value);
        if (!r.ok) { window.SFX && SFX.error(); toast(r.err); return; }
        window.SFX && SFX.save && SFX.save(); toast('نرخ «' + inp.dataset.mk + '» ثبت شد', 'ok');
        render(document.getElementById('view'));
      });
    });
  }
  function paintBudgets(allRaw) {
    const box = document.getElementById('fin-budgets'); if (!box) return;
    ensureP2(F);
    const [cy, cm] = toJ(Date.now());
    const jy = FS.year !== 'all' ? +FS.year : cy;
    const jm = FS.month !== 'all' ? +FS.month : cm;
    const domain = (FS.domain === 'personal' || FS.domain === 'company') ? FS.domain : 'all';
    const rows = F.budgets.filter(b => b.jy === jy && b.jm === jm && (domain === 'all' || (b.domain || 'all') === domain || (b.domain || 'all') === 'all'));
    const list = (allRaw || F.tx).map(t => t); // already dispTx if from filtered
    const src = allRaw || F.tx;
    const body = rows.map(b => {
      const p = budgetProgress(b, src);
      const w = Math.min(100, Math.round(p.ratio * 1000) / 10);
      return `<div class="bud-row ${p.alert}" data-bud="${b.id}">
        <div class="bud-cat">${esc(b.category)}${b.domain && b.domain !== 'all' ? ` <small>${b.domain === 'company' ? 'شرکت' : 'شخصی'}</small>` : ''}</div>
        <div class="bud-bar"><i style="width:${w}%"></i></div>
        <div class="bud-meta"><span>${fmtShort(dispAmt(p.spent))} از ${fmtShort(dispAmt(b.amount))}</span><span>${pct(p.ratio * 100)}</span>${p.msg ? `<b class="bud-al">${p.msg}</b>` : ''}</div>
        <button type="button" class="x-del" data-delbud="${b.id}" title="حذف بودجه">✕</button>
      </div>`;
    }).join('') || '<div class="empty">برای این ماه بودجه‌ای ثبت نشده.</div>';
    const catOpts = [...new Set([...(F.catList.personal || []), ...(F.catList.company || []), ...F.tx.map(t => t.category)])].filter(Boolean);
    box.innerHTML = `<div class="fc-h"><span class="fc-dot" style="--c:${C.out}"></span>بودجه در برابر عملکرد<small>${periodLabel(jy, jm)} · هشدار ۸۰٪ و ۱۰۰٪</small></div>
      <div class="bud-add">
        <input id="bud-cat" list="bud-cats" placeholder="دسته">
        <datalist id="bud-cats">${catOpts.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
        <input id="bud-amt" class="ltr" inputmode="decimal" placeholder="سقف تومان">
        <select id="bud-dom"><option value="all">هر دو حوزه</option><option value="personal">شخصی</option><option value="company">شرکت</option></select>
        <button type="button" class="fin-chip" id="bud-go">ثبت بودجه</button>
      </div>
      <div class="bud-list">${body}</div>`;
    const go = document.getElementById('bud-go');
    if (go) go.onclick = () => {
      const typed = parseAmount($('#bud-amt').value);
      const r = setBudget({ jy, jm, category: $('#bud-cat').value, amount: typed != null ? typed / DISPLAY_TEST_MULTIPLIER : 0, domain: $('#bud-dom').value });
      if (!r.ok) { window.SFX && SFX.error(); toast(r.err || 'بودجه نامعتبر است'); return; }
      window.SFX && SFX.save && SFX.save(); toast('بودجه ثبت شد ✓', 'ok'); paintBudgets(src);
    };
    box.querySelectorAll('[data-delbud]').forEach(b => b.onclick = () => {
      F.budgets = F.budgets.filter(x => x.id !== b.dataset.delbud); saveF(); paintBudgets(src);
    });
  }
  function paintReports(allRaw) {
    const box = document.getElementById('fin-reports'); if (!box) return;
    const src = cashRows(allRaw || filtered({ ignoreType: true }));
    const monthly = monthRows(src);
    const cats = catRows(src);
    const histLocked = src.filter(t => t.rateLocked && t.usd != null).reduce((s, t) => s + (t.type === 'in' ? t.usd : -t.usd), 0);
    const nLock = src.filter(t => t.rateLocked && t.usd != null).length;
    box.innerHTML = `<div class="fc-h"><span class="fc-dot" style="--c:${C.blue}"></span>گزارش‌های مالی<small>ماهانه و دسته‌ای · خروجی CSV / Excel / چاپ</small></div>
      <div class="rep-usd">${nLock ? `نمای دلاری تاریخی (جمع معادل قفل‌شده، بدون تبدیل با نرخ امروز): <b>${fmtUsd(histLocked)}</b> · ${fmt(nLock)} تراکنش` : 'هنوز تراکنش قفل‌شده‌ای نیست؛ پس از ثبت نرخ، تراکنش‌های جدید معادل ثابت می‌گیرند.'}</div>
      <div class="rep-tabs fin-seg" id="rep-kind"><button type="button" data-v="monthly" class="on">ماهانه</button><button type="button" data-v="category">دسته‌ای</button></div>
      <div id="rep-table"></div>
      <div class="rep-actions">
        <button type="button" class="fin-chip" id="rep-csv">خروجی CSV</button>
        <button type="button" class="fin-chip" id="rep-xlsx">خروجی Excel</button>
        <button type="button" class="fin-chip" id="rep-print">چاپ / PDF</button>
        <button type="button" class="fin-chip" id="rep-arch">بایگانی در پورتال</button>
        <span class="fx-meta" id="rep-arch-n">${(F.reports || []).length ? fmt(F.reports.length) + ' گزارش بایگانی‌شده' : ''}</span>
      </div>`;
    let kind = 'monthly';
    const draw = () => {
      const rows = kind === 'monthly' ? monthly : cats;
      if (kind === 'monthly') {
        $('#rep-table').innerHTML = rows.length ? `<table class="ftab" id="rep-ftab"><thead><tr><th>ماه</th><th>درآمد</th><th>هزینه</th><th>خالص</th><th>معادل دلار قفل‌شده</th></tr></thead><tbody>${rows.map(r => `<tr><td>${periodLabel(r.jy, r.jm)}</td><td class="amt in">${fmt(r.inn)}</td><td class="amt out">${fmt(r.out)}</td><td class="amt">${fmt(r.net)}</td><td class="k-usd">${r.usdNetLocked ? fmtUsd(r.usdNetLocked) : '—'}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">داده‌ای در این بازه نیست.</div>';
      } else {
        $('#rep-table').innerHTML = rows.length ? `<table class="ftab" id="rep-ftab"><thead><tr><th>دسته</th><th>نوع</th><th>تعداد</th><th>جمع</th><th>معادل دلار قفل‌شده</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.category)}</td><td>${r.type === 'in' ? 'درآمد' : 'هزینه'}</td><td class="n">${fmt(r.n)}</td><td class="amt ${r.type}">${fmt(r.amount)}</td><td class="k-usd">${r.usdLocked ? fmtUsd(r.usdLocked) : '—'}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">داده‌ای در این بازه نیست.</div>';
      }
    };
    draw();
    $('#rep-kind').onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; kind = b.dataset.v; $$('#rep-kind button').forEach(x => x.classList.toggle('on', x === b)); draw(); };
    const rowsNow = () => kind === 'monthly' ? monthly : cats;
    $('#rep-csv').onclick = () => { downloadText(kind === 'monthly' ? 'گزارش-ماهانه.csv' : 'گزارش-دسته.csv', reportCsv(kind, rowsNow()), 'text/csv;charset=utf-8'); toast('CSV آماده شد', 'ok'); };
    $('#rep-xlsx').onclick = () => { reportXlsx(kind, rowsNow()).then(() => toast('Excel آماده شد', 'ok')).catch(() => toast('خروجی Excel در دسترس نیست')); };
    $('#rep-print').onclick = () => {
      const html = `<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><title>گزارش مالی</title><style>body{font-family:Tahoma,sans-serif;padding:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px 8px;text-align:right}h1{font-size:18px}</style><h1>${kind === 'monthly' ? 'گزارش ماهانه' : 'گزارش دسته‌ای'}</h1>${$('#rep-table').innerHTML}</html>`;
      const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); }
      else downloadText(kind === 'monthly' ? 'گزارش-ماهانه.html' : 'گزارش-دسته.html', html, 'text/html;charset=utf-8');
    };
    $('#rep-arch').onclick = () => { archiveReport(kind, rowsNow()); toast('گزارش در پورتال بایگانی شد ✓', 'ok'); $('#rep-arch-n').textContent = fmt(F.reports.length) + ' گزارش بایگانی‌شده'; };
  }
  function catsModal() {
    ensureP2(F);
    const list = (dom) => (F.catList[dom] || []).map((c, i) => `<li>${esc(c)} <button type="button" class="x-del" data-delc="${dom}:${i}">✕</button></li>`).join('');
    const m = openModal(`<div class="fin-modal-in"><h3>دسته‌های قابل ویرایش</h3>
      <div class="cat-cols"><div><h4>شخصی</h4><ul id="cl-personal">${list('personal')}</ul><div class="bud-add"><input id="nc-p" placeholder="دسته جدید"><button type="button" class="fin-chip" id="add-p">افزودن</button></div></div>
      <div><h4>شرکت</h4><ul id="cl-company">${list('company')}</ul><div class="bud-add"><input id="nc-c" placeholder="دسته جدید"><button type="button" class="fin-chip" id="add-c">افزودن</button></div></div></div>
      <div class="form-actions"><button type="button" class="btn ghost" data-close>بستن</button></div></div>`, 'fin-modal');
    const refresh = () => { $('#cl-personal', m).innerHTML = list('personal'); $('#cl-company', m).innerHTML = list('company'); };
    m.addEventListener('click', e => {
      if (e.target.id === 'add-p') { addCat('personal', $('#nc-p', m).value); $('#nc-p', m).value = ''; refresh(); }
      if (e.target.id === 'add-c') { addCat('company', $('#nc-c', m).value); $('#nc-c', m).value = ''; refresh(); }
      const del = e.target.closest('[data-delc]');
      if (del) { const [d, i] = del.dataset.delc.split(':'); F.catList[d].splice(+i, 1); saveF(); refresh(); }
    });
  }

  function insights(all, months, expCat, tIn, tOut) {
    const li = [];
    if (!all.length) { $('#fin-ins').innerHTML = '<li>داده‌ای در این بازه نیست.</li>'; return; }
    const mk = t => { const [y, m] = toJ(t.date); return y * 100 + m; };
    const outM = sumBy(all.filter(t => t.type === 'out'), mk), inM = sumBy(all.filter(t => t.type === 'in'), mk);
    const name = k => `${MONTHS[k % 100 - 1]} ${fmt(Math.floor(k / 100)).replace(/٬/g, '')}`;
    if (outM.size) { const [k, v] = [...outM].sort((a, b) => b[1] - a[1])[0]; li.push(`<li><b class="r">پرهزینه‌ترین ماه:</b> ${name(k)} با ${fmtShort(v)}</li>`); }
    if (inM.size) { const [k, v] = [...inM].sort((a, b) => b[1] - a[1])[0]; li.push(`<li><b class="g">پردرآمدترین ماه:</b> ${name(k)} با ${fmtShort(v)}</li>`); }
    if (months.length >= 2) {
      const a = months[months.length - 1], b = months[months.length - 2];
      const ca = outM.get(a) || 0, cb = outM.get(b) || 0;
      if (cb) { const d = (ca - cb) / cb * 100; li.push(`<li><b class="${d > 0 ? 'r' : 'g'}">هزینه ${MONTHS[a % 100 - 1]}</b> نسبت به ${MONTHS[b % 100 - 1]}: ${d > 0 ? '▲' : '▼'} ${pct(Math.abs(d))}${months[months.length - 1] === (() => { const [y, m] = toJ(Date.now()); return y * 100 + m; })() ? ' <small>(ماه جاری هنوز تمام نشده)</small>' : ''}</li>`); }
    }
    if (tIn) li.push(`<li><b class="y">نرخ پس‌انداز:</b> ${pct((tIn - tOut) / tIn * 100)} — ${tIn >= tOut ? 'درآمد بیشتر از هزینه است ✓' : 'هزینه از درآمد بیشتر است ⚠'}</li>`);
    if (expCat.length >= 3) { const s3 = expCat.slice(0, 3).reduce((a, x) => a + x[1], 0); li.push(`<li><b class="b">۳ دسته اول</b> (${expCat.slice(0, 3).map(x => esc(x[0])).join('، ')}) ${pct(s3 / tOut * 100)} کل هزینه‌اند</li>`); }
    const sum = l => l.reduce((a, t) => a + t.amount, 0);
    const top = (l, key) => { const g = new Map(); l.forEach(t => { const k = key(t); if (!k) return; const v = g.get(k) || [0, 0]; v[0] += t.amount; v[1]++; g.set(k, v); }); return [...g].sort((a, b) => b[1][0] - a[1][0])[0]; };
    const shop = all.filter(t => t.type === 'out' && t.merchant && !/^(پایانه|پذیرنده بی‌نام|پرداخت الکترونیک)/.test(t.merchant));
    const tm = top(shop, t => t.merchant); if (tm) li.push(`<li><b class="r">بیشترین خرید از:</b> ${esc(tm[0])} — ${fmt(tm[1][1])} خرید، ${fmtShort(tm[1][0])}</li>`);
    const tp = top(all.filter(t => t.type === 'out' && t.party && t.category === 'انتقال به اشخاص'), t => t.party); if (tp) li.push(`<li><b class="r">بیشترین انتقال به:</b> ${esc(tp[0])} — ${fmt(tp[1][1])} بار، ${fmtShort(tp[1][0])}</li>`);
    const td = top(all.filter(t => t.type === 'in' && t.category === 'واریز از سپرده اشخاص'), t => (t.desc.match(/^واریز از (.+?)( —|$)/) || [])[1]); if (td) li.push(`<li><b class="g">بیشترین واریز از:</b> ${esc(td[0])} — ${fmt(td[1][1])} بار، ${fmtShort(td[1][0])}</li>`);
    const loanIn = sum(all.filter(t => t.category === 'دریافت تسهیلات (وام)')), loanOut = sum(all.filter(t => t.category === 'اقساط و تسویه وام')), fee = all.filter(t => t.category === 'کارمزدهای بانکی');
    if (loanIn || loanOut) li.push(`<li><b class="y">تسهیلات:</b> دریافت ${fmtShort(loanIn)} · قسط و تسویه ${fmtShort(loanOut)}</li>`);
    if (fee.length) li.push(`<li><b class="v">کارمزدهای بانکی:</b> ${fmt(fee.length)} مورد، جمعاً ${fmt(sum(fee))} ${esc(F.unit || 'تومان')}</li>`);
    const lastB = all.slice().sort(byTime).reverse().find(t => t.bal != null); if (lastB) li.push(`<li><b class="y">مانده حساب در ${jdot(lastB.date)}:</b> ${fmt(lastB.bal)} ${esc(F.unit || 'تومان')} (طبق صورت‌حساب)</li>`);
    $('#fin-ins').innerHTML = li.join('');
  }

  const typeTag = t => `<span class="tt ${t.type}">${t.type === 'in' ? 'درآمد' : 'هزینه'}</span>`;
  const amt = t => `<span class="amt-wrap"><span class="amt ${t.type}">${t.type === 'in' ? '+' : '−'}${fmt(t.amount)}</span>${usdHtml(t)}</span>`;
  const sampleTag = t => t.sample ? '<span class="smp">آزمایشی</span>' : '';
  function tables(list, exp, inc, tOut, tIn) {
    const big = list.slice().sort((a, b) => b.amount - a.amount).slice(0, 10);
    $('#t-big').innerHTML = big.length ? `<table class="ftab"><thead><tr><th>#</th><th>تاریخ</th><th>شرح</th><th>دسته</th><th>مبلغ</th></tr></thead><tbody>${big.map((t, i) => `<tr><td class="n">${fmt(i + 1)}</td><td class="d">${jdot(t.date)}</td><td>${esc(t.desc)} ${sampleTag(t)}</td><td><span class="cat-pill" data-cat="${esc(t.category)}">${esc(t.category)}</span></td><td>${amt(t)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">—</div>';
    const cats = [...sumBy(list, t => t.type + '|' + t.category)].map(([k, v]) => { const [type, name] = k.split('|'); const n = list.filter(t => t.type === type && t.category === name).length; return { type, name, v, n }; }).sort((a, b) => (a.type === b.type ? b.v - a.v : a.type === 'out' ? -1 : 1));
    $('#t-cat').innerHTML = cats.length ? `<table class="ftab"><thead><tr><th>دسته</th><th>تعداد</th><th>جمع</th><th>سهم</th><th>میانگین</th></tr></thead><tbody>${cats.map(c => { const share = c.v / ((c.type === 'out' ? tOut : tIn) || 1) * 100; return `<tr><td><span class="cat-pill ${c.type}" data-cat="${esc(c.name)}">${esc(c.name)}</span></td><td class="n">${fmt(c.n)}</td><td><span class="amt ${c.type}">${fmt(c.v)}</span></td><td><div class="share"><i style="--w:${Math.min(100, share)}%;--c:${c.type === 'in' ? C.in : C.out}"></i><span>${pct(share)}</span></div></td><td class="n">${fmtShort(c.v / c.n)}</td></tr>`; }).join('')}</tbody></table>` : '<div class="empty">—</div>';
    paintRecent(list);
  }
  function paintRecent(list) {
    const rec = list.slice().sort((a, b) => b.date - a.date);
    $('#t-recent-n').textContent = `${fmt(Math.min(recentN, rec.length))} از ${fmt(rec.length)} تراکنش`;
    $('#t-more').style.display = rec.length > recentN ? '' : 'none';
    const rows = rec.slice(0, recentN).map(t => `<tr${t.review ? ' class="need-review"' : ''}><td class="d">${jdot(t.date)}</td><td class="dim">${WEEK[weekdayIdx(t.date)]}</td><td>${esc(t.desc)} ${sampleTag(t)}</td><td><span class="cat-pill ${t.type}" data-cat="${esc(t.category)}">${esc(t.category)}</span>${t.review ? ' <small class="need">نیازمند بررسی</small>' : ''}</td><td>${typeTag(t)}</td><td>${amt(t)}</td><td class="dim">${esc(t.source || '')}</td><td><button class="x-del" data-deltx="${t.id}" title="حذف">✕</button></td></tr>`).join('');
    $('#t-recent').innerHTML = `<table class="ftab" id="ftab-recent"><thead><tr><th>تاریخ</th><th>روز</th><th>شرح</th><th>دسته</th><th>نوع</th><th>مبلغ</th><th>منبع</th><th></th></tr></thead><tbody>${rows}
      <tr class="tx-add"><td><input id="txa-date" class="ltr" placeholder="1405/08/20"></td><td></td><td><input id="txa-desc" placeholder="شرح"></td><td><input id="txa-cat" placeholder="دسته"></td><td><select id="txa-type"><option value="out">هزینه</option><option value="in">درآمد</option></select></td><td><input id="txa-amt" class="ltr" inputmode="decimal" placeholder="مبلغ"></td><td><input id="txa-src" placeholder="منبع"></td><td><button type="button" class="fin-chip" id="txa-go">ثبت</button></td></tr>
    </tbody></table>`;
    const go = document.getElementById('txa-go');
    if (go) go.onclick = () => {
      const r = addManual({ date: $('#txa-date').value, desc: $('#txa-desc').value.trim(), category: $('#txa-cat').value.trim(), type: $('#txa-type').value, amount: $('#txa-amt').value, source: $('#txa-src').value.trim() || 'ورود دستی' });
      if (!r.ok) { window.SFX && SFX.error(); toast(r.err || 'تاریخ یا مبلغ نامعتبر است'); return; }
      window.SFX && SFX.cash(); toast('تراکنش ثبت شد ✓', 'ok'); render(document.getElementById('view'));
    };
  }

  function addManual(o) {
    o = o || {};
    if (o.type === 'xfer' || o.type === 'transfer') return addTransfer(o);
    const date = typeof o.date === 'number' ? o.date : (parseJInput(o.date) || (o.occurDate ? (typeof o.occurDate === 'number' ? o.occurDate : parseJInput(o.occurDate)) : (o.date ? undefined : Date.now())));
    let amount = typeof o.amount === 'number' ? o.amount : parseAmount(o.amount);
    const currency = o.currency === 'USD' ? 'USD' : 'IRR';
    if (currency === 'USD') {
      const usd = typeof o.usd === 'number' ? o.usd : parseAmount(o.usd != null ? o.usd : o.amount);
      if (!date || !usd) return { ok: false, err: 'تاریخ یا مبلغ نامعتبر است' };
      const info = o.rate ? { rate: +o.rate } : rateForDate(date);
      if (!info || !(info.rate > 0)) return { ok: false, err: 'برای مبلغ دلاری ابتدا نرخ دستی را ثبت کن' };
      amount = tomanOf(Math.abs(usd), info.rate);
      o.principal = Math.abs(usd);
      o.usd = Math.abs(usd);
    }
    if (!date || !amount) return { ok: false, err: 'تاریخ یا مبلغ نامعتبر است' };
    const type = o.type === 'in' ? 'in' : 'out';
    const desc = (o.desc || '').trim() || 'تراکنش';
    const gi = guessCatInfo(desc, type);
    const category = (o.category || '').trim() || gi.name;
    const row = { id: newId(), date, amount: Math.abs(amount), type, desc, category, source: o.source || 'ورود دستی', sample: !!o.sample, catConf: o.category ? 100 : gi.conf, review: !o.category && gi.review };
    attachFx(row, o);
    F.tx.push(row);
    F.tx.sort(byTime); saveF();
    return { ok: true, tx: row };
  }
  function addTransfer(o) {
    o = o || {};
    const date = typeof o.date === 'number' ? o.date : (parseJInput(o.date) || Date.now());
    const amount = typeof o.amount === 'number' ? o.amount : parseAmount(o.amount);
    if (!date || !amount) return { ok: false, err: 'تاریخ یا مبلغ نامعتبر است' };
    const from = o.fromDomain === 'company' ? 'company' : 'personal';
    const to = from === 'personal' ? 'company' : 'personal';
    const pair = newId();
    const desc = (o.desc || '').trim() || (from === 'personal' ? 'انتقال شخصی به شرکت' : 'انتقال شرکت به شخصی');
    const base = { date, amount: Math.abs(amount), category: 'انتقال شخصی ↔ شرکت', source: o.source || 'ورود دستی', sample: !!o.sample, kind: 'transfer', transferId: pair, project: o.project || '' };
    const a = attachFx(Object.assign({ id: newId(), type: 'out', desc, domain: from, account: o.account || '' }, base), o);
    const b = attachFx(Object.assign({ id: newId(), type: 'in', desc, domain: to, account: o.account || '' }, base), o);
    F.tx.push(a, b);
    F.tx.sort(byTime); saveF();
    return { ok: true, transferId: pair, tx: [a, b] };
  }

  /* ---------- upload: loaders ---------- */
  const loaded = {};
  // libs: inlined in the single-file build (window.__LIBS, base64) → executed from memory; multi-file build → <script src>
  function loadScript(src) {
    return loaded[src] || (loaded[src] = new Promise((res, rej) => {
      const s = document.createElement('script');
      const b64 = window.__LIBS && window.__LIBS[src];
      if (b64) { try { s.text = b64decode(b64); document.head.appendChild(s); document.head.removeChild(s); res(); } catch (e) { delete loaded[src]; rej(e); } return; }
      s.src = src; s.onload = res; s.onerror = () => { delete loaded[src]; rej(new Error('load ' + src)); }; document.head.appendChild(s);
    }));
  }
  function b64decode(b) { const bin = atob(b); const n = bin.length, u = new Uint8Array(n); for (let i = 0; i < n; i++) u[i] = bin.charCodeAt(i); return typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8').decode(u) : decodeURIComponent(escape(bin)); }
  async function needXLSX() { if (!window.XLSX) await loadScript('assets/lib/xlsx.full.min.js'); return window.XLSX; }
  let workerBlobUrl = null;
  async function needPDF() {
    if (!window.pdfjsLib) await loadScript('assets/lib/pdf.min.js');
    // worker as plain script → pdf.js falls back to an in-page "fake worker" (works on file:// and content:// too)
    if (!window.pdfjsWorker) await loadScript('assets/lib/pdf.worker.min.js');
    try {
      if (window.__LIBS && window.__LIBS['assets/lib/pdf.worker.min.js']) { // single-file build: worker from a Blob URL (falls back to the fake worker if the browser refuses it)
        if (!workerBlobUrl) workerBlobUrl = URL.createObjectURL(new Blob([b64decode(window.__LIBS['assets/lib/pdf.worker.min.js'])], { type: 'text/javascript' }));
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerBlobUrl;
      } else pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/lib/pdf.worker.min.js';
    } catch (e) { }
    return window.pdfjsLib;
  }

  /* ---------- parsing ---------- */
  function parseAmount(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    let s = normDigits(v).replace(/[٬،,\s]|ریال|تومان|IRR|IRT|rial|toman/gi, '').replace(/٫/g, '.');
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (/^-|-$|^−|−$/.test(s)) { neg = true; s = s.replace(/^[-−]|[-−]$/g, ''); }
    if (!/^\d+(\.\d+)?$/.test(s)) return null;
    const n = parseFloat(s); return neg ? -n : n;
  }
  function parseDate(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date && !isNaN(v)) return noon(v.getTime());
    if (typeof v === 'number') { if (v > 20000 && v < 80000) return noon(Math.round((v - 25569) * DAYMS) + new Date().getTimezoneOffset() * 6e4); if (v > 13000101 && v < 15001231) { const s = String(v); return fromJ(+s.slice(0, 4), +s.slice(4, 6), +s.slice(6, 8)); } return null; }
    const s = normDigits(v).trim();
    let m = s.match(/(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/);
    if (m) { const y = +m[1], mo = +m[2], d = +m[3]; if (y < 1700) return fromJ(y, mo, d); const g = new Date(y, mo - 1, d, 12); return isNaN(g) ? null : g.getTime(); }
    m = s.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/);
    if (m) { const y = +m[3], mo = +m[2], d = +m[1]; if (y < 1700) return fromJ(y, mo, d); const g = new Date(y, mo - 1, d, 12); return isNaN(g) ? null : g.getTime(); }
    m = s.match(/^(1[34]\d{2})(\d{2})(\d{2})$/); if (m) return fromJ(+m[1], +m[2], +m[3]);
    m = s.match(/(\d{2})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/); if (m && +m[1] >= 90) return fromJ(1300 + +m[1], +m[2], +m[3]); if (m && +m[1] < 30) return fromJ(1400 + +m[1], +m[2], +m[3]);
    return null;
  }
  const H = {
    date: /تاریخ|date|روز/i,
    desc: /شرح|توضیح|بابت|عنوان|description|desc|details|narration|memo|title|گیرنده|طرف/i,
    cat: /دسته|گروه|category|نوع هزینه/i,
    credit: /واریز|بستانکار|credit|deposit|income|درآمد|دریافت/i,
    debit: /برداشت|بدهکار|debit|withdraw|expense|هزینه|پرداخت/i,
    amount: /مبلغ|amount|value|sum|price|قیمت/i,
    type: /^نوع$|نوع تراکنش|type|ماهیت/i,
    balance: /مانده|موجودی|balance/i,
    ref: /شناسه تراکنش|شماره تراکنش|شماره پیگیری|کد پیگیری|کد رهگیری|شماره مرجع|reference|\bref\b|transaction ?id/i,
    time: /^(زمان|ساعت|time)$/i,
  };
  function detectHeader(rows, maxRows = 25) {
    for (let r = 0; r < Math.min(rows.length, maxRows); r++) {
      const cells = rows[r].map(c => normDigits(c).trim());
      const has = k => cells.findIndex(c => c && c.length < 40 && H[k].test(c));
      const map = { date: has('date') };
      if (map.date < 0) continue;
      map.balance = has('balance');
      const used = new Set([map.date, map.balance]);
      const find = k => { const i = cells.findIndex((c, j) => !used.has(j) && c && c.length < 40 && H[k].test(c)); if (i >= 0) used.add(i); return i; };
      map.after = -1; cells.forEach((c, j) => { if (c && c.length < 40 && /مانده|balance/i.test(c)) map.after = j; }); if (map.after === map.balance && cells.filter(c => /مانده|موجودی|balance/i.test(c)).length < 2) map.after = map.balance;
      map.ref = find('ref'); map.time = find('time');
      map.credit = find('credit'); map.debit = find('debit'); map.amount = find('amount'); map.type = find('type'); map.cat = find('cat'); map.desc = find('desc');
      if (map.credit >= 0 || map.debit >= 0 || map.amount >= 0) return { row: r, map };
    }
    return null;
  }
  function typeFromText(s) { s = normDigits(s); if (/واریز|بستانکار|credit|deposit|درآمد|income|دریافت|\bin\b|\+/i.test(s)) return 'in'; if (/برداشت|بدهکار|debit|withdraw|هزینه|expense|پرداخت|خرید|\bout\b|-/i.test(s)) return 'out'; return null; }
  function rowsToTx(rows, source) {
    rows = rows.filter(r => r && r.some(c => c !== '' && c != null));
    const out = []; const hd = detectHeader(rows);
    if (hd) {
      const { map } = hd;
      if (map.desc >= 0) HOLDER = holderFrom(rows.slice(hd.row + 1).map(r => String(r[map.desc] ?? ''))) || HOLDER;
      const known = knownMerchants(rows.slice(hd.row + 1).map(r => map.desc >= 0 ? String(r[map.desc] ?? '') : ''));
      const signed = map.amount >= 0 && rows.slice(hd.row + 1).some(r => (parseAmount(r[map.amount]) || 0) < 0);
      for (const r of rows.slice(hd.row + 1)) {
        const date = parseDate(r[map.date]); if (!date) continue;
        let desc = map.desc >= 0 ? String(r[map.desc] ?? '').trim() : '';
        if (!desc) desc = r.filter((c, j) => typeof c === 'string' && !Object.values(map).includes(j) && c.trim() && parseAmount(c) == null).join(' ').trim();
        const cr = map.credit >= 0 ? parseAmount(r[map.credit]) : null, db = map.debit >= 0 ? parseAmount(r[map.debit]) : null;
        let items = [];
        if (cr) items.push(['in', Math.abs(cr)]);
        if (db) items.push(['out', Math.abs(db)]);
        if (!items.length && map.amount >= 0) {
          const a = parseAmount(r[map.amount]); if (!a) continue;
          let type = map.type >= 0 ? typeFromText(r[map.type]) : null;
          if (!type) type = a < 0 ? 'out' : signed ? 'in' : (typeFromText(desc) || 'out');
          items.push([type, Math.abs(a)]);
        }
        const catRaw = map.cat >= 0 ? String(r[map.cat] ?? '').trim() : '';
        const ref = map.ref >= 0 ? normDigits(String(r[map.ref] ?? '')).replace(/\s+/g, '').trim() : '';
        const tm = map.time >= 0 ? (normDigits(String(r[map.time] ?? '')).match(/\d{1,2}:\d{2}(:\d{2})?/) || [''])[0] : '';
        const bal = map.after >= 0 ? parseAmount(r[map.after]) : null;
        items.forEach(([type, amount]) => { const td = tidyDesc(desc, type, known); const d = td.desc || (type === 'in' ? 'واریز' : 'برداشت');
          const gi = guessCatInfo(d, type); const t = { date, amount, type, desc: d, category: catRaw || td.cat || gi.name, source, catConf: (catRaw || td.cat) ? 100 : gi.conf, review: !!(!(catRaw || td.cat) && gi.review) }; if (ref) t.ref = ref; if (tm) t.time = tm; if (td.merchant) t.merchant = td.merchant; if (td.party) t.party = fixAr(td.party); if (bal != null) t.bal = bal; out.push(t); });
      }
      return { tx: out, how: 'ستون‌ها شناسایی شد: ' + Object.entries(hd.map).filter(([, v]) => v >= 0).map(([k]) => ({ date: 'تاریخ', desc: 'شرح', cat: 'دسته', credit: 'واریز', debit: 'برداشت', amount: 'مبلغ', type: 'نوع', balance: 'مانده', ref: 'شناسه', time: 'زمان', after: null }[k])).filter(Boolean).join('، ') };
    }
    // headerless fallback: date cell + first meaningful number
    for (const r of rows) {
      const di = r.findIndex(c => parseDate(c)); if (di < 0) continue;
      const nums = r.map((c, j) => j === di ? null : parseAmount(c)).map((n, j) => ({ n, j })).filter(x => x.n && Math.abs(x.n) >= 1000);
      if (!nums.length) continue;
      const desc = r.filter((c, j) => j !== di && typeof c === 'string' && parseAmount(c) == null).join(' ').trim();
      const a = nums[0].n; const type = a < 0 ? 'out' : (typeFromText(desc) || 'out');
      out.push((() => { const gi = guessCatInfo(desc, type); return { date: parseDate(r[di]), amount: Math.abs(a), type, desc: desc || 'تراکنش', category: gi.name, source, catConf: gi.conf, review: gi.review }; })());
    }
    return { tx: out, how: 'سربرگ پیدا نشد — تشخیص خودکار تاریخ و مبلغ' };
  }
  async function parseSheet(file) {
    const XLSX = await needXLSX();
    const buf = await file.arrayBuffer();
    const wb = /\.csv$/i.test(file.name) ? XLSX.read(new TextDecoder('utf-8').decode(buf), { type: 'string', cellDates: true, raw: false }) : XLSX.read(buf, { type: 'array', cellDates: true });
    let best = { tx: [], how: '' };
    for (const name of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '' });
      const r = rowsToTx(rows, file.name); if (r.tx.length > best.tx.length) best = Object.assign(r, { sheet: name });
    }
    return best;
  }
  async function parsePDF(file) {
    const lib = await needPDF();
    const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p); const tc = await page.getTextContent();
      const lines = [];
      tc.items.forEach(it => { if (!it.str || !it.str.trim()) return; const y = it.transform[5]; let L = lines.find(l => Math.abs(l.y - y) < 3.5); if (!L) lines.push(L = { y, toks: [] }); L.toks.push({ x: it.transform[4], w: it.width || 0, h: Math.abs(it.transform[3]) || it.height || 10, s: it.str, rtl: it.dir === 'rtl' || /[\u0600-\u06FF\uFB50-\uFEFF]/.test(it.str) }); });
      lines.sort((a, b) => b.y - a.y).forEach(l => { l.cells = lineCells(l.toks.slice()); l.strs = l.cells.map(c => c.s); });
      pages.push(lines);
      if (p % 10 === 0) await new Promise(r => setTimeout(r));
    }
    const pre = (pages[0] || []).slice(0, 40).map(l => l.strs.join(' ')).join(' ');
    const unitHint = /ریال|IRR|\brial\b/i.test(pre) ? 10 : /تومان|IRT|toman/i.test(pre) ? 1 : 0;
    const tb = pdfTable(pages);
    if (!tb) { // no table header — line-by-line fallback
      const r = rowsToTx(pages.flat().map(l => l.strs), file.name);
      return Object.assign(r, { unitHint, how: 'متن PDF استخراج شد (' + doc.numPages + ' صفحه) — ' + r.how });
    }
    const r = rowsToTx(tb.rows, file.name);
    // printed summary (e.g. «مجموع مبلغ تراکنش واریز») for automatic reconciliation
    const summary = pdfSummary(tb.footer);
    return Object.assign(r, { unitHint, summary, how: 'متن PDF استخراج شد (' + doc.numPages + ' صفحه، شرح‌های چندخطی ادغام شد) — ' + r.how });
  }
  const SUM_RE = /مجموع|جمع کل|پایان دوره|پایان گردش|شروع گردش|حداکثر مبلغ|حداقل مبلغ/;
  // Rebuild a bank-statement table from positioned PDF lines: per-page header → columns,
  // anchor lines (date + amount) = one transaction, wrapped description lines (above AND
  // below the anchor, possibly across a page break) are merged back into it.
  function pdfTable(pages) {
    let head = null, map = null, headStrs = null;
    const out = [], footer = []; let pending = [], last = null, ended = false;
    pages.forEach(lines => {
      const hd = detectHeader(lines.map(l => l.strs), 70);
      let start = 0;
      if (hd) { head = lines[hd.row].cells; map = hd.map; start = hd.row + 1; headStrs = headStrs || head.map(c => c.s); }
      if (!head || ended) { if (ended) footer.push(...lines); return; }
      const colOf = t => {
        const x0 = t.x, x1 = t.x + t.w; let best = -1, bo = 0;
        head.forEach((h, i) => { const o = Math.min(x1, h.x1) - Math.max(x0, h.x0); if (o > bo) { bo = o; best = i; } });
        if (best < 0) { let bd = Infinity; const cx = (x0 + x1) / 2; head.forEach((h, i) => { const d = Math.abs((h.x0 + h.x1) / 2 - cx); if (d < bd) { bd = d; best = i; } }); }
        return best;
      };
      const items = [];
      for (const l of lines.slice(start)) {
        if (SUM_RE.test(l.strs.join(' '))) { ended = true; footer.push(l); continue; }
        if (ended) { footer.push(l); continue; }
        const groups = head.map(() => []); l.toks.forEach(t => groups[colOf(t)].push(t));
        const a = groups.map(g => g.length ? cellText(g.sort((p, q) => p.x - q.x)) : '');
        const anchor = !!parseDate(a[map.date]) && [map.credit, map.debit, map.amount].some(i => i >= 0 && parseAmount(a[i]) != null);
        items.push({ y: l.y, a, anchor, cont: map.desc >= 0 ? a[map.desc] : '' });
      }
      if (!items.length) return;
      const diffs = items.slice(1).map((it, i) => items[i].y - it.y).sort((p, q) => p - q);
      const sp = diffs.length ? diffs[Math.floor(diffs.length / 2)] : 12;
      const clusters = [[items[0]]];
      items.slice(1).forEach((it, i) => { if (items[i].y - it.y > sp * 1.55) clusters.push([]); clusters[clusters.length - 1].push(it); });
      let seenAnchor = false;
      clusters.forEach(cl => {
        const anchors = cl.filter(it => it.anchor);
        if (!anchors.length) {
          const txt = cl.map(it => it.cont).filter(Boolean);
          if (!seenAnchor && last && !pending.length) last.parts.push(...txt.map((s, k) => ({ y: -1e6 - k, s }))); // tail of a row from previous page
          else pending.push(...txt);
          return;
        }
        seenAnchor = true;
        const rows = anchors.map(it => ({ a: it.a, parts: [{ y: it.y, s: it.cont }] }));
        // several rows touching: split by the widest gap, else symmetrically (anchor sits mid-block)
        const idx = anchors.map(an => cl.indexOf(an)); const add = (k, it) => it.cont && rows[k].parts.push({ y: it.y, s: it.cont });
        cl.slice(0, idx[0]).forEach(it => add(0, it));
        let ua = idx[0] + (pending.length ? pending.length : 0);
        for (let k = 0; k < idx.length; k++) {
          const nextI = k + 1 < idx.length ? idx[k + 1] : cl.length, betw = cl.slice(idx[k] + 1, nextI);
          if (k + 1 >= idx.length) { betw.forEach(it => add(k, it)); break; }
          const ys = [cl[idx[k]], ...betw, cl[nextI]].map(it => it.y); let gi = -1, gm = sp * 1.3;
          ys.slice(1).forEach((y, j) => { if (ys[j] - y > gm) { gm = ys[j] - y; gi = j; } });
          const take = gi >= 0 ? gi : Math.min(ua, betw.length);
          betw.forEach((it, j) => add(j < take ? k : k + 1, it));
          ua = betw.length - take;
        }
        rows.forEach((r, k) => { if (k === 0 && pending.length) { r.parts.push(...pending.map((s, j) => ({ y: 1e6 - j, s }))); pending = []; } out.push(r); });
        last = rows[rows.length - 1];
      });
    });
    if (!headStrs || !out.length) return null;
    const rows = out.map(r => { const a = r.a.slice(); if (map.desc >= 0) a[map.desc] = r.parts.sort((p, q) => q.y - p.y).map(p => p.s).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(); return a; });
    return { rows: [headStrs, ...rows], footer };
  }
  function pdfSummary(lines) {
    const S = {}, num = s => { const m = normDigits(s).match(/-?\d[\d,٬]*/g); return m ? m.map(x => parseAmount(x)) : []; };
    const K = [['inSum', /مجموع مبلغ (تراکنش )?(واریز|بستانکار)/], ['outSum', /مجموع مبلغ (تراکنش )?(برداشت|بدهکار)/], ['inN', /مجموع تعداد (تراکنش )?(واریز|بستانکار)/], ['outN', /مجموع تعداد (تراکنش )?(برداشت|بدهکار)/], ['open', /موجودی شروع|مانده (اول|ابتدای) دوره/], ['close', /مانده پایان گردش/]];
    lines.forEach(l => l.cells.forEach((c, i) => {
      for (const [k, re] of K) {
        if (S[k] != null || !re.test(c.s)) continue;
        let n = num(c.s.replace(re, ''));
        if (!n.length) { const nx = l.cells[i + 1]; if (nx && !/[\u0600-\u06FF]/.test(nx.s)) n = num(nx.s); }
        if (n.length) S[k] = n[n.length - 1];
      }
    }));
    return Object.keys(S).length ? S : null;
  }
  // PDF text → table cells. Works for both whole-string items and per-glyph items
  // (e.g. Chrome-printed PDFs), RTL with LTR runs (dates/amounts) kept in order.
  function lineCells(toks) {
    toks.sort((a, b) => a.x - b.x);
    const h = toks.reduce((a, t) => a + t.h, 0) / toks.length || 10;
    const cells = []; let cur = [];
    toks.forEach((t, i) => { if (i && t.x - (toks[i - 1].x + toks[i - 1].w) > 1.6 * h) { cells.push(cur); cur = []; } cur.push(t); });
    cur.length && cells.push(cur);
    return cells.reverse().map(c => ({ s: cellText(c), x0: c[0].x, x1: c[c.length - 1].x + c[c.length - 1].w })).filter(c => c.s);
  }
  function cellText(c) {
    const rtl = c.filter(t => t.rtl).length >= c.length / 2;
    const seq = rtl ? c.slice().reverse() : c.slice(); // reading order
    let out = '', run = [], prev = null;
    const gapSp = (a, b) => { const [l, r] = a.x < b.x ? [a, b] : [b, a]; return r.x - (l.x + l.w) > 0.22 * a.h ? ' ' : ''; };
    const flush = () => { if (!run.length) return; run.sort((a, b) => a.x - b.x); run.forEach((t, i) => { out += (i ? gapSp(run[i - 1], t) : '') + t.s; }); run = []; };
    seq.forEach(t => {
      if (rtl && !t.rtl) { if (!run.length && prev) out += gapSp(prev, t); run.push(t); prev = t; return; }
      if (run.length) { const last = run.reduce((a, b) => (rtl ? (a.x < b.x ? a : b) : (a.x > b.x ? a : b))); flush(); out += gapSp(last, t); }
      else if (prev) out += gapSp(prev, t);
      out += t.s; prev = t;
    });
    flush();
    return out.normalize('NFKC').replace(/\s+/g, ' ').trim();
  }

  /* ---------- upload flow ---------- */
  async function handleFile(file) {
    const isPDF = /\.pdf$/i.test(file.name), isSheet = /\.(xlsx|xls|csv)$/i.test(file.name);
    if (!isPDF && !isSheet) { window.SFX && SFX.error(); toast('فقط فایل اکسل (xlsx/xls/csv) یا PDF'); return; }
    window.SFX && SFX.upload();
    const m = openModal(`<div class="fin-modal-in"><h3>⏳ در حال خواندن «${esc(file.name)}»…</h3><div class="fin-loader"><i></i><i></i><i></i></div></div>`, 'fin-modal');
    let res;
    try { res = isPDF ? await parsePDF(file) : await parseSheet(file); }
    catch (err) { console.warn(err); closeModal(); window.SFX && SFX.error(); toast('خواندن فایل ممکن نشد: ' + (err.message || err)); return; }
    importModal(file, res);
  }
  // compare what was parsed against the statement's own printed totals (Rial, as in the file)
  function recon(res) {
    const s = res.summary; if (!s) return '';
    const inn = res.tx.filter(t => t.type === 'in'), out = res.tx.filter(t => t.type === 'out');
    const si = inn.reduce((a, t) => a + t.amount, 0), so = out.reduce((a, t) => a + t.amount, 0);
    const row = (lbl, n, sum, pn, ps) => { const ok = (pn == null || pn === n) && (ps == null || Math.abs(ps - sum) < 0.5); return `<tr><td>${lbl}</td><td class="n">${fmt(n)} / ${pn == null ? '—' : fmt(pn)}</td><td class="n">${fmt(dispAmt(sum))} / ${ps == null ? '—' : fmt(dispAmt(ps))}</td><td>${ok ? '<b class="g">✓</b>' : '<b class="r">✗ مغایرت</b>'}</td></tr>`; };
    let chain = '';
    if (s.open != null && s.close != null) { const calc = s.open + si - so; const ok = Math.abs(calc - s.close) < 0.5; chain = `<tr><td>مانده</td><td colspan="2" class="n">ابتدا ${fmt(dispAmt(s.open))} + واریز − برداشت = ${fmt(dispAmt(calc))} · مانده پایان فایل ${fmt(dispAmt(s.close))}</td><td>${ok ? '<b class="g">✓</b>' : '<b class="r">✗</b>'}</td></tr>`; }
    return `<div class="fin-recon"><div class="dim">تطبیق با جمع‌های چاپ‌شده در خود فایل (واحد فایل):</div><table class="ftab"><thead><tr><th></th><th>تعداد (خوانده‌شده / فایل)</th><th>جمع (خوانده‌شده / فایل)</th><th></th></tr></thead><tbody>${row('واریز', inn.length, si, s.inN, s.inSum)}${row('برداشت', out.length, so, s.outN, s.outSum)}${chain}</tbody></table></div>`;
  }
  function importModal(file, res) {
    const dv = (v, div) => Math.round(v / div * 10) / 10; // ÷10 keeps the last Rial digit as one decimal → nothing is lost
    const conv = div => res.tx.map(t => Object.assign({}, t, { amount: dv(t.amount, div) }, t.bal != null ? { bal: dv(t.bal, div) } : {}));
    const stats = div => { const keys = new Set(F.tx.map(txKey)), l = conv(div); return { l, dup: l.filter(t => keys.has(txKey(t))).length, tin: l.filter(t => t.type === 'in').reduce((a, t) => a + t.amount, 0), tout: l.filter(t => t.type === 'out').reduce((a, t) => a + t.amount, 0) }; };
    const prevRows = l => l.slice(0, 8).map(dispTx).map(t => `<tr class="${t.review ? 'need-review' : ''}"><td class="d">${jdot(t.date)}</td><td>${esc(t.desc)}</td><td>${esc(t.category)}${t.review ? ' <small class="need">نیازمند بررسی</small>' : (t.catConf != null ? ` <small class="conf">${t.catConf}٪</small>` : '')}</td><td>${amt(t)}</td></tr>`).join('');
    const div0 = res.unitHint === 10 ? 10 : 1; const { dup, tin, tout } = stats(div0);
    const hasSamples = F.tx.some(t => t.sample);
    const m = openModal(`<div class="fin-modal-in">
      <div class="fin-modal-body">
      <h3>📥 ورود داده از «${esc(file.name)}»</h3>
      <div class="fin-how">${esc(res.how)}${res.sheet ? ' · شیت: ' + esc(res.sheet) : ''}</div>
      ${res.tx.length ? `<div class="fin-sum"><div><b>${fmt(res.tx.length)}</b><span>تراکنش شناسایی شد</span></div><div class="g"><b id="u-in">${fmtShort(dispAmt(tin))}</b><span>درآمد</span></div><div class="r"><b id="u-out">${fmtShort(dispAmt(tout))}</b><span>هزینه</span></div><div><b id="u-dup">${fmt(dup)}</b><span>تکراری (رد می‌شود)</span></div></div>
      <div class="fin-prev"><table class="ftab"><thead><tr><th>تاریخ</th><th>شرح</th><th>دسته</th><th>مبلغ</th></tr></thead><tbody id="u-prev">${prevRows(conv(div0))}</tbody></table>${res.tx.length > 8 ? `<div class="dim" style="padding:.4rem">… و ${fmt(res.tx.length - 8)} ردیف دیگر</div>` : ''}</div>
      <div class="fin-opts"><label>واحد مبالغ فایل:</label><div class="fin-seg" id="u-unit"><button type="button" data-v="1"${div0 === 1 ? ' class="on"' : ''}>تومان</button><button type="button" data-v="10"${div0 === 10 ? ' class="on"' : ''}>ریال (÷۱۰ به تومان)</button></div>${res.unitHint === 10 ? '<small class="dim">فایل «ریال» اعلام کرده</small>' : ''}</div>
      ${recon(res)}
      <div class="fin-opts"><label>روش ورود:</label><div class="fin-seg" id="u-mode"><button type="button" data-v="merge" class="on">ادغام با داده‌های فعلی</button>${hasSamples ? '<button type="button" data-v="nosample">ادغام + حذف آزمایشی‌ها</button>' : ''}<button type="button" data-v="replace">جایگزینی کامل</button></div></div>
      </div><div class="form-actions"><button type="button" class="btn solid fin-go" id="u-go" data-snd="1">✓ به‌روزرسانی داشبورد</button><button type="button" class="btn ghost" data-close>انصراف</button></div>`
      : `<div class="fin-modal-body"><div class="empty">هیچ تراکنشی شناسایی نشد. فایل باید ستون «تاریخ» و «مبلغ» یا «واریز/برداشت» داشته باشد.</div></div><div class="form-actions"><button type="button" class="btn ghost" data-close>بستن</button></div>`}
    </div>`, 'fin-modal');
    if (!res.tx.length) { window.SFX && SFX.error(); return; }
    m.addEventListener('click', e => { const b = e.target.closest('.fin-seg button'); if (b) { $$('button', b.parentElement).forEach(x => x.classList.toggle('on', x === b)); window.SFX && SFX.pick(); if (b.parentElement.id === 'u-unit') { const st = stats(+b.dataset.v); $('#u-in', m).textContent = fmtShort(dispAmt(st.tin)); $('#u-out', m).textContent = fmtShort(dispAmt(st.tout)); $('#u-dup', m).textContent = fmt(st.dup); $('#u-prev', m).innerHTML = prevRows(st.l); } } });
    $('#u-go', m).onclick = () => {
      const div = +$('#u-unit .on', m).dataset.v, mode = $('#u-mode .on', m).dataset.v;
      const batchId = newId();
      const incoming = conv(div).map(t => Object.assign(t, { id: newId(), sample: false, source: file.name, batchId, entryAt: Date.now() }));
      if (mode === 'replace') { F.tx = []; F.sources = []; }
      if (mode === 'nosample') { F.tx = F.tx.filter(t => !t.sample); F.sources = F.sources.filter(s => !s.sample); }
      const ks = new Set(F.tx.map(txKey)); let added = 0;
      incoming.forEach(t => { const k = txKey(t); if (!ks.has(k)) { ks.add(k); F.tx.push(t); added++; } });
      F.tx.sort(byTime);
      if (res.summary) { F.statements = (F.statements || []).filter(x => x.name !== file.name); F.statements.push(Object.assign({ name: file.name }, res.summary)); }
      F.sources.push({ name: file.name, at: Date.now(), count: added, batchId });
      saveF(); closeModal(); window.SFX && SFX.cash();
      requestAnimationFrame(() => { const k = document.getElementById('fin-kpis'); if (k) { k.classList.add('flash'); setTimeout(() => k.classList.remove('flash'), 400); } });
      Object.assign(FS, { year: 'all', month: 'all', from: '', to: '' });
      toast(added ? `${fmt(added)} تراکنش اضافه شد — داشبورد به‌روز شد ✓` : `همه ${fmt(incoming.length)} تراکنش قبلاً ثبت شده بود — چیزی اضافه نشد`, 'ok');
      render(document.getElementById('view'));
    };
  }
  function manualTx() {
    const rate = currentRate();
    const m = openModal(`<div class="fin-modal-in"><h3>＋ تراکنش دستی</h3><form class="form" id="m-tx-form">
      <div class="fld"><label>تاریخ وقوع (شمسی)</label><input name="date" class="ltr" value="${jstr(Date.now())}"></div>
      <div class="fld"><label>ارز مبلغ</label><div class="fin-seg" id="m-cur"><button type="button" data-v="IRR" class="on">تومان</button><button type="button" data-v="USD">دلار</button></div></div>
      <div class="fld" id="fld-irr"><label>مبلغ تومان</label><input name="amount" class="ltr" inputmode="decimal" id="m-amt-irr" placeholder="1500000"></div>
      <div class="fld" id="fld-usd"><label>مبلغ دلار</label><input name="usd" class="ltr" inputmode="decimal" id="m-amt-usd" placeholder="20.00"></div>
      <div class="fld full" id="m-eq">معادل محاسبه‌شده: ${rate ? 'نرخ ' + fmt(rate) + ' تومان برای هر دلار' : 'ابتدا نرخ دستی را ثبت کن'}</div>
      <div class="fld full"><label>شرح</label><input name="desc" placeholder="مثلاً: تسویه پروژه…"></div>
      <div class="fld"><label>نوع</label><div class="fin-seg" id="m-type"><button type="button" data-v="out" class="on t-out">هزینه</button><button type="button" data-v="in" class="t-in">درآمد</button><button type="button" data-v="xfer">انتقال شخصی ↔ شرکت</button></div></div>
      <div class="fld"><label>حوزه</label><div class="fin-seg" id="m-dom"><button type="button" data-v="personal" class="on">شخصی</button><button type="button" data-v="company">شرکت</button></div></div>
      <div class="fld"><label>دسته (خالی = خودکار)</label><input name="cat" list="fin-cats"><datalist id="fin-cats">${[...new Set([...(F.catList.personal||[]), ...(F.catList.company||[]), ...F.tx.map(t => t.category)])].map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
      <div class="fld"><label>پروژه (اختیاری)</label><input name="project" placeholder="نام پروژه"></div>
      <div class="fld"><label>نرخ واقعی خرید / کارمزد (اختیاری)</label><input name="actualRate" class="ltr" inputmode="decimal" placeholder="نرخ پرداخت‌شده"></div>
      <div class="fld"><label>کارمزد (تومان، اختیاری)</label><input name="fee" class="ltr" inputmode="decimal" placeholder="0"></div>
      <div class="form-actions"><button class="btn solid fin-go" data-snd="1">ثبت تراکنش</button><button type="button" class="btn ghost" data-close>انصراف</button></div></form></div>`, 'fin-modal');
    const syncEq = () => {
      const cur = $('#m-cur .on', m).dataset.v;
      const r = currentRate();
      $('#fld-irr', m).style.opacity = cur === 'IRR' ? '1' : '.7';
      $('#fld-usd', m).style.opacity = cur === 'USD' ? '1' : '.7';
      $('#m-amt-irr', m).readOnly = cur !== 'IRR';
      $('#m-amt-usd', m).readOnly = cur !== 'USD';
      if (!r) { $('#m-eq', m).textContent = 'نرخ دستی ثبت نشده — معادل محاسبه نمی‌شود'; return; }
      if (cur === 'IRR') {
        const a = parseAmount($('#m-amt-irr', m).value);
        $('#m-amt-usd', m).value = a ? String(usdOf(a, r)) : '';
        $('#m-eq', m).textContent = a ? (`معادل: ${fmtUsd(usdOf(a, r))}  (نرخ ${fmt(r)} · فقط فیلد تومان ویرایش می‌شود)`) : `نرخ ${fmt(r)} تومان برای هر دلار`;
      } else {
        const a = parseAmount($('#m-amt-usd', m).value);
        $('#m-amt-irr', m).value = a ? String(tomanOf(a, r)) : '';
        $('#m-eq', m).textContent = a ? (`معادل: ${fmt(tomanOf(a, r))} تومان  (نرخ ${fmt(r)} · فقط فیلد دلار ویرایش می‌شود)`) : `نرخ ${fmt(r)} تومان برای هر دلار`;
      }
    };
    m.addEventListener('click', e => { const b = e.target.closest('.fin-seg button'); if (b) { e.preventDefault(); $$('button', b.parentElement).forEach(x => x.classList.toggle('on', x === b)); syncEq(); } });
    $('#m-amt-irr', m).addEventListener('input', syncEq);
    $('#m-amt-usd', m).addEventListener('input', syncEq);
    syncEq();
    $('form', m).onsubmit = e => {
      e.preventDefault(); const f = e.target;
      const date = parseDate(f.date.value), type = $('#m-type .on', m).dataset.v, desc = f.desc.value.trim() || (type === 'in' ? 'درآمد' : type === 'xfer' ? 'انتقال شخصی ↔ شرکت' : 'هزینه');
      const cur = $('#m-cur .on', m).dataset.v;
      const domain = $('#m-dom .on', m).dataset.v;
      const payload = { date, desc, type, category: f.cat.value.trim(), domain, project: f.project.value.trim(), currency: cur, actualRate: parseAmount(f.actualRate.value) || undefined, fee: parseAmount(f.fee.value) || undefined, source: 'ورود دستی' };
      if (cur === 'USD') payload.usd = parseAmount(f.usd.value);
      else payload.amount = parseAmount(f.amount.value);
      if (type === 'xfer') payload.fromDomain = domain;
      const r = addManual(payload);
      if (!r.ok) { window.SFX && SFX.error(); toast(r.err || 'تاریخ یا مبلغ نامعتبر است'); return; }
      closeModal(); window.SFX && SFX.cash(); toast('تراکنش ثبت شد ✓', 'ok'); render(document.getElementById('view'));
    };
  }
  function sourcesModal() {
    const m = openModal(`<div class="fin-modal-in"><h3>🗂 منابع داده</h3>
      <table class="ftab"><thead><tr><th>منبع</th><th>تاریخ ورود</th><th>تعداد</th><th></th></tr></thead><tbody>${F.sources.map((s, i) => `<tr><td>${esc(s.name)} ${s.sample ? '<span class="smp">آزمایشی</span>' : ''}</td><td class="d">${jdot(s.at)}</td><td class="n">${fmt(s.count)}</td><td>${s.batchId ? `<button class="fin-chip" data-roll="${esc(s.batchId)}" title="برگرداندن کل این ورود">برگرداندن ورود</button>` : ''}<button class="x-del" data-src="${i}" title="حذف تراکنش‌های این منبع">✕</button></td></tr>`).join('') || '<tr><td colspan="4">—</td></tr>'}</tbody></table>
      <div class="fin-how">کل تراکنش‌ها: ${fmt(F.tx.length)} · برای پشتیبان‌گیری از منوی ⚙ «خروجی پشتیبان» استفاده کن.</div>
      <div class="form-actions"><button class="btn red sm" id="src-all">حذف همه داده‌های مالی</button><button class="btn ghost" data-close>بستن</button></div></div>`, 'fin-modal');
    m.addEventListener('click', e => {
      const roll = e.target.closest('[data-roll]');
      if (roll) { const bid = roll.dataset.roll; if (!confirm('همه تراکنش‌های این ورود برگردانده شوند؟')) return; F.tx = F.tx.filter(t => t.batchId !== bid); F.sources = F.sources.filter(s => s.batchId !== bid); saveF(); closeModal(); render(document.getElementById('view')); return; }
      const b = e.target.closest('[data-src]');
      if (b) { const s = F.sources[+b.dataset.src]; if (!confirm(`تراکنش‌های «${s.name}» حذف شود؟`)) return; const srcName = s.name; F.tx = F.tx.filter(t => (s.sample ? !t.sample : t.source !== srcName)); F.sources.splice(+b.dataset.src, 1); saveF(); closeModal(); render(document.getElementById('view')); }
      if (e.target.closest('#src-all')) { if (!confirm('همه داده‌های مالی حذف شود؟')) return; F.tx = []; F.sources = []; saveF(); closeModal(); render(document.getElementById('view')); }
    });
  }


  function nextDue(s) {
    const start = +s.start || Date.now();
    const cyc = s.cycle === 'year' ? 365 : s.cycle === 'week' ? 7 : 30;
    let due = start;
    const now = Date.now();
    while (due < now - 86400000) due += cyc * 86400000;
    if (due < now) due += cyc * 86400000;
    return due;
  }
  function paintSubs() {
    const el = document.getElementById('fin-subs'); if (!el) return;
    F.subs = F.subs || [];
    F.subs.forEach(s => { s.next = nextDue(s); });
    const rows = F.subs.map(s => {
      const due = s.next || nextDue(s);
      const days = Math.round((due - Date.now()) / 86400000);
      const cls = days <= 3 ? 'alert-100' : days <= 7 ? 'alert-80' : '';
      return `<tr class="${cls}"><td>${esc(s.name)}</td><td>${esc(s.cycle === 'year' ? 'سالانه' : s.cycle === 'week' ? 'هفتگی' : 'ماهانه')}</td><td class="n">${fmt(dispAmt(s.amount || 0))}</td><td>${jdot(due)} (${days <= 0 ? 'سررسید' : faNum(days) + ' روز'})</td><td><button class="x-del" data-delsub="${esc(s.id)}">✕</button></td></tr>`;
    }).join('') || '<tr><td colspan="5">اشتراکی ثبت نشده</td></tr>';
    el.innerHTML = `<div class="fc-h"><span class="fc-dot" style="--c:#7dd3fc"></span>یادآوری تمدید اشتراک<small>محلی، بدون سرور</small></div>
      <form class="form sub-form" id="sub-form">
        <div class="fld"><label>نام</label><input name="name" required placeholder="مثلاً سرویس ماهانه"></div>
        <div class="fld"><label>مبلغ (تومان)</label><input name="amount" type="number" min="0"></div>
        <div class="fld"><label>دوره</label><select name="cycle"><option value="month">ماهانه</option><option value="year">سالانه</option><option value="week">هفتگی</option></select></div>
        <div class="fld"><label>شروع / آخرین تمدید (روز)</label><input name="start" type="date"></div>
        <div class="form-actions"><button class="btn solid sm" data-snd="1">ثبت اشتراک</button></div>
      </form>
      <table class="ftab"><thead><tr><th>نام</th><th>دوره</th><th>مبلغ</th><th>سررسید بعدی</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
    const f = document.getElementById('sub-form');
    f.onsubmit = ev => {
      ev.preventDefault();
      const name = fv(f, 'name').trim(); if (!name) return;
      const raw = +fv(f, 'amount') || 0;
      const amount = raw / (typeof DISPLAY_TEST_MULTIPLIER === 'number' ? DISPLAY_TEST_MULTIPLIER : 1);
      const startStr = fv(f, 'start');
      const start = startStr ? new Date(startStr + 'T12:00:00').getTime() : Date.now();
      const rec = { id: newId(), name, amount, cycle: fv(f, 'cycle') || 'month', start }; rec.next = nextDue(rec); F.subs.push(rec);
      saveF(); window.SFX && SFX.save(); toast('اشتراک ثبت شد', 'ok'); paintSubs();
    };
    el.onclick = ev => {
      const b = ev.target.closest('[data-delsub]'); if (!b) return;
      F.subs = F.subs.filter(s => s.id !== b.dataset.delsub); saveF(); paintSubs();
    };
  }

  function paintExtraFin(allRaw) {
    const el = document.getElementById('fin-extra'); if (!el) return;
    const rec = (allRaw || []).filter(t => t.receivable || t.status === 'receivable');
    const recSum = rec.filter(t => t.type === 'in').reduce((s, t) => s + +t.amount, 0);
    const recPay = rec.filter(t => t.type === 'out').reduce((s, t) => s + +t.amount, 0);
    const net = cashRows(allRaw).filter(t => t.type === 'in').reduce((s, t) => s + +t.amount, 0) - cashRows(allRaw).filter(t => t.type === 'out').reduce((s, t) => s + +t.amount, 0);
    const months = {};
    cashRows(allRaw).forEach(t => {
      const d = new Date(+t.date); const k = d.getFullYear() * 100 + (d.getMonth() + 1);
      months[k] = months[k] || { in: 0, out: 0 };
      months[k][t.type] += +t.amount;
    });
    const keys = Object.keys(months).map(Number).sort();
    const last3 = keys.slice(-3);
    const avgNet = last3.length ? last3.reduce((s, k) => s + (months[k].in - months[k].out), 0) / last3.length : 0;
    const cats = {};
    cashRows(allRaw).filter(t => t.type === 'out').forEach(t => { const c = t.category || 'سایر'; cats[c] = (cats[c] || 0) + +t.amount; });
    const catArr = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const maxC = catArr[0] ? catArr[0][1] : 1;
    const sankey = catArr.map(([n, v]) => `<div class="sk-row"><span>${esc(n)}</span><i style="width:${Math.max(6, Math.round(100 * v / maxC))}%"></i></div>`).join('') || '<div class="empty">—</div>';
    el.innerHTML = `<div class="fc-h"><span class="fc-dot" style="--c:#c4b5fd"></span>بینش تکمیلی<small>طلب / خالص دارایی / پیش‌بینی خطی محلی</small></div>
      <div class="fin-extra-grid">
        <div class="fx-mini"><b>طلب‌ها و بدهی‌های علامت‌خورده</b><p>${rec.length ? faNum(rec.length) + ' مورد علامت‌خورده' : 'موردی به‌عنوان طلب علامت نخورده'} · ورود علامت‌خورده / خروج علامت‌خورده (مبالغ در جداول اصلی)</p></div>
        <div class="fx-mini"><b>خالص دارایی (از گردش نقدی همین صفحه)</b><p>بر اساس فیلتر فعلی، بدون شمارش دوبارهٔ جابه‌جایی داخلی در حالت تجمیعی. عدد دقیق در کارت‌های بالا آمده است.</p></div>
        <div class="fx-mini"><b>پیش‌بینی ساده</b><p>میانگین خالص ${faNum(last3.length) || '۰'} ماه اخیر، اگر همین روند بماند — فقط جهت برآورد، نه توصیه.</p></div>
      </div>
      <div class="sk-wrap"><b>جریان هزینه به‌تفکیک دسته (نمای ساده، بدون کانواس اضافه)</b>${sankey}</div>`;
  }

  function classifyModal() {
    const un = F.tx.filter(t => !t.domain);
    const m = openModal(`<div class="fin-modal-in"><h3>⚖ تفکیک شخصی / شرکت</h3>
      <p class="fin-how">تراکنش‌های بدون حوزه را یکجا علامت بزن. پیش‌فرض فعلی «همه» در صفحه حفظ می‌شود و دادهٔ بذر تغییر نمی‌کند مگر اینجا ذخیره کنی.</p>
      <div class="form-actions">
        <button class="btn sm solid" data-allp>همهٔ بدون‌حوزه ← شخصی</button>
        <button class="btn sm" data-allc>همهٔ بدون‌حوزه ← شرکت</button>
      </div>
      <div class="cls-list" id="cls-list">${un.slice(0, 80).map(t => `<label class="cls-row"><input type="checkbox" data-id="${t.id}" checked><span>${esc(t.desc || t.category || '—')}</span><span class="d">${jdot(t.date)}</span></label>`).join('') || '<div class="empty">همه تراکنش‌ها حوزه دارند</div>'}${un.length > 80 ? `<p class="fin-how">نمایش ۸۰ مورد اول از ${faNum(un.length)}</p>` : ''}</div>
      <div class="form-actions">
        <button class="btn solid" data-topers>اعمال به‌عنوان شخصی</button>
        <button class="btn" data-toco>اعمال به‌عنوان شرکت</button>
        <button class="btn ghost" data-close>بستن</button>
      </div></div>`, 'fin-modal');
    const apply = domain => {
      const ids = new Set([...m.querySelectorAll('[data-id]:checked')].map(x => x.dataset.id));
      let n = 0;
      F.tx.forEach(t => { if (ids.has(t.id)) { t.domain = domain; n++; } });
      saveF(); toast(n ? 'حوزه ذخیره شد' : 'موردی انتخاب نشد', n ? 'ok' : '');
      closeModal(); render(document.getElementById('view'));
    };
    m.addEventListener('click', e => {
      if (e.target.closest('[data-allp]')) { F.tx.forEach(t => { if (!t.domain) t.domain = 'personal'; }); saveF(); closeModal(); render(document.getElementById('view')); }
      if (e.target.closest('[data-allc]')) { F.tx.forEach(t => { if (!t.domain) t.domain = 'company'; }); saveF(); closeModal(); render(document.getElementById('view')); }
      if (e.target.closest('[data-topers]')) apply('personal');
      if (e.target.closest('[data-toco]')) apply('company');
    });
  }

  window.Finance = {
    render, destroy, addManual, addTransfer,
    data: () => F,
    importData: d => { if (d && Array.isArray(d.tx)) { F = ensureP2(Object.assign({ version: 2, unit: 'تومان', sources: [], statements: [] }, d, { version: 2 })); saveF(); } },
    reset: () => { F = ensureP2(realSeed()); saveF(); },
    clearSamples: () => { const n = F.tx.filter(t => t.sample).length; F.tx = F.tx.filter(t => !t.sample); F.sources = F.sources.filter(s => !s.sample); saveF(); return n; },
    _parse: { rowsToTx, parseDate, parseAmount, fromJ, toJ, handleFile, parsePDF },
    fx: { setRate, getRate: currentRate, rateForDate, usdOf, tomanOf, usdFor, attachFx, roundToman, roundUsd, setMarket, currentRate },
    domain: { isInternal, txDomain, cashRows, accountOf },
    classifyModal, paintSubs, nextDue,
    budgets: { set: setBudget, progress: budgetProgress },
    reports: { monthly: monthRows, category: catRows, csv: reportCsv, xlsx: reportXlsx, archive: archiveReport },
    cats: { add: addCat },
    filters: () => FS,
    dispAmt, fmt,
  };
})();
