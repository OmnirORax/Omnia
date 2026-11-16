import type {ShortcutDefinition} from './shortcuts.ts';
/** Assigned pointer actions; these are descriptions, not keyboard aliases. */
export const WORLD_GESTURES:ShortcutDefinition[]=[
 ['multi-toggle','Multi-selection · toggle node','Ctrl + click','multi select multiselect multiple selection'],
 ['multi-plane','Multi-selection · rectangle in active plane','Ctrl + drag','multi select multiselect multiple selection box marquee'],
 ['multi-depth','Multi-selection · rectangle with depth','Ctrl + Shift + drag','multi select multiselect multiple selection volume box marquee'],
 ['selection-depth','Adjust selection depth','Wheel during depth selection','multi selection volume'],
 ['connect','Connect nodes','Shift + drag','connector link'],
 ['paint-preview','Preview painting nodes','Hold Alt','create stamp'],
 ['paint-confirm','Confirm paint preview','Alt + left click','create stamp apply'],
 ['create-place','Place a node in creation mode','N then left click','create paint'],
 ['create-stroke','Paint nodes in creation mode','N then left drag','create paint'],
 ['create-secondary','Place a node in creation mode (alternate)','N then right click','create paint'],
 ['move','Pick up / place nodes; drop on a node to parent','Left click','move relocation selection adopt'],
 ['menu','Open context menu','Right click','menu'],
 ['view','Navigate camera','Right drag','view look orbit'],
 ['zoom','Zoom camera','Wheel','view'],
 ['rotate','Rotate node/origin; orbit camera on empty space','MB3 + scroll','rotation middle mouse'],
 ['aim','Aim active rotation subject at another node','MB3 on node','rotation face middle mouse'],
 ['rotation-confirm','Confirm active rotation','MB3 on empty space','rotation middle mouse'],
 ['face-origin','Aim origin toward node','Alt + right click','face reference'],
 ['alignment-direction','Rotate alignment direction','Right drag during alignment','align'],
 ['axis-toggle','Toggle active axes','Left click or hold left and sweep axes','plane axis'],
].map(([id,label,gesture,keywords])=>({category:'Omnium',id:`gesture:${id}`,label,gesture,keywords,defaultKey:'',editable:false}));

export const DOCUMENT_GESTURES:ShortcutDefinition[]=[
 ['cursor','Add text cursor','Alt + click','multiple cursor multicursor selection'],
 ['word','Add word selection','Alt + double click','multi highlight multiselect multiple selection'],
 ['range','Add text selection','Alt + drag','multi highlight multiselect multiple selection'],
].map(([id,label,gesture,keywords])=>({category:'Document',id:`gesture:${id}`,label,gesture,keywords,defaultKey:'',editable:false}));
