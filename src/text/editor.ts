import { panel } from '../ui/panel.ts';
import { documentCommand } from './editing.ts';
import { escapeHTML, readTextDOM, textHTML, TEXT_CLIPBOARD } from './dom.ts';
import { formatMarkdownAtCaret } from './live.ts';
import { validateNodeText, type NodeText } from './model.ts';
import type { Origin, World } from '../core/model.ts';
import { inherited } from '../core/lattice.ts';
import { locate } from '../core/model.ts';

export function editDocument(origin: Origin, read: () => World, commit: (text: NodeText) => void, feedback: (message: string) => void, closed?: () => void) {
  const current = locate(read(), origin); if (!current) return;
  let failed = false;
  const actual = inherited(current, read()), view = panel(actual.label || 'Document', () => { if (failed) { save(); if (failed && !confirm('These document changes could not be saved. Close and discard them?')) return false; } closed?.(); });
  const toolbar = document.createElement('div'), editor = document.createElement('div'); toolbar.className = 'document-tools'; editor.className = 'document-content';
  editor.contentEditable = 'true'; editor.spellcheck = true; editor.setAttribute('role', 'textbox'); editor.setAttribute('aria-label', 'Node document'); editor.setAttribute('aria-multiline', 'true');
  const glyph = (id: string) => {
    const node = read().nodes.find(n => JSON.stringify(n.origin) === id);
    const asset = read().assets?.find(a => a.id === node?.visual?.assetId);
    return `<span contenteditable="false" data-node-glyph="${escapeHTML(id)}">${asset?.kind === 'image' ? `<img alt="${escapeHTML(node?.label || 'Glyph')}" src="${escapeHTML(asset.dataUrl)}">` : escapeHTML(node?.visual?.character || node?.label || '•')}</span>`;
  };
  editor.innerHTML = textHTML(actual.text ?? { version: 1, content: [] }, glyph);
  function save() {
    try {
      const text = readTextDOM(editor); validateNodeText(text, new Set(read().nodes.map(n => JSON.stringify(n.origin)))); commit(text); failed = false;
    } catch (error) { failed = true; feedback(error instanceof Error ? error.message : String(error)); }
  }
  for (const [label, command] of [['B','bold'],['I','italic'],['1.','insertOrderedList'],['•','insertUnorderedList'],['→','indent'],['←','outdent']]) {
    const button = document.createElement('button'); button.textContent = label; button.title = command; button.onpointerdown = event => event.preventDefault(); button.onclick = () => { documentCommand(editor, command); save(); }; toolbar.append(button);
  }
  editor.oninput = () => { formatMarkdownAtCaret(editor, glyph); save(); };
  editor.onpaste = event => {
    event.preventDefault();
    const rich = event.clipboardData?.getData(TEXT_CLIPBOARD), plain = event.clipboardData?.getData('text/plain') ?? '';
    try {
      if (rich) { const text = JSON.parse(rich); validateNodeText(text, new Set(read().nodes.map(n => JSON.stringify(n.origin)))); document.execCommand('insertHTML', false, textHTML(text, glyph)); }
      else document.execCommand('insertText', false, plain);
      save();
    } catch { document.execCommand('insertText', false, plain); save(); }
  };
  editor.oncopy = event => {
    const selection = window.getSelection(); if (!selection?.rangeCount || !editor.contains(selection.anchorNode)) return;
    const fragment = document.createElement('div'); fragment.append(selection.getRangeAt(0).cloneContents());
    event.clipboardData?.setData(TEXT_CLIPBOARD, JSON.stringify(readTextDOM(fragment))); event.clipboardData?.setData('text/plain', selection.toString()); event.preventDefault();
  };
  editor.onkeydown = event => {
    if (event.key === 'Escape') view.close();
    if ((event.ctrlKey || event.metaKey) && ['b','i'].includes(event.key.toLowerCase())) { event.preventDefault(); documentCommand(editor, event.key.toLowerCase() === 'b' ? 'bold' : 'italic'); save(); }
    event.stopPropagation();
  };
  view.body.append(toolbar, editor); editor.focus(); return view;
}
