# ✏️ Krakelpost

**Stille Post mit Zeichnungen** – ein Spiel in der Zockbox. *made by Oskar*

Jeder schreibt einen Satz → der Nächste zeichnet ihn → der Nächste beschreibt die Zeichnung → … Die Ketten („Alben“) wandern reihum. Am Ende blättert der Spielleiter jedes Album Schritt für Schritt auf, alle reagieren mit Emojis, und jedes Album lässt sich als Bild (PNG) oder animiertes GIF speichern.

Vorbild ist das Spielprinzip von Gartic Phone (Modusnamen nach der deutschen Fassung). Code, Design, Grafiken und Sounds sind komplett eigen.

## Spielen
- **Schnelles Spiel:** rein in eine offene öffentliche Lobby (oder eine neue erstellen).
- **Lobby erstellen:** private Lobby mit 4-Buchstaben-Code. Einladungslink: `games/krakelpost/?code=ABCD` (auch `?join=ABCD`, öffentliche Lobby `?pub=3`).
- **2–30 Spieler**, Standard 10. Wer mitten im Spiel kommt, schaut zu und ist im nächsten Spiel dabei. Der Spielleiter kann Leute rauswerfen (Avatar antippen).

## Modi (Voreinstellungen)
Normal · Imitation · Animation · Eisbrecher · Fremdkörper · Ergänzen · Meisterwerk · Story · Fehlendes Teil · Geheimnis · Koop · Punkte · Sandwich · Hintergrund · Solo · Speedrun · Kein Druck

Einstellungen: Zeit (Langsam, Normal, Schnell, Speedrun, Regressiv, Dynamisch, Unendlich), Runden (Wenige, Mittel, Alle, Alle + 1, 200 %, 300 % oder feste Zahl), Geheimnis an/aus, Animationstempo, max. Spieler, Zuschauer erlauben, Alben automatisch zeigen.
Läuft die Zeit ab, wird automatisch abgegeben, was gerade da ist (leerer Startsatz → zufällige Idee).

## Zeichnen
Stift, Radierer, Fülleimer, Linie, Rechteck, Kreis, 5 Größen, 18 Farben + eigene Farbe, Deckkraft, Rückgängig/Wiederholen, Leeren. Touch (iPhone/iPad), Apple Pencil und Maus. Tastatur: B/E/G/L/R/O, Strg+Z / Strg+Y.

## Dateien
```
index.html   Bildschirme (Start, Lobby, Spiel, Alben, Ende)
game.js      Lobby, Host-Logik (Ketten, Runden, Timer), Client-Ansichten
draw.js      Zeichenfläche (Ebenen, Werkzeuge, Fülleimer, Verlauf)
export.js    Album → PNG / GIF
sound.js     Soundeffekte per WebAudio (keine Dateien)
game.css     Design (dunkel, bunt, Briefmarken-Motiv)
vendor/omggif.js  GIF-Encoder (MIT, Dean McNamee)
```
Netzwerk über `../../shared/net.js` (PeerJS/WebRTC, Host-Browser = Spielserver), Profil über `../../shared/profile.js`, Schriften aus `../../shared/fonts/`.
`GAME_ID = 'krakelpost-v1'` → Peer-IDs `zockbox-krakelpost-v1-p-CODE` bzw. `…-pub-N`.
