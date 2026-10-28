"""Copy the signed Android delivery and its actual dashboard capture into the site."""
from pathlib import Path
import hashlib
import json
import re
import shutil

ROOT = Path(__file__).resolve().parent.parent
ANDROID = ROOT.parent / "Android"

def main():
    source = (ANDROID / "app/build.gradle.kts").read_text(encoding="utf-8")
    version = re.search(r'versionName\s*=\s*"([0-9.]+)"', source).group(1)
    apk = ANDROID / "outputs" / f"SenseRing-Android-{version}.apk"
    capture = ANDROID / "screenshots/Dashboard-dark.png"
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    assert f"downloads/{apk.name}" in html, "Website APK link and app version differ"
    assert apk.is_file() and capture.is_file(), "Build/package Android and capture its dashboard first"
    downloads = ROOT / "downloads"
    assets = ROOT / "assets/android"
    downloads.mkdir(exist_ok=True)
    assets.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(apk, downloads / apk.name)
    shutil.copyfile(capture, assets / "dashboard-dark.png")
    digest = hashlib.sha256(apk.read_bytes()).hexdigest()
    assert hashlib.sha256((downloads / apk.name).read_bytes()).hexdigest() == digest
    (downloads / "SenseRing-Android-SHA256.txt").write_text(f"{digest}  {apk.name}\n", encoding="utf-8")
    release = {"version": version, "minimumAndroid": "10", "file": apk.name,
               "bytes": apk.stat().st_size, "sha256": digest}
    (downloads / "android-release.json").write_text(json.dumps(release, indent=2) + "\n", encoding="utf-8")
    print(f"Copied signed Android {version}, verified its hash and added the actual dashboard capture.")

if __name__ == "__main__":
    main()
