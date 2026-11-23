// Synthetic, opt-in microbenchmarks. No browser, workspace or network access.
import {performance} from 'node:perf_hooks';
import {EditorState} from '@codemirror/state';
import {emptyWorld,addStructure,sameOrigin} from '../src/core/model.ts';
import {branch} from '../src/core/nodeOperations.ts';
import {inherited,createInheritanceReader,prepareTranslation,lattice,address,point,vector} from '../src/core/lattice.ts';
import {createOccupancy} from '../src/graph/occupancy.ts';
import {connectorPaint,connectorPaintReader} from '../src/core/appearance.ts';
import {glyphField,glyphIndexAt} from '../src/text/source.ts';
import {lexiconTextWindow} from '../src/text/lexicon.ts';
import {lexiconWindow} from '../src/text/model.ts';
// Retired algorithms retained only here to make the comparison reproducible.
function scanBranch(world,roots){const values=[...roots];let added=true;while(added){added=false;for(const node of world.nodes)if(node.parent&&values.some(origin=>sameOrigin(origin,node.parent))&&!values.some(origin=>sameOrigin(origin,node.origin))){values.push(node.origin);added=true;}}return values;}
function scanTranslation(world,origins){const index=lattice(world),moving=new Set(origins.map(address)),carried=new Set();let changed=true;while(changed){const count=moving.size;for(const node of world.nodes)if(moving.has(address(node.origin))&&node.collapsed)carried.add(address(node.origin));for(const node of world.nodes)if(node.parent&&(carried.has(address(node.parent))||node.hidden&&moving.has(address(node.parent)))){carried.add(address(node.origin));moving.add(address(node.origin));}changed=count!==moving.size;}const occupied=createOccupancy(world.nodes.filter(node=>!moving.has(address(node.origin))).map(node=>[address(node.origin),point(node.position)]));return delta=>{const result=new Map();for(const id of moving){const from=index.cells.get(id);if(!from)continue;const to={x:from.x+delta[0],y:from.y+delta[1],z:from.z+delta[2]};if(!occupied.free(to)||!Object.values(to).every(n=>Number.isFinite(n)&&Math.abs(n)<=1e7))return;result.set(id,vector(to));}return result;};}
function compare(name,before,after){const median=run=>{const samples=[];run();for(let i=0;i<3;i++){const start=performance.now();run();samples.push(performance.now()-start);}return +samples.sort((a,b)=>a-b)[1].toFixed(2);};return {name,before_ms:median(before),after_ms:median(after)};}
const world=emptyWorld();let parent;for(let i=0;i<700;i++){const node=addStructure(world,[i*2,0,0],i+1);node.parent=parent?.origin;node.collapsed=true;parent=node;}const root=world.nodes[0];world.nodes.reverse();
const results=[compare('700-node reverse-ordered branch',()=>scanBranch(world,[root.origin]),()=>branch(world,[root.origin])),compare('700-node reverse-ordered carry preparation',()=>scanTranslation(world,[root.origin]),()=>prepareTranslation(world,[root.origin]))];
function selection(legacy){let state=EditorState.create({doc:'x'.repeat(8000),extensions:[glyphField.init(()=>Array.from({length:4000},(_,i)=>({at:i*2,part:{glyph:'g'}})))]});for(let i=0;i<5000;i++){if(legacy)[...state.field(glyphField)].sort((a,b)=>a.at-b.at);state=state.update({selection:{anchor:i%8000}}).state;}}
results.push(compare('5000 cursor changes with 4000 glyphs',()=>selection(true),()=>selection(false)));
const paints=emptyWorld();for(let i=0;i<1500;i++)addStructure(paints,[i*2,0,0],i+1);const source=paints.nodes[0];source.variantOf=paints.nodes.at(-1).origin;source.overrides=[];
results.push(compare('1000 connectors sharing a variant source',()=>{for(let i=0;i<1000;i++)connectorPaint(paints,source);},()=>{const read=connectorPaintReader(paints);for(let i=0;i<1000;i++)read(source);}));
const markers=Array.from({length:4000},(_,i)=>({at:i*2}));
results.push(compare('3000 viewport queries near the end of 4000 glyphs',()=>{for(let i=0;i<3000;i++)markers.filter(g=>g.at>=7800&&g.at<7820);},()=>{for(let i=0;i<3000;i++)markers.slice(glyphIndexAt(markers,7800),glyphIndexAt(markers,7820));}));
const text='one two three four five\n'.repeat(8000),doc=EditorState.create({doc:text}).doc;
results.push(compare('1000 annotation windows in a 192k-character document',()=>{for(let i=0;i<1000;i++)lexiconWindow(doc.toString(),100000+i);},()=>{for(let i=0;i<1000;i++)lexiconTextWindow(doc,100000+i);}));
for(const node of paints.nodes.slice(0,500)){node.variantOf=paints.nodes.at(-1).origin;node.overrides=[];}
results.push(compare('resolve 500 variants of a shared late-positioned base',()=>{for(const node of paints.nodes.slice(0,500))inherited(node,paints);},()=>{const read=createInheritanceReader(paints);for(const node of paints.nodes.slice(0,500))read(node);}));
console.log(JSON.stringify({node:process.version,note:'Medians of 3 warmed synthetic runs; not application frame times. Carry fixture has no active axis constraint. Glyph baseline emulates the retired copy/sort on the current transaction pipeline.',results},null,2));
