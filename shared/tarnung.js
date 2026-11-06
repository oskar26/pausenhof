// Zockbox – Tarnmodus (optional, standardmäßig AUS). made by Oskar
//
// Wichtig: keine echten Logos/Markennamen nachbauen (sonst Phishing-Warnungen für das ganze Repo).
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
//   zb_tarn_tab   'passend' (Standard: Titel/Symbol passend zur Tarnseite) | 'aus' | 'notizen' | 'dokument'
//                 | 'suche' | 'wiki' | 'rechner'                                  (Tab-Tarnung)
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
  suche: svgUrl('<circle cx="16" cy="16" r="16" fill="#fff"/><circle cx="14" cy="14" r="7.5" fill="none" stroke="#1d8a7a" stroke-width="3.6"/><path d="M19.6 19.6 26 26" stroke="#1d8a7a" stroke-width="4" stroke-linecap="round"/>'),
  wiki: svgUrl('<rect width="32" height="32" rx="4" fill="#fff"/><path d="M4 7c4-2 8-2 12 1v19c-4-3-8-3-12-1z" fill="#54595d"/><path d="M28 7c-4-2-8-2-12 1v19c4-3 8-3 12-1z" fill="#a2a9b1"/>'),
  rechner: svgUrl('<rect x="6" y="2" width="20" height="28" rx="3" fill="#4a4f5c"/><rect x="9" y="5" width="14" height="6" rx="1" fill="#cfe8d6"/><g fill="#e6e8ee"><rect x="9" y="14" width="4" height="3" rx="1"/><rect x="14" y="14" width="4" height="3" rx="1"/><rect x="9" y="19" width="4" height="3" rx="1"/><rect x="14" y="19" width="4" height="3" rx="1"/><rect x="9" y="24" width="4" height="3" rx="1"/><rect x="14" y="24" width="4" height="3" rx="1"/></g><rect x="19" y="14" width="4" height="13" rx="1" fill="#f08a3c"/>'),
};

// Tab-Tarnung: Vorlagen
// 'passend' = Titel und Symbol der gewählten Tarnseite (Standard, damit Tab und Tarnseite zusammenpassen).
export const TAB_TEMPLATES = [
  { id: 'passend', label: 'Passend zur Tarnseite', title: null, icon: null },
  { id: 'aus', label: 'Original', title: null, icon: null },
  { id: 'notizen', label: 'Notizen', title: 'Notizen', icon: ICONS.notizen },
  { id: 'dokument', label: 'Dokument', title: 'Dokument – Unbenannt', icon: ICONS.dokument },
  { id: 'suche', label: 'Suche', title: 'Suche', icon: ICONS.suche },
  { id: 'wiki', label: 'Lexikon', title: 'Lexikon – Die freie Enzyklopädie', icon: ICONS.wiki },
  { id: 'rechner', label: 'Taschenrechner', title: 'Taschenrechner', icon: ICONS.rechner },
];

// Tarnseiten (Panik-Modus)
// tab = Tab-Titel, solange nur die Tab-Tarnung aktiv ist; title = Tab-Titel, während die Tarnseite offen ist.
export const PAGES = [
  { id: 'suche', label: 'Suche', tab: 'Suche', title: 'photosynthese – Suche', icon: ICONS.suche },
  { id: 'lexikon', label: 'Lexikon-Artikel', tab: 'Photosynthese – Lexikon', title: 'Photosynthese – Lexikon', icon: ICONS.wiki },
  { id: 'dokument', label: 'Dokument', tab: 'Biologie-Notizen – Dokument', title: 'Biologie-Notizen – Dokument', icon: ICONS.dokument },
];

// ---------------------------------------------------------------------------
// Zustand
// ---------------------------------------------------------------------------
function readState() {
  const tab = get(KEYS.tab, 'passend');
  const page = get(KEYS.page, 'suche');
  return {
    on: get(KEYS.on) === '1',
    tab: TAB_TEMPLATES.some((t) => t.id === tab) ? tab : 'passend',
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
let disguiseTitle = null; // zuletzt gesetzter Tarn-Titel (kann sich ändern, z. B. „<suchwort> – Suche“)
let overlayTitle = null;  // aktueller Titel der offenen Tarnseite

function iconLinks() { return [...document.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"]')].filter((l) => !l.dataset.zbTarn); }

function setDisguise(title, icon) {
  // Titel
  disguiseTitle = title || null;
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
    const id = (ov && ov.dataset.page) || pagePreview || S.page;
    const p = PAGES.find((x) => x.id === id) || PAGES[0];
    setDisguise(overlayTitle || p.title, p.icon);
  } else if (S.on && S.tab === 'passend') {
    const p = PAGES.find((x) => x.id === S.page);
    setDisguise(p.tab, p.icon);
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
    const t = document.title;
    const known = t === disguiseTitle || [...TAB_TEMPLATES, ...PAGES].some((x) => x.title === t || x.tab === t);
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
  font:14px/1.58 Arial,Helvetica,sans-serif;text-align:left;letter-spacing:normal;text-transform:none;-webkit-font-smoothing:auto;color-scheme:light}
.zbt-ov *{box-sizing:border-box}
.zbt-ov a{text-decoration:none;cursor:pointer}
.zbt-ov button{font-family:inherit;color:inherit;letter-spacing:normal;text-transform:none}
.zbt-ov svg{flex:none}
.zbt-back{position:fixed;left:0;top:0;width:64px;height:64px;z-index:2147483001;background:transparent;border:0;padding:0;opacity:0;cursor:default;-webkit-tap-highlight-color:transparent}
.zbt-back:focus-visible{opacity:1;outline:2px dashed #888}
.zbt-fab{position:fixed;left:max(10px,env(safe-area-inset-left));bottom:calc(10px + env(safe-area-inset-bottom));z-index:2147482999;
  width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.3);background:rgba(30,30,30,.5);color:#fff;
  display:grid;place-items:center;padding:0;opacity:.6;-webkit-tap-highlight-color:transparent;touch-action:manipulation;cursor:pointer}
.zbt-fab svg{width:20px;height:20px}
.zbt-fab:active{transform:scale(.92)}
.zbt-preview-bar{position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:2147483002;
  display:flex;gap:10px;align-items:center;padding:8px 8px 8px 14px;border-radius:10px;background:#222;color:#fff;font:600 14px/1.2 Arial,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35);white-space:nowrap}
.zbt-preview-bar button{border:0;border-radius:6px;padding:8px 12px;background:#fff;color:#111;font:700 14px Arial,sans-serif;cursor:pointer}
html.zbt-lock,html.zbt-lock body{overflow:hidden!important}
/* Schutz gegen Spiel-Styles (z. B. body.kd h1): neutrale Basis, die eigenen Regeln oben/unten sind spezifischer */
#zbTarnOverlay h1,#zbTarnOverlay h2,#zbTarnOverlay h3,#zbTarnOverlay h4,#zbTarnOverlay p,#zbTarnOverlay ul,#zbTarnOverlay ol,#zbTarnOverlay li,#zbTarnOverlay table,#zbTarnOverlay td,#zbTarnOverlay th,#zbTarnOverlay input,#zbTarnOverlay button,#zbTarnOverlay a,#zbTarnOverlay span,#zbTarnOverlay div{font-family:inherit;letter-spacing:normal;text-transform:none;text-shadow:none;line-height:inherit}
#zbTarnOverlay h1,#zbTarnOverlay h2,#zbTarnOverlay h3{font-weight:400;margin:0;color:inherit}

/* ===== (a) Suche – Startseite + Ergebnisseite ===== */
#zbTarnOverlay .zbt-s{min-height:100%;display:flex;flex-direction:column;font-family:Arial,Helvetica,sans-serif;color:#202124}
#zbTarnOverlay .zbt-s a{color:#1a0dab}
#zbTarnOverlay .zbt-s-ic{width:24px;height:24px;fill:#5f6368}
#zbTarnOverlay .zbt-s-apps{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;cursor:pointer}
#zbTarnOverlay .zbt-s-apps:hover{background:rgba(60,64,67,.08)}
#zbTarnOverlay .zbt-s-av{width:32px;height:32px;border-radius:50%;background:#6b7f99;color:#fff;display:grid;place-items:center;font:500 15px/1 Arial,sans-serif;margin:0 4px}
#zbTarnOverlay .zbt-s-logo{display:inline-flex;align-items:center;gap:.12em;color:#3c4043;font-family:Arial,Helvetica,sans-serif;font-weight:400;letter-spacing:-.04em;line-height:1;cursor:pointer;user-select:none}
#zbTarnOverlay .zbt-s-logo svg{width:.78em;height:.78em}
#zbTarnOverlay .zbt-s-box{display:flex;align-items:center;gap:12px;height:46px;padding:0 6px 0 14px;border:1px solid #dfe1e5;border-radius:24px;background:#fff}
#zbTarnOverlay .zbt-s-box:hover,#zbTarnOverlay .zbt-s-box:focus-within{box-shadow:0 1px 6px rgba(32,33,36,.28);border-color:rgba(223,225,229,0)}
#zbTarnOverlay .zbt-s-box input{flex:1;min-width:0;height:100%;border:0;outline:0;font:16px Arial,sans-serif;color:#202124;background:transparent;padding:0;-webkit-appearance:none;appearance:none}
#zbTarnOverlay .zbt-s-box input::-webkit-search-cancel-button{display:none}
#zbTarnOverlay .zbt-s-box .lens{width:20px;height:20px;fill:#9aa0a6}
#zbTarnOverlay .zbt-s-tools{display:flex;align-items:center;gap:2px;height:100%}
#zbTarnOverlay .zbt-s-tools span{width:40px;height:40px;display:grid;place-items:center;border-radius:50%;cursor:pointer}
#zbTarnOverlay .zbt-s-tools svg{width:22px;height:22px;fill:#5f6368}
#zbTarnOverlay .zbt-s-tools .x svg{fill:#70757a}
#zbTarnOverlay .zbt-s-tools .div{width:1px;height:65%;background:#dadce0;border-radius:0;margin:0 4px;cursor:default}

/* Startseite */
#zbTarnOverlay .zbt-s-top{display:flex;justify-content:flex-end;align-items:center;gap:12px;height:60px;padding:6px 10px 0 15px;font-size:13px}
#zbTarnOverlay .zbt-s-top a{color:#1f1f1f}
#zbTarnOverlay .zbt-s-top a:hover{text-decoration:underline}
#zbTarnOverlay .zbt-s-home{flex:1;display:flex;flex-direction:column;align-items:center;padding:calc(10vh + 40px) 20px 36px}
#zbTarnOverlay .zbt-s-home .zbt-s-logo{font-size:clamp(56px,16vw,86px);margin-bottom:28px}
#zbTarnOverlay .zbt-s-home form{width:100%;max-width:584px}
#zbTarnOverlay .zbt-s-home .zbt-s-box{height:48px}
#zbTarnOverlay .zbt-s-btns{display:flex;justify-content:center;gap:12px;margin-top:29px;flex-wrap:wrap}
#zbTarnOverlay .zbt-s-btns button{height:36px;padding:0 16px;border:1px solid #f8f9fa;border-radius:8px;background:#f8f9fa;color:#3c4043;font:14px Arial,sans-serif;cursor:pointer}
#zbTarnOverlay .zbt-s-btns button:hover{border-color:#dadce0;box-shadow:0 1px 1px rgba(0,0,0,.1);color:#202124}
#zbTarnOverlay .zbt-s-lang{margin-top:30px;font-size:13px;color:#4d5156;text-align:center}
#zbTarnOverlay .zbt-s-lang a{margin:0 3px}
#zbTarnOverlay .zbt-s-foot{background:#f2f2f2;color:#70757a;font-size:15px;margin-top:auto}
#zbTarnOverlay .zbt-s-foot .c{padding:15px 30px;border-bottom:1px solid #dadce0}
#zbTarnOverlay .zbt-s-foot nav{display:flex;flex-wrap:wrap;justify-content:space-between;gap:0 24px;padding:0 20px}
#zbTarnOverlay .zbt-s-foot nav div{display:flex;flex-wrap:wrap}
#zbTarnOverlay .zbt-s-foot nav a{color:#70757a;padding:15px;font-size:14px}
#zbTarnOverlay .zbt-s-foot nav a:hover{text-decoration:underline}

/* Ergebnisseite */
#zbTarnOverlay .zbt-r-head{display:flex;align-items:center;gap:0;padding:20px 16px 0 28px}
#zbTarnOverlay .zbt-r-head .zbt-s-logo{font-size:30px;width:152px;flex:none}
#zbTarnOverlay .zbt-r-head form{flex:1;max-width:692px;min-width:0}
#zbTarnOverlay .zbt-r-head .zbt-s-box{height:46px;padding-left:20px;box-shadow:0 2px 5px 1px rgba(64,60,67,.16);border-color:transparent}
#zbTarnOverlay .zbt-r-head .zbt-s-box:hover,#zbTarnOverlay .zbt-r-head .zbt-s-box:focus-within{box-shadow:0 2px 8px 1px rgba(64,60,67,.24)}
#zbTarnOverlay .zbt-r-right{margin-left:auto;display:flex;align-items:center;gap:6px;padding-left:16px}
#zbTarnOverlay .zbt-r-tabs{display:flex;gap:0;padding:0 0 0 180px;margin-top:14px;border-bottom:1px solid #ebebeb;overflow-x:auto;white-space:nowrap;scrollbar-width:none}
#zbTarnOverlay .zbt-r-tabs::-webkit-scrollbar{display:none}
#zbTarnOverlay .zbt-r-tabs span{padding:12px 12px 10px;font-size:14px;color:#5f6368;cursor:pointer;border-bottom:3px solid transparent}
#zbTarnOverlay .zbt-r-tabs span.on{color:#1f1f1f;border-bottom-color:#1f1f1f;font-weight:500}
#zbTarnOverlay .zbt-r-tabs .sp{margin-left:auto}
#zbTarnOverlay .zbt-r-body{display:flex;gap:70px;padding:0 0 0 180px}
#zbTarnOverlay .zbt-r-main{width:652px;max-width:100%;min-width:0}
#zbTarnOverlay .zbt-r-stats{color:#70757a;font-size:14px;line-height:43px;height:43px}
#zbTarnOverlay .zbt-r-res{margin:0 0 30px}
#zbTarnOverlay .zbt-r-site{display:flex;align-items:center;gap:12px;margin-bottom:4px}
#zbTarnOverlay .zbt-r-fav{width:28px;height:28px;border-radius:50%;background:#f1f3f4;border:1px solid #ecedef;display:grid;place-items:center;flex:none}
#zbTarnOverlay .zbt-r-fav svg{width:18px;height:18px}
#zbTarnOverlay .zbt-r-site .n{display:block;font-size:14px;color:#202124;line-height:20px}
#zbTarnOverlay .zbt-r-site .u{display:block;font-size:12px;color:#4d5156;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:520px}
#zbTarnOverlay .zbt-r-res h3{margin:0 0 3px;font:400 20px/1.3 Arial,sans-serif;color:#1a0dab}
#zbTarnOverlay .zbt-r-res h3 a{color:#1a0dab}
#zbTarnOverlay .zbt-r-res h3 a:hover{text-decoration:underline}
#zbTarnOverlay .zbt-r-res p{margin:0;color:#474747;font-size:14px;line-height:22px}
#zbTarnOverlay .zbt-r-res p .d{color:#70757a}
#zbTarnOverlay .zbt-r-res p b{color:#5f6368}
#zbTarnOverlay .zbt-r-sub{display:flex;flex-wrap:wrap;gap:4px 18px;margin-top:6px;padding-left:16px}
#zbTarnOverlay .zbt-r-sub a{font-size:14px;color:#1a0dab}
#zbTarnOverlay .zbt-r-paa{margin:6px 0 34px}
#zbTarnOverlay .zbt-r-paa h2{font:400 20px/1.3 Arial,sans-serif;margin:0 0 12px;color:#202124}
#zbTarnOverlay .zbt-r-q{border-top:1px solid #dadce0}
#zbTarnOverlay .zbt-r-q:last-child{border-bottom:1px solid #dadce0}
#zbTarnOverlay .zbt-r-q button{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:48px;padding:10px 4px;background:none;border:0;font:16px/1.4 Arial,sans-serif;color:#202124;text-align:left;cursor:pointer}
#zbTarnOverlay .zbt-r-q button svg{width:24px;height:24px;fill:#5f6368;transition:transform .2s}
#zbTarnOverlay .zbt-r-q.open button svg{transform:rotate(180deg)}
#zbTarnOverlay .zbt-r-q .a{display:none;padding:0 4px 16px;color:#202124;font-size:14px;line-height:22px}
#zbTarnOverlay .zbt-r-q.open .a{display:block}
#zbTarnOverlay .zbt-r-kp{width:369px;flex:none;margin-top:43px;border:1px solid #dadce0;border-radius:8px;padding:16px;align-self:flex-start}
#zbTarnOverlay .zbt-r-kp h2{font:400 28px/1.2 Arial,sans-serif;margin:0;color:#202124}
#zbTarnOverlay .zbt-r-kp .t{color:#70757a;font-size:14px;margin:2px 0 12px}
#zbTarnOverlay .zbt-r-kp svg.pic{display:block;width:100%;height:auto;border-radius:8px;margin-bottom:12px}
#zbTarnOverlay .zbt-r-kp p{margin:0 0 10px;font-size:14px;line-height:22px;color:#4d5156}
#zbTarnOverlay .zbt-r-kp dl{margin:0;font-size:14px;line-height:22px}
#zbTarnOverlay .zbt-r-kp dt{display:inline;font-weight:700;color:#202124}
#zbTarnOverlay .zbt-r-kp dd{display:inline;margin:0;color:#4d5156}
#zbTarnOverlay .zbt-r-kp dd::after{content:'';display:block}
#zbTarnOverlay .zbt-r-pages{display:flex;align-items:center;justify-content:center;gap:4px;margin:10px 0 40px;font-size:14px}
#zbTarnOverlay .zbt-r-pages span,#zbTarnOverlay .zbt-r-pages a{min-width:28px;text-align:center;padding:6px 4px}
#zbTarnOverlay .zbt-r-pages .on{color:#202124;font-weight:700}
#zbTarnOverlay .zbt-r-pages a{color:#1a0dab}
#zbTarnOverlay .zbt-r-foot{background:#f2f2f2;color:#70757a;font-size:14px;margin-top:auto}
#zbTarnOverlay .zbt-r-foot .c{padding:14px 0 14px 180px;border-bottom:1px solid #dadce0}
#zbTarnOverlay .zbt-r-foot .c b{color:#202124;font-weight:400}
#zbTarnOverlay .zbt-r-foot nav{display:flex;flex-wrap:wrap;gap:0 28px;padding:14px 0 18px 180px}
#zbTarnOverlay .zbt-r-foot nav a{color:#70757a}
@media (max-width:1180px){#zbTarnOverlay .zbt-r-kp{display:none}}
@media (max-width:860px){
  #zbTarnOverlay .zbt-r-head{flex-wrap:wrap;padding:12px 12px 0;gap:10px}
  #zbTarnOverlay .zbt-r-head .zbt-s-logo{width:auto;font-size:26px;order:1;margin:0 auto}
  #zbTarnOverlay .zbt-r-head .zbt-r-right{order:2;position:absolute;right:10px;top:8px;padding:0}
  #zbTarnOverlay .zbt-r-head .zbt-r-right .zbt-s-apps{display:none}
  #zbTarnOverlay .zbt-r-head form{order:3;flex:1 1 100%;max-width:none}
  #zbTarnOverlay .zbt-r-head .zbt-s-box{padding-left:16px}
  #zbTarnOverlay .zbt-r-head .zbt-s-tools .m{display:none}
  #zbTarnOverlay .zbt-r-tabs{padding:0 8px;margin-top:6px}
  #zbTarnOverlay .zbt-r-tabs .sp{display:none}
  #zbTarnOverlay .zbt-r-body{padding:0 16px}
  #zbTarnOverlay .zbt-r-stats{display:none}
  #zbTarnOverlay .zbt-r-main{padding-top:14px}
  #zbTarnOverlay .zbt-r-res{margin-bottom:28px}
  #zbTarnOverlay .zbt-r-res h3{font-size:18px}
  #zbTarnOverlay .zbt-r-site .u{max-width:calc(100vw - 90px)}
  #zbTarnOverlay .zbt-r-foot .c,#zbTarnOverlay .zbt-r-foot nav{padding-left:16px;padding-right:16px}
  #zbTarnOverlay .zbt-s-foot nav{justify-content:center}
  #zbTarnOverlay .zbt-s-foot .c{padding:15px 20px}
}
@media (max-width:560px){#zbTarnOverlay .zbt-s-top .lnk{display:none}#zbTarnOverlay .zbt-s-home{padding-top:12vh}#zbTarnOverlay .zbt-s-foot nav a{padding:10px 12px}}

/* ===== (b) Lexikon – Artikel im Stil der freien Enzyklopädie ===== */
#zbTarnOverlay .zbt-v{min-height:100%;background:#fff;color:#202122;font:14px/1.6 sans-serif;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Lato,Helvetica,Arial,sans-serif}
#zbTarnOverlay .zbt-v a{color:#36c}
#zbTarnOverlay .zbt-v a:hover{text-decoration:underline}
#zbTarnOverlay .zbt-v a.new{color:#d73333}
#zbTarnOverlay .zbt-v-head{display:flex;align-items:center;gap:12px;max-width:1596px;margin:0 auto;padding:8px 24px;height:58px}
#zbTarnOverlay .zbt-v-menu{width:32px;height:32px;display:grid;place-items:center;border-radius:2px;cursor:pointer;flex:none}
#zbTarnOverlay .zbt-v-menu svg{width:20px;height:20px;fill:#202122}
#zbTarnOverlay .zbt-v-brand{display:flex;align-items:center;gap:10px;color:#000!important;flex:none;margin-right:12px}
#zbTarnOverlay .zbt-v-brand:hover{text-decoration:none!important}
#zbTarnOverlay .zbt-v-brand svg{width:44px;height:44px}
#zbTarnOverlay .zbt-v-word{display:flex;flex-direction:column;line-height:1}
#zbTarnOverlay .zbt-v-word b{font:400 21px/1 'Linux Libertine','Georgia','Times',serif;font-variant:small-caps;letter-spacing:.06em;color:#000}
#zbTarnOverlay .zbt-v-word small{font:400 12.5px/1.3 'Linux Libertine','Georgia','Times',serif;color:#202122;margin-top:3px}
#zbTarnOverlay .zbt-v-search{display:flex;flex:1;max-width:500px;min-width:0}
#zbTarnOverlay .zbt-v-search label{flex:1;display:flex;align-items:center;gap:6px;height:32px;border:1px solid #a2a9b1;border-right:0;border-radius:2px 0 0 2px;padding:0 8px;background:#fff;min-width:0}
#zbTarnOverlay .zbt-v-search label svg{width:18px;height:18px;fill:#72777d}
#zbTarnOverlay .zbt-v-search input{flex:1;min-width:0;border:0;outline:0;font:14px sans-serif;color:#202122;background:transparent;padding:0}
#zbTarnOverlay .zbt-v-search button{height:32px;padding:0 12px;border:1px solid #a2a9b1;border-radius:0 2px 2px 0;background:#f8f9fa;color:#202122;font:700 14px sans-serif;cursor:pointer}
#zbTarnOverlay .zbt-v-user{margin-left:auto;display:flex;align-items:center;gap:16px;font-size:14px;white-space:nowrap}
#zbTarnOverlay .zbt-v-user .dots{font-weight:700;letter-spacing:1px;color:#202122}
#zbTarnOverlay .zbt-v-page{max-width:1596px;margin:0 auto;padding:0 24px;display:grid;grid-template-columns:15.5em minmax(0,1fr);column-gap:24px}
#zbTarnOverlay .zbt-v-toc{position:sticky;top:0;align-self:start;padding:24px 0 20px;font-size:14px;max-height:100vh;overflow:auto}
#zbTarnOverlay .zbt-v-toc .h{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid #c8ccd1;padding-bottom:4px;margin-bottom:6px}
#zbTarnOverlay .zbt-v-toc .h b{font-size:14px}
#zbTarnOverlay .zbt-v-toc .h span{font-size:12px;padding:1px 6px;border:1px solid #a2a9b1;border-radius:2px;color:#202122;background:#f8f9fa}
#zbTarnOverlay .zbt-v-toc ul{list-style:none;margin:0;padding:0}
#zbTarnOverlay .zbt-v-toc li{padding:5px 0;line-height:1.3}
#zbTarnOverlay .zbt-v-toc li.on a{color:#202122;font-weight:700}
#zbTarnOverlay .zbt-v-toc li ul{padding-left:12px}
#zbTarnOverlay .zbt-v-main{min-width:0;padding-bottom:30px}
#zbTarnOverlay .zbt-v-titlebar{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;border-bottom:1px solid #a2a9b1;margin-top:18px}
#zbTarnOverlay .zbt-v-titlebar h1{font:400 28.8px/1.375 'Linux Libertine','Georgia','Times',serif;margin:0 0 2px;color:#000;letter-spacing:normal;text-transform:none}
#zbTarnOverlay .zbt-v-lang{display:inline-flex;align-items:center;gap:6px;margin-bottom:6px;padding:4px 8px;font-weight:700;font-size:14px;color:#36c;border-radius:2px;white-space:nowrap}
#zbTarnOverlay .zbt-v-lang svg{width:18px;height:18px;fill:#36c}
#zbTarnOverlay .zbt-v-tabs{display:flex;justify-content:space-between;gap:12px;font-size:14px;border-bottom:1px solid #a2a9b1;overflow-x:auto;white-space:nowrap;scrollbar-width:none}
#zbTarnOverlay .zbt-v-tabs::-webkit-scrollbar{display:none}
#zbTarnOverlay .zbt-v-tabs div{display:flex;gap:2px}
#zbTarnOverlay .zbt-v-tabs a{display:block;padding:8px 8px 6px;margin-bottom:-1px;border-bottom:2px solid transparent}
#zbTarnOverlay .zbt-v-tabs a.on{color:#202122;border-bottom-color:#202122}
#zbTarnOverlay .zbt-v-tabs a.on:hover{text-decoration:none}
#zbTarnOverlay .zbt-v-tag{font-size:12.8px;color:#54595d;margin:8px 0 10px}
#zbTarnOverlay .zbt-v-body{font-size:14px;line-height:1.6}
#zbTarnOverlay .zbt-v-body p{margin:7px 0 7px}
#zbTarnOverlay .zbt-v-hat{font-style:italic;padding-left:1.6em;margin:0 0 8px;color:#202122}
#zbTarnOverlay .zbt-v-body h2{font:400 21px/1.375 'Linux Libertine','Georgia','Times',serif;color:#000;border-bottom:1px solid #a2a9b1;margin:18px 0 6px;padding-bottom:1px;letter-spacing:normal;text-transform:none}
#zbTarnOverlay .zbt-v-body h2 .ed{float:right;font:12.5px sans-serif;color:#54595d;margin-top:8px}
#zbTarnOverlay .zbt-v-body h3{font:700 16.8px/1.6 sans-serif;margin:14px 0 2px;color:#202122;letter-spacing:normal;text-transform:none}
#zbTarnOverlay .zbt-v-body sup{font-size:10.5px;line-height:1}
#zbTarnOverlay .zbt-v-body ul{margin:4px 0 8px;padding-left:1.6em}
#zbTarnOverlay .zbt-v-box{float:right;clear:right;width:22em;margin:4px 0 12px 16px;border:1px solid #a2a9b1;background:#f8f9fa;font-size:12.3px;line-height:1.5;padding:3px}
#zbTarnOverlay .zbt-v-box .cap{font-weight:700;text-align:center;font-size:14px;padding:6px 4px;background:#cfe3c6}
#zbTarnOverlay .zbt-v-box svg{display:block;width:100%;height:auto;margin:3px 0}
#zbTarnOverlay .zbt-v-box .sub{text-align:center;color:#202122;padding:0 4px 6px}
#zbTarnOverlay .zbt-v-box table{width:100%;border-collapse:collapse}
#zbTarnOverlay .zbt-v-box th{text-align:left;vertical-align:top;padding:3px 5px;width:40%;font-weight:700}
#zbTarnOverlay .zbt-v-box td{padding:3px 5px;vertical-align:top}
#zbTarnOverlay .zbt-v-box tr+tr th,#zbTarnOverlay .zbt-v-box tr+tr td{border-top:1px solid #eaecf0}
#zbTarnOverlay .zbt-v-formula{display:block;text-align:center;margin:10px 0 12px;font:16px 'Times New Roman',serif}
#zbTarnOverlay .zbt-v-refs{font-size:12.6px;line-height:1.6;padding-left:2em;margin:6px 0}
#zbTarnOverlay .zbt-v-cats{clear:both;border:1px solid #a2a9b1;background:#f8f9fa;padding:6px 8px;margin-top:20px;font-size:12.6px}
#zbTarnOverlay .zbt-v-foot{border-top:1px solid #a2a9b1;margin-top:24px;padding:14px 0 30px;font-size:12px;color:#202122}
#zbTarnOverlay .zbt-v-foot p{margin:0 0 8px}
#zbTarnOverlay .zbt-v-foot nav{display:flex;flex-wrap:wrap;gap:4px 14px}
@media (max-width:1000px){
  #zbTarnOverlay .zbt-v-page{grid-template-columns:minmax(0,1fr)}
  #zbTarnOverlay .zbt-v-toc{display:none}
  #zbTarnOverlay .zbt-v-user .opt{display:none}
}
@media (max-width:720px){
  #zbTarnOverlay .zbt-v{font-size:16px}
  #zbTarnOverlay .zbt-v-head{padding:0 8px;height:54px;gap:6px;border-bottom:1px solid #eaecf0}
  #zbTarnOverlay .zbt-v-brand{margin:0 auto}
  #zbTarnOverlay .zbt-v-brand svg{display:none}
  #zbTarnOverlay .zbt-v-word b{font-size:22px}
  #zbTarnOverlay .zbt-v-word small{display:none}
  #zbTarnOverlay .zbt-v-search{flex:none;width:32px}
  #zbTarnOverlay .zbt-v-search label{border:0;padding:0;justify-content:center}
  #zbTarnOverlay .zbt-v-search input,#zbTarnOverlay .zbt-v-search button{display:none}
  #zbTarnOverlay .zbt-v-search label svg{width:20px;height:20px;fill:#202122}
  #zbTarnOverlay .zbt-v-user{display:none}
  #zbTarnOverlay .zbt-v-page{padding:0 16px}
  #zbTarnOverlay .zbt-v-titlebar{display:block;border-bottom:0;margin-top:14px}
  #zbTarnOverlay .zbt-v-titlebar h1{font-size:28px;line-height:1.3}
  #zbTarnOverlay .zbt-v-lang{display:none}
  #zbTarnOverlay .zbt-v-tabs{border-top:1px solid #eaecf0;border-bottom:1px solid #eaecf0}
  #zbTarnOverlay .zbt-v-tabs div:last-child{display:none}
  #zbTarnOverlay .zbt-v-body{font-size:16px;line-height:1.65}
  #zbTarnOverlay .zbt-v-box{float:none;width:auto;margin:10px 0 14px}
  #zbTarnOverlay .zbt-v-body h2{font-size:22px}
}

/* ===== (c) Dokument ===== */
#zbTarnOverlay .zbt-d{min-height:100%;background:#eef0f3;display:flex;flex-direction:column;font-family:Arial,Helvetica,sans-serif}
#zbTarnOverlay .zbt-d-head{background:#fff;border-bottom:1px solid #dadce0;position:sticky;top:0;z-index:2}
#zbTarnOverlay .zbt-d-row1{display:flex;align-items:center;gap:10px;padding:8px 14px 2px}
#zbTarnOverlay .zbt-d-row1 svg{width:28px;height:28px;flex:none}
#zbTarnOverlay .zbt-d-name{font-size:17px;color:#202124;outline:0;border:1px solid transparent;border-radius:4px;padding:1px 6px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#zbTarnOverlay .zbt-d-name:hover{border-color:#dadce0}
#zbTarnOverlay .zbt-d-saved{font-size:12px;color:#5f6368;margin-left:auto;white-space:nowrap}
#zbTarnOverlay .zbt-d-menu{display:flex;gap:14px;padding:0 14px 6px 52px;font-size:13.5px;color:#3c4043;overflow-x:auto;white-space:nowrap}
#zbTarnOverlay .zbt-d-tools{display:flex;align-items:center;gap:4px;padding:5px 12px;margin:0 10px 8px;background:#edf2fa;border-radius:20px;overflow-x:auto;white-space:nowrap}
#zbTarnOverlay .zbt-d-tools .dd{flex:none;font:13px Arial,sans-serif;color:#444;padding:0 6px;cursor:default}#zbTarnOverlay .zbt-d-tools .dd::after{content:' ▾';font-size:10px;color:#666}
#zbTarnOverlay .zbt-d-tools button{height:28px;min-width:28px;border:0;border-radius:4px;background:transparent;color:#444;font:13px Arial,sans-serif;padding:0 6px;cursor:pointer}
#zbTarnOverlay .zbt-d-tools button:hover{background:#dde3ea}
#zbTarnOverlay .zbt-d-tools .sep{width:1px;height:20px;background:#c7c7c7;margin:0 4px;flex:none}
#zbTarnOverlay .zbt-d-page{width:min(816px,calc(100% - 24px));margin:18px auto 50px;background:#fff;box-shadow:0 1px 3px rgba(60,64,67,.3);padding:clamp(24px,8vw,90px) clamp(20px,9vw,96px);min-height:900px;font:15px/1.6 Arial,sans-serif;color:#202124;outline:0}
#zbTarnOverlay .zbt-d-page h1{font:400 26px/1.3 Arial,sans-serif;margin:0 0 6px;letter-spacing:normal;text-transform:none}
#zbTarnOverlay .zbt-d-page h2{font:700 17px/1.3 Arial,sans-serif;margin:22px 0 6px;letter-spacing:normal;text-transform:none}
#zbTarnOverlay .zbt-d-page .dt{color:#5f6368;font-size:13px;margin-bottom:18px}
#zbTarnOverlay .zbt-d-page ul{margin:6px 0 10px;padding-left:22px}
#zbTarnOverlay .zbt-d-page p{margin:0 0 10px}
`;

function injectCSS() {
  if (document.getElementById('zbt-css')) return;
  const st = document.createElement('style');
  st.id = 'zbt-css'; st.textContent = CSS;
  (document.head || document.documentElement).appendChild(st);
}

// ---------------------------------------------------------------------------
// Tarnseiten (eigener Text, eigenes Design, keine fremden Marken oder Logos)
// ---------------------------------------------------------------------------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LENS = '<svg class="lens" viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z"/></svg>';
const MIC = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3zm5.3-3a5.3 5.3 0 0 1-10.6 0H5a7 7 0 0 0 6 6.9V22h2v-3.1a7 7 0 0 0 6-6.9z"/></svg>';
const CAM = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3 7.2 5H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.2L15 3zm3 15a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/></svg>';
const XIC = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/></svg>';
const APPS = '<svg class="zbt-s-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm6 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm6 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm6 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm6 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm6 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm6 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>';
const CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6z"/></svg>';
// neutrales Such-Logo: einfarbiger Schriftzug + Lupe (bewusst KEIN nachgebautes Fremd-Logo)
const S_LOGO = '<span class="zbt-s-logo" data-zbt="home" role="link" aria-label="Suche – Startseite"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="13" cy="13" r="8.5" fill="none" stroke="#1d8a7a" stroke-width="3.6"/><path d="M19.5 19.5 27 27" stroke="#1d8a7a" stroke-width="4" stroke-linecap="round"/></svg>Suche</span>';
const SITE_IC = {
  lex: '<svg viewBox="0 0 24 24"><path d="M3 5c3-1.5 6-1.5 9 .8V20c-3-2.3-6-2.3-9-.8z" fill="#54595d"/><path d="M21 5c-3-1.5-6-1.5-9 .8V20c3-2.3 6-2.3 9-.8z" fill="#a2a9b1"/></svg>',
  leaf: '<svg viewBox="0 0 24 24"><path d="M5 19C5 9 11 4 20 4c0 9-5 15-15 15z" fill="#3e9b4f"/><path d="M5 19 14 10" stroke="#fff" stroke-width="1.6"/></svg>',
  cap: '<svg viewBox="0 0 24 24"><path d="M12 4 1 9l11 5 9-4.1V16h2V9z" fill="#c2552d"/><path d="M5 12.5V16c2 2 12 2 14 0v-3.5l-7 3.2z" fill="#e07a4f"/></svg>',
  play: '<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="4" fill="#5c6bc0"/><path d="M10 9v6l5-3z" fill="#fff"/></svg>',
  atom: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="2.4" fill="#1d7fa3"/><g fill="none" stroke="#1d7fa3" stroke-width="1.5"><ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(-60 12 12)"/></g></svg>',
};

function searchBox(q, big) {
  return `<form data-zbt="search" role="search"><label class="zbt-s-box">${big ? LENS : ''}<input type="search" name="q" value="${esc(q || '')}" autocomplete="off" spellcheck="false" aria-label="Suchen" maxlength="200">
    <span class="zbt-s-tools">${q && !big ? `<span class="x" data-zbt="clear" aria-label="Löschen">${XIC}</span><span class="div"></span>` : ''}<span class="m" aria-hidden="true">${MIC}</span><span class="m" aria-hidden="true">${CAM}</span>${big ? '' : `<span data-zbt="go" aria-label="Suchen">${LENS.replace('class="lens"', 'style="fill:#1a73e8"')}</span>`}</span></label>${big ? '<div class="zbt-s-btns"><button type="submit">Suche starten</button><button type="button" data-zbt="lucky">Auf gut Glück!</button></div>' : ''}</form>`;
}

function searchHome() {
  return `<div class="zbt-s">
  <div class="zbt-s-top"><a class="lnk">Mail</a><a class="lnk">Bilder</a><span class="zbt-s-apps" aria-hidden="true">${APPS}</span><span class="zbt-s-av" aria-hidden="true">L</span></div>
  <div class="zbt-s-home">${S_LOGO}${searchBox('', true)}
    <div class="zbt-s-lang">Suche gibt es auch auf: <a>English</a><a>Français</a><a>Türkçe</a><a>Русский</a></div>
  </div>
  <footer class="zbt-s-foot"><div class="c">Deutschland</div><nav><div><a>Über uns</a><a>Werbung</a><a>Unternehmen</a><a>Wie funktioniert die Suche?</a></div><div><a>Datenschutzerklärung</a><a>Nutzungsbedingungen</a><a>Einstellungen</a></div></nav></footer>
</div>`;
}

const PHOTO_RESULTS = [
  { ic: 'lex', n: 'Lexikon', u: 'https://de.lexikon.org › wiki › Photosynthese', t: 'Photosynthese – Lexikon', open: 'lexikon',
    p: '<b>Photosynthese</b> ist ein physiologischer Prozess zur Erzeugung von energiereichen Biomolekülen aus energieärmeren Stoffen mithilfe von Lichtenergie. Sie wird von Pflanzen, Algen und einigen Bakterien betrieben.',
    sub: ['Calvin-Zyklus', 'Lichtreaktion', 'Chlorophyll', 'Gesamtgleichung'] },
  { ic: 'leaf', n: 'Bio-Lernen', u: 'https://www.bio-lernen.de › pflanzen › photosynthese', t: 'Photosynthese einfach erklärt: Formel, Ablauf & Ort',
    p: '<span class="d">12.09.2026 — </span>Bei der <b>Photosynthese</b> stellen Pflanzen aus Kohlenstoffdioxid und Wasser mithilfe von Sonnenlicht Traubenzucker und Sauerstoff her. Wir erklären dir Schritt für Schritt …' },
  { ic: 'cap', n: 'Schulwissen kompakt', u: 'https://www.schulwissen-kompakt.de › biologie › klasse-9', t: 'Photosynthese – Zusammenfassung für die 9. Klasse',
    p: 'Alles Wichtige zur <b>Photosynthese</b> auf einen Blick: Wortgleichung, Summenformel, lichtabhängige und lichtunabhängige Reaktion sowie typische Prüfungsfragen.' },
  { ic: 'play', n: 'Lernvideos', u: 'https://www.lernvideos.de › biologie', t: 'Photosynthese – Lichtreaktion und Calvin-Zyklus (Video)',
    p: '<span class="d">8:42 · </span>In diesem Video lernst du, wie die <b>Photosynthese</b> in den Chloroplasten abläuft und was in der Lichtreaktion und im Calvin-Zyklus passiert.' },
  { ic: 'atom', n: 'Naturwissen', u: 'https://www.naturwissen.info › photosynthese-versuch', t: 'Versuch: Sauerstoffbildung bei der Wasserpest',
    p: 'Mit diesem einfachen Experiment lässt sich zeigen, dass bei der <b>Photosynthese</b> Sauerstoff entsteht. Material, Durchführung und Auswertung mit Tabelle.' },
];
const PHOTO_QA = [
  ['Was ist die Photosynthese einfach erklärt?', 'Pflanzen nutzen Sonnenlicht, um aus Kohlenstoffdioxid und Wasser Zucker herzustellen. Dabei geben sie Sauerstoff ab.'],
  ['Wie lautet die Formel der Photosynthese?', '6 CO₂ + 6 H₂O → C₆H₁₂O₆ + 6 O₂ (mit Lichtenergie, in den Chloroplasten).'],
  ['Wo findet die Photosynthese statt?', 'In den Chloroplasten der Pflanzenzellen, vor allem in den Blättern. Die Lichtreaktion läuft in den Thylakoiden ab, der Calvin-Zyklus im Stroma.'],
  ['Was ist der Unterschied zwischen Photosynthese und Zellatmung?', 'Die Photosynthese baut Zucker unter Lichtenergie auf und setzt Sauerstoff frei. Die Zellatmung baut Zucker mit Sauerstoff ab und setzt Energie frei.'],
];

function genericResults(q) {
  const Q = esc(q);
  const T = esc(q.charAt(0).toUpperCase() + q.slice(1)); // Titel groß, Text wie eingegeben
  return [
    { ic: 'lex', n: 'Lexikon', u: 'https://de.lexikon.org › wiki', t: `${T} – Lexikon`, p: `<b>${Q}</b> – Definition, Herkunft und Bedeutung. Artikel aus der freien Enzyklopädie mit weiterführenden Links und Quellen.` },
    { ic: 'cap', n: 'Schulwissen kompakt', u: 'https://www.schulwissen-kompakt.de › suche', t: `${T} einfach erklärt – Schulwissen kompakt`, p: `Was bedeutet <b>${Q}</b>? Hier findest du eine verständliche Erklärung mit Beispielen und Übungsaufgaben.` },
    { ic: 'leaf', n: 'Lernportal', u: 'https://www.lernportal.de › themen', t: `${T}: Alles Wichtige im Überblick`, p: `<span class="d">vor 3 Tagen — </span>Zusammenfassung zu <b>${Q}</b>: die wichtigsten Fakten, Begriffe und häufige Fragen.` },
    { ic: 'play', n: 'Lernvideos', u: 'https://www.lernvideos.de › themen', t: `${T} – Erklärvideo`, p: `In wenigen Minuten erklärt: <b>${Q}</b>. Mit Zusammenfassung zum Download.` },
  ];
}

function resultHtml(r) {
  return `<div class="zbt-r-res"><div class="zbt-r-site"><span class="zbt-r-fav">${SITE_IC[r.ic]}</span><span><span class="n">${r.n}</span><span class="u">${r.u}</span></span></div>
    <h3><a ${r.open ? `data-zbt-open="${r.open}"` : ''}>${r.t}</a></h3><p>${r.p}</p>${r.sub ? `<div class="zbt-r-sub">${r.sub.map((s) => `<a data-zbt-open="lexikon">${s}</a>`).join('')}</div>` : ''}</div>`;
}

const KP_PIC = '<svg class="pic" viewBox="0 0 340 150" aria-hidden="true"><rect width="340" height="150" fill="#e7f3e2"/><circle cx="296" cy="34" r="20" fill="#f6c945"/><path d="M276 46 236 70M284 54 252 86" stroke="#e8b730" stroke-width="3"/><path d="M90 150c0-50 14-84 52-110" stroke="#3f7d3a" stroke-width="5" fill="none"/><ellipse cx="160" cy="62" rx="54" ry="22" transform="rotate(-25 160 62)" fill="#5aa64f"/><ellipse cx="94" cy="96" rx="42" ry="18" transform="rotate(30 94 96)" fill="#6dbb5f"/></svg>';

function searchResults(q) {
  const photo = /photo|foto|synth/i.test(q);
  const res = photo ? PHOTO_RESULTS : genericResults(q);
  const n = photo ? '4.130.000' : (100000 + (q.length * 7919) % 900000).toLocaleString('de-DE');
  const list = res.map(resultHtml);
  if (photo) {
    list.splice(1, 0, `<div class="zbt-r-paa"><h2>Ähnliche Fragen</h2>${PHOTO_QA.map(([f, a]) => `<div class="zbt-r-q"><button type="button" data-zbt="qa">${f}${CHEV}</button><div class="a">${a}</div></div>`).join('')}</div>`);
  }
  return `<div class="zbt-s zbt-r">
  <div class="zbt-r-head" style="position:relative">${S_LOGO}${searchBox(q, false)}<div class="zbt-r-right"><span class="zbt-s-apps" aria-hidden="true">${APPS}</span><span class="zbt-s-av" aria-hidden="true">L</span></div></div>
  <div class="zbt-r-tabs"><span class="on">Alle</span><span>Bilder</span><span>Videos</span><span>News</span><span>Bücher</span><span>Web</span><span>Mehr</span><span class="sp">Suchfilter</span></div>
  <div class="zbt-r-body">
    <div class="zbt-r-main"><div class="zbt-r-stats">Ungefähr ${n} Ergebnisse (0,${photo ? '38' : '41'} Sekunden)</div>${list.join('')}
      <div class="zbt-r-pages"><span class="on">1</span><a>2</a><a>3</a><a>4</a><a>5</a><a>6</a><a>7</a><a>8</a><a>9</a><a>10</a><a>Weiter</a></div>
    </div>
    ${photo ? `<aside class="zbt-r-kp"><h2>Photosynthese</h2><div class="t">Biologischer Prozess</div>${KP_PIC}<p>Photosynthese ist der Vorgang, bei dem grüne Pflanzen, Algen und einige Bakterien Lichtenergie in chemische Energie umwandeln. <a data-zbt-open="lexikon">Lexikon</a></p><dl><dt>Ort: </dt><dd>Chloroplasten</dd><dt>Ausgangsstoffe: </dt><dd>Kohlenstoffdioxid, Wasser</dd><dt>Produkte: </dt><dd>Glucose, Sauerstoff</dd><dt>Teilschritte: </dt><dd>Lichtreaktion, Calvin-Zyklus</dd></dl></aside>` : ''}
  </div>
  <footer class="zbt-r-foot"><div class="c"><b>Deutschland</b> · Basierend auf deinen bisherigen Aktivitäten</div><nav><a>Hilfe</a><a>Feedback geben</a><a>Datenschutzerklärung</a><a>Nutzungsbedingungen</a></nav></footer>
</div>`;
}

// Standardansicht der Tarnseite „Suche“: Ergebnisse zu einem Schulthema – sieht nach Recherche aus.
const SEARCH_DEFAULT_Q = 'photosynthese';
function pageSuche() { return searchResults(SEARCH_DEFAULT_Q); }

const MENU_IC = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M1 3h18v2H1zm0 6h18v2H1zm0 6h18v2H1z"/></svg>';
const LANG_IC = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M20 18h-1.4l-1.2-3h-4.9l-1.2 3H9.9l4.4-11h1.3zm-3.2-4.5-1.9-4.9-1.9 4.9zM9 6H6V4H4v2H0v2h6.4C5.9 9.5 5 10.9 3.9 12 3.1 11.2 2.5 10.4 2 9.5H.2c.6 1.3 1.4 2.5 2.4 3.6L0 15.6 1.4 17 4 14.4l1.6 1.6.6-1.6-1-1C6.6 12 7.7 10 8.4 8H9z"/></svg>';
const LEX_MARK = '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="#f8f9fa" stroke="#c8ccd1" stroke-width="1.5"/><path d="M10 15c4.6-2.2 9.2-2.2 13.8.9V36c-4.6-3-9.2-3-13.8-.9z" fill="#54595d"/><path d="M38 15c-4.6-2.2-9.2-2.2-13.8.9V36c4.6-3 9.2-3 13.8-.9z" fill="#a2a9b1"/></svg>';

function pageLexikon() {
  return `<div class="zbt-v">
  <header class="zbt-v-head">
    <span class="zbt-v-menu" aria-hidden="true">${MENU_IC}</span>
    <a class="zbt-v-brand">${LEX_MARK}<span class="zbt-v-word"><b>Lexikon</b><small>Die freie Enzyklopädie</small></span></a>
    <form class="zbt-v-search" data-zbt="lexsearch" role="search"><label>${LENS}<input type="search" placeholder="Lexikon durchsuchen" aria-label="Lexikon durchsuchen"></label><button type="submit">Suchen</button></form>
    <div class="zbt-v-user"><a class="opt">Spenden</a><a class="opt">Benutzerkonto erstellen</a><a>Anmelden</a><span class="dots">···</span></div>
  </header>
  <div class="zbt-v-page">
    <nav class="zbt-v-toc" aria-label="Inhalt"><div class="h"><b>Inhalt</b><span>verbergen</span></div>
      <ul><li class="on"><a>(Anfang)</a></li><li><a>Etymologie</a></li><li><a>Gesamtgleichung</a></li><li><a>Ablauf</a><ul><li><a>Lichtabhängige Reaktionen</a></li><li><a>Calvin-Zyklus</a></li></ul></li><li><a>Einflussfaktoren</a></li><li><a>Bedeutung</a></li><li><a>Siehe auch</a></li><li><a>Einzelnachweise</a></li></ul></nav>
    <main class="zbt-v-main">
      <div class="zbt-v-titlebar"><h1>Photosynthese</h1><span class="zbt-v-lang">${LANG_IC}112 Sprachen ▾</span></div>
      <div class="zbt-v-tabs"><div><a class="on">Artikel</a><a>Diskussion</a></div><div><a class="on">Lesen</a><a>Bearbeiten</a><a>Quelltext bearbeiten</a><a>Versionsgeschichte</a><a>Werkzeuge ▾</a></div></div>
      <div class="zbt-v-tag">aus Lexikon, der freien Enzyklopädie</div>
      <div class="zbt-v-body">
        <p class="zbt-v-hat">Dieser Artikel behandelt die Photosynthese bei Pflanzen. Zur Energiegewinnung ohne Licht siehe <a>Chemosynthese</a>.</p>
        <div class="zbt-v-box">
          <div class="cap">Photosynthese</div>
          <svg viewBox="0 0 240 130" aria-hidden="true"><rect width="240" height="130" fill="#eaf6ea"/><circle cx="205" cy="26" r="16" fill="#f6c945"/><path d="M190 36 150 60M196 42 160 76" stroke="#e8b730" stroke-width="2"/><path d="M60 120c0-40 10-70 40-90" stroke="#3f7d3a" stroke-width="4" fill="none"/><ellipse cx="110" cy="52" rx="40" ry="18" transform="rotate(-25 110 52)" fill="#5aa64f"/><ellipse cx="62" cy="78" rx="32" ry="14" transform="rotate(30 62 78)" fill="#6dbb5f"/><path d="M80 66 140 40" stroke="#3f7d3a" stroke-width="1.5"/><text x="150" y="100" font-size="11" fill="#2b5d28">CO₂ + H₂O</text><text x="20" y="20" font-size="11" fill="#2b5d28">O₂ ↑</text></svg>
          <div class="sub">Schema: Licht, Wasser und CO₂ werden im Blatt zu Zucker und Sauerstoff</div>
          <table><tr><th>Ort</th><td><a>Chloroplasten</a></td></tr><tr><th>Farbstoff</th><td><a>Chlorophyll</a> a und b</td></tr><tr><th>Ausgangsstoffe</th><td>Kohlenstoffdioxid, Wasser</td></tr><tr><th>Produkte</th><td><a>Glucose</a>, Sauerstoff</td></tr><tr><th>Energiequelle</th><td>Licht</td></tr></table>
        </div>
        <p>Die <b>Photosynthese</b> (von <a>altgriechisch</a> <i>phōs</i> „Licht“ und <i>sýnthesis</i> „Zusammensetzung“) ist ein <a>physiologischer</a> Prozess zur Erzeugung von energiereichen <a>Biomolekülen</a> aus energieärmeren Stoffen mithilfe von <a>Lichtenergie</a>. Sie wird von <a>Pflanzen</a>, <a>Algen</a> und einigen <a>Bakterien</a> betrieben.<sup><a>[1]</a></sup> Dabei werden <a>Kohlenstoffdioxid</a> und <a>Wasser</a> zu <a>Traubenzucker</a> (Glucose) umgewandelt; als Nebenprodukt entsteht <a>Sauerstoff</a>.</p>
        <p>Die Photosynthese gilt als einer der wichtigsten biochemischen Prozesse der Erde. Nahezu alle <a>Nahrungsketten</a> beginnen bei Lebewesen, die Photosynthese betreiben, und der Sauerstoff der <a>Erdatmosphäre</a> stammt zum größten Teil aus ihr.<sup><a>[2]</a></sup></p>
        <h2>Etymologie</h2>
        <p>Der Begriff wurde im 19. Jahrhundert aus den griechischen Wörtern für „Licht“ und „Zusammensetzung“ gebildet und setzte sich gegen ältere Bezeichnungen wie <i>Assimilation</i> durch, die heute noch in der Fachsprache verwendet wird.</p>
        <h2>Gesamtgleichung</h2>
        <p>Vereinfacht lässt sich die Photosynthese grüner Pflanzen in einer <a>Summengleichung</a> zusammenfassen:</p>
        <span class="zbt-v-formula">6 CO₂ + 12 H₂O &nbsp;→ &nbsp;C₆H₁₂O₆ + 6 O₂ + 6 H₂O</span>
        <p>Die Gleichung beschreibt nur Anfang und Ende. Tatsächlich laufen viele Einzelschritte ab, die sich in zwei Abschnitte gliedern lassen: die lichtabhängigen Reaktionen und die lichtunabhängigen Reaktionen.</p>
        <h2>Ablauf</h2>
        <h3>Lichtabhängige Reaktionen</h3>
        <p>In den <a>Thylakoidmembranen</a> der Chloroplasten nimmt das grüne Blattpigment <a>Chlorophyll</a> Licht auf. Die Energie wird genutzt, um Wasser zu spalten (<a>Photolyse</a>). Dabei entstehen Sauerstoff, Protonen und Elektronen. Über eine <a>Elektronentransportkette</a> werden die Energieträger <a>ATP</a> und <a>NADPH</a> gebildet.<sup><a>[3]</a></sup></p>
        <h3>Calvin-Zyklus</h3>
        <p>Im <a>Stroma</a> der Chloroplasten wird Kohlenstoffdioxid mithilfe des Enzyms <a>RuBisCO</a> an einen Zucker mit fünf Kohlenstoffatomen gebunden. Unter Verbrauch von ATP und NADPH entstehen in mehreren Schritten Zuckermoleküle, aus denen die Pflanze Glucose, <a>Stärke</a> und <a>Cellulose</a> aufbaut. Der Zyklus ist nach dem Chemiker <a>Melvin Calvin</a> benannt.</p>
        <h2>Einflussfaktoren</h2>
        <p>Die Geschwindigkeit der Photosynthese hängt vor allem von der <a>Lichtintensität</a>, der Kohlenstoffdioxid-Konzentration und der <a>Temperatur</a> ab. Der Faktor, der am knappsten ist, begrenzt die Rate (<a class="new">Prinzip des begrenzenden Faktors</a>). Bei zu hohen Temperaturen nimmt die Leistung wieder ab, weil <a>Enzyme</a> geschädigt werden.</p>
        <h2>Bedeutung</h2>
        <p>Neben der Bildung von Sauerstoff bindet die Photosynthese große Mengen Kohlenstoffdioxid und spielt damit eine zentrale Rolle im <a>Kohlenstoffkreislauf</a> und für das <a>Klima</a>. Auch <a>fossile Brennstoffe</a> wie Kohle und Erdöl gehen auf Biomasse zurück, die einst durch Photosynthese entstanden ist.</p>
        <h2>Siehe auch</h2>
        <ul><li><a>Chemosynthese</a></li><li><a>Zellatmung</a></li><li><a>C4-Pflanzen</a></li></ul>
        <h2>Einzelnachweise</h2>
        <ol class="zbt-v-refs"><li>Grundlagen der Pflanzenphysiologie. 8. Auflage, 2019, S. 112–118.</li><li>Lehrbuch der Botanik. 38. Auflage, 2021, S. 254.</li><li>Biochemie kompakt. 5. Auflage, 2018, Kapitel 15.</li></ol>
        <div class="zbt-v-cats"><a>Kategorien</a>: <a>Pflanzenphysiologie</a> | <a>Stoffwechsel</a> | <a>Biochemie</a></div>
      </div>
      <footer class="zbt-v-foot"><p>Diese Seite wurde zuletzt am 3. November 2026 um 14:12 Uhr bearbeitet.</p><p>Der Text ist unter der Lizenz „Creative-Commons Namensnennung – Weitergabe unter gleichen Bedingungen“ verfügbar; Informationen zu den Urhebern sind auf der Versionsseite abrufbar.</p><nav><a>Datenschutz</a><a>Über Lexikon</a><a>Impressum</a><a>Mobile Ansicht</a></nav></footer>
    </main>
  </div>
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

// Inhalt der Tarnseite tauschen (z. B. Suche → Ergebnisse → Lexikon-Artikel), ohne das Overlay neu aufzubauen.
function setOverlayContent(pageId, html, title) {
  ov.dataset.page = pageId;
  ov.innerHTML = html;
  ov.appendChild(backBtn);
  ov.scrollTop = 0;
  overlayTitle = title;
  applyTab();
}

function onOverlayClick(e) {
  const t = e.target.closest('[data-zbt], [data-zbt-open]');
  if (!t || !ov.contains(t)) return;
  const act = t.dataset.zbt;
  const form = t.closest('form');
  const q = form && form.q ? form.q.value.trim() : '';
  if (t.dataset.zbtOpen === 'lexikon') { e.preventDefault(); setOverlayContent('lexikon', pageLexikon(), PAGES[1].title); return; }
  if (act === 'home') { setOverlayContent('suche', searchHome(), 'Suche'); return; }
  if (act === 'lucky') { e.preventDefault(); if (q) runSearch(q); else setOverlayContent('lexikon', pageLexikon(), PAGES[1].title); return; }
  if (act === 'go') { if (q) runSearch(q); return; }
  if (act === 'clear') { form.q.value = ''; form.q.focus(); return; }
  if (act === 'qa') { t.parentElement.classList.toggle('open'); }
}

function runSearch(q) {
  setOverlayContent('suche', searchResults(q.slice(0, 200)), `${q.slice(0, 60)} – Suche`);
}

function buildOverlay(pageId) {
  injectCSS();
  ov = document.createElement('div');
  ov.className = 'zbt-ov';
  ov.id = 'zbTarnOverlay';
  ov.setAttribute('role', 'document');
  backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'zbt-back';
  backBtn.setAttribute('aria-label', 'Zurück (zweimal tippen)');
  backBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const now = Date.now();
    if (now - lastBackTap < DOUBLE_MS) { lastBackTap = 0; hide(); } else lastBackTap = now;
  });
  const p = PAGES.find((x) => x.id === pageId) || PAGES[0];
  setOverlayContent(pageId, RENDER[pageId](), p.title);
  // Bedienung der Tarnseiten (nur Attrappen, nichts verlässt die Seite)
  ov.addEventListener('click', onOverlayClick);
  ov.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.dataset.zbt === 'search') { const q = f.q.value.trim(); if (q) runSearch(q); }
  });
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
  ov = null; backBtn = null; previewBar = null; overlayTitle = null;
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
  const render = () => {
    const touch = isTouch();
    const cur = PAGES.find((p) => p.id === S.page) || PAGES[0];
    const tabIcon = (t) => (t.id === 'passend' ? cur.icon : t.icon);
    root.innerHTML = `
      <div class="zx-set-row">
        <div class="zx-set-txt"><b>Tarnmodus</b><span>Tarnseite, passender Tab und Panik-Taste – für Startseite und alle Spiele.</span></div>
        <button type="button" class="zx-switch" role="switch" id="zbTarnOn" aria-checked="${S.on}" aria-label="Tarnmodus"><i></i></button>
      </div>
      <div class="zx-tarn-opts${S.on ? '' : ' hidden'}" id="zbTarnOpts">
        <div class="zx-set-block">
          <span class="zx-set-label">Tarnseite <small>(erscheint bei der Panik-Taste)</small></span>
          <div class="zx-chips" role="radiogroup" aria-label="Tarnseite">
            ${PAGES.map((p) => `<button type="button" class="zx-chip" role="radio" data-page="${p.id}" aria-checked="${S.page === p.id}"><img src="${p.icon}" alt="" width="16" height="16">${esc(p.label)}</button>`).join('')}
            <button type="button" class="zx-chip zx-chip-dash" id="zbTarnPreview">Vorschau</button>
          </div>
        </div>
        <div class="zx-set-block">
          <span class="zx-set-label">Tab-Tarnung <small>(Titel &amp; Symbol im Browser-Tab – passt automatisch zur Tarnseite)</small></span>
          <div class="zx-chips" role="radiogroup" aria-label="Tab-Tarnung">
            ${TAB_TEMPLATES.map((t) => `<button type="button" class="zx-chip" role="radio" data-tab="${t.id}" aria-checked="${S.tab === t.id}">${tabIcon(t) ? `<img src="${tabIcon(t)}" alt="" width="16" height="16">` : ''}${esc(t.id === 'passend' ? `Passend: „${cur.tab}“` : t.label)}</button>`).join('')}
          </div>
        </div>
        <div class="zx-set-block">
          <span class="zx-set-label">Panik-Taste</span>
          <div class="zx-set-key">
            <kbd id="zbTarnKey">${esc(keyLabel(S.key))}</kbd><span>2× schnell drücken</span>
            <button type="button" class="zx-chip" id="zbTarnKeyBtn">Ändern</button>
          </div>
        </div>
        <div class="zx-set-row zx-set-row-sm">
          <div class="zx-set-txt"><b>Panik-Knopf auf Touch</b><span>Kleiner Knopf unten links${touch ? '' : ' (nur auf Handy/Tablet sichtbar)'}.</span></div>
          <button type="button" class="zx-switch" role="switch" id="zbTarnFabSw" aria-checked="${S.fab}" aria-label="Panik-Knopf auf Touch-Geräten"><i></i></button>
        </div>
        <p class="zx-set-note">Zurück zum Spiel: dieselbe Taste 2× drücken oder die Ecke oben links 2× antippen. Das Spiel läuft im Hintergrund weiter.</p>
      </div>`;

    root.querySelector('#zbTarnOn').onclick = () => setSetting('on', !S.on);
    root.querySelector('#zbTarnFabSw').onclick = () => setSetting('fab', !S.fab);
    root.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => setSetting('tab', b.dataset.tab); });
    // Neue Tarnseite → Tab-Tarnung springt auf „passend“ (kann danach wieder geändert werden)
    root.querySelectorAll('[data-page]').forEach((b) => { b.onclick = () => { set(KEYS.tab, 'passend'); setSetting('page', b.dataset.page); }; });
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
