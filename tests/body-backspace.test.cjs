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
 import {ListPlugin} from './src/wysimark/list-plugin';
 import {CollapsibleParagraphPlugin} from './src/wysimark/collapsible-paragraph-plugin';
 export const withBlocks=createWithSink([BlockStructurePlugin.fn,ConvertElementPlugin.fn]);
 export const withFoldedLists=createWithSink([BlockStructurePlugin.fn,ConvertElementPlugin.fn,CollapsibleParagraphPlugin.fn,ListPlugin.fn]);
 export {deleteAtBlockBoundary} from './src/blocks/selection';
 export {blockDepth} from './src/blocks/model';
 `,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history','slate-react'],write:false}).outputFiles[0].text,'body-backspace.cjs');
const {withBlocks,withFoldedLists,deleteAtBlockBoundary,blockDepth}=loaded.exports;
const paragraph=(text,depth=0)=>({type:'paragraph',__blockDepth:depth,children:[{text}]});
function fixture(nodes,withEditor=withBlocks){const base=withHistory(createEditor());base.wysimark={readOnly:false};base.normalizeAfterDelete={};base.isInline=node=>node.type==='anchor';const editor=withEditor(base,{});editor.children=nodes;return editor}

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

for(const type of ['unordered-list-item','ordered-list-item'])for(const depth of [0,1])test(`Backspace from empty prose after folded ${type} at depth ${depth} returns to the visible parent`,()=>{
 const list=(text,at,extra={})=>({type,depth:at,__blockDepth:at,children:[{text,bold:true}],...extra});
 const e=fixture([list('Parent',depth,{__collapsed:true}),list('Child',depth+1,{__collapsed:true}),list('Grandchild',depth+2),paragraph('',depth),paragraph('Next')]);
 Transforms.select(e,Editor.start(e,[3]));const before=structuredClone(e.children),selection=structuredClone(e.selection),children=e.children.slice(0,3);
 e.deleteBackward('character');assert.equal(e.children.length,4);assert.deepEqual(e.children.slice(0,3),children);assert.deepEqual(e.selection.anchor,Editor.end(e,[0]));assert.equal(e.children[0].__collapsed,true);assert.equal(e.children[1].__collapsed,true);assert.equal(Node.string(e.children[3]),'Next');
 assert.equal(e.history.undos.length,1);const after=structuredClone(e.children);e.undo();assert.deepEqual(e.children,before);assert.deepEqual(e.selection,selection);e.redo();assert.deepEqual(e.children,after);assert.deepEqual(e.selection.anchor,Editor.end(e,[0]));
});

for(const parentType of ['unordered-list-item','ordered-list-item'])for(const blankType of ['ordered-list-item','unordered-list-item','task-list-item'])for(const depth of [0,1])test(`empty ${blankType} after folded ${parentType} at depth ${depth} clears its list before returning to the parent`,()=>{
 const list=(text,at,extra={})=>({type:parentType,depth:at,__blockDepth:at,children:[{text}],...extra});
 const e=fixture([list('Parent',depth,{__collapsed:true}),list('Child',depth+1,{__collapsed:true}),list('Grandchild',depth+2),list('',depth,{type:blankType,...(blankType==='task-list-item'?{checked:true}:{})}),paragraph('Next')],withFoldedLists);
 Editor.normalize(e,{force:true});Transforms.select(e,Editor.start(e,[3]));const parents=structuredClone(e.children.slice(0,3));
 e.deleteBackward('character');assert.equal(e.children.length,5);assert.equal(e.children[3].type,'paragraph');assert.equal(Node.string(e.children[3]),'');assert.deepEqual(e.selection.anchor,Editor.start(e,[3]));assert.deepEqual(e.children.slice(0,3),parents);
 e.deleteBackward('character');assert.equal(e.children.length,4);assert.deepEqual(e.selection.anchor,Editor.end(e,[0]));assert.deepEqual(e.children.slice(0,3),parents);
 e.undo();assert.equal(e.children[3].type,'paragraph');assert.equal(e.selection.focus.path[0],3);e.undo();assert.equal(e.children[3].type,blankType);assert.deepEqual(e.children.slice(0,3),parents);
});

test('consecutive blank rows are removed one at a time before returning to a folded parent',()=>{
 const e=fixture([{type:'unordered-list-item',depth:0,__collapsed:true,children:[{text:'Parent'}]},{type:'unordered-list-item',depth:1,children:[{text:'Child'}]},paragraph(''),paragraph('')]);Transforms.select(e,Editor.start(e,[3]));
 e.deleteBackward('character');assert.equal(e.children.length,3);assert.deepEqual(e.selection.anchor,Editor.start(e,[2]));assert.equal(e.children[0].__collapsed,true);
 e.deleteBackward('character');assert.equal(e.children.length,2);assert.deepEqual(e.selection.anchor,Editor.end(e,[0]));assert.equal(e.children[0].__collapsed,true);
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
