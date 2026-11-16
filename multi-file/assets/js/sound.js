/* Synthesised sound effects (Web Audio API) — no audio files needed */
const SFX = (() => {
  let ctx = null, master = null, verb = null;
  let lastAt = 0;
  let muted = STORE.getItem('mss_muted') === '1';

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.55;
      // simple feedback-delay "space" reverb
      const delay = ctx.createDelay(); delay.delayTime.value = 0.16;
      const fb = ctx.createGain(); fb.gain.value = 0.32;
      const wet = ctx.createGain(); wet.gain.value = 0.28;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
      delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(wet); wet.connect(ctx.destination);
      verb = delay;
      master.connect(ctx.destination); master.connect(verb);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone({ f = 440, f2 = null, type = 'sine', at = 0, d = 0.2, v = 0.25, a = 0.006, curve = 'exp', detune = 0 }) {
    lastAt++; const c = ac(); if (!c || muted) return;
    const t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
    if (f2) (curve === 'lin' ? o.frequency.linearRampToValueAtTime(f2, t + d) : o.frequency.exponentialRampToValueAtTime(f2, t + d));
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.05);
  }

  function noise({ at = 0, d = 1, v = 0.3, f1 = 300, f2 = 3000, q = 1.2, type = 'bandpass' }) {
    const c = ac(); if (!c || muted) return;
    const t = c.currentTime + at;
    const len = Math.floor(c.sampleRate * d);
    const buf = c.createBuffer(1, len, c.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const flt = c.createBiquadFilter(); flt.type = type; flt.Q.value = q;
    flt.frequency.setValueAtTime(f1, t); flt.frequency.exponentialRampToValueAtTime(f2, t + d * 0.85);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + d * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(flt); flt.connect(g); g.connect(master); src.start(t); src.stop(t + d + 0.05);
  }

  const bell = (f, at = 0, v = 0.18, d = 1.2) => {
    tone({ f, at, d, v, type: 'sine' });
    tone({ f: f * 2.01, at, d: d * 0.6, v: v * 0.35, type: 'sine' });
    tone({ f: f * 3.02, at, d: d * 0.35, v: v * 0.15, type: 'triangle' });
  };

  return {
    get muted() { return muted; },
    get lastAt() { return lastAt; },
    toggle() { muted = !muted; STORE.setItem('mss_muted', muted ? '1' : '0'); if (!muted) this.click(); return muted; },
    unlock() { ac(); },
    click() { tone({ f: 1500, f2: 900, type: 'triangle', d: 0.07, v: 0.12 }); },
    tick() { tone({ f: 2200, f2: 1800, type: 'sine', d: 0.035, v: 0.05 }); },
    open() { tone({ f: 420, f2: 860, type: 'sine', d: 0.22, v: 0.12 }); tone({ f: 1290, at: 0.05, d: 0.25, v: 0.05 }); },
    close() { tone({ f: 800, f2: 380, type: 'sine', d: 0.2, v: 0.1 }); },
    enter() { // futuristic portal whoosh + shimmering chord
      noise({ d: 1.4, v: 0.35, f1: 180, f2: 5200, q: 2.2 });
      tone({ f: 110, f2: 440, type: 'sawtooth', d: 1.1, v: 0.06 });
      tone({ f: 165, f2: 660, type: 'sawtooth', d: 1.1, v: 0.05, detune: 8 });
      tone({ f: 55, f2: 30, type: 'sine', at: 0.9, d: 0.9, v: 0.35 }); // sub drop
      [880, 1108.7, 1318.5, 1760].forEach((f, i) => bell(f, 0.95 + i * 0.07, 0.11, 1.6));
    },
    save() { // satisfying chime
      bell(1046.5, 0, 0.2, 0.9); bell(1568, 0.09, 0.16, 1.1); bell(2093, 0.18, 0.1, 1.2);
      noise({ d: 0.35, v: 0.06, f1: 6000, f2: 9000, q: 0.7, type: 'highpass' });
    },
    done() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(f, i * 0.08, 0.15, 0.9)); },
    undo() { tone({ f: 660, f2: 330, type: 'triangle', d: 0.25, v: 0.12 }); },
    rocket() { noise({ d: 1.1, v: 0.4, f1: 120, f2: 2600, q: 0.8, type: 'lowpass' }); tone({ f: 90, f2: 900, type: 'sawtooth', d: 0.9, v: 0.05 }); },
    back() { noise({ d: 0.45, v: 0.18, f1: 3000, f2: 300, q: 1.5 }); tone({ f: 900, f2: 260, type: 'sine', d: 0.35, v: 0.12 }); },
    nav() { noise({ d: 0.5, v: 0.16, f1: 400, f2: 3800, q: 1.8 }); tone({ f: 520, f2: 1040, d: 0.3, v: 0.08 }); },
    special() { // executive checklist button
      noise({ d: 0.8, v: 0.2, f1: 300, f2: 6000, q: 3 });
      [659.25, 987.77, 1318.5].forEach((f, i) => bell(f, 0.25 + i * 0.09, 0.13, 1.2));
    },
    error() { tone({ f: 180, f2: 120, type: 'square', d: 0.25, v: 0.07 }); },
    cash() { // finance button: coins + register ding
      [0, .07, .13, .2, .26].forEach((at, i) => { tone({ f: 2600 + i * 180, f2: 3400 + i * 120, type: 'triangle', at, d: .09, v: .07 }); tone({ f: 5200 + i * 90, at: at + .01, d: .05, v: .03 }); });
      bell(1318.5, .34, .18, 1.2); bell(1975.5, .42, .14, 1.4);
      tone({ f: 70, f2: 40, type: 'sine', at: .3, d: .6, v: .25 });
      noise({ at: .3, d: .9, v: .12, f1: 900, f2: 7000, q: 2 });
    },
    upload() { tone({ f: 300, f2: 1200, type: 'sine', d: .35, v: .12 }); bell(1568, .3, .12, .8); },
    pick() { tone({ f: 980, f2: 1320, type: 'sine', d: 0.12, v: 0.1 }); },
    daily() { // daily-planner button: clock ticks + rising violet arpeggio + shimmer
      [0, .11, .22, .33].forEach((at, i) => tone({ f: i % 2 ? 1900 : 2400, type: 'square', at, d: .03, v: .045 }));
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => bell(f, .42 + i * .075, .12, 1.1));
      tone({ f: 220, f2: 880, type: 'sawtooth', at: .4, d: .5, v: .035 });
      noise({ at: .4, d: 1.1, v: .1, f1: 1200, f2: 9000, q: 4 });
    },
  };
})();
