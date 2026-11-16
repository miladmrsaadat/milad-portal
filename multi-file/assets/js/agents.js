/* ================= «مدیریت ایجنت‌ها» — Agents Command Center (test version) =================
   Vanilla JS, offline. Data only in STORE under mss_agents_v1. No financial data in this module.
   Motto: اول تمومش کن، بعد بهترش کن */
window.Agents = (() => {
  'use strict';
  const K = 'mss_agents_v1';
  const q = (s, r = document) => r.querySelector(s), qa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const FD = '۰۱۲۳۴۵۶۷۸۹', fa = v => String(v).replace(/\d/g, d => FD[d]);
  const pad = n => String(n).padStart(2, '0');
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const sfx = n => { try { window.SFX && SFX[n] && SFX[n](); } catch (e) { } };
  const say = (m, t) => { try { window.toast ? toast(m, t) : console.log(m); } catch (e) { } };
  const T = () => (window.Daily && Daily._t) || null;
  const MN = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  const todayJ = () => T().todayJ();
  const keyOf = j => T().keyOf(j);
  const jOf = k => { if (!k || !/^\d{4}-\d\d-\d\d$/.test(k)) return null; const [y, m, d] = k.split('-').map(Number); return T().j2d(y, m, d); };
  const fmtK = k => { if (!k) return '—'; const [y, m, d] = k.split('-').map(Number); return `${fa(d)} ${MN[m - 1]} ${fa(y)}`; };
  const fmtTs = ts => { try { const d = new Date(ts); const j = T().g2d(d.getFullYear(), d.getMonth() + 1, d.getDate()); return fmtK(keyOf(j)) + ' · ' + fa(pad(d.getHours()) + ':' + pad(d.getMinutes())); } catch (e) { return ''; } };

  /* ---------- agents ---------- */
  const AG = [
    { id: 'nexo', fa: 'نکسو', en: 'Nexo', role: 'پورتال مدیریت پروژه', c: '#2f7bff', grok: 1 },
    { id: 'argus', fa: 'آرگوس', en: 'Argus', role: 'نظارت بر ایجنت‌ها و مدیریت داخلی', c: '#f5c55a', grok: 1 },
    { id: 'shaho', fa: 'شاهو', en: 'Shaho', role: 'بازی شاه‌گل', c: '#ff2e4d', grok: 1 },
    { id: 'webo', fa: 'وبو', en: 'Webo', role: 'طراحی سایت و تجربهٔ کاربری', c: '#22d3ee', grok: 1 },
    { id: 'novak', fa: 'نُواک', en: 'Novak', role: 'پروژه‌های موزیک', c: '#ff2d8b', grok: 1 },
    { id: 'viera', fa: 'ویرا', en: 'Viera', role: 'پورتال فتوگرافی پزشکی تهران', c: '#14c8d8', grok: 1 },
    { id: 'jergeh', fa: 'جرقه', en: 'Jergeh', role: 'جست‌وجو، تحلیل و ایده‌پردازی', c: '#ffb020', grok: 1 },
    { id: 'pixel', fa: 'پیکسل', en: 'Pixel', role: 'گرافیک و تبلیغات', c: '#a78bfa', grok: 1 },
    { id: 'reflex', fa: 'رفلکس', en: 'Reflex', role: 'بازی سنگ کاغذ قیچی', c: '#22c55e', grok: 1 },
    { id: 'radar', fa: 'رادار', en: 'Radar', role: 'بازار و بازاریابی', c: '#ff7a3d', grok: 1 },
    { id: 'grok', fa: 'Grok', en: 'Grok', role: 'هوش مصنوعی xAI', c: '#7c93ff', ext: 1 },
    { id: 'gemini', fa: 'Gemini', en: 'Gemini', role: 'هوش مصنوعی Google', c: '#4f8cff', ext: 1 },
    { id: 'chatgpt', fa: 'ChatGPT', en: 'ChatGPT', role: 'هوش مصنوعی OpenAI', c: '#a855f7', ext: 1 },
    { id: 'manus', fa: 'Manus', en: 'Manus', role: 'ایجنت خودکار Manus', c: '#e5e7eb', ext: 1 },
    { id: 'claude', fa: 'Claude', en: 'Claude', role: 'هوش مصنوعی Anthropic', c: '#ff8a3d', ext: 1 },
  ];
  const BY = Object.fromEntries(AG.map(a => [a.id, a]));
  const PRIO = { low: { n: 'کم', c: '#7cb4ff', w: 0 }, mid: { n: 'متوسط', c: '#f5c55a', w: 1 }, high: { n: 'زیاد', c: '#ff8a3d', w: 2 }, urgent: { n: 'فوری', c: '#ff2e4d', w: 3 } };
  const STAT = { queue: { n: 'صف کار', c: '#7c93c4' }, doing: { n: 'در جریان', c: '#2f7bff' }, wait: { n: 'در انتظار', c: '#f5c55a' }, done: { n: 'تمام‌شده', c: '#22c55e' } };
  const SORDER = ['queue', 'doing', 'wait', 'done'];
  const MOTTO = 'اول تمومش کن، بعد بهترش کن';

  function avatar(a, cls = '') {
    if (!a) return '';
    if (a.ext) return `<span class="ag-av ext ${cls}" style="--c:${a.c}"><svg><use href="#sym-${a.id}"/></svg></span>`;
    return `<span class="ag-av ${cls}" style="--c:${a.c}"><img src="${ASSET('agents/' + a.id + '.webp')}" alt="${h(a.fa)}" loading="lazy"></span>`;
  }

  /* ---------- model ---------- */
  let D = null;
  const celebrate = () => { try { if (window.Sky && !document.body.classList.contains('lowpower')) Sky.meteorShower(10); } catch (e) { } };
  function mk(o) {
    const t = Date.now();
    return Object.assign({ id: uid(), agent: 'nexo', title: '', prio: 'mid', status: 'queue', progress: 25, deadline: '', link: '', note: '', next: '', finish: '', approval: false, approved: false, deps: '', risk: '', stage: '', stageAt: 0, entries: [], createdAt: t, updatedAt: t, sample: false }, o);
  }
  function seed() {
    const tj = T() ? todayJ() : null, dl = n => tj ? keyOf(tj + n) : '';
    const S = (agent, title, o) => mk(Object.assign({ agent, title: title + ' (نمونه)', sample: true }, o));
    const items = [
      S('nexo', 'پورتال مدیریت پروژه‌ها', { status: 'doing', progress: 70, prio: 'high', deadline: dl(10), next: 'تکمیل بخش مدیریت ایجنت‌ها', finish: 'همهٔ بخش‌ها روی مانیتور ۳۲ اینچ و موبایل بدون خطا کار کنند' }),
      S('argus', 'داشبورد نظارت روزانه بر ایجنت‌ها', { status: 'queue', progress: 25, prio: 'mid', deadline: dl(14), next: 'فهرست شاخص‌های گزارش روزانه', finish: 'گزارش روزانهٔ وضعیت همهٔ ایجنت‌ها در یک صفحه', approval: true }),
      S('shaho', 'بازی شاه‌گل MVP', { status: 'doing', progress: 40, prio: 'urgent', deadline: dl(7), next: 'پیاده‌سازی دور کامل بازی دو نفره', finish: 'یک دور کامل بازی از شروع تا برنده قابل اجرا باشد', approval: true, risk: 'قوانین محلی بازی باید تأیید شوند' }),
      S('webo', 'بازطراحی تجربهٔ کاربری صفحهٔ ورود', { status: 'wait', progress: 50, prio: 'mid', deadline: dl(12), next: 'دریافت بازخورد میلاد روی طرح', finish: 'طرح نهایی تأییدشده و پیاده‌سازی‌شده', deps: 'پورتال مدیریت پروژه‌ها' }),
      S('novak', 'آهنگ‌ها / Suno — مجموعهٔ اول', { status: 'doing', progress: 35, prio: 'high', deadline: dl(20), next: 'نهایی کردن متن آهنگ اول', finish: 'سه آهنگ کامل با کاور آماده' }),
      S('viera', 'پورتال فتوگرافی پزشکی تهران', { status: 'doing', progress: 55, prio: 'high', deadline: dl(18), next: 'صفحهٔ معرفی خدمات', finish: 'نسخهٔ اول آنلاین با صفحات اصلی', approval: true }),
      S('jergeh', 'بانک ایده‌های هفته', { status: 'queue', progress: 25, prio: 'low', deadline: dl(5), next: 'جمع‌آوری ۱۰ ایدهٔ اولیه', finish: 'فهرست ایده‌ها با امتیاز اولویت' }),
      S('pixel', 'بستهٔ پوستر و بنر تبلیغاتی', { status: 'queue', progress: 25, prio: 'mid', deadline: dl(9), next: 'تهیهٔ سه طرح اولیه', finish: 'فایل‌های نهایی در سه سایز استاندارد' }),
      S('reflex', 'بازی سنگ کاغذ قیچی MVP', { status: 'doing', progress: 60, prio: 'mid', deadline: dl(6), next: 'افزودن جدول امتیاز', finish: 'بازی کامل در مرورگر با امتیازشماری' }),
      S('radar', 'تحلیل بازار و رقبا', { status: 'wait', progress: 30, prio: 'mid', deadline: dl(15), next: 'انتخاب سه رقیب اصلی', finish: 'گزارش یک‌صفحه‌ای با پیشنهاد اقدام' }),
    ];
    const STG = { nexo: ['بخش ایجنت‌ها ساخته و تست شد', 'پیش‌نمایش بخش ایجنت‌ها'], argus: ['فهرست اولیهٔ ایجنت‌ها آماده شد', 'جدول ایجنت‌ها و نقش‌ها'], shaho: ['صفحهٔ اتاق بازی طراحی شد', 'طرح آزمایشی صفحهٔ اتاق'], webo: ['طرح اولیه برای بازخورد ارسال شد', 'طرح اولیهٔ صفحهٔ ورود'], novak: ['متن آهنگ اول در حال نوشتن است', 'پیش‌نویس متن آهنگ اول'], viera: ['ساختار صفحات اصلی نوشته شد', 'فهرست صفحه‌های نمونه'], jergeh: ['', ''], pixel: ['', ''], reflex: ['منطق بازی و شمارنده کار می‌کند', 'پیش‌نمایش شمارنده'], radar: ['منتظر انتخاب رقبا', 'فهرست اولیهٔ رقبا'] };
    const now = Date.now();
    items.forEach((x, i) => { const g = STG[x.agent]; if (!g) return; if (g[0]) { x.stage = g[0]; x.stageAt = now - (i % 4) * 864e5; }
      x.entries = [{ id: uid(), t: now, type: 'change', date: dl(0), title: 'وضعیت اولیهٔ نمونه ثبت شد', note: 'دادهٔ نمونه برای امتحان‌کردن داشبورد.', link: '', done: false }];
      if (g[1]) x.entries.unshift({ id: uid(), t: now + 1, type: 'output', date: dl(0), title: g[1], note: 'دادهٔ نمونه.', link: '', done: false });
      if (x.next) x.entries.unshift({ id: uid(), t: now + 2, type: 'task', date: x.deadline || dl(0), title: x.next, note: '', link: '', done: false }); });
    return { version: 1, items, hist: [{ t: Date.now(), agent: 'argus', txt: 'اتاق فرمان ایجنت‌ها با داده‌های نمونه راه‌اندازی شد' }] };
  }
  const okItem = x => x && typeof x === 'object' && typeof x.title === 'string' && BY[x.agent];
  function normalize(v) {
    v.items = (Array.isArray(v.items) ? v.items : []).filter(okItem).map(x => {
      const n = mk(x); n.progress = Math.max(0, Math.min(100, Math.round(+n.progress || 0)));
      if (!PRIO[n.prio]) n.prio = 'mid'; if (!STAT[n.status]) n.status = 'queue';
      if (n.deadline && !/^\d{4}-\d\d-\d\d$/.test(n.deadline)) n.deadline = '';
      if (n.link && !/^https?:\/\//i.test(n.link)) n.link = '';
      n.stage = String(n.stage || '').slice(0, 220); n.stageAt = +n.stageAt || 0;
      n.entries = (Array.isArray(n.entries) ? n.entries : []).filter(e => e && ETYPE[e.type] && typeof e.title === 'string').map(e => ({ id: String(e.id || uid()), t: +e.t || Date.now(), type: e.type, date: /^\d{4}-\d\d-\d\d$/.test(e.date) ? e.date : '', title: e.title.slice(0, 200), note: String(e.note || '').slice(0, 600), link: cleanLink(e.link), done: !!e.done })).slice(0, 200);
      return n;
    });
    v.hist = (Array.isArray(v.hist) ? v.hist : []).filter(x => x && typeof x.txt === 'string').slice(0, 200);
    return v;
  }
  function load() {
    try { const v = JSON.parse(STORE.getItem(K)); if (v && v.version) { D = normalize(v); return; } } catch (e) { }
    D = seed(); save();
  }
  const save = () => { try { STORE.setItem(K, JSON.stringify(D)); } catch (e) { } };
  const ensure = () => { if (!D) load(); };
  const log = (agent, txt) => { D.hist.unshift({ t: Date.now(), agent, txt }); D.hist = D.hist.slice(0, 200); };
  const itemsOf = id => D.items.filter(x => x.agent === id);
  const avg = l => l.length ? Math.round(l.reduce((s, x) => s + x.progress, 0) / l.length) : 0;
  const pending = () => D.items.filter(x => x.approval && !x.approved && x.status !== 'done');

  /* ---------- shared bits ---------- */
  const ring = (v, c, sz = 54) => { const R = 22, C = 2 * Math.PI * R; return `<svg class="ag-ring" viewBox="0 0 54 54" style="width:${sz}px;height:${sz}px"><circle cx="27" cy="27" r="${R}" class="bg"/><circle cx="27" cy="27" r="${R}" stroke="${c}" stroke-dasharray="${C * v / 100} ${C}" transform="rotate(-90 27 27)" style="filter:drop-shadow(0 0 4px ${c})"/><text x="27" y="31" text-anchor="middle">${fa(v)}٪</text></svg>`; };
  const chip = (o, cls = '') => `<span class="ag-chip ${cls}" style="--c:${o.c}">${o.n}</span>`;
  function dlChip(k, done) {
    if (!k) return '<span class="ag-dl none">بدون ددلاین</span>';
    const j = jOf(k), left = j - todayJ();
    const cls = done ? 'ok' : left < 0 ? 'late' : left <= 3 ? 'soon' : '';
    const t = done ? '' : left < 0 ? ` · ${fa(-left)} روز گذشته` : left === 0 ? ' · امروز' : ` · ${fa(left)} روز مانده`;
    return `<span class="ag-dl ${cls}">📅 ${fmtK(k)}${t}</span>`;
  }
  function dateSel(name, val) {
    const tj = todayJ(), [cy] = T().d2j(tj); const [y, m, d] = val ? val.split('-').map(Number) : [0, 0, 0];
    const ys = [cy - 1, cy, cy + 1, cy + 2];
    return `<span class="ag-date" data-date="${name}">
      <select data-p="d"><option value="">روز</option>${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${d === i + 1 ? 'selected' : ''}>${fa(i + 1)}</option>`).join('')}</select>
      <select data-p="m"><option value="">ماه</option>${MN.map((n, i) => `<option value="${i + 1}" ${m === i + 1 ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <select data-p="y"><option value="">سال</option>${ys.map(v => `<option value="${v}" ${y === v ? 'selected' : ''}>${fa(v)}</option>`).join('')}</select>
      <button type="button" class="ag-mini" data-quick="7">+۷ روز</button></span>`;
  }
  function readDate(root, name) {
    const w = q(`[data-date="${name}"]`, root); if (!w) return '';
    const y = +q('[data-p=y]', w).value, m = +q('[data-p=m]', w).value, d = +q('[data-p=d]', w).value;
    if (!y || !m || !d) return '';
    const dd = Math.min(d, T().mLen(y, m)); return `${y}-${pad(m)}-${pad(dd)}`;
  }
  function wireDate(root) {
    qa('[data-quick]', root).forEach(b => b.onclick = () => {
      const w = b.closest('[data-date]'), [y, m, d] = T().d2j(todayJ() + (+b.dataset.quick));
      const ys = q('[data-p=y]', w); if (![...ys.options].some(o => +o.value === y)) ys.add(new Option(fa(y), y));
      ys.value = y; q('[data-p=m]', w).value = m; q('[data-p=d]', w).value = d;
    });
  }
  const optsP = sel => Object.entries(PRIO).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v.n}</option>`).join('');
  const optsS = sel => Object.entries(STAT).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v.n}</option>`).join('');
  const optsA = sel => `<optgroup label="ایجنت‌های Grok">${AG.filter(a => a.grok).map(a => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${a.fa} — ${a.role}</option>`).join('')}</optgroup><optgroup label="هوش‌های مصنوعی بیرونی">${AG.filter(a => a.ext).map(a => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${a.fa}</option>`).join('')}</optgroup>`;
  const cleanLink = s => { s = String(s || '').trim(); if (!s) return ''; if (!/^https?:\/\//i.test(s)) s = 'https://' + s; try { const u = new URL(s); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch (e) { return ''; } };

  let charts = [];
  const destroy = () => { charts.forEach(c => { try { c.destroy(); } catch (e) { } }); charts = []; };
  const CH = () => typeof Chart !== 'undefined';
  const grid = 'rgba(140,165,255,.12)';
  function chartDefaults() { if (!CH()) return; Chart.defaults.color = '#a9b4dc'; Chart.defaults.font.family = "Vazirmatn, Tahoma, sans-serif"; }

  /* ---------- main page ---------- */
  let root = null;
  function renderMain(view) {
    ensure(); destroy(); root = view;
    const grok = AG.filter(a => a.grok), ext = AG.filter(a => a.ext);
    const all = D.items, open = all.filter(x => x.status !== 'done');
    view.innerHTML = `<div class="page ag-page">
      <header class="ag-head glass">
        <button class="icon-btn ag-home" data-go="" title="صفحهٔ اصلی">⌂</button>
        <div class="ag-core-mini"><i></i><i></i><i></i></div>
        <div class="ag-title"><h2>مدیریت ایجنت‌ها</h2><small>Agents Command Center · نسخهٔ آزمایشی</small></div>
        <div class="ag-kpis">
          <div><b>${fa(AG.length)}</b><span>ایجنت</span></div>
          <div><b>${fa(open.length)}</b><span>کار باز</span></div>
          <div><b>${fa(avg(open))}٪</b><span>میانگین پیشرفت</span></div>
          <div class="warn"><b>${fa(pending().length)}</b><span>منتظر تأیید</span></div>
        </div>
        <div class="ag-motto">«${MOTTO}»</div>
      </header>
      <form class="ag-quick glass" id="ag-quick" autocomplete="off">
        <div class="aq-t">⚡ افزودن سریع</div>
        <label class="aq-a"><span>ایجنت</span><select name="agent">${optsA('nexo')}</select></label>
        <label class="aq-title"><span>عنوان</span><input name="title" required maxlength="140" placeholder="عنوان پروژه یا کار…"></label>
        <label><span>اولویت</span><select name="prio">${optsP('mid')}</select></label>
        <label class="aq-d"><span>ددلاین (شمسی)</span>${dateSel('dl', '')}</label>
        <label class="aq-l"><span>لینک (اختیاری)</span><input name="link" dir="ltr" placeholder="https://…"></label>
        <label class="aq-n"><span>یادداشت</span><input name="note" maxlength="400" placeholder="توضیح کوتاه…"></label>
        <button class="btn ag-add" type="submit">＋ ثبت در فهرست ایجنت</button>
      </form>
      <section class="ag-sec"><h3>ایجنت‌های Grok</h3><div class="ag-grid">${grok.map(card).join('')}</div></section>
      <section class="ag-sec"><h3>هوش‌های مصنوعی بیرونی</h3><div class="ag-grid ext">${ext.map(card).join('')}</div></section>
      <section class="ag-sec bd-sec"><h3>📋 سبد پروژه‌ها <small>همهٔ ایجنت‌ها · آخرین وضعیت هر کار همین‌جا</small></h3>${boardBar('main')}<div id="ag-body"></div></section>
      <section class="ag-charts">
        <div class="glass ag-ch wide"><h4>مقایسهٔ پیشرفت ایجنت‌ها</h4><div class="cw"><canvas id="ch-ag"></canvas></div></div>
        <div class="glass ag-ch"><h4>وضعیت کارها</h4><div class="cw"><canvas id="ch-st"></canvas></div></div>
        <div class="glass ag-ch"><h4>توزیع اولویت</h4><div class="cw"><canvas id="ch-pr"></canvas></div></div>
      </section>
      <section class="ag-two">
        <div class="glass ag-appr"><h4>✅ تأییدهای میلاد <span class="cnt">${fa(pending().length)}</span></h4><div id="ag-appr">${apprHTML()}</div></div>
        <div class="glass ag-hist"><h4>🕘 تاریخچهٔ فعالیت‌ها</h4><div id="ag-hist">${histHTML()}</div></div>
      </section>
    </div>`;
    wireDate(view);
    q('#ag-quick', view).onsubmit = e => {
      e.preventDefault(); const f = e.target;
      const title = f.title.value.trim(); if (!title) { say('عنوان را بنویس'); return; }
      const raw = f.link.value.trim(), link = cleanLink(raw); if (raw && !link) { say('لینک معتبر نیست'); return; }
      const it = mk({ agent: f.agent.value, title, prio: f.prio.value, deadline: readDate(f, 'dl'), link, note: f.note.value.trim() });
      D.items.unshift(it); log(it.agent, `«${it.title}» به فهرست ${BY[it.agent].fa} اضافه شد`); save(); sfx('save');
      say(`به فهرست ${BY[it.agent].fa} اضافه شد`, 'ok'); renderMain(view);
    };
    wireBoard(view, 'main', null);
    drawMainCharts();
  }
  function card(a) {
    const l = itemsOf(a.id), open = l.filter(x => x.status !== 'done'), v = avg(open.length ? open : l);
    const late = open.filter(x => x.deadline && jOf(x.deadline) < todayJ()).length, ap = l.filter(x => x.approval && !x.approved && x.status !== 'done').length;
    return `<a class="ag-card glass clickable" href="#/agent/${a.id}" style="--c:${a.c}" data-agent="${a.id}">
      ${avatar(a, 'lg')}
      <div class="agc-b"><b>${h(a.fa)}</b><small>${h(a.role)}</small>
        <div class="agc-m"><span>${fa(l.length)} پروژه</span>${open.length ? `<span>${fa(open.length)} باز</span>` : ''}${late ? `<span class="late">${fa(late)} عقب</span>` : ''}${ap ? `<span class="ap">${fa(ap)} تأیید</span>` : ''}</div></div>
      ${ring(v, a.c)}</a>`;
  }
  function apprHTML() {
    const l = pending();
    if (!l.length) return '<div class="ag-empty">موردی منتظر تأیید نیست ✨</div>';
    return l.map(x => { const a = BY[x.agent]; return `<div class="ap-row" data-id="${x.id}" style="--c:${a.c}">${avatar(a, 'sm')}<div class="ap-b"><b>${h(x.title)}</b><small>${h(a.fa)} · ${PRIO[x.prio].n} · ${fa(x.progress)}٪${x.next ? ' · قدم بعدی: ' + h(x.next) : ''}</small></div>
      <button class="ag-mini ok" data-appr="ok">تأیید</button><button class="ag-mini no" data-appr="no">برگشت</button></div>`; }).join('');
  }
  function histHTML(agent) {
    const l = D.hist.filter(x => !agent || x.agent === agent).slice(0, 14);
    if (!l.length) return '<div class="ag-empty">هنوز فعالیتی ثبت نشده</div>';
    return l.map(x => { const a = BY[x.agent]; return `<div class="hi-row">${a ? avatar(a, 'xs') : ''}<span>${h(x.txt)}</span><time>${fmtTs(x.t)}</time></div>`; }).join('');
  }
  function drawMainCharts() {
    if (!CH()) return; chartDefaults();
    const c1 = q('#ch-ag', root), c2 = q('#ch-st', root), c3 = q('#ch-pr', root);
    if (c1) charts.push(new Chart(c1, { type: 'bar', data: { labels: AG.map(a => a.fa), datasets: [{ label: 'میانگین پیشرفت ٪', data: AG.map(a => avg(itemsOf(a.id))), backgroundColor: AG.map(a => a.c + 'cc'), borderColor: AG.map(a => a.c), borderWidth: 1, borderRadius: 8 }, { label: 'تعداد کار', data: AG.map(a => itemsOf(a.id).length), type: 'line', yAxisID: 'y2', borderColor: '#ff2e4d', backgroundColor: '#ff2e4d', pointRadius: 4, tension: .3 }] }, options: { maintainAspectRatio: false, scales: { x: { reverse: true, grid: { color: grid } }, y: { min: 0, max: 100, grid: { color: grid } }, y2: { position: 'left', beginAtZero: true, ticks: { precision: 0 }, grid: { display: false } } }, plugins: { legend: { rtl: true }, tooltip: { rtl: true } } } }));
    if (c2) charts.push(new Chart(c2, { type: 'doughnut', data: { labels: SORDER.map(s => STAT[s].n), datasets: [{ data: SORDER.map(s => D.items.filter(x => x.status === s).length), backgroundColor: SORDER.map(s => STAT[s].c), borderColor: '#070b1d', borderWidth: 3 }] }, options: { maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom', rtl: true }, tooltip: { rtl: true } } } }));
    if (c3) charts.push(new Chart(c3, { type: 'bar', data: { labels: Object.values(PRIO).map(p => p.n), datasets: [{ label: 'تعداد', data: Object.keys(PRIO).map(k => D.items.filter(x => x.prio === k && x.status !== 'done').length), backgroundColor: Object.values(PRIO).map(p => p.c + 'cc'), borderRadius: 8 }] }, options: { indexAxis: 'y', maintainAspectRatio: false, scales: { x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: grid } }, y: { position: 'right', grid: { display: false } } }, plugins: { legend: { display: false }, tooltip: { rtl: true } } } }));
  }

  /* ---------- shared actions ---------- */
  let curAgent = null, lastAgent = null;
  const find = id => D.items.find(i => i.id === id);
  const rerender = () => curAgent ? renderAgent(root, curAgent) : renderMain(root);
  const ago = t => { if (!t) return ''; const d = Math.floor((Date.now() - t) / 864e5); return d <= 0 ? 'امروز' : d === 1 ? 'دیروز' : fa(d) + ' روز پیش'; };
  const isLate = x => x.status !== 'done' && x.deadline && jOf(x.deadline) < todayJ();
  const ETYPE = { task: { n: 'وظیفه', c: '#2f7bff' }, output: { n: 'خروجی', c: '#22c55e' }, decision: { n: 'تصمیم', c: '#a78bfa' }, next: { n: 'اقدام بعدی', c: '#38bdf8' }, approval: { n: 'تأیید', c: '#f5c55a' }, change: { n: 'تغییر', c: '#7c93c4' } };
  function addEntry(x, type, title, o) {
    x.entries.unshift(Object.assign({ id: uid(), t: Date.now(), type, date: keyOf(todayJ()), title: String(title).slice(0, 200), note: '', link: '', done: false }, o || {}));
    x.entries = x.entries.slice(0, 200);
  }
  function approve(id, how) {
    const x = find(id); if (!x) return;
    if (how === 'ok') { x.approved = true; addEntry(x, 'approval', 'تأیید میلاد ثبت شد'); log(x.agent, `میلاد «${x.title}» را تأیید کرد`); say('تأیید شد', 'ok'); }
    else { x.status = 'queue'; x.approved = false; addEntry(x, 'approval', 'برای اصلاح برگشت خورد'); log(x.agent, `«${x.title}» برای اصلاح برگشت خورد`); say('برگشت داده شد'); }
    x.updatedAt = Date.now(); save(); rerender();
  }
  function stageHTML(x) {
    return `<div class="it-stage ${x.stage ? '' : 'empty'}"><span class="st-l">📍 آخرین وضعیت</span><span class="st-t">${x.stage ? h(x.stage) : 'هنوز ثبت نشده — بنویس الان کجای کاری'}</span>${x.stageAt ? `<time>${ago(x.stageAt)}</time>` : ''}<button class="ag-mini st-e" data-stage="${x.id}" title="به‌روزرسانی آخرین وضعیت">✎</button></div>`;
  }
  function stageEdit(box, x, after) {
    if (!box || !x || box.classList.contains('editing')) return;
    box.classList.add('editing'); box.classList.remove('empty');
    box.innerHTML = `<span class="st-l">📍 آخرین وضعیت</span><input class="st-in" maxlength="220" value="${h(x.stage)}" placeholder="الان کجای کاری؟ مثلاً: صفحهٔ ورود آماده شد"><button class="ag-mini ok" data-st-ok>✓ ثبت</button><button class="ag-mini" data-st-no>✕</button>`;
    const inp = q('input', box); inp.focus(); inp.select();
    const done = ok => {
      if (ok) { const v = inp.value.trim(); if (v !== x.stage) { x.stage = v; x.stageAt = v ? Date.now() : 0; x.updatedAt = Date.now(); if (v) addEntry(x, 'change', 'آخرین وضعیت: ' + v); log(x.agent, `آخرین وضعیت «${x.title}»: ${v || '—'}`); save(); sfx('save'); say('آخرین وضعیت ثبت شد', 'ok'); } }
      rerender(); after && after();
    };
    inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); done(true); } if (e.key === 'Escape') { e.preventDefault(); done(false); } };
    q('[data-st-ok]', box).onclick = e => { e.stopPropagation(); done(true); };
    q('[data-st-no]', box).onclick = e => { e.stopPropagation(); done(false); };
  }

  /* ---------- board: views + filters (shared by main & agent pages) ---------- */
  const NEWVS = () => ({ mode: 'cards', q: '', st: '', pr: '', ag: '', flag: '', sort: 'smart', cmp: [] });
  const VS = { main: NEWVS(), agent: NEWVS() };
  const VIEWS = [['cards', 'کارت‌ها', '▦'], ['kanban', 'کانبان', '▥'], ['timeline', 'خط زمانی', '⟿'], ['table', 'جدول', '☰'], ['compare', 'مقایسه', '⇆']];
  const SORTS = { smart: 'هوشمند', dl: 'نزدیک‌ترین ددلاین', prog: 'کمترین پیشرفت', upd: 'آخرین به‌روزرسانی' };
  function sortL(l, s) {
    const f = { smart: (x, y) => (x.status === 'done') - (y.status === 'done') || PRIO[y.prio].w - PRIO[x.prio].w || (jOf(x.deadline) || 1e9) - (jOf(y.deadline) || 1e9),
      dl: (x, y) => (x.status === 'done') - (y.status === 'done') || (jOf(x.deadline) || 1e9) - (jOf(y.deadline) || 1e9),
      prog: (x, y) => (x.status === 'done') - (y.status === 'done') || x.progress - y.progress,
      upd: (x, y) => y.updatedAt - x.updatedAt }[s] || (() => 0);
    return l.slice().sort(f);
  }
  function filtered(scope, agentId) {
    const f = VS[scope]; let l = agentId ? itemsOf(agentId) : D.items.slice();
    if (!agentId && f.ag) l = l.filter(x => f.ag === 'grok' ? BY[x.agent].grok : f.ag === 'ext' ? BY[x.agent].ext : x.agent === f.ag);
    if (f.st) l = l.filter(x => x.status === f.st);
    if (f.pr) l = l.filter(x => x.prio === f.pr);
    if (f.flag === 'open') l = l.filter(x => x.status !== 'done');
    if (f.flag === 'appr') l = l.filter(x => x.approval && !x.approved && x.status !== 'done');
    if (f.flag === 'late') l = l.filter(isLate);
    if (f.flag === 'nostage') l = l.filter(x => !x.stage);
    if (f.flag === 'week') { l = l.filter(x => x.status !== 'done' && (x.prio === 'urgent' || x.prio === 'high') && (!x.deadline || jOf(x.deadline) <= todayJ() + 7)); }
    if (f.q) { const s = f.q.toLowerCase(); l = l.filter(x => [x.title, x.note, x.next, x.finish, x.stage, x.risk, BY[x.agent].fa, BY[x.agent].en].join(' ').toLowerCase().includes(s)); }
    return sortL(l, f.sort);
  }
  function boardBar(scope) {
    const f = VS[scope], sel = (k, v) => f[k] === v ? 'selected' : '';
    return `<div class="bd-bar glass">
      <div class="ag-tabs bd-views">${VIEWS.map(([k, n, i]) => `<button class="ag-tab ${f.mode === k ? 'on' : ''}" data-mode="${k}"><i>${i}</i> ${n}</button>`).join('')}</div>
      <label class="bd-q"><span>🔍</span><input type="search" data-bf="q" value="${h(f.q)}" placeholder="جست‌وجو در عنوان، آخرین وضعیت، قدم بعدی…"></label>
      <div class="bd-f">
      ${scope === 'main' ? `<select data-bf="ag" aria-label="ایجنت"><option value="">همهٔ ایجنت‌ها</option><option value="grok" ${sel('ag', 'grok')}>فقط Grokها</option><option value="ext" ${sel('ag', 'ext')}>فقط AIهای بیرونی</option>${AG.map(a => `<option value="${a.id}" ${sel('ag', a.id)}>${h(a.fa)}</option>`).join('')}</select>` : ''}
      <select data-bf="st" aria-label="وضعیت"><option value="">همهٔ وضعیت‌ها</option>${SORDER.map(s => `<option value="${s}" ${sel('st', s)}>${STAT[s].n}</option>`).join('')}</select>
      <select data-bf="pr" aria-label="اولویت"><option value="">همهٔ اولویت‌ها</option>${Object.entries(PRIO).map(([k, v]) => `<option value="${k}" ${sel('pr', k)}>${v.n}</option>`).join('')}</select>
      <select data-bf="flag" aria-label="فیلتر"><option value="">همهٔ موارد</option>${[['open', 'فقط باز'], ['appr', 'منتظر تأیید میلاد'], ['late', 'عقب از ددلاین'], ['nostage', 'بدون آخرین وضعیت'], ['week', '⚡ فوری‌های این هفته']].map(([k, n]) => `<option value="${k}" ${sel('flag', k)}>${n}</option>`).join('')}</select>
      <select data-bf="sort" aria-label="مرتب‌سازی">${Object.entries(SORTS).map(([k, n]) => `<option value="${k}" ${sel('sort', k)}>↕ ${n}</option>`).join('')}</select>
      <span class="bd-n" id="bd-n"></span></div>
    </div>`;
  }
  function viewHTML(scope, l, showAg) {
    if (!l.length) return '<div class="ag-empty big">با این فیلترها موردی پیدا نشد.</div>';
    const m = VS[scope].mode;
    if (m === 'kanban') return kanbanHTML(l, showAg);
    if (m === 'timeline') return timelineHTML(l, showAg);
    if (m === 'table') return tableHTML(l);
    if (m === 'compare') return compareHTML(scope, l);
    return `<div class="ag-items">${l.map(x => itemCard(x, showAg)).join('')}</div>`;
  }
  function wireBoard(view, scope, agentId) {
    const body = q('#ag-body', view);
    const paint = () => {
      const l = filtered(scope, agentId);
      body.innerHTML = agentId && !itemsOf(agentId).length ? '<div class="ag-empty big">هنوز پروژه‌ای برای این ایجنت ثبت نشده. از دکمهٔ «پروژهٔ جدید» یا نوار افزودن سریع استفاده کن.</div>' : viewHTML(scope, l, !agentId);
      const n = q('#bd-n', view); if (n) n.textContent = fa(l.length) + ' مورد';
      wireItems(body);
    };
    qa('[data-bf]', view).forEach(el => { const fn = () => { VS[scope][el.dataset.bf] = el.value; paint(); }; if (el.type === 'search') el.oninput = fn; else el.onchange = fn; });
    view.onclick = e => {
      const t = e.target;
      const g = t.closest('[data-go]'); if (g) { location.hash = '#/' + g.dataset.go; return; }
      const m = t.closest('[data-mode]'); if (m) { VS[scope].mode = m.dataset.mode; qa('[data-mode]', view).forEach(b => b.classList.toggle('on', b === m)); paint(); return; }
      const ap = t.closest('[data-appr]'); if (ap) { approve(ap.closest('[data-id]').dataset.id, ap.dataset.appr); return; }
      const sg = t.closest('[data-stage]'); if (sg) { stageEdit(sg.closest('.it-stage'), find(sg.dataset.stage)); return; }
      const dz = t.closest('[data-dossier]'); if (dz) { const x = find(dz.dataset.dossier); if (x) dossier(x); return; }
      const ed = t.closest('[data-edit]'); if (ed) { editor(find(ed.dataset.edit), agentId || find(ed.dataset.edit).agent); return; }
      const del = t.closest('[data-del]');
      if (del) { const x = find(del.dataset.del); if (x && confirm(`«${x.title}» حذف شود؟`)) { D.items = D.items.filter(i => i !== x); log(x.agent, `«${x.title}» حذف شد`); save(); sfx('del'); rerender(); } return; }
      const mv = t.closest('[data-move]');
      if (mv) { const x = find(mv.closest('[data-id]').dataset.id); const i = SORDER.indexOf(x.status) + (+mv.dataset.move); if (SORDER[i]) setStatus(x, SORDER[i]); return; }
      const tr = t.closest('tr[data-id]'); if (tr && !t.closest('button,a,input,select')) { const x = find(tr.dataset.id); if (x) dossier(x); }
    };
    view.onchange = e => {
      const c = e.target.closest && e.target.closest('[data-cmp]'); if (!c) return;
      const f = VS[scope]; f.cmp = c.checked ? [...new Set([...f.cmp, c.dataset.cmp])] : f.cmp.filter(i => i !== c.dataset.cmp); paint();
    };
    paint();
  }
  function wireItems(body) {
    qa('.it-card', body).forEach(c => {
      const x = find(c.dataset.id); if (!x) return;
      const r = q('input[type=range]', c), out = q('.it-pv', c);
      if (r) { r.oninput = () => { out.textContent = fa(r.value) + '٪'; r.style.setProperty('--v', r.value + '%'); }; r.onchange = () => { if (+r.value === 100 && x.progress < 100) celebrate(); x.progress = +r.value; if (x.progress === 100 && x.status !== 'done') x.status = 'done'; x.updatedAt = Date.now(); log(x.agent, `پیشرفت «${x.title}» به ${fa(x.progress)}٪ رسید`); save(); rerender(); }; }
      const st = q('select[data-f=status]', c); if (st) st.onchange = () => setStatus(x, st.value);
      const pr = q('select[data-f=prio]', c); if (pr) pr.onchange = () => { x.prio = pr.value; x.updatedAt = Date.now(); log(x.agent, `اولویت «${x.title}» ${PRIO[x.prio].n} شد`); save(); rerender(); };
      const ap = q('input[data-f=approval]', c); if (ap) ap.onchange = () => { x.approval = ap.checked; if (!ap.checked) x.approved = false; x.updatedAt = Date.now(); log(x.agent, `«${x.title}» ${ap.checked ? 'به صف تأیید میلاد رفت' : 'از صف تأیید خارج شد'}`); save(); rerender(); };
    });
    // kanban drag & drop (desktop); arrow buttons work everywhere
    let touchId = '';
    qa('.kb-card', body).forEach(c => {
      c.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', c.dataset.id); c.classList.add('drag'); });
      c.addEventListener('touchstart', () => { touchId = c.dataset.id; }, { passive: true });
    });
    qa('.kb-col', body).forEach(col => {
      col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('over'); });
      col.addEventListener('dragleave', () => col.classList.remove('over'));
      col.addEventListener('drop', e => { e.preventDefault(); const x = find(e.dataTransfer.getData('text/plain')); if (x) setStatus(x, col.dataset.st); });
      col.addEventListener('touchend', ev => { if (!touchId) return; const x = find(touchId); touchId = ''; if (x && col.dataset.st) setStatus(x, col.dataset.st); }, { passive: true });
    });
  }

  /* ---------- agent page ---------- */
  function renderAgent(view, id) {
    ensure(); destroy(); root = view; curAgent = id;
    const a = BY[id]; if (!a) { location.hash = '#/agents'; return; }
    if (lastAgent !== id) { const m = VS.agent.mode; VS.agent = NEWVS(); VS.agent.mode = m; lastAgent = id; }
    const l = sortL(itemsOf(id), 'smart');
    const open = l.filter(x => x.status !== 'done');
    view.innerHTML = `<div class="page ag-page ag-one" style="--c:${a.c}">
      <header class="ag-hero glass">
        <button class="icon-btn ag-home" data-go="agents" title="بازگشت به همهٔ ایجنت‌ها">→</button>
        ${avatar(a, 'xl')}
        <div class="agh-b"><h2>${h(a.fa)} <small>${h(a.en)}</small></h2><p>${h(a.role)}</p>
          <div class="agh-k"><span><b>${fa(l.length)}</b> پروژه</span><span><b>${fa(open.length)}</b> باز</span><span><b>${fa(l.filter(x => x.status === 'done').length)}</b> تمام‌شده</span><span><b>${fa(avg(open.length ? open : l))}٪</b> میانگین</span></div>
          <div class="ag-motto">«${MOTTO}»</div></div>
        <div class="agh-ch glass"><canvas id="ch-one"></canvas></div>
      </header>
      <div class="ag-bar">
        <button class="btn ag-add" id="ag-new">＋ پروژه / ایدهٔ جدید</button>
        <div class="ag-jump">${AG.map(x => `<a href="#/agent/${x.id}" class="${x.id === id ? 'on' : ''}" title="${h(x.fa)}">${avatar(x, 'xs')}</a>`).join('')}</div>
      </div>
      ${boardBar('agent')}
      <div id="ag-body"></div>
      <section class="ag-two"><div class="glass ag-hist"><h4>🕘 تاریخچهٔ ${h(a.fa)}</h4>${histHTML(id)}</div></section>
    </div>`;
    wireBoard(view, 'agent', id);
    q('#ag-new', view).onclick = () => editor(null, id);
    if (CH() && l.length) {
      chartDefaults();
      charts.push(new Chart(q('#ch-one', view), { type: 'bar', data: { labels: l.map(x => x.title.length > 18 ? x.title.slice(0, 17) + '…' : x.title), datasets: [{ label: 'پیشرفت ٪', data: l.map(x => x.progress), backgroundColor: l.map(x => STAT[x.status].c + 'cc'), borderRadius: 6 }] }, options: { indexAxis: 'y', maintainAspectRatio: false, scales: { x: { min: 0, max: 100, grid: { color: grid } }, y: { position: 'right', grid: { display: false } } }, plugins: { legend: { display: false }, tooltip: { rtl: true } } } }));
    }
  }
  function setStatus(x, s) {
    if (x.status === s) return;
    if (s === 'done' && x.progress < 100) celebrate(); x.status = s; if (s === 'done') x.progress = 100; x.updatedAt = Date.now();
    addEntry(x, 'change', `وضعیت → ${STAT[s].n}`);
    log(x.agent, `وضعیت «${x.title}» → ${STAT[s].n}`); save(); if (s === 'done') { sfx('save'); say('تمومش کردی! حالا وقت بهترکردنه 💪', 'ok'); } rerender();
  }
  function linkHTML(x) { return x.link ? `<a class="it-link" href="${h(x.link)}" target="_blank" rel="noopener noreferrer">🔗 باز کردن لینک</a>` : ''; }
  const agTag = a => `<span class="it-ag" style="--c:${a.c}">${avatar(a, 'xs')}${h(a.fa)}</span>`;
  function itemCard(x, showAg) {
    const late = isLate(x), a = BY[x.agent];
    return `<article class="it-card glass ${x.status} ${late ? 'late' : ''}" data-id="${x.id}" style="--p:${PRIO[x.prio].c}">
      <div class="it-top">${showAg ? agTag(a) : ''}<h4><button class="it-tt" data-dossier="${x.id}" title="مشاهدهٔ پرونده">${h(x.title)}</button></h4>${x.approval ? (x.approved ? '<span class="ag-chip" style="--c:#22c55e">✔ تأییدشده</span>' : '<span class="ag-chip" style="--c:#ff2e4d">منتظر تأیید میلاد</span>') : ''}</div>
      ${stageHTML(x)}
      <div class="it-row"><label>وضعیت <select data-f="status">${optsS(x.status)}</select></label><label>اولویت <select data-f="prio">${optsP(x.prio)}</select></label>${dlChip(x.deadline, x.status === 'done')}</div>
      <div class="it-prog"><input type="range" min="0" max="100" step="5" value="${x.progress}" style="--v:${x.progress}%" aria-label="پیشرفت"><b class="it-pv">${fa(x.progress)}٪</b></div>
      ${x.next ? `<div class="it-f nx"><span>⏭ قدم بعدی</span>${h(x.next)}</div>` : ''}
      ${x.finish ? `<div class="it-f"><span>🏁 معیار پایان</span>${h(x.finish)}</div>` : ''}
      ${x.deps ? `<div class="it-f"><span>🔗 وابستگی</span>${h(x.deps)}</div>` : ''}
      ${x.risk ? `<div class="it-f risk"><span>⚠ ریسک</span>${h(x.risk)}</div>` : ''}
      ${x.note ? `<div class="it-note">${h(x.note)}</div>` : ''}
      <div class="it-foot">${linkHTML(x)}<label class="it-tg"><input type="checkbox" data-f="approval" ${x.approval ? 'checked' : ''}><i></i>نیاز به تأیید میلاد</label><span class="sp"></span><button class="ag-mini dz-b" data-dossier="${x.id}">📂 پرونده${x.entries.length ? ' · ' + fa(x.entries.length) : ''}</button><button class="ag-mini" data-edit="${x.id}">✎ ویرایش</button><button class="ag-mini no" data-del="${x.id}">🗑 حذف</button></div>
    </article>`;
  }
  function kanbanHTML(l, showAg) {
    return `<div class="kb">${SORDER.map(s => { const c = l.filter(x => x.status === s); return `<div class="kb-col" data-st="${s}" style="--c:${STAT[s].c}"><h5>${STAT[s].n} <span>${fa(c.length)}</span></h5>
      ${c.map(x => `<div class="kb-card" draggable="true" data-id="${x.id}" style="--p:${PRIO[x.prio].c}">${showAg ? agTag(BY[x.agent]) : ''}<b>${h(x.title)}</b><div class="kb-m">${chip(PRIO[x.prio])}<span>${fa(x.progress)}٪</span></div><div class="kb-pb"><i style="width:${x.progress}%"></i></div>${x.stage ? `<small class="kb-st">📍 ${h(x.stage)}</small>` : ''}${dlChip(x.deadline, s === 'done')}${x.next ? `<small>⏭ ${h(x.next)}</small>` : ''}
        <div class="kb-mv"><button class="ag-mini" data-move="-1" ${s === 'queue' ? 'disabled' : ''} title="مرحلهٔ قبل">→</button><button class="ag-mini" data-dossier="${x.id}" title="پرونده">📂</button><button class="ag-mini" data-edit="${x.id}" title="ویرایش">✎</button><button class="ag-mini" data-move="1" ${s === 'done' ? 'disabled' : ''} title="مرحلهٔ بعد">←</button></div></div>`).join('') || '<div class="ag-empty">—</div>'}</div>`; }).join('')}</div>`;
  }
  function timelineHTML(l, showAg) {
    const tj = todayJ(), withD = l.filter(x => x.deadline), noD = l.filter(x => !x.deadline);
    const SJ = x => { const d = new Date(x.createdAt); return T().g2d(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
    const js = withD.map(x => jOf(x.deadline)), starts = withD.map(SJ);
    const lo = Math.min(tj, ...starts) - 2, hi = Math.max(tj + 7, ...js) + 2, span = hi - lo, P = j => ((j - lo) / span * 100).toFixed(2);
    const ticks = []; for (let j = lo; j <= hi; j++) { const [, , d] = T().d2j(j); if (d === 1 || j === lo) ticks.push(`<i style="right:${P(j)}%"><span>${fmtK(keyOf(j)).replace(/ \S+$/, '')}</span></i>`); }
    const sorted = withD.slice().sort((a, b) => jOf(a.deadline) - jOf(b.deadline));
    const ev = l.flatMap(x => x.entries.map(e => ({ e, x }))).sort((a, b) => (b.e.date || '').localeCompare(a.e.date || '') || b.e.t - a.e.t).slice(0, 30);
    return `<div class="tl glass"><div class="tl-scale">${ticks.join('')}<b class="tl-now" style="right:${P(tj)}%"><span>امروز</span></b></div>
      ${sorted.map(x => { const s = Math.min(SJ(x), jOf(x.deadline)), e = jOf(x.deadline); return `<div class="tl-row"><span class="tl-n">${showAg ? avatar(BY[x.agent], 'xs') : ''}${h(x.title)}</span><div class="tl-track"><div class="tl-bar ${x.status}" style="right:${P(s)}%;width:${Math.max(1.5, (e - s) / span * 100)}%;--p:${PRIO[x.prio].c}"><i style="width:${x.progress}%"></i><em>${fa(x.progress)}٪ · ${fmtK(x.deadline)}</em></div></div></div>`; }).join('')}
      ${noD.length ? `<div class="tl-nod">بدون ددلاین: ${noD.map(x => h(x.title)).join(' · ')}</div>` : ''}</div>
      <div class="tl-ev">
        <div class="glass"><h5>⏭ قدم‌های تاریخ‌دار</h5>${sorted.filter(x => x.status !== 'done').map(x => `<div class="tl-e ${isLate(x) ? 'late' : ''}" data-dossier="${x.id}"><time>${fmtK(x.deadline)}</time><b>${showAg ? avatar(BY[x.agent], 'xs') : ''}${h(x.title)}</b><span>${h(x.next || '—')}</span></div>`).join('') || '<div class="ag-empty">قدم تاریخ‌داری نیست</div>'}</div>
        <div class="glass"><h5>🗂 رویدادهای ثبت‌شده</h5>${ev.map(({ e, x }) => `<div class="tl-e" style="--c:${ETYPE[e.type].c}" data-dossier="${x.id}"><time>${e.date ? fmtK(e.date) : ''}</time><b>${chip(ETYPE[e.type])} ${h(x.title)}</b><span>${h(e.title)}</span></div>`).join('') || '<div class="ag-empty">هنوز رویدادی ثبت نشده — از «📂 پرونده ← ثبت مورد» استفاده کن</div>'}</div>
      </div>`;
  }
  function tableHTML(l) {
    return `<div class="tbw glass"><table class="ag-tb"><thead><tr><th>ایجنت</th><th>پروژه</th><th>📍 آخرین وضعیت</th><th>وضعیت</th><th>اولویت</th><th>پیشرفت</th><th>ددلاین</th><th>⏭ قدم بعدی</th><th></th></tr></thead><tbody>
    ${l.map(x => { const a = BY[x.agent]; return `<tr data-id="${x.id}" class="${isLate(x) ? 'late' : ''} ${x.status}" style="--c:${a.c}"><td class="tb-a">${avatar(a, 'xs')}<span>${h(a.fa)}</span></td><td><b>${h(x.title)}</b>${x.approval && !x.approved && x.status !== 'done' ? ' <span class="ag-chip" style="--c:#ff2e4d">تأیید</span>' : ''}</td><td class="tb-st">${x.stage ? h(x.stage) : '<em>—</em>'}${x.stageAt ? `<time>${ago(x.stageAt)}</time>` : ''}</td><td>${chip(STAT[x.status])}</td><td>${chip(PRIO[x.prio])}</td><td class="tb-pc"><div class="tb-p"><i style="width:${x.progress}%;background:${STAT[x.status].c}"></i></div><span>${fa(x.progress)}٪</span></td><td>${dlChip(x.deadline, x.status === 'done')}</td><td class="tb-nx">${x.next ? h(x.next) : '—'}</td><td><button class="ag-mini" data-dossier="${x.id}" title="پرونده">📂</button></td></tr>`; }).join('')}</tbody></table></div>`;
  }
  function compareHTML(scope, l) {
    const f = VS[scope]; f.cmp = f.cmp.filter(id => D.items.some(x => x.id === id));
    const sel = f.cmp.map(find).filter(Boolean);
    const row = (k, v) => `<div class="cmp-r"><span>${k}</span><div>${v}</div></div>`;
    return `<div class="cmp glass"><p class="cmp-h">⇆ پروژه‌ها رو برای مقایسه انتخاب کن (حداقل دو تا):</p>
      <div class="cmp-pick">${l.map(x => `<label class="cmp-c ${f.cmp.includes(x.id) ? 'on' : ''}" style="--c:${BY[x.agent].c}"><input type="checkbox" data-cmp="${x.id}" ${f.cmp.includes(x.id) ? 'checked' : ''}>${avatar(BY[x.agent], 'xs')}${h(x.title)}</label>`).join('')}</div>
      ${sel.length < 2 ? '<div class="ag-empty">حداقل دو پروژه انتخاب کن — پیشرفت، وضعیت، آخرین وضعیت، قدم بعدی و معیار پایان کنار هم نمایش داده می‌شن.</div>' :
      `<div class="cmp-grid" style="--n:${sel.length}">${sel.map(x => { const a = BY[x.agent]; return `<div class="cmp-col" style="--c:${a.c}"><div class="cmp-t">${avatar(a, 'sm')}<div><b>${h(x.title)}</b><small>${h(a.fa)}</small></div></div>
        ${row('وضعیت', chip(STAT[x.status]))}${row('اولویت', chip(PRIO[x.prio]))}
        ${row('پیشرفت', `<div class="dz-bar"><i style="width:${x.progress}%"></i></div><b>${fa(x.progress)}٪</b>`)}
        ${row('📍 آخرین وضعیت', x.stage ? h(x.stage) : '—')}${row('⏭ قدم بعدی', x.next ? h(x.next) : '—')}${row('🏁 معیار پایان', x.finish ? h(x.finish) : '—')}
        ${row('📅 ددلاین', dlChip(x.deadline, x.status === 'done'))}${row('⚠ ریسک', x.risk ? h(x.risk) : '—')}${row('🗂 ثبت‌ها', fa(x.entries.length))}
        <button class="ag-mini dz-b" data-dossier="${x.id}">📂 پرونده</button></div>`; }).join('')}</div>`}</div>`;
  }

  /* ---------- dossier (project file) ---------- */
  const DTABS = [['sum', 'خلاصه'], ['task', 'وظایف'], ['output', 'خروجی‌ها'], ['decision', 'تصمیم‌ها'], ['approval', 'تأییدها'], ['hist', 'تاریخچه']];
  function dossier(x, tab = 'sum', formOpen = false) {
    const a = BY[x.agent];
    const E = x.entries.slice().sort((p, r) => (r.date || '').localeCompare(p.date || '') || r.t - p.t);
    const ent = e => `<div class="dz-e ${e.done ? 'dn' : ''}" style="--c:${ETYPE[e.type].c}"><div class="dz-eh">${e.type === 'task' || e.type === 'next' ? `<label class="dz-ck" title="انجام شد"><input type="checkbox" data-etask="${e.id}" ${e.done ? 'checked' : ''}></label>` : ''}${chip(ETYPE[e.type])}<time>${e.date ? fmtK(e.date) : ''}</time><span class="sp"></span><button class="ag-mini no" data-edel="${e.id}" title="حذف این مورد">✕</button></div><b>${h(e.title)}</b>${e.note ? `<p>${h(e.note)}</p>` : ''}${e.link ? `<a class="it-link" href="${h(e.link)}" target="_blank" rel="noopener noreferrer">🔗 پیوند مرتبط</a>` : ''}</div>`;
    const of = (types, empty) => { const l = E.filter(e => types.includes(e.type)); return l.length ? l.map(ent).join('') : `<div class="ag-empty">${empty}</div>`; };
    const openAp = x.approval && !x.approved && x.status !== 'done';
    let body = '';
    if (tab === 'sum') body = `<div class="dz-prog"><span>پیشرفت ثبت‌شده</span><b>${fa(x.progress)}٪</b><div class="dz-bar"><i style="width:${x.progress}%"></i></div></div>
      ${stageHTML(x)}
      <div class="dz-grid">${[['⏭ قدم بعدی', x.next], ['🏁 معیار پایان — ' + MOTTO, x.finish], ['⚠ ریسک', x.risk], ['🔗 وابستگی', x.deps], ['📅 ددلاین', x.deadline ? fmtK(x.deadline) : ''], ['🏷 اولویت / وضعیت', PRIO[x.prio].n + ' · ' + STAT[x.status].n]].map(([k, v]) => `<div class="dz-f"><span>${k}</span>${v ? h(v) : '<em>—</em>'}</div>`).join('')}</div>
      ${x.note ? `<div class="it-note">${h(x.note)}</div>` : ''}${x.link ? linkHTML(x) : ''}
      <h5>خروجی‌های اخیر</h5>${E.filter(e => e.type === 'output').slice(0, 3).map(ent).join('') || '<div class="ag-empty">هنوز خروجی‌ای ثبت نشده.</div>'}
      <h5>تأییدهای باز میلاد</h5>${openAp ? `<div class="ap-row" data-id="${x.id}" style="--c:${a.c}">${avatar(a, 'sm')}<div class="ap-b"><b>${h(x.title)}</b><small>${fa(x.progress)}٪${x.next ? ' · قدم بعدی: ' + h(x.next) : ''}</small></div><button class="ag-mini ok" data-appr="ok">تأیید</button><button class="ag-mini no" data-appr="no">برگشت</button></div>` : '<div class="ag-empty">موردی برای تأیید باز نیست.</div>'}`;
    else if (tab === 'task') body = of(['task', 'next'], 'وظیفه‌ای ثبت نشده — از «＋ ثبت مورد» استفاده کن.');
    else if (tab === 'output') body = of(['output'], 'خروجی‌ای ثبت نشده.');
    else if (tab === 'decision') body = of(['decision'], 'تصمیمی ثبت نشده.');
    else if (tab === 'approval') body = of(['approval'], 'سابقهٔ تأییدی ثبت نشده.');
    else body = E.length ? E.map(ent).join('') : '<div class="ag-empty">هنوز موردی ثبت نشده.</div>';
    const cnt = t => { const n = t === 'sum' ? 0 : t === 'hist' ? E.length : E.filter(e => t === 'task' ? (e.type === 'task' || e.type === 'next') : e.type === t).length; return n ? ` <i>${fa(n)}</i>` : ''; };
    const m = openModal(`<div class="ag-dz" style="--c:${a.c}">
      <div class="dz-h">${avatar(a, 'lg')}<div><small>${h(a.fa)} · ${h(a.role)}</small><h3>${h(x.title)}</h3>${chip(STAT[x.status])} ${chip(PRIO[x.prio])}</div></div>
      <div class="dz-acts"><button class="ag-mini" data-dz="edit">✎ ویرایش پروژه</button><button class="ag-mini" data-dz="copy">⧉ کپی قالب</button><button class="btn ag-add sm" data-dz="log">＋ ثبت مورد</button></div>
      ${formOpen ? `<form class="ag-form dz-form glass" autocomplete="off">
        <label><span>نوع ثبت</span><select name="type">${Object.entries(ETYPE).map(([k, v]) => `<option value="${k}">${v.n}</option>`).join('')}</select></label>
        <label><span>تاریخ ثبت</span>${dateSel('ed', keyOf(todayJ()))}</label>
        <label class="full"><span>عنوان</span><input name="title" required maxlength="200"></label>
        <label class="full"><span>یادداشت</span><textarea name="note" rows="2" maxlength="600"></textarea></label>
        <label class="full"><span>پیوند مرتبط (اختیاری)</span><input name="link" dir="ltr" placeholder="https://…"></label>
        <div class="full ag-f-btns"><button class="btn ag-add" type="submit">ذخیرهٔ مورد</button><button class="btn ghost" type="button" data-dz="nolog">بستن فرم</button></div></form>` : ''}
      <div class="dz-tabs">${DTABS.map(([k, n]) => `<button class="ag-tab ${tab === k ? 'on' : ''}" data-dt="${k}">${n}${cnt(k)}</button>`).join('')}</div>
      <div class="dz-body">${body}</div></div>`, 'ag-modal dz-modal');
    const again = (t = tab, f = false) => dossier(find(x.id) || x, t, f);
    if (formOpen) {
      const f = q('.dz-form', m); wireDate(f); setTimeout(() => f.title.focus(), 50);
      f.onsubmit = e => {
        e.preventDefault(); const title = f.title.value.trim(); if (!title) return;
        const raw = f.link.value.trim(), link = cleanLink(raw); if (raw && !link) { say('لینک معتبر نیست'); return; }
        const type = f.type.value; addEntry(x, type, title, { date: readDate(f, 'ed') || keyOf(todayJ()), note: f.note.value.trim(), link });
        if (type === 'next') x.next = title;
        x.updatedAt = Date.now(); log(x.agent, `${ETYPE[type].n} برای «${x.title}» ثبت شد: ${title}`); save(); sfx('save'); say('مورد ثبت شد', 'ok'); rerender();
        again(type === 'next' ? 'task' : DTABS.some(d => d[0] === type) ? type : 'hist');
      };
    }
    m.onclick = e => {
      const t = e.target;
      const dt = t.closest('[data-dt]'); if (dt) { again(dt.dataset.dt, formOpen); return; }
      const d = t.closest('[data-dz]');
      if (d) {
        const k = d.dataset.dz;
        if (k === 'log') again(tab, true); else if (k === 'nolog') again(tab, false);
        else if (k === 'edit') { closeModal(); editor(x, x.agent); }
        else if (k === 'copy') { const c = mk({ agent: x.agent, title: x.title.replace(/ \(نمونه\)$/, '') + ' (کپی)', prio: x.prio, finish: x.finish, deps: x.deps, risk: x.risk, next: x.next, note: x.note, link: x.link }); D.items.unshift(c); log(c.agent, `«${c.title}» از روی قالب ساخته شد`); save(); sfx('save'); say('کپی ساخته شد — حالا ویرایشش کن', 'ok'); rerender(); closeModal(); editor(c, c.agent); }
        return;
      }
      const ap = t.closest('[data-appr]'); if (ap) { approve(x.id, ap.dataset.appr); again('sum'); return; }
      const sg = t.closest('[data-stage]'); if (sg) { stageEdit(sg.closest('.it-stage'), x, () => again('sum')); return; }
      const ed = t.closest('[data-edel]'); if (ed) { if (confirm('این مورد حذف شود؟')) { x.entries = x.entries.filter(e => e.id !== ed.dataset.edel); save(); rerender(); again(tab, formOpen); } return; }
    };
    m.onchange = e => { const ck = e.target.closest && e.target.closest('[data-etask]'); if (!ck) return; const en = x.entries.find(i => i.id === ck.dataset.etask); if (en) { en.done = ck.checked; if (ck.checked) log(x.agent, `وظیفهٔ «${en.title}» انجام شد`); save(); rerender(); again(tab, formOpen); } };
  }
  function editor(x, agentId) {
    const n = !x; x = x || mk({ agent: agentId });
    const m = openModal(`<h3 class="ag-m-t">${n ? 'پروژه / ایدهٔ جدید' : 'ویرایش'}</h3>
      <form class="ag-form" autocomplete="off">
        <label class="full"><span>عنوان</span><input name="title" required maxlength="140" value="${h(x.title)}"></label>
        <label><span>ایجنت</span><select name="agent">${optsA(x.agent)}</select></label>
        <label><span>وضعیت</span><select name="status">${optsS(x.status)}</select></label>
        <label><span>اولویت</span><select name="prio">${optsP(x.prio)}</select></label>
        <label><span>پیشرفت ٪</span><input name="progress" type="number" min="0" max="100" step="5" value="${x.progress}"></label>
        <label class="full"><span>ددلاین (شمسی)</span>${dateSel('dl', x.deadline)}</label>
        <label class="full"><span>لینک</span><input name="link" dir="ltr" value="${h(x.link)}" placeholder="https://…"></label>
        <label class="full"><span>📍 آخرین وضعیت (الان کجای کاری؟)</span><input name="stage" maxlength="220" value="${h(x.stage)}"></label>
        <label class="full"><span>قدم بعدی</span><input name="next" maxlength="200" value="${h(x.next)}"></label>
        <label class="full"><span>معیار پایان — ${MOTTO}</span><input name="finish" maxlength="200" value="${h(x.finish)}"></label>
        <label><span>وابستگی</span><input name="deps" maxlength="200" value="${h(x.deps)}"></label>
        <label><span>ریسک</span><input name="risk" maxlength="200" value="${h(x.risk)}"></label>
        <label class="full"><span>یادداشت</span><textarea name="note" rows="2" maxlength="600">${h(x.note)}</textarea></label>
        <label class="it-tg full"><input type="checkbox" name="approval" ${x.approval ? 'checked' : ''}><i></i>نیاز به تأیید میلاد</label>
        <div class="full ag-f-btns"><button class="btn ag-add" type="submit">ذخیره</button><button class="btn ghost" type="button" data-close>انصراف</button></div>
      </form>`, 'ag-modal');
    wireDate(m);
    q('form', m).onsubmit = e => {
      e.preventDefault(); const f = e.target, title = f.title.value.trim(); if (!title) return;
      const raw = f.link.value.trim(), link = cleanLink(raw); if (raw && !link) { say('لینک معتبر نیست'); return; }
      Object.assign(x, { title, agent: f.agent.value, status: f.status.value, prio: f.prio.value, progress: Math.max(0, Math.min(100, Math.round(+f.progress.value || 0))), deadline: readDate(f, 'dl'), link, next: f.next.value.trim(), finish: f.finish.value.trim(), deps: f.deps.value.trim(), risk: f.risk.value.trim(), note: f.note.value.trim(), approval: f.approval.checked, updatedAt: Date.now() });
      const sv = f.stage.value.trim(); if (sv !== x.stage) { x.stage = sv; x.stageAt = sv ? Date.now() : 0; if (sv && !n) addEntry(x, 'change', 'آخرین وضعیت: ' + sv); }
      if (!x.approval) x.approved = false; if (x.status === 'done') x.progress = 100;
      if (n) D.items.unshift(x); log(x.agent, n ? `«${x.title}» اضافه شد` : `«${x.title}» ویرایش شد`);
      save(); sfx('save'); closeModal(); say('ذخیره شد', 'ok'); rerender();
    };
  }

  return {
    AG,
    renderMain: v => { curAgent = null; renderMain(v); },
    renderAgent: (v, id) => renderAgent(v, id),
    destroy,
    data: () => { ensure(); return D; },
    importData: v => { if (v && v.version) { D = normalize(v); save(); } },
    reset: () => { D = seed(); save(); },
    addItem: o => { ensure(); const x = mk(Object.assign({ progress: 25 }, o)); D.items.unshift(x); log(x.agent, `«${x.title}» از صندوق ورودی اضافه شد`); save(); return x; },
    setFilter: (scope, o) => { Object.assign(VS[scope], o); },
    getFilter: scope => JSON.parse(JSON.stringify(VS[scope])),
    clearSamples: () => { ensure(); const n = D.items.filter(x => x.sample).length; D.items = D.items.filter(x => !x.sample); save(); return n; },
  };
})();
