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
 if(id==='slate-react')return {ReactEditor:{findPath(editor,element){
  for(const [node,path] of Node.nodes(editor))if(node===element)return path;
  throw new Error('Image is not in the editor');
 }}};
 return require(id);
};
loaded._compile(buildSync({stdin:{contents:`
 export {convertToInlineImage} from './src/wysimark/image-plugin/render-element/image-with-controls/image-toolbar/image-type-buttons/convert-to-inline-image';
 export {convertToBlockImage} from './src/wysimark/image-plugin/render-element/image-with-controls/image-toolbar/image-type-buttons/convert-to-block-image';
 `,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-react'],write:false}).outputFiles[0].text,'image-layout.cjs');
const {convertToInlineImage,convertToBlockImage}=loaded.exports;

function fixture(children){
 const editor=withHistory(createEditor());
 editor.isInline=node=>node.type==='image-inline';
 editor.isVoid=node=>['image-inline','image-block'].includes(node.type);
 editor.children=children;
 return editor;
}
const image=dimensions=>({type:'image-block',url:'attachments/photo.png',alt:'Photo',title:'Title',...dimensions,children:[{text:''}]});
const findImage=editor=>[...Node.elements(editor)].find(([node])=>['image-inline','image-block'].includes(node.type));

for(const [name,dimensions] of Object.entries({
 resized:{width:640,height:360,srcWidth:1920,srcHeight:1080},
 small:{width:16,height:12,srcWidth:1600,srcHeight:1200},
 natural:{},
 widthOnly:{width:480},
 dimensionsOnly:{width:720,height:480},
})){
 test(`layout round trip preserves ${name} dimensions, metadata and undo/redo`,()=>{
  const editor=fixture([image(dimensions)]);
  Transforms.select(editor,Editor.start(editor,[0]));
  const before=structuredClone(editor.children);
  HistoryEditor.withNewBatch(editor,()=>convertToInlineImage(editor,editor.children[0]));
  const [inline]=findImage(editor);
  assert.deepEqual(inline,{...before[0],type:'image-inline'});
  const inlineDocument=structuredClone(editor.children);
  editor.undo();assert.deepEqual(editor.children,before);
  editor.redo();assert.deepEqual(editor.children,inlineDocument);
  HistoryEditor.withNewBatch(editor,()=>convertToBlockImage(editor,findImage(editor)[0]));
  assert.deepEqual(editor.children,before);
  editor.undo();assert.deepEqual(editor.children,inlineDocument);
  editor.redo();assert.deepEqual(editor.children,before);
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
