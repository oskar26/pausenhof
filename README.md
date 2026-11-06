# 🔔 Pausenhof

**Kostenlose Multiplayer-Spiele für die große Pause – direkt im Browser.**
Kein Konto, kein Download, keine Werbung. Lobby erstellen, 4-Buchstaben-Code an die Freunde schicken, losspielen. Läuft auf Handy, iPad und Laptop.

*made by Oskar*

---

## 🎮 Spiele

| Spiel | Worum geht's? | Spieler |
|---|---|---|
| 🏅 **Memelympics** (`games/memelympics/`) | Meme-Partyspiel: Alle bekommen eine Meme-Vorlage, schreiben die witzigste Caption, dann wird abgestimmt. Wer holt Gold? | 2–30 |
| 🧭 **Wiki-Wandertag** (`games/wiki-wandertag/`) | Wikipedia-Rennen: Vom Startartikel zum Zielartikel – nur über Links im Text. Wer ist zuerst da? | 2–30 |
| ✏️ Kritzelkönig | *bald* | – |
| 🕵️ Wer lügt? | *bald* | – |

## ✨ Was der Pausenhof kann

- **Ein Profil für alle Spiele:** Name und Emoji-Avatar stellst du auf der Startseite ein („Schülerausweis“). Gespeichert wird nur in deinem Browser (`localStorage`: `ph_name`, `ph_avatar`).
- **Mit Code beitreten:** Code auf der Startseite eintippen – der Pausenhof sucht automatisch, in welchem Spiel die Lobby offen ist, und leitet dich hin (`games/<spiel>/?code=ABCD`).
- **Wie eine App:** Auf iPhone/iPad in Safari *Teilen → Zum Home-Bildschirm*. Dann hat Pausenhof ein eigenes Icon.

## 🔌 Wie funktioniert die Verbindung?

Pausenhof hat **keinen eigenen Server**. Es sind nur statische Dateien (HTML, CSS, JavaScript).

1. **Der Host-Browser ist der Spielserver.** Wer eine Lobby erstellt, dessen Browser verwaltet das Spiel: Spieler, Runden, Punkte.
2. **PeerJS macht nur das „Hallo“.** Damit sich zwei Browser im Internet finden, benutzen wir den kostenlosen öffentlichen Vermittlungsserver von [PeerJS](https://peerjs.com/) (Signaling). Der Lobby-Code steckt in der Peer-ID, z. B. `pausenhof-memelympics-v1-p-ABCD`.
3. **Danach geht alles direkt per WebRTC.** Sobald die Verbindung steht, laufen alle Spieldaten direkt zwischen den Geräten – nicht über einen Pausenhof-Server.

Die gemeinsame Netzwerk-Logik für alle Spiele steckt in `shared/net.js` (Klasse `Room`).

> Hinweis: In manchen Schul-WLANs ist WebRTC blockiert. Dann hilft es oft, mobile Daten zu benutzen.
> Wenn der Host den Tab schließt, ist die Lobby weg.

## 📁 Aufbau

```
index.html             Startseite (Hub): Spiele, Profil, Mit Code beitreten
404.html               Fehlerseite im Pausenhof-Look
manifest.webmanifest   App-Infos für „Zum Home-Bildschirm“
assets/                App-Icons (PNG)
shared/pausenhof.css   gemeinsames Design (Tafel + Klebezettel)
shared/net.js          Netzwerk-Kern (PeerJS + WebRTC)
shared/profile.js      gemeinsames Spielerprofil (ph_name, ph_avatar)
shared/hub.js          Logik der Startseite
games/<spiel>/         ein Ordner pro Spiel
.nojekyll              damit GitHub Pages alle Dateien unverändert ausliefert
```

## 🚀 Online stellen (GitHub Pages) – Schritt für Schritt

Repo: `https://github.com/oskar26/pausenhof`

1. **Pull Request mergen:** Im Repo oben auf **Pull requests** → „Pausenhof: Hub, Memelympics, Wiki-Wandertag“ öffnen → **Merge pull request** → **Confirm merge**.
2. **Pages einschalten:** **Settings** → links **Pages** → bei *Build and deployment* Source **Deploy from a branch**, Branch **main**, Ordner **/ (root)** → **Save**.
3. **1–2 Minuten warten**, dann ist alles online unter **https://oskar26.github.io/pausenhof/**
4. **Testen:** Auf zwei Geräten öffnen (am besten eins im WLAN, eins mit mobilen Daten), auf dem einen Lobby erstellen, auf dem anderen den Code eingeben.
5. **Neue Version hochladen:** Änderungen einfach auf `main` pushen (oder per PR mergen) – Pages aktualisiert sich nach ca. 1 Minute von selbst.

Klappt die Verbindung nicht? Dann blockiert das Netz vermutlich WebRTC oder peerjs.com. Mit mobilen Daten probieren.

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
- Schriften: Permanent Marker, Nunito und Anton (SIL Open Font License), lokal in `shared/fonts/`
- Emojis: die Emoji-Schrift deines Geräts

---

**made by Oskar** ✌️
