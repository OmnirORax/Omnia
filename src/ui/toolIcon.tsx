import { FEATURE_ACTIONS } from "../featureActions.ts";
export type ToolIcon = { image?:string; symbol?:string;hotspot?:{x:number;y:number} };
const icons=new Map<string,ToolIcon>(FEATURE_ACTIONS.flatMap(action=>'toolIcon' in action?[[action.id,action.toolIcon] as const]:[]));
export const toolIconFor=(id:string)=>icons.get(id);
/** One declared icon is used by tool buttons and keyboard/default cursors. */
export function ToolGlyph({icon}:{icon:ToolIcon}) {
  return icon.image?<img src={icon.image} alt="" draggable={false} style={{width:'100%',height:'100%',objectFit:'contain'}}/>:<span>{icon.symbol??'◇'}</span>;
}
