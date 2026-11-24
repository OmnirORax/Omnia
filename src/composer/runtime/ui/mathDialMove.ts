import {windowDrag} from '../../../ui/windowDrag.ts';
/** Move the complete editor, including controls outside its scaled ring surface. */
export function bindMathDialMove(surface:HTMLElement,handle:HTMLElement,scale:()=>number){
 const frame=surface.closest<HTMLElement>('[data-math-dial-frame]');
 return windowDrag(frame??surface,handle,undefined,{translateScale:frame?()=>1:scale});
}
