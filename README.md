# Pokesurvivor Offline — 0.1.0 parcial

Port Android local del frontend público preservado el 22 de noviembre de 2026. **Es una primera APK parcial, no una preservación completa del juego.**

La APK incluye 1.822 archivos recuperados del sitio, más tres archivos de apoyo. Entre los originales hay 1.686 PNG y 120 MP3. El proceso original de descarga se detuvo tras HTTP 429; el inventario completo de pendientes está en `preservation/original-capture.zip`.

## Qué contiene

- Android WebView con recursos empaquetados dentro de la APK.
- Sin permiso `android.permission.INTERNET`. Sin redirección a la web original ni descarga de recursos durante el juego.
- Guardado local del perfil de invitado: en las llamadas originales a commit, cada dos segundos y al pasar a segundo plano. Continúa al volver a pulsar el botón de partida local. Un cierre forzado puede perder los últimos segundos. No se conserva una run en curso como sesión suspendida.
- Interfaz original, controles táctiles originales y pantalla horizontal.
- Copia intacta de la captura original separada de las adaptaciones.
- Compilación reproducible desde las dependencias indicadas y hashes de contenido; firma y timestamps no se prometen idénticos entre máquinas.

## Cómo probar la APK

1. Instalá `Pokesurvivor-Offline-0.1.0-partial.apk` en Android 6.0 o posterior con Android System WebView actualizado.
2. Abrí la portada y pulsá **Abrir copia parcial**.
3. Pulsá para empezar y después **Jugar / continuar partida local**.
4. Completá el cuestionario y usá **Elegir otro → Bulbasaur**. Sus hojas están incluidas.
5. Revisá una partida y cerrá/reabrí la app para comprobar el perfil guardado.

Faltan numerosos Pokémon y cosméticos; el juego puede mostrar personajes vacíos, fallos o zonas incompletas. El guardado local no importa una cuenta de la web. Rankings, cooperativo y otras funciones remotas no están implementados localmente.

## Validación realizada

- Compilación Android correcta y firma APK v1/v2/v3 verificada.
- Manifiesto final comprobado sin permiso de Internet.
- Verificación de integridad del ZIP/APK y de los 1.825 archivos empaquetados.
- Comparación byte a byte de 1.820 originales sin cambios. Solo `index.html` y `js/app.min.js` reciben las adaptaciones descritas.
- Prueba automatizada del JavaScript en DOM: arranque sin recursos externos, ocho preguntas, selección de Bulbasaur, menú, guardado y restauración después de reiniciar.
- La prueba DOM usa canvas simulado: **no valida gráficos, audio, táctil ni una partida completa**. La APK no se ha probado todavía en un teléfono ni en un emulador Android.

La comprobación visual previa en el navegador correspondía al sitio original conectado, no a esta APK.

## Compilar en Linux

Requisitos: Python 3, JDK 17, Android SDK Platform 35 y Build Tools 35.0.0.

```bash
export ANDROID_SDK_ROOT=/ruta/al/android-sdk
bash tools/build_apk.sh
python3 tools/verify_bundle.py
npm ci --ignore-scripts
npm test
```

Salida: `build/Pokesurvivor-Offline-0.1.0-partial.apk`. No se descarga ningún recurso del juego al compilar; todo sale de la captura preservada. Los SDK y dependencias de desarrollo sí requieren una instalación previa.

El proyecto `android/` también puede abrirse en Android Studio (AGP 8.7.3, Gradle 8.9). Primero ejecutá `python3 tools/prepare_assets.py`. No se incluye Gradle Wrapper; Android Studio o Gradle instalado deben proporcionar Gradle 8.9.

En un entorno con Java runtime pero sin `javac`, el script admite `ECJ_JAR` apuntando a Eclipse ECJ 3.39.0 obtenido desde Maven Central.

## GitHub Actions y firma

`.github/workflows/android.yml` compila al subir a `main` o ejecutarlo manualmente y conserva la APK como artefacto durante 90 días. La captura y el proyecto siguen versionados en el repositorio; los artefactos de Actions no son almacenamiento permanente de releases.

El script crea una clave de pruebas en `build/debug.keystore` si no existe. Guardala fuera del repositorio: cambiarla impide instalar una actualización encima de la anterior. La clave usada para la primera APK se entrega en un archivo privado separado, fuera del ZIP preparado para GitHub.

Para mantener esa firma en Actions, configurá el secreto `POKESURVIVOR_KEYSTORE_BASE64` con el archivo de clave codificado en base64. Usa alias `androiddebugkey` y contraseña de pruebas `android`. La clave **no debe subirse a un repositorio público**. Sin el secreto, cada ejecución puede generar una firma distinta. Es una compilación de pruebas personales, no una publicación en Google Play.

## Preservación en GitHub

Repositorio: https://github.com/moportor6-art/Pokesurvivor.

`preservation/original-capture.zip` conserva la captura y la auditoría originales. `dist/Pokesurvivor-Offline-0.1.0-partial.apk` conserva la primera APK firmada. La clave de firma se mantiene fuera del repositorio.

El workflow está preparado para compilar y verificar versiones posteriores. Revisá su resultado en Actions; la presencia del workflow no certifica una compilación ni una prueba en Android.

## Créditos

Según el sitio original: proyecto fan sin ánimo de lucro; sprites SpriteCollab (CC BY-NC 4.0); Pokémon © Nintendo / Creatures / GAME FREAK. Se conservan los créditos del sitio. Estas adaptaciones no conceden permisos adicionales sobre recursos ajenos.
