import {foldAll,unfoldAll} from '@codemirror/language';
import type {KeyBinding} from '@codemirror/view';
/** Markdown's native fold service owns section boundaries and fold state. */
export const documentFoldBindings:KeyBinding[]=[
 {key:'Alt-1',run:foldAll},
 {key:'Alt-2',run:unfoldAll},
];
