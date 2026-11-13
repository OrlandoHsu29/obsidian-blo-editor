const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor,Node,Transforms}=require('slate');
const {withHistory}=require('slate-history');
const loaded=new Module('table-paste.cjs');
loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en',Platform:{isMacOS:false}}:require(id);
loaded._compile(buildSync({stdin:{contents:`
 import {createWithSink} from './src/wysimark/sink/editor';
 import {TablePlugin} from './src/wysimark/table-plugin';
 import {BlockStructurePlugin} from './src/blocks/plugin';
 import {PasteMarkdownPlugin} from './src/wysimark/paste-markdown-plugin';
 export const withTables=createWithSink([BlockStructurePlugin.fn,PasteMarkdownPlugin.fn,TablePlugin.fn]);
 export * from './src/wysimark/table-plugin/cell-selection';
 export * from './src/wysimark/table-plugin/paste-table';
 export {parse,serialize} from './src/wysimark/convert';
 `,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history','slate-react','react','react-dom'],write:false}).outputFiles[0].text,'table-paste.cjs');
const {withTables,selectTableCell,selectTableCellRange,tableCellSelection,beginTableCellEdit,pasteTableFragment,clipboardTextTable,parse,serialize}=loaded.exports;
const paragraph=text=>({type:'paragraph',children:[{text}]});
const table=(grid,extra={})=>({type:'table',columns:grid[0].map(()=>({align:'left'})),headerRow:true,headerColumn:false,...extra,children:grid.map(row=>({type:'table-row',children:row.map(value=>({type:'table-cell',children:[{type:'table-content',children:typeof value==='string'?[{text:value}]:value}]}))}))});
function fixture(grid){
 const editor=withHistory(createEditor());editor.wysimark={readOnly:false};withTables(editor,{});
 editor.isInline=node=>['anchor','math-inline','inline-code','image-inline'].includes(node.type);
 editor.isVoid=node=>['math-inline','image-inline'].includes(node.type);
 editor.children=[paragraph('Before'),table(grid,{__blockDepth:1,__blockId:'destination',headerColumn:true}),paragraph('After')];
 Editor.normalize(editor,{force:true});editor.history.undos=[];editor.history.redos=[];editor.operations=[];
 return editor;
}
const target=editor=>editor.children.find(n=>n.type==='table');
const values=editor=>target(editor).children.map(row=>row.children.map(Node.string));
const path=editor=>[editor.children.indexOf(target(editor))];
const select=(editor,x,y)=>selectTableCell(editor,[...path(editor),y,x]);

test('a native copied table fills cells from a selected cell without nesting or affecting neighbors',()=>{
 const editor=fixture([['00','01','02'],['10','11','12'],['20','21','22']]);select(editor,1,1);
 const before=structuredClone(editor.children);editor.insertFragment([table([['A','B'],['C','D']])]);
 assert.deepEqual(values(editor),[['00','01','02'],['10','A','B'],['20','C','D']]);
 assert.equal(target(editor).__blockDepth,1);assert.equal(target(editor).__blockId,'destination');assert.equal(target(editor).headerColumn,true);
 assert.equal([...Node.elements(editor)].filter(([node])=>node.type==='table').length,1);
 const selected=tableCellSelection(editor);assert.equal(selected.kind,'cell');assert.deepEqual([selected.left,selected.top,selected.right,selected.bottom],[1,1,2,2]);
 const after=structuredClone(editor.children);assert.equal(editor.history.undos.length,1);
 editor.undo();assert.deepEqual(editor.children,before);editor.redo();assert.deepEqual(editor.children,after);
});
test('a backward rectangular selection uses its top-left corner and only overwrites the clipboard footprint',()=>{
 const editor=fixture([['00','01','02'],['10','11','12'],['20','21','22']]);
 selectTableCellRange(editor,path(editor),{x:2,y:2},{x:0,y:0});editor.insertFragment([table([['A','B']])]);
 assert.deepEqual(values(editor),[['A','B','02'],['10','11','12'],['20','21','22']]);
});
test('pasting from a text caret in a cell still replaces the destination grid',()=>{
 const editor=fixture([['old','keep']]);select(editor,0,0);beginTableCellEdit(editor);
 Transforms.select(editor,{path:[...path(editor),0,0,0,0],offset:1});editor.insertFragment([table([['A','B']])]);
 assert.deepEqual(values(editor),[['A','B']]);
});
test('a paste beyond the right/bottom edges expands the table and keeps existing formatting',()=>{
 const editor=fixture([['00','01'],['10','11']]);
 Transforms.setNodes(editor,{columns:[{align:'center'},{align:'right'}]},{at:path(editor)});editor.history.undos=[];
 select(editor,1,1);const before=structuredClone(editor.children);
 editor.insertFragment([table([['A','B','C'],['D','E','F']],{__blockId:'source',headerRow:false,headerColumn:false,columns:[{align:'left'},{align:'center'},{align:'right'}]})]);
 assert.deepEqual(values(editor),[['00','01','',''],['10','A','B','C'],['','D','E','F']]);
 assert.deepEqual(target(editor).columns,[{align:'center'},{align:'right'},{align:'center'},{align:'right'}]);
 assert.equal(target(editor).__blockId,'destination');assert.equal(target(editor).headerRow,true);assert.equal(target(editor).headerColumn,true);
 assert.equal(tableCellSelection(editor).kind,'cell');assert.equal(editor.history.undos.length,1);
 editor.undo();assert.deepEqual(editor.children,before);editor.redo();assert.equal(target(editor).columns.length,4);
});
test('Markdown tables take the same grid route and preserve rich cell content',()=>{
 const editor=fixture([['00','01'],['10','11']]);select(editor,0,0);
 editor.pasteMarkdown.pasteMarkdown('| Name | Formula |\n| --- | --- |\n| **bold** and [site](https://example.com) | $x^2$<br>`code` |');
 assert.equal(target(editor).children[0].children[0].children[0].children[0].text,'Name');
 const cell=target(editor).children[1].children[0];assert([...Node.texts(cell)].some(([text])=>text.bold&&text.text==='bold'));
 assert([...Node.elements(cell)].some(([node])=>node.type==='anchor'&&node.href==='https://example.com'));
 const formula=target(editor).children[1].children[1];assert([...Node.elements(formula)].some(([node])=>node.type==='math-inline'&&node.latex==='x^2'));
 const reopened=parse(serialize(editor.children)).find(n=>n.type==='table');assert.equal(Node.string(reopened.children[0].children[0]),'Name');
});
test('same-table overlapping copy/paste snapshots the source before writing',()=>{
 const editor=fixture([['A','B','C'],['D','E','F'],['G','H','I']]);
 selectTableCellRange(editor,path(editor),{x:0,y:0},{x:1,y:1});const fragment=editor.getFragment();select(editor,1,1);editor.insertFragment(fragment);
 assert.deepEqual(values(editor),[['A','B','C'],['D','A','B'],['G','D','E']]);
});
test('quoted TSV preserves tabs, line breaks, escaped quotes and empty cells',()=>{
 const source=clipboardTextTable('"A\tB"\t"line 1\nline 2"\t\r\n"say ""hello"""\tC\tD\r\n');
 assert.deepEqual(source.children.map(row=>row.children.map(Node.string)),[['A\tB','line 1\nline 2',''],['say "hello"','C','D']]);
 const editor=fixture([['old']]);select(editor,0,0);assert(pasteTableFragment(editor,[source]));
 assert.deepEqual(values(editor),[['A\tB','line 1\nline 2',''],['say "hello"','C','D']]);
 assert.equal(clipboardTextTable('just\nparagraphs'),undefined);assert.equal(clipboardTextTable('"unclosed\ttext'),undefined);
});
test('plain text and outside-table pastes retain their normal behavior; read-only grids do not change',()=>{
 const editor=fixture([['old','keep']]);select(editor,0,0);editor.insertText('plain');assert.deepEqual(values(editor),[['plain','keep']]);
 Transforms.select(editor,{path:[0,0],offset:2});assert.equal(pasteTableFragment(editor,[table([['A']])]),false);
 select(editor,0,0);editor.wysimark.readOnly=true;const before=structuredClone(editor.children);
 assert.equal(pasteTableFragment(editor,[table([['A']])]),false);assert.deepEqual(editor.children,before);
});
