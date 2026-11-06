// Zockbox – Startseite (Bibliothek): Flüster-Intro, Profil, Einstellungen, "Mit Code beitreten", iPhone-Installationshinweis.
// made by Oskar
import { AVATARS, getProfile, setName, setAvatar, randomName, NAME_MAX } from './profile.js';

// Spiele, die per Code beitreten können.
// id = interner Schlüssel für die Auswahl-Chips (data-game in index.html).
// peerPrefixes = mögliche Peer-ID-Präfixe (aus shared/net.js: `zockbox-${GAME_ID}-p-CODE`).
// Wenn ein Spiel seine GAME_ID ändert, hier anpassen.
const GAMES = [
  { id: 'machs-meme', name: "Mach's Meme", icon: '😂', path: 'games/machs-meme/', peerPrefixes: ['zockbox-machs-meme-v1-'] },
  { id: 'wikirennen', name: 'Wikirennen', icon: '🏁', path: 'games/wikirennen/', peerPrefixes: ['zockbox-wikirennen-v1-'] },
  { id: 'kritzel-duell', name: 'Kritzel-Duell', icon: '✏️', path: 'games/kritzel-duell/', peerPrefixes: ['zockbox-kritzel-duell-v1-'] }, // GAME_ID 'kritzel-duell-v1'
  { id: 'krakelpost', name: 'Krakelpost', icon: '✉️', path: 'games/krakelpost/', peerPrefixes: ['zockbox-krakelpost-v1-'] }, // GAME_ID 'krakelpost-v1'
];
const PEERJS_URL = new URL('./vendor/peerjs.min.js', import.meta.url).href;

const $ = (id) => document.getElementById(id);

function toast(msg, ms = 2600) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg; t.setAttribute('role', 'status');
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

// ---------------------------------------------------------------------------
// Profil
// ---------------------------------------------------------------------------
function initProfile() {
  const prof = getProfile();
  const nameIn = $('phName'), avBtn = $('phAvatar'), grid = $('phAvatarGrid');
  nameIn.maxLength = NAME_MAX;
  nameIn.value = prof.name;
  avBtn.textContent = prof.avatar;
  const syncMe = () => {
    const p = getProfile();
    const av = $('zbMeAv'), nm = $('zbMeName');
    if (av) av.textContent = p.avatar;
    if (nm) nm.textContent = p.name || 'Profil';
  };
  syncMe();

  grid.innerHTML = '';
  for (const a of AVATARS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ph-avatar-opt'; b.textContent = a;
    b.setAttribute('aria-label', 'Avatar ' + a);
    if (a === prof.avatar) b.setAttribute('aria-pressed', 'true');
    b.onclick = () => {
      setAvatar(a); avBtn.textContent = a;
      grid.querySelectorAll('[aria-pressed]').forEach((x) => x.removeAttribute('aria-pressed'));
      b.setAttribute('aria-pressed', 'true');
      toggleGrid(false);
      saved();
    };
    grid.appendChild(b);
  }
  const toggleGrid = (open = grid.classList.contains('hidden')) => {
    grid.classList.toggle('hidden', !open);
    avBtn.setAttribute('aria-expanded', String(open));
  };
  avBtn.onclick = () => toggleGrid();

  let timer;
  const saved = () => {
    syncMe();
    const s = $('phSaved');
    s.classList.add('on'); clearTimeout(timer);
    timer = setTimeout(() => s.classList.remove('on'), 1400);
  };
  nameIn.addEventListener('input', () => { setName(nameIn.value); saved(); });
  nameIn.addEventListener('blur', () => { nameIn.value = setName(nameIn.value); syncMe(); });
  nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameIn.blur(); });
  $('phDice').onclick = () => {
    nameIn.value = setName(randomName());
    const a = AVATARS[Math.floor(Math.random() * AVATARS.length)];
    setAvatar(a); avBtn.textContent = a;
    saved();
  };
}

// ---------------------------------------------------------------------------
// Mit Code beitreten
// ---------------------------------------------------------------------------
let selected = 'auto';

function cleanCode(v) {
  const s = String(v || '').toUpperCase().replace(/\s/g, '');
  if (s.startsWith('Ö')) return 'Ö' + s.slice(1).replace(/[^0-9]/g, '').slice(0, 1); // öffentliche Lobby, z. B. Ö3
  return s.replace(/[^A-Z]/g, '').slice(0, 4);
}

function go(game, code) {
  const pub = /^Ö(\d)$/.exec(code);
  const q = pub ? `?pub=${pub[1]}` : `?code=${encodeURIComponent(code)}`;
  location.href = game.path + q;
}

function loadPeerJS() {
  if (window.Peer) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = PEERJS_URL; s.onload = () => res(); s.onerror = () => rej(new Error('peerjs'));
    document.head.appendChild(s);
  });
}

// Fragt beim PeerJS-Vermittler nach, in welchem Spiel eine Lobby mit diesem Code offen ist.
// Wir öffnen nur kurz eine Verbindung und schließen sie sofort wieder (kein "hello" → der Host ignoriert uns).
async function findGame(code) {
  await loadPeerJS();
  const peer = await new Promise((resolve, reject) => {
    const p = new window.Peer({ debug: 0 });
    const t = setTimeout(() => { try { p.destroy(); } catch (e) {} reject(new Error('timeout')); }, 9000);
    p.on('open', () => { clearTimeout(t); resolve(p); });
    p.on('error', (err) => { if (!p.open) { clearTimeout(t); try { p.destroy(); } catch (e) {} reject(err); } });
  });
  const pub = /^Ö(\d)$/.exec(code);
  const suffix = pub ? `pub-${pub[1]}` : `p-${code}`;

  const probe = (targetId) => new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; peer.off('error', onErr); resolve(v); } };
    const onErr = (err) => { if (err && err.type === 'peer-unavailable' && String(err.message || '').includes(targetId)) finish(false); };
    peer.on('error', onErr);
    const conn = peer.connect(targetId, { reliable: true });
    conn.on('open', () => { finish(true); setTimeout(() => { try { conn.close(); } catch (e) {} }, 50); });
    conn.on('error', () => finish(false));
    setTimeout(() => { try { if (!done) conn.close(); } catch (e) {} finish(false); }, 6000);
  });

  const found = [];
  await Promise.all(GAMES.map(async (g) => {
    const hits = await Promise.all(g.peerPrefixes.map((pre) => probe(pre + suffix)));
    if (hits.some(Boolean)) found.push(g);
  }));
  setTimeout(() => { try { peer.destroy(); } catch (e) {} }, 300);
  return found;
}

function setStatus(msg, kind = '') {
  const s = $('joinStatus');
  s.textContent = msg; s.dataset.kind = kind;
  s.classList.toggle('hidden', !msg);
}

function initJoin() {
  const input = $('joinCode'), btn = $('joinGo');
  const chips = document.querySelectorAll('#joinGame [data-game]');
  const pick = (id) => {
    selected = id;
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.game === id)));
  };
  chips.forEach((c) => c.addEventListener('click', () => { pick(c.dataset.game); setStatus(''); }));
  pick('auto');

  // Vier Buchstaben-Kacheln zeigen, was im (unsichtbaren) Eingabefeld steht.
  const tilesBox = input.closest('.zx-tiles');
  const tiles = tilesBox ? [...tilesBox.querySelectorAll('.zx-tile')] : [];
  const paint = () => {
    const chars = [...input.value];
    tiles.forEach((t, i) => {
      t.textContent = chars[i] || '';
      t.classList.toggle('cur', i === Math.min(chars.length, tiles.length - 1));
    });
  };
  if (tilesBox) {
    input.addEventListener('focus', () => { tilesBox.classList.add('focus'); paint(); });
    input.addEventListener('blur', () => tilesBox.classList.remove('focus'));
    // Cursor immer ans Ende, damit Tippen/Löschen zu den Kacheln passt
    const toEnd = () => { try { const n = input.value.length; input.setSelectionRange(n, n); } catch (e) {} };
    input.addEventListener('click', toEnd);
    input.addEventListener('keyup', toEnd);
  }

  input.addEventListener('input', () => {
    const v = cleanCode(input.value);
    if (v !== input.value) input.value = v;
    paint();
    setStatus('');
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') btn.click(); });

  $('joinForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = cleanCode(input.value);
    const valid = /^[A-Z]{4}$/.test(code) || /^Ö\d$/.test(code);
    if (!valid) { setStatus('Der Code hat 4 Buchstaben, z. B. KXPM.', 'err'); input.focus(); return; }

    if (selected !== 'auto') { go(GAMES.find((g) => g.id === selected), code); return; }

    // Kein btn.disabled: in Chromium "verschluckt" ein während des Klicks deaktivierter Button danach manchmal Klicks.
    if (btn.getAttribute('aria-busy') === 'true') return;
    btn.setAttribute('aria-busy', 'true');
    const old = btn.textContent;
    btn.textContent = 'Suche …';
    setStatus('Ich suche die Lobby in allen Spielen …', 'wait');
    try {
      const found = await findGame(code);
      if (found.length === 1) { setStatus(`Gefunden: ${found[0].icon} ${found[0].name}!`, 'ok'); go(found[0], code); return; }
      if (found.length > 1) setStatus('Den Code gibt es in mehreren Spielen. Tipp unten auf das richtige Spiel.', 'err');
      else setStatus('Keine offene Lobby mit diesem Code gefunden. Stimmt der Code? Oder wähl das Spiel unten aus.', 'err');
    } catch (err) {
      setStatus('Konnte nicht automatisch suchen. Wähl bitte unten das Spiel aus.', 'err');
    } finally {
      btn.removeAttribute('aria-busy'); btn.textContent = old;
    }
  });

  // ?join=ABCD in der Hub-URL füllt das Feld vor
  const pre = new URLSearchParams(location.search).get('join');
  if (pre) {
    input.value = cleanCode(pre);
    paint();
    setStatus('Code eingetragen – tipp auf „Los“, um beizutreten.', 'ok');
  }
}

// ---------------------------------------------------------------------------
// "Zum Home-Bildschirm" (iPhone/iPad Safari)
// ---------------------------------------------------------------------------
function initInstallHint() {
  const box = $('installHint');
  if (!box) return;
  const standalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let dismissed = false;
  try { dismissed = localStorage.getItem('ph_install_hint') === 'off'; } catch (e) {}
  if (ios && !standalone && !dismissed) box.classList.remove('hidden');
  $('installClose').onclick = () => {
    box.classList.add('hidden');
    try { localStorage.setItem('ph_install_hint', 'off'); } catch (e) {}
  };
}

// ---------------------------------------------------------------------------
// Flüster-Intro ("psst…") – nur Startseite. Ob es läuft, entscheidet das kleine Inline-Skript im <head>
// (Klasse zb-intro-on). Das Ausblenden passiert per CSS-Animation; hier nur Überspringen + Aufräumen.
// ---------------------------------------------------------------------------
const INTRO_MS = 2200;
function initIntro() {
  const el = $('zbIntro');
  const root = document.documentElement;
  if (!el) return;
  if (!root.classList.contains('zb-intro-on')) { el.remove(); return; }
  let done = false;
  const end = () => {
    if (done) return; done = true;
    root.classList.remove('zb-intro-on'); root.classList.add('zb-intro-done');
    el.remove();
    window.removeEventListener('keydown', onKey, true);
  };
  const skip = () => {
    if (done) return;
    el.classList.add('zb-intro-out');
    setTimeout(end, 260);
  };
  const onKey = () => skip();
  el.addEventListener('pointerdown', skip);
  window.addEventListener('keydown', onKey, true);
  el.addEventListener('animationend', (e) => { if (e.target === el) end(); });
  setTimeout(end, INTRO_MS + 400); // Sicherheitsnetz
}

function initIntroSetting() {
  const sw = $('zbIntroOn');
  if (!sw) return;
  const isOn = () => { try { return localStorage.getItem('zb_intro') !== 'off'; } catch (e) { return true; } };
  sw.setAttribute('aria-checked', String(isOn()));
  sw.onclick = () => {
    const next = !isOn();
    try { if (next) localStorage.removeItem('zb_intro'); else localStorage.setItem('zb_intro', 'off'); } catch (e) {}
    sw.setAttribute('aria-checked', String(next));
  };
  // #einstellungen in der URL klappt die Einstellungen auf
  if (location.hash === '#einstellungen') $('einstellungen').open = true;
}

initIntro();
initIntroSetting();
initProfile();
initJoin();
initInstallHint();
window.phToast = toast;
window.zbToast = toast;
