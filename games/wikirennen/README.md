# Wikirennen

Das Wikipedia-Wettrennen in der Zockbox – made by Oskar.

Alle starten auf demselben Wikipedia-Artikel und müssen sich **nur über Links** bis zum Zielartikel (oder zu mehreren Zielen) klicken. Die ganze Seite sieht aus wie Wikipedia selbst: am Rechner wie die Vector-2022-Oberfläche (Inhaltsverzeichnis links, Infobox rechts, Reiter, Tabellen), am Handy wie die mobile Wikipedia (graue Kopfzeile, aufklappbare Abschnitte).

## Spielmodi
- **Mehrspieler – private Lobby:** 4-Buchstaben-Code oder Einladungslink (`?code=ABCD`), 2–30 Spieler (Standard 10), Host kann Leute entfernen, Chat als „Diskussion“ in Lobby, Rennen und Ergebnis.
- **Schnelles Spiel:** tritt der vollsten offenen öffentlichen Lobby bei (`?pub=N`), sonst wird eine neue erstellt – allein starten geht auch.
- **1-gegen-1-Duell:** öffentliche Lobby für genau 2, startet automatisch, sobald ein Gegner da ist. Wenigste Klicks gewinnen, Neustart erlaubt.
- **Offene Lobbys:** Liste auf der Hauptseite (auch laufende Rennen mit Restzeit – Zuschauen und ab der nächsten Runde mitspielen).
- **Einzelrennen:** Zufallsroute oder Start/Ziel selbst wählen (Titel oder Wikipedia-Link einfügen), eigene Regeln, danach als Herausforderungs-Link teilen (`?from=…&to=…&lang=…&r=…`, optional mit `&by=Name&c=Klicks&ms=Zeit`).
- **Tageschallenge:** jeden Tag eine Route für alle, deterministisch aus dem UTC-Datum berechnet (wechselt 0 Uhr UTC). Bestwert, Serie, Archiv der letzten 30 Tage und spoilerfreies Teilen (`?daily=JJJJ-MM-TT&lang=de`). Gespeichert nur im Browser.
- **Stufen:** 40 deutsche Routen mit geprüftem kürzesten Weg („Par“), Sterne, Freischalten der nächsten Stufe. Gespeichert nur im Browser.

## Einstellungen und Regeln (Host)
Sprache (Deutsch/Englisch) · Route (Zufall → bekanntes Ziel, bekannte Themen, komplett zufällig, meistgelesen im letzten Monat, Tageschallenge von heute, Ziel aus Vorschlägen, selbst wählen mit Vorschlagsliste und Würfel) · Anzahl Ziele (1, 2, 3, 5) · Runden · Zeitlimit (1–10 Min oder ohne, max. 15) · Wertung (Zeit oder Klicks) · Rundenende (60 s nach dem Ersten / wenn alle fertig / sofort) · Max. Spieler · Zurück-Knopf (erlaubt, kostet 1 Klick / verboten) · Strg+F (verboten/erlaubt) · Klick-Limit (3/5/7/10/15) · verbotene Artikel (keine USA / USA & Deutschland / alle Länderartikel) · Ziel melden (automatisch oder per „Gefunden!“-Knopf) · Neustart (zurück zum Start, Klicks auf 0) · Power-ups · Zielvorschläge (alle oder nur Host).

## Rennen
- Echte Wikipedia-Artikel im echten Wikipedia-Look (live über die Wikipedia-API, Wikipedia-CSS im Shadow-DOM). Nur Links auf echte Artikel zählen; externe Links, rote Links, Dateien, Kategorien und Spezialseiten sind gesperrt. Weiterleitungen werden aufgelöst.
- Klebende Leiste oben: Ziel(e) (antippen = Vorschau), Runde, Zeit, Klicks, Zurück, Neustart, Gefunden!, Power-ups, Mitspieler, Aufgeben. Darunter der eigene Weg als Brotkrumen.
- Rechts (am Handy als Schublade): Mitspieler live mit aktuellem Artikel und Klicks, Regeln, Diskussion. Wer fertig ist, kann die Wege der anderen live ansehen.
- **Mehrere Ziele:** beliebige Reihenfolge, 10 Punkte pro Ziel, +5 für den Ersten, der ein Ziel findet.
- **Power-ups** (wenn an, je eins pro Runde): Tintenklecks (8 s Tinte über dem Artikel), Nebel (6 s verschwommen), Übersetzt (12 s Artikel in der anderen Sprache, Links gesperrt).
- **Fair Play:** Der Host prüft jeden Sprung im Hintergrund bei Wikipedia. Ein falscher Sprung auf ein Ziel führt zur Disqualifikation. Strg+F / Cmd+F / F3 werden blockiert (wenn verboten).

## Ergebnis
Platzierung (Zeit, Klicks, Ziele, Zurück-Klicks, Sekunden pro Klick, Punkte und kompletter Weg mit Links zu Wikipedia), Wegvergleich Schritt für Schritt, Gesamtwertung, Rundenübersicht, Siegerpodest am Ende. Im Einzelspiel: Bestwert/Sterne/Serie und Teilen.

## Punkte (1 Ziel)
Platz 1: 100, Platz 2: 80, dann 65, 55, 45, 40, 35, 30, 25, 20, danach je 10. Kürzester Weg (bei mindestens 2 im Ziel): +10.

## Technik
Reine statische Seite. Multiplayer über `../../shared/net.js` (PeerJS/WebRTC, der Host-Browser ist der Spielserver), Spiel-ID bleibt `wikirennen-v1` (die Zockbox-Startseite findet Lobbys darüber). Einzelspiel nutzt dieselbe Host-Logik lokal (`LocalRoom` in `game.js`). Kein eigener Server, keine Konten.

| Datei | Inhalt |
|---|---|
| `index.html` | Seite und alle Bildschirme (Hauptseite, Tageschallenge, Stufen, Lobby, Countdown, Rennen, Ergebnis) |
| `game.css` | Wikipedia-artige Oberfläche (Vector 2022 / Minerva), komplett selbst geschrieben mehr |
| `game.js` | Host-Logik, Client-Logik, Einzelspiel, Tageschallenge, Stufen, Power-ups, Teilen |
| `wiki.js` | Wikipedia-API: Artikel, Namensräume, Zufall, Suche, Vorschau, Link-Prüfung, Sprachlinks, CSS, verbotene Artikel |
| `wikiframe.js` / `wiki-frame.css` | Artikelrahmen im Wikipedia-Stil (Shadow-DOM) |
| `popular.js` | bekannte, schulfreundliche Artikel (de/en) |
| `data.js` | Staatenliste (Wikidata), Startartikel für die Tageschallenge, Stufen mit Par (geprüft am 06.11.2026) |
| `logo.svg` | eigenes Logo (selbst gezeichnete Puzzle-Kugel mit Zielflagge) |
| `fonts/` | Libertinus Serif (SIL OFL 1.1, siehe `fonts/OFL.txt`) – frei, ähnlich wie Linux Libertine |

Gespeichert wird nur im Browser: `ph_name`, `ph_avatar` (mit der Zockbox geteilt), `wr_avatar_img` (eigenes Bild, 64×64), `wr_daily_v1`, `wr_daily_lang`, `wr_levels_v1`.

## Grenzen
- Keine Ranglisten, kein Elo, keine Konten – dafür bräuchte man einen Server. Bestwerte gibt es nur pro Gerät.
- Auf iPhone/iPad kann „Auf der Seite suchen“ aus dem Teilen-Menü nicht technisch blockiert werden – da gilt Ehrenwort.
- Verlässt der Host die Seite, endet die Lobby für alle.
- Das Par der Stufen stimmt für den Stand vom 06.11.2026; Wikipedia ändert sich.
- Die Wikipedia-Inhalte stehen unter CC BY-SA 4.0. Wikirennen hat nichts mit der Wikimedia Foundation zu tun.
