// Krakelpost – kleine Soundeffekte, live mit WebAudio erzeugt (keine Sounddateien). made by Oskar
let ctx = null, master = null;
const KEY = 'kp_mute';
export const sfx = {
  get muted() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } },
  set muted(v) { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) {} },
  play(name) { if (this.muted) return; if (!ensure()) return; try { (S[name] || (() => {}))(); } catch (e) {} },
};
function ensure() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
  return ctx;
}
const unlock = () => { const c = ensure(); if (c) { const b = c.createBuffer(1, 1, 22050); const s = c.createBufferSource(); s.buffer = b; s.connect(master); s.start(0); } };
['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, unlock, { once: true, passive: true }));
function tone(f, at, dur, { type = 'triangle', gain = 0.25, slide = 0 } = {}) {
  const t0 = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
}
const S = {
  click: () => tone(700, 0, 0.05, { gain: 0.12 }),
  pop: () => tone(520, 0, 0.09, { slide: 300, gain: 0.18 }),
  join: () => { tone(523, 0, 0.1); tone(784, 0.08, 0.16); },
  leave: () => { tone(523, 0, 0.1); tone(349, 0.08, 0.2); },
  start: () => [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.07, 0.2, { type: 'square', gain: 0.09 })),
  turn: () => { tone(660, 0, 0.1); tone(990, 0.09, 0.18); },
  submit: () => { tone(784, 0, 0.08); tone(1175, 0.07, 0.2); },
  tick: () => tone(1300, 0, 0.03, { type: 'square', gain: 0.05 }),
  timeup: () => { tone(880, 0, 0.12, { type: 'square', gain: 0.1 }); tone(587, 0.13, 0.25, { type: 'square', gain: 0.1 }); },
  reveal: () => tone(440, 0, 0.18, { slide: 440, gain: 0.16 }),
  like: () => tone(900, 0, 0.08, { slide: 400, gain: 0.12 }),
  error: () => tone(200, 0, 0.2, { type: 'sawtooth', gain: 0.08 }),
};
