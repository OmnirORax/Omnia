import type {ShortcutDefinition} from './shortcuts.ts';
/** Assigned pointer actions; these are descriptions, not keyboard aliases. */
export const WORLD_GESTURES:ShortcutDefinition[]=[
 ['multi-toggle','Multi-select node','Ctrl + click','multi select multiselect multiple selection'],
 ['multi-plane','Select box · plane','Ctrl + drag','multi select multiselect multiple selection rectangle box marquee'],
 ['multi-depth','Select box · depth','Ctrl + Shift + drag','multi select multiselect multiple selection rectangle volume box marquee'],
 ['selection-depth','Adjust selection depth','Wheel in depth box','multi selection volume'],
 ['connect','Connect nodes','Shift + drag','connector link'],
 ['paint-preview','Preview painting nodes','Hold Alt','create stamp'],
 ['paint-confirm','Confirm paint preview','Alt + left click','create stamp apply'],
 ['create-place','Place node','N, left click','create paint'],
 ['create-stroke','Paint nodes','N, left drag','create paint'],
 ['create-secondary','Place node · alternate','N, right click','create paint'],
 ['move','Move / parent nodes','Left click','move relocation selection adopt'],
 ['menu','Open context menu','Right click','menu'],
 ['view','Navigate camera','Right drag','view look orbit'],
 ['zoom','Zoom camera','Wheel','view'],
 ['rotate','Rotate / orbit','MB3 + scroll','rotation middle mouse'],
 ['aim','Aim rotation target','MB3 on node','rotation face middle mouse'],
 ['rotation-confirm','Confirm rotation','MB3 on empty space','rotation middle mouse'],
 ['face-origin','Aim origin','Alt + right click','face reference'],
 ['alignment-direction','Turn alignment','Right drag in alignment','align'],
 ['axis-toggle','Toggle active axes','Click / left sweep','plane axis'],
].map(([id,label,gesture,keywords])=>({category:'Omnium',id:`gesture:${id}`,label,gesture,keywords,defaultKey:'',editable:false}));

export const DOCUMENT_GESTURES:ShortcutDefinition[]=[
 ['cursor','Add text cursor','Alt + click','multiple cursor multicursor selection'],
 ['word','Add word selection','Alt + double click','multi highlight multiselect multiple selection'],
 ['range','Add text selection','Alt + drag','multi highlight multiselect multiple selection'],
].map(([id,label,gesture,keywords])=>({category:'Document',id:`gesture:${id}`,label,gesture,keywords,defaultKey:'',editable:false}));
