import { EditorSelection, type EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

export function addWordSelection(state: EditorState, baseline: EditorSelection, start: number, end = start) {
  const a = state.wordAt(start) ?? EditorSelection.cursor(start), b = state.wordAt(end) ?? EditorSelection.cursor(end);
  const from = Math.min(a.from,b.from), to = Math.max(a.to,b.to);
  return baseline.addRange(start <= end ? EditorSelection.range(from,to) : EditorSelection.range(to,from));
}
export function documentMouseSelection() {
  let baseline: EditorSelection | undefined;
  return [
    EditorView.domEventObservers({ mousedown(event, view) {
      if (event.button !== 0 || !event.altKey) baseline = undefined;
      else if (event.detail === 1) baseline = view.state.selection;
    } }),
    EditorView.mouseSelectionStyle.of((view,event) => {
      if (!event.altKey || event.button !== 0 || event.detail !== 2) return null;
      let base = baseline ?? view.state.selection, start = view.posAtCoords({x:event.clientX,y:event.clientY});
      if (start === null) return null;
      return {
        update(update) { if (update.docChanged) { base=base.map(update.changes); start=update.changes.mapPos(start!); } },
        get(move) { const end=view.posAtCoords({x:move.clientX,y:move.clientY}) ?? start!; return addWordSelection(view.state,base,start!,end); },
      };
    }),
  ];
}
