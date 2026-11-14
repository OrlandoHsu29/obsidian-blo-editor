const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const loaded=new Module('drawing-resize.cjs');
loaded._compile(buildSync({entryPoints:['src/drawing-resize.ts'],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text,'drawing-resize.cjs');
const {observeDrawingResize}=loaded.exports;
function fixture(dragging=false){
 let callback,disconnected=false,time=0,sequence=0;const timers=new Map();
 const win={ResizeObserver:class{constructor(fn){callback=fn}observe(){}disconnect(){disconnected=true}},setTimeout(fn,delay){const id=++sequence;timers.set(id,{fn,at:time+delay});return id},clearTimeout(id){timers.delete(id)}};
 const host={ownerDocument:{defaultView:win},dataset:{},attributes:{},setAttribute(k,v){this.attributes[k]=v},removeAttribute(k){delete this.attributes[k]}};
 const dispose=observeDrawingResize(host,dragging);
 return {host,dispose,timers,get disconnected(){return disconnected},resize(width,height=400){callback([{contentRect:{width,height}}])},advance(ms){time+=ms;for(const [id,timer] of timers)if(timer.at<=time){timers.delete(id);timer.fn()}}};
}
test('initial size and height-only changes keep the drawing visible',()=>{
 const f=fixture();f.resize(640);f.resize(640,800);assert.equal(f.host.dataset.drawingResizing,undefined);assert.equal(f.timers.size,0);f.dispose();
});
test('width changes suspend the preview until the final width settles',()=>{
 const f=fixture();f.resize(640);f.resize(600);assert.equal(f.host.dataset.drawingResizing,'true');assert.equal(f.host.attributes['aria-busy'],'true');
 f.advance(100);f.resize(580);f.advance(119);assert.equal(f.host.dataset.drawingResizing,'true');assert.equal(f.timers.size,1);
 f.advance(1);assert.equal(f.host.dataset.drawingResizing,undefined);assert.equal(f.host.attributes['aria-busy'],undefined);assert.equal(f.timers.size,0);f.dispose();
});
test('height changes during a width gesture do not postpone restoration',()=>{
 const f=fixture();f.resize(640);f.resize(600);f.advance(100);f.resize(600,800);f.advance(20);assert.equal(f.host.dataset.drawingResizing,undefined);f.dispose();
});
test('hidden zero-width containers do not start a resize gesture',()=>{
 const f=fixture();f.resize(0);f.resize(640);f.resize(0);assert.equal(f.timers.size,0);assert.equal(f.host.dataset.drawingResizing,undefined);f.dispose();
});
test('unmounting cancels pending work and restores visibility',()=>{
 const f=fixture();f.resize(640);f.resize(600);f.dispose();assert.equal(f.disconnected,true);assert.equal(f.timers.size,0);assert.equal(f.host.dataset.drawingResizing,undefined);assert.equal(f.host.attributes['aria-busy'],undefined);
});
test('manual resizing masks immediately and stays masked while the pointer is held still',()=>{
 const f=fixture(true);assert.equal(f.host.dataset.drawingResizing,'true');assert.equal(f.host.attributes['aria-busy'],'true');
 f.advance(1000);assert.equal(f.host.dataset.drawingResizing,'true');assert.equal(f.timers.size,0);f.dispose();
});
test('ending or cancelling manual resizing restores the same preview without pending work',()=>{
 const f=fixture(true);f.dispose();assert.equal(f.host.dataset.drawingResizing,undefined);assert.equal(f.host.attributes['aria-busy'],undefined);assert.equal(f.timers.size,0);
});
