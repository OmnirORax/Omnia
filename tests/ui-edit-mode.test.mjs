import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyUILayout} from '../src/ui/layout.ts';
import {residentMovable,residentRigid,rigidityIncluded} from '../src/ui/rigidity.ts';
import {TARGETS} from '../src/appearance/registry.ts';
const functions=[{id:'action',control:false,homePath:['window:panel']},{id:'field',control:true,homePath:['window:panel']}];
const fixture=()=>{const layout=emptyUILayout();layout.panels['@devMode']=false;layout.windows.panel={x:20,y:20,width:300,height:200,collapsed:false,pinned:false};layout.frames=[{id:'group',name:'Group',x:0,y:0,width:200,height:100,cellSize:50,collapsed:false,pinned:false,members:[]}];return layout;};
test('normal mode fixes internal controls while complete frames/windows remain movable',()=>{
 const layout=fixture(),before=JSON.stringify(layout);
 for(const key of ['window:panel','frame:group'])assert.equal(residentMovable(layout,key,functions),true);
 for(const key of ['function:action','function:field'])assert.equal(residentMovable(layout,key,functions),false);
 assert.equal(residentRigid(layout,'window:panel',functions),false);
 assert.equal(rigidityIncluded(layout,TARGETS,'ui.windows',functions),false);
 assert.equal(JSON.stringify(layout),before,'permission reads never persist or migrate data');
});
test('explicit saved policies and pins remain authoritative; edit mode unlocks unpinned controls',()=>{
 const layout=fixture();layout.uiRigidity={all:true};assert.equal(residentMovable(layout,'window:panel',functions),false);
 layout.panels['@devMode']=true;assert.equal(residentMovable(layout,'function:action',functions),true);
 layout.windows.panel.pinned=true;assert.equal(residentMovable(layout,'function:action',functions),false);
 assert.equal(residentMovable(layout,'window:panel',functions),false);
 layout.windows.panel.pinned=false;layout.panels['@devMode']=false;layout.uiRigidity={'ui-rigidity:function:action':false};
 assert.equal(residentMovable(layout,'function:action',functions),true);
 layout.uiRigidity={'ui-rigidity:window:panel':true};assert.equal(residentMovable(layout,'window:panel',functions),false);
});

test('fixed controls cannot arm drag suppression; the nearest owner determines actual drag capability',async()=>{
 const {dragActivationSource}=await import('../src/ui/activationSource.ts');
 const target=(handle,editing=false,resize=false)=>({closest:selector=>selector.startsWith('input')?editing?{}:null:selector.startsWith('[data-ui-resize]')?resize?{}:null:handle});
 assert.equal(dragActivationSource(target({draggable:false})),false,'fixed action/minimize/close remains clickable after pointer drift');
 assert.equal(dragActivationSource(target({draggable:true})),true,'movable frame or explicitly movable action still suppresses its drag tail');
 assert.equal(dragActivationSource(target({draggable:true},true)),false,'text fields retain their native selection');
 assert.equal(dragActivationSource(target(null,false,true)),true,'actual resize gestures retain trailing-click protection');
 assert.equal(dragActivationSource(target(null)),false,'blank UI space cannot invent a drag');
});
