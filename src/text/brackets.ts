import {EditorState,Prec} from '@codemirror/state';
import {closeBrackets,closeBracketsKeymap} from '@codemirror/autocomplete';
import {keymap} from '@codemirror/view';

// Reuse CodeMirror's pair grammar, selection mapping, glyph mapping and undo.
// Extra delimiters wrap selections; ordinary typing keeps its existing pairing.
const selectionDelimiters=[..."([{<«‹“‘「『【〈《〔〖〘〚（［｛⟨⟦⌈⌊",'"',"'",'`','*','_','~','$'];
export const documentBrackets=[EditorState.languageData.of(state=>[{closeBrackets:{brackets:state.selection.ranges.some(range=>!range.empty)?selectionDelimiters:['(','[']}}]),closeBrackets(),Prec.highest(keymap.of(closeBracketsKeymap))];
