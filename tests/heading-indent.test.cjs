const {test}=require('node:test'),assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module');
const {createEditor,Editor,Transforms}=require('slate'),{withHistory}=require('slate-history');
const loaded=new Module('heading-indent.cjs');loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en'}:require(id);
loaded._compile(buildSync({stdin:{contents:`export {canIndentBlock,normalizeHeadingIndent,indentSelectedBlocks,changeBlockIndent,blockDragGroup,blockDropTarget,moveBlockGroup} from './src/blocks/model'; export {blockIndentItems} from './src/wysimark/toolbar-plugin/items/utility-items';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history'],write:false}).outputFiles[0].text,'heading-indent.cjs');
const {canIndentBlock,normalizeHeadingIndent,indentSelectedBlocks,changeBlockIndent,blockDragGroup,blockDropTarget,moveBlockGroup,blockIndentItems}=loaded.exports;
const p=(text,depth=0)=>({type:'paragraph',__blockDepth:depth,children:[{text}]}),heading=(level,extra={})=>({type:'heading',level,children:[{text:'title'}],...extra});
function fixture(nodes){const editor=withHistory(createEditor());editor.wysimark={readOnly:false};editor.children=nodes;Transforms.select(editor,Editor.start(editor,[0]));return editor}
const variants=[...[1,2,3,4,5,6].map(level=>heading(level)),...['hash','number'].map(style=>heading(2,{__headingList:{style,enabled:true}})),{type:'ordered-list-item',depth:0,blockChildren:true,children:[heading(2)]},{type:'ordered-list-item',depth:0,__subtitle:true,children:[{text:'subtitle'}]},p('subtitle')];variants.at(-1).__subtitle=true;
for(const [i,title]of variants.entries())test(`heading variant ${i} rejects keyboard, toolbar and block-menu indentation`,()=>{
 const editor=fixture([title,p('body')]),before=structuredClone(editor.children),undo=editor.history.undos.length;
 assert.equal(canIndentBlock(title),false);assert.equal(indentSelectedBlocks(editor,1),true);assert.equal(indentSelectedBlocks(editor,-1),true);assert.equal(changeBlockIndent(editor,0,1),false);
 assert(blockIndentItems.every(item=>item.disabled(editor)));assert.deepEqual(editor.children,before);assert.equal(editor.history.undos.length,undo);
});
test('dragging titles can reorder them but cannot indent their subtree',()=>{
 const editor=fixture([heading(2),p('child',1),p('target')]),group=blockDragGroup(editor.children,0),drop=blockDropTarget(group,2,'inside',3);
 assert.equal(drop.depth,0);assert.equal(drop.maxDepth,0);assert.equal(moveBlockGroup(editor,0,2,'inside',3),true);assert.deepEqual(editor.children.map(n=>n.__blockDepth??0),[0,0,1]);
 editor.undo();assert.equal(editor.children[0].type,'heading');assert.equal(editor.children[1].__blockDepth,1);
});
test('mixed title/body selections do not partially indent, while body-only selection remains usable',()=>{
 const editor=fixture([heading(1),p('body')]);Transforms.select(editor,{anchor:Editor.start(editor,[0]),focus:Editor.end(editor,[1])});const before=structuredClone(editor.children);
 indentSelectedBlocks(editor,1);assert.deepEqual(editor.children,before);Transforms.select(editor,Editor.start(editor,[1]));assert.equal(indentSelectedBlocks(editor,1),true);assert.equal(editor.children[1].__blockDepth,1);
});
test('a selection ending before the next title does not disable body indentation',()=>{
 const editor=fixture([p('body'),heading(1)]);Transforms.select(editor,{anchor:Editor.start(editor,[0]),focus:Editor.start(editor,[1])});
 assert.equal(blockIndentItems[1].disabled(editor),false);indentSelectedBlocks(editor,1);assert.equal(editor.children[0].__blockDepth,1);assert.equal(editor.children[1].__blockDepth,undefined);
});
test('legacy title indentation is normalized once without changing text or heading-list style',()=>{
 for(const original of variants){const node={...original,__blockDepth:2,...(original.type==='ordered-list-item'?{depth:2}:{})},editor=fixture([node]),beforeText=Editor.string(editor,Editor.range(editor,[0]));
  assert.equal(normalizeHeadingIndent(editor,[node,[0]]),true);const normalized=editor.children[0];assert.equal(normalized.__blockDepth,0);if('depth'in normalized)assert.equal(normalized.depth,0);
  assert.equal(normalizeHeadingIndent(editor,[normalized,[0]]),false);assert.equal(Editor.string(editor,Editor.range(editor,[0])),beforeText);assert.deepEqual(normalized.__headingList,original.__headingList);
 }
});
