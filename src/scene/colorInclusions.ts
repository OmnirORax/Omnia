import {PALETTE_COLOR_LIMIT} from '../properties/textPalette.ts';
import {panel} from '../ui/panel.ts';
import {bindColorSession} from '../ui/colorSession.ts';
import {motifSwatches} from './motifSwatches.ts';
import type {MotifCandidate} from './colorCombo.ts';
import {themeSettings,setThemeInclusions,setMotifMembership} from './themeControls.ts';
import {readPaint} from '../core/appearance.ts';
import {locate,type World,type Origin} from '../core/model.ts';
type Host={motifs?:(origin?:Origin)=>readonly MotifCandidate[];subscribeMotifs?:(listener:()=>void)=>()=>void;read:()=>World;change:(edit:(world:World)=>void)=>void;subscribe:(read:()=>void)=>()=>void;feedback:(text:string)=>void};
export function colorInclusionPanel(host:Host,origin?:Origin){
 let live=true,stop=()=>{},draft=readPaint(host.read(),origin?'nodeText':'text',origin).glowColor??'#ffffff';
 const change=(edit:(world:World)=>void)=>{if(!live)return;try{host.change(edit);}catch(error){host.feedback(String(error));}};
 const view=panel(origin?'Node colors':'Theme colors',()=>{live=false;stop();stopMotifs();session.cancel();}),input=document.createElement('input'),add=document.createElement('button'),grid=motifSwatches((candidate,enabled)=>change(world=>setMotifMembership(world,origin,candidate.id,enabled,host.motifs?.(origin)??[]))),reset=document.createElement('button');input.type='color';input.value=draft;input.setAttribute('aria-label','Include hue');add.textContent='+';add.setAttribute('aria-label','Include current color');reset.textContent='↺';reset.setAttribute('aria-label','Use image motif');reset.onclick=()=>change(world=>setThemeInclusions(world,origin,[]));view.body.append(input,add,reset,grid.root);
 const include=(color:string)=>change(world=>setThemeInclusions(world,origin,[...(themeSettings(world,origin).included??[]),color]));
 const session=bindColorSession(input,{read:()=>draft,preview:()=>{},commit:color=>{draft=color;include(color);},cancel:()=>{}});add.onclick=()=>include(input.value);
 function sync(){if(origin&&!locate(host.read(),origin)){view.close();return;}const colors=themeSettings(host.read(),origin).included??[];grid.render(host.motifs?.(origin)??[]);add.disabled=colors.length>=PALETTE_COLOR_LIMIT;reset.disabled=!colors.length;}
 const stopMotifs=host.subscribeMotifs?.(sync)??(()=>{});
 stop=host.subscribe(sync);sync();return {...view,origin,openPicker(){input.focus();try{if(input.showPicker)input.showPicker();else input.click();}catch{/* The visible input remains available when native opening is restricted. */}}};
}
