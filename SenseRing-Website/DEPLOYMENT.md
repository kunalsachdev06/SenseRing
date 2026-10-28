# Deploy the SenseRing touch website

The project keeps its existing GitHub / Vercel arrangement. The website is static; the Windows companion continues to run locally on the user's laptop.

## Static build

Use Node.js 22 or later from the `Website/` repository root:

```text
npm run check
npm test
npm run build
```

There are no npm dependencies to install. The included `vercel.json` sets:

- Framework: none.
- Build command: `node scripts/build-site.js`.
- Output directory: `dist`.

The build copies only the public HTML, CSS, browser scripts, `assets/` and `downloads/`. Do not change the output directory to the repository root: backend scripts, tests, runtime logs and source files do not belong on the public site.

Before deploying, confirm that `downloads/SenseRing-Laptop-Companion.zip` and `downloads/SenseRing-Touch-Firmware.zip` contain the intended release. Rebuild after replacing either archive.

## Publish through the existing project

Review and commit the website changes in the existing SenseRing repository, then use its existing Vercel project and deployment workflow. If importing this folder separately, set the Vercel root directory to the folder containing `package.json` and `vercel.json`.

The GitHub Pages address is `https://kunalsachdev06.github.io/SenseRing/`; its root page forwards to `SenseRing-Website/`. Pushing to main triggers the configured Pages deployment. The earlier Vercel address is `https://sense-ring.vercel.app`; its deployment is separate. Local file edits do not update either host. Treat a release as live only after the deployment succeeds and its actual URL has been checked. Laptop controls require companion 2.3.2 or newer running locally and the browser's local-network permission; static hosting does not run the Windows companion.

After deployment, check the landing page, Dashboard and Controls views in both appearances and at phone width. Check the ring/inside views, profiles, the companion archive at `downloads/SenseRing-Laptop-Companion.zip`, browser console and ring connection controls. Confirm Help/setup, automatic companion discovery, actual helper readiness and clearly labelled previews. The dashboard should keep engineering details out of the normal flow; setup guidance belongs in Help. The requested connected 2% battery icon remains a fixed visual placeholder.

## Local companion and hosted origins

The hosted page cannot start a local Node process. Each Windows user must extract the full portable companion (which includes Node.js), then choose **Start-SenseRing.cmd** or the optional sign-in installer.

The companion listens only on `127.0.0.1:3199`. Its default trusted origins include the existing production site and specific localhost development origins. A different hosted domain, including a Vercel preview domain, needs an exact trusted origin in `SENSERING_ALLOWED_ORIGINS` before the companion starts. Do not use wildcard/public origin access.

The browser may ask for local-network permission when an HTTPS page checks the companion. The locally served dashboard is the fallback if hosted-to-local access is blocked.

For local development without sending Windows keys:

```powershell
$env:SENSERING_DRY_RUN='1'
node local-media-bridge.js
```

Open `http://127.0.0.1:3199/`. Dry-run mode reports system output disabled and rejects command delivery instead of pretending keys were sent. Stop the test instance before using the real companion.

## Release boundaries

- The public deployment contains browser code and downloadable archives, not a publicly hosted keyboard-control service.
- Bluetooth permission still requires a user action and device choice.
- A deployment does not flash firmware, connect a ring, install startup or validate foreground application behaviour.
- The website includes the signed Android 1.3.0 download; native Android source is a separate project.
