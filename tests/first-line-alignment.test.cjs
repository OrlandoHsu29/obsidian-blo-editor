const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const loaded=new Module('first-line.cjs');loaded.require=require;
loaded._compile(buildSync({entryPoints:['src/blocks/first-line-alignment.ts'],bundle:true,platform:'node',format:'cjs',external:['react'],write:false}).outputFiles[0].text,'first-line.cjs');
const {createFirstLineAlignmentRegistry}=loaded.exports;
function fixture(){
 const frames=new Map(),listeners=new Map(),log=[];let next=0,resize,visibility;
 const doc={fonts:{addEventListener(name,fn){listeners.set(name,fn)},removeEventListener(name){listeners.delete(name)}},
  defaultView:{requestAnimationFrame(fn){frames.set(++next,fn);return next},cancelAnimationFrame(id){frames.delete(id)},
   getComputedStyle:()=>({width:'300',boxSizing:'border-box'}),
   ResizeObserver:class{constructor(fn){resize=fn}observe(){}unobserve(){}},IntersectionObserver:class{constructor(fn){visibility=fn}observe(){}unobserve(){}}},
  createTreeWalker(leaf){let done=false;return {nextNode(){if(done)return null;done=true;return leaf.text}}},
  createRange(){let text;return {setStart(node){text=node},setEnd(){},getClientRects(){log.push('read');return [{top:text.top,bottom:text.top+20,height:20,width:10}]}}}};
 const roots=Array.from({length:1200},()=>{const values=new Map(),text={textContent:'text',top:102};return {ownerDocument:doc,text,hover:false,
  matches(){return this.hover},querySelectorAll:()=>[{text}],getBoundingClientRect:()=>({top:100,width:300}),
  style:{getPropertyValue:key=>values.get(key)||'',setProperty(key,value){log.push('write');values.set(key,value)}}}});
 const registry=createFirstLineAlignmentRegistry(doc),dispose=roots.map((root,i)=>registry.add(root,{variable:'--center',visibleOnly:i===1}));
 return {roots,registry,frames,listeners,log,resize(indices){resize(indices.map(i=>({target:roots[i]})))},show(indices){visibility(indices.map(i=>({target:roots[i],isIntersecting:true})))},flush(){const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn())},dispose(){dispose.forEach(fn=>fn())}};
}

test('only visible markers and active handles enter the measurement queue in long documents',()=>{
 const f=fixture();try{
  f.show([0,1,2]);f.flush();assert.equal(f.roots[0].style.getPropertyValue('--center'),'12px');assert.equal(f.roots[1].style.getPropertyValue('--center'),'');
  f.log.length=0;f.resize(f.roots.map((_,i)=>i));assert.equal(f.log.filter(x=>x==='read').length,2);assert.equal(f.frames.size,0);
 }finally{f.dispose()}
});

test('resize completes alignment before paint and batches reads before writes',()=>{
 const f=fixture();try{
  f.show([0,2]);assert.equal(f.frames.size,1);f.resize([0,2]);assert.equal(f.frames.size,0);
  assert.deepEqual(f.log,['read','read','write','write']);
  f.log.length=0;f.roots[0].text.top=106;f.resize([0]);assert.equal(f.roots[0].style.getPropertyValue('--center'),'16px');
  assert.equal(f.frames.size,0);
 }finally{f.dispose()}
});

test('content/font updates still align and final cleanup releases callbacks',()=>{
 const f=fixture();f.show([0,1]);f.flush();f.roots[1].hover=true;
 f.registry.schedule(f.roots[1]);f.flush();assert.equal(f.roots[1].style.getPropertyValue('--center'),'12px');
 f.roots[0].text.top=110;f.listeners.get('loadingdone')();assert.equal(f.frames.size,1);f.flush();assert.equal(f.roots[0].style.getPropertyValue('--center'),'20px');
 f.registry.schedule(f.roots[0]);f.dispose();assert.equal(f.frames.size,0);assert.equal(f.listeners.size,0);
});
