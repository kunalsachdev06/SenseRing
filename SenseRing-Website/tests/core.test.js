'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../sense-ring-core.js');

const UUID = {
    service: '12345678-1234-1234-1234-123456789abc',
    event: 'abcd1234-ab12-ab12-ab12-abcdef123456',
    status: 'abcd1234-ab12-ab12-ab12-abcdef123457'
};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const view = value => {
    const bytes = new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value));
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
};
class FakeEvents {
    constructor() { this.listeners = new Map(); }
    addEventListener(type, listener) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set());
        this.listeners.get(type).add(listener);
    }
    removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
    emit(type) {
        for (const listener of [...(this.listeners.get(type) || [])]) listener.call(this, { type, target: this });
    }
    count(type) { return this.listeners.get(type)?.size || 0; }
}

function fixture(t, options = {}) {
    const events = [], operations = [], writes = [], timers = new Set();
    let active = 0, maxActive = 0, readCount = 0;
    let hardwareMode = options.mode || 'media';
    const snapshot = () => ({
        fw: '2.2.1-touch', mode: hardwareMode, power: 'awake', idle_ms: 0,
        touch_stuck: false, die_c: 34.5, temp_ok: true, cpu_mhz: 80,
        ble_default_dbm: 0, ble_adv_dbm: 0, touch_raw: false, touch_ready: true,
        ...options.status
    });
    function later(callback, ms = 1) {
        const timer = setTimeout(() => { timers.delete(timer); callback(); }, ms);
        timers.add(timer);
    }
    async function operation(kind, callback) {
        active++; maxActive = Math.max(maxActive, active); operations.push(kind);
        try { await delay(options.operationMs || 2); return callback(); }
        finally { active--; }
    }
    const event = new FakeEvents();
    event.value = view('');
    event.properties = { notify: true, write: true, read: true };
    event.startNotifications = async () => {
        if (options.failNotifications) throw new Error('Notification setup failed');
        return event;
    };
    event.stopNotifications = async () => event;
    event.notify = token => { event.value = view(token); event.emit('characteristicvaluechanged'); };
    event.readValue = () => operation('event-read', () => view(hardwareMode === 'presentation' ? 'MODE_PRESENTATION' : 'MODE_DEFAULT'));
    event.writeValueWithResponse = data => operation('write', () => {
        const token = new TextDecoder().decode(data); writes.push(token);
        if (options.autoMode !== false) {
            if (token === 'MODE_PRESENTATION') hardwareMode = 'presentation';
            if (token === 'MODE_DEFAULT' || token === 'MODE_MEDIA') hardwareMode = 'media';
            if (token === 'MODE_TOGGLE') hardwareMode = hardwareMode === 'media' ? 'presentation' : 'media';
        }
        if (options.notifications !== false && (token === 'GET_MODE' || token.startsWith('MODE_'))) {
            later(() => event.notify(hardwareMode === 'presentation' ? 'MODE_PRESENTATION' : 'MODE_DEFAULT'));
        }
    });
    event.writeValue = event.writeValueWithResponse;
    const status = new FakeEvents();
    status.properties = { read: true };
    status.readValue = () => operation('status-read', () => { readCount++; return view(options.statusRaw === undefined ? snapshot() : options.statusRaw); });
    const staleEvent = new FakeEvents();
    let eventRequests = 0;
    const service = { getCharacteristic: async id => {
        if (String(id).toLowerCase() === UUID.event) {
            eventRequests++;
            if (options.firstEventDelayMs && eventRequests === 1) { await delay(options.firstEventDelayMs); return staleEvent; }
            return event;
        }
        if (String(id).toLowerCase() === UUID.status && !options.noStatus) return status;
        const error = new Error('Characteristic not found'); error.name = 'NotFoundError'; throw error;
    } };
    const device = new FakeEvents();
    device.name = 'SmartRing'; device.id = 'test-ring';
    const gatt = {
        connected: false,
        async connect() { if (options.connectMs) await delay(options.connectMs); this.connected = true; return this; },
        async getPrimaryService(id) { assert.equal(String(id).toLowerCase(), UUID.service); return service; },
        disconnect() { if (this.connected) { this.connected = false; device.emit('gattserverdisconnected'); } }
    };
    device.gatt = gatt;
    let requestCount = 0;
    const bluetooth = { requestDevice(request) { requestCount++; assert(request && request.filters); return Promise.resolve(device); } };
    const ring = new Core.RingConnection({ bluetooth, pollMs: options.pollMs ?? 100000, onEvent: e => events.push(e) });
    t.after(() => { ring.disconnect('test-cleanup'); for (const timer of timers) clearTimeout(timer); });
    return {
        ring, event, staleEvent, status, device, gatt, bluetooth, events, writes, operations, options,
        setMode(mode, notify = true) { hardwareMode = mode; if (notify) event.notify(mode === 'presentation' ? 'MODE_PRESENTATION' : 'MODE_DEFAULT'); },
        get maxActive() { return maxActive; }, get readCount() { return readCount; }, get requestCount() { return requestCount; }
    };
}

test('touch tokens infer their source mode and preserve grouped presentation mappings', () => {
    const maps = JSON.parse(JSON.stringify(Core.DEFAULT_MAPPINGS));
    maps.media['touch-hold'] = 'NEXT';
    maps.presentation['slide-forward'] = 'SELECT';
    const media = Core.resolveToken('VOL_UP', 'presentation', maps);
    assert.equal(media.type, 'action'); assert.equal(media.mode, 'media');
    assert.equal(media.input, 'touch-hold'); assert.equal(media.action, 'NEXT');
    const next = Core.resolveToken('SLIDE_NEXT', 'media', maps);
    assert.equal(next.mode, 'presentation'); assert.equal(next.input, 'slide-forward'); assert.equal(next.action, 'SELECT');
    assert.equal(Core.INPUTS.media.length, 5); assert.equal(Core.INPUTS.presentation.length, 3);
    assert.equal(Core.resolveToken('MODE_PRESENTATION', 'media', maps).mode, 'presentation');
    assert.equal(Core.resolveToken('UNRECOGNIZED', 'media', maps), null);
    assert.equal(Core.ACTIONS.SLIDE_NEXT.bridgeCommand, 'SLIDE_NEXT');
    assert.equal(Core.ACTIONS.SLIDE_PREV.bridgeCommand, 'SLIDE_PREV');
    assert.equal(Core.ACTIONS.SELECT.bridgeCommand, 'SELECT');
});

test('status validation preserves valid zero/false values without manufacturing battery data', () => {
    const s = Core.validateStatus(JSON.stringify({ fw: '2.2.1-touch', mode: 'media', power: 'awake', idle_ms: 0, touch_raw: false, touch_ready: true, touch_stuck: false, die_c: null, temp_ok: false, ble_default_dbm: 0, cpu_mhz: 80, battery_percent: 2 }));
    assert.equal(s.fw, '2.2.1-touch'); assert.equal(s.idle_ms, 0); assert.equal(s.touch_raw, false);
    assert.equal(s.ble_default_dbm, 0); assert.equal(s.temp_ok, false);
    assert(!Object.hasOwn(s, 'battery_percent'));
    assert.equal(Core.validateStatus('{broken'), null);
    assert.equal(Core.validateStatus('[]'), null);
    assert.equal(Core.validateStatus('null'), null);
    assert.equal(Core.validateStatus('{"unrelated":1}'), null);
    const malformed = Core.validateStatus('{"mode":"music","touch_raw":"false","idle_ms":-1,"die_c":"hot","cpu_mhz":80}');
    assert.equal(malformed.cpu_mhz, 80);
    assert(!Object.hasOwn(malformed, 'touch_raw')); assert(!Object.hasOwn(malformed, 'idle_ms'));
    assert(!Object.hasOwn(malformed, 'mode')); assert(!Object.hasOwn(malformed, 'die_c'));
});

test('notification-only live sessions read status on connect without recurring diagnostic traffic', async t => {
    const f = fixture(t, { pollMs: 0 });
    await f.ring.connect();
    assert.equal(f.readCount, 1);
    f.event.notify('PLAY_PAUSE');
    await delay(100);
    assert.equal(f.readCount, 1);
    assert.equal(f.events.filter(event => event.type === 'action').length, 1);
});

test('connect opens the picker immediately and adopts the ring mode without writing a browser default', async t => {
    const f = fixture(t, { mode: 'presentation' });
    const connecting = f.ring.connect();
    assert.equal(f.requestCount, 1, 'requestDevice must run inside the initiating user gesture');
    await connecting;
    assert.equal(f.ring.connected, true); assert.equal(f.ring.mode, 'presentation');
    assert(!f.writes.includes('MODE_DEFAULT')); assert(!f.writes.includes('MODE_MEDIA'));
    assert(f.events.some(e => e.type === 'status' && e.status.fw === '2.2.1-touch'));
    assert.equal(f.event.count('characteristicvaluechanged'), 1);
});

test('optional status absence falls back to GET_MODE without blocking connection', async t => {
    const f = fixture(t, { noStatus: true, mode: 'presentation' });
    await f.ring.connect(); await delay(20);
    assert.equal(f.ring.connected, true); assert.equal(f.ring.mode, 'presentation');
    assert(f.writes.includes('GET_MODE'));
    assert.equal(f.ring.status, null);
});

test('ring notifications never echo a mode write and late action tokens retain their inherent mode', async t => {
    const f = fixture(t);
    await f.ring.connect(); await delay(10);
    const before = f.writes.length;
    f.event.notify('MODE_PRESENTATION');
    f.event.notify('VOL_DOWN');
    await delay(10);
    assert.equal(f.ring.mode, 'presentation'); assert.equal(f.writes.length, before);
    const action = f.events.filter(e => e.type === 'action').at(-1);
    assert.equal(action.mode, 'media'); assert.equal(action.input, 'tap-hold'); assert.equal(action.action, 'VOL_DOWN');
});

test('GATT write acknowledgement alone does not confirm a mode change', async t => {
    const f = fixture(t, { autoMode: false, notifications: false });
    await f.ring.connect();
    let settled = false;
    const pending = f.ring.setMode('presentation').then(() => { settled = true; });
    await delay(80);
    assert(f.writes.includes('MODE_PRESENTATION')); assert.equal(settled, false);
    f.setMode('presentation');
    await pending;
    assert.equal(f.ring.mode, 'presentation');
});

test('same-mode requests finish using confirmed status rather than waiting for a new mode notification', async t => {
    const f = fixture(t, { notifications: false });
    await f.ring.connect();
    await f.ring.setMode('media');
    assert.equal(f.ring.mode, 'media'); assert.equal(f.ring.connected, true);
});

test('reads and writes share one GATT operation queue', async t => {
    const f = fixture(t, { operationMs: 12 });
    await f.ring.connect();
    await Promise.all([f.ring.readStatus(), f.ring.requestMode(), f.ring.readStatus()]);
    assert.equal(f.maxActive, 1, 'overlapping GATT reads/writes can fail on the real browser stack');
});

test('disconnect cancels stale reads and stops polling', async t => {
    const f = fixture(t, { operationMs: 25, pollMs: 25 });
    await f.ring.connect();
    const pending = f.ring.readStatus();
    f.ring.disconnect('user');
    const afterDisconnect = f.events.length;
    const settled = await Promise.allSettled([pending]);
    assert.equal(settled[0].status, 'rejected');
    const reads = f.readCount;
    await delay(100);
    assert.equal(f.ring.connected, false); assert.equal(f.readCount, reads);
    assert(!f.events.slice(afterDisconnect).some(e => e.type === 'status'));
    assert.equal(f.event.count('characteristicvaluechanged'), 0);
});

test('reconnect installs one notification listener and never duplicates actions', async t => {
    const f = fixture(t);
    await f.ring.connect();
    f.ring.disconnect('user');
    assert.equal(f.event.count('characteristicvaluechanged'), 0);
    await f.ring.connect(); await delay(5);
    const before = f.events.filter(e => e.type === 'action').length;
    f.event.notify('PLAY_PAUSE');
    assert.equal(f.events.filter(e => e.type === 'action').length, before + 1);
    assert.equal(f.event.count('characteristicvaluechanged'), 1);
});

test('notification setup failure cleans up and allows a fresh connection', async t => {
    const f = fixture(t, { failNotifications: true });
    await assert.rejects(f.ring.connect(), /Notification setup failed/);
    assert.equal(f.ring.connected, false);
    assert.equal(f.event.count('characteristicvaluechanged'), 0);
    f.options.failNotifications = false;
    await f.ring.connect(); assert.equal(f.ring.connected, true);
});

test('sleep sends the firmware sleep command without inventing battery or wake capability', async t => {
    const f = fixture(t);
    await f.ring.connect();
    await f.ring.sleep();
    assert(f.writes.includes('SLEEP'));
    assert.equal(f.ring.status?.battery_percent, undefined);
});
test('status readback can confirm a real mode change when notifications are absent', async t => {
    const f = fixture(t, { notifications: false });
    await f.ring.connect();
    await f.ring.setMode('presentation');
    assert.equal(f.ring.mode, 'presentation');
    assert(f.writes.includes('MODE_PRESENTATION'));
    assert(f.events.some(e => e.type === 'status' && e.status.mode === 'presentation'));
});

test('physical disconnection rejects a pending mode confirmation promptly', async t => {
    const f = fixture(t, { autoMode: false, notifications: false });
    await f.ring.connect();
    const pending = f.ring.setMode('presentation');
    const rejection = assert.rejects(pending);
    await delay(20);
    f.gatt.disconnect();
    await rejection;
    assert.equal(f.ring.connected, false);
    assert.equal(f.event.count('characteristicvaluechanged'), 0);
});
test('cancel during a pending physical connection closes a connection that resolves late', async t => {
    const f = fixture(t, { connectMs: 50 });
    const pending = f.ring.connect();
    const rejection = assert.rejects(pending);
    await delay(10);
    f.ring.disconnect('user');
    await rejection;
    assert.equal(f.ring.connected, false);
    assert.equal(f.gatt.connected, false, 'a cancelled late physical connection must not remain open');
    assert.equal(f.device.count('gattserverdisconnected'), 0);
});
test('a stale characteristic discovery cannot overwrite or disconnect a fresh session', async t => {
    const f = fixture(t, { firstEventDelayMs: 60 });
    const previous = f.ring.connect();
    const rejection = assert.rejects(previous);
    await delay(10);
    f.ring.disconnect('user');
    await f.ring.connect();
    await rejection;
    assert.equal(f.ring.connected, true); assert.equal(f.gatt.connected, true);
    assert.equal(f.event.count('characteristicvaluechanged'), 1);
    assert.equal(f.staleEvent.count('characteristicvaluechanged'), 0);
    const actions = f.events.filter(e => e.type === 'action').length;
    f.event.notify('PLAY_PAUSE');
    assert.equal(f.events.filter(e => e.type === 'action').length, actions + 1);
});
