/* Shared companion readiness policy. No DOM, Bluetooth or keyboard side effects. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SenseRingCompanion = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MESSAGES = Object.freeze({
    checking: { title: 'Checking your laptop', detail: 'Looking for the SenseRing companion.', chip: 'Checking controls' },
    missing: { title: 'Set up your laptop', detail: 'Download and open the companion below, then retry connection.', chip: 'Set up laptop' },
    starting: { title: 'Starting laptop controls', detail: 'Your companion is opening. This usually takes a few seconds.', chip: 'Starting controls' },
    ready: { title: 'Laptop controls ready', detail: 'Connect your ring on the dashboard, then switch to your music or presentation app.', chip: 'Laptop ready' },
    unavailable: { title: 'Laptop controls unavailable', detail: 'Retry connection to prepare the companion again. If it still cannot start, close and reopen it from its folder.', chip: 'Check controls' },
    disabled: { title: 'Laptop controls are turned off', detail: 'Close the companion and reopen it normally from its folder.', chip: 'Controls off' },
    'update-required': { title: 'Update your companion', detail: 'Download the current version below. Close the previous companion before opening the new copy.', chip: 'Update companion' }
  });
  function normalizeHealth(health) {
    if (!health || health.ok !== true || health.name !== 'SenseRing Bridge' ||
        typeof health.sessionToken !== 'string' || health.sessionToken.length < 16)
      throw new Error('A compatible companion was not found.');
    let state;
    if (!Object.hasOwn(health, 'executorReady') || !Object.hasOwn(health, 'executorState')) state = 'update-required';
    else if (health.executionEnabled !== true) state = 'disabled';
    else if (health.executorState === 'ready' && health.executorReady === true) state = 'ready';
    else if (health.executorState === 'starting' && health.executorReady === false) state = 'starting';
    else state = 'unavailable';
    return { state, ready: state === 'ready', token: health.sessionToken, health };
  }
  function message(state) { return MESSAGES[state] || MESSAGES.unavailable; }
  return Object.freeze({ normalizeHealth, message });
});
