/* SenseRing 2.2.x touch protocol. Injectable Bluetooth adapter; no DOM or system keys. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SenseRingCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const BLE = Object.freeze({
    name: 'SmartRing', service: '12345678-1234-1234-1234-123456789abc',
    event: 'abcd1234-ab12-ab12-ab12-abcdef123456', status: 'abcd1234-ab12-ab12-ab12-abcdef123457',
    DEVICE_NAME: 'SmartRing', SERVICE: '12345678-1234-1234-1234-123456789abc',
    COMMAND: 'abcd1234-ab12-ab12-ab12-abcdef123456', STATUS: 'abcd1234-ab12-ab12-ab12-abcdef123457'
  });
  const TIMINGS = Object.freeze({ firstTapMs: 140, followupTapMs: 70, releaseMs: 60,
    multiTapGapMs: 250, tripleDecisionMs: 120, holdMs: 700, rearmMs: 180,
    idleSleepMs: 900000, powerHoldMs: 2000, startupMs: 2000 });
  const PIN_CONNECTIONS = Object.freeze({ touchVcc: '3V3', touchGround: 'GND', touchOutput: 'D2 / GPIO4', button: 'D1 / GPIO3 to GND' });
  const ACTIONS = Object.freeze(Object.fromEntries([
    ['PLAY_PAUSE', 'Play / pause'], ['NEXT', 'Next track'], ['PREV', 'Previous track'],
    ['VOL_UP', 'Volume up'], ['VOL_DOWN', 'Volume down'],
    ['SLIDE_NEXT', 'Next slide'], ['SLIDE_PREV', 'Previous slide'], ['SELECT', 'Select / Enter'],
    ['SCROLL_UP', 'Page up'], ['SCROLL_DOWN', 'Page down']
  ].map(([id, label]) => [id, Object.freeze({ id, label, bridgeCommand: id })])));
  const ACTION_ORDER = Object.freeze(Object.keys(ACTIONS));
  const INPUTS = Object.freeze({
    media: Object.freeze([
      { id: 'tap-single', label: 'Single tap', description: 'One deliberate touch, then lift', token: 'PLAY_PAUSE' },
      { id: 'tap-double', label: 'Double tap', description: 'Two touches with a clear lift between', token: 'NEXT' },
      { id: 'tap-triple', label: 'Triple tap', description: 'First tap deliberate; next two quicker', token: 'PREV' },
      { id: 'touch-hold', label: 'Touch and hold', description: 'Hold at least 0.7 s; up to five steps', token: 'VOL_UP' },
      { id: 'tap-hold', label: 'Tap then hold', description: 'Tap, lift, then hold within 0.25 s', token: 'VOL_DOWN' }
    ].map(Object.freeze)),
    presentation: Object.freeze([
      { id: 'slide-forward', label: 'Single tap / hold', description: 'These inputs share one ring message', token: 'SLIDE_NEXT', shared: true },
      { id: 'slide-back', label: 'Double tap / tap-and-hold', description: 'These inputs share one ring message', token: 'SLIDE_PREV', shared: true },
      { id: 'select', label: 'Triple tap', description: 'Three touches select or confirm', token: 'SELECT' }
    ].map(Object.freeze))
  });
  const DEFAULT_MAPPINGS = Object.freeze(Object.fromEntries(Object.entries(INPUTS).map(([mode, inputs]) =>
    [mode, Object.freeze(Object.fromEntries(inputs.map(input => [input.id, input.token]))) ])));
  const TOKEN_INPUTS = Object.freeze(Object.fromEntries(Object.entries(INPUTS).flatMap(([mode, inputs]) =>
    inputs.map(input => [input.token, Object.freeze({ mode, input })]))));
  function normalizeMode(mode) {
    if (typeof mode !== 'string') return null;
    const value = mode.trim().toUpperCase();
    if (['MEDIA', 'DEFAULT', 'MODE_MEDIA', 'MODE_DEFAULT'].includes(value)) return 'media';
    if (['PRESENTATION', 'MODE_PRESENTATION'].includes(value)) return 'presentation';
    return null;
  }
  function resolveToken(raw, _mode, mappings = DEFAULT_MAPPINGS) {
    if (typeof raw !== 'string' || raw.length > 80) return null;
    const token = raw.trim();
    if (token === 'MODE_DEFAULT' || token === 'MODE_MEDIA' || token === 'MODE_PRESENTATION')
      return { type: 'mode', mode: normalizeMode(token), token };
    // Token identity, rather than the latest UI mode, disambiguates delayed notifications.
    if (Object.hasOwn(TOKEN_INPUTS, token)) {
      const { mode, input } = TOKEN_INPUTS[token];
      const requested = mappings && mappings[mode] && mappings[mode][input.id];
      return { type: 'action', mode, input: input.id, label: input.label, token,
        defaultAction: token, action: ACTIONS[requested] ? requested : DEFAULT_MAPPINGS[mode][input.id] };
    }
    return null;
  }
  function validateStatus(raw) {
    let data = raw;
    if (typeof raw === 'string') {
      if (raw.length > 1024) return null;
      try { data = JSON.parse(raw); } catch (_) { return null; }
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const result = {};
    if (typeof data.fw === 'string' && /^[a-zA-Z0-9._-]{1,48}$/.test(data.fw)) result.fw = data.fw;
    if (data.mode === 'media' || data.mode === 'presentation') result.mode = data.mode;
    if (data.power === 'awake' || data.power === 'sleep_pending') result.power = data.power;
    for (const key of ['touch_stuck', 'temp_ok', 'touch_raw', 'touch_ready'])
      if (typeof data[key] === 'boolean') result[key] = data[key];
    if (Number.isInteger(data.idle_ms) && data.idle_ms >= 0 && data.idle_ms <= 4294967295) result.idle_ms = data.idle_ms;
    if (typeof data.die_c === 'number' && Number.isFinite(data.die_c) && data.die_c >= -40 && data.die_c <= 125) result.die_c = data.die_c;
    if (Number.isInteger(data.cpu_mhz) && data.cpu_mhz > 0 && data.cpu_mhz <= 240) result.cpu_mhz = data.cpu_mhz;
    for (const key of ['ble_default_dbm', 'ble_adv_dbm'])
      if (Number.isInteger(data[key]) && data[key] >= -128 && data[key] <= 30) result[key] = data[key];
    return Object.keys(result).length ? result : null;
  }
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  function decode(value) {
    if (typeof value === 'string') return value;
    if (value instanceof DataView) return decoder.decode(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
    if (value instanceof ArrayBuffer) return decoder.decode(value);
    if (ArrayBuffer.isView(value)) return decoder.decode(value);
    throw new Error('The ring returned unreadable Bluetooth data.');
  }
  function sessionError() { return new Error('The ring connection changed. Reconnect before trying again.'); }
  class RingConnection {
    constructor(options = {}) {
      this.bluetooth = options.bluetooth || (typeof navigator !== 'undefined' ? navigator.bluetooth : null);
      this.onEvent = typeof options.onEvent === 'function' ? options.onEvent : function () {};
      this.pollMs = options.pollMs === 0 ? 0 : Math.max(50, options.pollMs || 1500);
      this.modeTimeoutMs = options.modeTimeoutMs || 4000;
      this.mode = null; this.status = null; this.connected = false; this.device = null;
      this._generation = 0; this._queueTail = Promise.resolve(); this._pollTimer = null;
      this._connecting = false; this._pendingMode = null; this._initialMode = null;
      this._mappings = DEFAULT_MAPPINGS; this._sleepRequested = false;
      this._eventChar = null; this._statusChar = null; this._notify = null; this._lost = null;
    }
    _emit(event) { this.onEvent(event); }
    _check(generation) { if (generation !== this._generation || !this.connected) throw sessionError(); }
    _enqueue(operation, generation = this._generation) {
      const work = this._queueTail.catch(function () {}).then(async () => {
        this._check(generation); const value = await operation(); this._check(generation); return value;
      });
      this._queueTail = work.catch(function () {}); return work;
    }
    setMappings(mappings) {
      this._mappings = Object.fromEntries(Object.entries(INPUTS).map(([mode, inputs]) => [mode,
        Object.fromEntries(inputs.map(input => {
          const value = mappings && mappings[mode] && mappings[mode][input.id];
          return [input.id, ACTIONS[value] ? value : DEFAULT_MAPPINGS[mode][input.id]];
        }))]));
    }
    _applyMode(mode, source) {
      if (!mode) return;
      const pending = this._pendingMode;
      if (pending && source === 'status' && (mode !== pending.desired || Date.now() - pending.sentAt < 350)) return;
      const changed = this.mode !== mode; this.mode = mode;
      if (this._initialMode) { const initial = this._initialMode; this._initialMode = null; clearTimeout(initial.timer); initial.resolve(); }
      if (changed || pending && mode === pending.desired) this._emit({ type: 'mode', mode, source });
      if (pending && pending.armed && mode === pending.desired) this._finishMode(null);
    }
    _finishMode(error) {
      const pending = this._pendingMode; if (!pending) return;
      this._pendingMode = null; clearTimeout(pending.timer); clearTimeout(pending.readTimer);
      if (error) pending.reject(error); else pending.resolve(this.mode);
    }
    _handleNotification(event, generation) {
      if (generation !== this._generation || !this.connected) return;
      try {
        const resolved = resolveToken(decode(event.target.value), this.mode, this._mappings);
        if (!resolved) return;
        if (resolved.type === 'mode') this._applyMode(resolved.mode, 'notification');
        else this._emit(resolved);
      } catch (error) { this._emit({ type: 'error', error, operation: 'notification' }); }
    }
    async connect() {
      if (this.connected) return this;
      if (this._connecting) throw new Error('A Bluetooth connection is already being opened.');
      if (!this.bluetooth) throw new Error('This browser does not support Web Bluetooth.');
      const generation = ++this._generation; this._connecting = true; this.mode = null; this.status = null;
      this._queueTail = Promise.resolve(); this._sleepRequested = false;
      this._emit({ type: 'connection', state: 'connecting' });
      let selected;
      try {
        // Keep requestDevice in the original click stack to preserve browser user activation.
        const selection = this.bluetooth.requestDevice({ filters: [{ name: BLE.name }], optionalServices: [BLE.service] });
        selected = await selection;
        if (generation !== this._generation) throw sessionError();
        this.device = selected;
        this._lost = () => { if (generation === this._generation) this.disconnect(this._sleepRequested ? 'sleep' : 'lost'); };
        selected.addEventListener('gattserverdisconnected', this._lost);
        const server = await selected.gatt.connect();
        if (generation !== this._generation) throw sessionError();
        const service = await server.getPrimaryService(BLE.service);
        if (generation !== this._generation) throw sessionError();
        const eventChar = await service.getCharacteristic(BLE.event);
        if (generation !== this._generation) throw sessionError();
        let statusChar;
        try { statusChar = await service.getCharacteristic(BLE.status); }
        catch (_) { statusChar = null; }
        if (generation !== this._generation) throw sessionError();
        this._eventChar = eventChar; this._statusChar = statusChar;
        this.connected = true;
        this._notify = event => this._handleNotification(event, generation);
        this._eventChar.addEventListener('characteristicvaluechanged', this._notify);
        await this._enqueue(() => this._eventChar.startNotifications(), generation);
        if (this._statusChar) {
          try { await this.readStatus(); }
          catch (error) { if (generation === this._generation) this._emit({ type: 'error', error, scope: 'status' }); }
        }
        this._check(generation);
        if (!this.mode) {
          const modeReady = new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
              if (this._initialMode) this._initialMode = null;
              reject(new Error('The ring did not report its mode. Check that the touch firmware is installed.'));
            }, this.modeTimeoutMs);
            this._initialMode = { resolve, reject, timer };
          });
          // Attach a handler immediately, even if the GATT write itself fails.
          modeReady.catch(function () {});
          await this.requestMode(); await modeReady;
        }
        this._check(generation); this._connecting = false;
        this._emit({ type: 'connection', state: 'connected' }); this._schedulePoll(generation);
        return this;
      } catch (error) {
        if (generation === this._generation) this.disconnect('failed');
        else if (selected && selected.gatt.connected && (selected !== this.device || !this.connected && !this._connecting)) selected.gatt.disconnect();
        throw error;
      }
    }
    async _writeRaw(command) {
      const char = this._eventChar;
      if (!char) throw sessionError();
      const value = encoder.encode(command);
      if (typeof char.writeValueWithResponse === 'function' && (!char.properties || char.properties.write !== false))
        return char.writeValueWithResponse(value);
      if (typeof char.writeValue === 'function') return char.writeValue(value);
      throw new Error('The ring characteristic does not support command writes.');
    }
    requestMode() { return this._enqueue(() => this._writeRaw('GET_MODE')); }
    async readStatus() {
      if (!this._statusChar) return null;
      const generation = this._generation;
      return this._enqueue(async () => {
        const value = await this._statusChar.readValue(); this._check(generation);
        const status = validateStatus(decode(value));
        if (!status) throw new Error('The ring returned invalid diagnostics.');
        this.status = status;
        if (status.mode) this._applyMode(status.mode, 'status');
        this._emit({ type: 'status', status }); return status;
      }, generation);
    }
    _schedulePoll(generation) {
      if (!this.pollMs || !this._statusChar || generation !== this._generation || !this.connected) return;
      clearTimeout(this._pollTimer);
      this._pollTimer = setTimeout(async () => {
        try { await this.readStatus(); }
        catch (error) { if (generation === this._generation && this.connected) this._emit({ type: 'error', error, scope: 'status' }); }
        if (generation === this._generation && this.connected) this._schedulePoll(generation);
      }, this.pollMs);
    }
    setMode(requested) {
      const desired = normalizeMode(requested);
      if (!desired) return Promise.reject(new Error('Unknown ring mode.'));
      if (!this.connected || this._connecting) return Promise.reject(sessionError());
      if (this._pendingMode) return Promise.reject(new Error('Wait for the current mode change to finish.'));
      const generation = this._generation;
      const confirmation = new Promise((resolve, reject) => {
        this._pendingMode = { desired, resolve, reject, armed: false, sentAt: Infinity,
          timer: setTimeout(() => this._finishMode(new Error('The ring did not confirm the mode change.')), this.modeTimeoutMs), readTimer: null };
      });
      const request = this._pendingMode;
      this._enqueue(async () => {
        const pending = this._pendingMode;
        if (!pending || pending !== request) throw new Error('Mode request expired before it could be sent.');
        pending.armed = true; pending.sentAt = Date.now();
        await this._writeRaw(desired === 'media' ? 'MODE_DEFAULT' : 'MODE_PRESENTATION');
        this._check(generation); await this._writeRaw('GET_MODE');
        if (this._pendingMode === pending && this._statusChar) {
          pending.readTimer = setTimeout(() => {
            if (this._pendingMode !== pending || generation !== this._generation) return;
            this.readStatus().catch(error => { if (generation === this._generation) this._emit({ type: 'error', error, scope: 'status' }); });
          }, 375);
        }
      }, generation).catch(error => { if (generation === this._generation && this._pendingMode === request) this._finishMode(error); });
      return confirmation;
    }
    async sleep() {
      if (!this.connected || this._connecting) throw sessionError();
      this._sleepRequested = true;
      try { await this._enqueue(() => this._writeRaw('SLEEP')); this._emit({ type: 'sleep', state: 'requested' }); }
      catch (error) {
        if (this._lastDisconnectReason === 'sleep' && !this.connected) return;
        this._sleepRequested = false; throw error;
      }
    }
    disconnect(reason = 'user') {
      const hadConnection = this.connected || this._connecting;
      ++this._generation; this.connected = false; this._connecting = false; this._lastDisconnectReason = reason;
      clearTimeout(this._pollTimer); this._pollTimer = null;
      this._finishMode(sessionError());
      if (this._initialMode) {
        const initial = this._initialMode; this._initialMode = null; clearTimeout(initial.timer); initial.reject(sessionError());
      }
      if (this._eventChar && this._notify) this._eventChar.removeEventListener('characteristicvaluechanged', this._notify);
      if (this.device && this._lost) this.device.removeEventListener('gattserverdisconnected', this._lost);
      if (this.device && this.device.gatt.connected) this.device.gatt.disconnect();
      this._eventChar = null; this._statusChar = null; this._notify = null; this._lost = null;
      this.status = null; this._queueTail = Promise.resolve(); this._sleepRequested = false;
      if (hadConnection) this._emit({ type: 'connection', state: 'disconnected', reason });
    }
  }
  return Object.freeze({ BLE, TIMINGS, PIN_CONNECTIONS, INPUTS, DEFAULT_MAPPINGS, ACTIONS, ACTION_ORDER,
    normalizeMode, resolveToken, validateStatus, RingConnection });
});
