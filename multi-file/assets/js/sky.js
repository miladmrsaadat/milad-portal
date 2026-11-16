/* Animated night sky: static star field, twinkling stars, glowing moon, frequent meteors */
const Sky = (() => {
  const cv = document.getElementById('sky');
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, DPR = 1;
  let staticLayer, moonLayer, twinkles = [], meteors = [], sparks = [], nextMeteor = 0;
  let speedF = 1;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let mode = 'default';

  function rand(a, b) { return a + Math.random() * (b - a); }

  function buildStatic() {
    staticLayer = document.createElement('canvas');
    staticLayer.width = W * DPR; staticLayer.height = H * DPR;
    const c = staticLayer.getContext('2d'); c.scale(DPR, DPR);
    // milky way band
    const band = c.createLinearGradient(0, H * 0.15, W, H * 0.85);
    band.addColorStop(0, 'rgba(60,80,170,0)'); band.addColorStop(0.45, 'rgba(90,110,220,0.07)');
    band.addColorStop(0.55, 'rgba(160,110,220,0.06)'); band.addColorStop(1, 'rgba(60,80,170,0)');
    c.save(); c.translate(W / 2, H / 2); c.rotate(-0.55); c.fillStyle = band;
    c.fillRect(-W, -H * 0.12, W * 2, H * 0.24); c.restore();
    const n = Math.min(4200, Math.floor(W * H / 900));
    for (let i = 0; i < n; i++) {
      const x = Math.random() * W, y = Math.random() * H;
      const r = Math.random() < 0.94 ? rand(0.25, 0.9) : rand(0.9, 1.6);
      const hue = Math.random() < 0.15 ? 'rgba(255,220,200,' : (Math.random() < 0.3 ? 'rgba(180,200,255,' : 'rgba(255,255,255,');
      c.fillStyle = hue + rand(0.25, 0.9).toFixed(2) + ')';
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }
    // twinkle stars
    twinkles = [];
    const tn = Math.min(520, Math.floor(W * H / 9000));
    for (let i = 0; i < tn; i++) twinkles.push({ x: Math.random() * W, y: Math.random() * H, r: rand(0.8, 2.1), p: Math.random() * 6.28, s: rand(0.6, 2.4), c: Math.random() < 0.25 ? '170,200,255' : '255,255,255', cross: Math.random() < 0.22 });
  }

  function buildMoon() {
    const R = Math.max(38, Math.min(W, H) * 0.07);
    const S = R * 7;
    moonLayer = document.createElement('canvas'); moonLayer.width = S * DPR; moonLayer.height = S * DPR;
    const c = moonLayer.getContext('2d'); c.scale(DPR, DPR);
    const cx = S / 2, cy = S / 2;
    const halo = c.createRadialGradient(cx, cy, R * 0.8, cx, cy, S / 2);
    halo.addColorStop(0, 'rgba(200,215,255,0.35)'); halo.addColorStop(0.25, 'rgba(120,150,255,0.12)'); halo.addColorStop(1, 'rgba(60,80,200,0)');
    c.fillStyle = halo; c.fillRect(0, 0, S, S);
    const body = c.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.1, cx, cy, R);
    body.addColorStop(0, '#fffdf3'); body.addColorStop(0.55, '#e9e6da'); body.addColorStop(1, '#a9adc0');
    c.fillStyle = body; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
    c.save(); c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.clip();
    const craters = [[-0.3, -0.2, 0.22], [0.25, 0.1, 0.16], [0.05, 0.45, 0.12], [-0.45, 0.3, 0.1], [0.4, -0.38, 0.09], [-0.05, -0.55, 0.07], [0.55, 0.42, 0.08]];
    craters.forEach(([x, y, r]) => {
      const g = c.createRadialGradient(cx + x * R, cy + y * R, 0, cx + x * R, cy + y * R, r * R);
      g.addColorStop(0, 'rgba(140,140,160,0.45)'); g.addColorStop(0.8, 'rgba(150,150,170,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.beginPath(); c.arc(cx + x * R, cy + y * R, r * R, 0, Math.PI * 2); c.fill();
    });
    // terminator shadow
    const sh = c.createRadialGradient(cx + R * 0.9, cy + R * 0.5, R * 0.3, cx + R * 0.6, cy + R * 0.3, R * 1.7);
    sh.addColorStop(0, 'rgba(10,15,40,0)'); sh.addColorStop(0.55, 'rgba(10,15,40,0.05)'); sh.addColorStop(1, 'rgba(10,15,45,0.55)');
    c.fillStyle = sh; c.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    c.restore();
    moonLayer._S = S;
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildStatic(); buildMoon();
  }

  function spawnMeteor(big) {
    const scale = Math.max(W, H) / 1400;
    const fromTop = Math.random() < 0.7;
    // travel mostly towards bottom-left (RTL feel), sometimes bottom-right
    const dir = Math.random() < 0.78 ? -1 : 1;
    const angle = (dir < 0 ? Math.PI - rand(0.35, 0.75) : rand(0.35, 0.75));
    const speed = rand(14, 26) * scale * (big ? 0.8 : 1);
    meteors.push({
      x: fromTop ? rand(W * 0.1, W * 1.05) : (dir < 0 ? W + 20 : -20),
      y: fromTop ? rand(-40, H * 0.25) : rand(0, H * 0.45),
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      len: rand(160, 420) * scale * (big ? 1.6 : 1), life: 0, max: rand(45, 85),
      w: (big ? rand(2.6, 3.8) : rand(1.1, 2.2)) * Math.max(1, scale * 0.8), big,
      hue: Math.random() < 0.3 ? '255,190,150' : (Math.random() < 0.5 ? '170,205,255' : '255,255,255'),
    });
  }

  let last = performance.now(), t0 = performance.now();
  function frame(now) {
    const dt = Math.min(50, now - last) * speedF; last = now;
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(staticLayer, 0, 0, W, H);
    // twinkles
    for (const s of twinkles) {
      const a = 0.35 + 0.65 * Math.abs(Math.sin(t * s.s + s.p));
      ctx.fillStyle = `rgba(${s.c},${a.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
      if (s.cross && a > 0.75) {
        ctx.strokeStyle = `rgba(${s.c},${((a - 0.75) * 1.6).toFixed(3)})`; ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(s.x - s.r * 4, s.y); ctx.lineTo(s.x + s.r * 4, s.y); ctx.moveTo(s.x, s.y - s.r * 4); ctx.lineTo(s.x, s.y + s.r * 4); ctx.stroke();
      }
    }
    // moon (top-left, gentle float)
    const S = moonLayer._S;
    const mx = W * 0.16 - S / 2, my = H * 0.1 - S / 2 + Math.sin(t * 0.25) * 6;
    ctx.globalAlpha = mode === 'checklist' ? 0.85 : 1;
    ctx.drawImage(moonLayer, mx, my, S, S);
    ctx.globalAlpha = 1;
    // meteors
    if (now > nextMeteor) {
      const burst = Math.random() < 0.18 ? 3 : 1;
      for (let i = 0; i < burst; i++) spawnMeteor(Math.random() < 0.12);
      nextMeteor = now + (reduce ? rand(2500, 5000) : rand(220, 1100));
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.life += dt / 16.7; m.x += m.vx * dt / 16.7; m.y += m.vy * dt / 16.7;
      const fade = m.life < 8 ? m.life / 8 : Math.max(0, 1 - (m.life - m.max * 0.6) / (m.max * 0.4));
      const sp = Math.hypot(m.vx, m.vy);
      const tx = m.x - m.vx / sp * m.len, ty = m.y - m.vy / sp * m.len;
      const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
      g.addColorStop(0, `rgba(255,255,255,${0.95 * fade})`);
      g.addColorStop(0.08, `rgba(${m.hue},${0.7 * fade})`);
      g.addColorStop(1, `rgba(${m.hue},0)`);
      ctx.strokeStyle = g; ctx.lineWidth = m.w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx, ty); ctx.stroke();
      const hg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.w * (m.big ? 9 : 5));
      hg.addColorStop(0, `rgba(255,255,255,${0.9 * fade})`); hg.addColorStop(1, 'rgba(160,190,255,0)');
      ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(m.x, m.y, m.w * (m.big ? 9 : 5), 0, 6.283); ctx.fill();
      if (m.big && Math.random() < 0.6) sparks.push({ x: m.x, y: m.y, vx: m.vx * 0.15 + rand(-1, 1), vy: m.vy * 0.15 + rand(-1, 1), l: 1 });
      if (m.life > m.max || m.x < -m.len * 1.2 || m.x > W + m.len * 1.2 || m.y > H + m.len) meteors.splice(i, 1);
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]; s.x += s.vx; s.y += s.vy; s.l -= 0.03;
      if (s.l <= 0) { sparks.splice(i, 1); continue; }
      ctx.fillStyle = `rgba(255,210,170,${s.l})`; ctx.fillRect(s.x, s.y, 1.6, 1.6);
    }
    ctx.globalCompositeOperation = 'source-over';
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', () => { clearTimeout(resize._t); resize._t = setTimeout(resize, 120); });
  resize(); requestAnimationFrame(frame);
  return { setSpeed(f) { speedF = f; }, setMode(m) { mode = m; }, meteorShower(n = 8) { for (let i = 0; i < n; i++) setTimeout(() => spawnMeteor(Math.random() < 0.3), i * 70); } };
})();
