'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Companion = require('../companion-state.js');
const health = overrides => ({ ok: true, name: 'SenseRing Bridge', sessionToken: 'a'.repeat(48),
  executionEnabled: true, executorState: 'ready', executorReady: true, ...overrides });

test('only a confirmed ready helper enables delivery', () => {
  assert.equal(Companion.normalizeHealth(health()).ready, true);
  for (const state of ['starting', 'unavailable', 'stopped', 'unknown']) {
    for (const flag of [true, false]) {
      const actual = Companion.normalizeHealth(health({ executorState: state, executorReady: flag }));
      assert.equal(actual.ready, false);
    }
  }
  for (const flag of [false, 'true', 1, null])
    assert.equal(Companion.normalizeHealth(health({ executorReady: flag })).ready, false);
});

test('old companions offer an update rather than assuming readiness from configuration', () => {
  const old = health(); delete old.executorReady; delete old.executorState;
  assert.equal(Companion.normalizeHealth(old).state, 'update-required');
  assert.equal(Companion.normalizeHealth(old).ready, false);
  assert.match(Companion.message('update-required').detail, /Close the previous companion/);
});

test('disabled control stays disabled even with an inconsistent ready flag', () => {
  for (const value of [false, null, 'true', 1]) {
    const result = Companion.normalizeHealth(health({ executionEnabled: value }));
    assert.equal(result.state, 'disabled'); assert.equal(result.ready, false);
  }
});

test('failed or unrelated health responses are rejected without exposing a delivery state', () => {
  for (const value of [null, {}, health({ name: 'Other app' }), health({ ok: false }), health({ sessionToken: '' })])
    assert.throws(() => Companion.normalizeHealth(value), /compatible companion/);
});

test('all setup states have a user recovery message', () => {
  for (const state of ['checking', 'missing', 'starting', 'ready', 'unavailable', 'disabled', 'update-required']) {
    const message = Companion.message(state);
    assert(message.title && message.detail && message.chip);
  }
  assert.match(Companion.message('missing').detail, /Download/);
  assert.match(Companion.message('unavailable').detail, /Retry/);
});
