/* Run with macOS JavaScriptCore jsc. Exercises the actual detail handlers. */
const assert = (value, message) => { if (!value) throw new Error(message); };
class Element {
  constructor() { this.children = []; this.handlers = {}; this.dataset = {}; this.style = { setProperty(k,v) { this[k] = v; } }; this.hidden = false; this.value = ''; }
  append(...nodes) { nodes.forEach(node => { node.parent = this; this.children.push(node); }); }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  remove() { this.parent.children = this.parent.children.filter(node => node !== this); }
  setAttribute(k,v) { this[k] = v; }
  removeAttribute(k) { delete this[k]; }
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
  api = {configureGalleryImage, pose, paperDimensions, sourcePoint, availablePosters, renderPhotoSizes, updateOrderSummary, marginDescription, setupMagnifier, resetMagnifier,
    set(photo) { detailDialog = dialog; detailPhoto = photo; detailCollection = {id:'test',title:'Test',year:'2026',photos:[photo]}; }};
})();`);
const galleryImage = new Element();
api.configureGalleryImage(galleryImage, {src:'small.jpg',previewHigh:'large.jpg',orientation:'portrait'});
assert(galleryImage.srcset === 'small.jpg 480w, large.jpg 1440w' && galleryImage.sizes.includes('280px'), 'Retina candidates and portrait sizing');
api.configureGalleryImage(galleryImage, {src:'other.jpg',orientation:'landscape'});
assert(!galleryImage.srcset && !galleryImage.sizes && galleryImage.src === 'other.jpg', 'missing Retina candidate clears stale sources');
assert(api.pose(0,3).transform === 'translate(-50%, -50%)', 'center photo does not keep a 3D raster layer');
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
assert(point.x === 1680 && point.y === 1120, 'contained image maps to native source center');
const edge = api.sourcePoint(0,100,{width:300,height:400},3360,2240);
assert(edge.x === 0 && edge.y === 0, 'contained image top-left maps to full source edge');
api.set({orientation:'landscape',detailWidth:2000,detailHeight:1430,posterSizes:['30 × 40 cm'],inspection:'test.jpg'});
api.renderPhotoSizes(); api.updateOrderSummary();
const fittedWidth = parseFloat(node('.detail-preview').style['--detail-image-width']) / 100 * 40;
const fittedHeight = parseFloat(node('.detail-preview').style['--detail-image-height']) / 100 * 30;
assert(Math.abs(fittedWidth / fittedHeight - 2000 / 1430) < 1e-10, 'different paper ratio preserves full photo proportions');
assert(fittedWidth <= 40 * .84 && fittedHeight <= 30 * .84, 'full photo stays inside margin opening');
assert(api.marginDescription() === '3,2|2,99|33,6|24,02', 'reported margins include extra space from fitting');
dialog.dataset.margins = 'false'; api.updateOrderSummary();
assert(api.marginDescription() === '0|0,7|40|28,6', 'disabling decorative margins still preserves full frame');
dialog.dataset.margins = 'true';
api.setupMagnifier();
const preview = node('.detail-preview');
const lens = node('.photo-detail__lens');
api.resetMagnifier();
preview.emit('pointermove',{pointerType:'touch',pointerId:1,clientX:150,clientY:200});
assert(!nextImage && lens.hidden, 'touch requires a held pointer');
preview.emit('pointerdown',{pointerType:'touch',pointerId:1,clientX:150,clientY:200});
nextImage.onload();
assert(!lens.hidden && lastDraw[0].naturalWidth === 3360, 'touch down loads source and shows lens');
preview.emit('pointermove',{pointerType:'touch',pointerId:1,clientX:200,clientY:200});
assert(lastDraw[1] < -1595, 'held touch moves source sample');
const firstDraw = lastDraw;
preview.emit('pointerdown',{pointerType:'touch',pointerId:2,isPrimary:false,clientX:50,clientY:50});
preview.emit('pointermove',{pointerType:'touch',pointerId:2,clientX:50,clientY:50});
preview.emit('pointerup',{pointerType:'touch',pointerId:2});
assert(lastDraw === firstDraw && !lens.hidden, 'second finger cannot move or end first gesture');
preview.emit('pointerup',{pointerType:'touch',pointerId:1});
assert(lens.hidden, 'release immediately hides lens');
preview.emit('pointermove',{pointerType:'touch',pointerId:1,clientX:150,clientY:200});
assert(lens.hidden, 'released touch cannot reopen lens');
preview.emit('pointerdown',{pointerType:'touch',pointerId:3,clientX:150,clientY:200});
assert(!lens.hidden, 'next touch uses cached source');
preview.emit('pointercancel',{pointerType:'touch',pointerId:3});
assert(lens.hidden, 'cancel hides lens');
preview.emit('pointerdown',{pointerType:'touch',pointerId:4,clientX:350,clientY:200});
preview.emit('pointermove',{pointerType:'touch',pointerId:4,clientX:150,clientY:200});
assert(lens.hidden, 'gesture starting outside photo does not activate lens');
preview.emit('pointerdown',{pointerType:'touch',pointerId:5,clientX:150,clientY:200});
preview.emit('lostpointercapture',{pointerId:5});
assert(lens.hidden, 'lost capture hides lens');
api.resetMagnifier();
preview.emit('pointerdown',{pointerType:'touch',pointerId:6,clientX:150,clientY:200});
preview.emit('pointerup',{pointerType:'touch',pointerId:6});
nextImage.onload();
assert(lens.hidden, 'source arriving after release cannot reopen lens');
preview.emit('pointerenter',{pointerType:'mouse',clientX:150,clientY:200});
assert(!lens.hidden, 'mouse hover opens automatically');
preview.emit('pointermove',{pointerType:'mouse',clientX:350,clientY:200});
assert(lens.hidden, 'mouse outside actual image hides lens');
preview.emit('pointermove',{pointerType:'mouse',clientX:150,clientY:200});
assert(!lens.hidden, 'mouse returning to image opens lens');
preview.emit('pointerleave',{pointerType:'mouse'});
assert(lens.hidden, 'mouse leave hides lens');
api.resetMagnifier();
preview.emit('pointerenter',{pointerType:'mouse',clientX:150,clientY:200});
nextImage.onerror(); assert(node('.photo-detail__magnify-status').textContent === 'error', 'loading errors exposed');
const failed = nextImage;
preview.emit('pointerleave',{pointerType:'mouse'});
preview.emit('pointerenter',{pointerType:'mouse',clientX:150,clientY:200});
assert(nextImage !== failed, 'new hover retries a failed load');
const stale = nextImage; api.resetMagnifier(); stale.onload();
assert(lens.hidden, 'stale load cannot show previous photo');
assert(!code.includes('class="photo-detail__magnify"') && !code.includes('data-detail-copy="magnifierHint"'), 'button and description removed');
print('Detail checks passed: sizes, margins, orders, held-touch lifecycle, multitouch, mouse hover, retries and stale loads.');
