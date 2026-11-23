"""Manifiesto del contenido del juego para el actualizador de la app.

  manifiesto.py <build> <commit> <salida.json>
      Lista cada archivo del juego (assets/www) con su SHA-256 y tamaño, y una huella de la parte
      nativa (Java, manifiesto, recursos, Gradle): si la huella cambia, la actualización necesita la APK completa.
  manifiesto.py --apk <app.apk> <entrada.json> <salida.json>
      Copia el manifiesto y le agrega el SHA-256 y el tamaño de la APK (para la publicación).
"""
import hashlib, json, os, sys

GAME = 'app/src/main/assets/www'
NATIVE = ['app/src/main/java', 'app/src/main/res', 'app/src/main/AndroidManifest.xml', 'app/build.gradle',
          'build.gradle', 'settings.gradle', 'gradle.properties', 'gradle/wrapper', 'app/release.keystore']


def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 16), b''):
            h.update(b)
    return h.hexdigest()


def walk(p):
    if os.path.isfile(p):
        yield p
        return
    for d, _, fs in os.walk(p):
        for f in fs:
            yield os.path.join(d, f)


if sys.argv[1] == '--apk':
    apk, src, out = sys.argv[2:5]
    m = json.load(open(src))
    m['apk'] = {'name': os.path.basename(apk), 'sha': sha(apk), 'size': os.path.getsize(apk)}
    json.dump(m, open(out, 'w'), separators=(',', ':'))
    sys.exit(0)

build, commit, out = int(sys.argv[1]), sys.argv[2], sys.argv[3]
files = {}
for f in sorted(walk(GAME)):
    rel = os.path.relpath(f, GAME).replace(os.sep, '/')
    files[rel] = {'s': sha(f), 'n': os.path.getsize(f)}
nat = hashlib.sha256()
for p in NATIVE:
    for f in sorted(walk(p)):
        nat.update(f.replace(os.sep, '/').encode())
        nat.update(sha(f).encode())
os.makedirs(os.path.dirname(out), exist_ok=True)
json.dump({'build': build, 'commit': commit, 'native': nat.hexdigest(), 'files': files}, open(out, 'w'), separators=(',', ':'))
print(f'{len(files)} archivos · nativo {nat.hexdigest()[:12]}')
