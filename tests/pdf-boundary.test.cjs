const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor,Node,Transforms}=require('slate');
const {withHistory}=require('slate-history');
const loaded=new Module('pdf-boundary.cjs');
loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en'}:require(id);
loaded._compile(buildSync({stdin:{contents:`
import {createWithSink} from './src/wysimark/sink/editor';
import {BlockStructurePlugin} from './src/blocks/plugin';
import {ConvertElementPlugin} from './src/wysimark/convert-element-plugin';
import {InlineCodePlugin} from './src/wysimark/inline-code-plugin';
import {CodeBlockPlugin} from './src/wysimark/code-block-plugin';
import {TablePlugin} from './src/wysimark/table-plugin';
import {AtomicDeletePlugin} from './src/wysimark/atomic-delete-plugin';
import {NormalizeAfterDeletePlugin} from './src/wysimark/normalize-after-delete-plugin';
import {CollapsibleParagraphPlugin} from './src/wysimark/collapsible-paragraph-plugin';
export const withBlocks=createWithSink([BlockStructurePlugin.fn,ConvertElementPlugin.fn,InlineCodePlugin.fn,CodeBlockPlugin.fn,TablePlugin.fn,AtomicDeletePlugin.fn,NormalizeAfterDeletePlugin.fn,CollapsibleParagraphPlugin.fn]);
export {selectStructuredBoundary,boundaryBlockIndex,takeBoundaryInputScroll} from './src/blocks/boundary';
export {navigateBlockBoundary,isWholeBlockSelected} from './src/blocks/selection';
export {wikiEmbedUrl} from './src/wysimark/convert/obsidian-links';
`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-react','slate-history','react','react-dom'],write:false}).outputFiles[0].text,'pdf-boundary.cjs');
const {withBlocks,selectStructuredBoundary,boundaryBlockIndex,takeBoundaryInputScroll,navigateBlockBoundary,isWholeBlockSelected,wikiEmbedUrl}=loaded.exports;
function fixture(url=wikiEmbedUrl('attachments/manual.pdf')){
 const e=withHistory(createEditor());e.wysimark={readOnly:false};e.normalizeAfterDelete={};
 e.isVoid=n=>['image-inline','image-block'].includes(n.type);e.isInline=n=>n.type==='image-inline';withBlocks(e,{});
 e.children=[{type:'image-block',url,children:[{text:''}]},{type:'paragraph',children:[{text:'After',bold:true}]}];
 Editor.normalize(e,{force:true});e.history.undos=[];return e;
}
test('PDF right-side caret uses a real shared boundary and two Backspaces',()=>{
 const e=fixture(),pdf=e.children[0];assert.equal(selectStructuredBoundary(e,0),true);assert.equal(boundaryBlockIndex(e),0);
 e.deleteBackward('character');assert.equal(e.children[0],pdf);assert.equal(isWholeBlockSelected(e,0),true);
 const before=structuredClone(e.children);e.deleteBackward('character');assert.equal(e.children.some(n=>n.type==='image-block'),false);e.undo();assert.deepEqual(e.children,before);
});

test('boundary input requests nearest scrolling only for the new text row',()=>{
 const e=fixture();selectStructuredBoundary(e,0);assert.equal(takeBoundaryInputScroll(e),false);
 e.insertText('First');assert.equal(takeBoundaryInputScroll(e),true);assert.equal(takeBoundaryInputScroll(e),false);
 e.insertText(' second');assert.equal(takeBoundaryInputScroll(e),false);
 selectStructuredBoundary(e,0);e.insertText('Next');Transforms.select(e,Editor.end(e,[]));
 assert.equal(takeBoundaryInputScroll(e),false,'a later unrelated selection must retain normal scrolling');
});

for(const [name,url] of [['PDF',wikiEmbedUrl('attachments/manual.pdf')],['drawing',wikiEmbedUrl('attachments/diagram.excalidraw.md')],['image','attachments/photo.png']]){
 test(`typing at the right boundary of ${name} creates a separate text block and supports undo`,()=>{
  const e=fixture(url);selectStructuredBoundary(e,0);const before=structuredClone(e.children);
  e.insertText('正文');assert.equal(e.children[0].type,'image-block');assert.equal(e.children[0].url,url);
  const row=e.children.find(n=>Node.string(n)==='正文');assert.equal(row.type,'paragraph');assert.equal(row.__collapsible,undefined);
  assert.equal(Node.string(e.children.at(-1)),'After');const after=structuredClone(e.children);
  e.undo();assert.deepEqual(e.children,before);e.redo();assert.deepEqual(e.children,after);
 });
 test(`pasting text at the right boundary of ${name} keeps media and text in separate blocks`,()=>{
  const e=fixture(url);selectStructuredBoundary(e,0);
  e.insertFragment([{type:'paragraph',children:[{text:'Pasted',italic:true}]}]);
  assert.equal(e.children[0].type,'image-block');assert.equal(e.children[0].url,url);
  const row=e.children.find(n=>Node.string(n)==='Pasted');assert.equal(row.type,'paragraph');assert.equal(row.children.at(-1).italic,true);
  assert.equal(Node.string(e.children.at(-1)),'After');
 });
 test(`Backspace at the following row does not merge text into ${name}`,()=>{
  const e=fixture(url),index=e.children.findIndex(n=>Node.string(n)==='After');Transforms.select(e,Editor.start(e,[index]));
  e.deleteBackward('character');assert.equal(e.children[0].type,'image-block');assert.equal(e.children[0].url,url);
  const row=e.children.find(n=>Node.string(n)==='After');assert.equal(row.type,'paragraph');assert.deepEqual(row.children,[{text:'After',bold:true}]);
  assert.equal([...Node.elements(e)].some(([n])=>n.type==='image-inline'),false);
 });
}
test('Left from the next paragraph enters the PDF right boundary',()=>{
 const e=fixture(),index=e.children.findIndex(n=>Node.string(n)==='After');Transforms.select(e,Editor.start(e,[index]));
 assert.equal(navigateBlockBoundary(e,{key:'ArrowLeft'}),true);assert.equal(boundaryBlockIndex(e),0);
});
test('Left from a selected first media block does not enter a left-side void caret',()=>{
 const e=fixture();selectStructuredBoundary(e,0);navigateBlockBoundary(e,{key:'ArrowLeft'});
 assert.equal(isWholeBlockSelected(e,0),true);navigateBlockBoundary(e,{key:'ArrowLeft'});assert.equal(isWholeBlockSelected(e,0),true);
});

test('Left from selected media goes to preceding text instead of its left-side void',()=>{
 const e=fixture();Transforms.insertNodes(e,{type:'paragraph',children:[{text:'Before'}]},{at:[0]});selectStructuredBoundary(e,1);
 navigateBlockBoundary(e,{key:'ArrowLeft'});assert.equal(isWholeBlockSelected(e,1),true);
 navigateBlockBoundary(e,{key:'ArrowLeft'});assert.deepEqual(e.selection.anchor,{path:[0,0],offset:6});assert.equal(isWholeBlockSelected(e,1),false);
});

for(const block of [
 {type:'code-block',language:'text',children:[{text:'Code'}]},
 {type:'table',columns:[{align:'left'}],children:[{type:'table-row',children:[{type:'table-cell',x:0,y:0,children:[{type:'table-content',children:[{text:'Cell'}]}]}]}]},
])test(`typing at the right boundary of ${block.type} creates a separate text paragraph`,()=>{
 const e=fixture();e.children=[structuredClone(block),{type:'paragraph',children:[{text:'After'}]}];Editor.normalize(e,{force:true});
 selectStructuredBoundary(e,0);e.insertText('New row');assert.equal(e.children[0].type,block.type);
 const row=e.children[e.selection.anchor.path[0]];assert.equal(row.type,'paragraph');assert.equal(Node.string(row),'New row');assert.equal(row.__collapsible,undefined);
});
