# ✉️ Krakelpost

**Stille Post mit Zeichnungen** – ein Spiel in der Zockbox. *made by Oskar*

Jeder schreibt einen Satz → der Nächste zeichnet ihn → der Nächste beschreibt die Zeichnung → … Die Ketten („Alben“) wandern reihum. Am Ende werden alle Alben Schritt für Schritt „zugestellt“ (wie ein Chatverlauf), alle reagieren mit Emojis, und jedes Album lässt sich als Bild (PNG) oder animiertes GIF speichern.

Vorbild ist das Spielprinzip von Gartic Phone (Ablauf, Anordnung, deutsche Texte und Modusnamen). Code, Design, Logo, Grafiken und Sounds sind komplett eigen.

## Die Idee hinter dem Design: „Die Post der Krakeleien“
Alles ist Post – auf hellem Papier statt dunklem Bildschirm:
- **Luftpost-Ränder** (rot-blaue Streifen) oben, an Postkarten, Leisten und Album-Umschlägen.
- **Avatare sind Briefmarken** mit gezacktem Rand. Wer abgegeben hat, bekommt einen **Poststempel** mit Haken.
- Der **Timer ist ein Poststempel**: runder Stempel mit Wellenlinien, der Ring läuft ab.
- Die **Zeichenfläche ist eine Postkarte** mit Klebestreifen, Sätze stehen auf **liniertem Briefpapier** in Handschrift.
- **Warten** = ein Brief rutscht in den Umschlag. **Ende** = „Alle Alben sind zugestellt!“.
- Typo: *Gochi Hand* (große Handschrift-Titel), *Kalam* (Handschrift für Sätze und Namen), *Nunito* (Bedienung), *Special Elite* (Schreibmaschine für Stempel und Etiketten).
- Alle Symbole und Illustrationen sind selbst gezeichnete SVGs (in `index.html`), das Logo ist ein Umschlag mit Briefmarke und Bleistift.

## Spielen
- **Start:** private Lobby mit 4-Buchstaben-Code. **Schnelles Spiel:** rein in eine offene öffentliche Lobby (oder eine neue erstellen).
- Einladungslink: `games/krakelpost/?code=ABCD` (auch `?join=ABCD`, öffentliche Lobby `?pub=3`). In der Lobby gibt es einen **QR-Code** (selbst erzeugt, ohne CDN).
- **2–30 Spieler**, Standard 10 (Solo/Meisterwerk auch allein). Wer mitten im Spiel kommt, schaut zu und ist im nächsten Spiel dabei. Der Spielleiter kann Leute rauswerfen (Spieler antippen).

## Modi (Voreinstellungen)
Normal · Imitation · Animation · Eisbrecher · Fremdkörper · Ergänzen · Meisterwerk · Story · Fehlendes Teil · Geheimnis · Koop · Punkte · Sandwich · Hintergrund · Solo · Speedrun · Kein Druck · **Eigener**

**Eigener:** Unter „Einstellungen → Spielablauf“ frei kombinieren: Ablauf (Schreiben↔Zeichnen, nur Zeichnen, nur Schreiben, ein Satz für alle, Sandwich, Skizze ergänzen, Hintergrund + Animation, jeder für sich), Vorlage (am selben Bild weitermalen, vorheriges Bild ergänzen, unten anbauen), Animation, Nachzeichnen, Punkte, erste Runde kürzer/länger. Wer einen Baustein ändert, landet automatisch bei „Eigener“. Unpassende Kombinationen werden vom Host automatisch spielbar gemacht (z. B. keine Animation, wenn geschrieben wird).

Weitere Einstellungen: Zeit (Langsam, Normal, Schnell, Speedrun, Regressiv, Dynamisch, Unendlich), Runden (Wenige, Mittel, Alle, Alle + 1, 200 %, 300 % oder feste Zahl), Geheimnis, Animationstempo, max. Spieler, Zuschauer erlauben, Alben automatisch zeigen.
Läuft die Zeit ab, wird automatisch abgegeben, was gerade da ist (leerer Startsatz → zufällige Idee).

## Zeichnen
Stift, Radierer, Fülleimer, **Pipette**, Linie, Rechteck, **gefülltes Rechteck**, Kreis, **gefüllter Kreis**, 5 Größen, 18 Farben + eigene Farbe, Deckkraft, Rückgängig/Wiederholen, Leeren. Bei Animationen: **Belichtung** 1×–4× pro Bild (wie lange das Bild im Film stehen bleibt – gilt auch fürs GIF).
Touch (iPhone/iPad), Apple Pencil und Maus. Tastatur: B Stift, E Radierer, G Eimer, I Pipette, L Linie, R/⇧R Rechteck, O/⇧O Kreis, Strg+Z / Strg+Y.

Anordnung wie beim Vorbild: am Computer Farben links, Zeichenfläche in der Mitte, Werkzeuge rechts, darunter Größen, Deckkraft, Verlauf und „Fertig!“ – alles passt ohne Scrollen auf den Bildschirm. Am Handy steht alles untereinander.

## Dateien
```
index.html   Bildschirme (Start, Einladung, Lobby, Spiel, Alben, Ende) + alle SVG-Symbole/Illustrationen
game.css     Design (eigenständig, braucht kein shared/zockbox.css)
game.js      Lobby, Host-Logik (Ketten, Runden, Timer), Client-Ansichten
draw.js      Zeichenfläche (Ebenen, Werkzeuge, Fülleimer, Pipette, Verlauf)
export.js    Album → PNG / GIF (im selben Papier-Look)
qr.js        eigener QR-Code-Generator (Byte-Modus, Stufe M, Version 1–10)
sound.js     Soundeffekte per WebAudio (keine Dateien)
fonts/       Gochi Hand, Kalam Bold, Nunito (SIL OFL), Special Elite (Apache 2.0) – auf Latein/Deutsch reduziert
vendor/omggif.js  GIF-Encoder (MIT, Dean McNamee)
```
Netzwerk über `../../shared/net.js` (PeerJS/WebRTC, Host-Browser = Spielserver), Profil über `../../shared/profile.js`, Tarnmodus über `../../shared/tarnung.js`.
`GAME_ID = 'krakelpost-v1'` → Peer-IDs `zockbox-krakelpost-v1-p-CODE` bzw. `…-pub-N`.
