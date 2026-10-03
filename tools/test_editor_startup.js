/* jsc tools/test_editor_startup.js — full editor startup with a small DOM/API fixture. */
const nodes = new Map();
class ElementFixture {
  constructor() {
    this.children = []; this.dataset = {}; this.style = {}; this.value = ''; this.textContent = '';
    this.classList = { add() {}, remove() {}, toggle() {} };
  }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  addEventListener() {}
  setAttribute(name, value) { this[name] = value; }
  querySelectorAll() { return []; }
  reset() {}
  before(node) { nodes.set('#' + node.id, node); }
}
var window = { location: { assign() {} } };
var document = {
  body: new ElementFixture(), documentElement: new ElementFixture(),
  querySelector(selector) {
    if (selector === '#sort-hint' && !nodes.has(selector)) return null;
    if (!nodes.has(selector)) nodes.set(selector, new ElementFixture());
    return nodes.get(selector);
  },
  querySelectorAll() { return []; },
  createElement() { return new ElementFixture(); },
  createElementNS() { return new ElementFixture(); },
};
var location = { protocol: 'http:', hostname: '127.0.0.1' };
var localStorage = { getItem() { return 'en'; }, setItem() {} };
let fetched = 0;
var fetch = async url => {
  if (url !== '/admin/api/state') throw new Error('Unexpected request: ' + url);
  fetched++;
  return { status: 200, ok: true, json: async () => ({ csrf: 'test', films: [], isoValues: [], library: [], collections: [
    { id: 'trip', year: '2026', title: 'Trip', customTitle: true, locations: [], photos: [
      { name: 'photo.jpg', preview: '/assets/collections/previews/abcdef-480.jpg', medium: 'digital', orientation: 'portrait', colorMode: 'color' },
    ] },
  ] }) };
};
// No separately loaded sortable.js: the editor must bootstrap on its own.
eval(readFile('tools/admin/editor.js'));
Promise.resolve().then(() => Promise.resolve()).then(() => Promise.resolve()).then(() => {
  const status = nodes.get('#status');
  if (fetched !== 1 || !status.textContent.startsWith('Ready.')) throw new Error('Startup failed: ' + status.textContent);
  const photos = nodes.get('#photo-grid').children;
  if (photos.length !== 1 || photos[0].dataset.sortKey !== 'photo.jpg') throw new Error('Photo cards were not rendered');
  if (!photos[0].children.some(node => node.src === '/assets/collections/previews/abcdef-480.jpg')) throw new Error('Missing photo image');
  if (typeof window.WizjeSortable?.attach !== 'function') throw new Error('Sorting not initialized');
  print('Full editor startup passed: state fetched, collection and photo rendered, dragging available.');
}).catch(error => { print(error.stack); quit(1); });
