const {test}=require('node:test'),assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module');
function fixture(text=''){
 const writes=[],bitmap={isEmpty:()=>false},doc={body:{innerHTML:'',textContent:text,firstElementChild:{setAttribute(){}}},querySelectorAll:()=>[{src:'data:image/png;base64,aGVsbG8='}]};
 let systemHtml='fragment-token';
 const m=new Module('image-clipboard.cjs');m.require=id=>id==='./note-export/rich-content'?{richContent:async()=>({html:'<div><img src="data:image/png;base64,aGVsbG8="></div>'})}:id==='electron'?{clipboard:{readHTML:()=>systemHtml,write:data=>writes.push(data)},nativeImage:{createFromDataURL:()=>bitmap}}:require(id);
 m._compile(buildSync({entryPoints:['src/image-clipboard.ts'],bundle:true,platform:'node',format:'cjs',external:['*'],write:false}).outputFiles[0].text,'image-clipboard.cjs');
 const view={contentEl:{ownerDocument:{implementation:{createHTMLDocument:()=>doc},defaultView:{setTimeout}}}};
 return {writes,bitmap,run:(nodes,current=()=>true)=>m.exports.copyImageFragment(view,{},nodes,'fragment-token',current),changeClipboard:()=>systemHtml='new user clipboard'};
}
test('a copied standalone picture includes the OS bitmap format for image-only applications',async()=>{
 const f=fixture();await f.run([{type:'image-block',url:'source.png',children:[{text:''}]}]);assert.equal(f.writes.length,1);assert.equal(f.writes[0].image,f.bitmap);assert(!('text' in f.writes[0]));assert(f.writes[0].html.includes('data:image/png;'));
});
test('mixed image selections preserve portable rich text and plain text without bitmap replacement',async()=>{
 const f=fixture('BeforeAfter');await f.run([{type:'paragraph',children:[{text:'Before'}]},{type:'image-block',url:'source.png',children:[{text:''}]},{type:'paragraph',children:[{text:'After'}]}]);assert.equal(f.writes[0].text,'Before\n\nAfter');assert(!f.writes[0].image);assert(f.writes[0].html.includes('data:image/png;'));
});
test('asynchronous picture copy never overwrites a more recent clipboard operation',async()=>{
 const f=fixture();f.changeClipboard();await f.run([]);assert.equal(f.writes.length,0);
 const g=fixture();await g.run([],()=>false);assert.equal(g.writes.length,0);
});

test('table fragments use the shared image preparation and later text copies cancel pending images',()=>{
 const m=new Module('image-clipboard-routing.cjs');m.require=id=>id==='obsidian'?{getLanguage:()=> 'en'}:require(id);
 m._compile(buildSync({stdin:{contents:"export {prepareImageClipboard} from './src/wysimark/paste-markdown-plugin/clipboard-html';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history','slate-react','react','react-dom'],write:false}).outputFiles[0].text,'image-clipboard-routing.cjs');
 const prepared=[],editor={wysimark:{copyImageFragment:(...args)=>{prepared.push(args);return Promise.resolve()}}};
 const fragment=[{type:'table',columns:[{}],children:[{type:'table-row',children:[{type:'table-cell',children:[{type:'table-content',children:[{type:'image-inline',url:'a.png',children:[{text:''}]}]}]}]}]}];
 m.exports.prepareImageClipboard(editor,fragment,'table-fragment');
 assert.equal(prepared.length,1);assert.equal(prepared[0][0],fragment);assert.equal(prepared[0][1],'table-fragment');assert.equal(prepared[0][2](),true);
 m.exports.prepareImageClipboard({wysimark:{}},[{type:'paragraph',children:[{text:'new copy'}]}],'text-fragment');
 assert.equal(prepared[0][2](),false);
});
