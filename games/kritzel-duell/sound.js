// Kritzel-Duell – eigene Soundeffekte, live mit WebAudio erzeugt (keine Sounddateien). made by Oskar
let ctx = null;
let master = null;
const store = {
  get muted() { try { return localStorage.getItem('kd_mute') === '1'; } catch (e) { return false; } },
  set muted(v) { try { localStorage.setItem('kd_mute', v ? '1' : '0'); } catch (e) {} },
  get volume() { try { const v = localStorage.getItem('kd_vol'); return v == null ? 0.6 : +v; } catch (e) { return 0.6; } },
  set volume(v) { try { localStorage.setItem('kd_vol', String(v)); } catch (e) {} },
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
const unlock = () => {
  const c = ensure();
  if (c) { const b = c.createBuffer(1, 1, 22050); const s = c.createBufferSource(); s.buffer = b; s.connect(master); s.start(0); }
};
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

// Ringglocke (Boxkampf): unharmonische Teiltöne mit langem Ausklang
function bell(start) {
  [[830, 0.22], [1660 * 1.02, 0.1], [2490 * 0.97, 0.06], [3320 * 1.05, 0.035]].forEach(([f, g]) => tone(f, start, 1.1, { type: 'sine', gain: g, attack: 0.002 }));
}
const SOUNDS = {
  click() { tone(660, 0, 0.06, { type: 'triangle', gain: 0.15 }); },
  pop() { tone(420, 0, 0.09, { type: 'sine', gain: 0.3, slide: 500 }); },
  join() { tone(523, 0, 0.12, { type: 'triangle', gain: 0.2 }); tone(784, 0.09, 0.16, { type: 'triangle', gain: 0.2 }); },
  leave() { tone(523, 0, 0.12, { type: 'triangle', gain: 0.2 }); tone(330, 0.09, 0.2, { type: 'triangle', gain: 0.2 }); },
  guessed() { [659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.07, 0.18, { type: 'square', gain: 0.09 })); },
  myGuess() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.06, 0.22, { type: 'triangle', gain: 0.22 })); },
  close() { tone(880, 0, 0.08, { type: 'square', gain: 0.07 }); tone(880, 0.12, 0.08, { type: 'square', gain: 0.07 }); },
  turn() { tone(392, 0, 0.14, { type: 'sawtooth', gain: 0.08 }); tone(587, 0.12, 0.25, { type: 'triangle', gain: 0.2 }); },
  round() { bell(0); bell(0.32); },
  tick() { tone(1200, 0, 0.04, { type: 'square', gain: 0.06 }); },
  reveal() { tone(659, 0, 0.18, { type: 'triangle', gain: 0.2 }); tone(523, 0.16, 0.18, { type: 'triangle', gain: 0.2 }); tone(392, 0.32, 0.35, { type: 'triangle', gain: 0.2 }); },
  like() { tone(700, 0, 0.1, { type: 'sine', gain: 0.25, slide: 400 }); },
  dislike() { tone(300, 0, 0.16, { type: 'sine', gain: 0.25, slide: -150 }); },
  win() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.13, i === 5 ? 0.6 : 0.16, { type: 'triangle', gain: 0.22 })); },
  error() { tone(200, 0, 0.18, { type: 'sawtooth', gain: 0.1 }); },
};

export const sfx = {
  play(name) {
    if (store.muted || !SOUNDS[name]) return;
    if (!ensure()) return;
    try { SOUNDS[name](); } catch (e) {}
  },
  get muted() { return store.muted; },
  set muted(v) { store.muted = v; },
  get volume() { return store.volume; },
  set volume(v) { store.volume = v; if (master) master.gain.value = v; },
};
