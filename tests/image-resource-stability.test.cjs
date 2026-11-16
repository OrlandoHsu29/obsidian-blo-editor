const {test}=require('node:test'),assert=require('node:assert/strict');
const {buildSync}=require('esbuild'),Module=require('node:module');

function fixture(){
 const slots=[];let index=0,revision=0,resolutions=0,updates=0;
 const editor={wysimark:{resolveImageUrl:url=>url+'?token='+ ++resolutions}};
 const loaded=new Module('image-resource-stability.cjs');
 loaded.require=id=>{
  if(id==='react')return {
   useEffect(){},
   useMemo(fn,deps){const i=index++,previous=slots[i];if(!previous||deps.some((v,j)=>v!==previous.deps[j]))slots[i]={deps,value:fn()};return slots[i].value},
   useState(initial){const i=index++;if(!(i in slots))slots[i]=initial;return [slots[i],next=>{const value=typeof next==='function'?next(slots[i]):next;if(!Object.is(value,slots[i]))updates++;slots[i]=value}]},
  };
  if(id==='slate-react')return {useSlateStatic:()=>editor,useReadOnly:()=>true,useSelected:()=>false};
  if(id.includes('blocks/use-block-selection'))return {useBlockSelection:()=>false,useMultipleImagesSelected:()=>false};
  if(id.endsWith('/attachment-revision'))return {useAttachmentRevision:()=>revision};
  if(id.includes('image-with-controls-styles'))return {$Image:'img',$ImageContainer:'span'};
  if(id.startsWith('.'))return {};
  return require(id);
 };
 loaded._compile(buildSync({entryPoints:['src/wysimark/image-plugin/render-element/image-with-controls/index.tsx'],bundle:true,platform:'node',format:'cjs',jsx:'automatic',external:['react','react/*','slate-react','clsx','./*','../*'],write:false}).outputFiles[0].text,'image-resource-stability.cjs');
 let element={type:'image-block',url:'assets/preview.png',children:[{text:''}]};
 const render=()=>{index=0;return loaded.exports.ImageWithControls({element,presets:[]}).props.children[0]};
 return {render,get resolutions(){return resolutions},get updates(){return updates},restore(){revision++},changeReference(){element={...element,url:'assets/another.png'}}};
}

test('cache-busting resource URLs stay stable across image-load and unrelated renders',()=>{
 const f=fixture(),first=f.render();
 first.props.onLoad({currentTarget:{naturalWidth:1200,naturalHeight:1800}});
 for(let i=0;i<20;i++){const image=f.render();assert.equal(image.key,first.key);assert.equal(image.props.src,first.props.src);image.props.onLoad({currentTarget:{naturalWidth:1200,naturalHeight:1800}})}
 assert.equal(f.resolutions,1);assert.equal(f.updates,1,'unchanged natural dimensions cannot schedule another render');
});

test('restored attachments and changed references still refresh their image',()=>{
 const f=fixture(),first=f.render();f.restore();const restored=f.render();assert.notEqual(restored.key,first.key);
 f.changeReference();const changed=f.render();assert.notEqual(changed.key,restored.key);assert.equal(f.resolutions,3);
});
