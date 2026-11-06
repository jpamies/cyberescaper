# Llibreries de tercers (vendoritzades)

No es carreguen mai des d'una CDN. Només es baixen quan l'equip genera el PDF
(i el QR del nivell 3), de manera que no compten a la càrrega inicial.

| Fitxer | Versió | Origen | Llicència | Per a què |
|---|---|---|---|---|
| `jspdf.umd.min.js` | 4.2.1 | npm `jspdf` (`dist/jspdf.umd.min.js`) | MIT | Generar l'informe PDF |
| `qrcode.js` | 1.4.4 | npm `qrcode-generator` | MIT | QR del codi de verificació (PDF) i QR fictici del nivell 3 |

Per actualitzar-les: `npm pack jspdf@<versió> qrcode-generator@<versió>`, copiar els
fitxers indicats i actualitzar `LICENSES/`.
