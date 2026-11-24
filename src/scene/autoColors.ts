import type {PaletteSettings} from '../properties/textPalette.ts';
import {locate,type World,type Origin} from '../core/model.ts';
import {createInheritanceReader} from '../core/lattice.ts';
import {readPaint,writePaint} from '../core/appearance.ts';
import {DEFAULT_BACKGROUND} from './defaultBackground.ts';
import {imageColorCombo,type ImageColorCombo} from './colorCombo.ts';
export type AutoColorChannel='text'|'textGlow'|'node'|'nodeGlow';
export type AutoColorRule={enabled:boolean;inherit?:boolean;manual:AutoColorChannel[];mode?:'text';palette?:PaletteSettings};
export const autoColorKey=(origin?:Origin)=>origin?JSON.stringify(origin):'default';
export function configureAutoColors(world:World,origin:Origin|undefined,enabled:boolean,reset=false,settings?:PaletteSettings){const key=autoColorKey(origin);world.appearance??={};world.appearance.imageColors={...world.appearance.imageColors,[key]:{enabled,mode:'text',palette:{...world.appearance.imageColors?.[key]?.palette,...settings},manual:reset?[]:world.appearance.imageColors?.[key]?.manual??[]}};}
function autoImageReader(world:World){let nodes:Map<string,World['nodes'][number]>|undefined;let inherit:ReturnType<typeof createInheritanceReader>|undefined;return(key:string)=>{if(key==='default')return world.scene?world.scene.image:DEFAULT_BACKGROUND.id;nodes??=new Map(world.nodes.map(node=>[JSON.stringify(node.origin),node]));const node=nodes.get(key);if(!node)return null;const actual=(inherit??=createInheritanceReader(world))(node);return actual.scene!==undefined?actual.scene:world.scene?world.scene.image:DEFAULT_BACKGROUND.id;};}
export const autoColorImage=(world:World,key:string)=>autoImageReader(world)(key);

/** One serial analysis queue, cached by source image; results are checked again before applying. */
export function createAutoColors(host:{read:()=>World;change:(edit:(world:World)=>void)=>void;sample:(image:string)=>Promise<Uint8ClampedArray>;error:(error:unknown)=>void}){
 let closed=false,queue=Promise.resolve();const wanted=new Map<string,string>(),cache=new Map<string,Promise<ImageColorCombo>>();
 function update(){if(closed)return;const world=host.read(),rules=world.appearance?.imageColors??{},imageFor=autoImageReader(world);
  for(const key of wanted.keys())if(!rules[key]?.enabled)wanted.delete(key);
  for(const [key,rule]of Object.entries(rules)){if(!rule.enabled)continue;const image=imageFor(key);if(!image){wanted.delete(key);continue;}const stamp=JSON.stringify([image,rule.manual,rule.palette]);if(wanted.get(key)===stamp)continue;wanted.set(key,stamp);
   queue=queue.then(async()=>{if(closed||wanted.get(key)!==stamp)return;try{
    let pending=cache.get(image);if(!pending){pending=host.sample(image).then(imageColorCombo);cache.set(image,pending);if(cache.size>32)cache.delete(cache.keys().next().value!);}const combo=await pending;
    const current=host.read(),active=current.appearance?.imageColors?.[key];if(closed||wanted.get(key)!==stamp||!active?.enabled||autoColorImage(current,key)!==image)return;
    const origin=key==='default'?undefined:JSON.parse(key) as Origin;if(origin&&!locate(current,origin))return;
    const channels=[['text','color','text'],['text','glowColor','textGlow'],['nodeDefaults','color','node'],['nodeDefaults','glowColor','nodeGlow']] as const;
    const edits=channels.filter(([, ,channel])=>!active.manual.includes(channel)).map(([target,field,channel])=>({target:origin?(target==='text'?'nodeText':'nodes'):target,field,value:combo[channel]} as const));
    const palette=active.manual.some(c=>c==='text'||c==='textGlow')?undefined:{...active.palette,mode:'text' as const,colors:combo.textPalette,weights:combo.textWeights},textTarget=origin?'nodeText' as const:'text' as const;
    if(JSON.stringify(readPaint(current,textTarget,origin).palette)===JSON.stringify(palette)&&!edits.some(edit=>readPaint(current,edit.target,origin)[edit.field]!==edit.value))return;
    host.change(next=>{for(const edit of edits)writePaint(next,edit.target,origin?[origin]:[],{[edit.field]:edit.value},'automatic');writePaint(next,textTarget,origin?[origin]:[],{palette},'automatic');});
   }catch(error){cache.delete(image);if(!closed&&wanted.get(key)===stamp){wanted.delete(key);host.error(error);}}});
  }
 }
 return {update,settle:()=>queue,dispose(){closed=true;wanted.clear();cache.clear();}};
}
