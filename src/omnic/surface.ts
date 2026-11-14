import type {Origin} from '../core/model.ts';
import type {Evaluation} from './evaluate.ts';
import type {Recipe} from './model.ts';
export type OmnicPoint={x:number;y:number;scenePerPixel?:number};
export type OmnicSurface={readonly origin:Origin|undefined;hover?:(inside:boolean)=>void;readonly bounds:{x:number;y:number;width:number;height:number};readonly preview:{recipe:Recipe;evaluation:Evaluation;bounds?:{x:number;y:number;width:number;height:number};hovered?:readonly string[];pivot?:OmnicPoint|null;ghost?:OmnicPoint&{radius:number;color:string};gridPitch?:number};down:(point:OmnicPoint,event:PointerEvent)=>void;move:(point:OmnicPoint,event:PointerEvent)=>void;up:(point:OmnicPoint,event:PointerEvent)=>void;context:(point:OmnicPoint,event:MouseEvent)=>void;cancel:()=>void};
/** The same square xMidYMid presentation used by SVG and vector glyphs. */
export function glyphSurfacePoint(bounds:OmnicSurface['bounds'],local:OmnicPoint){const span=Math.max(bounds.width,bounds.height);return{x:bounds.x+bounds.width/2+local.x*span,y:bounds.y+bounds.height/2-local.y*span};}
