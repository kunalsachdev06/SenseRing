# SenseRing laptop companion

The website receives the ring's Bluetooth events. This small local companion delivers the resulting music/presentation keys to Windows. It keeps the script arrangement while removing the need to open a terminal each time.

## First use on Windows

1. Choose **Help → Download for Windows** on the website, then extract the **complete** companion ZIP into a permanent folder. Keep `runtime/`, `local-media-bridge.js`, `scripts/`, and the website assets together. Do not run directly from inside a ZIP archive. If updating, stop the previous copy first.
2. Use Windows 10 or 11, 64-bit. The ZIP includes the official, checksum-verified Node.js **24.22.1** runtime and license; a separate Node installation is not needed. The launcher prefers this included runtime. Source-only development can use an existing Node.js 22+ installation as a fallback.
3. Double-click **Start-SenseRing.cmd** in the extracted folder. It invokes the hidden VBS/PowerShell launcher, starts the companion in the background and opens `http://127.0.0.1:3199/` in your default browser. A command window may flash briefly, but no terminal needs to remain open. For an entirely hidden launch, double-click `scripts/Start-SenseRing.vbs` instead. Use Chrome or Edge for the Bluetooth connection.
4. Connect the ring in the website. Preview buttons are simulated unless their separate system-delivery checkbox is enabled. That checkbox applies only to preview clicks: **live ring gestures are sent automatically whenever the companion is available**. After connecting and checking the mode, focus your actual music app, PowerPoint, or Google Slides; Page Up, Page Down and Enter go to the foreground application.

Once the companion is running, the existing HTTPS website at `https://sense-ring.vercel.app` can also use it, subject to the browser's local-network permission. If the browser blocks local access, use the locally served dashboard. A web page cannot launch or install a local Node process by itself.

No command is delivered by opening the dashboard or checking companion health. On enabled Windows companions, the hidden PowerShell keyboard helper prepares in the background when the companion starts, and later commands reuse it. Preparation compiles the helper without sending a key. Health reports its actual readiness separately from whether execution is enabled. Commands received while Starting/Unavailable are rejected with HTTP 503 and never saved for later. **Help → Retry connection** can prepare a failed helper again without sending a key; ordinary health polls do not restart it. Each accepted request still has a four-second server lifetime; expired gestures are not sent later or automatically replayed. Check the foreground app before repeating a gesture.

If the old terminal-based bridge is already using port 3199, stop it in its own terminal with Ctrl+C before starting this companion. The launcher does not kill an unknown process to free the port. An old bridge may not support the new health/session-token contract, so close the old instance and launch the extracted current version.

## Optional: start quietly at Windows sign-in

Double-click `scripts/Install-Startup.cmd` once. It creates a **current-user** Startup shortcut pointing to this extracted folder. No administrator account is required. It starts only the background companion at sign-in, not a browser or a ring connection. It does not bypass the browser's Bluetooth device picker.

Keep the folder in place. If you move it, run the installer again from the new location. To remove startup, run `scripts/Remove-Startup.cmd` from the matching installation. These installers are provided for your choice; they were not executed during development.

To stop a running companion, double-click **Stop-SenseRing.cmd** in the extracted folder (or `scripts/Stop-SenseRing.vbs` for an entirely hidden launch). It verifies the local health response and sends a token-protected shutdown request. It does not kill unrelated Node processes. Removing startup and stopping an already running companion are separate actions.

The launchers use Windows Script Host and PowerShell. If an organisation policy disables either, do not bypass that policy; the manual Node command below remains an option where allowed. The launcher passes an execution-policy option only to its own PowerShell process and does not change the machine's persistent PowerShell policy.

## Manual fallback / diagnostics

From the extracted website folder:

```text
node local-media-bridge.js
```

Then open `http://127.0.0.1:3199/`. The service listens only on `127.0.0.1`, never a Wi-Fi/LAN interface. Normal launch delivers actual allowlisted keys only on Windows. On other platforms, or with `SENSERING_DRY_RUN=1`, health reports `executionEnabled: false` and real command requests return an error rather than pretending success.

Hidden-launch logs are in `.runtime/bridge.log`, `.runtime/bridge-error.log` and, for launcher failures, `.runtime/launcher-error.log`. These files are not served by the web server. No session tokens or keyboard scripts are written to logs. If the port belongs to another program, the launcher leaves it alone.

## HTTP contract for this website

- `GET /health`: `{ok, name: "SenseRing Bridge", version, platform, executionEnabled, executorState, executorReady, commands, sessionToken}`. `executionEnabled` is configuration; `executorReady` is true only after the helper's READY handshake. `executorState` is `starting`, `ready`, `unavailable` or `disabled`. A health response does not establish that a physical ring is connected.
- `POST /prepare`: same session-token/JSON/origin protections as command requests, body `{}`. Retries an unavailable helper asynchronously (202 while starting, 200 when ready), deduplicates concurrent startup and limits repeated failed attempts. It never sends a key. Disabled companions return 409.
- `POST /command`: `Content-Type: application/json`, `X-SenseRing-Token: <sessionToken>`, body `{"command":"SLIDE_NEXT"}`. Success is returned only after the key executor reports success.
- `POST /shutdown`: the same headers and token, body `{}`. Used by the stop launcher.

The session token is randomly generated on each start and kept in process memory. A website should refresh health after the companion restarts. Do not put the token in URLs or store it in persistent browser storage. The browser can allow up to 15 seconds to receive an HTTP response, but the server stops treating an action as fresh after **four seconds from HTTP receipt**, including request-body processing, queue waiting and helper startup. It returns HTTP 504 when that lifetime expires, skips expired/cancelled queued work, and checks the deadline again after helper startup and immediately before dispatch. The PowerShell worker receives the same numeric deadline and checks UTC time before injecting the key. Timers and response listeners are cleaned after completion, and expired queue slots are retained until their work settles so a stalled helper cannot create an unbounded queue.

Website 3.2 dispatches each recognized notification before UI work without waiting for earlier HTTP replies. Only the companion serializes OS execution; there is no second waiting queue in the browser. In-flight browser requests remain bounded at eight and are all cancelled on pause or a mode/session change. The helper remains prepared in the background rather than recompiling a PowerShell type for every gesture, as the original bridge did.

An expired response means delivery was not confirmed; a key already sent before its deadline cannot be undone. The website must not replay an expired action automatically. The four-second lifetime is measured from the companion's HTTP receipt, not directly from the sensor's physical touch time.

| Command | Windows key |
|---|---|
| PLAY_PAUSE | Media play/pause |
| NEXT / PREV | Next / previous media track |
| VOL_UP / VOL_DOWN | Volume up / down |
| SLIDE_NEXT | Page Down |
| SLIDE_PREV | Page Up |
| SELECT | Enter |
| SCROLL_UP / SCROLL_DOWN | Page Up / Page Down (legacy aliases) |

The old reversed slide directions and SELECT-to-play/pause substitution are corrected. No generic shell command or arbitrary key value is accepted from the browser.

Approved browser origins are the existing `https://sense-ring.vercel.app` and localhost/127.0.0.1 on ports 3199, 4173 and 5500. For a different deployment, configure `SENSERING_ALLOWED_ORIGINS` as a comma-separated list of **exact** trusted origins before starting the companion. Do not use arbitrary public origins. `BRIDGE_PORT` optionally changes the port; update the website's companion URL to match. The default remains 3199.

The HTTP server serves only the website's allowlisted public files, `assets/`, `icons/` and `downloads/`. Backend code, scripts, dotfiles, tests and other project files are excluded. Host-header checks, explicit CORS origins, JSON requests, per-process tokens, payload limits, bounded serialization and command allowlists reduce unwanted local requests; this is not an authentication system for untrusted people sharing the same Windows account.

## Verification

`node --test tests/bridge.test.js` uses injected fake executors and fake PowerShell streams: no real system keys are sent. The suite also verifies starting/unavailable rejection without replay, startup failure/retry, readiness loss after helper exit and protected prepare requests. `tests/companion-state.test.js` verifies browser readiness gating, legacy update prompts, disabled/inconsistent flags and recovery messages. Windows may skip the symlink escape test when the account lacks permission to create symlinks; the real-path containment check remains in the server.

The four launcher PowerShell sources passed syntax checks. The complete CMD-to-VBS-to-PowerShell-to-Node start path was also run on this laptop: the hidden companion started and its health response reported ready on Windows. This did not send any real keys, connect a physical ring or install a startup shortcut. The root wrappers use quoted `%~dp0` paths, and the launchers use literal/quoted full paths so an extracted folder containing spaces is supported. Real Windows foreground-key delivery and a physical ring remain end-to-end checks for the user.
