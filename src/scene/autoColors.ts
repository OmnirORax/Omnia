import {migratePaletteSettings,type PaletteSettings} from '../properties/textPalette.ts';
import {locate,type World,type Origin} from '../core/model.ts';
import {createInheritanceReader} from '../core/lattice.ts';
import {readPaint,writePaint} from '../core/appearance.ts';
import {DEFAULT_BACKGROUND} from './defaultBackground.ts';
import type {SceneSignal} from './palette.ts';
import {motifCandidates,imageColorCombo,matchedImageColors,comboPalette,type ImageColorCombo} from './colorCombo.ts';
export type AutoColorChannel='text'|'textGlow'|'node'|'nodeGlow';
export type AutoColorRule={enabled:boolean;inherit?:boolean;manual:AutoColorChannel[];mode?:'text';palette?:PaletteSettings};
const includedSample=(colors:readonly string[])=>{const combo=imageColorCombo(new Uint8ClampedArray(colors.flatMap(c=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16),255])));delete combo.source.spatial;return combo;};
export const autoColorKey=(origin?:Origin)=>origin?JSON.stringify(origin):'default';
const autoPaletteSettings=(settings?:PaletteSettings):PaletteSettings=>{const next={...settings,distribution:settings?.distribution??'image'};migratePaletteSettings(next);if(next.inverseDistribution===undefined)next.inverseDistribution=next.distribution==='image';return next;};
export function configureAutoColors(world:World,origin:Origin|undefined,enabled:boolean,reset=false,settings?:PaletteSettings){
 const key=autoColorKey(origin),previous=world.appearance?.imageColors?.[key];
 const palette=autoPaletteSettings({ink:'color',...previous?.palette,...settings});
 for(const k of Object.keys(palette) as (keyof PaletteSettings)[])if(palette[k]===undefined)delete palette[k];
 if(!enabled&&previous?.enabled){
  const target=origin?'nodeText':'text',paint=readPaint(world,target,origin);
  if(paint.palette?.distribution==='pixels')writePaint(world,target,origin?[origin]:[],{palette:{...paint.palette,distribution:'balanced'}},'automatic');
 }
 world.appearance??={};
 world.appearance.imageColors={...world.appearance.imageColors,[key]:{enabled,mode:'text',palette,manual:reset?[]:previous?.manual??[]}};
}
function autoImageReader(world:World){let nodes:Map<string,World['nodes'][number]>|undefined;let inherit:ReturnType<typeof createInheritanceReader>|undefined;return(key:string)=>{if(key==='default')return world.scene?world.scene.image:DEFAULT_BACKGROUND.id;nodes??=new Map(world.nodes.map(node=>[JSON.stringify(node.origin),node]));const node=nodes.get(key);if(!node)return null;const actual=(inherit??=createInheritanceReader(world))(node);return actual.scene!==undefined?actual.scene:world.scene?world.scene.image:DEFAULT_BACKGROUND.id;};}
export const autoColorImage=(world:World,key:string)=>autoImageReader(world)(key);

/** One serial analysis queue, cached by source image; results are checked again before applying. */
export function createAutoColors(host:{read:()=>World;change:(edit:(world:World)=>void)=>void;sample:(image:string)=>Promise<SceneSignal>;error:(error:unknown)=>void}){
 let closed=false,queue=Promise.resolve();const wanted=new Map<string,string>(),cache=new Map<string,Promise<ImageColorCombo>&{resolved?:ImageColorCombo}>(),listeners=new Set<()=>void>();
 function update(){if(closed)return;const world=host.read(),rules=world.appearance?.imageColors??{},imageFor=autoImageReader(world);
  for(const key of wanted.keys())if(!rules[key]?.enabled)wanted.delete(key);
  for(const [key,rule]of Object.entries(rules)){if(!rule.enabled)continue;const image=imageFor(key);if(!image&&!rule.palette?.included?.length){wanted.delete(key);continue;}const stamp=JSON.stringify([image,rule.manual,rule.palette]);if(wanted.get(key)===stamp)continue;wanted.set(key,stamp);
   queue=queue.then(async()=>{if(closed||wanted.get(key)!==stamp)return;try{
    let pending=image?cache.get(image):undefined;if(!pending){pending=image?host.sample(image).then(imageColorCombo):Promise.resolve(includedSample(rule.palette!.included!));if(image){cache.set(image,pending);if(cache.size>32)cache.delete(cache.keys().next().value!);}}const sampled=await pending;const result=pending as Promise<ImageColorCombo>&{resolved?:ImageColorCombo};if(result.resolved!==sampled){result.resolved=sampled;if(!closed)for(const listener of listeners)listener();}
    const current=host.read(),active=current.appearance?.imageColors?.[key];if(closed||wanted.get(key)!==stamp||!active?.enabled||autoColorImage(current,key)!==image)return;
    const settings=autoPaletteSettings(active.palette),combo=matchedImageColors(sampled,settings,image??undefined);
    const origin=key==='default'?undefined:JSON.parse(key) as Origin;if(origin&&!locate(current,origin))return;
    const channels=[['text','color','text'],['text','glowColor','textGlow'],['nodeDefaults','color','node'],['nodeDefaults','glowColor','nodeGlow']] as const;
    const edits=channels.filter(([, ,channel])=>!active.manual.includes(channel)).map(([target,field,channel])=>({target:origin?(target==='text'?'nodeText':'nodes'):target,field,value:combo[channel]} as const));
    const palette=active.manual.some(c=>c==='text'||c==='textGlow')?undefined:comboPalette(combo,settings),textTarget=origin?'nodeText' as const:'text' as const;
    if(JSON.stringify(readPaint(current,textTarget,origin).palette)===JSON.stringify(palette)&&!edits.some(edit=>readPaint(current,edit.target,origin)[edit.field]!==edit.value))return;
    host.change(next=>{for(const edit of edits)writePaint(next,edit.target,origin?[origin]:[],{[edit.field]:edit.value},'automatic');writePaint(next,textTarget,origin?[origin]:[],{palette},'automatic');});
   }catch(error){if(image&&!cache.get(image)?.resolved)cache.delete(image);if(!closed&&wanted.get(key)===stamp){wanted.delete(key);host.error(error);}}});
  }
 }
 const sampled=(world:World,origin:Origin|undefined,settings:PaletteSettings)=>{const image=autoColorImage(world,autoColorKey(origin));return image?cache.get(image)?.resolved:settings.included?.length?includedSample(settings.included):undefined;};
 return {subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},motifs(world:World,origin?:Origin){const settings=autoPaletteSettings(world.appearance?.imageColors?.[autoColorKey(origin)]?.palette),sample=sampled(world,origin,settings);return sample?motifCandidates(sample.source,settings):[];},preview(world:World,origin:Origin|undefined,settings:PaletteSettings){if(closed||world.appearance?.imageColors?.[autoColorKey(origin)]?.manual.some(c=>c==='text'||c==='textGlow'))return;const sample=sampled(world,origin,settings);if(!sample)return;settings=autoPaletteSettings(settings);const combo=matchedImageColors(sample,settings,autoColorImage(world,autoColorKey(origin))??undefined);return {color:combo.text,glowColor:combo.textGlow,palette:comboPalette(combo,settings)};},update,settle:()=>queue,dispose(){closed=true;wanted.clear();cache.clear();listeners.clear();}};
}
