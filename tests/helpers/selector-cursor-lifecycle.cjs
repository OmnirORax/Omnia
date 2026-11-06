// React DOM lifecycle reproduction, without a browser or a DOM dependency.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
class Element extends EventTarget {
 constructor(tag,doc){super();this.nodeType=1;this.tagName=this.nodeName=tag.toUpperCase();this.localName=tag;this.namespaceURI='http://www.w3.org/1999/xhtml';this.ownerDocument=doc;this.childNodes=[];this.style={};this.attributes=new Map();}
 appendChild(node){this.childNodes.push(node);node.parentNode=this;node.parentElement=this;return node;}
 removeChild(node){this.childNodes.splice(this.childNodes.indexOf(node),1);node.parentNode=node.parentElement=null;}
 setAttribute(key,value){this.attributes.set(key,String(value));}removeAttribute(key){this.attributes.delete(key);}
 getAttribute(key){return this.attributes.get(key)??null;}get firstChild(){return this.childNodes[0]??null;}
 getRootNode(){return this.ownerDocument;}
 matches(selector){return selector.split(',').some(part=>{part=part.trim();if(!part.startsWith('['))return part===this.localName;const match=part.match(/^\[([^=\]]+)(?:="([^"]*)")?\]/);return !!match&&this.attributes.has(match[1])&&(match[2]===undefined||this.attributes.get(match[1])===match[2])&&(!part.includes(':not')||this.attributes.get(match[1])!=='false');});}
 closest(selector){for(let node=this;node;node=node.parentElement)if(node.matches(selector))return node;return null;}
}
const doc=new EventTarget();doc.nodeType=9;doc.createElement=tag=>new Element(tag,doc);doc.createElementNS=(_,tag)=>doc.createElement(tag);doc.documentElement=doc.createElement('html');doc.body=doc.createElement('body');doc.activeElement=doc.body;
const win={document:doc,HTMLIFrameElement:class{},HTMLElement:Element,event:undefined};doc.defaultView=win;global.window=win;global.document=doc;global.HTMLElement=global.Element=Element;
const React=require('react'),{createRoot}=require('react-dom/client'),{flushSync}=require('react-dom'),ts=require('typescript');
const base=path.resolve(__dirname,'../..'),cache=new Map();let enabled=true;const requests=new Map(),selection={cursorConfiguration:{pattern:'item',contour:false,region:null}};
function useCursor(request){const owner=React.useId();React.useLayoutEffect(()=>{requests.set(owner,request);return()=>requests.delete(owner);},[owner,request]);}
const mocks={
 'ui/ActiveContext':{useCancelValueEdit:()=>{}},
 'ui/NumericEditorScope':{useNumericEditor:()=>({selectionCursor:enabled})},
 'appearance/VisualSelector':{useVisualSelection:()=>selection},
 'appearance/SelectorSymbol':{SelectorSymbol:()=>null,SELECTOR_VIEW:{x:32,y:30,width:64,height:60}},
 'ui/toolCursor':{useToolCursor:useCursor},
 'appearance/selectionSurfaces':{selectionSurfaces:{sessionOwns:()=>false}},
};
function load(relative){
 const key=relative.replace(/\.(tsx?|js)$/,'');if(mocks[key])return mocks[key];if(cache.has(key))return cache.get(key);
 const file=path.join(base,'src',key+(fs.existsSync(path.join(base,'src',key+'.tsx'))?'.tsx':'.ts'));
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};cache.set(key,module.exports);
 const resolve=id=>id.startsWith('.')?load(path.posix.normalize(path.posix.join(path.posix.dirname(key),id))):require(id);
 new Function('require','module','exports',code)(resolve,module,module.exports);cache.set(key,module.exports);return module.exports;
}
const zones=load('ui/toolCursorZone'),model=load('ui/toolCursorModel');
const {useSelectionPreviewCursor}=load('appearance/SelectionPreviewCursor');
const mountOrder=[];let field;
function OldChild({surface}){React.useLayoutEffect(()=>{mountOrder.push(['child',!!surface.current]);},[surface]);return null;}
function Reproduce(){const ref=React.useRef(null);React.useLayoutEffect(()=>{mountOrder.push(['owner',!!ref.current]);},[]);return React.createElement('div',{ref},React.createElement(OldChild,{surface:ref}));}
const host=doc.createElement('main'),root=createRoot(host);flushSync(()=>root.render(React.createElement(Reproduce)));
assert.deepEqual(mountOrder,[['child',false],['owner',true]],'reproduce why the previous child registration never ran against a mounted field');
function Field(){const ref=React.useRef(null),cursor=useSelectionPreviewCursor(ref);React.useLayoutEffect(()=>{field=ref.current;});return React.createElement('div',{ref,'data-ui-popup-interior':''},cursor);}
const popup=doc.createElement('section');popup.setAttribute('data-context-controller','');popup.appendChild(host);
flushSync(()=>root.render(React.createElement(Field)));
function activeAt(target){const point={x:10,y:20,target},scope=zones.pointerToolZone(point);return model.activeToolCursor(requests.values(),request=>model.cursorApplies(request,scope.zone,scope.blocked)&&request.contains(point));}
const svg=doc.createElement('svg');field.appendChild(svg);
assert.equal(zones.pointerToolZone({x:10,y:20,target:svg}).blocked,false,'the field zone registers during the real owner mount');
assert.equal(activeAt(svg)?.key,'visual-selector','the configured MS cursor activates within the popup even when its canvas session does not own the target');
const button=doc.createElement('button');popup.appendChild(button);assert.equal(activeAt(button),null,'neighboring settings retain native pointing');
const customControl=doc.createElement('div');customControl.setAttribute('data-ui-control','');const customIcon=doc.createElement('svg');customControl.appendChild(customIcon);field.appendChild(customControl);assert.equal(activeAt(customIcon),null,'a newly declared nested control inherits native pointing without a widget-specific exception');
const previous=field;enabled=false;flushSync(()=>root.render(React.createElement(Field)));assert.equal(activeAt(previous),null,'disabling the scope removes cursor applicability');
enabled=true;flushSync(()=>root.render(React.createElement(Field)));assert.equal(activeAt(field)?.key,'visual-selector','re-enabling registers the existing field');
const old=field;flushSync(()=>root.render(React.createElement(Field,{key:'remount'})));assert.equal(activeAt(old),null);assert.equal(activeAt(field)?.key,'visual-selector','replacement fields register on their own mount');
flushSync(()=>root.unmount());assert.equal(activeAt(field),null,'unmount releases the zone and request');
const css=fs.readFileSync(path.join(base,'src/workbench.css'),'utf8');assert.ok(!css.includes('html[data-visual-selecting]'),'aiming alone cannot globally hide the fallback native cursor');
console.log('React mount ordering, actual popup cursor activation, adjacent-control fallback, disable, remount and teardown passed.');

// The real shared color input opens only after ancestor popup layout, using the
// current owner value, with change/blur listeners installed before opening.
let popupReady=false;const pickerOpens=[],commits=[];
Element.prototype.showPicker=function(){assert.equal(popupReady,true,'the ancestor popup must already be visible');pickerOpens.push(this.value);};
const {ColorInput}=load('ui/ColorInput'),colorHost=doc.createElement('div'),colorRoot=createRoot(colorHost);
function ColorPanel(){React.useLayoutEffect(()=>{popupReady=true;return()=>{popupReady=false;};},[]);return React.createElement(ColorInput,{autoOpen:true,value:'#123456',onChange:value=>commits.push(value)});}
global.cancelAnimationFrame=()=>{};
flushSync(()=>colorRoot.render(React.createElement(ColorPanel)));
assert.deepEqual(pickerOpens,['#123456'],'choosing Color opens its existing picker immediately with the current color');
const input=colorHost.firstChild;flushSync(()=>{input.value='#aabbcc';input.dispatchEvent(new Event('change'));});
input.dispatchEvent(new Event('blur'));assert.deepEqual(commits,['#aabbcc'],'change commits once and blur does not duplicate it');
flushSync(()=>colorRoot.render(React.createElement(ColorPanel)));assert.equal(pickerOpens.length,1,'preview/value rerenders cannot reopen the native picker');
flushSync(()=>colorRoot.unmount());
console.log('Current-color auto-open follows popup layout and retains single native commit.');
