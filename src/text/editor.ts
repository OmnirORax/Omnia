import {documentBrackets} from './brackets.ts';
import {lexiconAnnotations,workspaceLexicon,refreshLexicon} from './lexicon.ts';
import { EditorState, Transaction, Prec, type StateCommand } from '@codemirror/state';
import { EditorView, drawSelection, keymap, scrollPastEnd } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentLess, indentMore, indentWithTab } from '@codemirror/commands';
import { markdown, markdownKeymap } from '@codemirror/lang-markdown';
import { Strikethrough, TaskList } from '@lezer/markdown';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { closeSearchPanel, getSearchQuery, openSearchPanel, search, searchKeymap, SearchQuery, setSearchQuery } from '@codemirror/search';
import { readPaint } from '../core/appearance.ts';
import { textStyle } from '../ui/appearance.ts';
import { emboldenStrokeEm } from '../properties/embolden.ts';
import { panel } from '../ui/panel.ts';
import { TEXT_CLIPBOARD } from './dom.ts';
import { normalizeText, validateNodeText, type NodeText, type TextPart } from './model.ts';
import type { Origin, World } from '../core/model.ts';
import { inherited } from '../core/lattice.ts';
import { locate } from '../core/model.ts';
import { fromSource, glyphField, glyphHistory, sliceSource, sourceTransaction, sourceRefreshSpec, toSource, type Edit } from './source.ts';
import { capitalizeSentence, codeBlock, deleteLines, heading, list, moveLines, singleCursor, wrap } from './commands.ts';
import { documentMouseSelection } from './mouse.ts';
import {createGlyphPresentation} from '../omnic/presentation.ts';
import { documentPresentation,refreshDocumentGlyphs } from './presentation.ts';

export function editDocument(origin: Origin, read: () => World, commit: (text: NodeText) => void, feedback: (message: string) => void, closed?: () => void) {
  const current = locate(read(), origin); if (!current) return;
  let syncing=false,failed = false, editor: EditorView | undefined;
  const actual = inherited(current, read()), source = toSource(actual.text ?? { version: 1, content: [] });
  const view = panel(actual.label || 'Document', () => {
    if (failed) { save(); if (failed && !confirm('These document changes could not be saved. Close and discard them?')) return false; }
    editor?.destroy(); closed?.();
  });
  view.root.classList.add('node-document-panel');
  function save() {
    if (!editor||syncing) return;
    try {
      const text = fromSource(sliceSource(editor.state)); validateNodeText(text, new Set(read().nodes.map(n => JSON.stringify(n.origin)))); commit(text); failed = false;
    } catch (error) { failed = true; feedback(error instanceof Error ? error.message : String(error)); }
  }
  const toolbar = document.createElement('div'), host = document.createElement('div'); toolbar.className = 'document-tools'; host.className = 'document-content'; view.body.append(toolbar, host);
  host.addEventListener('keydown',event => event.stopPropagation());
  const run = (command: StateCommand) => { if (editor) { command(editor); editor.focus(); } };
  for (const [label, command] of [['B',wrap('**')],['I',wrap('*')],['1.',list('numbered')],['•',list('bullet')],['→',indentMore],['←',indentLess]] as const) {
    const b = document.createElement('button'); b.textContent = label; b.setAttribute('aria-label', ({ B:'Bold',I:'Italic','1.':'Numbered list','•':'Bullet list','→':'Indent','←':'Outdent' })[label]);
    b.onpointerdown = event => event.preventDefault(); b.onclick = () => run(command); toolbar.append(b);
  }
  let headingMenu: HTMLElement | undefined;
  const chooseHeading = () => {
    headingMenu?.remove(); headingMenu = document.createElement('div'); headingMenu.className = 'document-tools';
    for (let level = 0; level <= 6; level++) { const b = document.createElement('button'); b.textContent = level ? `H${level}` : '¶'; b.onclick = () => { run(heading(level)); headingMenu?.remove(); headingMenu = undefined; }; headingMenu.append(b); }
    toolbar.after(headingMenu); return true;
  };
  let fontSize = 13;
  const font = (delta: number) => () => { fontSize = Math.min(36, Math.max(9, fontSize+delta)); host.style.fontSize = `${fontSize}px`; editor?.requestMeasure(); return true; };
  const regex = () => {
    if (!editor) return false;
    const q = getSearchQuery(editor.state); editor.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search:q.search,replace:q.replace,caseSensitive:q.caseSensitive,regexp:true })) });
    return openSearchPanel(editor);
  };
  function plain(text: NodeText) { return text.content.map(part => typeof part === 'string' ? part : part.word ?? read().nodes.find(n => JSON.stringify(n.origin) === part.glyph)?.label ?? '•').join(''); }
  const copy = (event: ClipboardEvent, cut: boolean) => {
    if (!editor || !event.clipboardData) return false;
    const parts: TextPart[] = []; let ranges: {from:number;to:number}[] = editor.state.selection.ranges.filter(r => !r.empty);
    if (!ranges.length) { const seen = new Set<number>(); ranges = editor.state.selection.ranges.flatMap(r => { const line = editor!.state.doc.lineAt(r.head); if (seen.has(line.number)) return []; seen.add(line.number); return [{from:line.from,to:Math.min(editor!.state.doc.length,line.to+1)}]; }); }
    for (const range of ranges) { if (parts.length && !String(parts.at(-1)).endsWith('\n')) parts.push('\n'); parts.push(...fromSource(sliceSource(editor.state, range.from, range.to)).content); }
    const text = normalizeText(parts); event.clipboardData.setData(TEXT_CLIPBOARD, JSON.stringify(text)); event.clipboardData.setData('text/plain', plain(text)); event.preventDefault();
    if (cut) editor.dispatch(sourceTransaction(editor.state, ranges.map(r => ({ from:r.from,to:r.to,insert:toSource({version:1,content:[]}) }))));
    return true;
  };
  editor = new EditorView({ parent:host, state:EditorState.create({ doc:source.text, extensions:[
    EditorState.allowMultipleSelections.of(true), glyphField.init(() => source.glyphs), glyphHistory, history(),documentBrackets,lexiconAnnotations(read),
    EditorView.clickAddsSelectionRange.of(event => event.altKey), documentMouseSelection(), drawSelection({drawRangeCursor:true,cursorBlinkRate:1000}), EditorView.lineWrapping, scrollPastEnd(),
    markdown({ extensions:[Strikethrough,TaskList],addKeymap:false }), documentPresentation(read),
    syntaxHighlighting(HighlightStyle.define([
      { tag:tags.strong,fontWeight:'bold',fontSynthesis:'weight',WebkitTextStroke:'var(--visual-text-bold-stroke, 0em currentColor)' }, { tag:tags.emphasis,fontStyle:'italic' }, { tag:tags.strikethrough,textDecoration:'line-through' },
      { tag:tags.monospace,fontFamily:'ui-monospace, monospace',backgroundColor:'#ffffff08' },
      { tag:tags.heading1,fontSize:'1.7em',fontWeight:'bold' }, { tag:tags.heading2,fontSize:'1.5em',fontWeight:'bold' },
      { tag:tags.heading3,fontSize:'1.3em',fontWeight:'bold' }, { tag:tags.heading4,fontSize:'1.15em',fontWeight:'bold' },
      { tag:tags.heading5,fontWeight:'bold' }, { tag:tags.heading6,fontWeight:'bold' }, { tag:tags.processingInstruction,color:'#89927f' },
    ])),
    search({ top:true }),
    Prec.highest(keymap.of([
      { key:'Escape',run: v => { if (headingMenu) { headingMenu.remove(); headingMenu=undefined; return true; } if (closeSearchPanel(v) || singleCursor(v)) return true; view.close(); return true; } },
      { key:'Mod-b',run:wrap('**') }, { key:'Mod-i',run:wrap('*') },
      { key:'Mod-ArrowUp',run:moveLines(-1) }, { key:'Mod-ArrowDown',run:moveLines(1) },
      { key:'Alt-Delete',run:deleteLines }, { key:'Mod-Delete',run:heading(0) },
      ...[1,2,3,4,5,6].map(n => ({ key:`Mod-F${n}`,run:heading(n) })), { key:'Mod-F7',run:chooseHeading },
      { key:'Mod-1',run:list('numbered') }, { key:'Mod-2',run:list('bullet') }, { key:'Mod-Shift-3',run:list('cycle') },
      { key:'Mod-Shift-4',run:wrap('~~') }, { key:'Mod-5',run:wrap('`') }, { key:'Alt-Mod-1',run:codeBlock },
      { key:'Mod-3',run:capitalizeSentence }, { key:'Alt-ArrowRight',run:regex },
      { key:'Mod-PageUp',run:font(1) }, { key:'Mod-PageDown',run:font(-1) },
      ...markdownKeymap, ...historyKeymap, ...searchKeymap, indentWithTab, ...defaultKeymap,
    ])),
    EditorView.contentAttributes.of({ 'aria-label':'Node document',spellcheck:'true' }),
    EditorView.domEventHandlers({
      keydown: event => { event.stopPropagation(); return false; },
      copy:event => copy(event,false), cut:event => copy(event,true),
      paste:event => {
        const data = event.clipboardData?.getData(TEXT_CLIPBOARD); if (!data || !editor) return false;
        try {
          const text: unknown = JSON.parse(data); validateNodeText(text,new Set(read().nodes.map(n => JSON.stringify(n.origin))));
          const insert = toSource(text), edits: Edit[] = editor.state.selection.ranges.map(r => ({from:r.from,to:r.to,insert}));
          const changes = editor.state.changes(edits.map(e => ({from:e.from,to:e.to,insert:e.insert.text})));
          const ranges = edits.map(e => ({ anchor:changes.mapPos(e.from,-1)+insert.text.length,head:changes.mapPos(e.from,-1)+insert.text.length }));
          editor.dispatch(sourceTransaction(editor.state,edits,ranges)); event.preventDefault(); return true;
        } catch { return false; }
      },
    }),
    EditorView.updateListener.of(update => { if (update.docChanged) save(); }),
    EditorView.theme({ '&':{ backgroundColor:'transparent',fontSize:'inherit',color:'inherit' },'.cm-content':{fontFamily:'inherit',padding:'0',minHeight:'120px'},'.cm-scroller':{overflow:'auto',fontFamily:'inherit'},'&.cm-focused':{outline:'none'},'.cm-cursorLayer':{mixBlendMode:'difference'},'.cm-cursor, &.cm-focused .cm-cursor':{borderLeft:'2px solid #ffffff',marginLeft:'-1px',filter:'brightness(0) invert(1)'},'&.cm-editor .cm-scroller > .cm-selectionLayer .cm-selectionBackground, &.cm-editor.cm-focused .cm-scroller > .cm-selectionLayer .cm-selectionBackground':{backgroundColor:'#245eac',outline:'1px solid #85baff',outlineOffset:'-1px'},'.cm-panels':{backgroundColor:'#191c1b',color:'inherit'},'.cm-search':{fontSize:'11px',padding:'4px'},'.cm-search label':{display:'inline-flex'},'.cm-search input':{width:'90px'},'.cm-search input[type=checkbox]':{width:'auto'} }, {dark:true}),
  ] }) });
  let previousLexicon=workspaceLexicon(read()),previousPaint='',previousGlyphs=createGlyphPresentation(read());
  function refreshAppearance(){
    if(editor&&!failed){
      const node=locate(read(),origin),text=node&&inherited(node,read()).text;
      const current=fromSource(sliceSource(editor.state));
      if(node&&JSON.stringify(current)!==JSON.stringify(text??{version:1,content:[]})){
        const next=toSource(text??{version:1,content:[]});
        queueMicrotask(()=>{if(!view.root.isConnected||!editor)return;syncing=true;try{editor.dispatch(editor.state.update(sourceRefreshSpec(editor.state,next),{annotations:Transaction.addToHistory.of(false)}));}finally{syncing=false;}});
      }
    }

    if(!locate(read(),origin))return;
    const dictionary=workspaceLexicon(read());if(dictionary!==previousLexicon){previousLexicon=dictionary;queueMicrotask(()=>{if(view.root.isConnected)editor?.dispatch({effects:refreshLexicon.of()});});}
    const glyphs=createGlyphPresentation(read());if(glyphs!==previousGlyphs){previousGlyphs=glyphs;queueMicrotask(()=>{if(view.root.isConnected)editor?.dispatch({effects:refreshDocumentGlyphs.of()});});}
    const paint=readPaint(read(),'nodeText',origin),key=JSON.stringify(paint);if(key===previousPaint)return;previousPaint=key;
    Object.assign(host.style,textStyle(paint));
    host.style.setProperty('--visual-text-bold-stroke',`${emboldenStrokeEm(paint.embolden)}em currentColor`);
    editor?.requestMeasure();
  }
  refreshAppearance();queueMicrotask(()=>{if(view.root.isConnected)editor?.dispatch({effects:refreshLexicon.of()});});editor.focus(); return {...view,refreshAppearance};
}
