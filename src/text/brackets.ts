import {EditorState,Prec} from '@codemirror/state';
import {closeBrackets,closeBracketsKeymap} from '@codemirror/autocomplete';
import {keymap} from '@codemirror/view';

export const documentBrackets=[EditorState.languageData.of(()=>[{closeBrackets:{brackets:['(','[']}}]),closeBrackets(),Prec.highest(keymap.of(closeBracketsKeymap))];
