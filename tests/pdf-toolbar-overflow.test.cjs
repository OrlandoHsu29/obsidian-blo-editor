const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const loaded=new Module('pdf-toolbar-overflow.cjs');
loaded._compile(buildSync({entryPoints:['src/pdf-toolbar-overflow.ts'],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text,'pdf-toolbar-overflow.cjs');
const {observePdfToolbarOverflow}=loaded.exports;
function fixture(){
 let id=0,resize,disconnected=false;const frames=new Map(),listeners=new Map();
 const win={requestAnimationFrame(fn){frames.set(++id,fn);return id},cancelAnimationFrame:id=>frames.delete(id),ResizeObserver:class{constructor(fn){resize=fn}observe(){}disconnect(){disconnected=true}}};
 const host={ownerDocument:{defaultView:win},dataset:{}};
 const toolbar={scrollLeft:0,scrollWidth:500,clientWidth:200,children:[{},{}],addEventListener:(t,fn)=>listeners.set(t,fn),removeEventListener:t=>listeners.delete(t)};
 const dispose=observePdfToolbarOverflow(host,toolbar);
 return {host,toolbar,dispose,frames,listeners,get disconnected(){return disconnected},paint(){for(const[id,fn]of frames){frames.delete(id);fn()}},scroll(left){toolbar.scrollLeft=left;listeners.get('scroll')()},resize(width){toolbar.clientWidth=width;resize()}};
}
test('edge hints follow the undisplayed toolbar content at either end and in the middle',()=>{
 const f=fixture();assert.deepEqual(f.host.dataset,{pdfToolbarMoreLeft:'false',pdfToolbarMoreRight:'true'});
 f.scroll(150);f.paint();assert.deepEqual(f.host.dataset,{pdfToolbarMoreLeft:'true',pdfToolbarMoreRight:'true'});
 f.scroll(300);f.paint();assert.deepEqual(f.host.dataset,{pdfToolbarMoreLeft:'true',pdfToolbarMoreRight:'false'});
 f.scroll(0);f.resize(600);f.paint();assert.deepEqual(f.host.dataset,{pdfToolbarMoreLeft:'false',pdfToolbarMoreRight:'false'});f.dispose();
});
test('scroll bursts share one measurement frame and tolerate subpixel edges',()=>{
 const f=fixture();for(let i=0;i<50;i++)f.scroll(298.8);assert.equal(f.frames.size,1);f.paint();
 assert.equal(f.host.dataset.pdfToolbarMoreRight,'false');f.dispose();
});
test('unmount removes listeners, the queued measurement and stale hints',()=>{
 const f=fixture();f.scroll(50);f.dispose();assert.equal(f.frames.size,0);assert.equal(f.listeners.size,0);assert.equal(f.disconnected,true);assert.deepEqual(f.host.dataset,{});
});
