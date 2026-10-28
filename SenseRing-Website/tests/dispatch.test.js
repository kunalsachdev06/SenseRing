'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Core = require('../sense-ring-core.js');
const source = fs.readFileSync(path.join(__dirname, '../gesture-ring-script.js'), 'utf8');
const between = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const delivery = between('async function deliver(', "on('clear-activity-btn'");
const cancellation = between('function invalidateActions()', 'function renderOutputState()');

function fixture() {
  const requests = [], records = [];
  const state = { commandDepth: 0, commandAborts: new Set(), bridge: { epoch: 1, ready: true, token: 'test-token' },
    session: 1, actionEpoch: 1, controlsEnabled: true, modePending: false, sleepRequested: false, activity: records };
  const context = vm.createContext({ state, ring: { connected: true }, bridgeBase: 'http://fixture.invalid', AbortController,
    text: () => {}, renderActivity: () => {}, checkBridge: () => {},
    timedFetch: (_url, options) => new Promise((resolve, reject) => {
      requests.push({ command: JSON.parse(options.body).command, signal: options.signal,
        confirm: () => resolve({ ok: true, json: async () => ({ ok: true }) }) });
      options.signal.addEventListener('abort', () => reject(new Error('Cancelled')), { once: true });
    })
  });
  vm.runInContext(delivery + '\n' + cancellation, context);
  function send(command = 'VOL_UP') {
    const record = { status: 'pending', detail: 'Sending' }; records.unshift(record);
    return { record, done: context.deliver(command, record, 'ring', 'Volume up') };
  }
  return { context, state, requests, records, send };
}

test('each gesture dispatches immediately without waiting for a previous HTTP acknowledgement', async () => {
  const f = fixture();
  const actions = Array.from({ length: 5 }, () => f.send());
  assert.equal(f.requests.length, 5, 'all fetch calls must begin before any reply resolves');
  assert.equal(f.state.commandDepth, 5);
  f.requests.forEach(request => request.confirm());
  await Promise.all(actions.map(action => action.done));
  assert(actions.every(action => action.record.status === 'delivered'));
  assert.equal(f.state.commandDepth, 0); assert.equal(f.state.commandAborts.size, 0);
});

test('pause or mode/session invalidation cancels every outstanding request without replay', async () => {
  const f = fixture(); const actions = [f.send(), f.send('NEXT'), f.send('PREV')];
  f.context.invalidateActions();
  assert(f.requests.every(request => request.signal.aborted));
  await Promise.all(actions.map(action => action.done));
  assert(actions.every(action => action.record.status === 'failed'));
  assert.equal(f.requests.length, 3); assert.equal(f.state.commandDepth, 0); assert.equal(f.state.commandAborts.size, 0);
});

test('unready, paused, sleeping, disconnected and changing-mode sessions never dispatch', async () => {
  for (const block of [f => { f.state.bridge.ready = false; }, f => { f.state.controlsEnabled = false; },
    f => { f.state.sleepRequested = true; }, f => { f.context.ring.connected = false; }, f => { f.state.modePending = true; }]) {
    const f = fixture(); block(f); const action = f.send(); await action.done;
    assert.equal(f.requests.length, 0); assert.equal(action.record.status, 'failed'); assert.equal(f.state.commandDepth, 0);
  }
});

test('immediate dispatch still bounds outstanding requests rather than growing a browser backlog', async () => {
  const f = fixture(); const actions = Array.from({ length: 9 }, () => f.send());
  assert.equal(f.requests.length, 8); assert.equal(actions[8].record.detail, 'Not sent');
  f.requests.forEach(request => request.confirm()); await Promise.all(actions.map(action => action.done));
  assert.equal(f.state.commandDepth, 0);
});

test('mapped commands leave before feedback and never schedule a dashboard model', () => {
  const order = [];
  const context = vm.createContext({ Core, state: { mode: 'media', controlsEnabled: true, modePending: false, sleepRequested: false,
    connection: 'connected', bridge: { ready: true } },
    $: () => null, text: () => order.push('text'), clearTimeout: () => {}, setTimeout: () => 1,
    addActivity: (_title, _detail, _source, _status, render) => { assert.equal(render, false); return {}; },
    deliver: command => order.push(command), renderActivity: () => order.push('activity'),
    liveVisual: { pulse: () => order.push('model'), animateGesture: () => order.push('model') }
  });
  vm.runInContext(between('function handleAction(', 'function showCinematic('), context);
  context.handleAction(Core.resolveToken('NEXT', 'media'), 'ring');
  assert.equal(order[0], 'NEXT'); assert(order.includes('activity'));assert(order.includes('text'));
  assert.equal(order.filter(item => item === 'model').length, 0, 'dashboard gestures must not start a model render');
});
