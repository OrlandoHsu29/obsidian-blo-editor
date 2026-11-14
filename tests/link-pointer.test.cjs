const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor,Transforms}=require('slate');
const loaded=new Module('link-pointer.cjs');
const reactEditor={
 focus(){},toDOMNode:(e,node)=>node===e?e.host:e.link,
 toSlatePoint:(_e,[node])=>node.point,
 toSlateRange:(_e,selection)=>selection.range,
 toSlateNode:e=>e.children[0].children[1],findPath:()=>[0,1],
 toDOMPoint:(_e,point)=>[{point},point.offset],
};
loaded.require=id=>id==='slate-react'?{ReactEditor:reactEditor}:require(id);
loaded._compile(buildSync({entryPoints:['src/wysimark/anchor-plugin/pointer-selection.ts'],bundle:true,platform:'node',format:'cjs',external:['slate','slate-react'],write:false}).outputFiles[0].text,'link-pointer.cjs');
const {trackLinkIconSelection,linkIconHit}=loaded.exports;
function fixture(){
 const e=createEditor();e.wysimark={readOnly:false};e.isInline=n=>n.type==='anchor';e.children=[{type:'paragraph',children:[{text:'body'},{type:'anchor',href:'https://example.test',children:[{text:'Title'}]},{text:'after'}]}];
 const anchor={path:[0,1,0],offset:5},focus={path:[0,1,0],offset:0};Transforms.select(e,{anchor,focus});
 let writes=0,next=0;const listeners=new Map(),frames=new Map();
 const listen=(target,type,fn,capture)=>listeners.set(target+type,{fn,capture}),remove=(target,type)=>listeners.delete(target+type);
 const win={getComputedStyle:()=>({fontSize:'20px',lineHeight:'33px'}),addEventListener:(t,f)=>listen('win:',t,f),removeEventListener:t=>remove('win:',t),requestAnimationFrame:fn=>{frames.set(++next,fn);return next},cancelAnimationFrame:id=>frames.delete(id)};
 const selection={anchorNode:{point:anchor},anchorOffset:5,range:{anchor,focus},setBaseAndExtent(a,_a,f,_f){writes++;this.anchorNode=a;this.focusNode=f;this.range={anchor:a.point,focus:f.point}}};
 const link={getClientRects:()=>[{left:6,right:100,top:8,bottom:32,height:24}],querySelector:selector=>selector==='.wysimark-link-icon'?{getBoundingClientRect:()=>({left:10,right:30,width:20,height:20,top:10,bottom:30})}:{getClientRects:()=>[{left:36,right:100}]}};
 let hit=true,previousLine,nativePoint,caretOffset=4;
 const doc={defaultView:win,addEventListener:(t,f,c)=>listen('doc:',t,f,c),removeEventListener:t=>remove('doc:',t),getSelection:()=>selection,elementFromPoint:()=>({closest:()=>hit?link:null}),caretRangeFromPoint:()=>previousLine||nativePoint?{startContainer:{point:nativePoint},startOffset:nativePoint?.offset,getBoundingClientRect:()=>previousLine}:null,createRange:()=>({setStart(_node,offset){caretOffset=offset},collapse(){},getBoundingClientRect:()=>({left:4-(e.children[0].children[0].text.length-caretOffset)*6,top:10,bottom:30,height:20})})};
 link.ownerDocument=doc;
 doc.documentElement={classList:{remove(){}}};
 const host={ownerDocument:doc,contains:()=>true};
 e.host=host;
 e.link=link;
 const event={currentTarget:host,button:0,detail:1,clientX:80,clientY:20,preventDefault(){this.prevented=true},stopPropagation(){this.stopped=true}};
 return {e,event,link,selection,listeners,frames,missIcon(){hit=false},setNativeCaret(point){nativePoint=point},pointToPreviousLine(){previousLine={top:-22,bottom:0,height:22}},pointToNextLine(){previousLine={top:40,bottom:62,height:22}},get writes(){return writes},dispatch(type,extra={}){listeners.get('doc:'+type)?.fn({buttons:1,clientX:20,clientY:20,...extra})},blur(){listeners.get('win:blur')?.fn()},paint(){for(const [id,fn]of frames){frames.delete(id);fn()}}};
}

for(const spaces of [' ','   ','\u00a0'])test(`a press in preceding whitespace ${JSON.stringify(spaces)} resolves the icon without hitting the anchor DOM`,()=>{
 const f=fixture();f.e.children[0].children[0].text='body'+spaces;
 f.missIcon();f.setNativeCaret({path:[0,0],offset:4});
 f.event.clientX=4-spaces.length*6;f.event.clientY=20;
 const before=structuredClone(f.e.children),cleanup=trackLinkIconSelection(f.e,f.event);
 assert(f.event.prevented&&f.event.stopped);
 assert.deepEqual(f.e.selection.anchor,{path:[0,0],offset:4+spaces.length});
 assert.deepEqual(f.e.children,before);cleanup();assert.equal(f.listeners.size,0);
});
test('the leading gap includes fractional-pixel rounding without absorbing preceding text',()=>{
 const f=fixture();assert.ok(linkIconHit(f.e,f.link,3.5,20));assert.equal(linkIconHit(f.e,f.link,2,20),undefined);
});

for(const [x,y] of [[5,20],[20,20],[32,20],[35,20],[32,-4],[32,44]])test(`starting at ${x},${y} uses the expanded icon geometry`,()=>{
 const f=fixture();assert.equal(linkIconHit(f.e,f.link,x,y).overLabel,false);
 f.event.clientX=x;f.event.clientY=y;
 const cleanup=trackLinkIconSelection(f.e,f.event);
 assert(f.event.prevented&&f.event.stopped);
 assert.deepEqual(f.e.selection,{anchor:{path:[0,0],offset:4},focus:{path:[0,2],offset:0}});
 assert(f.listeners.has('doc:dragstart'));cleanup();assert.equal(f.listeners.size,0);assert.equal(Editor.pointRefs(f.e).size,0);
});
test('actual label text and adjacent rows are excluded from the expanded start region',()=>{
 const f=fixture();assert.equal(linkIconHit(f.e,f.link,37,20).overLabel,true);
 assert.equal(linkIconHit(f.e,f.link,20,-8),undefined);assert.equal(linkIconHit(f.e,f.link,20,46),undefined);
 f.pointToPreviousLine();assert.equal(linkIconHit(f.e,f.link,20,-2),undefined);
});
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

test('forward dragging retains the leading anchor when Chromium restarts selection inside the label',()=>{
 const f=fixture(),origin={path:[0,0],offset:4};
 f.selection.anchorNode={point:origin};f.selection.anchorOffset=4;
 const cleanup=trackLinkIconSelection(f.e,f.event);
 f.dispatch('mousemove',{clientX:24});f.dispatch('selectionchange');
 assert.deepEqual(f.e.selection,{anchor:origin,focus:{path:[0,1,0],offset:0}});
 for(const offset of [1,2,3,5]){
  const range={anchor:{path:[0,1,0],offset:0},focus:{path:[0,1,0],offset}};
  f.selection.range=range;Transforms.select(f.e,range);
  f.dispatch('mousemove',{clientX:50+offset});f.dispatch('selectionchange');f.paint();
  assert.deepEqual(f.e.selection,{anchor:origin,focus:range.focus});
  const writes=f.writes;f.dispatch('selectionchange');assert.equal(f.writes,writes,'stable ranges must not oscillate');
 }
 f.missIcon();const range={anchor:{path:[0,1,0],offset:0},focus:{path:[0,2],offset:2}};
 f.selection.range=range;Transforms.select(f.e,range);f.dispatch('mousemove',{clientX:130});f.dispatch('selectionchange');
 assert.deepEqual(f.e.selection,{anchor:origin,focus:range.focus});
 f.dispatch('mouseup',{clientX:130});assert.deepEqual(f.e.selection.anchor,origin);cleanup();
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
