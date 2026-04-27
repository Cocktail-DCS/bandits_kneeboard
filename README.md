# DCS Bandits Advanced Kneeboard

Web estatica para piernografo de DCS.

## Edicion rapida de mision

El contenido que cambia entre misiones esta en `conf/`:

- `packages.json`: paquetes de vuelo y pestanas que ve cada paquete.
- `atc.json`: pantallas especiales del paquete ATC: Ground, Overlord y Tower.
- `radios.json`: tabla de radios principal y secundaria.
- `tankers.json`: informacion de tankers usada por Repostaje y ATC Overlord.
- `loadouts.json`: armamento por pagina de operacion.
- `holdings.json`: puntos de espera, altitudes, fuel y procedimiento.
- `notes.json`: notas generales, soft deck y hard deck.

Las paginas HTML de `pages/` quedan para contenido comun o muy especifico. Las esperas configuradas en `holdings.json` se renderizan directamente desde datos, por lo que no hace falta duplicar HTML para cada vuelo.

En `holdings.json`, los textos comunes estan en `defaults` y cada vuelo vive en `items`. Si un vuelo necesita un texto propio, anade ese campo dentro de su bloque en `items` y sustituira al valor comun. JSON no acepta comentarios reales, asi que el bloque `_help` documenta el formato sin romper la carga de la web.

---

Copyright © 2026 Bandits Squad

All rights reserved.

This repository is published for viewing purposes only. You may not copy, modify, distribute, sublicense, or use this code, in whole or in part, without prior written permission from the copyright holder.

For permission requests, contact: Create an issue in this repository