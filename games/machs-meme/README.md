# 😂 Mach's Meme

Meme-Partyspiel im Stil von makeitmeme.com (eigener Code, eigene Grafiken). Teil der Zockbox.
`GAME_ID = 'machs-meme-v1'` – nicht ändern (die Startseite sucht Lobbys darunter).

## Dateien
| Datei | Inhalt |
|---|---|
| `index.html`, `game.css` | Oberfläche (eigenes Design, hängt **nicht** von `shared/zockbox.css` ab) |
| `game.js` | Spiel-Logik: Host (Lobby, Runden, Punkte) + Client (Anzeige, Editor, Wiederverbinden) |
| `templates.js` | Vorlagen: Klassiker (imgflip Top 100), Extra (memegen.link), GIFs. Doppelte entfernt bzw. per `k` verknüpft |
| `layouts.js` | **Textfeld-Positionen pro Vorlage** in % (x, y, Breite, Höhe + Flags `b` schwarz, `r<grad>` gedreht, `vt`/`vb` oben/unten). Ohne Eintrag: klassisch oben/unten |
| `memerender.js` | Text zeichnen (Auto-Schriftgröße, Umbruch, Kontur, Drehung) + PNG/GIF-Export – Editor, Abstimmung, Ergebnis und Download nutzen dieselbe Funktion |

## Verbindung (alles in `game.js`, `shared/net.js` bleibt unverändert)
- **Herzschlag:** Clients melden sich alle 3 s, der Host sendet alle 3 s ein Lebenszeichen.
- **Verbindung weg:** Der Host hält den Platz (Punkte, Meme, Entwurf) **60 s** frei (Spieler wird ausgegraut). Der Client verbindet sich automatisch neu (mehrere Versuche, ca. 1–2 min).
- **Neu laden:** Mitspieler steigen nach einem Reload automatisch wieder ein (gleicher Tab), der Text im Editor bleibt.
- **Host lädt neu:** Der Spielstand liegt im Tab (`sessionStorage`), die Lobby wird mit demselben Code wiederhergestellt, alle verbinden sich neu.
- **Verlassen:** Wer auf „Verlassen“ drückt, ist sofort raus; verlässt der Host, bekommen alle sofort Bescheid.
- Grenzen: Schließt der Host den Tab ganz, ist die Lobby weg (kein Host-Wechsel).
