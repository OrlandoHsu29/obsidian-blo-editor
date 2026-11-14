const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor,Transforms}=require('slate');
const loaded=new Module('link-pointer.cjs');
const reactEditor={
 toSlatePoint:(_e,[node])=>node.point,
 toSlateRange:(_e,selection)=>selection.range,
 toSlateNode:e=>e.children[0].children[1],findPath:()=>[0,1],
 toDOMPoint:(_e,point)=>[{point},point.offset],
};
loaded.require=id=>id==='slate-react'?{ReactEditor:reactEditor}:require(id);
loaded._compile(buildSync({entryPoints:['src/wysimark/anchor-plugin/pointer-selection.ts'],bundle:true,platform:'node',format:'cjs',external:['slate','slate-react'],write:false}).outputFiles[0].text,'link-pointer.cjs');
const {trackLinkIconSelection}=loaded.exports;
function fixture(){
 const e=createEditor();e.wysimark={readOnly:false};e.isInline=n=>n.type==='anchor';e.children=[{type:'paragraph',children:[{text:'body'},{type:'anchor',href:'https://example.test',children:[{text:'Title'}]},{text:'after'}]}];
 const anchor={path:[0,1,0],offset:5},focus={path:[0,1,0],offset:0};Transforms.select(e,{anchor,focus});
 let writes=0,next=0;const listeners=new Map(),frames=new Map();
 const listen=(target,type,fn,capture)=>listeners.set(target+type,{fn,capture}),remove=(target,type)=>listeners.delete(target+type);
 const win={getComputedStyle:()=>({fontSize:'20px',lineHeight:'33px'}),addEventListener:(t,f)=>listen('win:',t,f),removeEventListener:t=>remove('win:',t),requestAnimationFrame:fn=>{frames.set(++next,fn);return next},cancelAnimationFrame:id=>frames.delete(id)};
 const selection={anchorNode:{point:anchor},anchorOffset:5,range:{anchor,focus},setBaseAndExtent(a,_a,f,_f){writes++;this.anchorNode=a;this.focusNode=f;this.range={anchor:a.point,focus:f.point}}};
 const link={getClientRects:()=>[{left:6,right:100,top:8,bottom:32,height:24}],querySelector:selector=>selector==='.wysimark-link-icon'?{getBoundingClientRect:()=>({left:10,right:30,width:20,height:20,top:10,bottom:30})}:{getClientRects:()=>[{left:36,right:100}]}};
 let hit=true,previousLine;
 const doc={defaultView:win,addEventListener:(t,f,c)=>listen('doc:',t,f,c),removeEventListener:t=>remove('doc:',t),getSelection:()=>selection,elementFromPoint:()=>({closest:()=>hit?link:null}),caretRangeFromPoint:()=>previousLine?{getBoundingClientRect:()=>previousLine}:null,createRange:()=>({setStart(){},collapse(){},getBoundingClientRect:()=>({left:4,top:10,bottom:30,height:20})})};
 const host={ownerDocument:doc,contains:()=>true};
 const event={currentTarget:host,button:0,detail:1,clientX:80,clientY:20};
 return {e,event,selection,listeners,frames,missIcon(){hit=false},pointToPreviousLine(){previousLine={top:-22,bottom:0,height:22}},pointToNextLine(){previousLine={top:40,bottom:62,height:22}},get writes(){return writes},dispatch(type,extra={}){listeners.get('doc:'+type)?.fn({buttons:1,clientX:20,clientY:20,...extra})},blur(){listeners.get('win:blur')?.fn()},paint(){for(const [id,fn]of frames){frames.delete(id);fn()}}};
}
test('mousemove waits for native selection; selectionchange normalizes before Slate without a feedback loop',()=>{
 const f=fixture(),cleanup=trackLinkIconSelection(f.e,f.event);
 assert.equal(f.listeners.get('doc:selectionchange').capture,true);
 f.dispatch('mousemove');assert.equal(f.writes,0,'must not compete with native mousemove selection');
 f.dispatch('selectionchange');assert.equal(f.writes,1);assert.deepEqual(f.e.selection.focus,{path:[0,0],offset:4});
 f.dispatch('selectionchange');f.paint();assert.equal(f.writes,1,'canonical selection must not be rewritten');cleanup();
});
test('crossing the threshold stays selected through the glyph and its leading margin',()=>{
 const f=fixture(),cleanup=trackLinkIconSelection(f.e,f.event);
 for(const x of [23,22,21,20,19,15,11,9,7,5]){
  f.selection.range={anchor:f.selection.range.anchor,focus:{path:[0,1,0],offset:0}};
  f.dispatch('mousemove',{clientX:x});f.dispatch('selectionchange');f.paint();
  assert.deepEqual(f.e.selection.focus,{path:[0,0],offset:4});
 }
 cleanup();
});
test('label positions remain native and never expand selection to the icon',()=>{
 const f=fixture(),cleanup=trackLinkIconSelection(f.e,f.event);
 f.dispatch('mousemove',{clientX:37});f.dispatch('selectionchange');f.paint();assert.equal(f.writes,0);assert.deepEqual(f.e.selection.focus,{path:[0,1,0],offset:0});cleanup();
});
test('leaving the icon hit target to its left does not discard the selected icon',()=>{
 const f=fixture(),cleanup=trackLinkIconSelection(f.e,f.event);f.dispatch('mousemove');f.dispatch('selectionchange');
 f.missIcon();const range={anchor:f.e.selection.anchor,focus:{path:[0,1,0],offset:0}};
 Transforms.select(f.e,range);f.selection.range=range;f.dispatch('mousemove',{clientX:5});f.dispatch('selectionchange');f.paint();
 assert.deepEqual(f.e.selection.focus,{path:[0,0],offset:4});cleanup();
});
test('moving back across the right-third threshold deselects the icon while preserving label selection',()=>{
 const f=fixture(),cleanup=trackLinkIconSelection(f.e,f.event);f.dispatch('mousemove');f.dispatch('selectionchange');
 f.dispatch('mousemove',{clientX:24});f.dispatch('selectionchange');f.paint();assert.deepEqual(f.e.selection.focus,{path:[0,1,0],offset:0});
 f.dispatch('mousemove',{clientX:23});f.dispatch('selectionchange');f.paint();assert.deepEqual(f.e.selection.focus,{path:[0,0],offset:4});cleanup();
});
test('the upper line leading retains icon selection even outside the painted glyph and hit target',()=>{
 const f=fixture(),cleanup=trackLinkIconSelection(f.e,f.event);f.dispatch('mousemove');f.dispatch('selectionchange');f.missIcon();
 for(const y of [9,7,3,0,-4]){
  const range={anchor:f.e.selection.anchor,focus:{path:[0,1,0],offset:0}};Transforms.select(f.e,range);f.selection.range=range;
  f.dispatch('mousemove',{clientY:y});f.dispatch('selectionchange');f.paint();assert.deepEqual(f.e.selection.focus,{path:[0,0],offset:4});
 }
 cleanup();
});
test('actually entering the preceding text line leaves selection to native line navigation',()=>{
 const f=fixture(),cleanup=trackLinkIconSelection(f.e,f.event);f.pointToPreviousLine();f.dispatch('mousemove',{clientY:-2});f.dispatch('selectionchange');f.paint();assert.equal(f.writes,0);cleanup();
});
test('the lower leading has the same generous selection extent as the upper leading',()=>{
 const f=fixture(),cleanup=trackLinkIconSelection(f.e,f.event);f.dispatch('mousemove');f.dispatch('selectionchange');f.missIcon();
 for(const y of [31,33,38,42,44]){
  const range={anchor:f.e.selection.anchor,focus:{path:[0,1,0],offset:0}};Transforms.select(f.e,range);f.selection.range=range;
  f.dispatch('mousemove',{clientY:y});f.dispatch('selectionchange');f.paint();assert.deepEqual(f.e.selection.focus,{path:[0,0],offset:4});
 }
 cleanup();
});
test('actually entering the following text line leaves selection to native line navigation',()=>{
 const f=fixture(),cleanup=trackLinkIconSelection(f.e,f.event);f.pointToNextLine();f.dispatch('mousemove',{clientY:42});f.dispatch('selectionchange');f.paint();assert.equal(f.writes,0);cleanup();
});
test('returning over the label releases a retained outside-inline caret without selecting label characters',()=>{
 const f=fixture(),cleanup=trackLinkIconSelection(f.e,f.event);f.dispatch('mousemove');f.dispatch('selectionchange');
 f.dispatch('mousemove',{clientX:37});f.dispatch('selectionchange');f.paint();assert.deepEqual(f.e.selection.focus,{path:[0,1,0],offset:0});cleanup();
});
test('clicking without dragging preserves the existing icon-click selection',()=>{
 const f=fixture(),cleanup=trackLinkIconSelection(f.e,f.event);f.dispatch('mouseup');assert.equal(f.writes,0);assert.equal(f.listeners.size,0);cleanup();
});
test('blur or unmount releases the point reference, listeners and queued frame',()=>{
 for(const blur of [false,true]){
  const f=fixture(),cleanup=trackLinkIconSelection(f.e,f.event);f.dispatch('mousemove');assert.equal(Editor.pointRefs(f.e).size,1);assert.equal(f.frames.size,1);
  if(blur)f.blur();else cleanup();assert.equal(f.listeners.size,0);assert.equal(f.frames.size,0);assert.equal(Editor.pointRefs(f.e).size,0);cleanup();
 }
});
test('read-only and modified clicks do not install drag handlers',()=>{
 for(const key of ['readOnly','shiftKey','ctrlKey','metaKey','altKey']){const f=fixture();if(key==='readOnly')f.e.wysimark.readOnly=true;else f.event[key]=true;assert.equal(trackLinkIconSelection(f.e,f.event),undefined);assert.equal(f.listeners.size,0)}
});
