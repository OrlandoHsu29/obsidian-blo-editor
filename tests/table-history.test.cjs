const {test}=require('node:test'),assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module');
const {createEditor,Editor,Node,Transforms}=require('slate'),{withHistory,HistoryEditor}=require('slate-history');
const m=new Module('table-history.cjs');
m.require=id=>id==='obsidian'?{getLanguage:()=> 'en',Platform:{isMacOS:false}}:id==='react'?{...require('react'),useRef:value=>({current:value}),useCallback:fn=>fn,useEffect(){}}:require(id);
m._compile(buildSync({stdin:{contents:`
 export {Editable} from './src/wysimark/entry';
 export {createWithSink} from './src/wysimark/sink/editor';
 export {TablePlugin} from './src/wysimark/table-plugin';
 export {BlockStructurePlugin} from './src/blocks/plugin';
 export {serialize} from './src/wysimark/convert';
 `,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',jsx:'automatic',external:['obsidian','slate','slate-history','slate-react','react','react/*','react-dom','react-dom/*'],write:false}).outputFiles[0].text,'table-history.cjs');
const {Editable,createWithSink,TablePlugin,BlockStructurePlugin,serialize}=m.exports;
const withTables=createWithSink([BlockStructurePlugin.fn,TablePlugin.fn]);
const p=text=>({type:'paragraph',children:[{text}]});
const table=(headerRow,headerColumn)=>({type:'table',headerRow,headerColumn,columns:[{align:'left'},{align:'right'}],children:[0,1].map(y=>({type:'table-row',children:[0,1].map(x=>({type:'table-cell',children:[{type:'table-content',children:[{text:`${y}:${x}`}]}]}))}))});
function fixture(){
 const e=withHistory(createEditor());e.wysimark={readOnly:false};withTables(e,{});e.getMarkdown=()=>serialize(e.children);
 Editable({editor:e,value:serialize([p('move this word'),table(true,true),table(false,true),table(true,false),p('destination')]),onChange:assert.fail});
 return e;
}
function assertTables(e){
 assert.deepEqual(e.children.filter(n=>n.type==='table').map(n=>[n.headerRow,n.headerColumn]),[[true,true],[false,true],[true,false]]);
 for(const table of e.children.filter(n=>n.type==='table'))table.children.forEach((row,y)=>row.children.forEach((cell,x)=>assert.deepEqual([cell.x,cell.y],[x,y])));
}
test('actual initial editor mount normalizes table indexes without creating undo entries',()=>{
 const e=fixture();assertTables(e);assert.equal(e.history.undos.length,0);assert.equal(e.history.redos.length,0);
 assert(!e.operations.some(op=>op.type==='set_node'&&('x' in op.newProperties||'y' in op.newProperties)));
});
test('moving selected text and exhausting undo preserves every table header and coordinate',()=>{
 const e=fixture(),before=structuredClone(e.children);e.operations=[];
 Transforms.select(e,{anchor:{path:[0,0],offset:5},focus:{path:[0,0],offset:9}});
 const fragment=e.getFragment();
 HistoryEditor.withNewBatch(e,()=>Editor.withoutNormalizing(e,()=>{
  e.deleteFragment();Transforms.select(e,Editor.end(e,[e.children.findIndex(n=>n.type==='paragraph'&&Node.string(n)==='destination')]));e.insertFragment(fragment);
 }));
 const moved=structuredClone(e.children);assert.notEqual(Node.string(e.children[0]),Node.string(before[0]));assertTables(e);
 e.undo();assert.deepEqual(e.children,before);assertTables(e);
 e.undo();assert.deepEqual(e.children,before);assertTables(e);
 e.redo();assert.deepEqual(e.children,moved);assertTables(e);
});

test('row and column edits recompute coordinates through undo and redo without recording derived repairs',()=>{
 for(const edit of ['insertRow','insertColumn']){
  const e=fixture(),before=structuredClone(e.children),index=e.children.findIndex(n=>n.type==='table');
  Transforms.select(e,Editor.start(e,[index,0,0]));e.operations=[];
  HistoryEditor.withNewBatch(e,()=>e.tablePlugin[edit]({offset:1}));
  const edited=structuredClone(e.children);assertTables(e);
  assert(e.history.undos[0].operations.every(op=>op.type!=='set_node'||!('x' in op.newProperties||'y' in op.newProperties)));
  e.undo();assert.deepEqual(e.children,before);assertTables(e);
  e.redo();assert.deepEqual(e.children,edited);assertTables(e);
 }
});

test('actual header settings still undo and redo independently',()=>{
 const e=fixture(),index=e.children.findIndex(n=>n.type==='table');e.operations=[];
 HistoryEditor.withNewBatch(e,()=>Transforms.setNodes(e,{headerRow:false,headerColumn:false},{at:[index]}));
 assert.equal(e.children[index].headerRow,false);assert.equal(e.children[index].headerColumn,false);
 e.undo();assertTables(e);e.redo();assert.equal(e.children[index].headerRow,false);assert.equal(e.children[index].headerColumn,false);
});
