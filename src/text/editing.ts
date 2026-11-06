/** Browser-native editing transactions own selection, list continuation and undo.
 * Commands operate only within this document, never on another active editor. */
export function documentCommand(root:HTMLElement,command:string){
 const selection=window.getSelection();if(!selection)return false;
 const inside=selection.rangeCount&&selection.anchorNode&&root.contains(selection.anchorNode),range=inside?selection.getRangeAt(0).cloneRange():document.createRange();
 if(!inside){range.selectNodeContents(root);range.collapse(false);}root.focus();selection.removeAllRanges();selection.addRange(range);
 return document.execCommand(command);
}
