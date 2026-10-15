/* Run with macOS JavaScriptCore jsc. Exercises the actual detail handlers. */
const assert = (value, message) => { if (!value) throw new Error(message); };
class Element {
  constructor() { this.children = []; this.handlers = {}; this.dataset = {}; this.style = { setProperty(k,v) { this[k] = v; } }; this.hidden = false; this.value = ''; }
  append(...nodes) { nodes.forEach(node => { node.parent = this; this.children.push(node); }); }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  remove() { this.parent.children = this.parent.children.filter(node => node !== this); }
  setAttribute(k,v) { this[k] = v; }
  addEventListener(k,v) { (this.handlers[k] ||= []).push(v); }
  emit(k,v = {}) { (this.handlers[k] || []).forEach(fn => fn(v)); }
  querySelectorAll(selector) { return this.children.filter(child => selector === 'label'); }
  querySelector() { return this.children.flatMap(child => child.children).find(node => node.checked); }
  getBoundingClientRect() { return { left:0, top:0, right:300, bottom:400, width:300, height:400 }; }
  getContext() { return { scale() {}, fillRect() {}, drawImage(...args) { globalThis.lastDraw = args; } }; }
  setPointerCapture() {}
}
const nodes = new Map();
const node = key => { if (!nodes.has(key)) nodes.set(key, new Element()); return nodes.get(key); };
const dialog = new Element(); dialog.open = true; dialog.dataset.margins = 'true';
dialog.querySelector = key => key.includes('poster-size') ? node('.photo-detail__sizes').querySelector() : node(key);
const document = { documentElement: { lang:'pl' }, createElement: () => new Element(), addEventListener() {} };
const window = { matchMedia: () => ({matches:false}), addEventListener() {}, ZWIDY_POSTERS: [{name:'30 × 40 cm',priceCents:1000},{name:'50 × 70 cm',priceCents:2000}] };
const navigator = {};
let nextImage;
class Image { constructor() { nextImage = this; this.naturalWidth = 3360; this.naturalHeight = 2240; } }
const setTimeout = () => 1, clearTimeout = () => {};
const translations = { pl: { marginDimensions:'{x}|{y}|{w}|{h}', marginUnknown:'unknown', magnifierLoading:'loading', magnifierError:'error' }, en: {} };
let api;
const code = readFile('collections.js');
// Keep the production dialog code, omit gallery bootstrap and expose its closures for the fixture.
eval(code.slice(0, code.indexOf('  class DrumCard')) + `
  const source = [];
  api = {paperDimensions, sourcePoint, availablePosters, renderPhotoSizes, updateOrderSummary, marginDescription, setupMagnifier, resetMagnifier,
    set(photo) { detailDialog = dialog; detailPhoto = photo; detailCollection = {id:'test',title:'Test',year:'2026',photos:[photo]}; }};
})();`);
assert(JSON.stringify(api.paperDimensions({name:'30 × 40 cm'}, false)) === '[30,40]', 'portrait dimensions');
assert(JSON.stringify(api.paperDimensions({name:'30 x 40 cm'}, true)) === '[40,30]', 'landscape dimensions');
assert(api.paperDimensions({name:'0 × 40 cm'}, false) === null, 'zero rejected');
assert(api.paperDimensions({name:'custom'}, false) === null, 'unknown size');
api.set({orientation:'portrait',inspection:'test.jpg',posterSizes:['30 × 40 cm']});
api.renderPhotoSizes(); api.updateOrderSummary();
assert(api.marginDescription() === '2,4|3,2|25,2|33,6', '30x40 margins');
assert(node('.photo-detail__order-summary').value.includes('2,4|3,2'), 'order includes physical margins');
assert(node('.photo-detail__sizes').children.length === 1, 'only assigned format');
dialog.dataset.margins = 'false';
assert(api.marginDescription() === '0|0|30|40', 'no margins');
dialog.dataset.margins = 'true';
api.set({orientation:'landscape',posterSizes:['50 × 70 cm'],inspection:'test.jpg'});
api.renderPhotoSizes(); api.updateOrderSummary();
assert(api.marginDescription() === '5,6|4|58,8|42', 'landscape margins');
assert(node('.photo-detail__sizes').querySelector().value === '50 × 70 cm', 'selection resets between photos');
api.set({posterSizes:[]}); api.renderPhotoSizes(); api.updateOrderSummary();
assert(node('.photo-detail__order').hidden && node('.photo-detail__order-summary').value === '', 'no invalid order for unavailable photo');
api.set({posterSizes:['removed']}); api.renderPhotoSizes(); api.updateOrderSummary();
assert(node('.photo-detail__order').hidden, 'deleted catalogue size does not enable fallback ordering');
api.set({inspection:'test.jpg'}); assert(api.availablePosters().length === 2, 'inherited sizes');
const point = api.sourcePoint(150,200,{width:300,height:400},3360,2240);
assert(point.x === 1680 && point.y === 1120, 'cover crop maps to native source center');
api.setupMagnifier();
const preview = node('.detail-preview'), button = node('.photo-detail__magnify');
preview.emit('pointermove',{pointerType:'touch',clientX:150,clientY:200});
assert(!nextImage, 'touch scroll does not load magnifier');
button.emit('click'); nextImage.onload();
assert(dialog.dataset.magnifier === 'true' && !node('.photo-detail__lens').hidden, 'toggle loads native detail');
assert(lastDraw[0].naturalWidth === 3360, 'draw uses full resolution');
preview.emit('pointermove',{pointerType:'touch',clientX:200,clientY:200});
assert(lastDraw[1] < -1595, 'touch movement changes source sample');
preview.emit('pointercancel'); assert(node('.photo-detail__lens').hidden, 'cancel hides lens');
let prevented = false;
dialog.emit('keydown',{key:'ArrowRight',target:{closest:()=>false},preventDefault(){prevented=true;}});
assert(prevented && !node('.photo-detail__lens').hidden, 'keyboard moves lens');
api.resetMagnifier(); assert(node('.photo-detail__lens').hidden && button['aria-pressed'] === 'false', 'navigation reset');
preview.emit('pointermove',{pointerType:'mouse',clientX:150,clientY:200});
nextImage.onerror(); assert(node('.photo-detail__magnify-status').textContent === 'error', 'loading errors visible');
api.resetMagnifier();
preview.emit('pointermove',{pointerType:'mouse',clientX:150,clientY:200});
const stale = nextImage; api.resetMagnifier(); stale.onload();
assert(node('.photo-detail__lens').hidden, 'stale load cannot show previous photo');
print('Detail checks passed: sizes, margins, orders, source mapping, mouse/touch/keyboard, loading failure and stale load.');
