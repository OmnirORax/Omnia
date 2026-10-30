import type { Point } from './atomnic';
export type InteractionPoint=Point & {scenePerPixel?:number};
export type AtomnicBounds={x:number;y:number;width:number;height:number};
export type AtomnicInteraction={
  select?:(ids:readonly string[])=>void;
  bounds:AtomnicBounds;cursorZone?:string; gridPitch?:number; ghost?:Point & {radius:number;color:string}; selected:readonly string[]; selectionBox?:{x:number;y:number;width:number;height:number}|null; hovered:readonly string[]; pivot:Point|null; phase:string;
  down:(point:InteractionPoint,event:PointerEvent)=>void; move:(point:InteractionPoint,event:PointerEvent)=>void;
  options?:(event:MouseEvent)=>boolean;
  context?:(event:MouseEvent)=>boolean;
  up:(point:InteractionPoint,event:PointerEvent)=>void; cancel:()=>void;
};
