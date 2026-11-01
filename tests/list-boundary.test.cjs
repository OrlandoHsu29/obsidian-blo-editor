const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor,Node,Transforms}=require('slate');
const {withHistory,HistoryEditor}=require('slate-history');
const loaded=new Module('list-plugin.cjs');
loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en'}:require(id);
loaded._compile(buildSync({entryPoints:['src/wysimark/list-plugin/index.tsx'],bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history'],write:false}).outputFiles[0].text,'list-plugin.cjs');
const {ListPlugin}=loaded.exports;

function fixture(list, nested=false) {
 const editor=withHistory(createEditor());
 editor.wysimark={readOnly:false};
 editor.convertElement={addConvertElementType:()=>{}};
 ListPlugin.fn(editor,{}, {createPolicy:p=>p});
 const nodes=[list,{type:'paragraph',children:[{text:'after',bold:true}]}];
 editor.children=nested?[{type:'block-quote',children:nodes}]:nodes;
 const before=structuredClone(editor.children);
 Transforms.select(editor,Editor.start(editor,nested?[0,1]:[1]));
 return {editor,before};
}
for(const type of ['unordered-list-item','ordered-list-item','task-list-item']) {
 for(const prior of ['', 'before']) {
  for(const nested of [false,true]) {
   test(`Backspace preserves ${type}: ${prior?'nonempty':'empty'}, ${nested?'nested':'root'}`,()=>{
    const props={type,depth:2,...(type==='ordered-list-item'?{start:7,__numbering:'explicit'}:{}),...(type==='task-list-item'?{checked:true}:{})};
    const {editor,before}=fixture({...props,children:[{text:prior}]},nested);
    HistoryEditor.withNewBatch(editor,()=>editor.deleteBackward('character'));
    const siblings=nested?editor.children[0].children:editor.children;
    assert.equal(siblings.length,1);
    for(const [key,value]of Object.entries(props))assert.equal(siblings[0][key],value);
    assert.equal(Node.string(siblings[0]),prior+'after');
    const listPath=nested?[0,0]:[0];
    assert.deepEqual(editor.selection.anchor,editor.selection.focus);
    assert.equal(Editor.string(editor,{anchor:Editor.start(editor,listPath),focus:editor.selection.anchor}),prior);
    assert.equal(siblings[0].children.at(-1).bold,true);
    const merged=structuredClone(editor.children);
    editor.undo();assert.deepEqual(editor.children,before);
    editor.redo();assert.deepEqual(editor.children,merged);
    assert.deepEqual(editor.selection.anchor,editor.selection.focus);
    assert.equal(Editor.string(editor,{anchor:Editor.start(editor,listPath),focus:editor.selection.anchor}),prior);
   });
  }
 }
}
test('an empty ordinary paragraph keeps Slate default replacement behavior',()=>{
 const {editor}=fixture({type:'paragraph',children:[{text:''}]});
 editor.deleteBackward('character');
 assert.equal(editor.children.length,1);
 assert.equal(editor.children[0].type,'paragraph');
 assert.equal(Node.string(editor.children[0]),'after');
});
