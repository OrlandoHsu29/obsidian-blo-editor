const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const moduleUnderTest=new Module('note-sync.cjs');
moduleUnderTest._compile(buildSync({entryPoints:['src/note-sync.ts'],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text,'note-sync.cjs');
const {NoteSync,NoteSyncConflict,validateWrite,lockElement}=moduleUnderTest.exports;

function fixture(){
 let disk='old',releaseWrite;const sync=new NoteSync(),locks=[];
 function view(name){return {name,base:'old',content:'old',current:true,
  isCurrent(){return this.current},isDirty(){return this.content!==this.base},savedContent(){return this.base},
  async save(){disk=validateWrite(this.base,disk,this.content);this.base=this.content},
  async reload(){this.content=disk;this.base=disk},
  lock(){locks.push(`lock ${name}`);return()=>locks.push(`unlock ${name}`)}};}
 return {sync,view,locks,read:async()=>disk,get disk(){return disk},set disk(v){disk=v}};
}
test('switching saves pending source edits before refreshing target',async()=>{
 const f=fixture(),a=f.view('a'),b=f.view('b');a.content='changed';
 await f.sync.handoff(b,[a],f.read);
 assert.equal(f.disk,'changed');assert.equal(b.content,'changed');
 assert.deepEqual(f.locks,['lock b','lock a','unlock a','unlock b']);
});
test('opposite direction also preserves the latest contents',async()=>{
 const f=fixture(),a=f.view('a'),b=f.view('b');b.content='new';
 await f.sync.handoff(a,[b],f.read);assert.equal(a.content,'new');
});
test('two dirty views are preserved without any write or reload',async()=>{
 const f=fixture(),a=f.view('a'),b=f.view('b');a.content='first';b.content='second';
 await assert.rejects(f.sync.handoff(a,[b],f.read),NoteSyncConflict);
 assert.equal(f.disk,'old');assert.equal(a.content,'first');assert.equal(b.content,'second');
});
test('disk edits cannot be overwritten by a stale view',async()=>{
 const f=fixture(),a=f.view('a'),b=f.view('b');a.content='local';f.disk='external';
 await assert.rejects(f.sync.handoff(b,[a],f.read),NoteSyncConflict);
 assert.equal(f.disk,'external');assert.equal(a.content,'local');assert.equal(b.content,'old');
});
test('a save failure unlocks both views and leaves the destination intact',async()=>{
 const f=fixture(),a=f.view('a'),b=f.view('b');a.content='new';a.save=async()=>{throw Error('disk failure')};
 await assert.rejects(f.sync.handoff(b,[a],f.read),/disk failure/);
 assert.equal(b.content,'old');assert.deepEqual(f.locks.slice(-2),['unlock a','unlock b']);
});
test('a view that changes files while saving is never reloaded',async()=>{
 const f=fixture(),a=f.view('a'),b=f.view('b');a.content='new';a.save=async()=>{b.current=false};
 await f.sync.handoff(b,[a],f.read);assert.equal(b.content,'old');
});
test('overlapping handoffs keep input blocked until the last one completes',()=>{
 const doc=new EventTarget(),el={ownerDocument:doc,contains:()=>true},first=lockElement(el),second=lockElement(el);
 let received=0;doc.addEventListener('keydown',()=>received++);
 const event=()=>new Event('keydown',{cancelable:true});
 assert.equal(doc.dispatchEvent(event()),false);first();assert.equal(doc.dispatchEvent(event()),false);
 second();assert.equal(doc.dispatchEvent(event()),true);assert.equal(received,1);
});
