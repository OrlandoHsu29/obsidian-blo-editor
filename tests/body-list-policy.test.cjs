const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor,Node,Transforms}=require('slate');
const {withHistory}=require('slate-history');
const loaded=new Module('body-list-policy.cjs');
loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en'}:require(id);
loaded._compile(buildSync({stdin:{contents:`
 import {createWithSink} from './src/wysimark/sink/editor';
 import {ConvertElementPlugin} from './src/wysimark/convert-element-plugin';
 import {ListPlugin} from './src/wysimark/list-plugin';
 import {HeadingPlugin} from './src/wysimark/heading-plugin';
 import {NormalizeAfterDeletePlugin} from './src/wysimark/normalize-after-delete-plugin';
 import {CollapsibleParagraphPlugin} from './src/wysimark/collapsible-paragraph-plugin';
 export const withLists=createWithSink([ConvertElementPlugin.fn,HeadingPlugin.fn,NormalizeAfterDeletePlugin.fn,CollapsibleParagraphPlugin.fn,ListPlugin.fn]);
 export {normalizeOrderedText,resolveOrderedNumbers,rootCache,blockDepth} from './src/blocks/model';
 export {parse,serialize} from './src/wysimark/convert';
 `,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history'],write:false}).outputFiles[0].text,'body-list-policy.cjs');
const {withLists,normalizeOrderedText,resolveOrderedNumbers,rootCache,blockDepth,parse,serialize}=loaded.exports;
const paragraph=text=>({type:'paragraph',children:[{text,bold:true}]});
const item=(start=99,extra={})=>({type:'ordered-list-item',depth:0,start,__numbering:'explicit',children:[{text:'body',bold:true}],...extra});
function fixture(nodes){const base=withHistory(createEditor());base.wysimark={readOnly:false};const editor=withLists(base,{});editor.convertElement.addConvertElementType('paragraph');editor.children=nodes;return editor}

for(const number of [1,9,10,98,99])test(`${number}. space converts body text to a numbered item`,()=>{
 const editor=fixture([paragraph(number+'. text')]);Transforms.select(editor,Editor.end(editor,[0]));assert.equal(normalizeOrderedText(editor,[editor.children[0],[0]]),true);
 assert.equal(editor.children[0].type,'ordered-list-item');assert.equal(editor.children[0].start,number);assert.equal(Node.string(editor.children[0]),'text');assert.equal(editor.children[0].children[0].bold,true);
});
for(const number of [0,100,101,999,999999,1000000])test(`${number}. space remains literal body text`,()=>{
 const editor=fixture([paragraph(number+'. text')]),before=structuredClone(editor.children);Transforms.select(editor,Editor.end(editor,[0]));assert.equal(normalizeOrderedText(editor,[editor.children[0],[0]]),false);
 assert.deepEqual(editor.children,before);assert.equal(editor.history.undos.length,0);
 const restored=parse(serialize(editor.children));assert.equal(restored[0].type,'paragraph');assert.equal(Node.string(restored[0]),number+'. text');
});

test('98 continues to 99 and the next filled item exits to body rather than 100',()=>{
 const editor=fixture([item(98)]);Transforms.select(editor,Editor.end(editor,[0]));editor.insertBreak();editor.insertText('last');
 assert.equal(resolveOrderedNumbers(editor.children).numbers.get(editor.children[1]),99);editor.insertBreak();
 assert.equal(editor.children[2].type,'paragraph');assert.equal(Node.string(editor.children[2]),'');assert.equal(editor.children[2].children[0].bold,true);
});

for(const depth of [0,2])test(`99 Enter preserves indentation ${depth}, content and undo`,()=>{
 const editor=fixture([item(99,{depth})]);Transforms.select(editor,Editor.end(editor,[0]));const before=structuredClone(editor.children),selection=structuredClone(editor.selection);editor.insertBreak();
 assert.equal(editor.children[1].type,'paragraph');assert.equal(editor.children[1].__blockDepth,depth);assert.equal(editor.children[1].__numbering,undefined);
 assert.equal(editor.history.undos.length,1);editor.undo();assert.deepEqual(editor.children,before);assert.deepEqual(editor.selection,selection);editor.redo();assert.equal(editor.children[1].type,'paragraph');
});

test('splitting item 99 in the middle preserves trailing text as ordinary body',()=>{
 const editor=fixture([item()]);Transforms.select(editor,{path:[0,0],offset:2});editor.insertBreak();assert.equal(Node.string(editor.children[0]),'bo');assert.equal(editor.children[1].type,'paragraph');assert.equal(Node.string(editor.children[1]),'dy');
});

test('nested containers resolve their own current number before splitting',()=>{
 const editor=fixture([{type:'block-quote',children:[item()]}]);Transforms.select(editor,Editor.end(editor,[0,0]));editor.insertBreak();assert.equal(editor.children[0].children[1].type,'paragraph');
});

test('structured body lists retain their attached paragraphs when reaching the limit',()=>{
 const editor=fixture([item(99,{blockChildren:true,children:[paragraph('body'),paragraph('attached')]})]);Transforms.select(editor,Editor.end(editor,[0,0]));editor.insertBreak();
 assert.equal(editor.children[1].type,'paragraph');assert.equal(Node.string(editor.children[2]),'attached');assert.equal(Node.string(editor.children[0]),'body');
});

for(const level of [1,5])test(`H${level} numbering is independent of the body limit`,()=>{
 const editor=fixture([item(99,{blockChildren:true,children:[{type:'heading',level,children:[{text:'heading'}]}]})]);Transforms.select(editor,{path:[0,0,0],offset:3});editor.insertBreak();assert.equal(editor.children[1].type,'ordered-list-item');assert.equal(editor.children[1].children[0].type,'heading');assert.equal(resolveOrderedNumbers(editor.children).numbers.get(editor.children[1]),100);
});

test('existing imported starts are preserved, but Enter does not extend them past the limit',()=>{
 const editor=fixture([item(100)]);Transforms.select(editor,Editor.end(editor,[0]));editor.insertBreak();assert.equal(editor.children[0].start,100);assert.equal(editor.children[1].type,'paragraph');
});

for(const type of ['unordered-list-item','ordered-list-item','task-list-item'])for(const action of ['insertBreak','deleteBackward'])for(const explicit of [false,true])test(`${type} empty ${action} synchronizes both indentation fields (${explicit?'shared':'legacy'} depth)`,()=>{
 const parent={type:'unordered-list-item',depth:0,children:[{text:'parent'}]};
 const child={type,depth:1,...(explicit?{__blockDepth:1}:{}),children:[{text:''}]};
 const editor=fixture([parent,child]);require('slate-history').HistoryEditor.withoutSaving(editor,()=>Editor.normalize(editor,{force:true}));Transforms.select(editor,Editor.start(editor,[1]));
 const before=structuredClone(editor.children);
 assert.equal(rootCache(editor).listGuides.get(editor.children[1]),1);
 if(action==='deleteBackward')editor.deleteBackward('character');else editor.insertBreak();
 const depth=action==='deleteBackward'?1:0,guide=depth?1:undefined;
 assert.equal(editor.children[1].type,action==='deleteBackward'?'paragraph':type);assert.equal(blockDepth(editor.children[1]),depth);
 assert.equal(rootCache(editor).listGuides.get(editor.children[1]),guide);
 assert.equal(blockDepth(parse(serialize(editor.children))[1]),depth);
 editor.undo();assert.deepEqual(editor.children,before);assert.equal(rootCache(editor).listGuides.get(editor.children[1]),1);
 editor.redo();assert.equal(blockDepth(editor.children[1]),depth);assert.equal(rootCache(editor).listGuides.get(editor.children[1]),guide);
});

test('successive empty Enter presses remove one shared indentation level at a time',()=>{
 const editor=fixture([item(1),{type:'unordered-list-item',depth:1,__blockDepth:1,children:[{text:'parent'}]},
  {type:'unordered-list-item',depth:2,__blockDepth:2,children:[{text:''}]}]);
 Transforms.select(editor,Editor.start(editor,[2]));editor.insertBreak();assert.equal(blockDepth(editor.children[2]),1);
 assert.equal(rootCache(editor).listGuides.get(editor.children[2]),1);
 editor.insertBreak();assert.equal(blockDepth(editor.children[2]),0);assert.equal(rootCache(editor).listGuides.get(editor.children[2]),undefined);
 editor.insertBreak();assert.equal(editor.children[2].type,'paragraph');assert.equal(blockDepth(editor.children[2]),0);
});
