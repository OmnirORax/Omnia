import { FEATURE_ACTIONS } from "../featureActions.ts";
export type ToolIcon = { image?:string; symbol?:string;size?:number;glow?:boolean };
const icons=new Map<string,ToolIcon>(FEATURE_ACTIONS.flatMap(action=>'toolIcon' in action?[[action.id,action.toolIcon] as const]:[]));
export const toolIconFor=(id:string)=>icons.get(id);
/** One declared icon is used by tool buttons and keyboard/default cursors. */
export function ToolGlyph({icon}:{icon:ToolIcon}) {
  const filter=icon.glow?'drop-shadow(0 0 2px currentColor) drop-shadow(0 0 4px currentColor)':undefined;
  return icon.image?<img src={icon.image} alt="" draggable={false} style={{width:icon.size??'100%',height:icon.size??'100%',objectFit:'contain',filter}}/>:<span style={{display:'inline-block',fontSize:icon.size,lineHeight:1,filter}}>{icon.symbol??'◇'}</span>;
}
