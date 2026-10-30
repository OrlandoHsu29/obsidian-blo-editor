const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');

function compile(path, external, requireFn){
 const m=new Module(path);m.require=requireFn;
 m._compile(buildSync({entryPoints:[path],bundle:true,platform:'node',format:'cjs',external,write:false,jsx:'automatic'}).outputFiles[0].text,path);
 return m.exports;
}
const sync=compile('src/note-sync.ts',[],require);
class FileView {} class MarkdownView extends FileView {} class TFile {}
const identity=()=>{};
const stub=new Proxy(identity,{get:()=>identity});
const obsidian={FileView,MarkdownView,TFile,Notice:class {},Scope:class {}};
const loaded=compile('src/BloView.tsx',['./*','obsidian','react','react/*','react-dom/*','slate','slate-react','@emotion/*'],id=>{
 if(id==='obsidian')return obsidian;
 if(id==='./note-sync')return sync;
 return new Proxy({__esModule:true,default:stub},{get:(o,k)=>k in o?o[k]:stub});
});
const BloView=loaded.BloView;
function fixture(){
 let disk='base',writes=0;const files=new Map(),file=Object.assign(new TFile(),{path:'note.md',basename:'note',parent:{path:'/'}});files.set(file.path,file);
 const vault={read:async()=>disk,process:async(f,fn)=>{const current=f===file?disk:files.get(f.path).content;const next=fn(current);writes++;if(f===file)disk=next;else f.content=next;return next},getFileByPath:path=>files.get(path),getAbstractFileByPath:path=>files.get(path),create:async(path,content)=>{if(files.has(path))throw Error('exists');const f=Object.assign(new TFile(),{path,content});files.set(path,f);return f}};
 function view(){const v=Object.create(BloView.prototype),doc=new EventTarget(),contentEl={ownerDocument:doc,contains:()=>true};Object.assign(v,{app:{vault},currentFile:file,file,editor:null,contentEl,readOnly:false,isDirty:false,savedContent:'base',fileContent:'base',saveQueue:Promise.resolve(),lastEditorMarkdown:'',conflictNoticeShown:false,conflictCopy:null});return v}
 return {view,file,files,get disk(){return disk},set disk(value){disk=value},get writes(){return writes}};
}
test('actual Blo save refuses stale disk and creates a separate conflict copy',async()=>{
 const f=fixture(),v=f.view();v.fileContent='mine';v.isDirty=true;f.disk='theirs';
 await assert.rejects(v.saveFile(),sync.NoteSyncConflict);
 assert.equal(f.disk,'theirs');assert.equal(v.fileContent,'mine');assert.equal(v.isDirty,true);
 const copy=[...f.files.values()].find(file=>file!==f.file);assert.equal(copy.content,'mine');
});
test('repeated conflicts update only the unchanged recovery copy',async()=>{
 const f=fixture(),v=f.view();v.fileContent='one';v.isDirty=true;f.disk='other';
 await assert.rejects(v.saveFile());v.fileContent='two';await assert.rejects(v.saveFile());
 assert.equal(f.files.size,2);assert.equal([...f.files.values()][1].content,'two');assert.equal(f.disk,'other');
});
test('reload refuses dirty text before replacing the editor',async()=>{
 const f=fixture(),v=f.view();v.fileContent='mine';v.isDirty=true;
 await assert.rejects(v.reloadFile(),sync.NoteSyncConflict);assert.equal(v.fileContent,'mine');
});
test('explicit reload preserves a conflict copy before loading the disk version',async()=>{
 const f=fixture(),v=f.view();v.fileContent='mine';v.isDirty=true;f.disk='theirs';
 v.renderEditor=()=>{};await v.reloadFromDisk();
 assert.equal(v.fileContent,'theirs');assert.equal(f.disk,'theirs');
 assert.equal([...f.files.values()][1].content,'mine');
});
test('save requests serialize and retain edits made during a write',async()=>{
 const f=fixture(),v=f.view();v.fileContent='one';v.isDirty=true;
 await v.saveFile();v.fileContent='two';v.isDirty=true;await v.saveFile();
 assert.equal(f.disk,'two');assert.equal(v.isDirty,false);
});
