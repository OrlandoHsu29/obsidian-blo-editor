const {test}=require('node:test'),assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module');
const loaded=new Module('chunk-visibility.cjs');
loaded._compile(buildSync({entryPoints:['src/chunk-visibility.ts'],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text,'chunk-visibility.cjs');
function fixture(){
 let notify,intersect,disconnected=0,next=0;const observed=new Set(),frames=new Map(),doc={defaultView:{matchMedia:()=>({matches:false}),requestAnimationFrame(fn){frames.set(++next,fn);return next},cancelAnimationFrame(id){frames.delete(id)},ResizeObserver:class{constructor(fn){notify=fn}observe(root){observed.add(root)}unobserve(root){observed.delete(root)}disconnect(){disconnected++}},IntersectionObserver:class{constructor(fn){intersect=fn}observe(){}unobserve(){}disconnect(){disconnected++}}}};
 const registry=loaded.exports.createChunkVisibilityRegistry(doc);
 const root=()=>{const styles=new Map(),events=new Map();return {ownerDocument:doc,dataset:{},styles,events,writes:0,style:{setProperty(k,v){this.root.writes++;styles.set(k,v)}},addEventListener(k,v){events.set(k,v)},removeEventListener(k){events.delete(k)}}};
 const position=(node,top=100,bottom=140,visible=true)=>intersect([{target:node,isIntersecting:visible,boundingClientRect:{top,bottom},rootBounds:{top:0,bottom:900}}]);
 const create=()=>{const node=root();node.style.root=node;const dispose=registry.add(node);return {node,dispose}};
 return {create,observed,frames,position,flush(){const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn())},get disconnected(){return disconnected},resize(node,height,width=800){notify([{target:node,contentRect:{height,width}}])},skip(node,skipped){node.events.get('contentvisibilityautostatechange')({currentTarget:node,skipped})}};
}

test('tall chunks retain their own exact height without repeated style writes',()=>{
 const f=fixture(),{node,dispose}=f.create();f.resize(node,2413.75);assert.equal(node.styles.get('--blo-chunk-height'),'2413.75px');assert.equal(node.dataset.bloChunkMeasured,'true');
 for(let i=0;i<20;i++)f.resize(node,2413.75);assert.equal(node.writes,1);
 f.resize(node,1937);assert.equal(node.styles.get('--blo-chunk-height'),'1937px');dispose();
});

test('offscreen placeholders cannot overwrite cached content heights',()=>{
 const f=fixture(),{node,dispose}=f.create();f.resize(node,2200);f.skip(node,true);f.resize(node,512);assert.equal(node.styles.get('--blo-chunk-height'),'2200px');
 f.skip(node,false);f.resize(node,1800);assert.equal(node.styles.get('--blo-chunk-height'),'1800px');
 f.resize(node,0,0);assert.equal(node.styles.get('--blo-chunk-height'),'1800px');dispose();
});

test('zero-height caret chunks preserve zero rather than becoming a large placeholder',()=>{
 const f=fixture(),{node,dispose}=f.create();f.resize(node,0);assert.equal(node.styles.get('--blo-chunk-height'),'0px');assert.equal(node.dataset.bloChunkMeasured,'true');dispose();
});

test('chunks share observation and release listeners when removed or the editor closes',()=>{
 const f=fixture(),a=f.create(),b=f.create();assert.equal(f.observed.size,2);a.dispose();assert.equal(a.node.events.size,0);assert.equal(f.disconnected,0);
 b.dispose();assert.equal(b.node.events.size,0);assert.equal(f.observed.size,0);assert.equal(f.disconnected,1);
 f.resize(b.node,100);assert.equal(b.node.writes,0);
 const c=f.create();f.resize(c.node,100);assert.equal(c.node.styles.get('--blo-chunk-height'),'100px');c.dispose();
});

test('native visibility changes drive CSS fades without a reveal scheduler',()=>{
 const f=fixture(),{node,dispose}=f.create();f.resize(node,800);
 for(let i=0;i<50;i++){f.skip(node,true);f.skip(node,false)}
 assert.equal(node.dataset.bloChunkSkipped,'false');assert.equal(node.dataset.bloChunkPending,undefined);assert.equal(node.dataset.bloChunkRevealing,undefined);assert.equal(f.frames.size,0);assert.equal(node.writes,1);dispose();
});

test('new and rebuilt visible chunks do not animate during formatting changes',()=>{
 const f=fixture(),a=f.create();assert.equal(a.node.dataset.bloChunkSkipped,undefined);f.skip(a.node,false);f.resize(a.node,80);f.skip(a.node,false);assert.equal(a.node.dataset.bloChunkSkipped,undefined);a.dispose();
 const b=f.create();f.skip(b.node,false);assert.equal(b.node.dataset.bloChunkSkipped,undefined);
 f.skip(b.node,true);assert.equal(b.node.dataset.bloChunkSkipped,'true');f.skip(b.node,false);assert.equal(b.node.dataset.bloChunkSkipped,'false');b.dispose();
});
