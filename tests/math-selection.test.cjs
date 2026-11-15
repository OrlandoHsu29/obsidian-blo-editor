const {test}=require('node:test'),assert=require('node:assert/strict');
const {buildSync}=require('esbuild'),Module=require('node:module');
const {createEditor,Editor,Transforms}=require('slate'),{withHistory}=require('slate-history');
const loaded=new Module('math-selection.cjs');loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en'}:require(id);
loaded._compile(buildSync({stdin:{contents:`
import {createWithSink} from './src/wysimark/sink/editor';
import {MathPlugin} from './src/wysimark/math-plugin';
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
test('a caret on an existing formula opens editing without changing its content',()=>{
 const e=fixture();Transforms.select(e,{path:[0,1,0],offset:0});const before=structuredClone(e.children);e.math.insertInline();assert.deepEqual(e.children,before);assert.equal(e.history.undos.length,0);
});
test('multiple selected formulas retain every source when combined',()=>{
 const e=fixture();Transforms.select(e,{anchor:{path:[0,0],offset:4},focus:{path:[0,4],offset:0}});e.math.insertInline();
 assert.deepEqual([...Editor.nodes(e,{at:[],match:n=>n.type==='math-inline'})].map(([n])=>n.latex),['a+b tailc^2']);
});
