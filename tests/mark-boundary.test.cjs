const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor,Node,Transforms}=require('slate');
const {withHistory}=require('slate-history');
const loaded=new Module('mark-boundary.cjs');
loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en'}:require(id);
loaded._compile(buildSync({stdin:{contents:`
 import {createWithSink} from './src/wysimark/sink/editor';
 import {MarkBoundaryPlugin} from './src/wysimark/marks-plugin/mark-boundary';
 import {ConvertElementPlugin} from './src/wysimark/convert-element-plugin';
 import {MarksPlugin} from './src/wysimark/marks-plugin';
 import {HeadingPlugin} from './src/wysimark/heading-plugin';
 import {ListPlugin} from './src/wysimark/list-plugin';
 export const withColors=createWithSink([MarkBoundaryPlugin.fn,ConvertElementPlugin.fn,MarksPlugin.fn,HeadingPlugin.fn,ListPlugin.fn]);
 export {MarkBoundaryPlugin};
 export {applyTextColor} from './src/wysimark/marks-plugin/methods/text-color';
 export {parse,serialize} from './src/wysimark/convert';
 `,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history'],write:false}).outputFiles[0].text,'mark-boundary.cjs');
const {withColors,MarkBoundaryPlugin,applyTextColor,parse,serialize}=loaded.exports;
const red='color:#FF0000';
const paragraph=(text,extra={})=>({type:'paragraph',children:[{text,inlineStyle:red,...extra}]});
function fixture(nodes){const base=withHistory(createEditor());base.wysimark={readOnly:false};const editor=withColors(base,{});editor.children=nodes;return editor}
const color=leaf=>leaf.inlineStyle?.split(';').find(part=>part.startsWith('color:'));

for(const type of ['paragraph','unordered-list-item','ordered-list-item','task-list-item']){
 test(`Enter from red ${type} creates an uncolored empty block that stays uncolored after selection sync`,()=>{
  const node={...paragraph('red',{bold:true}),type,...(type==='paragraph'?{}:{depth:0}),...(type==='task-list-item'?{checked:true}:{})};
  const editor=fixture([node]);Transforms.select(editor,Editor.end(editor,[0]));const before=structuredClone(editor.children),selection=structuredClone(editor.selection);
  editor.insertBreak();assert.equal(editor.children.length,2);assert.equal(color(Node.leaf(editor,editor.selection.anchor.path)),undefined);
  // A fresh DOM selection must not revive the split leaf's previous foreground.
  editor.marks=null;Transforms.select(editor,Editor.start(editor,[1]));editor.insertText('plain');
  assert.equal(Node.string(editor.children[1]),'plain');assert.equal(color(editor.children[1].children[0]),undefined);assert(!editor.children[1].children[0].bold);
  assert.equal(editor.children[1].type,type);if(type==='task-list-item')assert.equal(editor.children[1].checked,false);
  assert.equal(color(editor.children[0].children[0]),red);assert.equal(editor.pathRefs().size,0);
  editor.undo();assert.deepEqual(editor.children,before);assert.deepEqual(editor.selection,selection);
  const restored=parse(serialize([node,{type:'paragraph',children:[{text:'plain'}]}]));assert.equal(color(restored[1].children[0]),undefined);
 });
}

test('same-block typing and soft line breaks keep red foreground',()=>{
 const editor=fixture([paragraph('red')]);Transforms.select(editor,Editor.end(editor,[0]));editor.insertText(' more');editor.insertText('\n');editor.insertText('same block');
 assert.equal(editor.children.length,1);assert.equal(Node.string(editor.children[0]),'red more\nsame block');assert(editor.children[0].children.every(leaf=>color(leaf)===red));
});

test('choosing red at an uncolored block end does not carry that pending color into the next block',()=>{
 const editor=fixture([{type:'paragraph',children:[{text:'plain'}]}]);Transforms.select(editor,Editor.end(editor,[0]));applyTextColor(editor,'#FF0000');editor.insertBreak();editor.insertText('new');assert.equal(color(editor.children[1].children[0]),undefined);
});

test('splitting colored content preserves existing text colors without coloring newly typed text',()=>{
 const editor=fixture([paragraph('abcdef')]);Transforms.select(editor,{path:[0,0],offset:3});editor.insertBreak();
 assert.equal(Node.string(editor.children[1]),'def');assert.equal(color(editor.children[1].children[0]),red);
 editor.insertText('new ');assert.equal(Node.string(editor.children[1]),'new def');assert.equal(color(editor.children[1].children[0]),undefined);assert.equal(color(editor.children[1].children[1]),red);
});

test('new blocks clear background color and bold as well as foreground',()=>{
 const editor=fixture([paragraph('red',{bold:true,inlineStyle:red+';background-color:#FFFF00'})]);Transforms.select(editor,Editor.end(editor,[0]));editor.insertBreak();const leaf=Node.leaf(editor,editor.selection.anchor.path);
 assert.equal(color(leaf),undefined);assert(!leaf.bold);assert(!leaf.inlineStyle);
});

test('heading to new paragraph does not inherit red',()=>{
 const editor=fixture([{...paragraph('title'),type:'heading',level:1}]);Transforms.select(editor,Editor.end(editor,[0]));editor.insertBreak();editor.insertText('body');assert.equal(editor.children[1].type,'paragraph');assert.equal(color(editor.children[1].children[0]),undefined);
});

test('an Enter handler that inserts a soft break in the same block retains red',()=>{
 const editor=fixture([paragraph('cell')]);Transforms.select(editor,Editor.end(editor,[0]));
 // Use the same callback policy with a handled, in-block Enter, as table/code handlers do.
 const policy=MarkBoundaryPlugin.fn(editor);const done=policy.editor.insertBreak();editor.insertText('\n');done();editor.insertText('continued');assert.equal(editor.children.length,1);assert(editor.children[0].children.every(leaf=>color(leaf)===red));
});

for(const mark of ['bold','italic','underline','strike','highlight','code','kbd','sup','sub'])test(`a new block does not inherit ${mark}`,()=>{
 const editor=fixture([paragraph('styled',{[mark]:true})]);Transforms.select(editor,Editor.end(editor,[0]));editor.insertBreak();editor.marks=null;editor.select(Editor.start(editor,[1]));editor.insertText('plain');
 assert(!editor.children[1].children[0][mark]);assert.equal(editor.children[0].children[0][mark],true);
});

test('sticky toolbar marks reset on a block break but remain active during same-block typing',()=>{
 const editor=fixture([paragraph('styled')]);Transforms.select(editor,Editor.end(editor,[0]));editor.activeMarks={bold:true,strike:true};editor.insertText(' more');assert.equal(editor.children[0].children.at(-1).bold,true);editor.insertBreak();editor.insertText('plain');assert(!editor.children[1].children[0].bold);assert(!editor.children[1].children[0].strike);assert.deepEqual(editor.activeMarks,{});
});

test('mid-block splits retain existing rich text but start newly typed text without marks',()=>{
 const editor=fixture([paragraph('abcdef',{bold:true,strike:true})]);Transforms.select(editor,{path:[0,0],offset:3});editor.insertBreak();editor.insertText('plain ');const leaves=editor.children[1].children;
 assert(!leaves[0].bold);assert(!leaves[0].strike);assert.equal(leaves[1].bold,true);assert.equal(leaves[1].strike,true);assert.equal(leaves[1].text,'def');
});
