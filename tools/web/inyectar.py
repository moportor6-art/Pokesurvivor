"""Pone la capa local (local.js) en el index.html del juego, antes de cualquier otro script.

uso: python3 -I inyectar.py <carpeta del juego>
Es lo único que se cambia del juego original. Si el index.html ya la tiene, no hace nada.
"""
import re, sys
from pathlib import Path

TAG = '<script src="local.js"></script>'
www = Path(sys.argv[1])
idx = www / 'index.html'
html = idx.read_text(encoding='utf-8')
if TAG not in html:
    m = re.search(r'<head[^>]*>', html, re.I)
    if not m:
        raise SystemExit('index.html sin <head>: el sitio cambió, revisar a mano')
    html = html[:m.end()] + '\n' + TAG + html[m.end():]
    idx.write_text(html, encoding='utf-8')
    print('capa local puesta en index.html')
else:
    print('index.html ya tenía la capa local')
if not (www / 'local.js').is_file():
    raise SystemExit('falta local.js en ' + str(www))
