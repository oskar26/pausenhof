// Krakelpost – Alben als Bild (PNG) und als animiertes GIF exportieren. made by Oskar
import { GifWriter } from './vendor/omggif.js';
import { PALETTE } from './draw.js';

// Gleiche Schriften/Farben wie im Spiel (game.css): Papier, Tinte, Luftpost-Rot/Blau
const FONT = "'KP UI', system-ui, -apple-system, 'Segoe UI', sans-serif";
const HAND = "'KP Hand', 'Comic Sans MS', cursive";
const INK = "'KP Ink', 'KP Hand', cursive";
const TYPE = "'KP Type', 'Courier New', monospace";
const C = { bg: '#f3ead6', card: '#fffaf0', red: '#ef4a36', blue: '#2f62e6', yellow: '#ffcd3c', ink: '#23284d', muted: '#565b7d', line: '#c7d6f3' };
async function fontsReady() {
  if (!document.fonts || !document.fonts.load) return;
  try { await Promise.all([`400 40px ${HAND}`, `700 30px ${INK}`, `400 16px ${TYPE}`, `800 20px ${FONT}`].map((f) => document.fonts.load(f))); } catch (e) {}
}
function airmail(x, y0, w, h) { // Luftpost-Streifen
  x.save(); x.beginPath(); x.rect(0, y0, w, h); x.clip();
  for (let k = -h; k < w + h; k += 40) {
    x.fillStyle = C.red; x.beginPath(); x.moveTo(k, y0 + h); x.lineTo(k + h, y0); x.lineTo(k + h + 12, y0); x.lineTo(k + 12, y0 + h); x.fill();
    x.fillStyle = C.blue; x.beginPath(); x.moveTo(k + 20, y0 + h); x.lineTo(k + 20 + h, y0); x.lineTo(k + 32 + h, y0); x.lineTo(k + 32, y0 + h); x.fill();
  }
  x.restore();
}
function postmark(x, cx, cy, r, color, text) {
  x.save(); x.strokeStyle = color; x.fillStyle = color; x.globalAlpha = .8; x.lineWidth = 3;
  x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke();
  x.lineWidth = 1.6; x.beginPath(); x.arc(cx, cy, r - 7, 0, Math.PI * 2); x.stroke();
  x.font = `400 ${Math.round(r * .2)}px ${TYPE}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, cx, cy);
  x.lineWidth = 3; x.lineCap = 'round';
  for (let k = -1; k <= 1; k++) { x.beginPath(); const yy = cy + k * r * .45; x.moveTo(cx + r + 8, yy); for (let s = 0; s < 4; s++) x.quadraticCurveTo(cx + r + 18 + s * 22, yy + (s % 2 ? 8 : -8), cx + r + 30 + s * 22, yy); x.stroke(); }
  x.restore();
}

function loadImg(src) {
  return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}
function wrap(ctx, text, maxW) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = []; let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; }
    else line = t;
    while (ctx.measureText(line).width > maxW && line.length > 1) { // sehr langes Wort
      let k = line.length - 1; while (k > 1 && ctx.measureText(line.slice(0, k)).width > maxW) k--;
      lines.push(line.slice(0, k)); line = line.slice(k);
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
const stepText = (s) => (s.text && s.text.trim()) ? s.text : '(nichts geschrieben)';

// Stapelt die Fremdkörper-Teile zu einer langen Figur (oberer Streifen jedes weiteren Teils überlappt).
export const CORPSE_STRIP = 90;
export async function corpseCanvas(steps) {
  const imgs = (await Promise.all(steps.filter((s) => s.img).map((s) => loadImg(s.img)))).filter(Boolean);
  const h = imgs.length ? 600 + (imgs.length - 1) * (600 - CORPSE_STRIP) : 600;
  const c = document.createElement('canvas'); c.width = 800; c.height = h;
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 800, h);
  imgs.forEach((im, i) => {
    if (i === 0) x.drawImage(im, 0, 0, 800, 600);
    else x.drawImage(im, 0, CORPSE_STRIP, 800, 600 - CORPSE_STRIP, 0, 600 + (i - 1) * (600 - CORPSE_STRIP), 800, 600 - CORPSE_STRIP);
  });
  return c;
}

// ---------- PNG ----------
export async function albumToPngBlob(album) {
  await fontsReady();
  const Wd = 880, pad = 48, inner = Wd - pad * 2;
  const meas = document.createElement('canvas').getContext('2d');
  const blocks = [];
  if (album.kind === 'corpse') {
    const cc = await corpseCanvas(album.steps);
    const h = Math.round(cc.height * (inner / 800));
    blocks.push({ h: 34 + h + 24, draw: (x, y) => { label(x, pad, y, '🧟 Die fertige Figur'); x.drawImage(cc, pad, y + 34, inner, h); } });
  }
  if (album.kind === 'anim') {
    const imgs = (await Promise.all(album.steps.map((s) => s.img ? loadImg(s.img) : null))).filter(Boolean);
    const cols = 3, gw = (inner - (cols - 1) * 12) / cols, gh = gw * 0.75;
    const rows = Math.ceil(imgs.length / cols);
    blocks.push({ h: 34 + rows * (gh + 30) + 10, draw: (x, y) => {
      label(x, pad, y, `🎞️ ${imgs.length} Bilder – als GIF herunterladen zum Abspielen`);
      imgs.forEach((im, i) => {
        const cx = pad + (i % cols) * (gw + 12), cy = y + 34 + Math.floor(i / cols) * (gh + 30);
        x.drawImage(im, cx, cy, gw, gh);
        x.strokeStyle = C.ink; x.lineWidth = 2; x.strokeRect(cx, cy, gw, gh);
        x.fillStyle = C.muted; x.font = `700 16px ${INK}`;
        const s = album.steps[i]; x.fillText(`${i + 1}. ${s && s.by ? s.by.name : ''}${s && s.hold > 1 ? ` (${s.hold}×)` : ''}`, cx + 4, cy + gh + 22);
      });
    } });
  } else {
    for (const s of album.steps) {
      if (s.type === 'text') {
        meas.font = `700 30px ${INK}`;
        const lines = wrap(meas, stepText(s), inner - 48);
        const bh = lines.length * 44 + 30;
        blocks.push({ h: 40 + bh + 26, draw: (x, y) => {
          who(x, pad, y, s.by);
          rr(x, pad, y + 40, inner, bh, 16); x.fillStyle = '#fff'; x.fill(); x.lineWidth = 3; x.strokeStyle = C.ink; x.stroke();
          x.strokeStyle = C.line; x.lineWidth = 2;
          lines.forEach((l, i) => { x.beginPath(); x.moveTo(pad + 18, y + 40 + 56 + i * 44); x.lineTo(pad + inner - 18, y + 40 + 56 + i * 44); x.stroke(); });
          x.fillStyle = s.text && s.text.trim() ? C.blue : C.muted; x.font = `700 30px ${INK}`;
          lines.forEach((l, i) => x.fillText(l, pad + 24, y + 40 + 48 + i * 44));
        } });
      } else if (s.img) {
        const im = await loadImg(s.img);
        const h = inner * 0.75;
        blocks.push({ h: 40 + h + 34, draw: (x, y) => {
          who(x, pad, y, s.by);
          x.fillStyle = '#fff'; x.fillRect(pad - 8, y + 32, inner + 16, h + 16);
          x.lineWidth = 3; x.strokeStyle = C.ink; x.strokeRect(pad - 8, y + 32, inner + 16, h + 16);
          if (im) x.drawImage(im, pad, y + 40, inner, h);
        } });
      }
    }
  }
  const headH = 130, footH = 60;
  const total = headH + blocks.reduce((a, b) => a + b.h, 0) + footH;
  const c = document.createElement('canvas'); c.width = Wd; c.height = Math.min(total, 30000);
  const x = c.getContext('2d');
  x.fillStyle = C.bg; x.fillRect(0, 0, Wd, c.height);
  airmail(x, 0, Wd, 12); airmail(x, c.height - 12, Wd, 12);
  x.font = `400 58px ${HAND}`; x.lineJoin = 'round'; x.lineWidth = 7; x.strokeStyle = C.ink;
  x.strokeText('Krakel', pad, 76); x.fillStyle = C.red; x.fillText('Krakel', pad, 76);
  const kw = x.measureText('Krakel').width; x.strokeText('post', pad + kw + 2, 80); x.fillStyle = C.yellow; x.fillText('post', pad + kw + 2, 80);
  x.fillStyle = C.ink; x.font = `400 18px ${TYPE}`; x.fillText(`ALBUM VON`, pad, 112);
  x.font = `700 26px ${INK}`; x.fillText(`${album.owner.avatar} ${album.owner.name}`, pad + 118, 113);
  postmark(x, Wd - 210, 66, 40, C.red, 'ZUGESTELLT');
  let y = headH;
  for (const b of blocks) { b.draw(x, y); y += b.h; }
  x.fillStyle = C.muted; x.font = `400 16px ${TYPE}`; x.fillText('Krakelpost · Zockbox · made by Oskar', pad, c.height - 30);
  return new Promise((res) => c.toBlob(res, 'image/png'));

  function who(x, px, py, by) {
    x.font = `700 22px ${INK}`; x.fillStyle = C.ink;
    x.fillText(`${by ? by.avatar + ' ' + by.name : ''}`, px + 4, py + 24);
  }
  function label(x, px, py, t) { x.font = `700 22px ${INK}`; x.fillStyle = C.ink; x.fillText(t, px + 4, py + 24); }
}

// ---------- GIF ----------
let LUT = null, PAL = null;
function palette() {
  if (PAL) return PAL;
  const cols = [];
  const hex = (h) => parseInt(h.slice(1), 16);
  for (const p of PALETTE) cols.push(hex(p));
  for (const p of [C.bg, C.card, C.red, C.blue, C.yellow, C.ink, C.muted, C.line, '#2fae6a', '#ff78ad', '#9fd4ff']) cols.push(hex(p));
  const lv = [0, 51, 102, 153, 204, 255];
  for (const r of lv) for (const g of lv) for (const b of lv) cols.push((r << 16) | (g << 8) | b);
  let k = 0; while (cols.length < 256) { const v = Math.min(255, 8 + k * 17); cols.push((v << 16) | (v << 8) | v); k++; }
  PAL = cols.slice(0, 256);
  LUT = new Uint8Array(32768);
  const pr = PAL.map((c) => (c >> 16) & 255), pg = PAL.map((c) => (c >> 8) & 255), pb = PAL.map((c) => c & 255);
  for (let i = 0; i < 32768; i++) {
    const r = ((i >> 10) & 31) * 8.23, g = ((i >> 5) & 31) * 8.23, b = (i & 31) * 8.23;
    let best = 0, bd = 1e9;
    for (let j = 0; j < 256; j++) { const dr = r - pr[j], dg = g - pg[j], db = b - pb[j]; const d = dr * dr * 3 + dg * dg * 4 + db * db * 2; if (d < bd) { bd = d; best = j; } }
    LUT[i] = best;
  }
  return PAL;
}
const GW = 640, GH = 480;
async function frameFor(step, ctx) {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, GW, GH);
  if (step.type === 'text') {
    airmail(ctx, 0, GW, 10); airmail(ctx, GH - 10, GW, 10);
    ctx.fillStyle = C.muted; ctx.font = `700 24px ${INK}`; ctx.fillText(step.by ? `${step.by.avatar} ${step.by.name} schreibt:` : '', 40, 66);
    ctx.font = `700 38px ${INK}`;
    const lines = wrap(ctx, stepText(step), GW - 80).slice(0, 7);
    const y0 = GH / 2 - (lines.length * 52) / 2 + 34;
    ctx.strokeStyle = C.line; ctx.lineWidth = 2;
    lines.forEach((l, i) => { ctx.beginPath(); ctx.moveTo(36, y0 + i * 52 + 10); ctx.lineTo(GW - 36, y0 + i * 52 + 10); ctx.stroke(); });
    ctx.fillStyle = step.text && step.text.trim() ? C.blue : C.muted;
    lines.forEach((l, i) => ctx.fillText(l, 40, y0 + i * 52));
    ctx.font = `400 22px ${HAND}`; ctx.fillStyle = C.red; ctx.fillText('Krakelpost', GW - 128, GH - 22);
  } else if (step.img) {
    const im = await loadImg(step.img);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, GW, GH);
    if (im) ctx.drawImage(im, 0, 0, GW, GH);
    if (!step.noLabel) { ctx.font = `400 22px ${HAND}`; ctx.fillStyle = C.red; ctx.fillText('Krakelpost', GW - 128, GH - 22); }
    if (step.by && !step.noLabel) {
      ctx.font = `700 19px ${INK}`;
      const t = `${step.by.avatar} ${step.by.name}`; const w = ctx.measureText(t).width + 22;
      ctx.fillStyle = C.ink; rr(ctx, 10, GH - 44, w, 34, 6); ctx.fill();
      ctx.fillStyle = C.card; ctx.fillText(t, 21, GH - 20);
    }
  }
}
export async function albumToGifBlob(album, fps = 6, onProgress = () => {}) {
  await fontsReady();
  const pal = palette();
  const c = document.createElement('canvas'); c.width = GW; c.height = GH;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  let frames = [];
  if (album.kind === 'anim') frames = album.steps.filter((s) => s.img).map((s) => ({ step: { ...s, noLabel: true }, delay: Math.max(2, Math.round((100 / fps) * (s.hold || 1))) }));
  else if (album.kind === 'corpse') {
    const cc = await corpseCanvas(album.steps);
    frames = [{ canvas: cc, delay: 400 }];
  } else frames = album.steps.map((s) => ({ step: s, delay: s.type === 'text' ? 220 : 300 }));
  if (!frames.length) throw new Error('Leeres Album');
  const out = new Uint8Array(GW * GH * frames.length + 1024 * 1024);
  const gw = new GifWriter(out, GW, GH, { loop: 0, palette: pal });
  const idx = new Uint8Array(GW * GH);
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    if (f.canvas) { // hohe Figur auf 4:3 einpassen
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, GW, GH);
      const s = Math.min(GW / f.canvas.width, GH / f.canvas.height);
      ctx.drawImage(f.canvas, (GW - f.canvas.width * s) / 2, 0, f.canvas.width * s, f.canvas.height * s);
    } else await frameFor(f.step, ctx);
    const px = ctx.getImageData(0, 0, GW, GH).data;
    for (let p = 0, q = 0; q < idx.length; p += 4, q++) idx[q] = LUT[((px[p] >> 3) << 10) | ((px[p + 1] >> 3) << 5) | (px[p + 2] >> 3)];
    gw.addFrame(0, 0, GW, GH, idx, { delay: f.delay });
    onProgress((i + 1) / frames.length);
    await new Promise((r) => setTimeout(r, 0));
  }
  return new Blob([out.subarray(0, gw.end())], { type: 'image/gif' });
}

export async function saveBlob(blob, filename) {
  const file = typeof File !== 'undefined' ? new File([blob], filename, { type: blob.type }) : null;
  const touch = matchMedia('(hover: none)').matches;
  if (touch && file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Krakelpost' }); return 'shared'; }
    catch (e) { if (e && e.name === 'AbortError') return 'aborted'; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 20000);
  return 'downloaded';
}
