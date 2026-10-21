/* jsc tools/test_gallery.js — exercise lazy carousel images and recycling. */
const assert = (value, message) => { if (!value) throw new Error(message); };
class Element {
  constructor() {
    this.children = []; this.nodes = new Map(); this.dataset = {};
    this.style = { setProperty(k, v) { this[k] = v; } };
    this.complete = true; this.naturalWidth = 480;
  }
  append(node) { this.children.push(node); }
  replaceChildren() { this.children = []; }
  setAttribute(k, v) { this[k] = v; }
  removeAttribute(k) { delete this[k]; }
  addEventListener() {}
  querySelector(key) { if (!this.nodes.has(key)) this.nodes.set(key, new Element()); return this.nodes.get(key); }
  async decode() {}
}
const document = { documentElement: { lang: 'en' }, hidden: false, createElement: () => new Element(), querySelector: () => new Element(), addEventListener() {} };
const motion = { matches: true, addEventListener() {} };
const window = { matchMedia: () => motion, IntersectionObserver() {}, addEventListener() {} };
const navigator = {};
const translations = { en: {} };
const setTimeout = () => 1, clearTimeout = () => {};
let constructedImages = 0;
class Image extends Element {
  constructor() { super(); constructedImages++; }
  set src(value) { this.url = value; this.onload?.(); }
  get src() { return this.url; }
}
let api;
const code = readFile('collections.js');
eval(code.slice(0, code.indexOf('  const source = (window.ZWIDY_COLLECTIONS')) + `
  const source = [];
  api = { Collection, loadPhoto, configureGalleryImage, pose };
})();`);
const photos = Array.from({length: 8}, (_, i) => ({src:`${i}.jpg`, detail:`${i}-detail.jpg`, previewMedium:`${i}-960.jpg`, previewHigh:`${i}-1440.jpg`}));
const gallery = new api.Collection({id:'test',title:'Test',photos}, 0);
assert(gallery.cards.every(card => !card.image.src), 'offscreen collections do not assign image sources');
gallery.visible = true;
gallery.initialize().then(async () => {
  assert(gallery.cards.filter(card => card.image.src).length === 3, 'initialize only the three visible cards');
  assert(gallery.cards.find(card => card.slot === 0).image.fetchPriority === 'high', 'central photo has priority');
  assert(constructedImages === 2, 'only two neighboring previews are prefetched; large details wait for intent');
  for (const direction of [1, 1, -1, -1, -1]) {
    await gallery.advance(direction);
    for (const card of gallery.cards.filter(card => Math.abs(card.slot) <= 1)) {
      assert(card.image.src === card.photo.src, 'a card entering view has its current image');
    }
  }
  const photo = {src:'decode-check.jpg'};
  await api.loadPhoto(photo);
  const target = new Element();
  let sourceAssignments = 0, releaseDecode;
  Object.defineProperty(target, 'src', {set(value) { sourceAssignments++; }, get() { return photo.src; }});
  target.decode = () => new Promise(resolve => { releaseDecode = resolve; });
  let ready = false;
  const pending = api.loadPhoto(photo, target).then(() => { ready = true; });
  await Promise.resolve(); await Promise.resolve();
  assert(!ready && releaseDecode, 'cached prefetch must still await the moving DOM image decode');
  api.configureGalleryImage(target, photo);
  assert(sourceAssignments === 1, 'a decoded or loading image source is not reassigned during a turn');
  releaseDecode(); await pending;

  motion.matches = false;
  const arriving = gallery.cards.find(card => card.slot === 1);
  const oldOffset = gallery.offset;
  let releaseArrival, decodeCalls = 0, animations = 0;
  const decodeGate = new Promise(resolve => { releaseArrival = resolve; });
  arriving.image.decode = () => { decodeCalls++; return decodeGate; };
  gallery.cards.forEach(card => {
    card.element.animate = function(frames, options) {
      animations++;
      assert(options.fill === 'both', 'retain the compositor effect before and after playback');
      assert(frames[1].transform === this.style.transform, 'last animation frame exactly matches the resting style');
      assert(frames.every(frame => frame.transform.includes('translateZ(')), 'both endpoints retain the 3D transform');
      return {finished:Promise.resolve(),cancel() {}};
    };
  });
  const turn = gallery.advance(1);
  for (let i = 0; i < 10; i++) await Promise.resolve();
  assert(decodeCalls > 0 && animations === 0 && gallery.offset === oldOffset, 'movement waits for the arriving element to finish decoding');
  releaseArrival(); await turn;
  assert(animations === 5, 'all cards animate together after the decoded image is ready');
  assert(gallery.cards.find(card => card.slot === 0).element.style.transform === api.pose(0,8).transform, 'center keeps its exact 3D resting pose');
  for (const direction of [-1, 1, 1, -1]) {
    await gallery.advance(direction);
    assert(gallery.cards.every(card => card.animations.length <= 1), 'consecutive turns do not accumulate animation effects');
    assert(gallery.cards.filter(card => Math.abs(card.slot) <= 1).every(card => card.animations.length === 1), 'visible cards retain their compositor effect at rest');
    assert(gallery.cards.find(card => card.slot === direction * 2).animations.length === 0, 'recycled hidden card releases the old effect before repositioning');
  }
  motion.matches = true;
  await gallery.advance(-1);
  assert(gallery.cards.every(card => card.animations.length === 0), 'reduced motion clears retained effects and uses static positions');
  print('Gallery checks passed: lazy loading, recycling, actual element decoding, stable sources and matching 3D animation endpoints.');
}).catch(error => { print(error.stack); quit(1); });
