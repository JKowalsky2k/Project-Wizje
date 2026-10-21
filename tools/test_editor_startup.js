/* jsc tools/test_editor_startup.js — actual editor flows against a small DOM/API fixture. */
const nodes = new Map(), allNodes = new Set();
const assert = (value,message) => { if (!value) throw new Error(message); };
class ElementFixture {
  constructor(tag='') {
    this.tag = tag; this.tagName = tag.toUpperCase(); this.handlers = {}; this.children = []; this.dataset = {};
    this.style = {setProperty(k,v) {this[k]=v;}}; this.value = ''; this.textContent = ''; this.className = ''; this.open = false;
    this.classList = {add:(...values) => {this.className += ' '+values.join(' ');},remove:value => {this.className=this.className.split(' ').filter(x=>x!==value).join(' ');},toggle() {}};
    allNodes.add(this);
  }
  get isConnected() { return this.static || Boolean(this.parent?.isConnected); }
  append(...nodes) { for (const node of nodes) { node.remove(); node.parent=this; this.children.push(node); } }
  replaceChildren(...nodes) { for (const node of this.children) node.parent=null; this.children=[]; this.append(...nodes); }
  addEventListener(type,fn) { this.handlers[type]=fn; }
  setAttribute(name,value) { if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g,(_,x)=>x.toUpperCase())]=String(value); else this[name]=String(value); }
  getAttribute(name) { return name.startsWith('data-') ? this.dataset[name.slice(5).replace(/-([a-z])/g,(_,x)=>x.toUpperCase())] ?? null : this[name] ?? null; }
  removeAttribute(name) { delete this[name]; }
  matches(selector) {
    const checked=selector.endsWith(':checked'); selector=selector.replace(/:checked$/,'');
    if (checked && !this.checked) return false;
    const tag=selector.match(/^[a-z]+/i)?.[0]; if (tag && tag!==this.tag) return false;
    const cls=selector.match(/\.([\w-]+)/)?.[1]; if (cls && !this.className.split(' ').includes(cls)) return false;
    const id=selector.match(/#([\w-]+)/)?.[1]; if (id && this.id!==id) return false;
    for (const [,name,value] of selector.matchAll(/\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g)) {
      const found=this.getAttribute(name); if (found==null || (value!==undefined && found!==value)) return false;
    }
    return true;
  }
  querySelectorAll(selector) { return this.children.flatMap(child=>[...(selector.split(',').some(value=>child.matches(value.trim()))?[child]:[]),...child.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  remove() { if (this.parent) this.parent.children=this.parent.children.filter(node=>node!==this); this.parent=null; }
  replaceWith(node) { const parent=this.parent,index=parent.children.indexOf(this); node.remove(); parent.children[index]=node; node.parent=parent; this.parent=null; }
  before(node) { node.static=true; nodes.set('#'+node.id,node); }
  reset() { this.handlers.reset?.(); }
  focus() { document.activeElement=this; }
  showModal() { this.open=true; }
  close() { this.open=false; this.handlers.close?.(); }
}
for (const match of readFile('tools/admin/index.html').matchAll(/<([a-z][a-z0-9]*)\b([^>]*\bid="([^"]+)"[^>]*)>/gi)) {
  const node=new ElementFixture(match[1]); node.static=true;
  for (const [,name,value] of match[2].matchAll(/([\w-]+)="([^"]*)"/g)) node.setAttribute(name,value);
  node.checked=/\bchecked\b/.test(match[2]); node.hidden=/\bhidden\b/.test(match[2]); nodes.set('#'+match[3],node);
}
function get(selector) { const found=nodes.get(selector) || [...allNodes].find(node=>node.isConnected && node.matches(selector)); if (!found) throw new Error('Unknown node: '+selector); return found; }
var window={location:{assign() {}},confirm() {throw new Error('Photo deletion must not request confirmation');}};
var document={body:new ElementFixture('body'),documentElement:new ElementFixture('html'),activeElement:null,
 querySelector:get, querySelectorAll:selector=>[...allNodes].filter(node=>node.isConnected && selector.split(',').some(value=>node.matches(value.trim()))),
 createElement:tag=>new ElementFixture(tag),createElementNS:(ns,tag)=>new ElementFixture(tag)};
var location={protocol:'http:',hostname:'127.0.0.1'};
var localStorage={getItem() {return 'en';},setItem() {}};
var queueMicrotask=fn=>Promise.resolve().then(fn);
// Static radio controls have names but no IDs.
for (const [name,value,checked] of [['upload-medium','digital',true],['upload-medium','analog',false],['upload-orientation','portrait',true],['upload-orientation','landscape',false]]) {
 const node=new ElementFixture('input'); node.static=true; node.type='radio'; node.name=name; node.value=value; node.checked=checked;
}
get('#upload-color-mode').value='color'; get('#preview-color').value='black';
const clone=value=>JSON.parse(JSON.stringify(value));
let server={csrf:'test',films:[],isoValues:[100,200],library:[],posters:[{name:'30 × 40 cm',priceCents:1000}],publication:{dirty:true,changes:{added:2,removed:0,changed:0,collections:1,prices:false}},collections:[
 {id:'trip',year:'2026',title:'Trip',customTitle:true,locations:[],photos:[
  {name:'photo.jpg',preview:'/assets/collections/previews/abcdefabcdef-480.jpg',detail:'/assets/collections/previews/abcdefabcdef-2000.jpg',medium:'digital',orientation:'portrait',colorMode:'color',detailWidth:1400,detailHeight:2000},
  {name:'second.jpg',preview:'/assets/collections/previews/defabcdefabc-480.jpg',medium:'analog',orientation:'portrait',colorMode:'color',posterSizes:[]},
 ]},
]};
let fetched=0,lastUndo=null,allowBad=false,failColor=false;
const calls=[],uploadCalls=[];
var fetch=async (url,options={})=>{
 const data=options.body ? JSON.parse(options.body) : null; calls.push({url,data});
 if (url==='/admin/api/state') {fetched++; return {status:200,ok:true,json:async()=>clone(server)};}
 let result={ok:true}, status=200;
 const photos=server.collections[0].photos;
 if (url==='/admin/api/color-mode') {
  if (failColor) {failColor=false; return {status:500,ok:false,json:async()=>({error:'Save failed'})};}
  lastUndo=clone(server); const photo=photos.find(value=>value.name===data.name); photo.colorMode=data.colorMode; result.photo=photo; result.undo='undo-token';
 } else if (url==='/admin/api/bulk-photos') {
  lastUndo=clone(server); for (const photo of photos) if (data.names.includes(photo.name)) Object.assign(photo,data.changes); result.count=data.names.length; result.undo='undo-token';
 } else if (url==='/admin/api/delete-photo') {
  lastUndo=clone(server); const index=photos.findIndex(value=>value.name===data.name); const photo=photos.splice(index,1)[0]; server.library.push({...photo,id:'detached'}); result.undo='undo-token';
 } else if (url==='/admin/api/photo-sizes') {
  lastUndo=clone(server); const photo=photos.find(photo=>photo.name===data.name); photo.posterSizes=data.posterSizes; result.photo=photo; result.undo='undo-token';
 } else if (url==='/admin/api/remove-print-crop') {
  lastUndo=clone(server); delete photos.find(photo=>photo.name===data.name).printCrops[data.size]; result.undo='undo-token';
 } else if (url==='/admin/api/undo') {server=lastUndo; lastUndo=null;}
 else if (url==='/admin/api/purge-photo') {assert(data.confirmed===true,'permanent delete supplies authorization automatically'); server.collections[0].photos=photos.filter(photo=>photo.name!==data.name);server.library=[];}
 else throw new Error('Unexpected request '+url);
 result.publication=server.publication; return {status,ok:status===200,json:async()=>clone(result)};
};
var URLSearchParams=class {
 constructor(value={}) {this.values=new Map(typeof value==='string' ? value.split('&').filter(Boolean).map(part=>part.split('=').map(decodeURIComponent)) : Object.entries(value));}
 set(key,value) {this.values.set(key,String(value));}
 get(key) {return this.values.get(key);}
 toString() {return [...this.values].map(([key,value])=>encodeURIComponent(key)+'='+encodeURIComponent(value)).join('&');}
};
var TextEncoder=class {encode(text) {return Uint8Array.from(Array.from(text,char=>char.charCodeAt(0)));}};
var Blob=class {constructor(parts) {this.parts=parts;this.size=parts.reduce((sum,part)=>sum+(part.size??part.byteLength??0),0);}};
var XMLHttpRequest=class {
 constructor() {this.upload={};}
 open(method,url) {this.url=url;}
 setRequestHeader() {}
 send(body) {Promise.resolve().then(()=>{
  this.upload.onprogress?.({loaded:body.size,total:body.size,lengthComputable:true}); this.upload.onload?.();
  if (this.url.includes('print-crop?')) {
   const params=new URLSearchParams(this.url.split('?')[1]); lastUndo=clone(server);
   const photo=server.collections[0].photos.find(photo=>photo.name===params.get('name'));
   (photo.printCrops ||= {})[params.get('size')]={detail:'assets/collections/previews/custom-2000.jpg',inspection:'assets/collections/previews/custom-inspect.jpg',detailWidth:1500,detailHeight:2000};
   this.status=200; this.responseText=JSON.stringify({ok:true,undo:'undo-token',publication:server.publication}); this.onload(); return;
  }
  const batch=this.url.includes('upload-batch');
  const names=batch ? JSON.parse(String.fromCharCode(...body.parts[1])).map(value=>value.name) : [new URLSearchParams(this.url.split('?')[1]).get('name')];
  uploadCalls.push({batch,names}); const bad=names.includes('bad.jpg')&&!allowBad;
  this.status=bad?400:200; this.responseText=JSON.stringify(bad?{error:'Invalid photograph'}:{ok:true,count:names.length,publication:server.publication});
  if (!bad) for (const name of names) server.collections[0].photos.push({name,preview:'/assets/collections/previews/abcdefabcdef-480.jpg',medium:'digital',colorMode:'color',orientation:'portrait'});
  this.onload();
 });}
};
const click=node=>node.handlers.click?.({target:node,preventDefault() {}});
const change=node=>node.handlers.change?.({target:node,preventDefault() {}});
const submit=node=>node.handlers.submit?.({target:node,preventDefault() {}});
const tick=async()=>{for (let i=0;i<15;i++) await Promise.resolve();};
eval(readFile('tools/admin/editor.js'));
(async()=>{
 await tick();
 assert(fetched===1 && get('#status').textContent.startsWith('Ready.'),'editor starts: '+get('#status').textContent);
 let cards=get('#photo-grid').children;
 assert(cards.length===2 && cards[0].querySelectorAll('select').length===0,'cards are compact and have no inline forms');
 const original=cards[0],untouched=cards[1];
 await click(original.querySelector('.edit-photo'));
 assert(get('#photo-dialog').open && get('#admin-preview-image').src.endsWith('-2000.jpg'),'large preview opens');
 const color=get('#photo-editor-fields').querySelectorAll('select').find(node=>node['aria-label']==='Color: photo.jpg');
 color.value='monochrome'; await change(color);
 assert(fetched===1 && get('#photo-grid').children[0]!==original && get('#photo-grid').children[1]===untouched,'metadata updates only the changed card');
 assert(get('#photo-editor-fields').querySelectorAll('.field-status').some(node=>node.dataset.state==='saved'),'field save feedback is shown');
 await click(get('#undo-editor-change'));
 assert(get('#photo-dialog').open && server.collections[0].photos[0].colorMode==='color','metadata can be undone without closing the preview');
 const failingColor=get('#photo-editor-fields').querySelectorAll('select').find(node=>node['aria-label']==='Color: photo.jpg');
 failingColor.value='monochrome'; failColor=true; await change(failingColor);
 const failedField=get('#photo-editor-fields').querySelectorAll('.field-status').find(node=>node.dataset.field==='color-mode');
 assert(failedField.dataset.state==='error' && failedField.querySelector('button'),'failed fields expose a local retry');
 await click(failedField.querySelector('button'));
 assert(server.collections[0].photos[0].colorMode==='monochrome','field retry applies the requested value');

 const cropInput=get('#photo-editor-fields').querySelectorAll('input').find(node=>node.dataset.cropSize==='30 × 40 cm');
 assert(cropInput,'each print size accepts a photographer-supplied crop');
 cropInput.files=[{name:'custom.jpg',size:20}]; await change(cropInput);
 assert(get('#admin-preview-image').src==='/assets/collections/previews/custom-2000.jpg','upload switches the selected print preview to the custom crop');
 assert(!get('#undo-editor-change').hidden,'crop upload supports undo');
 await click(get('#photo-editor-fields').querySelectorAll('button').find(node=>node.dataset.removeCropSize==='30 × 40 cm'));
 assert(get('#admin-preview-image').src.endsWith('abcdefabcdef-2000.jpg'),'removing the assignment restores the main photograph');
 await click(get('#undo-editor-change'));
 assert(get('#admin-preview-image').src.endsWith('custom-2000.jpg'),'undo restores the custom crop and its preview');
 await click(get('#photo-editor-fields').querySelectorAll('button').find(node=>node.dataset.removeCropSize==='30 × 40 cm'));

 let sizeFields=get('#photo-editor-fields').querySelector('.photo-sizes');
 let sizeChecks=sizeFields.querySelectorAll('input');
 sizeChecks[0].checked=false; await change(sizeChecks[0]);
 sizeChecks[1].checked=false; await change(sizeChecks[1]);
 let blockedCrop=get('#photo-editor-fields').querySelectorAll('input').find(node=>node.dataset.cropSize==='30 × 40 cm');
 assert(blockedCrop.disabled,'unchecking a size immediately blocks its crop upload');
 await click(sizeFields.querySelector('button'));
 blockedCrop=get('#photo-editor-fields').querySelectorAll('input').find(node=>node.dataset.cropSize==='30 × 40 cm');
 assert(blockedCrop.disabled,'saving disabled sizes keeps the crop upload disabled after the busy state clears');
 sizeFields=get('#photo-editor-fields').querySelector('.photo-sizes'); sizeChecks=sizeFields.querySelectorAll('input');
 sizeChecks[1].checked=true; await change(sizeChecks[1]);
 assert(blockedCrop.disabled,'unsaved size selection does not enable the upload yet');
 await click(sizeFields.querySelector('button'));
 assert(!get('#photo-editor-fields').querySelectorAll('input').find(node=>node.dataset.cropSize==='30 × 40 cm').disabled,'saving an enabled size unlocks crop upload');

 get('#preview-frame').checked=false; await change(get('#preview-frame'));
 assert(get('#admin-artwork').dataset.frame==='false','preview frame toggle works');
 await click(get('#next-editor-photo'));
 assert(get('#photo-editor-title').textContent.startsWith('second.jpg'),'preview navigates to the next photo');
 await click(get('#close-photo-editor'));
 get('#photo-filter-missing').checked=true; await change(get('#photo-filter-missing'));
 assert(get('#photo-grid').children.length===1 && get('#photo-grid').children[0].dataset.sortKey==='second.jpg','missing-data filter finds analog photos without film/ISO');
 await click(get('#reset-photo-filters'));
 get('#photo-search').value='ABCDEFABCD'; get('#photo-search').handlers.input();
 assert(get('#photo-grid').children.length===1,'search matches the photo reference');
 get('#select-visible').checked=true; await change(get('#select-visible'));
 get('#bulk-orientation').value='landscape'; await submit(get('#bulk-form'));
 const bulk=calls.find(call=>call.url.endsWith('/bulk-photos'));
 assert(bulk.data.names.join(',')==='photo.jpg' && bulk.data.changes.orientation==='landscape','bulk edits apply to the selected filtered photos');
 await click(get('#reset-photo-filters'));
 cards=get('#photo-grid').children;
 await click(cards[0].querySelectorAll('button').find(node=>node.title==='Remove from collection'));
 assert(server.collections[0].photos.length===1 && !get('#undo-change').hidden,'detach requires no confirmation and exposes undo');
 await click(get('#undo-change'));
 assert(server.collections[0].photos.length===2 && server.library.length===0,'undo restores the detached photograph');
 await click(get('#photo-grid').children[0].querySelectorAll('button').find(node=>node.title==='Delete permanently'));
 assert(server.collections[0].photos.length===1 && get('#undo-change').hidden,'permanent deletion has no confirmation prompt');
 get('#photos').files=[{name:'good.jpg',size:10},{name:'bad.jpg',size:10}]; await submit(get('#upload-form'));
 assert(get('#upload-progress').children.map(row=>row.dataset.state).join(',')==='done,error','import identifies the failing file and retains successful files: '+get('#status').textContent+' '+JSON.stringify(uploadCalls)+' '+get('#upload-progress').children.map(row=>row.dataset.state).join(','));
 allowBad=true; await click(get('#retry-uploads'));
 assert(uploadCalls[uploadCalls.length-1].names.join(',')==='bad.jpg','retry sends only failed files');
 assert(get('#retry-uploads').hidden && get('#upload-progress').children.every(row=>row.dataset.state==='done'),'retry completes the remaining import');
 assert(get('#publication-state').dataset.dirty==='true','unexported changes are visible');
 print('Editor flows passed: compact cards, preview, save feedback, navigation, filters, selection, bulk edits, immediate deletion, undo, upload failure isolation and retry.');
})().catch(error=>{print(String(error));print(error.stack);quit(1);});
