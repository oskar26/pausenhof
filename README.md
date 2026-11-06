# 🎮 Zockbox

**Gratis Browser-Spiele zum Zocken mit Freunden – direkt im Browser.**
Kein Konto, kein Download, keine Werbung. Lobby erstellen, 4-Buchstaben-Code an die Freunde schicken, losspielen. Läuft auf Handy, iPad und Laptop.

*made by Oskar*

👉 **https://oskar26.github.io/zockbox/**

---

## 🕹️ Spiele

| Spiel | Worum geht's? | Spieler | Status |
|---|---|---|---|
| 😂 **Mach's Meme** (`games/machs-meme/`) | Meme-Partyspiel: Alle bekommen dieselbe Meme-Vorlage, schreiben die witzigste Caption, dann wird abgestimmt. | 2–30 | live |
| 🏁 **Wikirennen** (`games/wikirennen/`) | Wikipedia-Rennen: Vom Startartikel zum Zielartikel – nur über Links im Text. Wer ist zuerst da? | 2–30 | live |
| ✏️ **Kritzel-Duell** (`games/kritzel-duell/`) | Zeichnen und Raten: Einer zeichnet, alle raten. | 2–30 | live |
| ✉️ **Krakelpost** (`games/krakelpost/`) | Stille Post mit Zeichnen: Satz wird Bild, Bild wird Satz. | 2–30 | live |
| 🕵️ Wer lügt? | Alle kennen das Wort – nur einer nicht. Findet den Bluffer. | – | bald |

## ✨ Was die Zockbox kann

- **Ein Profil für alle Spiele:** Name und Emoji-Avatar stellst du auf der Startseite unter „Dein Profil“ ein. Gespeichert wird nur in deinem Browser (`localStorage`: `ph_name`, `ph_avatar`).
- **Mit Code beitreten:** Code auf der Startseite eintippen – die Zockbox sucht automatisch, in welchem Spiel die Lobby offen ist, und leitet dich hin (`games/<spiel>/?code=ABCD`). Klappt die Suche nicht, einfach das Spiel antippen.
- **Einladungs-Link:** `https://oskar26.github.io/zockbox/?join=ABCD` füllt den Code auf der Startseite schon aus.
- **Look „Die Kiste“:** Die Startseite sieht aus wie ein Umzugskarton – Kraftpapier, Paketband, Stempel und Aufkleber. Jedes Spiel ist eine bunte Schachtel mit schwarzer Kontur und hartem Schatten, der Code wird auf einem „Frachtzettel“ in vier Buchstaben-Kacheln eingetippt, das Profil ist ein „Hallo, ich bin“-Namensschild.
- **Flüster-Intro:** Beim Öffnen der Startseite geht kurz die Kiste auf und ein „psst…“ kommt heraus (ca. 2 s, einmal pro Tab). Antippen oder eine Taste überspringt es. Aus bei „Einstellungen → Intro beim Öffnen“ (`zb_intro = off`), bei *reduzierter Bewegung* im System und bei Einladungslinks (`?join=`).
- **Tarnmodus (standardmäßig aus):** Unter *Dein Profil → Einstellungen* einschaltbar, gilt für die Startseite und alle Spiele, die `shared/tarnung.js` einbinden. Reine Oberflächen-Tarnung:
  - *Panik-Taste:* Esc 2× schnell (Taste frei wählbar) oder der kleine Knopf unten links auf Handy/Tablet blendet eine Tarnseite ein: **Suche** (Ergebnisseite zu „photosynthese“ im Stil einer bekannten Suchmaschine – eigene Suche, Startseite per Klick aufs Logo, Treffer öffnen den Lexikon-Artikel), **Lexikon-Artikel** (Photosynthese, Artikel-Layout im Stil einer freien Online-Enzyklopädie) oder **Dokument** (Bio-Notizen). Das Spiel läuft darunter weiter, die Verbindung bleibt. Zurück: dieselbe Taste 2× oder oben links 2× tippen.
  - *Tab-Tarnung:* Standard ist **„Passend zur Tarnseite“** – Tab-Titel und Symbol passen automatisch zur gewählten Tarnseite (z. B. „Suche“ mit Lupen-Symbol). Wer eine andere Tarnseite wählt, bekommt wieder den passenden Tab. Danach lässt sich der Tab weiter von Hand ändern: „Original“, „Notizen“, „Dokument – Unbenannt“, „Suche“, „Lexikon“ oder „Taschenrechner“ (eigene, selbst gezeichnete Symbole).
  - *Wichtig:* Die Tarnseiten benutzen bewusst **keine echten Logos und keine echten Markennamen** (nur „Suche“ und „Lexikon – Die freie Enzyklopädie“) und keine nachgebauten Schriftzüge – sonst könnte Google Safe Browsing die Seite als Phishing markieren. Bitte beim Ändern so lassen.
  - Gespeichert in `localStorage`: `zb_tarn_on`, `zb_tarn_tab`, `zb_tarn_page`, `zb_tarn_key`, `zb_tarn_fab`.
  - Einbinden in ein Spiel (eine Zeile, z. B. vor `</body>` in `games/<spiel>/index.html`):
    `<script type="module" src="../../shared/tarnung.js"></script>`
    Optional im Spiel: `window.addEventListener('zb-tarnung', e => …e.detail.active…)`, z. B. um Sounds stummzuschalten.
- **Wie eine App:** Auf iPhone/iPad in Safari *Teilen → Zum Home-Bildschirm*. Dann hat die Zockbox ein eigenes Icon und startet im Vollbild.

## 🔌 Wie funktioniert die Verbindung?

Die Zockbox hat **keinen eigenen Server**. Es sind nur statische Dateien (HTML, CSS, JavaScript).

1. **Der Host-Browser ist der Spielserver.** Wer eine Lobby erstellt, dessen Browser verwaltet das Spiel: Spieler, Runden, Punkte.
2. **PeerJS macht nur das „Hallo“.** Damit sich zwei Browser im Internet finden, benutzen wir den kostenlosen öffentlichen Vermittlungsserver von [PeerJS](https://peerjs.com/) (Signaling). Der Lobby-Code steckt in der Peer-ID, z. B. `zockbox-machs-meme-v1-p-ABCD`. (Das Präfix `zockbox-` und die Spiel-IDs bleiben aus technischen Gründen so – sie sieht niemand.)
3. **Danach geht alles direkt per WebRTC.** Sobald die Verbindung steht, laufen alle Spieldaten direkt zwischen den Geräten – nicht über einen Zockbox-Server.

Die gemeinsame Netzwerk-Logik für alle Spiele steckt in `shared/net.js` (Klasse `Room`).

> Hinweis: Manche Netzwerke blockieren WebRTC oder peerjs.com. Dann hilft es oft, mobile Daten zu benutzen.
> Wenn der Host den Tab schließt, ist die Lobby weg.

## 📁 Aufbau

```
index.html             Startseite (Spielebibliothek): Spiele, Profil, Mit Code beitreten
404.html               Fehlerseite („Level nicht gefunden“)
manifest.webmanifest   App-Infos für „Zum Home-Bildschirm“
assets/                App-Icons (PNG) und assets/fonts/ (Permanent Marker für die Startseite)
shared/zockbox.css     Teil A: Basis für Spiele (Reset, Schriften, alte zb-*-Bausteine) · Teil B: Startseite „Kiste“ (body.zx, zx-*-Klassen)
shared/fonts/          Schriften (lokal, SIL Open Font License)
shared/hub.js          Logik der Startseite (Intro, Profil, Einstellungen, Code-Suche, Install-Tipp)
shared/tarnung.js      Tarnmodus (Tab-Tarnung + Panik-Taste), für Startseite und Spiele
shared/profile.js      gemeinsames Spielerprofil (ph_name, ph_avatar)
shared/net.js          Netzwerk-Kern (PeerJS + WebRTC)
shared/vendor/         PeerJS (lokale Kopie)
games/<spiel>/         ein Ordner pro Spiel
.nojekyll              damit GitHub Pages alle Dateien unverändert ausliefert
```

**Neues Spiel hinzufügen:** Ordner unter `games/` anlegen, auf der Startseite (`index.html`) eine Karte einbauen und in `shared/hub.js` im Array `GAMES` eintragen (Name, Pfad und Peer-ID-Präfix), damit „Mit Code beitreten“ es findet.

## 🚀 Online stellen (GitHub Pages) – Schritt für Schritt

Repo: **https://github.com/oskar26/zockbox** – GitHub Pages ist dort schon eingeschaltet (Branch `main`, Ordner `/ (root)`).

1. **Pull Request mergen:** Im Repo oben auf **Pull requests** → den offenen PR öffnen → **Merge pull request** → **Confirm merge**.
2. **1–2 Minuten warten.** GitHub baut die Seite automatisch neu (unter **Actions** siehst du den Fortschritt).
3. **Öffnen:** **https://oskar26.github.io/zockbox/** – falls noch die alte Version kommt, Seite neu laden (am iPhone: Tab schließen und neu öffnen).
4. **Testen:** Auf zwei Geräten öffnen, auf dem einen eine Lobby erstellen, auf dem anderen den Code eingeben.
5. **Klappt keine Verbindung?** Dann blockiert das Netz vermutlich WebRTC oder peerjs.com. Mit mobilen Daten probieren.
6. **Neue Version hochladen:** Änderungen einfach auf `main` pushen (oder per PR mergen) – Pages aktualisiert sich nach ca. 1–2 Minuten von selbst.

Falls Pages doch einmal aus ist: **Settings** → links **Pages** → *Build and deployment*: Source **Deploy from a branch**, Branch **main**, Ordner **/ (root)** → **Save**.

Lokal testen geht auch:

```bash
python3 -m http.server 8000
# dann http://localhost:8000 im Browser öffnen
```

(Einfach die `index.html` doppelklicken reicht nicht, weil JavaScript-Module einen Webserver brauchen.)

## 🙏 Credits

- [PeerJS](https://github.com/peers/peerjs) – MIT-Lizenz, inklusive des kostenlosen PeerJS-Cloud-Servers fürs Signaling
- Meme-Vorlagen über die [imgflip](https://imgflip.com/)-API und [memegen.link](https://memegen.link/)
- Artikel aus der [Wikipedia](https://de.wikipedia.org/) – Texte unter [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.de)
- Schriften: Anton, Inter und Unbounded (Startseite bzw. Spiel-Basis, SIL Open Font License, `shared/fonts/`), Permanent Marker (Startseite, Apache License 2.0, `assets/fonts/`) sowie die Schriften in den Spiel-Ordnern – alles lokal, nichts von fremden Servern
- Emojis: die Emoji-Schrift deines Geräts
- Icons und Spiel-Cover: selbst gemacht (CSS/SVG)
