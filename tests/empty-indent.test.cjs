const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor,Node,Transforms}=require('slate');
const {withHistory}=require('slate-history');
const loaded=new Module('empty-indent.cjs');
loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en'}:require(id);
loaded._compile(buildSync({stdin:{contents:`
 import {createWithSink} from './src/wysimark/sink/editor';
 import {BlockStructurePlugin} from './src/blocks/plugin';
 import {ConvertElementPlugin} from './src/wysimark/convert-element-plugin';
 import {InlineCodePlugin} from './src/wysimark/inline-code-plugin';
 import {HeadingPlugin} from './src/wysimark/heading-plugin';
 import {CodeBlockPlugin} from './src/wysimark/code-block-plugin';
 import {TablePlugin} from './src/wysimark/table-plugin';
 import {TrailingBlockPlugin} from './src/wysimark/trailing-block-plugin';
 import {ListPlugin} from './src/wysimark/list-plugin';
 import {AtomicDeletePlugin} from './src/wysimark/atomic-delete-plugin';
 import {NormalizeAfterDeletePlugin} from './src/wysimark/normalize-after-delete-plugin';
 import {CollapsibleParagraphPlugin} from './src/wysimark/collapsible-paragraph-plugin';
 export const withBlocks=createWithSink([BlockStructurePlugin.fn,ConvertElementPlugin.fn,InlineCodePlugin.fn,HeadingPlugin.fn,CodeBlockPlugin.fn,TablePlugin.fn,TrailingBlockPlugin.fn,ListPlugin.fn,AtomicDeletePlugin.fn,NormalizeAfterDeletePlugin.fn,CollapsibleParagraphPlugin.fn]);
 export {blockDepth} from './src/blocks/model';
 `,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history','slate-react','react','react-dom'],write:false}).outputFiles[0].text,'empty-indent.cjs');
const {withBlocks,blockDepth}=loaded.exports;
const p=(text='',depth=0)=>({type:'paragraph',__blockDepth:depth,children:[{text}]});
function fixture(nodes){const e=withHistory(createEditor());e.wysimark={readOnly:false};withBlocks(e,{});e.children=nodes;Editor.normalize(e,{force:true});e.history.undos=[];Transforms.select(e,Editor.end(e,[0]));return e}
function tab(e){let prevented=false;const handled=e.sink.plugins[0].editableProps.onKeyDown({key:'Tab',nativeEvent:{},preventDefault(){prevented=true},stopPropagation(){}});assert(handled&&prevented)}

test('Tab then Enter returns an empty paragraph to its original indentation without adding a row',()=>{
 const e=fixture([p(),p('following')]);tab(e);assert.equal(blockDepth(e.children[0]),1);e.insertBreak();
 assert.equal(e.children.length,2);assert.equal(blockDepth(e.children[0]),0);assert.equal(Node.string(e.children[1]),'following');assert.deepEqual(e.selection.anchor,{path:[0,0],offset:0});
});
test('successive Enter presses outdent one level each, then create a normal blank row at depth zero',()=>{
 const e=fixture([p()]);tab(e);tab(e);tab(e);
 for(const depth of [2,1,0]){e.insertBreak();assert.equal(blockDepth(e.children[0]),depth);assert.equal(e.children.length,1)}
 e.insertBreak();assert.equal(e.children.length,2);assert.equal(blockDepth(e.children[1]),0);
});
test('empty Enter is one undo step and preserves inline marks, identity and selection',()=>{
 const node=p('',2);node.__blockId='keep';node.children[0].bold=true;const e=fixture([node]),before=structuredClone(e.children),selection=structuredClone(e.selection);
 e.insertBreak();assert.equal(blockDepth(e.children[0]),1);assert.equal(e.children[0].__blockId,'keep');assert.equal(e.children[0].children[0].bold,true);assert.equal(e.history.undos.length,1);
 const after=structuredClone(e.children);e.undo();assert.deepEqual(e.children,before);assert.deepEqual(e.selection,selection);e.redo();assert.deepEqual(e.children,after);
});
test('outdenting an empty parent reuses subtree indentation without moving or deleting children',()=>{
 const e=fixture([p('',1),p('child',2),p('following')]);e.insertBreak();assert.deepEqual(e.children.map(blockDepth),[0,1,0]);assert.deepEqual(e.children.map(Node.string),['','child','following']);
});
test('typing after Tab and pressing Enter at the end creates a new paragraph at the same depth',()=>{
 const e=fixture([p()]);tab(e);e.insertText('content');e.insertBreak();assert.equal(e.children.length,2);assert.equal(Node.string(e.children[0]),'content');assert.equal(Node.string(e.children[1]),'');assert.deepEqual(e.children.map(blockDepth),[1,1]);assert.equal(e.selection.anchor.path[0],1);
});
test('clearing typed text makes Enter outdent again without tracking input history',()=>{
 const e=fixture([p()]);tab(e);e.insertText('content');Transforms.select(e,Editor.range(e,[0]));e.deleteFragment();e.insertBreak();assert.equal(e.children.length,1);assert.equal(blockDepth(e.children[0]),0);
});
test('splitting populated prose in the middle keeps both halves at the same indentation',()=>{
 const e=fixture([p('abcd',2)]);Transforms.select(e,{path:[0,0],offset:2});e.insertBreak();assert.deepEqual(e.children.map(Node.string),['ab','cd']);assert.deepEqual(e.children.map(blockDepth),[2,2]);
});
test('an expanded selection is replaced by a break instead of triggering empty-block outdent',()=>{
 const e=fixture([p('text',2)]);Transforms.select(e,Editor.range(e,[0]));e.insertBreak();assert.equal(e.children.length,2);assert.deepEqual(e.children.map(blockDepth),[2,2]);
});
test('Shift+Enter retains soft-break behavior in an empty indented paragraph',()=>{
 const e=fixture([p('',2)]);e.insertSoftBreak();assert.equal(e.children.length,1);assert.equal(blockDepth(e.children[0]),2);assert.equal(Node.string(e.children[0]),'\n');
});
for(const type of ['ordered-list-item','unordered-list-item','task-list-item']){
 test(`${type} keeps its empty-item outdent and populated-item continuation`,()=>{
  const e=fixture([{type,depth:1,children:[{text:''}]}]);e.insertBreak();assert.equal(e.children.length,1);assert.equal(e.children[0].type,type);assert.equal(blockDepth(e.children[0]),0);
  tab(e);e.insertText('item');e.insertBreak();assert.equal(e.children.length,2);assert.equal(e.children[1].type,type);assert.deepEqual(e.children.map(blockDepth),[1,1]);
 });
}
test('Enter inside an indented code block retains its code-frame behavior',()=>{
 const e=fixture([{type:'code-block',language:'text',__blockDepth:2,children:[{type:'code-block-line',children:[{text:'code'}]}]}]);e.insertBreak();assert.equal(e.children[0].type,'code-block');assert.equal(blockDepth(e.children[0]),2);assert.equal(e.children[0].children.length,2);
});
