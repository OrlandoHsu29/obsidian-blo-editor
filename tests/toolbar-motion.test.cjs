const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');

function fixture(){
 let effectCleanup,observerCallback,frameId=0,styleReads=0;
 const frames=new Map(),animations=[],ghosts=new Set(),listeners=new Set();
 const media={matches:false,addEventListener(_,cb){listeners.add(cb)},removeEventListener(_,cb){listeners.delete(cb)}};
 const win={matchMedia:()=>media,requestAnimationFrame(cb){frames.set(++frameId,cb);return frameId},cancelAnimationFrame(id){frames.delete(id)},
  DOMMatrixReadOnly:class {m41=0;m42=0},getComputedStyle(node){styleReads++;return {width:String(node.visualWidth??node.width),transform:'none',opacity:'1',boxSizing:'border-box'}},
  ResizeObserver:class {constructor(cb){observerCallback=cb}observe(){}disconnect(){}}};
 const makeNode=(key,x)=>({dataset:{toolbarMotionKey:key},width:30,x,style:{},attributes:{'data-toolbar-index':'0','data-toolbar-motion-key':key,title:key},
  getBoundingClientRect(){return {left:this.x,top:0,width:this.width,height:30}},
  querySelectorAll(){return []},classList:{remove(){}},removeAttribute(key){delete this.attributes[key]},setAttribute(key,value){this.attributes[key]=value},
  cloneNode(){return makeNode(key,x)},remove(){ghosts.delete(this)},animate(){const target=this;const animation={cancel(){this.cancelled=true;delete target.visualWidth},finish(){this.onfinish?.()}};animations.push(animation);return animation}});
 const a=makeNode('a',0),b=makeNode('b',30),more=makeNode('overflow',60),parent={clientWidth:300};
 const host=Object.assign(makeNode('host',0),{width:60,isConnected:true,parentElement:parent,ownerDocument:{defaultView:win},items:[a,b],
  getClientRects(){return this.isConnected?[{}]:[]},append(node){ghosts.add(node)},
  querySelectorAll(selector){return selector==='[data-toolbar-index]'?[a,b]:this.items},querySelector(){return more}});
 const loaded=new Module('toolbar-motion.cjs');loaded.require=id=>id==='react'?{useLayoutEffect:fn=>{effectCleanup=fn()},useState:value=>[value,()=>{}],useRef:value=>({current:value})}:require(id);
 loaded._compile(buildSync({stdin:{contents:`export * from './src/wysimark/toolbar-plugin/components/toolbar/use-toolbar-motion';export * from './src/wysimark/toolbar-plugin/components/toolbar/use-toolbar-overflow';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['react'],write:false}).outputFiles[0].text,'toolbar-motion.cjs');
 const api=loaded.exports;
 return {host,a,b,media,animations,ghosts,listeners,frames,api,get styleReads(){return styleReads},
  flush(){const pending=[...frames.values()];frames.clear();pending.forEach(cb=>cb())},notify(target,width){observerCallback([{target,contentRect:{width}}])},
  disposeObserver(){effectCleanup?.()}};
}

test('exit animations are inert, temporary and cleaned up on rapid changes or disposal',()=>{
 const f=fixture(),motion=f.api.createToolbarMotion(f.host);motion.update();f.flush();
 f.host.items=[f.b];f.b.x=0;f.host.width=30;motion.update();
 assert.equal(f.ghosts.size,1);const ghost=[...f.ghosts][0];
 assert.equal(ghost.inert,true);assert.equal(ghost.style.pointerEvents,'none');assert.equal(ghost.attributes['aria-hidden'],'true');
 assert.equal(ghost.attributes['data-toolbar-index'],undefined);assert.equal(ghost.attributes.title,undefined);
 assert.equal(f.api.toolbarWidthMotion.has(f.host),true);
 const oldWidth=f.api.toolbarWidthMotion.get(f.host);
 f.host.items=[f.a,f.b];f.b.x=30;f.host.width=60;f.host.visualWidth=45;motion.update();
 assert.equal(f.ghosts.size,0);oldWidth.oncancel(); // Late cancellation must not clear the replacement animation.
 assert.equal(f.api.toolbarWidthMotion.has(f.host),true);
 motion.dispose();assert.equal(f.api.toolbarWidthMotion.has(f.host),false);
 assert.equal(f.listeners.size,0);assert.equal(f.frames.size,0);assert.equal(f.ghosts.size,0);
 assert.ok(f.animations.every(animation=>animation.cancelled));
});

test('settled layouts avoid per-control style reads; reduced motion and hidden hosts stop animation',()=>{
 const f=fixture(),motion=f.api.createToolbarMotion(f.host);motion.update();f.flush();
 const reads=f.styleReads;motion.update();assert.equal(f.styleReads-reads,1);assert.equal(f.animations.length,0);
 f.host.items=[f.a];f.host.width=30;motion.update();assert.ok(f.ghosts.size);
 f.media.matches=true;f.listeners.forEach(cb=>cb());assert.equal(f.ghosts.size,0);assert.equal(f.api.toolbarWidthMotion.has(f.host),false);
 const before=f.animations.length;f.host.items=[f.a,f.b];f.host.width=60;motion.update();assert.equal(f.animations.length,before);
 f.host.isConnected=false;motion.update();assert.equal(f.frames.size,0);motion.dispose();
});

test('overflow ignores animated host widths while still reacting to parent and control widths',()=>{
 const f=fixture();f.api.useToolbarOverflow({current:f.host},[{title:'a'},{title:'b'}],true,()=>{});
 f.api.toolbarWidthMotion.set(f.host,{});
 f.notify(f.host,45);assert.equal(f.frames.size,0);
 f.notify(f.host.parentElement,280);assert.equal(f.frames.size,1);f.flush();
 f.notify(f.a,35);assert.equal(f.frames.size,1);f.flush();
 f.api.toolbarWidthMotion.delete(f.host);f.notify(f.host,60);assert.equal(f.frames.size,1);
 f.disposeObserver();assert.equal(f.frames.size,0);
});

test('normally completed animations release width tracking and exit nodes',()=>{
 const f=fixture(),motion=f.api.createToolbarMotion(f.host);motion.update();f.flush();
 f.host.items=[f.a];f.host.width=30;motion.update();
 f.animations.forEach(animation=>animation.finish());
 assert.equal(f.api.toolbarWidthMotion.has(f.host),false);assert.equal(f.ghosts.size,0);
 motion.dispose();assert.equal(f.animations.some(animation=>animation.cancelled),false);
});
