const {test}=require('node:test'),assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module');
const {createEditor,Editor,Node,Range,Transforms}=require('slate'),{withHistory}=require('slate-history');
const m=new Module('image-multiselect.cjs');m.require=id=>id==='obsidian'?{getLanguage:()=> 'en'}:require(id);
m._compile(buildSync({stdin:{contents:"import {createWithSink} from './src/wysimark/sink/editor';import {BlockStructurePlugin} from './src/blocks/plugin';export const withBlocks=createWithSink([BlockStructurePlugin.fn]);export * from './src/blocks/selection';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history','slate-react','react','react-dom'],write:false}).outputFiles[0].text,'image-multiselect.cjs');
const {withBlocks,selectImageWithModifier,isWholeBlockSelected,deleteWholeBlockSelection}=m.exports;
function fixture(){const e=withHistory(createEditor());e.wysimark={readOnly:false};withBlocks(e,{});e.isVoid=n=>n.type==='image-block';e.children=[{type:'paragraph',children:[{text:'Before'}]},...['a','b','c'].flatMap(name=>[{type:'image-block',url:name+'.png',alt:name,width:120,height:80,children:[{text:''}]},{type:'paragraph',children:[{text:'Keep '+name}]}])];Editor.normalize(e,{force:true});Transforms.select(e,Editor.start(e,[1]));e.history.undos=[];return e}
const at=(e,name)=>e.children.findIndex(n=>n.url===name+'.png');
test('Ctrl image selection copies only the chosen images and toggles individual images',()=>{
 const e=fixture();selectImageWithModifier(e,at(e,'c'),false);assert(isWholeBlockSelected(e,at(e,'a')));assert(isWholeBlockSelected(e,at(e,'c')));assert(!isWholeBlockSelected(e,at(e,'b')));
 assert.deepEqual(e.getFragment().map(n=>n.url),['a.png','c.png']);
 selectImageWithModifier(e,at(e,'b'),false);assert.deepEqual(e.getFragment().map(n=>n.url),['a.png','b.png','c.png']);
 selectImageWithModifier(e,at(e,'c'),false);assert.deepEqual(e.getFragment().map(n=>n.url),['a.png','b.png']);
});
test('Shift selects the native range including prose and images, with native deletion and undo',()=>{
 const e=fixture(),before=structuredClone(e.children);selectImageWithModifier(e,at(e,'c'),true);
 assert.equal(e.selection.focus.path[0],at(e,'c')+1,JSON.stringify(e.selection));
 assert(Range.isExpanded(e.selection));assert(e.getFragment().some(n=>Node.string(n)==='Keep a'));assert(e.getFragment().some(n=>Node.string(n)==='Keep b'));
 assert.deepEqual(e.getFragment().filter(n=>n.type==='image-block').map(n=>n.url),['a.png','b.png','c.png']);
 assert.equal(deleteWholeBlockSelection(e),false);e.deleteFragment();
 assert(!e.children.some(n=>n.type==='image-block'));assert(!e.children.some(n=>Node.string(n)==='Keep b'));assert(e.children.some(n=>Node.string(n)==='Keep c'));
 e.undo();assert.deepEqual(e.children,before);
});

test('backward and repeated Shift clicks keep the original anchor and extend or shrink the whole range',()=>{
 const e=fixture();Transforms.select(e,Editor.start(e,[at(e,'c')]));
 selectImageWithModifier(e,at(e,'a'),true);assert(Range.isBackward(e.selection));assert(e.getFragment().some(n=>Node.string(n)==='Keep b'));
 selectImageWithModifier(e,at(e,'b'),true);assert.deepEqual(e.selection.anchor,Editor.after(e,[at(e,'c')],{voids:true}));
 assert.deepEqual(e.getFragment().filter(n=>n.type==='image-block').map(n=>n.url),['b.png','c.png']);assert(!e.getFragment().some(n=>Node.string(n)==='Keep a'));
});

test('Ctrl after a Shift range returns to toggling individual images',()=>{
 const e=fixture();selectImageWithModifier(e,at(e,'c'),true);selectImageWithModifier(e,at(e,'b'),false);
 assert.deepEqual(e.getFragment().map(n=>n.url),['a.png','c.png']);assert(Range.isCollapsed(e.selection));
});

test('a range starting within text deletes only its suffix and the complete ending image',()=>{
 const e=fixture(),before=structuredClone(e.children);
 Transforms.select(e,{anchor:{path:[0,0],offset:3},focus:Editor.after(e,[at(e,'b')],{voids:true})});
 e.deleteFragment();assert.equal(Node.string(e.children[0]),'Bef');
 assert.deepEqual(e.children.filter(n=>n.type==='image-block').map(n=>n.url),['c.png']);
 e.undo();assert.deepEqual(e.children,before);
});
test('modifier selection stays read-only while Shift from text retains the exact text anchor',()=>{
 const e=fixture();e.wysimark.readOnly=true;assert.equal(selectImageWithModifier(e,at(e,'b'),false),false);
 e.wysimark.readOnly=false;const anchor={path:[0,0],offset:3};Transforms.select(e,anchor);
 assert.equal(selectImageWithModifier(e,at(e,'b'),true),true);assert.deepEqual(e.selection.anchor,anchor);
 assert(e.getFragment().some(n=>Node.string(n)==='ore'));assert(e.getFragment().some(n=>Node.string(n)==='Keep a'));
});
