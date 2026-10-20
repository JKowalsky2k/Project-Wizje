/* jsc tools/test_globe.js — cache geometry while retaining projection and controls. */
const assert = (value, message) => { if (!value) throw new Error(message); };
let geometryWrites = 0;
class Element {
  constructor() { this.children = []; this.dataset = {}; this.handlers = {}; }
  setAttribute(k, v) { this[k] = v; if (k === 'd') geometryWrites++; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(k, fn) { this.handlers[k] = fn; }
  focus() {}
}
const svg = new Element(), list = new Element(), host = new Element(), handlers = {};
host.querySelector = key => key === 'svg' ? svg : key === '.photo-globe__places' ? list : new Element();
const document = {
  documentElement: { lang:'en', dataset:{} }, activeElement:null,
  querySelector: () => host, createElement: () => new Element(), createElementNS: () => new Element(),
  addEventListener: (k, fn) => handlers[k] = fn,
};
const window = { ZWIDY_COLLECTIONS:[{id:'test',year:'2026',photos:[{}],locations:[{lat:53.01,lon:18.6,name:'Toruń',nameEn:'Torun'}]}] };
eval(readFile('globe.js'));
assert(geometryWrites === 2, 'one initial grid and border calculation');
handlers.collectionyearchange({detail:'2026'});
document.documentElement.lang = 'pl'; handlers.languagechange();
assert(geometryWrites === 2, 'same year and language change reuse geometry');
assert(list.children[0].textContent === 'Toruń', 'labels still change language');
const markers = svg.children[3], marker = markers.children[0];
const coords = marker.transform.match(/translate\(([^,]+),([^\)]+)\)/).slice(1).map(Number);
const delta = (18.6 - 15) * Math.PI / 180, phi = 53.01 * Math.PI / 180, tilt = 16 * Math.PI / 180;
assert(Math.abs(coords[0] - (450 + 460 * Math.cos(phi) * Math.sin(delta))) < 1e-8, 'cached vectors preserve longitude projection');
assert(Math.abs(coords[1] - (430 - 460 * (Math.cos(tilt) * Math.sin(phi) - Math.sin(tilt) * Math.cos(phi) * Math.cos(delta)))) < 1e-8, 'cached vectors preserve latitude projection');
list.children[0].handlers.click();
assert(geometryWrites === 4, 'selecting a place recalculates the view');
assert(markers.children[0]['aria-pressed'] === 'true', 'selected marker remains accessible');
print('Globe checks passed: projection, translated labels, selection and geometry reuse.');
