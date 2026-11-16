const {test}=require('node:test'),assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module');
const {createEditor,Editor,Transforms}=require('slate'),{withHistory}=require('slate-history');
const m=new Module('image-multiselect.cjs');m.require=id=>id==='obsidian'?{getLanguage:()=> 'en'}:require(id);
m._compile(buildSync({stdin:{contents:"import {createWithSink} from './src/wysimark/sink/editor';import {BlockStructurePlugin} from './src/blocks/plugin';export const withBlocks=createWithSink([BlockStructurePlugin.fn]);export * from './src/blocks/selection';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history','slate-react','react','react-dom'],write:false}).outputFiles[0].text,'image-multiselect.cjs');
const {withBlocks,selectImageWithModifier,isWholeBlockSelected,deleteWholeBlockSelection}=m.exports;
function fixture(){const e=withHistory(createEditor());e.wysimark={readOnly:false};e.isVoid=n=>n.type==='image-block';withBlocks(e,{});e.children=[{type:'paragraph',children:[{text:'Before'}]},...['a','b','c'].flatMap(name=>[{type:'image-block',url:name+'.png',alt:name,width:120,height:80,children:[{text:''}]},{type:'paragraph',children:[{text:'Keep '+name}]}])];Editor.normalize(e,{force:true});Transforms.select(e,Editor.start(e,[1]));e.history.undos=[];return e}
const at=(e,name)=>e.children.findIndex(n=>n.url===name+'.png');
test('Ctrl image selection copies only the chosen images and toggles individual images',()=>{
 const e=fixture();selectImageWithModifier(e,at(e,'c'),false);assert(isWholeBlockSelected(e,at(e,'a')));assert(isWholeBlockSelected(e,at(e,'c')));assert(!isWholeBlockSelected(e,at(e,'b')));
 assert.deepEqual(e.getFragment().map(n=>n.url),['a.png','c.png']);
 selectImageWithModifier(e,at(e,'b'),false);assert.deepEqual(e.getFragment().map(n=>n.url),['a.png','b.png','c.png']);
 selectImageWithModifier(e,at(e,'c'),false);assert.deepEqual(e.getFragment().map(n=>n.url),['a.png','b.png']);
});
test('Shift selects the image range and deletion preserves intervening prose with one undo',()=>{
 const e=fixture(),before=structuredClone(e.children);selectImageWithModifier(e,at(e,'c'),true);assert.deepEqual(e.getFragment().map(n=>n.url),['a.png','b.png','c.png']);
 assert.equal(deleteWholeBlockSelection(e),true);assert(!e.children.some(n=>n.type==='image-block'));assert(e.children.some(n=>n.children[0].text==='Keep b'));e.undo();assert.deepEqual(e.children,before);
});
test('modifier selection remains read-only and Shift from ordinary text keeps native selection',()=>{
 const e=fixture();e.wysimark.readOnly=true;assert.equal(selectImageWithModifier(e,at(e,'b'),false),false);
 e.wysimark.readOnly=false;Transforms.select(e,Editor.start(e,[0]));assert.equal(selectImageWithModifier(e,at(e,'b'),true),false);
});
