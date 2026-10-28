'use strict';
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const readline = require('node:readline');
const { spawn } = require('node:child_process');

const VERSION = '2.3.1';
const HOST = '127.0.0.1';
const DEFAULT_PORT = 3199;
const COMMAND_TO_VK = Object.freeze({
    PLAY_PAUSE: 0xB3, NEXT: 0xB0, PREV: 0xB1,
    VOL_UP: 0xAF, VOL_DOWN: 0xAE,
    SLIDE_NEXT: 0x22, SLIDE_PREV: 0x21, SELECT: 0x0D,
    SCROLL_UP: 0x21, SCROLL_DOWN: 0x22
});
const DEFAULT_ORIGINS = Object.freeze([
    'https://sense-ring.vercel.app',
    ...[3199, 4173, 5500].flatMap(port => [`http://127.0.0.1:${port}`, `http://localhost:${port}`])
]);
const ROOT_PUBLIC_FILES = new Set([
    'index.html', 'gesture-ring-script.js', 'gesture-ring-style.css',
    'sense-ring-core.js', 'product-state.js', 'companion-state.js', 'theme.js', 'ring-visual.js', 'android-section.css', 'android-experience.js', 'manifest.webmanifest',
    'favicon.ico', 'robots.txt', 'sw.js'
]);
const PUBLIC_TYPES = Object.freeze({
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff',
    '.woff2': 'font/woff2', '.zip': 'application/zip', '.apk': 'application/vnd.android.package-archive', '.txt': 'text/plain; charset=utf-8'
});

function httpError(status, message) { return Object.assign(new Error(message), { status }); }

// Prepared in the background at server startup; preparation never injects keys.
// The hidden PowerShell worker receives numeric ids and fixed allowlisted codes,
// never shell text from HTTP clients. Add-Type runs once for the whole session.
function createWindowsExecutor(options = {}) {
    const spawnWorker = options.spawn || spawn;
    let child = null, ready = null, sequence = 0, closing = false, state = 'starting';
    const pending = new Map();
    function rejectPending(error) {
        for (const item of pending.values()) { item.cleanup(); item.reject(error); }
        pending.clear();
    }
    function start() {
        if (closing) return Promise.reject(new Error('Executor stopped'));
        if (ready) return ready;
        state = 'starting';
        const attempt = new Promise((resolve, reject) => {
            const script = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class SenseRingKeys { [DllImport("user32.dll")] public static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extra); public static void Send(byte key) { uint flags = (key == 0x21 || key == 0x22) ? 1u : 0u; keybd_event(key, 0, flags, UIntPtr.Zero); keybd_event(key, 0, flags | 2u, UIntPtr.Zero); } }'
$allowed = @(${[...new Set(Object.values(COMMAND_TO_VK))].join(',')})
[Console]::Out.WriteLine('READY')
[Console]::Out.Flush()
while (($line = [Console]::ReadLine()) -ne $null) {
    $parts = $line.Split(' ')
    $id = 0
    $key = 0
    [long]$deadline = 0
    if ($parts.Length -ne 3 -or -not [int]::TryParse($parts[0], [ref]$id) -or -not [int]::TryParse($parts[1], [ref]$key) -or -not [long]::TryParse($parts[2], [ref]$deadline) -or $allowed -notcontains $key) { continue }
    if ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -ge $deadline) {
        [Console]::Out.WriteLine('EXPIRED ' + $id)
        [Console]::Out.Flush()
        continue
    }
    try {
        [SenseRingKeys]::Send([byte]$key)
        [Console]::Out.WriteLine('OK ' + $id)
    } catch {
        [Console]::Out.WriteLine('ERROR ' + $id)
    }
    [Console]::Out.Flush()
}
`;
            const encoded = Buffer.from(script, 'utf16le').toString('base64');
            const worker = spawnWorker('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {
                windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']
            });
            child = worker;
            const startupTimer = setTimeout(() => {
                reject(new Error('Keyboard helper startup timed out')); worker.kill();
            }, 8000);
            worker.on('error', error => { clearTimeout(startupTimer); reject(error); if (child === worker) { state = closing ? 'stopped' : 'unavailable'; rejectPending(error); } });
            worker.stdin.on('error', error => { if (child === worker) { rejectPending(error); worker.kill(); } });
            worker.stderr.on('data', () => {});
            const lines = readline.createInterface({ input: worker.stdout });
            lines.on('line', line => {
                if (line.trim() === 'READY') { if (child !== worker || closing || state !== 'starting') return; clearTimeout(startupTimer); state = 'ready'; resolve(); return; }
                const match = /^(OK|ERROR|EXPIRED) (\d+)$/.exec(line.trim());
                if (!match) return;
                const item = pending.get(Number(match[2]));
                if (!item) return;
                pending.delete(Number(match[2])); item.cleanup();
                if (match[1] === 'OK') item.resolve();
                else if (match[1] === 'EXPIRED') item.reject(httpError(504, 'Command expired; delivery was not confirmed'));
                else item.reject(new Error('Windows key injection failed'));
            });
            worker.on('exit', () => {
                clearTimeout(startupTimer);
                const error = new Error('Keyboard helper exited');
                reject(error);
                if (child === worker) { state = closing ? 'stopped' : 'unavailable'; rejectPending(error); child = null; ready = null; }
            });
        });
        ready = attempt;
        // Failed spawns can emit error without exit. Do not cache a rejected
        // startup forever; a subsequent command may retry after the fault clears.
        attempt.catch(() => {
            if (ready !== attempt) return;
            ready = null; state = closing ? 'stopped' : 'unavailable';
            const failed = child; child = null;
            try { failed?.kill(); } catch { /* The process may already be gone. */ }
        });
        return attempt;
    }
    return {
        getState() { return state; },
        prepare() { return start(); },
        async execute(command, context = {}) {
            const { signal, expiresAt = Date.now() + 4000, now = Date.now } = context;
            function checkFreshness() {
                if (signal?.aborted) throw signal.reason || httpError(499, 'Command request was cancelled');
                if (now() >= expiresAt) throw httpError(504, 'Command expired; delivery was not confirmed');
            }
            checkFreshness();
            await start();
            // Startup can take seconds. Never dispatch a gesture that expired meanwhile.
            checkFreshness();
            const code = COMMAND_TO_VK[command];
            if (!Number.isInteger(code)) throw new Error('Unknown key command');
            const id = sequence = sequence >= 2147483646 ? 1 : sequence + 1;
            return new Promise((resolve, reject) => {
                let timer;
                const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); };
                const onAbort = () => {
                    pending.delete(id); cleanup();
                    reject(signal.reason || httpError(499, 'Command request was cancelled'));
                };
                timer = setTimeout(() => {
                    pending.delete(id); cleanup(); reject(new Error('Keyboard command timed out')); child?.kill();
                }, 4000);
                pending.set(id, { resolve, reject, cleanup });
                signal?.addEventListener('abort', onAbort, { once: true });
                try {
                    // This is the final JS boundary before the worker receives a key.
                    checkFreshness();
                    child.stdin.write(`${id} ${code} ${expiresAt}\n`);
                } catch (error) { pending.delete(id); cleanup(); reject(error); }
            });
        },
        close() { closing = true; state = 'stopped'; child?.kill(); rejectPending(new Error('Executor stopped')); }
    };
}

function validHost(header) { return /^(?:127\.0\.0\.1|localhost)(?::\d{1,5})?$/.test(header || ''); }
function safeToken(actual, expected) {
    if (typeof actual !== 'string') return false;
    const left = Buffer.from(actual), right = Buffer.from(expected);
    return left.length === right.length && crypto.timingSafeEqual(left, right);
}
function readJson(req, maximum = 1024) {
    return new Promise((resolve, reject) => {
        let length = 0, overflow = false;
        const chunks = [];
        req.on('data', chunk => {
            length += chunk.length;
            if (length > maximum) {
                if (!overflow) reject(httpError(413, 'Payload too large'));
                overflow = true; return;
            }
            if (!overflow) chunks.push(chunk);
        });
        req.on('end', () => {
            if (overflow) return;
            try {
                const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('Not an object');
                resolve(value);
            } catch { reject(httpError(400, 'Expected a JSON object')); }
        });
        req.on('error', () => reject(httpError(400, 'Request interrupted')));
        req.on('aborted', () => reject(httpError(400, 'Request interrupted')));
    });
}

function createBridgeServer(options = {}) {
    const platform = options.platform || process.platform;
    const executionEnabled = options.executionEnabled ?? (platform === 'win32' && process.env.SENSERING_DRY_RUN !== '1');
    const siteRoot = path.resolve(options.siteRoot || path.join(__dirname, '..'));
    const sessionToken = crypto.randomBytes(24).toString('hex');
    const origins = new Set(options.allowedOrigins || DEFAULT_ORIGINS);
    for (const value of (process.env.SENSERING_ALLOWED_ORIGINS || '').split(',')) {
        if (value.trim()) origins.add(value.trim());
    }
    const windowsExecutor = !options.executeCommand && executionEnabled && platform === 'win32'
        ? createWindowsExecutor({ spawn: options.spawn }) : null;
    const executeCommand = options.executeCommand || ((command, _key, context) => {
        if (!windowsExecutor) throw new Error('Windows keyboard execution unavailable');
        return windowsExecutor.execute(command, context);
    });
    const maximumQueue = options.maximumQueue ?? 8;
    const maximumRate = options.maximumRate ?? 12;
    const rateWindowMs = options.rateWindowMs ?? 1000;
    const maximumCommandAgeMs = options.maximumCommandAgeMs ?? 4000;
    if (!Number.isInteger(maximumCommandAgeMs) || maximumCommandAgeMs < 1)
        throw new TypeError('maximumCommandAgeMs must be a positive integer');
    const now = options.now || Date.now;
    let recent = [], pendingCount = 0, tail = Promise.resolve(), stopping = false, stopPromise, lastPrepareAt = -Infinity;

    function executorState() {
        if (!executionEnabled) return 'disabled';
        if (stopping) return 'unavailable';
        if (windowsExecutor) return windowsExecutor.getState() === 'stopped' ? 'unavailable' : windowsExecutor.getState();
        return options.executeCommand ? 'ready' : 'unavailable';
    }
    function prepareExecutor() {
        windowsExecutor?.prepare().catch(() => {
            if (!stopping) console.warn('Keyboard helper is unavailable; use Retry connection in setup.');
        });
    }

    function json(res, status, body) {
        if (res.writableEnded || res.destroyed) return;
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(body));
    }
    async function publicFile(req, res, rawPath) {
        let name;
        try { name = decodeURIComponent(rawPath); } catch { throw httpError(400, 'Invalid path'); }
        if (name.includes('\\') || name.includes('\0') || name.includes('%')) throw httpError(404, 'Not found');
        const parts = name.split('/').filter(Boolean);
        if (parts.some(part => part.startsWith('.'))) throw httpError(404, 'Not found');
        if (name === '/') name = '/index.html';
        const relative = name.slice(1);
        const allowed = ROOT_PUBLIC_FILES.has(relative) || /^(assets|icons|downloads)\//.test(relative);
        const type = PUBLIC_TYPES[path.extname(relative).toLowerCase()];
        if (!allowed || !type) throw httpError(404, 'Not found');
        let realFile, realRoot;
        try { [realFile, realRoot] = await Promise.all([fs.realpath(path.join(siteRoot, relative)), fs.realpath(siteRoot)]); }
        catch { throw httpError(404, 'Not found'); }
        const distance = path.relative(realRoot, realFile);
        if (distance.startsWith('..' + path.sep) || distance === '..' || path.isAbsolute(distance)) throw httpError(404, 'Not found');
        const stat = await fs.stat(realFile);
        if (!stat.isFile()) throw httpError(404, 'Not found');
        const data = req.method === 'HEAD' ? null : await fs.readFile(realFile);
        res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Cache-Control': 'no-cache' });
        res.end(data);
    }
    const server = http.createServer(async (req, res) => {
        const receivedAt = now();
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Content-Security-Policy', "frame-ancestors 'none'; base-uri 'self'");
        try {
            if (!validHost(req.headers.host)) throw httpError(403, 'Only loopback hosts are accepted');
            const origin = req.headers.origin;
            if (origin && !origins.has(origin)) throw httpError(403, 'Origin not allowed');
            if (!origin && req.headers['sec-fetch-site'] === 'cross-site') throw httpError(403, 'Origin required');
            if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
            if (req.method === 'OPTIONS') {
                res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
                res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-SenseRing-Token');
                if (req.headers['access-control-request-private-network'] === 'true') res.setHeader('Access-Control-Allow-Private-Network', 'true');
                res.writeHead(204); res.end(); return;
            }
            const route = (req.url || '/').split('?')[0];
            if (route === '/health' && (req.method === 'GET' || req.method === 'HEAD')) {
                json(res, 200, { ok: true, name: 'SenseRing Bridge', version: VERSION, platform,
                    executionEnabled, executorState: executorState(), executorReady: executorState() === 'ready',
                    commands: Object.keys(COMMAND_TO_VK), sessionToken }); return;
            }
            if (route === '/command' || route === '/shutdown' || route === '/prepare') {
                if (req.method !== 'POST') throw httpError(405, 'Use POST');
                if (!safeToken(req.headers['x-sensering-token'], sessionToken)) throw httpError(403, 'Session token required; reconnect the companion');
                if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw httpError(415, 'Use application/json');
                const payload = await readJson(req);
                if (route === '/shutdown') { json(res, 200, { ok: true }); setImmediate(() => server.bridgeStop()); return; }
                if (route === '/prepare') {
                    if (!executionEnabled) throw httpError(409, 'System controls are disabled on this companion');
                    if (stopping) throw httpError(503, 'Companion is stopping');
                    if (executorState() === 'unavailable') {
                        if (now() - lastPrepareAt < 1000) throw httpError(429, 'Wait a moment before retrying');
                        lastPrepareAt = now(); prepareExecutor();
                    }
                    json(res, executorState() === 'ready' ? 200 : 202,
                        { ok: true, executorState: executorState(), executorReady: executorState() === 'ready' }); return;
                }
                const command = payload.command;
                if (typeof command !== 'string' || !Object.hasOwn(COMMAND_TO_VK, command)) throw httpError(400, 'Unknown command');
                const expiresAt = receivedAt + maximumCommandAgeMs;
                if (now() >= expiresAt) throw httpError(504, 'Command expired; delivery was not confirmed');
                if (!executionEnabled) throw httpError(409, 'System controls are disabled on this companion');
                if (stopping) throw httpError(503, 'Companion is stopping');
                if (executorState() !== 'ready') throw httpError(503, 'Keyboard controls are not ready; retry connection in setup');
                recent = recent.filter(time => now() - time < rateWindowMs);
                if (recent.length >= maximumRate || pendingCount >= maximumQueue) throw httpError(429, 'Too many commands; release the control and try again');
                recent.push(now()); ++pendingCount;
                const commandAbort = new AbortController();
                let rejectInterruption;
                const interrupted = new Promise((_, reject) => { rejectInterruption = reject; });
                function interrupt(status, message) {
                    if (commandAbort.signal.aborted) return;
                    const error = httpError(status, message);
                    commandAbort.abort(error); rejectInterruption(error);
                }
                const onResponseClose = () => {
                    if (!res.writableFinished) interrupt(499, 'Command request was cancelled');
                };
                const lifetimeTimer = setTimeout(() => {
                    interrupt(504, 'Command expired; delivery was not confirmed');
                }, Math.max(1, expiresAt - now()));
                res.once('close', onResponseClose);
                const work = tail.catch(() => {}).then(async () => {
                    if (stopping) throw httpError(503, 'Companion is stopping');
                    if (now() >= expiresAt) interrupt(504, 'Command expired; delivery was not confirmed');
                    if (res.destroyed || commandAbort.signal.aborted)
                        throw commandAbort.signal.reason || httpError(499, 'Command request was cancelled');
                    await executeCommand(command, COMMAND_TO_VK[command], { signal: commandAbort.signal, expiresAt, now });
                    if (now() >= expiresAt) interrupt(504, 'Command expired; delivery was not confirmed');
                    if (commandAbort.signal.aborted) throw commandAbort.signal.reason;
                });
                tail = work;
                // Expired requests can respond immediately, but retain their queue slot
                // until their work settles so a stalled executor cannot grow the queue.
                work.finally(() => { --pendingCount; }).catch(() => {});
                try { await Promise.race([work, interrupted]); }
                catch (error) {
                    throw httpError(error.status || 502, error.status ? error.message : 'Could not deliver the system command');
                } finally {
                    clearTimeout(lifetimeTimer); res.removeListener('close', onResponseClose);
                }
                json(res, 200, { ok: true, command }); return;
            }
            if (req.method !== 'GET' && req.method !== 'HEAD') throw httpError(405, 'Method not allowed');
            await publicFile(req, res, route);
        } catch (error) { json(res, error.status || 500, { ok: false, error: error.status ? error.message : 'Companion error' }); }
    });
    server.headersTimeout = 5000;
    server.requestTimeout = 5000;
    server.keepAliveTimeout = 1000;
    server.once('listening', () => {
        if (!windowsExecutor) return;
        prepareExecutor();
    });
    server.on('close', () => windowsExecutor?.close());
    server.bridgeStop = () => {
        if (stopPromise) return stopPromise;
        stopping = true; windowsExecutor?.close();
        stopPromise = new Promise(resolve => {
            if (!server.listening) { resolve(); return; }
            server.close(resolve); server.closeIdleConnections?.();
        });
        return stopPromise;
    };
    return server;
}

function startBridge() {
    const port = Number(process.env.BRIDGE_PORT || DEFAULT_PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        console.error('BRIDGE_PORT must be a number from 1 to 65535'); process.exitCode = 1; return;
    }
    const server = createBridgeServer();
    server.on('error', error => {
        console.error(error.code === 'EADDRINUSE' ? 'The companion port is already in use. Check the existing companion first.' : 'Could not start the companion.');
        process.exitCode = 1;
    });
    server.listen(port, HOST, () => console.log(`SenseRing Bridge ${VERSION} ready at http://${HOST}:${port}`));
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.bridgeStop());
    return server;
}

module.exports = { createBridgeServer, createWindowsExecutor, startBridge, COMMAND_TO_VK, DEFAULT_ORIGINS, VERSION, HOST };
