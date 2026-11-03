import { useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent } from 'react';
import type { Entity } from '../graph/structural';
import { RENDER_BUDGET } from '../renderBudget';
import { omnicBudgetAsset } from '../omnic/presentation';
import { evaluateRecipe } from '../omnic/evaluate';
import { objectResolver } from '../omnic/revisions';
import { renderSVG } from '../omnic/svg';
import { compileLexicon, validateNodeText, type NodeText } from './model';
import { escapeHTML, readTextDOM, textHTML, TEXT_CLIPBOARD } from './dom';
import './document.css';

type Props = {
  entity: Entity;
  entities: Entity[];
  saveStatus: string;
  onSave: (entityId: string, value: NodeText) => boolean;
  onClose: () => void;
  onLibrary: () => void;
};
const empty: NodeText = { version: 1, content: [] };
/** Browser owns the live editing DOM/caret/native undo. Committed workspace changes
 * are batched, never a React/Three.js update for each typed character. */
export function NodeDocument(props: Props) {
  const editor = useRef<HTMLDivElement>(null), latest = useRef(props); latest.current = props;
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const committed = useRef(JSON.stringify(props.entity.text ?? empty));
  const [status, setStatus] = useState('Saved'), [error, setError] = useState('');
  const previousObjects = useRef<Entity[]>([]);
  const glyphObjects = useMemo(() => {
    const next = props.entities.filter(e => e.omnic), previous = previousObjects.current;
    if (next.length === previous.length && next.every((e, i) => e.id === previous[i].id && e.label === previous[i].label && e.omnic === previous[i].omnic && e.omnicHistory === previous[i].omnicHistory && e.lexiconWords === previous[i].lexiconWords)) return previous;
    previousObjects.current = next; return next;
  }, [props.entities]);
  const objects = useMemo(() => new Map(glyphObjects.map(e => [e.id, e])), [glyphObjects]);
  const annotate = useMemo(() => compileLexicon(glyphObjects), [glyphObjects]);
  const resolve = useMemo(() => objectResolver(glyphObjects), [glyphObjects]);
  const rendering = useMemo(() => ({ cache: new Map<string, string>(), urls: new Set<string>(), primitives: 0 }), [resolve]);
  const renderCache = rendering.cache;
  useLayoutEffect(() => () => {
    for (const url of rendering.urls) URL.revokeObjectURL(url);
    rendering.urls.clear(); rendering.cache.clear(); rendering.primitives = 0;
  }, [rendering]);
  const glyphHTML = (id: string) => {
    let html = renderCache.get(id);
    if (html !== undefined) return html;
    const object = objects.get(id);
    if (!object?.omnic) throw Error('Missing Omnic object.');
    let src = omnicBudgetAsset.dataUrl;
    try {
      const evaluation = evaluateRecipe(object.omnic, resolve);
      if (rendering.primitives + evaluation.nodes.length <= RENDER_BUDGET.omnicTextPrimitives) {
        rendering.primitives += evaluation.nodes.length;
        src = URL.createObjectURL(new Blob([renderSVG(evaluation)], { type: 'image/svg+xml' }));
        rendering.urls.add(src);
      }
    } catch { /* Keep the reference editable when a structure exceeds evaluator limits. */ }
    html = `<span contenteditable="false" data-node-glyph="${escapeHTML(id)}" title="${escapeHTML(object.label)}"><img data-node-glyph="${escapeHTML(id)}" draggable="false" alt="${escapeHTML(object.label)}" loading="lazy" src="${escapeHTML(src)}"></span>`;
    renderCache.set(id, html); return html;
  };
  const save = (root = editor.current) => {
    clearTimeout(pending.current);
    if (!root) return true;
    try {
      const value = readTextDOM(root);
      validateNodeText(value, new Set(objects.keys()));
      const json = JSON.stringify(value);
      if (json === committed.current) return true;
      if (!latest.current.onSave(latest.current.entity.id, value)) throw Error('Document could not be saved. Keep this document open. Copy the unsaved contents elsewhere or reduce them.');
      committed.current = json; setStatus('Saved'); setError(''); return true;
    } catch (e) { setStatus('Unsaved'); setError(e instanceof Error ? e.message : String(e)); return false; }
  };
  const saveRef = useRef(save); saveRef.current = save;
  const changed = () => {
    setStatus('Editing…'); clearTimeout(pending.current);
    pending.current = setTimeout(() => saveRef.current(), 700);
  };
  const copy = (event: ClipboardEvent<HTMLDivElement>) => {
    const selection = window.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) return false;
    const value = readTextDOM(selection.getRangeAt(0).cloneContents());
    event.preventDefault(); event.clipboardData.setData(TEXT_CLIPBOARD, JSON.stringify(value));
    event.clipboardData.setData('text/plain', value.content.map(part => typeof part === 'string' ? part : `[${objects.get(part.glyph)?.label || 'Omnic'}]`).join(''));
    return true;
  };
  useLayoutEffect(() => {
    const value = props.entity.text ?? empty, json = JSON.stringify(value);
    if (editor.current && (editor.current.dataset.initialized !== 'true' || json !== committed.current)) {
      editor.current.innerHTML = textHTML(value, glyphHTML);
      editor.current.dataset.initialized = 'true'; committed.current = json;
    }
  }, [props.entity.text]);
  useLayoutEffect(() => {
    // Refresh existing glyph images only when their saved object actually changes.
    for (const span of editor.current?.querySelectorAll<HTMLElement>('span[data-node-glyph]') ?? []) {
      const object = objects.get(span.dataset.nodeGlyph!);
      if (object?.omnic) {
        const template = document.createElement('template'); template.innerHTML = glyphHTML(object.id);
        const image = span.querySelector('img'), next = template.content.querySelector('img');
        if (image && next && image.getAttribute('src') !== next.getAttribute('src')) image.src = next.src;
      }
    }
  }, [objects, renderCache]); // Editing never replaces the live DOM.
  useLayoutEffect(() => {
    const root = editor.current;
    const flush = () => saveRef.current(root);
    const visibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush); document.addEventListener('visibilitychange', visibility);
    return () => { flush(); clearTimeout(pending.current); window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  return <section className="node-document" aria-label={`Document: ${props.entity.label || 'Untitled'}`} data-ui-gesture-owner="content"
    onPointerDown={event => event.stopPropagation()} onWheel={event => event.stopPropagation()} onContextMenu={event => event.stopPropagation()}>
    <header><strong>{props.entity.label || 'Untitled'}</strong><small role="status">{status === "Saved" ? props.saveStatus : status}</small>
      <button data-ui-id="node-document-lexicon" title="Omnic library: select an object and set its English variants" onClick={props.onLibrary}>Lexicon</button>
      <button data-ui-id="node-document-close" aria-label="Close node document" onClick={() => { if (save()) props.onClose(); }}>×</button></header>
    {error && <div role="alert">{error}</div>}
    <div ref={editor} className="node-document-content" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="Node document"
      spellCheck data-placeholder="Type or paste text…" onInput={changed} onBlur={() => save()}
      onPaste={event => {
        event.preventDefault();
        try {
          const internal = event.clipboardData.getData(TEXT_CLIPBOARD);
          const value: NodeText = internal ? JSON.parse(internal) : annotate(event.clipboardData.getData('text/plain'));
          validateNodeText(value, new Set(objects.keys()));
          // Validate the replacement before touching the browser's native undo stack.
          const selection = window.getSelection(), range = selection?.rangeCount ? selection.getRangeAt(0) : null;
          if (!range || !editor.current?.contains(range.commonAncestorContainer)) return;
          const beforeRange = document.createRange(); beforeRange.selectNodeContents(editor.current); beforeRange.setEnd(range.startContainer, range.startOffset);
          const afterRange = document.createRange(); afterRange.selectNodeContents(editor.current); afterRange.setStart(range.endContainer, range.endOffset);
          validateNodeText({ version: 1, content: [...readTextDOM(beforeRange.cloneContents()).content, ...value.content, ...readTextDOM(afterRange.cloneContents()).content] }, new Set(objects.keys()));
          document.execCommand('insertHTML', false, textHTML(value, glyphHTML)); changed(); setError('');
        } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
      }}
      onCopy={copy} onCut={event => { if (copy(event)) { document.execCommand('delete'); changed(); } }}
      onDrop={event => { event.preventDefault(); setError('Use copy and paste to move text or glyphs.'); }} />
  </section>;
}
