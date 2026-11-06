// Wiki-Wandertag – ein Pausenhof-Spiel – made by Oskar
// Wikipedia-Wettrennen: Host-Browser ist der Spielserver (shared/net.js, PeerJS/WebRTC).
import { Room } from '../../shared/net.js';
import {
  normTitle, sameTitle, articleUrl, fetchArticle, fetchSummary, resolveTitle, randomArticle,
  popularArticle, trendingArticle, searchTitles, verifyHop, forbiddenTitles, loadNamespaces, loadWikiCss,
} from './wiki.js';
import { WikiFrame } from './wikiframe.js';

const GAME_ID = 'wiki-wandertag-v1';
const AVATARS = ['🐸','🦊','🐼','🐵','🐱','🐶','🦄','🐙','🤖','👽','🦖','🐧','🐷','🦁','🐨','🐯','🐮','🦉','🐝','🍕','🌮','👻','🤡','😎','🥸','🧠','🗿','🐢','🥾','🏔️'];
const POINTS = [100, 80, 65, 55, 45, 40, 35, 30, 25, 20];
const SHORT_BONUS = 10;
const MAX_RACE_MIN = 15;
const COUNTDOWN_MS = 7000;
const GRACE_MS = 60000;
const AUTO_NEXT_MS = 25000;
const ROUTE_NAMES = { mixed: 'Zufall → Bekannt', popular: 'Bekannte Themen', random: 'Zufällig', trending: 'Meistgelesen', custom: 'Selbst gewählt' };

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const fmt = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

function toast(msg, ms = 2600) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

// ---------------------------------------------------------------------------
// Profil
// ---------------------------------------------------------------------------
const me = {
  name: localStorage.getItem('ph_name') || '',
  avatar: localStorage.getItem('ph_avatar') || pick(AVATARS),
};
$('nameInput').value = me.name;
$('avatarBtn').textContent = me.avatar;
$('avatarBtn').onclick = () => {
  const i = AVATARS.indexOf(me.avatar);
  me.avatar = AVATARS[(i + 1) % AVATARS.length];
  $('avatarBtn').textContent = me.avatar;
  localStorage.setItem('ph_avatar', me.avatar);
};
function readProfile() {
  let n = $('nameInput').value.trim().slice(0, 16);
  if (!n) n = 'Wanderer' + Math.floor(100 + Math.random() * 900);
  me.name = n; $('nameInput').value = n;
  localStorage.setItem('ph_name', n);
  localStorage.setItem('ph_avatar', me.avatar);
  return { name: me.name, avatar: me.avatar };
}

// ---------------------------------------------------------------------------
// Bildschirme
// ---------------------------------------------------------------------------
const SCREENS = ['start', 'lobby', 'countdown', 'race', 'results'];
let curScreen = 'start';
function show(name) {
  if (curScreen === name) return;
  curScreen = name;
  for (const s of SCREENS) $('scr-' + s).classList.toggle('hidden', s !== name);
  document.body.classList.toggle('racing', name === 'race');
  window.scrollTo({ top: 0 });
  closePanel();
}

function rulesChips(st) {
  const s = st.settings;
  const out = [];
  out.push(s.time ? `⏱ ${s.time} Min` : `⏱ ohne Limit (max. ${MAX_RACE_MIN})`);
  out.push(s.find ? '🔍 Strg+F erlaubt' : '🚫 Kein Strg+F');
  out.push(s.back ? '↩ Zurück kostet 1 Klick' : '⛔ Kein Zurück');
  if (s.limit) out.push(`👣 max. ${s.limit} Klicks`);
  if (s.ban) out.push(`🚷 Verboten: ${forbiddenTitles(s.lang).join(' & ')}`);
  out.push(s.scoring === 'clicks' ? '🏆 Wenigste Klicks gewinnt' : '🏆 Schnellste Zeit gewinnt');
  out.push({ grace: '⏳ 60 s nach dem Ersten ist Schluss', all: '⏳ Bis alle da sind', first: '⚡ Der Erste beendet die Runde' }[s.end]);
  return out.map((x) => `<span>${esc(x)}</span>`).join('');
}

// ===========================================================================
// HOST-LOGIK (läuft nur im Browser des Lobby-Erstellers)
// ===========================================================================
let room = null;
let H = null;

function newHostState() {
  return {
    phase: 'lobby',
    settings: { lang: 'de', route: 'mixed', rounds: 3, time: 5, end: 'grace', scoring: 'time', back: 1, find: 0, limit: 0, ban: 0, max: 10 },
    players: {}, order: [],
    roundNo: 0, R: null, endsAt: 0, prepToken: 0, lastRoute: [],
  };
}

function hostAddPlayer(id, hello) {
  H.players[id] = {
    name: String(hello.name || 'Gast').slice(0, 16),
    avatar: AVATARS.includes(hello.avatar) ? hello.avatar : pick(AVATARS),
    score: 0,
  };
  H.order.push(id);
  if (H.R && (H.phase === 'countdown' || H.phase === 'race')) {
    H.R.p[id] = newRoundPlayer(id, H.phase === 'race' ? 'spectator' : 'racing');
  }
}

function newRoundPlayer(id, status = 'racing') {
  const pl = H.players[id];
  return { name: pl.name, avatar: pl.avatar, clicks: 0, cur: H.R.start, stack: [H.R.start], path: [{ t: H.R.start, ms: 0 }], status, time: 0, pts: 0, short: false };
}

function finishOrder() {
  if (!H.R) return [];
  const sc = H.settings.scoring;
  return Object.entries(H.R.p).filter(([, p]) => p.status === 'done')
    .sort(([, a], [, b]) => (sc === 'clicks' ? (a.clicks - b.clicks) || (a.time - b.time) : (a.time - b.time) || (a.clicks - b.clicks)))
    .map(([id]) => id);
}

function publicState(forId) {
  const st = {
    t: 'state', phase: H.phase, hostId: room.myId, code: room.code, isPublic: room.isPublic,
    settings: H.settings, players: H.order.map((id) => ({ id, ...H.players[id] })),
    roundNo: H.roundNo, endsIn: H.endsAt ? Math.max(0, H.endsAt - Date.now()) : 0,
  };
  const R = H.R;
  if (R && H.phase !== 'lobby' && H.phase !== 'prep') {
    const mine = R.p[forId];
    const reveal = H.phase === 'results' || H.phase === 'final' || !mine || mine.status !== 'racing';
    const order = finishOrder();
    const p = {};
    for (const [id, x] of Object.entries(R.p)) {
      p[id] = { name: x.name, avatar: x.avatar, clicks: x.clicks, cur: x.cur, status: x.status, time: x.time, pts: x.pts, short: x.short,
        place: order.indexOf(id) + 1 || 0, left: !H.players[id] };
      if (reveal || id === forId) p[id].path = x.path;
    }
    st.round = {
      n: R.n, lang: R.lang, start: R.start, target: R.target, startSummary: R.startSummary,
      startedAgo: R.startedAt ? Date.now() - R.startedAt : null, p,
    };
  }
  return st;
}

function sync() {
  if (!room || !room.isHost) return;
  for (const id of H.order) room.sendTo(id, publicState(id));
}
function sysChat(text) { room.broadcast({ t: 'chat', sys: true, text }); }

async function pickTitle(mode, lang, avoid) {
  if (mode === 'random') return randomArticle(lang, avoid);
  if (mode === 'trending') { try { return await trendingArticle(lang, avoid); } catch (e) { return popularArticle(lang, avoid); } }
  return popularArticle(lang, avoid);
}

async function prepRound(custom) {
  const backTo = H.phase;
  const s = H.settings;
  if (s.route === 'custom' && (!custom || !custom.start || !custom.target)) {
    room.sendTo(room.myId, { t: 'err', text: 'Trag erst Start und Ziel ein 🙂' });
    return;
  }
  const token = ++H.prepToken;
  H.phase = 'prep'; H.endsAt = 0; sync();
  const lang = s.lang;
  let start = null, target = null, err = '';
  for (let attempt = 0; attempt < 4 && (!start || !target); attempt++) {
    try {
      let st, tg;
      const avoid = H.lastRoute.slice();
      if (s.route === 'custom') { st = custom.start; tg = custom.target; }
      else if (s.route === 'mixed') { st = await randomArticle(lang, avoid); tg = await popularArticle(lang, [...avoid, st]); }
      else { st = await pickTitle(s.route, lang, avoid); tg = await pickTitle(s.route, lang, [...avoid, st]); }
      const [a, b] = await Promise.all([resolveTitle(lang, st), resolveTitle(lang, tg)]);
      if (!a || !b || a.ns !== 0 || b.ns !== 0) {
        if (s.route === 'custom') { err = `„${!a || a.ns !== 0 ? st : tg}“ gibt es auf Wikipedia (${lang}) nicht als Artikel.`; break; }
        continue;
      }
      if (sameTitle(a.title, b.title)) { if (s.route === 'custom') { err = 'Start und Ziel sind derselbe Artikel 😅'; break; } continue; }
      if (s.ban && forbiddenTitles(lang).some((f) => sameTitle(f, b.title))) { if (s.route === 'custom') { err = 'Das Ziel ist ein verbotener Artikel 🚷'; break; } continue; }
      start = a.title; target = b.title;
    } catch (e) { console.warn(e); err = 'Wikipedia antwortet gerade nicht 😕'; }
  }
  if (token !== H.prepToken || H.phase !== 'prep') return;
  if (!start || !target) {
    H.phase = backTo === 'prep' ? 'lobby' : backTo;
    room.sendTo(room.myId, { t: 'err', text: err || 'Keine Route gefunden – nochmal versuchen?' });
    sync();
    return;
  }
  const [tSum, sSum] = await Promise.all([fetchSummary(lang, target), fetchSummary(lang, start)]);
  if (token !== H.prepToken) return;
  H.lastRoute = [start, target, ...H.lastRoute].slice(0, 20);
  H.roundNo++;
  H.R = {
    n: H.roundNo, lang, start,
    target: { title: target, description: tSum.description, extract: tSum.extract, thumb: tSum.thumb },
    startSummary: { description: sSum.description },
    startedAt: 0, firstAt: 0, p: {},
  };
  for (const id of H.order) H.R.p[id] = newRoundPlayer(id);
  H.phase = 'countdown';
  H.endsAt = Date.now() + COUNTDOWN_MS;
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
  if (!racing.length) { H.endsAt = Math.min(H.endsAt, Date.now() + 1500); return; }
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
  order.forEach((id, i) => {
    const pts = POINTS[i] ?? 10;
    R.p[id].pts = pts;
  });
  if (order.length >= 2) {
    const minClicks = Math.min(...order.map((id) => R.p[id].clicks));
    for (const id of order) if (R.p[id].clicks === minClicks) { R.p[id].short = true; R.p[id].pts += SHORT_BONUS; }
  }
  for (const [id, p] of Object.entries(R.p)) if (H.players[id]) H.players[id].score += p.pts;
  if (H.roundNo >= H.settings.rounds) { H.phase = 'final'; H.endsAt = 0; }
  else { H.phase = 'results'; H.endsAt = H.settings.route === 'custom' ? 0 : Date.now() + AUTO_NEXT_MS; }
  const w = order[0];
  sysChat(w ? `🏆 ${R.p[w].name} gewinnt Runde ${R.n}!` : `Runde ${R.n}: Niemand hat das Ziel erreicht 🥲`);
  sync();
}

function hostTick() {
  if (!H || !H.endsAt || Date.now() < H.endsAt) return;
  H.endsAt = 0;
  if (H.phase === 'countdown') startRace();
  else if (H.phase === 'race') endRound();
  else if (H.phase === 'results') prepRound(null);
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
    if (!H.settings.back) { room.sendTo(from, { t: 'reject', text: 'Zurück ist in dieser Runde verboten ⛔', cur: pr.cur }); return; }
    const prev = pr.stack[pr.stack.length - 2];
    if (!prev || !sameTitle(prev, title)) { room.sendTo(from, { t: 'reject', text: 'Zurück ging nicht', cur: pr.cur }); return; }
    pr.stack.pop();
    pr.cur = prev; pr.clicks++;
    pr.path.push({ t: prev, ms, b: 1 });
  } else {
    if (H.settings.ban && forbiddenTitles(lang).some((f) => sameTitle(f, title))) { room.sendTo(from, { t: 'reject', text: 'Verbotener Artikel 🚷', cur: pr.cur }); return; }
    const fromTitle = pr.cur;
    pr.stack.push(title);
    pr.cur = title; pr.clicks++;
    const entry = { t: title, ms };
    pr.path.push(entry);
    const via = normTitle(msg.via || title);
    // Sprung im Hintergrund bei Wikipedia prüfen (verlinkt fromTitle wirklich auf via?)
    verifyHop(lang, fromTitle, via).then((ok) => {
      if (ok !== false || !H.R || H.R !== R) return;
      entry.x = 1;
      if (sameTitle(title, R.target.title) && pr.status === 'done') {
        pr.status = 'dq';
        sysChat(`⚠ ${pr.name}: Der letzte Sprung war kein echter Link – disqualifiziert.`);
      }
      sync();
    });
  }
  if (sameTitle(pr.cur, R.target.title)) {
    pr.status = 'done';
    pr.time = ms;
    if (!R.firstAt) R.firstAt = Date.now();
    const place = finishOrder().indexOf(from) + 1;
    sysChat(`🏁 ${pr.name} ist im Ziel! ${H.settings.scoring === 'time' ? `Platz ${place} · ` : ''}${pr.clicks} Klicks · ${fmt(ms)}`);
  } else if (H.settings.limit && pr.clicks >= H.settings.limit) {
    pr.status = 'limit';
    sysChat(`👣 ${pr.name} hat das Klick-Limit erreicht.`);
  }
  checkRoundEnd();
  sync();
}

function hostHandle(from, msg) {
  if (!msg || typeof msg !== 'object') return;
  const isHostMsg = from === room.myId;
  switch (msg.t) {
    case 'settings': {
      if (!isHostMsg || !['lobby', 'results'].includes(H.phase)) return;
      const s = H.settings;
      const inList = (v, l, d) => (l.includes(v) ? v : d);
      Object.assign(s, {
        lang: inList(msg.lang, ['de', 'en'], s.lang),
        route: inList(msg.route, Object.keys(ROUTE_NAMES), s.route),
        rounds: Math.max(1, Math.min(10, +msg.rounds || s.rounds)),
        time: [0, 2, 3, 5, 8, 10].includes(+msg.time) ? +msg.time : s.time,
        end: inList(msg.end, ['grace', 'all', 'first'], s.end),
        scoring: inList(msg.scoring, ['time', 'clicks'], s.scoring),
        back: +msg.back ? 1 : 0, find: +msg.find ? 1 : 0, ban: +msg.ban ? 1 : 0,
        limit: [0, 5, 8, 10, 15].includes(+msg.limit) ? +msg.limit : 0,
        max: Math.max(2, Math.min(30, +msg.max || s.max)),
      });
      if (H.phase === 'results' && s.route === 'custom') H.endsAt = 0;
      if (H.phase === 'results' && s.route !== 'custom' && !H.endsAt) H.endsAt = Date.now() + AUTO_NEXT_MS;
      sync();
      break;
    }
    case 'start':
      if (!isHostMsg || H.phase !== 'lobby') return;
      H.roundNo = 0; H.R = null;
      for (const id of H.order) H.players[id].score = 0;
      sysChat('Los geht’s – der Wandertag beginnt! 🥾');
      prepRound(msg.custom);
      break;
    case 'next':
      if (!isHostMsg || H.phase !== 'results') return;
      prepRound(msg.custom);
      break;
    case 'again':
      if (!isHostMsg || H.phase !== 'final') return;
      H.phase = 'lobby'; H.roundNo = 0; H.endsAt = 0; H.R = null;
      for (const id of H.order) H.players[id].score = 0;
      sync();
      break;
    case 'move':
      hostMove(from, msg);
      break;
    case 'giveup': {
      const pr = H.R && H.R.p[from];
      if (H.phase !== 'race' || !pr || pr.status !== 'racing') return;
      pr.status = 'gaveup';
      sysChat(`🏳 ${pr.name} hat aufgegeben.`);
      checkRoundEnd();
      sync();
      break;
    }
    case 'chat': {
      const p = H.players[from];
      const text = String(msg.text || '').trim().slice(0, 120);
      if (p && text) room.broadcast({ t: 'chat', name: p.name, avatar: p.avatar, text });
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
  H.order = H.order.filter((x) => x !== id);
  if (H.R && H.R.p[id]) {
    const pr = H.R.p[id];
    if (pr.status === 'racing' || pr.status === 'spectator') pr.status = 'gaveup';
    pr.gone = true;
  }
  sysChat(`${name} hat die Lobby verlassen`);
  checkRoundEnd();
  sync();
}

function setupHost() {
  H = newHostState();
  room.getInfo = () => ({
    phase: H.phase, players: H.order.length, max: H.settings.max, lang: H.settings.lang, route: H.settings.route,
    host: H.players[room.myId] ? H.players[room.myId].name : '?',
  });
  room.onClientJoin = (id, hello) => {
    if (H.order.length >= H.settings.max) {
      room.sendTo(id, { t: 'full' });
      setTimeout(() => room.kick(id), 300);
      return;
    }
    hostAddPlayer(id, hello);
    sysChat(`${H.players[id].avatar} ${H.players[id].name} ist beigetreten`);
    sync();
  };
  room.onClientLeave = (id) => hostRemove(id);
  room.onClientMessage = (from, msg) => hostHandle(from, msg);
  hostAddPlayer(room.myId, readProfile());
  setInterval(hostTick, 250);
  sync();
}

// ===========================================================================
// CLIENT-LOGIK (läuft bei allen, auch beim Host)
// ===========================================================================
let S = null;             // letzter Zustand vom Host
let localDeadline = 0;
let localStart = 0;
let lastPhase = null;
const L = { round: -1, stack: [], visits: [], cur: null, token: 0, clicks: 0, loadedFor: null, spec: null, celebrated: false, warnedGrace: false };

const frame = new WikiFrame($('wikiHost'), {
  onNavigate: (title, anchor) => navigate(title, anchor),
  onBlocked: (kind) => {
    const msg = {
      red: 'Diesen Artikel gibt es noch nicht – roter Link 🔴',
      file: 'Bilder und Dateien sind keine Wanderwege 📷',
      ns: 'Nur echte Artikel zählen – keine Kategorien, Hilfe- oder Spezialseiten 🚧',
      external: 'Externe Links sind beim Wandertag gesperrt 🌐',
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
    if (msg.round && msg.round.startedAgo != null) localStart = Date.now() - msg.round.startedAgo;
    render();
  } else if (msg.t === 'chat') addChat(msg);
  else if (msg.t === 'err') toast(msg.text, 3800);
  else if (msg.t === 'reject') { toast(msg.text, 3000); if (msg.cur) resyncTo(msg.cur); }
  else if (msg.t === 'full') { toast('Die Lobby ist voll 😕'); resetToStart(); }
  else if (msg.t === 'kicked') { toast('Du wurdest aus der Lobby entfernt'); resetToStart(); }
}

function resetToStart() {
  const r = room;
  room = null; S = null;
  if (r) r.leave(); H = null; lastPhase = null;
  L.round = -1;
  document.querySelectorAll('.chat-log').forEach((l) => { l.innerHTML = ''; });
  history.replaceState(null, '', location.pathname);
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
}

// ---------------------------------------------------------------------------
// LOBBY + EINSTELLUNGEN
// ---------------------------------------------------------------------------
const SET_IDS = { setLang: 'lang', setRoute: 'route', setRounds: 'rounds', setTime: 'time', setEnd: 'end', setScoring: 'scoring', setBack: 'back', setFind: 'find', setLimit: 'limit', setBan: 'ban', setMax: 'max' };

function placeRouteBox() {
  const box = $('routeBox');
  const target = S.phase === 'results' && isHost() ? $('routeSlotResults') : $('routeSlotLobby');
  if (box.parentElement !== target) target.appendChild(box);
}

function applySettingsToForm() {
  const host = isHost();
  for (const [id, key] of Object.entries(SET_IDS)) {
    const el = $(id);
    el.disabled = !host;
    if (document.activeElement !== el) el.value = String(S.settings[key]);
  }
  const custom = S.settings.route === 'custom';
  $('customBox').classList.toggle('hidden', !(custom && host));
  $('customHidden').classList.toggle('hidden', !(custom && !host));
}

function renderLobby() {
  $('lobbyCode').textContent = S.code;
  $('playerCount').textContent = `(${S.players.length}/${S.settings.max})`;
  $('playerList').innerHTML = S.players.map((p) => `
    <div class="player ${p.id === room.myId ? 'me' : ''}">
      ${p.id === S.hostId ? '<span class="crown">👑</span>' : ''}
      <span class="avatar">${esc(p.avatar)}</span><span class="nm">${esc(p.name)}</span>
      ${isHost() && p.id !== S.hostId ? `<button class="kick" data-kick="${esc(p.id)}" title="Entfernen">✕</button>` : ''}
    </div>`).join('');
  applySettingsToForm();
  const host = isHost();
  $('startBtn').classList.toggle('hidden', !host);
  $('waitHost').classList.toggle('hidden', host);
  $('startBtn').textContent = S.players.length < 2 ? '▶ Allein üben (oder auf Freunde warten)' : '▶ Wandertag starten';
  // Wikipedia-Daten schon mal vorladen
  loadNamespaces(S.settings.lang); loadWikiCss(S.settings.lang);
}
$('playerList').addEventListener('click', (e) => {
  const id = e.target.dataset && e.target.dataset.kick;
  if (id) room.send({ t: 'kick', id });
});
function sendSettings() {
  const msg = { t: 'settings' };
  for (const [id, key] of Object.entries(SET_IDS)) msg[key] = $(id).value;
  room.send(msg);
}
for (const id of Object.keys(SET_IDS)) $(id).addEventListener('change', () => room && sendSettings());
function customRoute() { return { start: $('customStart').value.trim(), target: $('customTarget').value.trim() }; }
$('startBtn').onclick = () => room.send({ t: 'start', custom: customRoute() });
$('nextBtn').onclick = () => room.send({ t: 'next', custom: customRoute() });
$('againBtn').onclick = () => room.send({ t: 'again' });
$('leaveBtn').onclick = () => resetToStart();
$('copyLinkBtn').onclick = async () => {
  const q = S.isPublic ? `?pub=${S.code.replace('Ö', '')}` : `?code=${S.code}`;
  const url = location.origin + location.pathname + q;
  try { await navigator.clipboard.writeText(url); toast('Link kopiert!'); }
  catch (e) { prompt('Link zum Teilen:', url); }
};

// Autovervollständigung + Würfel für „Selbst wählen“
for (const wrap of document.querySelectorAll('.ac')) {
  const input = wrap.querySelector('input');
  const list = wrap.querySelector('.ac-list');
  let t = null, seq = 0;
  const close = () => list.classList.add('hidden');
  input.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(async () => {
      const my = ++seq;
      let res = [];
      try { res = await searchTitles(S ? S.settings.lang : 'de', input.value); } catch (e) {}
      if (my !== seq || document.activeElement !== input) return;
      list.innerHTML = res.map((r) => `<div data-v="${esc(r)}">${esc(r)}</div>`).join('');
      list.classList.toggle('hidden', !res.length);
    }, 220);
  });
  list.addEventListener('pointerdown', (e) => {
    const d = e.target.closest('[data-v]');
    if (d) { e.preventDefault(); input.value = d.dataset.v; close(); }
  });
  input.addEventListener('blur', () => setTimeout(close, 150));
  wrap.querySelector('.dice').addEventListener('click', async (e) => {
    const b = e.currentTarget; b.disabled = true; b.textContent = '⏳';
    const lang = S ? S.settings.lang : 'de';
    try { input.value = input.id === 'customTarget' ? await popularArticle(lang, [$('customStart').value]) : await randomArticle(lang); }
    catch (err) { toast('Wikipedia antwortet gerade nicht 😕'); }
    b.disabled = false; b.textContent = '🎲';
  });
}

// ---------------------------------------------------------------------------
// CHAT (gibt es in Lobby, im Rennen und bei den Ergebnissen)
// ---------------------------------------------------------------------------
function addChat(m) {
  for (const log of document.querySelectorAll('.chat-log')) {
    const d = document.createElement('div');
    if (m.sys) { d.className = 'sys'; d.textContent = m.text; }
    else d.innerHTML = `${esc(m.avatar)} <b>${esc(m.name)}:</b> ${esc(m.text)}`;
    log.appendChild(d);
    while (log.children.length > 80) log.firstChild.remove();
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
function summaryHtml(t) {
  if (!t) return '';
  return `${t.thumb ? `<img src="${esc(t.thumb)}" alt="">` : ''}<div><h4>${esc(t.title)}</h4>${t.description ? `<div class="desc">${esc(t.description)}</div>` : ''}<p>${esc(t.extract || '')}</p></div>`;
}

function renderCountdown() {
  const prep = S.phase === 'prep';
  $('prepBox').classList.toggle('hidden', !prep);
  $('cdBox').classList.toggle('hidden', prep);
  if (prep || !S.round) return;
  const R = S.round;
  $('cdRound').textContent = `Runde ${R.n}/${S.settings.rounds}`;
  $('cdStart').textContent = R.start;
  $('cdTarget').textContent = R.target.title;
  $('cdSummary').innerHTML = summaryHtml(R.target);
  $('cdRules').innerHTML = rulesChips(S);
  // Startartikel schon vorladen
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
  window.scrollTo({ top: Math.max(0, top) });
}

async function startLocalRace() {
  const R = S.round;
  L.round = R.n; L.stack = [R.start]; L.visits = [{ t: R.start }]; L.cur = R.start; L.clicks = 0;
  L.spec = null; L.celebrated = false; L.warnedGrace = false; L.token++;
  $('targetName').textContent = R.target.title;
  $('modalSummary').innerHTML = summaryHtml(R.target);
  $('modalRules').innerHTML = rulesChips(S);
  $('ruleLine').innerHTML = rulesChips(S);
  frame.setLoading(true, 'Lade Start…');
  try { await showArticle(R.start); }
  catch (e) { frame.showMessage(R.start, '<p>Der Startartikel konnte nicht geladen werden. Prüfe deine Internetverbindung.</p>'); }
  frame.setLoading(false);
  scrollToFrame();
}

async function navigate(title, anchor) {
  if (!S || S.phase !== 'race') return;
  const mine = myRound();
  if (!mine || mine.status !== 'racing') {
    toast(mine && mine.status === 'spectator' ? 'Du schaust diese Runde nur zu 👀' : 'Du bist schon fertig – nur noch zuschauen 👀');
    return;
  }
  const s = S.settings;
  const lang = S.round.lang;
  if (sameTitle(title, L.cur)) { if (anchor) frame.scrollToAnchor(anchor); return; }
  if (s.ban && forbiddenTitles(lang).some((f) => sameTitle(f, title))) { toast('🚷 Dieser Artikel ist in dieser Runde verboten!'); return; }
  const token = ++L.token;
  frame.setLoading(true);
  let art;
  try { art = await fetchArticle(lang, title); }
  catch (e) {
    if (token === L.token) { frame.setLoading(false); toast(e.code === 'missingtitle' ? 'Diesen Artikel gibt es nicht' : 'Artikel konnte nicht geladen werden 😕'); }
    return;
  }
  if (token !== L.token || !S || S.phase !== 'race' || myRound().status !== 'racing') { if (token === L.token) frame.setLoading(false); return; }
  if (s.ban && forbiddenTitles(lang).some((f) => sameTitle(f, art.title))) { frame.setLoading(false); toast('🚷 Das leitet auf einen verbotenen Artikel weiter!'); return; }
  const from = L.cur;
  L.stack.push(art.title); L.visits.push({ t: art.title }); L.cur = art.title; L.clicks++;
  frame.show(art, { anchor, lang });
  frame.setLoading(false);
  if (!anchor) scrollToFrame();
  room.send({ t: 'move', title: art.title, via: title, from });
  if (sameTitle(art.title, S.round.target.title)) celebrate();
  renderRace(false);
}

async function goBack() {
  if (!S || S.phase !== 'race' || !S.settings.back) return;
  const mine = myRound();
  if (!mine || mine.status !== 'racing' || L.stack.length < 2) return;
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
  } catch (e) { toast('Zurück ging gerade nicht 😕'); }
  if (token === L.token) frame.setLoading(false);
  renderRace(false);
}

async function resyncTo(cur) {
  // Host lehnt einen Zug ab → zurück auf den Artikel, den der Host kennt
  if (!S || S.phase !== 'race') return;
  const mine = myRound();
  if (mine && mine.path) {
    L.stack = []; for (const v of mine.path) { if (v.b) L.stack.pop(); else L.stack.push(v.t); }
    L.visits = mine.path.map((v) => ({ t: v.t, b: v.b }));
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

function statusText(p) {
  switch (p.status) {
    case 'done': return `🏁 im Ziel${p.place ? ` · Platz ${p.place}` : ''} · ${fmt(p.time)}`;
    case 'gaveup': return p.left ? '👋 hat die Lobby verlassen' : '🏳 aufgegeben';
    case 'limit': return '👣 Klick-Limit erreicht';
    case 'dq': return '⚠ disqualifiziert';
    case 'timeout': return '⏱ nicht angekommen';
    case 'spectator': return '👀 schaut zu';
    default: return `📍 ${p.cur}`;
  }
}

function renderRace(phaseChanged) {
  const R = S.round;
  if (!R) return;
  if (L.round !== R.n) startLocalRace();
  const mine = myRound();
  const myStatus = mine ? mine.status : 'spectator';
  const racing = myStatus === 'racing';
  const clicks = racing ? Math.max(L.clicks, mine.clicks) : (mine ? mine.clicks : 0);
  $('raceRound').textContent = `R${R.n}/${S.settings.rounds}`;
  $('raceClicks').textContent = clicks;
  $('raceLimit').textContent = S.settings.limit ? `/${S.settings.limit}` : '';
  $('backBtn').classList.toggle('hidden', !S.settings.back);
  $('backBtn').disabled = !racing || L.stack.length < 2;
  $('giveupBtn').disabled = !racing;
  frame.setLocked(!racing);

  // Pfad oben
  const visits = racing || !mine || !mine.path ? L.visits : mine.path;
  $('pathBar').innerHTML = visits.map((v, i) =>
    `${i ? '<span class="ar">›</span>' : ''}<span class="st ${i === visits.length - 1 ? 'cur' : ''} ${v.b ? 'back' : ''}">${v.b ? '↩ ' : ''}${esc(v.t)}</span>`).join('');
  $('pathBar').scrollLeft = $('pathBar').scrollWidth;

  // Fertig-Banner
  const banner = $('doneBanner');
  if (!racing && mine) {
    banner.classList.remove('hidden');
    const head = { done: `🎉 Geschafft! ${mine.place ? `Platz ${mine.place}` : ''}`, gaveup: '🏳 Aufgegeben', limit: '👣 Klick-Limit erreicht', dq: '⚠ Disqualifiziert', spectator: '👀 Du schaust zu', timeout: '⏱ Zeit um' }[myStatus] || '';
    banner.innerHTML = `<div><b>${esc(head)}</b><div>${myStatus === 'done' ? `${mine.clicks} Klicks · ${fmt(mine.time)}` : ''} Tipp auf einen Mitspieler, um seinen Weg live zu sehen.</div></div><button class="btn small" id="openPanelBtn">👥 Zuschauen</button>`;
    $('openPanelBtn').onclick = openPanel;
    if (myStatus === 'done') celebrate();
    if (L.bannerRound !== R.n) { L.bannerRound = R.n; window.scrollTo({ top: 0, behavior: 'smooth' }); }
  } else banner.classList.add('hidden');

  // Live-Liste
  const entries = Object.entries(R.p).sort(([, a], [, b]) => {
    const rank = (p) => (p.status === 'done' ? 0 : p.status === 'racing' ? 1 : 2);
    return rank(a) - rank(b) || (a.place || 99) - (b.place || 99) || b.clicks - a.clicks;
  });
  const canSpec = !racing;
  $('liveCount').textContent = `${entries.filter(([, p]) => p.status === 'done').length}/${entries.filter(([, p]) => p.status !== 'spectator').length}`;
  $('liveList').innerHTML = entries.map(([id, p]) => `
    <div class="live ${id === room.myId ? 'me' : ''} ${p.status === 'done' ? 'done' : ''} ${['gaveup', 'limit', 'dq', 'timeout'].includes(p.status) ? 'out' : ''} ${canSpec ? 'can' : ''} ${L.spec === id ? 'sel' : ''}" data-id="${esc(id)}">
      <span class="avatar sm">${esc(p.avatar)}</span><span class="nm">${esc(p.name)}${id === S.hostId ? ' 👑' : ''}</span><span class="cl">👣 ${p.clicks}</span>
      <span class="where">${esc(statusText(p))}</span>
    </div>`).join('');
  renderSpec();

  if (phaseChanged) closePanel();
}

function renderSpec() {
  const R = S.round;
  const p = L.spec && R.p[L.spec];
  $('specBox').classList.toggle('hidden', !p || !p.path);
  if (!p || !p.path) return;
  $('specName').textContent = p.name;
  $('specPath').innerHTML = p.path.map((v) => `<li class="${v.b ? 'b' : ''} ${v.x ? 'x' : ''}">${v.b ? '↩ ' : ''}${esc(v.t)}</li>`).join('');
}

$('liveList').addEventListener('click', (e) => {
  const row = e.target.closest('.live');
  if (!row || !row.classList.contains('can')) {
    if (row) toast('Wege der anderen siehst du, wenn du fertig bist 🙈');
    return;
  }
  L.spec = row.dataset.id;
  renderRace(false);
});
$('backBtn').onclick = () => goBack();
$('giveupBtn').onclick = () => {
  if (confirm('Wirklich aufgeben? Du bekommst in dieser Runde keine Punkte.')) room.send({ t: 'giveup' });
};
$('targetChip').onclick = () => $('targetModal').classList.remove('hidden');
$('targetModal').addEventListener('click', (e) => {
  if (e.target === $('targetModal') || e.target.closest('[data-close]')) $('targetModal').classList.add('hidden');
});
function openPanel() { $('sidePanel').classList.add('open'); $('panelBackdrop').classList.add('open'); }
function closePanel() { $('sidePanel').classList.remove('open'); $('panelBackdrop').classList.remove('open'); }
$('playersBtn').onclick = () => ($('sidePanel').classList.contains('open') ? closePanel() : openPanel());
$('panelClose').onclick = closePanel;
$('panelBackdrop').onclick = closePanel;

// Strg+F / Cmd+F / F3 sperren
document.addEventListener('keydown', (e) => {
  if (!S || S.phase !== 'race' || S.settings.find) return;
  const k = (e.key || '').toLowerCase();
  if (((e.ctrlKey || e.metaKey) && (k === 'f' || k === 'g')) || k === 'f3') {
    e.preventDefault(); e.stopPropagation();
    toast('🚫 Strg+F ist beim Wandertag verboten – nur lesen und klicken!');
  }
}, true);

// HUD-Höhe für klebende Elemente
function updateHudVar() {
  const h = $('hud').offsetHeight || 100;
  document.documentElement.style.setProperty('--hud-h', h + 10 + 'px');
  $('wikiHost').style.setProperty('--wwt-top', h + 10 + 'px');
}
new ResizeObserver(updateHudVar).observe($('hud'));

// ---------------------------------------------------------------------------
// ERGEBNISSE
// ---------------------------------------------------------------------------
function renderResults() {
  const final = S.phase === 'final';
  const R = S.round;
  $('resultsTitle').textContent = final ? '🏆 Siegerehrung' : `Ergebnis Runde ${R ? R.n : ''}`;
  $('resultsRoute').innerHTML = R ? `${esc(R.start)} <span class="muted">➜</span> 🎯 ${esc(R.target.title)}` : '';
  const sorted = S.players.slice().sort((a, b) => b.score - a.score);
  $('podium').classList.toggle('hidden', !final);
  if (final) {
    const order = [[sorted[1], 's', '2'], [sorted[0], 'g', '1'], [sorted[2], 'b', '3']];
    $('podium').innerHTML = order.filter((o) => o[0]).map(([p, c, n]) => `
      <div class="pod ${c}"><div class="av">${esc(p.avatar)}</div><div class="who">${esc(p.name)}</div><div class="bar">${n}</div><div class="muted">${p.score} P</div></div>`).join('');
  }
  if (R) {
    const rows = Object.entries(R.p).filter(([, p]) => p.status !== 'spectator')
      .sort(([, a], [, b]) => (a.place || 999) - (b.place || 999) || a.clicks - b.clicks);
    const lang = R.lang;
    $('roundList').innerHTML = rows.length ? rows.map(([id, p]) => {
      const path = (p.path || []).map((v, i, arr) => {
        const goal = p.status === 'done' && i === arr.length - 1;
        return `${i ? '<span class="ar">→</span>' : ''}<a href="${esc(articleUrl(lang, v.t))}" target="_blank" rel="noopener" class="${goal ? 'goal' : ''} ${v.b ? 'b' : ''} ${v.x ? 'x' : ''}" title="${v.x ? 'Kein echter Link gefunden' : 'Auf Wikipedia öffnen'}">${v.b ? '↩ ' : ''}${esc(v.t)}</a>`;
      }).join('');
      const stat = p.status === 'done' ? `${p.clicks} Klicks · ${fmt(p.time)}${p.short ? ' · ⭐ kürzester Weg' : ''}` : `${statusText(p)} · ${p.clicks} Klicks`;
      return `<div class="rr ${p.place === 1 ? 'win' : ''}">
        <div class="rr-top"><span class="pos">${p.place ? (p.place === 1 ? '🥇' : p.place === 2 ? '🥈' : p.place === 3 ? '🥉' : p.place + '.') : '–'}</span>
          <span class="avatar sm">${esc(p.avatar)}</span><span class="nm">${esc(p.name)}${id === room.myId ? ' (du)' : ''}</span>
          <span class="stat">${esc(stat)}</span><span class="pts">${p.pts ? '+' + p.pts : ''}</span></div>
        <div class="rr-path">${path}</div></div>`;
    }).join('') : '<p class="muted">Keine Ergebnisse.</p>';
  }
  $('scoreList').innerHTML = sorted.map((p, i) => {
    const g = R && R.p[p.id] ? R.p[p.id].pts : 0;
    return `<div class="score-row"><span class="pos">${i + 1}.</span><span class="avatar sm">${esc(p.avatar)}</span><span>${esc(p.name)}</span>
      <span class="pts">${p.score}${g && !final ? `<span class="plus">+${g}</span>` : ''}</span></div>`;
  }).join('');
  const host = isHost();
  $('nextBox').classList.toggle('hidden', !(host && !final));
  if (host && !final) applySettingsToForm();
  $('againBtn').classList.toggle('hidden', !(final && host));
  updateNextNote();
}

function updateNextNote() {
  if (!S) return;
  const final = S.phase === 'final';
  let t = '';
  if (final) t = isHost() ? '' : 'Der Host kann einen neuen Wandertag starten.';
  else if (localDeadline) t = `Nächste Runde startet automatisch in ${Math.max(0, Math.ceil((localDeadline - Date.now()) / 1000))} s…`;
  else t = isHost() ? 'Wähle die nächste Route und starte, wenn alle bereit sind.' : 'Warte auf den Host…';
  $('nextNote').textContent = t;
}

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
      const el = $('cdNum'); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    }
  } else if (S.phase === 'race') {
    $('raceTimer').textContent = fmt(left);
    $('raceTimer').classList.toggle('low', left < 30000);
    const R = S.round;
    const anyDone = R && Object.values(R.p).some((p) => p.status === 'done');
    if (anyDone && S.settings.end === 'grace' && !L.warnedGrace && myRound() && myRound().status === 'racing') {
      L.warnedGrace = true;
      toast(`⏳ Jemand ist im Ziel – noch ${Math.ceil(left / 1000)} Sekunden!`, 3500);
    }
  } else if (S.phase === 'results') updateNextNote();
}, 250);

// ---------------------------------------------------------------------------
// START-BUTTONS
// ---------------------------------------------------------------------------
function newRoom() {
  if (typeof Peer === 'undefined') { toast('Verbindungsbibliothek konnte nicht geladen werden. Ist das Netz blockiert?', 4000); return null; }
  const r = new Room(GAME_ID);
  r.onHostMessage = onHostMessage;
  r.onHostLost = () => { if (room === r) { toast('Verbindung zum Host verloren 😢', 3500); resetToStart(); } };
  return r;
}

async function busy(btn, fn) {
  const label = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = '⏳ Verbinde…';
  try { await fn(); } catch (e) { console.error(e); toast(errText(e), 3800); if (room && !room.peer) room = null; }
  finally { btn.disabled = false; btn.innerHTML = label; }
}
function errText(e) {
  const t = e && e.type;
  if (t === 'network' || t === 'server-error' || t === 'socket-error') return 'Keine Verbindung zum Vermittlungsserver. Ist das Netz blockiert?';
  if (t === 'browser-incompatible') return 'Dein Browser unterstützt kein WebRTC 😕';
  return e && e.message ? e.message : 'Etwas ist schiefgelaufen';
}

async function hostPrivate() {
  room = newRoom(); if (!room) return;
  await room.createPrivate();
  setupHost();
  history.replaceState(null, '', `?code=${room.code}`);
}

async function joinCode(code) {
  code = code.trim().toUpperCase();
  if (code.length !== 4) { toast('Der Code hat 4 Buchstaben'); return; }
  room = newRoom(); if (!room) return;
  const ok = await room.joinPrivate(code, readProfile());
  if (!ok) { room.leave(); room = null; toast('Lobby nicht gefunden 🤔'); return; }
  history.replaceState(null, '', `?code=${code}`);
}

async function joinPub(n) {
  room = newRoom(); if (!room) return false;
  const ok = await room.joinPublic(n, readProfile());
  if (!ok) { room.leave(); room = null; toast('Lobby nicht mehr da 🤔'); return false; }
  return true;
}

async function quickPlay() {
  readProfile();
  let list = [];
  try { list = await Room.listPublic(GAME_ID); } catch (e) {}
  const open = list.filter((l) => l.phase === 'lobby' && l.players < l.max).sort((a, b) => b.players - a.players);
  for (const l of open) { if (await joinPub(l.slot)) return; }
  room = newRoom(); if (!room) return;
  await room.createPublic();
  setupHost();
  toast('Neue öffentliche Lobby erstellt – warte auf Mitspieler!');
}

async function browse() {
  const box = $('browseList');
  box.classList.remove('hidden');
  box.innerHTML = '<p class="muted">Suche offene Lobbys…</p>';
  let list = [];
  try { list = await Room.listPublic(GAME_ID); } catch (e) { box.innerHTML = `<p class="muted">${esc(errText(e))}</p>`; return; }
  if (!list.length) { box.innerHTML = '<p class="muted">Gerade keine offenen Lobbys. Starte doch eine mit „Schnelles Spiel“!</p>'; return; }
  box.innerHTML = list.map((l) => `
    <div class="browse-item"><div><b>Lobby von ${esc(l.host)}</b><div class="muted">${l.players}/${l.max} · ${l.lang === 'en' ? '🇬🇧' : '🇩🇪'} · ${esc(ROUTE_NAMES[l.route] || '')} · ${l.phase === 'lobby' ? 'wartet' : 'läuft'}</div></div>
    <button class="btn small mint" data-slot="${l.slot}" ${l.players >= l.max ? 'disabled' : ''}>Rein</button></div>`).join('');
}
$('browseList').addEventListener('click', (e) => {
  const slot = e.target.dataset && e.target.dataset.slot;
  if (slot) busy(e.target, () => joinPub(+slot));
});

$('quickBtn').onclick = (e) => busy(e.currentTarget, quickPlay);
$('privateBtn').onclick = (e) => busy(e.currentTarget, hostPrivate);
$('joinBtn').onclick = (e) => busy(e.currentTarget, () => joinCode($('codeInput').value));
$('codeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('joinBtn').click(); });
$('browseBtn').onclick = () => browse();

// Einladungslink: ?code=ABCD oder ?pub=3
const params = new URLSearchParams(location.search);
if (params.get('code')) {
  $('codeInput').value = params.get('code').toUpperCase();
  toast('Gib deinen Namen ein und tippe auf „Beitreten“');
} else if (params.get('pub')) {
  const n = +params.get('pub');
  $('codeInput').placeholder = `Ö${n}`;
  $('joinBtn').onclick = (e) => busy(e.currentTarget, () => joinPub(n));
}

window.addEventListener('beforeunload', (e) => {
  if (room && room.isHost && S && S.players.length > 1) { e.preventDefault(); e.returnValue = ''; }
});
