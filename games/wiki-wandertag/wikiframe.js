// Wiki-Wandertag – Artikelrahmen im Wikipedia-Look (Shadow-DOM, damit Wikipedia-CSS
// und Pausenhof-CSS sich nicht in die Quere kommen). made by Oskar
import { loadWikiCss } from './wiki.js';

const LOGO = `<svg class="wwt-logo-svg" viewBox="0 0 64 64" aria-hidden="true">
  <defs><radialGradient id="g" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#d9dbde"/><stop offset="1" stop-color="#8f9399"/></radialGradient></defs>
  <circle cx="32" cy="32" r="29" fill="url(#g)" stroke="#6b6f75" stroke-width="1.2"/>
  <g fill="none" stroke="#7d8187" stroke-width="1" opacity=".7">
    <ellipse cx="32" cy="32" rx="12" ry="29"/><ellipse cx="32" cy="32" rx="22" ry="29"/>
    <path d="M4 24h56M3 32h58M4 40h56M8 16h48M8 48h48"/>
  </g>
  <g font-family="Georgia,serif" font-weight="bold" fill="#3b3e42">
    <text x="15" y="27" font-size="10">W</text><text x="34" y="21" font-size="8">Ω</text>
    <text x="40" y="41" font-size="9">文</text><text x="18" y="47" font-size="8">Ж</text>
  </g>
  <path d="M10 50 C 20 40, 26 52, 32 38 S 46 26, 50 14" fill="none" stroke="#c0392b" stroke-width="2.2" stroke-dasharray="3 2.4" stroke-linecap="round"/>
  <path d="M50 14 v-9 l7 3 -7 3" fill="#c0392b" stroke="#7a1f16" stroke-width=".8"/>
</svg>`;

export class WikiFrame {
  constructor(hostEl, { onNavigate, onBlocked } = {}) {
    this.host = hostEl;
    this.onNavigate = onNavigate || (() => {});
    this.onBlocked = onBlocked || (() => {});
    this.lang = null;
    this.root = hostEl.attachShadow({ mode: 'open' });
    const frameCss = new URL('wiki-frame.css', import.meta.url).href;
    this.root.innerHTML = `
      <style id="wikiCss"></style>
      <link rel="stylesheet" href="${frameCss}">
      <div class="wwt-html vector-feature-custom-font-size-clientpref-1 skin-theme-clientpref-day">
      <div class="wwt-body skin--responsive skin-vector ltr">
        <header class="wwt-header">
          <span class="wwt-burger" aria-hidden="true">☰</span>
          <div class="wwt-logo">${LOGO}<div class="wwt-wordmark"><b>Wiki-Wandertag</b><small>Die freie Wanderkarte</small></div></div>
          <div class="wwt-search" title="Suchen ist beim Wandertag verboten 😉"><span>🔍</span> <span class="ph">Suche ist heute gesperrt…</span></div>
        </header>
        <div class="wwt-container">
          <nav class="wwt-toc"><div class="wwt-toc-h">Inhalt</div><ul class="wwt-toc-list"></ul></nav>
          <main class="mw-body wwt-main">
            <div class="wwt-titlebar"><h1 class="firstHeading mw-first-heading"><span class="mw-page-title-main">Wiki-Wandertag</span></h1><span class="wwt-langbtn">文A <span class="wwt-langname"></span></span></div>
            <div class="wwt-tabs"><span class="sel">Artikel</span><span>Diskussion</span><span class="gap"></span><span class="sel">Lesen</span><span>Bearbeiten</span><span class="hide-s">Versionsgeschichte</span></div>
            <div class="vector-body mw-body-content" id="bodyContent">
              <div class="wwt-tagline">Aus Wiki-Wandertag, der freien Wanderkarte durch Wikipedia</div>
              <div class="wwt-redirect"></div>
              <div class="wwt-content"></div>
            </div>
            <div class="wwt-footer">Artikeltext und Bilder: Wikipedia und Wikimedia Commons, Lizenz CC BY-SA 4.0 bzw. laut Dateibeschreibung. Wiki-Wandertag ist ein Pausenhof-Spiel und nicht mit der Wikimedia Foundation verbunden.</div>
          </main>
        </div>
        <div class="wwt-loading hidden"><div class="wwt-bar"></div><div class="wwt-loadtxt">Wandere…</div></div>
      </div></div>`;
    this.$ = (sel) => this.root.querySelector(sel);
    this.$('.wwt-body').addEventListener('click', (e) => this._click(e));
    this.$('.wwt-body').addEventListener('auxclick', (e) => { if (e.target.closest('a')) e.preventDefault(); });
    this.$('.wwt-body').addEventListener('contextmenu', (e) => { if (e.target.closest('a')) e.preventDefault(); });
    this.$('.wwt-toc-list').addEventListener('click', (e) => {
      const li = e.target.closest('[data-anchor]');
      if (li) { e.preventDefault(); this.scrollToAnchor(li.dataset.anchor); }
    });
  }

  async setLang(lang) {
    if (this.lang === lang) return;
    this.lang = lang;
    this.$('.wwt-langname').textContent = lang === 'en' ? 'English' : 'Deutsch';
    const css = await loadWikiCss(lang);
    if (this.lang === lang) this.$('#wikiCss').textContent = css;
  }

  setLoading(on, text = 'Wandere…') {
    this.$('.wwt-loading').classList.toggle('hidden', !on);
    this.$('.wwt-loadtxt').textContent = text;
  }

  setLocked(on) { this.$('.wwt-body').classList.toggle('wwt-locked', !!on); }

  show(article, { anchor, lang } = {}) {
    const content = this.$('.wwt-content');
    this.$('.mw-page-title-main').textContent = article.display || article.title;
    this.$('.wwt-redirect').textContent = article.redirectedFrom ? `(Weitergeleitet von ${article.redirectedFrom})` : '';
    content.setAttribute('lang', lang || this.lang || 'de');
    content.innerHTML = article.html;
    this._wrapTables(content);
    this._buildToc(content);
    if (anchor) requestAnimationFrame(() => this.scrollToAnchor(anchor));
  }

  showMessage(title, html) {
    this.$('.mw-page-title-main').textContent = title;
    this.$('.wwt-redirect').textContent = '';
    this.$('.wwt-content').innerHTML = html;
    this.$('.wwt-toc-list').innerHTML = '';
  }

  _wrapTables(content) {
    // Tabellen horizontal scrollbar machen (iPhone!), Floats der Tabelle übernehmen
    const tables = Array.from(content.querySelectorAll('table')).filter((t) => !t.parentElement.closest('table'));
    for (const t of tables) {
      const cs = getComputedStyle(t);
      const w = document.createElement('div');
      w.className = 'wwt-tw';
      if (cs.float && cs.float !== 'none') {
        w.classList.add('wwt-tw-float');
        w.style.cssFloat = cs.float;
        w.style.clear = cs.clear;
        w.style.marginLeft = cs.float === 'right' ? '1em' : '0';
        w.style.marginRight = cs.float === 'left' ? '1em' : '0';
        t.style.cssFloat = 'none';
        t.style.marginLeft = '0'; t.style.marginRight = '0';
      }
      t.parentNode.insertBefore(w, t);
      w.appendChild(t);
    }
  }

  _buildToc(content) {
    const hs = Array.from(content.querySelectorAll('h2[id], h3[id]')).slice(0, 60);
    this.$('.wwt-toc-list').innerHTML = hs.map((h) =>
      `<li class="l${h.tagName === 'H3' ? 3 : 2}" data-anchor="${encodeURIComponent(h.id)}">${escapeHtml(h.textContent)}</li>`).join('');
    this.$('.wwt-toc').classList.toggle('empty', !hs.length);
  }

  scrollToAnchor(anchor) {
    let id = anchor;
    try { id = decodeURIComponent(anchor); } catch (e) {}
    const el = this.root.getElementById(id) || this.root.getElementById(id.replace(/ /g, '_'));
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - (this.topOffset ? this.topOffset() : 80);
      window.scrollTo({ top: y, behavior: 'smooth' });
      el.classList.add('wwt-flash');
      setTimeout(() => el.classList.remove('wwt-flash'), 1600);
    }
  }

  _click(e) {
    const a = e.target.closest('a');
    if (!a) return;
    e.preventDefault();
    const kind = a.dataset.wwt;
    if (kind === 'anchor') { this.scrollToAnchor(a.dataset.anchor); return; }
    if (kind === 'article') { this.onNavigate(a.dataset.title, a.dataset.anchor || null, a); return; }
    this.onBlocked(kind || 'external', a);
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
