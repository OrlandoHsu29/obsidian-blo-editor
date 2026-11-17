const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
class Component {constructor(){this.cleanups=[]}addChild(c){return c}register(fn){this.cleanups.push(fn)}load(){this.onload()}unload(){this.onunload();this.cleanups.splice(0).forEach(fn=>fn())}}
const loaded=new Module('pdf-render-owner.cjs');
loaded.require=id=>id==='obsidian'?{Component}:require(id);
loaded._compile(buildSync({entryPoints:['src/pdf-render-owner.ts'],bundle:true,platform:'node',format:'cjs',external:['obsidian'],write:false}).outputFiles[0].text,'pdf-render-owner.cjs');
const {PdfRenderOwner}=loaded.exports;
test('interactive rendering keeps continuous page scrolling and fits the page width',async()=>{
 const owner=new PdfRenderOwner();owner.load();let ratio;
 const viewer={currentPageNumber:2,currentScaleValue:1,scrollMode:0,spreadMode:1,getPageView(index){assert.equal(index,1);return {pdfPage:{getViewport:()=>({width:600,height:800})}}}};
 const host={opts:{displayMode:true},then(fn){fn({pdfViewer:{pdfViewer:viewer}})}};
 owner.addChild({viewer:host});assert.equal(host.opts.displayMode,false);
 owner.fit(value=>ratio=value);await Promise.resolve();
 assert.equal(ratio,800/600);assert.equal(viewer.currentScaleValue,'page-width');assert.equal(viewer.scrollMode,0);assert.equal(viewer.spreadMode,0);owner.unload();
});
test('a PDF that finishes loading after unmount cannot update layout',async()=>{
 const owner=new PdfRenderOwner();owner.load();let resolve,updates=0;
 const viewer={firstPagePromise:new Promise(r=>resolve=r),currentPageNumber:1,getPageView(){updates++}};
 owner.addChild({viewer:{opts:{},then:fn=>fn({pdfViewer:{pdfViewer:viewer}})}});
 owner.fit(()=>updates++);owner.unload();resolve();await Promise.resolve();assert.equal(updates,0);
});

test('a pending first-page load cannot resume rendering after resizing suspends it',async()=>{
 const owner=new PdfRenderOwner();owner.load();let resolve,updates=0,renders=0;
 const queue={highestPriorityPage:null,renderHighestPriority(){renders++}};
 const viewer={firstPagePromise:new Promise(r=>resolve=r),currentPageNumber:1,renderingQueue:queue,getPageView(){updates++;return {renderingState:3,pdfPage:{getViewport:()=>({width:600,height:800})}}}};
 owner.addChild({viewer:{opts:{},then:fn=>fn({pdfViewer:{pdfViewer:viewer}})}});
 owner.fit(()=>updates++);owner.suspend();resolve();await new Promise(r=>setImmediate(r));
 queue.renderHighestPriority();assert.equal(updates,0);assert.equal(renders,0);
 owner.fit(()=>{});await new Promise(r=>setImmediate(r));assert.equal(renders,1);owner.unload();
});
test('missing private PDF interfaces are safely ignored',()=>{
 const owner=new PdfRenderOwner();owner.load();owner.addChild({});owner.fit(()=>assert.fail());owner.unload();
});

test('the transition waits for the current page render and releases native listeners',async()=>{
 const listeners=new Map(),bus={_on:(name,fn)=>listeners.set(name,fn),_off:name=>listeners.delete(name)};
 const owner=new PdfRenderOwner();owner.load();let completed=0;
 const viewer={currentPageNumber:1,currentScaleValue:1,getPageView:()=>({renderingState:0,pdfPage:{getViewport:()=>({width:600,height:800})}})};
 owner.addChild({viewer:{opts:{},then:fn=>fn({pdfViewer:{pdfViewer:viewer,eventBus:bus}})}});
 owner.fit(()=>{},()=>completed++);await Promise.resolve();assert.equal(completed,0);
 listeners.get('pagerendered')({pageNumber:2});assert.equal(completed,0);
 listeners.get('pagerendered')({pageNumber:1});await new Promise(r=>setImmediate(r));assert.equal(completed,1);
 owner.unload();assert.equal(listeners.size,0);
});

test('pause stops native resize observation and the rendering queue until the final fit',async()=>{
 const owner=new PdfRenderOwner();owner.load();let disconnects=0,renders=0;
 const original=function(){renders++},queue={highestPriorityPage:'page1',renderHighestPriority:original};
 const viewer={currentPageNumber:1,currentScaleValue:1,renderingQueue:queue,getPageView:()=>({renderingState:3,pdfPage:{getViewport:()=>({width:600,height:800})}})};
 owner.addChild({viewer:{opts:{},then:fn=>fn({resizeObserver:{disconnect(){disconnects++}},pdfViewer:{pdfViewer:viewer}})}});
 assert.equal(disconnects,1);owner.suspend();
 for(let i=0;i<20;i++)queue.renderHighestPriority();assert.equal(renders,0);assert.equal(queue.highestPriorityPage,null);
 owner.fit(()=>{});await new Promise(r=>setImmediate(r));assert.equal(renders,1);
 owner.unload();assert.equal(queue.renderHighestPriority,original);
});

test('viewport suspension resumes rendering without resetting the page or user zoom',()=>{
 const owner=new PdfRenderOwner();owner.load();let renders=0;const queue={highestPriorityPage:'page8',renderHighestPriority(){renders++}};
 const viewer={currentPageNumber:8,currentScaleValue:'150%',renderingQueue:queue};owner.addChild({viewer:{opts:{},then:fn=>fn({pdfViewer:{pdfViewer:viewer}})}});
 owner.setScrollPaused(true);queue.renderHighestPriority();assert.equal(renders,0);assert.equal(queue.highestPriorityPage,null);
 owner.setScrollPaused(false);assert.equal(renders,1);assert.equal(viewer.currentPageNumber,8);assert.equal(viewer.currentScaleValue,'150%');
 owner.suspend();owner.setScrollPaused(false);assert.equal(renders,1);owner.unload();
});
