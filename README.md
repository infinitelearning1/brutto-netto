# Brutto-Netto Auswahl AT

Chrome-Extension für schnelle österreichische Brutto-Netto-Schätzungen direkt auf Webseiten. Diese Version rechnet lokal mit einer Formel für 2026 und führt keine Hintergrundanfragen an externe Brutto-Netto-Rechner aus.

## Schnell installieren

1. ZIP herunterladen: [brutto-netto main.zip](https://github.com/infinitelearning1/brutto-netto/archive/refs/heads/main.zip)
2. ZIP entpacken.
3. Chrome öffnen und `chrome://extensions` aufrufen.
4. Rechts oben `Entwicklermodus` aktivieren.
5. `Entpackte Erweiterung laden` wählen.
6. Den entpackten Projektordner auswählen.

Nach Updates an der Extension auf `chrome://extensions` beim Eintrag `Brutto-Netto Auswahl AT` auf den Reload-Button klicken.


## Nutzung

1. Eine Gehaltszahl oder einen Gehaltsabschnitt auf einer Webseite markieren, z. B. `3.500`, `EUR 3.700,-- brutto`, `40.000`, `EUR 55.000 p.a.`, `35k`, `EUR 3.000 x 14`, `3.500 bis 5.000 EUR monatlich` oder einen Absatz mit `Bruttomonatsgehalt` / `Jahresbruttogehalt`.
2. Rechtsklick auf die Markierung.
3. Der Menüpunkt `Netto-Schätzung ...` zeigt direkt im Rechtsklick-Menü den laufenden Monats-Netto-Wert und den Netto-Jahreswert.
4. Ein Klick auf den Menüpunkt öffnet optional eine kleine Detailbox auf derselben Seite.

## Formel-v2

Die Berechnung liegt in `payroll-at-2026.js`. Sie bildet den Standardfall ab:

- Arbeiter/in oder Angestellte/r
- 14 gleich hohe Bruttobezüge
- Werbungskostenpauschale 132 EUR
- Verkehrsabsetzbetrag 496 EUR
- Lohnsteuertarif 2026
- begünstigte Besteuerung für 13. und 14. Bezug
- Arbeitnehmer-SV inklusive gestaffelter Arbeitslosenversicherung und Höchstbeitragsgrundlage

Bei Sonderfällen zeigt die Extension Hinweise an, statt so zu tun, als wären diese schon vollständig abgedeckt.

## Annahmen

Standardmäßig wird gerechnet als:

- Arbeiter/in oder Angestellte/r
- Beschäftigungsort Wien
- kein Alleinverdiener-/Alleinerzieher-Absetzbetrag
- kein Familienbonus
- kein Sachbezug
- kein Freibetrag
- keine Pendlerpauschale

Arbeitsverhältnis, Bundesland und Schwellenwerte für Monats-/Jahreserkennung können in den Extension-Optionen angepasst werden.