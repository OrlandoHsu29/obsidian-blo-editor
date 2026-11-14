const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor,Range,Transforms}=require('slate');
const loaded=new Module('progressive-selection.cjs');
loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en',Platform:{isMacOS:false}}:require(id);
loaded._compile(buildSync({stdin:{contents:`export {handleScopedHotkey} from './src/wysimark/entry/scoped-hotkeys';export {isWholeBlockSelected} from './src/blocks/selection';export {BlockStructurePlugin} from './src/blocks/plugin';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history','slate-react','react','react-dom'],write:false}).outputFiles[0].text,'progressive-selection.cjs');
const {handleScopedHotkey,isWholeBlockSelected,BlockStructurePlugin}=loaded.exports;
const p=(text,depth=0)=>({type:'paragraph',__blockDepth:depth,children:[{text}]});
function fixture(nodes=[p('before'),p('current'),p('after')]){
 const e=createEditor();e.wysimark={getBlockSelectShortcut:()=>true};e.sink={plugins:[]};e.children=nodes;BlockStructurePlugin.fn(e);Transforms.select(e,{path:[1,0],offset:2});return e;
}
function press(e,extra={}){const event={key:'a',altKey:false,ctrlKey:true,metaKey:false,shiftKey:false,isComposing:false,repeat:false,preventDefault(){this.prevented=true},stopPropagation(){this.stopped=true},...extra};const handled=handleScopedHotkey(e,event);return {handled,event}}
test('Ctrl+A selects a block then the document, keeping repeated document selection stable',()=>{
 const e=fixture(),before=structuredClone(e.children);
 assert.equal(press(e).handled,true);assert.deepEqual(e.selection,Editor.range(e,[1]));assert.equal(isWholeBlockSelected(e,1),false);
 press(e);assert.deepEqual(e.selection,Editor.range(e,[]));press(e);assert.deepEqual(e.selection,Editor.range(e,[]));assert.deepEqual(e.children,before);
});
test('manually selecting the complete block in either direction escalates directly',()=>{
 for(const backward of [false,true]){const e=fixture(),r=Editor.range(e,[1]);Transforms.select(e,backward?{anchor:r.focus,focus:r.anchor}:r);press(e);assert.deepEqual(e.selection,Editor.range(e,[]))}
});
test('partial selection selects the block; moving the caret resets escalation',()=>{
 const e=fixture();Transforms.select(e,{anchor:{path:[1,0],offset:1},focus:{path:[1,0],offset:4}});press(e);assert.deepEqual(e.selection,Editor.range(e,[1]));
 Transforms.select(e,{path:[2,0],offset:1});press(e);assert.deepEqual(e.selection,Editor.range(e,[2]));
});
test('content selection excludes descendants, which remain folded when selecting all',()=>{
 const parent={type:'unordered-list-item',depth:0,__collapsed:true,children:[{text:'parent'}]},e=fixture([p('before'),parent,p('hidden',1),p('after')]);
 press(e);assert.deepEqual(e.selection,Editor.range(e,[1]));assert.equal(e.children[1].__collapsed,true);
 press(e);assert.deepEqual(e.selection,Editor.range(e,[]));assert.equal(e.children[1].__collapsed,true);
});
test('empty blocks require two separate presses and key repeat does not escalate',()=>{
 const e=fixture([p('before'),p(''),p('after')]);Transforms.select(e,{path:[1,0],offset:0});press(e);assert.equal(Range.isCollapsed(e.selection),true);assert.equal(isWholeBlockSelected(e,1),false);
 press(e,{repeat:true});assert.equal(Range.isCollapsed(e.selection),true);press(e);assert.deepEqual(e.selection,Editor.range(e,[]));
});
test('Cmd+A shares Ctrl+A progressive selection',()=>{
 const e=fixture();assert.equal(press(e,{ctrlKey:false,metaKey:true}).handled,true);assert.deepEqual(e.selection,Editor.range(e,[1]));press(e,{ctrlKey:false,metaKey:true});assert.deepEqual(e.selection,Editor.range(e,[]));
});
test('disabled, composing, modified, Alt+A and read-only shortcuts leave selection unchanged',()=>{
 for(const mode of ['disabled','readonly','composition','shift','alt','plain']){const e=fixture(),before=structuredClone(e.selection);if(mode==='disabled')e.wysimark.getBlockSelectShortcut=()=>false;if(mode==='readonly')e.wysimark.readOnly=true;
 assert.equal(press(e,{isComposing:mode==='composition',shiftKey:mode==='shift',altKey:mode==='alt',ctrlKey:!['alt','plain'].includes(mode)}).handled,false);assert.deepEqual(e.selection,before)}
});
test('embedded input fields retain native Ctrl+A for every press',()=>{
 const e=fixture(),before=structuredClone(e.selection);let dispatched=0;e.wysimark.handleCommandHotkey=()=>{dispatched++;return true};
 for(let i=0;i<3;i++){const result=press(e,{target:{closest:()=>({tagName:'INPUT'})}});assert.equal(result.handled,false);assert.equal(result.event.prevented,undefined);assert.deepEqual(e.selection,before)}assert.equal(dispatched,0);
});
