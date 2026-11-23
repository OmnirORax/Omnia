import {StateEffect} from '@codemirror/state';
import {createGlyphPresentation} from '../omnic/presentation.ts';
export const refreshDocumentGlyphs=StateEffect.define<void>();
const formattingMarker=/^(EmphasisMark|StrikethroughMark|HeaderMark|CodeMark)$/;
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { glyphField,glyphIndexAt } from './source.ts';
import type { TextPart } from './model.ts';
import type { World,Structure } from '../core/model.ts';

class GlyphWidget extends WidgetType {
  readonly part:Exclude<TextPart,string>;readonly node:Structure|undefined;readonly asset:import('../graph/assets.ts').VisualAsset|undefined;readonly glyphs:ReturnType<typeof createGlyphPresentation>;
  constructor(part:Exclude<TextPart,string>,node:Structure|undefined,asset:import('../graph/assets.ts').VisualAsset|undefined,glyphs:ReturnType<typeof createGlyphPresentation>){super();this.part=part;this.node=node;this.asset=asset;this.glyphs=glyphs;}
  eq(other: GlyphWidget) { return this.part.glyph === other.part.glyph && this.part.word === other.part.word && this.glyphs===other.glyphs&&this.node?.label===other.node?.label&&this.node?.visual?.character===other.node?.visual?.character&&this.asset?.kind===other.asset?.kind&&this.asset?.dataUrl===other.asset?.dataUrl; }
  toDOM() {
    const {node,asset}=this;
    const span = document.createElement('span'); span.className = 'document-glyph'; span.setAttribute('aria-label', node?.label || 'Glyph');
    if (asset?.kind === 'image') { const image = document.createElement('img'); image.src = asset.dataUrl; image.alt = node?.label || 'Glyph'; span.append(image); }
    else span.textContent = node?.visual?.character || node?.label || '•';
    return span;
  }
}
export function documentPresentation(read: () => World) {
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet;
    world:World|undefined;nodes=new Map<string,Structure>();assets=new Map<string,import('../graph/assets.ts').VisualAsset>();
    constructor(view: EditorView) { this.decorations = this.build(view); }
    update(update: import('@codemirror/view').ViewUpdate) {
      if (update.transactions.some(tr=>tr.effects.some(effect=>effect.is(refreshDocumentGlyphs))) || update.docChanged || update.selectionSet || update.viewportChanged || syntaxTree(update.startState) !== syntaxTree(update.state)) this.decorations = this.build(update.view);
    }
    build(view: EditorView) {
      const world=read();if(world!==this.world){this.world=undefined;this.nodes.clear();this.assets.clear();}
      let glyphs:ReturnType<typeof createGlyphPresentation>|undefined;
      const allGlyphs=view.state.field(glyphField),tree=syntaxTree(view.state),selectedLines=view.state.selection.ranges.map(r=>({from:view.state.doc.lineAt(r.from).from,to:view.state.doc.lineAt(r.to).to}));
      const ranges: import('@codemirror/state').Range<Decoration>[] = [];
      for (const visible of view.visibleRanges) {
        tree.iterate({ from: visible.from, to: visible.to, enter: node => {
          if(!formattingMarker.test(node.name)||node.to<=node.from)return;
          const active=selectedLines.some(r=>r.from<=node.to&&r.to>=node.from);
          if (!active) {
            let to=node.to;
            // The separator belongs to an opening heading marker, not its visible text.
            if(node.name==='HeaderMark'&&node.from===view.state.doc.lineAt(node.from).from){
              const line=view.state.doc.lineAt(node.from);
              to+=/^[ \t]*/.exec(view.state.sliceDoc(to,line.to))![0].length;
            }
            ranges.push(Decoration.replace({}).range(node.from,to));
          }
        } });
        for(let i=glyphIndexAt(allGlyphs,visible.from);i<allGlyphs.length&&allGlyphs[i].at<visible.to;i++){
          if(this.world!==world){this.world=world;this.nodes=new Map(world.nodes.map(node=>[JSON.stringify(node.origin),node]));this.assets=new Map((world.assets??[]).map(asset=>[asset.id,asset]));}
          glyphs??=createGlyphPresentation(world);
          const glyph=allGlyphs[i],node=this.nodes.get(glyph.part.glyph),asset=(node&&glyphs(node)?.asset)??(node?.visual?.assetId?this.assets.get(node.visual.assetId):undefined);
          ranges.push(Decoration.replace({ widget: new GlyphWidget(glyph.part,node,asset,glyphs) }).range(glyph.at,glyph.at+1));
        }
      }
      return Decoration.set(ranges, true);
    }
  }, { decorations: value => value.decorations });
}
