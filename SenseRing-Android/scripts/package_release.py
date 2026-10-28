"""Package the already verified release without private keys, caches or SDK files."""
from pathlib import Path
import hashlib
import shutil
import zipfile

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'outputs'
VERSION = '1.3.0'
APK = ROOT / 'app/build/outputs/apk/release/app-release.apk'

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    if not APK.is_file():
        raise SystemExit('Build and verify the signed release APK first.')
    for name in ('README.md', 'RESEARCH.md', 'VALIDATION.md'):
        if not (ROOT / name).is_file():
            raise SystemExit('Missing release document: ' + name)
    OUT.mkdir(exist_ok=True)
    destination = OUT / f'SenseRing-Android-{VERSION}.apk'
    shutil.copyfile(APK, destination)
    if digest(APK) != digest(destination):
        raise RuntimeError('APK copy differs from the verified build.')
    roots = ['app/src', 'core/src', 'scripts', 'gradle']
    files = [ROOT / p for p in ('.gitignore', 'README.md', 'RESEARCH.md', 'VALIDATION.md',
        'settings.gradle.kts', 'build.gradle.kts', 'gradle.properties', 'gradlew', 'gradlew.bat',
        'app/build.gradle.kts', 'app/proguard-rules.pro', 'core/build.gradle.kts')]
    files += [p for root in roots for p in (ROOT / root).rglob('*') if p.is_file()]
    screenshots = ROOT / 'screenshots'
    if screenshots.exists():
        files += list(screenshots.glob('*.png'))
    forbidden = {'.signing', '.toolchain', '.gradle', '.git', 'build', '__pycache__'}
    archive = OUT / f'SenseRing-Android-Source-{VERSION}.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for path in sorted(set(files)):
            relative = path.relative_to(ROOT)
            if any(part in forbidden for part in relative.parts) or path.suffix in ('.p12', '.jks', '.keystore', '.pyc'):
                raise RuntimeError('Private or generated file selected: ' + str(relative))
            z.write(path, Path('SenseRing-Android') / relative)
    with zipfile.ZipFile(archive) as z:
        if z.testzip() is not None:
            raise RuntimeError('Source archive CRC verification failed.')
        names = z.namelist()
        assert any(n.endswith('gradle-wrapper.jar') for n in names)
        assert not any('local.properties' in n or '/.signing/' in n for n in names)
    manifest = ''.join(f'{digest(path)}  {path.name}\n' for path in (destination, archive))
    (OUT / 'SHA256SUMS.txt').write_text(manifest, encoding='utf-8')
    print('Packaged APK and editable source; checksums and archive CRC verified.')
    for path in (destination, archive):
        print(f'{path.name}: {path.stat().st_size:,} bytes')

if __name__ == '__main__':
    main()
