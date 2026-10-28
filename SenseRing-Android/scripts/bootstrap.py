"""Download verified Gradle and Google's SDK manager into this checkout only.
SDK licences are reviewed/accepted separately through sdkmanager; this script
does not accept agreements or change system environment variables.
"""
from pathlib import Path
import hashlib
import urllib.request
import zipfile
import xml.etree.ElementTree as ET
import subprocess

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / '.toolchain'
DOWNLOADS = TOOLS / 'downloads'
DOWNLOADS.mkdir(parents=True, exist_ok=True)

def get(url):
    with urllib.request.urlopen(url, timeout=90) as response:
        return response.read()

def download(url, filename, expected, algorithm='sha256'):
    target = DOWNLOADS / filename
    if not target.exists() or hashlib.new(algorithm, target.read_bytes()).hexdigest().lower() != expected.strip().lower():
        print('Downloading', filename, flush=True)
        subprocess.run(['curl.exe', '--fail', '--location', '--retry', '2', '--connect-timeout', '20',
                        '--max-time', '300', '--silent', '--show-error', '--output', str(target), url], check=True)
    actual = hashlib.new(algorithm, target.read_bytes()).hexdigest()
    if actual.lower() != expected.strip().lower():
        raise RuntimeError('Checksum mismatch: ' + filename)
    print('Verified', filename, flush=True)
    return target

gradle_name = 'gradle-8.14.3-bin.zip'
gradle = download('https://downloads.gradle.org/distributions/' + gradle_name,
                  gradle_name, get('https://services.gradle.org/distributions/' + gradle_name + '.sha256').decode())
if not (TOOLS / 'gradle-8.14.3/bin/gradle.bat').exists():
    with zipfile.ZipFile(gradle) as z: z.extractall(TOOLS)

repo = ET.fromstring(get('https://dl.google.com/android/repository/repository2-1.xml'))
package = next(p for p in repo.iter('remotePackage') if p.attrib.get('path') == 'cmdline-tools;19.0')
archive = next(a for a in package.findall('./archives/archive') if a.findtext('host-os') == 'windows')
complete = archive.find('complete')
checksum = complete.find('checksum')
sdk_zip = download('https://dl.google.com/android/repository/' + complete.findtext('url'),
                   'android-commandline-tools-19.zip', checksum.text, checksum.attrib.get('type', 'sha1'))
destination = TOOLS / 'android-sdk/cmdline-tools/19.0'
if not (destination / 'bin/sdkmanager.bat').exists():
    with zipfile.ZipFile(sdk_zip) as z:
        for item in z.infolist():
            if item.is_dir(): continue
            relative = Path(item.filename).relative_to('cmdline-tools')
            target = destination / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(z.read(item))
print('Build tools prepared in', TOOLS, flush=True)
