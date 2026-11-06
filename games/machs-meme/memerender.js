// Mach's Meme – Memes zeichnen (Anzeige + PNG/GIF-Export). made by Oskar
import { GifReader, GifWriter } from './vendor/omggif.js';

export const CAPTION_FONT = 'Barlow Condensed';
const FONT_STACK = `"${CAPTION_FONT}", 'Arial Narrow', Impact, sans-serif`;
const F = (px) => `italic 700 ${px}px ${FONT_STACK}`;
let fontReady = null;
export function captionFontReady() {
  if (!fontReady) {
    fontReady = (document.fonts && document.fonts.load ? document.fonts.load(F(40)) : Promise.resolve()).catch(() => {});
  }
  return fontReady;
}

// --- Textlayout: größte Schrift, bei der der Text in den Kasten passt ---------
function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(''); continue; }
    let line = '';
    for (let word of words) {
      // sehr lange Wörter notfalls zerteilen
      while (ctx.measureText(word).width > maxW && word.length > 1) {
        let cut = word.length - 1;
        while (cut > 1 && ctx.measureText(word.slice(0, cut)).width > maxW) cut--;
        if (line) { out.push(line); line = ''; }
        out.push(word.slice(0, cut));
        word = word.slice(cut);
      }
      const test = line ? line + ' ' + word : word;
      if (line && ctx.measureText(test).width > maxW) { out.push(line); line = word; }
      else line = test;
    }
    out.push(line);
  }
  return out;
}

const LH = 1.08;
export function layoutCaption(ctx, text, bw, bh, cap = Infinity) {
  const maxSize = Math.max(6, Math.min(bh * 0.9, bw * 0.3, cap));
  let lo = 4, hi = maxSize, best = null;
  for (let i = 0; i < 14; i++) {
    const s = (lo + hi) / 2;
    ctx.font = F(s);
    const lines = wrap(ctx, text, bw * 0.94);
    const fits = lines.length * s * LH <= bh * 0.96 && lines.every((l) => ctx.measureText(l).width <= bw * 0.98);
    if (fits) { best = { size: s, lines }; lo = s; } else hi = s;
  }
  if (!best) { ctx.font = F(lo); best = { size: lo, lines: wrap(ctx, text, bw * 0.94) }; }
  return best;
}

export function drawCaptions(ctx, W, H, boxes) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  for (const b of boxes || []) {
    const text = String(b.text || '').trim();
    if (!text) continue;
    const bx = (b.x / 100) * W, by = (b.y / 100) * H, bw = (b.w / 100) * W, bh = (b.h / 100) * H;
    const { size, lines } = layoutCaption(ctx, text, bw, bh, Math.max(W, H) * 0.075);
    ctx.font = F(size);
    const lh = size * LH;
    let y = by + (bh - lines.length * lh) / 2 + lh / 2 + size * 0.04;
    const cx = bx + bw / 2;
    const black = b.c === 'b';
    ctx.lineWidth = Math.max(1.5, size * 0.15);
    ctx.strokeStyle = black ? '#ffffff' : '#000000';
    ctx.fillStyle = black ? '#000000' : '#ffffff';
    for (const line of lines) {
      ctx.strokeText(line, cx, y);
      ctx.fillText(line, cx, y);
      y += lh;
    }
  }
  ctx.restore();
}

// --- Anzeige im DOM ----------------------------------------------------------
const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver((entries) => {
  for (const e of entries) if (e.target._draw) e.target._draw();
}) : null;

/**
 * Zeigt ein Meme in `el` an: Bild (GIF animiert) + Text-Ebene als Canvas.
 * opts.still = true zeigt GIFs als Standbild.
 */
export function renderMeme(el, tpl, boxes, opts = {}) {
  el.innerHTML = '';
  el._meme = { tpl, boxes };
  if (!tpl) return;
  el.style.setProperty('--ar', String((tpl.w || 1) / (tpl.h || 1)));
  let media;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.alt = tpl.n || 'Meme';
  img.decoding = 'async';
  img.draggable = false;
  img.style.aspectRatio = `${tpl.w} / ${tpl.h}`;
  if (tpl.gif && opts.still) {
    media = document.createElement('canvas');
    media.className = 'still';
    media.width = tpl.w; media.height = tpl.h;
    media.style.aspectRatio = `${tpl.w} / ${tpl.h}`;
    img.onload = () => { try { media.getContext('2d').drawImage(img, 0, 0, tpl.w, tpl.h); } catch (e) {} };
  } else media = img;
  const loading = document.createElement('div');
  loading.className = 'loading'; loading.textContent = 'Wird geladen …';
  img.addEventListener('load', () => { loading.remove(); el._draw && el._draw(); });
  img.addEventListener('error', () => { loading.textContent = 'Bild nicht erreichbar 😕'; });
  img.src = tpl.u;
  const cap = document.createElement('canvas');
  cap.className = 'cap';
  el.append(media, cap, loading);
  if (tpl.gif) { const g = document.createElement('span'); g.className = 'gif-badge'; g.textContent = opts.still ? 'GIF (Standbild)' : 'GIF'; el.appendChild(g); }
  if (opts.watermark) { const w = document.createElement('span'); w.className = 'wm'; w.textContent = "Mach's Meme"; el.appendChild(w); }
  el._draw = () => {
    const r = media.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    cap.style.inset = 'auto';
    cap.style.width = r.width + 'px'; cap.style.height = r.height + 'px';
    cap.style.left = media.offsetLeft + 'px'; cap.style.top = media.offsetTop + 'px';
    cap.width = Math.round(r.width * dpr); cap.height = Math.round(r.height * dpr);
    const ctx = cap.getContext('2d');
    ctx.clearRect(0, 0, cap.width, cap.height);
    drawCaptions(ctx, cap.width, cap.height, el._meme.boxes);
  };
  captionFontReady().then(() => el._draw && el._draw());
  if (ro) { ro.unobserve(el); ro.observe(el); }
  requestAnimationFrame(() => el._draw && el._draw());
}
export function redrawMeme(el, boxes) {
  if (!el._meme) return;
  el._meme.boxes = boxes;
  el._draw && el._draw();
}

// --- Export ------------------------------------------------------------------
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'));
    img.src = url;
  });
}
function watermark(ctx, W, H) {
  const s = Math.max(10, Math.round(W * 0.026));
  ctx.save();
  ctx.font = F(s);
  ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
  ctx.lineWidth = Math.max(2, s * 0.22); ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(255,90,120,.95)';
  ctx.strokeText("Mach's Meme", W - s * 0.4, H - s * 0.25);
  ctx.fillText("Mach's Meme", W - s * 0.4, H - s * 0.25);
  ctx.restore();
}

export async function memeToPngBlob(meme) {
  await captionFontReady();
  const img = await loadImage(meme.tpl.u);
  let W = img.naturalWidth || meme.tpl.w, H = img.naturalHeight || meme.tpl.h;
  const scale = Math.min(1, 1600 / W);
  W = Math.round(W * scale); H = Math.round(H * scale);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, W, H);
  drawCaptions(ctx, W, H, meme.boxes);
  watermark(ctx, W, H);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('PNG fehlgeschlagen'))), 'image/png'));
}

// Median-Cut über ein 15-Bit-Histogramm -> bis zu 254 Farben (+ Schwarz/Weiß)
function buildPalette(hist) {
  const cols = [];
  for (let i = 0; i < 32768; i++) if (hist[i]) cols.push(i);
  const ch = (c, k) => (k === 0 ? (c >> 10) & 31 : k === 1 ? (c >> 5) & 31 : c & 31);
  let boxes = [cols];
  while (boxes.length < 254) {
    let bi = -1, bestScore = 0, bestK = 0;
    boxes.forEach((b, i) => {
      if (b.length < 2) return;
      let w = 0;
      const mn = [31, 31, 31], mx = [0, 0, 0];
      for (const c of b) { w += hist[c]; for (let k = 0; k < 3; k++) { const v = ch(c, k); if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v; } }
      let k = 0, range = -1;
      for (let j = 0; j < 3; j++) if (mx[j] - mn[j] > range) { range = mx[j] - mn[j]; k = j; }
      const score = range * Math.sqrt(w);
      if (range > 0 && score > bestScore) { bestScore = score; bi = i; bestK = k; }
    });
    if (bi < 0) break;
    const b = boxes[bi].slice().sort((p, q) => ch(p, bestK) - ch(q, bestK));
    let total = 0; for (const c of b) total += hist[c];
    let acc = 0, cut = 1;
    for (let i = 0; i < b.length - 1; i++) { acc += hist[b[i]]; if (acc >= total / 2) { cut = i + 1; break; } }
    boxes.splice(bi, 1, b.slice(0, cut), b.slice(cut));
  }
  const pal = boxes.filter((b) => b.length).map((b) => {
    let r = 0, g = 0, bl = 0, w = 0;
    for (const c of b) { const n = hist[c]; r += ((c >> 10) & 31) * n; g += ((c >> 5) & 31) * n; bl += (c & 31) * n; w += n; }
    const f = (v) => Math.min(255, Math.round((v / w) * 255 / 31));
    return (f(r) << 16) | (f(g) << 8) | f(bl);
  });
  pal.push(0x000000, 0xffffff);
  while (pal.length < 256) pal.push(0);
  return pal.slice(0, 256);
}

function makeLut(pal) {
  const lut = new Int16Array(32768).fill(-1);
  const pr = pal.map((p) => (p >> 16) & 255), pg = pal.map((p) => (p >> 8) & 255), pb = pal.map((p) => p & 255);
  return (key) => {
    let v = lut[key];
    if (v >= 0) return v;
    const r = ((key >> 10) & 31) * 255 / 31, g = ((key >> 5) & 31) * 255 / 31, b = (key & 31) * 255 / 31;
    let best = 0, bd = 1e9;
    for (let i = 0; i < pal.length; i++) {
      const dr = r - pr[i], dg = g - pg[i], db = b - pb[i];
      const d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
      if (d < bd) { bd = d; best = i; }
    }
    lut[key] = best;
    return best;
  };
}

/** Animiertes GIF mit Text. onProgress(0..1) */
export async function memeToGifBlob(meme, onProgress = () => {}) {
  await captionFontReady();
  const res = await fetch(meme.tpl.u, { mode: 'cors' });
  if (!res.ok) throw new Error('GIF konnte nicht geladen werden');
  const bytes = new Uint8Array(await res.arrayBuffer());
  const reader = new GifReader(bytes);
  const W = reader.width, H = reader.height;
  const n = Math.min(reader.numFrames(), 150);
  const scale = Math.min(1, 480 / Math.max(W, H));
  const OW = Math.max(1, Math.round(W * scale)), OH = Math.max(1, Math.round(H * scale));
  const src = document.createElement('canvas'); src.width = W; src.height = H;
  const sctx = src.getContext('2d');
  const out = document.createElement('canvas'); out.width = OW; out.height = OH;
  const octx = out.getContext('2d', { willReadFrequently: true });

  // Frames nacheinander zusammensetzen (Disposal beachten) und je Frame callback aufrufen
  async function walk(cb) {
    const buf = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < n; i++) {
      const fi = reader.frameInfo(i);
      const saved = fi.disposal === 3 ? buf.slice() : null;
      reader.decodeAndBlitFrameRGBA(i, buf);
      sctx.putImageData(new ImageData(buf.slice(), W, H), 0, 0);
      octx.fillStyle = '#000'; octx.fillRect(0, 0, OW, OH);
      octx.drawImage(src, 0, 0, OW, OH);
      drawCaptions(octx, OW, OH, meme.boxes);
      watermark(octx, OW, OH);
      await cb(i, octx.getImageData(0, 0, OW, OH).data, fi);
      if (fi.disposal === 2) {
        for (let y = fi.y; y < fi.y + fi.height && y < H; y++) for (let x = fi.x; x < fi.x + fi.width && x < W; x++) { const p = (y * W + x) * 4; buf[p] = buf[p + 1] = buf[p + 2] = buf[p + 3] = 0; }
      } else if (saved) buf.set(saved);
      if (i % 3 === 2) await new Promise((r) => setTimeout(r, 0));
    }
  }
  // 1. Durchgang: Farbhistogramm
  const hist = new Uint32Array(32768);
  const step = Math.max(1, Math.floor(n / 12));
  await walk(async (i, px) => {
    onProgress((i / n) * 0.35);
    if (i % step) return;
    for (let p = 0; p < px.length; p += 8) hist[((px[p] >> 3) << 10) | ((px[p + 1] >> 3) << 5) | (px[p + 2] >> 3)]++;
  });
  const pal = buildPalette(hist);
  const near = makeLut(pal);
  // 2. Durchgang: kodieren
  const outBuf = new Uint8Array(Math.ceil(OW * OH * n * 1.6) + 4096 + 1024 * 4);
  const gw = new GifWriter(outBuf, OW, OH, { loop: 0, palette: pal });
  const idx = new Uint8Array(OW * OH);
  await walk(async (i, px, fi) => {
    onProgress(0.35 + (i / n) * 0.65);
    for (let p = 0, q = 0; q < idx.length; p += 4, q++) idx[q] = near(((px[p] >> 3) << 10) | ((px[p + 1] >> 3) << 5) | (px[p + 2] >> 3));
    gw.addFrame(0, 0, OW, OH, idx, { delay: Math.max(2, fi.delay || 8) });
  });
  const end = gw.end();
  onProgress(1);
  return new Blob([outBuf.subarray(0, end)], { type: 'image/gif' });
}

export async function saveBlob(blob, filename) {
  const file = typeof File !== 'undefined' ? new File([blob], filename, { type: blob.type }) : null;
  const touch = matchMedia('(hover: none)').matches;
  if (touch && file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "Mach's Meme" }); return 'shared'; }
    catch (e) { if (e && e.name === 'AbortError') return 'aborted'; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 20000);
  return 'downloaded';
}
