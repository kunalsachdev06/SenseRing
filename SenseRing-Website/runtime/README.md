# Portable companion runtime

The companion ZIP includes the unmodified official Node.js 24.22.1 Windows x64 binary and its full license. The executable is not installed globally and does not change PATH. The launcher prefers `runtime/node.exe` in its own extracted folder.

`release.json` records its source and SHA-256. `SHASUMS256.txt` is the official release checksum list. The pinned binary hash was checked against the `win-x64/node.exe` entry. See the [Node.js release page](https://nodejs.org/en/about/previous-releases) and [official distribution](https://nodejs.org/dist/v24.22.1/).

Maintainers: run `python scripts/prepare-runtime.py` before packaging. The executable is ignored by Git; `package-release.py` refuses to create a companion with a missing or mismatched binary. To update the runtime, review the official release and update the pinned version/hash together, including its matching license. Do not substitute this development environment's modified runtime.
