// Zockbox – Tarnmodus (optional, standardmäßig AUS). made by Oskar
//
// Reine UI-Tarnung: Tab-Titel/Favicon tauschen und per Panik-Taste eine Tarnseite
// als Vollbild-Overlay über die App legen. Das Spiel läuft darunter weiter, die
// Verbindung bleibt bestehen. Kein Fenster-Öffnen, keine Proxies, kein Netzwerk-Kram.
//
// Einbinden (eine Zeile, eigenständig – bringt sein CSS selbst mit):
//   Startseite:      <script type="module" src="shared/tarnung.js"></script>
//   Spiele:          <script type="module" src="../../shared/tarnung.js"></script>
//
// Einstellungen (localStorage):
//   zb_tarn_on    '1' = Tarnmodus an (sonst aus)
//   zb_tarn_tab   'aus' | 'notizen' | 'dokument' | 'suche' | 'wiki' | 'rechner'   (Tab-Tarnung)
//   zb_tarn_page  'suche' | 'lexikon' | 'dokument'                               (Tarnseite)
//   zb_tarn_key   KeyboardEvent.key der Panik-Taste (Standard 'Escape', zweimal schnell drücken)
//   zb_tarn_fab   '0' = schwebenden Panik-Knopf auf Touch-Geräten ausblenden
//
// Für Spiele: window.addEventListener('zb-tarnung', e => e.detail.active) – z. B. um Sounds stummzuschalten.
// Die Einstellungs-Oberfläche erscheint automatisch in einem Element mit id="zbTarnSettings" (nur Startseite).

const KEYS = { on: 'zb_tarn_on', tab: 'zb_tarn_tab', page: 'zb_tarn_page', key: 'zb_tarn_key', fab: 'zb_tarn_fab' };
const DOUBLE_MS = 550;

const get = (k, d = '') => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

// ---------------------------------------------------------------------------
// Eigene, generische Favicons (selbst gezeichnet, keine fremden Logos)
// ---------------------------------------------------------------------------
const svgUrl = (inner) => 'data:image/svg+xml,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${inner}</svg>`);

const ICONS = {
  notizen: svgUrl('<rect x="5" y="3" width="22" height="26" rx="3" fill="#f6c945"/><rect x="5" y="3" width="22" height="6" rx="3" fill="#e0a92a"/><path d="M9 14h14M9 19h14M9 24h9" stroke="#7a5a10" stroke-width="2" stroke-linecap="round"/>'),
  dokument: svgUrl('<path d="M7 2h13l6 6v20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#3a6fd8"/><path d="M20 2v6h6" fill="#8fb0f0"/><path d="M9 14h14M9 18h14M9 22h10" stroke="#fff" stroke-width="2" stroke-linecap="round"/>'),
  suche: svgUrl('<circle cx="13" cy="13" r="8.5" fill="none" stroke="#1d8a7a" stroke-width="4"/><path d="M19.5 19.5 28 28" stroke="#1d8a7a" stroke-width="4.5" stroke-linecap="round"/>'),
  wiki: svgUrl('<path d="M4 6c4-2 8-2 12 1v21c-4-3-8-3-12-1z" fill="#6b6f78"/><path d="M28 6c-4-2-8-2-12 1v21c4-3 8-3 12-1z" fill="#9aa0aa"/><path d="M7 11c2-1 4-1 6 0M7 15c2-1 4-1 6 0M19 11c2-1 4-1 6 0M19 15c2-1 4-1 6 0" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>'),
  rechner: svgUrl('<rect x="6" y="2" width="20" height="28" rx="3" fill="#4a4f5c"/><rect x="9" y="5" width="14" height="6" rx="1" fill="#cfe8d6"/><g fill="#e6e8ee"><rect x="9" y="14" width="4" height="3" rx="1"/><rect x="14" y="14" width="4" height="3" rx="1"/><rect x="9" y="19" width="4" height="3" rx="1"/><rect x="14" y="19" width="4" height="3" rx="1"/><rect x="9" y="24" width="4" height="3" rx="1"/><rect x="14" y="24" width="4" height="3" rx="1"/></g><rect x="19" y="14" width="4" height="13" rx="1" fill="#f08a3c"/>'),
};

// Tab-Tarnung: Vorlagen
export const TAB_TEMPLATES = [
  { id: 'aus', label: 'Original', title: null, icon: null },
  { id: 'notizen', label: 'Notizen', title: 'Notizen', icon: ICONS.notizen },
  { id: 'dokument', label: 'Dokument', title: 'Dokument – Unbenannt', icon: ICONS.dokument },
  { id: 'suche', label: 'Suche', title: 'Suche', icon: ICONS.suche },
  { id: 'wiki', label: 'Wiki-Artikel', title: 'Wiki-Artikel', icon: ICONS.wiki },
  { id: 'rechner', label: 'Taschenrechner', title: 'Taschenrechner', icon: ICONS.rechner },
];

// Tarnseiten (Panik-Modus)
export const PAGES = [
  { id: 'suche', label: 'Suche', title: 'Suchfix', icon: ICONS.suche },
  { id: 'lexikon', label: 'Lexikon-Artikel', title: 'Photosynthese – Lexikon', icon: ICONS.wiki },
  { id: 'dokument', label: 'Dokument', title: 'Biologie-Notizen – Dokument', icon: ICONS.dokument },
];

// ---------------------------------------------------------------------------
// Zustand
// ---------------------------------------------------------------------------
function readState() {
  const tab = get(KEYS.tab, 'aus');
  const page = get(KEYS.page, 'suche');
  return {
    on: get(KEYS.on) === '1',
    tab: TAB_TEMPLATES.some((t) => t.id === tab) ? tab : 'aus',
    page: PAGES.some((p) => p.id === page) ? page : 'suche',
    key: get(KEYS.key, 'Escape') || 'Escape',
    fab: get(KEYS.fab, '1') !== '0',
  };
}
let S = readState();
let panic = false;
let pagePreview = null; // Vorschau aus den Einstellungen (auch wenn Tarnmodus aus)

// Original-Titel/Icons merken
let origTitle = document.title;
let origIcons = null; // [{el, parent, next}]
let applyingTitle = false;

function iconLinks() { return [...document.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"]')].filter((l) => !l.dataset.zbTarn); }

function setDisguise(title, icon) {
  // Titel
  if (title) {
    if (document.title !== title) { applyingTitle = true; document.title = title; applyingTitle = false; }
  } else if (document.title !== origTitle) { applyingTitle = true; document.title = origTitle; applyingTitle = false; }
  // Favicon
  let mine = document.querySelector('link[data-zb-tarn]');
  if (icon) {
    if (!origIcons) {
      origIcons = iconLinks().map((el) => ({ el, parent: el.parentNode, next: el.nextSibling }));
      origIcons.forEach((o) => o.el.remove());
    }
    if (!mine) {
      mine = document.createElement('link');
      mine.rel = 'icon'; mine.type = 'image/svg+xml'; mine.dataset.zbTarn = '1';
      document.head.appendChild(mine);
    }
    if (mine.getAttribute('href') !== icon) mine.setAttribute('href', icon);
  } else {
    if (mine) mine.remove();
    if (origIcons) {
      origIcons.forEach((o) => { try { o.parent.insertBefore(o.el, o.next && o.next.parentNode === o.parent ? o.next : null); } catch (e) { document.head.appendChild(o.el); } });
      origIcons = null;
    }
  }
}

function applyTab() {
  if (panic || pagePreview) {
    const p = PAGES.find((x) => x.id === (pagePreview || S.page));
    setDisguise(p.title, p.icon);
  } else if (S.on && S.tab !== 'aus') {
    const t = TAB_TEMPLATES.find((x) => x.id === S.tab);
    setDisguise(t.title, t.icon);
  } else {
    setDisguise(null, null);
  }
}

// Spiele ändern den Titel manchmal selbst (z. B. "Lobby ABCD"). Das merken wir uns als neuen
// Original-Titel und setzen die Tarnung wieder drauf.
function watchTitle() {
  const obs = new MutationObserver(() => {
    if (applyingTitle) return;
    const disguised = panic || pagePreview || (S.on && S.tab !== 'aus');
    const known = [...TAB_TEMPLATES, ...PAGES].some((t) => t.title === document.title);
    if (!known) origTitle = document.title;
    if (disguised) applyTab();
  });
  obs.observe(document.head, { childList: true, subtree: true, characterData: true });
}

// ---------------------------------------------------------------------------
// CSS (selbst mitgebracht, damit eine <script>-Zeile reicht)
// ---------------------------------------------------------------------------
const CSS = `
.zbt-ov{position:fixed;inset:0;z-index:2147483000;overflow:auto;-webkit-overflow-scrolling:touch;background:#fff;color:#202124;
  font:15px/1.5 Arial,Helvetica,sans-serif;text-align:left;letter-spacing:normal;-webkit-font-smoothing:auto;color-scheme:light}
.zbt-ov *{box-sizing:border-box}
.zbt-ov a{color:#1a56b0;text-decoration:none;cursor:pointer}
.zbt-ov a:hover{text-decoration:underline}
.zbt-back{position:fixed;left:0;top:0;width:64px;height:64px;z-index:2147483001;background:transparent;border:0;padding:0;opacity:0;cursor:default;-webkit-tap-highlight-color:transparent}
.zbt-back:focus-visible{opacity:1;outline:2px dashed #888}
.zbt-fab{position:fixed;left:max(10px,env(safe-area-inset-left));bottom:calc(10px + env(safe-area-inset-bottom));z-index:2147482999;
  width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(20,22,32,.55);color:#fff;
  display:grid;place-items:center;padding:0;opacity:.6;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);
  -webkit-tap-highlight-color:transparent;touch-action:manipulation;cursor:pointer}
.zbt-fab svg{width:20px;height:20px}
.zbt-fab:active{transform:scale(.92)}
.zbt-preview-bar{position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:2147483002;
  display:flex;gap:10px;align-items:center;padding:8px 8px 8px 14px;border-radius:12px;background:#222;color:#fff;font:600 14px/1.2 Arial,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35)}
.zbt-preview-bar button{border:0;border-radius:8px;padding:8px 12px;background:#fff;color:#111;font:700 14px Arial,sans-serif;cursor:pointer}
html.zbt-lock,html.zbt-lock body{overflow:hidden!important}

/* (a) Suche */
.zbt-s{min-height:100%;display:flex;flex-direction:column}
.zbt-s-top{display:flex;justify-content:flex-end;gap:16px;align-items:center;padding:14px 20px;font-size:13px}
.zbt-s-top a{color:#3c4043}
.zbt-s-dots{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:#f1f3f4}
.zbt-s-av{width:32px;height:32px;border-radius:50%;background:#5b7c99;color:#fff;display:grid;place-items:center;font-weight:700;font-size:14px}
.zbt-s-main{flex:1;display:flex;flex-direction:column;align-items:center;padding:12vh 16px 40px}
.zbt-s-logo{display:flex;align-items:center;gap:10px;font:700 clamp(40px,11vw,64px)/1 Georgia,'Times New Roman',serif;color:#1d8a7a;letter-spacing:-.02em;margin-bottom:28px}
.zbt-s-logo i{font-style:normal;color:#e08a2c}
.zbt-s-logo svg{width:.8em;height:.8em}
.zbt-s-form{width:100%;max-width:580px}
.zbt-s-box{display:flex;align-items:center;gap:10px;height:48px;padding:0 16px;border:1px solid #dfe1e5;border-radius:24px;background:#fff}
.zbt-s-box:hover,.zbt-s-box:focus-within{box-shadow:0 1px 6px rgba(32,33,36,.28);border-color:transparent}
.zbt-s-box svg{width:18px;height:18px;flex:none;fill:#9aa0a6}
.zbt-s-box input{flex:1;min-width:0;border:0;outline:0;font:16px Arial,sans-serif;color:#202124;background:transparent}
.zbt-s-btns{display:flex;justify-content:center;gap:10px;margin-top:26px;flex-wrap:wrap}
.zbt-s-btns button{height:36px;padding:0 16px;border:1px solid #f8f9fa;border-radius:4px;background:#f8f9fa;color:#3c4043;font:14px Arial,sans-serif;cursor:pointer}
.zbt-s-btns button:hover{border-color:#dadce0;box-shadow:0 1px 1px rgba(0,0,0,.1)}
.zbt-s-msg{margin-top:22px;color:#5f6368;font-size:14px;text-align:center;min-height:21px}
.zbt-s-lang{margin-top:24px;font-size:13px;color:#4d5156}
.zbt-s-foot{background:#f2f2f2;color:#70757a;font-size:14px}
.zbt-s-foot div{padding:13px 24px;border-bottom:1px solid #dadce0}
.zbt-s-foot nav{display:flex;flex-wrap:wrap;gap:6px 24px;padding:13px 24px}
.zbt-s-foot nav a{color:#70757a}

/* (b) Lexikon */
.zbt-l{max-width:1100px;margin:0 auto;display:flex;min-height:100%;font-family:Arial,Helvetica,sans-serif}
.zbt-l-side{width:170px;flex:none;padding:18px 14px;font-size:13px}
.zbt-l-logo{display:flex;flex-direction:column;align-items:center;gap:4px;margin-bottom:22px;color:#54595d;font:600 15px Georgia,serif;text-align:center}
.zbt-l-logo svg{width:64px;height:64px}
.zbt-l-side ul{list-style:none;padding:0;margin:0 0 18px}
.zbt-l-side li{padding:3px 0}
.zbt-l-side h4{margin:0 0 4px;font:600 12px Arial,sans-serif;color:#72777d;border-bottom:1px solid #c8ccd1;padding-bottom:3px}
.zbt-l-main{flex:1;min-width:0;padding:16px 24px 60px;border-left:1px solid #e4e6ea}
.zbt-l-bar{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;border-bottom:1px solid #a2a9b1;font-size:13px;padding-bottom:6px;margin-bottom:12px}
.zbt-l-bar span{color:#54595d}
.zbt-l-bar input{border:1px solid #a2a9b1;border-radius:2px;padding:5px 8px;font:13px Arial,sans-serif;width:200px;max-width:45vw}
.zbt-l h1{font:400 28px/1.3 Georgia,'Times New Roman',serif;margin:6px 0 2px;border-bottom:1px solid #a2a9b1;padding-bottom:4px;color:#000}
.zbt-l-sub{font-size:12.5px;color:#54595d;margin-bottom:14px}
.zbt-l h2{font:400 21px/1.3 Georgia,'Times New Roman',serif;border-bottom:1px solid #a2a9b1;margin:22px 0 8px;padding-bottom:3px;color:#000}
.zbt-l p{margin:0 0 10px;font-size:14.5px;line-height:1.6;color:#202122}
.zbt-l-box{float:right;width:250px;max-width:46%;margin:0 0 12px 18px;border:1px solid #a2a9b1;background:#f8f9fa;font-size:13px;padding:6px}
.zbt-l-box .cap{font-weight:700;text-align:center;padding:4px;background:#d5ecd4}
.zbt-l-box svg{display:block;width:100%;height:auto;margin:6px 0}
.zbt-l-box table{width:100%;border-collapse:collapse}
.zbt-l-box td{padding:3px 4px;border-top:1px solid #e4e6ea;vertical-align:top}
.zbt-l-toc{display:inline-block;border:1px solid #a2a9b1;background:#f8f9fa;padding:8px 14px;font-size:13.5px;margin:4px 0 8px}
.zbt-l-toc b{display:block;text-align:center;margin-bottom:4px}
.zbt-l-toc ol{margin:0;padding-left:18px}
.zbt-l-formula{font:15px 'Times New Roman',serif;text-align:center;margin:10px 0 14px;padding:8px;background:#f8f9fa;border:1px solid #eaecf0}
@media (max-width:720px){.zbt-l-side{display:none}.zbt-l-main{border:0;padding:12px 14px 50px}.zbt-l-box{float:none;width:auto;max-width:none;margin:0 0 14px}}

/* (c) Dokument */
.zbt-d{min-height:100%;background:#eef0f3;display:flex;flex-direction:column;font-family:Arial,Helvetica,sans-serif}
.zbt-d-head{background:#fff;border-bottom:1px solid #dadce0;position:sticky;top:0;z-index:2}
.zbt-d-row1{display:flex;align-items:center;gap:10px;padding:8px 14px 2px}
.zbt-d-row1 svg{width:28px;height:28px;flex:none}
.zbt-d-name{font-size:17px;color:#202124;outline:0;border:1px solid transparent;border-radius:4px;padding:1px 6px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.zbt-d-name:hover{border-color:#dadce0}
.zbt-d-saved{font-size:12px;color:#5f6368;margin-left:auto;white-space:nowrap}
.zbt-d-menu{display:flex;gap:14px;padding:0 14px 6px 52px;font-size:13.5px;color:#3c4043;overflow-x:auto;white-space:nowrap}
.zbt-d-tools{display:flex;align-items:center;gap:4px;padding:5px 12px;margin:0 10px 8px;background:#edf2fa;border-radius:20px;overflow-x:auto;white-space:nowrap}
.zbt-d-tools .dd{flex:none;font:13px Arial,sans-serif;color:#444;padding:0 6px;cursor:default}.zbt-d-tools .dd::after{content:' ▾';font-size:10px;color:#666}
.zbt-d-tools button{height:28px;min-width:28px;border:0;border-radius:4px;background:transparent;color:#444;font:13px Arial,sans-serif;padding:0 6px;cursor:pointer}
.zbt-d-tools button:hover{background:#dde3ea}
.zbt-d-tools .sep{width:1px;height:20px;background:#c7c7c7;margin:0 4px;flex:none}
.zbt-d-page{width:min(816px,calc(100% - 24px));margin:18px auto 50px;background:#fff;box-shadow:0 1px 3px rgba(60,64,67,.3);padding:clamp(24px,8vw,90px) clamp(20px,9vw,96px);min-height:900px;font:15px/1.6 Arial,sans-serif;color:#202124;outline:0}
.zbt-d-page h1{font:400 26px/1.3 Arial,sans-serif;margin:0 0 6px}
.zbt-d-page h2{font:700 17px/1.3 Arial,sans-serif;margin:22px 0 6px}
.zbt-d-page .dt{color:#5f6368;font-size:13px;margin-bottom:18px}
.zbt-d-page ul{margin:6px 0 10px;padding-left:22px}
.zbt-d-page p{margin:0 0 10px}
`;

function injectCSS() {
  if (document.getElementById('zbt-css')) return;
  const st = document.createElement('style');
  st.id = 'zbt-css'; st.textContent = CSS;
  (document.head || document.documentElement).appendChild(st);
}

// ---------------------------------------------------------------------------
// Tarnseiten (eigener Text, eigenes Design, keine fremden Marken)
// ---------------------------------------------------------------------------
const LENS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z"/></svg>';

function pageSuche() {
  return `<div class="zbt-s">
  <div class="zbt-s-top"><a>Nachrichten</a><a>Bilder</a><span class="zbt-s-dots" aria-hidden="true">⋮</span><span class="zbt-s-av" aria-hidden="true">S</span></div>
  <div class="zbt-s-main">
    <div class="zbt-s-logo"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="13" cy="13" r="8.5" fill="none" stroke="#1d8a7a" stroke-width="4"/><path d="M19.5 19.5 28 28" stroke="#e08a2c" stroke-width="4.5" stroke-linecap="round"/></svg><span>Such<i>fix</i></span></div>
    <form class="zbt-s-form" data-zbt="search">
      <label class="zbt-s-box">${LENS}<input type="search" name="q" autocomplete="off" aria-label="Suchen"></label>
      <div class="zbt-s-btns"><button type="submit">Suchfix-Suche</button><button type="button" data-zbt="lucky">Auf gut Glück</button></div>
      <div class="zbt-s-msg" aria-live="polite"></div>
    </form>
    <div class="zbt-s-lang">Suchfix gibt es auch auf: <a>English</a> · <a>Français</a> · <a>Türkçe</a></div>
  </div>
  <footer class="zbt-s-foot"><div>Deutschland</div><nav><a>Über Suchfix</a><a>Hilfe</a><a>Datenschutz</a><a>Bedingungen</a><a>Einstellungen</a></nav></footer>
</div>`;
}

function pageLexikon() {
  return `<div class="zbt-l">
  <aside class="zbt-l-side">
    <div class="zbt-l-logo"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#f3f4f6" stroke="#c8ccd1"/><path d="M14 20c6-3 12-3 18 1v26c-6-4-12-4-18-1z" fill="#72777d"/><path d="M50 20c-6-3-12-3-18 1v26c6-4 12-4 18-1z" fill="#a2a9b1"/></svg>Das freie Lexikon</div>
    <ul><li><a>Hauptseite</a></li><li><a>Themenportale</a></li><li><a>Zufälliger Artikel</a></li></ul>
    <h4>Mitmachen</h4><ul><li><a>Artikel verbessern</a></li><li><a>Hilfe</a></li><li><a>Letzte Änderungen</a></li></ul>
    <h4>Werkzeuge</h4><ul><li><a>Links auf diese Seite</a></li><li><a>Druckversion</a></li><li><a>Artikel zitieren</a></li></ul>
  </aside>
  <main class="zbt-l-main">
    <div class="zbt-l-bar"><span>Artikel · Diskussion</span><span>Lesen · Bearbeiten · Versionen <input type="search" placeholder="Lexikon durchsuchen" aria-label="Lexikon durchsuchen"></span></div>
    <h1>Photosynthese</h1>
    <div class="zbt-l-sub">aus dem freien Lexikon</div>
    <div class="zbt-l-box">
      <div class="cap">Photosynthese</div>
      <svg viewBox="0 0 240 130" aria-hidden="true"><rect width="240" height="130" fill="#eaf6ea"/><circle cx="205" cy="26" r="16" fill="#f6c945"/><path d="M190 36 150 60M196 42 160 76" stroke="#e8b730" stroke-width="2"/><path d="M60 120c0-40 10-70 40-90" stroke="#3f7d3a" stroke-width="4" fill="none"/><ellipse cx="110" cy="52" rx="40" ry="18" transform="rotate(-25 110 52)" fill="#5aa64f"/><ellipse cx="62" cy="78" rx="32" ry="14" transform="rotate(30 62 78)" fill="#6dbb5f"/><path d="M80 66 140 40" stroke="#3f7d3a" stroke-width="1.5"/><text x="150" y="100" font-size="11" fill="#2b5d28">CO₂ + H₂O</text><text x="20" y="20" font-size="11" fill="#2b5d28">O₂ ↑</text></svg>
      <table><tr><td>Ort</td><td>Chloroplasten</td></tr><tr><td>Farbstoff</td><td>Chlorophyll a und b</td></tr><tr><td>Ausgangsstoffe</td><td>Kohlenstoffdioxid, Wasser</td></tr><tr><td>Produkte</td><td>Glucose, Sauerstoff</td></tr><tr><td>Energiequelle</td><td>Licht</td></tr></table>
    </div>
    <p><b>Photosynthese</b> (von altgriechisch <i>phōs</i> „Licht“ und <i>synthesis</i> „Zusammensetzung“) ist der Vorgang, bei dem Pflanzen, Algen und einige Bakterien mithilfe von Lichtenergie aus energiearmen Stoffen energiereiche Verbindungen herstellen. Dabei werden Kohlenstoffdioxid und Wasser zu Traubenzucker (Glucose) umgewandelt; als Nebenprodukt entsteht Sauerstoff.</p>
    <p>Die Photosynthese gilt als einer der wichtigsten biochemischen Prozesse der Erde. Nahezu alle Nahrungsketten beginnen bei Lebewesen, die Photosynthese betreiben, und der Sauerstoff der Atmosphäre stammt zum größten Teil aus ihr.</p>
    <div class="zbt-l-toc"><b>Inhaltsverzeichnis</b><ol><li>Gesamtgleichung</li><li>Lichtabhängige Reaktionen</li><li>Calvin-Zyklus</li><li>Einflussfaktoren</li><li>Bedeutung</li></ol></div>
    <h2>Gesamtgleichung</h2>
    <p>Vereinfacht lässt sich die Photosynthese grüner Pflanzen in einer Summengleichung zusammenfassen:</p>
    <div class="zbt-l-formula">6 CO₂ + 12 H₂O &nbsp;→<sup>Licht</sup>&nbsp; C₆H₁₂O₆ + 6 O₂ + 6 H₂O</div>
    <p>Die Gleichung beschreibt nur Anfang und Ende. Tatsächlich laufen viele Einzelschritte ab, die sich in zwei Abschnitte gliedern lassen: die lichtabhängigen Reaktionen und die lichtunabhängigen Reaktionen.</p>
    <h2>Lichtabhängige Reaktionen</h2>
    <p>In den Thylakoidmembranen der Chloroplasten nimmt das grüne Blattpigment Chlorophyll Licht auf. Die Energie wird genutzt, um Wasser zu spalten (Photolyse). Dabei entstehen Sauerstoff, Protonen und Elektronen. Über eine Elektronentransportkette werden die Energieträger ATP und NADPH gebildet.</p>
    <h2>Calvin-Zyklus</h2>
    <p>Im Stroma der Chloroplasten wird Kohlenstoffdioxid mithilfe des Enzyms RuBisCO an einen Zucker mit fünf Kohlenstoffatomen gebunden. Unter Verbrauch von ATP und NADPH entstehen in mehreren Schritten Zuckermoleküle, aus denen die Pflanze Glucose, Stärke und Cellulose aufbaut. Der Zyklus ist nach dem Chemiker Melvin Calvin benannt.</p>
    <h2>Einflussfaktoren</h2>
    <p>Die Geschwindigkeit der Photosynthese hängt vor allem von der Lichtintensität, der Kohlenstoffdioxid-Konzentration und der Temperatur ab. Der Faktor, der am knappsten ist, begrenzt die Rate (Prinzip des begrenzenden Faktors). Bei zu hohen Temperaturen nimmt die Leistung wieder ab, weil Enzyme geschädigt werden.</p>
    <h2>Bedeutung</h2>
    <p>Neben der Bildung von Sauerstoff bindet die Photosynthese große Mengen Kohlenstoffdioxid und spielt damit eine zentrale Rolle im Kohlenstoffkreislauf und für das Klima. Auch fossile Brennstoffe wie Kohle und Erdöl gehen auf Biomasse zurück, die einst durch Photosynthese entstanden ist.</p>
  </main>
</div>`;
}

const DOC_ICON = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 2h13l6 6v20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#3a6fd8"/><path d="M20 2v6h6" fill="#8fb0f0"/><path d="M9 14h14M9 18h14M9 22h10" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>';

function pageDokument() {
  const d = new Date();
  const dt = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `<div class="zbt-d">
  <div class="zbt-d-head">
    <div class="zbt-d-row1">${DOC_ICON}<span class="zbt-d-name" contenteditable="true" spellcheck="false">Biologie-Notizen</span><span class="zbt-d-saved">Alle Änderungen gespeichert</span></div>
    <div class="zbt-d-menu"><span>Datei</span><span>Bearbeiten</span><span>Ansicht</span><span>Einfügen</span><span>Format</span><span>Extras</span><span>Hilfe</span></div>
    <div class="zbt-d-tools" aria-hidden="true">
      <button type="button">↶</button><button type="button">↷</button><span class="sep"></span>
      <span class="dd">Normaler Text</span><span class="sep"></span>
      <span class="dd">Arial</span><span class="dd">11</span><span class="sep"></span>
      <button type="button"><b>F</b></button><button type="button"><i>K</i></button><button type="button"><u>U</u></button><span class="sep"></span>
      <button type="button">≡</button><button type="button">•</button><button type="button">1.</button>
    </div>
  </div>
  <div class="zbt-d-page" contenteditable="true" spellcheck="false">
    <h1>Biologie – Photosynthese</h1>
    <div class="dt">Notizen vom ${dt}</div>
    <h2>1. Grundlagen</h2>
    <ul><li>Ort: Chloroplasten (vor allem in den Blättern)</li><li>Farbstoff: Chlorophyll → nimmt rotes und blaues Licht auf, grünes wird reflektiert</li><li>Ausgangsstoffe: Kohlenstoffdioxid (aus der Luft) + Wasser (aus dem Boden)</li><li>Produkte: Glucose + Sauerstoff</li></ul>
    <p><b>Wortgleichung:</b> Kohlenstoffdioxid + Wasser → (Licht) → Glucose + Sauerstoff</p>
    <h2>2. Ablauf</h2>
    <p><b>Lichtreaktion</b> (Thylakoide): Wasser wird gespalten, Sauerstoff wird frei, ATP und NADPH entstehen.</p>
    <p><b>Dunkelreaktion / Calvin-Zyklus</b> (Stroma): CO₂ wird gebunden, mit ATP und NADPH wird Zucker aufgebaut.</p>
    <h2>3. Einflussfaktoren</h2>
    <ul><li>Lichtstärke</li><li>CO₂-Gehalt der Luft</li><li>Temperatur (Optimum ca. 25–30 °C)</li><li>Wasserversorgung</li></ul>
    <p>→ Prinzip des begrenzenden Faktors: der knappste Faktor bestimmt die Geschwindigkeit.</p>
    <h2>4. Für den Test wiederholen</h2>
    <ul><li>Versuch mit der Wasserpest (Sauerstoffbläschen zählen)</li><li>Unterschied Fotosynthese ↔ Zellatmung</li><li>Aufbau eines Laubblatts (Skizze!)</li></ul>
  </div>
</div>`;
}

const RENDER = { suche: pageSuche, lexikon: pageLexikon, dokument: pageDokument };

// ---------------------------------------------------------------------------
// Overlay
// ---------------------------------------------------------------------------
let ov = null, backBtn = null, previewBar = null;
let mutedMedia = [];
let lastBackTap = 0;

function buildOverlay(pageId) {
  injectCSS();
  ov = document.createElement('div');
  ov.className = 'zbt-ov';
  ov.id = 'zbTarnOverlay';
  ov.setAttribute('role', 'document');
  ov.dataset.page = pageId;
  ov.innerHTML = RENDER[pageId]();
  backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'zbt-back';
  backBtn.setAttribute('aria-label', 'Zurück (zweimal tippen)');
  backBtn.addEventListener('click', () => {
    const now = Date.now();
    if (now - lastBackTap < DOUBLE_MS) { lastBackTap = 0; hide(); } else lastBackTap = now;
  });
  ov.appendChild(backBtn);
  // Suchfeld: nur Attrappe
  const form = ov.querySelector('[data-zbt="search"]');
  if (form) {
    const msg = form.querySelector('.zbt-s-msg');
    const say = () => { msg.textContent = 'Suchfix wird gerade gewartet. Bitte versuche es in ein paar Minuten noch einmal.'; };
    form.addEventListener('submit', (e) => { e.preventDefault(); say(); });
    form.querySelector('[data-zbt="lucky"]').addEventListener('click', say);
  }
  // Tastatureingaben im Overlay nicht an das Spiel darunter weiterreichen
  ['keydown', 'keyup', 'keypress', 'input'].forEach((t) => ov.addEventListener(t, (e) => e.stopPropagation()));
  document.body.appendChild(ov);
}

function show(pageId = S.page, { preview = false } = {}) {
  if (ov) removeOverlay();
  if (preview) pagePreview = pageId; else panic = true;
  try { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); } catch (e) {}
  buildOverlay(pageId);
  document.documentElement.classList.add('zbt-lock');
  // laufende Medien stummschalten (Spiel läuft weiter)
  mutedMedia = [...document.querySelectorAll('audio, video')].filter((m) => !m.muted);
  mutedMedia.forEach((m) => { m.muted = true; });
  if (preview) {
    previewBar = document.createElement('div');
    previewBar.className = 'zbt-preview-bar';
    previewBar.innerHTML = '<span>Vorschau der Tarnseite</span><button type="button">Schließen</button>';
    previewBar.querySelector('button').onclick = () => hide();
    document.body.appendChild(previewBar);
  }
  ov.scrollTop = 0;
  applyTab();
  updateFab();
  window.dispatchEvent(new CustomEvent('zb-tarnung', { detail: { active: true, page: pageId, preview } }));
}

function removeOverlay() {
  if (ov) ov.remove();
  if (previewBar) previewBar.remove();
  ov = null; backBtn = null; previewBar = null;
}

function hide() {
  const was = panic || pagePreview;
  removeOverlay();
  panic = false; pagePreview = null;
  document.documentElement.classList.remove('zbt-lock');
  mutedMedia.forEach((m) => { m.muted = false; });
  mutedMedia = [];
  applyTab();
  updateFab();
  if (was) window.dispatchEvent(new CustomEvent('zb-tarnung', { detail: { active: false } }));
}

function toggle() { if (panic || pagePreview) hide(); else if (S.on) show(S.page); }

// ---------------------------------------------------------------------------
// Panik-Taste (zweimal schnell drücken)
// ---------------------------------------------------------------------------
let lastKey = 0;
let recording = null; // Callback, wenn gerade eine neue Taste aufgenommen wird
let handled = null;

function onKey(e) {
  if (handled === e) return;
  handled = e;
  if (recording) return;
  if (!S.on && !pagePreview) return;
  if (e.repeat) return;
  if (e.key !== S.key) { lastKey = 0; return; }
  const now = Date.now();
  if (now - lastKey < DOUBLE_MS) {
    lastKey = 0;
    e.preventDefault();
    toggle();
  } else lastKey = now;
}

// ---------------------------------------------------------------------------
// Schwebender Panik-Knopf (nur Touch-Geräte)
// ---------------------------------------------------------------------------
let fab = null;
const isTouch = () => { try { return matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0; } catch (e) { return false; } };

function updateFab() {
  const want = S.on && S.fab && isTouch() && !panic && !pagePreview && document.body;
  if (want && !fab) {
    injectCSS();
    fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'zbt-fab';
    fab.id = 'zbTarnFab';
    fab.setAttribute('aria-label', 'Tarnseite einblenden');
    fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 12c2.5-4 5.5-6 9-6s6.5 2 9 6"/><path d="M5 15l-1.5 2M9.5 17l-.5 2.5M14.5 17l.5 2.5M19 15l1.5 2"/></svg>';
    fab.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); show(S.page); });
    document.body.appendChild(fab);
  } else if (!want && fab) { fab.remove(); fab = null; }
}

// ---------------------------------------------------------------------------
// Einstellungen speichern (auch von außen nutzbar)
// ---------------------------------------------------------------------------
export function getSettings() { return { ...S }; }
export function setSetting(name, value) {
  if (!(name in KEYS)) return;
  const v = name === 'on' || name === 'fab' ? (value ? '1' : '0') : String(value);
  set(KEYS[name], v);
  S = readState();
  if (!S.on && panic) hide();
  applyTab(); updateFab();
  if (ui) ui.render();
}
export const showPanic = (page) => show(page || S.page);
export const hidePanic = hide;
export const previewPage = (page) => show(page, { preview: true });
export const isPanic = () => panic;

// andere Tabs (z. B. ein offenes Spiel) übernehmen Änderungen sofort
window.addEventListener('storage', (e) => {
  if (!e.key || !e.key.startsWith('zb_tarn_')) return;
  S = readState();
  if (!S.on && panic) hide();
  applyTab(); updateFab();
  if (ui) ui.render();
});

// ---------------------------------------------------------------------------
// Einstellungs-Oberfläche (nur dort, wo #zbTarnSettings existiert – also auf der Startseite)
// ---------------------------------------------------------------------------
let ui = null;

const keyLabel = (k) => ({ Escape: 'Esc', ' ': 'Leertaste', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'Enter', Tab: 'Tab', Backspace: '⌫' }[k] || (k.length === 1 ? k.toUpperCase() : k));

function mountSettings(root) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const render = () => {
    const touch = isTouch();
    root.innerHTML = `
      <div class="zb-set-row">
        <div class="zb-set-txt"><b>Tarnmodus</b><span>Tab-Tarnung und Panik-Taste – für Startseite und alle Spiele.</span></div>
        <button type="button" class="zb-switch" role="switch" id="zbTarnOn" aria-checked="${S.on}" aria-label="Tarnmodus"><i></i></button>
      </div>
      <div class="zb-tarn-opts${S.on ? '' : ' hidden'}" id="zbTarnOpts">
        <div class="zb-set-block">
          <span class="zb-set-label">Tab-Tarnung <small>(Titel &amp; Symbol im Browser-Tab)</small></span>
          <div class="zb-chips" role="radiogroup" aria-label="Tab-Tarnung">
            ${TAB_TEMPLATES.map((t) => `<button type="button" class="zb-chip zb-chip-ic" role="radio" data-tab="${t.id}" aria-checked="${S.tab === t.id}" aria-pressed="${S.tab === t.id}">${t.icon ? `<img src="${t.icon}" alt="" width="16" height="16">` : ''}${esc(t.label)}</button>`).join('')}
          </div>
        </div>
        <div class="zb-set-block">
          <span class="zb-set-label">Tarnseite <small>(erscheint bei der Panik-Taste)</small></span>
          <div class="zb-chips" role="radiogroup" aria-label="Tarnseite">
            ${PAGES.map((p) => `<button type="button" class="zb-chip zb-chip-ic" role="radio" data-page="${p.id}" aria-checked="${S.page === p.id}" aria-pressed="${S.page === p.id}"><img src="${p.icon}" alt="" width="16" height="16">${esc(p.label)}</button>`).join('')}
            <button type="button" class="zb-chip zb-chip-link" id="zbTarnPreview">👀 Vorschau</button>
          </div>
        </div>
        <div class="zb-set-block">
          <span class="zb-set-label">Panik-Taste</span>
          <div class="zb-set-key">
            <kbd id="zbTarnKey">${esc(keyLabel(S.key))}</kbd><span>2× schnell drücken</span>
            <button type="button" class="zb-chip" id="zbTarnKeyBtn">Ändern</button>
          </div>
        </div>
        <div class="zb-set-row zb-set-row-sm">
          <div class="zb-set-txt"><b>Panik-Knopf auf Touch</b><span>Kleiner Knopf unten links${touch ? '' : ' (nur auf Handy/Tablet sichtbar)'}.</span></div>
          <button type="button" class="zb-switch" role="switch" id="zbTarnFabSw" aria-checked="${S.fab}" aria-label="Panik-Knopf auf Touch-Geräten"><i></i></button>
        </div>
        <p class="zb-hint zb-set-note">Zurück zum Spiel: dieselbe Taste 2× drücken oder die Ecke oben links 2× antippen. Das Spiel läuft im Hintergrund weiter.</p>
      </div>`;

    root.querySelector('#zbTarnOn').onclick = () => setSetting('on', !S.on);
    root.querySelector('#zbTarnFabSw').onclick = () => setSetting('fab', !S.fab);
    root.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => setSetting('tab', b.dataset.tab); });
    root.querySelectorAll('[data-page]').forEach((b) => { b.onclick = () => setSetting('page', b.dataset.page); });
    root.querySelector('#zbTarnPreview').onclick = () => previewPage(S.page);
    const kb = root.querySelector('#zbTarnKeyBtn');
    kb.onclick = () => {
      if (recording) return;
      kb.textContent = 'Taste drücken …';
      root.querySelector('#zbTarnKey').textContent = '?';
      recording = (e) => {
        e.preventDefault(); e.stopPropagation();
        recording = null;
        const bad = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Enter', 'Unidentified', 'Dead'];
        if (!bad.includes(e.key)) setSetting('key', e.key); else render();
      };
    };
  };
  ui = { render };
  render();
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
function init() {
  injectCSS();
  // capture: Panik-Taste greift auch, wenn das Spiel Tasten selbst abfängt
  window.addEventListener('keydown', (e) => {
    if (recording) { recording(e); return; }
    onKey(e);
  }, true);
  watchTitle();
  applyTab();
  updateFab();
  const root = document.getElementById('zbTarnSettings');
  if (root) mountSettings(root);
  window.zbTarnung = { show: showPanic, hide, preview: previewPage, get: getSettings, set: setSetting, isPanic };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
