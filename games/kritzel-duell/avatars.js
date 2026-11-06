// Kritzel-Duell – eigene Avatar-Figuren (SVG, Kugelschreiber-Kritzel-Stil). made by Oskar
// Eine Figur = [Farbe, Augen, Mund, Extra] – alles frei kombinierbar.
// Gespeichert lokal als 'kd_fig' (z. B. "3.5.2.1"). Fallback ist das Zockbox-Emoji aus shared/profile.js.

const INK = '#1b1b1f';
export const FIG_COLORS = ['#ff5a5f', '#ff9f1c', '#ffd23f', '#9be15d', '#2ec27e', '#2bc4b6', '#5ec8ff', '#3a6df0', '#8a5cf6', '#ff7ac8', '#b07a4f', '#ffcfa8', '#a9b1bd', '#f4f1e8'];
export const FIG_PARTS = [
  { key: 'c', label: 'Farbe', n: FIG_COLORS.length },
  { key: 'e', label: 'Augen', n: 13 },
  { key: 'm', label: 'Mund', n: 13 },
  { key: 'x', label: 'Extra', n: 13 },
];

export function validFig(f) {
  return Array.isArray(f) && f.length === 4 && f.every((v, i) => Number.isInteger(v) && v >= 0 && v < FIG_PARTS[i].n);
}
export function randomFig() {
  return FIG_PARTS.map((p, i) => (i === 3 && Math.random() < 0.35 ? 0 : Math.floor(Math.random() * p.n)));
}
export function parseFig(s) {
  const f = String(s || '').split('.').map((v) => parseInt(v, 10));
  return validFig(f) ? f : null;
}

// kleiner deterministischer Zufall, damit jede Kombination einen eigenen „krakeligen“ Kopf hat
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function blob(cx, cy, r, seed, wob = 0.07) {
  const R = rng(seed), n = 9, pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2, rr = r * (1 + (R() - 0.5) * 2 * wob);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.96]);
  }
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  let d = `M${mid(pts[n - 1], pts[0]).map((v) => v.toFixed(1)).join(' ')}`;
  for (let i = 0; i < n; i++) { const m = mid(pts[i], pts[(i + 1) % n]); d += ` Q${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`; }
  return d + 'Z';
}
const S = (w = 4) => `fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const star = (cx, cy, r) => { let d = ''; for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(1) + ' ' + (cy + Math.sin(a) * rr).toFixed(1); } return d + 'Z'; };
const heart = (cx, cy, s) => `M${cx} ${cy + s * 0.9} C${cx - s * 1.6} ${cy - s * 0.1} ${cx - s * 0.7} ${cy - s * 1.2} ${cx} ${cy - s * 0.35} C${cx + s * 0.7} ${cy - s * 1.2} ${cx + s * 1.6} ${cy - s * 0.1} ${cx} ${cy + s * 0.9}Z`;

const EYES = [
  () => `<circle cx="37" cy="48" r="5.2" fill="${INK}"/><circle cx="63" cy="48" r="5.2" fill="${INK}"/>`,
  () => `<circle cx="36" cy="47" r="10" fill="#fff" ${S(3.5)}/><circle cx="64" cy="47" r="10" fill="#fff" ${S(3.5)}/><circle cx="39" cy="49" r="4.6" fill="${INK}"/><circle cx="67" cy="49" r="4.6" fill="${INK}"/><circle cx="40.5" cy="47.5" r="1.4" fill="#fff"/><circle cx="68.5" cy="47.5" r="1.4" fill="#fff"/>`,
  () => `<path d="M29 50 Q37 39 45 50 M55 50 Q63 39 71 50" ${S(4.2)}/>`,
  () => `<path d="M28 46 Q37 54 46 46 M54 46 Q63 54 72 46" ${S(4)}/><path d="M31 50 l-2 4 M37 52 v4 M43 50 l2 4 M57 50 l-2 4 M63 52 v4 M69 50 l2 4" ${S(2.4)}/>`,
  () => `<circle cx="38" cy="50" r="4.8" fill="${INK}"/><circle cx="62" cy="50" r="4.8" fill="${INK}"/><path d="M27 37 L45 43 M73 37 L55 43" ${S(4.6)}/>`,
  () => `<path d="M31 42 l12 12 M43 42 l-12 12 M57 42 l12 12 M69 42 l-12 12" ${S(4.2)}/>`,
  () => `<path d="${star(37, 48, 9)}" fill="#ffd23f" ${S(2.6).replace('fill="none" ', '')}/><path d="${star(63, 48, 9)}" fill="#ffd23f" ${S(2.6).replace('fill="none" ', '')}/>`,
  () => `<path d="M37 48 m0 0 a2 2 0 1 1 3 1 a5 5 0 1 1 -7 -4 a8 8 0 1 1 10 9 M63 48 a2 2 0 1 1 3 1 a5 5 0 1 1 -7 -4 a8 8 0 1 1 10 9" ${S(2.8)}/>`,
  () => `<circle cx="37" cy="48" r="5.2" fill="${INK}"/><path d="M55 49 Q63 41 71 49" ${S(4.2)}/>`,
  () => `<path d="M24 41 H76 M24 41 Q24 56 36 56 Q46 56 47 43 M53 43 Q54 56 64 56 Q76 56 76 41" fill="${INK}" ${S(3.5).replace('fill="none" ', '')}/><path d="M29 45 l5 -2 M58 45 l5 -2" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>`,
  () => `<circle cx="50" cy="46" r="13" fill="#fff" ${S(3.5)}/><circle cx="52" cy="48" r="6" fill="${INK}"/><circle cx="54" cy="46" r="1.8" fill="#fff"/><path d="M38 31 Q50 25 62 31" ${S(3.6)}/>`,
  () => `<path d="${heart(37, 48, 7)}" fill="#ff3b5c" ${S(2.6).replace('fill="none" ', '')}/><path d="${heart(63, 48, 7)}" fill="#ff3b5c" ${S(2.6).replace('fill="none" ', '')}/>`,
  () => `<ellipse cx="37" cy="48" rx="8.5" ry="7" fill="#fff" ${S(3.2)}/><ellipse cx="63" cy="48" rx="8.5" ry="7" fill="#fff" ${S(3.2)}/><circle cx="41" cy="49" r="3.6" fill="${INK}"/><circle cx="67" cy="49" r="3.6" fill="${INK}"/><path d="M29 38 Q37 35 45 38 M55 36 Q63 33 71 37" ${S(3.4)}/>`,
];
const MOUTHS = [
  () => `<path d="M38 66 Q50 77 62 66" ${S(4.2)}/>`,
  () => `<path d="M34 63 H66 Q64 80 50 80 Q36 80 34 63Z" fill="#fff" ${S(3.6).replace('fill="none" ', '')}/><path d="M35 69 H65 M43 63 V70 M50 63 V70 M57 63 V70" ${S(2.2)}/>`,
  () => `<ellipse cx="50" cy="70" rx="7.5" ry="9" fill="${INK}"/><path d="M45 75 Q50 71 55 75 Q53 79 50 79 Q47 79 45 75Z" fill="#ff7a8a"/>`,
  () => `<path d="M39 69 H61" ${S(4.2)}/>`,
  () => `<path d="M37 65 Q50 75 63 65" ${S(4)}/><path d="M48 70 Q47 81 53 81 Q58 80 57 69" fill="#ff7a8a" ${S(3).replace('fill="none" ', '')}/>`,
  () => `<path d="M38 73 Q50 63 62 73" ${S(4.2)}/>`,
  () => `<path d="M36 69 l5 -4 l5 4 l4 -4 l5 4 l4 -4 l5 4" ${S(3.6)}/>`,
  () => `<path d="M36 65 Q50 75 64 65" ${S(4)}/><path d="M41 68 l2 6 l3 -5 M54 69 l3 5 l2 -6" fill="#fff" ${S(2.2).replace('fill="none" ', '')}/>`,
  () => `<path d="M38 70 Q52 72 63 63" ${S(4.2)}/><path d="M61 61 l4 4" ${S(3)}/>`,
  () => `<path d="M33 64 Q41 58 50 63 Q59 58 67 64 Q60 67 50 65 Q40 67 33 64Z" fill="${INK}" ${S(2.4).replace('fill="none" ', '')}/><path d="M45 72 Q50 75 55 72" ${S(3.4)}/>`,
  () => `<path d="M47 63 Q55 65 49 69 Q55 71 47 75" ${S(4)}/>`,
  () => `<path d="M33 63 H67 Q65 80 50 80 Q35 80 33 63Z" fill="#fff" ${S(3.4).replace('fill="none" ', '')}/><path d="M36 66 Q50 74 64 66 L63 71 Q50 78 37 71Z" fill="#3a6df0" stroke="${INK}" stroke-width="2"/>`,
  () => `<path d="M38 66 Q50 71 62 66" ${S(4)}/><path d="M45 68 v7 h5 v-6 M50 69 v6 h5 v-7" fill="#fff" ${S(2.4).replace('fill="none" ', '')}/>`,
];
// Extras: [hinter dem Kopf, vor dem Kopf]
const EXTRAS = [
  () => ['', ''],
  () => ['', `<path d="M15 33 Q50 22 86 33 L85 42 Q50 31 16 42Z" fill="#ff3b30" ${S(3).replace('fill="none" ', '')}/><path d="M84 36 l13 -4 l-3 9 M84 39 l11 9 l-9 1" fill="#ff3b30" ${S(2.6).replace('fill="none" ', '')}/>`],
  () => ['', `<path d="M30 22 L28 4 L39 14 L50 0 L61 14 L72 4 L70 22Z" fill="#ffd23f" ${S(3.2).replace('fill="none" ', '')}/><circle cx="50" cy="13" r="3" fill="#ff3b5c"/>`],
  () => ['', `<path d="M17 30 Q20 8 50 8 Q80 8 82 30Z" fill="#3a6df0" ${S(3.4).replace('fill="none" ', '')}/><path d="M74 29 Q96 26 104 33 Q90 36 74 33Z" fill="#2a50c8" ${S(3).replace('fill="none" ', '')}/><circle cx="50" cy="8" r="3.5" fill="#fff" ${S(2.2).replace('fill="none" ', '')}/>`],
  () => ['', `<g transform="rotate(-28 72 63)"><rect x="61" y="58" width="22" height="10" rx="4" fill="#f2c99a" ${S(2.6).replace('fill="none" ', '')}/><path d="M69 60 v6 M75 60 v6" stroke="${INK}" stroke-width="1.6"/></g>`],
  () => ['', `<path d="M50 16 L34 7 Q30 16 34 25Z M50 16 L66 7 Q70 16 66 25Z" fill="#ff7ac8" ${S(3).replace('fill="none" ', '')}/><circle cx="50" cy="16" r="5" fill="#ff7ac8" ${S(3).replace('fill="none" ', '')}/>`],
  () => [`<path d="M24 30 Q14 12 22 2 Q28 16 36 22Z M76 30 Q86 12 78 2 Q72 16 64 22Z" fill="#e8323b" ${S(3).replace('fill="none" ', '')}/>`, ''],
  () => [`<path d="M50 20 Q47 8 56 -2" ${S(3.2)}/>`, `<circle cx="56" cy="-2" r="5.5" fill="#ff3b5c" ${S(3).replace('fill="none" ', '')}/>`],
  () => ['', `<path d="M20 34 Q14 10 34 12 Q36 -4 52 6 Q64 -6 70 10 Q90 8 82 34 Q76 22 66 24 Q60 16 50 22 Q40 16 34 24 Q26 22 20 34Z" fill="#4a2e1c" ${S(3).replace('fill="none" ', '')}/><path d="M36 12 q4 4 2 9 M56 8 q4 5 1 10" stroke="#fff" stroke-width="1.6" fill="none" opacity=".5"/>`],
  () => ['', `<path d="M36 22 L50 -6 L64 22Z" fill="#9be15d" ${S(3.2).replace('fill="none" ', '')}/><path d="M42 10 L58 12 M39 17 L61 19" stroke="#ff3b5c" stroke-width="3.4" stroke-linecap="round"/><circle cx="50" cy="-7" r="4" fill="#ffd23f" ${S(2.4).replace('fill="none" ', '')}/>`],
  () => ['', `<g transform="rotate(-18 84 86)"><path d="M72 76 Q72 64 86 64 Q100 64 100 78 Q100 92 88 94 L78 94 Q72 92 72 84Z" fill="#ff3b30" ${S(3.2).replace('fill="none" ', '')}/><path d="M78 94 h11 v8 h-11z" fill="#fff" ${S(2.8).replace('fill="none" ', '')}/><path d="M80 76 Q84 70 92 72" ${S(2.4)}/></g>`],
  () => ['', `<circle cx="37" cy="48" r="11" fill="rgba(255,255,255,.25)" ${S(3.2).replace('fill="none" ', '')}/><circle cx="63" cy="48" r="11" fill="rgba(255,255,255,.25)" ${S(3.2).replace('fill="none" ', '')}/><path d="M48 47 Q50 45 52 47 M26 46 L14 42 M74 46 L86 42" ${S(3)}/>`],
  () => [`<g transform="rotate(38 80 30)"><rect x="60" y="24" width="46" height="11" fill="#ffd23f" ${S(2.8).replace('fill="none" ', '')}/><path d="M106 24 L118 29.5 L106 35Z" fill="#f2c99a" ${S(2.6).replace('fill="none" ', '')}/><path d="M114 27.5 L118 29.5 L114 31.5Z" fill="${INK}"/><rect x="54" y="24" width="7" height="11" fill="#ff7ac8" ${S(2.6).replace('fill="none" ', '')}/></g>`, ''],
];

const cache = new Map();
export function figSvg(f) {
  if (!validFig(f)) f = [0, 0, 0, 0];
  const k = f.join('.');
  if (cache.has(k)) return cache.get(k);
  const [c, e, m, x] = f;
  const seed = c * 2203 + e * 131 + m * 17 + x * 7 + 11;
  const head = blob(50, 54, 37, seed);
  const sketch = blob(50.5, 53.5, 37.5, seed * 3 + 5, 0.09);
  const [back, front] = EXTRAS[x]();
  const svg = `<svg viewBox="-12 -12 124 124" aria-hidden="true" focusable="false">${back}`
    + `<path d="${head}" fill="${FIG_COLORS[c]}" stroke="${INK}" stroke-width="4.2" stroke-linejoin="round"/>`
    + `<path d="${sketch}" fill="none" stroke="${INK}" stroke-width="1.4" opacity=".45"/>`
    + `<path d="M26 40 Q28 26 40 21" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".55"/>`
    + EYES[e]() + MOUTHS[m]() + front + '</svg>';
  cache.set(k, svg);
  return svg;
}
