// Mach's Meme – ein Spiel in der Zockbox – made by Oskar
// Multiplayer über ../../shared/net.js (PeerJS/WebRTC). Der Browser, der die Lobby erstellt, ist der Host.
import { Room } from '../../shared/net.js';
import { PACKS, buildPool } from './templates.js';
import { LAYOUTS } from './layouts.js';
import { renderMeme, redrawMeme, memeToPngBlob, memeToGifBlob, saveBlob, captionFontReady } from './memerender.js';
import { sfx } from './sound.js';

const GAME_ID = 'machs-meme-v1'; // nicht ändern – die Zockbox-Startseite sucht Lobbys unter dieser ID
const AVATARS = ['🐸','🦊','🐼','🐵','🐱','🐶','🦄','🐙','🤖','👽','🦖','🐧','🐷','🦁','🐨','🐯','🐮','🦉','🐝','🍕','🌮','👻','🤡','😎','🥸','🧠','🗿','🐢'];
const AV_COLORS = ['#ffb3dc', '#a8e6ff', '#c3f7a0', '#ffe28a', '#d6c2ff', '#ffc9a3', '#9ff5e1', '#ffaaa8'];
const NAME_A = ['Salty', 'Short', 'Large', 'Sus', 'Old', 'Right', 'Next', 'Red', 'Big', 'Small', 'Fame', 'Dank', 'Lazy', 'Cringe', 'Based', 'Turbo', 'Mini', 'Mega', 'Wild', 'Chill'];
const NAME_B = ['Memes', 'Batman', 'Pepe', 'Obama', 'Mood', 'Banana', 'Science', 'Zoomer', 'Grill', 'King', 'Shrek', 'Doge', 'Cheems', 'Toast', 'Taco', 'Kebab', 'Noob', 'Lord', 'Penguin', 'Brezel'];
const TOPICS = [
  'Montagmorgen', 'Mathe-Test', 'Hausaufgaben vergessen', 'WLAN ist weg', 'Wenn der Wecker klingelt', 'Mama ruft zum Essen',
  'Handy-Akku 1 %', 'Ferien sind vorbei', 'Game-Update lädt ewig', 'Kopfhörer vergessen', 'Gruppenchat um 3 Uhr nachts',
  'Geschwister', 'Fußball', 'Wenn das Essen kalt ist', 'Erster Tag im neuen Jahr', 'Das kommt im Test dran',
  'Pizza oder Döner?', 'Lag im entscheidenden Moment', 'Wenn die Lehrkraft krank ist', 'Spoiler bekommen', 'Geburtstag',
  'Freitagabend', 'Sportunterricht', 'Busfahrt', 'Online-Shopping', 'Wenn die Eltern dein Zimmer sehen', 'Katzen',
  'Elternabend', 'Schnee-Frei', 'Zeugnistag', 'Montag schon wieder', 'Der letzte Keks', 'Passwort vergessen',
];
const MOTIVATION = ['Schreib was Lustiges. Jetzt.', 'Die Uhr tickt …', 'Mach es lustig, nicht perfekt!', 'Du schaffst das. Vielleicht.', 'Zeig, was du drauf hast!', 'Kein Druck. Okay, ein bisschen.'];
const MODES = [
  { id: 'normal', ico: '🎲', name: 'Normal', desc: 'Jeder Spieler bekommt ein zufälliges Meme' },
  { id: 'topics', ico: '💡', name: 'Themen', desc: 'Erstelle Memes zu einem vorgegebenen Thema' },
  { id: 'same', ico: '👯', name: 'Gleiches Meme', desc: 'Alle Spieler erhalten das gleiche Meme' },
  { id: 'relaxed', ico: '😌', name: 'Entspannt', desc: 'Keine Punkte, kein Stress. Einfach nur Memes bauen' },
];
const TIMES = [[30, 'Wahnsinn'], [60, 'Schwer'], [90, 'Normal'], [120, 'Locker'], [180, 'Gemütlich'], [300, 'Ewigkeit']];
const REROLL_OPTS = [0, 1, 2, 3, 5, 8, 10, 15, 20];
const MAX_OPTS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 15, 16, 18, 20, 25, 30];
const TOGGLES = [
  ['family', 'Familienfreundlicher Modus 🦄', 'Filtert Schimpfwörter in Memes, Chat und Namen.'],
  ['autoStart', 'Spiel automatisch starten', 'Startet von selbst, sobald die Lobby voll ist (öffentliche Lobbys: ab 3 Leuten nach 30 Sekunden).'],
  ['lateJoin', 'Beitreten erlauben, während das Spiel läuft', 'Neue Leute können mitten im Spiel einsteigen und mitmachen.'],
  ['hostControl', 'Der Spielleiter entscheidet, wann es weitergeht', 'Statt Timer drückt der Spielleiter beim Bewerten und bei den Ergebnissen auf „Weiter“.'],
  ['dynVote', 'Dynamische Abstimmungszeit', 'Sobald alle abgestimmt haben, kommt sofort das nächste Meme.'],
  ['noBuddy', 'Meme Buddy deaktivieren', 'Niemand kann Meme Buddies für Bonuspunkte vergeben.'],
  ['gifs', 'GIF Memes', 'Animierte Memes abspielen. Aus = Standbild (gut bei schwachem Internet).'],
];
const DEFAULT_SETTINGS = {
  packs: ['classic'], mode: 'normal', time: 90, rounds: 3, rerolls: 5, max: 10,
  family: false, autoStart: true, lateJoin: true, hostControl: false, dynVote: true, noBuddy: false, gifs: true,
};
const MAX_BOXES = 8;
const PENALTY = -500;
const T = { intro: 3200, timeup: 2200, next: 1700, collect: 2600, gameover: 2600 };
const BAD_WORDS = ['scheiß', 'scheiss', 'scheis', 'fick', 'fotze', 'hurensohn', 'hure', 'wichser', 'arschloch', 'schlampe', 'nutte', 'missgeburt', 'spast', 'bastard',
  'fuck', 'shit', 'bitch', 'cunt', 'pussy', 'dick', 'whore', 'slut', 'nigg', 'neger', 'porn', 'penis', 'vagina', 'motherf', 'asshole', 'wanker', 'nazi', 'hitler'];
const BAD_RE = new RegExp(BAD_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi');
const cleanText = (s) => String(s).replace(BAD_RE, (m) => m[0] + '*'.repeat(Math.max(1, m.length - 1)));

// PeerJS loggt erwartete Fehlversuche (z. B. beim Abfragen leerer öffentlicher Lobby-Plätze) als
// Konsolenfehler. Fehler kommen trotzdem als 'error'-Events an und werden im Spiel angezeigt.
if (typeof window.Peer === 'function') {
  const OrigPeer = window.Peer;
  window.Peer = class extends OrigPeer {
    constructor(a, b) {
      if (a && typeof a === 'object') super({ ...a, debug: 0 });
      else super(a, { ...(b || {}), debug: 0 });
    }
  };
}

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const avColor = (key) => { let h = 0; for (const ch of String(key)) h = (h * 31 + ch.codePointAt(0)) >>> 0; return AV_COLORS[h % AV_COLORS.length]; };
const avHtml = (p, cls = 'av') => `<span class="${cls}" style="background:${avColor((p.avatar || '') + (p.name || ''))}">${esc(p.avatar)}</span>`;
const randomName = () => (pick(NAME_A) + pick(NAME_B)).slice(0, 16);
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

// ---------------------------------------------------------------------------
// Toasts, Modal
// ---------------------------------------------------------------------------
function toast(msg, opts = {}) {
  const ms = opts.ms || 3200;
  const t = document.createElement('div');
  t.className = 'toast' + (opts.err ? ' err' : '');
  t.style.setProperty('--dur', ms + 'ms');
  t.innerHTML = `<span class="ti">${opts.err ? '!' : '✓'}</span><span class="tt"></span><button class="tx" type="button" aria-label="Schließen">✕</button>`;
  t.querySelector('.tt').textContent = msg;
  t.querySelector('.tx').onclick = () => t.remove();
  $('toasts').appendChild(t);
  if (opts.err) sfx.play('error');
  const timer = setTimeout(() => t.remove(), ms);
  return { el: t, set(text) { t.querySelector('.tt').textContent = text; }, close() { clearTimeout(timer); t.remove(); } };
}
function openModal(html, onMount) {
  $('modalCard').innerHTML = html;
  $('modal').classList.remove('hidden');
  if (onMount) onMount($('modalCard'));
}
function closeModal() { $('modal').classList.add('hidden'); $('modalCard').innerHTML = ''; }
$('modal').addEventListener('click', (e) => { if (e.target === $('modal')) closeModal(); });
function confirmBox(title, text, yes, onYes) {
  openModal(`<h2>${esc(title)}</h2><p>${esc(text)}</p><div class="modal-btns"><button class="btn blue" data-a="no">Abbrechen</button><button class="btn red" data-a="yes">${esc(yes)}</button></div>`, (card) => {
    card.querySelector('[data-a=no]').onclick = closeModal;
    card.querySelector('[data-a=yes]').onclick = () => { closeModal(); onYes(); };
  });
}

// ---------------------------------------------------------------------------
// Profil
// ---------------------------------------------------------------------------
const me = { name: lsGet('ph_name', ''), avatar: lsGet('ph_avatar', '') };
if (!AVATARS.includes(me.avatar)) { me.avatar = pick(AVATARS); lsSet('ph_avatar', me.avatar); }
if (!me.name) { me.name = randomName(); }
function showProfile() {
  for (const id of ['avatarEmoji', 'avatarEmoji2']) $(id).textContent = me.avatar;
  for (const id of ['avatarBtn', 'avatarBtn2']) $(id).style.background = `radial-gradient(circle at 35% 30%, #fff, ${avColor(me.avatar)} 60%)`;
  for (const id of ['nameInput', 'nameInput2']) if (document.activeElement !== $(id)) $(id).value = me.name;
}
function setMyName(v) {
  me.name = String(v || '').replace(/\s+/g, ' ').trim().slice(0, 16);
  lsSet('ph_name', me.name);
}
function readProfile() {
  if (!me.name) setMyName(randomName());
  lsSet('ph_name', me.name);
  showProfile();
  return { name: me.name, avatar: me.avatar };
}
for (const id of ['nameInput', 'nameInput2']) {
  $(id).addEventListener('input', (e) => { setMyName(e.target.value); });
  $(id).addEventListener('blur', () => { if (!me.name) setMyName(randomName()); showProfile(); });
}
for (const id of ['diceBtn', 'diceBtn2']) $(id).onclick = () => { setMyName(randomName()); showProfile(); sfx.play('pop'); };
function avatarPicker(after) {
  openModal(`<h2>Wähle deinen Avatar</h2>
    <div class="av-grid">${AVATARS.map((a) => `<button type="button" data-av="${a}" class="${a === me.avatar ? 'on' : ''}" style="background:${avColor(a)}">${a}</button>`).join('')}</div>
    <div class="name-field" style="margin-top:16px"><input id="mName" type="text" maxlength="16" value="${esc(me.name)}" placeholder="Dein Name" autocomplete="off"><button class="dice" id="mDice" type="button">🎲</button></div>
    <div class="modal-btns"><button class="btn green" id="mOk" type="button">Passt so!</button></div>`, (card) => {
    card.querySelectorAll('[data-av]').forEach((b) => b.onclick = () => {
      me.avatar = b.dataset.av; lsSet('ph_avatar', me.avatar);
      card.querySelectorAll('[data-av]').forEach((x) => x.classList.toggle('on', x === b)); sfx.play('pop');
    });
    card.querySelector('#mDice').onclick = () => { card.querySelector('#mName').value = randomName(); };
    card.querySelector('#mOk').onclick = () => {
      setMyName(card.querySelector('#mName').value || randomName());
      closeModal(); showProfile(); after && after();
    };
  });
}
$('avatarBtn').onclick = () => avatarPicker();
$('avatarBtn2').onclick = () => avatarPicker();
showProfile();

// ---------------------------------------------------------------------------
// Bildschirme + Kopfzeile
// ---------------------------------------------------------------------------
const SCREENS = ['start', 'private', 'invite', 'public', 'lobby', 'stage', 'create', 'vote', 'results', 'final'];
let curScreen = 'start';
function show(name) {
  if (curScreen !== name) {
    for (const s of SCREENS) $('scr-' + s).classList.toggle('hidden', s !== name);
    window.scrollTo({ top: 0 });
    curScreen = name;
  }
  document.body.classList.toggle('on-start', ['start', 'private', 'invite', 'public'].includes(name));
}
function setHeader({ small = '', title = '', tag = '', bar = false } = {}) {
  $('hdrSmall').innerHTML = small; $('hdrSmall').classList.toggle('hidden', !small);
  $('hdrTitle').innerHTML = title;
  $('hdrTag').textContent = tag; $('hdrTag').classList.toggle('hidden', !tag);
  $('hdrBar').classList.toggle('hidden', !bar);
}
document.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => { sfx.play('click'); show(b.dataset.go); });

// ---------------------------------------------------------------------------
// HOST-LOGIK (läuft nur im Browser des Lobby-Erstellers)
// ---------------------------------------------------------------------------
let room = null;
let H = null;

function newHostState() {
  return {
    phase: 'lobby', settings: { ...DEFAULT_SETTINGS, packs: DEFAULT_SETTINGS.packs.slice() },
    players: {}, order: [], round: 0, topic: null, endsAt: 0, totalMs: 0, autoAt: 0,
    assign: {}, subs: {}, drafts: {}, roundPlayers: new Set(),
    entries: [], voteIdx: 0, votes: {}, buddies: {},
    results: null, gallery: [], used: new Set(), kick: null, sameTpl: null,
  };
}
const pool = () => buildPool(H.settings.packs);
function freshTemplate() {
  const all = pool();
  let free = all.filter((t) => !H.used.has(t.id));
  if (free.length < 2) { H.used.clear(); free = all; }
  const t = pick(free);
  H.used.add(t.id);
  return t;
}
function cleanName(n) {
  let s = String(n || '').replace(/\s+/g, ' ').trim().slice(0, 16) || 'Gast';
  if (H && H.settings.family) s = cleanText(s);
  return s;
}
function hostAddPlayer(id, hello) {
  H.players[id] = { name: cleanName(hello.name), avatar: AVATARS.includes(hello.avatar) ? hello.avatar : pick(AVATARS), score: 0, sid: String(hello.sid || '').slice(0, 40) };
  H.order.push(id);
  if (H.phase === 'create' && !H.assign[id]) H.assign[id] = { tpl: H.sameTpl || freshTemplate(), rerolls: H.settings.mode === 'same' ? 0 : H.settings.rerolls };
}
const count = () => H.order.length;
const online = () => H.order.filter((id) => !H.players[id].off);
const eligibleVoters = (author) => online().filter((id) => id !== author);

function publicState() {
  const st = {
    t: 'state', phase: H.phase, hostId: room.myId, code: room.code, isPublic: room.isPublic,
    settings: H.settings, round: H.round, topic: H.topic,
    players: H.order.map((id) => { const p = H.players[id]; return { id, name: p.name, avatar: p.avatar, score: p.score, off: !!p.off }; }),
    endsIn: H.endsAt ? Math.max(0, H.endsAt - Date.now()) : 0, totalMs: H.totalMs,
    autoIn: H.autoAt ? Math.max(0, H.autoAt - Date.now()) : 0,
  };
  if (H.kick) st.kick = { target: H.kick.target, name: (H.players[H.kick.target] || {}).name, yes: [...H.kick.yes], need: kickNeed() };
  if (H.phase === 'create') { st.assign = H.assign; st.submitted = Object.keys(H.subs); }
  if (H.phase === 'vote' || H.phase === 'next') {
    const e = H.entries[H.voteIdx];
    st.vote = {
      idx: H.voteIdx, total: H.entries.length, author: e.author, meme: e.meme,
      voted: Object.keys(H.votes[H.voteIdx] || {}).length, eligible: eligibleVoters(e.author).length, buddies: H.buddies,
    };
  }
  if (['results', 'final', 'gameover'].includes(H.phase)) st.results = H.results;
  if (H.phase === 'final') st.gallery = H.gallery.slice().sort((a, b) => b.pts - a.pts);
  return st;
}
function sync() { if (room && room.isHost) { room.broadcast(publicState()); saveHostSoon(); } }
function sysChat(text) { room.broadcast({ t: 'chat', sys: true, text }); }
function setTimer(ms) { H.totalMs = ms; H.endsAt = ms ? Date.now() + ms : 0; }
function go(phase, ms) { H.phase = phase; setTimer(ms); sync(); }

function startGame() {
  H.round = 0; H.gallery = []; H.results = null; H.used.clear(); H.autoAt = 0;
  for (const id of H.order) H.players[id].score = 0;
  sysChat('Los geht’s! 🏁');
  startIntro();
}
function startIntro() { H.results = null; go('intro', T.intro); }
function startCreate() {
  H.round++;
  H.subs = {}; H.drafts = {}; H.assign = {}; H.buddies = {}; H.votes = {};
  H.topic = H.settings.mode === 'topics' ? pick(TOPICS) : null;
  H.sameTpl = H.settings.mode === 'same' ? freshTemplate() : null;
  H.roundPlayers = new Set(online());
  for (const id of H.order) H.assign[id] = { tpl: H.sameTpl || freshTemplate(), rerolls: H.settings.mode === 'same' ? 0 : H.settings.rerolls };
  go('create', H.settings.time * 1000);
}
function endCreate(timeUp) {
  const entries = [];
  for (const id of H.order) {
    const m = H.subs[id] || H.drafts[id];
    const p = H.players[id];
    if (m && m.boxes.some((b) => b.text && b.text.trim())) entries.push({ author: id, name: p.name, avatar: p.avatar, meme: m });
  }
  H.entries = shuffle(entries);
  H.votes = {}; H.voteIdx = 0;
  if (timeUp) { H.phase = 'timeup'; setTimer(T.timeup); H.afterTimeup = true; sync(); return; }
  afterCreate();
}
function afterCreate() {
  if (!H.entries.length) { sysChat('Niemand hat ein Meme gemacht 😴'); computeRound(); return; }
  startVote(0);
}
function voteMs() { const n = count(); return (n <= 6 ? 15 : n <= 12 ? 12 : 10) * 1000; }
function startVote(i) {
  H.voteIdx = i;
  H.votes[i] = H.votes[i] || {};
  const e = H.entries[i];
  const hasVoters = eligibleVoters(e.author).length > 0;
  go('vote', H.settings.hostControl && hasVoters ? 0 : (hasVoters ? voteMs() : 4000));
}
function endVote() {
  const e = H.entries[H.voteIdx];
  if (e) e.eligible = eligibleVoters(e.author).length;
  if (H.voteIdx + 1 < H.entries.length) { H.phase = 'next'; setTimer(T.next); sync(); }
  else { computeRound(); }
}
function computeRound() {
  const relaxed = H.settings.mode === 'relaxed';
  const gains = {};
  const g = (id) => (gains[id] = gains[id] || { meme: 0, buddyBonus: 0, share: 0, penalty: 0, total: 0 });
  const memes = [];
  H.entries.forEach((e, i) => {
    const vs = Object.values(H.votes[i] || {});
    const ups = vs.filter((v) => v === 1).length, downs = vs.filter((v) => v === -1).length, mehs = vs.filter((v) => v === 0).length;
    const elig = e.eligible ?? eligibleVoters(e.author).length;
    const memePts = elig ? Math.round((1000 * (ups - downs)) / elig) : 0;
    const givers = Object.keys(H.buddies).filter((gid) => H.buddies[gid] === e.author);
    const buddyBonus = 10 * givers.length;
    const pts = memePts + buddyBonus;
    memes.push({ author: e.author, name: e.name, avatar: e.avatar, meme: e.meme, pts: relaxed ? 0 : pts, memePts, buddyBonus, ups, downs, mehs,
      buddies: givers.map((gid) => ({ name: (H.players[gid] || {}).name || '?', avatar: (H.players[gid] || {}).avatar || '👻' })) });
    if (!relaxed) {
      g(e.author).meme += memePts; g(e.author).buddyBonus += buddyBonus;
      for (const gid of givers) g(gid).share += Math.round(pts / 2);
    }
    H.gallery.push({ meme: e.meme, name: e.name, avatar: e.avatar, pts: relaxed ? 0 : pts, round: H.round });
  });
  if (!relaxed) {
    for (const id of H.roundPlayers) if (H.players[id] && !H.entries.some((e) => e.author === id)) g(id).penalty = PENALTY;
    for (const id of Object.keys(gains)) {
      const x = gains[id]; x.total = x.meme + x.buddyBonus + x.share + x.penalty;
      if (H.players[id]) H.players[id].score += x.total;
    }
  }
  memes.sort((a, b) => b.pts - a.pts || b.ups - a.ups);
  H.results = { memes, gains, relaxed, empty: !H.entries.length, round: H.round };
  if (H.entries.length) { H.phase = 'collect'; setTimer(T.collect); sync(); }
  else startResults();
}
function startResults() {
  const n = H.results ? H.results.memes.length : 0;
  go('results', H.settings.hostControl ? 0 : Math.min(40000, 10000 + n * 3000));
}
function endResults() {
  if (H.round >= H.settings.rounds) { H.phase = 'gameover'; setTimer(T.gameover); sync(); }
  else startIntro();
}
function hostAdvance() {
  if (H.phase === 'vote') endVote();
  else if (H.phase === 'results') endResults();
}
function hostTick() {
  if (!H) return;
  const now = Date.now();
  if (H.kick && now > H.kick.ends) { sysChat(`Abstimmung gegen ${(H.players[H.kick.target] || {}).name || '?'} gescheitert`); H.kick = null; sync(); }
  if (H.phase === 'lobby') {
    const s = H.settings, n = count();
    let want = 0;
    if (s.autoStart && n >= 2) {
      if (n >= s.max) want = 5000;
      else if (room.isPublic && n >= 3) want = 30000;
    }
    if (!want && H.autoAt) { H.autoAt = 0; sync(); }
    else if (want && !H.autoAt) { H.autoAt = now + want; sync(); }
    else if (want && H.autoAt && H.autoAt - now > want) { H.autoAt = now + want; sync(); }
    if (H.autoAt && now >= H.autoAt) startGame();
    return;
  }
  if (!H.endsAt || now < H.endsAt) return;
  H.endsAt = 0;
  switch (H.phase) {
    case 'intro': startCreate(); break;
    case 'create': endCreate(true); break;
    case 'timeup': afterCreate(); break;
    case 'vote': endVote(); break;
    case 'next': startVote(H.voteIdx + 1); break;
    case 'collect': startResults(); break;
    case 'results': endResults(); break;
    case 'gameover': H.phase = 'final'; H.totalMs = 0; sync(); break;
  }
}
function cleanBoxes(boxes) {
  if (!Array.isArray(boxes)) return [];
  const num = (v, d, lo, hi) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
  return boxes.slice(0, MAX_BOXES).map((b) => {
    let text = String((b && b.text) || '').slice(0, 140);
    if (H.settings.family) text = cleanText(text);
    const o = { text, x: num(b.x, 4, -10, 100), y: num(b.y, 4, -10, 100), w: num(b.w, 92, 5, 120), h: num(b.h, 20, 3, 120), c: b.c === 'b' ? 'b' : 'w' };
    const r = num(b.r, 0, -180, 180); if (r) o.r = Math.round(r);
    if (b.v === 't' || b.v === 'b') o.v = b.v;
    return o;
  });
}
function kickNeed() { if (!H.kick) return 0; const others = online().filter((x) => x !== H.kick.target).length; return Math.floor(others / 2) + 1; }
// alle, die gerade verbunden sind (und ein Meme bekommen haben), haben eingereicht
function allSubmitted() { const on = online().filter((id) => H.assign[id]); return on.length > 0 && on.every((id) => H.subs[id]); }
function doKick(id, why) {
  if (!H.players[id] || id === room.myId) return;
  room.sendTo(id, { t: 'kicked', why });
  setTimeout(() => room.kick(id), 250);
  hostRemove(id, true);
}
function hostHandle(from, msg) {
  const isHostMsg = from === room.myId;
  const a = H.assign[from];
  switch (msg.t) {
    case 'settings': {
      if (!isHostMsg || H.phase !== 'lobby') return;
      const s = H.settings;
      if (Array.isArray(msg.packs)) { const p = msg.packs.filter((x) => PACKS.some((k) => k.id === x)).slice(0, 2); if (p.length) s.packs = p; }
      if (MODES.some((m) => m.id === msg.mode)) s.mode = msg.mode;
      if (TIMES.some(([v]) => v === +msg.time)) s.time = +msg.time;
      if (+msg.rounds >= 1 && +msg.rounds <= 10) s.rounds = Math.round(+msg.rounds);
      if (REROLL_OPTS.includes(+msg.rerolls)) s.rerolls = +msg.rerolls;
      if (+msg.max >= 2 && +msg.max <= 30) s.max = Math.round(+msg.max);
      for (const [k] of TOGGLES) if (typeof msg[k] === 'boolean') s[k] = msg[k];
      sync();
      break;
    }
    case 'start':
      if (!isHostMsg || H.phase !== 'lobby' || online().length < 2) return;
      startGame();
      break;
    case 'again':
      if (!isHostMsg) return;
      H.phase = 'lobby'; H.round = 0; setTimer(0); H.results = null; H.gallery = []; H.autoAt = 0;
      for (const id of H.order) H.players[id].score = 0;
      sync();
      break;
    case 'next':
      if (!isHostMsg || !H.settings.hostControl) return;
      hostAdvance();
      break;
    case 'profile': {
      const p = H.players[from];
      if (!p) return;
      const old = p.name;
      p.name = cleanName(msg.name); if (AVATARS.includes(msg.avatar)) p.avatar = msg.avatar;
      if (old !== p.name) sysChat(`${old} heißt jetzt ${p.name}`);
      sync();
      break;
    }
    case 'reroll':
      if (H.phase !== 'create' || !a || a.rerolls <= 0 || H.subs[from] || H.settings.mode === 'same') return;
      a.rerolls--; a.tpl = freshTemplate();
      sync();
      break;
    case 'draft':
      if (H.phase !== 'create' || !a) return;
      H.drafts[from] = { tpl: a.tpl, boxes: cleanBoxes(msg.boxes) };
      break;
    case 'submit':
      if (H.phase !== 'create' || !a) return;
      H.subs[from] = { tpl: a.tpl, boxes: cleanBoxes(msg.boxes) };
      if (allSubmitted()) { setTimer(0); endCreate(false); }
      else sync();
      break;
    case 'unsubmit':
      if (H.phase !== 'create') return;
      delete H.subs[from];
      sync();
      break;
    case 'vote': {
      if (H.phase !== 'vote' || msg.idx !== H.voteIdx) return;
      const e = H.entries[H.voteIdx];
      if (!e || e.author === from || !H.players[from]) return;
      const v = [1, 0, -1].includes(+msg.v) ? +msg.v : 0;
      H.votes[H.voteIdx][from] = v;
      if (H.settings.dynVote && !H.settings.hostControl && eligibleVoters(e.author).every((id) => id in H.votes[H.voteIdx])) H.endsAt = Math.min(H.endsAt || Infinity, Date.now() + 1200);
      sync();
      break;
    }
    case 'buddy': {
      if (H.phase !== 'vote' || msg.idx !== H.voteIdx || H.settings.noBuddy || H.settings.mode === 'relaxed') return;
      const e = H.entries[H.voteIdx];
      if (!e || e.author === from || H.buddies[from] || !H.players[from]) return;
      H.buddies[from] = e.author;
      sync();
      break;
    }
    case 'chat': {
      const p = H.players[from];
      let text = String(msg.text || '').trim().slice(0, 200);
      if (H.settings.family) text = cleanText(text);
      if (p && text) room.broadcast({ t: 'chat', name: p.name, avatar: p.avatar, text });
      break;
    }
    case 'kick':
      if (!isHostMsg) return;
      doKick(msg.id, 'host');
      break;
    case 'votekick': {
      if (!room.isPublic || H.kick || !H.players[msg.id] || msg.id === from || msg.id === room.myId || !H.players[from]) return;
      H.kick = { target: msg.id, yes: new Set([from]), ends: Date.now() + 30000 };
      sysChat(`${H.players[from].name} will ${H.players[msg.id].name} rauswerfen – stimmt ab!`);
      checkKick();
      sync();
      break;
    }
    case 'kickvote':
      if (!H.kick || from === H.kick.target || !H.players[from]) return;
      H.kick.yes.add(from);
      checkKick();
      sync();
      break;
  }
}
function checkKick() {
  if (H.kick && H.kick.yes.size >= kickNeed()) { const id = H.kick.target; H.kick = null; doKick(id, 'vote'); }
}
function hostRemove(id, kicked) {
  if (!H || !H.players[id]) return;
  const name = H.players[id].name;
  delete H.players[id];
  H.order = H.order.filter((x) => x !== id);
  delete H.assign[id]; delete H.subs[id]; delete H.drafts[id]; delete lastSeen[id];
  if (H.kick && H.kick.target === id) H.kick = null;
  if (H.kick) H.kick.yes.delete(id);
  sysChat(kicked ? `${name} wurde rausgeworfen` : `${name} hat die Lobby verlassen`);
  if (H.phase === 'create' && allSubmitted()) { setTimer(0); endCreate(false); return; }
  checkVoteDone();
  checkKick();
  sync();
}
// --- Verbindungsabbrüche: Spieler behalten ihren Platz, bis sie wiederkommen ---
const GRACE_MS = 60000;      // so lange wartet der Host auf einen weggebrochenen Spieler
const SILENT_MS = 12000;     // keine Nachricht so lange = Verbindung tot
const lastSeen = {};
function markOffline(id) {
  if (!H || !room) return;
  const p = H.players[id];
  if (!p || p.off || id === room.myId) return;
  p.off = Date.now();
  sysChat(`📶 ${p.name} hat die Verbindung verloren – wartet auf Rückkehr …`);
  if (H.phase === 'create' && allSubmitted()) { setTimer(0); endCreate(false); return; }
  checkVoteDone();
  checkKick();
  sync();
}
function checkVoteDone() {
  if (H.phase !== 'vote' || !H.settings.dynVote || H.settings.hostControl) return;
  const e = H.entries[H.voteIdx];
  if (e && eligibleVoters(e.author).every((x) => x in (H.votes[H.voteIdx] || {}))) H.endsAt = Math.min(H.endsAt || Infinity, Date.now() + 1200);
}
// alle Spuren einer alten Peer-ID auf die neue umschreiben (Wiederverbinden)
function remapId(from, to) {
  const sw = (x) => (x === from ? to : x);
  const moveKey = (o) => { if (o && from in o) { o[to] = o[from]; delete o[from]; } };
  moveKey(H.players); moveKey(H.assign); moveKey(H.subs); moveKey(H.drafts); moveKey(lastSeen);
  H.order = H.order.map(sw);
  H.roundPlayers = new Set([...H.roundPlayers].map(sw));
  for (const e of H.entries) e.author = sw(e.author);
  for (const k of Object.keys(H.votes)) moveKey(H.votes[k]);
  const bud = {}; for (const [g, t] of Object.entries(H.buddies)) bud[sw(g)] = sw(t); H.buddies = bud;
  if (H.kick) { H.kick.target = sw(H.kick.target); H.kick.yes = new Set([...H.kick.yes].map(sw)); }
  if (H.results) { moveKey(H.results.gains); for (const m of H.results.memes) m.author = sw(m.author); }
}
function hostJoin(id, hello) {
  lastSeen[id] = Date.now();
  const sid = String((hello && hello.sid) || '');
  const old = sid && H.order.find((x) => x !== id && H.players[x] && H.players[x].sid === sid);
  if (old) {
    // derselbe Spieler kommt zurück (neu geladen, Netz weg, …): Platz, Punkte, Meme übernehmen
    const wasOff = H.players[old].off;
    if (room.conns.has(old)) { room.sendTo(old, { t: 'kicked', why: 'dup' }); setTimeout(() => room.kick(old), 200); }
    remapId(old, id);
    lastSeen[id] = Date.now();
    const p = H.players[id];
    delete p.off;
    if (hello.name) p.name = cleanName(hello.name);
    if (AVATARS.includes(hello.avatar)) p.avatar = hello.avatar;
    sysChat(wasOff ? `✅ ${p.name} ist wieder da` : `🔁 ${p.name} hat sich neu verbunden`);
    sync();
    return;
  }
  if (count() >= H.settings.max) { room.sendTo(id, { t: 'full' }); setTimeout(() => room.kick(id), 300); return; }
  if (H.phase !== 'lobby' && !H.settings.lateJoin) { room.sendTo(id, { t: 'deny', text: 'Das Spiel läuft schon – Beitreten ist gerade nicht erlaubt.' }); setTimeout(() => room.kick(id), 300); return; }
  hostAddPlayer(id, hello);
  sysChat(`${H.players[id].avatar} ${H.players[id].name} ist beigetreten`);
  sync();
}
function hostWatchdog() {
  if (!H || !room || !room.isHost) return;
  const now = Date.now();
  for (const id of H.order.slice()) {
    if (id === room.myId) continue;
    const p = H.players[id];
    if (!p) continue;
    if (p.off) { if (now - p.off > GRACE_MS) hostRemove(id); continue; }
    if (!room.conns.has(id)) { markOffline(id); continue; }
    if (now - (lastSeen[id] || now) > SILENT_MS) { room.kick(id); markOffline(id); }
  }
}

// --- Host-Zustand im Tab sichern: lädt der Host versehentlich neu, geht die Lobby weiter ---
const HOST_KEY = 'mm_host';
let saveTimer = null;
function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
function ssSet(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) {} }
function saveHostNow() {
  clearTimeout(saveTimer); saveTimer = null;
  if (!H || !room || !room.isHost) return;
  try {
    const h = { ...H, used: [...H.used], roundPlayers: [...H.roundPlayers], kick: null };
    ssSet(HOST_KEY, JSON.stringify({ v: 1, code: room.code, isPublic: room.isPublic, t: Date.now(), H: h }));
  } catch (e) {}
}
function saveHostSoon() { if (!saveTimer) saveTimer = setTimeout(saveHostNow, 800); }
function loadHostSave() {
  try {
    const x = JSON.parse(ssGet(HOST_KEY) || 'null');
    if (!x || x.v !== 1 || Date.now() - x.t > 3 * 60000) return null;
    return x;
  } catch (e) { return null; }
}
window.addEventListener('pagehide', () => saveHostNow());

function setupHost(restored) {
  H = newHostState();
  if (restored) {
    Object.assign(H, restored, { used: new Set(restored.used || []), roundPlayers: new Set(restored.roundPlayers || []), kick: null });
    const now = Date.now();
    for (const id of H.order) { if (id !== room.myId && H.players[id]) H.players[id].off = H.players[id].off || now; }
    // Wer gerade schreibt, bekommt nach dem Neuladen ein paar Sekunden extra
    if (H.endsAt && H.phase === 'create') H.endsAt = Math.max(H.endsAt, now + 15000);
    else if (H.endsAt) H.endsAt = Math.max(H.endsAt, now + 3000);
    if (H.autoAt) H.autoAt = 0;
  }
  room.getInfo = () => ({
    phase: H.phase, players: count(), max: H.settings.max, mode: H.settings.mode, pack: H.settings.packs.join('+'),
    host: H.players[room.myId] ? H.players[room.myId].name : '?', late: H.settings.lateJoin,
  });
  room.onClientJoin = (id, hello) => hostJoin(id, hello || {});
  room.onClientLeave = (id) => markOffline(id);
  room.onClientMessage = (from, msg) => {
    if (!msg || typeof msg !== 'object') return;
    lastSeen[from] = Date.now();
    if (msg.t === 'ping') return;
    if (msg.t === 'bye') { if (from !== room.myId) { hostRemove(from); room.kick(from); } return; }
    hostHandle(from, msg);
  };
  if (!restored || !H.players[room.myId]) hostAddPlayer(room.myId, readProfile());
  else { const p = H.players[room.myId]; delete p.off; }
  clearInterval(hostTimer);
  hostTimer = setInterval(() => { try { hostTick(); } catch (e) { console.error('hostTick', e); } }, 200);
  clearInterval(hbTimer);
  hbTimer = setInterval(() => { if (room && room.isHost) { room.broadcast({ t: 'hb' }); hostWatchdog(); } }, 3000);
  sync();
  if (restored) sysChat('🔄 Der Spielleiter war kurz weg – weiter geht’s!');
}
let hostTimer = null, hbTimer = null;
// Eigene Peer-ID (Lobby-Code) erneut belegen. Der Vermittlungsserver gibt die alte ID oft erst
// nach ein paar Sekunden frei, darum mehrere Versuche.
async function claimHostId(r, code, isPublic) {
  const id = isPublic ? r._publicId(+String(code).replace(/\D/g, '')) : r._privateId(code);
  for (let i = 0; i < 10; i++) {
    try {
      const peer = await new Promise((res, rej) => {
        const p = new Peer(id, { debug: 0 });
        let done = false;
        p.on('open', () => { done = true; res(p); });
        p.on('error', (e) => { if (!done) { done = true; try { p.destroy(); } catch (x) {} rej(e); } });
        setTimeout(() => { if (!done) { done = true; try { p.destroy(); } catch (x) {} rej(new Error('timeout')); } }, 10000);
      });
      r.code = code; r.isPublic = !!isPublic;
      await r._becomeHost(peer);
      return true;
    } catch (e) {
      if (e && e.type && e.type !== 'unavailable-id') throw e;
      await new Promise((res) => setTimeout(res, 2500));
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// CLIENT (läuft bei allen, auch beim Host)
// ---------------------------------------------------------------------------
let S = null;
let localDeadline = 0;
let localAuto = 0;
let lastPhase = null;
let lastPlayerCount = 0;
let lobbyStep = 'pack';
let codeShown = false;
let localLobby = false;
const editor = { tplId: null, round: -1, tpl: null, boxes: [], sel: 0, el: null };
const myVotes = {};
let myRoundKey = '';

function onHostMessage(msg) {
  if (!msg || typeof msg !== 'object') return;
  lastHostMsg = Date.now();
  if (msg.t === 'hb') return;
  if (msg.t === 'state') {
    const first = !S || needResync;
    S = msg; localDeadline = msg.endsIn ? Date.now() + msg.endsIn : 0; localAuto = msg.autoIn ? Date.now() + msg.autoIn : 0;
    render();
    if (first && needResync) {
      needResync = false;
      // nach dem Wiederverbinden den aktuellen Entwurf sofort nachschicken
      if (S.phase === 'create' && editor.round === S.round && editor.boxes.some((b) => b.text)) room.send({ t: 'draft', boxes: editor.boxes });
    }
    saveClientInfo();
  } else if (msg.t === 'chat') addChat(msg);
  else if (msg.t === 'closed') { toast('Der Spielleiter hat die Lobby geschlossen 👋', { err: true, ms: 4500 }); resetToStart(true); }
  else if (msg.t === 'full') { toast('Die Lobby ist voll 😕', { err: true }); resetToStart(); }
  else if (msg.t === 'deny') { toast(msg.text, { err: true, ms: 4500 }); resetToStart(); }
  else if (msg.t === 'kicked') {
    toast(msg.why === 'vote' ? 'Du wurdest per Abstimmung rausgeworfen' : msg.why === 'dup' ? 'Du bist in einem anderen Tab mit dieser Lobby verbunden' : 'Du wurdest aus der Lobby entfernt', { err: true, ms: 4500 });
    resetToStart(true);
  }
}
const isHost = () => room && room.isHost;
const myId = () => room && room.myId;
const playerById = (id) => (S && S.players.find((p) => p.id === id)) || null;

function resetToStart(silent) {
  const old = room; room = null;
  reconnecting = null; needResync = false;
  if (reconnectToast) { reconnectToast.close(); reconnectToast = null; }
  ssSet(CLIENT_KEY, null);
  if (old) {
    // dem Host Bescheid sagen, damit er nicht auf uns wartet
    try {
      if (old.isHost) { ssSet(HOST_KEY, null); clearInterval(hostTimer); clearInterval(hbTimer); old.broadcast({ t: 'closed' }); }
      else if (!silent) old.send({ t: 'bye' });
    } catch (e) {}
    old.onClientJoin = old.onClientLeave = old.onClientMessage = old.onHostLost = old.onHostMessage = () => {};
    setTimeout(() => old.leave(), 250);
  }
  S = null; H = null; lastPhase = null; localLobby = false; codeShown = false;
  clearInterval(hostTimer); clearInterval(hbTimer);
  editor.tplId = null; editor.round = -1;
  $('chatLog').innerHTML = ''; unread = 0; updateBadge(); $('chat').classList.add('hidden');
  $('votekick').classList.add('hidden');
  history.replaceState(null, '', location.pathname);
  setHeader({});
  show('start');
}

function roundSmall(label = 'Runde', a = S.round, b = S.settings.rounds) { return `${label} <b>${a}</b>/${b}`; }
function render() {
  if (!S) return;
  const phaseChanged = S.phase !== lastPhase;
  if (phaseChanged) onPhaseEnter(S.phase, lastPhase);
  lastPhase = S.phase;
  if (S.players.length > lastPlayerCount && lastPlayerCount) sfx.play('join');
  else if (S.players.length < lastPlayerCount) sfx.play('leave');
  lastPlayerCount = S.players.length;
  renderKick();
  if (S.phase !== 'final') localLobby = false;
  switch (S.phase) {
    case 'lobby': renderLobby(); break;
    case 'intro': renderStage(); break;
    case 'create': renderCreate(); break;
    case 'timeup': case 'next': case 'collect': case 'gameover': renderStage(); break;
    case 'vote': renderVote(); break;
    case 'results': renderResults(); break;
    case 'final': if (localLobby) renderLobby(); else renderFinal(); break;
  }
}
function onPhaseEnter(p) {
  if (p === 'intro') sfx.play(S.round === 0 ? 'start' : 'whoosh');
  if (p === 'timeup') sfx.play('timeup');
  if (p === 'next') sfx.play('whoosh');
  if (p === 'collect') sfx.play('drum');
  if (p === 'results') sfx.play('pop');
  if (p === 'final') { sfx.play('fanfare'); confetti(); }
  if (p === 'vote') sfx.play('pop');
}

// LOBBY ----------------------------------------------------------------------
function lobbyTitle() {
  const code = codeShown ? esc(S.code) : '••••';
  return `<span class="lob">Lobby</span> <span class="hash">#${code}</span>`;
}
function autoText() { return `Spiel startet automatisch in ${Math.max(0, Math.ceil((localAuto - Date.now()) / 1000))} s …`; }
function sendSettings(patch) { room.send({ t: 'settings', ...S.settings, ...patch }); }
function fillSelect(sel, opts, val) {
  const html = opts.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
  if (sel._html !== html) { sel.innerHTML = html; sel._html = html; }
  sel.value = String(val);
}
function renderLobby() {
  show('lobby');
  const host = isHost() && S.phase === 'lobby';
  setHeader({ title: lobbyTitle(), tag: S.isPublic ? '🌐 Öffentlich' : '🔒 Privat' });
  // Schritte
  document.querySelectorAll('.lstep').forEach((b) => { b.classList.toggle('on', host && b.dataset.step === lobbyStep); b.disabled = !host; });
  $('lobbySteps').querySelectorAll('.lstep, .ls-arrow').forEach((el) => el.classList.toggle('hidden', !host));
  $('stepPack').classList.toggle('hidden', !host || lobbyStep !== 'pack');
  $('stepMode').classList.toggle('hidden', !host || lobbyStep !== 'mode');
  $('stepSettings').classList.toggle('hidden', !host || lobbyStep !== 'settings');
  $('guestView').classList.toggle('hidden', host);
  const s = S.settings;
  // Packs
  $('packCount').innerHTML = `<b>${s.packs.length}</b>/2 ausgewählt`;
  $('packGrid').innerHTML = PACKS.map((p) => {
    const n = buildPool([p.id]).length;
    const on = s.packs.includes(p.id);
    return `<button class="pack ${on ? 'on' : ''}" data-pack="${p.id}" type="button" ${host ? '' : 'disabled'}>
      <img src="${esc(p.cover.u)}" alt="" loading="lazy">${p.isNew ? '<span class="pk-new">NEU!</span>' : ''}
      <span class="pk-count">${n} Memes</span><span class="pk-name">${esc(p.name)}</span><span class="pk-btn">${on ? 'Ausgewählt ✓' : 'Auswählen'}</span></button>`;
  }).join('');
  // Modi
  $('modeGrid').innerHTML = MODES.map((m) => `<button class="mode ${s.mode === m.id ? 'on' : ''}" data-mode="${m.id}" type="button" ${host ? '' : 'disabled'}>
    <span class="md-ico">${m.ico}</span><span class="md-t">${esc(m.name)}</span><span class="md-d">${esc(m.desc)}</span></button>`).join('');
  // Einstellungen
  fillSelect($('setTime'), TIMES.map(([v, l]) => [v, `${v} Sekunden – ${l}`]), s.time);
  fillSelect($('setRounds'), Array.from({ length: 10 }, (_, i) => [i + 1, `${i + 1} ${i ? 'Runden' : 'Runde'}`]), s.rounds);
  fillSelect($('setRerolls'), REROLL_OPTS.map((v) => [v, v ? `${v} Mal` : 'Keine']), s.rerolls);
  fillSelect($('setMax'), MAX_OPTS.map((v) => [v, `${v} Spieler`]), s.max);
  for (const id of ['setTime', 'setRounds', 'setRerolls', 'setMax']) $(id).disabled = !host;
  $('expertList').innerHTML = TOGGLES.map(([k, t, d]) => `<div class="tgl-row"><button class="tgl ${s[k] ? 'on' : ''}" data-tgl="${k}" type="button" ${host ? '' : 'disabled'} aria-pressed="${!!s[k]}" aria-label="${esc(t)}"><span class="knob"></span></button>
    <div><div class="tg-t">${esc(t)}</div><div class="tg-d">${esc(d)}</div></div></div>`).join('');
  // Gäste-Ansicht
  const mode = MODES.find((m) => m.id === s.mode) || MODES[0];
  const packs = s.packs.map((id) => PACKS.find((p) => p.id === id)).filter(Boolean);
  $('guestSum').innerHTML = `
    <div class="gs-item"><span class="gs-ico">${mode.ico}</span>${esc(mode.name)}</div>
    ${packs.map((p) => `<div class="gs-item"><span class="gs-ico"><img src="${esc(p.cover.u)}" alt=""></span>${esc(p.name)}</div>`).join('')}
    <div class="gs-item"><span class="gs-ico ring">${s.rounds}</span>Runden</div>
    <div class="gs-item"><span class="gs-ico ring">${s.time}s</span>Beschriftungszeit</div>`;
  $('guestDetails').innerHTML = [
    ['Meme-Wechsel', s.rerolls ? `${s.rerolls} Mal` : 'Keine'], ['Max. Spieler', s.max],
    ...TOGGLES.map(([k, t]) => [t, s[k] ? 'Ja' : 'Nein']),
  ].map(([a, b]) => `<div>${esc(a)}: <b>${esc(b)}</b></div>`).join('');
  // Spielerleiste
  const cap = Math.min(s.max, 15);
  const shown = S.players.slice(0, cap);
  let html = shown.map((p) => {
    const mine = p.id === myId();
    return `<button class="pl ${mine ? 'me' : ''} ${p.off ? 'off' : ''}" data-pid="${esc(p.id)}" type="button" title="${esc(p.name)}${p.off ? ' (Verbindung weg)' : ''}">
      ${p.id === S.hostId ? '<span class="crown">👑</span>' : ''}${avHtml(p)}${mine ? '' : ''}
      <span class="nm">${esc(p.name)}</span>${p.id === S.hostId ? '<span class="role">SPIELLEITER</span>' : ''}</button>`;
  }).join('');
  html = html.replace(/(<button class="pl me"[^>]*>[\s\S]*?<span class="av"[^>]*>[^<]*)(<\/span>)/, '$1<span class="edit-badge">✎</span>$2');
  const empty = Math.max(0, cap - shown.length);
  html += Array.from({ length: Math.min(empty, 6) }, () => '<span class="pl empty"><span class="av">👤</span><span class="nm">&nbsp;</span></span>').join('');
  if (S.players.length > cap) html += `<span class="pl more"><span class="av">+${S.players.length - cap}</span></span>`;
  $('playerList').innerHTML = html;
  $('playerNum').textContent = S.players.length;
  // Status
  const startBtn = $('startBtn');
  startBtn.classList.toggle('hidden', !host);
  startBtn.disabled = S.players.length < 2;
  const msg = $('lobbyMsg');
  msg.classList.remove('ok');
  if (S.phase === 'final') msg.textContent = 'Warte, bis der Spielleiter zurück in die Lobby geht …';
  else if (localAuto) msg.textContent = autoText();
  else if (S.players.length < 2) msg.textContent = 'Es müssen mindestens 2 Spieler sein, um ein Spiel zu starten';
  else { msg.textContent = host ? 'Alles klar. Wir können loslegen!' : 'Alles klar – warte auf den Spielleiter.'; msg.classList.add('ok'); }
  $('showCodeBtn').textContent = codeShown ? `Code: ${S.code} 🙈` : 'Code anzeigen 👁';
}
document.querySelectorAll('.lstep').forEach((b) => b.onclick = () => { lobbyStep = b.dataset.step; sfx.play('click'); render(); });
$('packGrid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-pack]'); if (!b || !isHost()) return;
  let packs = S.settings.packs.slice();
  const id = b.dataset.pack;
  if (packs.includes(id)) { if (packs.length > 1) packs = packs.filter((x) => x !== id); else { toast('Mindestens ein Pack muss ausgewählt sein'); return; } }
  else { packs.push(id); if (packs.length > 2) packs.shift(); }
  sfx.play('click'); sendSettings({ packs });
});
$('modeGrid').addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (b && isHost()) { sfx.play('click'); sendSettings({ mode: b.dataset.mode }); } });
$('expertList').addEventListener('click', (e) => { const b = e.target.closest('[data-tgl]'); if (b && isHost()) { sfx.play('click'); sendSettings({ [b.dataset.tgl]: !S.settings[b.dataset.tgl] }); } });
$('expertBtn').onclick = () => $('expertList').classList.toggle('hidden');
$('detailsBtn').onclick = () => $('guestDetails').classList.toggle('hidden');
$('setTime').onchange = (e) => sendSettings({ time: +e.target.value });
$('setRounds').onchange = (e) => sendSettings({ rounds: +e.target.value });
$('setRerolls').onchange = (e) => sendSettings({ rerolls: +e.target.value });
$('setMax').onchange = (e) => {
  const v = +e.target.value;
  if (v < S.players.length) { toast(`Es sind schon ${S.players.length} Spieler in der Lobby`, { err: true }); e.target.value = S.settings.max; return; }
  sendSettings({ max: v });
};
$('startBtn').onclick = () => { sfx.play('click'); room.send({ t: 'start' }); };
$('showCodeBtn').onclick = () => { codeShown = !codeShown; render(); };
$('copyLinkBtn').onclick = async () => {
  const q = S.isPublic ? `?pub=${String(S.code).replace('Ö', '')}` : `?code=${S.code}`;
  const url = location.origin + location.pathname + q;
  try {
    if (navigator.share && matchMedia('(hover: none)').matches) { await navigator.share({ title: "Mach's Meme", text: 'Komm in meine Lobby!', url }); return; }
    await navigator.clipboard.writeText(url); toast('Link kopiert!');
  } catch (e) { if (!(e && e.name === 'AbortError')) prompt('Link zum Teilen:', url); }
};
$('playerList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-pid]'); if (!b || !S) return;
  playerMenu(b.dataset.pid);
});
function playerMenu(pid) {
  const p = playerById(pid); if (!p) return;
  if (pid === myId()) { avatarPicker(() => room && room.send({ t: 'profile', name: me.name, avatar: me.avatar })); return; }
  const canKick = isHost();
  const canVote = S.isPublic && !isHost() && pid !== S.hostId && !S.kick;
  if (!canKick && !canVote) return;
  openModal(`<div style="text-align:center">${avHtml(p, 'av')}</div><h2>${esc(p.name)}</h2>
    <div class="modal-btns"><button class="btn blue" data-a="no">Schließen</button>
    ${canKick ? '<button class="btn red" data-a="kick">Rauswerfen</button>' : ''}${canVote ? '<button class="btn red" data-a="vk">Abstimmung: Rauswerfen</button>' : ''}</div>`, (card) => {
    const av = card.querySelector('.av'); av.style.cssText += ';display:inline-grid;place-items:center;width:84px;height:84px;border-radius:50%;font-size:48px;border:3px solid #fff';
    card.querySelector('[data-a=no]').onclick = closeModal;
    const k = card.querySelector('[data-a=kick]'); if (k) k.onclick = () => { closeModal(); room.send({ t: 'kick', id: pid }); };
    const v = card.querySelector('[data-a=vk]'); if (v) v.onclick = () => { closeModal(); room.send({ t: 'votekick', id: pid }); };
  });
}
function renderKick() {
  const box = $('votekick');
  if (!S || !S.kick) { box.classList.add('hidden'); return; }
  const k = S.kick;
  const mine = k.target === myId();
  const voted = k.yes.includes(myId());
  box.classList.remove('hidden');
  box.innerHTML = `<span>🗳️ Rauswerfen: <b>${esc(k.name || '?')}</b>? (${k.yes.length}/${k.need})</span>${!mine && !voted ? '<button class="btn small red" id="kickYes" type="button">Ja, raus</button>' : ''}`;
  const y = $('kickYes'); if (y) y.onclick = () => room.send({ t: 'kickvote' });
}

// ZWISCHENBILDSCHIRME --------------------------------------------------------
function renderStage() {
  show('stage');
  const p = S.phase;
  $('stageEditBtn').classList.add('hidden');
  $('stageNote').textContent = '';
  let emoji = '😼', title = '', sub = '', head = '';
  if (p === 'intro') {
    const first = S.round === 0;
    emoji = first ? '😼' : '🚀';
    title = first ? 'Okaaay, los geht’s' : 'Nächste Runde!';
    sub = first ? 'Mach dich bereit, dein Meme zu erstellen' : 'Mach dich bereit für dein nächstes Meme';
    head = first ? 'Mögen die Spiele beginnen' : 'Nächste Runde startet';
    setHeader({ small: roundSmall('Runde', S.round + 1), title: head });
  } else if (p === 'timeup') { emoji = '⏰'; title = 'Die Zeit ist um!'; sub = 'Stifte weg …'; setHeader({ small: roundSmall(), title: 'Die Zeit ist um!' }); }
  else if (p === 'next') { emoji = '👆'; title = 'Nächstes Meme!'; sub = ''; setHeader({ small: roundSmall('Meme', S.vote.idx + 1, S.vote.total), title: 'Nächstes Meme' }); }
  else if (p === 'collect') { emoji = '🛞'; title = 'Alle Memes bewertet!'; sub = 'Mal sehen, wer der Lustigste ist'; setHeader({ small: roundSmall(), title: 'Stimmen werden gezählt …' }); }
  else if (p === 'gameover') { emoji = '🏁'; title = 'Das Spiel ist vorbei!'; sub = 'Gleich gibt’s die Siegerehrung'; setHeader({ small: roundSmall(), title: 'Ergebnisse werden berechnet …' }); }
  $('stageEmoji').textContent = emoji; $('stageTitle').textContent = title; $('stageSub').textContent = sub;
}

// ERSTELLEN ------------------------------------------------------------------
let draftTimer = null;
function flushDraft() {
  clearTimeout(draftTimer); draftTimer = null;
  if (room && S && S.phase === 'create') room.send({ t: 'draft', boxes: editor.boxes });
  keepDraftLocal();
}
// Entwurf auch im Tab merken: nach Neuladen/Wiederverbinden ist der Text noch da
function keepDraftLocal() {
  if (!S || !room) return;
  ssSet('mm_draft', JSON.stringify({ code: room.code, round: S.round, tpl: editor.tplId, boxes: editor.boxes }));
}
function localDraftFor(tplId) {
  try {
    const d = JSON.parse(ssGet('mm_draft') || 'null');
    if (d && room && d.code === room.code && d.round === S.round && d.tpl === tplId && Array.isArray(d.boxes)) return d.boxes;
  } catch (e) {}
  return null;
}
function sendDraft() {
  // kurz vor Schluss sofort senden, damit beim Zeitende nichts verloren geht
  if (localDeadline && localDeadline - Date.now() < 3000) { flushDraft(); return; }
  clearTimeout(draftTimer); draftTimer = setTimeout(flushDraft, 400);
  keepDraftLocal();
}
function layoutBox(a) {
  const [x, y, w, h, flags = ''] = a;
  const b = { text: '', x, y, w, h, c: 'w' };
  for (const f of String(flags).split(/\s+/)) {
    if (f === 'b') b.c = 'b';
    else if (f === 'vt') b.v = 't';
    else if (f === 'vb') b.v = 'b';
    else if (/^r-?\d+$/.test(f)) b.r = +f.slice(1);
  }
  return b;
}
function defaultBoxes(tpl) {
  const lay = LAYOUTS[tpl.id];
  if (lay && lay.length) return lay.slice(0, MAX_BOXES).map(layoutBox);
  const n = Math.max(1, Math.min(tpl.b || 2, MAX_BOXES));
  if (n === 1) return [{ text: '', x: 3, y: 2, w: 94, h: 22, c: 'w', v: 't' }];
  if (n === 2) return [{ text: '', x: 3, y: 2, w: 94, h: 22, c: 'w', v: 't' }, { text: '', x: 3, y: 76, w: 94, h: 22, c: 'w', v: 'b' }];
  const h = 96 / n;
  return Array.from({ length: n }, (_, i) => ({ text: '', x: 6, y: Math.round((2 + i * h) * 10) / 10, w: 88, h: Math.round((h - 2) * 10) / 10, c: 'w' }));
}
function renderCreate() {
  const a = S.assign && S.assign[myId()];
  const submitted = (S.submitted || []).includes(myId());
  setHeader({ small: roundSmall(), title: submitted ? 'Warte auf die anderen' : 'Beschrifte dein Meme', bar: true });
  if (!a) { show('stage'); $('stageEmoji').textContent = '👀'; $('stageTitle').textContent = 'Du bist mitten im Spiel dazugekommen'; $('stageSub').textContent = 'Ab dem Bewerten bist du dabei!'; return; }
  if (submitted) {
    show('stage');
    $('stageEmoji').textContent = '😎⌨️';
    $('stageTitle').textContent = 'Du hast dein Meisterwerk eingereicht';
    $('stageSub').textContent = 'Warten wir auf die anderen …';
    $('stageEditBtn').classList.remove('hidden');
    $('stageNote').textContent = `${(S.submitted || []).length}/${S.players.filter((p) => !p.off).length} fertig`;
    return;
  }
  const fresh = a.tpl.id !== editor.tplId || S.round !== editor.round;
  show('create');
  if (fresh) {
    const old = editor.round === S.round ? editor.boxes.map((b) => b.text) : [];
    const saved = localDraftFor(a.tpl.id);
    editor.tpl = a.tpl; editor.tplId = a.tpl.id; editor.round = S.round; editor.sel = 0;
    editor.boxes = saved ? saved.map((b) => ({ ...b, text: String(b.text || '') })) : defaultBoxes(a.tpl);
    if (saved) old.length = 0;
    old.forEach((t, i) => { if (!t) return; if (editor.boxes[i]) editor.boxes[i].text = t; else if (editor.boxes.length < MAX_BOXES) editor.boxes.push({ text: t, x: 6, y: 40, w: 88, h: 18, c: 'w' }); });
    $('motivation').textContent = pick(MOTIVATION);
    drawEditor(); buildInputs();
  }
  $('tplName').textContent = a.tpl.n;
  $('topicChip').classList.toggle('hidden', !S.topic);
  $('topicChip').textContent = S.topic ? `Thema: ${S.topic}` : '';
  $('rerollCount').textContent = a.rerolls;
  $('rerollBtn').disabled = a.rerolls <= 0;
  $('rerollBtn').classList.toggle('hidden', S.settings.mode === 'same' || S.settings.rerolls === 0);
  $('addBoxBtn').disabled = editor.boxes.length >= MAX_BOXES;
}
function drawEditor() {
  const el = $('editorMeme');
  renderMeme(el, editor.tpl, editor.boxes, { still: S && S.settings.gifs === false });
  editor.el = el;
  drawBoxOverlays();
}
function drawBoxOverlays() {
  const el = editor.el; if (!el) return;
  el.querySelectorAll('.bx').forEach((x) => x.remove());
  editor.boxes.forEach((b, i) => {
    const d = document.createElement('div');
    d.className = 'bx' + (i === editor.sel ? ' sel' : '');
    d.dataset.i = i;
    placeBox(d, b);
    d.innerHTML = `${b.text ? '' : `<span class="ph">Text ${i + 1}</span>`}<span class="rs"></span>`;
    attachDrag(d, i);
    el.appendChild(d);
  });
}
function placeBox(d, b) { d.style.left = b.x + '%'; d.style.top = b.y + '%'; d.style.width = b.w + '%'; d.style.height = b.h + '%'; d.style.transform = b.r ? `rotate(${b.r}deg)` : ''; }
function selectBox(i, focus) {
  editor.sel = i;
  editor.el.querySelectorAll('.bx').forEach((x) => x.classList.toggle('sel', +x.dataset.i === i));
  $('boxInputs').querySelectorAll('.bi-row').forEach((r) => r.classList.toggle('sel', +r.dataset.i === i));
  if (focus) { const inp = $('boxInputs').querySelector(`.bi-row[data-i="${i}"] input`); if (inp) inp.focus({ preventScroll: true }); }
}
function attachDrag(d, i) {
  let st = null;
  d.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const b = editor.boxes[i];
    const r = editor.el.getBoundingClientRect();
    st = { px: e.clientX, py: e.clientY, x: b.x, y: b.y, w: b.w, h: b.h, rw: r.width, rh: r.height, resize: e.target.classList.contains('rs'), moved: false };
    d.setPointerCapture(e.pointerId);
    selectBox(i, false);
  });
  d.addEventListener('pointermove', (e) => {
    if (!st) return;
    const dx = ((e.clientX - st.px) / st.rw) * 100, dy = ((e.clientY - st.py) / st.rh) * 100;
    if (Math.abs(e.clientX - st.px) + Math.abs(e.clientY - st.py) > 4) st.moved = true;
    const b = editor.boxes[i];
    if (st.resize) { b.w = Math.max(10, Math.min(110 - b.x, st.w + dx)); b.h = Math.max(6, Math.min(110 - b.y, st.h + dy)); }
    else { b.x = Math.max(-b.w * 0.5, Math.min(100 - b.w * 0.5, st.x + dx)); b.y = Math.max(-b.h * 0.5, Math.min(100 - b.h * 0.5, st.y + dy)); }
    placeBox(d, b);
    redrawMeme(editor.el, editor.boxes);
  });
  const end = () => {
    if (!st) return;
    const tapped = !st.moved;
    d._dragged = !tapped;
    st = null;
    if (tapped) selectBox(i, true); else sendDraft();
  };
  d.addEventListener('pointerup', end);
  d.addEventListener('pointercancel', end);
  // iOS öffnet die Tastatur zuverlässig nur aus einem click heraus: dort nochmal fokussieren
  d.addEventListener('click', () => { if (editor.sel === i && document.activeElement !== $('boxInputs').querySelector(`.bi-row[data-i="${i}"] input`) && !d._dragged) selectBox(i, true); });
}
function buildInputs() {
  const wrap = $('boxInputs');
  wrap.innerHTML = '';
  editor.boxes.forEach((b, i) => {
    const row = document.createElement('div');
    row.className = 'bi-row' + (i === editor.sel ? ' sel' : '');
    row.dataset.i = i;
    const last = i === editor.boxes.length - 1;
    row.innerHTML = `<input type="text" maxlength="140" placeholder="Text ${i + 1} …" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="${last ? 'done' : 'next'}" aria-label="Text ${i + 1}">
      <button class="bi-tool ${b.c === 'b' ? 'col-b' : 'col-w'}" data-a="col" type="button" title="Textfarbe" aria-label="Textfarbe wechseln"></button>
      ${editor.boxes.length > 1 ? '<button class="bi-tool" data-a="del" type="button" title="Textfeld löschen" aria-label="Textfeld löschen">🗑</button>' : ''}`;
    const inp = row.querySelector('input');
    inp.value = b.text;
    inp.addEventListener('focus', () => selectBox(i, false));
    inp.addEventListener('input', () => {
      const had = !!b.text; b.text = inp.value;
      redrawMeme(editor.el, editor.boxes);
      if (had !== !!b.text) drawBoxOverlays();
      sendDraft();
    });
    inp.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.isComposing) return;
      e.preventDefault();
      // Enter springt ins nächste Feld, im letzten Feld schließt es die Tastatur
      if (i + 1 < editor.boxes.length) selectBox(i + 1, true); else { inp.blur(); flushDraft(); }
    });
    inp.addEventListener('blur', () => flushDraft());
    row.querySelector('[data-a=col]').onclick = () => { b.c = b.c === 'b' ? 'w' : 'b'; redrawMeme(editor.el, editor.boxes); buildInputs(); sendDraft(); };
    const del = row.querySelector('[data-a=del]');
    if (del) del.onclick = () => { editor.boxes.splice(i, 1); editor.sel = Math.max(0, Math.min(editor.sel, editor.boxes.length - 1)); drawEditor(); buildInputs(); sendDraft(); };
    wrap.appendChild(row);
  });
  $('addBoxBtn').disabled = editor.boxes.length >= MAX_BOXES;
}
// --- Tipp-Modus am Handy: Meme + aktives Textfeld passen über die Tastatur ------
const touchUI = matchMedia('(hover: none)');
let typingRaf = 0;
function updateTyping() {
  const a = document.activeElement;
  const on = touchUI.matches && curScreen === 'create' && !!(a && a.closest && a.closest('#boxInputs')) && window.innerWidth <= 760;
  document.body.classList.toggle('mm-typing', on);
  if (!on) return;
  const vv = window.visualViewport;
  document.body.style.setProperty('--vvh', Math.round(vv ? vv.height : window.innerHeight) + 'px');
  document.body.style.setProperty('--rows', String(editor.boxes.length || 1));
  cancelAnimationFrame(typingRaf);
  typingRaf = requestAnimationFrame(() => {
    const box = document.querySelector('#scr-create .meme-panel');
    if (!box) return;
    const top = box.getBoundingClientRect().top - (vv ? vv.offsetTop : 0);
    const want = document.getElementById('hdr').getBoundingClientRect().height + 6;
    if (Math.abs(top - want) > 3) window.scrollBy(0, top - want);
  });
}
document.addEventListener('focusin', updateTyping);
document.addEventListener('focusout', () => setTimeout(updateTyping, 250));
// Knöpfe im Tipp-Modus nehmen der Eingabe nicht den Fokus weg (sonst springt das Layout
// zwischen Drücken und Loslassen und der Tipp geht ins Leere)
document.addEventListener('mousedown', (e) => {
  if (document.body.classList.contains('mm-typing') && e.target.closest && e.target.closest('#scr-create button')) e.preventDefault();
}, true);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', updateTyping);
}
window.addEventListener('resize', updateTyping);

$('addBoxBtn').onclick = () => {
  if (editor.boxes.length >= MAX_BOXES) return;
  editor.boxes.push({ text: '', x: 10, y: 40, w: 80, h: 18, c: 'w' });
  editor.sel = editor.boxes.length - 1;
  drawEditor(); buildInputs(); selectBox(editor.sel, true);
};
$('rerollBtn').onclick = () => { sfx.play('whoosh'); room.send({ t: 'reroll' }); };
$('submitBtn').onclick = () => {
  if (!editor.boxes.some((b) => b.text.trim())) { toast('Schreib erst einen Text 😉', { err: true }); return; }
  sfx.play('submit');
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  clearTimeout(draftTimer); keepDraftLocal();
  room.send({ t: 'submit', boxes: editor.boxes });
  toast('Dein Meisterwerk wurde eingereicht!');
};
$('stageEditBtn').onclick = () => { room.send({ t: 'unsubmit' }); };

// BEWERTEN -------------------------------------------------------------------
function renderVote() {
  const v = S.vote;
  show('vote');
  setHeader({ small: roundSmall('Meme', v.idx + 1, v.total), title: 'Bewerte das Meme', bar: !!localDeadline });
  const key = `${S.round}:${v.idx}`;
  if (myRoundKey !== key) {
    myRoundKey = key;
    renderMeme($('voteMeme'), v.meme.tpl, v.meme.boxes, { still: S.settings.gifs === false });
  }
  $('voteTopic').classList.toggle('hidden', !S.topic);
  $('voteTopic').textContent = S.topic ? `Thema: ${S.topic}` : '';
  const mine = v.author === myId();
  const myV = myVotes[key];
  const ctr = $('voteControls');
  ctr.classList.toggle('off', mine);
  ctr.classList.toggle('voted', myV !== undefined);
  ctr.querySelectorAll('.vc').forEach((b) => b.classList.toggle('sel', myV !== undefined && +b.dataset.v === myV));
  $('mehLabel').textContent = myV === 1 ? 'Nice!' : myV === -1 ? 'Nope' : 'Meh';
  // Buddy
  const bb = $('buddyBtn');
  const buddies = v.buddies || {};
  const myBuddy = buddies[myId()];
  const buddyOff = S.settings.noBuddy || S.settings.mode === 'relaxed';
  bb.classList.toggle('hidden', buddyOff);
  bb.classList.toggle('given', myBuddy === v.author);
  bb.disabled = mine || !!myBuddy;
  bb.querySelector('.blabel').textContent = myBuddy === v.author ? 'Dein Buddy!' : myBuddy ? 'Vergeben' : 'Buddy';
  bb.title = myBuddy ? 'Du hast deinen Meme Buddy diese Runde schon vergeben' : 'Meme Buddy vergeben: du bekommst die Hälfte der Punkte dieses Memes';
  $('voteNote').textContent = mine ? '🫣 Das ist dein Meme! Mal sehen, was die anderen sagen …' : `${v.voted}/${v.eligible} haben abgestimmt`;
  $('voteNextBtn').classList.toggle('hidden', !(isHost() && S.settings.hostControl));
}
$('voteControls').addEventListener('click', (e) => {
  const b = e.target.closest('.vc');
  if (!b || !S || S.phase !== 'vote' || S.vote.author === myId()) return;
  const v = +b.dataset.v;
  myVotes[`${S.round}:${S.vote.idx}`] = v;
  sfx.play(v === 1 ? 'up' : v === -1 ? 'down' : 'meh');
  room.send({ t: 'vote', v, idx: S.vote.idx });
  renderVote();
});
$('buddyBtn').onclick = () => {
  if (!S || S.phase !== 'vote') return;
  sfx.play('buddy');
  room.send({ t: 'buddy', idx: S.vote.idx });
  toast('Meme Buddy vergeben 💞 – du bekommst die Hälfte seiner Punkte!');
};
$('voteDlBtn').onclick = () => S && S.vote && downloadMeme(S.vote.meme, `machs-meme-r${S.round}-${S.vote.idx + 1}`);
$('voteSaveBtn').onclick = () => S && S.vote && saveMeme(S.vote.meme, playerById(S.vote.author) || {});
$('voteNextBtn').onclick = () => room.send({ t: 'next' });

// ERGEBNISSE -----------------------------------------------------------------
function memeCard(m, i, opts = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'mcard';
  const el = document.createElement('div'); el.className = 'meme';
  const relaxed = opts.relaxed;
  const medal = !relaxed && i < 3 && m.pts > 0 ? ['🥇', '🥈', '🥉'][i] : '';
  wrap.appendChild(el);
  const info = document.createElement('div');
  info.innerHTML = `<div class="mc-row"><span class="mc-by">${medal ? `<span class="mc-medal">${medal}</span> ` : ''}von <b>${esc(m.name)}</b></span>
    ${relaxed ? '' : `<span class="mc-pts"><b class="${m.pts < 0 ? 'neg' : ''}">${m.pts}</b> Punkte</span>`}</div>
    <div class="mc-row" style="margin-top:8px"><span class="mc-buddies">${m.buddies ? `${m.buddies.map((b) => avHtml(b, 'mini')).join('')}<b>${m.buddies.length}</b>&nbsp;Meme Buddies` : (m.round ? `Runde ${m.round}` : '')}</span>
    <span class="mc-acts"><button class="round-btn light" data-a="dl" type="button" title="Herunterladen" aria-label="Herunterladen">⤓</button>
    <button class="round-btn yellow" data-a="save" type="button" title="Speichern" aria-label="Speichern">⭐</button></span></div>`;
  wrap.appendChild(info);
  info.querySelector('[data-a=dl]').onclick = () => downloadMeme(m.meme, `machs-meme-${(m.name || 'meme').replace(/[^a-z0-9]+/gi, '-')}`);
  info.querySelector('[data-a=save]').onclick = (e) => { saveMeme(m.meme, m); e.currentTarget.classList.add('on'); };
  requestAnimationFrame(() => renderMeme(el, m.meme.tpl, m.meme.boxes, { still: S && S.settings.gifs === false }));
  return wrap;
}
let resultsKey = '';
function renderResults() {
  show('results');
  const R = S.results || { memes: [], gains: {} };
  setHeader({ small: roundSmall(), title: 'Abstimmungsergebnisse', bar: !!localDeadline });
  const key = `${S.round}:${R.memes.length}`;
  if (resultsKey !== key) {
    resultsKey = key;
    const list = $('resMemes'); list.innerHTML = '';
    R.memes.forEach((m, i) => list.appendChild(memeCard(m, i, { relaxed: R.relaxed })));
  }
  $('noMemes').classList.toggle('hidden', !R.empty);
  document.querySelector('#scr-results .divider-title').classList.toggle('hidden', R.empty);
  renderBoard($('scoreList'), R);
  $('resNextBtn').classList.toggle('hidden', !(isHost() && S.settings.hostControl));
}
const openRows = new Set();
function renderBoard(box, R) {
  if (R.relaxed) { box.innerHTML = '<div class="panel" style="text-align:center">😌 Entspannt-Modus: keine Punkte, nur Memes.</div>'; return; }
  const sorted = S.players.slice().sort((a, b) => b.score - a.score);
  box.innerHTML = sorted.map((p, i) => {
    const g = R.gains && R.gains[p.id];
    const mine = p.id === myId();
    const open = mine || openRows.has(p.id);
    const line = (label, v) => (v ? `<div><span>${label}</span><span class="v ${v < 0 ? 'neg' : ''}">${v > 0 ? '+' : ''}${v}</span></div>` : '');
    const det = g ? line('Meme-Punkte', g.meme) + line('Buddy-Bonus', g.buddyBonus) + line('Buddy-Anteil', g.share) + line('Kein-Meme-Abzug', g.penalty) : '';
    return `<button class="srow ${mine ? 'me' : ''} ${open && det ? 'open' : ''} ${p.off ? 'off' : ''}" data-row="${esc(p.id)}" type="button">
      <div class="sr-main"><span class="pos ${i === 0 ? '' : i === 1 ? 'p2' : i === 2 ? 'p3' : 'px'}">${i + 1}.</span>${avHtml(p)}<span class="nm">${esc(p.name)}</span>
      <span class="pts ${p.score < 0 ? 'neg' : ''}">${p.score}</span></div><div class="sr-det">${det}</div></button>`;
  }).join('');
}
$('scoreList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-row]'); if (!b) return;
  const id = b.dataset.row; if (openRows.has(id)) openRows.delete(id); else openRows.add(id);
  renderBoard($('scoreList'), S.results || {});
});
$('resNextBtn').onclick = () => room.send({ t: 'next' });

// FINALE ---------------------------------------------------------------------
let finalKey = '';
function renderFinal() {
  show('final');
  setHeader({ small: roundSmall('Runde', S.settings.rounds), title: 'GG, es ist vorbei' });
  const R = S.results || {};
  const relaxed = S.settings.mode === 'relaxed';
  const sorted = S.players.slice().sort((a, b) => b.score - a.score);
  const meP = sorted.findIndex((p) => p.id === myId());
  const meS = sorted[meP];
  $('finalSum').innerHTML = relaxed ? '<span>😌 Entspannt gespielt – danke fürs Mitmachen!</span>'
    : `<span>Deine Punkte: <b>${meS ? meS.score : 0}</b></span><span>Platz: <b class="gold">${meP + 1}</b> von ${sorted.length}</span>`;
  const top = relaxed ? [] : [[sorted[1], 'p2', '2'], [sorted[0], 'p1', '1'], [sorted[2], 'p3', '3']].filter((x) => x[0]);
  $('podium').classList.toggle('hidden', relaxed);
  $('podium').innerHTML = top.map(([p, c, n]) => `<div class="pod ${c}"><div class="place">${n}.</div>
    <div class="ring" style="background:${avColor(p.avatar + p.name)}">${esc(p.avatar)}</div><div class="who">${esc(p.name)}</div><div class="sc">${p.score}</div></div>`).join('');
  $('againBtn').textContent = 'Zurück zur Lobby 🎮';
  $('finalNote').textContent = isHost() ? 'Du bist Spielleiter: damit holst du alle zurück in die Lobby.' : '';
  const key = `${(S.gallery || []).length}:${S.round}`;
  if (finalKey !== key) {
    finalKey = key;
    const gal = $('gallery'); gal.innerHTML = '';
    (S.gallery || []).forEach((m, i) => gal.appendChild(memeCard({ ...m, buddies: null }, i, { relaxed })));
    if (!(S.gallery || []).length) gal.innerHTML = '<p style="text-align:center">Keine Memes 😴</p>';
  }
  void R;
}
$('againBtn').onclick = () => {
  sfx.play('click');
  if (isHost()) room.send({ t: 'again' });
  else { localLobby = true; render(); }
};
$('topflopBtn').onclick = () => $('gallery').scrollIntoView({ behavior: 'smooth', block: 'start' });
function confetti() {
  const box = $('confetti'); box.innerHTML = '';
  const cols = ['#ffd233', '#35f2e2', '#ff58d5', '#3ee45d', '#ff8a1f', '#2fa4ff', '#fff'];
  for (let i = 0; i < 90; i++) {
    const c = document.createElement('i');
    c.style.left = Math.random() * 100 + '%';
    c.style.background = pick(cols);
    c.style.animationDuration = 2.4 + Math.random() * 2.6 + 's';
    c.style.animationDelay = Math.random() * 1.6 + 's';
    if (Math.random() < 0.4) { c.style.borderRadius = '50%'; c.style.width = c.style.height = '9px'; }
    box.appendChild(c);
  }
  setTimeout(() => { box.innerHTML = ''; }, 7500);
}

// DOWNLOAD + SAMMLUNG --------------------------------------------------------
async function downloadMeme(meme, base) {
  const animate = meme.tpl.gif && !(S && S.settings.gifs === false);
  sfx.play('click');
  if (animate) {
    const t = toast('GIF wird erstellt … 0 %', { ms: 120000 });
    try {
      const blob = await memeToGifBlob(meme, (p) => t.set(`GIF wird erstellt … ${Math.round(p * 100)} %`));
      t.close();
      await saveBlob(blob, base + '.gif');
      return;
    } catch (e) { console.warn('GIF-Export fehlgeschlagen, nehme PNG', e); t.close(); }
  }
  try { await saveBlob(await memeToPngBlob(meme), base + '.png'); }
  catch (e) { console.warn(e); toast('Download hat nicht geklappt 😕', { err: true }); }
}
function getSaved() { try { return JSON.parse(lsGet('mm_saved', '[]')) || []; } catch (e) { return []; } }
function saveMeme(meme, by) {
  const list = getSaved();
  const sig = JSON.stringify([meme.tpl.id, meme.boxes.map((b) => b.text)]);
  if (list.some((x) => JSON.stringify([x.meme.tpl.id, x.meme.boxes.map((b) => b.text)]) === sig)) { toast('Schon gespeichert ⭐'); return; }
  list.unshift({ meme, name: by.name || '', avatar: by.avatar || '', t: Date.now() });
  lsSet('mm_saved', JSON.stringify(list.slice(0, 60)));
  sfx.play('buddy');
  toast('In „Meine Memes“ gespeichert ⭐');
  updateSavedCount();
}
function updateSavedCount() { const n = getSaved().length; $('savedCount').textContent = n ? `(${n})` : ''; $('savedBtn').classList.toggle('hidden', !n); }
$('savedBtn').onclick = () => {
  const list = getSaved();
  openModal(`<h2>Meine gespeicherten Memes</h2><div class="saved-grid" id="savedGrid"></div><div class="modal-btns"><button class="btn blue" id="savedClose" type="button">Schließen</button></div>`, (card) => {
    card.style.width = 'min(900px, 100%)';
    const grid = card.querySelector('#savedGrid');
    list.forEach((x, i) => {
      const w = document.createElement('div'); w.className = 'mcard';
      const el = document.createElement('div'); el.className = 'meme';
      w.appendChild(el);
      const row = document.createElement('div'); row.className = 'mc-row';
      row.innerHTML = `<span class="mc-by">von <b>${esc(x.name || '?')}</b></span><span class="mc-acts"><button class="round-btn light" data-a="dl" type="button" aria-label="Herunterladen">⤓</button><button class="round-btn light" data-a="rm" type="button" aria-label="Löschen">🗑</button></span>`;
      row.querySelector('[data-a=dl]').onclick = () => downloadMeme(x.meme, 'machs-meme-' + (i + 1));
      row.querySelector('[data-a=rm]').onclick = () => { const l = getSaved(); l.splice(i, 1); lsSet('mm_saved', JSON.stringify(l)); updateSavedCount(); closeModal(); if (l.length) $('savedBtn').click(); };
      w.appendChild(row); grid.appendChild(w);
      requestAnimationFrame(() => renderMeme(el, x.meme.tpl, x.meme.boxes));
    });
    card.querySelector('#savedClose').onclick = closeModal;
  });
};
updateSavedCount();

// TIMER ----------------------------------------------------------------------
let lastTickSec = -1;
setInterval(() => {
  if (!S) return;
  const fill = $('hdrFill'), secs = $('hdrSecs');
  if (!localDeadline || !S.totalMs) { fill.style.width = '0'; secs.classList.add('hidden'); }
  else {
    const left = Math.max(0, localDeadline - Date.now());
    const s = Math.ceil(left / 1000);
    fill.style.width = `calc(${(left / S.totalMs) * 100}% - ${(left / S.totalMs) * 24}px)`;
    const low = s <= 10 && ['create', 'vote', 'results'].includes(S.phase);
    fill.classList.toggle('low', low && S.phase === 'create');
    secs.classList.toggle('hidden', !low);
    secs.textContent = `${s} Sek.`;
    if (S.phase === 'create' && s <= 5 && s > 0 && s !== lastTickSec) { lastTickSec = s; sfx.play('tick'); }
  }
  if (S.phase === 'lobby' && localAuto && curScreen === 'lobby') $('lobbyMsg').textContent = autoText();
}, 200);

// CHAT -----------------------------------------------------------------------
let unread = 0;
function updateBadge() { $('chatBadge').textContent = unread > 9 ? '9+' : unread; $('chatBadge').classList.toggle('hidden', !unread); }
function addChat(m) {
  const log = $('chatLog');
  const d = document.createElement('div');
  if (m.sys) { d.className = 'sys'; d.textContent = m.text; }
  else { d.innerHTML = `<span class="who">${esc(m.avatar)} ${esc(m.name)}:</span> `; d.appendChild(document.createTextNode(m.text)); }
  log.appendChild(d);
  while (log.children.length > 120) log.firstChild.remove();
  log.scrollTop = log.scrollHeight;
  if ($('chat').classList.contains('hidden')) { unread++; updateBadge(); if (!m.sys) sfx.play('chat'); }
}
$('chatFab').onclick = () => {
  const c = $('chat'); c.classList.toggle('hidden');
  if (!c.classList.contains('hidden')) { unread = 0; updateBadge(); $('chatLog').scrollTop = $('chatLog').scrollHeight; if (matchMedia('(hover: hover)').matches) $('chatInput').focus(); }
};
$('chatClose').onclick = () => $('chat').classList.add('hidden');
$('chatForm').onsubmit = (e) => {
  e.preventDefault();
  const v = $('chatInput').value.trim();
  if (v && room) room.send({ t: 'chat', text: v });
  $('chatInput').value = '';
};

// TON + EINSTELLUNGEN --------------------------------------------------------
function showSound() { $('soundBtn').classList.toggle('muted', sfx.muted); $('soundBtn').textContent = sfx.muted ? '🔇' : '📣'; $('muteChk').checked = sfx.muted; $('volRange').value = Math.round(sfx.volume * 100); }
$('soundBtn').onclick = () => { sfx.muted = !sfx.muted; showSound(); sfx.play('click'); };
$('gearBtn').onclick = (e) => { e.stopPropagation(); $('gearPop').classList.toggle('hidden'); };
$('volRange').oninput = (e) => { sfx.volume = +e.target.value / 100; };
$('volRange').onchange = () => sfx.play('pop');
$('muteChk').onchange = (e) => { sfx.muted = e.target.checked; showSound(); };
document.addEventListener('click', (e) => { if (!$('gearPop').contains(e.target) && e.target !== $('gearBtn')) $('gearPop').classList.add('hidden'); });
showSound();

// VERLASSEN ------------------------------------------------------------------
$('leaveBtn').onclick = () => {
  if (!room) { show('start'); return; }
  confirmBox('Lobby verlassen?', isHost() && S && S.players.length > 1 ? 'Du bist Spielleiter – wenn du gehst, ist die Lobby für alle vorbei.' : 'Willst du die Lobby wirklich verlassen?', 'Verlassen', () => resetToStart());
};

// ---------------------------------------------------------------------------
// START: Lobby erstellen / beitreten
// ---------------------------------------------------------------------------
function newRoom() {
  if (typeof Peer === 'undefined') { toast('Verbindungsbibliothek konnte nicht geladen werden. Ist das Netz blockiert?', { err: true, ms: 5000 }); return null; }
  const r = new Room(GAME_ID);
  r.onHostMessage = (msg) => { if (room === r) onHostMessage(msg); };
  r.onHostLost = () => { if (room === r) startReconnect(); };
  return r;
}
// --- Wiederverbinden (Client) -------------------------------------------------
const CLIENT_KEY = 'mm_client';
const SID = (() => {
  let v = ssGet('mm_sid');
  if (!v) { v = Math.random().toString(36).slice(2, 10) + Date.now().toString(36); ssSet('mm_sid', v); }
  return v;
})();
let lastHostMsg = 0;
let reconnecting = null;
let reconnectToast = null;
let needResync = false;
const hello = () => ({ ...readProfile(), sid: SID });
function saveClientInfo() {
  if (!room || room.isHost || !room.code) return;
  ssSet(CLIENT_KEY, JSON.stringify({ code: room.code, isPublic: room.isPublic, t: Date.now() }));
}
async function joinTarget(r, code, isPublic) {
  if (isPublic) return r.joinPublic(+String(code).replace(/\D/g, ''), hello());
  return r.joinPrivate(code, hello());
}
function startReconnect() {
  if (reconnecting || !room || room.isHost) return;
  const old = room;
  const code = old.code, isPublic = old.isPublic;
  old.onHostLost = () => {}; old.onHostMessage = () => {};
  try { old.leave(); } catch (e) {}
  const job = { cancelled: false };
  reconnecting = job;
  reconnectToast = toast('📶 Verbindung weg – verbinde neu …', { err: true, ms: 600000 });
  (async () => {
    const waits = [300, 1500, 2500, 4000, 5000, 6000, 8000, 10000, 12000];
    for (let i = 0; i < waits.length; i++) {
      await new Promise((r) => setTimeout(r, waits[i]));
      if (job.cancelled || reconnecting !== job) return;
      reconnectToast && reconnectToast.set(`📶 Verbindung weg – verbinde neu … (Versuch ${i + 1})`);
      const r = newRoom(); if (!r) break;
      let ok = false;
      try { ok = await joinTarget(r, code, isPublic); } catch (e) { ok = false; }
      if (job.cancelled || reconnecting !== job) { if (ok) r.leave(); return; }
      if (ok) {
        room = r; reconnecting = null; needResync = true; lastHostMsg = Date.now();
        if (reconnectToast) { reconnectToast.close(); reconnectToast = null; }
        toast('Wieder verbunden! 🎉');
        return;
      }
      try { r.leave(); } catch (e) {}
    }
    if (reconnecting !== job) return;
    reconnecting = null;
    if (reconnectToast) { reconnectToast.close(); reconnectToast = null; }
    toast('Verbindung zum Spielleiter verloren 😢', { err: true, ms: 5000 });
    room = old; // damit resetToStart sauber aufräumt
    resetToStart(true);
  })();
}
// Herzschlag: Client meldet sich alle 3 s beim Host; kommt 10 s nichts vom Host, neu verbinden
setInterval(() => {
  if (!room || room.isHost || reconnecting || !S) return;
  room.send({ t: 'ping' });
  if (lastHostMsg && Date.now() - lastHostMsg > 10000) startReconnect();
}, 3000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !room || room.isHost || reconnecting || !S) return;
  room.send({ t: 'ping' });
  const before = lastHostMsg;
  // nach dem Zurückkehren in den Tab: kommt nicht bald etwas vom Host, ist die Leitung tot
  setTimeout(() => { if (room && !room.isHost && !reconnecting && lastHostMsg === before && Date.now() - lastHostMsg > 4500) startReconnect(); }, 4000);
});

async function busy(btn, fn) {
  if (btn.dataset.busy) return;
  btn.dataset.busy = '1';
  const label = btn.innerHTML;
  btn.disabled = true;
  if (!btn.classList.contains('card-play')) btn.innerHTML = '⏳ Verbinde …';
  else btn.querySelector('.cp-hover').textContent = '⏳ Verbinde …';
  try { await fn(); }
  catch (e) { console.warn(e); toast(errText(e), { err: true, ms: 4500 }); if (room && !room.peer) room = null; }
  finally { btn.disabled = false; btn.innerHTML = label; delete btn.dataset.busy; }
}
function errText(e) {
  const t = e && e.type;
  if (t === 'network' || t === 'server-error' || t === 'socket-error' || (e && e.message === 'timeout')) return 'Keine Verbindung zum Vermittlungsserver. Ist das Netz blockiert?';
  if (t === 'browser-incompatible') return 'Dein Browser unterstützt kein WebRTC 😕';
  return e && e.message ? e.message : 'Etwas ist schiefgelaufen';
}
function enteredRoom() { lobbyStep = 'pack'; captionFontReady(); }
async function hostPrivate() {
  readProfile();
  room = newRoom(); if (!room) return;
  await room.createPrivate();
  setupHost(); enteredRoom(); saveHostNow();
  codeShown = false;
  history.replaceState(null, '', `?code=${room.code}`);
}
async function joinCode(code) {
  code = String(code || '').trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) { toast('Der Code hat 4 Buchstaben', { err: true }); return; }
  readProfile();
  let ok = false;
  for (let i = 0; i < 2 && !ok; i++) {
    if (i) await new Promise((r) => setTimeout(r, 1200));
    room = newRoom(); if (!room) return;
    ok = await room.joinPrivate(code, hello());
    if (!ok) { room.leave(); room = null; }
  }
  if (!ok) { toast('Lobby nicht gefunden 🤔', { err: true }); return; }
  lastHostMsg = Date.now();
  enteredRoom();
  history.replaceState(null, '', `?code=${code}`);
}
async function joinPub(n) {
  readProfile();
  room = newRoom(); if (!room) return false;
  const ok = await room.joinPublic(n, hello());
  if (!ok) { room.leave(); room = null; toast('Lobby nicht mehr da 🤔', { err: true }); return false; }
  lastHostMsg = Date.now();
  enteredRoom();
  history.replaceState(null, '', `?pub=${n}`);
  return true;
}
async function quickPlay() {
  readProfile();
  let list = [];
  try { list = await Room.listPublic(GAME_ID); } catch (e) {}
  const open = list.filter((l) => (l.phase === 'lobby' || (l.late && l.phase !== 'final')) && l.players < l.max).sort((a, b) => (a.phase === 'lobby' ? 0 : 1) - (b.phase === 'lobby' ? 0 : 1) || b.players - a.players);
  for (const l of open) { if (await joinPub(l.slot)) return; }
  room = newRoom(); if (!room) return;
  await room.createPublic();
  setupHost(); enteredRoom(); saveHostNow();
  toast('Neue öffentliche Lobby erstellt – warte auf Mitspieler!');
}
const modeName = (id) => (MODES.find((m) => m.id === id) || {}).name || '';
async function browse() {
  show('public');
  const box = $('browseList');
  box.innerHTML = '<div class="browse-empty">Suche offene Lobbys …</div>';
  let list = [];
  try { list = await Room.listPublic(GAME_ID); } catch (e) { box.innerHTML = `<div class="browse-empty">${esc(errText(e))}</div>`; return; }
  if (curScreen !== 'public') return;
  if (!list.length) { box.innerHTML = '<div class="browse-empty">Gerade keine offenen Lobbys. Starte doch eine mit „Schnelles Spiel“!</div>'; return; }
  box.innerHTML = list.map((l) => {
    const canJoin = l.players < l.max && (l.phase === 'lobby' || (l.late && l.phase !== 'final'));
    return `<div class="browse-item"><span class="bi-av">🎮</span><div class="bi-main"><div>Lobby von ${esc(l.host)}</div>
      <div class="bi-sub">${l.players}/${l.max} Spieler · ${esc(modeName(l.mode))} · ${l.phase === 'lobby' ? 'wartet' : 'läuft gerade'}</div></div>
      <button class="btn small green" data-slot="${l.slot}" type="button" ${canJoin ? '' : 'disabled'}>Rein da</button></div>`;
  }).join('');
}
$('browseList').addEventListener('click', (e) => { const b = e.target.closest('[data-slot]'); if (b) busy(b, () => joinPub(+b.dataset.slot)); });
$('refreshBtn').onclick = () => browse();
$('browseBtn').onclick = () => { sfx.play('click'); browse(); };
$('quickBtn').onclick = (e) => { sfx.play('click'); busy(e.currentTarget, quickPlay); };
$('privateBtn').onclick = () => { sfx.play('click'); show('private'); setTimeout(() => { if (matchMedia('(hover: hover)').matches) $('codeBoxes').querySelector('input').focus(); }, 50); };
$('createLobbyBtn').onclick = (e) => busy(e.currentTarget, hostPrivate);
$('howtoBtn').onclick = () => $('howto').scrollIntoView({ behavior: 'smooth' });

// Code-Kästchen
const codeInputs = [...$('codeBoxes').querySelectorAll('input')];
function codeValue() { return codeInputs.map((i) => i.value).join('').toUpperCase(); }
function tryCode() {
  const v = codeValue();
  if (v.length === 4 && !room) { codeInputs.forEach((i) => i.blur()); busy($('createLobbyBtn'), () => joinCode(v)); }
}
codeInputs.forEach((inp, i) => {
  inp.addEventListener('input', () => {
    const clean = inp.value.toUpperCase().replace(/[^A-Z]/g, '');
    if (clean.length > 1) { // eingefügt
      clean.slice(0, 4 - i).split('').forEach((ch, k) => { codeInputs[i + k].value = ch; });
      const nx = codeInputs[Math.min(3, i + clean.length)]; nx.focus();
    } else {
      inp.value = clean;
      if (clean && i < 3) codeInputs[i + 1].focus();
    }
    tryCode();
  });
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !inp.value && i > 0) { codeInputs[i - 1].focus(); codeInputs[i - 1].value = ''; e.preventDefault(); }
    if (e.key === 'Enter') tryCode();
  });
  inp.addEventListener('paste', (e) => {
    const t = (e.clipboardData || window.clipboardData).getData('text').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    if (!t) return;
    e.preventDefault();
    t.split('').forEach((ch, k) => { if (codeInputs[k]) codeInputs[k].value = ch; });
    tryCode();
  });
});

// Einladungslink: ?code=ABCD oder ?pub=3
const params = new URLSearchParams(location.search);
let inviteJoin = null;
if (params.get('code')) {
  const c = params.get('code').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  inviteJoin = () => joinCode(c);
} else if (params.get('pub')) {
  const n = +params.get('pub');
  if (n >= 1 && n <= 8) inviteJoin = () => joinPub(n);
}
// Neu geladen? Host stellt seine Lobby wieder her, Mitspieler steigen automatisch wieder ein.
const hostSave = loadHostSave();
const clientSave = (() => { try { const x = JSON.parse(ssGet(CLIENT_KEY) || 'null'); return x && Date.now() - x.t < 3 * 60000 ? x : null; } catch (e) { return null; } })();
const urlCode = (params.get('code') || '').toUpperCase();
const isReload = (() => { try { return performance.getEntriesByType('navigation')[0].type === 'reload'; } catch (e) { return false; } })();
if (hostSave && (hostSave.isPublic ? isReload : urlCode === hostSave.code)) {
  inviteJoin = null;
  (async () => {
    const t = toast('🔄 Deine Lobby wird wiederhergestellt …', { ms: 60000 });
    try {
      room = newRoom(); if (!room) { t.close(); return; }
      const ok = await claimHostId(room, hostSave.code, hostSave.isPublic);
      t.close();
      if (!ok) { room.leave(); room = null; ssSet(HOST_KEY, null); toast('Lobby konnte nicht wiederhergestellt werden 😕', { err: true, ms: 4500 }); return; }
      setupHost(hostSave.H); enteredRoom();
      if (!hostSave.isPublic) history.replaceState(null, '', `?code=${room.code}`);
      toast('Lobby wiederhergestellt – alle können wieder rein!');
    } catch (e) { t.close(); console.warn(e); room = null; ssSet(HOST_KEY, null); toast(errText(e), { err: true, ms: 4500 }); }
  })();
} else if (clientSave && inviteJoin && (clientSave.isPublic ? params.get('pub') : urlCode === clientSave.code)) {
  show('invite');
  busy($('inviteJoinBtn'), inviteJoin);
} else if (inviteJoin) { show('invite'); }
$('inviteJoinBtn').onclick = (e) => { sfx.play('click'); busy(e.currentTarget, inviteJoin || (async () => {})); };
$('inviteBack').onclick = () => { history.replaceState(null, '', location.pathname); show('start'); };

window.addEventListener('beforeunload', (e) => {
  if (room && room.isHost && S && S.players.length > 1) { e.preventDefault(); e.returnValue = ''; }
});
document.querySelectorAll('.qm').forEach((q) => q.addEventListener('click', (e) => { e.preventDefault(); toast(q.title, { ms: 4000 }); }));

// Test-/Fehlersuche-Hilfe (nur lesend): window.__machsMeme.state()
window.__machsMeme = { state: () => ({ H, S, room: room && { id: room.myId, isHost: room.isHost, code: room.code } }) };
