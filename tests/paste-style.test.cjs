const {test}=require('node:test'),assert=require('node:assert/strict');
const {buildSync}=require('esbuild'),Module=require('node:module');
const {createEditor,Editor,Transforms,Node}=require('slate');
const {withHistory}=require('slate-history');
const loaded=new Module('paste-style.cjs');
loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en'}:require(id);
loaded._compile(buildSync({stdin:{contents:`
import {createWithSink} from './src/wysimark/sink/editor';
import {BlockStructurePlugin} from './src/blocks/plugin';
export const withBlocks=createWithSink([BlockStructurePlugin.fn]);
`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-react','slate-history','react','react-dom'],write:false}).outputFiles[0].text,'paste-style.cjs');
const targets=[{type:'heading',level:2},{type:'ordered-list-item',depth:1,start:3},{type:'unordered-list-item',depth:1},{type:'task-list-item',depth:1,checked:true},{type:'paragraph',__subtitle:true}];
function fixture(target,text=''){
 const e=withHistory(createEditor());e.wysimark={readOnly:false};loaded.exports.withBlocks(e,{});
 e.children=[{...target,__blockId:'destination',children:[{text}]}];Editor.normalize(e,{force:true});
 Transforms.select(e,Editor.start(e,[0]));e.history.undos=[];return e;
}
for(const target of targets){
 test(`body text preserves empty ${target.type} destination and undo`,()=>{
  const e=fixture(target),before=structuredClone(e.children);
  e.insertFragment([{type:'paragraph',children:[{text:'Word',bold:true}]}]);
  assert.equal(e.children[0].type,target.type);assert.equal(e.children[0].__blockId,'destination');
  assert.equal(Node.string(e.children[0]),'Word');assert.equal(e.children[0].children[0].bold,true);
  if(target.checked!==undefined)assert.equal(e.children[0].checked,target.checked);
  const after=structuredClone(e.children);e.undo();assert.deepEqual(e.children,before);e.redo();assert.deepEqual(e.children,after);
 });
 test(`partial ${target.type} copy drops block style; full copy retains it`,()=>{
  const e=fixture(target,'Two words');Transforms.select(e,{anchor:{path:[0,0],offset:4},focus:{path:[0,0],offset:9}});
  const partial=e.getFragment();assert.equal(partial[0].type,'paragraph');assert.equal(Node.string(partial[0]),'words');assert.equal(partial[0].__subtitle,undefined);
  Transforms.select(e,Editor.range(e,[0]));assert.equal(e.getFragment()[0].type,target.type);
  if(target.__subtitle)assert.equal(e.getFragment()[0].__subtitle,true);
 });
}
test('explicit source heading retains its style when pasted into a body paragraph',()=>{
 const e=fixture({type:'paragraph'});e.insertFragment([{type:'heading',level:3,children:[{text:'Heading'}]}]);
 assert.equal(e.children[0].type,'heading');assert.equal(e.children[0].level,3);
});

test('a word copied from a numbered heading carries neither heading nor list style',()=>{
 const e=fixture({type:'ordered-list-item',depth:0,blockChildren:true});
 e.children[0]={type:'ordered-list-item',depth:0,blockChildren:true,children:[{type:'heading',level:2,children:[{text:'Two words',italic:true}]}]};
 Transforms.select(e,{anchor:{path:[0,0,0],offset:4},focus:{path:[0,0,0],offset:9}});
 assert.deepEqual(e.getFragment(),[{type:'paragraph',children:[{text:'words',italic:true}]}]);
});
