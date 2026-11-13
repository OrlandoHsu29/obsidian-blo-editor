const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor,Transforms}=require('slate');
let requests=0;
const loaded=new Module('remote-images.cjs');
loaded.require=id=>id==='obsidian'?{Notice:class {},getLanguage:()=> 'en',requestUrl:async()=>{requests++;return {status:404}}}:require(id);
loaded._compile(buildSync({entryPoints:['src/remote-images.ts'],bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history','react'],write:false}).outputFiles[0].text,'remote-images.cjs');
const {watchRemoteImages}=loaded.exports;
const paragraph=text=>({type:'paragraph',children:[{text}]});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const editor=createEditor();editor.wysimark={readOnly:false};editor.children=Array.from({length:2000},(_,i)=>paragraph(`Block ${i}`));
 let active=true,callback,removed=false;const scans=[];
 const nodes=Editor.nodes;Editor.nodes=(editor,options)=>{scans.push(options.at);return nodes(editor,options)};
 const app={workspace:{on(event,cb){callback=cb;return cb},offref(){removed=true}}};
 const dispose=watchRemoteImages(app,'test.md',editor,()=>async()=> 'local.png',()=>active);
 return {editor,scans,activate(){callback()},setActive(value){active=value},get removed(){return removed},dispose(){dispose();Editor.nodes=nodes}};
}

test('repeated tab activation and ordinary text edits do not rescan a long document',async()=>{
 const f=fixture();try{
  await flush();assert.deepEqual(f.scans,[[]]);f.scans.length=0;
  Transforms.select(f.editor,Editor.start(f.editor,[100]));f.editor.insertText(' edited');
  for(let i=0;i<20;i++)f.activate();assert.deepEqual(f.scans,[]);
 }finally{f.dispose()}assert.equal(f.removed,true);
});

test('active inserts scan the subtree; background inserts are recovered on activation',async()=>{
 const f=fixture();try{
  await flush();f.scans.length=0;
  Transforms.insertNodes(f.editor,paragraph('active'),{at:[2000]});assert.deepEqual(f.scans,[[2000]]);
  f.scans.length=0;f.setActive(false);
  Transforms.insertNodes(f.editor,{type:'image-block',url:'https://example.test/test.png',children:[{text:''}]},{at:[2001]});
  f.activate();assert.deepEqual(f.scans,[]);
  const before=requests;f.setActive(true);f.activate();await flush();
  assert.deepEqual(f.scans,[[]]);assert.equal(requests,before+1);
  f.scans.length=0;f.activate();assert.deepEqual(f.scans,[]);
 }finally{f.dispose()}
});

test('an initially inactive document waits for activation before scanning',async()=>{
 const f=fixture();try{
  f.setActive(false);await flush();assert.deepEqual(f.scans,[]);
  f.setActive(true);f.activate();assert.deepEqual(f.scans,[[]]);
 }finally{f.dispose()}
});

test('switching away before a queued download starts preserves the activation retry',async()=>{
 const f=fixture();try{
  await flush();f.scans.length=0;
  Transforms.insertNodes(f.editor,{type:'image-block',url:'https://example.test/retry.png',children:[{text:''}]},{at:[2000]});
  f.setActive(false);const before=requests;await flush();assert.equal(requests,before);
  f.scans.length=0;f.setActive(true);f.activate();await flush();
  assert.deepEqual(f.scans,[[]]);assert.equal(requests,before+1);
 }finally{f.dispose()}
});
