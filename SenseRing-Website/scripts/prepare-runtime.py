"""Prepare the pinned Windows x64 runtime for the portable companion release."""
from pathlib import Path
import hashlib
import json
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
VERSION = "24.22.1"
SHA256 = "d702daa815eabbff763c7d3808e235cf031cf2ca70211b56847bc72f51e240e5"
BASE = f"https://nodejs.org/dist/v{VERSION}"


def download(url, destination):
    with urllib.request.urlopen(url, timeout=180) as response, destination.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)


def main():
    runtime = ROOT / "runtime"
    runtime.mkdir(exist_ok=True)
    binary = runtime / "node.exe"
    if not binary.is_file() or hashlib.sha256(binary.read_bytes()).hexdigest() != SHA256:
        temporary = runtime / "node.exe.download"
        download(f"{BASE}/win-x64/node.exe", temporary)
        if hashlib.sha256(temporary.read_bytes()).hexdigest() != SHA256:
            temporary.unlink(missing_ok=True)
            raise RuntimeError("Downloaded Node runtime failed the pinned checksum")
        temporary.replace(binary)
    license_file = runtime / "LICENSE.txt"
    if not license_file.is_file():
        download(f"https://raw.githubusercontent.com/nodejs/node/v{VERSION}/LICENSE", license_file)
    (runtime / "release.json").write_text(json.dumps({
        "name": "Node.js", "version": VERSION, "platform": "win-x64",
        "sha256": SHA256, "source": f"{BASE}/win-x64/node.exe",
        "checksums": f"{BASE}/SHASUMS256.txt",
    }, indent=2) + "\n", encoding="utf-8")
    print(f"Verified Node.js {VERSION}, Windows x64; license included")


if __name__ == "__main__":
    main()
