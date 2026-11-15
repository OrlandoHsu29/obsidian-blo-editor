const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor,Node,Transforms}=require('slate');
const {withHistory,HistoryEditor}=require('slate-history');
const loaded=new Module('media-url-paste.cjs');
loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en'}:require(id);
loaded._compile(buildSync({stdin:{contents:`export {createMediaLinkImport} from './src/media-url-paste';export {wikiEmbedUrl} from './src/wysimark/convert/obsidian-links';export {convertToEmbed} from './src/wysimark/anchor-plugin/methods/convertToEmbed';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['slate','slate-react','obsidian'],write:false}).outputFiles[0].text,'media-url-paste.cjs');
const {createMediaLinkImport,wikiEmbedUrl,convertToEmbed}=loaded.exports;
function fixture(before,after,ext='pdf',props={}){
 const e=withHistory(createEditor());
 e.isInline=n=>['anchor','image-inline'].includes(n.type);
 e.isVoid=n=>['image-inline','image-block'].includes(n.type);
 const url='https://example.test/manual.'+ext;
 e.children=[{type:'paragraph',...props,children:[{text:before,bold:true},{type:'anchor',href:url,children:[{text:'Source'}]},{text:after,italic:true}]},{type:'paragraph',children:[{text:'Other block'}]}];
 e.wysimark={readOnly:false,downloadAttachment:async()=>({name:'manual.'+ext,type:ext==='pdf'?'application/pdf':'image/png'}),onImageSave:async()=> 'attachments/manual.'+ext};
 Transforms.select(e,Editor.end(e,[1]));
 return {e,url,importer:createMediaLinkImport(e,[0,1],url)};
}
for(const ext of ['pdf','png'])for(const [before,after] of [['Before','After'],['','After'],['Before',''],['','']]){
 test(`${ext} import separates ${JSON.stringify(before)} and ${JSON.stringify(after)} and undoes in one step`,async()=>{
  const {e,importer}=fixture(before,after,ext),original=structuredClone(e.children);
  assert.equal(await importer.embed(),true);
  const content=e.children.slice(0,-1),media=content.find(n=>n.type==='image-block');
  assert.ok(media);assert.equal(media.alt,'manual.'+ext);assert.equal(media.url,ext==='pdf'?wikiEmbedUrl('attachments/manual.pdf'):'attachments/manual.png');
  assert.deepEqual(content.map(n=>n.type),[...(before?['paragraph']:[]),'image-block',...(after?['paragraph']:[])]);
  if(before)assert.deepEqual(content[0].children,[{text:before,bold:true}]);
  if(after)assert.deepEqual(content.at(-1).children,[{text:after,italic:true}]);
  assert.equal(Node.string(e.children.at(-1)),'Other block');
  assert.deepEqual(e.selection.anchor.path,[e.children.length-1,0]);
  const embedded=structuredClone(e.children);e.undo();assert.deepEqual(e.children,original);e.redo();assert.deepEqual(e.children,embedded);
 });
}
for(const props of [{type:'heading',level:2,__blockDepth:2},{type:'ordered-list-item',depth:2},{type:'blockquote',__blockDepth:1}]){
 test(`embedding in ${props.type} retains text block properties and media indentation`,async()=>{
  const {e,importer}=fixture('Before','After','pdf',props);await importer.embed();
  assert.equal(e.children[1].type,'image-block');assert.equal(e.children[1].__blockDepth,props.__blockDepth??props.depth);
  for(const index of [0,2])for(const [key,value] of Object.entries(props))assert.equal(e.children[index][key],value);
 });
}
test('a link deleted while downloading is not replaced elsewhere',async()=>{
 const {e,importer}=fixture('Before','After');
 // The importer captures the downloader; deleting the link before it resumes
 // must invalidate its path reference instead of overwriting adjacent text.
 const pending=importer.embed();Transforms.removeNodes(e,{at:[0,1]});
 assert.equal(await pending,false);assert.equal([...Node.elements(e)].some(([n])=>n.type==='image-block'),false);
});

for(const spec of ['attachments/manual.pdf','attachments/photo.png','attachments/diagram.excalidraw.md'])test(`converting a link to ${spec} creates a standalone block`,()=>{
 const {e,importer}=fixture('Before','After');importer.dispose();const before=structuredClone(e.children);
 HistoryEditor.withNewBatch(e,()=>assert.equal(convertToEmbed(e,spec,{at:[0,1]}),true));
 assert.deepEqual(e.children.map(n=>n.type),['paragraph','image-block','paragraph','paragraph']);
 assert.equal(e.children[1].url,wikiEmbedUrl(spec));assert.equal(Node.string(e.children[0]),'Before');assert.equal(Node.string(e.children[2]),'After');
 e.undo();assert.deepEqual(e.children,before);
});
