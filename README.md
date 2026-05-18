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
- `pages.json`: paginas editables desde datos y plantillas reutilizables.

La carga de paginas es compatible con los HTML existentes:

1. Si la pestana es ATC, Repostaje o una espera de `holdings.json`, se renderiza desde su configuracion especifica.
2. Si el `id` existe en `pages.json`, se renderiza desde datos.
3. Si no existe en `pages.json`, se carga `pages/{id}.html` como antes.

Usa `pages.json` para contenido repetido o facil de editar entre misiones. Usa `pages/` para HTML muy especifico, maquetacion especial o pruebas rapidas que no merezcan una plantilla.

En `pages.json`, `type: "operation"` sirve para paginas STRIKE con armamento desde `loadouts.json`. `type: "standard"` permite componer una pagina con bloques (`card`, `notes`, `list`, `checklist`, `image`, `table`, `textarea`). `type: "html"` fuerza la carga de un HTML personalizado.

Las paginas HTML de `pages/` quedan para contenido comun o muy especifico. Las esperas configuradas en `holdings.json` se renderizan directamente desde datos, por lo que no hace falta duplicar HTML para cada vuelo.

En `holdings.json`, los textos comunes estan en `defaults` y cada vuelo vive en `items`. Si un vuelo necesita un texto propio, anade ese campo dentro de su bloque en `items` y sustituira al valor comun. JSON no acepta comentarios reales, asi que el bloque `_help` documenta el formato sin romper la carga de la web.
