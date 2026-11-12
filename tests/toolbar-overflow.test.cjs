const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
let current;
const hooks={useState:n=>[n,value=>{current.count=value}],useLayoutEffect:fn=>{current.cleanup=fn()}};
const m=new Module('toolbar-overflow.cjs');m.require=id=>id==='react'?hooks:require(id);m._compile(buildSync({entryPoints:['src/wysimark/toolbar-plugin/components/toolbar/use-toolbar-overflow.ts'],bundle:true,platform:'node',format:'cjs',external:['react'],write:false}).outputFiles[0].text,'toolbar-overflow.cjs');
function fixture(){
 const e={width:180,reads:0,count:5,closed:0,frames:new Map(),next:0};
 const control=width=>({width,getBoundingClientRect(){e.reads++;return {width:this.width}}});
 e.controls=[32,32,8,32,32].map(control);e.more=control(32);
 e.parent={get clientWidth(){return e.width}};
 const win={getComputedStyle:()=>({paddingLeft:'0px',paddingRight:'0px',marginLeft:'0px',marginRight:'0px',borderLeftWidth:'0px',borderRightWidth:'0px'}),requestAnimationFrame:fn=>{e.frames.set(++e.next,fn);return e.next},cancelAnimationFrame:id=>e.frames.delete(id),ResizeObserver:class{constructor(fn){e.resize=entries=>fn(entries.map(entry=>({...entry,contentRect:{width:entry.target===e.parent?e.width:entry.target.width||e.width}})))}observe(){}disconnect(){e.disconnected=true}}};
 e.host={parentElement:e.parent,ownerDocument:{defaultView:win},querySelectorAll:()=>e.controls,querySelector:()=>e.more};
 e.flush=()=>{for(const [id,fn]of [...e.frames]){e.frames.delete(id);fn()}};current=e;m.exports.useToolbarOverflow({current:e.host},[{},{} ,'divider',{},{}],true,()=>e.closed++);return e;
}
test('resizing the toolbar budget reuses fixed control widths',()=>{
 const e=fixture(),reads=e.reads;assert.equal(e.count,5);
 for(const [width,count]of [[90,1],[110,2],[200,5]]){e.width=width;e.resize([{target:e.parent}]);e.flush();assert.equal(e.count,count)}assert.equal(e.reads,reads);assert.equal(e.closed,3);e.cleanup();
});
test('theme or font changes invalidate control width caching',()=>{
 const e=fixture();e.width=100;e.resize([{target:e.parent}]);e.flush();assert.equal(e.count,2);const reads=e.reads;e.controls[0].width=48;e.resize([{target:e.controls[0]}]);e.flush();assert.equal(e.count,1);assert(e.reads>reads);e.cleanup();
});
test('unmount cancels pending toolbar measurements',()=>{
 const e=fixture();e.width=90;e.resize([{target:e.parent}]);e.cleanup();e.flush();assert.equal(e.count,5);assert.equal(e.frames.size,0);assert.equal(e.disconnected,true);
});

test('height-only document resizes do not schedule toolbar measurement',()=>{
 const e=fixture();e.resize([{target:e.parent}]);e.flush();
 for(let i=0;i<20;i++)e.resize([{target:e.parent}]);assert.equal(e.frames.size,0);e.cleanup();
});
