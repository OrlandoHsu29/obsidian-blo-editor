const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor,Node,Range,Transforms}=require('slate');
const {withHistory}=require('slate-history');
const loaded=new Module('content-selection.cjs');loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en',Platform:{isMacOS:false}}:require(id);
loaded._compile(buildSync({stdin:{contents:`
 import {createWithSink} from './src/wysimark/sink/editor';
 import {BlockStructurePlugin} from './src/blocks/plugin';import {ConvertElementPlugin} from './src/wysimark/convert-element-plugin';
 import {InlineCodePlugin} from './src/wysimark/inline-code-plugin';import {HeadingPlugin} from './src/wysimark/heading-plugin';
 import {CodeBlockPlugin} from './src/wysimark/code-block-plugin';import {ListPlugin} from './src/wysimark/list-plugin';
 import {TablePlugin} from './src/wysimark/table-plugin';import {AtomicDeletePlugin} from './src/wysimark/atomic-delete-plugin';
 import {NormalizeAfterDeletePlugin} from './src/wysimark/normalize-after-delete-plugin';import {CollapsibleParagraphPlugin} from './src/wysimark/collapsible-paragraph-plugin';
 import {TrailingBlockPlugin} from './src/wysimark/trailing-block-plugin';
 export const withBlocks=createWithSink([BlockStructurePlugin.fn,ConvertElementPlugin.fn,InlineCodePlugin.fn,HeadingPlugin.fn,CodeBlockPlugin.fn,TablePlugin.fn,TrailingBlockPlugin.fn,ListPlugin.fn,AtomicDeletePlugin.fn,NormalizeAfterDeletePlugin.fn,CollapsibleParagraphPlugin.fn]);
 export {selectBlockOrDocument,selectBlockContents,isWholeBlockSelected,indentBlockSelection,navigateBlockBoundary} from './src/blocks/selection';
 `,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history','slate-react','react','react-dom'],write:false}).outputFiles[0].text,'content-selection.cjs');
const {withBlocks,selectBlockOrDocument,selectBlockContents,isWholeBlockSelected,indentBlockSelection,navigateBlockBoundary}=loaded.exports;
const p=text=>({type:'paragraph',children:[{text}]}),text=()=>[{text:'rich ',bold:true},{text:'content',italic:true}];
function fixture(node){const e=withHistory(createEditor());e.wysimark={getBlockSelectShortcut:()=>true};withBlocks(e,{});e.children=[p('before'),node,p('after')];Editor.normalize(e,{force:true});e.history.undos=[];e.operations=[];Transforms.select(e,Editor.start(e,[1]));return e}
for(const type of ['ordered-list-item','unordered-list-item','task-list-item'])test(`Ctrl+A then Backspace clears ${type} content, second Backspace removes the marker`,()=>{
 const e=fixture({type,depth:0,checked:type==='task-list-item'?true:undefined,__blockId:'keep',children:text()}),before=structuredClone(e.children);
 selectBlockOrDocument(e);assert.equal(isWholeBlockSelected(e,1),false);assert.equal(Editor.string(e,e.selection),'rich content');assert.deepEqual(e.children,before);
 e.deleteFragment({direction:'backward'});assert.equal(e.children[1].type,type);assert.equal(e.children[1].__blockId,'keep');assert.equal(Node.string(e.children[1]),'');assert.equal(Node.string(e.children[0]),'before');assert.equal(Node.string(e.children[2]),'after');assert.equal(e.history.undos.length,1);
 const empty=structuredClone(e.children);e.undo();assert.deepEqual(e.children,before);e.redo();assert.deepEqual(e.children,empty);e.deleteBackward('character');assert.equal(e.children[1].type,'paragraph');assert.equal(Node.string(e.children[0]),'before');
});
for(const type of ['ordered-list-item','unordered-list-item','task-list-item'])test(`an indented empty ${type} removes its marker without requiring extra outdent presses`,()=>{
 const e=fixture({type,depth:2,checked:false,children:text()});selectBlockOrDocument(e);e.deleteFragment({direction:'backward'});assert.equal(e.children[1].type,type);assert.equal(e.children[1].depth,2);e.deleteBackward('character');assert.equal(e.children[1].type,'paragraph');assert.equal(e.children[1].__blockDepth,2);
});
for(const numbered of [false,true])test(`first deletion keeps ${numbered?'numbered':'hash'} heading style; second removes only its prefix`,()=>{
 const heading={type:'heading',level:2,children:text()},node=numbered?{type:'ordered-list-item',blockChildren:true,depth:0,children:[heading]}:heading,e=fixture(node);
 selectBlockOrDocument(e);e.deleteFragment({direction:'backward'});const target=numbered?e.children[1].children[0]:e.children[1];assert.equal(target.type,'heading');assert.equal(target.level,2);assert.equal(target.__headingList?.enabled!==false,true);assert.equal(Node.string(target),'');if(numbered)assert.equal(e.children[1].type,'ordered-list-item');
 e.deleteBackward('character');assert.equal(e.children[1].type,'heading');assert.equal(e.children[1].level,2);assert.equal(e.children[1].__headingList.enabled,false);
});
test('a multiline code block loses its code text, retaining language, block identity and its frame',()=>{
 const e=fixture({type:'code-block',language:'typescript',__blockId:'code-id',children:[{type:'code-block-line',children:[{text:'const a = 1'}]},{type:'code-block-line',children:[{text:'return a'}]}]}),before=structuredClone(e.children);
 selectBlockOrDocument(e);assert.equal(isWholeBlockSelected(e,1),false);e.deleteFragment({direction:'backward'});assert.equal(e.children[1].type,'code-block');assert.equal(e.children[1].language,'typescript');assert.equal(e.children[1].__blockId,'code-id');assert.equal(Node.string(e.children[1]),'');assert.equal(e.children[1].children.length,1);assert.equal(e.history.undos.length,1);e.undo();assert.deepEqual(e.children,before);
});
test('content selection does not delete a parent list\'s descendants; block-handle selection still does',()=>{
 const e=fixture({type:'unordered-list-item',depth:0,children:text()});Transforms.insertNodes(e,{type:'unordered-list-item',depth:1,children:[{text:'child'}]},{at:[2]});Transforms.select(e,Editor.start(e,[1]));
 selectBlockOrDocument(e);e.deleteFragment({direction:'backward'});assert.equal(Node.string(e.children[2]),'child');assert.equal(e.children[2].depth,1);
 selectBlockContents(e,1);assert.equal(isWholeBlockSelected(e,1),true);e.deleteFragment();assert(!e.children.some(n=>Node.string(n)==='child'));
});
test('an expanded contents range remains ordinary text formatting and the second Ctrl+A selects the document',()=>{
 const e=fixture({type:'ordered-list-item',depth:0,children:text()});selectBlockOrDocument(e);Transforms.setNodes(e,{bold:true},{match:n=>!!n.text,split:true});assert.equal(e.children[1].type,'ordered-list-item');assert(e.children[1].children.every(n=>n.bold));selectBlockOrDocument(e);assert.deepEqual(Range.edges(e.selection),Range.edges(Editor.range(e,[])));
});
for(const single of [false,true])test(`second Ctrl+A includes every block's structure and deletes the full ${single?'single-block':'multi-block'} document in one undo`,()=>{
 const e=fixture({type:'ordered-list-item',depth:0,children:text()});if(single){Transforms.deselect(e);e.children=[{type:'ordered-list-item',depth:0,children:text()}]};Transforms.select(e,Editor.start(e,[single?0:1]));e.history.undos=[];e.operations=[];const before=structuredClone(e.children);
 selectBlockOrDocument(e);assert.equal(isWholeBlockSelected(e,single?0:1),false);selectBlockOrDocument(e);for(let i=0;i<e.children.length;i++)assert.equal(isWholeBlockSelected(e,i),true);
 e.deleteFragment({direction:'backward'});assert.equal(e.children.length,1);assert.equal(e.children[0].type,'paragraph');assert.equal(Node.string(e),'');assert.equal(e.history.undos.length,1);e.undo();assert.deepEqual(e.children,before);e.redo();assert.equal(e.children.length,1);assert.equal(e.children[0].type,'paragraph');
});
test('full-document deletion removes a leading code frame and its indentation',()=>{
 const e=fixture({type:'code-block',language:'javascript',__blockDepth:2,children:[{type:'code-block-line',children:[{text:'code'}]}]});Transforms.removeNodes(e,{at:[0]});Transforms.select(e,Editor.start(e,[0]));const before=structuredClone(e.children);e.history.undos=[];e.operations=[];
 selectBlockOrDocument(e);selectBlockOrDocument(e);e.deleteFragment();assert.equal(e.children.length,1);assert.equal(e.children[0].type,'paragraph');assert.equal(e.children[0].__blockDepth??0,0);assert.equal(Node.string(e),'');assert.equal(e.history.undos.length,1);e.undo();assert.deepEqual(e.children,before);
});
test('indenting a document selection keeps every block selected',()=>{
 const e=fixture({type:'ordered-list-item',depth:0,children:text()});selectBlockOrDocument(e);selectBlockOrDocument(e);indentBlockSelection(e,1);assert.deepEqual(Range.edges(e.selection),Range.edges(Editor.range(e,[])));assert(e.children.every((_,index)=>isWholeBlockSelected(e,index)));
});
test('document-wide arrow navigation does not enter its first code block',()=>{
 const e=fixture({type:'code-block',language:'text',children:[{type:'code-block-line',children:[{text:'code'}]}]});Transforms.removeNodes(e,{at:[0]});Transforms.select(e,Editor.start(e,[0]));selectBlockOrDocument(e);selectBlockOrDocument(e);const range=structuredClone(e.selection);assert.equal(navigateBlockBoundary(e,{key:'ArrowRight'}),false);assert.deepEqual(e.selection,range);
});
test('removing an empty final code frame removes its obsolete insertion line in the same undo',()=>{
 const e=fixture({type:'code-block',language:'javascript',children:[{type:'code-block-line',children:[{text:'code'}]}]});Transforms.removeNodes(e,{at:[e.children.length-1]});Editor.normalize(e,{force:true});Transforms.select(e,Editor.start(e,[1]));assert.equal(e.children.at(-1).__collapsible,true);
 selectBlockOrDocument(e);e.deleteFragment({direction:'backward'});assert.equal(e.children[1].type,'code-block');assert.equal(e.children.at(-1).__collapsible,true);const before=structuredClone(e.children);e.history.undos=[];e.operations=[];e.deleteBackward('character');assert.equal(e.children[1].type,'paragraph');assert.equal(e.children.length,2);assert(!e.children.some(n=>n.__collapsible));assert.equal(e.history.undos.length,1);e.undo();assert.deepEqual(e.children,before);e.redo();assert(!e.children.some(n=>n.__collapsible));
});
test('normalization preserves real blank paragraphs and necessary boundaries after code',()=>{
 const code={type:'code-block',language:'text',children:[{type:'code-block-line',children:[{text:'keep'}]}]},e=fixture(code);assert.equal(e.children[2].__collapsible,true);assert.equal(e.children[1].type,'code-block');
 Transforms.insertNodes(e,p(''),{at:[e.children.length]});Editor.normalize(e,{force:true});assert.equal(e.children.at(-1).type,'paragraph');assert.equal(e.children.at(-1).__collapsible,undefined);assert.equal(Node.string(e.children.at(-1)),'');
});
