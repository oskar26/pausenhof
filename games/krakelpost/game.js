// Krakelpost – Stille Post mit Zeichnungen. Ein Spiel in der Zockbox – made by Oskar
// Multiplayer über ../../shared/net.js (PeerJS/WebRTC). Der Browser, der die Lobby erstellt, ist der Host.
import { Room } from '../../shared/net.js';
import { AVATARS, getProfile, setName, setAvatar, randomName, NAME_MAX } from '../../shared/profile.js';
import { Board, PALETTE, SIZES, W as CW, H as CH } from './draw.js';
import { albumToPngBlob, albumToGifBlob, saveBlob, corpseCanvas, CORPSE_STRIP } from './export.js';
import { sfx } from './sound.js';

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
];
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
const AV_COLORS = ['#7c5cff', '#ff4fd8', '#3de0ff', '#c6ff3d', '#ffb347', '#ff5a6e', '#5cffb0', '#ffd84d'];
const avColor = (k) => { let h = 0; for (const ch of String(k)) h = (h * 31 + ch.codePointAt(0)) >>> 0; return AV_COLORS[h % AV_COLORS.length]; };
const avHtml = (p, cls = 'av') => `<span class="${cls}" style="--c:${avColor((p.avatar || '') + (p.name || ''))}">${esc(p.avatar || '👻')}</span>`;
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
  openModal(`<h2>${esc(title)}</h2><p>${esc(text)}</p><div class="modal-btns"><button class="btn ghost" data-a="no" type="button">Abbrechen</button><button class="btn pink" data-a="yes" type="button">${esc(yes)}</button></div>`, (c) => {
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
  openModal(`<h2>Avatar auswählen</h2><div class="av-grid">${AVATARS.map((a) => `<button type="button" data-av="${a}" class="${a === me.avatar ? 'on' : ''}" style="--c:${avColor(a)}">${a}</button>`).join('')}</div>
    <div class="modal-btns"><button class="btn lime" id="mOk" type="button">Passt!</button></div>`, (c) => {
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
function setHeader(step = '', title = '') {
  $('hdrStep').innerHTML = step; $('hdrStep').classList.toggle('hidden', !step);
  $('hdrTitle').textContent = title;
}
document.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => { sfx.play('click'); show(b.dataset.go); });
$('soundBtn').onclick = () => { sfx.muted = !sfx.muted; $('soundBtn').textContent = sfx.muted ? '🔇' : '🔊'; sfx.play('click'); };
$('soundBtn').textContent = sfx.muted ? '🔇' : '🔊';

let localDeadline = 0, localTotal = 0, lastTickSec = -1;
setInterval(() => {
  const t = $('timer');
  if (!localDeadline || !S || !['play'].includes(S.phase)) { t.classList.add('hidden'); return; }
  const left = Math.max(0, localDeadline - Date.now());
  t.classList.remove('hidden');
  $('timerFill').style.transform = `scaleX(${localTotal ? left / localTotal : 0})`;
  const sec = Math.ceil(left / 1000);
  $('timerTxt').textContent = sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : `${sec}`;
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
  return { t: 'albumStart', i, total: H.chains.length, owner: { name: ch.ownerName, avatar: ch.ownerAvatar }, kind: albumKind(H.settings), fps: (FPS[H.settings.fps] || FPS.normal)[0], count: ch.steps.length, mode: H.settings.mode, score: !!H.settings.score, flow: H.settings.flow };
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
  room.broadcast({ t: 'reveal', i: a.i, s: a.shown, step: { type: s.type, text: s.text, img: s.img, by: s.by, auto: s.auto } });
  a.shown++;
  H.autoAt = H.settings.autoAlbum ? Date.now() + (s.type === 'text' ? 2600 : 3200) : 0;
  sync();
}
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
      if (msg.mode && MODES.some((m) => m.id === msg.mode) && msg.mode !== s.mode) Object.assign(s, BASE_SETTINGS, modeById(msg.mode).s, { mode: msg.mode });
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
      H.subs[from] = { text: typeof msg.text === 'string' ? msg.text : undefined, img: msg.img, layer: msg.layer, auto: !!msg.auto };
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
      for (let s = 0; s < H.album.shown; s++) { const st = ch.steps[s]; room.sendTo(id, { t: 'reveal', i: H.album.i, s, step: { type: st.type, text: st.text, img: st.img, by: st.by, auto: st.auto }, quiet: true }); }
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
    case 'newgame': for (const k of Object.keys(albums)) delete albums[k]; curAlbum = -1; sfx.play('start'); break;
    case 'task': onTask(msg); break;
    case 'timeup': onTimeUp(msg); break;
    case 'albumStart':
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
    renderLobby(); show('lobby'); setHeader('', 'Lobby');
  } else if (S.phase === 'play' || S.phase === 'collect') {
    setHeader(`Runde <b>${Math.min(S.turn + 1, S.total)}</b>/${S.total}`, modeById(S.settings.mode).name);
    renderPlay(); show('play');
  } else if (S.phase === 'album') {
    if (S.album) setHeader(`Album <b>${S.album.i + 1}</b>/${S.album.total}`, 'Alben');
    show('album'); renderAlbumBar();
  } else if (S.phase === 'end') {
    setHeader('', 'Fertig!');
    if (phaseChanged) { renderEnd(); sfx.play('start'); }
    else renderEndControls();
    show('end');
  }
}

// ---------- LOBBY ----------
let lobbyTab = 'modes';
function renderLobby() {
  const s = S.settings, host = isHost();
  $('pCount').textContent = `${S.players.length}/${s.max}`;
  $('codePill').textContent = S.isPublic ? `Öffentlich ${S.code}` : `Code ${S.code}`;
  const slots = Math.max(s.max, S.players.length);
  let html = '';
  for (let i = 0; i < slots; i++) {
    const p = S.players[i];
    if (p) html += `<button class="pl ${p.id === S.hostId ? 'is-host' : ''} ${p.id === myId() ? 'is-me' : ''}" data-pid="${p.id}" type="button">${avHtml(p)}<span class="pl-n">${esc(p.name)}</span>${p.id === S.hostId ? '<span class="pl-crown" title="Spielleiter">👑</span>' : ''}</button>`;
    else if (i < S.players.length + 5) html += `<div class="pl empty"><span class="av ghost"></span><span class="pl-n">Leer</span></div>`;
  }
  $('playerGrid').innerHTML = html;
  // Modi
  $('modeGrid').innerHTML = MODES.map((m) => `<button class="mode ${m.id === s.mode ? 'on' : ''}" data-mode="${m.id}" type="button" ${host ? '' : 'disabled'}>
    <span class="m-ico">${m.ico}</span><span class="m-name">${esc(m.name)}</span><span class="m-desc">${esc(m.desc)}</span></button>`).join('');
  // Einstellungen
  const sel = (key, opts, val) => `<select data-set="${key}" ${host ? '' : 'disabled'}>${opts.map(([v, l]) => `<option value="${v}" ${String(v) === String(val) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const tog = (key, val) => `<label class="switch"><input type="checkbox" data-set="${key}" ${val ? 'checked' : ''} ${host ? '' : 'disabled'}><span></span></label>`;
  $('setList').innerHTML = `
    <div class="set"><span>⏱️ Zeit</span>${sel('time', Object.entries(TIMES).map(([k, v]) => [k, v.name]), s.time)}</div>
    <div class="set"><span>🔁 Runden</span>${sel('turns', TURNS, s.turns)}</div>
    <div class="set"><span>🤫 Geheimnis <small>Eigene Striche &amp; Buchstaben unsichtbar</small></span>${tog('secret', s.secret)}</div>
    ${s.anim ? `<div class="set"><span>🎞️ Animationstempo</span>${sel('fps', Object.entries(FPS).map(([k, v]) => [k, v[1]]), s.fps)}</div>` : ''}
    <div class="set"><span>👥 Max. Spieler</span>${sel('max', MAX_OPTS.map((v) => [v, String(v)]), s.max)}</div>
    <div class="set"><span>👀 Zuschauer mitten im Spiel <small>Neue schauen zu, nächstes Spiel sind sie dabei</small></span>${tog('lateJoin', s.lateJoin)}</div>
    <div class="set"><span>▶ Alben automatisch zeigen <small>Sonst blättert der Spielleiter</small></span>${tog('autoAlbum', s.autoAlbum)}</div>`;
  $('guestWait').classList.toggle('hidden', host);
  $('startBtn').classList.toggle('hidden', !host);
  const m = modeById(s.mode);
  const n = S.players.length;
  const need = isSoloFlow(s.flow) ? 1 : 2;
  $('startBtn').disabled = n < need;
  $('sbInfo').innerHTML = `<b>${m.ico} ${esc(m.name)}</b><span>${esc((TIMES[s.time] || {}).name || '')} · ${n < need ? 'Mindestens 2 Spieler' : `${turnPreview(s, n)} Runden`}</span>`;
}
function turnPreview(s, n) { return turnCount(s, Math.max(1, n)); }
$('modeGrid').addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (!b || !isHost()) return; sfx.play('pop'); room.send({ t: 'settings', mode: b.dataset.mode }); });
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
$('qrHint').onclick = () => { if (!S) return; openModal(`<h2>Lobby-Code</h2><div class="big-code">${esc(S.code)}</div><p>Auf der Zockbox-Startseite unter „Mit Code beitreten“ eintippen – oder den Link teilen.</p><div class="modal-btns"><button class="btn lime" type="button" id="mOk">OK</button></div>`, (c) => { c.querySelector('#mOk').onclick = closeModal; }); };
$('playerGrid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-pid]'); if (!b) return;
  playerMenu(b.dataset.pid);
});
$('doneList').addEventListener('click', (e) => { const b = e.target.closest('[data-pid]'); if (b) playerMenu(b.dataset.pid); });
function playerMenu(pid) {
  const p = S.players.find((x) => x.id === pid); if (!p) return;
  const canKick = isHost() && pid !== myId();
  openModal(`<div class="pm">${avHtml(p, 'av big')}<h2>${esc(p.name)}</h2><p>${pid === S.hostId ? '👑 Spielleiter' : p.spec ? '👀 Schaut zu' : 'Spieler'}</p></div>
    <div class="modal-btns"><button class="btn ghost" data-a="x" type="button">Schließen</button>${canKick ? '<button class="btn pink" data-a="kick" type="button">Rauswerfen</button>' : ''}</div>`, (c) => {
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
  $('thTitle').textContent = 'Und jetzt: aus dem Gedächtnis nachzeichnen!';
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
  const msg = { t: 'submit', turn: t.turn, img: board.exportComposite(keepUnder), auto };
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
    $('waitTitle').textContent = spec ? 'Du schaust zu 👀' : S.phase === 'collect' ? 'Zeit ist um!' : 'Fertig! Warte auf die anderen …';
    $('waitSub').textContent = spec ? 'Beim nächsten Spiel bist du dabei. Die Alben siehst du gleich mit.' : `${done} von ${players.length} sind fertig`;
    const specs = S.players.filter((p) => p.spec);
    $('doneList').innerHTML = players.map((p) => `<button type="button" data-pid="${p.id}" class="dl ${p.done ? 'ok' : ''}" title="${esc(p.name)}">${avHtml(p)}${p.done ? '<i>✓</i>' : ''}</button>`).join('') +
      (specs.length ? `<span class="dl-spec">👀 ${specs.map((p) => `<button type="button" data-pid="${p.id}" class="dl-sname">${esc(p.name)}</button>`).join(', ')}</span>` : '');
    $('editBtn').classList.toggle('hidden', !haveTask || S.phase !== 'play');
    $('forceBtn').classList.toggle('hidden', !isHost() || S.phase !== 'play');
  } else {
    board.locked = false;
    $('forceBtn').classList.add('hidden');
  }
}

// Werkzeuge
function buildTools() {
  $('sizeRow').innerHTML = SIZES.map((s, i) => `<button class="size ${i === 1 ? 'on' : ''}" data-size="${s}" type="button" aria-label="Größe ${i + 1}"><i style="width:${Math.min(28, 4 + s * 0.6)}px;height:${Math.min(28, 4 + s * 0.6)}px"></i></button>`).join('');
  $('palette').innerHTML = PALETTE.map((c, i) => `<button class="sw ${i === 0 ? 'on' : ''}" data-color="${c}" style="--sw:${c}" type="button" aria-label="Farbe ${c}"></button>`).join('') +
    `<label class="sw custom" title="Eigene Farbe" aria-label="Eigene Farbe"><input type="color" id="customColor" value="#7c5cff"><span>🎨</span></label>`;
}
buildTools();
function setTool(t) { board.tool = t; document.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === t)); }
function setColor(c) {
  board.color = c; document.querySelectorAll('#palette .sw').forEach((b) => b.classList.toggle('on', b.dataset.color === c));
  if (board.tool === 'eraser') setTool('pen');
  $('palette').style.setProperty('--cur', c);
}
$('tools').addEventListener('click', (e) => {
  const t = e.target.closest('[data-tool]'); if (t) { setTool(t.dataset.tool); sfx.play('click'); return; }
  const s = e.target.closest('[data-size]'); if (s) { board.size = +s.dataset.size; document.querySelectorAll('[data-size]').forEach((b) => b.classList.toggle('on', b === s)); return; }
  const c = e.target.closest('[data-color]'); if (c) setColor(c.dataset.color);
});
$('customColor').addEventListener('input', (e) => { setColor(e.target.value); document.querySelector('#palette .custom').classList.add('on'); });
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
  const map = { b: 'pen', p: 'pen', e: 'eraser', g: 'fill', f: 'fill', l: 'line', r: 'rect', o: 'ellipse' };
  if (map[k] && !e.ctrlKey && !e.metaKey) setTool(map[k]);
});

// ---------- ALBEN ----------
let animTimer = null;
function stepHtml(a, s, idx) {
  const by = s.by || { name: '?', avatar: '👻' };
  const body = s.type === 'text'
    ? `<div class="bubble ${s.text && s.text.trim() ? '' : 'empty'}">${esc(s.text && s.text.trim() ? s.text : '(nichts geschrieben)')}</div>`
    : `<div class="pic"><img src="${s.img}" alt="Zeichnung von ${esc(by.name)}" loading="lazy"></div>`;
  return `<article class="st ${s.type}" data-s="${idx}">
    <div class="st-who">${avHtml(by)}<span>${esc(by.name)}</span>${s.auto ? '<em title="Bei Zeitablauf automatisch abgegeben">⏰</em>' : ''}</div>
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
  const row = e.target.closest('.st-react'); if (!row) return;
  const idx = +row.dataset.s;
  const rx = e.target.closest('[data-e]'); if (rx) { sfx.play('like'); room.send({ t: 'react', i: curAlbum, s: idx, e: rx.dataset.e }); return; }
  const vb = e.target.closest('[data-v]');
  if (vb) { const v = +vb.dataset.v; const cur = a.myVotes[idx] || 0; const nv = cur === v ? 0 : v; a.myVotes[idx] = nv; room.send({ t: 'vote', i: curAlbum, s: idx, v: nv }); updateReacts(idx); }
});
function renderAlbum(fresh, newIdx) {
  const a = albums[curAlbum]; if (!a) return;
  $('albumWho').innerHTML = `${avHtml(a.owner)}<div><small>Album von</small><b>${esc(a.owner.name)}</b></div>`;
  $('albumNav').textContent = `${a.steps.filter(Boolean).length}/${a.count}`;
  const box = $('album');
  if (fresh) { box.innerHTML = ''; box.className = 'album k-' + a.kind; stopAnim(); }
  if (a.kind === 'anim') {
    if (!box.querySelector('.anim-stage')) box.innerHTML = `<div class="anim-stage"><img id="animImg" alt="Animation"><span class="anim-badge" id="animBadge"></span></div><div class="st-react" data-s="0">${reactBar({ ...a, score: false }, 0)}</div><div class="frames" id="frames"></div>`;
    const frames = animSteps(a);
    $('frames').innerHTML = frames.map((s, i) => `<button class="fr" data-f="${i}" type="button"><img src="${s.img}" alt=""><span>${i + 1}</span></button>`).join('');
    playAnim(a);
  } else {
    if (newIdx != null && a.steps[newIdx] && !box.querySelector(`.st[data-s="${newIdx}"]`)) {
      box.insertAdjacentHTML('beforeend', stepHtml(a, a.steps[newIdx], newIdx));
      const el = box.lastElementChild; el.classList.add('pop-in');
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
    } else if (fresh) box.innerHTML = a.steps.map((s, i) => s ? stepHtml(a, s, i) : '').join('');
    if (a.kind === 'corpse' && a.steps.filter(Boolean).length === a.count && !box.querySelector('.corpse-final')) {
      corpseCanvas(a.steps).then((c) => {
        if (albums[curAlbum] !== a) return;
        box.insertAdjacentHTML('beforeend', `<div class="corpse-final"><h3>🧟 Die fertige Figur</h3><img src="${c.toDataURL('image/png')}" alt="Fertige Figur"></div>`);
        box.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  }
  renderAlbumBar();
}
function animSteps(a) { const f = a.steps.filter(Boolean); return a.flow === 'hintergrund' && f.length > 1 ? f.slice(1) : f; }
function playAnim(a) {
  stopAnim();
  const st = animSteps(a);
  if (!st.length) return;
  let i = -1; const img = $('animImg'), badge = $('animBadge');
  const step = () => {
    i = (i + 1) % st.length; img.src = st[i].img;
    badge.textContent = `${i + 1}/${st.length} · ${st[i].by ? st[i].by.avatar + ' ' + st[i].by.name : ''}`;
    document.querySelectorAll('#frames .fr').forEach((f, k) => f.classList.toggle('on', k === i));
  };
  step();
  animTimer = setInterval(step, 1000 / (a.fps || 6));
}
function stopAnim() { if (animTimer) clearInterval(animTimer); animTimer = null; }
function renderAlbumBar() {
  if (!S || S.phase !== 'album' || !S.album) return;
  const host = isHost();
  const { shown, count, i, total } = S.album;
  $('nextBtn').classList.toggle('hidden', !host);
  $('autoBtn').classList.toggle('hidden', !host);
  $('autoBtn').textContent = S.settings.autoAlbum ? '⏸ Auto' : '▶ Auto';
  $('nextBtn').textContent = shown < count ? 'Weiter ▸' : i + 1 < total ? 'Nächstes ▸' : 'Zum Ende ▸';
  $('nextBtn').title = shown < count ? 'Nächsten Schritt zeigen' : i + 1 < total ? 'Nächstes Album' : 'Zum Ende';
  $('albumBar').dataset.guest = host ? '' : 'Der Spielleiter blättert weiter …';
}
$('nextBtn').onclick = () => { if (isHost()) { sfx.play('click'); room.send({ t: 'next' }); } };
$('autoBtn').onclick = () => { if (isHost()) room.send({ t: 'auto', on: !S.settings.autoAlbum }); };
$('dlPngBtn').onclick = (e) => downloadAlbum(curAlbum, 'png', e.currentTarget);
$('dlGifBtn').onclick = (e) => downloadAlbum(curAlbum, 'gif', e.currentTarget);
async function downloadAlbum(i, type, btn) {
  const a = albums[i]; if (!a) return;
  const view = { ...a, steps: a.kind === 'anim' ? animSteps(a) : a.steps.filter(Boolean) };
  if (!view.steps.length) { toast('Noch nichts zum Herunterladen', { err: true }); return; }
  const label = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = '⏳ …'; }
  try {
    const safe = a.owner.name.replace(/[^\wäöüÄÖÜß-]+/g, '_').slice(0, 20) || 'album';
    const blob = type === 'gif' ? await albumToGifBlob(view, a.fps || 6, (p) => { if (btn) btn.textContent = `⏳ ${Math.round(p * 100)} %`; }) : await albumToPngBlob(view);
    const r = await saveBlob(blob, `krakelpost-${safe}.${type}`);
    if (r === 'downloaded') toast(type === 'gif' ? 'GIF gespeichert 🎞️' : 'Bild gespeichert 🖼️');
  } catch (e) { console.warn(e); toast('Download hat nicht geklappt 😕', { err: true }); }
  finally { if (btn) { btn.disabled = false; btn.textContent = label; } }
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
      <div class="al-head">${avHtml(a.owner)}<div><b>${esc(a.owner.name)}</b><small>${a.steps.filter(Boolean).length} Schritte${likes ? ` · ${likes} Reaktionen` : ''}</small></div></div>
      ${lastImg ? `<img class="al-thumb" src="${lastImg.img}" alt="">` : ''}
      ${first && first.type === 'text' ? `<p class="al-first">„${esc(first.text || '…')}“</p>` : ''}
      <div class="al-btns"><button class="btn small ghost" data-view="${i}" type="button">👁 Ansehen</button><button class="btn small ghost" data-png="${i}" type="button">⤓ Bild</button><button class="btn small ghost" data-gif="${i}" type="button">⤓ GIF</button></div>
    </div>`;
  }).join('') : '<p class="muted center">Du bist zu spät gekommen – nächstes Mal bist du dabei!</p>';
  renderEndControls();
}
function renderEndControls() {
  const sc = S.scores;
  $('scoreCard').classList.toggle('hidden', !sc);
  if (sc) $('scoreCard').innerHTML = `<h3 class="card-h">🏆 Punkte</h3><ol class="scores">${sc.map((p, k) => `<li class="${k === 0 ? 'win' : ''}">${avHtml(p)}<span>${esc(p.name)}</span><b>${p.pts}</b></li>`).join('')}</ol>`;
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
  openModal(`<h2>Album von ${esc(a.owner.name)}</h2><div class="album mini">${a.kind === 'anim' ? `<div class="anim-stage"><img id="mAnim" alt="Animation"></div>` : steps.map((s) => `<article class="st ${s.type}"><div class="st-who">${avHtml(s.by || {})}<span>${esc((s.by || {}).name || '')}</span></div>${s.type === 'text' ? `<div class="bubble">${esc(s.text || '(nichts geschrieben)')}</div>` : `<div class="pic"><img src="${s.img}" alt=""></div>`}</article>`).join('')}</div>
    <div class="modal-btns"><button class="btn lime" id="mOk" type="button">Schließen</button></div>`, (c) => {
    let t = null;
    if (a.kind === 'anim') { let k = 0; const im = c.querySelector('#mAnim'); im.src = steps[0].img; t = setInterval(() => { if (!im.isConnected) { clearInterval(t); return; } k = (k + 1) % steps.length; im.src = steps[k].img; }, 1000 / (a.fps || 6)); }
    c.querySelector('#mOk').onclick = () => { if (t) clearInterval(t); closeModal(); };
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
      <button class="btn small lime" data-slot="${l.slot}" type="button" ${canJoin ? '' : 'disabled'}>Rein</button></div>`;
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
