/*!
 * Crew Orbit — vanilla JS hero component for the Milad Saadat portal
 * Pixel · گرافیک و تبلیغات — no framework, no dependencies.
 *
 * Usage:
 *   <div class="crew-orbit" id="crewOrbit"></div>
 *   [script src=crew-orbit.js]
 *   CrewOrbit.mount('#crewOrbit', { ...overrides });
 *
 * Everything Nexo may want to change lives in CrewOrbit.CONFIG (below).
 */
(function (global) {
  "use strict";

  /* ======================= CONFIG (edit me) ======================= */
  var CONFIG = {
    assetsBase: "assets/orbit/",               // folder that holds logo/, avatars/, sound/
    hrefPrefix: "/bots/",                // default link = hrefPrefix + id  (overridden by bot.href)
    logo: { src: "logo/milad-logo-512.webp", fallback: "logo/milad-logo-512.png", alt: "میلاد سعادت — Milad Saadat", href: null },
    // order = clockwise from 12 o'clock
    bots: [
      { id: "argus",  name: "آرگوس", role: "مدیر داخلی",          href: null },
      { id: "shaho",  name: "شاهو",  role: "شاه‌گل",               href: null },
      { id: "webo",   name: "وبو",   role: "وب‌سایت",             href: null },
      { id: "nexo",   name: "نکسو",  role: "پورتال",              href: null },
      { id: "novak",  name: "نُواک", role: "تنظیم‌کننده / موزیک",  href: null },
      { id: "viera",  name: "ویرا",  role: "فتوگرافی پزشکی",      href: null },
      { id: "jergeh", name: "جرقه",  role: "ایده‌پرداز",           href: null },
      { id: "reflex", name: "رفلکس", role: "شاه‌دست",              href: null },
      { id: "radar",  name: "رادار", role: "بازارساز",             href: null },
      { id: "pixel",  name: "پیکسل", role: "گرافیست",             href: null }
    ],
    radius: 0.385,          // orbit radius as a fraction of the stage width
    idleSecondsPerTurn: 90, // slow idle rotation (0 = no idle rotation)
    hoverSlowdown: 0.25,    // idle speed multiplier while a bot is hovered/focused
    spinMs: 1450,           // click spin duration (ease-in: slow -> fast)
    extraTurns: 1.5,        // extra full turns during the click spin
    landAtTop: true,        // chosen bot finishes the spin at 12 o'clock
    sound: "synth",         // "synth" (Web Audio, no file) | "file" | false
    soundFile: "sound/orbit-whoosh.mp3",
    volume: 0.55,
    stars: 46,
    navigate: function (href) { global.location.assign(href); }, // replace for SPA routers
    onSelect: null          // optional callback(bot) fired on click, before the spin
  };
  /* ================================================================ */

  var TAU = Math.PI * 2;
  var reduceMQ = global.matchMedia ? global.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

  function el(tag, cls, attrs) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function svgEl(tag, attrs) {
    var e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function merge(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in (b || {})) o[k] = b[k]; return o; }

  /* ---------- synthesized whoosh + rising chime (Web Audio, original) ---------- */
  var actx = null;
  function playSynth(durS, vol) {
    try {
      actx = actx || new (global.AudioContext || global.webkitAudioContext)();
      if (actx.state === "suspended") actx.resume();
      var now = actx.currentTime + 0.02, end = now + durS;
      var master = actx.createGain(); master.gain.value = vol;
      var comp = actx.createDynamicsCompressor(); master.connect(comp); comp.connect(actx.destination);

      // whoosh: filtered noise sweeping up
      var len = Math.floor(actx.sampleRate * (durS + 0.6));
      var buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      var src = actx.createBufferSource(); src.buffer = buf;
      var bp = actx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 1.1;
      bp.frequency.setValueAtTime(260, now);
      bp.frequency.exponentialRampToValueAtTime(3600, end);
      bp.frequency.exponentialRampToValueAtTime(500, end + 0.45);
      var wg = actx.createGain();
      wg.gain.setValueAtTime(0.0001, now);
      wg.gain.exponentialRampToValueAtTime(0.5, end);
      wg.gain.exponentialRampToValueAtTime(0.0001, end + 0.5);
      src.connect(bp); bp.connect(wg); wg.connect(master);
      src.start(now); src.stop(end + 0.6);

      // rising pentatonic chime, notes accelerate with the spin
      var notes = [587.33, 659.25, 739.99, 880, 987.77, 1174.66, 1318.51, 1479.98];
      notes.forEach(function (f, k) {
        var t = now + durS * (1 - Math.pow(1 - k / notes.length, 0.55));
        bell(f, t, 0.08 + 0.018 * k, 0.45, master);
      });
      // arrival shimmer
      [1174.66, 1479.98, 1760, 2349.32].forEach(function (f) { bell(f, end, 0.07, 1.1, master); });
    } catch (e) { /* audio is decoration only */ }
  }
  function bell(f, t, amp, dec, out) {
    [[1, 1], [2.01, 0.35], [3.02, 0.12]].forEach(function (p) {
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = "sine"; o.frequency.value = f * p[0];
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp * p[1], t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + dec + 0.05);
    });
  }
  var audioEl = null;
  function playFile(url, vol) {
    try { audioEl = audioEl || new Audio(url); audioEl.volume = vol; audioEl.currentTime = 0; audioEl.play().catch(function () {}); } catch (e) {}
  }

  /* ---------- component ---------- */
  function mount(target, opts) {
    var root = typeof target === "string" ? document.querySelector(target) : target;
    if (!root) throw new Error("CrewOrbit: mount target not found");
    var cfg = merge(CONFIG, opts);
    var A = function (p) { var m = global.__ORBIT_ASSETS; if (m) return m[p] || m[p.replace(/\.webp$/, ".png")] || (cfg.assetsBase + p); return cfg.assetsBase + p; };
    var still = !!global.__ORBIT_ASSETS;
    var reduceNow = function () { return reduceMQ.matches || (global.document && document.body && document.body.classList.contains("lowpower")); };
    root.classList.add("crew-orbit");
    if (!root.hasAttribute("dir")) root.setAttribute("dir", "rtl");
    root.innerHTML = "";

    var stage = el("div", "co-stage");
    root.appendChild(stage);

    // background light + stars
    var bg = el("div", "co-bg", { "aria-hidden": "true" });
    var stars = svgEl("svg", { "class": "co-stars", viewBox: "0 0 100 100", preserveAspectRatio: "none" });
    var seed = 11; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var s = 0; s < cfg.stars; s++) {
      var c = svgEl("circle", { cx: (rnd() * 100).toFixed(2), cy: (rnd() * 100).toFixed(2), r: (0.08 + rnd() * 0.22).toFixed(2) });
      c.style.setProperty("--d", (3 + rnd() * 5).toFixed(1) + "s");
      c.style.setProperty("--dl", (-rnd() * 6).toFixed(1) + "s");
      stars.appendChild(c);
    }
    bg.appendChild(stars); stage.appendChild(bg);

    // rings
    var R = cfg.radius * 100;
    var rings = svgEl("svg", { "class": "co-rings", viewBox: "0 0 100 100", "aria-hidden": "true" });
    rings.innerHTML =
      '<defs>' +
      '<linearGradient id="coGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6ea8ff" stop-opacity=".9"/><stop offset=".5" stop-color="#2f7bff" stop-opacity=".25"/><stop offset="1" stop-color="#6ea8ff" stop-opacity=".9"/></linearGradient>' +
      '<linearGradient id="coComet" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6ea8ff" stop-opacity="0"/><stop offset="1" stop-color="#ff2e4d" stop-opacity="1"/></linearGradient>' +
      '</defs>' +
      '<circle class="co-ring-ticks co-spin-ccw" cx="50" cy="50" r="' + (R + 7.5) + '"/>' +
      '<circle class="co-ring-dash co-spin-cw" cx="50" cy="50" r="' + (R + 4.2) + '"/>' +
      '<circle class="co-ring-orbit" cx="50" cy="50" r="' + R + '"/>' +
      '<circle class="co-ring-inner co-spin-ccw" cx="50" cy="50" r="' + (R - 9) + '" stroke-dasharray="1 3"/>' +
      '<g class="co-comet-g"><path class="co-comet" d="' + arcPath(50, 50, R, -150, -90) + '"/></g>';
    stage.appendChild(rings);
    var cometG = rings.querySelector(".co-comet-g");

    // centre logo
    var core = el(cfg.logo.href ? "a" : "div", "co-core");
    if (cfg.logo.href) core.setAttribute("href", cfg.logo.href);
    var lp = el("picture");
    if (!still) lp.appendChild(el("source", null, { srcset: A(cfg.logo.src), type: "image/webp" }));
    var li = el("img", null, { src: A(cfg.logo.fallback), alt: cfg.logo.alt, width: "512", height: "512", decoding: "async" });
    lp.appendChild(li); core.appendChild(lp); stage.appendChild(core);

    // bots
    var ring = el("nav", "co-ring", { "aria-label": "تیم بات‌ها — Crew" });
    stage.appendChild(ring);
    var nodes = cfg.bots.map(function (b, i) {
      var href = b.href || (cfg.hrefPrefix + b.id);
      var a = el("a", "co-bot", { href: href, "data-href": href, "data-id": b.id, "aria-label": b.name + " — " + b.role });
      a.innerHTML =
        '<span class="co-bot-inner"><span class="co-disc"><span class="co-fig"><picture>' +
        (still ? '' : '<source srcset="' + A("avatars/" + b.id + "-256.webp") + '" type="image/webp">') +
        '<img src="' + A("avatars/" + b.id + "-256.png") + '" alt="" width="256" height="256" loading="eager" decoding="async">' +
        '</picture></span></span>' +
        '<span class="co-label"><span class="co-name">' + b.name + '</span><span class="co-role">' + b.role + '</span></span></span>';
      ring.appendChild(a);
      return { el: a, bot: b, href: href, base: -Math.PI / 2 + (i / cfg.bots.length) * TAU };
    });

    var flash = el("div", "co-flash", { "aria-hidden": "true" });
    stage.appendChild(flash);

    // ---------- motion loop ----------
    var size = stage.clientWidth, angle = 0, last = performance.now(), hovered = 0, launching = null, raf = 0;
    var ro = global.ResizeObserver ? new ResizeObserver(function () { size = stage.clientWidth; place(); }) : null;
    if (ro) ro.observe(stage); else global.addEventListener("resize", function () { size = stage.clientWidth; place(); });

    function idleSpeed() {
      if (reduceNow() || !cfg.idleSecondsPerTurn) return 0;
      return (TAU / cfg.idleSecondsPerTurn) * (hovered ? cfg.hoverSlowdown : 1);
    }
    function place() {
      var r = cfg.radius * size;
      for (var i = 0; i < nodes.length; i++) {
        var t = nodes[i].base + angle;
        nodes[i].el.style.transform = "translate3d(" + (Math.cos(t) * r).toFixed(2) + "px," + (Math.sin(t) * r).toFixed(2) + "px,0)";
        nodes[i].el.classList.toggle("is-low", Math.sin(t) > 0.18);
      }
      cometG.setAttribute("transform", "rotate(" + (angle * 180 / Math.PI).toFixed(3) + " 50 50)");
    }
    function tick(now) {
      var dt = Math.min((now - last) / 1000, 0.05); last = now;
      if (launching) {
        var L = launching, p = Math.min((now - L.t0) / L.dur, 1);
        // ease-in: idle velocity + cubic acceleration term (slow -> fast)
        angle = L.a0 + L.v0 * p * L.durS + (L.delta - L.v0 * L.durS) * p * p * p;
        place();
        if (p >= 1) { finish(); return; }
      } else {
        angle += idleSpeed() * dt;
        place();
      }
      raf = requestAnimationFrame(tick);
    }
    place();
    raf = requestAnimationFrame(tick);

    ring.addEventListener("pointerover", function (e) { if (e.target.closest(".co-bot")) hovered = 1; });
    ring.addEventListener("pointerout", function (e) { if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest(".co-bot")) hovered = 0; });
    ring.addEventListener("focusin", function () { hovered = 1; });
    ring.addEventListener("focusout", function () { hovered = 0; });

    ring.addEventListener("click", function (e) {
      var a = e.target.closest(".co-bot"); if (!a) return;
      // let ctrl/cmd/middle-click open in new tab normally
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();
      if (launching) return;
      var node = nodes.filter(function (n) { return n.el === a; })[0];
      launch(node);
    });
    // Enter is native for <a>; Space also activates for convenience
    ring.addEventListener("keydown", function (e) {
      if (e.key === " " && e.target.closest(".co-bot")) { e.preventDefault(); e.target.click(); }
    });

    function launch(node) {
      if (typeof cfg.onSelect === "function") cfg.onSelect(node.bot);
      root.dispatchEvent(new CustomEvent("crew-orbit:select", { detail: { id: node.bot.id, href: node.href } }));
      if (reduceNow()) { cfg.navigate(node.href); return; }
      var durS = cfg.spinMs / 1000, v0 = Math.max(idleSpeed(), TAU / 120);
      var delta = cfg.extraTurns * TAU;
      if (cfg.landAtTop) {
        var cur = node.base + angle, target = -Math.PI / 2;
        var need = ((target - cur) % TAU + TAU) % TAU;
        delta = Math.ceil(cfg.extraTurns) * TAU + need;
      }
      launching = { node: node, t0: performance.now(), dur: cfg.spinMs, durS: durS, a0: angle, v0: v0, delta: delta };
      node.el.classList.add("is-chosen");
      root.classList.add("is-launching");
      var muted = global.SFX && SFX.muted; if (!muted && cfg.sound === "synth") playSynth(durS, cfg.volume);
      else if (cfg.sound === "file") playFile(A(cfg.soundFile), cfg.volume);
    }
    function finish() {
      var node = launching.node;
      // flash from the chosen avatar's position, then navigate
      var r = node.el.getBoundingClientRect(), s = stage.getBoundingClientRect();
      flash.style.setProperty("--fx", ((r.left + r.width / 2 - s.left) / s.width * 100) + "%");
      flash.style.setProperty("--fy", ((r.top + r.height / 2 - s.top) / s.height * 100) + "%");
      root.classList.add("is-arriving");
      setTimeout(function () {
        cfg.navigate(node.href);
        // reset (useful for SPA routers / back-forward cache)
        setTimeout(reset, 400);
      }, 380);
    }
    function reset() {
      launching = null;
      root.classList.remove("is-launching", "is-arriving");
      nodes.forEach(function (n) { n.el.classList.remove("is-chosen"); });
      last = performance.now();
      cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
    }
    global.addEventListener("pageshow", function (e) { if (e.persisted) reset(); });

    return {
      config: cfg,
      select: function (id) { var n = nodes.filter(function (x) { return x.bot.id === id; })[0]; if (n && !launching) launch(n); },
      reset: reset,
      destroy: function () { cancelAnimationFrame(raf); if (ro) ro.disconnect(); root.innerHTML = ""; }
    };
  }

  function arcPath(cx, cy, r, a0, a1) {
    var p = function (a) { a = a * Math.PI / 180; return (cx + r * Math.cos(a)).toFixed(3) + " " + (cy + r * Math.sin(a)).toFixed(3); };
    return "M " + p(a0) + " A " + r + " " + r + " 0 0 1 " + p(a1);
  }

  global.CrewOrbit = { CONFIG: CONFIG, mount: mount, playSound: function () { playSynth(CONFIG.spinMs / 1000, CONFIG.volume); } };
})(window);
