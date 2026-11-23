# Originales y cambios

Origen preservado: https://pokesurvivor.com/ (captura 22 de noviembre de 2026).

`preservation/original-capture.zip` conserva la entrega de auditoría original. Dentro está `LEEME_AUDITORIA.md`, el inventario, los SHA-256 y los recursos descargados. No se retocaron ni convirtieron sprites, audio ni fuentes.

La captura original guardó la página raíz en `resources/pokesurvivor.com/index.html/index.html`. El preparador corrige únicamente esa ubicación a `game/index.html` para el bundle local. La captura original permanece intacta.

Cambios del bundle derivado:

1. Inserción de un adaptador local en el HTML.
2. Persistencia y recuperación del perfil de invitado en localStorage; se conserva el modo local ya previsto por el motor original.
3. Desactivación del registro del service worker de la web, porque Android sirve el bundle directamente. No se modifica el worker preservado.
4. Pantalla de alcance parcial y ajustes de textos/controles de cuentas que no funcionan en esta edición.
5. Contenedor Android que sirve archivos locales bajo un origen HTTPS interno y rechaza destinos externos. No solicita permiso de Internet.

No se reproducen servidores, cuentas, clasificaciones ni verificaciones remotas, ni se eliminan controles del servidor original. Las restricciones de descarga del origen no se eludieron. No se hicieron nuevas descargas del sitio para esta etapa.

Sprites: https://github.com/PMDCollab/SpriteCollab (CC BY-NC 4.0, según la web). Pokémon © Nintendo / Creatures / GAME FREAK. Otros recursos conservan las licencias y avisos que les correspondan; no se relicencian como parte de este port.
