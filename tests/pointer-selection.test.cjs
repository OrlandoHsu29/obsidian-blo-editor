const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor,Node,Range}=require('slate');
const {withHistory}=require('slate-history');
const loaded=new Module('pointer-selection.cjs');
loaded.require=id=>id==='slate-react'?{ReactEditor:{focus(){},toDOMNode:e=>e.host,toDOMPoint:(_e,p)=>[{point:p},p.offset],toSlatePoint:(_e,[n])=>n.point}}:require(id);
loaded._compile(buildSync({stdin:{contents:`export * from './src/blocks/pointer-selection';export {selectLink} from './src/wysimark/anchor-plugin/link-keyboard';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['slate','slate-react'],write:false}).outputFiles[0].text,'pointer-selection.cjs');
const {startPointerSelection,isPointerSelecting,consumePointerSelectionClick,selectLink}=loaded.exports;
function fixture(){
 const e=withHistory(createEditor());e.wysimark={};e.isInline=n=>n.type==='anchor';e.children=[{type:'paragraph',children:[{text:'body'},{type:'anchor',href:'https://example.test',children:[{text:'Title'}]},{text:'after'}]}];
 const listeners=new Map(),classes=new Set();let target={path:[0,1,0],offset:2};
 const doc={defaultView:{addEventListener:(t,f)=>listeners.set('win:'+t,f),removeEventListener:t=>listeners.delete('win:'+t)},documentElement:{classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)}},addEventListener:(t,f)=>listeners.set(t,f),removeEventListener:t=>listeners.delete(t),caretRangeFromPoint:()=>({startContainer:{point:target},startOffset:target.offset}),getSelection:()=>({setBaseAndExtent(){}})};
 const event={currentTarget:{ownerDocument:doc},clientX:30,clientY:20,preventDefault(){this.prevented=true}};e.host={contains:()=>true};
 const cleanup=startPointerSelection(e,{path:[0,0],offset:4},event);selectLink(e,[0,1]);
 return {e,event,cleanup,listeners,classes,setTarget:p=>target=p,dispatch(type,extra={}){const event={buttons:1,clientX:60,clientY:20,preventDefault(){this.prevented=true},stopPropagation(){this.stopped=true},...extra};listeners.get(type)?.(event);return event}};
}
test('an icon click can select the whole link without changing any document content',()=>{
 const f=fixture(),before=structuredClone(f.e.children),selected=structuredClone(f.e.selection);assert(f.event.prevented);f.dispatch('mouseup');assert.deepEqual(f.e.selection,selected);assert.deepEqual(f.e.children,before);assert.equal(f.e.history.undos.length,0);assert.equal(isPointerSelecting(f.e),false);f.cleanup();
});
test('dragging from the icon selects label characters from the stable leading boundary',()=>{
 const f=fixture(),before=structuredClone(f.e.children);f.dispatch('mousemove');assert.deepEqual(f.e.selection,{anchor:{path:[0,0],offset:4},focus:{path:[0,1,0],offset:2}});assert.equal(Editor.string(f.e,f.e.selection),'Ti');
 f.setTarget({path:[0,2],offset:3});f.dispatch('mousemove',{clientX:100});assert.equal(Editor.string(f.e,f.e.selection),'Titleaft');f.dispatch('mouseup');assert.deepEqual(f.e.children,before);assert.equal(f.e.history.undos.length,0);assert.equal(consumePointerSelectionClick(f.e),true);assert.equal(consumePointerSelectionClick(f.e),false);f.cleanup();
});
test('native dragstart is cancelled throughout a selection gesture so Slate cannot copy/drop the link',()=>{
 const f=fixture(),before=structuredClone(f.e.children);const event=f.dispatch('dragstart');assert(event.prevented&&event.stopped);f.dispatch('mousemove');const again=f.dispatch('dragstart');assert(again.prevented&&again.stopped);f.dispatch('mouseup');assert.deepEqual(f.e.children,before);assert.equal(f.e.history.undos.length,0);assert.equal(f.listeners.has('dragstart'),false);f.cleanup();
});
test('click jitter preserves whole-link selection and does not suppress the click',()=>{
 const f=fixture(),selected=structuredClone(f.e.selection);f.dispatch('mousemove',{clientX:31,clientY:20});f.dispatch('mouseup');assert.deepEqual(f.e.selection,selected);assert.equal(consumePointerSelectionClick(f.e),false);f.cleanup();
});
test('blur and unmount release drag protection, visual state and all point references',()=>{
 for(const blur of [false,true]){const f=fixture();f.dispatch('mousemove');assert.equal(Editor.pointRefs(f.e).size,1);assert(f.classes.size);if(blur)f.dispatch('win:blur');else f.cleanup();assert.equal(f.listeners.size,0);assert.equal(f.classes.size,0);assert.equal(Editor.pointRefs(f.e).size,0);assert.equal(isPointerSelecting(f.e),false);assert.equal(Range.isExpanded(f.e.selection),true);assert.equal(Node.string(f.e),'bodyTitleafter');f.cleanup()}
});
