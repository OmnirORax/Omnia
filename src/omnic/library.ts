import {viewHistory} from '../ui/viewHistory.ts';
import {navigationState} from '../ui/navigationState.ts';
import {universalHistory} from '../core/universalHistory.ts';
import {panel} from '../ui/panel.ts';
import {locate,type Origin,type World} from '../core/model.ts';
import {definitionRecipe,matchesAtlas,saveDefinition,type AtlasFilter} from './atlas.ts';
import {definitionResolver} from './atlas.ts';
import {evaluateRecipe} from './evaluate.ts';
import {renderSVG,svgDataUrl} from './svg.ts';
import {atomnicViewBounds} from './atomnicSettings.ts';
import {PRESETS,createRecipe} from './presets.ts';
type Host={read:()=>World;change:(edit:(world:World)=>void,group?:string)=>void;open:(origin?:Origin)=>void;focus:(origin:Origin)=>void;feedback:(message:string)=>void;subscribe:(listener:()=>void)=>()=>void};

function dialogButton(host:Host,parent:HTMLElement,label:string,action:()=>void){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{try{universalHistory.transaction(action);}catch(error){host.feedback(String(error));}};parent.append(b);}
/** These constructors retain the host, never a closed library's DOM. */
function libraryDialogs(host:Host){
 const atlas=viewHistory.defineWindow('atlas-create',(filter:AtlasFilter)=>{
  const editor=panel('Atlas'),name=document.createElement('input');name.placeholder='Name';editor.body.append(name);
  dialogButton(host,editor.body,'Save',()=>{if(!name.value.trim())return;host.change(world=>{world.version=3;world.atlases??=[{name:'All',filter:{}}];world.atlases.push({name:name.value.trim(),filter});world.activeAtlas=world.atlases.length-1;});editor.close();});return editor;
 });
 const filter=viewHistory.defineWindow('atlas-filter',(index:number,current:AtlasFilter)=>{
  const editor=panel('Filter'),form=document.createElement('form'),inputs=new Map<string,HTMLInputElement>();editor.body.append(form);
  for(const key of ['tags','collection','generator','operator'] as const){const input=document.createElement('input');input.placeholder=key;input.setAttribute('aria-label',key);const value=current[key];input.value=Array.isArray(value)?value.join(', '):value??'';inputs.set(key,input);form.append(input);}
  for(const key of ['countMin','countMax','motion','boundary','filled','parameter','parameterMin','parameterMax']){const input=document.createElement('input');input.placeholder=key;input.setAttribute('aria-label',key);input.value=key==='parameter'?current.parameter?.property??'':key==='parameterMin'?String(current.parameter?.min??''):key==='parameterMax'?String(current.parameter?.max??''):String((current as Record<string,unknown>)[key]??'');inputs.set(key,input);form.append(input);}
  dialogButton(host,form,'Apply',()=>{const next:AtlasFilter={text:current.text};for(const [key,input]of inputs)if(input.value.trim()){if(key==='parameter'||key==='parameterMin'||key==='parameterMax')continue;Object.assign(next,{[key]:key==='tags'?input.value.split(',').map(v=>v.trim()).filter(Boolean):['countMin','countMax'].includes(key)?Number(input.value):['motion','boundary','filled'].includes(key)?input.value.trim()==='true':input.value.trim()});}if(inputs.get('parameter')!.value.trim())next.parameter={property:inputs.get('parameter')!.value.trim(),min:Number(inputs.get('parameterMin')!.value),max:Number(inputs.get('parameterMax')!.value)};
   host.change(world=>{world.version=3;world.atlases??=[{name:'All',filter:{}}];if(!world.atlases[index])throw Error('Atlas no longer exists.');world.atlases[index].filter=next;},'atlas-filter');editor.close();});return editor;
 });
 const presets=viewHistory.defineWindow('atlas-presets',()=>{const editor=panel('Presets');for(const preset of PRESETS)dialogButton(host,editor.body,preset.label,()=>{let origin:Origin|undefined;host.change(world=>{origin=saveDefinition(world,undefined,createRecipe(preset.id),preset.label);locate(world,origin)!.catalog={tags:[],collections:[],preset:true};});host.open(origin);editor.close();});return editor;});
 return {atlas,filter,presets};
}

/** Library and atlases query the same structures; neither owns another placement. */
export function libraryPanel(host:Host,scope:string){
 const dialogs=libraryDialogs(host),menuKey=`${scope}/library-menu`;
 let indexedWorld:World|undefined,snapshot='',thumbs=new Map<string,string>(),page=0,alive=true,menu:HTMLElement|undefined;
 const view=panel('Omnic · Atlas',()=>{alive=false;unsubscribe();stopMenu();}),toolbar=document.createElement('nav'),views=document.createElement('select'),search=document.createElement('input'),list=document.createElement('div'),footer=document.createElement('nav');
 view.root.classList.add('omnic-library');list.className='omnic-library-grid';search.type='search';search.placeholder='Search';search.setAttribute('aria-label','Search definitions');views.setAttribute('aria-label','Atlas view');view.body.append(toolbar,search,list,footer);
 const attempt=(action:()=>void)=>{try{universalHistory.transaction(action);}catch(e){host.feedback(e instanceof Error?e.message:String(e));}};
 function button(label:string,action:()=>void,parent:HTMLElement=toolbar){const b=document.createElement('button');b.textContent=label;b.type='button';b.onclick=()=>attempt(action);parent.append(b);return b;}
 const current=()=>host.read().atlases?.[host.read().activeAtlas??0];
 function updateFilter(next:AtlasFilter){host.change(world=>{world.version=3;world.atlases??=[{name:'All',filter:{}}];world.activeAtlas??=0;world.atlases[world.activeAtlas].filter=next;},'atlas-filter');page=0;render();}
 toolbar.append(views);button('＋ Omnic',()=>host.open());button('＋ View',()=>dialogs.atlas({...current()?.filter,text:search.value}));
 button('Filter',()=>dialogs.filter(host.read().activeAtlas??0,{...current()?.filter,text:search.value}));
 button('Presets',()=>dialogs.presets());
 button('− View',()=>{const world=host.read();if((world.atlases?.length??0)<=1)return;host.change(world=>{world.atlases!.splice(world.activeAtlas??0,1);world.activeAtlas=0;});});
 views.onchange=()=>host.change(world=>{world.version=3;world.activeAtlas=Number(views.value);});search.oninput=()=>{page=0;render(true);};search.onchange=()=>updateFilter({...current()?.filter,text:search.value});
 function metadata(origin:Origin,event:MouseEvent){event.preventDefault();navigationState.set(menuKey,{origin});}
 function renderMetadata(){menu?.remove();menu=undefined;const state=navigationState.read<{origin:Origin}|null>(menuKey,null);if(!state||!alive)return;const {origin}=state;if(!locate(host.read(),origin))return;menu=document.createElement('div');menu.className='omnic-menu';view.body.append(menu);button('Open',()=>{host.open(origin);navigationState.set(menuKey,null);},menu);button('Focus',()=>{host.focus(origin);navigationState.set(menuKey,null);},menu);
  const form=document.createElement('form'),node=locate(host.read(),origin)!;menu.append(form);const words=document.createElement('input');words.placeholder='English words / phrases';words.setAttribute('aria-label','English words and phrases');words.value=node.lexiconWords?.join(', ')??'';words.onchange=()=>host.change(world=>{locate(world,origin)!.lexiconWords=words.value.split(',').map(word=>word.trim()).filter(Boolean);});form.append(words);for(const key of ['tags','collections'] as const){const input=document.createElement('input');input.placeholder=key;input.setAttribute('aria-label',key);input.value=node.catalog?.[key].join(', ')??'';input.onchange=()=>host.change(world=>{const target=locate(world,origin)!;target.catalog??={tags:[],collections:[]};target.catalog[key]=input.value.split(',').map(v=>v.trim()).filter(Boolean);});form.append(input);}}
 function render(typing=false){if(!alive)return;const world=host.read(),filter={...current()?.filter,...(typing?{text:search.value}:{})};const stamp=indexedWorld===world?snapshot:JSON.stringify(world.nodes.map(n=>[n.origin,n.position,n.invariant,n.omnic,n.omnicEdits,n.omnicHistory,n.variantOf]));indexedWorld=world;if(stamp!==snapshot){snapshot=stamp;thumbs.clear();}views.replaceChildren();for(const [i,atlas]of (world.atlases??[{name:'All',filter:{}}]).entries()){const option=document.createElement('option');option.value=String(i);option.textContent=atlas.name;views.append(option);}views.value=String(world.activeAtlas??0);if(document.activeElement!==search)search.value=filter.text??'';
  const nodes=world.nodes.filter(node=>node.invariant&&definitionRecipe(node,world)&&matchesAtlas(node,world,filter));page=Math.min(page,Math.max(0,Math.ceil(nodes.length/40)-1));list.replaceChildren();const resolve=definitionResolver(world);
  for(const node of nodes.slice(page*40,page*40+40)){const item=document.createElement('button');item.className='omnic-library-item';const recipe=definitionRecipe(node,world)!;const id=JSON.stringify(node.origin);let markup=thumbs.get(id);if(!markup){markup=renderSVG(evaluateRecipe(recipe,resolve),{bounds:atomnicViewBounds(recipe.atomnic)});if(thumbs.size>=80)thumbs.delete(thumbs.keys().next().value!);thumbs.set(id,markup);}const image=document.createElement('img');image.src=svgDataUrl(markup);image.alt=node.label||'⚬';image.width=60;image.height=60;item.append(image);const label=document.createElement('span');label.textContent=node.label||'⚬';item.append(label);item.onclick=()=>host.open(node.origin);item.oncontextmenu=event=>metadata(node.origin,event);list.append(item);}
  footer.replaceChildren();button('←',()=>{page=Math.max(0,page-1);render();},footer);footer.append(document.createTextNode(`${nodes.length? page+1:0}/${Math.ceil(nodes.length/40)}`));button('→',()=>{page=Math.min(Math.ceil(nodes.length/40)-1,page+1);render();},footer);
 }
 const unsubscribe=host.subscribe(()=>{render();renderMetadata();}),stopMenu=navigationState.subscribe(menuKey,renderMetadata);render();renderMetadata();return view;
}
