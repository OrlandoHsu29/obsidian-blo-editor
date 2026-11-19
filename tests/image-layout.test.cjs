const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor,Node,Transforms}=require('slate');
const {withHistory,HistoryEditor}=require('slate-history');

const loaded=new Module('image-layout.cjs');
loaded.require=id=>{
 if(id==='obsidian')return {getLanguage:()=> 'en'};
 // Resolve rendered-node paths without mounting React; all transforms use real Slate.
 if(id==='slate-react')return {ReactEditor:{toDOMNode(editor,element){
  return {querySelector:()=>editor.imageRects?.get(element.url)};
 },findPath(editor,element){
  for(const [node,path] of Node.nodes(editor))if(node===element)return path;
  throw new Error('Image is not in the editor');
 }}};
 return require(id);
};
loaded._compile(buildSync({stdin:{contents:`
 export {convertToBlockImage} from './src/wysimark/image-plugin/render-element/image-with-controls/image-toolbar/image-type-buttons/convert-to-block-image';
 export {insertImageRow,imageRowDropTarget,moveImageToBlock} from './src/blocks/image-row';
 export {rowImages} from './src/wysimark/image-plugin/row-model';
 export {navigateBlockBoundary} from './src/blocks/selection';
 export {BlockStructurePlugin} from './src/blocks/plugin';
 export {createWithSink} from './src/wysimark/sink/editor';
 export {normalizeSiblingWalls} from './src/wysimark/collapsible-paragraph-plugin/normalize-node/normalize-sibling-walls';
 export {parse,serialize} from './src/wysimark/convert';
 `,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history','slate-react','react','react-dom'],write:false}).outputFiles[0].text,'image-layout.cjs');
const {convertToBlockImage}=loaded.exports;

function fixture(children){
 const editor=withHistory(createEditor());
 editor.isInline=node=>node.type==='image-inline';
 editor.isVoid=node=>['image-inline','image-block'].includes(node.type);
 editor.children=children;
 return editor;
}
const image=dimensions=>({type:'image-block',url:'attachments/photo.png',alt:'Photo',title:'Title',...dimensions,children:[{text:''}]});
const findImage=editor=>[...Node.elements(editor)].find(([node])=>['image-inline','image-block'].includes(node.type));

const namedImage = name => ({...image(),url:`attachments/${name}.png`});
const paragraph = text => ({type:'paragraph',children:[{text}]});
const imageRow = editor => editor.children.find(node=>node.type==='image-row');
const pictures = editor => loaded.exports.rowImages(imageRow(editor));
function rowFixture(children) {
 const editor = fixture(children);
 editor.wysimark = {};
 const {createWithSink,BlockStructurePlugin,normalizeSiblingWalls}=loaded.exports;
 createWithSink([BlockStructurePlugin.fn, e=>({editor:{normalizeNode:entry=>normalizeSiblingWalls(e,entry)}})])(editor,{});
 Editor.normalize(editor,{force:true});
 editor.operations=[];editor.history.undos=[];
 return editor;
}

test('image paste at the right caret groups pictures and text still starts a separate paragraph',()=>{
 const editor=rowFixture([namedImage('one'),paragraph('After')]);
 Transforms.select(editor,Editor.start(editor,[1]));
 editor.insertFragment([namedImage('two')]);
 assert.deepEqual(pictures(editor).map(node=>node.url),['attachments/one.png','attachments/two.png']);
 assert.deepEqual(editor.selection.anchor.path,[1,0]);
 editor.insertText('New text');
 assert.equal(pictures(editor).length,2);
 assert(editor.children.some(node=>node.type==='paragraph'&&Node.string(node)==='New text'));
});

test('moving to either side preserves order and supports undo and redo',()=>{
 for(const slot of [0,1]){
  const editor=rowFixture([namedImage('one'),namedImage('two'),paragraph('After')]);
  const before=structuredClone(editor.children),source=editor.children[0],index=editor.children.findIndex(node=>node.url?.endsWith('/two.png'));
  assert(loaded.exports.insertImageRow(editor,{index,slot},[source],[0]));
  const expected=slot===0?['one','two']:['two','one'];
  assert.deepEqual(pictures(editor).map(node=>node.url),expected.map(name=>`attachments/${name}.png`));
  const after=structuredClone(editor.children);
  editor.undo();assert.deepEqual(editor.children,before);
  editor.redo();assert.deepEqual(editor.children,after);
 }
});

test('Markdown round trips a multi-image row with separate image dimensions',()=>{
 const {parse,serialize}=loaded.exports;
 const source='![[a.png|240x160]] ![Other](b.png#srcSize=800x800&size=160x160) ![[c.png]]\n\nAfter\n';
 const options={enableInternalLinks:true},nodes=parse(source,options),row=nodes[0];
 assert.equal(row.type,'image-row');assert.equal(loaded.exports.rowImages(row).length,3);
 assert.deepEqual(loaded.exports.rowImages(row).map(node=>node.width),[240,160,undefined]);
 assert.deepEqual(parse(serialize(nodes,options),options),nodes);
});

test('normalizing a row after its images are removed preserves a pasted paragraph',()=>{
 const editor=rowFixture([{type:'image-row',children:[{type:'image-row-caret',children:[{text:''}]},paragraph('Keep this text')]}]);
 assert.deepEqual(editor.children.filter(node=>Node.string(node)),[paragraph('Keep this text')]);
 assert.equal(imageRow(editor),undefined);
});

test('an inserted image matches the stationary image height without changing its size',()=>{
 const editor=rowFixture([{...namedImage('one'),width:200,height:100},paragraph('After')]);
 Transforms.select(editor,Editor.start(editor,[1]));
 editor.insertFragment([{...namedImage('two'),srcWidth:180,srcHeight:360}]);
 assert.deepEqual(pictures(editor).map(({width,height})=>[width,height]),[[200,100],[50,100]]);
});

test('the tallest image determines the incoming height even when its neighbor is shorter',()=>{
 const {parse}=loaded.exports;
 const editor=rowFixture(parse('![A](a.png#srcSize=240x480&size=200x400) ![B](b.png#srcSize=400x400&size=180x180)'));
 Transforms.select(editor,Editor.start(editor,[1]));
 editor.insertFragment([{...namedImage('C'),srcWidth:200,srcHeight:400}]);
 assert.deepEqual(pictures(editor).map(({width,height})=>[width,height]),[[200,400],[180,180],[200,400]]);
});

test('reordering inside one row moves the existing images without changing their sizes',()=>{
 const {parse,insertImageRow}=loaded.exports;
 for(const [from,slot,order] of [[0,3,[1,2,0]],[2,0,[2,0,1]]]){
  const editor=rowFixture(parse('![A](a.png#srcSize=400x400&size=110x110) ![B](b.png#srcSize=500x500&size=250x250) ![C](c.png)'));
  const before=pictures(editor);
  assert(insertImageRow(editor,{index:0,slot},[before[from]],[0,from*2+1]));
  assert.deepEqual(pictures(editor),order.map(index=>before[index]));
  pictures(editor).forEach((image,index)=>assert.equal(image,before[order[index]]));
  assert.deepEqual(editor.history.undos[0].operations.map(op=>op.type),['move_node','move_node']);
  editor.undo();assert.deepEqual(pictures(editor),before);
  editor.redo();assert.deepEqual(pictures(editor),order.map(index=>before[index]));
 }
});

test('moving an image out of a row makes a standalone block at the drop boundary',()=>{
 const {parse,moveImageToBlock}=loaded.exports;
 const editor=rowFixture(parse('![A](a.png) ![B](b.png#srcSize=400x400&size=160x160)\n\nAbove drop\n\nBelow drop'));
 const before=structuredClone(editor.children);
 const target=editor.children.findIndex(node=>Node.string(node)==='Below drop');
 assert(moveImageToBlock(editor,[0,3],target,1));
 const imageBlocks=editor.children.filter(node=>node.type==='image-block');
 assert.deepEqual(imageBlocks.map(node=>node.alt),['A','B']);
 assert.equal(imageBlocks[1].width,160);
 assert.equal(imageBlocks[1].__blockDepth,1);
 assert.equal(Node.string(editor.children[editor.children.indexOf(imageBlocks[1])-1]),'Above drop');
 editor.undo();assert.deepEqual(editor.children,before);
});

test('deleting from a fitted row preserves the displayed dimensions through singleton conversion and undo',()=>{
 const {parse}=loaded.exports;
 const editor=rowFixture(parse('![A](a.png#srcSize=400x400&size=400x400) ![B](b.png#srcSize=800x400&size=600x300) ![C](c.png#srcSize=400x400&size=400x400)'));
 editor.imageRects=new Map([
  ['a.png',{naturalWidth:400,naturalHeight:400,offsetWidth:120,offsetHeight:120}],
  ['b.png',{naturalWidth:800,naturalHeight:400,offsetWidth:240,offsetHeight:120}],
 ]);
 const before=structuredClone(editor.children);
 Transforms.select(editor,Editor.start(editor,[0,5]));
 editor.deleteBackward('character');
 assert.deepEqual(pictures(editor).map(({width,height})=>[width,height]),[[120,120],[240,120]]);
 Transforms.select(editor,Editor.start(editor,[0,3]));
 editor.deleteBackward('character');
 assert.deepEqual([editor.children[0].type,editor.children[0].width,editor.children[0].height],['image-block',120,120]);
 editor.undo();
 assert.deepEqual(pictures(editor).map(({width,height})=>[width,height]),[[120,120],[240,120]]);
 editor.undo();
 assert.deepEqual(editor.children,before);
});

test('arrows move through each image and real caret, and Backspace deletes one image at a time',()=>{
 const {parse,navigateBlockBoundary}=loaded.exports;
 const editor=rowFixture(parse('![A](a.png) ![B](b.png) ![C](c.png)\n\nAfter'));
 Transforms.select(editor,Editor.start(editor,[1]));
 for(const slot of [5,4,3,2,1,0]){
  assert(navigateBlockBoundary(editor,{key:'ArrowLeft'}));
  assert.deepEqual(editor.selection.anchor.path,[0,slot,0]);
 }
 for(const slot of [1,2,3,4,5]){
  assert(navigateBlockBoundary(editor,{key:'ArrowRight'}));
  assert.deepEqual(editor.selection.anchor.path,[0,slot,0]);
 }
 assert(navigateBlockBoundary(editor,{key:'ArrowRight'}));
 assert.deepEqual(editor.selection.anchor.path,[1,0]);
 editor.deleteBackward('character');
 assert.deepEqual(editor.selection.anchor.path,[0,5,0]);
 editor.deleteBackward('character');
 assert.deepEqual(pictures(editor).map(node=>node.alt),['A','B']);
 assert.deepEqual(editor.selection.anchor.path,[1,0]);
 editor.deleteBackward('character');editor.deleteBackward('character');
 assert.equal(editor.children[0].alt,'A');
 assert.deepEqual(editor.selection.anchor.path,[1,0]);
 editor.deleteBackward('character');editor.deleteBackward('character');
 assert(!editor.children.some(node=>node.type==='image-block'||node.type==='image-row'));
});

test('typing at an inter-image caret creates prose below the row',()=>{
 const editor=rowFixture(loaded.exports.parse('![A](a.png) ![B](b.png)'));
 Transforms.select(editor,Editor.start(editor,[0,2]));
 editor.insertText('Below');
 assert.deepEqual(pictures(editor).map(node=>node.alt),['A','B']);
 assert.equal(Node.string(editor.children[2]),'Below');
});

test('two Backspaces between images leave the caret before the next image',()=>{
 const {parse,navigateBlockBoundary,serialize}=loaded.exports;
 for(const [count,slot] of [[3,2],[3,4],[2,2]]){
  const source='![A](a.png) ![B](b.png)'+(count===3?' ![C](c.png)':'');
  const editor=rowFixture(parse(source+'\n\nAfter'));
  Transforms.select(editor,Editor.start(editor,[0,slot]));
  editor.deleteBackward('character');
  assert.deepEqual(editor.selection.anchor.path,[0,slot-1,0]);
  editor.deleteBackward('character');
  const gap=slot-2;
  assert.deepEqual(editor.selection.anchor.path,[0,gap,0]);
  assert.equal(editor.children[0].children[gap].type,'image-row-caret');
  assert(navigateBlockBoundary(editor,{key:'ArrowRight'}));
  assert.deepEqual(editor.selection.anchor.path,[0,gap+1,0]);
  assert.equal(editor.children[0].children[gap+1].alt,slot===2?'B':'C');
  if(count===2)assert.equal(parse(serialize(editor.children))[0].type,'image-block');
 }
});

test('Enter splits at the image caret and follows the right group with undo and redo',()=>{
 const {parse,serialize,rowImages}=loaded.exports;
 for(const slot of [2,4]) {
  const editor=rowFixture(parse('![A](a.png) ![B](b.png) ![C](c.png) ^image-row-id\n\nAfter'));
  Transforms.select(editor,Editor.start(editor,[0,slot]));
  const before=structuredClone(editor.children),selection=structuredClone(editor.selection);
  editor.insertBreak();
  const right=editor.selection.anchor.path[0];
  assert(right>0);
  assert.deepEqual(editor.selection.anchor.path,[right,0,0]);
  assert.equal(editor.children[right].children[0].type,'image-row-caret');
  assert.equal(editor.children[0].__blockId,'image-row-id');
  assert.equal(editor.children[right].__blockId,undefined);
  const rows=parse(serialize(editor.children)).filter(node=>node.type==='image-row'||node.type==='image-block');
  assert.deepEqual(rows.map(node=>node.type==='image-row'?rowImages(node).map(image=>image.alt):[node.alt]),slot===2?[['A'],['B','C']]:[['A','B'],['C']]);
  const after=structuredClone(editor.children);
  editor.undo();assert.deepEqual(editor.children,before);assert.deepEqual(editor.selection,selection);
  editor.redo();assert.deepEqual(editor.children,after);
 }
});

test('Enter at the leading caret inserts a blank line above',()=>{
 const editor=rowFixture(loaded.exports.parse('![A](a.png) ![B](b.png)'));
 Transforms.select(editor,Editor.start(editor,[0,0]));
 editor.insertBreak();
 assert.equal(editor.children[0].type,'paragraph');
 assert.equal(Node.string(editor.children[0]),'');
 assert.deepEqual(editor.selection.anchor.path,[1,0,0]);
});

test('image paste and forward Delete follow the caret in the middle of a row',()=>{
 const editor=rowFixture(loaded.exports.parse('![A](a.png) ![B](b.png) ![C](c.png)'));
 Transforms.select(editor,Editor.start(editor,[0,2]));
 editor.insertFragment([{...namedImage('new'),alt:'New'}]);
 assert.deepEqual(pictures(editor).map(node=>node.alt),['A','New','B','C']);
 assert.deepEqual(editor.selection.anchor.path,[0,4,0]);
 editor.deleteForward('character');
 assert.deepEqual(editor.selection.anchor.path,[0,5,0]);
 editor.deleteForward('character');
 assert.deepEqual(pictures(editor).map(node=>node.alt),['A','New','C']);
 assert.deepEqual(editor.selection.anchor.path,[0,4,0]);
});

for(const [name,dimensions] of Object.entries({
 resized:{width:640,height:360,srcWidth:1920,srcHeight:1080},
 small:{width:16,height:12,srcWidth:1600,srcHeight:1200},
 natural:{},
 widthOnly:{width:480},
 dimensionsOnly:{width:720,height:480},
})){
 test(`legacy inline media converts to a block preserving ${name} dimensions, metadata and undo/redo`,()=>{
  const photo={...image(dimensions),type:'image-inline'};
  const editor=fixture([{type:'paragraph',children:[{text:''},photo,{text:''}]}]);
  Transforms.select(editor,Editor.start(editor,[0,1]));
  const before=structuredClone(editor.children);
  HistoryEditor.withNewBatch(editor,()=>convertToBlockImage(editor,findImage(editor)[0]));
  assert.deepEqual(editor.children,[image(dimensions)]);
  const blockDocument=structuredClone(editor.children);
  editor.undo();assert.deepEqual(editor.children,before);
  editor.redo();assert.deepEqual(editor.children,blockDocument);
 });
}

test('inline image becomes a separate block without resizing or losing adjacent text',()=>{
 const photo={...image({width:600,height:400}),type:'image-inline'};
 const editor=fixture([{type:'paragraph',children:[{text:'Before',bold:true},photo,{text:'After',italic:true}]}]);
 Transforms.select(editor,Editor.start(editor,[0,1]));
 const before=structuredClone(editor.children);
 HistoryEditor.withNewBatch(editor,()=>convertToBlockImage(editor,photo));
 assert.deepEqual(editor.children,[
  {type:'paragraph',children:[{text:'Before',bold:true}]},
  {...photo,type:'image-block'},
  {type:'paragraph',children:[{text:'After',italic:true}]},
 ]);
 editor.undo();assert.deepEqual(editor.children,before);
});
