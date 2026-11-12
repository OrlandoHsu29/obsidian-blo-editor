const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor,Node,Transforms}=require('slate');
const {withHistory}=require('slate-history');
const loaded=new Module('body-backspace.cjs');
loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en'}:require(id);
loaded._compile(buildSync({stdin:{contents:`
 import {createWithSink} from './src/wysimark/sink/editor';
 import {BlockStructurePlugin} from './src/blocks/plugin';
 import {ConvertElementPlugin} from './src/wysimark/convert-element-plugin';
 export const withBlocks=createWithSink([BlockStructurePlugin.fn,ConvertElementPlugin.fn]);
 export {deleteAtBlockBoundary} from './src/blocks/selection';
 export {blockDepth} from './src/blocks/model';
 `,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history','slate-react'],write:false}).outputFiles[0].text,'body-backspace.cjs');
const {withBlocks,deleteAtBlockBoundary,blockDepth}=loaded.exports;
const paragraph=(text,depth=0)=>({type:'paragraph',__blockDepth:depth,children:[{text}]});
function fixture(nodes){const base=withHistory(createEditor());base.wysimark={readOnly:false};base.isInline=node=>node.type==='anchor';const editor=withBlocks(base,{});editor.children=nodes;return editor}

test('first Backspace outdents populated prose, second merges into the previous block',async()=>{
 const e=fixture([paragraph('Before'),paragraph('Body',1)]);Transforms.select(e,Editor.start(e,[1]));const original=structuredClone(e.children);
 e.deleteBackward('character');assert.equal(e.children.length,2);assert.equal(blockDepth(e.children[1]),0);assert.equal(Node.string(e.children[1]),'Body');assert.deepEqual(e.selection.anchor,{path:[1,0],offset:0});
 const outdented=structuredClone(e.children);await Promise.resolve();e.deleteBackward('character');assert.equal(e.children.length,1);assert.equal(Node.string(e.children[0]),'BeforeBody');assert.equal(e.selection.anchor.offset,6);
 e.undo();assert.deepEqual(e.children,outdented);e.undo();assert.deepEqual(e.children,original);
});

test('multiple indentation levels require one Backspace each before merging',()=>{
 const e=fixture([paragraph('Before'),paragraph('Body',2)]);Transforms.select(e,Editor.start(e,[1]));
 for(const depth of [1,0]){e.deleteBackward('character');assert.equal(e.children.length,2);assert.equal(blockDepth(e.children[1]),depth)}
 e.deleteBackward('character');assert.equal(Node.string(e.children[0]),'BeforeBody');
});

test('outdenting prose moves its descendants exactly like Shift+Tab',()=>{
 const e=fixture([paragraph('Before'),paragraph('Body',1),{type:'unordered-list-item',depth:2,__blockDepth:2,children:[{text:'child'}]},paragraph('attached',3),paragraph('Next')]);
 Transforms.select(e,Editor.start(e,[1]));const before=structuredClone(e.children);e.deleteBackward('character');assert.deepEqual(e.children.map(blockDepth),[0,0,1,2,0]);assert.deepEqual(e.children.map(Node.string),['Before','Body','child','attached','Next']);e.undo();assert.deepEqual(e.children,before);
});

test('deleting inside a populated block removes text without changing indentation',()=>{
 const e=fixture([paragraph('Before'),paragraph('Body',1)]);Transforms.select(e,{path:[1,0],offset:2});e.deleteBackward('character');assert.equal(Node.string(e.children[1]),'Bdy');assert.equal(blockDepth(e.children[1]),1);
});

test('a later marked leaf is not mistaken for the start of its block',()=>{
 const e=fixture([paragraph('Before'),{type:'paragraph',__blockDepth:1,children:[{text:'First'},{text:'Second',bold:true}]}]);Transforms.select(e,{path:[1,1],offset:0});e.deleteBackward('character');assert.equal(blockDepth(e.children[1]),1);assert.equal(Node.string(e.children[1]),'FirsSecond');
});

test('the first block can outdent without any previous block',()=>{
 const e=fixture([paragraph('Body',1)]);Transforms.select(e,Editor.start(e,[0]));e.deleteBackward('character');assert.equal(blockDepth(e.children[0]),0);assert.equal(Node.string(e.children[0]),'Body');
});

test('empty indented prose retains its one-level Backspace behavior',()=>{
 const e=fixture([paragraph('Before'),paragraph('',1)]);Transforms.select(e,Editor.start(e,[1]));e.deleteBackward('character');assert.equal(e.children.length,2);assert.equal(blockDepth(e.children[1]),0);
});

test('expanded text selection is deleted without outdenting the block',()=>{
 const e=fixture([paragraph('Before'),paragraph('Body',1)]);Transforms.select(e,{anchor:{path:[1,0],offset:0},focus:{path:[1,0],offset:2}});e.deleteFragment();assert.equal(Node.string(e.children[1]),'dy');assert.equal(blockDepth(e.children[1]),1);
});

test('structured block contents keep their own Backspace rules',()=>{
 const e=fixture([paragraph('Before'),{type:'code-block',__blockDepth:1,language:'text',children:[{text:'code'}]}]);Transforms.select(e,Editor.start(e,[1]));assert.equal(deleteAtBlockBoundary(e),false);assert.equal(blockDepth(e.children[1]),1);
});

test('a leading inline link after an empty boundary is still at the text start',()=>{
 const e=fixture([paragraph('Before'),{type:'paragraph',__blockDepth:1,children:[{text:''},{type:'anchor',href:'https://example.com',children:[{text:'Link'}]},{text:''}]}]);
 Transforms.select(e,{path:[1,1,0],offset:0});e.deleteBackward('character');assert.equal(e.children.length,2);assert.equal(blockDepth(e.children[1]),0);assert.equal(Node.string(e.children[1]),'Link');
});
