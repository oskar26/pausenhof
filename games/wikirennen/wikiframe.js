// Wikirennen – Artikelrahmen im Wikipedia-Look (Shadow-DOM, damit das echte Wikipedia-CSS
// und das Spiel-CSS sich nicht in die Quere kommen). made by Oskar
import { loadWikiCss } from './wiki.js';

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
        <div class="wwt-container">
          <nav class="wwt-toc"><div class="wwt-toc-h">Inhalt</div><ul class="wwt-toc-list"></ul></nav>
          <main class="mw-body wwt-main">
            <div class="wwt-titlebar"><h1 class="firstHeading mw-first-heading"><span class="mw-page-title-main">Wikirennen</span></h1><span class="wwt-langbtn"><svg viewBox="0 0 20 20" aria-hidden="true" style="width:18px;height:18px;vertical-align:-4px"><path fill="currentColor" d="M20 18h-1.4l-1-3h-4.2l-1 3H11l3.8-10h1.4zm-6.2-4.3h3.3L15.4 9zM8 4V2H6v2H1v2h8.3A10 10 0 0 1 6.9 10 9 9 0 0 1 5.5 8H3.4a11 11 0 0 0 2 3.3L2 14.6l1.4 1.4 3.4-3.4 2 2 .8-1.9-1.4-1.4A12 12 0 0 0 11.3 6H13V4z"/></svg> <span class="wwt-langname"></span></span></div>
            <div class="wwt-tabs"><span class="sel">Artikel</span><span>Diskussion</span><span class="gap"></span><span class="sel">Lesen</span><span>Bearbeiten</span><span class="hide-s">Versionsgeschichte</span></div>
            <div class="vector-body mw-body-content" id="bodyContent">
              <div class="wwt-tagline">Aus Wikipedia, der freien Enzyklopädie</div>
              <div class="wwt-redirect"></div>
              <div class="wwt-content"></div>
            </div>
            <div class="wwt-footer">Artikeltext und Bilder: Wikipedia und Wikimedia Commons, Lizenz CC BY-SA 4.0 bzw. laut Dateibeschreibung. Wikirennen ist ein Spiel in der Zockbox und nicht mit der Wikimedia Foundation verbunden.</div>
          </main>
        </div>
        <div class="wwt-loading hidden"><div class="wwt-bar"></div><div class="wwt-loadtxt">Lädt …</div></div>
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
    this.$('.wwt-tagline').textContent = lang === 'en' ? 'From Wikipedia, the free encyclopedia' : 'Aus Wikipedia, der freien Enzyklopädie';
    const css = await loadWikiCss(lang);
    if (this.lang === lang) this.$('#wikiCss').textContent = css;
  }

  setLoading(on, text = 'Lädt …') {
    this.$('.wwt-loading').classList.toggle('hidden', !on);
    this.$('.wwt-loadtxt').textContent = text;
  }

  setLocked(on) { this.$('.wwt-body').classList.toggle('wwt-locked', !!on); }

  show(article, { anchor, lang } = {}) {
    const content = this.$('.wwt-content');
    this.$('.mw-page-title-main').textContent = article.display || article.title;
    this.$('.wwt-redirect').textContent = article.redirectedFrom ? `(Weitergeleitet von ${article.redirectedFrom})` : '';
    content.setAttribute('lang', lang || this.lang || 'de');
    this.$('.wwt-langname').textContent = (lang || this.lang) === 'en' ? 'English' : 'Deutsch';
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
