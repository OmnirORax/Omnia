import {addRelationRow,relationCounts,relationProfile,type ColorRelations} from '../properties/colorRelations.ts';
import type {ScenePalette} from './palette.ts';
const cache=new WeakMap<ScenePalette,Map<string,ColorRelations>>();
/** Membership projects the same source grid; unselected colors don't become partners. */
export function imageRelations(source:ScenePalette,mapping:readonly number[],colors:number):ColorRelations|undefined{
 const grid=source.spatial;if(!grid)return;let variants=cache.get(source);if(!variants){variants=new Map();cache.set(source,variants);}const key=JSON.stringify([mapping,colors]);const found=variants.get(key);if(found)return found;
 const scan=(vertical:boolean)=>{const counts=relationCounts(colors),rows=vertical?grid.width:grid.height,length=vertical?grid.height:grid.width;
  for(let row=0;row<rows;row++){const indices:number[]=[];for(let at=0;at<length;at++){const index=grid.cells[vertical?at*grid.width+row:row*grid.width+at],color=mapping[index]??-1;if(color>=0)indices.push(color);}addRelationRow(counts,indices);}return relationProfile(counts);
 };
 const result={horizontal:scan(false),vertical:scan(true)};variants.set(key,result);if(variants.size>16)variants.delete(variants.keys().next().value!);return result;
}
