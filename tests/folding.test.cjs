const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor,Node,Transforms}=require('slate');
const {withHistory}=require('slate-history');
const loaded=new Module('folding.cjs');
loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en'}:require(id);
loaded._compile(buildSync({stdin:{contents:`
 export {rootCache} from './src/blocks/model';
 export {toggleBlockFold,revealFoldedSelection} from './src/blocks/folding';
 export {BlockStructurePlugin} from './src/blocks/plugin';
 export {parse,serialize} from './src/wysimark/convert';
 export {portableDocument} from './src/note-export/portable-document';
 export {splitListItem} from './src/wysimark/list-plugin/methods/insert-break';
 export {selectBlockContents,isWholeBlockSelected,deleteWholeBlockSelection,indentBlockSelection} from './src/blocks/selection';
 `,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history','slate-react'],write:false}).outputFiles[0].text,'folding.cjs');
const {rootCache,toggleBlockFold,revealFoldedSelection,BlockStructurePlugin,parse,serialize,portableDocument,splitListItem}=loaded.exports;
const {selectBlockContents,isWholeBlockSelected,deleteWholeBlockSelection,indentBlockSelection}=loaded.exports;
const item=(depth,text='item',extra={})=>({type:'unordered-list-item',depth,children:[{text,bold:true}],...extra});
function fixture(nodes){const editor=withHistory(createEditor());editor.wysimark={readOnly:false};editor.isMaster=()=>false;BlockStructurePlugin.fn(editor);editor.children=nodes;return editor}
const hidden=editor=>editor.children.map(n=>rootCache(editor).foldedBy.has(n));

test('folding hides the entire indented group while retaining content and following siblings',()=>{
 const editor=fixture([item(0,'parent'),item(1,'child'),item(2,'grandchild'),item(1,'second'),item(0,'next')]);const text=editor.children.map(Node.string);
 toggleBlockFold(editor,0);assert.deepEqual(hidden(editor),[false,true,true,true,false]);assert.deepEqual(editor.children.map(Node.string),text);assert.equal(rootCache(editor).previousVisible.get(editor.children[4]),0);
 toggleBlockFold(editor,0);assert.deepEqual(hidden(editor),[false,false,false,false,false]);
});
test('only ordered and unordered lists with children offer folding',()=>{
 const editor=fixture([item(0,'task',{type:'task-list-item'}),item(1),item(0,'number',{type:'ordered-list-item'}),item(1),item(0,'leaf')]);
 const c=rootCache(editor);assert(!c.foldable.has(editor.children[0]));assert(c.foldable.has(editor.children[2]));assert(!c.foldable.has(editor.children[4]));toggleBlockFold(editor,0);assert.equal(editor.children[0].__collapsed,undefined);
});
test('expanding an outer group retains an independently collapsed child',()=>{
 const editor=fixture([item(0,'parent',{__collapsed:true}),item(1,'child',{__collapsed:true}),item(2),item(0)]);toggleBlockFold(editor,0);assert.deepEqual(hidden(editor),[false,false,true,false]);toggleBlockFold(editor,1);assert.deepEqual(hidden(editor),[false,false,false,false]);
});
test('collapse moves a hidden text selection to the parent and is one undo step',()=>{
 const editor=fixture([item(0,'parent'),item(1,'child')]);Transforms.select(editor,{path:[1,0],offset:2});const before=structuredClone(editor.children),selection=structuredClone(editor.selection);
 toggleBlockFold(editor,0);assert.deepEqual(editor.selection.anchor,Editor.end(editor,[0]));assert.equal(editor.history.undos.length,1);editor.undo();assert.deepEqual(editor.children,before);assert.deepEqual(editor.selection,selection);editor.redo();assert.deepEqual(hidden(editor),[false,true]);
});
test('fold state persists in v1 metadata without losing child text or attachments',()=>{
 const editor=fixture([item(0,'parent'),item(1,'child [[note]]'),item(2,'grandchild'),item(0,'next')]);toggleBlockFold(editor,0);const markdown=serialize(editor.children),restored=fixture(parse(markdown));
 assert(markdown.includes('wysimark-block:v1'));assert.equal(restored.children[0].__collapsed,true);assert.deepEqual(restored.children.map(Node.string),editor.children.map(Node.string));assert.deepEqual(hidden(restored),[false,true,true,false]);
});
test('invalid collapsed metadata is ignored',()=>{
 for(const value of [1,'true',false]){const data=encodeURIComponent(JSON.stringify({depth:0,collapsed:value}));const nodes=parse('<!-- wysimark-block:v1 '+data+' -->\n\n- parent\n');assert.equal(nodes[0].__collapsed,undefined)}
});
test('selecting a hidden search result reveals every ancestor without adding an undo entry',()=>{
 const editor=fixture([item(0,'outer',{__collapsed:true}),item(1,'inner',{__collapsed:true}),item(2,'target')]);const before=editor.history.undos.length;
 Transforms.select(editor,{path:[2,0],offset:3});assert.deepEqual(hidden(editor),[false,false,false]);assert.equal(editor.history.undos.length,before);assert.deepEqual(editor.selection.anchor,{path:[2,0],offset:3});
});
test('explicit outline reveal works in reading mode without changing text',()=>{
 const editor=fixture([item(0,'parent',{__collapsed:true}),item(1,'target')]);editor.wysimark.readOnly=true;const range=Editor.range(editor,[1]);assert.equal(revealFoldedSelection(editor,range),true);assert.equal(revealFoldedSelection(editor,range),false);assert.equal(Node.string(editor.children[1]),'target');
});
test('portable exports retain all descendants and strip private fold state',()=>{
 const nodes=[item(0,'parent',{__collapsed:true}),item(1,'child'),item(2,'grandchild')],copy=structuredClone(nodes),output=portableDocument(nodes);assert.equal(output.map(Node.string).join(''),'parentchildgrandchild');assert(!JSON.stringify(output).includes('__collapsed'));assert.deepEqual(nodes,copy);
});
test('selection can reveal the maximum supported nested depth',()=>{
 const editor=fixture(Array.from({length:33},(_,depth)=>item(depth,'level '+depth,depth<32?{__collapsed:true}:{})));Transforms.select(editor,Editor.start(editor,[32]));assert(hidden(editor).every(value=>!value));
});
test('new split list items do not inherit collapsed state',()=>{
 const editor=fixture([item(0,'parent',{type:'ordered-list-item',__collapsed:true}),item(1,'child')]);Transforms.select(editor,Editor.end(editor,[0]));splitListItem(editor);assert.equal(editor.children[1].__collapsed,undefined);assert(!rootCache(editor).foldedBy.has(editor.children[2]));
});

test('whole-block selection preserves nested folds and includes all descendants',()=>{
 const editor=fixture([item(0,'parent',{__collapsed:true}),item(1,'child',{__collapsed:true}),item(2,'grandchild'),item(0,'next')]);
 const before=structuredClone(editor.children);selectBlockContents(editor,0);
 assert.deepEqual(editor.children,before);assert.deepEqual(hidden(editor),[false,true,true,false]);
 assert.equal(isWholeBlockSelected(editor,2),true);assert.equal(editor.selection.focus.path[0],2);
 assert.equal(editor.getFragment().map(Node.string).join(''),'parentchildgrandchild');
 const selection=structuredClone(editor.selection);editor.apply({type:'set_selection',properties:selection,newProperties:selection});
 assert.deepEqual(editor.children,before);assert.equal(isWholeBlockSelected(editor,0),true);
 Transforms.select(editor,{path:[2,0],offset:1});assert.deepEqual(hidden(editor),[false,false,false,false]);
});

test('selecting an expanded block ending in a folded subgroup keeps that subgroup folded',()=>{
 const editor=fixture([item(0,'parent'),item(1,'child',{__collapsed:true}),item(2,'grandchild'),item(0,'next')]);
 selectBlockContents(editor,0);assert.equal(editor.children[1].__collapsed,true);assert.equal(editor.selection.focus.path[0],2);
});

test('deleting a selected folded block removes its descendants and undo restores fold state',()=>{
 const editor=fixture([item(0,'parent',{__collapsed:true}),item(1,'child'),item(2,'grandchild'),item(0,'next')]);
 const before=structuredClone(editor.children);selectBlockContents(editor,0);assert.equal(deleteWholeBlockSelection(editor),true);
 assert.deepEqual(editor.children.map(Node.string),['next']);editor.undo();assert.deepEqual(editor.children,before);
});

test('indenting a selected folded subtree keeps its fold and block selection',()=>{
 const editor=fixture([item(0,'previous'),item(0,'parent',{__collapsed:true}),item(1,'child')]);
 selectBlockContents(editor,1);assert.equal(indentBlockSelection(editor,1),true);
 assert.equal(editor.children[1].depth,1);assert.equal(editor.children[2].depth,2);
 assert.equal(editor.children[1].__collapsed,true);assert.equal(isWholeBlockSelected(editor,2),true);
});
