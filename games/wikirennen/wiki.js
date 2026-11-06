// Wikirennen – Wikipedia-Anbindung (läuft komplett im Browser, CORS über origin=*)
// made by Oskar
import { POPULAR } from './popular.js';
import { COUNTRIES } from './data.js';

export const LANGS = { de: 'Deutsch', en: 'English' };
const api = (lang) => `https://${lang}.wikipedia.org/w/api.php`;
const rest = (lang) => `https://${lang}.wikipedia.org/api/rest_v1`;

// Verbotene Artikel: 0 = keine, 1 = USA, 2 = USA & Deutschland, 3 = alle Staaten
const USA = { de: 'Vereinigte Staaten', en: 'United States' };
const GER = { de: 'Deutschland', en: 'Germany' };
export const BAN_NAMES = ['keine', 'Keine USA', 'Keine USA & kein Deutschland', 'Keine Länderartikel'];
export function forbiddenTitles(lang, ban = 2) {
  ban = +ban || 0;
  if (!ban) return [];
  if (ban === 1) return [USA[lang]].filter(Boolean);
  if (ban === 2) return [USA[lang], GER[lang]].filter(Boolean);
  return COUNTRIES[lang] || [USA[lang], GER[lang]].filter(Boolean);
}
export function isForbidden(lang, ban, title) {
  if (!+ban) return false;
  const n = normTitle(title);
  return forbiddenTitles(lang, ban).some((f) => normTitle(f) === n);
}

// Nimmt Titel oder Wikipedia-Links („https://de.wikipedia.org/wiki/Mond“, auch mobil) entgegen
export function parseWikiInput(str) {
  const s = String(str || '').trim();
  const m = s.match(/^https?:\/\/([a-z-]+)\.(?:m\.)?wikipedia\.org\/wiki\/([^?#]+)/i);
  if (m) { let t = m[2]; try { t = decodeURIComponent(t); } catch (e) {} return { lang: m[1].toLowerCase(), title: normTitle(t) }; }
  return { lang: null, title: normTitle(s) };
}

export function normTitle(t) {
  let s = String(t || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (s) s = s.charAt(0).toUpperCase() + s.slice(1);
  return s;
}
export function sameTitle(a, b) { return normTitle(a) === normTitle(b); }
export function articleUrl(lang, title) { return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(normTitle(title).replace(/ /g, '_'))}`; }

async function getJSON(url, tries = 2) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) { lastErr = e; await new Promise((res) => setTimeout(res, 400)); }
  }
  throw lastErr;
}
function qs(params) {
  return Object.entries({ format: 'json', formatversion: 2, origin: '*', ...params })
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}

// ---------------------------------------------------------------------------
// Namensräume (damit nur echte Artikel = Namensraum 0 zählen)
// ---------------------------------------------------------------------------
const nsCache = {};
export function loadNamespaces(lang) {
  if (!nsCache[lang]) {
    nsCache[lang] = getJSON(`${api(lang)}?${qs({ action: 'query', meta: 'siteinfo', siprop: 'namespaces|namespacealiases' })}`)
      .then((d) => {
        const m = new Map();
        for (const ns of Object.values(d.query.namespaces)) {
          if (ns.id === 0) continue;
          if (ns.name) m.set(ns.name.toLowerCase(), ns.id);
          if (ns.canonical) m.set(ns.canonical.toLowerCase(), ns.id);
        }
        for (const a of d.query.namespacealiases || []) m.set(a.alias.toLowerCase(), a.id);
        return m;
      })
      .catch(() => {
        nsCache[lang] = null;
        // Notfall-Liste
        return new Map(['datei', 'file', 'bild', 'image', 'kategorie', 'category', 'spezial', 'special', 'hilfe', 'help', 'wikipedia',
          'portal', 'vorlage', 'template', 'diskussion', 'talk', 'benutzer', 'user', 'modul', 'module', 'media', 'medium', 'wp', 'project']
          .map((n) => [n, 99]));
      });
  }
  return nsCache[lang];
}
function namespaceOf(nsMap, title) {
  const i = title.indexOf(':');
  if (i <= 0) return 0;
  const pre = title.slice(0, i).trim().toLowerCase();
  return nsMap.has(pre) ? nsMap.get(pre) : 0;
}
export async function isArticleTitle(lang, title) {
  return namespaceOf(await loadNamespaces(lang), normTitle(title)) === 0;
}

// ---------------------------------------------------------------------------
// Wikipedia-Stylesheets (werden in den Shadow-DOM des Artikelrahmens gelegt)
// ---------------------------------------------------------------------------
const cssCache = {};
function transformCss(css, lang) {
  return css
    .replace(/:root/g, ':host')
    .replace(/(^|[\s,}>+~(])(html|body)(?=[\s.,{:>[#)])/g, '$1.wwt-$2')
    .replace(/url\((['"]?)\/\//g, 'url($1https://')
    .replace(/url\((['"]?)\/(?!\/)/g, `url($1https://${lang}.wikipedia.org/`);
}
export function loadWikiCss(lang) {
  if (!cssCache[lang]) {
    const base = `https://${lang}.wikipedia.org/w/load.php?lang=${lang}&only=styles&skin=vector-2022&modules=`;
    const mods = [
      'ext.cite.styles|ext.cite.parsoid.styles|mediawiki.page.gallery.styles|jquery.makeCollapsible.styles|jquery.tablesorter.styles|ext.kartographer.style|ext.imagemap.styles|skins.vector.styles|mediawiki.codex.messagebox.styles',
      'site.styles',
    ];
    if (lang === 'de') mods.push('ext.gadget.dewikiCommonHide,dewikiCommonLayout,dewikiCommonStyle');
    cssCache[lang] = Promise.all(mods.map((m) => fetch(base + encodeURIComponent(m)).then((r) => r.ok ? r.text() : '').catch(() => '')))
      .then((parts) => transformCss(parts.join('\n'), lang));
  }
  return cssCache[lang];
}

// ---------------------------------------------------------------------------
// Artikel laden + aufbereiten
// ---------------------------------------------------------------------------
const pageCache = new Map();
const ABS = (u) => (u && u.startsWith('//') ? 'https:' + u : u);

export async function fetchArticle(lang, title) {
  const key = lang + '|' + normTitle(title);
  if (pageCache.has(key)) return pageCache.get(key);
  const p = (async () => {
    const d = await getJSON(`${api(lang)}?${qs({
      action: 'parse', page: normTitle(title), prop: 'text|displaytitle', redirects: 1,
      disableeditsection: 1, disablelimitreport: 1, disabletoc: 1,
    })}`);
    if (d.error) { const e = new Error(d.error.info || 'Fehler'); e.code = d.error.code; throw e; }
    const nsMap = await loadNamespaces(lang);
    const html = processHtml(d.parse.text, nsMap);
    const tmp = new DOMParser().parseFromString(`<b>${d.parse.displaytitle || d.parse.title}</b>`, 'text/html');
    return {
      title: d.parse.title,
      display: tmp.body.textContent || d.parse.title,
      html,
      redirectedFrom: d.parse.redirects && d.parse.redirects.length ? d.parse.redirects[0].from : null,
    };
  })();
  pageCache.set(key, p);
  p.then((a) => { pageCache.set(lang + '|' + normTitle(a.title), p); }).catch(() => pageCache.delete(key));
  return p;
}

function processHtml(html, nsMap) {
  const doc = new DOMParser().parseFromString(`<div id="wwt-root">${html}</div>`, 'text/html');
  const root = doc.getElementById('wwt-root');
  root.querySelectorAll('script, iframe, object, embed, video, audio, .mw-editsection, .mw-empty-elt').forEach((n) => n.remove());
  for (const el of root.querySelectorAll('*')) {
    for (const a of Array.from(el.attributes)) if (/^on/i.test(a.name)) el.removeAttribute(a.name);
  }
  for (const img of root.querySelectorAll('img')) {
    img.setAttribute('src', ABS(img.getAttribute('src')));
    if (img.getAttribute('srcset')) img.setAttribute('srcset', img.getAttribute('srcset').split(',').map((s) => ABS(s.trim())).join(', '));
    img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
    img.removeAttribute('data-file-width');
  }
  for (const a of root.querySelectorAll('a')) {
    const href = a.getAttribute('href');
    a.setAttribute('draggable', 'false');
    if (!href) continue;
    if (href.startsWith('#')) { a.dataset.wwt = 'anchor'; a.dataset.anchor = decodeURIComponent(href.slice(1)); continue; }
    if (a.classList.contains('new') || href.includes('redlink=1')) { a.dataset.wwt = 'red'; a.setAttribute('href', '#'); continue; }
    if (href.startsWith('/wiki/')) {
      let rest = href.slice(6);
      let hash = '';
      const hi = rest.indexOf('#');
      if (hi >= 0) { hash = rest.slice(hi + 1); rest = rest.slice(0, hi); }
      let t;
      try { t = normTitle(decodeURIComponent(rest)); } catch (e) { t = normTitle(rest); }
      const ns = namespaceOf(nsMap, t);
      if (ns === 0 && t) {
        a.dataset.wwt = 'article'; a.dataset.title = t;
        if (hash) { try { a.dataset.anchor = decodeURIComponent(hash); } catch (e) { a.dataset.anchor = hash; } }
        a.setAttribute('href', '#wiki/' + encodeURIComponent(t));
      } else {
        a.dataset.wwt = ns === 6 || ns === -2 ? 'file' : 'ns';
        a.setAttribute('href', '#');
      }
      continue;
    }
    a.dataset.wwt = 'external';
    a.setAttribute('href', '#');
    a.removeAttribute('target');
  }
  return root.innerHTML;
}

// ---------------------------------------------------------------------------
// Auflösen, Zufall, Beliebt, Suche, Vorschau, Prüfen
// ---------------------------------------------------------------------------
export async function resolveTitle(lang, title) {
  const d = await getJSON(`${api(lang)}?${qs({ action: 'query', titles: normTitle(title), redirects: 1, prop: 'info|pageprops', ppprop: 'disambiguation' })}`);
  const p = d.query && d.query.pages && d.query.pages[0];
  if (!p || p.missing || p.invalid) return null;
  return { title: p.title, ns: p.ns, length: p.length || 0, disambig: !!(p.pageprops && 'disambiguation' in p.pageprops) };
}

export async function randomArticle(lang, avoid = []) {
  let best = null;
  for (let i = 0; i < 4; i++) {
    const d = await getJSON(`${api(lang)}?${qs({ action: 'query', generator: 'random', grnnamespace: 0, grnlimit: 30, prop: 'info|pageprops', ppprop: 'disambiguation' })}`);
    const pages = (d.query.pages || []).filter((p) => !(p.pageprops && 'disambiguation' in p.pageprops)
      && !/^(Liste |List of )/.test(p.title) && !avoid.some((a) => sameTitle(a, p.title)));
    const good = pages.filter((p) => p.length > 7000 && p.length < 120000);
    if (good.length) return good[Math.floor(Math.random() * good.length)].title;
    for (const p of pages) if (!best || p.length > best.length) best = p;
  }
  if (best) return best.title;
  throw new Error('Kein Zufallsartikel gefunden');
}

export async function popularArticle(lang, avoid = []) {
  const list = (POPULAR[lang] || POPULAR.de).filter((t) => !avoid.some((a) => sameTitle(a, t)));
  return list[Math.floor(Math.random() * list.length)];
}

const trendCache = {};
export async function trendingArticle(lang, avoid = []) {
  if (!trendCache[lang]) {
    trendCache[lang] = (async () => {
      const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1);
      const y = d.getUTCFullYear(), m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const j = await getJSON(`https://wikimedia.org/api/rest_v1/metrics/pageviews/top/${lang}.wikipedia.org/all-access/${y}/${m}/all-days`);
      const nsMap = await loadNamespaces(lang);
      const skip = /^(Hauptseite|Main Page|Nekrolog|Deaths in|Liste |List of |-$|XXX)/;
      return j.items[0].articles.map((a) => normTitle(a.article))
        .filter((t) => namespaceOf(nsMap, t) === 0 && !skip.test(t) && !/^\d{4}$/.test(t)).slice(0, 250);
    })().catch((e) => { trendCache[lang] = null; throw e; });
  }
  const list = (await trendCache[lang]).filter((t) => !avoid.some((a) => sameTitle(a, t)));
  return list[Math.floor(Math.random() * list.length)];
}

export async function searchTitles(lang, q) {
  if (!q || q.trim().length < 2) return [];
  const d = await getJSON(`${api(lang)}?${qs({ action: 'opensearch', search: q.trim(), limit: 7, namespace: 0, redirects: 'resolve' })}`, 1);
  return Array.isArray(d) ? d[1] : [];
}

const sumCache = new Map();
export async function fetchSummary(lang, title) {
  const key = lang + '|' + normTitle(title);
  if (!sumCache.has(key)) {
    sumCache.set(key, getJSON(`${rest(lang)}/page/summary/${encodeURIComponent(normTitle(title).replace(/ /g, '_'))}`)
      .then((d) => ({
        title: d.title, description: d.description || '', extract: (d.extract || '').slice(0, 420),
        thumb: d.thumbnail ? d.thumbnail.source : '',
      }))
      .catch(() => ({ title: normTitle(title), description: '', extract: '', thumb: '' })));
  }
  return sumCache.get(key);
}

// Prüft, ob Artikel `from` wirklich auf `via` verlinkt. true / false / null (unbekannt)
export async function verifyHop(lang, from, via) {
  try {
    const d = await getJSON(`${api(lang)}?${qs({ action: 'query', titles: normTitle(from), prop: 'links', pltitles: normTitle(via), pllimit: 5 })}`);
    const p = d.query && d.query.pages && d.query.pages[0];
    if (!p || p.missing) return null;
    return !!(p.links && p.links.length);
  } catch (e) { return null; }
}

// Titel desselben Artikels in einer anderen Sprache (für das Power-up „Übersetzt“)
export async function langlinkTitle(lang, title, toLang) {
  try {
    const d = await getJSON(`${api(lang)}?${qs({ action: 'query', titles: normTitle(title), prop: 'langlinks', lllang: toLang, redirects: 1 })}`, 1);
    const p = d.query && d.query.pages && d.query.pages[0];
    return p && p.langlinks && p.langlinks[0] ? p.langlinks[0].title : null;
  } catch (e) { return null; }
}
