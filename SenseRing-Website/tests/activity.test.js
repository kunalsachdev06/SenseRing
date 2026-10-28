'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const app = fs.readFileSync(path.join(__dirname, '../gesture-ring-script.js'), 'utf8');
const source = app.slice(app.indexOf('const activityRows='), app.indexOf('function handleAction('));

function fixture() {
  let created = 0;
  class Element {
    constructor() { this.children = []; this.textContent = ''; this.dataset = {}; created++; }
    append(...items) { for (const item of items) this.insertBefore(item, null); }
    insertBefore(item, before) {
      item.remove(); const index = before ? this.children.indexOf(before) : this.children.length;
      this.children.splice(index, 0, item); item.parent = this;
    }
    remove() { if (this.parent) { this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; } }
    replaceChildren(...items) { for (const child of [...this.children]) child.remove(); this.append(...items); }
  }
  const target = new Element(), state = { activity: [], nextId: 1 };
  const context = vm.createContext({ state, $: () => target, document: { createElement: () => new Element() } });
  vm.runInContext(source, context);
  return { target, state, api: context, created: () => created };
}
test('delivery acknowledgement updates the existing activity row without rebuilding it', () => {
  const f = fixture();
  const record = f.api.addActivity('Single tap → Next slide', 'Sending…', 'Ring', 'pending');
  const row = f.target.children[0], time = row.children[0], created = f.created();
  record.detail = 'Sent'; f.api.renderActivity();
  assert.equal(f.target.children[0], row); assert.equal(row.children[0], time);
  assert.equal(f.created(), created); assert.match(row.children[1].textContent, /Sent$/);
  assert.equal(time.textContent, record.timeLabel);
});
test('bursts retain the newest ten rows and preserve existing nodes and preview labels', () => {
  const f = fixture();
  const first = f.api.addActivity('Triple tap → Select', 'Preview', 'Preview', 'preview');
  const node = f.target.children[0];
  for (let i = 0; i < 9; i++) f.api.addActivity('Action ' + i, 'Sent', 'Ring', 'delivered');
  assert.equal(f.target.children[9], node); assert.equal(f.target.children.length, 10);
  assert.match(node.children[1].textContent, /Preview/);
  f.api.addActivity('Newest', 'Sent', 'Ring', 'delivered');
  assert.equal(f.target.children.length, 10); assert.equal(node.parent, null);
  assert(!f.state.activity.includes(first)); assert.match(f.target.children[0].children[1].textContent, /^Newest/);
});
test('empty state is stable, disappears on new input, and can be restored by clear', () => {
  const f = fixture(); f.api.renderActivity(); const empty = f.target.children[0], created = f.created();
  f.api.renderActivity(); assert.equal(f.target.children[0], empty); assert.equal(f.created(), created);
  f.api.addActivity('Tap', 'Preview', 'Preview', 'preview'); assert.equal(empty.parent, null);
  f.state.activity = []; f.api.renderActivity();
  assert.equal(f.target.children.length, 1); assert.equal(f.target.children[0].textContent, 'No activity yet.');
  f.api.addActivity('Tap again', 'Sent', 'Ring', 'delivered'); assert.equal(f.target.children.length, 1);
  assert.match(f.target.children[0].children[1].textContent, /^Tap again/);
});
