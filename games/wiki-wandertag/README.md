# 🥾 Wiki-Wandertag

Das Wikipedia-Wettrennen für den Pausenhof – made by Oskar.

Alle starten auf demselben Wikipedia-Artikel und müssen sich **nur über Links** bis zum Zielartikel klicken. Wer zuerst (oder mit den wenigsten Klicks) ankommt, gewinnt die Runde.

## So funktioniert's
- **Lobbys:** Private Lobby mit 4-Buchstaben-Code oder Einladungslink (`?code=ABCD`), schnelles Spiel über öffentliche Lobbys (`?pub=N`), Liste offener Lobbys, bis zu 30 Spieler, Host kann Leute rauswerfen, Chat in Lobby, Rennen und Ergebnis.
- **Host-Einstellungen:** Sprache (Deutsch/Englisch), Route (Zufall → bekanntes Ziel, bekannte Themen, komplett zufällig, meistgelesen im letzten Monat, selbst wählen mit Vorschlägen und 🎲), Runden, Zeitlimit, Rundenende (60 s nach dem Ersten / wenn alle fertig / sofort), Wertung (Zeit oder Klicks), Zurück-Knopf erlaubt/verboten, Strg+F erlaubt/verboten, Klick-Limit, verbotene Artikel (Deutschland & USA), max. Spieler.
- **Rennen:** Echte Wikipedia-Artikel im Wikipedia-Look (live über die Wikipedia-API). Nur Links auf echte Artikel zählen; externe Links, rote Links, Dateien, Kategorien und Spezialseiten sind gesperrt. Weiterleitungen werden aufgelöst. Ziel-Vorschau vor dem Start und jederzeit über 🎯, Klickzähler, Weg-Leiste, Aufgeben-Knopf, Live-Liste mit Klicks und aktuellem Artikel aller Mitspieler.
- **Fair Play:** Der Host prüft im Hintergrund bei Wikipedia, ob jeder Sprung wirklich verlinkt ist. Ein falscher letzter Sprung führt zur Disqualifikation. Strg+F / Cmd+F / F3 werden blockiert.
- **Nach dem Ziel:** Zuschauen – Wege der anderen live ansehen. Ergebnis mit Platz, Zeit, Klicks und komplettem Weg (Links öffnen Wikipedia), Gesamtwertung über alle Runden, Siegerpodest am Ende.

## Punkte
Platz 1: 100, Platz 2: 80, dann 65, 55, 45, 40, 35, 30, 25, 20, danach je 10. Kürzester Weg (bei mindestens 2 im Ziel): +10.

## Technik
Reine statische Seite (GitHub Pages). Multiplayer über `shared/net.js` (PeerJS/WebRTC, der Host-Browser ist der Spielserver), Spiel-ID `wiki-wandertag-v1`.

| Datei | Inhalt |
|---|---|
| `index.html` | Seite und alle Bildschirme |
| `game.css` | Tafel- und Klebezettel-Design für das Spiel |
| `game.js` | Host-Logik, Client-Logik, Lobby, Rennen, Ergebnisse |
| `wiki.js` | Wikipedia-API: Artikel, Namensräume, Zufall, Suche, Vorschau, Link-Prüfung, CSS |
| `wikiframe.js` | Artikelrahmen im Wikipedia-Stil (Shadow-DOM) |
| `wiki-frame.css` | Wikipedia-ähnlicher Rahmen und Anpassungen fürs Handy |
| `popular.js` | Liste bekannter, schulfreundlicher Artikel (de/en) |

## Grenzen
- Auf iPhone/iPad kann „Auf der Seite suchen“ aus dem Teilen-Menü nicht technisch blockiert werden – da gilt Ehrenwort.
- Verlässt der Host die Seite, endet die Lobby für alle.
- Die Wikipedia-Inhalte stehen unter CC BY-SA 4.0. Wiki-Wandertag hat nichts mit der Wikimedia Foundation zu tun.
