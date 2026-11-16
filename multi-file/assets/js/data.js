/* Static configuration + seed data */
const AIS = {
  chatgpt: { name: 'ChatGPT', color: '#a855f7', short: 'GPT' },
  gemini:  { name: 'Gemini',  color: '#4f8cff', short: 'Gemini' },
  grok:    { name: 'Grok',    color: '#5b7cff', short: 'Grok' },
  claude:  { name: 'Claude',  color: '#ff8a3d', short: 'Claude' },
};
const NOTE_AIS = ['chatgpt', 'gemini', 'grok', 'claude'];

const STARTED_SUB = 'ایده‌های شروع‌شده';
const CATS = {
  ai: {
    key: 'ai', name: 'مدیریت پروژه‌های Ai', short: 'Ai', color: '#2f7bff', color2: '#7cc4ff', icon: '🤖',
    subs: [STARTED_SUB, 'ایجنت و اتوماسیون', 'اپلیکیشن و وب‌سایت', 'GPT و جم سفارشی', 'ویدیو و تصویر', 'آموزش و AI Studio', 'پرامپت و تحقیق'],
    hasAi: true,
  },
  music: {
    key: 'music', name: 'مدیریت پروژه‌های موزیک', short: 'موزیک', color: '#ff2d8b', color2: '#ff8ac4', icon: '🎵',
    subs: [STARTED_SUB].concat((window.MUSIC_CATEGORIES || []).map(c => c.name)),
    hasAi: true,
  },
  company: {
    key: 'company', name: 'مدیریت پروژه‌های شرکت', short: 'شرکت', color: '#14c8d8', color2: '#8ef1ff', icon: '🏢',
    subs: [STARTED_SUB, 'تبلیغات و بازاریابی', 'فتوگرافی پزشکی', 'وب و اپلیکیشن شرکت', 'پوستر، ویدیو و تیزر', 'مالی و حسابداری', 'امور اداری و پیگیری'],
    hasAi: false,
  },
  personal: {
    key: 'personal', name: 'مدیریت پروژه‌های شخصی', short: 'شخصی', color: '#f5b53d', color2: '#ffe08a', icon: '✨',
    subs: [STARTED_SUB, 'خانه و خانواده', 'باربد', 'سلامت و ورزش', 'یادگیری و مهارت', 'مالی شخصی', 'امور اداری شخصی'],
    hasAi: false,
  },
};
const RUNNING = { key: 'running', name: 'مدیریت پروژه‌های در حال اجرا', short: 'در حال اجرا', color: '#ff2e4d', color2: '#ff9aa9', icon: '🚀' };

const DAY = 86400000;

function seedPortal() {
  const now = Date.now();
  const ago = d => now - d * DAY;
  let no = { ai: 0, music: 0, company: 0, personal: 0 };
  const P = (o) => {
    const cat = o.cat;
    const n = o.no || ++no[cat];
    return Object.assign({
      id: 'p' + Math.random().toString(36).slice(2, 9), no: n, sub: STARTED_SUB, desc: '', link: '', ai: null,
      progress: 10, done: false, sample: true, createdAt: ago(o.days || 1), lastProgressAt: ago(o.stale != null ? o.stale : (o.days || 1)),
    }, o);
  };
  const list = [
    P({ cat: 'ai', title: 'ایجنت پاسخ‌گوی خودکار تلگرام شرکت', desc: 'ایجنت پاسخ به مشتری‌ها و ثبت نوبت عکاسی، متصل به شیت شرکت.', sub: 'ایجنت و اتوماسیون', ai: 'grok', progress: 45, days: 21, stale: 12, link: 'https://grok.com/' }),
    P({ cat: 'ai', title: 'GPT سفارشی تحلیل اکسل شرکت', desc: 'خواندن گزارش‌های اکسل و ساخت داشبورد خلاصه هفتگی.', sub: 'GPT و جم سفارشی', ai: 'chatgpt', progress: 30, days: 15, stale: 9, link: 'https://chatgpt.com/' }),
    P({ cat: 'ai', title: 'اپلیکیشن وب فتوگرافی تهران', desc: 'نسخه اول اپ رزرو و گالری، طراحی دارک و مدرن.', sub: 'اپلیکیشن و وب‌سایت', ai: 'claude', progress: 60, days: 10, stale: 2, link: 'https://claude.ai/' }),
    P({ cat: 'ai', title: 'استوری‌برد و ویدیو تبلیغاتی با جمینای', desc: 'استوری‌برد ۳۰ ثانیه‌ای و ساخت ویدیو با Veo.', sub: 'ویدیو و تصویر', ai: 'gemini', progress: 20, days: 4, stale: 1, link: 'https://gemini.google.com/' }),
    P({ cat: 'ai', title: 'ایده: دستیار صوتی جارویس', desc: 'ثبت‌شده از یادداشت چسبان.', ai: 'chatgpt', progress: 10, days: 0.2 }),
    P({ cat: 'company', title: 'کمپین تبلیغاتی پاییز فتوگرافی پزشکی', desc: 'پوستر، تیزر و برنامه انتشار اینستاگرام.', sub: 'تبلیغات و بازاریابی', progress: 35, days: 18, stale: 10 }),
    P({ cat: 'company', title: 'پورتال کلی از اکسل شرکت', desc: 'تبدیل فایل‌های اکسل به یک پورتال مدیریتی.', sub: 'وب و اپلیکیشن شرکت', progress: 50, days: 9, stale: 3 }),
    P({ cat: 'company', title: 'سایت فتوگرافی تهران و اپ ویندوز', desc: 'بازطراحی سایت و نسخه دسکتاپ.', sub: 'فتوگرافی پزشکی', progress: 70, days: 30, stale: 5 }),
    P({ cat: 'company', title: 'تسویه حساب‌های فصل', desc: 'جمع‌بندی حساب‌ها با حسابدار.', sub: 'مالی و حسابداری', progress: 100, done: true, days: 25, stale: 6 }),
    P({ cat: 'personal', title: 'برنامه ورزش صبحگاهی', desc: '۳۰ دقیقه پیاده‌روی و کشش هر روز.', sub: 'سلامت و ورزش', progress: 15, days: 14, stale: 8 }),
    P({ cat: 'personal', title: 'ثبت احوال و پاسپورت', desc: 'پیگیری مدارک و نوبت اداره.', sub: 'امور اداری شخصی', progress: 40, days: 6, stale: 2 }),
    P({ cat: 'personal', title: 'برنامه درسی و تفریح باربد', desc: 'برنامه هفتگی مدرسه، کلاس و تفریح.', sub: 'باربد', progress: 25, days: 3, stale: 1 }),
  ];
  // Music projects from Milad's own music file (real data, not samples)
  const seeds = window.MUSIC_SEEDS || {};
  const ideaById = {};
  (window.MUSIC_CATEGORIES || []).forEach(c => c.ideas.forEach(i => ideaById[i.id] = { idea: i, cat: c.name }));
  Object.keys(seeds).forEach((k, idx) => {
    const s = seeds[k], ref = ideaById[k];
    if (!ref) return;
    const ai = (s.contributors || [])[0] === 'gpt' ? 'chatgpt' : ((s.contributors || [])[0] || 'chatgpt');
    list.push(P({
      cat: 'music', no: +k, ideaId: +k, title: ref.idea.title, desc: ref.idea.desc, sub: ref.cat, ai,
      progress: s.progress || 0, link: s.taskLink || '', sample: false, days: 5 + idx * 0.1, stale: 5,
      music: {
        singer: s.singer || 'milad', reference: '', structure: s.structure || '', style: s.style || s.prompt || '', negative: s.exclude || '',
        lyrics: s.lyrics || '', vocal: s.vocal || 'male', lyricsMode: 'manual', weirdness: s.weirdness ?? 50, styleInfluence: s.styleInfluence ?? 50,
        variety: s.variety ?? 50, maxMode: !!s.maxMode, personalize: !!s.personalize, instrumental: false, duration: s.duration || 'auto', model: 'v5', songTitle: s.songTitle || ref.idea.title,
      },
    }));
  });
  list.push(P({ cat: 'music', no: 900, title: 'نمونه: ترانه شب‌های تهران', desc: 'آیتم نمونه برای دیدن هشدار بی‌تحرکی.', sub: 'دارک و سینمایی', ai: 'grok', progress: 15, days: 16, stale: 11 }));
  return { version: 1, projects: list, notes: { chatgpt: '', gemini: '', grok: '', claude: '' }, seededAt: now };
}

const CK_STATUS = {
  normal:    { name: 'عادی',       color: '#2f8cff' },
  running:   { name: 'در حال اجرا', color: '#22c55e' },
  important: { name: 'مهم',        color: '#eab308' },
  critical:  { name: 'خیلی مهم',   color: '#ff3b6b' },
};

function seedChecklist() {
  const G = [
    ['g1', 'امور کل اجرایی', ['بررسی و تکمیل چک لیست امور کل اجرایی', 'واریز ۱۴ میلیون - بررسی و برنامه ریزی']],
    ['g2', 'خانه و خانواده', ['حسابرسی کل شرکت - حسابرسی کل منزل (حساب های امروز - هزینه - درآمد)', 'نظافت منزل - لباس ها - نظافت شخصی', 'مدرسه و لباس و پول و درس و تفریح و برنامه ریزی باربد', 'خرید کل منزل - آماده کردن ناهار و شام و صبحانه باربد']],
    ['g3', 'پیگیری‌های روزانه', ['پیگیری امور اجرایی روزانه شرکت - حضوری تلفنی', 'پیگیری امور اجرایی اداری شخصی - ثبت احوال و پاسپورت']],
    ['g4', 'میزکار و پروژه‌های هوش مصنوعی', ['میزکار - سیستم ها و مانیتور و کیبرد و موس (چیدمان)', 'استند و تخته کار بروزرسانی (استند موبایل و هدست)', 'راه اندازی جارویس و بروزرسانی و خروجی', 'نصب ها (دیپ سیک - پلاگین ها و اسکیل ها - API)', 'ساخت و راه اندازی پت GPT و جزییات و اکشن', 'بررسی نمونه سایت های ذخیره شده و پورتال و ایجنت ها', 'پروژه استوری برد ویدیو و تکمیل ایجنت و ساخت ویدیو جمینای', 'پروژه های جمینای - پروژه های GPT / اپ ، ایده و اجرا']],
    ['g5', 'یادگیری و ساخت - AI Studio', ['بررسی و برنامه روزانه آموزش AI Studio', 'بررسی تمدید اکانت های AI Studio', 'بررسی تمامی ذخیره های آموزش AI Studio - تلگرام و اینستا و یوتیوب', 'ساخت اسکیل و ایجنت ها نمونه تا ایده پردازی', 'ساخت اپلیکیشن های مدرن - بررسی و ایده پردازی و ایده AI', 'ساخت بازی مدرن و نمونه و ایده پردازی', 'خرید اکانت هوشا یا آکا - بررسی نهایی و خرید و بررسی']],
    ['g6', 'موسیقی و ترانه - Suno', ['بررسی و برنامه روزانه آموزش Suno AI Studio', 'بررسی تمامی آیتم های وب سونو و کمک GPT', 'ساخت و تکمیل اسکیل ساخت ترانه و استایل نهایی موزیک ها', 'آهنگسازی ترانه پدر', 'آهنگسازی ترانه باربد', 'آهنگسازی ترانه ایران']],
    ['g7', 'شرکت، تبلیغات و بازاریابی', ['برنامه روزانه مدیریت تبلیغات و بازاریابی شرکت', 'ساخت پورتال کلی از اکسل شرکت و بررسی نهایی و ایده', 'نرم افزار وب و اپ فتوگرافی تهران', 'پروپوزال کدینگ نهایی اپلیکیشن فتوگرافی تهران', 'ساخت پوسترهای شرکت و طراحی های مدرن', 'ساخت ویدیو و تیزرهای تبلیغاتی', 'سایت فتوگرافی تهران و اپ ویندوز', 'برنامه ریزی و برنامه دقیق بازاریابی پروژه AI شرکت']],
  ];
  const now = Date.now();
  return {
    version: 1,
    groups: G.map(([id, name, tasks]) => ({
      id, name, wide: id === 'g7',
      tasks: tasks.map((t, i) => ({ id: id + 't' + i, title: t, status: 'important', done: false, progress: 0, createdAt: now })),
    })),
  };
}
