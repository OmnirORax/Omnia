import {panel} from '../ui/panel.ts';
import {bindColorSession} from '../ui/colorSession.ts';
import {themeSettings,setThemeInclusions} from './themeControls.ts';
import {readPaint} from '../core/appearance.ts';
import {locate,type World,type Origin} from '../core/model.ts';
type Host={read:()=>World;change:(edit:(world:World)=>void)=>void;subscribe:(read:()=>void)=>()=>void;feedback:(text:string)=>void};
export function colorInclusionPanel(host:Host,origin?:Origin){
 let live=true,stop=()=>{},last='',draft=readPaint(host.read(),origin?'nodeText':'text',origin).glowColor??'#ffffff';
 const view=panel(origin?'Node colors':'Theme colors',()=>{live=false;stop();session.cancel();}),input=document.createElement('input'),add=document.createElement('button'),grid=document.createElement('div');input.type='color';input.value=draft;input.setAttribute('aria-label','Include hue');add.textContent='+';add.setAttribute('aria-label','Include current color');grid.className='theme-inclusions';view.body.append(input,add,grid);
 const include=(color:string)=>{if(!live)return;try{host.change(world=>setThemeInclusions(world,origin,[...(themeSettings(world,origin).included??[]),color]));}catch(error){host.feedback(String(error));}};
 const session=bindColorSession(input,{read:()=>draft,preview:()=>{},commit:color=>{draft=color;include(color);},cancel:()=>{}});add.onclick=()=>include(input.value);
 function sync(){if(origin&&!locate(host.read(),origin)){view.close();return;}const colors=themeSettings(host.read(),origin).included??[],key=JSON.stringify(colors);if(key===last)return;last=key;grid.replaceChildren();for(const color of colors){const swatch=document.createElement('button');swatch.type='button';swatch.style.backgroundColor=color;swatch.setAttribute('aria-label',`Remove ${color}`);swatch.onclick=()=>{if(!live)return;try{host.change(world=>setThemeInclusions(world,origin,(themeSettings(world,origin).included??[]).filter(c=>c!==color)));}catch(error){host.feedback(String(error));}};grid.append(swatch);}add.disabled=colors.length>=8;}
 stop=host.subscribe(sync);sync();return {...view,origin,openPicker(){input.focus();try{if(input.showPicker)input.showPicker();else input.click();}catch{/* The visible input remains available when native opening is restricted. */}}};
}
