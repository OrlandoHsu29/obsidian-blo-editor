const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor,Node,Range,Transforms}=require('slate');
const {withHistory}=require('slate-history');

const loaded=new Module('quote-boundary.cjs');
loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en'}:require(id);
loaded._compile(buildSync({stdin:{contents:`
 import {createWithSink} from './src/wysimark/sink/editor';
 import {ConvertElementPlugin} from './src/wysimark/convert-element-plugin';
 import {BlockQuotePlugin} from './src/wysimark/block-quote-plugin';
 import {AtomicDeletePlugin} from './src/wysimark/atomic-delete-plugin';
 import {NormalizeAfterDeletePlugin} from './src/wysimark/normalize-after-delete-plugin';
 export const withQuotes=createWithSink([ConvertElementPlugin.fn,BlockQuotePlugin.fn,AtomicDeletePlugin.fn,NormalizeAfterDeletePlugin.fn]);
 export {handleLinkKey} from './src/wysimark/anchor-plugin/link-keyboard';
 `,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history','slate-react'],write:false}).outputFiles[0].text,'quote-boundary.cjs');
const {withQuotes,handleLinkKey}=loaded.exports;
const paragraph=text=>({type:'paragraph',children:[{text}]});
const quote=(...children)=>({type:'block-quote',children});
const link=()=>({type:'anchor',href:'https://example.com',title:'Example',children:[{text:'Example',bold:true}]});
const linkedParagraph=()=>({type:'paragraph',children:[{text:''},link(),{text:''}]});
function fixture(children,point){
 const base=withHistory(createEditor());
 base.isInline=node=>node.type==='anchor';
 const editor=withQuotes(base,{});
 editor.convertElement.addConvertElementType('paragraph');
 editor.wysimark={readOnly:false};
 editor.children=children;
 Transforms.select(editor,point);
 return editor;
}
function backspace(editor){
 if(handleLinkKey(editor,'Backspace'))return;
 if(editor.selection&&Range.isExpanded(editor.selection))editor.deleteFragment({direction:'backward'});
 else editor.deleteBackward('character');
}

for(const insideLink of [false,true]){
 test(`first Backspace removes quote at ${insideLink?'link start':'empty boundary'} without changing text`,()=>{
  const content=linkedParagraph();
  const editor=fixture([paragraph('Previous!'),quote(content)],{path:insideLink?[1,0,1,0]:[1,0,0],offset:0});
  const before=structuredClone(editor.children),selection=structuredClone(editor.selection);
  backspace(editor);
  assert.deepEqual(editor.children,[before[0],content]);
  assert.equal(Node.string(editor.children[0]),'Previous!');
  assert.equal(editor.selection.anchor.offset,0);
  const after=structuredClone(editor.children);
  editor.undo();assert.deepEqual(editor.children,before);assert.deepEqual(editor.selection,selection);
  editor.redo();assert.deepEqual(editor.children,after);
 });
}

test('next Backspace merges the unquoted link without deleting the previous last character',()=>{
 const editor=fixture([paragraph('Previous!'),quote(linkedParagraph())],{path:[1,0,0],offset:0});
 backspace(editor);backspace(editor);
 assert.equal(editor.children.length,1);
 assert.equal(editor.children[0].type,'paragraph');
 assert.equal(Node.string(editor.children[0]),'Previous!Example');
 assert.deepEqual(editor.children[0].children.find(node=>node.type==='anchor'),link());
});

test('only the first paragraph leaves a multi-paragraph quote',()=>{
 const content=linkedParagraph(),following=paragraph('Still quoted');
 const editor=fixture([paragraph('Previous!'),quote(content,following)],{path:[1,0,0],offset:0});
 backspace(editor);
 assert.deepEqual(editor.children,[paragraph('Previous!'),content,quote(following)]);
});

test('nested quote loses one level per Backspace',()=>{
 const content=linkedParagraph();
 const editor=fixture([quote(quote(content))],{path:[0,0,0,0],offset:0});
 backspace(editor);assert.deepEqual(editor.children,[quote(content)]);
 backspace(editor);assert.deepEqual(editor.children,[content]);
});

test('plain text and empty quote also leave the quote on first Backspace',()=>{
 for(const text of ['Text','']){
  const content=paragraph(text),editor=fixture([quote(content)],{path:[0,0,0],offset:0});
  backspace(editor);assert.deepEqual(editor.children,[content]);
 }
});

test('normal deletion within a link keeps its quote and metadata',()=>{
 const editor=fixture([quote(linkedParagraph())],{path:[0,0,1,0],offset:3});
 backspace(editor);
 assert.equal(editor.children[0].type,'block-quote');
 assert.equal(editor.children[0].children[0].children[1].href,'https://example.com');
 assert.equal(Node.string(editor.children[0]),'Exmple');
});

test('later quoted paragraphs still merge within their quote',()=>{
 const editor=fixture([quote(paragraph('First!'),linkedParagraph())],{path:[0,1,0],offset:0});
 backspace(editor);
 assert.equal(editor.children[0].type,'block-quote');
 assert.equal(editor.children[0].children.length,1);
 assert.equal(Node.string(editor.children[0]),'First!Example');
});

test('expanded selection deletes text without removing the quote',()=>{
 const editor=fixture([quote(paragraph('Example'))],{path:[0,0,0],offset:0});
 Transforms.select(editor,{anchor:{path:[0,0,0],offset:0},focus:{path:[0,0,0],offset:2}});
 backspace(editor);
 assert.deepEqual(editor.children,[quote(paragraph('ample'))]);
});

test('a preceding inline image is content, not an empty link boundary',()=>{
 const editor=fixture([quote({type:'paragraph',children:[
  {text:''},{type:'image-inline',url:'photo.png',children:[{text:''}]},{text:''},link(),{text:''},
 ]})],{path:[0,0,3,0],offset:0});
 const isInline=editor.isInline;
 editor.isInline=node=>node.type==='image-inline'||isInline(node);
 editor.isVoid=node=>node.type==='image-inline';
 backspace(editor);
 assert.equal(editor.children[0].type,'block-quote');
});
