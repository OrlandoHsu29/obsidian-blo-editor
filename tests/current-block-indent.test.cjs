const {test}=require('node:test'),assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module');
const {createEditor,Editor,Transforms}=require('slate'),{withHistory}=require('slate-history');
const loaded=new Module('current-block-indent.cjs');loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en',Platform:{isMacOS:false}}:require(id);
loaded._compile(buildSync({stdin:{contents:"export {indentCurrentBlock,indentSelectedBlocks,blockDepth} from './src/blocks/model';export {editorCommands,installEditorHotkeys} from './src/editor-hotkeys';export {blockIndentItems} from './src/wysimark/toolbar-plugin/items/utility-items';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history','slate-react','react','react-dom'],write:false}).outputFiles[0].text,'current-block-indent.cjs');
const {indentCurrentBlock,indentSelectedBlocks,blockDepth,editorCommands,installEditorHotkeys,blockIndentItems}=loaded.exports;
const p=(text,depth)=>({type:'paragraph',__blockDepth:depth,children:[{text}]});
function fixture(){const e=withHistory(createEditor());e.wysimark={readOnly:false};e.children=[p('Parent',2),p('Child',3),{type:'task-list-item',depth:4,children:[{text:'Grandchild'}]},p('Following',1)];Transforms.select(e,{path:[0,0],offset:3});return e}
test('current-block commands preserve descendants, content, caret and undo',()=>{
 const e=fixture(),children=e.children.slice(1),before=structuredClone(e.children),selection=structuredClone(e.selection);
 assert.equal(indentCurrentBlock(e,1),true);assert.deepEqual(e.children.map(blockDepth),[3,3,4,1]);assert(children.every((n,i)=>n===e.children[i+1]));assert.deepEqual(e.selection,selection);
 e.undo();assert.deepEqual(e.children,before);assert.deepEqual(e.selection,selection);e.redo();assert.deepEqual(e.children.map(blockDepth),[3,3,4,1]);
 assert.equal(indentCurrentBlock(e,-1),true);assert.deepEqual(e.children.map(blockDepth),[2,3,4,1]);
 const subtree=fixture();indentSelectedBlocks(subtree,-1);assert.deepEqual(subtree.children.map(blockDepth),[1,2,3,1]);
});
test('both list depth fields update without changing child lists',()=>{
 for(const type of ['ordered-list-item','unordered-list-item','task-list-item']){
  const e=fixture();e.children[0]={type,depth:2,__blockDepth:2,children:[{text:'Parent'}]};
  indentCurrentBlock(e,-1);assert.equal(e.children[0].depth,1);assert.equal(e.children[0].__blockDepth,1);assert.equal(blockDepth(e.children[1]),3);
 }
});
test('current-block commands honor boundaries, readonly and heading policy',()=>{
 const e=fixture();Transforms.setNodes(e,{__blockDepth:0},{at:[0]});assert.equal(indentCurrentBlock(e,-1),false);
 Transforms.setNodes(e,{__blockDepth:32},{at:[0]});assert.equal(indentCurrentBlock(e,1),false);
 e.wysimark.readOnly=true;assert.equal(indentCurrentBlock(e,-1),false);e.wysimark.readOnly=false;
 e.children[0]={type:'heading',level:2,children:[{text:'Heading'}]};assert.equal(indentCurrentBlock(e,1),false);
 Transforms.deselect(e);assert.equal(indentCurrentBlock(e,1),false);
});
test('a media boundary caret operates on its owning block',()=>{
 const e=fixture();e.children=[{type:'image-block',url:'manual.pdf',children:[{text:''}]},{type:'paragraph',__collapsible:true,children:[{text:''}]},p('Following',0)];Transforms.select(e,Editor.start(e,[1]));
 assert.equal(indentCurrentBlock(e,1),true);assert.equal(blockDepth(e.children[0]),1);assert.equal(blockDepth(e.children[1]),0);assert.equal(blockDepth(e.children[2]),0);
});
test('bracket command IDs and effective bindings use only the current block',()=>{
 const e=fixture(),defaults=new Map(),custom=new Map();
 const plugin={manifest:{id:'blo-editor'},app:{hotkeyManager:{getHotkeys:id=>custom.get(id),getDefaultHotkeys:id=>defaults.get(id),printHotkeyForCommand:()=>''}},addCommand:c=>defaults.set('blo-editor:'+c.id,c.hotkeys)};
 const commands=installEditorHotkeys(plugin,()=>e),event=key=>({key,code:'',ctrlKey:true,metaKey:false,altKey:false,shiftKey:false,isComposing:false,preventDefault(){this.prevented=true},stopPropagation(){}});
 const press=event(']');assert.equal(commands.handle(e,press),true);assert.equal(press.prevented,true);assert.deepEqual(e.children.map(blockDepth),[3,3,4,1]);
 commands.handle(e,event('['));assert.deepEqual(e.children.map(blockDepth),[2,3,4,1]);
 assert(editorCommands().find(c=>c.id==='indent-block').name.includes('current block'));
 custom.set('blo-editor:indent-block',[{key:'F8',modifiers:[]}]);commands.handle(e,event(']'));assert.deepEqual(e.children.map(blockDepth),[2,3,4,1]);
 const reassigned={...event('F8'),ctrlKey:false};assert.equal(commands.handle(e,reassigned),true);assert.deepEqual(e.children.map(blockDepth),[3,3,4,1]);
});
test('indent and outdent buttons only open two independently enabled scope choices',()=>{
 for(const[menu,delta]of[[blockIndentItems[0],-1],[blockIndentItems[1],1]]){
  const e=fixture();assert.equal(menu.action,undefined);assert.equal(menu.more,true);assert.equal(menu.children.length,2);assert.equal(menu.disabled(e),false);
  const[tree,current]=menu.children;tree.action(e);assert.deepEqual(e.children.map(blockDepth),[2+delta,3+delta,4+delta,1]);
  const one=fixture();current.action(one);assert.deepEqual(one.children.map(blockDepth),[2+delta,3,4,1]);
  one.wysimark.readOnly=true;assert.equal(menu.disabled(one),true);assert.equal(current.disabled(one),true);
 }
});
