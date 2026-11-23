import {StateEffect,countColumn} from '@codemirror/state';
import {createGlyphPresentation} from '../omnic/presentation.ts';
export const refreshDocumentGlyphs=StateEffect.define<void>();
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { glyphField } from './source.ts';
import type { TextPart } from './model.ts';
import type { World } from '../core/model.ts';

class GlyphWidget extends WidgetType {
  constructor(readonly part: Exclude<TextPart,string>, readonly read: () => World,readonly glyphs:ReturnType<typeof createGlyphPresentation>) { super(); }
  eq(other: GlyphWidget) { return this.part.glyph === other.part.glyph && this.part.word === other.part.word && this.glyphs===other.glyphs; }
  toDOM() {
    const world = this.read(), node = world.nodes.find(n => JSON.stringify(n.origin) === this.part.glyph), asset = (node&&this.glyphs(node)?.asset)??world.assets?.find(a => a.id === node?.visual?.assetId);
    const span = document.createElement('span'); span.className = 'document-glyph'; span.setAttribute('aria-label', node?.label || 'Glyph');
    if (asset?.kind === 'image') { const image = document.createElement('img'); image.src = asset.dataUrl; image.alt = node?.label || 'Glyph'; span.append(image); }
    else span.textContent = node?.visual?.character || node?.label || '•';
    return span;
  }
}
export function documentPresentation(read: () => World) {
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet;
    constructor(view: EditorView) { this.decorations = this.build(view); }
    update(update: import('@codemirror/view').ViewUpdate) {
      if (update.transactions.some(tr=>tr.effects.some(effect=>effect.is(refreshDocumentGlyphs))) || update.docChanged || update.selectionSet || update.viewportChanged || syntaxTree(update.startState) !== syntaxTree(update.state)) this.decorations = this.build(update.view);
    }
    build(view: EditorView) {
      const glyphs=createGlyphPresentation(read());
      const ranges: import('@codemirror/state').Range<Decoration>[] = [],listLines=new Set<number>();
      for (const visible of view.visibleRanges) {
        const tree=syntaxTree(view.state);
        for(let pos=view.state.doc.lineAt(visible.from).from;pos<=visible.to;){
          const line=view.state.doc.lineAt(pos);pos=line.to+1;
          if(listLines.has(line.from))continue;listLines.add(line.from);
          const leading=/^[ \t]*/.exec(line.text)![0];
          let item=tree.resolveInner(line.from+leading.length,1);
          while(item&&item.name!=='ListItem')item=item.parent!;
          const marker=item?.getChild('ListMark');
          if(!marker)continue;
          const first=view.state.doc.lineAt(marker.from);
          const separator=/^[ \t]+(?:\[[ xX]\][ \t]+)?/.exec(view.state.sliceDoc(marker.to,first.to))?.[0]??'';
          const itemColumns=countColumn(view.state.sliceDoc(first.from,marker.to)+separator,view.state.tabSize);
          const leadingColumns=countColumn(leading,view.state.tabSize);
          const columns=line.from===first.from?itemColumns:Math.max(itemColumns,leadingColumns);
          // Explicit continuation lines may omit indentation in Markdown. They
          // inherit the owning item's text column just like soft-wrapped rows.
          const firstOffset=line.from===first.from?columns:leadingColumns;
          ranges.push(Decoration.line({attributes:{style:`padding-left:calc(2px + ${columns}ch);text-indent:-${firstOffset}ch`}}).range(line.from));
        }
        tree.iterate({ from: visible.from, to: visible.to, enter: node => {
          const active = view.state.selection.ranges.some(r => view.state.doc.lineAt(r.from).from <= node.to && view.state.doc.lineAt(r.to).to >= node.from);
          if (!active && /^(EmphasisMark|StrikethroughMark|HeaderMark|CodeMark)$/.test(node.name) && node.to > node.from) {
            let to=node.to;
            // The separator belongs to an opening heading marker, not its visible text.
            if(node.name==='HeaderMark'&&node.from===view.state.doc.lineAt(node.from).from){
              const line=view.state.doc.lineAt(node.from);
              to+=/^[ \t]*/.exec(view.state.sliceDoc(to,line.to))![0].length;
            }
            ranges.push(Decoration.replace({}).range(node.from,to));
          }
        } });
        for (const glyph of view.state.field(glyphField)) {
          if (glyph.at < visible.from) continue; if (glyph.at >= visible.to) break;
          ranges.push(Decoration.replace({ widget: new GlyphWidget(glyph.part, read,glyphs) }).range(glyph.at, glyph.at+1));
        }
      }
      return Decoration.set(ranges, true);
    }
  }, { decorations: value => value.decorations });
}
