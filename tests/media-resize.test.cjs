const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const loaded=new Module('media-resize.cjs');
loaded._compile(buildSync({entryPoints:['src/media-resize.ts'],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text,'media-resize.cjs');
const {observeMediaResize}=loaded.exports;
function fixture(extra={}){
 let callback,time=0,id=0,box={width:640,height:800},fits=[];const timers=new Map();
 const win={ResizeObserver:class{constructor(fn){callback=fn}observe(){}disconnect(){}},setTimeout(fn,delay){timers.set(++id,{fn,time:time+delay});return id},clearTimeout:id=>timers.delete(id)};
 const host={ownerDocument:{defaultView:win},dataset:{},setAttribute(){},removeAttribute(){}};
 const control=observeMediaResize(host,{marker:'pdfResizing',initiallyMasked:true,measure:()=>box,onSettled:size=>fits.push(size),...extra});
 return {host,control,fits,resize(width,height=800){box={width,height};callback?.([{contentRect:box}])},advance(ms){time+=ms;for(const [id,t]of timers)if(t.time<=time){timers.delete(id);t.fn()}},get pending(){return timers.size}};
}
test('first paint is masked and a continuous resize computes only its final dimensions',()=>{
 const f=fixture();assert.equal(f.host.dataset.pdfResizing,'true');
 for(let i=0;i<20;i++){f.resize(640-i*4);f.advance(40)}
 assert.equal(f.fits.length,0);assert.equal(f.pending,1);f.advance(120);
 assert.deepEqual(f.fits,[{width:564,height:800}]);assert.equal(f.host.dataset.pdfResizing,undefined);f.control.dispose();
});
test('holding a resize grip never computes even if the pointer stops for a long time',()=>{
 const f=fixture({dragging:true});f.advance(3000);assert.equal(f.fits.length,0);assert.equal(f.host.dataset.pdfResizing,'true');f.control.dispose();
});
test('a superseded asynchronous render cannot uncover the new pending geometry',async()=>{
 const completed=[],f=fixture({onSettled:()=>new Promise(resolve=>completed.push(resolve))});
 f.resize(600);f.advance(120);assert.equal(completed.length,1);f.resize(560);completed[0]();await Promise.resolve();
 assert.equal(f.host.dataset.pdfResizing,'true');f.advance(120);assert.equal(completed.length,2);completed[1]();await Promise.resolve();
 assert.equal(f.host.dataset.pdfResizing,undefined);f.control.dispose();
});
test('unmount cancels a pending calculation and clears the placeholder',()=>{
 const f=fixture();f.resize(600);f.control.dispose();f.advance(1000);assert.equal(f.fits.length,0);assert.equal(f.host.dataset.pdfResizing,undefined);
});
