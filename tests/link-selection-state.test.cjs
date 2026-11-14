const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor,Transforms,Range}=require('slate');
const loaded=new Module('link-selection-state.cjs');
loaded.require=id=>require(id);
loaded._compile(buildSync({entryPoints:['src/wysimark/anchor-plugin/render-element/use-link-selection.ts'],bundle:true,platform:'node',format:'cjs',external:['react','slate','slate-react'],write:false}).outputFiles[0].text,'link-selection-state.cjs');
const {linkSelectionState}=loaded.exports;
const paragraph=()=>({type:'paragraph',children:[{text:'before'},{type:'anchor',href:'https://example.test',children:[{text:'Title'}]},{text:'after'}]});
function fixture(count=1){const e=createEditor();e.isInline=n=>n.type==='anchor';e.children=Array.from({length:count},paragraph);return e}
test('a thousand links share one precise-selection check and untouched links skip their text ranges',()=>{
 const e=fixture(1000);Transforms.select(e,{anchor:{path:[0,0],offset:6},focus:{path:[0,1,0],offset:2}});
 const above=Editor.above,range=Editor.range;let aboveCalls=0,rangeCalls=0;
 Editor.above=(...args)=>{aboveCalls++;return above(...args)};Editor.range=(...args)=>{rangeCalls++;return range(...args)};
 try{
  const states=e.children.map((_,i)=>linkSelectionState(e,[i,1]));
  assert.equal(aboveCalls,2);assert.equal(rangeCalls,1);
  assert.equal(states[0].icon,true);assert.equal(states[0].full,false);assert.equal(states[0].precise,false);
  assert(states.slice(1).every(s=>!s.icon&&!s.full&&s.text===null));
 }finally{Editor.above=above;Editor.range=range}
});
test('selection and document changes invalidate the shared cache, while repeated reads reuse it',()=>{
 const e=fixture();Transforms.select(e,{anchor:{path:[0,0],offset:6},focus:{path:[0,2],offset:0}});
 assert.equal(linkSelectionState(e,[0,1]).precise,true);
 Transforms.select(e,{anchor:{path:[0,1,0],offset:0},focus:{path:[0,1,0],offset:2}});
 assert.equal(linkSelectionState(e,[0,1]).precise,false);
 const above=Editor.above;let calls=0;Editor.above=(...args)=>{calls++;return above(...args)};
 try{linkSelectionState(e,[0,1]);assert.equal(calls,0);e.children=[...e.children];linkSelectionState(e,[0,1]);assert.equal(calls,2)}
 finally{Editor.above=above}
});
test('collapsed and label-only selections preserve their existing icon and dialog semantics',()=>{
 const e=fixture();Transforms.select(e,{path:[0,1,0],offset:2});
 assert.deepEqual(linkSelectionState(e),{full:false,icon:false,text:null,start:null,expanded:false,precise:true});
 for(const backward of [false,true]){
  const range={anchor:{path:[0,1,0],offset:0},focus:{path:[0,1,0],offset:5}};
  Transforms.select(e,backward?{anchor:range.focus,focus:range.anchor}:range);
  const state=linkSelectionState(e,[0,1]);assert.equal(state.icon,false);assert.equal(state.full,false);assert.equal(state.precise,false);assert(Range.equals(state.text,range));
 }
});
test('rectangular cell ranges still use precise presentation for their own cell',()=>{
 const e=fixture();e.children=[{type:'table',children:[{type:'table-row',children:[{type:'table-cell',children:[paragraph()]}]}]}];
 Transforms.select(e,Editor.range(e,[0,0,0]));const state=linkSelectionState(e,[0,0,0,0,1]);assert.equal(state.precise,true);assert.equal(state.full,true);
});
test('the combined subscription accepts Slate initial null snapshots',()=>{
 const e=fixture();const hook=new Module('link-selection-hook.cjs');
 hook.require=id=>id==='react'?{useCallback:fn=>fn}:id==='slate-react'?{ReactEditor:{findPath:()=>[0,1]},useSlateSelector:(read,equal)=>{const state=read(e);assert.equal(equal(null,state),false);assert.equal(equal(state,state),true);return state}}:require(id);
 hook._compile(buildSync({entryPoints:['src/wysimark/anchor-plugin/render-element/use-link-selection.ts'],bundle:true,platform:'node',format:'cjs',external:['react','slate','slate-react'],write:false}).outputFiles[0].text,'link-selection-hook.cjs');
 assert.equal(hook.exports.useLinkSelection(e.children[0].children[1]).expanded,false);
});
