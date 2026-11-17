const {test}=require('node:test'),assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module');
const loaded=new Module('viewport-work.cjs');loaded._compile(buildSync({entryPoints:['src/viewport-work.ts'],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text,'viewport-work.cjs');
function fixture(){
 let now=0,next=0,intersection,disconnected=0;const frames=new Map(),timers=new Map(),events=new Map();
 const win={performance:{now:()=>now},requestAnimationFrame(fn){frames.set(++next,fn);return next},cancelAnimationFrame(id){frames.delete(id)},setTimeout(fn,ms){timers.set(++next,{fn,at:now+ms});return next},clearTimeout(id){timers.delete(id)},IntersectionObserver:class{constructor(fn){intersection=fn}observe(){}unobserve(){}disconnect(){disconnected++}}};
 const scroller={scrollTop:0,ownerDocument:{defaultView:win},addEventListener(k,fn){events.set(k,fn)},removeEventListener(k){events.delete(k)}};
 const queue=loaded.exports.createViewportWorkQueue(scroller),hosts=[];
 return {queue,scroller,frames,timers,events,add(work,kind='pdf'){const host={dataset:{},matches:selector=>selector==='.'+'blo-'+kind};hosts.push(host);return {host,dispose:queue.add(host,work)}},enter(host,near=true,top=100,bottom=300){intersection([{target:host,isIntersecting:near,boundingClientRect:{top,bottom},rootBounds:{top:-1000,bottom:1900}}])},frame(){const tasks=[...frames.values()];frames.clear();tasks.forEach(fn=>fn())},advance(ms){now+=ms;for(const[id,t]of[...timers])if(t.at<=now){timers.delete(id);t.fn()}},get disconnected(){return disconnected}};
}

test('distant embeds do not render and continuous scrolling waits for 80ms of quiet',async()=>{
 const f=fixture();let loads=0;const item=f.add({load(){loads++}});f.frame();assert.equal(loads,0);f.enter(item.host);
 for(let i=0;i<10;i++){f.events.get('scroll')();f.advance(20);f.frame();assert.equal(loads,0)}
 f.events.get('scroll')();f.advance(79);f.frame();assert.equal(loads,0);f.advance(1);f.frame();await Promise.resolve();assert.equal(loads,1);assert.equal(item.host.dataset.bloRenderPaused,undefined);item.dispose();
});

test('one expensive embed starts per frame, with the viewport before nearest buffers',()=>{
 const f=fixture(),calls=[],above=f.add({load:()=>{calls.push('above')}}),below=f.add({load:()=>{calls.push('below')}}),visible=f.add({load:()=>{calls.push('visible')}});
 f.enter(above.host,true,-700,-500);f.enter(below.host,true,1100,1300);f.enter(visible.host);f.frame();assert.deepEqual(calls,['visible']);f.frame();assert.deepEqual(calls,['visible','below']);f.frame();assert.deepEqual(calls,['visible','below','above']);[above,below,visible].forEach(x=>x.dispose());
});

test('a new jump drops stale buffered jobs before starting expensive work',()=>{
 const f=fixture(),calls=[],a=f.add({load:()=>{calls.push('a')}}),b=f.add({load:()=>{calls.push('b')}});f.enter(a.host);f.enter(a.host,false);f.enter(b.host);f.frame();assert.deepEqual(calls,['b']);a.dispose();b.dispose();
});

test('cached embeds keep their preview while offscreen work suspends and resumes without reloading',async()=>{
 const f=fixture();let loads=0,pauses=0,resumes=0;const item=f.add({load(){loads++},suspend(){pauses++},resume(){resumes++}});f.enter(item.host);f.frame();await Promise.resolve();f.enter(item.host,false);assert.equal(pauses,1);assert.equal(item.host.dataset.bloRenderPaused,undefined);
 f.events.get('scroll')();f.enter(item.host);f.advance(79);f.frame();assert.equal(resumes,0);f.advance(1);f.frame();assert.equal(loads,1);assert.equal(resumes,1);assert.equal(item.host.dataset.bloRenderPaused,undefined);item.dispose();
});

test('an old asynchronous completion cannot expose an embed outside the new window',async()=>{
 const f=fixture();let resolve;const item=f.add({load:()=>new Promise(r=>resolve=r)});f.enter(item.host);f.frame();f.enter(item.host,false);resolve();await Promise.resolve();assert.equal(item.host.dataset.bloRenderPaused,'true');item.dispose();
});

test('export can load offscreen drawings without starting PDF viewers or scrolling the note',async()=>{
 const f=fixture(),calls=[],drawing=f.add({load:()=>{calls.push('drawing')}},'drawing'),pdf=f.add({load:()=>{calls.push('pdf')}});await f.queue.flush({contains:()=>true});assert.deepEqual(calls,['drawing']);assert.equal(drawing.host.dataset.bloRenderPaused,undefined);assert.equal(pdf.host.dataset.bloRenderPaused,'true');drawing.dispose();pdf.dispose();
});

test('cleanup cancels idle timers, queued frames and shared observers',()=>{
 const f=fixture(),item=f.add({load:assert.fail});f.enter(item.host);f.events.get('scroll')();f.frame();assert.equal(f.timers.size,1);item.dispose();assert.equal(f.frames.size,0);assert.equal(f.timers.size,0);assert.equal(f.events.size,0);assert.equal(f.disconnected,1);
});

test('scrollbar jumps never remask cached controls inside the existing window',async()=>{
 const f=fixture();let loads=0,pauses=0,resumes=0;const item=f.add({load(){loads++},suspend(){pauses++},resume(){resumes++}});f.enter(item.host);f.frame();await Promise.resolve();
 f.scroller.scrollTop=1600;f.events.get('scroll')();assert.equal(pauses,0);assert.equal(item.host.dataset.bloRenderPaused,undefined);
 for(let i=0;i<8;i++){f.scroller.scrollTop+=100;f.events.get('scroll')();f.advance(25);f.frame();assert.equal(resumes,0)}
 f.events.get('scroll')();f.advance(79);f.frame();assert.equal(resumes,0);f.advance(1);f.frame();assert.equal(resumes,0);assert.equal(loads,1);assert.equal(item.host.dataset.bloRenderPaused,undefined);item.dispose();
});

test('short independent gestures keep cached controls visible instead of accumulating distance',async()=>{
 const f=fixture();let pauses=0;const item=f.add({load(){},suspend(){pauses++}});f.enter(item.host);f.frame();await Promise.resolve();
 for(let i=0;i<8;i++){f.scroller.scrollTop+=200;f.events.get('scroll')();f.advance(350);f.frame()}
 assert.equal(pauses,0);assert.equal(item.host.dataset.bloRenderPaused,undefined);item.dispose();
});
