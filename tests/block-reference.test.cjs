const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor,Node,Transforms}=require('slate');
const {withHistory}=require('slate-history');
const loaded=new Module('block-reference.cjs');
loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en'}:require(id);
loaded._compile(buildSync({stdin:{contents:`
 export * from './src/blocks/block-reference';
 export {setListBlock} from './src/blocks/list-container';
 export {parse,serialize} from './src/wysimark/convert';
 import {createWithSink} from './src/wysimark/sink/editor';
 import {BlockStructurePlugin} from './src/blocks/plugin';
 export const withBlocks=createWithSink([BlockStructurePlugin.fn]);
 `,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history'],write:false}).outputFiles[0].text,'block-reference.cjs');
const {parse,serialize,ensureBlockId,uniquePastedBlockIds,withBlocks,setListBlock}=loaded.exports;
const p=text=>({type:'paragraph',children:[{text}]});
function fixture(nodes){const base=withHistory(createEditor());base.wysimark={readOnly:false};const editor=withBlocks(base,{});editor.children=nodes;return editor}
const types=()=>[
 p('Paragraph'),{type:'heading',level:2,children:[{text:'Heading'}]},
 {type:'unordered-list-item',depth:0,children:[{text:'List item'}]},
 {type:'task-list-item',depth:0,checked:false,children:[{text:'Task'}]},
 {type:'ordered-list-item',depth:0,blockChildren:true,children:[{type:'heading',level:3,children:[{text:'Numbered heading'}]}]},
 {type:'block-quote',children:[p('Quoted text')]},
 {type:'code-block',language:'mermaid',children:[{type:'code-block-line',children:[{text:'graph LR; A-->B'}]}]},
 {type:'table',columns:[{align:'left'}],headerRow:true,children:[{type:'table-row',children:[{type:'table-cell',children:[{type:'table-content',children:[{text:'Cell'}]}]}]}]},
 {type:'image-block',url:'photo.png',children:[{text:''}]},
 {type:'math-block',latex:'E=mc^2',children:[{text:''}]},
 {type:'horizontal-rule',children:[{text:''}]},
];

for(const metadata of [false,true])test(`native block IDs round-trip across all block types (${metadata?'Blo metadata':'plain Markdown'})`,()=>{
 const nodes=types().map((node,i)=>({...node,__blockId:`test-${i}`,...(metadata?{__blockDepth:0}:{})}));
 const source=serialize(nodes),restored=parse(source);
 assert.equal(restored.length,nodes.length,source);
 for(let i=0;i<nodes.length;i++){
  assert.equal(restored[i].type,nodes[i].type);
  assert.equal(restored[i].__blockId,`test-${i}`);
  assert(!Node.string(restored[i]).includes(`^test-${i}`));
 }
 assert.deepEqual(parse(serialize(restored)).map(n=>n.__blockId),nodes.map(n=>n.__blockId));
});

test('existing inline, structured, and list-item native IDs are recognized without exposing marker text',()=>{
 const nodes=parse('Text ^existing\n\n- First ^first\n- Second ^second\n\n> Quote\n\n^quote\n');
 assert.deepEqual(nodes.map(n=>n.__blockId),['existing','first','second','quote']);
 assert.deepEqual(nodes.map(Node.string),['Text','First','Second','Quote']);
});
test('escaped/literal IDs, formulas and code samples remain text and never turn into references',()=>{
 for(const source of ['Literal \\^not-an-id','`^example`','^orphan','Text $x^2$','```text\n^code\n```']){
  const nodes=parse(source),restored=parse(serialize(nodes));
  assert(nodes.every(n=>!n.__blockId));assert(restored.every(n=>!n.__blockId));
  assert.deepEqual(restored.map(Node.string),nodes.map(Node.string));
 }
});
test('copy assigns one stable ID in one undo unit and preserves selection',()=>{
 const editor=fixture([p('Target'),p('Other')]);Transforms.select(editor,{path:[0,0],offset:2});
 const selection=structuredClone(editor.selection),id=ensureBlockId(editor,editor.children[0]);
 assert.match(id,/^blo-[a-z0-9]+$/);assert.deepEqual(editor.selection,selection);
 const undoCount=editor.history.undos.length;
 assert.equal(ensureBlockId(editor,editor.children[0]),id);assert.equal(editor.history.undos.length,undoCount);
 editor.undo();assert.equal(editor.children[0].__blockId,undefined);
 editor.redo();assert.equal(editor.children[0].__blockId,id);
});
for(const offset of [0,2])test(`splitting a referenced paragraph at ${offset} avoids duplicate IDs and supports undo/redo`,()=>{
 const editor=fixture([{...p('Target'),__blockId:'original'}]);
 Transforms.select(editor,{path:[0,0],offset});const before=structuredClone(editor.children);
 editor.insertBreak();const after=structuredClone(editor.children);
 assert.equal(editor.children.filter(n=>n.__blockId==='original').length,1);
 assert.equal(editor.children[offset===0?1:0].__blockId,'original',JSON.stringify({children:editor.children,operations:editor.operations}));
 editor.undo();assert.deepEqual(editor.children,before);
 editor.redo();assert.deepEqual(editor.children,after);
});
test('undoing a merge restores both original block IDs',()=>{
 const editor=fixture([{...p('First'),__blockId:'one'},{...p('Second'),__blockId:'two'}]);
 Transforms.select(editor,Editor.start(editor,[1]));const before=structuredClone(editor.children);
 editor.deleteBackward('character');assert.equal(editor.children.length,1);editor.undo();assert.deepEqual(editor.children,before);
});
test('copy/paste removes colliding IDs while cut/paste preserves available IDs',()=>{
 const editor=fixture([{...p('Existing'),__blockId:'same'}]);
 const fragment=[{...p('Copied'),__blockId:'same'},{...p('Cut'),__blockId:'available'}];
 const result=uniquePastedBlockIds(editor,fragment);
 assert.equal(result[0].__blockId,undefined);assert.equal(result[1].__blockId,'available');
 assert.equal(fragment[0].__blockId,'same','source fragment must remain immutable');
});
test('changing paragraph/list/numbered-heading styles keeps exactly one block ID',()=>{
 for(const source of [{...p('Content'),__blockId:'stable'},{type:'heading',level:2,children:[{text:'Title'}],__blockId:'stable'}]){
  const editor=fixture([source]);Transforms.select(editor,Editor.start(editor,[0]));
  Editor.withoutNormalizing(editor,()=>setListBlock(editor,editor.children[0],[0],'ordered-list-item'));
  assert.equal(editor.children[0].__blockId,'stable');
  assert.equal([...Node.elements(editor)].filter(([node])=>node.__blockId==='stable').length,1);
  assert.equal((serialize(editor.children).match(/\^stable/g)||[]).length,1);
  Editor.withoutNormalizing(editor,()=>setListBlock(editor,editor.children[0],[0]));
  assert.equal(editor.children[0].__blockId,'stable');
  assert.equal([...Node.elements(editor)].filter(([node])=>node.__blockId==='stable').length,1);
 }
});
test('an emptied referenced paragraph cannot accidentally assign its ID to the preceding block',()=>{
 const restored=parse(serialize([p('Previous'),{...p(''),__blockId:'empty'}]));
 assert(restored.every(node=>!node.__blockId));
});
