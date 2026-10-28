import type { Component, Params, Recipe } from './model.ts';
import { validateRecipe } from './model.ts';
import { atomnicDefaults } from './atomnicSettings.ts';
import { defaultParams, definition } from './registry.ts';
import type { PatternObject } from '../appearance/propertyPatterns.ts';
export type Point={x:number;y:number};
export type Atom=Point & {id:string;group:string;component:Component;origin:Point;radius:number;values:PatternObject['values']};
export const atomnicSettings=(recipe:Recipe)=>({...atomnicDefaults(),...recipe.atomnic});
export function atoms(recipe:Recipe):Atom[] {
  const result:Atom[]=[];
  const walk=(items:Component[],origin:Point,group:string)=>items.forEach(component=>{
    const params={...defaultParams(definition(component.generator,true)!),...component.params};
    const point={x:origin.x+Number(params.x??0),y:origin.y+Number(params.y??0)};
    if(component.generator==='dot')result.push({...point,id:component.id,group,origin,component,radius:Number(params.size),
      values:{...Object.fromEntries(definition('dot',true)!.parameters.filter(p=>!['x','y'].includes(p.key)).map(p=>[p.property,params[p.key]])), 'structure.generator':'dot'}});
    if(component.children)walk(component.children,point,component.id);
  });walk(recipe.components,{x:0,y:0},'@root');return result;
}
export function mapAtoms(recipe:Recipe,change:(component:Component)=>Component):Recipe {
  const walk=(items:Component[]):Component[]=>items.map(c=>c.generator==='dot'?change(c):c.children?{...c,children:walk(c.children)}:c);
  return {...recipe,components:walk(recipe.components)};
}
export function snapLattice(point:Point,pitch:number):Point {
  const b=point.x/(Math.sqrt(3)*pitch/2),a=-point.y/pitch-b/2;
  let x=Math.round(a),z=Math.round(b),y=Math.round(-a-b);
  const dx=Math.abs(x-a),dz=Math.abs(z-b),dy=Math.abs(y+a+b);
  if(dx>dy&&dx>dz)x=-y-z;else if(dz>dy)z=-x-y;else y=-x-z;
  return {x:z*Math.sqrt(3)*pitch/2,y:-(x+z/2)*pitch};
}
export function placementPoint(point:Point,settings:Params):Point {
  if(settings.mode==='constrained')return snapLattice(point,Number(settings.size)*2);
  const step=Number(settings.step);return {x:Math.round(point.x/step)*step,y:Math.round(point.y/step)*step};
}
export function legalAtoms(recipe:Recipe):boolean {
  const settings=atomnicSettings(recipe);if(settings.mode!=='constrained')return true;
  const list=atoms(recipe),pitch=Number(settings.size)*2;
  for(let i=0;i<list.length;i++) {
    const a=list[i],slot=snapLattice(a,pitch);
    if(Math.hypot(slot.x-a.x,slot.y-a.y)>.001)return false;
    for(let j=0;j<i;j++)if(Math.hypot(a.x-list[j].x,a.y-list[j].y)<a.radius+list[j].radius-.001)return false;
  }return true;
}
export function transformAtoms(recipe:Recipe,ids:ReadonlySet<string>,change:(atom:Atom)=>Point):Recipe {
  const changes=new Map(atoms(recipe).filter(a=>ids.has(a.id)).map(a=>{const p=change(a);return [a.id,{x:p.x-a.origin.x,y:p.y-a.origin.y}];}));
  const next=mapAtoms(recipe,c=>changes.has(c.id)?{...c,params:{...c.params,...changes.get(c.id)}}:c);
  if(!legalAtoms(next))throw Error('That configuration is outside the touching-lattice profile. Choose Free or another valid placement.');
  return validateRecipe(next);
}
export function addAtom(recipe:Recipe,point:Point,id:string):Recipe {
  const s=atomnicSettings(recipe),p=placementPoint(point,s),list=atoms(recipe);
  if(list.some(a=>Math.hypot(a.x-p.x,a.y-p.y)<.01))return recipe;
  const dot:Component={id,generator:'dot',params:{...p,size:Number(s.size),fill:Boolean(s.fill),color:String(s.color),opacity:Number(s.opacity),thickness:Number(s.thickness)}};
  const next={...recipe,components:[...recipe.components,dot]};
  if(!legalAtoms(next))throw Error('This slot is occupied or overlaps another unit.');
  return validateRecipe(next);
}
export function selectionScope(list:Atom[],ids:ReadonlySet<string>,macro:boolean):Set<string> {
  if(!macro)return new Set(ids);
  const groups=new Set(list.filter(a=>ids.has(a.id)).map(a=>a.group));return new Set(list.filter(a=>groups.has(a.group)).map(a=>a.id));
}
export function rotateAtoms(recipe:Recipe,ids:ReadonlySet<string>,pivot:Point,turn:number):Recipe {
  const a=turn*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
  const next=transformAtoms(recipe,ids,p=>({x:pivot.x+(p.x-pivot.x)*c-(p.y-pivot.y)*s,y:pivot.y+(p.x-pivot.x)*s+(p.y-pivot.y)*c}));
  // Mark orientation is authored on the existing highlight applications.
  const oriented=mapAtoms(next,c=>ids.has(c.id)?{...c,params:{...c.params,angle:((Number(c.params.angle??0)+turn*360)%360+360)%360}}:c);
  const descendants=new Map<string,string[]>();
  const collect=(items:Component[]):string[]=>items.flatMap(item=>{const ids=item.generator==='dot'?[item.id]:collect(item.children??[]);descendants.set(item.id,ids);return ids;});
  const all=collect(oriented.components);
  const operations=oriented.operations.flatMap(op=>{
    if(op.operator!=='highlight'||!op.enabled)return [op];
    let targets=op.targets.length?[...new Set(op.targets.flatMap(id=>descendants.get(id.replace(/:shape$/,''))??[]))]:all;
    if(op.params.which!=='all')targets=targets.slice(Number(op.params.index??1)-1,Number(op.params.index??1));
    const moving=targets.filter(id=>ids.has(id)),stationary=targets.filter(id=>!ids.has(id));
    if(!moving.length)return [op];
    const rotated={...op,id:stationary.length?crypto.randomUUID():op.id,targets:moving.map(id=>`${id}:shape`),params:{...op.params,which:'all',start:((Number(op.params.start??0)+turn*360)%360+360)%360}};
    return stationary.length?[{...op,targets:stationary.map(id=>`${id}:shape`),params:{...op.params,which:'all'}},rotated]:[rotated];
  });
  return validateRecipe({...oriented,operations});
}
