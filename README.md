# PokéSurvivor Offline (Android)

Port Android de **[PokéSurvivor](https://pokesurvivor.com/) de JPTER78**, completo y sin internet, para uso personal sin fines de lucro.
Es la web del juego entera dentro de la app (código, los 1.538 Pokémon y formas con sus hojas normales, shiny y skins,
gritos, huevos, arenas, marcos, fotos de perfil y las páginas de guía/Pokédex), servida desde el teléfono.

## Qué tiene

- **Todo en local.** Nada del juego sale a internet: la app corta cualquier petición a otro sitio.
  Sin cuentas, sin servidor, sin donaciones ni enlaces que lleven fuera.
- **Partida local sin cuentas.** La primera vez solo pide el nombre de entrenador; después entra sola.
  La partida queda guardada en el teléfono (el propio modo local que trae el juego).
- **Eventos siempre activos** (Halloween), para no perder contenido de temporada.
- **Actualizador propio**: al abrir la app busca la versión nueva y **baja solo los archivos que cambiaron**;
  no hay que reinstalar ni bajar todo otra vez. Solo si cambia la parte Android se baja la APK completa.
  Si algo nuevo no arranca, vuelve sola a la versión anterior. En *Ajustes → Acerca de → Actualizaciones* se puede buscar a mano
  o volver a lo que trae la APK.
- **Al día con la web**: cada día GitHub mira pokesurvivor.com; si hay algo nuevo lo baja, lo prueba y publica una versión.
- **Plus (local)**: ideas de [PokeSurvivor Plus](https://github.com/PokeSurvivorPlus/PokeSurvivorPlus) rehechas para esta versión
  y para el teléfono (`www/plus.js`): **∞ Sin fin** (sin Juicio a los 30:00, hordas cada vez más duras y jefes cada 4 min;
  «Invocar a Arceus» en la pausa), **medidor de daño** por movimiento, **minimapa**, **campo de visión** más amplio,
  **historial de partidas** con gráfica de daño y **récords por Pokémon**. Se configura tocando las estadísticas del menú.
  Si una actualización del juego rompe alguna mejora, esa se apaga sola y el juego sigue normal.
- Atrás de Android: en partida pausa, en una ventana la cierra y en el menú pregunta antes de salir.

No disponible sin servidor: amigos/salas online, clasificación online y vincular Google (se esconden).

## Instalar

Descarga la APK de la última versión en [Releases](../../releases/latest) e instálala.
Si tenías la **0.1.0 parcial**, desinstálala primero (la firma es otra); desde la 0.2 todas se instalan encima.

## Cómo está hecho

| Parte | Dónde |
|---|---|
| Juego (copia de la web, sin tocar) | `app/src/main/assets/www/` |
| Capa local (lo único nuestro dentro del juego) | `app/src/main/assets/www/local.js`, cargada desde `index.html` |
| App Android (WebView, servidor de archivos, Atrás) | `app/src/main/java/.../MainActivity.java` |
| Actualizador | `app/src/main/java/.../Updater.java` + `contenido.json` en cada versión |
| Bajar la web y ponerla al día | `tools/web/actualizar.py` (catálogos: `jslit.py` y `catalogo.cjs`; páginas: `paginas.py`) |
| Prueba automática sin internet | `tests/smoke.cjs` (si falla, no se publica) |
| Compilar y publicar | `.github/workflows/build-apk.yml` · diario: `.github/workflows/actualizar.yml` |

`tools/web/actualizar.py` lee del propio juego qué archivos existen (no adivina rutas), baja solo lo nuevo o lo que cambió
(cada Pokémon tiene su versión de hojas) y borra lo que el juego ya no usa. Respeta el límite del sitio:
un archivo tras otro y, si responde 429, espera. Es reanudable.

Compilar en la PC: abrir la carpeta en Android Studio, o `./gradlew assembleRelease`.

`preservation/original-capture.zip` es la captura parcial del 22-11-2026 (versión 0.1.0), guardada como historia.

## Créditos

Juego, diseño y código: **JPTER78** (pokesurvivor.com). Proyecto fan sin ánimo de lucro.
Ideas de mejoras: PokeSurvivor Plus (licencia MIT), rehechas desde cero para esta versión.
Sprites y retratos: [PMD SpriteCollab](https://github.com/PMDCollab/SpriteCollab) (CC BY-NC 4.0) y sus artistas, según los créditos del juego.
Pokémon © Nintendo / Creatures / GAME FREAK. Este port no tiene relación con ellos y no concede permisos adicionales sobre recursos ajenos.
