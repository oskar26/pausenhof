// Krakelpost – kleiner, eigener QR-Code-Generator (Byte-Modus, Fehlerkorrektur M, Version 1–10).
// Kein CDN, keine Bibliothek. Reicht für Einladungslinks bis ca. 210 Zeichen. made by Oskar

// [Gesamt-Codewörter, EC-Codewörter pro Block, [[Blöcke, Datenwörter], …]] für Stufe M
const VERS = [null,
  [26, 10, [[1, 16]]], [44, 16, [[1, 28]]], [70, 26, [[1, 44]]], [100, 18, [[2, 32]]], [134, 24, [[2, 43]]],
  [172, 16, [[4, 27]]], [196, 18, [[4, 31]]], [242, 22, [[2, 38], [2, 39]]], [292, 22, [[3, 36], [2, 37]]], [346, 26, [[4, 43], [1, 44]]],
];
const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

// ---------- Galoisfeld GF(256) + Reed-Solomon ----------
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
(() => { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
function rsGen(n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const ng = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) { ng[j] ^= g[j]; ng[j + 1] ^= mul(g[j], EXP[i]); }
    g = ng;
  }
  return g;
}
function rsEc(data, n) {
  const g = rsGen(n), res = new Array(n).fill(0);
  for (const d of data) {
    const f = d ^ res[0];
    res.shift(); res.push(0);
    for (let i = 0; i < n; i++) res[i] ^= mul(g[i + 1], f);
  }
  return res;
}

// ---------- Daten → Codewörter ----------
function encodeData(bytes, v) {
  const [total, ecPer, groups] = VERS[v];
  const dataCap = total - ecPer * groups.reduce((a, [b]) => a + b, 0);
  const bits = [];
  const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(4, 4); put(bytes.length, v < 10 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  put(0, Math.min(4, dataCap * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let pad = 0; data.length < dataCap; pad++) data.push(pad % 2 ? 0x11 : 0xec);
  // Blöcke + Fehlerkorrektur, dann verschränken
  const blocks = []; let k = 0;
  for (const [cnt, len] of groups) for (let b = 0; b < cnt; b++) { const d = data.slice(k, k + len); k += len; blocks.push({ d, e: rsEc(d, ecPer) }); }
  const out = [];
  const maxD = Math.max(...blocks.map((b) => b.d.length));
  for (let i = 0; i < maxD; i++) for (const b of blocks) if (i < b.d.length) out.push(b.d[i]);
  for (let i = 0; i < ecPer; i++) for (const b of blocks) out.push(b.e[i]);
  return out;
}
const capacity = (v) => { const [total, ecPer, groups] = VERS[v]; return total - ecPer * groups.reduce((a, [b]) => a + b, 0) - (v < 10 ? 2 : 3); };

// ---------- Matrix ----------
function bch(val, poly, polyLen) { // Rest der Polynomdivision
  let v = val << (polyLen - 1);
  while (v && Math.floor(Math.log2(v)) >= polyLen - 1) v ^= poly << (Math.floor(Math.log2(v)) - (polyLen - 1));
  return v;
}
const MASKS = [
  (r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function build(v, codewords, mask) {
  const n = 17 + 4 * v;
  const m = Array.from({ length: n }, () => new Array(n).fill(0));
  const fn = Array.from({ length: n }, () => new Array(n).fill(false)); // Funktionsmuster
  const set = (r, c, val) => { m[r][c] = val ? 1 : 0; fn[r][c] = true; };
  const finder = (r0, c0) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const rr = r0 + r, cc = c0 + c; if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
      const inR = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      const on = inR && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      set(rr, cc, on);
    }
  };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
  for (let i = 8; i < n - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const al = ALIGN[v];
  const last = al.length - 1;
  al.forEach((r, i) => al.forEach((c, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return; // überlappt Suchmuster
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
  }));
  set(n - 8, 8, true); // dunkles Modul
  // Formatinfo-Bereiche reservieren
  for (let i = 0; i < 9; i++) { if (!fn[8][i]) set(8, i, 0); if (!fn[i][8]) set(i, 8, 0); }
  for (let i = 0; i < 8; i++) { set(8, n - 1 - i, 0); set(n - 1 - i, 8, 0); }
  if (v >= 7) {
    const vi = (v << 12) | bch(v, 0x1f25, 13);
    for (let i = 0; i < 18; i++) { const b = (vi >> i) & 1; const a = Math.floor(i / 3), c = i % 3; set(a, n - 11 + c, b); set(n - 11 + c, a, b); }
  }
  // Daten im Zickzack
  const bits = [];
  for (const cw of codewords) for (let i = 7; i >= 0; i--) bits.push((cw >> i) & 1);
  let bi = 0, up = true;
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let k = 0; k < n; k++) {
      const r = up ? n - 1 - k : k;
      for (let dc = 0; dc < 2; dc++) {
        const c = col - dc;
        if (fn[r][c]) continue;
        let b = bi < bits.length ? bits[bi] : 0; bi++;
        if (MASKS[mask](r, c)) b ^= 1;
        m[r][c] = b;
      }
    }
    up = !up;
  }
  // Formatinfo (Stufe M = 00)
  const fmt = (((0 << 3) | mask) << 10 | bch((0 << 3) | mask, 0x537, 11)) ^ 0x5412;
  for (let i = 0; i < 15; i++) {
    const b = (fmt >> i) & 1;
    if (i < 6) m[i][8] = b; else if (i < 8) m[i + 1][8] = b; else m[n - 15 + i][8] = b;
    if (i < 8) m[8][n - 1 - i] = b; else if (i < 9) m[8][15 - i] = b; else m[8][14 - i] = b;
  }
  m[n - 8][8] = 1;
  return m;
}

function penalty(m) {
  const n = m.length; let p = 0;
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) { // Regel 1: Läufe
    let run = 1;
    for (let j = 1; j < n; j++) {
      const a = pass ? m[j][i] : m[i][j], b = pass ? m[j - 1][i] : m[i][j - 1];
      if (a === b) run++; else { if (run >= 5) p += run - 2; run = 1; }
    }
    if (run >= 5) p += run - 2;
  }
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) { const v = m[r][c]; if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) p += 3; }
  const pat1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], pat2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  for (let i = 0; i < n; i++) for (let j = 0; j <= n - 11; j++) {
    let h1 = true, h2 = true, v1 = true, v2 = true;
    for (let k = 0; k < 11; k++) {
      if (m[i][j + k] !== pat1[k]) h1 = false; if (m[i][j + k] !== pat2[k]) h2 = false;
      if (m[j + k][i] !== pat1[k]) v1 = false; if (m[j + k][i] !== pat2[k]) v2 = false;
    }
    p += 40 * (h1 + h2 + v1 + v2);
  }
  let dark = 0; for (const row of m) for (const v of row) dark += v;
  p += Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n)) * 10;
  return p;
}

/** Liefert die QR-Matrix (Array von Zeilen mit 0/1) oder null, wenn der Text zu lang ist. */
export function qrMatrix(text, forceMask = -1) {
  const bytes = Array.from(new TextEncoder().encode(String(text)));
  let v = 1; while (v <= 10 && capacity(v) < bytes.length) v++;
  if (v > 10) return null;
  const cw = encodeData(bytes, v);
  let best = null, bestP = Infinity;
  if (forceMask >= 0) return build(v, cw, forceMask);
  for (let mask = 0; mask < 8; mask++) { const mm = build(v, cw, mask); const pp = penalty(mm); if (pp < bestP) { bestP = pp; best = mm; } }
  return best;
}

/** QR-Code als SVG-Markup (dunkle Module als ein Pfad). */
export function qrSvg(text, { dark = '#1f2547', light = '#fff', quiet = 4 } = {}) {
  const m = qrMatrix(text); if (!m) return '';
  const n = m.length, s = n + quiet * 2;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c]) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" shape-rendering="crispEdges" role="img" aria-label="QR-Code"><rect width="${s}" height="${s}" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
}
