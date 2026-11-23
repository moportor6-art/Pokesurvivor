#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,zipfile
ROOT=Path(__file__).resolve().parents[1]
assets=ROOT/'android/app/src/main/assets'
apk=ROOT/'build/Pokesurvivor-Offline-0.1.0-partial.apk'
manifest=json.loads((ROOT/'preservation/bundled-assets-sha256.json').read_text())
changed={'index.html','js/app.min.js'}
checked=0
with zipfile.ZipFile(ROOT/'preservation/original-capture.zip') as z:
    for item in z.infolist():
        prefix='resources/pokesurvivor.com/'
        if not item.filename.startswith(prefix) or item.is_dir():continue
        name=item.filename[len(prefix):]
        if name=='index.html/index.html':name='index.html'
        if name in changed:continue
        assert z.read(item)==(assets/'game'/name).read_bytes(),f'Original bytes changed: {name}'
        checked+=1
with zipfile.ZipFile(apk) as z:
    assert z.testzip() is None
    assert 'classes.dex' in z.namelist()
    for name,digest in manifest.items():assert hashlib.sha256(z.read('assets/'+name)).hexdigest()==digest,name
assert 'android.permission.INTERNET' not in (ROOT/'build/permissions.txt').read_text()
print(f'PASS: {checked} original files unchanged; {len(manifest)} APK assets match; no INTERNET permission.')
