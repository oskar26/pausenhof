// Kritzel-Duell – ein Spiel in der Zockbox – made by Oskar
// Einer zeichnet, alle raten. Multiplayer über ../../shared/net.js (PeerJS/WebRTC).
// Der Browser, der die Lobby erstellt, ist der Host und rechnet das ganze Spiel.
import { Room } from '../../shared/net.js';
import { AVATARS, getProfile, setName, setAvatar, randomName, NAME_MAX } from '../../shared/profile.js';
import { WORDS } from './words.js';
import { sfx } from './sound.js';
import { figSvg, validFig, randomFig, parseFig, FIG_PARTS } from './avatars.js';

const GAME_ID = 'kritzel-duell-v1'; // nicht ändern – Peer-IDs: zockbox-kritzel-duell-v1-...

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------
const W = 800, H_ = 600; // logische Zeichenfläche
const PALETTE = [
  '#ffffff', '#000000', '#c8c8d0', '#6b6b78', '#3a3a44', '#ff3b30', '#9e1b14', '#ff8a00', '#b85a00',
  '#ffd60a', '#d4a200', '#7ddc1f', '#1f9e3a', '#0b5a2a', '#2de0c0', '#0b8f80', '#38b6ff', '#1463d6',
  '#0b2a7a', '#8e5bff', '#5a1fa8', '#ff5fc8', '#b0216e', '#ffc9a8', '#c98a5a', '#6e3b1a',
];
const PAL_RGB = PALETTE.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const SIZES = [4, 10, 18, 30, 44];
const DRAW_TIMES = [15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 150, 180, 210, 240];
const DEFAULT_SETTINGS = { max: 10, time: 80, rounds: 3, count: 3, hints: 2, mode: 'normal', custom: '', customOnly: false, lang: 'de' };
const T = { round: 2600, choose: 15000, reveal: 5500, final: 15000, auto: 15000 };
const MODE_HINT = {
  normal: 'Normal: Die Rater sehen Striche für jeden Buchstaben, nach und nach kommen Hinweise.',
  hidden: 'Versteckt: Die Rater sehen weder Buchstabenanzahl noch Hinweise – nur die Zeichnung zählt.',
  combo: 'Kombination: Jedes Wort besteht aus zwei Wörtern (z. B. „Apfel + Baum“). Es zählt nur, wer beide errät.',
};
const BAD_WORDS = ['scheiß', 'scheiss', 'fick', 'fotze', 'hurensohn', 'hure', 'wichser', 'arschloch', 'schlampe', 'nutte', 'missgeburt', 'spast', 'bastard',
  'fuck', 'shit', 'bitch', 'cunt', 'pussy', 'whore', 'slut', 'nigg', 'neger', 'porn', 'motherf', 'asshole', 'wanker', 'nazi', 'hitler'];
const BAD_RE = new RegExp(BAD_WORDS.join('|'), 'gi');
const cleanBad = (s) => String(s).replace(BAD_RE, (m) => m[0] + '*'.repeat(Math.max(1, m.length - 1)));

// PeerJS loggt erwartete Fehlversuche (leere öffentliche Plätze) als Konsolenfehler – leiser stellen.
if (typeof window.Peer === 'function') {
  const OrigPeer = window.Peer;
  window.Peer = class extends OrigPeer {
    constructor(a, b) {
      if (a && typeof a === 'object') super({ ...a, debug: 0 });
      else super(a, { ...(b || {}), debug: 0 });
    }
  };
}

// ---------------------------------------------------------------------------
// Helfer
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const AV_COLORS = ['#ffb3dc', '#a8e6ff', '#c3f7a0', '#ffe28a', '#d6c2ff', '#ffc9a3', '#9ff5e1', '#ffaaa8'];
const avColor = (key) => { let h = 0; for (const ch of String(key)) h = (h * 31 + ch.codePointAt(0)) >>> 0; return AV_COLORS[h % AV_COLORS.length]; };
// Avatar: eigene Kritzel-Figur, sonst das Zockbox-Emoji (shared/profile.js) als Fallback
const avHtml = (p, cls = 'av') => (validFig(p.fig)
  ? `<span class="${cls} fig">${figSvg(p.fig)}</span>`
  : `<span class="${cls} emo" style="background:${avColor((p.avatar || '') + (p.name || ''))}">${esc(p.avatar)}</span>`);
const ICON = (id, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;

// Vergleich von Tipps: klein, Umlaute ausgeschrieben, nur Buchstaben/Ziffern.
function norm(s) {
  return String(s || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}
function lev(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 1) return 2; // uns interessiert nur 0/1
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
const isLetter = (ch) => /[\p{L}\p{N}]/u.test(ch);

// ---------------------------------------------------------------------------
// Zeichenfläche: eigener Pixel-Rasterizer (deterministisch → Fülleimer sieht überall gleich aus)
// ---------------------------------------------------------------------------
class Board {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    this.img = this.ctx.createImageData(W, H_);
    this.d = this.img.data;
    this.ops = [];
    this.cps = new Map();
    this.dirty = null;
    this.raf = 0;
    this.spans = {};
    this.reset();
  }
  span(r) { // horizontale Halbbreiten pro Zeile für einen Kreis mit Radius r
    if (!this.spans[r]) { const a = []; for (let dy = -r; dy <= r; dy++) a.push(Math.floor(Math.sqrt(r * r - dy * dy + r * 0.8))); this.spans[r] = a; }
    return this.spans[r];
  }
  mark(x0, y0, x1, y1) {
    x0 = clamp(Math.floor(x0), 0, W - 1); y0 = clamp(Math.floor(y0), 0, H_ - 1); x1 = clamp(Math.ceil(x1), 0, W - 1); y1 = clamp(Math.ceil(y1), 0, H_ - 1);
    if (!this.dirty) this.dirty = [x0, y0, x1, y1];
    else { const d = this.dirty; d[0] = Math.min(d[0], x0); d[1] = Math.min(d[1], y0); d[2] = Math.max(d[2], x1); d[3] = Math.max(d[3], y1); }
    if (!this.raf) this.raf = requestAnimationFrame(() => this.flush());
  }
  flush() {
    this.raf = 0;
    const d = this.dirty; if (!d) return;
    this.dirty = null;
    this.ctx.putImageData(this.img, 0, 0, d[0], d[1], d[2] - d[0] + 1, d[3] - d[1] + 1);
  }
  clearPixels() { this.d.fill(255); this.mark(0, 0, W - 1, H_ - 1); }
  reset() { this.ops = []; this.cps.clear(); this.clearPixels(); this.cps.set(0, new Uint8ClampedArray(this.d)); }
  stamp(cx, cy, r, rgb) {
    const s = this.span(r), d = this.d;
    for (let dy = -r; dy <= r; dy++) {
      const y = cy + dy; if (y < 0 || y >= H_) continue;
      const hw = s[dy + r];
      let xa = Math.max(0, cx - hw), xb = Math.min(W - 1, cx + hw);
      let i = (y * W + xa) * 4;
      for (let x = xa; x <= xb; x++, i += 4) { d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255; }
    }
    this.mark(cx - r, cy - r, cx + r, cy + r);
  }
  line(x0, y0, x1, y1, size, c) {
    const r = Math.max(1, Math.round(size / 2)), rgb = PAL_RGB[c] || PAL_RGB[1];
    const dx = x1 - x0, dy = y1 - y0, dist = Math.hypot(dx, dy);
    const step = Math.max(1, r * 0.35);
    const n = Math.max(1, Math.ceil(dist / step));
    for (let k = 0; k <= n; k++) this.stamp(Math.round(x0 + (dx * k) / n), Math.round(y0 + (dy * k) / n), r, rgb);
  }
  drawStroke(op, from = 0) {
    const p = op.p;
    if (p.length < 2) return;
    if (from === 0) { this.line(p[0], p[1], p[0], p[1], op.s, op.c); from = 2; }
    for (let i = Math.max(2, from); i + 1 < p.length; i += 2) this.line(p[i - 2], p[i - 1], p[i], p[i + 1], op.s, op.c);
  }
  floodFill(x, y, c) {
    x = clamp(Math.floor(x), 0, W - 1); y = clamp(Math.floor(y), 0, H_ - 1);
    const d = this.d, rgb = PAL_RGB[c] || PAL_RGB[1];
    const i0 = (y * W + x) * 4;
    const tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2];
    if (tr === rgb[0] && tg === rgb[1] && tb === rgb[2]) return;
    const same = (i) => d[i] === tr && d[i + 1] === tg && d[i + 2] === tb;
    const stack = [x, y];
    let minX = x, maxX = x, minY = y, maxY = y;
    while (stack.length) {
      const sy = stack.pop(), sx = stack.pop();
      let lx = sx; let i = (sy * W + lx) * 4;
      if (!same(i)) continue;
      while (lx > 0 && same(i - 4)) { lx--; i -= 4; }
      let rx = sx; let j = (sy * W + rx) * 4;
      while (rx < W - 1 && same(j + 4)) { rx++; j += 4; }
      let upOpen = false, dnOpen = false;
      for (let xx = lx, k = (sy * W + lx) * 4; xx <= rx; xx++, k += 4) {
        d[k] = rgb[0]; d[k + 1] = rgb[1]; d[k + 2] = rgb[2]; d[k + 3] = 255;
        if (sy > 0) { const u = k - W * 4; if (same(u)) { if (!upOpen) { stack.push(xx, sy - 1); upOpen = true; } } else upOpen = false; }
        if (sy < H_ - 1) { const v = k + W * 4; if (same(v)) { if (!dnOpen) { stack.push(xx, sy + 1); dnOpen = true; } } else dnOpen = false; }
      }
      if (lx < minX) minX = lx; if (rx > maxX) maxX = rx; if (sy < minY) minY = sy; if (sy > maxY) maxY = sy;
    }
    this.mark(minX, minY, maxX, maxY);
  }
  render(op, from = 0) {
    if (op.k === 's') this.drawStroke(op, from);
    else if (op.k === 'f') this.floodFill(op.x, op.y, op.c);
    else if (op.k === 'x') this.clearPixels();
  }
  push(op) { // neuen Schritt anfangen
    const i = this.ops.length;
    if (i > 0 && i % 25 === 0 && !this.cps.has(i)) this.cps.set(i, new Uint8ClampedArray(this.d));
    this.ops.push(op);
    this.render(op);
  }
  extend(pts) { // laufenden Strich verlängern
    const op = this.ops[this.ops.length - 1];
    if (!op || op.k !== 's') return;
    const from = op.p.length;
    for (const v of pts) op.p.push(v);
    this.drawStroke(op, from);
  }
  undo() {
    if (!this.ops.length) return;
    this.ops.pop();
    const n = this.ops.length;
    let best = 0;
    for (const k of [...this.cps.keys()]) { if (k > n) this.cps.delete(k); else if (k > best) best = k; }
    this.d.set(this.cps.get(best) || this.cps.get(0));
    for (let i = best; i < n; i++) this.render(this.ops[i]);
    this.mark(0, 0, W - 1, H_ - 1);
  }
  load(ops) { this.reset(); for (const op of ops) this.push({ ...op, p: op.p ? op.p.slice() : undefined }); }
  colorAt(x, y) {
    const i = (clamp(Math.floor(y), 0, H_ - 1) * W + clamp(Math.floor(x), 0, W - 1)) * 4, d = this.d;
    let best = 0, bd = Infinity;
    PAL_RGB.forEach((c, k) => { const dd = (c[0] - d[i]) ** 2 + (c[1] - d[i + 1]) ** 2 + (c[2] - d[i + 2]) ** 2; if (dd < bd) { bd = dd; best = k; } });
    return best;
  }
}
const board = new Board($('canvas'));

// ---------------------------------------------------------------------------
// Toasts, Modal
// ---------------------------------------------------------------------------
function toast(msg, opts = {}) {
  const t = document.createElement('div');
  t.className = 'kd-toast' + (opts.err ? ' err' : '');
  t.textContent = msg;
  $('toasts').appendChild(t);
  if (opts.err) sfx.play('error');
  setTimeout(() => t.remove(), opts.ms || 3200);
}
function openModal(html, onMount) {
  $('modalCard').innerHTML = html;
  $('modal').classList.remove('hidden');
  if (onMount) onMount($('modalCard'));
}
function closeModal() { $('modal').classList.add('hidden'); $('modalCard').innerHTML = ''; }
$('modal').addEventListener('click', (e) => { if (e.target === $('modal')) closeModal(); });

// ---------------------------------------------------------------------------
// Profil (gemeinsam mit der Zockbox: ph_name / ph_avatar)
// ---------------------------------------------------------------------------
const me = getProfile();
if (!AVATARS.includes(me.avatar)) { me.avatar = pick(AVATARS); setAvatar(me.avatar); }
if (!me.name) me.name = randomName(); // Vorschlag – gespeichert wird erst beim Beitreten
me.fig = parseFig(lsGet('kd_fig', '')) || randomFig();
me.useEmoji = lsGet('kd_emoji', '0') === '1';
const saveFig = () => { lsSet('kd_fig', me.fig.join('.')); lsSet('kd_emoji', me.useEmoji ? '1' : '0'); };
const myAv = () => ({ name: me.name, avatar: me.avatar, fig: me.useEmoji ? null : me.fig });
let devId = lsGet('kd_dev', '');
if (!devId) { devId = Math.random().toString(36).slice(2) + Date.now().toString(36); lsSet('kd_dev', devId); }

// Avatar-Baukasten: Pfeile links/rechts je Teil (Farbe, Augen, Mund, Extra), Würfel, Emoji-Fallback
const avBoxes = [];
function mountAvBox(el) {
  const arrows = (dir) => `<div class="av-arrows">${FIG_PARTS.map((p, i) => `<button type="button" class="av-arr" data-part="${i}" data-dir="${dir}" title="${p.label} ${dir < 0 ? 'zurück' : 'weiter'}">${ICON(dir < 0 ? 'left' : 'right')}<span>${p.label} ${dir < 0 ? 'zurück' : 'weiter'}</span></button>`).join('')}</div>`;
  el.innerHTML = `${arrows(-1)}<div class="av-center"><div class="av-part"></div><div class="av-big" title="Zufällige Figur"></div>
    <div class="av-tools"><button type="button" data-a="dice" title="Zufällige Figur" aria-label="Zufällige Figur">${ICON('dice')}</button><button type="button" data-a="emoji" title="Zockbox-Emoji statt Figur" aria-label="Zockbox-Emoji statt Figur">${esc(me.avatar)}</button></div></div>${arrows(1)}`;
  const label = el.querySelector('.av-part');
  let labelT = 0;
  const say = (t) => { label.textContent = t; clearTimeout(labelT); labelT = setTimeout(() => { label.textContent = ''; }, 1400); };
  el.addEventListener('click', (e) => {
    const arr = e.target.closest('.av-arr');
    if (arr) {
      const i = +arr.dataset.part, n = FIG_PARTS[i].n;
      me.useEmoji = false;
      me.fig[i] = (me.fig[i] + +arr.dataset.dir + n) % n;
      saveFig(); sfx.play('click'); say(`${FIG_PARTS[i].label} ${me.fig[i] + 1}/${n}`); refreshAvBoxes(); onAvatarChange();
      return;
    }
    const t = e.target.closest('[data-a]');
    if ((t && t.dataset.a === 'dice') || e.target.closest('.av-big')) {
      if (me.useEmoji && !t) { emojiPicker(); return; }
      me.useEmoji = false; me.fig = randomFig(); saveFig(); sfx.play('pop'); refreshAvBoxes(); onAvatarChange(); return;
    }
    if (t && t.dataset.a === 'emoji') { emojiPicker(); }
  });
  for (let i = avBoxes.length - 1; i >= 0; i--) if (!avBoxes[i].isConnected) avBoxes.splice(i, 1);
  avBoxes.push(el);
  refreshAvBoxes();
}
function refreshAvBoxes() {
  for (const el of avBoxes) {
    if (!el.isConnected) continue;
    el.querySelector('.av-big').innerHTML = avHtml(myAv(), 'av');
    const eb = el.querySelector('[data-a=emoji]'); eb.textContent = me.avatar; eb.classList.toggle('on', me.useEmoji);
  }
}
function emojiPicker() {
  openModal(`<h2>Zockbox-Emoji</h2><p>Statt der Kritzel-Figur dein Emoji aus der Zockbox benutzen.</p>
    <div class="av-emoji-grid">${AVATARS.map((a) => `<button type="button" data-av="${a}" class="${me.useEmoji && a === me.avatar ? 'on' : ''}">${a}</button>`).join('')}</div>
    <div class="modal-btns"><button class="kd-btn kd-btn-white" id="mFig" type="button"><span>Lieber Figur</span></button><button class="kd-btn kd-btn-go" id="mOk" type="button"><span>Passt!</span></button></div>`, (card) => {
    card.querySelectorAll('[data-av]').forEach((b) => b.onclick = () => {
      me.avatar = b.dataset.av; setAvatar(me.avatar); me.useEmoji = true; saveFig();
      card.querySelectorAll('[data-av]').forEach((x) => x.classList.toggle('on', x === b)); sfx.play('pop'); refreshAvBoxes(); onAvatarChange();
    });
    card.querySelector('#mFig').onclick = () => { me.useEmoji = false; saveFig(); closeModal(); refreshAvBoxes(); onAvatarChange(); };
    card.querySelector('#mOk').onclick = () => { closeModal(); };
  });
}
let avSendT = 0;
function onAvatarChange() { // im Raum: Änderung an den Host schicken (gebündelt)
  if (!room) return;
  clearTimeout(avSendT);
  avSendT = setTimeout(() => room && room.send({ t: 'profile', ...myAv() }), 350);
}
function showProfile() {
  for (const id of ['nameInput', 'nameInput2']) if (document.activeElement !== $(id)) $(id).value = me.name;
  refreshAvBoxes();
}
function readProfile() {
  if (!me.name) me.name = setName(randomName());
  else setName(me.name);
  saveFig();
  showProfile();
  return { ...myAv(), dev: devId };
}
for (const id of ['nameInput', 'nameInput2']) {
  $(id).maxLength = NAME_MAX;
  $(id).addEventListener('input', (e) => { me.name = setName(e.target.value); });
  $(id).addEventListener('blur', () => { if (!me.name) me.name = setName(randomName()); showProfile(); });
}
function profileModal() { // im Raum: eigenen Namen/Figur ändern
  openModal(`<h2>Deine Figur</h2><div class="kd-avbox" id="mAvBox"></div>
    <div class="kd-namerow" style="margin-top:12px"><input class="kd-input" id="mName" type="text" maxlength="${NAME_MAX}" value="${esc(me.name)}" placeholder="Gib deinen Namen ein" autocomplete="off"></div>
    <div class="modal-btns"><button class="kd-btn kd-btn-go" id="mOk" type="button"><span>Passt!</span></button></div>`, (card) => {
    mountAvBox(card.querySelector('#mAvBox'));
    card.querySelector('#mOk').onclick = () => {
      me.name = setName(card.querySelector('#mName').value || randomName());
      closeModal(); showProfile();
      room && room.send({ t: 'profile', ...myAv() });
    };
  });
}
mountAvBox($('avBox'));
mountAvBox($('avBox2'));
showProfile();

// Startseite: zwei zufällige Figuren im Duell + „Wie gespielt wird“-Folien
function vsRow() {
  const a = randomFig(), b = randomFig();
  a[3] = pick([1, 10, 10, 0, 2]); b[3] = pick([1, 10, 10, 0, 6]);
  $('vsRow').innerHTML = `<span class="vs-fig l">${figSvg(a)}</span><span class="vs-badge">VS</span><span class="vs-fig r">${figSvg(b)}</span>`;
}
vsRow();
setInterval(() => { if (curScreen === 'home' && !document.hidden) vsRow(); }, 4800);
let howIdx = 0, howT = 0;
const howSlides = [...document.querySelectorAll('#howSlides .how-slide')];
$('howDots').innerHTML = howSlides.map((_, i) => `<button type="button" aria-label="Schritt ${i + 1}" data-i="${i}"></button>`).join('');
function howGo(i) {
  howIdx = (i + howSlides.length) % howSlides.length;
  howSlides.forEach((el, k) => el.classList.toggle('on', k === howIdx));
  document.querySelectorAll('#howDots button').forEach((b, k) => b.classList.toggle('on', k === howIdx));
  clearTimeout(howT); howT = setTimeout(() => { if (curScreen === 'home') howGo(howIdx + 1); else howT = 0; }, 5200);
}
$('howDots').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) howGo(+b.dataset.i); });
$('howSlides').addEventListener('click', () => howGo(howIdx + 1));
howGo(0);

// ---------------------------------------------------------------------------
// Bildschirme
// ---------------------------------------------------------------------------
const SCREENS = ['home', 'invite', 'room'];
let curScreen = 'home';
function show(name) {
  if (name === curScreen && name === 'room') return;
  for (const s of SCREENS) $('scr-' + s).classList.toggle('hidden', s !== name);
  curScreen = name;
  if (name === 'home' && !howT) howGo(howIdx);
  document.body.classList.toggle('on-home', name !== 'room');
  document.body.classList.toggle('in-room', name === 'room');
  if (name === 'room') { window.scrollTo(0, 0); requestAnimationFrame(fitBoard); }
}

// ===========================================================================
// HOST-LOGIK (läuft nur im Browser des Raum-Erstellers)
// ===========================================================================
let room = null;
let H = null;

function newHostState() {
  return {
    phase: 'lobby', settings: { ...DEFAULT_SETTINGS }, players: {}, order: [],
    round: 0, queue: [], drawer: null, turn: 0, choices: [], word: null, targets: [], chars: [], revealed: new Set(),
    hintAt: [], guessed: new Map(), gains: {}, turnStart: 0, endsAt: 0, totalMs: 0, ops: [],
    likes: {}, reveal: null, final: null, kicks: new Map(), bans: new Set(), rate: {}, used: new Set(), autoAt: 0,
    seen: {}, lastPing: 0,
  };
}
const count = () => H.order.length;
const pname = (id) => (H.players[id] || {}).name || '?';
function customList(s = H.settings) {
  const seen = new Set();
  return String(s.custom || '').split(',').map((w) => w.replace(/\s+/g, ' ').trim()).filter((w) => {
    if (w.length < 1 || w.length > 32 || !/[\p{L}\p{N}]/u.test(w)) return false;
    const k = norm(w); if (!k || seen.has(k)) return false; seen.add(k); return true;
  });
}
function wordPool() {
  const custom = customList();
  if (H.settings.customOnly && custom.length) return { main: custom, custom: [] };
  return { main: WORDS, custom };
}
function drawOne(list, filter = () => true) {
  let free = list.filter((w) => !H.used.has(norm(w)) && filter(w));
  if (!free.length) free = list.filter(filter);
  if (!free.length) free = list;
  const w = pick(free);
  H.used.add(norm(w));
  return w;
}
function makeChoices() {
  const { main, custom } = wordPool();
  const n = H.settings.count, out = [];
  const simple = (w) => /^[\p{L}]+$/u.test(w) && w.length <= 10;
  for (let i = 0; i < n * 3 && out.length < n; i++) {
    let w;
    if (H.settings.mode === 'combo') {
      const src = custom.length && Math.random() < 0.5 ? custom : main;
      const a = drawOne(src, simple), b = drawOne(main.length > 1 ? main : src, (x) => simple(x) && norm(x) !== norm(a));
      w = `${a} + ${b}`;
    } else w = drawOne(custom.length && Math.random() < 0.5 ? custom : main);
    if (!out.some((x) => norm(x) === norm(w))) out.push(w);
  }
  return out;
}

function personalState(pid) {
  const isDrawer = pid === H.drawer;
  const knows = isDrawer || H.guessed.has(pid) || H.phase === 'reveal';
  const st = {
    t: 'state', phase: H.phase, hostId: room.myId, code: room.code, isPublic: room.isPublic,
    settings: { ...H.settings, custom: pid === room.myId ? H.settings.custom : '', customCount: customList().length },
    round: H.round, turn: H.turn, drawer: H.drawer,
    players: H.order.map((id) => ({ id, name: H.players[id].name, avatar: H.players[id].avatar, fig: H.players[id].fig, score: H.players[id].score, guessed: H.guessed.has(id) })),
    endsIn: H.endsAt ? Math.max(0, H.endsAt - Date.now()) : 0, totalMs: H.totalMs,
    autoIn: H.autoAt ? Math.max(0, H.autoAt - Date.now()) : 0,
    liked: pid in H.likes,
  };
  if (H.phase === 'choose' && isDrawer) st.choices = H.choices;
  if (H.phase === 'draw' || H.phase === 'reveal') {
    st.hidden = H.settings.mode === 'hidden';
    if (knows) st.word = H.word;
    if (!st.hidden || knows) st.mask = H.chars.map((ch, i) => (!isLetter(ch) || knows || H.revealed.has(i) ? ch : '_'));
  }
  if (H.phase === 'reveal') st.reveal = H.reveal;
  if (H.phase === 'final') st.final = H.final;
  const kick = [...H.kicks.entries()].find(([t]) => H.players[t]);
  if (kick) st.kick = { target: kick[0], name: pname(kick[0]), votes: [...kick[1]].filter((v) => H.players[v]).length, need: kickNeed(kick[0]), mine: kick[1].has(pid) };
  return st;
}
function sync() { if (!room || !room.isHost) return; for (const id of H.order) room.sendTo(id, personalState(id)); }
function sendAll(msg, filter) { for (const id of H.order) if (!filter || filter(id)) room.sendTo(id, msg); }
function sys(text, k = 'info', filter) { sendAll({ t: 'chat', k, text }, filter); }
function setTimer(ms) { H.totalMs = ms; H.endsAt = ms ? Date.now() + ms : 0; }

function startGame() {
  if (H.settings.customOnly && customList().length < 10) {
    sys('Für „Nur eigene Wörter benutzen“ brauchst du mindestens 10 eigene Wörter!', 'err', (id) => id === room.myId); return;
  }
  H.round = 0; H.used.clear(); // H.turn läuft weiter: Clients erkennen so jeden neuen Zug sicher H.autoAt = 0; H.final = null; H.reveal = null;
  for (const id of H.order) H.players[id].score = 0;
  nextRound();
}
function nextRound() {
  H.round++;
  if (H.round > H.settings.rounds) { finishGame(); return; }
  H.queue = H.order.slice();
  H.drawer = null; H.guessed = new Map(); H.reveal = null;
  H.phase = 'round'; setTimer(T.round); sync();
}
function nextTurn() {
  H.queue = H.queue.filter((id) => H.players[id]);
  if (!H.queue.length) { nextRound(); return; }
  H.drawer = H.queue.shift();
  H.turn++;
  H.choices = makeChoices();
  H.word = null; H.chars = []; H.guessed = new Map(); H.gains = {}; H.likes = {}; H.ops = []; H.reveal = null; H.revealed = new Set();
  H.phase = 'choose'; setTimer(T.choose); sync();
}
function chooseWord(i) {
  const w = H.choices[i] ?? H.choices[0];
  H.word = w;
  H.chars = [...w];
  if (H.settings.mode === 'combo') {
    const [a, b] = w.split(' + ');
    H.targets = [norm(a) + norm(b), norm(b) + norm(a)];
  } else H.targets = [norm(w)];
  const letters = H.chars.map((ch, k) => (isLetter(ch) ? k : -1)).filter((k) => k >= 0);
  const nh = H.settings.mode === 'hidden' ? 0 : Math.min(H.settings.hints, Math.max(0, letters.length - 2), Math.ceil(letters.length / 2));
  const ms = H.settings.time * 1000;
  H.hintAt = Array.from({ length: nh }, (_, k) => Math.round((ms * (k + 1)) / (nh + 1)));
  H.phase = 'draw'; H.turnStart = Date.now(); setTimer(ms);
  sys(`${pname(H.drawer)} zeichnet nun!`, 'draw');
  sync();
}
function revealHint() {
  const free = H.chars.map((ch, k) => (isLetter(ch) && !H.revealed.has(k) ? k : -1)).filter((k) => k >= 0);
  if (free.length > 1) H.revealed.add(pick(free));
}
function guessers() { return H.order.filter((id) => id !== H.drawer); }
function endTurn(reason) {
  if (H.phase !== 'draw' && H.phase !== 'choose') return;
  const gains = {};
  for (const [id, pts] of H.guessed) gains[id] = pts;
  const g = guessers().length;
  if (H.drawer && H.players[H.drawer] && H.guessed.size) {
    const sum = [...H.guessed.values()].reduce((a, b) => a + b, 0);
    gains[H.drawer] = Math.round(sum / Math.max(1, g));
  }
  for (const [id, pts] of Object.entries(gains)) if (H.players[id]) H.players[id].score += pts;
  const likes = Object.values(H.likes);
  H.reveal = {
    word: H.word, reason, drawer: H.drawer, likes: likes.filter((v) => v === 1).length, dislikes: likes.filter((v) => v === 0).length,
    gains: H.order.map((id) => ({ id, name: H.players[id].name, avatar: H.players[id].avatar, fig: H.players[id].fig, pts: gains[id] || 0, drawer: id === H.drawer }))
      .sort((a, b) => b.pts - a.pts),
  };
  if (H.word) sys(`Das Wort war '${H.word}'`, 'word');
  H.phase = 'reveal'; setTimer(T.reveal); sync();
}
function finishGame() {
  const ranked = H.order.map((id) => ({ id, name: H.players[id].name, avatar: H.players[id].avatar, fig: H.players[id].fig, score: H.players[id].score }))
    .sort((a, b) => b.score - a.score);
  let rank = 0, last = null;
  ranked.forEach((p, i) => { if (p.score !== last) { rank = i + 1; last = p.score; } p.rank = rank; });
  H.final = ranked;
  const winners = ranked.filter((p) => p.rank === 1);
  if (!winners.length || winners[0].score <= 0) sys('Niemand hat gewonnen!', 'owner');
  else if (winners.length === 1) sys(`${winners[0].name} hat mit einem Punktestand von ${winners[0].score} gewonnen!`, 'owner');
  else sys(`${winners.map((w) => w.name).join(' und ')} haben mit einem Punktestand von ${winners[0].score} gewonnen!`, 'owner');
  H.drawer = null; H.guessed = new Map();
  H.phase = 'final'; setTimer(T.final); sync();
}
function backToLobby(msg) {
  H.phase = 'lobby'; H.drawer = null; H.guessed = new Map(); H.reveal = null; H.final = null; H.round = 0; setTimer(0); H.autoAt = 0;
  if (msg) sys(msg, 'err');
  sync();
}
function kickNeed(target) { const others = H.order.filter((x) => x !== target).length; return clamp(Math.floor(others / 2) + 1, 1, Math.max(1, others)); }

const HB_TIMEOUT = 20000; // so lange ohne Lebenszeichen → Spieler gilt als weg
function hostTick() {
  if (!H) return;
  const now = Date.now();
  if (now - H.lastPing > 3000) { H.lastPing = now; for (const id of H.order) if (id !== room.myId) room.sendTo(id, { t: 'ping' }); }
  for (const id of H.order.slice()) {
    if (id !== room.myId && H.seen[id] && now - H.seen[id] > HB_TIMEOUT) { room.kick(id); hostRemove(id); }
  }
  if (H.phase === 'lobby') {
    let want = 0;
    if (room.isPublic && count() >= 2) want = T.auto;
    if (!want && H.autoAt) { H.autoAt = 0; sync(); }
    else if (want && !H.autoAt) { H.autoAt = now + want; sync(); }
    if (H.autoAt && now >= H.autoAt) startGame();
    return;
  }
  if (H.phase === 'draw') {
    const el = now - H.turnStart;
    let changed = false;
    while (H.hintAt.length && el >= H.hintAt[0]) { H.hintAt.shift(); revealHint(); changed = true; }
    if (changed) sync();
  }
  if (!H.endsAt || now < H.endsAt) return;
  H.endsAt = 0;
  switch (H.phase) {
    case 'round': nextTurn(); break;
    case 'choose': chooseWord(Math.floor(Math.random() * H.choices.length)); break;
    case 'draw': endTurn('time'); break;
    case 'reveal': nextTurn(); break;
    case 'final': backToLobby(); break;
  }
}

function relayDraw(from, msg) { for (const id of H.order) if (id !== from) room.sendTo(id, msg); }
function hostDraw(from, msg) {
  if (H.phase !== 'draw' || from !== H.drawer) return;
  const ints = (a) => (Array.isArray(a) ? a.slice(0, 4000).map((v) => clamp(Math.round(+v) || 0, -50, 850)) : []);
  const c = clamp(+msg.c | 0, 0, PALETTE.length - 1), s = clamp(+msg.s | 0, 1, 60);
  let out;
  switch (msg.a) {
    case 'b': { const p = ints(msg.p); H.ops.push({ k: 's', c, s, p }); out = { t: 'd', a: 'b', c, s, p }; break; }
    case 'm': { const op = H.ops[H.ops.length - 1]; if (!op || op.k !== 's') return; const p = ints(msg.p); op.p.push(...p); out = { t: 'd', a: 'm', p }; break; }
    case 'f': { const x = clamp(+msg.x | 0, 0, W - 1), y = clamp(+msg.y | 0, 0, H_ - 1); H.ops.push({ k: 'f', c, x, y }); out = { t: 'd', a: 'f', c, x, y }; break; }
    case 'u': if (!H.ops.length) return; H.ops.pop(); out = { t: 'd', a: 'u' }; break;
    case 'x': H.ops.push({ k: 'x' }); out = { t: 'd', a: 'x' }; break;
    default: return;
  }
  relayDraw(from, out);
}

function hostChat(from, raw) {
  const p = H.players[from]; if (!p) return;
  const now = Date.now();
  const r = (H.rate[from] = (H.rate[from] || []).filter((t) => now - t < 4000));
  if (r.length >= 6) { room.sendTo(from, { t: 'chat', k: 'err', text: 'Spam erkannt! Du sendest Nachrichten zu schnell.' }); return; }
  r.push(now);
  const text = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 100);
  if (!text) return;
  const base = { t: 'chat', id: from, name: p.name, avatar: p.avatar, text };
  if (H.phase === 'draw' && H.word) {
    const n = norm(text);
    const insider = (id) => id === H.drawer || H.guessed.has(id);
    if (insider(from)) {
      if (n && H.targets.some((t) => n.includes(t))) { room.sendTo(from, { t: 'chat', k: 'err', text: 'Psst! Das Wort darfst du nicht verraten.' }); return; }
      sendAll({ ...base, k: 'gc' }, insider);
      return;
    }
    if (n && H.targets.includes(n)) {
      const frac = clamp((now - H.turnStart) / H.totalMs, 0, 1);
      const pts = Math.max(50, Math.round(50 + 450 * (1 - frac)) - 20 * H.guessed.size);
      H.guessed.set(from, pts);
      sys(`${p.name} hat das Wort erraten!`, 'guessed');
      room.sendTo(from, { t: 'guessOk', pts });
      if (guessers().every((id) => H.guessed.has(id))) { endTurn('all'); return; }
      sync();
      return;
    }
    sendAll({ ...base, k: 'msg' });
    if (n && H.targets.some((t) => lev(n, t) === 1)) room.sendTo(from, { t: 'chat', k: 'close', text: `'${text}' ist nah dran!` });
    return;
  }
  sendAll({ ...base, k: 'msg' });
}

function hostRemove(id, how) {
  if (!H.players[id]) return;
  const name = H.players[id].name;
  delete H.players[id];
  H.order = H.order.filter((x) => x !== id);
  H.queue = H.queue.filter((x) => x !== id);
  H.guessed.delete(id); delete H.likes[id]; H.kicks.delete(id);
  for (const set of H.kicks.values()) set.delete(id);
  sys(how === 'kick' ? `${name} wurde gekickt!` : how === 'ban' ? `${name} wurde gebannt!` : `${name} hat den Raum verlassen!`, 'leave');
  if (H.phase !== 'lobby' && H.phase !== 'final' && count() < 2) { backToLobby('Zu wenige Spieler – zurück in die Lobby.'); return; }
  if (id === H.drawer) {
    if (H.phase === 'draw') { endTurn('left'); return; }
    if (H.phase === 'choose') { H.drawer = null; nextTurn(); return; }
  }
  if (H.phase === 'draw' && guessers().length && guessers().every((x) => H.guessed.has(x))) { endTurn('all'); return; }
  sync();
}
function doKick(id, ban) {
  if (!H.players[id] || id === room.myId) return;
  if (ban && H.players[id].dev) H.bans.add(H.players[id].dev);
  room.sendTo(id, { t: 'kicked', ban });
  setTimeout(() => room.kick(id), 250);
  hostRemove(id, ban ? 'ban' : 'kick');
}

function hostHandle(from, msg) {
  const isHostMsg = from === room.myId;
  H.seen[from] = Date.now();
  switch (msg.t) {
    case 'hb': break;
    case 'bye': if (!isHostMsg) { room.kick(from); hostRemove(from); } break;
    case 'd': hostDraw(from, msg); break;
    case 'chat': hostChat(from, msg.text); break;
    case 'settings': {
      if (!isHostMsg || H.phase !== 'lobby') return;
      const s = H.settings;
      if (+msg.max >= 2 && +msg.max <= 30) s.max = Math.max(Math.round(+msg.max), count());
      if (DRAW_TIMES.includes(+msg.time)) s.time = +msg.time;
      if (+msg.rounds >= 2 && +msg.rounds <= 10) s.rounds = Math.round(+msg.rounds);
      if (+msg.count >= 1 && +msg.count <= 5) s.count = Math.round(+msg.count);
      if (+msg.hints >= 0 && +msg.hints <= 5) s.hints = Math.round(+msg.hints);
      if (['normal', 'hidden', 'combo'].includes(msg.mode)) s.mode = msg.mode;
      if (typeof msg.custom === 'string') s.custom = msg.custom.slice(0, 10000);
      if (typeof msg.customOnly === 'boolean') s.customOnly = msg.customOnly;
      sync();
      break;
    }
    case 'start':
      if (!isHostMsg || H.phase !== 'lobby') return;
      if (count() < 2) { room.sendTo(from, { t: 'chat', k: 'err', text: 'Du brauchst mind. 2 Spieler um das Spiel zu starten!' }); return; }
      startGame();
      break;
    case 'lobby': if (isHostMsg && H.phase === 'final') backToLobby(); break;
    case 'choose':
      if (H.phase !== 'choose' || from !== H.drawer) return;
      chooseWord(clamp(+msg.i | 0, 0, H.choices.length - 1));
      break;
    case 'like': {
      if (H.phase !== 'draw' || from === H.drawer || from in H.likes || !H.players[from]) return;
      H.likes[from] = msg.v ? 1 : 0;
      sys(msg.v ? `${pname(from)} mag die Zeichnung!` : `${pname(from)} mag die Zeichnung nicht!`, msg.v ? 'like' : 'dislike');
      sync();
      break;
    }
    case 'profile': {
      const p = H.players[from]; if (!p) return;
      const old = p.name;
      p.name = String(msg.name || '').replace(/\s+/g, ' ').trim().slice(0, 16) || 'Gast';
      if (AVATARS.includes(msg.avatar)) p.avatar = msg.avatar;
      p.fig = cleanFig(msg.fig);
      if (old !== p.name) sys(`${old} heißt jetzt ${p.name}`);
      sync();
      break;
    }
    case 'kick': if (isHostMsg) doKick(msg.id, !!msg.ban); break;
    case 'votekick': {
      const target = msg.id;
      if (!H.players[target] || !H.players[from] || target === from) return;
      if (target === room.myId) { room.sendTo(from, { t: 'chat', k: 'err', text: 'Du kannst den Raumbesitzer nicht kicken!' }); return; }
      if (!H.kicks.has(target)) H.kicks.set(target, new Set());
      const set = H.kicks.get(target);
      if (set.has(from)) return;
      set.add(from);
      const votes = [...set].filter((v) => H.players[v]).length, need = kickNeed(target);
      sys(`${pname(from)} möchte ${pname(target)} kicken (${votes}/${need})!`, 'owner');
      if (votes >= need) doKick(target, false);
      else sync();
      break;
    }
  }
}

function setupHost() {
  H = newHostState();
  room.getInfo = () => ({
    phase: H.phase, players: count(), max: H.settings.max, host: pname(room.myId), round: H.round, rounds: H.settings.rounds, mode: H.settings.mode,
  });
  room.onClientJoin = (id, hello) => {
    if (hello && hello.dev && H.bans.has(String(hello.dev))) { room.sendTo(id, { t: 'deny', text: 'Du bist von diesem Raum gebannt!' }); setTimeout(() => room.kick(id), 300); return; }
    if (count() >= H.settings.max) { room.sendTo(id, { t: 'deny', text: 'Raum ist voll!' }); setTimeout(() => room.kick(id), 300); return; }
    addPlayer(id, hello || {});
    sys(`${H.players[id].name} ist dem Raum beigetreten!`, 'join');
    sync();
    if ((H.phase === 'draw' || H.phase === 'reveal') && H.ops.length) room.sendTo(id, { t: 'ops', turn: H.turn, ops: H.ops });
  };
  room.onClientLeave = (id) => hostRemove(id);
  room.onClientMessage = (from, msg) => { if (msg && typeof msg === 'object') hostHandle(from, msg); };
  addPlayer(room.myId, readProfile());
  setInterval(hostTick, 200);
  sync();
}
function cleanFig(f) { return validFig(f) ? f.slice(0, 4) : null; }
function addPlayer(id, hello) {
  H.players[id] = {
    name: String(hello.name || '').replace(/\s+/g, ' ').trim().slice(0, 16) || 'Gast',
    avatar: AVATARS.includes(hello.avatar) ? hello.avatar : pick(AVATARS), fig: cleanFig(hello.fig), score: 0, dev: String(hello.dev || '').slice(0, 40),
  };
  H.order.push(id);
  H.seen[id] = Date.now();
  // Mitten-ins-Spiel: in dieser Runde noch drankommen
  if (!['lobby', 'final', 'round'].includes(H.phase)) H.queue.push(id);
}

// ===========================================================================
// CLIENT (läuft bei allen, auch beim Host)
// ===========================================================================
let S = null;
let localDeadline = 0, localAuto = 0;
let lastPhase = null, lastTurn = -1, lastOvKey = '';
let codeShown = false;
const muted = new Set();
const isHost = () => room && room.isHost;
const myId = () => room && room.myId;
const amDrawer = () => S && S.phase === 'draw' && S.drawer === myId();
const playerById = (id) => (S && S.players.find((p) => p.id === id)) || null;

let lastHostMsg = 0;
setInterval(() => {
  if (!room || room.isHost || !S) return;
  room.send({ t: 'hb' });
  if (lastHostMsg && Date.now() - lastHostMsg > 25000 && !document.hidden) { toast('Verbindung verloren!', { err: true, ms: 4000 }); resetToHome(); }
}, 2500);
const sayBye = () => { if (room && !room.isHost) { try { room.send({ t: 'bye' }); } catch (e) {} } };
window.addEventListener('pagehide', sayBye);
function onHostMessage(msg) {
  if (!msg || typeof msg !== 'object') return;
  lastHostMsg = Date.now();
  switch (msg.t) {
    case 'state':
      S = msg; localDeadline = msg.endsIn ? Date.now() + msg.endsIn : 0; localAuto = msg.autoIn ? Date.now() + msg.autoIn : 0;
      render();
      break;
    case 'chat': addChat(msg); break;
    case 'd': if (S && S.drawer !== myId()) applyDraw(msg); break;
    case 'ops': if (S && msg.turn === S.turn) board.load(msg.ops); break;
    case 'guessOk': sfx.play('myGuess'); addChat({ k: 'guessedme', text: `Richtig! +${msg.pts} Punkte` }); break;
    case 'deny': toast(msg.text, { err: true, ms: 4500 }); resetToHome(); break;
    case 'kicked': toast(msg.ban ? 'Du wurdest gebannt!' : 'Du wurdest gekickt!', { err: true, ms: 4500 }); resetToHome(); break;
  }
}
function applyDraw(m) {
  if (m.a === 'b') board.push({ k: 's', c: m.c, s: m.s, p: m.p.slice() });
  else if (m.a === 'm') board.extend(m.p);
  else if (m.a === 'f') board.push({ k: 'f', c: m.c, x: m.x, y: m.y });
  else if (m.a === 'u') board.undo();
  else if (m.a === 'x') board.push({ k: 'x' });
}

function resetToHome() {
  sayBye();
  lastHostMsg = 0;
  const old = room; room = null;
  if (old) old.leave();
  S = null; H = null; lastPhase = null; lastTurn = -1; lastOvKey = ''; codeShown = false;
  $('chatLog').innerHTML = '';
  stopStroke();
  history.replaceState(null, '', location.pathname);
  show('home');
}

// RENDER --------------------------------------------------------------------
function render() {
  if (!S) return;
  show('room');
  const phaseChanged = S.phase !== lastPhase;
  if (S.turn !== lastTurn && (S.phase === 'choose' || S.phase === 'draw')) { board.reset(); lastTurn = S.turn; }
  if (phaseChanged) onPhaseEnter(S.phase);
  lastPhase = S.phase;
  const el = $('scr-room');
  el.classList.toggle('ph-lobby', S.phase === 'lobby');
  el.classList.toggle('ph-game', S.phase !== 'lobby');
  el.classList.toggle('drawing', amDrawer());
  $('lobby').classList.toggle('hidden', S.phase !== 'lobby');
  $('boardWrap').classList.toggle('hidden', S.phase === 'lobby');
  $('tools').classList.toggle('hidden', !amDrawer());
  if (chatStick) $('chatLog').scrollTop = $('chatLog').scrollHeight;
  if (!amDrawer()) stopStroke();
  renderBar();
  renderPlayers();
  if (S.phase === 'lobby') renderLobby();
  else renderOverlay();
  $('rate').classList.toggle('hidden', !(S.phase === 'draw' && S.drawer !== myId() && !S.liked));
  $('chatInput').placeholder = amDrawer() || (S.phase === 'draw' && (playerById(myId()) || {}).guessed) ? 'Schreib was …' : S.phase === 'draw' ? 'Rate das Wort …' : 'Schreib was …';
  requestAnimationFrame(fitBoard);
}
function onPhaseEnter(p) {
  if (p === 'round') sfx.play('round');
  if (p === 'choose' && S.drawer === myId()) sfx.play('turn');
  if (p === 'draw') sfx.play('pop');
  if (p === 'reveal') sfx.play('reveal');
  if (p === 'final') sfx.play('win');
}

function renderBar() {
  const s = S.settings;
  $('roundTxt').textContent = S.phase === 'lobby' ? (S.players.length < 2 ? 'Auf Spieler warten…' : 'Lobby') : `Runde ${Math.min(S.round, s.rounds)} von ${s.rounds}`;
  let desc = 'WARTEN', word = '';
  if (S.phase === 'draw' || S.phase === 'reveal') {
    if (S.drawer === myId() && S.phase === 'draw') { desc = 'ZEICHNE'; word = esc(S.word); }
    else if (S.mask) {
      desc = S.phase === 'reveal' ? 'AUFLÖSUNG' : S.word ? 'ERRATEN!' : 'RATE';
      word = S.mask.map((ch) => (ch === '_' ? '<i class="u"></i>' : ch === ' ' ? '<i class="sp"></i>' : `<i class="l">${esc(ch)}</i>`)).join('');
      const lens = S.mask.join('').split(/[\s+\-]+/).filter(Boolean).map((x) => x.length);
      word += `<sup>${lens.join(' ')}</sup>`;
    } else { desc = 'WORT VERSTECKT'; word = '<i class="q">?</i>'; }
  } else if (S.phase === 'choose') desc = S.drawer === myId() ? 'WÄHLE EIN WORT' : 'WARTEN';
  else if (S.phase === 'final') desc = 'SPIELENDE';
  if (S.phase !== 'lobby') desc = `<span class="w-rnd">R ${Math.min(S.round, s.rounds)}/${s.rounds} · </span>${desc}`;
  $('wordDesc').innerHTML = desc;
  $('wordTxt').innerHTML = word;
  $('wordBox').classList.toggle('mine', S.drawer === myId() && S.phase === 'draw');
}

function renderPlayers() {
  const ranked = S.players.slice().sort((a, b) => b.score - a.score);
  const rank = {}; let r = 0, last = null;
  ranked.forEach((p, i) => { if (p.score !== last) { r = i + 1; last = p.score; } rank[p.id] = r; });
  const inGame = S.phase !== 'lobby';
  $('players').innerHTML = S.players.map((p) => {
    const mine = p.id === myId();
    const drawing = p.id === S.drawer && (S.phase === 'draw' || S.phase === 'choose');
    return `<button type="button" class="pl ${p.guessed ? 'ok' : ''} ${mine ? 'me' : ''} ${drawing ? 'drw' : ''}" data-pid="${esc(p.id)}">
      ${inGame ? `<span class="rk r${rank[p.id]}">#${rank[p.id]}</span>` : ''}
      <span class="pl-mid"><span class="nm">${esc(p.name)}${mine ? ' <em>(Du)</em>' : ''}</span>${inGame ? `<span class="sc">${p.score} Punkte</span>` : ''}</span>
      <span class="pl-ic">${drawing ? ICON('pencil', 'dr') : ''}${p.id === S.hostId ? `<span title="Raumbesitzer">${ICON('crown')}</span>` : ''}${muted.has(p.id) ? ICON('mute') : ''}</span>${avHtml(p)}</button>`;
  }).join('') + (S.kick ? `<div class="kickbox">🗳️ <b>${esc(S.kick.name)}</b> kicken? ${S.kick.votes}/${S.kick.need}${!S.kick.mine && S.kick.target !== myId() ? ` <button type="button" class="kd-mini" data-vk="${esc(S.kick.target)}">Ja</button>` : ''}</div>` : '');
}
$('players').addEventListener('click', (e) => {
  const vk = e.target.closest('[data-vk]');
  if (vk) { room && room.send({ t: 'votekick', id: vk.dataset.vk }); return; }
  const b = e.target.closest('[data-pid]'); if (b) playerMenu(b.dataset.pid);
});
function playerMenu(pid) {
  const p = playerById(pid); if (!p) return;
  if (pid === myId()) { profileModal(); return; }
  const host = isHost();
  openModal(`<div class="pm-av">${avHtml(p)}</div><h2>${esc(p.name)}</h2><p>${p.id === S.hostId ? 'Raumbesitzer · ' : ''}${S.phase !== 'lobby' ? `${p.score} Punkte` : 'in der Lobby'}</p>
    <div class="modal-btns col">
      <button class="kd-btn kd-btn-white" data-a="mute" type="button"><span>${muted.has(pid) ? 'Stummschaltung aufheben' : 'Stummschalten'}</span></button>
      ${pid !== S.hostId && !host ? '<button class="kd-btn kd-btn-red" data-a="vk" type="button"><span>Votekick</span></button>' : ''}
      ${host ? '<button class="kd-btn kd-btn-red" data-a="kick" type="button"><span>Kicken</span></button><button class="kd-btn kd-btn-red" data-a="ban" type="button"><span>Bannen</span></button>' : ''}
      <button class="kd-link" data-a="close" type="button">Schließen</button></div>`, (card) => {
    card.querySelector('[data-a=close]').onclick = closeModal;
    card.querySelector('[data-a=mute]').onclick = () => {
      closeModal();
      if (muted.has(pid)) { muted.delete(pid); addChat({ k: 'info', text: `Du hast die Stummschaltung für '${p.name}' aufgehoben!` }); }
      else { muted.add(pid); addChat({ k: 'info', text: `Du hast '${p.name}' stummgeschalten!` }); }
      renderPlayers();
    };
    const vk = card.querySelector('[data-a=vk]'); if (vk) vk.onclick = () => { closeModal(); room.send({ t: 'votekick', id: pid }); };
    const k = card.querySelector('[data-a=kick]'); if (k) k.onclick = () => { closeModal(); room.send({ t: 'kick', id: pid }); };
    const bn = card.querySelector('[data-a=ban]'); if (bn) bn.onclick = () => { closeModal(); room.send({ t: 'kick', id: pid, ban: true }); };
  });
}

// LOBBY ---------------------------------------------------------------------
function fillSelect(sel, opts, val) {
  const html = opts.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
  if (sel._html !== html) { sel.innerHTML = html; sel._html = html; }
  sel.value = String(val);
}
function renderLobby() {
  const s = S.settings, host = isHost();
  fillSelect($('setMax'), Array.from({ length: 29 }, (_, i) => [i + 2, `${i + 2}`]), s.max);
  fillSelect($('setTime'), DRAW_TIMES.map((v) => [v, `${v} s`]), s.time);
  fillSelect($('setRounds'), Array.from({ length: 9 }, (_, i) => [i + 2, `${i + 2}`]), s.rounds);
  fillSelect($('setCount'), [1, 2, 3, 4, 5].map((v) => [v, `${v}`]), s.count);
  fillSelect($('setHints'), [0, 1, 2, 3, 4, 5].map((v) => [v, `${v}`]), s.hints);
  $('setMode').value = s.mode;
  for (const id of ['setMax', 'setTime', 'setRounds', 'setCount', 'setHints', 'setMode', 'setCustom', 'setCustomOnly']) $(id).disabled = !host;
  $('setLang').disabled = true;
  if (host) { if (document.activeElement !== $('setCustom') && !$('setCustom').value && s.custom) $('setCustom').value = s.custom; }
  else $('setCustom').value = s.customCount ? `${s.customCount} eigene Wörter hinterlegt` : '';
  $('setCustom').placeholder = host ? 'Minimum von 10 Wörtern. 1-32 Buchstaben pro Wort. 10000 Buchstaben maximal. Getrennt durch ein , (Komma)' : 'Keine eigenen Wörter';
  $('setCustomOnly').checked = !!s.customOnly;
  $('modeHint').textContent = MODE_HINT[s.mode] || '';
  $('codeTxt').textContent = codeShown || S.isPublic ? inviteUrl() : inviteUrl().replace(/code=\w+/, 'code=••••');
  $('showCodeBtn').classList.toggle('hidden', !!S.isPublic);
  $('showCodeBtn').textContent = codeShown ? 'Verbergen' : 'Anzeigen';
  $('startBtn').classList.toggle('hidden', !host);
  $('startBtn').disabled = S.players.length < 2;
  const msg = $('lobbyMsg');
  if (localAuto) msg.textContent = 'Das Spiel beginnt in wenigen Sekunden...';
  else if (S.players.length < 2) msg.textContent = 'Auf Spieler warten… Lad deine Freunde ein!';
  else msg.textContent = host ? `${S.players.length} Spieler bereit. Los geht's!` : 'Warte, bis der Raumbesitzer startet …';
}
function sendSettings(patch) { if (room && S) room.send({ t: 'settings', ...S.settings, ...patch }); }
$('setMax').onchange = (e) => { const v = +e.target.value; if (v < S.players.length) { toast(`Es sind schon ${S.players.length} Spieler im Raum`, { err: true }); e.target.value = S.settings.max; return; } sendSettings({ max: v }); };
$('setTime').onchange = (e) => sendSettings({ time: +e.target.value });
$('setRounds').onchange = (e) => sendSettings({ rounds: +e.target.value });
$('setCount').onchange = (e) => sendSettings({ count: +e.target.value });
$('setHints').onchange = (e) => sendSettings({ hints: +e.target.value });
$('setMode').onchange = (e) => sendSettings({ mode: e.target.value });
$('setCustomOnly').onchange = (e) => sendSettings({ customOnly: e.target.checked });
let customTimer = 0;
$('setCustom').addEventListener('input', () => { clearTimeout(customTimer); customTimer = setTimeout(() => sendSettings({ custom: $('setCustom').value }), 400); });
$('startBtn').onclick = () => {
  if (S.settings.customOnly && (S.settings.customCount || 0) < 10) { toast('Minimum von 10 eigenen Wörtern für „Nur eigene Wörter“!', { err: true }); return; }
  sfx.play('click'); room.send({ t: 'start' });
};
$('showCodeBtn').onclick = () => { codeShown = !codeShown; renderLobby(); };
function inviteUrl() {
  const q = S.isPublic ? `?pub=${String(S.code).replace('Ö', '')}` : `?code=${S.code}`;
  return location.origin + location.pathname + q;
}
$('copyBtn').onclick = async () => {
  const url = inviteUrl();
  try {
    if (navigator.share && matchMedia('(hover: none)').matches) { await navigator.share({ title: 'Kritzel-Duell', text: 'Komm in meinen Raum!', url }); return; }
    await navigator.clipboard.writeText(url);
    addChat({ k: 'join', text: 'Raumlink in die Zwischenablage kopiert!' });
  } catch (e) { if (!(e && e.name === 'AbortError')) prompt('Link zum Teilen:', url); }
};

// OVERLAYS (Runde, Wortwahl, Auflösung, Podium) ------------------------------
const BELL = '<svg class="ov-bell" viewBox="0 0 64 60" aria-hidden="true"><path d="M32 6c-12 0-20 9-20 22v10l-6 8h52l-6-8V28c0-13-8-22-20-22z" fill="#ffd23f" stroke="#1b1b1f" stroke-width="4" stroke-linejoin="round"/><circle cx="32" cy="52" r="5" fill="#1b1b1f"/><path d="M4 18q2-8 8-12M60 18q-2-8-8-12" fill="none" stroke="#1b1b1f" stroke-width="3.5" stroke-linecap="round"/></svg>';
function renderOverlay() {
  const ov = $('ov'), card = $('ovCard');
  let key = S.phase + ':' + S.turn, html = '';
  const drawerP = playerById(S.drawer) || { name: '?', avatar: '❔' };
  if (S.phase === 'round') html = `<div class="ov-round">${BELL}<small>Ding ding!</small><b>Runde ${S.round}</b><span>von ${S.settings.rounds}</span></div>`;
  else if (S.phase === 'choose') {
    if (S.drawer === myId() && S.choices) {
      html = `<h3>Wähle ein Wort</h3><div class="choices">${S.choices.map((w, i) => `<button type="button" class="choice" data-i="${i}">${esc(w)}</button>`).join('')}</div>`;
    } else html = `<div class="ov-who">${avHtml(drawerP, 'av')}<b>${esc(drawerP.name)} wählt ein Wort!</b></div>`;
  } else if (S.phase === 'reveal' && S.reveal) {
    const rv = S.reveal;
    const reason = { all: 'Jeder hat das Wort erraten!', time: 'Die Zeit ist abgelaufen!', left: 'Der Zeichner hat das Spiel verlassen!' }[rv.reason] || '';
    html = `<p class="ov-sub">Das Wort war</p><h3 class="ov-word"><span>${esc(rv.word || '?')}</span></h3><p class="ov-reason">${reason}</p>
      <div class="gains">${rv.gains.map((g) => `<div class="gain ${g.pts ? 'plus' : ''}"><span class="gn">${g.drawer ? '✏️ ' : ''}${esc(g.name)}</span><span class="dots"></span><b>${g.pts ? '+' + g.pts : '0'}</b></div>`).join('')}</div>
      ${rv.likes || rv.dislikes ? `<p class="ov-likes">👍 ${rv.likes} · 👎 ${rv.dislikes}</p>` : ''}`;
  } else if (S.phase === 'final' && S.final) {
    key += ':' + isHost();
    const top = S.final.slice(0, 3);
    const order = [top[1], top[0], top[2]].filter(Boolean);
    const winners = S.final.filter((p) => p.rank === 1);
    html = `<h3 class="ov-final-t">${winners.length > 1 ? `${winners.map((w) => esc(w.name)).join(' & ')} haben gewonnen!` : winners[0] && winners[0].score > 0 ? `${esc(winners[0].name)} hat gewonnen!` : 'Niemand hat gewonnen!'}</h3>
      <div class="podium">${order.map((p) => `<div class="pod pod-${p.rank > 3 ? 3 : p.rank}"><div class="pod-av">${avHtml(p, 'av')}${p.rank === 1 ? `<span class="pod-crown">${ICON('crown')}</span>` : ''}</div>
        <span class="pod-nm">${esc(p.name)}</span><span class="pod-sc">${p.score} Punkte</span><div class="pod-col">${p.rank === 1 ? '<span class="pod-belt"></span>' : `<b>${p.rank}</b>`}</div></div>`).join('')}</div>
      ${S.final.length > 3 ? `<div class="rest">${S.final.slice(3).map((p) => `<span>#${p.rank} ${esc(p.name)} · ${p.score}</span>`).join('')}</div>` : ''}
      ${isHost() ? '<button type="button" class="kd-btn kd-btn-go" id="toLobbyBtn"><span>Zurück zur Lobby</span></button>' : '<p class="ov-sub">Gleich geht es zurück in die Lobby …</p>'}`;
  } else key = 'none';
  if (key !== lastOvKey) {
    lastOvKey = key;
    card.innerHTML = html;
    card.className = 'ov-card ov-' + S.phase;
    if (S.phase === 'final') confetti();
  }
  ov.classList.toggle('hidden', !html);
}
$('ovCard').addEventListener('click', (e) => {
  const c = e.target.closest('[data-i]');
  if (c && room) { sfx.play('click'); room.send({ t: 'choose', i: +c.dataset.i }); c.closest('.choices').querySelectorAll('button').forEach((b) => (b.disabled = true)); return; }
  if (e.target.closest('#toLobbyBtn') && room) room.send({ t: 'lobby' });
});
$('rate').addEventListener('click', (e) => {
  const b = e.target.closest('[data-like]'); if (!b || !room) return;
  const v = +b.dataset.like;
  sfx.play(v ? 'like' : 'dislike');
  room.send({ t: 'like', v });
  $('rate').classList.add('hidden');
});
function confetti() {
  const box = $('ov');
  const colors = ['#ff5a5f', '#ffd23f', '#9be15d', '#5ec8ff', '#ff7ac8', '#ff9f1c', '#fffef9'];
  for (let i = 0; i < 60; i++) {
    const c = document.createElement('i');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + '%';
    c.style.transform = `rotate(${Math.random() * 90}deg)`;
    c.style.background = pick(colors);
    c.style.animationDelay = Math.random() * 1.2 + 's';
    c.style.animationDuration = 2 + Math.random() * 2 + 's';
    box.appendChild(c);
    setTimeout(() => c.remove(), 5000);
  }
}

// TIMER ---------------------------------------------------------------------
let lastTick = -1;
setInterval(() => {
  if (!S) return;
  const num = $('clockNum'), arc = $('clockArc');
  const C = 2 * Math.PI * 14.5;
  if (!localDeadline || !S.totalMs) { num.textContent = S.phase === 'lobby' && localAuto ? Math.ceil(Math.max(0, localAuto - Date.now()) / 1000) : '–'; arc.style.strokeDasharray = `${C} ${C}`; arc.style.strokeDashoffset = '0'; $('clock').classList.remove('low'); return; }
  const left = Math.max(0, localDeadline - Date.now());
  const s = Math.ceil(left / 1000);
  num.textContent = s;
  arc.style.strokeDasharray = `${C} ${C}`;
  arc.style.strokeDashoffset = String(C * (1 - left / S.totalMs));
  const low = S.phase === 'draw' && s <= 10;
  $('clock').classList.toggle('low', low);
  if (low && s > 0 && s !== lastTick) { lastTick = s; sfx.play('tick'); }
}, 200);

// CHAT ----------------------------------------------------------------------
let filterBad = lsGet('kd_filter', '1') === '1';
let bubblesOn = lsGet('kd_bubbles', matchMedia('(max-width: 759px)').matches ? '1' : '0') === '1';
function addChat(m) {
  if (m.id && muted.has(m.id)) return;
  const log = $('chatLog');
  const d = document.createElement('p');
  d.className = 'cm k-' + (m.k || 'msg');
  const text = filterBad ? cleanBad(m.text) : m.text;
  if (m.name) { const b = document.createElement('b'); b.textContent = (filterBad ? cleanBad(m.name) : m.name) + ': '; d.appendChild(b); }
  d.appendChild(document.createTextNode(text));
  log.appendChild(d);
  while (log.children.length > 150) log.firstChild.remove();
  if (chatStick) log.scrollTop = log.scrollHeight;
  if (m.k === 'guessed') sfx.play('guessed');
  else if (m.k === 'join') sfx.play('join');
  else if (m.k === 'leave') sfx.play('leave');
  else if (m.k === 'close') sfx.play('close');
  if (bubblesOn && S && S.phase !== 'lobby' && m.name && !amDrawer()) {
    const bb = document.createElement('div'); bb.className = 'bubble'; bb.textContent = `${m.name}: ${text}`;
    $('bubbles').appendChild(bb); setTimeout(() => bb.remove(), 2600);
    while ($('bubbles').children.length > 3) $('bubbles').firstChild.remove();
  }
}
// Chat bleibt unten „kleben“, solange man nicht selbst hochgescrollt hat – auch wenn sich die Höhe ändert (Tastatur, Drehen)
let chatStick = true;
let chatUserAt = 0; // nur echtes Scrollen durch den Nutzer löst das „Kleben“ (Layoutwechsel wie Werkzeugleiste/Tastatur nicht)
for (const ev of ['wheel', 'touchstart', 'touchmove', 'pointerdown', 'keydown']) $('chatLog').addEventListener(ev, () => { chatUserAt = Date.now(); }, { passive: true });
$('chatLog').addEventListener('scroll', () => {
  const l = $('chatLog'), atEnd = l.scrollHeight - l.scrollTop - l.clientHeight < 40;
  if (atEnd) chatStick = true; else if (Date.now() - chatUserAt < 1500) chatStick = false;
}, { passive: true });
if (window.ResizeObserver) new ResizeObserver(() => { if (chatStick) $('chatLog').scrollTop = $('chatLog').scrollHeight; }).observe($('chatLog'));
$('chatForm').onsubmit = (e) => {
  e.preventDefault();
  const v = $('chatInput').value.trim();
  if (v && room) room.send({ t: 'chat', text: v });
  $('chatInput').value = '';
};

// ===========================================================================
// ZEICHNEN (Maus, Touch, Stift)
// ===========================================================================
const tool = { name: 'brush', c1: 1, c2: 0, size: 1 };
function buildTools() {
  $('palette').innerHTML = PALETTE.map((c, i) => `<button type="button" class="sw" data-c="${i}" style="background:${c}" aria-label="Farbe ${i + 1}"></button>`).join('');
  $('sizes').innerHTML = SIZES.map((s, i) => `<button type="button" class="sz" data-s="${i}" aria-label="Größe ${i + 1}"><i style="width:${6 + i * 5}px;height:${6 + i * 5}px"></i></button>`).join('');
  showTool();
}
function showTool() {
  $('curC1').style.background = PALETTE[tool.c1]; $('curC2').style.background = PALETTE[tool.c2];
  document.querySelectorAll('#palette .sw').forEach((b) => b.classList.toggle('on', +b.dataset.c === tool.c1));
  document.querySelectorAll('#sizes .sz').forEach((b) => { b.classList.toggle('on', +b.dataset.s === tool.size); b.querySelector('i').style.background = tool.name === 'eraser' ? '#fff' : PALETTE[tool.c1]; });
  document.querySelectorAll('#toolBtns [data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === tool.name));
  $('board').dataset.tool = tool.name;
}
$('palette').addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (!b) return; tool.c1 = +b.dataset.c; if (tool.name === 'eraser' || tool.name === 'pick') tool.name = 'brush'; showTool(); });
$('palette').addEventListener('contextmenu', (e) => { const b = e.target.closest('[data-c]'); if (!b) return; e.preventDefault(); tool.c2 = +b.dataset.c; showTool(); });
$('curColor').onclick = () => { [tool.c1, tool.c2] = [tool.c2, tool.c1]; showTool(); };
$('sizes').addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (b) { tool.size = +b.dataset.s; showTool(); } });
$('toolBtns').addEventListener('click', (e) => { const b = e.target.closest('[data-tool]'); if (b) { tool.name = b.dataset.tool; showTool(); } });
$('undoBtn').onclick = () => doUndo();
$('clearBtn').onclick = () => doClear();
function doUndo() { if (!amDrawer() || !board.ops.length) return; stopStroke(); board.undo(); room.send({ t: 'd', a: 'u' }); }
function doClear() { if (!amDrawer()) return; stopStroke(); board.push({ k: 'x' }); room.send({ t: 'd', a: 'x' }); }
buildTools();

let stroke = null; // { pointerId, pend: [], begun: false, c, s }
let flushTimer = 0;
function canvasPos(e) {
  const r = $('canvas').getBoundingClientRect();
  return [clamp(Math.round(((e.clientX - r.left) / r.width) * W), 0, W - 1), clamp(Math.round(((e.clientY - r.top) / r.height) * H_), 0, H_ - 1)];
}
function flushStroke() {
  if (!stroke || !room) return;
  if (!stroke.sent) { room.send({ t: 'd', a: 'b', c: stroke.c, s: stroke.s, p: stroke.pend }); stroke.sent = true; }
  else if (stroke.pend.length) room.send({ t: 'd', a: 'm', p: stroke.pend });
  stroke.pend = [];
}
function stopStroke() {
  if (!stroke) return;
  flushStroke();
  clearInterval(flushTimer);
  stroke = null;
}
const cv = $('canvas');
cv.addEventListener('pointerdown', (e) => {
  if (!amDrawer()) return;
  e.preventDefault();
  if (stroke) stopStroke();
  const [x, y] = canvasPos(e);
  const right = e.button === 2;
  const color = right ? tool.c2 : tool.c1;
  if (tool.name === 'fill') { board.push({ k: 'f', c: color, x, y }); room.send({ t: 'd', a: 'f', c: color, x, y }); sfx.play('pop'); return; }
  if (tool.name === 'pick') { const c = board.colorAt(x, y); if (right) tool.c2 = c; else tool.c1 = c; tool.name = 'brush'; showTool(); return; }
  const c = tool.name === 'eraser' ? 0 : color, s = SIZES[tool.size];
  try { cv.setPointerCapture(e.pointerId); } catch (er) {}
  stroke = { id: e.pointerId, c, s, pend: [x, y], sent: false, lx: x, ly: y };
  board.push({ k: 's', c, s, p: [x, y] });
  flushTimer = setInterval(flushStroke, 50);
});
cv.addEventListener('pointermove', (e) => {
  if (!stroke || e.pointerId !== stroke.id) return;
  e.preventDefault();
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  const pts = [];
  for (const ev of (evs.length ? evs : [e])) {
    const [x, y] = canvasPos(ev);
    if (Math.abs(x - stroke.lx) + Math.abs(y - stroke.ly) < 2) continue;
    pts.push(x, y); stroke.lx = x; stroke.ly = y;
  }
  if (!pts.length) return;
  board.extend(pts);
  stroke.pend.push(...pts);
});
const endPtr = (e) => { if (stroke && e.pointerId === stroke.id) stopStroke(); };
cv.addEventListener('pointerup', endPtr);
cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('contextmenu', (e) => e.preventDefault());
// iOS Safari: kein Scrollen/Zoomen beim Zeichnen
for (const ev of ['touchstart', 'touchmove']) cv.addEventListener(ev, (e) => { if (amDrawer()) e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', (e) => { if (curScreen === 'room') e.preventDefault(); });

document.addEventListener('keydown', (e) => {
  if (!amDrawer()) return;
  const tag = (document.activeElement && document.activeElement.tagName) || '';
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); doUndo(); return; }
  if (tag === 'INPUT' || tag === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'b') tool.name = 'brush'; else if (k === 'e') tool.name = 'eraser'; else if (k === 'f') tool.name = 'fill'; else if (k === 'p') tool.name = 'pick';
  else if (k === 'u') { doUndo(); return; } else if (k === 'c') { doClear(); return; }
  else if (k >= '1' && k <= '5') tool.size = +k - 1;
  else return;
  showTool();
});

// Zeichenfläche passend einpassen (4:3)
function fitBoard() {
  const wrap = $('boardWrap'), bd = $('board');
  if (!wrap || wrap.classList.contains('hidden')) return;
  const r = wrap.getBoundingClientRect();
  if (!r.width || !r.height) return;
  let w = r.width, h = (w * 3) / 4;
  if (h > r.height) { h = r.height; w = (h * 4) / 3; }
  bd.style.width = Math.floor(w) + 'px'; bd.style.height = Math.floor(h) + 'px';
}
// Mobil: Ist die Bildschirmtastatur für den Chat offen, schrumpft das Layout auf den sichtbaren Bereich
// (visualViewport) – Zeichenfläche oben, Chat + Eingabe direkt darunter, nichts wird verdeckt.
const touchUI = matchMedia('(hover: none) and (pointer: coarse)').matches || navigator.maxTouchPoints > 0;
let kbOpen = false, baseW = 0, baseH = 0;
function setAppHeight() {
  const vv = window.visualViewport;
  const h = vv ? vv.height : window.innerHeight;
  const root = document.documentElement.style;
  root.setProperty('--app-h', Math.round(h) + 'px');
  root.setProperty('--vv-top', (vv && curScreen === 'room' ? Math.max(0, Math.round(vv.offsetTop)) : 0) + 'px');
  const w = window.innerWidth;
  if (w !== baseW) { baseW = w; baseH = 0; } // Drehen → neu messen
  baseH = Math.max(baseH, h);
  const kb = curScreen === 'room' && touchUI && document.activeElement === $('chatInput') && h < baseH * 0.8;
  if (kb !== kbOpen) { kbOpen = kb; $('scr-room').classList.toggle('kb', kb); if (kb) requestAnimationFrame(() => { $('chatLog').scrollTop = $('chatLog').scrollHeight; }); }
  if (curScreen === 'room' && !kb) window.scrollTo(0, 0);
  requestAnimationFrame(fitBoard);
}
window.addEventListener('resize', setAppHeight);
if (window.visualViewport) { window.visualViewport.addEventListener('resize', setAppHeight); window.visualViewport.addEventListener('scroll', setAppHeight); }
$('chatInput').addEventListener('focus', () => { setAppHeight(); setTimeout(setAppHeight, 350); });
$('chatInput').addEventListener('blur', () => { setTimeout(setAppHeight, 60); });
setAppHeight();

// ===========================================================================
// TON + EINSTELLUNGEN + VERLASSEN
// ===========================================================================
function showSound() {
  for (const id of ['soundBtn', 'soundBtnTop']) $(id).querySelector('use').setAttribute('href', sfx.muted ? '#i-mute' : '#i-sound');
  $('darkChk').checked = document.body.classList.contains('dark');
  $('muteChk').checked = sfx.muted; $('volRange').value = Math.round(sfx.volume * 100);
  $('filterChk').checked = filterBad; $('bubbleChk').checked = bubblesOn;
}
for (const id of ['soundBtn', 'soundBtnTop']) $(id).onclick = () => { sfx.muted = !sfx.muted; showSound(); sfx.play('click'); };
$('gearBtn').onclick = (e) => { e.stopPropagation(); $('gearPop').classList.toggle('hidden'); };
$('volRange').oninput = (e) => { sfx.volume = +e.target.value / 100; };
$('volRange').onchange = () => sfx.play('pop');
$('muteChk').onchange = (e) => { sfx.muted = e.target.checked; showSound(); };
$('filterChk').onchange = (e) => { filterBad = e.target.checked; lsSet('kd_filter', filterBad ? '1' : '0'); };
$('bubbleChk').onchange = (e) => { bubblesOn = e.target.checked; lsSet('kd_bubbles', bubblesOn ? '1' : '0'); };
$('darkChk').onchange = (e) => { document.body.classList.toggle('dark', e.target.checked); lsSet('kd_dark', e.target.checked ? '1' : '0'); };
if (lsGet('kd_dark', '0') === '1') document.body.classList.add('dark');
document.addEventListener('click', (e) => { if (!$('gearPop').contains(e.target) && !$('gearBtn').contains(e.target)) $('gearPop').classList.add('hidden'); });
showSound();

$('leaveBtn').onclick = () => {
  if (!room) { show('home'); return; }
  const hostWarn = isHost() && S && S.players.length > 1;
  openModal(`<h2>Raum verlassen?</h2><p>${hostWarn ? 'Du bist Raumbesitzer – wenn du gehst, ist das Spiel für alle vorbei.' : 'Willst du den Raum wirklich verlassen?'}</p>
    <div class="modal-btns"><button class="kd-btn kd-btn-white" data-a="no" type="button"><span>Bleiben</span></button><button class="kd-btn kd-btn-red" data-a="yes" type="button"><span>Verlassen</span></button></div>`, (card) => {
    card.querySelector('[data-a=no]').onclick = closeModal;
    card.querySelector('[data-a=yes]').onclick = () => { closeModal(); resetToHome(); };
  });
};

// ===========================================================================
// START: Raum erstellen / beitreten
// ===========================================================================
function newRoom() {
  if (typeof Peer === 'undefined') { toast('Verbindungsbibliothek konnte nicht geladen werden. Ist das Netz blockiert?', { err: true, ms: 5000 }); return null; }
  const r = new Room(GAME_ID);
  r.onHostMessage = (msg) => { if (room === r) onHostMessage(msg); };
  r.onHostLost = () => { if (room === r) { toast('Verbindung verloren!', { err: true, ms: 4000 }); resetToHome(); } };
  return r;
}
async function busy(btn, fn) {
  if (btn.dataset.busy) return;
  btn.dataset.busy = '1';
  const label = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span>⏳ Verbinde …</span>';
  try { await fn(); }
  catch (e) { console.warn(e); toast(errText(e), { err: true, ms: 4500 }); if (room && !room.peer) room = null; }
  finally { btn.disabled = false; btn.innerHTML = label; delete btn.dataset.busy; }
}
function errText(e) {
  const t = e && e.type;
  if (t === 'network' || t === 'server-error' || t === 'socket-error' || (e && e.message === 'timeout')) return 'Keine Verbindung zum Vermittlungsserver. Ist das Netz blockiert?';
  if (t === 'browser-incompatible') return 'Dein Browser unterstützt kein WebRTC 😕';
  return e && e.message ? e.message : 'Etwas ist schief gelaufen!';
}
function entered() {
  $('chatLog').innerHTML = '';
  addChat({ k: 'info', text: 'Willkommen bei Kritzel-Duell! ✏️' });
}
async function hostPrivate() {
  readProfile();
  room = newRoom(); if (!room) return;
  await room.createPrivate();
  entered(); setupHost(); codeShown = false;
  history.replaceState(null, '', `?code=${room.code}`);
}
async function joinCode(code) {
  code = String(code || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
  if (!/^[A-Z]{4}$/.test(code)) { toast('Der Code hat 4 Buchstaben', { err: true }); return; }
  room = newRoom(); if (!room) return;
  const ok = await room.joinPrivate(code, readProfile());
  if (!ok) { room.leave(); room = null; toast('Raum nicht gefunden!', { err: true }); return; }
  entered();
  history.replaceState(null, '', `?code=${code}`);
}
async function joinPub(n) {
  room = newRoom(); if (!room) return false;
  const ok = await room.joinPublic(n, readProfile());
  if (!ok) { room.leave(); room = null; toast('Raum nicht gefunden!', { err: true }); return false; }
  entered();
  return true;
}
async function quickPlay() {
  readProfile();
  let list = [];
  try { list = await Room.listPublic(GAME_ID); } catch (e) {}
  const open = list.filter((l) => l.players < l.max).sort((a, b) => (a.phase === 'lobby' ? 0 : 1) - (b.phase === 'lobby' ? 0 : 1) || b.players - a.players);
  for (const l of open) { if (await joinPub(l.slot)) return; }
  room = newRoom(); if (!room) return;
  await room.createPublic();
  entered(); setupHost();
  addChat({ k: 'info', text: 'Neue öffentliche Lobby erstellt – warte auf Mitspieler! Ab 2 Spielern startet das Spiel automatisch.' });
}
const MODE_NAME = { normal: 'Normal', hidden: 'Versteckt', combo: 'Kombination' };
async function browse() {
  const box = $('roomList');
  box.innerHTML = '<p class="kd-empty">Suche offene Lobbys …</p>';
  let list = [];
  try { list = await Room.listPublic(GAME_ID); } catch (e) { box.innerHTML = `<p class="kd-empty">${esc(errText(e))}</p>`; return; }
  if (!list.length) { box.innerHTML = '<p class="kd-empty">Keine Räume gefunden! Starte doch einen mit „Spielen!“.</p>'; return; }
  box.innerHTML = list.map((l) => `<div class="kd-room"><div class="kd-room-main"><b>Raum von ${esc(l.host)}</b>
    <small>${l.players}/${l.max} Spieler · ${esc(MODE_NAME[l.mode] || 'Normal')} · ${l.phase === 'lobby' ? 'Nicht gestartet' : `Runde ${Math.max(1, l.round)} von ${l.rounds}`}</small></div>
    <button class="kd-btn kd-btn-go kd-btn-sm" data-slot="${l.slot}" type="button" ${l.players < l.max ? '' : 'disabled'}><span>Rein</span></button></div>`).join('');
}
$('roomList').addEventListener('click', (e) => { const b = e.target.closest('[data-slot]'); if (b) busy(b, () => joinPub(+b.dataset.slot)); });
$('refreshBtn').onclick = () => browse();
$('quickBtn').onclick = (e) => { sfx.play('click'); busy(e.currentTarget, quickPlay); };
$('createBtn').onclick = (e) => { sfx.play('click'); busy(e.currentTarget, hostPrivate); };
$('codeInput').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); });
$('joinForm').onsubmit = (e) => { e.preventDefault(); const btn = e.currentTarget.querySelector('button'); busy(btn, () => joinCode($('codeInput').value)); };

// Einladungslinks: ?code=ABCD, ?join=ABCD (Zockbox) oder ?pub=3
const params = new URLSearchParams(location.search);
let inviteJoin = null;
const codeParam = params.get('code') || params.get('join');
if (codeParam) {
  const c = codeParam.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  if (c.length === 4) { inviteJoin = () => joinCode(c); $('inviteHint').textContent = `Raum ${c} wartet auf dich. Such dir Namen und Figur aus und steig in den Ring.`; }
} else if (params.get('pub')) {
  const n = +params.get('pub');
  if (n >= 1 && n <= 8) inviteJoin = () => joinPub(n);
}
if (inviteJoin) show('invite');
$('inviteJoinBtn').onclick = (e) => { sfx.play('click'); busy(e.currentTarget, inviteJoin || (async () => {})); };
$('inviteBack').onclick = () => { history.replaceState(null, '', location.pathname); show('home'); };
window.addEventListener('beforeunload', (e) => { if (room && room.isHost && S && S.players.length > 1) { e.preventDefault(); e.returnValue = ''; } });

// Für Tests
window.__kd = { get S() { return S; }, get H() { return H; }, board };
