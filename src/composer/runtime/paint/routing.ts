import {blocked,connected,createTargetIndex,type Controller,type Target} from '../appearance/model.ts';
/** One live source link, inherited down the existing visual hierarchy. No colour copies. */
export function patternApplies(state:Controller,targets:Target[],target:Target,global:boolean,index=createTargetIndex(targets)){
 if(!target.properties?.includes('patternUse')||!connected(state,targets,target.id,'color',index)||!connected(state,targets,target.id,'patternUse',index)||blocked(state,targets,target.id,'color',undefined,index)||blocked(state,targets,target.id,'patternUse',undefined,index))return false;
 const path=[...index.path(target.id)],base=target.instance?.base;
 if(base&&!path.includes(base))path.unshift(base);
 for(const id of [...path].reverse()){const mode=state.values[id]?.patternUse;if(mode==='on')return true;if(mode==='off')return false;}
 return global;
}
export function patternCSS(role:'text'|'background'|'contour',tile:{url:string;size:number;borderURL:string;slice:number},outline:number,ink:string){
 const common=`background-image:var(--omnium-pattern-text,none),var(--omnium-pattern-surface,none) !important;background-size:${tile.size}px ${tile.size}px !important;background-repeat:repeat !important;background-clip:text,padding-box !important;-webkit-background-clip:text,padding-box !important`;
 if(role==='text')return `--omnium-pattern-text:${tile.url};${common};-webkit-text-fill-color:transparent !important;-webkit-text-stroke:${outline}px ${ink};caret-color:${ink} !important`;
 if(role==='background')return `--omnium-pattern-surface:${tile.url};${common};background-color:transparent !important`;
 return `border-color:transparent !important;border-image-source:${tile.borderURL} !important;border-image-slice:${tile.slice} !important;border-image-repeat:round !important`;
}
