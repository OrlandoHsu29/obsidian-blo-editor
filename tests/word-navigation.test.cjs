const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor,Transforms}=require('slate');
const {withHistory}=require('slate-history');
const platform={isMacOS:false};
const reactEditor={toDOMNode:e=>e.host,toDOMPoint:(_e,point)=>[{point},point.offset],toSlateRange:(_e,native)=>native.unresolvable?null:native.range};
const loaded=new Module('word-navigation.cjs');
loaded.require=id=>id==='slate-react'?{ReactEditor:reactEditor}:id==='obsidian'?{Platform:platform,getLanguage:()=> 'en'}:require(id);
loaded._compile(buildSync({stdin:{contents:`export {handleWordNavigation} from './src/wysimark/entry/word-navigation';export {handleScopedHotkey} from './src/wysimark/entry/scoped-hotkeys';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-react','slate-history','react','react-dom'],write:false}).outputFiles[0].text,'word-navigation.cjs');
const {handleWordNavigation,handleScopedHotkey}=loaded.exports;
const point=(offset,path=[0,0])=>({path,offset});
function fixture(){
 platform.isMacOS=false;const e=withHistory(createEditor());e.wysimark={};e.children=[{type:'paragraph',children:[{text:'测试中文分词',bold:true}]}];Transforms.select(e,point(6));
 const calls=[],sources=[],targets=[];
 const native={anchorNode:{point:point(6)},focusNode:{point:point(6)},range:e.selection,setBaseAndExtent(a,_ao,f,_fo){this.anchorNode=a;this.focusNode=f;this.range={anchor:a.point,focus:f.point};sources.push(structuredClone(this.range))},modify(alter,direction,unit){calls.push([alter,direction,unit]);const target=targets.shift()??point(4);this.range={anchor:alter==='extend'?this.range.anchor:target,focus:target};this.anchorNode={point:this.range.anchor};this.focusNode={point:target,...(this.leaveEditor?{outside:true}:{})}}};
 e.host={contains:n=>!n.outside,ownerDocument:{getSelection:()=>native}};
 const event=extra=>({key:'ArrowLeft',ctrlKey:true,altKey:false,metaKey:false,shiftKey:false,isComposing:false,defaultPrevented:false,preventDefault(){this.defaultPrevented=true},stopPropagation(){this.stopped=true},...extra});
 return {e,native,calls,sources,targets,event};
}
test('Ctrl+Left uses browser word segmentation and updates only Slate selection',()=>{
 const f=fixture(),before=structuredClone(f.e.children),event=f.event();assert.equal(handleWordNavigation(f.e,event),true);assert.deepEqual(f.calls,[['move','left','word']]);assert.deepEqual(f.e.selection,{anchor:point(4),focus:point(4)});assert.deepEqual(f.e.children,before);assert.equal(f.e.history.undos.length,0);assert(event.defaultPrevented&&event.stopped);
});
test('Ctrl+Right uses physical rightward word navigation',()=>{
 const f=fixture();Transforms.select(f.e,point(0));f.targets.push(point(2));handleWordNavigation(f.e,f.event({key:'ArrowRight'}));assert.deepEqual(f.calls,[['move','right','word']]);assert.equal(f.e.selection.focus.offset,2);
});
test('Ctrl+Shift+Arrow extends the current range while retaining its anchor',()=>{
 const f=fixture();handleWordNavigation(f.e,f.event({shiftKey:true}));assert.deepEqual(f.calls,[['extend','left','word']]);assert.deepEqual(f.e.selection,{anchor:point(6),focus:point(4)});
});
test('rapid repeats start from the newest Slate selection rather than stale native offsets',()=>{
 const f=fixture();f.targets.push(point(4),point(2));handleWordNavigation(f.e,f.event());f.native.range={anchor:point(6),focus:point(6)};handleWordNavigation(f.e,f.event({repeat:true}));assert.deepEqual(f.sources.at(-1),{anchor:point(4),focus:point(4)});assert.equal(f.e.selection.focus.offset,2);
});
test('Mac Option+Arrow follows native word navigation without replacing Cmd+Arrow',()=>{
 const f=fixture();platform.isMacOS=true;try{
  assert.equal(handleWordNavigation(f.e,f.event({ctrlKey:false,altKey:true})),true);
  assert.equal(handleWordNavigation(f.e,f.event({ctrlKey:false,metaKey:true})),false);
  assert.equal(handleWordNavigation(f.e,f.event()),false);
 }finally{platform.isMacOS=false}
});
test('ordinary arrows, vertical navigation, composition and handled events pass through',()=>{
 for(const extra of [{ctrlKey:false},{key:'ArrowUp'},{altKey:true},{metaKey:true},{isComposing:true},{defaultPrevented:true}]){const f=fixture();assert.equal(handleWordNavigation(f.e,f.event(extra)),false);assert.equal(f.calls.length,0)}
});
test('readonly, missing selection, unsupported native API and another editor keep existing behavior',()=>{
 for(const mode of ['readonly','missing','unsupported','outside']){const f=fixture();if(mode==='readonly')f.e.wysimark.readOnly=true;if(mode==='missing')Transforms.deselect(f.e);if(mode==='unsupported')f.native.modify=undefined;if(mode==='outside')f.native.anchorNode.outside=true;assert.equal(handleWordNavigation(f.e,f.event()),false);assert.equal(f.calls.length,0)}
});
test('unresolvable or out-of-editor native results restore the original range for fallback',()=>{
 for(const mode of ['unresolvable','leaveEditor']){const f=fixture(),before=structuredClone(f.e.selection),event=f.event();f.native[mode]=true;assert.equal(handleWordNavigation(f.e,event),false);assert.deepEqual(f.e.selection,before);assert.deepEqual(f.native.range,before);assert.equal(event.defaultPrevented,false)}
});
test('native results can span formatted leaves without altering formatting',()=>{
 const f=fixture();f.e.children=[{type:'paragraph',children:[{text:'hello ',bold:true},{text:'中文',italic:true}]}];Transforms.select(f.e,point(2,[0,1]));const before=structuredClone(f.e.children);f.targets.push(point(0,[0,1]));handleWordNavigation(f.e,f.event());assert.deepEqual(f.e.selection.focus,point(0,[0,1]));assert.deepEqual(f.e.children,before);
});
test('formula inputs keep native shortcuts and custom editor bindings take priority',()=>{
 const f=fixture();let commands=0;f.e.wysimark.handleCommandHotkey=()=>{commands++;return true};
 assert.equal(handleScopedHotkey(f.e,f.event({target:{closest:()=>({})}})),false);assert.equal(commands,0);assert.equal(f.calls.length,0);
 assert.equal(handleScopedHotkey(f.e,f.event()),true);assert.equal(commands,1);assert.equal(f.calls.length,0);
});
