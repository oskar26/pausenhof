# Kritzel-Duell ✏️

Einer zeichnet, alle raten – das Mal- und Ratespiel der Zockbox. Läuft komplett im Browser (GitHub Pages, kein eigener Server). made by Oskar

## Dateien
- `index.html` – Startseite, Einladung, Raum (Lobby + Spiel)
- `game.js` – Host-Logik (Spielablauf, Punkte, Chat-Raten), Client-Anzeige, Zeichenwerkzeug
- `game.css` – eigenes Design auf Basis von `../../shared/zockbox.css` (mobil zuerst)
- `words.js` – eigene deutsche Wortliste (über 1000 Wörter, jugendfrei, keine Dubletten)
- `sound.js` – Soundeffekte, live per WebAudio erzeugt (keine Audiodateien)

## Technik
- Multiplayer über `../../shared/net.js` (PeerJS/WebRTC). `GAME_ID = 'kritzel-duell-v1'` → Peer-IDs `zockbox-kritzel-duell-v1-p-CODE` (privat) bzw. `…-pub-N` (öffentlich).
- Der Browser, der den Raum erstellt, ist Host und rechnet alles. Jeder Spieler bekommt seinen eigenen Zustand (das Wort sieht nur, wer zeichnet oder es schon erraten hat).
- Einladungslinks: `?code=ABCD`, `?join=ABCD` oder `?pub=3`.
- Profil (Name + Emoji-Avatar) kommt aus `../../shared/profile.js` (`ph_name`, `ph_avatar`).
- Zeichenfläche 800×600 mit eigenem Pixel-Rasterizer: alle Geräte zeichnen exakt gleich, darum ist auch der Fülleimer überall identisch. Striche werden alle 50 ms gebündelt verschickt; wer später dazukommt, bekommt die bisherige Zeichnung nachgeliefert.

## Features
Lobby mit Spieler (2–30), Sprache, Zeit (15–240 s), Runden (2–10), Wort-Modus (Normal/Versteckt/Kombination), Wort-Anzahl (1–5), Hinweise (0–5), eigene Wörter + „Nur eigene Wörter benutzen“ · Schnelles Spiel (öffentlich, Autostart) · offene Lobbys · Wortwahl mit Timer · Striche mit Buchstabenzahl · Hinweis-Buchstaben · „nah dran“ · Punkte nach Tempo + Zeichnerpunkte · Auflösung nach jedem Zug · Podium · Stift, Radierer, Fülleimer, Pipette, 5 Größen, 26 Farben (Links-/Rechtsklick), Rückgängig, Löschen, Tastenkürzel · Daumen hoch/runter · Votekick, Kicken, Bannen, Stummschalten · Beitritt mitten im Spiel · Zeichner geht → nächster Zug · Chat-Filter · Chat-Blasen.

## Lokal testen
```
cd zockbox && python3 -m http.server 8000
# http://localhost:8000/games/kritzel-duell/ in zwei Fenstern öffnen
```
