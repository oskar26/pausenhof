// Memelympics – ein Pausenhof-Spiel – made by Oskar
import { Room } from '../../shared/net.js';
import { TEMPLATE_SETS } from './templates.js';

const GAME_ID = 'memelympics-v1';
const AVATARS = ['🐸','🦊','🐼','🐵','🐱','🐶','🦄','🐙','🤖','👽','🦖','🐧','🐷','🦁','🐨','🐯','🐮','🦉','🐝','🍕','🌮','👻','🤡','😎','🥸','🧠','🗿','🐢'];
const TOPICS = [
  'Montagmorgen', 'Mathe-Test', 'Hausaufgaben vergessen', 'WLAN ist weg', 'Pausenbrot', 'Lehrer kommt zu spät',
  'Gruppenarbeit', 'Zeugnistag', 'Klassenfahrt', 'Handy-Akku 1 %', 'Sportunterricht', 'Ferien sind vorbei',
  'Wenn der Wecker klingelt', 'Mama ruft zum Essen', 'Online-Unterricht', 'Vertretungsplan', 'Mensa-Essen',
  'Letzte Stunde Freitag', 'Referat halten', 'Elternabend', 'Game Update lädt', 'Kopfhörer vergessen',
  'Schnee-Frei', 'Busfahrt', 'Spickzettel', 'Geburtstag', 'Geschwister', 'Fußball', 'TikTok um 3 Uhr nachts',
  'Wenn das Essen kalt ist', 'Erster Schultag', 'Lehrer sagt: "Das kommt im Test dran"'
];
const VOTE_EMOJI = ['', '💀', '😐', '🙂', '😂', '🔥'];
const MAX_BOXES = 6;
const REROLLS = 2;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function toast(msg, ms = 2600) {
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
  me.avatar = AVATARS[(AVATARS.indexOf(me.avatar) + 1) % AVATARS.length];
  $('avatarBtn').textContent = me.avatar;
  localStorage.setItem('ph_avatar', me.avatar);
};
function readProfile() {
  let n = $('nameInput').value.trim().slice(0, 16);
  if (!n) n = 'Schüler' + Math.floor(100 + Math.random() * 900);
  me.name = n; $('nameInput').value = n;
  localStorage.setItem('ph_name', n);
  return { name: me.name, avatar: me.avatar };
}

// ---------------------------------------------------------------------------
// Bildschirme
// ---------------------------------------------------------------------------
const SCREENS = ['start', 'lobby', 'create', 'vote', 'results'];
function show(name) {
  for (const s of SCREENS) $('scr-' + s).classList.toggle('hidden', s !== name);
  window.scrollTo({ top: 0 });
}

// ---------------------------------------------------------------------------
// Meme-Darstellung
// ---------------------------------------------------------------------------
function defaultBoxes(tpl) {
  const n = Math.max(2, Math.min(tpl.b || 2, MAX_BOXES));
  const boxes = [];
  for (let i = 0; i < n; i++) {
    const y = n === 1 ? 4 : 3 + i * (78 / (n - 1));
    boxes.push({ text: '', x: 50, y: Math.round(y), w: 92, s: n > 2 ? 6 : 8, c: 'w' });
  }
  return boxes;
}

function renderMeme(el, tpl, boxes, opts = {}) {
  el.innerHTML = '';
  el.classList.toggle('editable', !!opts.editable);
  if (!tpl) return;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.alt = tpl.n || 'Meme';
  img.src = tpl.u;
  img.style.aspectRatio = `${tpl.w} / ${tpl.h}`;
  el.appendChild(img);
  if (tpl.gif) { const g = document.createElement('span'); g.className = 'gif-badge'; g.textContent = 'GIF'; el.appendChild(g); }
  (boxes || []).forEach((b, i) => {
    const d = document.createElement('div');
    d.className = 'txt' + (b.c === 'b' ? ' black' : '') + (!b.text ? ' empty' : '');
    d.style.left = b.x + '%';
    d.style.top = b.y + '%';
    d.style.width = b.w + '%';
    d.style.fontSize = b.s + 'cqw';
    d.textContent = b.text || (opts.editable ? `Text ${i + 1}` : '');
    if (opts.editable && !b.text) d.style.opacity = '.55';
    if (opts.editable) makeDraggable(d, el, b, opts.onChange);
    el.appendChild(d);
  });
}

function makeDraggable(d, container, box, onChange) {
  let start = null;
  d.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    d.setPointerCapture(e.pointerId);
    const r = container.getBoundingClientRect();
    start = { px: e.clientX, py: e.clientY, x: box.x, y: box.y, w: r.width, h: r.height };
  });
  d.addEventListener('pointermove', (e) => {
    if (!start) return;
    box.x = Math.max(5, Math.min(95, start.x + ((e.clientX - start.px) / start.w) * 100));
    box.y = Math.max(-2, Math.min(95, start.y + ((e.clientY - start.py) / start.h) * 100));
    d.style.left = box.x + '%';
    d.style.top = box.y + '%';
  });
  const end = () => { if (start) { start = null; onChange && onChange(); } };
  d.addEventListener('pointerup', end);
  d.addEventListener('pointercancel', end);
}

// Meme als PNG herunterladen (zeichnet Bild + Text auf ein Canvas)
async function downloadMeme(meme, filename = 'memelympics.png') {
  try {
    await document.fonts.load('40px Anton');
  } catch (e) {}
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = meme.tpl.u;
  await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, W, H);
  for (const b of meme.boxes) {
    if (!b.text) continue;
    const fs = (b.s / 100) * W;
    ctx.font = `${fs}px Anton, Impact, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';
    ctx.lineWidth = fs * 0.18;
    ctx.strokeStyle = b.c === 'b' ? '#fff' : '#000';
    ctx.fillStyle = b.c === 'b' ? '#000' : '#fff';
    const maxW = (b.w / 100) * W;
    const lines = wrapText(ctx, b.text.toUpperCase(), maxW);
    const cx = (b.x / 100) * W;
    let y = (b.y / 100) * H;
    for (const line of lines) {
      ctx.strokeText(line, cx, y);
      ctx.fillText(line, cx, y);
      y += fs * 1.08;
    }
  }
  const a = document.createElement('a');
  a.download = filename;
  a.href = c.toDataURL('image/png');
  a.click();
}
function wrapText(ctx, text, maxW) {
  const out = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = word; }
      else line = test;
    }
    out.push(line);
  }
  return out;
}

// ---------------------------------------------------------------------------
// HOST-LOGIK (läuft nur im Browser des Lobby-Erstellers)
// ---------------------------------------------------------------------------
let room = null;
let H = null; // Host-Zustand

function newHostState() {
  return {
    phase: 'lobby',
    settings: { mode: 'normal', rounds: 4, time: 90, max: 10, pack: 'all' },
    players: {}, order: [],
    round: 0, topic: null, endsAt: 0,
    assign: {}, subs: {}, drafts: {},
    entries: [], voteIdx: 0, votes: {},
    results: null, gallery: [], used: new Set(),
  };
}

function freshTemplate() {
  const all = TEMPLATE_SETS[H.settings.pack] || TEMPLATE_SETS.all;
  let pool = all.filter((t) => !H.used.has(t.id));
  if (pool.length < 3) { H.used.clear(); pool = all; }
  const t = pick(pool);
  H.used.add(t.id);
  return t;
}

function hostAddPlayer(id, hello) {
  H.players[id] = {
    name: String(hello.name || 'Gast').slice(0, 16),
    avatar: AVATARS.includes(hello.avatar) ? hello.avatar : pick(AVATARS),
    score: 0,
  };
  H.order.push(id);
  if (H.phase === 'create' && !H.assign[id]) {
    H.assign[id] = { tpl: H.settings.mode === 'same' ? H.sameTpl : freshTemplate(), rerolls: REROLLS };
  }
}

function playerCount() { return H.order.length; }

function publicState() {
  const players = H.order.map((id) => ({ id, ...H.players[id] }));
  const st = {
    t: 'state',
    phase: H.phase,
    hostId: room.myId,
    code: room.code,
    isPublic: room.isPublic,
    settings: H.settings,
    players,
    round: H.round,
    topic: H.topic,
    endsIn: H.endsAt ? Math.max(0, H.endsAt - Date.now()) : 0,
  };
  if (H.phase === 'create') {
    st.assign = H.assign;
    st.submitted = Object.keys(H.subs);
  }
  if (H.phase === 'vote') {
    const e = H.entries[H.voteIdx];
    st.vote = {
      idx: H.voteIdx, total: H.entries.length,
      author: e.author, meme: e.meme,
      voted: Object.keys(H.votes[e.author] || {}).length,
      eligible: eligibleVoters(e.author).length,
    };
  }
  if (H.phase === 'results' || H.phase === 'final') {
    st.results = H.results;
    if (H.phase === 'final') st.gallery = H.gallery.slice().sort((a, b) => b.pts - a.pts).slice(0, 12);
  }
  return st;
}

function sync() { if (room && room.isHost) room.broadcast(publicState()); }
function sysChat(text) { room.broadcast({ t: 'chat', sys: true, text }); }

function eligibleVoters(author) { return H.order.filter((id) => id !== author); }

function startRound() {
  H.round++;
  H.phase = 'create';
  H.subs = {}; H.drafts = {}; H.assign = {}; H.results = null;
  H.topic = H.settings.mode === 'topics' ? pick(TOPICS) : null;
  H.sameTpl = H.settings.mode === 'same' ? freshTemplate() : null;
  for (const id of H.order) {
    H.assign[id] = { tpl: H.sameTpl || freshTemplate(), rerolls: H.settings.mode === 'same' ? 0 : REROLLS };
  }
  H.endsAt = Date.now() + H.settings.time * 1000;
  sync();
}

function endCreate() {
  const entries = [];
  for (const id of H.order) {
    const m = H.subs[id] || H.drafts[id];
    if (m && m.boxes.some((b) => b.text && b.text.trim())) entries.push({ author: id, meme: m });
  }
  H.entries = shuffle(entries);
  H.votes = {};
  H.voteIdx = 0;
  if (!H.entries.length) {
    sysChat('Niemand hat ein Meme gemacht 😴');
    return afterRound();
  }
  startVoteFor(0);
}

function voteSeconds() { return playerCount() > 12 ? 8 : 11; }

function startVoteFor(i) {
  H.voteIdx = i;
  H.phase = 'vote';
  const e = H.entries[i];
  H.votes[e.author] = H.votes[e.author] || {};
  H.endsAt = Date.now() + (eligibleVoters(e.author).length ? voteSeconds() : 4) * 1000;
  sync();
}

function nextMeme() {
  if (H.voteIdx + 1 < H.entries.length) startVoteFor(H.voteIdx + 1);
  else computeRound();
}

function computeRound() {
  const relaxed = H.settings.mode === 'relaxed';
  const gains = {};
  let best = null;
  for (const e of H.entries) {
    const vs = Object.values(H.votes[e.author] || {});
    const sum = vs.reduce((a, b) => a + b, 0);
    const avg = vs.length ? sum / vs.length : 0;
    const pts = relaxed ? 0 : sum * 10;
    gains[e.author] = pts;
    if (H.players[e.author]) H.players[e.author].score += pts;
    const p = H.players[e.author] || { name: 'Weg', avatar: '👻' };
    const g = { meme: e.meme, name: p.name, avatar: p.avatar, pts: sum * 10, avg: Math.round(avg * 10) / 10, round: H.round };
    H.gallery.push(g);
    if (!best || g.pts > best.pts) best = g;
  }
  H.results = { gains, best, relaxed };
  afterRound();
}

function afterRound() {
  if (H.round >= H.settings.rounds) {
    H.phase = 'final';
    H.endsAt = 0;
    if (!H.results) H.results = { gains: {}, best: null, relaxed: H.settings.mode === 'relaxed' };
  } else {
    H.phase = 'results';
    H.endsAt = Date.now() + 9000;
    if (!H.results) H.results = { gains: {}, best: null, relaxed: H.settings.mode === 'relaxed' };
  }
  sync();
}

function hostTick() {
  if (!H || !H.endsAt || Date.now() < H.endsAt) return;
  H.endsAt = 0;
  if (H.phase === 'create') endCreate();
  else if (H.phase === 'vote') nextMeme();
  else if (H.phase === 'results') { H.results = null; startRound(); }
}

function cleanBoxes(boxes) {
  if (!Array.isArray(boxes)) return [];
  return boxes.slice(0, MAX_BOXES).map((b) => ({
    text: String(b.text || '').slice(0, 140),
    x: +b.x || 50, y: +b.y || 0, w: Math.max(20, Math.min(100, +b.w || 92)),
    s: Math.max(3, Math.min(16, +b.s || 8)), c: b.c === 'b' ? 'b' : 'w',
  }));
}

function hostHandle(from, msg) {
  const isHostMsg = from === room.myId;
  const a = H.assign[from];
  switch (msg.t) {
    case 'settings':
      if (!isHostMsg || H.phase !== 'lobby') return;
      Object.assign(H.settings, {
        mode: ['normal', 'same', 'topics', 'relaxed'].includes(msg.mode) ? msg.mode : H.settings.mode,
        rounds: Math.max(1, Math.min(10, +msg.rounds || 4)),
        time: Math.max(30, Math.min(180, +msg.time || 90)),
        max: Math.max(2, Math.min(30, +msg.max || 10)),
        pack: TEMPLATE_SETS[msg.pack] ? msg.pack : H.settings.pack,
      });
      sync();
      break;
    case 'start':
      if (!isHostMsg || (H.phase !== 'lobby')) return;
      H.round = 0; H.gallery = []; H.results = null;
      for (const id of H.order) H.players[id].score = 0;
      sysChat('Los geht’s! 🏁');
      startRound();
      break;
    case 'again':
      if (!isHostMsg) return;
      H.phase = 'lobby'; H.round = 0; H.endsAt = 0; H.results = null; H.gallery = [];
      for (const id of H.order) H.players[id].score = 0;
      sync();
      break;
    case 'reroll':
      if (H.phase !== 'create' || !a || a.rerolls <= 0 || H.subs[from]) return;
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
      if (H.order.every((id) => H.subs[id])) { H.endsAt = 0; endCreate(); }
      else sync();
      break;
    case 'unsubmit':
      if (H.phase !== 'create') return;
      delete H.subs[from];
      sync();
      break;
    case 'vote': {
      if (H.phase !== 'vote') return;
      const e = H.entries[H.voteIdx];
      const v = Math.max(1, Math.min(5, Math.round(+msg.v)));
      if (!e || e.author === from || msg.idx !== H.voteIdx) return;
      H.votes[e.author][from] = v;
      const el = eligibleVoters(e.author);
      if (el.every((id) => H.votes[e.author][id])) H.endsAt = Math.min(H.endsAt, Date.now() + 1200);
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
      setTimeout(() => room.kick(msg.id), 200);
      hostRemove(msg.id);
      break;
  }
}

function hostRemove(id) {
  if (!H.players[id]) return;
  const name = H.players[id].name;
  delete H.players[id];
  H.order = H.order.filter((x) => x !== id);
  delete H.assign[id]; delete H.subs[id];
  sysChat(`${name} hat die Lobby verlassen`);
  if (H.phase === 'create' && H.order.length && H.order.every((x) => H.subs[x])) { H.endsAt = 0; endCreate(); return; }
  sync();
}

function setupHost() {
  H = newHostState();
  room.getInfo = () => ({
    phase: H.phase, players: playerCount(), max: H.settings.max, mode: H.settings.mode, pack: H.settings.pack,
    host: H.players[room.myId] ? H.players[room.myId].name : '?',
  });
  room.onClientJoin = (id, hello) => {
    if (playerCount() >= H.settings.max) {
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

// ---------------------------------------------------------------------------
// CLIENT-LOGIK (läuft bei allen, auch beim Host)
// ---------------------------------------------------------------------------
let S = null;              // letzter Zustand vom Host
let localDeadline = 0;
const editor = { tplId: null, round: -1, tpl: null, boxes: [] };
let myVote = { idx: -1, v: 0 };
let lastPhase = null;

function onHostMessage(msg) {
  if (!msg || typeof msg !== 'object') return;
  if (msg.t === 'state') { S = msg; localDeadline = msg.endsIn ? Date.now() + msg.endsIn : 0; render(); }
  else if (msg.t === 'chat') addChat(msg);
  else if (msg.t === 'full') { toast('Die Lobby ist voll 😕'); resetToStart(); }
  else if (msg.t === 'kicked') { toast('Du wurdest aus der Lobby entfernt'); resetToStart(); }
}

function resetToStart() {
  const old = room; room = null;
  if (old) old.leave();
  S = null; H = null; lastPhase = null;
  editor.tplId = null; editor.round = -1;
  $('chatLog').innerHTML = '';
  history.replaceState(null, '', location.pathname);
  show('start');
}

function isHost() { return room && room.isHost; }

function render() {
  if (!S) return;
  const phaseChanged = S.phase !== lastPhase;
  lastPhase = S.phase;
  if (S.phase === 'lobby') renderLobby();
  else if (S.phase === 'create') renderCreate();
  else if (S.phase === 'vote') renderVote();
  else renderResults();
  if (phaseChanged) {
    const scr = { lobby: 'lobby', create: 'create', vote: 'vote', results: 'results', final: 'results' }[S.phase];
    show(scr);
  }
}

// LOBBY
function renderLobby() {
  $('lobbyCode').textContent = S.code;
  $('playerCount').textContent = `(${S.players.length}/${S.settings.max})`;
  $('playerList').innerHTML = S.players.map((p) => `
    <div class="player ${p.id === room.myId ? 'me' : ''}">
      ${p.id === S.hostId ? '<span class="crown">👑</span>' : ''}
      <span class="avatar">${esc(p.avatar)}</span><span class="nm">${esc(p.name)}</span>
      ${isHost() && p.id !== S.hostId ? `<button class="kick" data-kick="${esc(p.id)}" title="Entfernen">✕</button>` : ''}
    </div>`).join('');
  const host = isHost();
  for (const id of ['setMode', 'setRounds', 'setTime', 'setMax', 'setPack']) $(id).disabled = !host;
  $('setPack').value = S.settings.pack;
  $('setMode').value = S.settings.mode;
  $('setRounds').value = String(S.settings.rounds);
  $('setTime').value = String(S.settings.time);
  $('setMax').value = String(S.settings.max);
  $('startBtn').classList.toggle('hidden', !host);
  $('waitHost').classList.toggle('hidden', host);
  $('startBtn').disabled = S.players.length < 2;
  $('startBtn').textContent = S.players.length < 2 ? 'Warte auf Mitspieler…' : '▶ Spiel starten';
}
$('playerList').addEventListener('click', (e) => {
  const id = e.target.dataset && e.target.dataset.kick;
  if (id) room.send({ t: 'kick', id });
});
for (const id of ['setMode', 'setRounds', 'setTime', 'setMax', 'setPack']) {
  $(id).addEventListener('change', () => room.send({
    t: 'settings', mode: $('setMode').value, rounds: $('setRounds').value, time: $('setTime').value, max: $('setMax').value, pack: $('setPack').value,
  }));
}
$('startBtn').onclick = () => room.send({ t: 'start' });
$('leaveBtn').onclick = () => resetToStart();
$('copyLinkBtn').onclick = async () => {
  const q = S.isPublic ? `?pub=${S.code.replace('Ö', '')}` : `?code=${S.code}`;
  const url = location.origin + location.pathname + q;
  try { await navigator.clipboard.writeText(url); toast('Link kopiert!'); }
  catch (e) { prompt('Link zum Teilen:', url); }
};

// CHAT
function addChat(m) {
  const log = $('chatLog');
  const d = document.createElement('div');
  if (m.sys) { d.className = 'sys'; d.textContent = m.text; }
  else d.innerHTML = `${esc(m.avatar)} <b>${esc(m.name)}:</b> ${esc(m.text)}`;
  log.appendChild(d);
  while (log.children.length > 80) log.firstChild.remove();
  log.scrollTop = log.scrollHeight;
}
$('chatForm').onsubmit = (e) => {
  e.preventDefault();
  const v = $('chatInput').value.trim();
  if (v && room) room.send({ t: 'chat', text: v });
  $('chatInput').value = '';
};

// CREATE
let draftTimer = null;
function sendDraft() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => room && room.send({ t: 'draft', boxes: editor.boxes }), 600);
}

function renderCreate() {
  const a = S.assign && S.assign[room.myId];
  $('roundLabel').textContent = `Runde ${S.round}/${S.settings.rounds}`;
  $('topicLabel').classList.toggle('hidden', !S.topic);
  $('topicLabel').textContent = S.topic ? `Thema: ${S.topic}` : '';
  if (!a) return;
  if (a.tpl.id !== editor.tplId || S.round !== editor.round) {
    // neue Vorlage: Texte behalten, wenn möglich
    const old = editor.round === S.round ? editor.boxes.map((b) => b.text) : [];
    editor.tpl = a.tpl; editor.tplId = a.tpl.id; editor.round = S.round;
    editor.boxes = defaultBoxes(a.tpl);
    old.forEach((t, i) => { if (editor.boxes[i]) editor.boxes[i].text = t; });
    drawEditor(); buildInputs();
  }
  $('rerollCount').textContent = a.rerolls;
  $('rerollBtn').disabled = a.rerolls <= 0;
  $('rerollBtn').classList.toggle('hidden', S.settings.mode === 'same');
  const submitted = (S.submitted || []).includes(room.myId);
  $('scr-create').classList.toggle('locked', submitted);
  $('submitBtn').textContent = submitted ? '✏️ Doch noch bearbeiten' : '✅ Fertig!';
  $('submitBtn').classList.toggle('mint', !submitted);
  $('submitBtn').classList.toggle('orange', submitted);
  $('submitState').textContent = `${(S.submitted || []).length}/${S.players.length} fertig`;
}

function drawEditor() {
  renderMeme($('editorMeme'), editor.tpl, editor.boxes, { editable: true, onChange: sendDraft });
}

function buildInputs() {
  const wrap = $('boxInputs');
  wrap.innerHTML = '';
  editor.boxes.forEach((b, i) => {
    const row = document.createElement('div');
    row.className = 'box-input';
    row.innerHTML = `
      <textarea maxlength="140" placeholder="Text ${i + 1}">${esc(b.text)}</textarea>
      <div class="box-tools">
        <button data-a="big" title="Größer">A+</button>
        <button data-a="small" title="Kleiner">A−</button>
        <button data-a="col" class="col ${b.c === 'b' ? 'w' : ''}" title="Farbe">${b.c === 'b' ? '⚪' : '⚫'}</button>
        ${editor.boxes.length > 1 ? '<button data-a="del" title="Löschen">🗑</button>' : ''}
      </div>`;
    row.querySelector('textarea').addEventListener('input', (e) => { b.text = e.target.value; drawEditor(); sendDraft(); });
    row.querySelector('.box-tools').addEventListener('click', (e) => {
      const act = e.target.dataset.a;
      if (!act) return;
      if (act === 'big') b.s = Math.min(16, b.s + 1);
      if (act === 'small') b.s = Math.max(3, b.s - 1);
      if (act === 'col') b.c = b.c === 'b' ? 'w' : 'b';
      if (act === 'del') editor.boxes.splice(i, 1);
      drawEditor(); buildInputs(); sendDraft();
    });
    wrap.appendChild(row);
  });
  $('addBoxBtn').disabled = editor.boxes.length >= MAX_BOXES;
}
$('addBoxBtn').onclick = () => {
  if (editor.boxes.length >= MAX_BOXES) return;
  editor.boxes.push({ text: '', x: 50, y: 45, w: 80, s: 7, c: 'w' });
  drawEditor(); buildInputs();
};
$('rerollBtn').onclick = () => room.send({ t: 'reroll' });
$('submitBtn').onclick = () => {
  const submitted = (S.submitted || []).includes(room.myId);
  if (submitted) { room.send({ t: 'unsubmit' }); return; }
  if (!editor.boxes.some((b) => b.text.trim())) { toast('Schreib erst einen Text 😉'); return; }
  room.send({ t: 'submit', boxes: editor.boxes });
};

// VOTE
function renderVote() {
  const v = S.vote;
  $('voteLabel').textContent = `Meme ${v.idx + 1}/${v.total} · Runde ${S.round}/${S.settings.rounds}`;
  $('voteTopic').classList.toggle('hidden', !S.topic);
  $('voteTopic').textContent = S.topic ? `Thema: ${S.topic}` : '';
  if (myVote.idx !== v.idx || myVote.round !== S.round) {
    myVote = { idx: v.idx, round: S.round, v: 0 };
    renderMeme($('voteMeme'), v.meme.tpl, v.meme.boxes);
  }
  const mine = v.author === room.myId;
  $('voteBtns').classList.toggle('off', mine);
  for (const b of $('voteBtns').querySelectorAll('button')) b.classList.toggle('sel', +b.dataset.v === myVote.v);
  $('voteNote').textContent = mine ? '🫣 Das ist dein Meme! Warte auf die Bewertungen…' : `${v.voted}/${v.eligible} haben bewertet`;
}
$('voteBtns').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || !S || S.phase !== 'vote') return;
  myVote.v = +b.dataset.v;
  room.send({ t: 'vote', v: myVote.v, idx: S.vote.idx });
  renderVote();
});

// RESULTS / FINAL
function renderResults() {
  const final = S.phase === 'final';
  const R = S.results || { gains: {}, best: null };
  $('resultsTitle').textContent = final ? '🏆 Siegerehrung' : `Ergebnis Runde ${S.round}`;
  const sorted = S.players.slice().sort((a, b) => b.score - a.score);
  // Podium
  $('podium').classList.toggle('hidden', !final || R.relaxed);
  if (final && !R.relaxed) {
    const order = [[sorted[1], 's', '2'], [sorted[0], 'g', '1'], [sorted[2], 'b', '3']];
    $('podium').innerHTML = order.filter((o) => o[0]).map(([p, c, n]) => `
      <div class="pod ${c}"><div class="av">${esc(p.avatar)}</div><div class="who">${esc(p.name)}</div><div class="bar">${n}</div><div class="muted">${p.score} P</div></div>`).join('');
  }
  // Bestes Meme
  $('bestMemeWrap').classList.toggle('hidden', !R.best || final);
  if (R.best && !final) {
    renderMeme($('bestMeme'), R.best.meme.tpl, R.best.meme.boxes);
    $('bestBy').innerHTML = `${esc(R.best.avatar)} ${esc(R.best.name)} · Ø ${R.best.avg} ${VOTE_EMOJI[Math.round(R.best.avg)] || ''} <button class="btn small ghost" id="dlBest">⬇ Speichern</button>`;
    $('dlBest').onclick = () => downloadMeme(R.best.meme);
  }
  // Punkteliste
  $('scoreList').innerHTML = R.relaxed ? '<p class="muted center">Chillig-Modus: keine Punkte, nur Spaß 😌</p>' :
    sorted.map((p, i) => `
      <div class="score-row"><span class="pos">${i + 1}.</span><span class="avatar">${esc(p.avatar)}</span><span>${esc(p.name)}</span>
      <span class="pts">${p.score}${!final && R.gains[p.id] ? `<span class="plus">+${R.gains[p.id]}</span>` : ''}</span></div>`).join('');
  // Galerie
  $('gallery').classList.toggle('hidden', !final);
  if (final) {
    const g = S.gallery || [];
    $('gallery').innerHTML = g.length ? '' : '<p class="muted">Keine Memes 😴</p>';
    g.forEach((item, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'item';
      const m = document.createElement('div'); m.className = 'meme';
      renderMeme(m, item.meme.tpl, item.meme.boxes);
      const cap = document.createElement('div'); cap.className = 'cap';
      cap.innerHTML = `<span>${esc(item.avatar)} ${esc(item.name)} · ${item.pts} P</span>`;
      const dl = document.createElement('button'); dl.className = 'btn small ghost'; dl.textContent = '⬇';
      dl.onclick = () => downloadMeme(item.meme, `memelympics-${i + 1}.png`);
      cap.appendChild(dl);
      wrap.append(m, cap);
      $('gallery').appendChild(wrap);
    });
  }
  $('againBtn').classList.toggle('hidden', !(final && isHost()));
  $('nextNote').textContent = final ? (isHost() ? '' : 'Der Host kann eine neue Runde starten.') : 'Nächste Runde startet gleich…';
}
$('againBtn').onclick = () => room.send({ t: 'again' });

// TIMER-ANZEIGE
setInterval(() => {
  if (!S || !localDeadline) return;
  const s = Math.max(0, Math.ceil((localDeadline - Date.now()) / 1000));
  const el = S.phase === 'create' ? $('timer') : S.phase === 'vote' ? $('voteTimer') : null;
  if (el) { el.textContent = s; el.classList.toggle('low', s <= 10 && S.phase === 'create'); }
  if (S.phase === 'results') $('nextNote').textContent = `Nächste Runde in ${s} s…`;
}, 200);

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
  if (t === 'network' || t === 'server-error' || t === 'socket-error' || (e && e.message === 'timeout')) return 'Keine Verbindung zum Vermittlungsserver. Ist das Netz blockiert?';
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
  room = newRoom(); if (!room) return;
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
  const modeName = { normal: 'Normal', same: 'Gleiches Meme', topics: 'Themen', relaxed: 'Chillig' };
  box.innerHTML = list.map((l) => `
    <div class="browse-item"><div><b>Lobby von ${esc(l.host)}</b><div class="muted">${l.players}/${l.max} · ${modeName[l.mode] || ''} · ${l.phase === 'lobby' ? 'wartet' : 'läuft'}</div></div>
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
  $('joinBtn').textContent = 'Beitreten';
  $('codeInput').placeholder = `Ö${n}`;
  $('joinBtn').onclick = (e) => busy(e.currentTarget, () => joinPub(n));
}

window.addEventListener('beforeunload', (e) => {
  if (room && room.isHost && S && S.players.length > 1) { e.preventDefault(); e.returnValue = ''; }
});
