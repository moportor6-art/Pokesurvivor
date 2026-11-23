#!/usr/bin/env python3
"""Build local assets from preserved originals; never fetch network resources."""
from pathlib import Path
import hashlib,json,shutil,zipfile
ROOT=Path(__file__).resolve().parents[1]
ARCHIVE=ROOT/'preservation/original-capture.zip'
OUT=ROOT/'android/app/src/main/assets'

def replace_once(text,old,new):
    if text.count(old)!=1:raise RuntimeError(f'Upstream anchor changed: {old[:80]} ({text.count(old)} matches)')
    return text.replace(old,new,1)

def main():
    if OUT.exists():shutil.rmtree(OUT)
    game=OUT/'game';game.mkdir(parents=True)
    with zipfile.ZipFile(ARCHIVE) as z:
        for item in z.infolist():
            prefix='resources/pokesurvivor.com/'
            if not item.filename.startswith(prefix) or item.is_dir():continue
            relative=Path(item.filename[len(prefix):])
            if str(relative)=='index.html/index.html':relative=Path('index.html')
            if '..' in relative.parts or relative.is_absolute():raise RuntimeError('Unsafe archive path')
            dest=game/relative;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(z.read(item))
        summary=json.loads(z.read('audit/summary.json'))
    js=game/'js/app.min.js';source=js.read_text()
    # Preserve the original engine. Only adapt the already-local guest profile.
    source=replace_once(source,"ad=aB('Invitado')", "ad=(function(){var fresh=aB('Invitado');try{var old=JSON.parse(localStorage.getItem('ps.offline.save.v1')||'null');if(old&&typeof old==='object'&&!Array.isArray(old)&&old.owned)return Object.assign(fresh,old);}catch(e){}return fresh;})()")
    source=replace_once(source,"function cU(){return!(ac||!ab||!ad)","function cU(){if(ac&&ad){au('ps.offline.save.v1',ad);return true;}return!(ac||!ab||!ad)")
    source=replace_once(source,"let cT=null;function cU()", "window.addEventListener('ps-offline-save',function(){if(ac&&ad)au('ps.offline.save.v1',ad);});window.addEventListener('pagehide',function(){if(ac&&ad)au('ps.offline.save.v1',ad);});setInterval(function(){if(ac&&ad)au('ps.offline.save.v1',ad);},2000);let cT=null;function cU()")
    # Original local mode is selected naturally for the local appassets host.
    source=replace_once(source,"'serviceWorker'in navigator&&", "!window.PS_OFFLINE&&'serviceWorker'in navigator&&")
    js.write_text(source)
    html=game/'index.html';s=html.read_text()
    # Inject a visible offline edition notice. All original resources stay local.
    s=replace_once(s,'<head>','<head>\n<script src="offline-adapter.js"></script>')
    html.write_text(s)
    shutil.copyfile(ROOT/'web/offline-adapter.js',game/'offline-adapter.js')
    shutil.copyfile(ROOT/'web/offline.html',OUT/'offline.html')
    (OUT/'capture-summary.json').write_text(json.dumps(summary,indent=2))
    assets={str(p.relative_to(OUT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in OUT.rglob('*') if p.is_file()}
    (ROOT/'preservation/bundled-assets-sha256.json').write_text(json.dumps(assets,indent=2))
    print(f'Prepared {len(assets)} bundled files; no network used.')
if __name__=='__main__':main()
