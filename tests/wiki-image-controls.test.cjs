const {test}=require('node:test'),assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module');
function fixture(){
 let readOnly=false,selected=true;
 const element={type:'image-block',url:'wysimark:wiki-embed:attachments%2Fphoto.png',alt:'Photo',width:320,height:240,srcWidth:640,srcHeight:480,children:[{text:''}]};
 const editor={wysimark:{resolveImageUrl:()=> 'app://photo.png'}};
 const m=new Module('wiki-image-controls.cjs');m.require=id=>{
  if(id==='react')return {useEffect(){},useState:initial=>[initial,()=>{}],useMemo:fn=>fn()};
  if(id==='slate-react')return {useSlateStatic:()=>editor,useElement:()=>element,useSelected:()=>selected,useReadOnly:()=>readOnly};
  if(id.includes('image-with-controls-styles'))return {$Image:'img',$ImageContainer:'span'};
  if(id.includes('image-toolbar'))throw Error('Image presets must not be mounted on photos');
  if(id.includes('image-resize-control'))return {ImageResizeControl:'resize-control'};
  if(id.includes('attachment-revision'))return {useAttachmentRevision:()=>0};
  if(id.includes('image-size-status'))return {ImageSizeStatus:'size-status'};
  return require(id);
 };
 m._compile(buildSync({entryPoints:['src/wysimark/image-plugin/render-element/image-with-controls/index.tsx'],bundle:true,platform:'node',format:'cjs',jsx:'automatic',external:['*'],write:false}).outputFiles[0].text,'wiki-image-controls.cjs');
 const render=()=>{const wiki=m.exports.WikiImageWithControls();return wiki.type(wiki.props)};
 return {render,element,setReading:value=>readOnly=value,setSelected:value=>selected=value};
}
test('wiki images retain saved dimensions and the shared drag handle without the preset toolbar',()=>{
 const f=fixture(),view=f.render(),children=view.props.children.filter(Boolean);
 assert(view.props.className.includes('--selected'));assert(children.some(child=>child.type==='resize-control'));
 const image=children.find(child=>child.type==='img');assert.equal(image.props.width,320);assert.equal(image.props.height,240);assert.equal(image.props.src,'app://photo.png');
 assert.equal(f.element.url,'wysimark:wiki-embed:attachments%2Fphoto.png');
});
test('reading mode and unselected wiki images have no editing handles',()=>{
 const f=fixture();f.setReading(true);let view=f.render();assert(!view.props.className.includes('--selected'));assert(!view.props.children.some(child=>child?.type==='resize-control'));
 f.setReading(false);f.setSelected(false);view=f.render();assert(!view.props.children.some(child=>child?.type==='resize-control'));
});
