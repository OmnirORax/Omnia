import type { Origin,World } from './model.ts';
import { geometry,address,vector } from './lattice.ts';
import { transformPlacements,type Rotation } from '../navigation/transforms.ts';
import { prepareLatticeTransform } from '../graph/lattice.ts';
import { worldPositions } from '../graph/coordinates.ts';
import {axisComponent} from './axes.ts';
import {rotateVector} from '../navigation/transforms.ts';
import type { XYZ } from '../graph/geometryTypes.ts';

/** V1's placement transformation, committed once through the current owner. */
export function transformNodes(world:World,origins:readonly Origin[],rotation:Rotation,pivot:XYZ,layout:boolean){
  const doc=geometry(world),ids=origins.map(address),next=transformPlacements(doc,ids,rotation,pivot,layout);
  if(layout){
    const connected=axisComponent(world,new Set(ids));if(connected.size!==ids.length)throw Error('Select the whole constrained arrangement to rotate it.');
    const worlds=worldPositions(next),targets=new Map(ids.map(id=>[id,worlds.get(id)!]));
    const landing=prepareLatticeTransform(doc,ids,1,1)(targets);if(!landing)throw Error('That rotated layout is occupied.');
    for(const node of world.nodes){const target=landing.get(address(node.origin));if(target)node.position=vector(target);}
    for(const frame of world.axes??[])if(frame.members.some(member=>ids.includes(address(member))))for(const key of ['x','y','z'] as const){const v=frame[key],rotated=rotateVector({x:v[0],y:v[1],z:v[2]},rotation);frame[key]=[rotated.x,rotated.y,rotated.z];}
  }else{
    const orientations=new Map(next.placements.map(p=>[p.id,p.orientation]));
    for(const node of world.nodes)if(ids.includes(address(node.origin)))node.orientation=orientations.get(address(node.origin));
  }
}
