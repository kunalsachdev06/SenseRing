'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { PassThrough, Writable } = require('node:stream');
const { createBridgeServer, createWindowsExecutor, COMMAND_TO_VK, HOST } = require('../local-media-bridge.js');

function fakeWorker() {
    const child = new EventEmitter();
    const writes = [];
    child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.stdin = new Writable({ write(chunk, _encoding, done) { writes.push(chunk.toString()); done(); } });
    let closed = false;
    child.kill = () => {
        if (closed) return;
        closed = true; child.stdout.end(); child.stderr.end(); child.stdin.end(); child.emit('exit', 0);
    };
    return { child, writes, ready: () => child.stdout.write('READY\n') };
}

async function fixture(t, options = {}) {
    const siteRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'sensering-bridge-test-'));
    await fs.mkdir(path.join(siteRoot, 'assets'));
    await fs.mkdir(path.join(siteRoot, 'scripts'));
    await fs.writeFile(path.join(siteRoot, 'index.html'), '<!doctype html><title>Test dashboard</title>');
    await fs.writeFile(path.join(siteRoot, 'assets/ring-mesh.js'), 'window.fixture = true;');
    await fs.writeFile(path.join(siteRoot, 'local-media-bridge.js'), 'PRIVATE SOURCE');
    await fs.writeFile(path.join(siteRoot, 'scripts/private.json'), 'PRIVATE CONFIG');
    const delivered = [];
    const server = createBridgeServer({ siteRoot, platform: 'win32', executionEnabled: true,
        executeCommand: async (command, key) => { delivered.push({ command, key }); }, ...options });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, HOST, resolve); });
    const base = `http://${HOST}:${server.address().port}`;
    t.after(async () => {
        await server.bridgeStop();
        const relative = path.relative(os.tmpdir(), siteRoot);
        assert(!relative.startsWith('..') && !path.isAbsolute(relative));
        assert(path.basename(siteRoot).startsWith('sensering-bridge-test-'));
        await fs.rm(siteRoot, { recursive: true, force: true });
    });
    const health = await (await fetch(base + '/health')).json();
    const post = (command, headers = {}, body = JSON.stringify({ command })) => fetch(base + '/command', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-SenseRing-Token': health.sessionToken, ...headers }, body
    });
    return { server, base, health, post, delivered, siteRoot };
}

test('health is truthful and no key is delivered by health/static requests', async t => {
    const f = await fixture(t);
    assert.equal(f.server.address().address, '127.0.0.1');
    assert.equal(f.health.name, 'SenseRing Bridge');
    assert.equal(f.health.executionEnabled, true);
    assert.equal(f.health.platform, 'win32');
    assert.equal(f.health.sessionToken.length, 48);
    assert(f.health.commands.includes('SELECT'));
    assert.equal((await fetch(f.base + '/')).status, 200);
    assert.equal(f.delivered.length, 0);
});

test('Android download and its story assets are served without any control action',async t=>{
    const f=await fixture(t);
    await fs.mkdir(path.join(f.siteRoot,'downloads'));
    const apk=Buffer.from([0x50,0x4b,0x03,0x04,0x00,0x00]);
    await fs.writeFile(path.join(f.siteRoot,'downloads/SenseRing-Android-1.2.0.apk'),apk);
    await fs.writeFile(path.join(f.siteRoot,'android-experience.js'),'/* story */');
    await fs.writeFile(path.join(f.siteRoot,'android-section.css'),'/* style */');
    const response=await fetch(f.base+'/downloads/SenseRing-Android-1.2.0.apk');
    assert.equal(response.status,200);
    assert.equal(response.headers.get('content-type'),'application/vnd.android.package-archive');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),apk);
    for(const name of ['android-experience.js','android-section.css'])assert.equal((await fetch(f.base+'/'+name)).status,200);
    assert.equal(f.delivered.length,0);
});

test('slide directions and SELECT map to Page Down, Page Up and Enter', async t => {
    const f = await fixture(t);
    for (const command of ['SLIDE_NEXT', 'SLIDE_PREV', 'SELECT']) {
        const response = await f.post(command);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { ok: true, command });
    }
    assert.deepEqual(f.delivered.map(item => item.key), [0x22, 0x21, 0x0D]);
    assert.equal(COMMAND_TO_VK.SCROLL_UP, 0x21);
    assert.equal(COMMAND_TO_VK.SCROLL_DOWN, 0x22);
});

test('all supported media tokens reach the injected executor without shell text', async t => {
    const f = await fixture(t);
    for (const command of ['PLAY_PAUSE', 'NEXT', 'PREV', 'VOL_UP', 'VOL_DOWN'])
        assert.equal((await f.post(command)).status, 200);
    assert.deepEqual(f.delivered.map(item => item.key), [0xB3, 0xB0, 0xB1, 0xAF, 0xAE]);
});

test('unapproved origins and null origins cannot read health or send actions', async t => {
    const f = await fixture(t);
    for (const Origin of ['https://untrusted.example', 'https://another-user.github.io', 'https://kunalsachdev06.github.io.untrusted.example', 'null']) {
        const response = await fetch(f.base + '/health', { headers: { Origin } });
        assert.equal(response.status, 403);
        assert.equal(response.headers.get('access-control-allow-origin'), null);
        assert.equal((await f.post('PLAY_PAUSE', { Origin })).status, 403);
    }
    assert.equal(f.delivered.length, 0);
});

test('GitHub Pages can read health and deliver authenticated music and slide commands', async t => {
    const f = await fixture(t);
    const Origin = 'https://kunalsachdev06.github.io';
    const response = await fetch(f.base + '/health', { headers: { Origin, 'Sec-Fetch-Site': 'cross-site' } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), Origin);
    const health = await response.json();
    assert.equal(health.version, '2.3.2');
    assert.equal(health.executorReady, true);
    const preflight = await fetch(f.base + '/command', { method: 'OPTIONS', headers: {
        Origin, 'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,x-sensering-token',
        'Access-Control-Request-Private-Network': 'true'
    } });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), Origin);
    assert.equal(preflight.headers.get('access-control-allow-private-network'), 'true');
    assert.equal((await f.post('NEXT', { Origin, 'X-SenseRing-Token': '' })).status, 403);
    assert.equal(f.delivered.length, 0);
    for (const command of ['PLAY_PAUSE', 'VOL_UP', 'SLIDE_NEXT', 'SLIDE_PREV'])
        assert.equal((await f.post(command, { Origin, 'Sec-Fetch-Site': 'cross-site' })).status, 200);
    assert.deepEqual(f.delivered.map(item => item.command), ['PLAY_PAUSE', 'VOL_UP', 'SLIDE_NEXT', 'SLIDE_PREV']);
});

test('approved CORS preflight allows only the expected command headers', async t => {
    const f = await fixture(t);
    const response = await fetch(f.base + '/command', { method: 'OPTIONS', headers: {
        Origin: 'https://sense-ring.vercel.app',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,x-sensering-token',
        'Access-Control-Request-Private-Network': 'true'
    } });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://sense-ring.vercel.app');
    assert.match(response.headers.get('access-control-allow-headers'), /X-SenseRing-Token/);
    assert.equal(response.headers.get('access-control-allow-private-network'), 'true');
});

test('missing/wrong session tokens and cross-site requests cause no actions', async t => {
    const f = await fixture(t);
    assert.equal((await f.post('NEXT', { 'X-SenseRing-Token': '' })).status, 403);
    assert.equal((await f.post('NEXT', { 'X-SenseRing-Token': 'wrong' })).status, 403);
    assert.equal((await f.post('NEXT', { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
    assert.equal(f.delivered.length, 0);
});

test('malformed payloads, unknown commands, non-JSON and large bodies are rejected', async t => {
    const f = await fixture(t);
    assert.equal((await f.post('NEXT', {}, '{')).status, 400);
    assert.equal((await f.post('NEXT', {}, '[]')).status, 400);
    assert.equal((await f.post('powershell; calc.exe')).status, 400);
    assert.equal((await f.post('toString')).status, 400);
    assert.equal((await f.post('NEXT', { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await f.post('NEXT', {}, JSON.stringify({ command: 'NEXT', extra: 'x'.repeat(2000) }))).status, 413);
    assert.equal(f.delivered.length, 0);
});

test('public assets are served but backend/source/config and traversal are hidden', async t => {
    const f = await fixture(t);
    const asset = await fetch(f.base + '/assets/ring-mesh.js');
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type'), /javascript/);
    for (const name of ['/local-media-bridge.js', '/scripts/private.json', '/.git/config', '/tests/bridge.test.js', '/assets/%2e%2e/scripts/private.json', '/assets/%5c..%5cscripts/private.json'])
        assert.equal((await fetch(f.base + name)).status, 404, name);
});

test('symbolic links cannot escape the public root when the platform permits links', async t => {
    const f = await fixture(t);
    const outside = path.join(path.dirname(f.siteRoot), path.basename(f.siteRoot) + '-outside.js');
    await fs.writeFile(outside, 'private outside file');
    t.after(() => fs.unlink(outside));
    try { await fs.symlink(outside, path.join(f.siteRoot, 'assets/escape.js')); }
    catch (error) { if (error.code === 'EPERM') { t.skip('Windows account cannot create symlinks'); return; } throw error; }
    assert.equal((await fetch(f.base + '/assets/escape.js')).status, 404);
});

test('a DNS-rebinding Host header is rejected', async t => {
    const f = await fixture(t);
    const response = await new Promise((resolve, reject) => {
        const request = http.get(f.base + '/health', { headers: { Host: 'attacker.example:3199' } }, result => {
            result.resume(); result.on('end', () => resolve(result));
        });
        request.on('error', reject);
    });
    assert.equal(response.statusCode, 403);
});

test('disabled/dry-run system control is visible and does not pretend delivery succeeded', async t => {
    const f = await fixture(t, { executionEnabled: false });
    assert.equal(f.health.executionEnabled, false);
    assert.equal((await f.post('PLAY_PAUSE')).status, 409);
    assert.equal(f.delivered.length, 0);
});

test('execution failures return an error instead of a false success', async t => {
    const f = await fixture(t, { executeCommand: async () => { throw new Error('simulated OS error'); } });
    const response = await f.post('SELECT');
    assert.equal(response.status, 502);
    assert.equal((await response.json()).ok, false);
});

test('commands execute in order and the bounded queue rejects excessive backlog', async t => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const order = [];
    const f = await fixture(t, { maximumQueue: 2, executeCommand: async command => {
        order.push(command); if (command === 'NEXT') await gate;
    } });
    const first = f.post('NEXT');
    await new Promise(resolve => setTimeout(resolve, 20));
    const second = f.post('PREV');
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal((await f.post('SELECT')).status, 429);
    release();
    assert.equal((await first).status, 200);
    assert.equal((await second).status, 200);
    assert.deepEqual(order, ['NEXT', 'PREV']);
});

test('rate limiting caps bursts and recovers after the configured window', async t => {
    let clock = 10000;
    const f = await fixture(t, { maximumRate: 2, now: () => clock });
    assert.equal((await f.post('NEXT')).status, 200);
    assert.equal((await f.post('NEXT')).status, 200);
    assert.equal((await f.post('NEXT')).status, 429);
    clock += 1001;
    assert.equal((await f.post('NEXT')).status, 200);
});

test('a cancelled request is removed before its queued key can run', async t => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const order = [];
    const f = await fixture(t, { executeCommand: async command => {
        order.push(command); if (command === 'NEXT') await gate;
    } });
    const first = f.post('NEXT');
    await new Promise(resolve => setTimeout(resolve, 20));
    const cancellation = new AbortController();
    const second = fetch(f.base + '/command', { method: 'POST', signal: cancellation.signal,
        headers: { 'Content-Type': 'application/json', 'X-SenseRing-Token': f.health.sessionToken },
        body: JSON.stringify({ command: 'PREV' }) });
    const rejected = assert.rejects(second, /abort/i);
    await new Promise(resolve => setTimeout(resolve, 20));
    cancellation.abort();
    await rejected;
    await new Promise(resolve => setTimeout(resolve, 20));
    release();
    assert.equal((await first).status, 200);
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.deepEqual(order, ['NEXT']);
});

test('method checks and authenticated shutdown behave as documented', async t => {
    const f = await fixture(t);
    assert.equal((await fetch(f.base + '/command')).status, 405);
    assert.equal((await fetch(f.base + '/health', { method: 'PUT' })).status, 405);
    assert.equal((await fetch(f.base + '/shutdown', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
    const response = await fetch(f.base + '/shutdown', { method: 'POST', headers: {
        'Content-Type': 'application/json', 'X-SenseRing-Token': f.health.sessionToken
    }, body: '{}' });
    assert.equal(response.status, 200);
    assert.equal(f.delivered.length, 0);
});

test('expired queued requests receive 504 and never dispatch a late key', async t => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const started = [], delivered = [];
    const f = await fixture(t, { maximumCommandAgeMs: 50,
        executeCommand: async (command, _key, context) => {
            started.push(command);
            if (command === 'NEXT') await gate;
            if (!context.signal.aborted && Date.now() < context.expiresAt) delivered.push(command);
        }
    });
    const first = f.post('NEXT');
    await new Promise(resolve => setTimeout(resolve, 15));
    const second = f.post('PREV');
    const responses = await Promise.all([first, second]);
    for (const response of responses) {
        assert.equal(response.status, 504);
        assert.match((await response.json()).error, /expired/i);
    }
    release();
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.deepEqual(started, ['NEXT']);
    assert.deepEqual(delivered, []);
    // Settled expired queue slots are reusable by a fresh command.
    assert.equal((await f.post('SELECT')).status, 200);
    assert.deepEqual(delivered, ['SELECT']);
});

test('Windows executor checks cancellation after helper startup before writing any key', async t => {
    const worker = fakeWorker();
    const executor = createWindowsExecutor({ spawn: () => worker.child });
    t.after(() => executor.close());
    const cancellation = new AbortController();
    const pending = executor.execute('NEXT', { signal: cancellation.signal, expiresAt: Date.now() + 1000 });
    const rejected = assert.rejects(pending, /cancelled/i);
    cancellation.abort(new Error('request cancelled'));
    worker.ready();
    await rejected;
    assert.deepEqual(worker.writes, []);
});

test('Windows executor rejects an elapsed deadline after delayed startup even without an abort event', async t => {
    const worker = fakeWorker();
    const executor = createWindowsExecutor({ spawn: () => worker.child });
    t.after(() => executor.close());
    let clock = 1000;
    const pending = executor.execute('NEXT', { expiresAt: 1100, now: () => clock });
    const rejected = assert.rejects(pending, error => error.status === 504);
    clock = 1200;
    worker.ready();
    await rejected;
    assert.deepEqual(worker.writes, []);
});

test('fresh worker commands include a numeric deadline and acknowledge without a real OS key', async t => {
    const worker = fakeWorker();
    let encodedScript;
    const executor = createWindowsExecutor({ spawn: (_file, args) => {
        encodedScript = args[args.length - 1]; return worker.child;
    } });
    t.after(() => executor.close());
    const expiresAt = Date.now() + 1000;
    const pending = executor.execute('SELECT', { expiresAt });
    worker.ready();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(worker.writes.length, 1);
    const [id, key, deadline] = worker.writes[0].trim().split(' ').map(Number);
    assert.equal(key, 0x0D);
    assert.equal(deadline, expiresAt);
    const script = Buffer.from(encodedScript, 'base64').toString('utf16le');
    assert.match(script, /UtcNow\.ToUnixTimeMilliseconds\(\) -ge \$deadline/);
    assert.match(script, /EXPIRED/);
    worker.child.stdout.write(`OK ${id}\n`);
    await pending;
});

test('preparing the Windows executor sends no keys and later commands reuse the ready worker', async t => {
    const worker = fakeWorker();
    let spawns = 0;
    const executor = createWindowsExecutor({ spawn: () => { spawns++; return worker.child; } });
    t.after(() => executor.close());
    const prepared = executor.prepare();
    assert.equal(spawns, 1);
    assert.deepEqual(worker.writes, []);
    worker.ready();
    await prepared;
    await executor.prepare();
    assert.equal(spawns, 1);
    assert.deepEqual(worker.writes, []);
    const pending = executor.execute('SELECT', { expiresAt: Date.now() + 1000 });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(spawns, 1);
    assert.equal(worker.writes.length, 1);
    const id = Number(worker.writes[0].split(' ')[0]);
    worker.child.stdout.write(`OK ${id}\n`);
    await pending;
});

test('failed background preparation can retry after a spawn error without an exit event', async t => {
    const workers = [fakeWorker(), fakeWorker()];
    let spawns = 0;
    const executor = createWindowsExecutor({ spawn: () => workers[spawns++].child });
    t.after(() => executor.close());
    const rejected = assert.rejects(executor.prepare(), /simulated startup error/);
    workers[0].child.emit('error', new Error('simulated startup error'));
    await rejected;
    const prepared = executor.prepare();
    assert.equal(spawns, 2);
    workers[1].ready();
    await prepared;
    assert.deepEqual(workers.flatMap(worker => worker.writes), []);
});

test('a synchronously failed worker spawn does not cache a rejected preparation', async t => {
    const worker = fakeWorker();
    let spawns = 0;
    const executor = createWindowsExecutor({ spawn: () => {
        if (++spawns === 1) throw new Error('simulated missing helper');
        return worker.child;
    } });
    t.after(() => executor.close());
    await assert.rejects(executor.prepare(), /simulated missing helper/);
    const prepared = executor.prepare();
    worker.ready();
    await prepared;
    assert.equal(spawns, 2);
    assert.deepEqual(worker.writes, []);
});

test('enabled Windows companions prepare on listening without delaying health or sending a key', async t => {
    const worker = fakeWorker();
    let spawns = 0;
    const f = await fixture(t, { executeCommand: undefined,
        spawn: () => { spawns++; return worker.child; }
    });
    assert.equal(f.health.executionEnabled, true);
    assert.equal(spawns, 1);
    assert.deepEqual(worker.writes, []);
    assert.equal((await fetch(f.base + '/')).status, 200);
    worker.ready();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal((await fetch(f.base + '/health')).status, 200);
    assert.equal(spawns, 1);
    assert.deepEqual(worker.writes, []);
});

test('disabled Windows execution never starts a helper and health remains truthful', async t => {
    let spawns = 0;
    const f = await fixture(t, { executionEnabled: false, executeCommand: undefined,
        spawn: () => { spawns++; throw new Error('must not start a helper'); }
    });
    assert.equal(f.health.executionEnabled, false);
    assert.equal((await f.post('SELECT')).status, 409);
    assert.equal(spawns, 0);
});

test('starting controls reject gestures without queueing or replaying them after readiness', async t => {
    const worker = fakeWorker();
    const f = await fixture(t, { executeCommand: undefined, spawn: () => worker.child });
    assert.equal(f.health.executorState, 'starting');
    assert.equal(f.health.executorReady, false);
    assert.equal((await f.post('SLIDE_NEXT')).status, 503);
    assert.deepEqual(worker.writes, []);
    worker.ready();
    const ready = await (await fetch(f.base + '/health')).json();
    assert.equal(ready.executorState, 'ready'); assert.equal(ready.executorReady, true);
    assert.deepEqual(worker.writes, []);
    const response = f.post('SELECT');
    for (let i = 0; i < 100 && !worker.writes.length; i++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(worker.writes.length, 1);
    worker.child.stdout.write(`OK ${worker.writes[0].split(' ')[0]}\n`);
    assert.equal((await response).status, 200);
});

test('helper failure is visible in health and an authenticated retry recovers without a key', async t => {
    const worker = fakeWorker();
    let spawns = 0;
    const f = await fixture(t, { executeCommand: undefined, spawn: () => {
        if (++spawns === 1) throw new Error('simulated unavailable helper');
        return worker.child;
    } });
    assert.equal(f.health.executionEnabled, true);
    assert.equal(f.health.executorReady, false); assert.equal(f.health.executorState, 'unavailable');
    assert.equal((await f.post('SELECT')).status, 503);
    const retry = () => fetch(f.base + '/prepare', { method: 'POST', headers: {
        'Content-Type': 'application/json', 'X-SenseRing-Token': f.health.sessionToken }, body: '{}' });
    assert.equal((await retry()).status, 202);
    assert.equal((await retry()).status, 202);
    assert.equal(spawns, 2); assert.deepEqual(worker.writes, []);
    worker.ready();
    const ready = await (await fetch(f.base + '/health')).json();
    assert.equal(ready.executorReady, true);
    assert.equal((await retry()).status, 200);
    assert.equal(spawns, 2); assert.deepEqual(worker.writes, []);
});

test('a ready helper exit immediately removes readiness and health never silently restarts it', async t => {
    const worker = fakeWorker(); let spawns = 0;
    const f = await fixture(t, { executeCommand: undefined, spawn: () => { spawns++; return worker.child; } });
    worker.ready();
    assert.equal((await (await fetch(f.base + '/health')).json()).executorReady, true);
    worker.child.kill();
    const failed = await (await fetch(f.base + '/health')).json();
    assert.equal(failed.executorState, 'unavailable'); assert.equal(failed.executorReady, false);
    assert.equal((await f.post('NEXT')).status, 503);
    assert.equal(spawns, 1); assert.deepEqual(worker.writes, []);
});

test('prepare endpoint requires the existing origin, token and JSON protections', async t => {
    const f = await fixture(t);
    const request = headers => fetch(f.base + '/prepare', { method: 'POST', headers, body: '{}' });
    assert.equal((await request({ 'Content-Type': 'application/json' })).status, 403);
    const token = { 'X-SenseRing-Token': f.health.sessionToken };
    assert.equal((await request(token)).status, 415);
    assert.equal((await request({ ...token, 'Content-Type': 'application/json', Origin: 'https://attacker.example' })).status, 403);
    assert.equal((await request({ ...token, 'Content-Type': 'application/json' })).status, 200);
    assert.equal(f.delivered.length, 0);
    const disabled = await fixture(t, { executionEnabled: false });
    assert.equal((await fetch(disabled.base + '/prepare', { method: 'POST', headers: {
        'X-SenseRing-Token': disabled.health.sessionToken, 'Content-Type': 'application/json' }, body: '{}' })).status, 409);
});
