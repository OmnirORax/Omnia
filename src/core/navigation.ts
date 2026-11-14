import type { Origin,World } from './model.ts';
import { geometry,address,vector } from './lattice.ts';
import { transformPlacements,type Rotation } from '../navigation/transforms.ts';
import { prepareLatticeTransform,latticeDocument } from '../graph/lattice.ts';
import { worldPositions } from '../graph/coordinates.ts';
import type { XYZ } from '../graph/geometryTypes.ts';

/** V1's placement transformation, committed once through the current owner. */
export function transformNodes(world:World,origins:readonly Origin[],rotation:Rotation,pivot:XYZ,layout:boolean){
  const doc=layout?latticeDocument(geometry(world)):geometry(world),ids=origins.map(address),next=transformPlacements(doc,ids,rotation,pivot,layout);
  if(layout){
    const worlds=worldPositions(next),targets=new Map(ids.map(id=>[id,worlds.get(id)!]));
    const landing=prepareLatticeTransform(doc,ids,1,1)(targets);if(!landing)throw Error('That rotated layout is occupied.');
    for(const node of world.nodes){const target=landing.get(address(node.origin));if(target)node.position=vector(target);}
  }else{
    const orientations=new Map(next.placements.map(p=>[p.id,p.orientation]));
    for(const node of world.nodes)if(ids.includes(address(node.origin)))node.orientation=orientations.get(address(node.origin));
  }
}
