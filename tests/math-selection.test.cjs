const {test}=require('node:test'),assert=require('node:assert/strict');
const {buildSync}=require('esbuild'),Module=require('node:module');
const {createEditor,Editor,Node,Transforms}=require('slate'),{withHistory,HistoryEditor}=require('slate-history');
const loaded=new Module('math-selection.cjs');loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en'}:require(id);
loaded._compile(buildSync({stdin:{contents:`
import {createWithSink} from './src/wysimark/sink/editor';
import {MathPlugin} from './src/wysimark/math-plugin';
export {canInsertMath} from './src/wysimark/math-plugin';
export const withMath=createWithSink([MathPlugin.fn]);
`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-react','slate-history','react','react-dom'],write:false}).outputFiles[0].text,'math-selection.cjs');
const formula=latex=>({type:'math-inline',latex,children:[{text:''}]});
function fixture(){const e=withHistory(createEditor());e.wysimark={readOnly:false};loaded.exports.withMath(e,{});e.children=[{type:'paragraph',children:[{text:'pre '},formula('a+b'),{text:' tail'},formula('c^2'),{text:' end'}]}];Editor.normalize(e,{force:true});e.history.undos=[];return e}
for(const backward of[false,true])test(`formula and neighboring text merge without losing LaTeX (${backward?'backward':'forward'})`,()=>{
 const e=fixture(),start={path:[0,0],offset:2},end={path:[0,2],offset:3};Transforms.select(e,backward?{anchor:end,focus:start}:{anchor:start,focus:end});
 const before=structuredClone(e.children);assert.equal(e.math.insertInline(),true);
 const maths=[...Editor.nodes(e,{at:[],match:n=>n.type==='math-inline'})].map(([n])=>n.latex);assert.deepEqual(maths,['e a+b ta','c^2']);
 const after=structuredClone(e.children);e.undo();assert.deepEqual(e.children,before);e.redo();assert.deepEqual(e.children,after);
});
test('text converted beside an unselected formula remains a separate formula',()=>{
 const e=fixture();Transforms.select(e,{anchor:{path:[0,2],offset:1},focus:{path:[0,2],offset:5}});e.math.insertInline();
 assert.deepEqual([...Editor.nodes(e,{at:[],match:n=>n.type==='math-inline'})].map(([n])=>n.latex),['a+b','tail','c^2']);
});
for(const mode of ['clicked','forward','backward'])test(`toggling one ${mode} formula restores its exact LaTeX as plain text`,()=>{
 const e=fixture(),start=Editor.end(e,[0,0]),end=Editor.start(e,[0,2]);
 Transforms.select(e,mode==='clicked'?Editor.start(e,[0,1]):mode==='backward'?{anchor:end,focus:start}:{anchor:start,focus:end});
 const before=structuredClone(e.children),selection=structuredClone(e.selection);
 assert.equal(e.math.insertInline(),true);
 assert.deepEqual(e.children[0].children,[{text:'pre a+b tail'},formula('c^2'),{text:' end'}]);
 const after=structuredClone(e.children);e.undo();assert.deepEqual(e.children,before);assert.deepEqual(e.selection,selection);e.redo();assert.deepEqual(e.children,after);
});
test('multiple selected formulas retain every source when combined',()=>{
 const e=fixture();Transforms.select(e,{anchor:{path:[0,0],offset:4},focus:{path:[0,4],offset:0}});e.math.insertInline();
 assert.deepEqual([...Editor.nodes(e,{at:[],match:n=>n.type==='math-inline'})].map(([n])=>n.latex),['a+b tailc^2']);
});

const title=(level,children)=>({type:'heading',level,children});
test('the math command and inline insertion cannot create formulas in headings or subtitles',()=>{
 for(const level of [1,2,3,4,5,6]){
  const e=fixture();e.children=[title(level,[{text:'Title '}])];Transforms.select(e,Editor.end(e,[0]));
  assert.equal(loaded.exports.canInsertMath(e),false);assert.equal(e.math.insertInline(),false);
  Transforms.insertNodes(e,formula('x^2'),{at:[0,1]});
  assert.deepEqual(e.children,[title(level,[{text:'Title x^2'}])]);
 }
});

test('pasted headings and fragments inside headings keep the source as text while body formulas remain',()=>{
 const e=fixture();e.children=[title(2,[{text:'Title '}])];
 Transforms.select(e,Editor.end(e,[0]));
 e.insertFragment([{type:'paragraph',children:[formula('first')]}]);
 assert.equal(Node.string(e.children[0]),'Title first');
 Transforms.insertNodes(e,[title(3,[formula('second')]),{type:'paragraph',children:[formula('body')]}],{at:[1]});
 assert.equal(Node.string(e.children[1]),'second');
 assert.deepEqual([...Editor.nodes(e,{at:[],match:n=>n.type==='math-inline',voids:true})].map(([n])=>n.latex),['body']);
});

test('conversion to a heading restores formula text and undo restores formula nodes',()=>{
 const e=fixture();Transforms.select(e,Editor.start(e,[0,1]));
 const before=structuredClone(e.children);
 HistoryEditor.withNewBatch(e,()=>Transforms.setNodes(e,{type:'heading',level:2},{at:[0]}));
 assert.equal(Node.string(e.children[0]),'pre a+b tailc^2 end');
 assert.equal(e.children[0].children.some(n=>n.type==='math-inline'),false);
 e.undo();assert.deepEqual(e.children,before);
});

test('existing formulas survive document load and ordinary edits to legacy headings',()=>{
 const e=fixture();
 HistoryEditor.withoutSaving(e,()=>Transforms.insertNodes(e,title(2,[formula('legacy')]),{at:[0]}));
 Transforms.select(e,Editor.end(e,[0]));e.insertText(' tail');
 assert.equal(e.children[0].children.find(n=>n.type==='math-inline').latex,'legacy');
 assert.equal(loaded.exports.canInsertMath(e),false);
});
