"""Baja las páginas del sitio (guía, Pokédex, jefes, logros, novedades... en español e inglés) con todo lo que usan.

uso: python3 -I tools/web/paginas.py <carpeta www> [ritmo por segundo] [estado.json]
Recorre los enlaces internos desde index.html. No toca las hojas de sprites, gritos, huevos ni fotos
(de eso se encarga actualizar.py). Devuelve en <carpeta>/../paginas.json la lista de archivos de páginas.
"""
import json, re, sys, time
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests

BASE = 'https://pokesurvivor.com/'
# lo que no va: hojas y fotos (actualizar.py), y las páginas de apoyo/donaciones y contacto (todo local, sin pagos)
SKIP = re.compile(r'^(assets/(pokemon|cries|eggs|tienda)/|(en/)?(apoyar|support|contacto|contact)/)')


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.found = []

    def handle_starttag(self, tag, attrs):
        for k, v in attrs:
            if k in ('href', 'src', 'poster', 'data-src') and v:
                self.found.append(v)
            if k == 'srcset' and v:
                self.found += [x.strip().split(' ')[0] for x in v.split(',')]


def local_path(url):
    """Ruta dentro del sitio, o None si es de otro sitio."""
    u = urlparse(url)
    if u.scheme not in ('http', 'https') or u.netloc not in ('pokesurvivor.com', 'www.pokesurvivor.com'):
        return None
    p = u.path.lstrip('/')
    if p == '' or p.endswith('/'):
        p += 'index.html'
    return p


def main():
    www = Path(sys.argv[1])
    rate = float(sys.argv[2]) if len(sys.argv) > 2 else 2.0
    s = requests.Session()
    s.headers['User-Agent'] = 'Mozilla/5.0 (PokeSurvivor Offline; preservacion personal)'
    seen, queue, got = set(), ['index.html'], []
    last, backoff = 0.0, 30
    while queue:
        p = queue.pop(0)
        if p in seen:
            continue
        seen.add(p)
        while True:
            w = 1 / rate - (time.time() - last)
            if w > 0:
                time.sleep(w)
            last = time.time()
            r = s.get(BASE + p, timeout=30)
            if r.status_code == 429:
                ra = r.headers.get('Retry-After')
                time.sleep(int(ra) if ra and ra.isdigit() else backoff)
                backoff = min(backoff * 2, 600)
                continue
            break
        if r.status_code != 200:
            continue
        f = www / p
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_bytes(r.content)
        got.append(p)
        ctype = r.headers.get('content-type', '')
        refs = []
        if 'html' in ctype or p.endswith('.html'):
            lp = Links()
            lp.feed(r.text)
            refs = lp.found
        elif p.endswith('.css'):
            refs = re.findall(r'url\(\s*["\']?([^"\')]+)', r.text)
        elif p.endswith('.js') and not p.startswith('js/'):
            # scripts de las páginas: rutas literales a datos e imágenes
            refs = re.findall(r'["\']([\w./-]+\.(?:json|png|jpg|webp|js|css|svg|mp3))["\']', r.text)
        for ref in refs:
            if ref.startswith(('mailto:', 'javascript:', 'data:', '#')):
                continue
            lp2 = local_path(urljoin(BASE + p, ref))
            if lp2 and lp2 not in seen and not SKIP.match(lp2):
                queue.append(lp2)
        if len(got) % 25 == 0:
            print(f'  páginas y archivos: {len(got)} · en cola {len(queue)}', flush=True)
    out = www.parent / 'paginas.json'
    out.write_text(json.dumps(sorted(got)))
    print(f'listo: {len(got)} archivos de páginas', flush=True)


if __name__ == '__main__':
    main()
