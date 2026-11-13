const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const loaded=new Module('anchored-overlay.cjs');
loaded._compile(buildSync({entryPoints:['src/wysimark/use-reposition/observe-anchored-overlay.ts'],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text,'anchored-overlay.cjs');
const {observeAnchoredOverlay}=loaded.exports;

function fixture(scale=1,boxSizing='border-box'){
 const e={maxHeight:246,frames:new Map(),sequence:0,updates:[],disconnected:false,scrollHeight:244,width:280,viewportHeight:900,viewportWidth:1200};
 const height=()=>e.maxHeight>=245.5?245.5:245;
 const rect=(left,top,width,height)=>({left,top,right:left+width,bottom:top+height,width,height});
 const win={innerHeight:900,requestAnimationFrame:fn=>{e.frames.set(++e.sequence,fn);return e.sequence},cancelAnimationFrame:id=>e.frames.delete(id),addEventListener(){},removeEventListener(){},
  ResizeObserver:class{constructor(fn){e.resize=fn}observe(){}disconnect(){e.disconnected=true}},
  getComputedStyle:()=>({boxSizing,width:`${e.width-(boxSizing==='border-box'?0:22)}px`,height:`${height()-(boxSizing==='border-box'?0:21.5)}px`,paddingLeft:'10px',paddingRight:'10px',paddingTop:'10px',paddingBottom:'10px',borderLeftWidth:'1px',borderRightWidth:'1px',borderTopWidth:'.75px',borderBottomWidth:'.75px'}),
 };
 Object.defineProperty(win,'innerHeight',{get:()=>e.viewportHeight});
 const doc={nodeType:9,defaultView:win,documentElement:{get clientWidth(){return e.viewportWidth}},addEventListener(){},removeEventListener(){}};
 const anchor={ownerDocument:doc,isConnected:true,closest:()=>null,getBoundingClientRect:()=>rect(120,600,100,20)};
 const panel={offsetWidth:e.width,offsetHeight:245,get clientWidth(){return e.maxHeight>=245.5?278:267},get clientHeight(){return e.maxHeight>=245.5?244:243},get scrollHeight(){return e.scrollHeight},get scrollWidth(){return this.clientWidth},getBoundingClientRect:()=>rect(0,0,e.width*scale,height()*scale)};
 e.tracker=observeAnchoredOverlay(anchor,panel,next=>{e.updates.push(next);e.maxHeight=next.maxHeight},{allowResize:true});
 e.settle=()=>{for(let i=0;i<15;i++)e.tracker.place()};
 return e;
}

for(const scale of [1,.8125,1.25])for(const boxSizing of ['border-box','content-box']){
 test(`fractional panel dimensions settle without scrollbar oscillation at scale ${scale} (${boxSizing})`,()=>{
  const e=fixture(scale,boxSizing);e.settle();
  assert.equal(e.maxHeight,246);
  assert.equal(new Set(e.updates.map(p=>p.maxHeight)).size,1);
  assert.equal(new Set(e.updates.map(p=>p.maxWidth)).size,1);
  assert(e.updates.every(p=>p.visible));
  e.tracker.dispose();assert.equal(e.disconnected,true);
 });
}
test('real content and viewport changes still update overlay constraints',()=>{
 const e=fixture();e.settle();e.scrollHeight=400;e.tracker.place();
 assert.equal(e.maxHeight,402);
 e.viewportWidth=220;e.tracker.place();assert.equal(e.updates.at(-1).maxWidth,204);assert(e.updates.at(-1).visible);
 e.tracker.dispose();
});
test('unmount cancels queued resize measurements',()=>{
 const e=fixture();e.resize();assert.equal(e.frames.size,1);e.tracker.dispose();assert.equal(e.frames.size,0);
});
