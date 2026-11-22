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
 import {BlockQuotePlugin} from './src/wysimark/block-quote-plugin';
 export const withBlocks=createWithSink([BlockStructurePlugin.fn,ConvertElementPlugin.fn,InlineCodePlugin.fn,HeadingPlugin.fn,CodeBlockPlugin.fn,TablePlugin.fn,TrailingBlockPlugin.fn,BlockQuotePlugin.fn,ListPlugin.fn,AtomicDeletePlugin.fn,NormalizeAfterDeletePlugin.fn,CollapsibleParagraphPlugin.fn]);
 export {blockDepth} from './src/blocks/model';
 export {sharedQuoteIndent} from './src/blocks/quote-indent';
 export {parse,serialize} from './src/wysimark/convert';
 export {createPasteMarkdownMethods} from './src/wysimark/paste-markdown-plugin/methods';
 export {selectWholeTableDrag,tableCellSelection} from './src/wysimark/table-plugin/cell-selection';
 `,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history','slate-react','react','react-dom'],write:false}).outputFiles[0].text,'empty-indent.cjs');
const {withBlocks,blockDepth,sharedQuoteIndent,parse,serialize,createPasteMarkdownMethods,selectWholeTableDrag,tableCellSelection}=loaded.exports;
const p=(text='',depth=0)=>({type:'paragraph',__blockDepth:depth,children:[{text}]});
function fixture(nodes){const e=withHistory(createEditor());e.wysimark={readOnly:false};withBlocks(e,{});e.children=nodes;Editor.normalize(e,{force:true});e.history.undos=[];Transforms.select(e,Editor.end(e,[0]));return e}
function tab(e){let prevented=false;const handled=e.sink.plugins[0].editableProps.onKeyDown({key:'Tab',nativeEvent:{},preventDefault(){prevented=true},stopPropagation(){}});assert(handled&&prevented)}

test('Tab indents only the quoted child or children touched by the range and persists the offsets',()=>{
 const e=fixture(parse('> first\n>\n> - second\n>\n> third'));
 const depths=()=>e.children[0].children.map(node=>node.__quoteIndent??0);
 Transforms.select(e,Editor.start(e,[0,1]));tab(e);assert.deepEqual(depths(),[0,1,0]);
 Transforms.select(e,{anchor:Editor.end(e,[0,1]),focus:Editor.start(e,[0,0])});tab(e);assert.deepEqual(depths(),[1,2,0]);
 assert.equal(blockDepth(e.children[0]),0);
 const saved=parse(serialize(e.children));assert.deepEqual(saved[0].children.map(node=>node.__quoteIndent??0),[1,2,0]);
 e.undo();assert.deepEqual(depths(),[0,1,0]);
});

test('the shared quote indent follows the least-indented child across separate edits and undo',()=>{
 const e=fixture(parse('> first\n>\n> second'));
 Transforms.select(e,Editor.start(e,[0,1]));tab(e);tab(e);
 assert.equal(sharedQuoteIndent(e.children[0]),0);
 Transforms.select(e,Editor.start(e,[0,0]));tab(e);
 assert.equal(sharedQuoteIndent(e.children[0]),1);
 assert.deepEqual(e.children[0].children.map(node=>node.__quoteIndent),[1,2]);
 assert.equal(sharedQuoteIndent(parse(serialize(e.children))[0]),1);
 Transforms.select(e,Editor.range(e,[0]));tab(e);
 assert.equal(sharedQuoteIndent(e.children[0]),2);
 e.undo();assert.equal(sharedQuoteIndent(e.children[0]),1);
 e.undo();assert.equal(sharedQuoteIndent(e.children[0]),0);
});

test('Backspace removes an empty quoted list marker without moving the quote bar or the previous item',()=>{
 for(const blockChildren of [false,true]) {
  const e=fixture([{type:'block-quote',children:[
   {type:'unordered-list-item',depth:0,__quoteIndent:1,children:[{text:'Previous item'}]},
   {type:'unordered-list-item',depth:0,__quoteIndent:1,...(blockChildren?{blockChildren:true}:{}),children:blockChildren?[p()]:[{text:''}]},
  ]}]);
  Transforms.select(e,Editor.start(e,[0,1]));
  const previous=e.children[0].children[0],before=structuredClone(e.children),selection=structuredClone(e.selection);
  assert.equal(sharedQuoteIndent(e.children[0]),1);
  e.deleteBackward('character');
  const quote=e.children[0],paragraph=quote.children[1];
  assert.equal(quote.type,'block-quote');assert.equal(sharedQuoteIndent(quote),1);
  assert.equal(quote.children[0],previous);assert.equal(paragraph.type,'paragraph');
  assert.equal(paragraph.__quoteIndent,1);assert.equal(Node.string(paragraph),'');
  assert.deepEqual(e.selection.anchor,Editor.start(e,[0,1]));
  e.undo();assert.deepEqual(e.children,before);assert.deepEqual(e.selection,selection);
 }
});

test('single-line text and an image replace an indented blank without losing its depth',()=>{
 const prose=fixture([p('parent'),p('',2),p('following')]);
 Transforms.select(prose,Editor.start(prose,[1]));createPasteMarkdownMethods(prose).pasteMarkdown('one line');
 assert.equal(Node.string(prose.children[1]),'one line');assert.equal(blockDepth(prose.children[1]),2);
 const images=fixture([p('parent'),p('',2),p('following')]);
 Transforms.select(images,Editor.start(images,[1]));images.insertFragment([{type:'image-block',url:'photo.png',children:[{text:''}]}]);
 const image=images.children.find(node=>node.type==='image-block');assert(image);assert.equal(blockDepth(image),2);
});

test('multiline Markdown pasted into an indented blank uses the pasted blocks’ own depths',()=>{
 for(const markdown of ['first\nsecond','first\n\nsecond']) {
  const e=fixture([p('parent'),p('',2),p('following')]);Transforms.select(e,Editor.start(e,[1]));
  createPasteMarkdownMethods(e).pasteMarkdown(markdown);
  assert.equal(blockDepth(e.children[1]),0);assert.match(Node.string(e.children[1]),/^first/);
 }
});

const markdownTable='| A | B |\n| --- | --- |\n| C | D |';
test('dragging over the complete table selects the block and deletion is undoable',()=>{
 const e=fixture(parse(`Before\n\n${markdownTable}\n\nAfter`));
 const index=e.children.findIndex(node=>node.type==='table'), path=[index];
 const partial=Editor.range(e,[index,0,0]);Transforms.select(e,partial);
 assert.equal(selectWholeTableDrag(e,path,partial),false);
 const full=Editor.range(e,path);Transforms.select(e,full);
 assert(selectWholeTableDrag(e,path,full));assert.equal(tableCellSelection(e),undefined);
 e.deleteFragment();assert(!e.children.some(node=>node.type==='table'));
 e.undo();assert.equal(Node.string(e.children[index]),'ABCD');
});

test('mixed text selection removes a fully covered table and only the selected surrounding text',()=>{
 for(const anchorInTable of [false,true]) {
  const e=fixture(parse(`Before\n\n${markdownTable}\n\nAfter`));
  const index=e.children.findIndex(node=>node.type==='table'),after=e.children.findIndex(node=>Node.string(node)==='After');
  const anchor=anchorInTable?Editor.start(e,[index]):{path:[0,0],offset:3};
  Transforms.select(e,{anchor,focus:{path:[after,0],offset:2}});e.deleteFragment();
  assert(!e.children.some(node=>node.type==='table'));
  assert.equal(e.children.map(Node.string).join(''),anchorInTable?'Beforeter':'Befter');
  e.undo();assert(e.children.some(node=>node.type==='table'));
 }
});

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

for(const type of ['ordered-list-item','unordered-list-item','task-list-item'])for(const text of ['content','']){
 test(`Backspace removes ${type} before indentation (${text?'populated':'empty'})`,()=>{
  const e=fixture([{type,depth:2,children:[{text,bold:true}]},p('child',3),p('following')]);
  Transforms.select(e,Editor.start(e,[0]));const before=structuredClone(e.children),selection=structuredClone(e.selection);
  e.deleteBackward('character');
  assert.equal(e.children[0].type,'paragraph');assert.equal(blockDepth(e.children[0]),2);
  assert.equal(Node.string(e.children[0]),text);assert.equal(e.children[0].children[0].bold,true);assert.equal(blockDepth(e.children[1]),3);
  const after=structuredClone(e.children);e.undo();assert.deepEqual(e.children,before);assert.deepEqual(e.selection,selection);e.redo();assert.deepEqual(e.children,after);
  if(!text){e.deleteBackward('character');assert.equal(blockDepth(e.children[0]),1);assert.equal(blockDepth(e.children[1]),3)}
 });
}

test('populated prose at the start does not outdent before its native merge',()=>{
 const e=fixture([p('Previous'),p('Content',2)]);Transforms.select(e,Editor.start(e,[1]));
 e.deleteBackward('character');assert.equal(e.children.length,1);assert.equal(Node.string(e.children[0]),'PreviousContent');
});

test('empty Backspace keeps descendant depths while Shift+Tab outdents the subtree',()=>{
 const nodes=()=>[p('',2),p('child',3),{type:'unordered-list-item',depth:4,children:[{text:'grandchild'}]},p('following',1)];
 const e=fixture(nodes());Transforms.select(e,Editor.start(e,[0]));const before=structuredClone(e.children),selection=structuredClone(e.selection),children=e.children.slice(1);
 e.deleteBackward('character');assert.deepEqual(e.children.map(blockDepth),[1,3,4,1]);assert(children.every((node,i)=>node===e.children[i+1]));assert.deepEqual(e.selection,selection);
 const after=structuredClone(e.children);e.undo();assert.deepEqual(e.children,before);assert.deepEqual(e.selection,selection);e.redo();assert.deepEqual(e.children,after);
 const tabbed=fixture(nodes());Transforms.select(tabbed,Editor.start(tabbed,[0]));let prevented=false;
 assert.equal(tabbed.sink.plugins[0].editableProps.onKeyDown({key:'Tab',shiftKey:true,nativeEvent:{},preventDefault(){prevented=true},stopPropagation(){}}),true);
 assert.equal(prevented,true);assert.deepEqual(tabbed.children.map(blockDepth),[1,2,3,1]);
});

test('removing a structured list retains its child blocks and their indentation',()=>{
 const e=fixture([{type:'unordered-list-item',depth:2,blockChildren:true,children:[p('content'),p('attached',3)]},p('following')]);
 Transforms.select(e,Editor.start(e,[0]));e.deleteBackward('character');
 assert.equal(e.children[0].type,'paragraph');assert.equal(Node.string(e.children[0]),'content');assert.equal(blockDepth(e.children[0]),2);
 assert.equal(Node.string(e.children[1]),'attached');assert.equal(blockDepth(e.children[1]),3);
});

for(const type of ['ordered-list-item','unordered-list-item','task-list-item'])for(const text of ['content',''])test(`Backspace removes ${type}, then quote, then empty indentation (${text?'populated':'empty'})`,()=>{
 const e=fixture([{type:'block-quote',__blockDepth:2,children:[{type,depth:2,children:[{text,bold:true}]}]},p('following')]);
 Transforms.select(e,Editor.start(e,[0]));const before=structuredClone(e.children);
 e.deleteBackward('character');assert.equal(e.children[0].type,'block-quote');assert.equal(e.children[0].children[0].type,'paragraph');assert.equal(blockDepth(e.children[0].children[0]),2);
 e.deleteBackward('character');assert.equal(e.children[0].type,'paragraph');assert.equal(blockDepth(e.children[0]),2);assert.equal(Node.string(e.children[0]),text);
 if(!text){e.deleteBackward('character');assert.equal(blockDepth(e.children[0]),1);e.undo()}
 e.undo();assert.equal(e.children[0].type,'block-quote');e.undo();assert.deepEqual(e.children,before);
});
