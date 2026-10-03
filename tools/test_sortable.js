/* Run with JavaScriptCore: jsc tools/test_sortable.js (from the repository root).
   Exercises pointer transactions against an isolated DOM/event fixture. */
class EventTargetFixture {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  dispatch(type, values = {}) {
    const event = { pointerId: 1, button: 0, isPrimary: true, clientX: 50, clientY: 50,
      preventDefault() {}, stopImmediatePropagation() {}, ...values };
    for (const listener of [...(this.listeners.get(type) || [])]) listener(event);
  }
}
class NodeFixture extends EventTargetFixture {
  constructor(key = null) {
    super(); this.dataset = key === null ? {} : { sortKey: key, sortHandle: 'true' };
    this.children = []; this.style = {}; this.isConnected = true;
    const classes = new Set();
    this.classList = { add: x => classes.add(x), remove: x => classes.delete(x) };
  }
  closest(selector) {
    const key = selector === '[data-sort-key]' ? 'sortKey' : 'sortHandle';
    return key in this.dataset ? this : this.parentElement?.closest(selector);
  }
  append(child) { child.remove(); this.children.push(child); child.parentElement = this; }
  remove() {
    if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
    this.parentElement = null;
  }
  insertBefore(child, before) {
    child.remove();
    this.children.splice(before ? this.children.indexOf(before) : this.children.length, 0, child);
    child.parentElement = this;
  }
  get nextSibling() { return this.parentElement.children[this.parentElement.children.indexOf(this) + 1] || null; }
  getBoundingClientRect() {
    const index = 'sortKey' in this.dataset ? this.parentElement.children.indexOf(this) : 0;
    return { left: 0, right: 200, top: index * 100, bottom: 'sortKey' in this.dataset ? (index + 1) * 100 : 300, width: 200, height: 'sortKey' in this.dataset ? 100 : 300 };
  }
  cloneNode() { return new NodeFixture(this.dataset.sortKey); }
  removeAttribute(name) { if (name === 'data-sort-key') delete this.dataset.sortKey; }
  setAttribute() {}
  querySelectorAll() { return []; }
}
var window = new EventTargetFixture();
window.scrollBy = () => {};
var document;
var innerHeight = 800;
var matchMedia = () => ({ matches: true });
var requestAnimationFrame = () => 1;
var cancelAnimationFrame = () => {};
var setTimeout = () => 1;
eval(readFile('tools/admin/editor.js').split('/* Workshop editor. */')[0]);
function assert(value, message) { if (!value) throw new Error(message); }
function fixture() {
  window.WizjeSortable.cancel();
  document = new EventTargetFixture(); document.body = new NodeFixture();
  const container = new NodeFixture();
  for (const key of ['a', 'b', 'c']) container.append(new NodeFixture(key));
  document.elementFromPoint = (x, y) => x < 0 || x > 200 ? null : container.children[Math.floor(y / 100)];
  const drops = [];
  window.WizjeSortable.attach(container, { canStart: () => true, onDrop: (order, expected) => drops.push({ order, expected }) });
  return { container, drops, keys: () => container.children.map(n => n.dataset.sortKey).join(''),
    down: (index = 0) => container.dispatch('pointerdown', { target: container.children[index], clientY: index * 100 + 50 }),
    move: y => document.dispatch('pointermove', { clientY: y }),
    up: (y, x = 50) => document.dispatch('pointerup', { clientY: y, clientX: x }) };
}
let f = fixture(); f.down(); f.move(250);
assert(f.keys() === 'bca', 'Dragging first to last changes the visible order');
f.up(250);
assert(f.drops[0].order.join('') === 'bca' && f.drops[0].expected.join('') === 'abc', 'Save both new order and original revision');
assert(f.keys() === 'bca' && document.body.children.length === 0, 'Keep dropped position visible while saving and remove ghost');

f = fixture(); f.down(2); f.move(50); f.up(50);
assert(f.drops[0].order.join('') === 'cab', 'Move backwards');

f = fixture(); f.down(); f.move(53); f.up(53);
assert(f.drops.length === 0 && f.keys() === 'abc', 'A click or small movement is not a reorder');

f = fixture(); f.down(); f.move(250); document.dispatch('keydown', { key: 'Escape' });
assert(f.drops.length === 0 && f.keys() === 'abc' && !window.WizjeSortable.isDragging(), 'Escape restores original without saving');

f = fixture(); f.down(); f.move(250); f.up(250, 500);
assert(f.drops.length === 0 && f.keys() === 'abc', 'Dropping outside the original list cancels');

f = fixture(); f.down(); f.move(250); document.dispatch('pointercancel');
assert(f.drops.length === 0 && f.keys() === 'abc', 'Pointer cancellation restores original');

f = fixture(); f.down(); f.move(250); window.dispatch('blur');
assert(f.drops.length === 0 && f.keys() === 'abc', 'Losing window focus cancels the transaction');

f = fixture();
window.WizjeSortable.attach(f.container, { canStart: () => false, onDrop: () => { throw new Error('Busy save'); } });
f.down(); f.move(250); f.up(250);
assert(f.keys() === 'abc' && !window.WizjeSortable.isDragging(), 'Rebinding uses the latest busy guard without duplicate listeners');

f = fixture();
const formControl = new NodeFixture(); formControl.parentElement = f.container.children[0];
delete f.container.children[0].dataset.sortHandle;
f.container.dispatch('pointerdown', { target: formControl }); f.move(250); f.up(250);
assert(f.drops.length === 0, 'Inputs outside a drag handle do not start sorting');

f = fixture(); f.down(); f.move(250); f.move(50); f.up(50);
assert(f.drops.length === 0 && f.keys() === 'abc', 'Returning to the original position does not save');
f = fixture(); f.down();
document.elementFromPoint = () => { throw new Error('Animated visual bounds must not drive sorting'); };
f.move(250);
for (let i = 0; i < 20; i++) f.move(250);
assert(f.keys() === 'bca', 'Stationary pointer must not cause animated tiles to swap back');
f.up(250);

f = fixture(); f.down(); f.move(201);
assert(f.keys() === 'abc', 'Small overlap with a tile edge does not trigger a jump');
f.move(250); f.up(250);
assert(f.drops[0].order.join('') === 'bca', 'Entering the tile interior commits the intended position');

const failed = fixture();
window.WizjeSortable.attach(failed.container, { canStart: () => true, onDrop: async () => false });
failed.down(); failed.move(250); failed.up(250);
assert(failed.keys() === 'bca', 'Keep the new position during a pending save');
Promise.resolve().then(() => Promise.resolve()).then(() => {
  assert(failed.keys() === 'abc', 'Failed save rolls the tiles back');
  print('13 sortable interaction checks passed.');
}).catch(error => { print(error.stack); quit(1); });
