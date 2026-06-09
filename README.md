# Schätzspiel

Ein interaktives Web-Tippspiel zum Schätzen und Auswerten von Ergebnissen. Eine beliebige Anzahl von Personen kann je 5 Tipps eingeben, diese werden automatisch im Browser gespeichert und nach einem Endergebnis ausgewertet.

## Features

- 🎯 Beliebig viele Personen mit je max. 5 Tipps
- 💾 Automatische Speicherung im Browser (localStorage)
- 📊 Automatische Auswertung und Ranking
- 📱 Vollständig responsive für Smartphones, Tablets und Desktop
- 🔄 Sequentielle Bestätigung pro Person
- 📥 CSV-Export der Spielerdaten

## Nutzung

1. Öffne `index.html` in einem Browser
2. Gib den Namen der ersten Person ein
3. Trage bis zu 5 Tipps ein
4. Klicke "Bestätigen" - die nächste Person erscheint
5. Wiederhole für alle Spieler
6. Gib im Bereich "Ergebnis & Auswertung" das Endergebnis und die Ranking-Größe ein
7. Klicke "Tippspiel auswerten" oder exportiere die Daten als CSV

Die Daten werden automatisch gespeichert und auch nach Browser-Neustart erhalten.

## Technologie

- HTML5, CSS3, Vanilla JavaScript
- Keine externen Abhängigkeiten
- Responsive Design mit Media Queries
- localStorage für persistente Speicherung

## Lizenz

MIT
