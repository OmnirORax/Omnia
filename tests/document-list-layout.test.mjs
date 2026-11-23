import test from 'node:test';
import assert from 'node:assert/strict';
import {EditorState} from '@codemirror/state';
import {markdown} from '@codemirror/lang-markdown';
import {ensureSyntaxTree} from '@codemirror/language';
import {documentListLayout} from '../src/text/listLayout.ts';
function editor(doc,widths,scale=1){
 let state=EditorState.create({doc,extensions:[markdown()]});ensureSyntaxTree(state,doc.length,1000);
 let pending,plugin,reads=0,measuring=false;const view={get state(){return state;},visibleRanges:[{from:0,to:doc.length}],defaultCharacterWidth:8,scaleX:scale,
  requestMeasure:request=>{pending=request;},
  coordsAtPos(pos){reads++;const line=state.doc.lineAt(pos),text=state.sliceDoc(line.from,pos);return {left:100+scale*(widths.get(text)??0),top:20*line.number};},
  dispatch(spec){assert.equal(measuring,false,'never dispatch inside native measurement phase');const old=state,tr=state.update(spec);state=tr.state;plugin.update({view:this,state,startState:old,transactions:[tr],docChanged:tr.docChanged,viewportChanged:false,geometryChanged:false});},
 };
 plugin=documentListLayout.create(view);
 return {async measure(){const request=pending;pending=undefined;measuring=true;request.write(request.read(view),view);measuring=false;await Promise.resolve();},styles(){const styles=[];plugin.decorations.between(0,state.doc.length,(from,to,d)=>styles.push([state.doc.lineAt(from).number,d.spec.attributes.style]));return styles;},get state(){return state;},typeAt(pos,text){view.visibleRanges=[{from:0,to:state.doc.length+text.length}];view.dispatch({changes:{from:pos,insert:text},selection:{anchor:pos+text.length}});},get reads(){return reads;},geometry(width=8){view.defaultCharacterWidth=width;plugin.update({view,state,startState:state,transactions:[],docChanged:false,viewportChanged:false,geometryChanged:true});}};
}
test('wrapped text uses fractional rendered prefix width, not character-count estimates',async()=>{
 const view=editor('  - Unknown? long item',new Map([['  - ',17.375],['  ',5.25]]));
 await view.measure();assert.deepEqual(view.styles(),[[1,'padding-left:calc(6px + 17.375px);text-indent:-17.375px']]);
 assert.equal(view.state.doc.toString(),'  - Unknown? long item');
});
test('native screen coordinates are converted to CSS pixels when the editor is scaled',async()=>{
 const view=editor('  • long item',new Map([['  • ',21.125],['  ',5.25]]),1.5);
 await view.measure();assert.deepEqual(view.styles(),[[1,'padding-left:calc(6px + 21.125px);text-indent:-21.125px']]);
});
test('nested bullets align soft wraps without indenting separate physical rows',async()=>{
 const view=editor('- parent\n  - child\nlazy continuation\n    indented continuation',new Map([['- ',9.5],['  - ',17.375],['  ',5.25],['    ',10.5]]));
 await view.measure();assert.deepEqual(view.styles(),[[1,'padding-left:calc(6px + 9.5px);text-indent:-9.5px'],[2,'padding-left:calc(6px + 17.375px);text-indent:-17.375px']]);
});

test('geometry refreshes reuse cached prefix widths and font metric changes remeasure them',async()=>{
 const widths=new Map([['- ',9.5]]),view=editor('- item',widths);
 await view.measure();const reads=view.reads;view.geometry();await view.measure();assert.equal(view.reads,reads);
 widths.set('- ',12.75);view.geometry(9);await view.measure();assert.ok(view.reads>reads);
 assert.deepEqual(view.styles(),[[1,'padding-left:calc(6px + 12.75px);text-indent:-12.75px']]);
});

test('typing a new row after a bullet does not give it continuation indentation or move its caret',async()=>{
 const doc='- Interact & communicate\n',view=editor(doc,new Map([['- ',9.5]]));
 await view.measure();view.typeAt(doc.length,'asdf');await view.measure();
 assert.equal(view.state.doc.toString(),doc+'asdf');assert.equal(view.state.selection.main.head,doc.length+4);
 assert.deepEqual(view.styles(),[[1,'padding-left:calc(6px + 9.5px);text-indent:-9.5px']]);
});
