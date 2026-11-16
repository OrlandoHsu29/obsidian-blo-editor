const {test}=require('node:test'),assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module');
const loaded=new Module('presentation-scroll.cjs'),originalRequire=loaded.require.bind(loaded);
loaded.require=name=>name==='obsidian'?{}:originalRequire(name);
loaded._compile(buildSync({entryPoints:['src/presentation/presentation-mode.ts'],bundle:true,platform:'node',format:'cjs',external:['obsidian'],write:false}).outputFiles[0].text,'presentation-scroll.cjs');
const {PresentationMode}=loaded.exports;
test('presentation hosts an image overlay and restores it on exit without stealing its gestures',async()=>{
 const win={performance:{now:()=>100},cancelAnimationFrame(){}},doc={defaultView:win},restored=[];
 const parent={insertBefore:(el,next)=>{restored.push([el,next]);el.parentNode=parent}},next={parentNode:parent};
 const host={ownerDocument:doc,querySelector:()=>null,append:el=>{el.parentNode=host},classList:{remove(){}}};
 const classes=new Set(),overlay={parentNode:parent,nextSibling:next,classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)}};
 const mode=new PresentationMode(host,()=>{});mode.mountOverlay(overlay);mode.mountOverlay(overlay);
 assert.equal(overlay.parentNode,host);assert.equal(mode.overlays.size,1);
 assert.equal(mode.controlTarget({target:{nodeType:1,closest:selector=>selector==='.blo-presentation-overlay'?overlay:null}}),true);
 await mode.exit();assert.equal(classes.size,0);assert.equal(mode.overlays.size,0);assert.deepEqual(restored,[[overlay,next]]);
});
test('simultaneous navigation and tab-change exits share one fullscreen transition',async()=>{
 let release,calls=0,finished=0;
 const doc={defaultView:{performance:{now:()=>100},cancelAnimationFrame(){}},exitFullscreen:()=>{calls++;return new Promise(resolve=>{release=()=>{doc.fullscreenElement=null;resolve()}})}};
 const host={ownerDocument:doc,querySelector:()=>null,classList:{remove(){}}};doc.fullscreenElement=host;
 const mode=new PresentationMode(host,()=>finished++),first=mode.exit(),second=mode.exit();
 assert.equal(first,second);assert.equal(calls,1);assert.equal(finished,0);
 release();await Promise.all([first,second]);assert.equal(finished,1);await mode.exit();assert.equal(calls,1);
});
test('laser marks follow document scroll while the cursor dot stays at the pointer',()=>{
 const scroller={scrollLeft:10,scrollTop:300},transforms=[],vertices=[];
 const context={clearRect(){},save(){},restore(){},translate(x,y){transforms.push([x,y])},beginPath(){},moveTo(x,y){vertices.push([x,y])},lineTo(){},closePath(){},fill(){}};
 const win={performance:{now:()=>100},requestAnimationFrame:()=>1,cancelAnimationFrame(){}};
 const host={ownerDocument:{defaultView:win},querySelector:()=>scroller};
 const mode=new PresentationMode(host,()=>{});mode.left=20;mode.top=30;mode.width=800;mode.height=600;
 mode.canvas={getContext:()=>context};mode.dot={hidden:true,style:{}};mode.scroll();
 const first=mode.position({clientX:120,clientY:230});assert.deepEqual(first,{x:110,y:500});
 mode.trail.begin(first.x,first.y,100);mode.trail.move(first.x+100,first.y,100);mode.paint();
 const firstVertex=vertices.at(-1),dot=mode.dot.style.transform;
 scroller.scrollTop+=120;scroller.scrollLeft+=5;mode.scroll();mode.paint();
 assert.deepEqual(vertices.at(-1),firstVertex); // The stored document position is unchanged.
 assert.deepEqual(transforms.at(-1),[-15,-420]); // The viewport moves over those marks.
 assert.equal(mode.dot.style.transform,dot);
 assert.deepEqual(mode.position({clientX:120,clientY:230}),{x:115,y:620});
});
