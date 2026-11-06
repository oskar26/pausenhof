# Kritzel-Duell ✏️

Einer zeichnet, alle raten – das Mal- und Ratespiel der Zockbox. Läuft komplett im Browser (GitHub Pages, kein eigener Server). made by Oskar

## Designidee: „Duell auf dem Collegeblock“
Alles sieht aus wie ein Schulblock, auf dem in der Pause gekritzelt wird – und dazu Boxkampf-Anmutung:
- Hintergrund: Karopapier mit Kugelschreiber-Kritzeleien (Sterne, Blitze, Boxhandschuh, Würfel …) – `img/doodles.svg`.
- Flächen: Papierzettel mit dicken Filzstift-Konturen, harter Versatz-Schatten, Klebeband-Streifen.
- Chat: liniertes Heftpapier mit rotem Rand; „erraten“ ist grün mit Textmarker markiert, „nah dran“ gelb.
- Spielerliste: wer erraten hat, bekommt einen grünen Textmarker-Strich.
- Overlays: gelber Klebezettel über der schraffierten Zeichenfläche; Runde = „Ding ding!“ mit Ringglocke (Sound), Sieger bekommt Krone + Champion-Gürtel auf dem Podest.
- Schriften: Permanent Marker (Überschriften, Logo) und Patrick Hand (Text), selbst gehostet in `fonts/` (Lizenzen liegen bei).
- Eigene Avatare: Kritzel-Figuren aus Farbe × Augen × Mund × Extra (14 × 13 × 13 × 13), mit Pfeilen durchschaltbar (`avatars.js`). Wer will, nimmt stattdessen das Zockbox-Emoji aus `shared/profile.js` (Fallback).
- „Lichter aus“ (Zahnrad): Tafel-Modus mit Kreide-Optik.
- Alles selbst gemacht – kein Code, Logo oder Grafik vom Original.

## Dateien
- `index.html` – Startseite, Einladung, Raum (Lobby + Spiel), eigene SVG-Symbole
- `game.js` – Host-Logik (Spielablauf, Punkte, Chat-Raten), Client-Anzeige, Zeichenwerkzeug, Avatar-Baukasten
- `game.css` – komplettes eigenes Design (mobil zuerst, unabhängig von `shared/zockbox.css`)
- `avatars.js` – SVG-Kritzel-Figuren
- `words.js` – eigene deutsche Wortliste (über 1000 Wörter, jugendfrei, keine Dubletten)
- `sound.js` – Soundeffekte, live per WebAudio erzeugt (keine Audiodateien), inkl. Ringglocke
- `fonts/`, `img/` – Schriften (OFL/Apache) und Hintergrund-Kritzeleien

## Layout
- Handy (hochkant): oben Leiste mit Stoppuhr, Runde und Wort-Strichen, darunter die Zeichenfläche, Werkzeuge (nur beim Zeichnen), dann Spieler | Chat nebeneinander und die Eingabe unten.
- Tippt man in den Chat (Bildschirmtastatur offen), schrumpft das Layout auf den sichtbaren Bereich: Zeichenfläche bleibt oben sichtbar, Chat + Eingabe rücken direkt darunter.
- Desktop/Querformat: Spieler | Zeichenfläche (+ Werkzeugleiste darunter) | Chat.

## Technik
- Multiplayer über `../../shared/net.js` (PeerJS/WebRTC). `GAME_ID = 'kritzel-duell-v1'` → Peer-IDs `zockbox-kritzel-duell-v1-p-CODE` (privat) bzw. `…-pub-N` (öffentlich).
- Der Browser, der den Raum erstellt, ist Host und rechnet alles. Jeder Spieler bekommt seinen eigenen Zustand (das Wort sieht nur, wer zeichnet oder es schon erraten hat).
- Einladungslinks: `?code=ABCD`, `?join=ABCD` oder `?pub=3`.
- Profil: Name aus `ph_name` (gemeinsam mit der Zockbox), Emoji aus `ph_avatar`, eigene Figur lokal in `kd_fig` (`kd_emoji = 1` → Emoji statt Figur).
- Zeichenfläche 800×600 mit eigenem Pixel-Rasterizer: alle Geräte zeichnen exakt gleich, darum ist auch der Fülleimer überall identisch. Striche werden alle 50 ms gebündelt verschickt; wer später dazukommt, bekommt die bisherige Zeichnung nachgeliefert.

## Features
Lobby mit Spieler (2–30), Sprache, Zeit (15–240 s), Runden (2–10), Wort-Modus (Normal/Versteckt/Kombination), Wort-Anzahl (1–5), Hinweise (0–5), eigene Wörter + „Nur eigene Wörter benutzen“ · Einladen-Knopf (Teilen/Kopieren) + Einladungslink · Schnelles Spiel (öffentlich, Autostart) · offene Lobbys · Wortwahl mit Timer · Striche mit Buchstabenzahl · Hinweis-Buchstaben · „nah dran“ · Punkte nach Tempo + Zeichnerpunkte · Auflösung nach jedem Zug · Podium · Stift, Radierer, Fülleimer, Pipette, 5 Größen, 26 Farben (Links-/Rechtsklick), Rückgängig, Löschen, Tastenkürzel · Daumen hoch/runter · Votekick, Kicken, Bannen, Stummschalten · Beitritt mitten im Spiel · Zeichner geht → nächster Zug · Chat-Filter · Chat-Blasen · Tafel-Modus.

## Lokal testen
```
cd pausenhof && python3 -m http.server 8000
# http://localhost:8000/games/kritzel-duell/ in zwei Fenstern öffnen
```
