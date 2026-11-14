const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor,Node,Range,Transforms}=require('slate');
const {withHistory}=require('slate-history');
const loaded=new Module('clear-formatting.cjs');loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en',Platform:{isMacOS:false}}:require(id);
loaded._compile(buildSync({stdin:{contents:`
 import {createWithSink} from './src/wysimark/sink/editor';
 import {BlockStructurePlugin} from './src/blocks/plugin';import {ConvertElementPlugin} from './src/wysimark/convert-element-plugin';
 import {AnchorPlugin} from './src/wysimark/anchor-plugin';import {MarksPlugin} from './src/wysimark/marks-plugin';
 import {InlineCodePlugin} from './src/wysimark/inline-code-plugin';import {HeadingPlugin} from './src/wysimark/heading-plugin';
 import {BlockQuotePlugin} from './src/wysimark/block-quote-plugin';import {CodeBlockPlugin} from './src/wysimark/code-block-plugin';
 import {TablePlugin} from './src/wysimark/table-plugin';import {TrailingBlockPlugin} from './src/wysimark/trailing-block-plugin';
 import {ListPlugin} from './src/wysimark/list-plugin';import {AtomicDeletePlugin} from './src/wysimark/atomic-delete-plugin';
 import {NormalizeAfterDeletePlugin} from './src/wysimark/normalize-after-delete-plugin';import {CollapsibleParagraphPlugin} from './src/wysimark/collapsible-paragraph-plugin';
 export const withBlocks=createWithSink([BlockStructurePlugin.fn,ConvertElementPlugin.fn,AnchorPlugin.fn,MarksPlugin.fn,InlineCodePlugin.fn,HeadingPlugin.fn,BlockQuotePlugin.fn,CodeBlockPlugin.fn,TablePlugin.fn,TrailingBlockPlugin.fn,ListPlugin.fn,AtomicDeletePlugin.fn,NormalizeAfterDeletePlugin.fn,CollapsibleParagraphPlugin.fn]);
 export {clearFormatting} from './src/wysimark/marks-plugin/methods/clear-formatting';
 export {parse,serialize} from './src/wysimark/convert';
 export {blockDepth} from './src/blocks/model';
 `,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history','slate-react','react','react-dom'],write:false}).outputFiles[0].text,'clear-formatting.cjs');
const {withBlocks,clearFormatting,parse,serialize,blockDepth}=loaded.exports;
const rich=text=>({text,bold:true,italic:true,underline:true,strike:true,highlight:true,inlineStyle:'color:#ff0000;background-color:#00ff00'});
const p=(text,extra={})=>({type:'paragraph',...extra,children:[rich(text)]});
function fixture(nodes){const e=withHistory(createEditor());e.wysimark={readOnly:false};e.isVoid=n=>['image-block','image-inline','math-inline','math-block'].includes(n.type);e.isInline=n=>['image-inline','math-inline'].includes(n.type);withBlocks(e,{});e.children=nodes;Editor.normalize(e,{force:true});e.history.undos=[];Transforms.select(e,Editor.start(e,[0]));return e}
const plain=node=>{for(const [leaf]of Node.texts(node))for(const mark of ['bold','italic','underline','strike','highlight','inlineStyle','code','kbd','sup','sub'])assert.equal(leaf[mark],undefined,mark)};
function history(e,run){const before=structuredClone(e.children),selection=structuredClone(e.selection);run();const after=structuredClone(e.children);assert.equal(e.history.undos.length,1);e.undo();assert.deepEqual(e.children,before);assert.deepEqual(e.selection,selection);e.redo();assert.deepEqual(e.children,after)}

for(const level of [1,2,3,4,5])test(`a caret in H${level} clears the entire heading to plain body and preserves its position`,()=>{
 const e=fixture([{type:'heading',level,__blockId:'heading-id',children:[rich('first '),{text:'second',kbd:true}]}]);Transforms.select(e,{path:[0,0],offset:2});history(e,()=>clearFormatting(e));assert.equal(e.children[0].type,'paragraph');assert.equal(e.children[0].level,undefined);assert.equal(e.children[0].__blockId,'heading-id');assert.equal(Node.string(e),'first second');plain(e.children[0]);assert.equal(e.selection.anchor.offset,2);assert(Range.isCollapsed(e.selection));
});
for(const type of ['ordered-list-item','unordered-list-item','task-list-item'])for(const depth of [0,2])test(`collapsed ${type} at depth ${depth} becomes prose without changing child blocks`,()=>{
 const e=fixture([{type,depth,checked:true,__blockId:'list-id',children:[rich('list text')]},p('child',{__blockDepth:depth+1}),p('next')]);Transforms.select(e,{path:[0,0],offset:4});const child=structuredClone(e.children[1]),next=structuredClone(e.children[2]);history(e,()=>clearFormatting(e));assert.equal(e.children[0].type,'paragraph');assert.equal(blockDepth(e.children[0]),depth);assert.equal(e.children[0].__blockId,'list-id');assert.equal(e.children[0].checked,undefined);plain(e.children[0]);assert.deepEqual(e.children[1],child);assert.deepEqual(e.children[2],next);assert.equal(e.selection.anchor.offset,4);
});
test('numbered headings with attached blocks clear their whole owner while retaining identity and indentation',()=>{
 const e=fixture([{type:'ordered-list-item',blockChildren:true,depth:0,__blockId:'owner-id',children:[{type:'heading',level:2,children:[rich('title')]},p('attached',{__blockDepth:1})]},p('unrelated')]);Transforms.select(e,{path:[0,0,0],offset:2});const last=structuredClone(e.children[1]);history(e,()=>clearFormatting(e));assert.equal(e.children[0].type,'paragraph');assert.equal(e.children[1].type,'paragraph');assert.equal(e.children[0].__blockId,'owner-id');assert.equal(blockDepth(e.children[1]),1);plain(e.children[0]);plain(e.children[1]);assert.deepEqual(e.children[2],last);assert.equal(e.selection.anchor.offset,2);
});
test('subtitle flags are removed after clearing a list subtitle',()=>{
 const e=fixture([{type:'unordered-list-item',depth:0,__subtitle:true,children:[rich('subtitle')]}]);clearFormatting(e);assert.equal(e.children[0].type,'paragraph');assert.equal(e.children[0].__subtitle,undefined);plain(e.children[0]);
});
test('a caret inside inline code clears the whole paragraph, preserves links and restores the logical caret',()=>{
 const link={type:'anchor',href:'https://example.test',title:'Keep',children:[rich('link')]};
 const e=fixture([{type:'paragraph',children:[rich('before '),{type:'inline-code',children:[rich('CODE')]},rich(' '),link,rich(' after')]}]);Transforms.select(e,{path:[0,1,0],offset:2});history(e,()=>clearFormatting(e));assert.equal(Node.string(e),'before CODE link after');assert.equal([...Editor.nodes(e,{at:[],match:n=>n.type==='inline-code'})].length,0);const anchor=[...Editor.nodes(e,{at:[],match:n=>n.type==='anchor'})][0][0];assert.equal(anchor.href,link.href);assert.equal(anchor.title,'Keep');plain(e.children[0]);assert.equal(Editor.string(e,{anchor:Editor.start(e,[0]),focus:e.selection.focus}),'before CO');
});
test('a caret in an indented multiparagraph quote clears the complete block and preserves its identity',()=>{
 const e=fixture([{type:'block-quote',__blockDepth:2,__blockId:'quote-id',children:[p('first'),p('second')]},p('outside')]);Transforms.select(e,{path:[0,0,0],offset:2});history(e,()=>clearFormatting(e));assert.deepEqual(e.children.map(n=>n.type),['paragraph','paragraph','paragraph']);assert.equal(e.children[0].__blockId,'quote-id');assert.deepEqual(e.children.slice(0,2).map(blockDepth),[2,2]);plain(e.children[0]);plain(e.children[1]);assert.equal(e.children[2].children[0].bold,true);assert.equal(e.selection.anchor.offset,2);
});
test('clearing one selected quote paragraph leaves its neighboring quote paragraphs intact',()=>{
 const e=fixture([{type:'block-quote',children:[p('before'),p('middle'),p('after')]}]);Transforms.select(e,Editor.range(e,[0,1]));history(e,()=>clearFormatting(e));assert.deepEqual(e.children.slice(0,3).map(n=>n.type),['block-quote','paragraph','block-quote']);assert.deepEqual(e.children.slice(0,3).map(Node.string),['before','middle','after']);plain(e.children[1]);assert.equal(e.children[0].children[0].children[0].bold,true);assert.equal(e.children[3].__collapsible,true);
});
test('nested quotes clear to prose in one undo step',()=>{
 const e=fixture([{type:'block-quote',__blockDepth:2,children:[{type:'block-quote',children:[p('nested')]}]}]);history(e,()=>clearFormatting(e));assert.equal(e.children.length,1);assert.equal(e.children[0].type,'paragraph');assert.equal(blockDepth(e.children[0]),2);plain(e.children[0]);
});
const code=()=>({type:'code-block',language:'typescript',__blockId:'code-id',__blockDepth:1,children:[{type:'code-block-line',children:[{text:'first'}]},{type:'code-block-line',children:[{text:'second'}]}]});
test('a caret in multiline code becomes plain text with its line breaks, identity and caret retained',()=>{
 const e=fixture([code(),p('outside')]);Transforms.select(e,{path:[0,1,0],offset:2});history(e,()=>clearFormatting(e));assert.equal(e.children[0].type,'paragraph');assert.equal(e.children[0].__blockId,'code-id');assert.equal(Node.string(e.children[0]),'first\nsecond');assert.equal(blockDepth(e.children[0]),1);assert.deepEqual(e.selection.anchor,{path:[0,0],offset:8});assert.equal(e.children.length,2);
});
test('a backward selection spanning code, heading and list clears every selected block without losing text',()=>{
 const e=fixture([p('outside'),code(),{type:'heading',level:2,children:[rich('title')]},{type:'task-list-item',depth:0,checked:true,children:[rich('task')]}]);const last=e.children.length-1;Transforms.select(e,{anchor:Editor.end(e,[last]),focus:Editor.start(e,[1])});history(e,()=>clearFormatting(e));assert.deepEqual(e.children.map(n=>n.type),['paragraph','paragraph','paragraph','paragraph']);assert.deepEqual(e.children.map(Node.string),['outside','first\nsecond','title','task']);assert(Range.isBackward(e.selection));e.children.slice(1).forEach(plain);assert.equal(e.children[0].children[0].bold,true);
});
test('an endpoint at the next heading start does not reset that heading',()=>{
 const e=fixture([p('selected'),{type:'heading',level:2,children:[rich('untouched')]}]);Transforms.select(e,{anchor:Editor.start(e,[0]),focus:Editor.start(e,[1])});clearFormatting(e);plain(e.children[0]);assert.equal(e.children[1].type,'heading');assert.equal(e.children[1].children[0].bold,true);
});
const cell=text=>({type:'table-cell',children:[{type:'table-content',children:[rich(text)]}]});
const table=()=>({type:'table',headerRow:true,headerColumn:true,columns:[{align:'center'},{align:'right'}],children:[{type:'table-row',children:[{...cell('a'),x:0,y:0},{...cell('b'),x:1,y:0}]},{type:'table-row',children:[{...cell('c'),x:0,y:1},{...cell('d'),x:1,y:1}]}]});
test('a caret in a table cell clears that cell only and keeps headers, columns and neighboring cells',()=>{
 const e=fixture([table()]);Transforms.select(e,{path:[0,0,0,0,0],offset:1});const neighbor=structuredClone(e.children[0].children[0].children[1]);history(e,()=>clearFormatting(e));assert.equal(e.children[0].type,'table');assert.equal(e.children[0].headerRow,true);assert.equal(e.children[0].headerColumn,true);plain(e.children[0].children[0].children[0]);assert.deepEqual(e.children[0].children[0].children[1],neighbor);assert.deepEqual(e.selection.anchor,{path:[0,0,0,0,0],offset:1});
});
test('rectangular table selections keep their table and clear text color even in header cells',()=>{
 const e=fixture([table()]);Transforms.select(e,{anchor:Editor.start(e,[0,0,0]),focus:Editor.end(e,[0,1,1])});history(e,()=>clearFormatting(e));assert.equal(e.children[0].type,'table');assert.deepEqual(e.children[0].columns,[{align:'center'},{align:'right'}]);plain(e.children[0]);
});
test('empty formatted paragraphs and subsequent typing are fully plain',()=>{
 const e=fixture([p('')]);e.activeMarks={bold:true,highlight:true};clearFormatting(e);plain(e.children[0]);e.insertText('plain');plain(e.children[0]);assert.equal(Node.string(e),'plain');
});
test('source soft breaks and footnote reference metadata survive clearing',()=>{
 const e=fixture([{type:'paragraph',children:[rich('before'),{text:'\n',softBreak:true,bold:true},{text:'ref',footnote:'id',bold:true},rich('after')]}]);clearFormatting(e);const texts=[...Node.texts(e.children[0])].map(([n])=>n);assert(texts.some(n=>n.softBreak));assert(texts.some(n=>n.footnote==='id'));plain(e.children[0]);
});
test('clear formatting preserves image and formula nodes instead of turning them into empty prose',()=>{
 const image={type:'image-block',url:'Attachments/image.png',alt:'keep',children:[{text:''}]},math={type:'math-block',value:'x^2',children:[{text:''}]};
 const e=fixture([p('text'),image,math]);Transforms.select(e,Editor.range(e,[]));clearFormatting(e);assert.deepEqual([...Editor.nodes(e,{at:[],match:n=>n.type==='image-block'})][0][0],image);assert.deepEqual([...Editor.nodes(e,{at:[],match:n=>n.type==='math-block'})][0][0],math);
});
test('read-only and absent selections do nothing',()=>{
 for(const mode of ['readonly','missing']){const e=fixture([{type:'heading',level:2,children:[rich('keep')]}]),before=structuredClone(e.children);if(mode==='readonly')e.wysimark.readOnly=true;else Transforms.deselect(e);clearFormatting(e);assert.deepEqual(e.children,before);assert.equal(e.history.undos.length,0)}
});
test('the cleared note survives Markdown serialization with indentation and text intact',()=>{
 const e=fixture([{type:'unordered-list-item',depth:2,__blockId:'list-id',children:[rich('text')]}]);clearFormatting(e);const restored=parse(serialize(e.children));assert.equal(restored[0].type,'paragraph');assert.equal(blockDepth(restored[0]),2);assert.equal(Node.string(restored[0]),'text');plain(restored[0]);
});
