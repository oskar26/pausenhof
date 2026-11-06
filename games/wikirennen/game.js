// Wikirennen – das Wikipedia-Wettrennen. Ein Spiel in der Zockbox – made by Oskar
// Mehrspieler: Der Host-Browser ist der Spielserver (shared/net.js, PeerJS/WebRTC).
// Einzelspieler (Einzelrennen, Tageschallenge, Stufen) laufen mit derselben Host-Logik lokal (LocalRoom).
import { Room } from '../../shared/net.js';
import {
  normTitle, sameTitle, articleUrl, fetchArticle, fetchSummary, resolveTitle, randomArticle,
  popularArticle, trendingArticle, searchTitles, verifyHop, forbiddenTitles, isForbidden, loadNamespaces, loadWikiCss,
  parseWikiInput, langlinkTitle,
} from './wiki.js';
import { WikiFrame } from './wikiframe.js';
import { POPULAR } from './popular.js';
import { DAILY_STARTS, LEVELS } from './data.js';

// PeerJS leiser stellen: Beim Durchsuchen der öffentlichen Lobbys sind leere Plätze normal –
// die Fehler kommen trotzdem als Ereignis bei shared/net.js an, nur ohne rote Konsolenmeldung.
if (typeof window.Peer === 'function' && !window.Peer.__wrQuiet) {
  const P = window.Peer;
  window.Peer = class extends P {
    constructor(id, opts) {
      if (id && typeof id === 'object') super({ ...id, debug: 0 });
      else super(id, { ...(opts || {}), debug: 0 });
    }
  };
  window.Peer.__wrQuiet = true;
}

const GAME_ID = 'wiki-wandertag-v1'; // bleibt so – die Zockbox-Startseite findet Lobbys über diese ID
const AVATARS = ['🐸','🦊','🐼','🐵','🐱','🐶','🦄','🐙','🤖','👽','🦖','🐧','🐷','🦁','🐨','🐯','🐮','🦉','🐝','🍕','🌮','👻','🤡','😎','🥸','🧠','🗿','🐢','🏎️','🚀'];
const POINTS = [100, 80, 65, 55, 45, 40, 35, 30, 25, 20];
const SHORT_BONUS = 10;
const TARGET_PTS = 10;
const FIRST_BONUS = 5;
const MAX_RACE_MIN = 15;
const COUNTDOWN_MS = 7000;
const SOLO_COUNTDOWN_MS = 4000;
const GRACE_MS = 60000;
const AUTO_NEXT_MS = 25000;
const POWERS = {
  ink: { name: 'Tintenklecks', icon: '🖋', desc: 'Kleckst 8 Sekunden lang Tinte über den Artikel', ms: 8000 },
  fog: { name: 'Nebel', icon: '🌫', desc: 'Verschwimmt den Artikel 6 Sekunden lang', ms: 6000 },
  trans: { name: 'Übersetzt', icon: '🌐', desc: 'Zeigt den Artikel 12 Sekunden in einer anderen Sprache – Links gesperrt', ms: 12000 },
};
const ROUTE_NAMES = { mixed: 'Zufall → Bekannt', popular: 'Bekannte Themen', random: 'Komplett zufällig', trending: 'Meistgelesen', daily: 'Tageschallenge', suggest: 'Aus Vorschlägen', custom: 'Selbst gewählt' };
const LANG_NAMES = { de: 'Deutsch', en: 'English' };
const BAN_TXT = ['keine', 'keine USA', 'keine USA, kein Deutschland', 'keine Länderartikel'];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const fmt = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const kl = (n) => `${n} ${+n === 1 ? 'Klick' : 'Klicks'}`;
const isMobile = () => matchMedia('(max-width: 720px)').matches;
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};

function toast(msg, ms = 2800) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

// ---------------------------------------------------------------------------
// Profil (Name + Emoji teilt sich die Zockbox: ph_name / ph_avatar; eigenes Bild nur hier)
// ---------------------------------------------------------------------------
const me = {
  name: localStorage.getItem('ph_name') || '',
  avatar: localStorage.getItem('ph_avatar') || pick(AVATARS),
  img: store.get('wr_avatar_img', ''),
};
if (!AVATARS.includes(me.avatar) && !/^\p{Extended_Pictographic}/u.test(me.avatar)) me.avatar = pick(AVATARS);
let IMGS = {}; // Spieler-ID → Bild (vom Host verteilt)

function avHtml(emoji, id, cls = '') {
  const img = id && IMGS[id];
  return `<span class="av ${cls}">${img ? `<img src="${esc(img)}" alt="">` : esc(emoji)}</span>`;
}
function renderProfile() {
  $('nameInput').value = me.name;
  $('avatarBtn').innerHTML = me.img ? `<img src="${esc(me.img)}" alt="">` : esc(me.avatar);
  $('userAv').innerHTML = me.img ? `<img src="${esc(me.img)}" alt="">` : esc(me.avatar);
  $('userName').textContent = me.name || 'Profil';
  $('clearImgWrap').classList.toggle('hidden', !me.img);
  $('avatarGrid').innerHTML = AVATARS.map((a) => `<button type="button" data-av="${a}" aria-pressed="${!me.img && a === me.avatar}">${a}</button>`).join('');
}
$('avatarBtn').onclick = () => {
  const g = $('avatarGrid');
  g.classList.toggle('hidden');
  $('avatarBtn').setAttribute('aria-expanded', String(!g.classList.contains('hidden')));
};
$('avatarGrid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-av]');
  if (!b) return;
  me.avatar = b.dataset.av; me.img = '';
  localStorage.setItem('ph_avatar', me.avatar); store.set('wr_avatar_img', '');
  renderProfile();
});
$('nameInput').addEventListener('change', () => { me.name = $('nameInput').value.trim().slice(0, 16); localStorage.setItem('ph_name', me.name); renderProfile(); });
$('uploadBtn').onclick = () => $('uploadInput').click();
$('clearImgBtn').onclick = () => { me.img = ''; store.set('wr_avatar_img', ''); renderProfile(); };
$('uploadInput').addEventListener('change', async () => {
  const f = $('uploadInput').files[0];
  $('uploadInput').value = '';
  if (!f) return;
  if (f.size > 512 * 1024) { toast('Das Bild ist größer als 512 KB'); return; }
  try {
    const url = URL.createObjectURL(f);
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const s = Math.min(img.naturalWidth || 64, img.naturalHeight || 64);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 64, 64);
    ctx.drawImage(img, ((img.naturalWidth || 64) - s) / 2, ((img.naturalHeight || 64) - s) / 2, s, s, 0, 0, 64, 64);
    URL.revokeObjectURL(url);
    me.img = c.toDataURL('image/jpeg', 0.8);
    store.set('wr_avatar_img', me.img);
    renderProfile();
    toast('Bild gespeichert – es gilt in Lobbys, solange sie offen sind');
  } catch (e) { toast('Das Bild konnte nicht gelesen werden'); }
});
function readProfile() {
  let n = $('nameInput').value.trim().slice(0, 16);
  if (!n) n = 'Renner' + Math.floor(100 + Math.random() * 900);
  me.name = n;
  localStorage.setItem('ph_name', n);
  localStorage.setItem('ph_avatar', me.avatar);
  renderProfile();
  return { name: me.name, avatar: me.avatar, img: me.img || '' };
}
renderProfile();

// ---------------------------------------------------------------------------
// Tageschallenge + Stufen: Daten, die nur auf diesem Gerät gespeichert werden
// ---------------------------------------------------------------------------
function hash(str) { // FNV-1a, 32 Bit
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
function utcDateKey(d = new Date()) { return d.toISOString().slice(0, 10); }
function addDays(key, n) { const d = new Date(key + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return utcDateKey(d); }
function niceDate(key) { const [y, m, d] = key.split('-'); return `${+d}. ${['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'][+m - 1]} ${y}`; }
function shortDate(key) { const [y, m, d] = key.split('-'); return `${d}.${m}.${y}`; }
function coprimeStep(n, s) { const g = (a, b) => (b ? g(b, a % b) : a); while (g(s, n) !== 1) s++; return s; }
// Deterministisch aus dem Datum: Mit einem teilerfremden Schritt wiederholt sich ein Startartikel erst nach ~170 Tagen.
function dailyRoute(key, lang, attempt = 0, n = 1) {
  const starts = DAILY_STARTS[lang] || DAILY_STARTS.de;
  const pool = POPULAR[lang] || POPULAR.de;
  const day = Math.floor(Date.parse(key + 'T00:00:00Z') / 864e5);
  const start = starts[(day * coprimeStep(starts.length, 37) + (hash(lang) % starts.length) + attempt * 7) % starts.length];
  const targets = [];
  for (let i = 0; targets.length < n && i < 50; i++) {
    const t = pool[(day * coprimeStep(pool.length, 53) + 11 + i * 17 + attempt * 5) % pool.length];
    if (!sameTitle(t, start) && !targets.some((x) => sameTitle(x, t))) targets.push(t);
  }
  return { start, targets };
}
const DAILY_KEY = 'wr_daily_v1';
const LEVEL_KEY = 'wr_levels_v1';
function dailyResult(key, lang) { return store.get(DAILY_KEY, {})[`${lang}|${key}`] || null; }
function saveDaily(key, lang, res) {
  const all = store.get(DAILY_KEY, {});
  const k = `${lang}|${key}`;
  const old = all[k];
  const better = !old || res.c < old.c || (res.c === old.c && res.ms < old.ms);
  if (better) all[k] = { ...res, onDay: (old && old.onDay) || res.onDay, tries: ((old && old.tries) || 0) + 1 };
  else all[k] = { ...old, onDay: old.onDay || res.onDay, tries: (old.tries || 0) + 1 };
  store.set(DAILY_KEY, all);
  return better;
}
function dailyStreak(lang) {
  const all = store.get(DAILY_KEY, {});
  let key = utcDateKey();
  if (!(all[`${lang}|${key}`] && all[`${lang}|${key}`].onDay)) key = addDays(key, -1);
  let n = 0;
  while (all[`${lang}|${key}`] && all[`${lang}|${key}`].onDay) { n++; key = addDays(key, -1); }
  return n;
}
function levelBest() { return store.get(LEVEL_KEY, {}); }
function stars(c, par) { if (c == null) return 0; return c <= par ? 3 : c <= par + 2 ? 2 : 1; }
function starsHtml(n) { return `<span class="stars" title="${n} von 3 Sternen">${'★'.repeat(n)}<span class="off">${'★'.repeat(3 - n)}</span></span>`; }
function levelUnlocked(i, best = levelBest()) { return i === 0 || best[i - 1] != null || best[i] != null; }

// ---------------------------------------------------------------------------
// Bildschirme, Inhaltsverzeichnis, Hauptmenü
// ---------------------------------------------------------------------------
const SCREENS = ['start', 'daily', 'levels', 'lobby', 'countdown', 'race', 'results'];
let curScreen = 'start';
function show(name, keepScroll) {
  if (curScreen !== name) {
    curScreen = name;
    for (const s of SCREENS) $('scr-' + s).classList.toggle('hidden', s !== name);
    document.body.classList.toggle('racing', name === 'race');
    if (!keepScroll) window.scrollTo({ top: 0 });
    closePanel(); closeMenu(); clearFx();
    if (name !== 'race') document.documentElement.style.setProperty('--hud-h', '0px');
  }
  const t = { start: 'Wikirennen – das Wikipedia-Wettrennen', daily: 'Tageschallenge – Wikirennen', levels: 'Stufen – Wikirennen', lobby: `${$('lobbyTitle').textContent} – Wikirennen`,
    countdown: 'Gleich geht’s los – Wikirennen', race: 'Rennen – Wikirennen', results: `${$('resultsTitle').textContent} – Wikirennen` }[name];
  if (document.title !== t) document.title = t;
  scheduleToc();
}

let tocTimer = 0;
function scheduleToc() { cancelAnimationFrame(tocTimer); tocTimer = requestAnimationFrame(buildToc); }
function buildToc() {
  const sec = $('scr-' + curScreen);
  const hs = Array.from(sec.querySelectorAll('h2[id]')).filter((h) => h.offsetParent !== null);
  $('tocList').innerHTML = `<li class="top"><a data-toc="__top">(Anfang)</a></li>` +
    hs.map((h) => `<li><a data-toc="${h.id}">${esc(h.childNodes[0] ? h.childNodes[0].textContent.trim() : h.textContent)}</a></li>`).join('');
  $('vp').classList.toggle('no-toc', curScreen === 'race');
  setupCollapsibles(sec);
}
$('tocList').addEventListener('click', (e) => {
  const a = e.target.closest('[data-toc]');
  if (!a) return;
  if (a.dataset.toc === '__top') window.scrollTo({ top: 0, behavior: 'smooth' });
  else $(a.dataset.toc).scrollIntoView({ behavior: 'smooth' });
});
$('tocHide').onclick = () => { $('toc').classList.add('hidden'); $('vp').classList.add('no-toc'); toast('Inhaltsverzeichnis ausgeblendet – über das Hauptmenü ☰ geht’s weiter'); };
window.addEventListener('scroll', () => {
  const links = $('tocList').querySelectorAll('[data-toc]');
  let on = null;
  for (const a of links) { const h = a.dataset.toc !== '__top' && $(a.dataset.toc); if (h && h.getBoundingClientRect().top < 120) on = a; }
  links.forEach((a) => a.parentElement.classList.toggle('on', a === on));
}, { passive: true });

// Handy: Abschnitte auf- und zuklappen (wie in der mobilen Wikipedia)
function setupCollapsibles(sec) {
  for (const h of sec.querySelectorAll('.vbody > h2')) {
    if (h.dataset.coll) continue;
    h.dataset.coll = '1';
    h.classList.add('coll');
    h.addEventListener('click', (e) => {
      if (!isMobile() || e.target.closest('button, a')) return;
      const closed = h.classList.toggle('closed');
      for (let n = h.nextElementSibling; n && n.tagName !== 'H2'; n = n.nextElementSibling) n.style.display = closed ? 'none' : '';
    });
  }
}

function openMenu() { $('mainMenu').classList.remove('hidden'); $('menuBtn').setAttribute('aria-expanded', 'true'); }
function closeMenu() { $('mainMenu').classList.add('hidden'); $('menuBtn').setAttribute('aria-expanded', 'false'); }
$('menuBtn').onclick = (e) => { e.stopPropagation(); $('mainMenu').classList.contains('hidden') ? openMenu() : closeMenu(); };
$('menuClose').onclick = closeMenu;
document.addEventListener('click', (e) => {
  if (!$('mainMenu').classList.contains('hidden') && !e.target.closest('#mainMenu, #menuBtn')) closeMenu();
  if (!$('powerMenu').classList.contains('hidden') && !e.target.closest('#powerMenu, #powerBtn')) $('powerMenu').classList.add('hidden');
});
$('searchToggle').onclick = () => { const f = $('hdrJoin'); f.classList.toggle('open'); if (f.classList.contains('open')) $('hdrCode').focus(); };
$('homeLink').onclick = (e) => { e.preventDefault(); goHome(); };
$('userBtn').onclick = () => {
  if (room) { toast('Name und Avatar kannst du auf der Hauptseite ändern, wenn du keine Lobby offen hast'); return; }
  show('start'); $('sec-profile').scrollIntoView({ behavior: 'smooth' }); setTimeout(() => $('nameInput').focus(), 300);
};

function confirmLeave() {
  if (!room) return true;
  if (ctx.kind === 'solo') return !S || !['race', 'countdown'].includes(S.phase) || confirm('Rennen wirklich abbrechen?');
  return confirm(room.isHost ? 'Lobby wirklich schließen? Dann ist sie für alle weg.' : 'Lobby wirklich verlassen?');
}
function goHome() { if (!confirmLeave()) return; resetToStart(); }

// Navigation über data-go (Menü, Reiter, Fußzeile, Kästen)
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-go]');
  if (!a) return;
  e.preventDefault();
  closeMenu();
  const go = a.dataset.go;
  const inRace = room && S && ['countdown', 'race'].includes(S.phase);
  if (['start', 'daily', 'levels', 'rules'].includes(go) && room) { if (!confirmLeave()) return; resetToStart(); }
  if (go === 'start') show('start');
  else if (go === 'rules') { show('start'); $('h-rules').scrollIntoView({ behavior: 'smooth' }); }
  else if (go === 'daily') { renderDailyPage(); show('daily'); }
  else if (go === 'levels') { renderLevels(); show('levels'); }
  else {
    if (room) { if (inRace || !confirmLeave()) return; resetToStart(); }
    if (go === 'solo') startSolo({ type: 'free' });
    else if (go === 'random') startSolo({ type: 'random' });
    else if (go === 'private') busy($('privateBtn'), hostPrivate);
    else if (go === 'quick') busy($('quickBtn'), quickPlay);
    else if (go === 'duel') busy($('duelBtn'), duelPlay);
  }
});

function rulesList(st) {
  const s = st.settings;
  const out = [];
  out.push(s.time ? `Zeitlimit: ${s.time} Min` : `Kein Zeitlimit (höchstens ${MAX_RACE_MIN} Min)`);
  out.push(s.find ? 'Strg+F erlaubt' : 'Kein Strg+F');
  out.push(s.back ? 'Zurück erlaubt, kostet 1 Klick' : 'Kein Zurück-Knopf');
  if (s.limit) out.push(`Höchstens ${kl(s.limit)}`);
  if (s.ban) out.push(s.ban === 3 ? 'Verboten: alle Länderartikel' : `Verboten: ${forbiddenTitles(s.lang, s.ban).join(', ')}`);
  if (s.targets > 1) out.push(`${s.targets} Ziele in beliebiger Reihenfolge: ${TARGET_PTS} Punkte pro Ziel, +${FIRST_BONUS} für den Ersten`);
  else out.push(s.scoring === 'clicks' ? 'Wertung: wenigste Klicks (danach Zeit)' : 'Wertung: schnellste Zeit (danach Klicks)');
  if (s.confirm) out.push('Ziel mit „Gefunden!“ melden');
  if (s.restart) out.push('Neustart erlaubt: zurück zum Start, Klicks auf 0');
  if (s.power && ctx.kind !== 'solo') out.push('Power-ups an: Tintenklecks, Nebel, Übersetzt');
  if (ctx.kind !== 'solo') out.push({ grace: '60 s nach dem Ersten ist Schluss', all: 'Die Runde läuft, bis alle fertig sind', first: 'Der Erste beendet die Runde' }[s.end]);
  return out.map((x) => `<li>${esc(x)}</li>`).join('');
}

// ===========================================================================
// LokalRaum: dieselbe Schnittstelle wie Room, aber ohne Netzwerk (Einzelspieler)
// ===========================================================================
class LocalRoom {
  constructor() { this.isHost = true; this.myId = 'solo'; this.code = 'SOLO'; this.isPublic = false; this.peer = null;
    this.getInfo = () => ({}); this.onClientMessage = () => {}; this.onClientJoin = () => {}; this.onClientLeave = () => {}; this.onHostMessage = () => {}; this.onHostLost = () => {}; }
  send(msg) { this.onClientMessage(this.myId, msg); }
  sendTo(id, msg) { if (id === this.myId) this.onHostMessage(msg); }
  broadcast(msg) { this.onHostMessage(msg); }
  kick() {}
  leave() {}
}

// ===========================================================================
// HOST-LOGIK (läuft nur im Browser des Lobby-Erstellers bzw. lokal im Einzelspiel)
// ===========================================================================
let room = null;
let H = null;
let ctx = { kind: 'multi' }; // { kind: 'multi'|'solo', type, date, lang, level, route, challenge }

const DEFAULTS = { lang: 'de', route: 'mixed', targets: 1, rounds: 3, time: 5, end: 'grace', scoring: 'time', back: 1, find: 0, limit: 0, ban: 0, confirm: 0, restart: 0, power: 0, suggest: 1, max: 10 };
function newHostState(over = {}) {
  return {
    phase: 'lobby', settings: { ...DEFAULTS, ...over }, players: {}, order: [], imgs: {},
    roundNo: 0, R: null, endsAt: 0, prepToken: 0, lastRoute: [], suggestions: [], history: [], duel: false, autoAt: 0, dailyDate: null,
  };
}

function hostAddPlayer(id, hello) {
  H.players[id] = {
    name: String(hello.name || 'Gast').slice(0, 16),
    avatar: typeof hello.avatar === 'string' && hello.avatar.length <= 16 ? hello.avatar : pick(AVATARS),
    score: 0,
  };
  const img = hello.img;
  if (typeof img === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(img) && img.length < 24000) H.imgs[id] = img;
  H.order.push(id);
  if (H.R && (H.phase === 'countdown' || H.phase === 'race')) H.R.p[id] = newRoundPlayer(id, H.phase === 'race' ? 'spectator' : 'racing');
}

function newRoundPlayer(id, status = 'racing') {
  const pl = H.players[id];
  return { name: pl.name, avatar: pl.avatar, clicks: 0, cur: H.R.start, stack: [H.R.start], path: [{ t: H.R.start, ms: 0 }], status, time: 0, pts: 0, short: false,
    found: [], backs: 0, restarts: 0, powers: H.settings.power ? { ink: 1, fog: 1, trans: 1 } : {} };
}

function multiTarget() { return H.R && H.R.targets.length > 1; }
function lastFoundMs(p) { return p.found.length ? Math.max(...p.found.map((f) => f.ms)) : Infinity; }
function finishOrder() {
  if (!H.R) return [];
  const sc = H.settings.scoring;
  if (multiTarget()) {
    return Object.entries(H.R.p).filter(([, p]) => p.found.length && p.status !== 'dq' && p.status !== 'spectator')
      .sort(([, a], [, b]) => (b.found.length * TARGET_PTS + b.found.filter((f) => f.first).length * FIRST_BONUS) - (a.found.length * TARGET_PTS + a.found.filter((f) => f.first).length * FIRST_BONUS)
        || b.found.length - a.found.length || lastFoundMs(a) - lastFoundMs(b) || a.clicks - b.clicks)
      .map(([id]) => id);
  }
  return Object.entries(H.R.p).filter(([, p]) => p.status === 'done')
    .sort(([, a], [, b]) => (sc === 'clicks' ? (a.clicks - b.clicks) || (a.time - b.time) : (a.time - b.time) || (a.clicks - b.clicks)))
    .map(([id]) => id);
}

function publicState(forId) {
  const st = {
    t: 'state', phase: H.phase, hostId: room.myId, code: room.code, isPublic: room.isPublic, duel: H.duel,
    settings: H.settings, players: H.order.map((id) => ({ id, ...H.players[id] })),
    roundNo: H.roundNo, endsIn: H.endsAt ? Math.max(0, H.endsAt - Date.now()) : 0,
    suggestions: H.suggestions, history: H.history, autoIn: H.autoAt ? Math.max(0, H.autoAt - Date.now()) : 0,
  };
  const R = H.R;
  if (R && H.phase !== 'lobby' && H.phase !== 'prep') {
    const mine = R.p[forId];
    const reveal = H.phase === 'results' || H.phase === 'final' || !mine || mine.status !== 'racing';
    const order = finishOrder();
    const p = {};
    for (const [id, x] of Object.entries(R.p)) {
      p[id] = { name: x.name, avatar: x.avatar, clicks: x.clicks, cur: x.cur, status: x.status, time: x.time, pts: x.pts, short: x.short,
        place: order.indexOf(id) + 1 || 0, left: !H.players[id], found: x.found, backs: x.backs, restarts: x.restarts, powers: id === forId ? x.powers : undefined };
      if (reveal || id === forId) p[id].path = x.path;
    }
    st.round = { n: R.n, lang: R.lang, start: R.start, target: R.targets[0], targets: R.targets, startSummary: R.startSummary,
      startedAgo: R.startedAt ? Date.now() - R.startedAt : null, p, firstFound: R.firstFound };
  }
  return st;
}

function sync() {
  if (!room || !room.isHost || !H) return;
  for (const id of H.order) room.sendTo(id, publicState(id));
}
function sysChat(text) { if (ctx.kind !== 'solo') room.broadcast({ t: 'chat', sys: true, text }); }
function sendImgs() { if (ctx.kind !== 'solo') room.broadcast({ t: 'imgs', imgs: H.imgs }); else IMGS = { ...H.imgs }; }

async function pickTitle(mode, lang, avoid) {
  if (mode === 'random') return randomArticle(lang, avoid);
  if (mode === 'trending') { try { return await trendingArticle(lang, avoid); } catch (e) { return popularArticle(lang, avoid); } }
  return popularArticle(lang, avoid);
}

async function prepRound(custom) {
  const backTo = H.phase;
  const s = H.settings;
  const n = s.targets;
  const isCustom = s.route === 'custom';
  if (isCustom && (!custom || !custom.start || !custom.targets || custom.targets.filter(Boolean).length < n)) {
    room.sendTo(room.myId, { t: 'err', text: n > 1 ? `Trag erst Start und alle ${n} Ziele ein` : 'Trag erst Start und Ziel ein' });
    return;
  }
  const token = ++H.prepToken;
  H.phase = 'prep'; H.endsAt = 0; H.autoAt = 0; sync();
  const lang = s.lang;
  let start = null, targets = null, err = '';
  for (let attempt = 0; attempt < 6 && !start; attempt++) {
    try {
      let st, tgs = [];
      const avoid = H.lastRoute.slice();
      if (isCustom) { st = custom.start; tgs = custom.targets.slice(0, n); }
      else if (s.route === 'daily') { const d = dailyRoute(H.dailyDate || utcDateKey(), lang, attempt, n); st = d.start; tgs = d.targets; }
      else {
        st = s.route === 'mixed' || s.route === 'suggest' ? await randomArticle(lang, avoid) : await pickTitle(s.route, lang, avoid);
        const sugg = s.route === 'suggest' ? H.suggestions.map((x) => x.title).sort(() => Math.random() - 0.5) : [];
        for (let i = 0; i < n; i++) {
          const av = [...avoid, st, ...tgs];
          const fromSugg = sugg.find((x) => !av.some((a) => sameTitle(a, x)));
          tgs.push(fromSugg || (s.route === 'mixed' || s.route === 'suggest' ? await popularArticle(lang, av) : await pickTitle(s.route, lang, av)));
        }
      }
      const res = await Promise.all([st, ...tgs].map((t) => resolveTitle(lang, t)));
      const bad = res.findIndex((r) => !r || r.ns !== 0);
      if (bad >= 0) {
        if (isCustom) { err = `„${[st, ...tgs][bad]}“ gibt es auf Wikipedia (${lang}) nicht als Artikel.`; break; }
        continue;
      }
      const titles = res.map((r) => r.title);
      const [a, ...b] = titles;
      if (b.some((t) => sameTitle(t, a)) || new Set(b.map(normTitle)).size !== b.length) { if (isCustom) { err = 'Start und Ziele müssen verschiedene Artikel sein'; break; } continue; }
      if (s.ban && b.some((t) => isForbidden(lang, s.ban, t))) { if (isCustom) { err = 'Ein Ziel ist ein verbotener Artikel'; break; } continue; }
      if (res.some((r) => r.disambig) && !isCustom && s.route !== 'daily') continue;
      start = a; targets = b;
    } catch (e) { console.warn(e); err = 'Wikipedia antwortet gerade nicht'; }
  }
  if (token !== H.prepToken || H.phase !== 'prep') return;
  if (!start) {
    H.phase = backTo === 'prep' ? 'lobby' : backTo;
    room.sendTo(room.myId, { t: 'err', text: err || 'Keine Route gefunden – nochmal versuchen?' });
    sync();
    return;
  }
  const sums = await Promise.all([start, ...targets].map((t) => fetchSummary(lang, t)));
  if (token !== H.prepToken) return;
  H.lastRoute = [start, ...targets, ...H.lastRoute].slice(0, 30);
  H.roundNo++;
  H.R = {
    n: H.roundNo, lang, start,
    targets: targets.map((t, i) => ({ title: t, description: sums[i + 1].description, extract: sums[i + 1].extract, thumb: sums[i + 1].thumb })),
    startSummary: { description: sums[0].description, extract: sums[0].extract, thumb: sums[0].thumb },
    startedAt: 0, firstAt: 0, p: {}, firstFound: targets.map(() => null),
  };
  for (const id of H.order) H.R.p[id] = newRoundPlayer(id);
  H.phase = 'countdown';
  H.endsAt = Date.now() + (ctx.kind === 'solo' ? SOLO_COUNTDOWN_MS : COUNTDOWN_MS);
  sync();
}

function startRace() {
  H.phase = 'race';
  H.R.startedAt = Date.now();
  H.endsAt = H.R.startedAt + (H.settings.time || MAX_RACE_MIN) * 60000;
  sync();
}

function checkRoundEnd() {
  if (H.phase !== 'race') return;
  const R = H.R;
  const racing = Object.values(R.p).filter((p) => p.status === 'racing' && !p.gone);
  const done = Object.values(R.p).filter((p) => p.status === 'done');
  if (!racing.length) { H.endsAt = Math.min(H.endsAt, Date.now() + 1200); return; }
  if (done.length && H.settings.end === 'first') { H.endsAt = Math.min(H.endsAt, Date.now() + 1500); return; }
  if (done.length && H.settings.end === 'grace' && R.firstAt) {
    const g = R.firstAt + GRACE_MS;
    if (g < H.endsAt) H.endsAt = g;
  }
}

function endRound() {
  const R = H.R;
  for (const p of Object.values(R.p)) if (p.status === 'racing') p.status = 'timeout';
  const order = finishOrder();
  if (multiTarget()) {
    for (const p of Object.values(R.p)) p.pts = p.status === 'dq' ? 0 : p.found.length * TARGET_PTS + p.found.filter((f) => f.first).length * FIRST_BONUS;
  } else {
    order.forEach((id, i) => { R.p[id].pts = POINTS[i] ?? 10; });
    if (order.length >= 2) {
      const minClicks = Math.min(...order.map((id) => R.p[id].clicks));
      for (const id of order) if (R.p[id].clicks === minClicks) { R.p[id].short = true; R.p[id].pts += SHORT_BONUS; }
    }
  }
  for (const [id, p] of Object.entries(R.p)) if (H.players[id]) H.players[id].score += p.pts;
  const w = order[0];
  H.history.push({ n: R.n, start: R.start, targets: R.targets.map((t) => t.title), lang: R.lang,
    winner: w ? { name: R.p[w].name, avatar: R.p[w].avatar, id: w, clicks: R.p[w].clicks, time: R.p[w].status === 'done' ? R.p[w].time : lastFoundMs(R.p[w]), found: R.p[w].found.length } : null,
    finished: Object.values(R.p).filter((p) => p.status === 'done').length, racers: Object.values(R.p).filter((p) => p.status !== 'spectator').length });
  if (H.history.length > 30) H.history.shift();
  if (H.roundNo >= H.settings.rounds) { H.phase = 'final'; H.endsAt = 0; }
  else { H.phase = 'results'; H.endsAt = H.settings.route === 'custom' || ctx.kind === 'solo' ? 0 : Date.now() + AUTO_NEXT_MS; }
  sysChat(w ? `🏆 ${R.p[w].name} gewinnt Runde ${R.n}!` : `Runde ${R.n}: Niemand hat das Ziel erreicht`);
  sync();
}

function hostTick() {
  if (!H) return;
  if (H.duel && H.phase === 'lobby') {
    if (H.order.length >= 2 && !H.autoAt) { H.autoAt = Date.now() + 5000; sysChat('⚔ Gegner gefunden – das Duell startet in 5 Sekunden!'); sync(); }
    if (H.order.length < 2 && H.autoAt) { H.autoAt = 0; sync(); }
    if (H.autoAt && Date.now() >= H.autoAt) { H.autoAt = 0; hostStart(null); }
  }
  if (!H.endsAt || Date.now() < H.endsAt) return;
  H.endsAt = 0;
  if (H.phase === 'countdown') startRace();
  else if (H.phase === 'race') endRound();
  else if (H.phase === 'results') prepRound(null);
}

function hostStart(custom) {
  H.roundNo = 0; H.R = null; H.history = [];
  for (const id of H.order) H.players[id].score = 0;
  sysChat('Los geht’s – das Rennen beginnt! 🏁');
  prepRound(custom);
}

function unfoundTargetIndex(R, pr, title) {
  return R.targets.findIndex((t, i) => sameTitle(t.title, title) && !pr.found.some((f) => f.i === i));
}

function markFound(id, pr, i, ms) {
  const R = H.R;
  const first = !R.firstFound[i];
  if (first) R.firstFound[i] = id;
  pr.found.push({ i, ms, first });
  if (pr.path.length) pr.path[pr.path.length - 1].f = 1;
  if (pr.found.length >= R.targets.length) {
    pr.status = 'done';
    pr.time = ms;
    if (!R.firstAt) R.firstAt = Date.now();
    const place = finishOrder().indexOf(id) + 1;
    sysChat(`🏁 ${pr.name} ist im Ziel! ${!multiTarget() && H.settings.scoring === 'time' ? `Platz ${place} · ` : ''}${kl(pr.clicks)} · ${fmt(ms)}`);
  } else {
    sysChat(`🎯 ${pr.name} hat „${R.targets[i].title}“ gefunden${first ? ' – als Erste(r)! +5' : ''} (${pr.found.length}/${R.targets.length})`);
  }
}

function hostMove(from, msg) {
  const R = H.R;
  const pr = R && R.p[from];
  if (H.phase !== 'race' || !pr || pr.status !== 'racing') return;
  const title = normTitle(msg.title);
  if (!title) return;
  const ms = Date.now() - R.startedAt;
  const lang = R.lang;
  if (msg.back) {
    if (!H.settings.back) { room.sendTo(from, { t: 'reject', text: 'Zurück ist in dieser Runde verboten', cur: pr.cur }); return; }
    const prev = pr.stack[pr.stack.length - 2];
    if (!prev || !sameTitle(prev, title)) { room.sendTo(from, { t: 'reject', text: 'Zurück ging nicht', cur: pr.cur }); return; }
    pr.stack.pop();
    pr.cur = prev; pr.clicks++; pr.backs++;
    pr.path.push({ t: prev, ms, b: 1 });
  } else {
    if (isForbidden(lang, H.settings.ban, title)) { room.sendTo(from, { t: 'reject', text: 'Verbotener Artikel', cur: pr.cur }); return; }
    const fromTitle = pr.cur;
    pr.stack.push(title);
    pr.cur = title; pr.clicks++;
    const entry = { t: title, ms };
    pr.path.push(entry);
    const via = normTitle(msg.via || title);
    // Sprung im Hintergrund bei Wikipedia prüfen (verlinkt fromTitle wirklich auf via?)
    verifyHop(lang, fromTitle, via).then((ok) => {
      if (ok !== false || !H || !H.R || H.R !== R) return;
      entry.x = 1;
      if (R.targets.some((t) => sameTitle(t.title, title)) && pr.status !== 'dq') {
        pr.status = 'dq';
        sysChat(`⚠ ${pr.name}: Ein Sprung zum Ziel war kein echter Link – disqualifiziert.`);
        checkRoundEnd();
      }
      sync();
    });
  }
  const ti = unfoundTargetIndex(R, pr, pr.cur);
  if (ti >= 0 && !H.settings.confirm) markFound(from, pr, ti, ms);
  if (pr.status === 'racing' && H.settings.limit && pr.clicks >= H.settings.limit && !(ti >= 0 && H.settings.confirm)) {
    pr.status = 'limit';
    sysChat(`👣 ${pr.name} hat das Klick-Limit erreicht.`);
  }
  checkRoundEnd();
  sync();
}

function hostHandle(from, msg) {
  if (!msg || typeof msg !== 'object' || !H) return;
  const isHostMsg = from === room.myId;
  const R = H.R;
  switch (msg.t) {
    case 'settings': {
      if (!isHostMsg || !['lobby', 'results'].includes(H.phase)) return;
      const s = H.settings;
      const inList = (v, l, d) => (l.includes(v) ? v : d);
      const num = (v, l, d) => (l.includes(+v) ? +v : d);
      Object.assign(s, {
        lang: inList(msg.lang, ['de', 'en'], s.lang),
        route: inList(msg.route, Object.keys(ROUTE_NAMES), s.route),
        targets: num(msg.targets, [1, 2, 3, 5], s.targets),
        rounds: Math.max(1, Math.min(10, +msg.rounds || s.rounds)),
        time: num(msg.time, [0, 1, 2, 3, 5, 7, 10], s.time),
        end: inList(msg.end, ['grace', 'all', 'first'], s.end),
        scoring: inList(msg.scoring, ['time', 'clicks'], s.scoring),
        back: +msg.back ? 1 : 0, find: +msg.find ? 1 : 0, confirm: +msg.confirm ? 1 : 0, restart: +msg.restart ? 1 : 0,
        power: +msg.power ? 1 : 0, suggest: +msg.suggest ? 1 : 0,
        ban: num(msg.ban, [0, 1, 2, 3], s.ban),
        limit: num(msg.limit, [0, 3, 5, 7, 10, 15], 0),
        max: Math.max(Math.max(2, H.order.length), Math.min(30, +msg.max || s.max)),
      });
      if (H.duel) s.max = 2;
      if (H.phase === 'results' && s.route === 'custom') H.endsAt = 0;
      if (H.phase === 'results' && s.route !== 'custom' && !H.endsAt && ctx.kind !== 'solo') H.endsAt = Date.now() + AUTO_NEXT_MS;
      sync();
      break;
    }
    case 'start':
      if (!isHostMsg || H.phase !== 'lobby') return;
      hostStart(msg.custom);
      break;
    case 'next':
      if (!isHostMsg || H.phase !== 'results') return;
      prepRound(msg.custom);
      break;
    case 'again':
      if (!isHostMsg || H.phase !== 'final') return;
      H.phase = 'lobby'; H.roundNo = 0; H.endsAt = 0; H.R = null; H.history = [];
      for (const id of H.order) H.players[id].score = 0;
      sync();
      break;
    case 'move':
      hostMove(from, msg);
      break;
    case 'found': {
      const pr = R && R.p[from];
      if (H.phase !== 'race' || !pr || pr.status !== 'racing') return;
      const ti = unfoundTargetIndex(R, pr, pr.cur);
      if (ti < 0) { room.sendTo(from, { t: 'err', text: 'Das hier ist (noch) kein offenes Ziel' }); return; }
      markFound(from, pr, ti, Date.now() - R.startedAt);
      checkRoundEnd(); sync();
      break;
    }
    case 'restart': {
      const pr = R && R.p[from];
      if (H.phase !== 'race' || !pr || pr.status !== 'racing' || !H.settings.restart) return;
      pr.stack = [R.start]; pr.cur = R.start; pr.clicks = 0; pr.restarts++;
      pr.path.push({ t: R.start, ms: Date.now() - R.startedAt, r: 1 });
      sync();
      break;
    }
    case 'giveup': {
      const pr = R && R.p[from];
      if (H.phase !== 'race' || !pr || pr.status !== 'racing') return;
      pr.status = 'gaveup';
      sysChat(`⚑ ${pr.name} hat aufgegeben.`);
      checkRoundEnd();
      sync();
      break;
    }
    case 'power': {
      const pr = R && R.p[from];
      const victim = R && R.p[msg.to];
      const pw = POWERS[msg.kind];
      if (!H.settings.power || H.phase !== 'race' || !pr || !pw || pr.status !== 'racing' || !(pr.powers[msg.kind] > 0)) return;
      if (!victim || msg.to === from || victim.status !== 'racing' || victim.gone) { room.sendTo(from, { t: 'err', text: 'Dieses Ziel kann gerade nicht getroffen werden' }); return; }
      pr.powers[msg.kind]--;
      room.sendTo(msg.to, { t: 'hit', kind: msg.kind, by: pr.name });
      sysChat(`${pw.icon} ${pr.name} → ${victim.name}: ${pw.name}!`);
      sync();
      break;
    }
    case 'suggest': {
      const p = H.players[from];
      if (!p || (!H.settings.suggest && !isHostMsg)) return;
      const t = parseWikiInput(String(msg.title || '').slice(0, 200)).title.slice(0, 120);
      if (!t) return;
      if (H.suggestions.some((x) => sameTitle(x.title, t))) { room.sendTo(from, { t: 'err', text: 'Das wurde schon vorgeschlagen' }); return; }
      H.suggestions.push({ title: t, name: p.name, by: from });
      if (H.suggestions.length > 30) H.suggestions.shift();
      sysChat(`💡 ${p.name} schlägt als Ziel vor: ${t}`);
      sync();
      break;
    }
    case 'unsuggest':
      if (!isHostMsg) return;
      H.suggestions = H.suggestions.filter((x) => !sameTitle(x.title, msg.title));
      sync();
      break;
    case 'chat': {
      const p = H.players[from];
      const text = String(msg.text || '').trim().slice(0, 120);
      if (p && text) room.broadcast({ t: 'chat', name: p.name, avatar: p.avatar, id: from, text, at: Date.now() });
      break;
    }
    case 'kick':
      if (!isHostMsg || msg.id === room.myId || !H.players[msg.id]) return;
      room.sendTo(msg.id, { t: 'kicked' });
      setTimeout(() => room.kick(msg.id), 700);
      hostRemove(msg.id);
      break;
  }
}

function hostRemove(id) {
  if (!H.players[id]) return;
  const name = H.players[id].name;
  delete H.players[id];
  delete H.imgs[id];
  H.order = H.order.filter((x) => x !== id);
  if (H.R && H.R.p[id]) {
    const pr = H.R.p[id];
    if (pr.status === 'racing' || pr.status === 'spectator') pr.status = 'gaveup';
    pr.gone = true;
  }
  sysChat(`${name} hat die Lobby verlassen`);
  sendImgs();
  checkRoundEnd();
  sync();
}

function setupHost(over = {}, duel = false) {
  H = newHostState(over);
  H.duel = duel;
  room.getInfo = () => ({
    phase: H.phase, players: H.order.length, max: H.settings.max, lang: H.settings.lang, route: H.settings.route, targets: H.settings.targets,
    host: H.players[room.myId] ? H.players[room.myId].name : '?', duel: H.duel,
    endsIn: H.phase === 'race' && H.endsAt ? Math.max(0, H.endsAt - Date.now()) : 0, round: H.roundNo, rounds: H.settings.rounds,
  });
  room.onClientJoin = (id, hello) => {
    if (H.order.length >= H.settings.max) {
      room.sendTo(id, { t: 'full' });
      setTimeout(() => room.kick(id), 300);
      return;
    }
    hostAddPlayer(id, hello || {});
    sysChat(`${H.players[id].avatar} ${H.players[id].name} ist beigetreten`);
    sendImgs();
    sync();
  };
  room.onClientLeave = (id) => hostRemove(id);
  room.onClientMessage = (from, msg) => hostHandle(from, msg);
  hostAddPlayer(room.myId, readProfile());
  clearInterval(setupHost.iv);
  setupHost.iv = setInterval(hostTick, 250);
  sendImgs();
  sync();
}

// ===========================================================================
// CLIENT-LOGIK (läuft bei allen, auch beim Host)
// ===========================================================================
let S = null;             // letzter Zustand vom Host
let localDeadline = 0;
let lastPhase = null;
const L = { round: -1, stack: [], visits: [], cur: null, token: 0, clicks: 0, spec: null, celebrated: false, warnedGrace: false, bannerRound: -1, savedRound: -1, fxLock: 0, found: new Set() };

const frame = new WikiFrame($('wikiHost'), {
  onNavigate: (title, anchor) => navigate(title, anchor),
  onBlocked: (kind) => {
    const msg = {
      red: 'Diesen Artikel gibt es noch nicht (roter Link)',
      file: 'Bilder und Dateien zählen nicht als Weg',
      ns: 'Nur echte Artikel zählen – keine Kategorien, Hilfe- oder Spezialseiten',
      external: 'Externe Links sind beim Wikirennen gesperrt',
    }[kind] || 'Dieser Link zählt nicht';
    toast(msg);
  },
});
frame.topOffset = () => ($('hud').offsetHeight || 80) + 8;

function myRound() { return S && S.round && room ? S.round.p[room.myId] : null; }
function isHost() { return room && room.isHost; }

function onHostMessage(msg) {
  if (!msg || typeof msg !== 'object') return;
  if (msg.t === 'state') {
    S = msg;
    localDeadline = msg.endsIn ? Date.now() + msg.endsIn : 0;
    render();
  } else if (msg.t === 'chat') addChat(msg);
  else if (msg.t === 'imgs') { IMGS = msg.imgs || {}; if (S) render(); }
  else if (msg.t === 'err') toast(msg.text, 3800);
  else if (msg.t === 'reject') { toast(msg.text, 3000); if (msg.cur) resyncTo(msg.cur); }
  else if (msg.t === 'full') { toast('Die Lobby ist voll'); resetToStart(); }
  else if (msg.t === 'kicked') { toast('Du wurdest aus der Lobby entfernt'); resetToStart(); }
  else if (msg.t === 'hit') applyHit(msg);
}

function resetToStart() {
  const r = room;
  room = null; S = null;
  if (r) r.leave();
  clearInterval(setupHost.iv);
  H = null; lastPhase = null; IMGS = {};
  L.round = -1; L.savedRound = -1;
  ctx = { kind: 'multi' };
  document.body.classList.remove('solo');
  document.querySelectorAll('.chat-log').forEach((l) => { l.innerHTML = ''; });
  history.replaceState(null, '', location.pathname);
  renderHome();
  show('start');
}

function render() {
  if (!S) return;
  const phaseChanged = S.phase !== lastPhase;
  lastPhase = S.phase;
  placeRouteBox();
  if (S.phase === 'lobby') { renderLobby(); show('lobby'); }
  else if (S.phase === 'prep' || S.phase === 'countdown') { renderCountdown(); show('countdown'); }
  else if (S.phase === 'race') { show('race'); renderRace(phaseChanged); }
  else { renderResults(); show('results'); }
  if (phaseChanged) scheduleToc();
}

// ---------------------------------------------------------------------------
// LOBBY + EINSTELLUNGEN
// ---------------------------------------------------------------------------
const SET_IDS = { setLang: 'lang', setRoute: 'route', setTargets: 'targets', setRounds: 'rounds', setTime: 'time', setEnd: 'end', setScoring: 'scoring', setBack: 'back', setFind: 'find',
  setLimit: 'limit', setBan: 'ban', setConfirm: 'confirm', setRestart: 'restart', setPower: 'power', setSuggest: 'suggest', setMax: 'max' };

function placeRouteBox() {
  const box = $('routeBox');
  const target = S.phase === 'results' && isHost() ? $('routeSlotResults') : $('routeSlotLobby');
  if (box.parentElement !== target) target.appendChild(box);
}

function renderCustomTargets(n) {
  const wrap = $('customTargets');
  const old = Array.from(wrap.querySelectorAll('input')).map((i) => i.value);
  if (wrap.children.length === n) return;
  wrap.innerHTML = Array.from({ length: n }, (_, i) => `
    <label class="fld">${n > 1 ? `Ziel ${i + 1}` : 'Ziel'}
      <div class="ac"><input type="text" class="custom-target" placeholder="Titel oder Wikipedia-Link, z. B. Mond" autocomplete="off" value="${esc(old[i] || '')}"><button type="button" class="cdx-btn dice" data-dice="target" title="Bekannter Artikel">🎲</button><div class="ac-list hidden"></div></div>
    </label>`).join('');
  wrap.querySelectorAll('.ac').forEach(setupAc);
}

function applySettingsToForm() {
  const host = isHost();
  for (const [id, key] of Object.entries(SET_IDS)) {
    const el = $(id);
    el.disabled = !host || (H && H.duel && key === 'max');
    if (document.activeElement !== el) el.value = String(S.settings[key]);
  }
  const custom = S.settings.route === 'custom';
  renderCustomTargets(S.settings.targets);
  $('customBox').classList.toggle('hidden', !(custom && host));
  $('customHidden').classList.toggle('hidden', !(custom && !host));
}

function infoRows(rows) { return rows.filter(Boolean).map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${v}</td></tr>`).join(''); }

function renderLobby() {
  const s = S.settings;
  const solo = ctx.kind === 'solo';
  const host = isHost();
  const hostP = S.players.find((p) => p.id === S.hostId);
  const typ = solo ? 'Einzelrennen' : S.duel ? 'Öffentliches Duell (1 gegen 1)' : S.isPublic ? 'Öffentliche Lobby' : 'Private Lobby';
  $('lobbyTitle').textContent = solo ? 'Einzelrennen' : S.duel ? 'Duell' : `Lobby ${S.code}`;
  $('ibCaption').textContent = solo ? 'Einzelrennen' : `Lobby ${S.code}`;
  $('lobbyCode').textContent = S.code;
  $('lobbyCodeHint').textContent = S.isPublic ? 'Öffentliche Lobby – Link teilen' : 'Lobby-Code – auf der Zockbox-Startseite eintippen';
  $('lobbyLangName').textContent = LANG_NAMES[s.lang];
  $('ibRows').innerHTML = infoRows([
    ['Typ', esc(typ)],
    !solo && ['Host', `${hostP ? avHtml(hostP.avatar, hostP.id) + ' ' + esc(hostP.name) : '?'}`],
    !solo && ['Spieler', `${S.players.length} von ${s.max}`],
    ['Sprache', LANG_NAMES[s.lang]],
    ['Route', esc(ROUTE_NAMES[s.route])],
    ['Ziele', s.targets > 1 ? `${s.targets} (Punkte pro Ziel)` : '1'],
    ['Runden', String(s.rounds)],
    ['Zeitlimit', s.time ? `${s.time} Min` : 'ohne'],
    ['Wertung', s.targets > 1 ? 'Punkte' : s.scoring === 'clicks' ? 'Wenigste Klicks' : 'Schnellste Zeit'],
  ]);
  if (solo) $('lobbyLead').innerHTML = 'Ein <b>Einzelrennen</b> ist ein Wikirennen nur für dich. Wähle unter <a href="#h-route">Route</a> Start und Ziel – oder lass würfeln –, stell die <a href="#h-rules2">Regeln</a> ein und leg los. Über „Route teilen“ kannst du die Strecke vorab an Freunde schicken.';
  else if (S.duel) $('lobbyLead').innerHTML = `Ein <b>Duell</b> ist ein Wikirennen für genau zwei. Gewertet werden die <b>wenigsten Klicks</b>; ein Neustart ist erlaubt. ${S.players.length < 2 ? 'Warte auf einen Gegner … Das Duell startet automatisch.' : S.autoIn ? `Gegner da – Start in ${Math.ceil(S.autoIn / 1000)} s!` : ''}`;
  else $('lobbyLead').innerHTML = `Die <b>Lobby ${esc(S.code)}</b> ist ${S.isPublic ? 'ein öffentliches' : 'ein privates'} Wikirennen für bis zu ${s.max} Spieler. Teile den Code oder den <a id="leadInvite">Einladungslink</a> mit deinen Freunden. ${host ? 'Du bist der Host: Du stellst Route und Regeln ein und startest das Rennen.' : 'Der Host stellt Route und Regeln ein und startet das Rennen.'}`;
  const li = $('leadInvite'); if (li) li.onclick = copyInvite;
  $('playerCount').textContent = `(${S.players.length}/${s.max})`;
  $('playerList').innerHTML = S.players.map((p) => `
    <li class="${p.id === room.myId ? 'me' : ''}">${avHtml(p.avatar, p.id)}<span class="nm">${esc(p.name)}</span>
      ${p.id === S.hostId ? '<span class="tag">(Host)</span>' : ''}${p.id === room.myId ? '<span class="tag">(du)</span>' : ''}
      ${host && p.id !== S.hostId ? `<button class="kick" data-kick="${esc(p.id)}" title="Aus der Lobby entfernen">[entfernen]</button>` : ''}</li>`).join('');
  applySettingsToForm();
  renderSuggestions();
  $('startBtn').classList.toggle('hidden', !host || (S.duel && !solo));
  $('waitHost').classList.toggle('hidden', host && !S.duel);
  $('waitHost').lastChild.textContent = S.duel ? ' Warte auf einen Gegner …' : ' Warte, bis der Host startet …';
  $('startBtn').textContent = solo ? 'Rennen starten' : S.players.length < 2 ? 'Allein starten (oder auf Mitspieler warten)' : 'Rennen starten';
  loadNamespaces(s.lang); loadWikiCss(s.lang);
}
$('playerList').addEventListener('click', (e) => {
  const id = e.target.dataset && e.target.dataset.kick;
  if (id && confirm('Diesen Spieler aus der Lobby entfernen?')) room.send({ t: 'kick', id });
});
function sendSettings() {
  const msg = { t: 'settings' };
  for (const [id, key] of Object.entries(SET_IDS)) msg[key] = $(id).value;
  room.send(msg);
}
for (const id of Object.keys(SET_IDS)) $(id).addEventListener('change', () => room && sendSettings());

function readCustom() {
  const s = S ? S.settings : DEFAULTS;
  const parse = (v) => { const r = parseWikiInput(v); if (r.lang && r.lang !== s.lang && LANG_NAMES[r.lang]) toast(`Hinweis: Der Link ist aus der ${LANG_NAMES[r.lang]}en Wikipedia, gespielt wird auf ${LANG_NAMES[s.lang]}.`); return r.title; };
  return { start: parse($('customStart').value), targets: Array.from(document.querySelectorAll('.custom-target')).map((i) => parse(i.value)) };
}
$('startBtn').onclick = () => room.send({ t: 'start', custom: readCustom() });
$('nextBtn').onclick = () => room.send({ t: 'next', custom: readCustom() });
$('againBtn').onclick = () => room.send({ t: 'again' });
$('leaveBtn').onclick = $('leaveBtn2').onclick = () => goHome();
$('copyLinkBtn').onclick = $('copyLinkBtn2').onclick = () => copyInvite();
async function copyInvite() {
  if (!S) return;
  const q = S.isPublic ? `?pub=${S.code.replace('Ö', '')}` : `?code=${S.code}`;
  shareOrCopy(location.origin + location.pathname + q, `Komm in meine Wikirennen-Lobby ${S.isPublic ? '' : S.code}`.trim());
}
async function shareOrCopy(url, text) {
  if (navigator.share && matchMedia('(pointer: coarse)').matches) { try { await navigator.share({ title: 'Wikirennen', text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(text ? `${text}\n${url}` : url); toast('Link kopiert!'); }
  catch (e) { prompt('Zum Teilen kopieren:', url); }
}
$('shareRouteBtn').onclick = () => {
  const c = readCustom();
  if (!S || S.settings.route !== 'custom' || !c.start || c.targets.some((t) => !t)) { toast('Zum Teilen „Selbst wählen“ einstellen und Start und Ziel eintragen'); return; }
  shareOrCopy(routeLink(S.settings, c.start, c.targets), 'Schaffst du diese Wikirennen-Route?');
};

// Autovervollständigung + Würfel (für „Selbst wählen“ und Vorschläge)
function setupAc(wrap) {
  const input = wrap.querySelector('input');
  const list = wrap.querySelector('.ac-list');
  let t = null, seq = 0, sel = -1;
  const close = () => { list.classList.add('hidden'); sel = -1; };
  input.addEventListener('input', () => {
    clearTimeout(t);
    if (/^https?:/i.test(input.value)) { close(); return; }
    t = setTimeout(async () => {
      const my = ++seq;
      let res = [];
      try { res = await searchTitles(S ? S.settings.lang : 'de', input.value); } catch (e) {}
      if (my !== seq || document.activeElement !== input) return;
      list.innerHTML = res.map((r) => `<div data-v="${esc(r)}">${esc(r)}</div>`).join('');
      sel = -1;
      list.classList.toggle('hidden', !res.length);
    }, 220);
  });
  input.addEventListener('keydown', (e) => {
    const items = list.querySelectorAll('[data-v]');
    if (list.classList.contains('hidden') || !items.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((d, i) => d.classList.toggle('on', i === sel));
    } else if (e.key === 'Enter' && sel >= 0) { e.preventDefault(); input.value = items[sel].dataset.v; close(); }
    else if (e.key === 'Escape') close();
  });
  list.addEventListener('pointerdown', (e) => {
    const d = e.target.closest('[data-v]');
    if (d) { e.preventDefault(); input.value = d.dataset.v; close(); }
  });
  input.addEventListener('blur', () => setTimeout(close, 150));
  const dice = wrap.querySelector('.dice');
  if (dice) dice.addEventListener('click', async (e) => {
    const b = e.currentTarget; b.disabled = true; b.textContent = '…';
    const lang = S ? S.settings.lang : 'de';
    try {
      const avoid = [$('customStart').value, ...Array.from(document.querySelectorAll('.custom-target')).map((i) => i.value)];
      input.value = b.dataset.dice === 'target' ? await popularArticle(lang, avoid) : await randomArticle(lang, avoid);
    } catch (err) { toast('Wikipedia antwortet gerade nicht'); }
    b.disabled = false; b.textContent = '🎲';
  });
}
document.querySelectorAll('#customBox > label .ac, #suggestForm').forEach(setupAc);

// Zielvorschläge
function renderSuggestions() {
  const s = S.settings;
  const show_ = ctx.kind !== 'solo' && (s.suggest || isHost());
  $('suggestSec').classList.toggle('hidden', !show_);
  if (!show_) return;
  $('suggestHint').textContent = s.suggest ? 'Alle können Ziele vorschlagen. Der Host übernimmt sie mit einem Klick oder stellt die Route auf „Ziel aus Vorschlägen“.' : 'Nur der Host kann gerade Ziele vorschlagen.';
  $('suggestForm').classList.toggle('hidden', !s.suggest && !isHost());
  const list = S.suggestions || [];
  $('suggestList').innerHTML = list.length ? list.map((x) => `<li><span class="t">${esc(x.title)}</span><span class="small muted">– vorgeschlagen von ${esc(x.name)}</span>
    ${isHost() ? `<button class="cdx-btn progressive" data-take="${esc(x.title)}" type="button">Als Ziel</button><button class="linkbtn" data-unsugg="${esc(x.title)}" type="button">[entfernen]</button>` : ''}</li>`).join('')
    : '<li class="muted small">Noch keine Vorschläge.</li>';
}
$('suggestBtn').onclick = () => {
  const v = $('suggestInput').value.trim();
  if (!v || !room) return;
  room.send({ t: 'suggest', title: v });
  $('suggestInput').value = '';
};
$('suggestInput').addEventListener('keydown', (e) => { if (e.key === 'Enter' && $('suggestForm').querySelector('.ac-list').classList.contains('hidden')) { e.preventDefault(); $('suggestBtn').click(); } });
$('suggestList').addEventListener('click', (e) => {
  const take = e.target.dataset.take, un = e.target.dataset.unsugg;
  if (un) room.send({ t: 'unsuggest', title: un });
  if (take) {
    if (S.settings.route !== 'custom') { $('setRoute').value = 'custom'; sendSettings(); }
    setTimeout(() => {
      const inputs = Array.from(document.querySelectorAll('.custom-target'));
      const empty = inputs.find((i) => !i.value.trim()) || inputs[0];
      if (empty) empty.value = take;
      if (!$('customStart').value.trim()) $('customStart').closest('.ac').querySelector('.dice').click();
      toast(`„${take}“ ist jetzt ein Ziel`);
    }, 50);
  }
});

// ---------------------------------------------------------------------------
// CHAT (als Diskussionsseite – in Lobby, Rennen und Ergebnis)
// ---------------------------------------------------------------------------
function addChat(m) {
  const at = new Date(m.at || Date.now());
  const ts = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
  for (const log of document.querySelectorAll('.chat-log')) {
    const d = document.createElement('p');
    if (m.sys) { d.className = 'sys'; d.textContent = m.text; }
    else d.innerHTML = `${esc(m.text)} <span class="sig">– <a>${avHtml(m.avatar, m.id)} ${esc(m.name)}</a> <span class="ts">${ts}</span></span>`;
    log.appendChild(d);
    while (log.children.length > 100) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
  }
}
for (const form of document.querySelectorAll('.chat-form')) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = form.querySelector('input');
    const v = inp.value.trim();
    if (v && room) room.send({ t: 'chat', text: v });
    inp.value = '';
  });
}

// ---------------------------------------------------------------------------
// COUNTDOWN
// ---------------------------------------------------------------------------
function cardHtml(label, t, cls = '') {
  if (!t) return '';
  return `<div class="pcard ${cls}">${t.thumb ? `<img class="pimg" src="${esc(t.thumb)}" alt="" loading="lazy">` : ''}<div class="lbl">${esc(label)}</div>
    <div class="ptitle">${esc(t.title)}</div>${t.description ? `<div class="pdesc">${esc(t.description)}</div>` : ''}<p class="pext">${esc(t.extract || '')}</p></div>`;
}
function targetCards(R) { return R.targets.map((t, i) => cardHtml(R.targets.length > 1 ? `Ziel ${i + 1}` : 'Ziel', t, 'target')).join(''); }

function renderCountdown() {
  const prep = S.phase === 'prep';
  $('prepBox').classList.toggle('hidden', !prep);
  $('cdBox').classList.toggle('hidden', prep);
  if (prep || !S.round) return;
  const R = S.round;
  $('cdRound').textContent = ctx.type === 'daily' ? `Tageschallenge vom ${shortDate(ctx.date)}` : ctx.type === 'level' ? `Stufe ${ctx.level + 1}` : S.settings.rounds > 1 ? `Runde ${R.n} von ${S.settings.rounds}` : 'Gleich geht’s los';
  $('cdLang').textContent = LANG_NAMES[R.lang];
  $('cdCards').innerHTML = cardHtml('Start', { title: R.start, ...R.startSummary }) + targetCards(R);
  $('cdRules').innerHTML = rulesList(S) + (ctx.type === 'level' ? `<li>Par: ${kl(LEVELS[ctx.level].par)}</li>` : '');
  frame.setLang(R.lang);
  fetchArticle(R.lang, R.start).catch(() => {});
}

// ---------------------------------------------------------------------------
// RENNEN
// ---------------------------------------------------------------------------
async function showArticle(title, anchor) {
  const R = S.round;
  await frame.setLang(R.lang);
  const art = await fetchArticle(R.lang, title);
  frame.show(art, { anchor, lang: R.lang });
  return art;
}

function scrollToFrame() {
  const top = $('wikiHost').getBoundingClientRect().top + window.scrollY - frame.topOffset();
  if (window.scrollY > top || top - window.scrollY > 160) window.scrollTo({ top: Math.max(0, top) });
}

async function startLocalRace() {
  const R = S.round;
  L.round = R.n; L.stack = [R.start]; L.visits = [{ t: R.start }]; L.cur = R.start; L.clicks = 0; L.found = new Set();
  L.spec = null; L.celebrated = false; L.warnedGrace = false; L.token++;
  clearFx();
  $('modalCards').innerHTML = targetCards(R);
  $('modalRules').innerHTML = rulesList(S);
  $('ruleLine').innerHTML = rulesList(S);
  frame.setLoading(true, 'Lade Start …');
  try { await showArticle(R.start); }
  catch (e) { frame.showMessage(R.start, '<p>Der Startartikel konnte nicht geladen werden. Prüfe deine Internetverbindung.</p>'); }
  frame.setLoading(false);
  window.scrollTo({ top: 0 });
}

function isUnfoundTarget(title) {
  const R = S.round; const mine = myRound();
  return R.targets.some((t, i) => sameTitle(t.title, title) && !(mine && mine.found.some((f) => f.i === i)) && !L.found.has(i));
}

async function navigate(title, anchor) {
  if (!S || S.phase !== 'race') return;
  const mine = myRound();
  if (!mine || mine.status !== 'racing') {
    toast(mine && mine.status === 'spectator' ? 'Du schaust diese Runde nur zu' : 'Du bist schon fertig – jetzt kannst du zuschauen');
    return;
  }
  if (L.fxLock > Date.now()) { toast('Übersetzt! Noch kurz warten …'); return; }
  const s = S.settings;
  const lang = S.round.lang;
  if (sameTitle(title, L.cur)) { if (anchor) frame.scrollToAnchor(anchor); return; }
  if (isForbidden(lang, s.ban, title)) { toast('Dieser Artikel ist in dieser Runde verboten!'); return; }
  const token = ++L.token;
  frame.setLoading(true);
  let art;
  try { art = await fetchArticle(lang, title); }
  catch (e) {
    if (token === L.token) { frame.setLoading(false); toast(e.code === 'missingtitle' ? 'Diesen Artikel gibt es nicht' : 'Artikel konnte nicht geladen werden'); }
    return;
  }
  if (token !== L.token || !S || S.phase !== 'race' || !myRound() || myRound().status !== 'racing') { if (token === L.token) frame.setLoading(false); return; }
  if (isForbidden(lang, s.ban, art.title)) { frame.setLoading(false); toast('Das leitet auf einen verbotenen Artikel weiter!'); return; }
  const from = L.cur;
  L.stack.push(art.title); L.visits.push({ t: art.title }); L.cur = art.title; L.clicks++;
  frame.show(art, { anchor, lang });
  frame.setLoading(false);
  if (!anchor) scrollToFrame();
  const hit = isUnfoundTarget(art.title);
  if (hit) {
    L.visits[L.visits.length - 1].f = 1;
    if (!s.confirm) {
      const i = S.round.targets.findIndex((t) => sameTitle(t.title, art.title));
      L.found.add(i);
      if (L.found.size + (mine.found ? mine.found.length : 0) >= S.round.targets.length || S.round.targets.length === 1) celebrate();
      else toast(`🎯 Ziel gefunden: ${art.title}`);
    } else toast('Das ist ein Ziel! Tipp auf „Gefunden!“');
  }
  room.send({ t: 'move', title: art.title, via: title, from });
  renderRace(false);
}

async function goBack() {
  if (!S || S.phase !== 'race' || !S.settings.back) return;
  const mine = myRound();
  if (!mine || mine.status !== 'racing' || L.stack.length < 2 || L.fxLock > Date.now()) return;
  const prev = L.stack[L.stack.length - 2];
  const token = ++L.token;
  frame.setLoading(true);
  try {
    const art = await fetchArticle(S.round.lang, prev);
    if (token !== L.token) return;
    L.stack.pop(); L.visits.push({ t: prev, b: 1 }); L.cur = prev; L.clicks++;
    frame.show(art, { lang: S.round.lang });
    scrollToFrame();
    room.send({ t: 'move', title: prev, back: true });
  } catch (e) { toast('Zurück ging gerade nicht'); }
  if (token === L.token) frame.setLoading(false);
  renderRace(false);
}

async function restartRun() {
  if (!S || S.phase !== 'race' || !S.settings.restart) return;
  const mine = myRound();
  if (!mine || mine.status !== 'racing') return;
  if (!confirm('Neustart: zurück zum Startartikel, deine Klicks gehen auf 0. Die Zeit läuft weiter.')) return;
  L.token++;
  L.stack = [S.round.start]; L.visits.push({ t: S.round.start, r: 1 }); L.cur = S.round.start; L.clicks = 0;
  room.send({ t: 'restart' });
  try { await showArticle(S.round.start); } catch (e) {}
  window.scrollTo({ top: 0 });
  renderRace(false);
}

async function resyncTo(cur) {
  // Host lehnt einen Zug ab → zurück auf den Artikel, den der Host kennt
  if (!S || S.phase !== 'race') return;
  const mine = myRound();
  if (mine && mine.path) {
    L.stack = [];
    for (const v of mine.path) { if (v.r) L.stack = [v.t]; else if (v.b) L.stack.pop(); else L.stack.push(v.t); }
    L.visits = mine.path.map((v) => ({ t: v.t, b: v.b, r: v.r, f: v.f }));
    L.clicks = mine.clicks;
  }
  L.cur = cur;
  try { await showArticle(cur); } catch (e) {}
}

function celebrate() {
  if (L.celebrated) return;
  L.celebrated = true;
  toast('🎉 Ziel erreicht!', 2500);
}

function statusText(p, R) {
  const multi = R && R.targets.length > 1;
  switch (p.status) {
    case 'done': return `im Ziel${p.place ? ` · Platz ${p.place}` : ''} · ${fmt(p.time)}`;
    case 'gaveup': return p.left ? 'hat die Lobby verlassen' : 'aufgegeben';
    case 'limit': return 'Klick-Limit erreicht';
    case 'dq': return 'disqualifiziert';
    case 'timeout': return multi && p.found && p.found.length ? `Zeit um · ${p.found.length}/${R.targets.length} Ziele` : 'nicht angekommen';
    case 'spectator': return 'schaut zu';
    default: return `${multi ? `${(p.found || []).length}/${R.targets.length} · ` : ''}${p.cur}`;
  }
}

function renderRace() {
  const R = S.round;
  if (!R) return;
  if (L.round !== R.n) startLocalRace();
  const mine = myRound();
  const myStatus = mine ? mine.status : 'spectator';
  const racing = myStatus === 'racing';
  const s = S.settings;
  const clicks = racing ? L.clicks : (mine ? mine.clicks : 0);
  const multi = R.targets.length > 1;
  const foundIdx = new Set([...(mine && mine.found ? mine.found.map((f) => f.i) : []), ...L.found]);
  $('raceRound').textContent = ctx.type === 'level' ? `St. ${ctx.level + 1}` : ctx.type === 'daily' ? 'Tag' : `${R.n}/${s.rounds}`;
  $('raceClicks').textContent = clicks;
  $('raceLimit').textContent = s.limit ? `/${s.limit}` : '';
  $('targetLbl').textContent = multi ? `Ziele ${foundIdx.size}/${R.targets.length}` : 'Ziel';
  $('targetName').innerHTML = R.targets.map((t, i) => `<span class="${foundIdx.has(i) ? 'done' : ''}">${esc(t.title)}</span>`).join('<span class="sep">·</span>');
  $('backBtn').classList.toggle('hidden', !s.back);
  $('backBtn').disabled = !racing || L.stack.length < 2;
  $('restartBtn').classList.toggle('hidden', !s.restart);
  $('restartBtn').disabled = !racing || (L.stack.length < 2 && sameTitle(L.cur, R.start));
  $('foundBtn').classList.toggle('hidden', !(s.confirm && racing && isUnfoundTarget(L.cur)));
  const pw = mine && mine.powers ? Object.values(mine.powers).reduce((a, b) => a + b, 0) : 0;
  $('powerBtn').classList.toggle('hidden', !(s.power && ctx.kind !== 'solo'));
  $('powerBtn').disabled = !racing || !pw;
  $('powerCount').textContent = pw ? ` ${pw}` : '';
  $('playersBtn').classList.toggle('hidden', ctx.kind === 'solo');
  $('giveupBtn').disabled = !racing;
  frame.setLocked(!racing || L.fxLock > Date.now());
  $('panelTitle').textContent = ctx.kind === 'solo' ? 'Dein Rennen' : 'Mitspieler';

  // Weg oben (Brotkrumen)
  const visits = racing || !mine || !mine.path ? L.visits : mine.path;
  $('pathBar').innerHTML = visits.map((v, i) =>
    `${i ? '<span class="ar">›</span>' : ''}<span class="st ${i === visits.length - 1 ? 'cur' : ''} ${v.b ? 'back' : ''} ${v.f ? 'goal' : ''} ${v.r ? 'restart' : ''}">${v.b ? '← ' : ''}${v.r ? '↺ ' : ''}${esc(v.t)}</span>`).join('');
  $('pathBar').scrollLeft = $('pathBar').scrollWidth;

  // Fertig-Hinweis
  const banner = $('doneBanner');
  if (!racing && mine) {
    banner.classList.remove('hidden');
    banner.className = `cdx-msg ${myStatus === 'done' ? 'success' : myStatus === 'spectator' ? '' : 'warning'}`;
    const head = { done: `Geschafft!${mine.place && ctx.kind !== 'solo' ? ` Platz ${mine.place}.` : ''}`, gaveup: 'Aufgegeben.', limit: 'Klick-Limit erreicht.', dq: 'Disqualifiziert.', spectator: 'Du schaust diese Runde zu.', timeout: 'Zeit um.' }[myStatus] || '';
    banner.innerHTML = `<span class="ico">${myStatus === 'done' ? '✓' : 'i'}</span><div><b>${esc(head)}</b> ${myStatus === 'done' ? `${kl(mine.clicks)} · ${fmt(mine.time)}.` : ''} ${ctx.kind === 'solo' ? 'Gleich kommt das Ergebnis.' : 'Tipp auf einen Mitspieler, um seinen Weg live zu sehen.'}</div>${ctx.kind === 'solo' ? '' : '<button class="cdx-btn" id="openPanelBtn">Zuschauen</button>'}`;
    if ($('openPanelBtn')) $('openPanelBtn').onclick = openPanel;
    if (myStatus === 'done') celebrate();
    if (L.bannerRound !== R.n) { L.bannerRound = R.n; window.scrollTo({ top: 0, behavior: 'smooth' }); }
  } else banner.classList.add('hidden');

  // Live-Liste
  const entries = Object.entries(R.p).sort(([, a], [, b]) => {
    const rank = (p) => (p.status === 'done' ? 0 : p.status === 'racing' ? 1 : 2);
    return rank(a) - rank(b) || (a.place || 99) - (b.place || 99) || (b.found || []).length - (a.found || []).length || b.clicks - a.clicks;
  });
  const canSpec = !racing;
  $('liveCount').textContent = `${entries.filter(([, p]) => p.status === 'done').length}/${entries.filter(([, p]) => p.status !== 'spectator').length}`;
  $('liveList').innerHTML = entries.map(([id, p]) => {
    const cl = id === room.myId && racing ? L.clicks : p.clicks;
    const where = id === room.myId && racing ? statusText({ ...p, cur: L.cur }, R) : statusText(p, R);
    return `<li class="live ${id === room.myId ? 'me' : ''} ${p.status === 'done' ? 'done' : ''} ${['gaveup', 'limit', 'dq', 'timeout'].includes(p.status) ? 'out' : ''} ${canSpec ? 'can' : ''} ${L.spec === id ? 'sel' : ''}" data-id="${esc(id)}">
      ${avHtml(p.avatar, id)}<span class="nm">${esc(p.name)}${id === S.hostId && ctx.kind !== 'solo' ? ' <span class="muted small">(Host)</span>' : ''}</span><span class="cl">${cl} Kl.</span>
      <span class="where">${esc(where)}</span></li>`;
  }).join('');
  renderSpec();
  renderPowerMenu();
}

function renderSpec() {
  const R = S.round;
  const p = L.spec && R.p[L.spec];
  $('specBox').classList.toggle('hidden', !p || !p.path);
  if (!p || !p.path) return;
  $('specName').textContent = p.name;
  $('specPath').innerHTML = p.path.map((v) => `<li class="${v.b ? 'b' : ''} ${v.x ? 'x' : ''} ${v.f ? 'f' : ''} ${v.r ? 'r' : ''}">${v.b ? '← ' : ''}${v.r ? '↺ ' : ''}${esc(v.t)}</li>`).join('');
}

$('liveList').addEventListener('click', (e) => {
  const row = e.target.closest('.live');
  if (!row || !row.classList.contains('can')) {
    if (row && ctx.kind !== 'solo') toast('Die Wege der anderen siehst du, wenn du fertig bist');
    return;
  }
  L.spec = row.dataset.id;
  renderRace(false);
});
$('backBtn').onclick = () => goBack();
$('restartBtn').onclick = () => restartRun();
$('foundBtn').onclick = () => room && room.send({ t: 'found' });
$('giveupBtn').onclick = () => {
  if (confirm(ctx.kind === 'solo' ? 'Wirklich aufgeben?' : 'Wirklich aufgeben? Du bekommst in dieser Runde keine Punkte.')) room.send({ t: 'giveup' });
};
$('targetChip').onclick = () => $('targetModal').classList.remove('hidden');
$('targetModal').addEventListener('click', (e) => {
  if (e.target === $('targetModal') || e.target.closest('[data-close]')) $('targetModal').classList.add('hidden');
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { $('targetModal').classList.add('hidden'); closePanel(); closeMenu(); $('powerMenu').classList.add('hidden'); } });
function openPanel() { $('sidePanel').classList.add('open'); $('panelBackdrop').classList.add('open'); }
function closePanel() { $('sidePanel').classList.remove('open'); $('panelBackdrop').classList.remove('open'); }
$('playersBtn').onclick = () => ($('sidePanel').classList.contains('open') ? closePanel() : openPanel());
$('panelClose').onclick = closePanel;
$('panelBackdrop').onclick = closePanel;

// Power-ups
function renderPowerMenu() {
  const menu = $('powerMenu');
  if (menu.classList.contains('hidden') || !S || !S.round) return;
  const mine = myRound();
  const rivals = Object.entries(S.round.p).filter(([id, p]) => id !== room.myId && p.status === 'racing' && !p.left);
  const keep = menu.querySelector('select') ? menu.querySelector('select').value : '';
  menu.innerHTML = `<h4>Power-ups</h4>${rivals.length ? `<label class="small">Wen triffst du?<select id="powerTarget">${rivals.map(([id, p]) => `<option value="${esc(id)}" ${id === keep ? 'selected' : ''}>${esc(p.name)} – ${kl(p.clicks)}</option>`).join('')}</select></label>` : '<p class="small muted">Gerade rennt niemand außer dir.</p>'}
    ${Object.entries(POWERS).map(([k, pw]) => `<div class="pw"><span style="font-size:22px">${pw.icon}</span><div class="d"><b>${pw.name} (${(mine && mine.powers && mine.powers[k]) || 0}×)</b>${pw.desc}</div>
      <button class="cdx-btn progressive" data-pw="${k}" ${!rivals.length || !(mine && mine.powers && mine.powers[k] > 0) ? 'disabled' : ''}>Los</button></div>`).join('')}`;
}
$('powerBtn').onclick = () => { $('powerMenu').classList.toggle('hidden'); renderPowerMenu(); };
$('powerMenu').addEventListener('click', (e) => {
  const b = e.target.closest('[data-pw]');
  if (!b) return;
  const to = $('powerTarget') && $('powerTarget').value;
  if (!to) return;
  room.send({ t: 'power', kind: b.dataset.pw, to });
  $('powerMenu').classList.add('hidden');
});
let fxTimers = [];
function clearFx() {
  fxTimers.forEach(clearTimeout); fxTimers = [];
  $('fxInk').classList.add('hidden'); $('fxInk').innerHTML = '';
  $('fxBadge').classList.add('hidden');
  $('wikiHost').classList.remove('fog');
  if (L.fxLock) { L.fxLock = 0; if (S && S.phase === 'race' && L.cur) showArticle(L.cur).catch(() => {}); }
}
function badge(text, ms) {
  $('fxBadge').textContent = text; $('fxBadge').classList.remove('hidden');
  fxTimers.push(setTimeout(() => $('fxBadge').classList.add('hidden'), ms));
}
async function applyHit(msg) {
  if (!S || S.phase !== 'race') return;
  const pw = POWERS[msg.kind];
  if (!pw) return;
  badge(`${pw.icon} ${pw.name} von ${msg.by}!`, pw.ms);
  if (msg.kind === 'ink') {
    const box = $('fxInk');
    box.innerHTML = Array.from({ length: 11 }, () => {
      const sz = 70 + Math.random() * 170;
      return `<span style="left:${Math.random() * 90}vw;top:${15 + Math.random() * 75}vh;width:${sz}px;height:${sz * (0.7 + Math.random() * 0.6)}px;transform:rotate(${Math.random() * 360}deg)"></span>`;
    }).join('');
    box.classList.remove('hidden');
    fxTimers.push(setTimeout(() => { box.classList.add('hidden'); box.innerHTML = ''; }, pw.ms));
  } else if (msg.kind === 'fog') {
    $('wikiHost').classList.add('fog');
    fxTimers.push(setTimeout(() => $('wikiHost').classList.remove('fog'), pw.ms));
  } else if (msg.kind === 'trans') {
    const lang = S.round.lang, other = lang === 'de' ? 'en' : 'de';
    const t = await langlinkTitle(lang, L.cur, other);
    if (!t) { $('wikiHost').classList.add('fog'); fxTimers.push(setTimeout(() => $('wikiHost').classList.remove('fog'), 6000)); return; }
    try {
      const art = await fetchArticle(other, t);
      if (!S || S.phase !== 'race') return;
      L.fxLock = Date.now() + pw.ms;
      frame.show(art, { lang: other });
      frame.setLocked(true);
      fxTimers.push(setTimeout(() => { L.fxLock = 0; if (S && S.phase === 'race') { showArticle(L.cur).catch(() => {}); renderRace(false); } }, pw.ms));
    } catch (e) {}
  }
}

// Strg+F / Cmd+F / F3 sperren
document.addEventListener('keydown', (e) => {
  if (!S || S.phase !== 'race' || S.settings.find) return;
  const k = (e.key || '').toLowerCase();
  if (((e.ctrlKey || e.metaKey) && (k === 'f' || k === 'g')) || k === 'f3') {
    e.preventDefault(); e.stopPropagation();
    toast('Strg+F ist in diesem Rennen verboten – nur lesen und klicken!');
  }
}, true);

// HUD-Höhe für klebende Elemente
function updateHudVar() {
  if (curScreen !== 'race') return;
  const h = $('hud').offsetHeight || 100;
  document.documentElement.style.setProperty('--hud-h', h + 'px');
  $('wikiHost').style.setProperty('--wwt-top', h + 10 + 'px');
}
new ResizeObserver(updateHudVar).observe($('hud'));

// ---------------------------------------------------------------------------
// ERGEBNISSE
// ---------------------------------------------------------------------------
function wikiLink(lang, t, cls = '') { return `<a href="${esc(articleUrl(lang, t))}" target="_blank" rel="noopener" class="${cls}">${esc(t)}</a>`; }
function playersOfRound(R) {
  return Object.entries(R.p).filter(([, p]) => p.status !== 'spectator')
    .sort(([, a], [, b]) => (a.place || 999) - (b.place || 999) || (b.found || []).length - (a.found || []).length || a.clicks - b.clicks);
}

function renderResults() {
  const final = S.phase === 'final';
  const R = S.round;
  const solo = ctx.kind === 'solo';
  const multi = R && R.targets.length > 1;
  const title = solo ? (ctx.type === 'daily' ? `Tageschallenge vom ${shortDate(ctx.date)}` : ctx.type === 'level' ? `Stufe ${ctx.level + 1}: Ergebnis` : S.settings.rounds > 1 ? `Ergebnis Runde ${R ? R.n : ''}` : 'Ergebnis')
    : final ? 'Siegerehrung' : `Ergebnis Runde ${R ? R.n : ''}`;
  $('resultsTitle').textContent = title;
  $('resLang').textContent = R ? LANG_NAMES[R.lang] : '';
  $('resultsRoute').innerHTML = R ? `<b>Route:</b> ${wikiLink(R.lang, R.start)} → ${R.targets.map((t) => wikiLink(R.lang, t.title)).join(', ')}` : '';
  const sorted = S.players.slice().sort((a, b) => b.score - a.score);

  // Podest
  const showPod = final && !solo && sorted.length >= 2;
  $('podium').classList.toggle('hidden', !showPod);
  if (showPod) {
    const order = [[sorted[1], 's', '2'], [sorted[0], 'g', '1'], [sorted[2], 'b', '3']];
    $('podium').innerHTML = order.filter((o) => o[0]).map(([p, c, n]) => `
      <div class="pod ${c}">${avHtml(p.avatar, p.id, 'lg')}<div class="who">${esc(p.name)}</div><div class="bar">${n}</div><div class="pts">${p.score} Punkte</div></div>`).join('');
  }

  // Platzierung
  if (R) {
    const rows = playersOfRound(R);
    const lang = R.lang;
    const cols = (multi ? 9 : 8) - (isMobile() ? 2 : 0);
    $('roundTable').innerHTML = `<tr><th>Platz</th><th>Spieler</th><th>Zeit</th><th>Klicks</th>${multi ? '<th>Ziele</th>' : ''}<th title="Zurück-Klicks" class="hide-xs">Zurück</th><th title="Sekunden pro Klick" class="hide-xs">Ø s/Klick</th><th>${solo ? 'Status' : 'Punkte'}</th></tr>` +
      (rows.length ? rows.map(([id, p]) => {
        const path = (p.path || []).map((v, i) => `${i ? '<span class="ar">→</span>' : ''}<a href="${esc(articleUrl(lang, v.t))}" target="_blank" rel="noopener" class="${v.f ? 'goal' : ''} ${v.b ? 'b' : ''} ${v.x ? 'x' : ''} ${v.r ? 'r' : ''}" title="${v.x ? 'Kein echter Link gefunden' : 'Auf Wikipedia öffnen'}">${v.b ? '← ' : ''}${v.r ? '↺ ' : ''}${esc(v.t)}</a>`).join('');
        const t = p.status === 'done' ? p.time : multi && p.found && p.found.length ? Math.max(...p.found.map((f) => f.ms)) : 0;
        const pace = t && p.clicks ? (t / 1000 / p.clicks).toFixed(1).replace('.', ',') : '–';
        const pos = p.place && (p.status === 'done' || multi) ? p.place : 0;
        const st = p.status === 'done' ? (p.short && !solo ? 'kürzester Weg ⭐' : 'im Ziel') : statusText(p, R);
        return `<tr class="${id === room.myId ? 'me' : ''}"><td class="c ${pos && pos <= 3 ? 'g' + pos : ''}">${pos ? pos + '.' : '–'}</td>
          <td class="nowrap">${avHtml(p.avatar, id)} ${esc(p.name)}${id === room.myId && !solo ? ' <span class="muted small">(du)</span>' : ''}</td>
          <td class="num">${t ? fmt(t) : '–'}</td><td class="num">${p.clicks}</td>${multi ? `<td class="num">${(p.found || []).length}/${R.targets.length}${(p.found || []).some((f) => f.first) ? ` <span class="small muted">(${p.found.filter((f) => f.first).length}× Erste)</span>` : ''}</td>` : ''}
          <td class="num hide-xs">${p.backs || 0}</td><td class="num hide-xs">${pace}</td><td class="${solo ? '' : 'num'}">${solo ? esc(st) : (p.pts ? '+' + p.pts : '0') + (p.short ? ' ⭐' : '')}</td></tr>
          <tr class="${id === room.myId ? 'me' : ''}"><td colspan="${cols}"><div class="res-path">${path || '<span class="muted">–</span>'}</div></td></tr>`;
      }).join('') : `<tr><td colspan="${cols}" class="muted">Keine Ergebnisse.</td></tr>`);

    // Wegvergleich (Spalten = Spieler, Zeilen = Schritte)
    const ps = rows.filter(([, p]) => p.path);
    const maxLen = Math.max(0, ...ps.map(([, p]) => p.path.length));
    let html = `<tr><th class="step">Schritt</th>${ps.map(([id, p]) => `<th>${avHtml(p.avatar, id)} ${esc(p.name)}</th>`).join('')}</tr>`;
    for (let i = 0; i < Math.min(maxLen, 60); i++) {
      const cells = ps.map(([, p]) => p.path[i]);
      html += `<tr><th class="step">${i === 0 ? 'Start' : i}</th>${cells.map((v) => {
        if (!v) return '<td></td>';
        const same = cells.filter((w) => w && sameTitle(w.t, v.t)).length > 1 && i > 0;
        return `<td class="${v.f ? 'goal' : ''} ${v.b ? 'b' : ''} ${v.x ? 'x' : ''} ${v.r ? 'r' : ''} ${same ? 'same' : ''}">${v.b ? '← ' : ''}${v.r ? '↺ ' : ''}${esc(v.t)}</td>`;
      }).join('')}</tr>`;
    }
    $('compareTable').innerHTML = ps.length ? html : '<tr><td class="muted">Noch keine Wege.</td></tr>';
  }

  // Gesamtwertung
  $('scoreTable').innerHTML = '<tr><th>Platz</th><th>Spieler</th><th>Punkte</th><th>Diese Runde</th></tr>' + sorted.map((p, i) => {
    const g = R && R.p[p.id] ? R.p[p.id].pts : 0;
    return `<tr class="${p.id === room.myId ? 'me' : ''}"><td class="c ${final && i < 3 ? 'g' + (i + 1) : ''}">${i + 1}.</td><td>${avHtml(p.avatar, p.id)} ${esc(p.name)}</td><td class="num"><b>${p.score}</b></td><td class="num">${g ? '+' + g : '–'}</td></tr>`;
  }).join('');

  // Rundenübersicht
  const hist = S.history || [];
  $('historySec').classList.toggle('hidden', hist.length < 2);
  $('historyTable').innerHTML = '<tr><th>Runde</th><th>Start</th><th>Ziel</th><th>Sieger</th><th>Klicks</th><th>Zeit</th><th>Im Ziel</th></tr>' + hist.map((h) => `
    <tr><td class="c">${h.n}</td><td>${wikiLink(h.lang, h.start)}</td><td>${h.targets.map((t) => wikiLink(h.lang, t)).join(', ')}</td>
    <td>${h.winner ? `${avHtml(h.winner.avatar, h.winner.id)} ${esc(h.winner.name)}` : '<span class="muted">niemand</span>'}</td>
    <td class="num">${h.winner ? h.winner.clicks : '–'}</td><td class="num">${h.winner && isFinite(h.winner.time) ? fmt(h.winner.time) : '–'}</td><td class="num">${h.finished}/${h.racers}</td></tr>`).join('');

  const host = isHost();
  $('nextBox').classList.toggle('hidden', !(host && !final && !solo));
  if (host && !final) applySettingsToForm();
  $('againBtn').classList.toggle('hidden', !(final && host && !solo));
  $('soloAgainBtn').classList.toggle('hidden', !(solo && final && ['random', 'free'].includes(ctx.type)));
  $('soloAgainBtn').textContent = ctx.type === 'free' ? 'Noch ein Einzelrennen' : 'Neue Zufallsroute';
  $('retryBtn').classList.toggle('hidden', !(solo && final && ['level', 'daily', 'challenge', 'random', 'free'].includes(ctx.type)));
  $('retryBtn').textContent = 'Gleiche Route nochmal';
  $('nextLevelBtn').classList.toggle('hidden', !(solo && final && ctx.type === 'level' && ctx.level + 1 < LEVELS.length && levelUnlocked(ctx.level + 1)));
  if (solo && !final && S.phase === 'results') { $('nextBox').classList.add('hidden'); }
  renderSoloOutcome(final);
  updateNextNote();
}

function soloRoundNext() { // Einzelrennen mit mehreren Runden: nächste Runde
  room.send({ t: 'next', custom: readCustom() });
}

function renderSoloOutcome(final) {
  const solo = ctx.kind === 'solo';
  $('resultMsg').classList.add('hidden');
  $('shareSec').classList.toggle('hidden', !solo);
  if (!solo || !S.round) return;
  const R = S.round;
  const mine = myRound();
  const done = mine && mine.status === 'done';
  const msg = [];
  if (L.savedRound !== R.n && mine) {
    L.savedRound = R.n;
    if (ctx.type === 'daily' && done) {
      ctx.newBest = saveDaily(ctx.date, R.lang, { c: mine.clicks, ms: mine.time, path: mine.path.map((v) => v.t), onDay: ctx.date === utcDateKey() });
    }
    if (ctx.type === 'level' && done) {
      const best = levelBest();
      ctx.newBest = best[ctx.level] == null || mine.clicks < best[ctx.level];
      if (ctx.newBest) { best[ctx.level] = mine.clicks; store.set(LEVEL_KEY, best); }
    }
  }
  if (done) {
    msg.push(`<b>Geschafft!</b> ${kl(mine.clicks)} in ${fmt(mine.time)}.`);
    if (ctx.type === 'level') {
      const par = LEVELS[ctx.level].par;
      msg.push(`${starsHtml(stars(mine.clicks, par))} Par ist ${par}. ${mine.clicks < par ? 'Du warst sogar kürzer als unser Par – Wikipedia hat sich geändert!' : ''} ${ctx.newBest ? 'Neuer Bestwert!' : ''}`);
    }
    if (ctx.type === 'daily') {
      const best = dailyResult(ctx.date, R.lang);
      msg.push(ctx.newBest ? 'Neuer Bestwert für diesen Tag!' : best ? `Dein Bestwert: ${kl(best.c)} · ${fmt(best.ms)}.` : '');
      if (ctx.date === utcDateKey()) msg.push(`Serie: ${dailyStreak(R.lang)} Tag(e).`);
    }
    if (ctx.challenge) {
      const c = ctx.challenge;
      const win = mine.clicks < c.c || (mine.clicks === c.c && mine.time < c.ms);
      msg.push(`${esc(c.by)} hatte ${kl(c.c)} in ${fmt(c.ms)} – ${win ? '<b>du hast gewonnen!</b>' : mine.clicks === c.c && mine.time === c.ms ? 'unentschieden!' : 'knapp verloren.'}`);
    }
  } else if (mine) msg.push(`<b>${esc(statusText(mine, R))}.</b> Versuch es gleich nochmal!`);
  $('resultMsg').className = `cdx-msg ${done ? 'success' : 'warning'}`;
  $('resultMsg').querySelector('.ico').textContent = done ? '✓' : '!';
  $('resultMsgTxt').innerHTML = msg.filter(Boolean).join(' ');
  $('resultMsg').classList.remove('hidden');
  // Teilen
  let text, url;
  if (ctx.type === 'daily') {
    url = location.origin + location.pathname + `?daily=${ctx.date}&lang=${R.lang}`;
    text = `Wikirennen Tageschallenge ${shortDate(ctx.date)}\n${R.start} → ${R.targets[0].title}\n${done ? `🏁 ${kl(mine.clicks)} · ${fmt(mine.time)}\n${'🟦'.repeat(Math.max(0, mine.clicks - 1))}🟩` : '❌ nicht geschafft'}`;
  } else {
    url = routeLink(S.settings, R.start, R.targets.map((t) => t.title), done ? { by: me.name, c: mine.clicks, ms: mine.time } : null);
    text = done ? `Ich hab ${R.start} → ${R.targets.map((t) => t.title).join(', ')} in ${kl(mine.clicks)} und ${fmt(mine.time)} geschafft. Schlägst du mich?` : `Schaffst du ${R.start} → ${R.targets.map((t) => t.title).join(', ')}?`;
  }
  $('shareLead').textContent = ctx.type === 'daily' ? 'Teile dein Ergebnis ohne zu spoilern – die Kästchen zeigen nur deine Klicks.' : 'Schick die Route an Freunde – sie sehen dein Ergebnis und können es schlagen.';
  $('shareText').value = `${text}\n${url}`;
  $('shareBtn').onclick = () => shareOrCopy(url, text);
  if (S.phase === 'results') { // mehrere Runden im Einzelrennen
    $('nextNote').innerHTML = '';
    if (!$('soloNextBtn')) {
      const b = document.createElement('button');
      b.id = 'soloNextBtn'; b.className = 'cdx-btn primary big'; b.textContent = 'Nächste Runde';
      b.onclick = soloRoundNext;
      $('endBtns').prepend(b);
    }
  } else if ($('soloNextBtn')) $('soloNextBtn').remove();
}

function updateNextNote() {
  if (!S) return;
  const final = S.phase === 'final';
  let t = '';
  if (ctx.kind === 'solo') t = '';
  else if (final) t = isHost() ? '' : 'Der Host kann ein neues Rennen starten.';
  else if (localDeadline) t = `Die nächste Runde startet automatisch in ${Math.max(0, Math.ceil((localDeadline - Date.now()) / 1000))} s …`;
  else t = isHost() ? 'Wähle die nächste Route und starte, wenn alle bereit sind.' : 'Warte auf den Host …';
  $('nextNote').textContent = t;
}
$('soloAgainBtn').onclick = () => {
  if (ctx.type === 'free') { room.send({ t: 'again' }); return; }
  room.send({ t: 'again' }); room.send({ t: 'start' });
};
$('retryBtn').onclick = () => {
  const R = S.round;
  const custom = { start: R.start, targets: R.targets.map((t) => t.title) };
  room.send({ t: 'again' });
  if (ctx.type !== 'daily') { $('setRoute').value = 'custom'; sendSettings(); }
  room.send({ t: 'start', custom });
};
$('nextLevelBtn').onclick = () => { const n = ctx.level + 1; resetToStart(); startLevel(n); };
$('homeBtn').onclick = $('homeBtn2').onclick = () => goHome();

// ---------------------------------------------------------------------------
// TIMER-ANZEIGE
// ---------------------------------------------------------------------------
setInterval(() => {
  if (!S) return;
  const left = localDeadline ? Math.max(0, localDeadline - Date.now()) : 0;
  if (S.phase === 'countdown') {
    const n = String(Math.max(1, Math.ceil(left / 1000)));
    if ($('cdNum').textContent !== n) {
      $('cdNum').textContent = n;
      const el = $('cdNum'); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    }
  } else if (S.phase === 'race') {
    $('raceTimer').textContent = fmt(left);
    $('raceTimer').classList.toggle('low', left < 30000);
    const R = S.round;
    const anyDone = R && Object.values(R.p).some((p) => p.status === 'done');
    if (anyDone && S.settings.end === 'grace' && ctx.kind !== 'solo' && !L.warnedGrace && myRound() && myRound().status === 'racing') {
      L.warnedGrace = true;
      toast(`Jemand ist im Ziel – noch ${Math.ceil(left / 1000)} Sekunden!`, 3500);
    }
    if (L.fxLock && L.fxLock < Date.now()) frame.setLocked(myRound() && myRound().status !== 'racing');
  } else if (S.phase === 'results') updateNextNote();
  else if (S.phase === 'lobby' && S.duel && S.autoIn) renderLobby();
}, 250);

// ---------------------------------------------------------------------------
// HAUPTSEITE, TAGESCHALLENGE, STUFEN
// ---------------------------------------------------------------------------
function dailyLang() { return store.get('wr_daily_lang', 'de'); }
function renderHome() {
  const key = utcDateKey(), lang = dailyLang();
  const d = dailyRoute(key, lang);
  $('dailyDate').textContent = `${niceDate(key)} · ${LANG_NAMES[lang]}`;
  $('dailyRoute').innerHTML = `${esc(d.start)}<span class="arr">→</span>${esc(d.targets[0])}`;
  const r = dailyResult(key, lang);
  $('dailyStat').innerHTML = r ? `Heute geschafft: <b>${kl(r.c)}</b> · ${fmt(r.ms)} · Serie: ${dailyStreak(lang)} Tag(e)` : `Noch nicht gespielt. ${dailyStreak(lang) ? `Deine Serie: ${dailyStreak(lang)} Tag(e) – halt sie am Leben!` : ''}`;
  $('dailyBtn').textContent = r ? 'Nochmal versuchen' : 'Heute spielen';
  const best = levelBest();
  const done = LEVELS.filter((_, i) => best[i] != null).length;
  const st = LEVELS.reduce((a, l, i) => a + stars(best[i], l.par), 0);
  $('levelsStat').innerHTML = `Geschafft: <b>${done} von ${LEVELS.length}</b> Stufen · ${st} von ${LEVELS.length * 3} Sternen`;
  document.querySelectorAll('.lvCount').forEach((e) => { e.textContent = LEVELS.length; });
  $('lvCountTxt').textContent = LEVELS.length;
}
function renderDailyPage() {
  const lang = dailyLang();
  $('dailyLang').value = lang;
  $('dailyLangName').textContent = LANG_NAMES[lang];
  const key = utcDateKey();
  const d = dailyRoute(key, lang);
  const r = dailyResult(key, lang);
  const all = store.get(DAILY_KEY, {});
  const played = Object.keys(all).filter((k) => k.startsWith(lang + '|')).length;
  $('dailyInfo').innerHTML = `<caption>Tageschallenge</caption><tbody><tr><td colspan="2" class="ib-center" style="font-family:var(--serif);font-size:20px">${esc(niceDate(key))}</td></tr>
    <tr><td colspan="2" class="ib-head">Heute</td></tr>${infoRows([['Start', esc(d.start)], ['Ziel', esc(d.targets[0])], ['Wertung', 'Wenigste Klicks'], ['Zeitlimit', `keins (max. ${MAX_RACE_MIN} Min)`], ['Zurück', 'erlaubt (1 Klick)']])}
    <tr><td colspan="2" class="ib-head">Deine Statistik</td></tr>${infoRows([['Heute', r ? `${kl(r.c)} · ${fmt(r.ms)}` : '–'], ['Serie', `${dailyStreak(lang)} Tag(e)`], ['Gespielt', `${played} Tag(e)`]])}</tbody>`;
  $('dailyRoute2').innerHTML = `${esc(d.start)}<span class="arr">→</span>${esc(d.targets[0])}`;
  $('dailyStat2').innerHTML = r ? `Dein Bestwert heute: <b>${kl(r.c)}</b> in ${fmt(r.ms)}. Du kannst es beliebig oft versuchen – gespeichert wird der beste Versuch.` : 'Du hast heute noch nicht gespielt.';
  $('dailyShareBtn').classList.toggle('hidden', !r);
  $('dailyBtn2').textContent = r ? 'Nochmal versuchen' : 'Tageschallenge starten';
  let rows = '<tr><th>Datum</th><th>Start</th><th>Ziel</th><th>Dein Ergebnis</th><th></th></tr>';
  for (let i = 0; i < 30; i++) {
    const k = addDays(key, -i);
    const dr = dailyRoute(k, lang);
    const res = dailyResult(k, lang);
    rows += `<tr class="${i === 0 ? 'me' : ''}"><td class="nowrap">${shortDate(k)}${i === 0 ? ' <span class="small muted">(heute)</span>' : ''}</td><td>${esc(dr.start)}</td><td>${esc(dr.targets[0])}</td>
      <td class="num">${res ? `${res.c} Kl. · ${fmt(res.ms)}${res.onDay ? '' : ' <span class="small muted">(nachgeholt)</span>'}` : '–'}</td><td><button class="cdx-btn" data-daily="${k}">${res ? 'Nochmal' : 'Spielen'}</button></td></tr>`;
  }
  $('archiveTable').innerHTML = rows;
}
$('dailyLang').addEventListener('change', () => { store.set('wr_daily_lang', $('dailyLang').value); renderDailyPage(); renderHome(); });
$('archiveTable').addEventListener('click', (e) => { const k = e.target.dataset && e.target.dataset.daily; if (k) startDaily(k); });
$('dailyBtn').onclick = $('dailyBtn2').onclick = () => startDaily(utcDateKey());
$('dailyShareBtn').onclick = () => {
  const key = utcDateKey(), lang = dailyLang(); const r = dailyResult(key, lang); const d = dailyRoute(key, lang);
  if (!r) return;
  shareOrCopy(location.origin + location.pathname + `?daily=${key}&lang=${lang}`, `Wikirennen Tageschallenge ${shortDate(key)}\n${d.start} → ${d.targets[0]}\n🏁 ${kl(r.c)} · ${fmt(r.ms)}\n${'🟦'.repeat(Math.max(0, r.c - 1))}🟩`);
};

function renderLevels() {
  const best = levelBest();
  const done = LEVELS.filter((_, i) => best[i] != null).length;
  const st = LEVELS.reduce((a, l, i) => a + stars(best[i], l.par), 0);
  $('levelsStat2').innerHTML = `Du hast <b>${done} von ${LEVELS.length}</b> Stufen geschafft und ${st} von ${LEVELS.length * 3} Sternen gesammelt.`;
  $('levelTable').innerHTML = '<tr><th>Nr.</th><th>Start</th><th>Ziel</th><th>Par</th><th>Bestwert</th><th>Sterne</th><th></th></tr>' + LEVELS.map((l, i) => {
    const open = levelUnlocked(i, best);
    return `<tr class="${open ? '' : 'locked'}"><td class="c">${i + 1}</td><td>${open ? esc(l.s) : '<span class="muted">???</span>'}</td><td>${esc(l.t)}</td><td class="num">${l.par}</td>
      <td class="num">${best[i] != null ? best[i] : '–'}</td><td class="c">${starsHtml(stars(best[i], l.par))}</td>
      <td>${open ? `<button class="cdx-btn ${best[i] == null ? 'primary' : ''}" data-level="${i}">${best[i] == null ? 'Spielen' : 'Nochmal'}</button>` : '🔒'}</td></tr>`;
  }).join('');
}
$('levelTable').addEventListener('click', (e) => { const i = e.target.dataset && e.target.dataset.level; if (i != null) startLevel(+i); });

// ---------------------------------------------------------------------------
// EINZELSPIEL starten
// ---------------------------------------------------------------------------
function startSolo(opts, settings = {}, autostart = false, custom = null) {
  if (room) resetToStart();
  ctx = { kind: 'solo', ...opts };
  document.body.classList.add('solo');
  room = new LocalRoom();
  room.onHostMessage = onHostMessage;
  const base = { rounds: 1, time: 0, scoring: 'clicks', max: 1, end: 'all', power: 0 };
  setupHost({ ...base, ...settings });
  if (custom) prefillCustom(custom);
  if (autostart) room.send({ t: 'start', custom });
}
function prefillCustom(c) {
  setTimeout(() => {
    $('customStart').value = c.start || '';
    const inputs = document.querySelectorAll('.custom-target');
    (c.targets || []).forEach((t, i) => { if (inputs[i]) inputs[i].value = t; });
  }, 0);
}
function startDaily(key) {
  const lang = dailyLang();
  startSolo({ type: 'daily', date: key, lang }, { lang, route: 'daily', targets: 1, back: 1, find: 0, limit: 0, ban: 0, confirm: 0, restart: 0 }, false);
  H.dailyDate = key;
  room.send({ t: 'start' });
}
function startLevel(i) {
  const l = LEVELS[i];
  if (!l || !levelUnlocked(i)) { toast('Diese Stufe ist noch gesperrt'); return; }
  startSolo({ type: 'level', level: i }, { lang: 'de', route: 'custom', targets: 1, back: 1, find: 0, limit: 0, ban: 0, confirm: 0, restart: 0 }, true, { start: l.s, targets: [l.t] });
}

$('randomBtn').onclick = () => startSolo({ type: 'random' }, { route: 'mixed' }, true);
$('soloBtn').onclick = () => startSolo({ type: 'free' }, { route: 'custom' });

// Routen-Link (Einzelrennen teilen / Herausforderung)
function routeLink(s, start, targets, result) {
  const r = [s.back, s.find, s.limit, s.ban, s.time, s.scoring === 'time' ? 't' : 'c', s.confirm, s.restart].join('.');
  let q = `?from=${encodeURIComponent(start)}&to=${targets.map(encodeURIComponent).join('|')}&lang=${s.lang}&r=${r}`;
  if (result) q += `&by=${encodeURIComponent(result.by)}&c=${result.c}&ms=${Math.round(result.ms)}`;
  return location.origin + location.pathname + q;
}
function parseRules(r) {
  const p = String(r || '').split('.');
  const n = (i, l, d) => (l.includes(+p[i]) ? +p[i] : d);
  return { back: n(0, [0, 1], 1), find: n(1, [0, 1], 0), limit: n(2, [0, 3, 5, 7, 10, 15], 0), ban: n(3, [0, 1, 2, 3], 0), time: n(4, [0, 1, 2, 3, 5, 7, 10], 0),
    scoring: p[5] === 't' ? 'time' : 'clicks', confirm: n(6, [0, 1], 0), restart: n(7, [0, 1], 0) };
}

// ---------------------------------------------------------------------------
// MEHRSPIELER starten
// ---------------------------------------------------------------------------
function newRoom() {
  if (typeof Peer === 'undefined') { toast('Die Verbindungsbibliothek konnte nicht geladen werden. Ist das Netz blockiert?', 4000); return null; }
  ctx = { kind: 'multi' };
  document.body.classList.remove('solo');
  const r = new Room(GAME_ID);
  r.onHostMessage = onHostMessage;
  r.onHostLost = () => { if (room === r) { toast('Verbindung zum Host verloren', 3500); resetToStart(); } };
  return r;
}

async function busy(btn, fn) {
  if (room && ctx.kind === 'solo') resetToStart();
  if (room) return;
  const label = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px"></span> Verbinde …';
  try { await fn(); } catch (e) { console.warn(e); toast(errText(e), 3800); if (room && !room.peer) room = null; }
  finally { btn.disabled = false; btn.innerHTML = label; }
}
function errText(e) {
  const t = e && e.type;
  if (t === 'network' || t === 'server-error' || t === 'socket-error') return 'Keine Verbindung zum Vermittlungsserver. Ist das Netz blockiert?';
  if (t === 'browser-incompatible') return 'Dein Browser unterstützt kein WebRTC';
  return e && e.message ? e.message : 'Etwas ist schiefgelaufen';
}

async function hostPrivate() {
  room = newRoom(); if (!room) return;
  await room.createPrivate();
  setupHost();
  history.replaceState(null, '', `?code=${room.code}`);
}

async function joinCode(code) {
  code = String(code || '').trim().toUpperCase();
  if (pubSlot && !code) return joinPub(pubSlot);
  if (code.length !== 4) { toast('Der Code hat 4 Buchstaben'); return; }
  room = newRoom(); if (!room) return;
  const ok = await room.joinPrivate(code, readProfile());
  if (!ok) { room.leave(); room = null; toast('Lobby nicht gefunden'); return; }
  history.replaceState(null, '', `?code=${code}`);
}

async function joinPub(n) {
  room = newRoom(); if (!room) return false;
  const ok = await room.joinPublic(n, readProfile());
  if (!ok) { room.leave(); room = null; toast('Diese Lobby gibt es nicht mehr'); return false; }
  history.replaceState(null, '', `?pub=${n}`);
  return true;
}

async function quickPlay() {
  readProfile();
  let list = [];
  try { list = await Room.listPublic(GAME_ID); } catch (e) {}
  const open = list.filter((l) => !l.duel && l.phase === 'lobby' && l.players < l.max).sort((a, b) => b.players - a.players);
  for (const l of open) { if (await joinPub(l.slot)) return; }
  room = newRoom(); if (!room) return;
  await room.createPublic();
  setupHost();
  history.replaceState(null, '', `?pub=${room.code.replace('Ö', '')}`);
  toast('Gerade wartet niemand – neue öffentliche Lobby erstellt. Du kannst auch allein starten.', 4500);
}

async function duelPlay() {
  readProfile();
  let list = [];
  try { list = await Room.listPublic(GAME_ID); } catch (e) {}
  const open = list.filter((l) => l.duel && l.phase === 'lobby' && l.players < 2);
  for (const l of open) { if (await joinPub(l.slot)) return; }
  room = newRoom(); if (!room) return;
  await room.createPublic();
  setupHost({ max: 2, scoring: 'clicks', restart: 1, rounds: 1, route: 'mixed', time: 5, end: 'all', targets: 1, suggest: 0 }, true);
  history.replaceState(null, '', `?pub=${room.code.replace('Ö', '')}`);
  toast('Suche einen Gegner … Das Duell startet automatisch.', 4500);
}

let browsing = false;
async function browse() {
  if (browsing) return;
  browsing = true;
  const box = $('browseList');
  box.innerHTML = '<li class="muted"><span class="spinner" style="width:16px;height:16px;border-width:2px"></span> Suche offene Lobbys …</li>';
  let list = [];
  try { list = await Room.listPublic(GAME_ID); }
  catch (e) { box.innerHTML = `<li class="muted">${esc(errText(e))}</li>`; browsing = false; return; }
  browsing = false;
  if (!list.length) { box.innerHTML = '<li class="muted">Gerade keine offenen Lobbys. Starte doch eine mit „Schnelles Spiel“!</li>'; return; }
  box.innerHTML = list.map((l) => {
    const running = l.phase !== 'lobby';
    const state = running ? `<span class="live-dot"></span>läuft${l.endsIn ? ` – noch ${fmt(l.endsIn)}` : ''}` : 'wartet';
    return `<li><div><b>${l.duel ? 'Duell' : 'Lobby'} von ${esc(l.host)}</b><div class="small muted">${l.players}/${l.max} Spieler · ${l.lang === 'en' ? 'English' : 'Deutsch'} · ${esc(ROUTE_NAMES[l.route] || '')}${l.targets > 1 ? ` · ${l.targets} Ziele` : ''} · ${state}</div></div>
    <button class="cdx-btn progressive" data-slot="${l.slot}" ${l.players >= l.max ? 'disabled' : ''}>${running ? 'Zuschauen' : 'Beitreten'}</button></li>`;
  }).join('');
}
$('browseList').addEventListener('click', (e) => {
  const slot = e.target.dataset && e.target.dataset.slot;
  if (slot) busy(e.target, () => joinPub(+slot));
});

$('quickBtn').onclick = (e) => busy(e.currentTarget, quickPlay);
$('duelBtn').onclick = (e) => busy(e.currentTarget, duelPlay);
$('privateBtn').onclick = (e) => busy(e.currentTarget, hostPrivate);
$('joinForm').addEventListener('submit', (e) => { e.preventDefault(); busy($('joinBtn'), () => joinCode($('codeInput').value)); });
$('hdrJoin').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('hdrCode').value;
  if (room) { toast('Verlass erst deine aktuelle Lobby'); return; }
  busy($('hdrJoin').querySelector('button'), () => joinCode(v));
});
$('browseBtn').onclick = () => browse();

// ---------------------------------------------------------------------------
// Links beim Laden: ?code=ABCD · ?pub=3 · ?from=…&to=… · ?daily=2026-11-06 · ?level=5
// ---------------------------------------------------------------------------
let pubSlot = 0;
const params = new URLSearchParams(location.search);
renderHome();
if (params.get('code')) {
  const c = params.get('code').toUpperCase().slice(0, 4);
  $('codeInput').value = c; $('hdrCode').value = c;
  show('start');
  $('sec-multi').scrollIntoView();
  toast('Gib deinen Namen ein und tippe auf „Beitreten“', 4000);
} else if (params.get('pub')) {
  pubSlot = Math.max(1, Math.min(8, +params.get('pub') || 1));
  $('codeInput').placeholder = `Öffentliche Lobby Ö${pubSlot}`;
  $('joinBtn').textContent = `Lobby Ö${pubSlot} beitreten`;
  $('sec-multi').scrollIntoView();
  toast('Gib deinen Namen ein und tippe auf „Beitreten“', 4000);
} else if (params.get('from') && params.get('to')) {
  const lang = params.get('lang') === 'en' ? 'en' : 'de';
  const targets = params.get('to').split('|').map((t) => normTitle(t).slice(0, 120)).filter(Boolean).slice(0, 5);
  const n = [1, 2, 3, 5].includes(targets.length) ? targets.length : 1;
  const challenge = params.get('by') && params.get('c') ? { by: params.get('by').slice(0, 16), c: Math.max(0, +params.get('c') || 0), ms: Math.max(0, +params.get('ms') || 0) } : null;
  startSolo({ type: 'challenge', challenge }, { lang, route: 'custom', targets: n, ...parseRules(params.get('r')) }, false, { start: normTitle(params.get('from')).slice(0, 120), targets: targets.slice(0, n) });
  if (challenge) {
    $('challengeTxt').innerHTML = `<b>Herausforderung!</b> ${esc(challenge.by)} hat diese Route in <b>${kl(challenge.c)}</b> und ${fmt(challenge.ms)} geschafft. Schaffst du es mit weniger Klicks?`;
    $('challengeMsg').classList.remove('hidden');
  }
} else if (params.get('daily')) {
  const k = /^\d{4}-\d{2}-\d{2}$/.test(params.get('daily')) && params.get('daily') <= utcDateKey() ? params.get('daily') : utcDateKey();
  if (params.get('lang') === 'en' || params.get('lang') === 'de') store.set('wr_daily_lang', params.get('lang'));
  renderDailyPage(); show('daily');
  if (k !== utcDateKey()) toast(`Tageschallenge vom ${shortDate(k)} – unten im Archiv`, 4000);
} else if (params.get('level')) {
  renderLevels(); show('levels');
} else show('start');
scheduleToc();
if (typeof Peer !== 'undefined' && !params.get('from')) setTimeout(browse, 600);

window.addEventListener('beforeunload', (e) => {
  if (room && room.isHost && ctx.kind !== 'solo' && S && S.players.length > 1) { e.preventDefault(); e.returnValue = ''; }
});
