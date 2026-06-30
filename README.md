# Brutto-Netto Auswahl AT

Chrome-Extension fuer schnelle oesterreichische Brutto-Netto-Schaetzungen direkt auf Webseiten. Diese Version rechnet lokal mit einer Formel fuer 2026 und fuehrt keine Hintergrundanfragen an externe Brutto-Netto-Rechner aus.

## Installation

1. Chrome oeffnen und `chrome://extensions` aufrufen.
2. Rechts oben `Entwicklermodus` aktivieren.
3. `Entpackte Erweiterung laden` waehlen.
4. Den entpackten Projektordner dieser Extension auswaehlen.

Nach Updates an der Extension auf `chrome://extensions` beim Eintrag `Brutto-Netto Auswahl AT` auf den Reload-Button klicken.

## Nutzung

1. Eine Gehaltszahl oder einen Gehaltsabschnitt auf einer Webseite markieren, z. B. `3.500`, `EUR 3.700,-- brutto`, `40.000`, `EUR 55.000 p.a.`, `35k`, `EUR 3.000 x 14`, `3.500 bis 5.000 EUR monatlich` oder einen Absatz mit `Bruttomonatsgehalt` / `Jahresbruttogehalt`.
2. Rechtsklick auf die Markierung.
3. Der Menuepunkt `Netto Schaetzung ...` zeigt direkt im Rechtsklick-Menue den laufenden Monats-Netto-Wert und den Netto-Jahreswert.
4. Ein Klick auf den Menuepunkt oeffnet optional eine kleine Detailbox auf derselben Seite.

## Formel-v2

Die Berechnung liegt in `payroll-at-2026.js`. Sie bildet den Standardfall ab:

- Arbeiter/in oder Angestellte/r
- 14 gleich hohe Bruttobezuege
- Werbungskostenpauschale 132 EUR
- Verkehrsabsetzbetrag 496 EUR
- Lohnsteuertarif 2026
- beguenstige Besteuerung fuer 13. und 14. Bezug
- Arbeitnehmer-SV inklusive gestaffelter Arbeitslosenversicherung und Hoechstbeitragsgrundlage

Bei Sonderfaellen zeigt die Extension Hinweise an, statt so zu tun, als waeren diese schon vollstaendig abgedeckt.

## Annahmen

Standardmaessig wird gerechnet als:

- Arbeiter/in oder Angestellte/r
- Beschaeftigungsort Wien
- keine Alleinverdiener-/Alleinerzieher-Absetzbetrag
- kein Familienbonus
- kein Sachbezug
- kein Freibetrag
- keine Pendlerpauschale

Arbeitsverhaeltnis, Bundesland und Schwellenwerte fuer Monats-/Jahreserkennung koennen in den Extension-Optionen angepasst werden.