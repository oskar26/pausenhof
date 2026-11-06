// Krakelpost – Zeichenfläche (Touch + Maus + Stift). made by Oskar
// Ebenen: underImg (feste Vorlage, nicht radierbar), onionImg (Zwiebelhaut, nur Anzeige),
// cvMain (eigene Striche, transparent), cvLive (Vorschau des aktuellen Strichs / der Form).
export const W = 800, H = 600;
export const PALETTE = [
  '#111111', '#ffffff', '#6b6f80', '#c4c7d4', '#7a3b1f', '#c98a5a',
  '#e3263b', '#ff7a3d', '#ffc81f', '#fff27a', '#2bb24c', '#9bea5a',
  '#0f7a6b', '#29c6e8', '#2456e8', '#8a5cff', '#d63ad8', '#ff8fc8',
];
export const SIZES = [3, 6, 12, 22, 40];

function loadImage(src) {
  return new Promise((res) => {
    if (!src) { res(null); return; }
    const im = new Image();
    im.onload = () => res(im); im.onerror = () => res(null);
    im.src = src;
  });
}

export class Board {
  constructor(els) {
    this.el = els; // {board, main, live, under, onion, cursor}
    this.ctx = els.main.getContext('2d', { willReadFrequently: true });
    this.lctx = els.live.getContext('2d');
    this.tool = 'pen'; this.color = '#111111'; this.size = SIZES[1]; this.opacity = 1;
    this.undoStack = []; this.redoStack = [];
    this.underImage = null; // Image für Füll-Erkennung
    this.secret = false; this.locked = false;
    this.onChange = () => {};
    this._bind();
  }

  // ---------- Inhalt setzen ----------
  async setup({ under = null, onion = null, base = null, secret = false } = {}) {
    this.clearRaw(); this.undoStack = []; this.redoStack = [];
    this.underImage = await loadImage(under);
    this.el.under.classList.toggle('hidden', !under); if (under) this.el.under.src = under; else this.el.under.removeAttribute('src');
    this.el.onion.classList.toggle('hidden', !onion); if (onion) this.el.onion.src = onion; else this.el.onion.removeAttribute('src');
    if (base) { const b = await loadImage(base); if (b) this.ctx.drawImage(b, 0, 0, W, H); }
    this.secret = secret;
    this.el.board.classList.toggle('secret', !!secret);
    this.onChange();
  }
  clearRaw() { this.ctx.clearRect(0, 0, W, H); this.lctx.clearRect(0, 0, W, H); }
  isEmpty() {
    const d = this.ctx.getImageData(0, 0, W, H).data;
    for (let i = 3; i < d.length; i += 16) if (d[i]) return false;
    return true;
  }

  // ---------- Verlauf ----------
  snapshot() {
    this.undoStack.push(this.ctx.getImageData(0, 0, W, H));
    if (this.undoStack.length > 40) this.undoStack.shift();
    this.redoStack = [];
  }
  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(this.ctx.getImageData(0, 0, W, H));
    this.ctx.putImageData(this.undoStack.pop(), 0, 0); this.onChange();
  }
  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(this.ctx.getImageData(0, 0, W, H));
    this.ctx.putImageData(this.redoStack.pop(), 0, 0); this.onChange();
  }
  clear() { if (this.isEmpty()) return; this.snapshot(); this.ctx.clearRect(0, 0, W, H); this.onChange(); }

  // ---------- Export ----------
  exportLayer() { return this.el.main.toDataURL('image/png'); }
  exportComposite(includeUnder = true) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    if (includeUnder && this.underImage) x.drawImage(this.underImage, 0, 0, W, H);
    x.drawImage(this.el.main, 0, 0);
    return c.toDataURL('image/png');
  }

  // ---------- Eingabe ----------
  _pos(e) {
    const r = this.el.main.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }
  _bind() {
    const t = this.el.live; // oberste Ebene fängt die Eingabe
    t.style.touchAction = 'none';
    let pts = null, start = null, pid = null;
    const down = (e) => {
      if (this.locked || pid !== null) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      pid = e.pointerId; try { t.setPointerCapture(pid); } catch (er) {}
      const p = this._pos(e);
      this._cursor(e, true);
      if (this.tool === 'fill') { pid = null; this.snapshot(); this.fill(p.x, p.y); this.onChange(); return; }
      this.snapshot();
      start = p; pts = [p];
      if (this.tool === 'eraser') this._eraseSeg(p, p);
      else if (this.tool === 'pen') this._drawLive(pts);
    };
    const move = (e) => {
      this._cursor(e, true);
      if (pid === null || e.pointerId !== pid) return;
      e.preventDefault();
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of (evs.length ? evs : [e])) {
        const p = this._pos(ev);
        const last = pts[pts.length - 1];
        if (Math.hypot(p.x - last.x, p.y - last.y) < 0.8) continue;
        if (this.tool === 'eraser') this._eraseSeg(last, p);
        pts.push(p);
      }
      if (this.tool === 'pen') this._drawLive(pts);
      else if (['line', 'rect', 'ellipse'].includes(this.tool)) this._shapeLive(start, pts[pts.length - 1], e.shiftKey);
    };
    const up = (e) => {
      if (pid === null || e.pointerId !== pid) return;
      pid = null;
      if (this.tool === 'pen' || ['line', 'rect', 'ellipse'].includes(this.tool)) {
        this.ctx.save(); this.ctx.globalAlpha = this.opacity; this.ctx.drawImage(this.el.live, 0, 0); this.ctx.restore();
        this.lctx.clearRect(0, 0, W, H);
      }
      pts = null; start = null;
      this.onChange();
    };
    t.addEventListener('pointerdown', down);
    t.addEventListener('pointermove', move);
    t.addEventListener('pointerup', up);
    t.addEventListener('pointercancel', up);
    t.addEventListener('pointerleave', (e) => { if (pid === null) this._cursor(e, false); });
    // iOS: kein Scrollen/Zoomen beim Zeichnen
    t.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    t.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    t.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  _cursor(e, show) {
    const c = this.el.cursor; if (!c) return;
    if (!show || e.pointerType === 'touch' && !this.secret) { c.classList.add('hidden'); return; }
    const r = this.el.board.getBoundingClientRect();
    const s = Math.max(6, (this.size / W) * r.width);
    c.style.width = c.style.height = s + 'px';
    c.style.transform = `translate(${e.clientX - r.left - s / 2}px, ${e.clientY - r.top - s / 2}px)`;
    c.style.borderColor = this.tool === 'eraser' ? '#888' : this.color;
    c.classList.remove('hidden');
  }
  _style(x) {
    x.lineCap = 'round'; x.lineJoin = 'round';
    x.strokeStyle = this.color; x.fillStyle = this.color; x.lineWidth = this.size;
  }
  _drawLive(pts) {
    const x = this.lctx; x.clearRect(0, 0, W, H); this._style(x);
    if (pts.length === 1) { x.beginPath(); x.arc(pts[0].x, pts[0].y, this.size / 2, 0, Math.PI * 2); x.fill(); return; }
    x.beginPath(); x.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
      x.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    const l = pts[pts.length - 1]; x.lineTo(l.x, l.y); x.stroke();
  }
  _shapeLive(a, b, square) {
    const x = this.lctx; x.clearRect(0, 0, W, H); this._style(x);
    let w = b.x - a.x, h = b.y - a.y;
    if (square && this.tool !== 'line') { const m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; }
    x.beginPath();
    if (this.tool === 'line') { x.moveTo(a.x, a.y); x.lineTo(a.x + w, a.y + h); }
    else if (this.tool === 'rect') x.rect(a.x, a.y, w, h);
    else x.ellipse(a.x + w / 2, a.y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
    x.stroke();
  }
  _eraseSeg(a, b) {
    const x = this.ctx; x.save(); x.globalCompositeOperation = 'destination-out';
    x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = this.size * 1.4;
    x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x + 0.01, b.y); x.stroke(); x.restore();
  }

  // Fülleimer: Grenzen aus Vorlage + eigenen Strichen, Farbe landet in der eigenen Ebene.
  fill(fx, fy) {
    const sx = Math.floor(fx), sy = Math.floor(fy);
    if (sx < 0 || sy < 0 || sx >= W || sy >= H) return;
    const comp = document.createElement('canvas'); comp.width = W; comp.height = H;
    const cx = comp.getContext('2d', { willReadFrequently: true });
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, W, H);
    if (this.underImage) cx.drawImage(this.underImage, 0, 0, W, H);
    cx.drawImage(this.el.main, 0, 0);
    const src = new Uint32Array(cx.getImageData(0, 0, W, H).data.buffer);
    const target = src[sy * W + sx];
    const tr = target & 255, tg = (target >> 8) & 255, tb = (target >> 16) & 255;
    const tol = 48;
    const same = (v) => Math.abs((v & 255) - tr) + Math.abs(((v >> 8) & 255) - tg) + Math.abs(((v >> 16) & 255) - tb) <= tol;
    const mask = new Uint8Array(W * H);
    const stack = [sx, sy];
    while (stack.length) {
      const y = stack.pop(); let x = stack.pop();
      let i = y * W + x;
      while (x >= 0 && !mask[i] && same(src[i])) { x--; i--; }
      x++; i++;
      let up = false, dn = false;
      while (x < W && !mask[i] && same(src[i])) {
        mask[i] = 1;
        if (y > 0) { const u = i - W; if (!mask[u] && same(src[u])) { if (!up) { stack.push(x, y - 1); up = true; } } else up = false; }
        if (y < H - 1) { const d = i + W; if (!mask[d] && same(src[d])) { if (!dn) { stack.push(x, y + 1); dn = true; } } else dn = false; }
        x++; i++;
      }
    }
    // Maske um 1px wachsen lassen, damit keine weißen Kanten an Antialiasing-Rändern bleiben
    const grown = mask.slice();
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (!mask[i] && (mask[i - 1] || mask[i + 1] || mask[i - W] || mask[i + W])) grown[i] = 1;
    }
    const img = this.ctx.getImageData(0, 0, W, H); const d = img.data;
    const r = parseInt(this.color.slice(1, 3), 16), g = parseInt(this.color.slice(3, 5), 16), b = parseInt(this.color.slice(5, 7), 16);
    const a = Math.round(this.opacity * 255);
    for (let i = 0; i < grown.length; i++) {
      if (!grown[i]) continue;
      const p = i * 4;
      if (a === 255) { d[p] = r; d[p + 1] = g; d[p + 2] = b; d[p + 3] = 255; }
      else { // über bestehende Farbe mischen
        const oa = d[p + 3] / 255, na = a / 255, outA = na + oa * (1 - na);
        d[p] = (r * na + d[p] * oa * (1 - na)) / outA; d[p + 1] = (g * na + d[p + 1] * oa * (1 - na)) / outA; d[p + 2] = (b * na + d[p + 2] * oa * (1 - na)) / outA; d[p + 3] = outA * 255;
      }
    }
    this.ctx.putImageData(img, 0, 0);
  }
}
