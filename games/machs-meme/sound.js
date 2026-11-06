// Mach's Meme – eigene Soundeffekte, live mit WebAudio erzeugt (keine Sounddateien).
let ctx = null;
let master = null;
const store = {
  get muted() { try { return localStorage.getItem('mm_mute') === '1'; } catch (e) { return false; } },
  set muted(v) { try { localStorage.setItem('mm_mute', v ? '1' : '0'); } catch (e) {} },
  get volume() { try { const v = localStorage.getItem('mm_vol'); return v == null ? 0.6 : +v; } catch (e) { return 0.6; } },
  set volume(v) { try { localStorage.setItem('mm_vol', String(v)); } catch (e) {} },
};

function ensure() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = store.volume;
  master.connect(ctx.destination);
  return ctx;
}
// iOS: Audio erst nach einer Berührung erlauben
const unlock = () => { const c = ensure(); if (c) { const b = c.createBuffer(1, 1, 22050); const s = c.createBufferSource(); s.buffer = b; s.connect(master); s.start(0); } };
['pointerdown', 'keydown', 'touchend'].forEach((ev) => window.addEventListener(ev, unlock, { once: true, passive: true }));

function tone(freq, start, dur, { type = 'sine', gain = 0.3, slide = 0, attack = 0.005 } = {}) {
  const t0 = ctx.currentTime + start;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(start, dur, { gain = 0.2, freq = 1200, q = 0.8 } = {}) {
  const t0 = ctx.currentTime + start;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = ctx.createBufferSource(); s.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.value = gain;
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t0);
}

const SOUNDS = {
  click: () => tone(660, 0, 0.06, { type: 'triangle', gain: 0.15 }),
  join: () => { tone(523, 0, 0.12, { type: 'triangle' }); tone(784, 0.09, 0.18, { type: 'triangle' }); },
  leave: () => { tone(523, 0, 0.12, { type: 'triangle' }); tone(330, 0.09, 0.2, { type: 'triangle' }); },
  start: () => { [392, 523, 659, 784].forEach((f, i) => tone(f, i * 0.09, 0.22, { type: 'square', gain: 0.12 })); },
  whoosh: () => noise(0, 0.35, { gain: 0.35, freq: 900, q: 0.6 }),
  tick: () => tone(1200, 0, 0.04, { type: 'square', gain: 0.07 }),
  timeup: () => { tone(880, 0, 0.15, { type: 'square', gain: 0.12 }); tone(660, 0.16, 0.15, { type: 'square', gain: 0.12 }); tone(440, 0.32, 0.35, { type: 'square', gain: 0.12 }); },
  submit: () => { tone(784, 0, 0.1, { type: 'triangle' }); tone(1175, 0.08, 0.25, { type: 'triangle' }); },
  up: () => tone(500, 0, 0.16, { type: 'triangle', slide: 500 }),
  down: () => tone(500, 0, 0.2, { type: 'sawtooth', gain: 0.12, slide: -300 }),
  meh: () => tone(330, 0, 0.18, { type: 'triangle', gain: 0.2 }),
  buddy: () => { [880, 1109, 1319].forEach((f, i) => tone(f, i * 0.06, 0.2, { type: 'sine', gain: 0.18 })); },
  pop: () => tone(300, 0, 0.08, { type: 'sine', gain: 0.3, slide: 600 }),
  drum: () => { for (let i = 0; i < 14; i++) noise(i * 0.06, 0.06, { gain: 0.18 + i * 0.012, freq: 220, q: 1.2 }); },
  fanfare: () => { [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36], [784, 0.56], [1047, 0.68]].forEach(([f, t]) => tone(f, t, t > 0.6 ? 0.6 : 0.18, { type: 'square', gain: 0.11 })); },
  chat: () => tone(990, 0, 0.07, { type: 'sine', gain: 0.12 }),
  error: () => tone(220, 0, 0.25, { type: 'sawtooth', gain: 0.12 }),
};

export const sfx = {
  play(name) {
    if (store.muted) return;
    const c = ensure();
    if (!c || !SOUNDS[name]) return;
    try { SOUNDS[name](); } catch (e) {}
  },
  get muted() { return store.muted; },
  set muted(v) { store.muted = !!v; },
  get volume() { return store.volume; },
  set volume(v) { store.volume = v; if (master) master.gain.value = v; },
};
