"""Pone al día la copia del juego (app/src/main/assets/www) con la versión de pokesurvivor.com.

uso: python3 -I tools/web/actualizar.py [--ritmo 8] [--max-horas 5]

1. Baja el código y las páginas del sitio (index, js, css, fuentes, iconos, guía, Pokédex...).
2. Lee los catálogos del juego (jslit.py sobre app.min.js + catalogo.cjs en Chrome) para saber qué archivos existen.
3. Baja solo lo nuevo y las hojas de los Pokémon cuya versión (?g=) cambió; borra lo que el juego ya no usa.
4. Vuelve a poner la capa local (inyectar.py).
El estado (qué hay, qué no existe y la versión de cada Pokémon) queda en tools/web/estado.json.
Respeta el límite del sitio: un archivo tras otro y, si responde 429, espera lo que pida.
Es reanudable: si se corta, la siguiente vez sigue donde quedó.
"""
import argparse, json, os, shutil, subprocess, sys, tempfile, time
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
WWW = ROOT / 'app/src/main/assets/www'
STATE = HERE / 'estado.json'
BASE = 'https://pokesurvivor.com/'
OURS = {'local.js', 'plus.js'}   # archivos nuestros dentro de www (no vienen del sitio)
SITE = ['index.html', 'favicon.ico', 'manifest.webmanifest', 'sw.js', 'version.json', 'css/style.css',
        'js/app.min.js', 'js/boot.js', 'js/core/locales.js', 'js/noframe.js',
        'assets/fonts/PixelifyPS-400.ttf', 'assets/fonts/PixelifyPS-700.ttf',
        'assets/icons/icon-48.png', 'assets/icons/icon-96.png', 'assets/icons/icon-144.png',
        'assets/icons/icon-180.png', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png',
        'guia/index.html', 'comunidad/index.html', 'pokedex/index.html', 'privacidad/index.html']
TYPES = ['normal', 'fuego', 'agua', 'planta', 'electrico', 'hielo', 'lucha', 'veneno', 'tierra', 'volador',
         'psiquico', 'bicho', 'roca', 'fantasma', 'dragon', 'siniestro', 'acero', 'hada',
         'fire', 'water', 'grass', 'electric', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
         'rock', 'ghost', 'dark', 'steel', 'fairy']


class Site:
    def __init__(self, rate):
        self.s = requests.Session()
        self.s.headers['User-Agent'] = 'Mozilla/5.0 (PokeSurvivor Offline; preservacion personal)'
        self.rate = rate
        self.backoff = 30
        self.last = 0.0

    def get(self, path):
        """Devuelve los bytes, None si no existe (404). Espera si el sitio pide calma (429)."""
        while True:
            wait = 1 / self.rate - (time.time() - self.last)
            if wait > 0:
                time.sleep(wait)
            self.last = time.time()
            try:
                r = self.s.get(BASE + path, timeout=30)
            except Exception as e:
                print('  error de red', path, e, flush=True)
                time.sleep(10)
                continue
            if r.status_code == 200:
                self.backoff = 30
                return r.content
            if r.status_code == 404:
                return None
            if r.status_code == 429:
                ra = r.headers.get('Retry-After')
                w = int(ra) if ra and ra.isdigit() else self.backoff
                self.backoff = min(self.backoff * 2, 600)
                self.rate = max(0.5, self.rate * 0.75)
                print(f'  429: espero {w}s (ritmo {self.rate:.2f}/s)', flush=True)
                time.sleep(w)
                continue
            raise RuntimeError(f'HTTP {r.status_code} en {path}')


def sheet_files(entry, shiny):
    """Hojas que el juego pide para un Pokémon (igual que su función de carga de sprites)."""
    out = set()
    for anim, meta in entry['a'].items():
        if shiny and entry.get('sm') and anim in entry['sm']:
            continue
        m = meta
        if shiny and entry.get('sa') and anim in entry['sa']:
            m = entry['sa'][anim]
        out.add(m.get('f') or anim)
    return sorted(out)


def wanted(sprites, cat):
    """Todos los archivos del juego. Devuelve {ruta: id de Pokémon o None}."""
    w = {}
    for pid, e in sprites.items():
        for f in sheet_files(e, False):
            w[f'assets/pokemon/{pid}/{f}.png'] = pid
        if e.get('sh'):
            for f in sheet_files(e, True):
                w[f'assets/pokemon/{pid}/s/{f}.png'] = pid
        w[f'assets/cries/{pid}.mp3'] = None
    skins = dict(cat['skins'])
    if cat.get('hat'):
        skins['hat'] = {'dex': cat['hat'], 'sh': 1}
    for sk, s in skins.items():
        ids = [s['dex']] + ([s['mega']] if isinstance(s.get('mega'), int) else list(s.get('mega') or []))
        for pid in ids:
            e = sprites.get(str(pid))
            if not e:
                continue
            for f in sheet_files(e, False):
                w[f'assets/pokemon/{pid}/k-{sk}/{f}.png'] = str(pid)
            if s.get('sh') and e.get('sh'):
                for f in sheet_files(e, True):
                    w[f'assets/pokemon/{pid}/k-{sk}/s/{f}.png'] = str(pid)
    for base in sorted(set(cat['eggs'].values())):
        w[f'assets/eggs/{base}.png'] = None
        w[f'assets/eggs/s/{base}.png'] = None
    for a in cat['arenas']:
        w[f'assets/arenas/{a}'] = None
    for m in cat['marcos']:
        w[f'assets/tienda/marcos/{m["id"]}.png'] = None
        if m['anim']:
            w[f'assets/tienda/marcos/{m["id"]}-anim.png'] = None
    for t in TYPES:
        w[f'assets/tienda/marcos/maestria_{t}.png'] = None
        w[f'assets/tienda/marcos/maestria_{t}-anim.png'] = None
    for dex, (norm, shiny) in cat['fotos'].items():
        for x in norm:
            w[f'assets/tienda/fotos-perfil/{dex}/{x}.png'] = None
        for x in shiny:
            w[f'assets/tienda/fotos-perfil/{dex}/s/{x}.png'] = None
    return w


def write(path, data):
    p = WWW / path
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_name(p.name + '.part')
    tmp.write_bytes(data)
    os.replace(tmp, p)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ritmo', type=float, default=8.0)
    ap.add_argument('--max-horas', type=float, default=5.0)
    args = ap.parse_args()
    t_end = time.time() + args.max_horas * 3600
    site = Site(args.ritmo)
    state = json.loads(STATE.read_text()) if STATE.exists() else {'files': {}, 'g': {}, 'version': ''}

    # 1. Código y páginas (siempre; son pocos)
    ver = json.loads(site.get('version.json') or b'{}').get('v', '')
    print('versión del sitio:', ver, '· la copia tenía:', state.get('version') or '(ninguna)', flush=True)
    for p in SITE:
        data = site.get(p)
        if data is not None:
            write(p, data)
    # Páginas del sitio (guía, Pokédex, jefes, logros, novedades... ES/EN) con lo que usan
    subprocess.run([sys.executable, '-I', str(HERE / 'paginas.py'), str(WWW), '2'], check=True)
    pages = set(json.loads((WWW.parent / 'paginas.json').read_text()))
    (WWW.parent / 'paginas.json').unlink()
    subprocess.run([sys.executable, '-I', str(HERE / 'inyectar.py'), str(WWW)], check=True)

    # 2. Catálogos
    with tempfile.TemporaryDirectory() as td:
        lit = Path(td) / 'cat.json'
        subprocess.run([sys.executable, '-I', str(HERE / 'jslit.py'), str(WWW / 'js/app.min.js'), str(lit)], check=True)
        sprites = json.loads(lit.read_text())['sprites']
        ids = Path(td) / 'ids.json'
        ids.write_text(json.dumps(list(sprites)))
        rt = Path(td) / 'rt.json'
        subprocess.run(['node', str(HERE / 'catalogo.cjs'), str(ids), str(rt)], check=True, cwd=str(HERE))
        cat = json.loads(rt.read_text())
    w = wanted(sprites, cat)
    print(f'el juego usa {len(w)} archivos', flush=True)

    # 3. Qué bajar: lo que falta, y las hojas de los Pokémon cuya versión cambió
    files = state['files']
    changed = {pid for pid, g in cat['g'].items() if state['g'].get(pid) not in (None, g)}
    if changed:
        print(f'{len(changed)} Pokémon con hojas nuevas', flush=True)
    todo = [p for p, pid in w.items()
            if files.get(p) is None or (pid in changed and files.get(p) == 'ok')
            or (files.get(p) == 'ok' and not (WWW / p).is_file())]
    # Orden: lo que se ve primero (hojas normales, gritos, huevos), luego shiny/skins, marcos y fotos de perfil
    def prio(p):
        if '/fotos-perfil/' in p: return 4
        if '/marcos/' in p: return 3
        if p.startswith('assets/pokemon/') and ('/s/' in p or '/k-' in p): return 2
        return 1
    todo.sort(key=prio)
    print(f'por bajar: {len(todo)}', flush=True)
    done = 0
    t0 = time.time()
    complete = True
    for p in todo:
        if time.time() > t_end:
            print('se acabó el tiempo de esta pasada: sigue en la próxima', flush=True)
            complete = False
            break
        data = site.get(p)
        if data is None:
            files[p] = 'no'
            (WWW / p).unlink(missing_ok=True)
        else:
            write(p, data)
            files[p] = 'ok'
        done += 1
        if done % 500 == 0:
            STATE.write_text(json.dumps(state, separators=(',', ':'), sort_keys=True))
            print(f'  {done}/{len(todo)} · {done / (time.time() - t0):.1f}/s', flush=True)

    # Versiones: solo se dan por buenas las de los Pokémon con todas sus hojas al día
    pending = {w[p] for p in todo[done:] if w.get(p)}
    for pid, g in cat['g'].items():
        if pid not in pending:
            state['g'][pid] = g

    # 4. Lo que el juego ya no usa se borra (p. ej. sprites retirados)
    if complete:
        keep = set(w) | set(SITE) | pages | OURS
        removed = 0
        for f in list(WWW.rglob('*')):
            if f.is_file():
                rel = f.relative_to(WWW).as_posix()
                if rel not in keep:
                    f.unlink()
                    removed += 1
        for p in list(files):
            if p not in w:
                del files[p]
        for d in sorted((d for d in WWW.rglob('*') if d.is_dir()), key=lambda d: -len(d.parts)):
            if not any(d.iterdir()):
                d.rmdir()
        if removed:
            print(f'borrados {removed} archivos que el juego ya no usa', flush=True)
        state['version'] = ver
    STATE.write_text(json.dumps(state, separators=(',', ':'), sort_keys=True))
    ok = sum(1 for v in files.values() if v == 'ok')
    print(f'listo: {ok} archivos del juego en la copia · {"completa" if complete else "incompleta (sigue después)"}', flush=True)


if __name__ == '__main__':
    main()
