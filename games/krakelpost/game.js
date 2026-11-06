// Krakelpost – Stille Post mit Zeichnungen. Ein Spiel in der Zockbox – made by Oskar
// Multiplayer über ../../shared/net.js (PeerJS/WebRTC). Der Browser, der die Lobby erstellt, ist der Host.
import { Room } from '../../shared/net.js';
import { AVATARS, getProfile, setName, setAvatar, randomName, NAME_MAX } from '../../shared/profile.js';
import { Board, PALETTE, SIZES, W as CW, H as CH } from './draw.js';
import { albumToPngBlob, albumToGifBlob, saveBlob, corpseCanvas, CORPSE_STRIP } from './export.js';
import { sfx } from './sound.js';
import { qrSvg } from './qr.js';

const GAME_ID = 'krakelpost-v1'; // nicht ändern – Peer-IDs: zockbox-krakelpost-v1-p-CODE

// ---------------------------------------------------------------------------
// Modi (Namen + Beschreibungen nach der deutschen Gartic-Phone-Fassung, eigener Code/Design)
// flow: sz = Schreiben→Zeichnen, z = nur Zeichnen, s = nur Schreiben, einsatz = ein Satz für alle,
//       sandwich, ergaenzen, hintergrund, solo (eigenes Blatt), soloanim (eigene Animation)
// ---------------------------------------------------------------------------
const MODES = [
  { id: 'normal', ico: '✏️', name: 'Normal', desc: 'Die Grundlage von allem! Schreibe oder zeichne bis zur letzten Runde.', s: { flow: 'sz' } },
  { id: 'imitation', ico: '🪞', name: 'Imitation', desc: 'Konzentriere dich! Repliziere die Zeichnungen, während die Uhr immer schneller läuft.', s: { flow: 'z', time: 'regressiv', copy: true } },
  { id: 'animation', ico: '🎞️', name: 'Animation', desc: 'Zeit für Animationen! Erstelle gemeinsam mit anderen Animationen.', s: { flow: 'z', anim: true } },
  { id: 'eisbrecher', ico: '🧊', name: 'Eisbrecher', desc: 'Spiele mit nur einem Satz! Stelle Fragen und habe mit den Zeichnungen der anderen Spaß.', s: { flow: 'einsatz', turns: 'alle1' } },
  { id: 'fremdkoerper', ico: '🧟', name: 'Fremdkörper', desc: 'Erstelle surrealistische Charaktere, die oben an den Zeichnungen verbunden sind.', s: { flow: 'z', keep: 'oben', turns: '3', time: 'langsam' } },
  { id: 'ergaenzen', ico: '🧩', name: 'Ergänzen', desc: 'Vervollständige die Skizze! Beginne mit Linien und sieh dir Interpretationen an.', s: { flow: 'ergaenzen', turns: 'alle1', first: 'schneller' } },
  { id: 'meisterwerk', ico: '🖼️', name: 'Meisterwerk', desc: 'Erschaffe ein Kunstwerk! Spiele eine einzelne Runde ohne Zeitlimit.', s: { flow: 'solo', turns: '1', time: 'unendlich' } },
  { id: 'story', ico: '📖', name: 'Story', desc: 'Schreibe eine Erzählung nur mithilfe des vorherigen Satzes als Referenz.', s: { flow: 's' } },
  { id: 'fehlend', ico: '🕳️', name: 'Fehlendes Teil', desc: 'Starte mit unvollständiger Zeichnung. In jeder Runde wird ein Teil addiert und eins entfernt.', s: { flow: 'z', keep: 'vorherige' } },
  { id: 'geheimnis', ico: '🤫', name: 'Geheimnis', desc: 'Alle Aktionen sind ein Mysterium! Zeichnungen und Sätze sind versteckt.', s: { flow: 'sz', time: 'schnell', secret: true } },
  { id: 'koop', ico: '🤝', name: 'Koop', desc: 'Gemeinsame Kreativität! Starte mit einem Satz und verfeinere die Zeichnungen.', s: { flow: 'einsatz', keep: 'alle', turns: '6', time: 'schnell' } },
  { id: 'punkte', ico: '🏆', name: 'Punkte', desc: 'Gib alles! Jedes Mal, wenn du die Bedeutung von Sätzen und Zeichnungen beibehältst, erzielst du Punkte.', s: { flow: 'sz', score: true } },
  { id: 'sandwich', ico: '🥪', name: 'Sandwich', desc: 'Beginne mit dem Schreiben und zeichne bis zum Ende! Beschreibe die letzte Zeichnung.', s: { flow: 'sandwich', copy: true } },
  { id: 'hintergrund', ico: '🏞️', name: 'Hintergrund', desc: 'Animationen mit Kontext! Erstelle feste Hintergründe für deine Animationen.', s: { flow: 'hintergrund', anim: true, turns: 'doppelt', first: 'langsamer' } },
  { id: 'solo', ico: '🎬', name: 'Solo', desc: 'Erstelle deine eigene Animation in 5 Frames! Spiele alleine oder mit Freunden.', s: { flow: 'soloanim', anim: true, turns: '5', time: 'dynamisch' } },
  { id: 'speedrun', ico: '⚡', name: 'Speedrun', desc: 'Wie Normal – nur mit superkurzen Zeiten. Kein Platz für Meisterwerke!', s: { flow: 'sz', time: 'speedrun' } },
  { id: 'keindruck', ico: '😌', name: 'Kein Druck', desc: 'Die Uhr tickt erst, wenn die Mehrheit auf „Fertig!“ gedrückt hat.', s: { flow: 'sz', time: 'dynamisch' } },
  { id: 'eigener', ico: '🛠️', name: 'Eigener', desc: 'Bau dir dein eigenes Spiel! Unter „Einstellungen“ kombinierst du Ablauf, Vorlage, Animation, Nachzeichnen und Punkte frei.', s: { flow: 'sz' } },
];
const MODE_COLORS = ['#ffd66b', '#c9b6ff', '#9fd4ff', '#b8ecea', '#a6e8cf', '#ffcf9e', '#ffb3a7', '#ffa9d0', '#d9d2c3', '#c4c7d4', '#a6e8cf', '#ffd66b', '#ffcf9e', '#9fd4ff', '#ffa9d0', '#ffb3a7', '#b8ecea', '#fff27a'];
// Frei kombinierbare Bausteine („Eigener“ Modus)
const FLOWS = [['sz', 'Schreiben ↔ Zeichnen'], ['z', 'Nur Zeichnen'], ['s', 'Nur Schreiben (Geschichte)'], ['einsatz', 'Ein Satz – alle zeichnen'], ['sandwich', 'Sandwich (Satz – Bilder – Satz)'],
  ['ergaenzen', 'Skizze ergänzen'], ['hintergrund', 'Hintergrund + Animation'], ['solo', 'Jeder für sich: ein Bild'], ['soloanim', 'Jeder für sich: Animation']];
const KEEPS = [['', 'Nichts'], ['alle', 'Am selben Bild weitermalen'], ['vorherige', 'Vorheriges Bild ergänzen'], ['oben', 'Unten anbauen (Fremdkörper)']];
const FIRSTS = [['', 'Wie die anderen'], ['schneller', 'Kürzer'], ['langsamer', 'Länger']];
const FLOW_KEYS = ['flow', 'keep', 'copy', 'anim', 'score', 'first'];
// Hält frei kombinierte Einstellungen spielbar
function normalizeSettings(s) {
  if (s.flow === 'hintergrund' || s.flow === 'soloanim') s.anim = true;
  if (['sz', 's', 'einsatz', 'sandwich', 'solo'].includes(s.flow)) s.anim = false;
  if (!(s.keep === 'alle' && ['z', 'einsatz'].includes(s.flow)) && !(['oben', 'vorherige'].includes(s.keep) && s.flow === 'z')) s.keep = '';
  if (s.anim) s.keep = '';
  if (!['z', 'sandwich'].includes(s.flow) || s.anim || s.keep) s.copy = false;
  return s;
}
const TIMES = {
  langsam: { name: 'Langsam', w: 60, d: 240 },
  normal: { name: 'Normal', w: 40, d: 150 },
  schnell: { name: 'Schnell', w: 25, d: 80 },
  speedrun: { name: 'Speedrun', w: 15, d: 40 },
  regressiv: { name: 'Regressiv (wird schneller)', w: 40, d: 150, regress: true },
  dynamisch: { name: 'Dynamisch (Kein Druck)', w: 25, d: 50, dyn: true },
  unendlich: { name: 'Unendlich (Leiter entscheidet)', inf: true },
};
const TURNS = [['wenige', 'Wenige'], ['mittel', 'Mittel'], ['alle', 'Alle'], ['alle1', 'Alle + 1'], ['doppelt', '200 %'], ['dreifach', '300 %'],
  ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6'], ['8', '8'], ['10', '10']];
const FPS = { langsam: [3, 'Langsam'], normal: [6, 'Normal'], schnell: [10, 'Schnell'] };
const MAX_OPTS = [2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 20, 25, 30];
const BASE_SETTINGS = { flow: 'sz', time: 'normal', turns: 'alle', secret: false, anim: false, copy: false, keep: '', score: false, first: '' };
const REACTS = ['❤️', '😂', '🔥', '😮', '👏'];
const IDEAS = [
  'Ein Pinguin verkauft Eis am Nordpol', 'Oma fährt Skateboard auf dem Dach', 'Ein Hai beim Zahnarzt', 'Die Katze regiert die Welt',
  'Ein Toaster verliebt sich in eine Waffel', 'Batman beim Bäcker', 'Ein Dino macht Hausaufgaben', 'Schneemann im Hochsommer',
  'Eine Giraffe im Aufzug', 'Pizza mit Ananas vor Gericht', 'Ein Roboter lernt tanzen', 'Der Mond isst Käse',
  'Zwei Tauben streiten um eine Pommes', 'Ein Alien beim Elternabend', 'Kuh fährt Achterbahn', 'Ein Gespenst hat Schluckauf',
  'Der Lehrer ist ein Krokodil', 'Ein Hamster im Fitnessstudio', 'Brokkoli auf dem roten Teppich', 'Ein Vampir am Strand',
  'Spaghetti-Monster im Schwimmbad', 'Ein Schaf zählt Menschen', 'Der Bus fliegt zur Schule', 'Ein Bär klaut Honig im Supermarkt',
  'Eine Ente als Polizistin', 'Ein Pirat ohne Schiff', 'Die Sonne trägt eine Sonnenbrille', 'Ein Kaktus will kuscheln',
  'WLAN-Router in der Wüste', 'Ein Frosch wird König', 'Banane mit Superkräften', 'Ein Elefant auf einem Einrad',
];
const ICEBREAKER_IDEAS = ['Was ist dein Lieblingsessen?', 'Zeichne dein Traumhaus', 'Welches Tier wärst du gern?', 'Zeichne deinen perfekten Sonntag', 'Was machst du in den Ferien?', 'Zeichne dein Lieblingsspiel'];
const STORY_IDEAS = ['Es war einmal ein Toaster, der fliegen wollte …', 'Eines Morgens wachte ich als Kartoffel auf …', 'Der Bus kam nie an, denn …', 'Im Keller wohnte ein sehr höflicher Drache …'];

// PeerJS loggt erwartete Fehlversuche (leere öffentliche Plätze) als Konsolenfehler – leiser stellen.
if (typeof window.Peer === 'function') {
  const OrigPeer = window.Peer;
  window.Peer = class extends OrigPeer {
    constructor(a, b) { if (a && typeof a === 'object') super({ ...a, debug: 0 }); else super(a, { ...(b || {}), debug: 0 }); }
  };
}

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const AV_COLORS = ['#ffb3a7', '#ffd66b', '#a6e8cf', '#9fd4ff', '#c9b6ff', '#ffa9d0', '#ffcf9e', '#b8ecea'];
const avColor = (k) => { let h = 0; for (const ch of String(k)) h = (h * 31 + ch.codePointAt(0)) >>> 0; return AV_COLORS[h % AV_COLORS.length]; };
// Avatare sind Briefmarken
const avHtml = (p, size = 'sm') => `<span class="sav ${size}" style="--c:${avColor(p.avatar || '')}"><i><b>${esc(p.avatar || '👻')}</b></i></span>`;
const PM_SVG = '<svg class="pic-stamp" viewBox="0 0 160 100" aria-hidden="true"><use href="#art-postmark"/></svg>';
const modeById = (id) => MODES.find((m) => m.id === id) || MODES[0];

// ---------------------------------------------------------------------------
// Toasts + Modal
// ---------------------------------------------------------------------------
function toast(msg, opts = {}) {
  const t = document.createElement('div');
  t.className = 'toast' + (opts.err ? ' err' : '');
  t.textContent = msg;
  $('toasts').appendChild(t);
  if (opts.err) sfx.play('error');
  setTimeout(() => t.classList.add('out'), (opts.ms || 2800) - 300);
  setTimeout(() => t.remove(), opts.ms || 2800);
}
function openModal(html, onMount) {
  $('modalCard').innerHTML = html; $('modal').classList.remove('hidden');
  if (onMount) onMount($('modalCard'));
}
function closeModal() { $('modal').classList.add('hidden'); $('modalCard').innerHTML = ''; }
$('modal').addEventListener('click', (e) => { if (e.target === $('modal')) closeModal(); });
function confirmBox(title, text, yes, onYes) {
  openModal(`<h2>${esc(title)}</h2><p>${esc(text)}</p><div class="modal-btns"><button class="btn" data-a="no" type="button">Abbrechen</button><button class="btn red" data-a="yes" type="button">${esc(yes)}</button></div>`, (c) => {
    c.querySelector('[data-a=no]').onclick = closeModal;
    c.querySelector('[data-a=yes]').onclick = () => { closeModal(); onYes(); };
  });
}

// ---------------------------------------------------------------------------
// Profil (gemeinsam mit der Zockbox: ph_name / ph_avatar)
// ---------------------------------------------------------------------------
const me = getProfile();
if (!me.name) me.name = setName(randomName());
function showProfile() {
  for (const id of ['avatarEmoji', 'avatarEmoji2']) $(id).textContent = me.avatar;
  for (const id of ['avatarBtn', 'avatarBtn2']) $(id).style.setProperty('--c', avColor(me.avatar));
  for (const id of ['nameInput', 'nameInput2']) if (document.activeElement !== $(id)) $(id).value = me.name;
}
function readProfile() { if (!me.name) me.name = setName(randomName()); return { name: me.name, avatar: me.avatar }; }
for (const id of ['nameInput', 'nameInput2']) {
  $(id).maxLength = NAME_MAX;
  $(id).addEventListener('input', (e) => { me.name = setName(e.target.value); });
  $(id).addEventListener('blur', () => { if (!me.name) me.name = setName(randomName()); showProfile(); });
}
for (const id of ['diceBtn', 'diceBtn2']) $(id).onclick = () => { me.name = setName(randomName()); showProfile(); sfx.play('pop'); };
function avatarPicker() {
  openModal(`<h2>Wähle deine Briefmarke</h2><div class="av-grid">${AVATARS.map((a) => `<button type="button" data-av="${a}" class="${a === me.avatar ? 'on' : ''}" aria-label="${a}">${avHtml({ avatar: a }, 'mid')}</button>`).join('')}</div>
    <div class="modal-btns"><button class="btn red" id="mOk" type="button">Passt!</button></div>`, (c) => {
    c.querySelectorAll('[data-av]').forEach((b) => b.onclick = () => {
      me.avatar = setAvatar(b.dataset.av);
      c.querySelectorAll('[data-av]').forEach((x) => x.classList.toggle('on', x === b)); sfx.play('pop'); showProfile();
    });
    c.querySelector('#mOk').onclick = closeModal;
  });
}
$('avatarBtn').onclick = avatarPicker; $('avatarBtn2').onclick = avatarPicker;
showProfile();

// ---------------------------------------------------------------------------
// Bildschirme, Kopfzeile, Timer
// ---------------------------------------------------------------------------
const SCREENS = ['start', 'invite', 'public', 'lobby', 'play', 'album', 'end'];
let curScreen = 'start';
function show(name) {
  if (curScreen !== name) {
    for (const s of SCREENS) $('scr-' + s).classList.toggle('hidden', s !== name);
    window.scrollTo({ top: 0 });
    curScreen = name;
  }
  document.body.classList.toggle('on-start', ['start', 'invite', 'public'].includes(name));
  document.body.dataset.screen = name;
}
function setHeader() { /* Kopfzeile zeigt immer das kleine Logo; Runden/Timer stehen im Spielkopf */ }
document.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => { sfx.play('click'); show(b.dataset.go); });
const soundIcon = () => { $('soundBtn').querySelector('use').setAttribute('href', sfx.muted ? '#i-mute' : '#i-sound'); };
$('soundBtn').onclick = () => { sfx.muted = !sfx.muted; soundIcon(); sfx.play('click'); };
soundIcon();

let localDeadline = 0, localTotal = 0, lastTickSec = -1;
setInterval(() => {
  const t = $('timer');
  if (!localDeadline || !S || !['play'].includes(S.phase)) { t.classList.add('hidden'); return; }
  const left = Math.max(0, localDeadline - Date.now());
  t.classList.remove('hidden');
  $('timerFill').style.strokeDashoffset = String(100 - (localTotal ? (left / localTotal) * 100 : 0));
  const sec = Math.ceil(left / 1000);
  $('timerTxt').textContent = sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : `${sec}`;
  $('timerTxt').classList.toggle('long', sec >= 60);
  t.classList.toggle('hurry', sec <= 10);
  if (sec <= 5 && sec > 0 && sec !== lastTickSec && myTask && !submitted) sfx.play('tick');
  lastTickSec = sec;
}, 200);

// ---------------------------------------------------------------------------
// HOST-LOGIK (läuft nur im Browser des Lobby-Erstellers)
// ---------------------------------------------------------------------------
let room = null;
let H = null;
let BLANK = null;
function blankPng() {
  if (BLANK) return BLANK;
  const c = document.createElement('canvas'); c.width = CW; c.height = CH;
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, CW, CH);
  BLANK = c.toDataURL('image/png'); return BLANK;
}
function newHostState() {
  const m = MODES[0];
  return {
    phase: 'lobby', players: {}, order: [],
    settings: { mode: m.id, ...BASE_SETTINGS, ...m.s, fps: 'normal', max: 10, lateJoin: true, autoAlbum: false },
    roster: [], chains: [], turn: 0, total: 0, subs: {}, endsAt: 0, totalMs: 0, collectUntil: 0, advanceAt: 0,
    album: null, reacts: {}, votes: {}, autoAt: 0,
  };
}
const present = (id) => !!H.players[id];
const activeRoster = () => H.roster.filter(present);
function cleanName(n) { return String(n || '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX) || 'Gast'; }

function publicState() {
  const st = {
    t: 'state', phase: H.phase, hostId: room.myId, code: room.code, isPublic: room.isPublic, settings: H.settings,
    players: H.order.map((id) => ({ id, name: H.players[id].name, avatar: H.players[id].avatar, spec: !!H.players[id].spec, done: H.phase === 'play' && !!H.subs[id] })),
    turn: H.turn, total: H.total,
    endsIn: H.endsAt ? Math.max(0, H.endsAt - Date.now()) : 0, totalMs: H.totalMs,
  };
  if (H.album) st.album = { i: H.album.i, shown: H.album.shown, count: H.chains[H.album.i] ? H.chains[H.album.i].steps.length : 0, total: H.chains.length };
  if (H.settings.score && (H.phase === 'album' || H.phase === 'end')) st.scores = computeScores();
  return st;
}
function sync() { if (room && room.isHost && H) room.broadcast(publicState()); }
function sysChat(text) { room.broadcast({ t: 'chat', sys: true, text }); }

function hostAddPlayer(id, hello) {
  H.players[id] = { name: cleanName(hello.name), avatar: AVATARS.includes(hello.avatar) ? hello.avatar : pick(AVATARS), spec: H.phase !== 'lobby' };
  H.order.push(id);
}
function turnCount(s, n) {
  const flow = s.flow;
  let T;
  switch (s.turns) {
    case 'wenige': T = Math.ceil(n / 2); break;
    case 'mittel': T = Math.ceil(n * 0.75); break;
    case 'alle': T = n; break;
    case 'alle1': T = n + 1; break;
    case 'doppelt': T = 2 * n; break;
    case 'dreifach': T = 3 * n; break;
    default: T = Math.max(1, parseInt(s.turns, 10) || n);
  }
  if (['sz', 'sandwich'].includes(flow)) T = Math.max(T, 3);
  if (['einsatz', 'ergaenzen', 'hintergrund'].includes(flow)) T = Math.max(T, 2);
  if (!['solo', 'soloanim'].includes(flow)) T = Math.max(T, 2);
  return Math.min(T, 60);
}
function stepKind(flow, t, T) {
  switch (flow) {
    case 'sz': return t % 2 === 0 ? 'write' : 'draw';
    case 's': return 'write';
    case 'einsatz': return t === 0 ? 'write' : 'draw';
    case 'sandwich': return t === 0 || t === T - 1 ? 'write' : 'draw';
    default: return 'draw';
  }
}
const isSoloFlow = (flow) => flow === 'solo' || flow === 'soloanim';
function chainFor(i, t, n, flow) { return isSoloFlow(flow) ? i : ((i - t) % n + n) % n; }
function albumKind(s) { return s.anim ? 'anim' : s.keep === 'oben' ? 'corpse' : 'chain'; }
function stepSeconds(s, kind, t, T) {
  const tm = TIMES[s.time] || TIMES.normal;
  if (tm.inf) return 0;
  let sec = kind === 'write' ? tm.w : tm.d;
  if (tm.regress && kind === 'draw') sec = Math.max(25, Math.round(sec * (1 - 0.75 * (t / Math.max(1, T - 1)))));
  if (t === 0 && s.first === 'schneller') sec = Math.min(sec, 30);
  if (t === 0 && s.first === 'langsamer') sec = Math.round(sec * 1.6);
  return sec;
}

function buildTask(i, t) {
  const s = H.settings, n = H.roster.length, T = H.total;
  const c = chainFor(i, t, n, s.flow);
  const steps = H.chains[c].steps;
  const prev = steps[t - 1];
  const kind = stepKind(s.flow, t, T);
  const m = modeById(s.mode);
  const task = { t: 'task', turn: t, total: T, kind, chain: c, mode: s.mode, secret: !!s.secret, title: '', kicker: '', prompt: null, ref: null, under: null, onion: null, base: null, copy: false, needLayer: false, corpseSrc: null, corpseLast: false, sec: 0 };
  if (kind === 'write') {
    task.kicker = 'Zeit zum Schreiben';
    if (t === 0) task.title = s.flow === 's' ? 'Schreibe den Anfang einer Geschichte' : s.flow === 'einsatz' ? 'Schreibe einen Satz oder eine Frage – alle zeichnen ihn' : 'Schreibe einen lustigen Satz';
    else if (prev && prev.type === 'img') { task.ref = prev.img; task.kicker = 'Was ist das?'; task.title = 'Beschreibe diese Zeichnung'; }
    else { task.prompt = prev ? prev.text : ''; task.title = 'Wie geht die Geschichte weiter?'; }
  } else {
    task.kicker = 'Zeit zum Zeichnen';
    if (s.flow === 'einsatz') {
      task.prompt = steps[0] ? steps[0].text : '';
      task.title = 'Zeichne diesen Satz';
      if (s.keep === 'alle' && prev && prev.type === 'img') { task.base = prev.img; task.title = 'Zeichne weiter an diesem Bild'; }
    } else if (t === 0) {
      task.title = ({ fremdkoerper: 'Zeichne einen Kopf', ergaenzen: 'Zeichne eine unvollständige Skizze', meisterwerk: 'Erschaffe ein Kunstwerk!', hintergrund: 'Zeichne einen Hintergrund',
        fehlend: 'Zeichne etwas – gern unvollständig', animation: 'Zeichne das erste Bild deiner Animation', solo: `Bild 1 von ${T}: Los geht's!` })[s.mode] || 'Zeichne, was dir einfällt';
      if (s.keep === 'vorherige' || s.flow === 'hintergrund') task.needLayer = true;
      if (s.keep === 'oben') task.corpseLast = T === 1;
    } else if (prev && prev.type === 'text') {
      task.prompt = prev.text; task.title = 'Zeichne diesen Satz';
    } else if (prev && prev.type === 'img') {
      if (s.copy) { task.ref = prev.img; task.copy = true; task.kicker = 'Imitation'; task.title = 'Präg dir das Bild ein – dann zeichne es nach!'; }
      else if (s.flow === 'hintergrund') {
        task.under = steps[0].img; task.needLayer = true;
        if (t >= 2) task.onion = prev.layer || null;
        task.kicker = `Bild ${t} von ${T - 1}`; task.title = t === 1 ? 'Zeichne das erste Bild über den Hintergrund' : 'Zeichne das nächste Bild deiner Animation';
      } else if (s.anim) { task.onion = prev.img; task.kicker = `Bild ${t + 1} von ${T}`; task.title = 'Zeichne das nächste Bild – das vorige scheint durch'; }
      else if (s.keep === 'vorherige') { task.under = prev.layer || prev.img; task.needLayer = true; task.title = 'Ergänze die Zeichnung!'; }
      else if (s.keep === 'oben') { task.corpseSrc = prev.img; task.corpseLast = t === T - 1; task.title = t === 1 ? 'Zeichne den Körper – oben schließt er an' : t === 2 ? 'Zeichne die Beine' : 'Zeichne weiter nach unten'; }
      else if (s.flow === 'ergaenzen') { task.under = steps[0].img; task.title = 'Vervollständige die Skizze!'; }
      else if (s.keep === 'alle') { task.base = prev.img; task.title = 'Zeichne weiter an diesem Bild'; }
      else if (s.flow === 'solo') { task.base = prev.img; task.title = `Bild ${t + 1} von ${T}: Mach weiter an deinem Bild`; }
      else { task.ref = prev.img; task.title = 'Zeichne dieses Bild nach'; }
    }
  }
  if (m.id === 'meisterwerk') task.kicker = 'Meisterwerk';
  task.sec = stepSeconds(s, kind, t, T);
  return task;
}

function hostStartGame() {
  const s = H.settings;
  for (const id of H.order) H.players[id].spec = false;
  H.roster = shuffle(H.order.slice());
  const n = H.roster.length;
  H.total = turnCount(s, n);
  H.chains = H.roster.map((id) => ({ owner: id, ownerName: H.players[id].name, ownerAvatar: H.players[id].avatar, steps: [] }));
  H.turn = 0; H.album = null; H.reacts = {}; H.votes = {};
  sysChat(`Los geht's: ${modeById(s.mode).name} · ${H.total} ${H.total === 1 ? 'Runde' : 'Runden'} ✏️`);
  room.broadcast({ t: 'newgame' });
  startTurn();
}
function startTurn() {
  H.subs = {}; H.collectUntil = 0; H.advanceAt = 0; H.phase = 'play';
  const s = H.settings;
  const kind = stepKind(s.flow, H.turn, H.total);
  const sec = stepSeconds(s, kind, H.turn, H.total);
  const dyn = (TIMES[s.time] || {}).dyn;
  H.totalMs = sec * 1000; H.endsAt = sec && !dyn ? Date.now() + sec * 1000 : 0;
  H.roster.forEach((id, i) => { if (present(id)) room.sendTo(id, buildTask(i, H.turn)); });
  sync();
}
function allSubmitted() { const a = activeRoster(); return a.length > 0 && a.every((id) => H.subs[id]); }
function onSubmitChange() {
  const s = H.settings, tm = TIMES[s.time] || {};
  if (H.phase === 'play' && tm.dyn && !H.endsAt) {
    const a = activeRoster(), done = a.filter((id) => H.subs[id]).length;
    if (done >= Math.ceil(a.length / 2) && done < a.length) {
      const kind = stepKind(s.flow, H.turn, H.total);
      const sec = kind === 'write' ? 20 : 40;
      H.totalMs = sec * 1000; H.endsAt = Date.now() + sec * 1000;
    }
  }
  if (allSubmitted()) H.advanceAt = Date.now() + (H.phase === 'collect' ? 150 : 900);
  else H.advanceAt = 0;
  sync();
}
function timeUp() {
  H.phase = 'collect'; H.endsAt = 0; H.collectUntil = Date.now() + 3000;
  room.broadcast({ t: 'timeup', turn: H.turn });
  sync();
  if (allSubmitted()) H.advanceAt = Date.now() + 150;
}
function finalizeTurn() {
  const s = H.settings, n = H.roster.length, t = H.turn;
  const kind = stepKind(s.flow, t, H.total);
  H.roster.forEach((id, i) => {
    const c = chainFor(i, t, n, s.flow);
    const sub = H.subs[id];
    const p = H.players[id] || { name: H.chains[i].ownerName, avatar: H.chains[i].ownerAvatar };
    const by = { id, name: p.name, avatar: p.avatar };
    let step;
    if (kind === 'write') {
      let text = sub && typeof sub.text === 'string' ? sub.text.slice(0, 120).trim() : '';
      let auto = !sub || !!sub.auto;
      if (!text && t === 0) { text = pick(s.flow === 's' ? STORY_IDEAS : s.flow === 'einsatz' ? ICEBREAKER_IDEAS : IDEAS); auto = true; }
      step = { type: 'text', text, by, auto };
    } else {
      const img = sub && typeof sub.img === 'string' && sub.img.startsWith('data:image/') ? sub.img : blankPng();
      step = { type: 'img', img, by, auto: !sub || !!sub.auto };
      if (s.anim && sub && sub.hold > 1) step.hold = sub.hold;
      if (sub && typeof sub.layer === 'string' && sub.layer.startsWith('data:image/')) step.layer = sub.layer;
    }
    H.chains[c].steps[t] = step;
  });
  H.turn++;
  if (H.turn >= H.total) startAlbums();
  else startTurn();
}

// ---------- Präsentation ----------
function startAlbums() {
  H.phase = 'album'; H.endsAt = 0; H.totalMs = 0;
  openAlbum(0);
}
function albumHead(i) {
  const ch = H.chains[i];
  return { t: 'albumStart', i, total: H.chains.length, owner: { name: ch.ownerName, avatar: ch.ownerAvatar }, owners: H.chains.map((c) => ({ name: c.ownerName, avatar: c.ownerAvatar })), kind: albumKind(H.settings), fps: (FPS[H.settings.fps] || FPS.normal)[0], count: ch.steps.length, mode: H.settings.mode, score: !!H.settings.score, flow: H.settings.flow };
}
function openAlbum(i) {
  H.album = { i, shown: 0 };
  room.broadcast(albumHead(i));
  revealNext();
}
function revealNext() {
  const a = H.album; const ch = H.chains[a.i];
  if (a.shown >= ch.steps.length) return;
  const s = ch.steps[a.shown];
  room.broadcast({ t: 'reveal', i: a.i, s: a.shown, step: stepOut(s) });
  a.shown++;
  H.autoAt = H.settings.autoAlbum ? Date.now() + (s.type === 'text' ? 2600 : 3200) : 0;
  sync();
}
function stepOut(s) { return { type: s.type, text: s.text, img: s.img, by: s.by, auto: s.auto, hold: s.hold || 1 }; }
function hostNext() {
  if (H.phase !== 'album' || !H.album) return;
  const ch = H.chains[H.album.i];
  if (H.album.shown < ch.steps.length) revealNext();
  else if (H.album.i + 1 < H.chains.length) openAlbum(H.album.i + 1);
  else { H.phase = 'end'; H.autoAt = 0; sync(); }
}
function computeScores() {
  const pts = {};
  for (const id of H.roster) pts[id] = 0;
  H.chains.forEach((ch, i) => ch.steps.forEach((st, s) => {
    if (s === 0) return;
    const v = H.votes[`${i}:${s}`]; if (!v) return;
    const vals = Object.values(v); const up = vals.filter((x) => x > 0).length, down = vals.filter((x) => x < 0).length;
    if (up > down && st.by) pts[st.by.id] = (pts[st.by.id] || 0) + 1;
  }));
  return H.roster.map((id) => {
    const ch = H.chains.find((c) => c.owner === id);
    const p = H.players[id] || { name: ch ? ch.ownerName : '?', avatar: ch ? ch.ownerAvatar : '👻' };
    return { id, name: p.name, avatar: p.avatar, pts: pts[id] || 0 };
  }).sort((a, b) => b.pts - a.pts);
}

function hostTick() {
  if (!H || !room) return;
  const now = Date.now();
  if (H.phase === 'play' && H.endsAt && now >= H.endsAt) timeUp();
  if (H.phase === 'collect' && now >= H.collectUntil) { finalizeTurn(); return; }
  if ((H.phase === 'play' || H.phase === 'collect') && H.advanceAt && now >= H.advanceAt) { H.advanceAt = 0; if (allSubmitted()) finalizeTurn(); }
  if (H.phase === 'album' && H.autoAt && now >= H.autoAt) { H.autoAt = 0; hostNext(); }
}
function hostRemove(id, kicked) {
  if (!H.players[id]) return;
  const name = H.players[id].name;
  delete H.players[id];
  H.order = H.order.filter((x) => x !== id);
  delete H.subs[id];
  sysChat(kicked ? `${name} wurde rausgeworfen` : `${name} hat die Lobby verlassen`);
  if ((H.phase === 'play' || H.phase === 'collect') && allSubmitted()) H.advanceAt = Date.now() + 300;
  sync();
}
function hostHandle(from, msg) {
  const isHostMsg = from === room.myId;
  const p = H.players[from];
  if (!p) return;
  switch (msg.t) {
    case 'settings': {
      if (!isHostMsg || H.phase !== 'lobby') return;
      const s = H.settings;
      if (msg.mode && MODES.some((m) => m.id === msg.mode) && msg.mode !== s.mode) {
        if (msg.mode === 'eigener') s.mode = 'eigener'; // übernimmt die aktuellen Bausteine als Startpunkt
        else Object.assign(s, BASE_SETTINGS, modeById(msg.mode).s, { mode: msg.mode });
      }
      // Bausteine frei kombinieren → Modus wird „Eigener“
      let custom = false;
      if (msg.flow && FLOWS.some(([v]) => v === msg.flow)) { s.flow = msg.flow; custom = true; }
      if (typeof msg.keep === 'string' && KEEPS.some(([v]) => v === msg.keep)) { s.keep = msg.keep; custom = true; }
      if (typeof msg.first === 'string' && FIRSTS.some(([v]) => v === msg.first)) { s.first = msg.first; custom = true; }
      for (const k of ['copy', 'anim', 'score']) if (typeof msg[k] === 'boolean') { s[k] = msg[k]; custom = true; }
      if (custom) { s.mode = 'eigener'; normalizeSettings(s); }
      if (msg.time && TIMES[msg.time]) s.time = msg.time;
      if (msg.turns && TURNS.some(([v]) => v === msg.turns)) s.turns = msg.turns;
      if (msg.fps && FPS[msg.fps]) s.fps = msg.fps;
      if (+msg.max >= 2 && +msg.max <= 30) s.max = Math.round(+msg.max);
      for (const k of ['secret', 'lateJoin', 'autoAlbum']) if (typeof msg[k] === 'boolean') s[k] = msg[k];
      sync();
      break;
    }
    case 'start':
      if (!isHostMsg || H.phase !== 'lobby') return;
      if (H.order.length < 2 && !isSoloFlow(H.settings.flow)) return;
      hostStartGame();
      break;
    case 'submit':
      if ((H.phase !== 'play' && H.phase !== 'collect') || msg.turn !== H.turn || !H.roster.includes(from)) return;
      if (H.phase === 'collect' && H.subs[from] && msg.auto) return; // bewusste Abgabe nicht überschreiben
      H.subs[from] = { text: typeof msg.text === 'string' ? msg.text : undefined, img: msg.img, layer: msg.layer, auto: !!msg.auto, hold: Math.max(1, Math.min(4, Math.round(+msg.hold) || 1)) };
      onSubmitChange();
      break;
    case 'unsubmit':
      if (H.phase !== 'play' || msg.turn !== H.turn) return;
      delete H.subs[from]; onSubmitChange();
      break;
    case 'force':
      if (!isHostMsg || H.phase !== 'play') return;
      timeUp();
      break;
    case 'next':
      if (!isHostMsg) return;
      hostNext();
      break;
    case 'auto':
      if (!isHostMsg) return;
      H.settings.autoAlbum = !!msg.on; H.autoAt = msg.on ? Date.now() + 1500 : 0; sync();
      break;
    case 'react': {
      if (!REACTS.includes(msg.e) || !H.chains[msg.i] || !H.chains[msg.i].steps[msg.s]) return;
      const k = `${msg.i}:${msg.s}`;
      const r = H.reacts[k] = H.reacts[k] || {};
      const set = r[msg.e] = r[msg.e] || new Set();
      if (set.has(from)) set.delete(from); else set.add(from);
      const counts = {}; for (const e of Object.keys(r)) counts[e] = r[e].size;
      room.broadcast({ t: 'reacts', i: msg.i, s: msg.s, counts, who: from, e: msg.e, on: set.has(from) });
      break;
    }
    case 'vote': {
      if (!H.settings.score || !H.chains[msg.i] || !H.chains[msg.i].steps[msg.s] || msg.s < 1) return;
      const st = H.chains[msg.i].steps[msg.s]; if (st.by && st.by.id === from) return;
      const k = `${msg.i}:${msg.s}`; const v = H.votes[k] = H.votes[k] || {};
      if (msg.v === 1 || msg.v === -1) v[from] = msg.v; else delete v[from];
      const vals = Object.values(v);
      room.broadcast({ t: 'votes', i: msg.i, s: msg.s, up: vals.filter((x) => x > 0).length, down: vals.filter((x) => x < 0).length });
      break;
    }
    case 'again':
      if (!isHostMsg) return;
      H.phase = 'lobby'; H.album = null; H.chains = []; H.roster = []; H.turn = 0; H.total = 0; H.endsAt = 0; H.autoAt = 0;
      for (const id of H.order) H.players[id].spec = false;
      sync();
      break;
    case 'kick':
      if (!isHostMsg || !H.players[msg.id] || msg.id === room.myId) return;
      room.sendTo(msg.id, { t: 'kicked' });
      setTimeout(() => room.kick(msg.id), 250);
      hostRemove(msg.id, true);
      break;
    case 'chat': {
      const text = String(msg.text || '').slice(0, 200).trim(); if (!text) return;
      room.broadcast({ t: 'chat', name: p.name, avatar: p.avatar, text });
      break;
    }
  }
}
function setupHost() {
  H = newHostState();
  room.getInfo = () => ({ phase: H.phase, players: H.order.length, max: H.settings.max, mode: H.settings.mode, host: H.players[room.myId] ? H.players[room.myId].name : '?', late: H.settings.lateJoin });
  room.onClientJoin = (id, hello) => {
    if (H.order.length >= H.settings.max) { room.sendTo(id, { t: 'deny', text: 'Die Lobby ist voll 😕' }); setTimeout(() => room.kick(id), 300); return; }
    if (H.phase !== 'lobby' && !H.settings.lateJoin) { room.sendTo(id, { t: 'deny', text: 'Das Spiel läuft schon – Zuschauen ist hier nicht erlaubt.' }); setTimeout(() => room.kick(id), 300); return; }
    hostAddPlayer(id, hello || {});
    const p = H.players[id];
    sysChat(`${p.avatar} ${p.name} ist ${p.spec ? 'als Zuschauer ' : ''}beigetreten`);
    sync();
    if (H.phase === 'album' && H.album) { // Zuschauer holt das aktuelle Album nach
      room.sendTo(id, albumHead(H.album.i));
      const ch = H.chains[H.album.i];
      for (let s = 0; s < H.album.shown; s++) room.sendTo(id, { t: 'reveal', i: H.album.i, s, step: stepOut(ch.steps[s]), quiet: true });
    }
  };
  room.onClientLeave = (id) => hostRemove(id, false);
  room.onClientMessage = (from, msg) => { if (msg && typeof msg === 'object') hostHandle(from, msg); };
  hostAddPlayer(room.myId, readProfile());
  setInterval(hostTick, 150);
  sync();
}

// ---------------------------------------------------------------------------
// CLIENT (läuft bei allen, auch beim Host)
// ---------------------------------------------------------------------------
let S = null;
let lastPhase = null;
let myTask = null, submitted = false, editing = false, copyStarted = false, myTaskKey = '';
const albums = {}; // i -> {owner, kind, fps, steps:[], reacts:{s:{counts, mine:Set}}, votes:{}}
let curAlbum = -1;
const isHost = () => !!(room && room.isHost);
const myId = () => room && room.myId;
const amSpec = () => { const p = S && S.players.find((x) => x.id === myId()); return !p || p.spec; };

const board = new Board({ board: $('board'), main: $('cvMain'), live: $('cvLive'), under: $('underImg'), onion: $('onionImg'), cursor: $('cursorDot') });

function onHostMessage(msg) {
  if (!msg || typeof msg !== 'object') return;
  switch (msg.t) {
    case 'state': {
      const prevPlayers = S ? S.players.length : 0;
      S = msg; localDeadline = msg.endsIn ? Date.now() + msg.endsIn : 0; localTotal = msg.totalMs || 0;
      if (prevPlayers && S.players.length > prevPlayers) sfx.play('join');
      render();
      break;
    }
    case 'newgame': for (const k of Object.keys(albums)) delete albums[k]; curAlbum = -1; albumOwners = []; sfx.play('start'); break;
    case 'task': onTask(msg); break;
    case 'timeup': onTimeUp(msg); break;
    case 'albumStart':
      if (Array.isArray(msg.owners)) albumOwners = msg.owners;
      albums[msg.i] = { owner: msg.owner, kind: msg.kind, fps: msg.fps, count: msg.count, mode: msg.mode, score: msg.score, flow: msg.flow, steps: [], reacts: {}, votes: {}, myVotes: {} };
      curAlbum = msg.i; renderAlbum(true);
      break;
    case 'reveal': {
      const a = albums[msg.i]; if (!a) return;
      a.steps[msg.s] = msg.step;
      if (!msg.quiet) sfx.play('reveal');
      if (msg.i === curAlbum) renderAlbum(false, msg.s);
      break;
    }
    case 'reacts': {
      const a = albums[msg.i]; if (!a) return;
      const r = a.reacts[msg.s] = a.reacts[msg.s] || { counts: {}, mine: new Set() };
      r.counts = msg.counts;
      if (msg.who === myId()) { if (msg.on) r.mine.add(msg.e); else r.mine.delete(msg.e); }
      else if (msg.on) { floatEmoji(msg.e); }
      if (msg.i === curAlbum) updateReacts(msg.s);
      break;
    }
    case 'votes': {
      const a = albums[msg.i]; if (!a) return;
      a.votes[msg.s] = { up: msg.up, down: msg.down };
      if (msg.i === curAlbum) updateReacts(msg.s);
      break;
    }
    case 'chat': addChat(msg); break;
    case 'deny': toast(msg.text, { err: true, ms: 4500 }); resetToStart(); break;
    case 'kicked': toast('Du wurdest aus der Lobby entfernt', { err: true, ms: 4500 }); resetToStart(); break;
  }
}

function resetToStart() {
  const old = room; room = null;
  if (old) old.leave();
  S = null; H = null; lastPhase = null; myTask = null; submitted = false; editing = false;
  for (const k of Object.keys(albums)) delete albums[k];
  albumOwners = []; stopAnim();
  $('chatLog').innerHTML = ''; unread = 0; updateBadge(); $('chat').classList.add('hidden'); $('chatFab').classList.add('hidden');
  $('leaveBtn').classList.add('hidden');
  history.replaceState(null, '', location.pathname);
  setHeader(); show('start');
}

function render() {
  if (!S) return;
  const phaseChanged = S.phase !== lastPhase;
  lastPhase = S.phase;
  $('leaveBtn').classList.remove('hidden');
  $('chatFab').classList.remove('hidden');
  if (S.phase === 'lobby') {
    if (phaseChanged) { myTask = null; submitted = false; }
    renderLobby(); show('lobby');
  } else if (S.phase === 'play' || S.phase === 'collect') {
    $('roundNum').textContent = `${Math.min(S.turn + 1, S.total)}/${S.total}`;
    renderPlay(); show('play');
  } else if (S.phase === 'album') {
    show('album'); renderAlbumBar(); renderAlbumSide();
  } else if (S.phase === 'end') {
    if (phaseChanged) { renderEnd(); sfx.play('start'); }
    else renderEndControls();
    show('end');
  }
}

// ---------- LOBBY ----------
let lobbyTab = 'modes';
function modeTags(s) {
  const t = [];
  t.push((FLOWS.find(([v]) => v === s.flow) || ['', ''])[1]);
  if (s.keep) t.push((KEEPS.find(([v]) => v === s.keep) || ['', ''])[1]);
  if (s.anim) t.push('Animation');
  if (s.copy) t.push('Nachzeichnen');
  if (s.secret) t.push('Geheimnis');
  if (s.score) t.push('Punkte');
  t.push(`Zeit: ${((TIMES[s.time] || {}).name || '').replace(/ \(.*\)/, '')}`);
  return t.filter(Boolean);
}
function renderLobby() {
  const s = S.settings, host = isHost();
  $('pCount').textContent = `${S.players.length}/${s.max}`;
  $('codePill').textContent = S.isPublic ? `Öffentlich ${S.code}` : S.code;
  const wide = matchMedia('(min-width: 1000px)').matches;
  const empties = Math.max(0, Math.min(s.max - S.players.length, wide ? 4 : (S.players.length % 2 ? 1 : 2)));
  let html = S.players.map((p) => `<li><button class="pl ${p.id === myId() ? 'is-me' : ''} ${p.spec ? 'spec' : ''}" data-pid="${p.id}" type="button">${avHtml(p, 'sm')}<span class="pl-n">${esc(p.name)}</span>${p.spec ? '<span class="pl-you">Zuschauer</span>' : ''}${p.id === myId() ? '<span class="pl-you">Du</span>' : ''}${p.id === S.hostId ? '<svg class="ico pl-crown" aria-label="Spielleiter"><use href="#i-crown"/></svg>' : ''}</button></li>`).join('');
  for (let i = 0; i < empties; i++) html += '<li><div class="pl empty"><span class="ph"></span><span class="pl-n">Leer</span></div></li>';
  $('playerGrid').innerHTML = html;
  // Voreinstellungen als Briefmarken
  $('modeGrid').innerHTML = MODES.map((m, k) => `<button class="mode ${m.id === s.mode ? 'on' : ''}" data-mode="${m.id}" type="button" ${host ? '' : 'disabled'} aria-pressed="${m.id === s.mode}" title="${esc(m.desc)}">
    <span class="m-stamp" style="--c:${MODE_COLORS[k % MODE_COLORS.length]}"><i><b>${m.ico}</b></i></span><span class="m-name">${esc(m.name).replace(/^(Fremd|Meister|Hinter)/, '$1\u00ad')}</span></button>`).join('');
  const m = modeById(s.mode);
  $('modeInfo').innerHTML = `<span class="mi-ico">${m.ico}</span><div><b>${esc(m.name)}</b><p>${esc(m.desc)}</p><div class="mi-tags">${modeTags(s).map((t) => `<span>${esc(t)}</span>`).join('')}</div></div>`;
  // Einstellungen
  const dis = host ? '' : 'disabled';
  const sel = (key, opts, val) => `<select data-set="${key}" ${dis}>${opts.map(([v, l]) => `<option value="${v}" ${String(v) === String(val) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const tog = (key, val, off) => `<label class="switch"><input type="checkbox" data-set="${key}" ${val ? 'checked' : ''} ${dis || (off ? 'disabled' : '')}><span></span></label>`;
  const canAnim = !['sz', 's', 'einsatz', 'sandwich', 'solo', 'hintergrund', 'soloanim'].includes(s.flow);
  const canCopy = ['z', 'sandwich'].includes(s.flow) && !s.anim && !s.keep;
  const keepOpts = s.anim ? KEEPS.slice(0, 1) : s.flow === 'z' ? KEEPS : s.flow === 'einsatz' ? KEEPS.slice(0, 2) : KEEPS.slice(0, 1);
  $('setList').innerHTML = `
    <div class="set-group">Allgemein</div>
    <div class="set"><span>Zeit <small>Wie lange pro Runde</small></span>${sel('time', Object.entries(TIMES).map(([k, v]) => [k, v.name]), s.time)}</div>
    <div class="set"><span>Runden</span>${sel('turns', TURNS, s.turns)}</div>
    <div class="set"><span>Geheimnis <small>Eigene Striche &amp; Buchstaben unsichtbar</small></span>${tog('secret', s.secret)}</div>
    <div class="set"><span>Max. Spieler</span>${sel('max', MAX_OPTS.map((v) => [v, String(v)]), s.max)}</div>
    <div class="set"><span>Zuschauer mitten im Spiel <small>Neue schauen zu, nächstes Spiel sind sie dabei</small></span>${tog('lateJoin', s.lateJoin)}</div>
    <div class="set"><span>Alben automatisch zeigen <small>Sonst blättert der Spielleiter</small></span>${tog('autoAlbum', s.autoAlbum)}</div>
    <div class="set-group">Spielablauf · ändern macht daraus „Eigener“</div>
    <div class="set"><span>Ablauf</span>${sel('flow', FLOWS, s.flow)}</div>
    <div class="set ${keepOpts.length < 2 ? 'locked' : ''}"><span>Vorlage <small>Was vom vorigen Bild bleibt</small></span>${sel('keep', keepOpts, s.keep)}</div>
    <div class="set ${canAnim || s.anim ? '' : 'locked'}"><span>Animation <small>Vorbild scheint durch, Album spielt als Film</small></span>${tog('anim', s.anim, !canAnim)}</div>
    ${s.anim ? `<div class="set"><span>Animationstempo</span>${sel('fps', Object.entries(FPS).map(([k, v]) => [k, v[1]]), s.fps)}</div>` : ''}
    <div class="set ${canCopy || s.copy ? '' : 'locked'}"><span>Nachzeichnen <small>Bild kurz ansehen, dann aus dem Gedächtnis</small></span>${tog('copy', s.copy, !canCopy)}</div>
    <div class="set"><span>Punkte <small>Daumen hoch, wenn die Bedeutung bleibt</small></span>${tog('score', s.score)}</div>
    <div class="set"><span>Erste Runde</span>${sel('first', FIRSTS, s.first)}</div>`;
  $('guestWait').classList.toggle('hidden', host);
  $('startBtn').classList.toggle('hidden', !host);
  const n = S.players.length;
  const need = isSoloFlow(s.flow) ? 1 : 2;
  $('startBtn').disabled = n < need;
  const T = turnPreview(s, n);
  $('sbInfo').innerHTML = `<b>${m.ico} ${esc(m.name)}</b><span>${n < need ? 'Mindestens 2 Spieler' : `${T} ${T === 1 ? 'Runde' : 'Runden'} · ${esc((TIMES[s.time] || {}).name || '')}`}</span>`;
}
function turnPreview(s, n) { return turnCount(s, Math.max(1, n)); }
$('modeGrid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-mode]'); if (!b || !isHost()) return;
  sfx.play('pop'); room.send({ t: 'settings', mode: b.dataset.mode });
  if (b.dataset.mode === 'eigener') setTimeout(() => $('lobbyTabs').querySelector('[data-tab=settings]').click(), 120);
});
$('setList').addEventListener('change', (e) => {
  const el = e.target.closest('[data-set]'); if (!el || !isHost()) return;
  const k = el.dataset.set; room.send({ t: 'settings', [k]: el.type === 'checkbox' ? el.checked : el.value });
});
$('lobbyTabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]'); if (!b) return;
  lobbyTab = b.dataset.tab;
  document.querySelectorAll('#lobbyTabs .tab').forEach((t) => t.classList.toggle('on', t === b));
  $('tab-modes').classList.toggle('hidden', lobbyTab !== 'modes'); $('tab-settings').classList.toggle('hidden', lobbyTab !== 'settings');
});
$('startBtn').onclick = () => { if (isHost()) { sfx.play('click'); room.send({ t: 'start' }); } };
function inviteUrl() { const u = new URL(location.href); u.search = S.isPublic ? `?pub=${S.code.replace(/\D/g, '')}` : `?code=${S.code}`; u.hash = ''; return u.href; }
async function copyText(t) { try { await navigator.clipboard.writeText(t); return true; } catch (e) { return false; } }
$('inviteBtn').onclick = async () => {
  if (!S) return;
  const url = inviteUrl();
  if (navigator.share && matchMedia('(hover: none)').matches) { try { await navigator.share({ title: 'Krakelpost', text: 'Komm in meine Krakelpost-Lobby!', url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  toast((await copyText(url)) ? 'Einladungslink kopiert 🔗' : url, { ms: 4000 });
};
$('codePill').onclick = async () => { if (S && (await copyText(S.code))) toast('Code kopiert'); };
$('qrHint').onclick = () => {
  if (!S) return;
  const url = inviteUrl();
  openModal(`<h2>Einladung</h2><div class="qr-box">${qrSvg(url)}</div>
    ${S.isPublic ? '' : `<div class="big-code">${esc(S.code)}</div>`}
    <p>QR-Code mit der Handykamera scannen – oder den Code in der Zockbox unter „Mit Code beitreten“ eintippen.</p>
    <div class="inv-link"><input type="text" readonly value="${esc(url)}" aria-label="Einladungslink"><button class="btn small" type="button" id="mCopy"><svg class="ico"><use href="#i-copy"/></svg>Kopieren</button></div>
    <div class="modal-btns"><button class="btn red" type="button" id="mOk">OK</button></div>`, (c) => {
    c.querySelector('#mOk').onclick = closeModal;
    c.querySelector('#mCopy').onclick = async () => { const ok = await copyText(url); if (!ok) c.querySelector('.inv-link input').select(); toast(ok ? 'Link kopiert 🔗' : 'Link markiert – jetzt kopieren'); };
  });
};
$('playerGrid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-pid]'); if (!b) return;
  playerMenu(b.dataset.pid);
});
$('doneList').addEventListener('click', (e) => { const b = e.target.closest('[data-pid]'); if (b) playerMenu(b.dataset.pid); });
function playerMenu(pid) {
  const p = S.players.find((x) => x.id === pid); if (!p) return;
  const canKick = isHost() && pid !== myId();
  openModal(`<div class="pm">${avHtml(p, 'big')}<h2>${esc(p.name)}</h2><p>${pid === S.hostId ? '👑 Spielleiter' : p.spec ? '👀 Schaut zu' : 'Spieler'}</p></div>
    <div class="modal-btns"><button class="btn" data-a="x" type="button">Schließen</button>${canKick ? '<button class="btn red" data-a="kick" type="button">Rauswerfen</button>' : ''}</div>`, (c) => {
    c.querySelector('[data-a=x]').onclick = closeModal;
    const k = c.querySelector('[data-a=kick]'); if (k) k.onclick = () => { closeModal(); room.send({ t: 'kick', id: pid }); };
  });
}

// ---------- AUFGABE (Schreiben / Zeichnen) ----------
async function onTask(task) {
  const key = `${task.turn}`;
  myTask = task; myTaskKey = key; submitted = false; editing = false; copyStarted = !task.copy;
  sfx.play('turn');
  $('thKicker').textContent = task.kicker;
  $('thTitle').textContent = task.title;
  // Vorgabe
  $('prompt').classList.toggle('hidden', task.prompt == null);
  if (task.prompt != null) { $('prText').textContent = task.prompt || '(nichts geschrieben) – zeichne, was du willst!'; $('prText').classList.toggle('empty', !task.prompt); }
  $('ref').classList.toggle('hidden', !task.ref);
  if (task.ref) $('refImg').src = task.ref;
  $('copyStartBtn').classList.toggle('hidden', !task.copy);
  // Schreiben
  const isWrite = task.kind === 'write';
  $('task').classList.toggle('is-write', isWrite);
  $('task').classList.toggle('has-ref', !!task.ref);
  $('writeBox').classList.toggle('hidden', !isWrite);
  $('writeInput').value = ''; $('writeInput').classList.toggle('secret', !!task.secret); updateCount();
  $('writeInput').placeholder = task.turn === 0 ? 'Schreib hier deinen Satz …' : task.ref ? 'Was siehst du auf dem Bild?' : 'Schreib die Geschichte weiter …';
  $('ideaBtn').classList.toggle('hidden', task.turn !== 0);
  // Zeichnen
  $('drawBox').classList.toggle('hidden', isWrite || task.copy);
  if (!isWrite) {
    let under = task.under;
    if (task.corpseSrc) under = await corpseUnder(task.corpseSrc);
    if (myTask !== task) return;
    await board.setup({ under, onion: task.onion, base: task.base, secret: task.secret });
    $('corpseGuide').classList.toggle('hidden', !(S && S.settings.keep === 'oben'));
    $('corpseGuide').classList.toggle('first', !task.corpseSrc);
    $('corpseGuide').classList.toggle('last', !!task.corpseLast);
    $('secretVeil').classList.toggle('hidden', !task.secret);
    board.locked = false;
  }
  setHold(1);
  (isWrite ? $('writeBox') : $('drawFoot')).appendChild($('doneBtn')); // Desktop: „Fertig!“ direkt unter der Zeichenfläche
  $('holdRow').classList.toggle('hidden', isWrite || !(S && S.settings.anim));
  $('doneBtn').disabled = false;
  $('doneBtn').classList.toggle('hidden', !!task.copy);
  render();
  if (isWrite && matchMedia('(hover: hover)').matches) setTimeout(() => $('writeInput').focus(), 60);
}
// Fremdkörper: nur der untere Streifen der vorigen Zeichnung, oben angesetzt
async function corpseUnder(src) {
  const im = await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
  if (!im) return null;
  const c = document.createElement('canvas'); c.width = CW; c.height = CH;
  const x = c.getContext('2d');
  x.drawImage(im, 0, CH - CORPSE_STRIP, CW, CORPSE_STRIP, 0, 0, CW, CORPSE_STRIP);
  return c.toDataURL('image/png');
}
$('copyStartBtn').onclick = () => {
  if (!myTask) return;
  copyStarted = true; sfx.play('pop');
  $('thTitle').textContent = 'Jetzt aus dem Gedächtnis nachzeichnen!';
  $('ref').classList.add('hidden'); $('copyStartBtn').classList.add('hidden'); $('drawBox').classList.remove('hidden'); $('doneBtn').classList.remove('hidden');
};
function updateCount() { $('writeCount').textContent = `${$('writeInput').value.length}/120`; }
$('writeInput').addEventListener('input', updateCount);
$('writeBox').addEventListener('submit', (e) => { e.preventDefault(); submitWork(false); });
$('ideaBtn').onclick = () => {
  const f = S && S.settings.flow;
  $('writeInput').value = pick(f === 's' ? STORY_IDEAS : f === 'einsatz' ? ICEBREAKER_IDEAS : IDEAS); updateCount(); sfx.play('pop');
};
function collectWork(auto) {
  const t = myTask;
  if (t.kind === 'write') return { t: 'submit', turn: t.turn, text: $('writeInput').value.slice(0, 120), auto };
  if (t.copy && !copyStarted) return { t: 'submit', turn: t.turn, img: blankPng(), auto: true };
  const keepUnder = !!t.under; // Vorlage gehört zum Bild (Ergänzen, Hintergrund, Fehlendes Teil, Fremdkörper)
  const msg = { t: 'submit', turn: t.turn, img: board.exportComposite(keepUnder), auto, hold: curHold };
  if (t.needLayer) msg.layer = board.exportLayer();
  return msg;
}
function submitWork(auto) {
  if (!myTask || !room) return;
  if (!auto && myTask.kind === 'write' && !$('writeInput').value.trim()) { toast('Schreib erst etwas – oder würfel eine Idee 🎲', { err: true }); return; }
  room.send(collectWork(auto));
  submitted = true; editing = false;
  if (!auto) sfx.play('submit');
  $('writeInput').blur();
  render();
}
$('doneBtn').onclick = () => submitWork(false);
$('editBtn').onclick = () => {
  if (!myTask || !S || S.phase !== 'play') return;
  editing = true; submitted = false;
  room.send({ t: 'unsubmit', turn: myTask.turn });
  render();
};
$('forceBtn').onclick = () => { if (isHost()) confirmBox('Runde beenden?', 'Wer noch nicht fertig ist, gibt automatisch ab.', 'Beenden', () => room.send({ t: 'force' })); };
function onTimeUp(msg) {
  if (!myTask || msg.turn !== myTask.turn) return;
  sfx.play('timeup');
  if (!submitted) { room.send(collectWork(true)); submitted = true; editing = false; toast('Zeit ist um – automatisch abgegeben ⏰'); render(); }
}
function renderPlay() {
  const spec = amSpec();
  const haveTask = myTask && S.turn === myTask.turn && !spec;
  const showTask = haveTask && !submitted && S.phase === 'play';
  $('task').classList.toggle('hidden', !showTask);
  $('waiting').classList.toggle('hidden', showTask);
  if (!showTask) {
    if (board) board.locked = true;
    const players = S.players.filter((p) => !p.spec);
    const done = players.filter((p) => p.done).length;
    $('waitTitle').textContent = spec ? 'Du schaust zu' : S.phase === 'collect' ? 'Zeit ist um!' : 'Warte auf die anderen Spieler …';
    $('waitSub').textContent = spec ? 'Beim nächsten Spiel bist du dabei. Die Alben siehst du gleich mit.' : `${done} von ${players.length} haben abgeschickt`;
    $('thKicker').textContent = spec ? 'Zuschauer' : 'Abgeschickt';
    $('thTitle').textContent = spec ? 'Die anderen krakeln gerade …' : 'Dein Brief ist unterwegs!';
    const specs = S.players.filter((p) => p.spec);
    $('doneList').innerHTML = players.map((p) => `<button type="button" data-pid="${p.id}" class="dl ${p.done ? 'ok' : ''}" title="${esc(p.name)}">${avHtml(p, 'mid').replace('class="sav mid"', `class="sav mid ${p.done ? 'ok' : ''}"`)}<small>${esc(p.name)}</small></button>`).join('') +
      (specs.length ? `<span class="dl-spec">👀 ${specs.map((p) => `<button type="button" data-pid="${p.id}" class="dl-sname">${esc(p.name)}</button>`).join(', ')}</span>` : '');
    $('editBtn').classList.toggle('hidden', !haveTask || S.phase !== 'play');
    $('forceBtn').classList.toggle('hidden', !isHost() || S.phase !== 'play');
  } else {
    board.locked = false;
    $('forceBtn').classList.add('hidden');
    if (myTask) { $('thKicker').textContent = myTask.kicker; $('thTitle').textContent = myTask.copy && copyStarted ? 'Jetzt aus dem Gedächtnis nachzeichnen!' : myTask.title; }
  }
}

// Werkzeuge
function buildTools() {
  $('sizeRow').innerHTML = SIZES.map((s, i) => `<button class="size ${i === 1 ? 'on' : ''}" data-size="${s}" type="button" aria-label="Größe ${i + 1}" title="Größe ${i + 1}"><i style="width:${[4, 7, 12, 18, 25][i]}px;height:${[4, 7, 12, 18, 25][i]}px"></i></button>`).join('');
  $('palette').innerHTML = PALETTE.map((c, i) => `<button class="sw ${i === 0 ? 'on' : ''}" data-color="${c}" style="--sw:${c}" type="button" aria-label="Farbe ${c}"></button>`).join('') +
    `<label class="sw custom" title="Eigene Farbe" aria-label="Eigene Farbe"><input type="color" id="customColor" value="#2f62e6"><i></i></label>`;
}
buildTools();
let lastTool = 'pen';
function setTool(t) {
  if (t !== 'picker') lastTool = t;
  board.tool = t; document.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
}
function setColor(c) {
  c = String(c).toLowerCase();
  board.color = c;
  let hit = false;
  document.querySelectorAll('#palette .sw[data-color]').forEach((b) => { const on = b.dataset.color.toLowerCase() === c; b.classList.toggle('on', on); hit = hit || on; });
  document.querySelector('#palette .custom').classList.toggle('on', !hit);
  if (!hit) $('customColor').value = c;
  if (board.tool === 'eraser' || board.tool === 'picker') setTool(lastTool === 'eraser' ? 'pen' : lastTool);
  $('palette').style.setProperty('--cur', c);
}
// Pipette: Farbe übernehmen und zurück zum vorigen Werkzeug
board.onPick = (c) => { setColor(c); sfx.play('pop'); };
// Belichtung (Animation): wie lange dieses Bild im Film stehen bleibt
let curHold = 1;
function setHold(h) { curHold = h; document.querySelectorAll('#holdRow [data-hold]').forEach((b) => b.classList.toggle('on', +b.dataset.hold === h)); }
$('holdRow').addEventListener('click', (e) => { const b = e.target.closest('[data-hold]'); if (b) { setHold(+b.dataset.hold); sfx.play('click'); } });
$('drawBox').addEventListener('click', (e) => {
  const t = e.target.closest('[data-tool]'); if (t) { setTool(t.dataset.tool); sfx.play('click'); return; }
  const s = e.target.closest('#sizeRow [data-size]'); if (s) { board.size = +s.dataset.size; document.querySelectorAll('[data-size]').forEach((b) => b.classList.toggle('on', b === s)); return; }
  const c = e.target.closest('[data-color]'); if (c) setColor(c.dataset.color);
});
$('customColor').addEventListener('input', (e) => setColor(e.target.value));
$('opacityRange').addEventListener('input', (e) => { board.opacity = +e.target.value / 100; });
$('undoBtn').onclick = () => board.undo();
$('redoBtn').onclick = () => board.redo();
$('clearBtn').onclick = () => { board.clear(); sfx.play('pop'); };
board.onChange = () => { $('undoBtn').disabled = !board.undoStack.length; $('redoBtn').disabled = !board.redoStack.length; };
document.addEventListener('keydown', (e) => {
  if (curScreen !== 'play' || !myTask || myTask.kind !== 'draw' || submitted) return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement && document.activeElement.tagName)) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); if (e.shiftKey) board.redo(); else board.undo(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); board.redo(); return; }
  const map = { b: 'pen', p: 'pen', e: 'eraser', g: 'fill', f: 'fill', i: 'picker', l: 'line', r: e.shiftKey ? 'rectf' : 'rect', o: e.shiftKey ? 'ellipsef' : 'ellipse' };
  if (map[k] && !e.ctrlKey && !e.metaKey && !e.altKey) setTool(map[k]);
});

// ---------- ALBEN ----------
let animTimer = null;
let albumOwners = [];
function stepHtml(a, s, idx) {
  const by = s.by || { name: '?', avatar: '👻' };
  const has = s.text && s.text.trim();
  const body = s.type === 'text'
    ? `<div class="bubble ${has ? '' : 'empty'}">${esc(has ? s.text : '(nichts geschrieben)')}</div>`
    : `<div class="pic"><img src="${s.img}" alt="Zeichnung von ${esc(by.name)}" loading="lazy">${idx === 0 ? '' : PM_SVG}</div>`;
  return `<article class="st ${s.type}" data-s="${idx}">
    <div class="st-who">${avHtml(by, 'xs')}<span class="who-n">${esc(by.name)}</span>${s.auto ? '<em title="Bei Zeitablauf automatisch abgegeben">⏰</em>' : ''}</div>
    ${body}
    <div class="st-react" data-s="${idx}">${reactBar(a, idx)}</div>
  </article>`;
}
function reactBar(a, idx) {
  const r = a.reacts[idx] || { counts: {}, mine: new Set() };
  let h = REACTS.map((e) => `<button class="rx ${r.mine.has(e) ? 'on' : ''}" data-e="${e}" type="button">${e}<b>${r.counts[e] || ''}</b></button>`).join('');
  if (a.score && idx > 0 && !(a.steps[idx] && a.steps[idx].by && a.steps[idx].by.id === myId())) {
    const v = a.votes[idx] || { up: 0, down: 0 }; const mv = a.myVotes[idx] || 0;
    h += `<span class="vote"><button class="vb up ${mv > 0 ? 'on' : ''}" data-v="1" type="button">👍 Passt <b>${v.up || ''}</b></button><button class="vb down ${mv < 0 ? 'on' : ''}" data-v="-1" type="button">👎 <b>${v.down || ''}</b></button></span>`;
  } else if (a.score && idx > 0) { const v = a.votes[idx] || { up: 0, down: 0 }; h += `<span class="vote mine">👍 ${v.up || 0} · 👎 ${v.down || 0}</span>`; }
  return h;
}
function updateReacts(idx) { const a = albums[curAlbum]; const el = document.querySelector(`#album .st-react[data-s="${idx}"]`); if (a && el) el.innerHTML = reactBar(a.kind === 'anim' ? { ...a, score: false } : a, idx); }
$('album').addEventListener('click', (e) => {
  const a = albums[curAlbum]; if (!a || !room) return;
  const fr = e.target.closest('[data-f]'); if (fr && a.kind === 'anim') { stopAnim(); showFrame(a, +fr.dataset.f); return; }
  if (e.target.closest('#animImg') && a.kind === 'anim') { if (animTimer) stopAnim(); else playAnim(a); return; }
  const row = e.target.closest('.st-react'); if (!row) return;
  const idx = +row.dataset.s;
  const rx = e.target.closest('[data-e]'); if (rx) { sfx.play('like'); room.send({ t: 'react', i: curAlbum, s: idx, e: rx.dataset.e }); return; }
  const vb = e.target.closest('[data-v]');
  if (vb) { const v = +vb.dataset.v; const cur = a.myVotes[idx] || 0; const nv = cur === v ? 0 : v; a.myVotes[idx] = nv; room.send({ t: 'vote', i: curAlbum, s: idx, v: nv }); updateReacts(idx); }
});
function renderAlbumSide() {
  const box = $('albumSide'); if (!albumOwners.length) { box.innerHTML = ''; return; }
  const cur = S && S.album ? S.album.i : curAlbum;
  box.innerHTML = albumOwners.map((o, i) => `<div class="as-item ${i === cur ? 'on' : ''} ${i < cur || (S && S.phase === 'end') ? 'done' : ''}">${avHtml(o, 'xs')}<span class="as-n">${esc(o.name)}</span></div>`).join('');
  const on = box.querySelector('.on'); if (on && box.scrollWidth > box.clientWidth) box.scrollLeft = on.offsetLeft - 12;
}
function renderAlbum(fresh, newIdx) {
  const a = albums[curAlbum]; if (!a) return;
  $('albumWho').innerHTML = `${avHtml(a.owner, 'sm')}<div><small>Album von</small><b>${esc(a.owner.name)}</b></div>`;
  $('albumNav').textContent = `${a.steps.filter(Boolean).length}/${a.count}`;
  const box = $('album');
  if (fresh) { box.innerHTML = ''; box.className = 'album k-' + a.kind; stopAnim(); renderAlbumSide(); }
  if (a.kind === 'anim') {
    if (!box.querySelector('.anim-stage')) box.innerHTML = `<div class="anim-stage"><img id="animImg" alt="Animation – antippen zum Anhalten"><span class="anim-badge" id="animBadge"></span></div><div class="st-react" data-s="0">${reactBar({ ...a, score: false }, 0)}</div><div class="frames" id="frames"></div>`;
    const frames = animSteps(a);
    $('frames').innerHTML = frames.map((s, i) => `<button class="fr" data-f="${i}" type="button" aria-label="Bild ${i + 1}"><img src="${s.img}" alt=""><span>${i + 1}</span>${(s.hold || 1) > 1 ? `<em>${s.hold}×</em>` : ''}</button>`).join('');
    playAnim(a);
  } else {
    if (newIdx != null && a.steps[newIdx] && !box.querySelector(`.st[data-s="${newIdx}"]`)) {
      box.insertAdjacentHTML('beforeend', stepHtml(a, a.steps[newIdx], newIdx));
      const el = box.lastElementChild; el.classList.add('pop-in');
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
    } else if (fresh) box.innerHTML = a.steps.map((s, i) => s ? stepHtml(a, s, i) : '').join('');
    if (a.kind === 'corpse' && a.steps.filter(Boolean).length === a.count && !box.querySelector('.corpse-final')) {
      corpseCanvas(a.steps).then((c) => {
        if (albums[curAlbum] !== a || box.querySelector('.corpse-final')) return;
        box.insertAdjacentHTML('beforeend', `<div class="corpse-final pop-in"><h3>🧟 Die fertige Figur</h3><img src="${c.toDataURL('image/png')}" alt="Fertige Figur"></div>`);
        box.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  }
  renderAlbumBar();
}
function animSteps(a) { const f = a.steps.filter((s) => s && s.img); return a.flow === 'hintergrund' && f.length > 1 ? f.slice(1) : f; }
let animIdx = 0;
function showFrame(a, i) {
  const st = animSteps(a); if (!st.length) return;
  animIdx = ((i % st.length) + st.length) % st.length;
  const s = st[animIdx];
  $('animImg').src = s.img;
  $('animBadge').textContent = `${animIdx + 1}/${st.length} · ${s.by ? s.by.avatar + ' ' + s.by.name : ''}${(s.hold || 1) > 1 ? ` · ${s.hold}×` : ''}`;
  document.querySelectorAll('#frames .fr').forEach((f, k) => f.classList.toggle('on', k === animIdx));
}
function playAnim(a) {
  stopAnim();
  const st = animSteps(a);
  if (!st.length) return;
  const base = 1000 / (a.fps || 6);
  let i = animIdx >= st.length ? -1 : animIdx - 1;
  const tick = () => { i = (i + 1) % st.length; showFrame(a, i); animTimer = setTimeout(tick, base * (st[i].hold || 1)); };
  tick();
}
function stopAnim() { if (animTimer) clearTimeout(animTimer); animTimer = null; }
function renderAlbumBar() {
  if (!S || S.phase !== 'album' || !S.album) return;
  const host = isHost();
  const { shown, count, i, total } = S.album;
  $('nextBtn').classList.toggle('hidden', !host);
  $('autoBtn').classList.toggle('hidden', !host);
  $('autoBtn').innerHTML = S.settings.autoAlbum ? '<svg class="ico"><use href="#i-pause"/></svg><span>Auto</span>' : '<svg class="ico"><use href="#i-play"/></svg><span>Auto</span>';
  $('autoBtn').title = S.settings.autoAlbum ? 'Automatisch blättern anhalten' : 'Automatisch blättern';
  $('nextBtn').textContent = shown < count ? 'Weiter' : i + 1 < total ? 'Nächstes Album' : 'Zum Ende';
  $('nextBtn').title = shown < count ? 'Nächsten Schritt zeigen' : i + 1 < total ? 'Nächstes Album' : 'Zum Ende';
  $('albumGuest').textContent = host ? '' : 'Der Spielleiter blättert weiter …';
}
$('nextBtn').onclick = () => { if (isHost()) { sfx.play('click'); room.send({ t: 'next' }); } };
$('autoBtn').onclick = () => { if (isHost()) room.send({ t: 'auto', on: !S.settings.autoAlbum }); };
$('dlPngBtn').onclick = (e) => downloadAlbum(curAlbum, 'png', e.currentTarget);
$('dlGifBtn').onclick = (e) => downloadAlbum(curAlbum, 'gif', e.currentTarget);
async function downloadAlbum(i, type, btn) {
  const a = albums[i]; if (!a) return;
  const view = { ...a, steps: a.kind === 'anim' ? animSteps(a) : a.steps.filter(Boolean) };
  if (!view.steps.length) { toast('Noch nichts zum Herunterladen', { err: true }); return; }
  const label = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.textContent = '⏳ …'; }
  try {
    const safe = a.owner.name.replace(/[^\wäöüÄÖÜß-]+/g, '_').slice(0, 20) || 'album';
    const blob = type === 'gif' ? await albumToGifBlob(view, a.fps || 6, (p) => { if (btn) btn.textContent = `⏳ ${Math.round(p * 100)} %`; }) : await albumToPngBlob(view);
    const r = await saveBlob(blob, `krakelpost-${safe}.${type}`);
    if (r === 'downloaded') toast(type === 'gif' ? 'GIF gespeichert 🎞️' : 'Bild gespeichert 🖼️');
  } catch (e) { console.warn(e); toast('Download hat nicht geklappt 😕', { err: true }); }
  finally { if (btn) { btn.disabled = false; btn.innerHTML = label; } }
}
function floatEmoji(e) {
  if (curScreen !== 'album') return;
  const el = document.createElement('span'); el.className = 'float-emo'; el.textContent = e;
  el.style.left = (10 + Math.random() * 80) + 'vw';
  document.body.appendChild(el); setTimeout(() => el.remove(), 2200);
}

// ---------- ENDE ----------
function renderEnd() {
  stopAnim();
  const idxs = Object.keys(albums).map(Number).sort((a, b) => a - b);
  $('albumList').innerHTML = idxs.length ? idxs.map((i) => {
    const a = albums[i]; const first = a.steps.find(Boolean); const lastImg = [...a.steps].reverse().find((s) => s && s.img);
    const likes = Object.values(a.reacts).reduce((n, r) => n + Object.values(r.counts || {}).reduce((x, y) => x + y, 0), 0);
    return `<div class="al-card">
      <div class="al-head">${avHtml(a.owner, 'sm')}<div><b>${esc(a.owner.name)}</b><small>${a.steps.filter(Boolean).length} Schritte${likes ? ` · ${likes} Reaktionen` : ''}</small></div></div>
      ${lastImg ? `<img class="al-thumb" src="${lastImg.img}" alt="">` : ''}
      ${first && first.type === 'text' ? `<p class="al-first">„${esc(first.text || '…')}“</p>` : ''}
      <div class="al-btns"><button class="btn small" data-view="${i}" type="button"><svg class="ico"><use href="#i-eye"/></svg>Ansehen</button><button class="btn small" data-png="${i}" type="button"><svg class="ico"><use href="#i-dl"/></svg>Bild</button><button class="btn small" data-gif="${i}" type="button"><svg class="ico"><use href="#i-dl"/></svg>GIF</button></div>
    </div>`;
  }).join('') : '<p class="muted center">Du bist zu spät gekommen – nächstes Mal bist du dabei!</p>';
  renderEndControls();
}
function renderEndControls() {
  const sc = S.scores;
  $('scoreCard').classList.toggle('hidden', !sc);
  if (sc) $('scoreCard').innerHTML = `<h3>🏆 Punkte</h3><ol class="scores">${sc.map((p, k) => `<li class="${k === 0 ? 'win' : ''}">${avHtml(p, 'xs')}<span class="sc-n">${esc(p.name)}</span><b>${p.pts}</b></li>`).join('')}</ol>`;
  $('againBtn').classList.toggle('hidden', !isHost());
  $('endNote').textContent = isHost() ? '' : 'Der Spielleiter bringt euch gleich zurück in die Lobby.';
}
$('albumList').addEventListener('click', (e) => {
  const v = e.target.closest('[data-view]'); if (v) { viewAlbum(+v.dataset.view); return; }
  const p = e.target.closest('[data-png]'); if (p) { downloadAlbum(+p.dataset.png, 'png', p); return; }
  const g = e.target.closest('[data-gif]'); if (g) downloadAlbum(+g.dataset.gif, 'gif', g);
});
function viewAlbum(i) {
  const a = albums[i]; if (!a) return;
  const steps = a.kind === 'anim' ? animSteps(a) : a.steps.filter(Boolean);
  openModal(`<h2>Album von ${esc(a.owner.name)}</h2><div class="album mini">${a.kind === 'anim' ? `<div class="anim-stage"><img id="mAnim" alt="Animation"></div>` : steps.map((s) => `<article class="st ${s.type}"><div class="st-who">${avHtml(s.by || {}, 'xs')}<span class="who-n">${esc((s.by || {}).name || '')}</span></div>${s.type === 'text' ? `<div class="bubble ${s.text && s.text.trim() ? '' : 'empty'}">${esc(s.text && s.text.trim() ? s.text : '(nichts geschrieben)')}</div>` : `<div class="pic"><img src="${s.img}" alt=""></div>`}</article>`).join('')}</div>
    <div class="modal-btns"><button class="btn red" id="mOk" type="button">Schließen</button></div>`, (c) => {
    let t = null;
    if (a.kind === 'anim') {
      let k = 0; const im = c.querySelector('#mAnim'); const base = 1000 / (a.fps || 6);
      const tick = () => { if (!im.isConnected) return; im.src = steps[k].img; t = setTimeout(tick, base * (steps[k].hold || 1)); k = (k + 1) % steps.length; };
      tick();
    }
    c.querySelector('#mOk').onclick = () => { if (t) clearTimeout(t); closeModal(); };
  });
}
$('againBtn').onclick = () => { if (isHost()) room.send({ t: 'again' }); };

// ---------- CHAT ----------
let unread = 0;
function updateBadge() { $('chatBadge').textContent = unread; $('chatBadge').classList.toggle('hidden', !unread); }
function addChat(m) {
  const d = document.createElement('div');
  d.className = 'cm' + (m.sys ? ' sys' : '');
  d.innerHTML = m.sys ? esc(m.text) : `<b>${esc(m.avatar)} ${esc(m.name)}</b> ${esc(m.text)}`;
  $('chatLog').appendChild(d); $('chatLog').scrollTop = 1e9;
  if ($('chat').classList.contains('hidden') && !m.sys) { unread++; updateBadge(); }
}
$('chatFab').onclick = () => { $('chat').classList.toggle('hidden'); unread = 0; updateBadge(); if (!$('chat').classList.contains('hidden') && matchMedia('(hover: hover)').matches) $('chatInput').focus(); };
$('chatClose').onclick = () => $('chat').classList.add('hidden');
$('chatForm').onsubmit = (e) => { e.preventDefault(); const v = $('chatInput').value.trim(); if (v && room) room.send({ t: 'chat', text: v }); $('chatInput').value = ''; };

// ---------- VERLASSEN ----------
$('leaveBtn').onclick = () => {
  if (!room) { show('start'); return; }
  confirmBox('Lobby verlassen?', isHost() && S && S.players.length > 1 ? 'Du bist Spielleiter – wenn du gehst, ist die Lobby für alle vorbei.' : 'Willst du die Lobby wirklich verlassen?', 'Verlassen', () => resetToStart());
};
window.addEventListener('beforeunload', (e) => { if (room && room.isHost && S && S.players.length > 1) { e.preventDefault(); e.returnValue = ''; } });

// ---------------------------------------------------------------------------
// START: Lobby erstellen / beitreten
// ---------------------------------------------------------------------------
function newRoom() {
  if (typeof Peer === 'undefined') { toast('Verbindungsbibliothek konnte nicht geladen werden. Ist das Netz blockiert?', { err: true, ms: 5000 }); return null; }
  const r = new Room(GAME_ID);
  r.onHostMessage = (msg) => { if (room === r) onHostMessage(msg); };
  r.onHostLost = () => { if (room === r) { toast('Verbindung zum Spielleiter verloren 😢', { err: true, ms: 4000 }); resetToStart(); } };
  return r;
}
function errText(e) {
  const t = e && e.type;
  if (t === 'network' || t === 'server-error' || t === 'socket-error' || (e && e.message === 'timeout')) return 'Keine Verbindung zum Vermittlungsserver. Ist das Netz blockiert?';
  if (t === 'browser-incompatible') return 'Dein Browser unterstützt kein WebRTC 😕';
  return e && e.message ? e.message : 'Etwas ist schiefgelaufen';
}
async function busy(btn, fn) {
  if (btn.dataset.busy) return;
  btn.dataset.busy = '1'; const label = btn.innerHTML; btn.disabled = true;
  btn.classList.add('busy');
  try { await fn(); }
  catch (e) { console.warn(e); toast(errText(e), { err: true, ms: 4500 }); if (room && !room.peer) room = null; }
  finally { btn.disabled = false; btn.innerHTML = label; btn.classList.remove('busy'); delete btn.dataset.busy; }
}
async function hostPrivate() {
  readProfile();
  room = newRoom(); if (!room) return;
  await room.createPrivate();
  setupHost();
  history.replaceState(null, '', `?code=${room.code}`);
}
async function joinCode(code) {
  code = String(code || '').trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) { toast('Der Code hat 4 Buchstaben', { err: true }); return; }
  room = newRoom(); if (!room) return;
  const ok = await room.joinPrivate(code, readProfile());
  if (!ok) { room.leave(); room = null; toast('Lobby nicht gefunden 🤔', { err: true }); return; }
  history.replaceState(null, '', `?code=${code}`);
}
async function joinPub(n) {
  room = newRoom(); if (!room) return false;
  const ok = await room.joinPublic(n, readProfile());
  if (!ok) { room.leave(); room = null; toast('Lobby nicht mehr da 🤔', { err: true }); return false; }
  return true;
}
async function quickPlay() {
  readProfile();
  let list = [];
  try { list = await Room.listPublic(GAME_ID); } catch (e) {}
  const open = list.filter((l) => (l.phase === 'lobby' || (l.late && l.phase !== 'end')) && l.players < l.max)
    .sort((a, b) => (a.phase === 'lobby' ? 0 : 1) - (b.phase === 'lobby' ? 0 : 1) || b.players - a.players);
  for (const l of open) { if (await joinPub(l.slot)) return; }
  room = newRoom(); if (!room) return;
  await room.createPublic();
  setupHost();
  toast('Neue öffentliche Lobby erstellt – warte auf Mitspieler!');
}
async function browse() {
  show('public');
  const box = $('browseList');
  box.innerHTML = '<div class="browse-empty">Suche offene Lobbys …</div>';
  let list = [];
  try { list = await Room.listPublic(GAME_ID); } catch (e) { box.innerHTML = `<div class="browse-empty">${esc(errText(e))}</div>`; return; }
  if (curScreen !== 'public') return;
  if (!list.length) { box.innerHTML = '<div class="browse-empty">Gerade keine offenen Lobbys. Starte doch eine mit „Schnelles Spiel“!</div>'; return; }
  box.innerHTML = list.map((l) => {
    const canJoin = l.players < l.max && (l.phase === 'lobby' || (l.late && l.phase !== 'end'));
    return `<div class="browse-item"><span class="bi-ico">${modeById(l.mode).ico}</span><div class="bi-main"><b>Lobby von ${esc(l.host)}</b>
      <small>${l.players}/${l.max} Spieler · ${esc(modeById(l.mode).name)} · ${l.phase === 'lobby' ? 'wartet' : 'läuft (zuschauen)'}</small></div>
      <button class="btn small red" data-slot="${l.slot}" type="button" ${canJoin ? '' : 'disabled'}>Rein</button></div>`;
  }).join('');
}
$('browseList').addEventListener('click', (e) => { const b = e.target.closest('[data-slot]'); if (b) busy(b, () => joinPub(+b.dataset.slot)); });
$('refreshBtn').onclick = () => browse();
$('browseBtn').onclick = () => { sfx.play('click'); browse(); };
$('quickBtn').onclick = (e) => { sfx.play('click'); busy(e.currentTarget, quickPlay); };
$('createBtn').onclick = (e) => { sfx.play('click'); busy(e.currentTarget, hostPrivate); };
$('codeInput').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); });
$('codeForm').addEventListener('submit', (e) => { e.preventDefault(); if (room) return; $('codeInput').blur(); busy($('codeBtn'), () => joinCode($('codeInput').value)); });

// Einladungslink: ?code=ABCD, ?join=ABCD oder ?pub=3
const params = new URLSearchParams(location.search);
let inviteJoin = null;
const codeParam = (params.get('code') || params.get('join') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
if (codeParam.length === 4) inviteJoin = () => joinCode(codeParam);
else if (params.get('pub')) { const n = +params.get('pub'); if (n >= 1 && n <= 8) inviteJoin = () => joinPub(n); }
if (inviteJoin) show('invite');
$('inviteJoinBtn').onclick = (e) => { sfx.play('click'); busy(e.currentTarget, inviteJoin || (async () => {})); };
$('inviteBack').onclick = () => { history.replaceState(null, '', location.pathname); show('start'); };

// Für Tests/Debugging
window.__kp = { get S() { return S; }, get H() { return H; }, get task() { return myTask; }, albums, board };
