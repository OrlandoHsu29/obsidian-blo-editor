const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor,Node,Transforms}=require('slate');
const {withHistory}=require('slate-history');
const loaded=new Module('editor-commands.cjs');
loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en'}:require(id);
loaded._compile(buildSync({stdin:{contents:`
 export {withHistoryBatch} from './src/wysimark/utils/with-history-batch';
 export {resizeInPreset} from './src/wysimark/image-plugin/utils/resize-utils';
 export {insertColumn} from './src/wysimark/table-plugin/methods/insert-column';
 export {removeColumn} from './src/wysimark/table-plugin/methods/remove-column';
 export {insertRow} from './src/wysimark/table-plugin/methods/insert-row';
 export {removeRow} from './src/wysimark/table-plugin/methods/remove-row';
 `,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history'],write:false}).outputFiles[0].text,'editor-commands.cjs');
const {withHistoryBatch,resizeInPreset,insertColumn,removeColumn,insertRow,removeRow}=loaded.exports;
const paragraph=text=>({type:'paragraph',children:[{text}]});

test('shared history batch keeps structure and selection in one undo step',()=>{
 const editor=withHistory(createEditor());editor.children=[paragraph('first')];
 Transforms.select(editor,Editor.start(editor,[0]));const before=structuredClone(editor.children),selection=structuredClone(editor.selection);
 withHistoryBatch(editor,()=>{
  Transforms.insertNodes(editor,paragraph('second'),{at:[1]});
  Transforms.setNodes(editor,{__blockDepth:2},{at:[0]});
  Transforms.select(editor,Editor.end(editor,[1]));
 });
 const after=structuredClone(editor.children);assert.equal(editor.history.undos.length,1);
 editor.undo();assert.deepEqual(editor.children,before);assert.deepEqual(editor.selection,selection);
 editor.redo();assert.deepEqual(editor.children,after);
});

test('shared batch also runs with a plain Slate editor',()=>{
 const editor=createEditor();editor.children=[paragraph('text')];
 withHistoryBatch(editor,()=>{Transforms.insertNodes(editor,paragraph('next'),{at:[1]});Transforms.select(editor,Editor.end(editor,[1]))});
 assert.equal(editor.children.length,2);assert.equal(Node.string(editor.children[1]),'next');assert.deepEqual(editor.selection.anchor,{path:[1,0],offset:4});
});

test('image presets preserve aspect ratio and never upscale bounds presets',()=>{
 const source={width:400,height:200};
 assert.deepEqual(resizeInPreset(source,{type:'bounds',width:200,height:300}),{width:200,height:100});
 assert.deepEqual(resizeInPreset(source,{type:'bounds',width:800,height:600}),source);
 assert.deepEqual(resizeInPreset(source,{type:'bounds',width:24,height:24}),{width:24,height:12});
 assert.deepEqual(resizeInPreset(source,{type:'scale',scale:0.5}),{width:200,height:100});
});

function tableFixture(){
 const editor=createEditor();
 editor.children=[{type:'table',headerRow:true,headerColumn:true,columns:[{align:'left'},{align:'right'}],children:[0,1].map(row=>({type:'table-row',children:[0,1].map(col=>({type:'table-cell',children:[{type:'table-content',children:[{text:`${row}:${col}`,bold:col===0}]}]}))}))}];
 Transforms.select(editor,Editor.start(editor,[0,0,0]));
 return editor;
}

test('column insert/remove retains alignment, headers, cell text and formatting',()=>{
 const editor=tableFixture(),before=structuredClone(editor.children);
 insertColumn(editor,{offset:1});
 assert.deepEqual(editor.children[0].columns,[{align:'left'},{align:'right'},{align:'right'}]);
 for(const row of editor.children[0].children){assert.equal(row.children.length,3);assert.equal(Node.string(row.children[1]),'');assert.equal(row.children[0].children[0].children[0].bold,true)}
 Transforms.select(editor,Editor.start(editor,[0,0,1]));removeColumn(editor);
 assert.deepEqual(editor.children,before);
});

test('row insert/remove creates independent editable cells without changing existing rows',()=>{
 const editor=tableFixture(),before=structuredClone(editor.children);
 insertRow(editor,{offset:0});const row=editor.children[0].children[0];
 assert.equal(row.children.length,2);assert.equal(Node.string(row),'');assert.notEqual(row.children[0],row.children[1]);
 Transforms.select(editor,Editor.start(editor,[0,0,0]));editor.insertText('new');assert.equal(Node.string(row.children[1]),'');
 removeRow(editor);assert.deepEqual(editor.children,before);
});
