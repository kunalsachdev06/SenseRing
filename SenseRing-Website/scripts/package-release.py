"""Create the self-contained companion and reviewable source archives. Python 3 stdlib only."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib
import json

ROOT = Path(__file__).resolve().parent.parent
DOWNLOADS = ROOT / "downloads"
ARTIFACTS = ROOT / "artifacts"
PUBLIC = ["index.html", "gesture-ring-style.css", "gesture-ring-script.js", "sense-ring-core.js", "product-state.js", "companion-state.js", "theme.js", "ring-visual.js", "android-section.css", "android-experience.js"]
COMPANION = PUBLIC + ["local-media-bridge.js", "Start-SenseRing.cmd", "Stop-SenseRing.cmd", "README.md", "BRIDGE_SETUP.md", "DEPLOYMENT.md", "VALIDATION.md", "PRODUCT_RESEARCH.md", "package.json", "RIGHTS_AND_NOTICES.md"]


def files_under(folder):
    return sorted(p for p in (ROOT / folder).rglob("*") if p.is_file() and not p.is_symlink() and not any(x.startswith(".") for x in p.relative_to(ROOT).parts))


def archive(target, prefix, files):
    unique = sorted(set(files))
    with ZipFile(target, "w", compression=ZIP_DEFLATED, compresslevel=9) as output:
        for file in unique:
            if not file.is_file():
                raise FileNotFoundError(file)
            output.write(file, str(Path(prefix) / file.relative_to(ROOT)).replace("\\", "/"))
    with ZipFile(target) as check:
        bad = check.testzip()
        if bad:
            raise RuntimeError(f"Archive failed its integrity check: {bad}")
        if len(check.namelist()) != len(unique):
            raise RuntimeError("Archive entry count mismatch")
    print(f"{target.relative_to(ROOT)}: {len(unique)} files, {target.stat().st_size:,} bytes; integrity verified")


def main():
    DOWNLOADS.mkdir(exist_ok=True)
    ARTIFACTS.mkdir(exist_ok=True)
    runtime = ROOT / 'runtime/node.exe'
    metadata = json.loads((ROOT / 'runtime/release.json').read_text(encoding='utf-8'))
    if not runtime.is_file() or hashlib.sha256(runtime.read_bytes()).hexdigest() != metadata['sha256']:
        raise RuntimeError('Prepare and verify the bundled runtime using scripts/prepare-runtime.py before packaging')
    companion = [ROOT / p for p in COMPANION]
    companion += files_under("runtime")
    companion += files_under("assets")
    companion += files_under("Firmware")
    # Explicit download selection prevents an archive containing itself.
    companion.append(DOWNLOADS / "SenseRing-Touch-Firmware.zip")
    companion += [DOWNLOADS / "SenseRing-Android-1.3.0.apk", DOWNLOADS / "SenseRing-Android-SHA256.txt", DOWNLOADS / "android-release.json"]
    companion += files_under("scripts") + files_under("tests")
    archive(DOWNLOADS / "SenseRing-Laptop-Companion.zip", "SenseRing-Companion", companion)
    source = [ROOT / p for p in COMPANION + [".gitignore", "vercel.json", "DEPLOYMENT.md", "VALIDATION.md", "PRODUCT_RESEARCH.md"]]
    for folder in ["assets", "Firmware", "legacy", "scripts", "tests"]:
        source += files_under(folder)
    source += [p for p in files_under("runtime") if p.suffix != '.exe']
    source += [DOWNLOADS / "SenseRing-Touch-Firmware.zip", DOWNLOADS / "SenseRing-Laptop-Companion.zip"]
    source += [DOWNLOADS / "SenseRing-Android-1.3.0.apk", DOWNLOADS / "SenseRing-Android-SHA256.txt", DOWNLOADS / "android-release.json"]
    archive(ARTIFACTS / "SenseRing-Website-Source.zip", "SenseRing-Website", source)


if __name__ == "__main__":
    main()
