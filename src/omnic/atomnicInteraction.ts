import type { Point } from './atomnic';
export type AtomnicBounds={x:number;y:number;width:number;height:number};
export type AtomnicInteraction={
  bounds:AtomnicBounds;cursorZone?:string; gridPitch?:number; ghost?:Point & {radius:number;color:string}; selected:readonly string[]; hovered:readonly string[]; pivot:Point|null; phase:string;
  down:(point:Point,event:PointerEvent)=>void; move:(point:Point,event:PointerEvent)=>void;
  context?:(event:MouseEvent)=>boolean;
  up:(point:Point,event:PointerEvent)=>void; cancel:()=>void;
};
