/* Extras (Phase B): unified inbox, Ctrl+K palette & global search, morning plan / evening review,
   focus mode, shortcuts, saved filters, recurring tasks + reminders, low-power mode.
   Offline only. Data in STORE under mss_extras_v1. No financial data here. */
window.Extras = (() => {
  const K = 'mss_extras_v1';
  const h = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fa = n => Number(n).toLocaleString('fa-IR');
  const T = () => Daily._t, DA = () => Daily.api;
  const id = () => 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const blank = () => ({ version: 1, inbox: [], rituals: {}, recur: [], saved: [], prefs: { lowpower: null } });
  function norm(v) {
    const d = blank(); if (!v || typeof v !== 'object') return d;
    d.inbox = Array.isArray(v.inbox) ? v.inbox.filter(x => x && typeof x.text === 'string').map(x => ({ id: x.id || id(), text: x.text.slice(0, 300), note: String(x.note || '').slice(0, 1000), source: String(x.source || '').slice(0, 80), kind: x.kind || 'note', file: x.file && x.file.name ? { name: String(x.file.name).slice(0, 120), type: String(x.file.type || ''), size: +x.file.size || 0, data: x.file.data && String(x.file.data).length < 550000 ? x.file.data : '' } : null, at: +x.at || Date.now() })) : [];
    d.rituals = v.rituals && typeof v.rituals === 'object' ? v.rituals : {};
    d.recur = Array.isArray(v.recur) ? v.recur.filter(r => r && typeof r.title === 'string').map(r => ({ id: r.id || id(), title: r.title.slice(0, 140), days: Array.isArray(r.days) ? r.days.filter(n => n >= 0 && n < 7) : [0, 1, 2, 3, 4, 5, 6], time: /^\d\d:\d\d$/.test(r.time) ? r.time : '', last: r.last || '', notified: r.notified || '' })) : [];
    d.saved = Array.isArray(v.saved) ? v.saved.filter(x => x && x.name && x.f).slice(0, 20) : [];
    d.prefs = Object.assign({ lowpower: null, dash: { notes: true, feat: true, cats: true, bottom: true } }, v.prefs || {});
    return d;
  }
  let D; try { D = norm(JSON.parse(STORE.getItem(K))); } catch (e) { D = blank(); }
  const save = () => { try { STORE.setItem(K, JSON.stringify(D)); } catch (e) { } };
  const say = (m, t) => { try { toast(m, t); } catch (e) { } };
  const snd = n => { try { SFX[n] && SFX[n](); } catch (e) { } };
  const todayK = () => T().keyOf(T().todayJ());
  const rit = k => D.rituals[k] || (D.rituals[k] = { top: [], review: '', reviewed: false });
  const WD = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
  const satIdx = () => { const g = new Date().getDay(); return (g + 1) % 7; };

  /* ---------- low power ---------- */
  const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
  function applyLow() {
    const on = D.prefs.lowpower == null ? reduceMQ.matches : !!D.prefs.lowpower;
    document.body.classList.toggle('lowpower', on);
    try { Sky.setSpeed(document.body.classList.contains('focus-on') ? .25 : on ? .35 : 1); } catch (e) { }
    return on;
  }
  function toggleLow() { D.prefs.lowpower = !document.body.classList.contains('lowpower'); save(); const on = applyLow(); say(on ? 'حالت کم‌مصرف روشن شد 🌙' : 'حالت کم‌مصرف خاموش شد', 'ok'); }

  /* ---------- dock ---------- */
  function dock() {
    if (document.getElementById('xdock')) return;
    const d = document.createElement('div'); d.id = 'xdock'; d.className = 'xdock';
    d.innerHTML = `<button data-x="cap" data-snd="1" title="ثبت سریع در صندوق ورودی (N)">📥<i id="xd-n"></i></button><button data-x="pal" data-snd="1" title="جستجو و فرمان‌ها (Ctrl+K)">⌘</button><button data-x="plan" data-snd="1" title="برنامهٔ صبح / مرور شب">☀️</button><button data-x="focus" data-snd="1" title="حالت تمرکز (F)">🎯</button><button data-x="help" data-snd="1" title="میان‌برها (?)">?</button>`;
    document.body.appendChild(d);
    d.onclick = e => { const b = e.target.closest('[data-x]'); if (!b) return; snd('click'); ({ cap: capture, pal: palette, plan: () => go('plan'), focus: focus, help: help })[b.dataset.x](); };
    badge();
  }
  const badge = () => { const n = document.getElementById('xd-n'); if (n) n.textContent = D.inbox.length ? fa(D.inbox.length) : ''; };

  /* ---------- inbox ---------- */
  function capture() {
    openModal(`<h3>📥 ثبت سریع</h3><p class="x-sub">ایده، کار یا تراکنش را همین‌جا ثبت کن.</p>
      <form id="x-cap" class="x-form">
        <div class="fin-seg x-kind" id="x-kind"><button type="button" data-k="note" class="on">صندوق</button><button type="button" data-k="tx">تراکنش</button></div>
        <input name="t" required maxlength="300" placeholder="ایده، کار، یادداشت…" autocomplete="off">
        <textarea name="n" rows="2" maxlength="1000" placeholder="توضیح (اختیاری)"></textarea>
        <input name="source" maxlength="80" placeholder="منبع (اختیاری)">
        <label class="x-file">ضمیمه (اختیاری، تا ۴۰۰ کیلوبایت)<input type="file" name="f"></label>
        <div class="x-tx hidden" id="x-tx">
          <div class="fin-seg" id="x-ty"><button type="button" data-v="out" class="on">هزینه</button><button type="button" data-v="in">درآمد</button></div>
          <input name="amt" inputmode="decimal" placeholder="مبلغ (تومان)" class="ltr">
        </div>
        <div class="x-btns"><button class="btn" type="submit">ثبت</button><button class="btn ghost" type="button" data-x-inbox>مشاهدهٔ صندوق (${fa(D.inbox.length)})</button></div></form>`, 'x-modal');
    const f = document.getElementById('x-cap'); f.t.focus();
    let kind = 'note';
    f.querySelector('#x-kind').onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; kind = b.dataset.k; $$('#x-kind button').forEach(x => x.classList.toggle('on', x === b)); f.querySelector('#x-tx').classList.toggle('hidden', kind !== 'tx'); };
    f.querySelector('#x-ty').onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; $$('#x-ty button').forEach(x => x.classList.toggle('on', x === b)); };
    f.onsubmit = async e => {
      e.preventDefault();
      const text = f.t.value.trim(); if (!text) return;
      if (kind === 'tx') {
        if (!window.Finance || !Finance.addManual) { say('ماژول مالی در دسترس نیست'); return; }
        if (window.FinLock && !FinLock.ok()) { say('اول قفل مالی را باز کنید'); return; }
        const typ = (f.querySelector('#x-ty button.on') || {}).dataset.v || 'out';
        const r = Finance.addManual({ desc: text, amount: f.amt.value, type: typ, source: f.source.value.trim() || 'ثبت سریع' });
        if (!r || !r.ok) { snd('error'); say('تاریخ یا مبلغ نامعتبر است'); return; }
        snd('cash'); closeModal(); say('تراکنش ثبت شد ✓', 'ok'); return;
      }
      const item = { id: id(), text, note: f.n.value.trim(), source: f.source.value.trim(), kind: 'note', file: null, at: Date.now() };
      const file = f.f && f.f.files && f.f.files[0];
      if (file) {
        if (file.size > 400 * 1024) { say('فایل بزرگ‌تر از ۴۰۰ کیلوبایت است؛ فقط نام آن ذخیره شد'); item.file = { name: file.name, type: file.type, size: file.size, data: '' }; }
        else { item.file = { name: file.name, type: file.type, size: file.size, data: await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(''); r.readAsDataURL(file); }) }; }
      }
      D.inbox.unshift(item); save(); badge(); snd('save'); closeModal(); say('در صندوق ورودی ثبت شد ✓', 'ok'); if (currentRoute === 'inbox') render();
    };
    f.querySelector('[data-x-inbox]').onclick = () => { closeModal(); go('inbox'); };
  }
  function renderInbox(view) {
    const cats = Object.values(CATS), ags = window.Agents ? Agents.AG : [];
    view.innerHTML = `${topbar('صندوق ورودی', '')}<main class="page x-page">
      <section class="glass x-hero"><h2>📥 صندوق ورودی واحد</h2><p>همه‌چیز اول اینجا؛ بعد هر مورد را به <b>پروژه</b>، یک <b>روز</b> در امور روزانه یا یک <b>ایجنت</b> بفرست.</p>
        <form id="x-inq" class="x-inline"><input name="t" maxlength="300" placeholder="ثبت سریع… (Enter)" autocomplete="off"><input name="source" maxlength="80" placeholder="منبع"><button class="btn">＋ ثبت</button></form></section>
      <section class="x-list">${D.inbox.length ? D.inbox.map(x => `<article class="glass x-it" data-id="${x.id}">
        <div class="x-it-h"><b>${h(x.text)}</b><time>${new Date(x.at).toLocaleDateString('fa-IR')}</time></div>${x.note ? `<p>${h(x.note)}</p>` : ''}${x.source ? `<p class="x-src">منبع: ${h(x.source)}</p>` : ''}${x.file ? `<p class="x-src">پیوست: ${h(x.file.name)}</p>` : ''}
        <div class="x-route">
          <label>📁 <select data-r="proj"><option value="">به پروژه…</option>${cats.map(c => `<option value="${c.key}">${h(c.icon || '')} ${h(c.name)}</option>`).join('')}</select></label>
          <label>📅 <select data-r="day"><option value="">به روز…</option><option value="0">امروز</option><option value="1">فردا</option><option value="2">پس‌فردا</option><option value="7">هفتهٔ بعد</option></select></label>
          <label>🤖 <select data-r="agent"><option value="">به ایجنت…</option>${ags.map(a => `<option value="${a.id}">${h(a.fa)}</option>`).join('')}</select></label>
          <button class="ag-mini no" data-del>🗑</button></div></article>`).join('') : '<div class="glass x-empty">صندوق خالی است ✨ — با <kbd>N</kbd> یا دکمهٔ 📥 هر جا چیزی ثبت کن.</div>'}</section></main>`;
    const fq = view.querySelector('#x-inq'); fq.onsubmit = e => { e.preventDefault(); const t = fq.t.value.trim(); if (!t) return; D.inbox.unshift({ id: id(), text: t, note: '', source: (fq.source && fq.source.value.trim()) || '', kind: 'note', file: null, at: Date.now() }); save(); badge(); snd('save'); renderInbox(view); view.querySelector('#x-inq input').focus(); };
    view.onclick = e => { const d = e.target.closest('[data-del]'); if (!d) return; const it = d.closest('[data-id]'); D.inbox = D.inbox.filter(x => x.id !== it.dataset.id); save(); badge(); renderInbox(view); };
    view.querySelectorAll('[data-r]').forEach(sel => sel.onchange = () => {
      const v = sel.value; if (!v) return; const it = D.inbox.find(x => x.id === sel.closest('[data-id]').dataset.id); if (!it) return;
      const r = sel.dataset.r; let msg = '';
      if (r === 'proj') { createProject({ cat: v, title: it.text.slice(0, 140), desc: it.note || 'از صندوق ورودی', progress: 10 }); msg = 'به ' + CATS[v].name + ' رفت'; }
      if (r === 'day') { const j = T().todayJ() + +v; DA().day(j, true).tasks.push(DA().newTask(it.text.slice(0, 140))); DA().save(); msg = 'به امور روزانهٔ ' + T().fmtD(j) + ' رفت'; }
      if (r === 'agent') { Agents.addItem({ agent: v, title: it.text.slice(0, 140), note: it.note }); msg = 'به فهرست ' + (Agents.AG.find(a => a.id === v) || {}).fa + ' رفت (۲۵٪)'; }
      D.inbox = D.inbox.filter(x => x !== it); save(); badge(); snd('save'); say(msg + ' ✓', 'ok'); renderInbox(view);
    });
  }

  /* ---------- palette / global search ---------- */
  const PRESETS = [{ name: '⚡ فوری‌های این هفته', f: { flag: 'week', mode: 'cards' } }, { name: '⏳ منتظر تأیید میلاد', f: { flag: 'appr' } }, { name: '🔥 عقب از ددلاین', f: { flag: 'late', mode: 'table' } }, { name: '📍 بدون آخرین وضعیت', f: { flag: 'nostage' } }];
  const applyFilter = f => { Agents.setFilter('main', Object.assign({ q: '', st: '', pr: '', ag: '', flag: '' }, f)); go('agents'); setTimeout(() => { const s = document.querySelector('.bd-sec'); s && s.scrollIntoView({ block: 'start' }); }, 250); };
  function commands() {
    const c = [
      ['🏠 خانه', () => go('')], ['📊 داشبورد', () => go('dashboard')], ['🗓 امور روزانه', () => go('daily')], ['🤖 مرکز ایجنت‌ها', () => go('agents')], ['✅ چک‌لیست', () => go('checklist')],
      ['📥 صندوق ورودی', () => go('inbox')], ['☀️ برنامهٔ صبح و مرور شب', () => go('plan')], ['＋ ثبت سریع در صندوق', capture], ['🎯 حالت تمرکز', focus],
      ['🌙 روشن/خاموش کردن حالت کم‌مصرف', toggleLow], ['⌨️ راهنمای میان‌برها', help],
      ['💾 ذخیرهٔ فیلتر فعلی ایجنت‌ها', () => { const n = prompt('نام فیلتر؟'); if (!n) return; const f = Agents.getFilter('main'); delete f.cmp; D.saved.unshift({ name: n.slice(0, 40), f }); D.saved = D.saved.slice(0, 20); save(); say('فیلتر ذخیره شد ✓', 'ok'); }]];
    Object.values(CATS).forEach(k => c.push([(k.icon || '📁') + ' ' + k.name, () => go(k.key)]));
    PRESETS.concat(D.saved).forEach(p => c.push(['🔎 فیلتر: ' + p.name, () => applyFilter(p.f)]));
    return c.map(([t, run]) => ({ g: 'فرمان', t, run }));
  }
  function searchAll(q) {
    const out = [], m = s => String(s || '').toLowerCase().includes(q);
    (S.projects || []).forEach(p => { if (m(p.title) || m(p.desc) || m(p.lastStatus) || m((p.tags || []).join(' '))) out.push({ g: 'پروژه', t: p.title, d: (CATS[p.cat] || {}).name + ((p.tags || []).length ? ' · #' + p.tags.join(' #') : ''), run: () => go(p.cat) }); });
    if (window.Agents) Agents.data().items.forEach(x => { if (m(x.title) || m(x.stage) || m(x.next) || m(x.note)) out.push({ g: 'ایجنت', t: x.title, d: (Agents.AG.find(a => a.id === x.agent) || {}).fa, run: () => go('agent/' + x.agent) }); });
    try { const dd = Daily.data(); for (const k in dd.days) dd.days[k].tasks.forEach(t => { if (m(t.title)) out.push({ g: 'روزانه', t: t.title, d: k, run: () => go('daily') }); }); (dd.bank || []).forEach(b => { if (m(b.title)) out.push({ g: 'بانک تسک', t: b.title, run: () => go('daily') }); }); } catch (e) { }
    try { (typeof MUSIC_CATEGORIES !== 'undefined' ? MUSIC_CATEGORIES : []).forEach(c => c.ideas.forEach(i => { if (m(i.title)) out.push({ g: 'ایده', t: i.title, d: c.name || '', run: () => go('music') }); })); } catch (e) { }
    D.inbox.forEach(x => { if (m(x.text) || m(x.note)) out.push({ g: 'صندوق', t: x.text, run: () => go('inbox') }); });
    return out;
  }
  function palette() {
    openModal(`<div class="x-pal"><input id="x-pq" placeholder="جستجو در پروژه‌ها، تسک‌ها، ایده‌ها، ایجنت‌ها، روزانه، صندوق… یا یک فرمان" autocomplete="off"><div id="x-pr" class="x-pr"></div><small>↑↓ انتخاب · Enter اجرا · Esc بستن</small></div>`, 'x-modal x-palm');
    const inp = document.getElementById('x-pq'), box = document.getElementById('x-pr'); let res = [], sel = 0;
    const paint = () => {
      const q = inp.value.trim().toLowerCase(); const cm = commands().filter(c => !q || c.t.toLowerCase().includes(q));
      res = (q ? searchAll(q) : []).slice(0, 40).concat(cm).slice(0, 60); sel = Math.min(sel, Math.max(0, res.length - 1));
      box.innerHTML = res.length ? res.map((r, i) => `<button class="x-r ${i === sel ? 'on' : ''}" data-i="${i}" data-snd="1"><em>${h(r.g)}</em><b>${h(r.t)}</b>${r.d ? `<small>${h(r.d)}</small>` : ''}</button>`).join('') : '<div class="x-empty">چیزی پیدا نشد</div>';
      const on = box.querySelector('.on'); on && on.scrollIntoView({ block: 'nearest' });
    };
    const run = i => { const r = res[i]; if (!r) return; closeModal(); snd('nav'); r.run(); };
    inp.oninput = () => { sel = 0; paint(); };
    inp.onkeydown = e => { if (e.key === 'ArrowDown') { sel = Math.min(res.length - 1, sel + 1); paint(); e.preventDefault(); } else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); paint(); e.preventDefault(); } else if (e.key === 'Enter') { e.preventDefault(); run(sel); } };
    box.onclick = e => { const b = e.target.closest('[data-i]'); if (b) run(+b.dataset.i); };
    paint(); inp.focus();
  }

  /* ---------- morning plan / evening review ---------- */
  function renderPlan(view) {
    const j = T().todayJ(), k = T().keyOf(j), R = rit(k), dd = DA().day(j, false), tasks = dd.tasks || [];
    const done = tasks.filter(t => t.done).length, hr = new Date().getHours();
    view.innerHTML = `${topbar('برنامهٔ صبح و مرور شب', '')}<main class="page x-page">
      <section class="glass x-hero"><h2>${hr < 15 ? '☀️ صبح بخیر' : '🌙 وقت مرور روز'}</h2><p>${h(T().fmtD(j))} · ${fa(done)} از ${fa(tasks.length)} کار امروز انجام شده</p></section>
      <div class="x-two">
      <section class="glass x-card"><h3>☀️ سه کار مهم امروز</h3><p class="x-sub">از کارهای امروز انتخاب کن یا تازه بنویس (به امور روزانه اضافه می‌شود).</p>
        <ol class="x-top">${[0, 1, 2].map(i => { const t = tasks.find(x => x.id === R.top[i]); return `<li>${t ? `<label class="${t.done ? 'dn' : ''}"><input type="checkbox" data-tdone="${t.id}" ${t.done ? 'checked' : ''}> ${h(t.title)}</label><button class="ag-mini" data-untop="${i}">✕</button>` : `<select data-pick="${i}"><option value="">انتخاب از امروز…</option>${tasks.filter(x => !R.top.includes(x.id)).map(x => `<option value="${x.id}">${h(x.title)}</option>`).join('')}</select><input data-newtop="${i}" maxlength="140" placeholder="یا بنویس + Enter">`}</li>`; }).join('')}</ol>
        <button class="btn ghost" data-xfocus>🎯 شروع تمرکز روی کار اول</button></section>
      <section class="glass x-card"><h3>🌙 مرور شب</h3>
        <ul class="x-rev">${tasks.length ? tasks.map(t => `<li><label class="${t.done ? 'dn' : ''}"><input type="checkbox" data-tdone="${t.id}" ${t.done ? 'checked' : ''}> ${h(t.title)}</label></li>`).join('') : '<li class="x-empty">امروز کاری ثبت نشده</li>'}</ul>
        <button class="btn ghost" data-carry ${tasks.some(t => !t.done) ? '' : 'disabled'}>↪ انتقال ${fa(tasks.filter(t => !t.done).length)} کار انجام‌نشده به فردا</button>
        <textarea id="x-note" rows="3" maxlength="1500" placeholder="یادداشت مرور: چه خوب پیش رفت؟ فردا چه چیزی را بهتر می‌کنم؟">${h(R.review)}</textarea>
        <button class="btn" data-review>${R.reviewed ? '✓ مرور ثبت شد — به‌روزرسانی' : 'ثبت مرور شب'}</button><button class="btn ghost" data-wkreview type="button">مرور هفتگی کامل</button></section></div>
      <section class="glass x-card"><h3>🔁 کارهای تکرارشونده و یادآور</h3><p class="x-sub">هر روزِ انتخاب‌شده خودکار به امور روزانه اضافه می‌شود؛ اگر ساعت بدهی، یادآوری (اعلان مرورگر در صورت اجازه، وگرنه پیام داخل برنامه) می‌گیری.</p>
        <ul class="x-recl">${D.recur.map(r => `<li><b>${h(r.title)}</b><span>${r.days.length === 7 ? 'هر روز' : r.days.map(d => WD[d]).join('، ')}</span>${r.time ? `<span>⏰ ${h(r.time)}</span>` : ''}<button class="ag-mini no" data-rdel="${r.id}">🗑</button></li>`).join('') || '<li class="x-empty">هنوز موردی نیست</li>'}</ul>
        <form id="x-rec" class="x-inline"><input name="t" required maxlength="140" placeholder="مثلاً: ورزش صبح"><span class="x-days">${WD.map((w, i) => `<label><input type="checkbox" name="d" value="${i}" checked>${w.slice(0, 1)}</label>`).join('')}</span><input name="tm" type="time"><button class="btn">＋ افزودن</button></form>
        <button class="ag-mini" data-notif>🔔 ${typeof Notification !== 'undefined' && Notification.permission === 'granted' ? 'اعلان فعال است' : 'اجازهٔ اعلان مرورگر'}</button></section></main>`;
    const re = () => renderPlan(view);
    view.onclick = e => {
      const t = e.target;
      if (t.closest('[data-untop]')) { R.top.splice(+t.closest('[data-untop]').dataset.untop, 1); save(); re(); }
      else if (t.closest('[data-wkreview]')) go('review');
      else if (t.closest('[data-xfocus]')) focus(R.top[0]);
      else if (t.closest('[data-carry]')) { const nd = DA().day(j + 1, true); const keep = []; dd.tasks.forEach(x => x.done ? keep.push(x) : nd.tasks.push(Object.assign({}, x, { spent: 0 }))); const n = dd.tasks.length - keep.length; dd.tasks.splice(0, dd.tasks.length, ...keep); R.top = R.top.filter(i => keep.some(x => x.id === i)); DA().save(); save(); say(fa(n) + ' کار به فردا رفت ↪', 'ok'); re(); }
      else if (t.closest('[data-review]')) { R.review = view.querySelector('#x-note').value.trim(); R.reviewed = true; const d = DA().day(j, true); const tag = '🌙 مرور شب: '; d.note = (d.note || '').split('\n').filter(l => !l.startsWith(tag)).concat(R.review ? [tag + R.review] : []).join('\n').trim(); DA().save(); save(); snd('save'); say('مرور شب ثبت شد و به یادداشت روز اضافه شد ✓', 'ok'); re(); }
      else if (t.closest('[data-rdel]')) { D.recur = D.recur.filter(r => r.id !== t.closest('[data-rdel]').dataset.rdel); save(); re(); }
      else if (t.closest('[data-notif]')) { if (typeof Notification === 'undefined') say('این مرورگر اعلان ندارد؛ یادآوری داخل برنامه نشان داده می‌شود'); else Notification.requestPermission().then(re).catch(() => say('اعلان اجازه داده نشد')); }
    };
    view.querySelectorAll('[data-tdone]').forEach(c => c.onchange = () => { const x = dd.tasks.find(t => t.id === c.dataset.tdone); if (x) { x.done = c.checked; DA().save(); if (c.checked) snd('done'); re(); } });
    view.querySelectorAll('[data-pick]').forEach(s => s.onchange = () => { if (!s.value) return; R.top[+s.dataset.pick] = s.value; R.top = R.top.filter(Boolean); save(); re(); });
    view.querySelectorAll('[data-newtop]').forEach(i => i.onkeydown = e => { if (e.key !== 'Enter') return; e.preventDefault(); const v = i.value.trim(); if (!v) return; const t = DA().newTask(v); DA().day(j, true).tasks.push(t); DA().save(); R.top.push(t.id); R.top = R.top.slice(0, 3); save(); re(); });
    const ol = view.querySelector('.x-top');
    if (ol) {
      let dragI = -1;
      [...ol.children].forEach((li, i) => {
        if (!li.querySelector('label')) return;
        li.draggable = true; li.dataset.topi = i;
        li.addEventListener('dragstart', () => { dragI = i; li.classList.add('drag'); });
        li.addEventListener('dragend', () => li.classList.remove('drag'));
        li.addEventListener('dragover', e => { e.preventDefault(); li.classList.add('over'); });
        li.addEventListener('dragleave', () => li.classList.remove('over'));
        li.addEventListener('drop', e => {
          e.preventDefault(); li.classList.remove('over');
          const to = +li.dataset.topi; if (dragI < 0 || dragI === to) return;
          const arr = R.top.slice(); const [mv] = arr.splice(dragI, 1); arr.splice(to, 0, mv);
          R.top = arr.filter(Boolean).slice(0, 3); save(); re();
        });
      });
    }
    const fr = view.querySelector('#x-rec'); fr.onsubmit = e => { e.preventDefault(); const days = [...fr.querySelectorAll('[name=d]:checked')].map(c => +c.value); if (!days.length) { say('حداقل یک روز را انتخاب کن'); return; } D.recur.push({ id: id(), title: fr.t.value.trim(), days, time: fr.tm.value || '', last: '', notified: '' }); save(); recurTick(); re(); };
  }
  function recurTick() {
    if (!window.Daily) return; const k = todayK(), w = satIdx(); let add = 0;
    D.recur.forEach(r => { if (r.days.includes(w) && r.last !== k) { const d = DA().day(T().todayJ(), true); if (!d.tasks.some(t => t.recurId === r.id)) { const t = DA().newTask(r.title); t.recurId = r.id; d.tasks.push(t); add++; } r.last = k; } });
    if (add) { DA().save(); save(); }
    const n = new Date(), hm = String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
    D.recur.forEach(r => { if (r.time && r.days.includes(w) && r.time <= hm && r.notified !== k) { r.notified = k; save(); const msg = '⏰ یادآوری: ' + r.title;
      try { if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification('پورتال میلاد', { body: msg }); else say(msg, 'ok'); } catch (e) { say(msg, 'ok'); } } });
  }

  /* ---------- focus mode ---------- */
  let fTimer = null;
  function focus(tid) {
    if (document.getElementById('x-focus')) return;
    const j = T().todayJ(), tasks = (DA().day(j, false).tasks || []).filter(t => !t.done), R = rit(T().keyOf(j));
    const first = tid || R.top.find(i => tasks.some(t => t.id === i)) || (tasks[0] && tasks[0].id) || '';
    const o = document.createElement('div'); o.id = 'x-focus'; o.className = 'x-focus';
    o.innerHTML = `<div class="xf-in"><small>حالت تمرکز</small><select id="xf-t">${tasks.map(t => `<option value="${t.id}" ${t.id === first ? 'selected' : ''}>${h(t.title)}</option>`).join('') || '<option value="">یک کار برای امروز اضافه کن</option>'}</select>
      <div class="xf-clock" id="xf-c">۲۵:۰۰</div><div class="xf-b"><button class="btn" id="xf-go">▶ شروع</button><select id="xf-m"><option value="25">۲۵ دقیقه</option><option value="50">۵۰ دقیقه</option><option value="15">۱۵ دقیقه</option></select><button class="btn ghost" id="xf-done">✓ انجام شد</button><button class="btn ghost" id="xf-x">خروج (Esc)</button></div></div>`;
    document.body.appendChild(o); document.body.classList.add('focus-on'); applyLow();
    let left = 25 * 60, run = false; const c = o.querySelector('#xf-c');
    const paint = () => { const fd = n => String(n).padStart(2, '0').replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]); c.textContent = fd(Math.floor(left / 60)) + ':' + fd(left % 60); };
    o.querySelector('#xf-m').onchange = e => { if (!run) { left = +e.target.value * 60; paint(); } };
    o.querySelector('#xf-go').onclick = e => { run = !run; e.target.textContent = run ? '⏸ مکث' : '▶ ادامه'; clearInterval(fTimer); if (run) fTimer = setInterval(() => { left--; paint(); if (left <= 0) { clearInterval(fTimer); run = false; snd('special'); say('زمان تمرکز تمام شد 🎉', 'ok'); try { Sky.meteorShower(6); } catch (er) { } } }, 1000); };
    o.querySelector('#xf-done').onclick = () => { const id_ = o.querySelector('#xf-t').value; const t = (DA().day(j, false).tasks || []).find(x => x.id === id_); if (t) { t.done = true; DA().save(); snd('done'); say('آفرین! «' + t.title + '» انجام شد', 'ok'); } exitFocus(); };
    o.querySelector('#xf-x').onclick = exitFocus; paint();
  }
  function exitFocus() { clearInterval(fTimer); const o = document.getElementById('x-focus'); o && o.remove(); document.body.classList.remove('focus-on'); applyLow(); if (currentRoute === 'plan' || currentRoute === 'daily') render(); }

  /* ---------- help & shortcuts ---------- */
  function help() {
    openModal(`<h3>⌨️ میان‌برهای صفحه‌کلید</h3><table class="x-keys">${[['N', 'ثبت سریع در صندوق ورودی'], ['Ctrl + K  یا  /', 'جستجوی سراسری و فرمان‌ها'], ['G سپس D', 'رفتن به امور روزانه'], ['G سپس A', 'رفتن به مرکز ایجنت‌ها'], ['G سپس I', 'صندوق ورودی'], ['G سپس P', 'برنامهٔ صبح / مرور شب'], ['G سپس H', 'خانه'], ['F', 'حالت تمرکز'], ['L', 'حالت کم‌مصرف'], ['?', 'همین راهنما'], ['Esc', 'بستن پنجره / خروج از تمرکز']].map(([a, b]) => `<tr><td><kbd>${a}</kbd></td><td>${b}</td></tr>`).join('')}</table>`, 'x-modal');
  }
  let gAt = 0;
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('x-focus')) { exitFocus(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); palette(); return; }
    const tg = e.target, typing = tg && (tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName));
    if (typing || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('#modal-root .overlay')) return;
    const k = e.key.toLowerCase(), code = e.code;
    if (Date.now() - gAt < 1200) { gAt = 0; const r = { KeyD: 'daily', KeyA: 'agents', KeyI: 'inbox', KeyP: 'plan', KeyH: '' }[code]; if (r != null) { e.preventDefault(); go(r); } return; }
    if (code === 'KeyG') { gAt = Date.now(); return; }
    if (code === 'KeyN') { e.preventDefault(); capture(); }
    else if (k === '/' || code === 'Slash' && !e.shiftKey) { e.preventDefault(); palette(); }
    else if (k === '?' || (code === 'Slash' && e.shiftKey)) { e.preventDefault(); help(); }
    else if (code === 'KeyF') { e.preventDefault(); focus(); }
    else if (code === 'KeyL') { e.preventDefault(); toggleLow(); }
  });

  ROUTES['inbox'] = () => renderInbox(view);
  ROUTES['plan'] = () => renderPlan(view);
  function setPref(k, v) { D.prefs = D.prefs || {}; D.prefs[k] = v; save(); }
  function mobar() {
    if (document.getElementById('x-mobar')) return;
    const b = document.createElement('div'); b.id = 'x-mobar';
    b.innerHTML = '<button type="button" data-snd="1">＋ ثبت سریع</button>';
    b.querySelector('button').onclick = ev => { ev.preventDefault(); capture(); };
    document.body.appendChild(b);
  }
  function boot() { dock(); mobar(); applyLow(); try { recurTick(); } catch (e) { } setInterval(() => { try { recurTick(); } catch (e) { } }, 30000); try { reduceMQ.addEventListener('change', applyLow); } catch (e) { } if (/^#\/(inbox|plan)/.test(location.hash)) render(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  return { data: () => D, importData: v => { D = norm(v); save(); badge(); applyLow(); }, setPref, capture, palette, focus, help, toggleLow };
})();
