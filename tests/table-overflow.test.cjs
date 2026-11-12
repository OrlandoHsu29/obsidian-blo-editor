const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
function compile(entry,external=[],resolve=require){const m=new Module(entry);m.require=resolve;m._compile(buildSync({entryPoints:[entry],bundle:true,platform:'node',format:'cjs',external,write:false}).outputFiles[0].text,entry+'.cjs');return m.exports}
const {fitTableWidth,runTableFit}=compile('src/wysimark/table-plugin/render-element/table-fit.ts');
function fitting({width=320,rows=10,content=2000,fixedHeight,intrinsic=0}={}){
 const values=new Map();let writes=0;
 const table={get offsetWidth(){return Math.max(intrinsic,parseFloat(values.get('--blo-table-width'))||width)},get scrollWidth(){return this.offsetWidth},get offsetHeight(){return fixedHeight??Math.ceil(content/this.offsetWidth)*80}};
 table.rows=Array.from({length:rows},()=>({cells:[{},{},{},{}],get offsetHeight(){return table.offsetHeight/rows}}));
 const scroll={clientWidth:width,querySelector:()=>table};
 const host={dataset:{},ownerDocument:{defaultView:{getComputedStyle:()=>({fontSize:'16px'})}},querySelector:()=>scroll,style:{setProperty:(k,v)=>{writes++;values.set(k,v)},removeProperty:k=>{writes++;values.delete(k)}}};
 return {host,table,get writes(){return writes}};
}
function complete(iterator,onStep=()=>{}){for(let i=0;i<30;i++){const value=iterator.next();onStep();if(value.done)return value.value}throw Error('fit failed to converge')}

test('wide wrapping tables are fitted one width probe at a time',()=>{
 const f=fitting(),iterator=fitTableWidth(f.host);let previous=0,steps=0;
 const result=complete(iterator,()=>{assert(f.writes-previous<=1,'multiple layout writes in one step');previous=f.writes;steps++});
 assert(result.width>320&&result.width<=4096);assert(steps>4&&steps<15);
});
test('comfortable tables keep the available width',()=>{assert.equal(complete(fitTableWidth(fitting({content:100}).host)).width,undefined)});
test('explicit tall rows are not widened when width cannot improve height',()=>{assert.equal(complete(fitTableWidth(fitting({fixedHeight:1400}).host)).width,undefined)});
test('row count alone does not force horizontal overflow',()=>{assert.equal(complete(fitTableWidth(fitting({rows:80,fixedHeight:2000}).host)).width,undefined)});
test('intrinsic nonwrapping content retains horizontal scrolling',()=>{assert.notEqual(complete(fitTableWidth(fitting({content:100,intrinsic:1200}).host)).width,undefined)});

function clock(){
 const e={time:0,sequence:0,frames:new Map(),timers:new Map()};
 e.win={performance:{now:()=>e.time},requestAnimationFrame:fn=>{e.frames.set(++e.sequence,fn);return e.sequence},cancelAnimationFrame:id=>e.frames.delete(id),setTimeout:(fn,delay)=>{e.timers.set(++e.sequence,{fn,at:e.time+delay});return e.sequence},clearTimeout:id=>e.timers.delete(id)};
 e.frame=()=>{const next=[...e.frames];e.frames.clear();next.forEach(([,fn])=>fn(e.time))};
 e.advance=ms=>{e.time+=ms;for(const [id,task]of [...e.timers])if(task.at<=e.time){e.timers.delete(id);task.fn()}};
 e.settle=()=>{for(let i=0;i<80&&(e.frames.size||e.timers.size);i++){e.advance(20);e.frame()}};return e;
}
test('several tables share one layout probe per frame',()=>{
 const e=clock(),calls=[],done=[];function* task(name){calls.push(name);yield;calls.push(name);return {width:400}}
 runTableFit(e.win,task('a'),r=>done.push(r),assert.fail);runTableFit(e.win,task('b'),r=>done.push(r),assert.fail);
 e.frame();assert.deepEqual(calls,['a']);e.frame();assert.deepEqual(calls,['a','b']);e.settle();assert.deepEqual(calls,['a','b','a','b']);assert.equal(done.length,2);
});
test('cancelling queued work prevents stale completion',()=>{
 const e=clock();let steps=0,done=false;function* task(){steps++;yield;steps++;return {}}
 const cancel=runTableFit(e.win,task(),()=>{done=true},assert.fail);e.frame();cancel();e.settle();assert.equal(steps,1);assert.equal(done,false);assert.equal(e.frames.size,0);
});

let active;
const hooks={
 useRef(value){const i=active.refIndex++;return active.refs[i]??(active.refs[i]={current:i===0?active.host:value})},
 useLayoutEffect(callback,deps){const i=active.effectIndex++,old=active.effects[i];if(old&&deps.every((d,j)=>d===old.deps[j]))return;old?.cleanup?.();active.effects[i]={deps,cleanup:callback()}},
};
const measured={
 createTableMeasure(host,width){const e=host.env;e.fits++;e.copies++;return {host:{env:e,width},dispose(){e.copies--}}},
 *fitTableWidth(copy){yield;yield;return {width:copy.env.overflow?copy.width*2:undefined}},runTableFit,
};
const {useTableOverflow}=compile('src/wysimark/table-plugin/render-element/use-table-overflow.ts',['react','./table-fit'],id=>id==='react'?hooks:id==='./table-fit'?measured:require(id));
function fixture(){
 const e=Object.assign(clock(),{refs:[],effects:[],width:320,height:160,fits:0,copies:0,overflow:true,styles:new Map(),listeners:new Map(),disconnected:0});
 const events={addEventListener:(name,fn)=>e.listeners.set(name,fn),removeEventListener:name=>e.listeners.delete(name)};
 Object.assign(e.win,{getComputedStyle:()=>({fontSize:'16px'}),matchMedia:()=>({matches:false}),ResizeObserver:class{constructor(fn){e.resize=fn}observe(){}disconnect(){e.disconnected++}},IntersectionObserver:class{constructor(fn){e.intersection=fn}observe(){}disconnect(){e.disconnected++}}});
 const table={rows:Array(10),get offsetWidth(){return parseFloat(e.styles.get('--blo-table-width'))||e.width},get offsetHeight(){return e.height}};
 const scroll={scrollLeft:127,dataset:{},get offsetHeight(){return e.height+(e.host.dataset.overflow==='true'?31:0)},get clientWidth(){return e.width},get scrollWidth(){return table.offsetWidth},querySelector:()=>table,...events};
 e.host={env:e,isConnected:true,dataset:{},get clientWidth(){return e.width},get offsetHeight(){return parseFloat(e.styles.get('--blo-table-hold-height'))||scroll.offsetHeight},closest:()=>null,ownerDocument:{defaultView:e.win,...events},querySelector:()=>scroll,setAttribute:()=>{},removeAttribute:()=>{},style:{setProperty:(k,v)=>e.styles.set(k,v),removeProperty:k=>e.styles.delete(k),getPropertyValue:k=>e.styles.get(k)||''}};
 e.table=table;e.scroll=scroll;e.render=element=>{active=e;e.element=element;e.refIndex=0;e.effectIndex=0;useTableOverflow(element)};
 e.enter=value=>{e.intersection([{isIntersecting:value}]);e.settle()};e.cleanup=()=>e.effects.forEach(effect=>effect.cleanup?.());e.render({children:[],columns:[]});return e;
}

test('first layout reserves a rectangle and publishes the fitted result once',()=>{
 const e=fixture();assert.equal(e.host.dataset.tableLayout,'pending');e.enter(true);assert.equal(e.fits,1);assert.equal(e.copies,0);assert.equal(e.host.dataset.tableLayout,undefined);assert.equal(e.table.offsetWidth,640);assert.equal(e.scroll.scrollLeft,127);e.cleanup();
});
test('unchanged viewport re-entry reuses the completed fit',()=>{
 const e=fixture();e.enter(true);for(let i=0;i<20;i++){e.enter(false);e.enter(true)}assert.equal(e.fits,1);e.cleanup();
});
test('continuous resize holds the rectangle and delays computation until settling',()=>{
 const e=fixture();e.enter(true);for(let i=0;i<15;i++){e.width=400+i*10;e.resize();e.advance(16);e.frame();assert.equal(e.host.dataset.tableLayout,'pending');assert.equal(e.fits,1)}e.settle();assert.equal(e.fits,2);assert.equal(e.copies,0);assert.equal(e.table.offsetWidth,e.width*2);e.cleanup();
});
test('pointer release starts the final fit without waiting for resize debounce',()=>{
 const e=fixture();e.enter(true);e.width=500;e.resize();assert.equal(e.fits,1);e.listeners.get('pointerup')();e.frame();assert.equal(e.fits,2);e.settle();e.cleanup();
});
test('content changes invalidate the fit without hiding an actively visible table',()=>{
 const e=fixture();e.enter(true);e.render({...e.element,children:[{}]});assert.notEqual(e.host.dataset.tableLayout,'pending');e.settle();assert.equal(e.fits,2);e.cleanup();
});
test('indentation-only model updates reuse content and do not invalidate fitting',()=>{
 const e=fixture();e.enter(true);e.render({...e.element,__blockDepth:1});e.settle();assert.equal(e.fits,1);e.cleanup();
});
test('offscreen content changes wait for viewport prefetch',()=>{
 const e=fixture();e.enter(true);e.enter(false);e.render({...e.element,children:[{}]});e.settle();assert.equal(e.fits,1);e.enter(true);assert.equal(e.fits,2);e.cleanup();
});
test('cleanup cancels measurements, timers and all observers',()=>{
 const e=fixture();e.intersection([{isIntersecting:true}]);e.advance(1);e.frame();assert.equal(e.copies,1);e.cleanup();e.settle();assert.equal(e.copies,0);assert.equal(e.frames.size,0);assert.equal(e.timers.size,0);assert.equal(e.listeners.size,0);assert.equal(e.disconnected,2);
});

test('images changing row height do not restart width fitting or show the mask again',()=>{
 const e=fixture();e.enter(true);for(let i=0;i<20;i++){e.height+=20;e.resize();e.settle();assert.notEqual(e.host.dataset.tableLayout,'pending')}assert.equal(e.fits,1);e.enter(false);e.enter(true);assert.equal(e.fits,1);e.cleanup();
});

test('a nonoverflow table restores automatic width after the resize placeholder',()=>{
 const e=fixture();e.overflow=false;e.enter(true);assert.equal(e.styles.has('--blo-table-width'),false);e.width=480;e.resize();assert.equal(e.styles.get('--blo-table-width'),'320px');e.settle();assert.equal(e.styles.has('--blo-table-width'),false);assert.equal(e.table.offsetWidth,480);e.cleanup();
});

test('returning to the cached viewport width releases the placeholder without refitting',()=>{
 const e=fixture();e.overflow=false;e.enter(true);e.width=480;e.resize();e.advance(30);e.width=320;e.resize();e.settle();assert.equal(e.fits,1);assert.equal(e.host.dataset.tableLayout,undefined);assert.equal(e.styles.has('--blo-table-width'),false);e.cleanup();
});

test('content refitting waits until scrolling stops without masking the table',()=>{
 const e=fixture();e.enter(true);e.render({...e.element,children:[{}]});
 for(let i=0;i<20;i++){e.listeners.get('scroll')({target:e.scroll});e.advance(20);e.frame();assert.equal(e.fits,1);assert.equal(e.host.dataset.tableLayout,undefined)}
 e.settle();assert.equal(e.fits,2);assert.equal(e.copies,0);e.cleanup();
});

test('scrolling pauses an existing search and resumes it without another clone',()=>{
 const e=fixture();e.enter(true);e.render({...e.element,children:[{}]});e.advance(120);e.frame();assert.equal(e.copies,1);
 for(let i=0;i<20;i++){e.listeners.get('scroll')({target:e.scroll});e.advance(20);e.frame();assert.equal(e.copies,1);assert.equal(e.fits,2)}
 e.settle();assert.equal(e.fits,2);assert.equal(e.copies,0);e.cleanup();
});
