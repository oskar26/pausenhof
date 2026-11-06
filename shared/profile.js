// Pausenhof – gemeinsames Spielerprofil (Name + Emoji-Avatar).
// Alle Spiele lesen dieselben localStorage-Schlüssel:
//   ph_name   – Anzeigename (max. 16 Zeichen)
//   ph_avatar – ein Emoji
// Nutzung in einem Spiel:  import { getProfile, setName, setAvatar, AVATARS } from '../../shared/profile.js';

export const AVATARS = ['🐸','🦊','🐼','🐵','🐱','🐶','🦄','🐙','🤖','👽','🦖','🐧','🐷','🦁','🐨','🐯','🐮','🦉','🐝','🍕','🌮','👻','🤡','😎','🥸','🧠','🗿','🐢'];
export const NAME_MAX = 16;

function read(key) { try { return localStorage.getItem(key) || ''; } catch (e) { return ''; } }
function write(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }

export function getProfile() {
  let avatar = read('ph_avatar');
  if (!avatar) { avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)]; write('ph_avatar', avatar); }
  return { name: read('ph_name'), avatar };
}

export function setName(name) {
  const n = String(name || '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
  write('ph_name', n);
  return n;
}

export function setAvatar(emoji) {
  if (emoji) write('ph_avatar', emoji);
  return emoji;
}

export function randomName() {
  const names = ['Kreide-Ninja', 'Mathe-Profi', 'Mensa-Boss', 'Tafelkönig', 'Pausen-Profi', 'Brezel-Fan',
    'Turbo-Streber', 'Hofpirat', 'Klassenclown', 'Gong-Held', 'Tafelschwamm', 'Hausi-Muffel'];
  const n = names[Math.floor(Math.random() * names.length)];
  return `${n}${Math.floor(10 + Math.random() * 90)}`.slice(0, NAME_MAX);
}
