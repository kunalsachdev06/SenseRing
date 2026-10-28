"""Package the final firmware without any external reference checkout; Python stdlib only."""
from pathlib import Path
import hashlib, json, re, zipfile
ROOT = Path(__file__).resolve().parent

def main():
    cfg = (ROOT/'SenseRing_Touch/RingConfig.h').read_text(encoding='utf-8')
    expected = {'DEVICE_NAME':'SmartRing', 'SERVICE_UUID':'12345678-1234-1234-1234-123456789abc',
                'EVENT_UUID':'abcd1234-ab12-ab12-ab12-abcdef123456',
                'STATUS_UUID':'abcd1234-ab12-ab12-ab12-abcdef123457'}
    for name, value in expected.items():
        match = re.search(rf'{name}\[\]\s*=\s*"([^"]+)"', cfg)
        if not match or match.group(1) != value:
            raise RuntimeError('Protocol mismatch: ' + name)
    selected = [p for p in ROOT.rglob('*') if p.is_file() and not p.is_symlink()
                and (p.suffix.lower() in {'.md','.ino','.h','.cpp','.py'} or p.name in {'.gitignore','.gitattributes'})
                and not any(part.startswith('.build') or part in {'.git','__pycache__','.downloads','.arduino-user'}
                            for part in p.relative_to(ROOT).parts)]
    manifest = {p.relative_to(ROOT).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(selected)}
    target = ROOT/'SenseRing-Touch-Firmware.zip'
    (ROOT/'SHA256.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for p in sorted(selected)+[ROOT/'SHA256.json']:
            z.write(p,Path('SenseRing-Touch-Firmware')/p.relative_to(ROOT))
    with zipfile.ZipFile(target) as z:
        if z.testzip(): raise RuntimeError('Archive CRC failure')
        for name,digest in manifest.items():
            if hashlib.sha256(z.read('SenseRing-Touch-Firmware/'+name)).hexdigest()!=digest:
                raise RuntimeError('Archive hash mismatch: '+name)
    print('Firmware source archive, protocol constants and hashes verified.')
if __name__=='__main__': main()
