const {test}=require('node:test'),assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module');
class TFile {}
const navigation=new Module('presentation-navigation.cjs');navigation.require=require;
navigation._compile(buildSync({entryPoints:['src/presentation/navigation.ts'],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text,'presentation-navigation.cjs');
const {registerPresentationExit,openOutsidePresentation,mountPresentationOverlay}=navigation.exports;
test('external tab and dialog navigation waits for the shared fullscreen exit and cleans up',async()=>{
 const doc={},calls=[];let finish;
 const cleanup=registerPresentationExit(doc,()=>new Promise(resolve=>{calls.push('exit');finish=resolve}));
 const opening=openOutsidePresentation(doc,()=>calls.push('viewer'));assert.deepEqual(calls,['exit']);finish();await opening;
 assert.deepEqual(calls,['exit','viewer']);cleanup();
 const normal=openOutsidePresentation(doc,()=>calls.push('normal'));assert.equal(calls.at(-1),'normal');await normal;
});
test('image overlays mount in their own presentation without exiting and stop routing after cleanup',()=>{
 const doc={},other={},calls=[],cleanup=registerPresentationExit(doc,async()=>calls.push('exit'),element=>calls.push(element));
 const viewer={ownerDocument:doc};mountPresentationOverlay(viewer);mountPresentationOverlay({ownerDocument:other});assert.deepEqual(calls,[viewer]);
 cleanup();mountPresentationOverlay(viewer);assert.deepEqual(calls,[viewer]);
});
test('the shared viewer guard isolates windows and does not open after a failed exit',async()=>{
 const doc={},other={},calls=[],cleanup=registerPresentationExit(doc,async()=>{throw Error('exit failed')});
 await openOutsidePresentation(other,()=>calls.push('other window'));
 await assert.rejects(openOutsidePresentation(doc,()=>calls.push('hidden viewer')),/exit failed/);
 assert.deepEqual(calls,['other window']);cleanup();
});
function fixture(exitPresentation){
 const calls=[],editor={},source=Object.assign(new TFile(),{path:'note.md'}),drawing=Object.assign(new TFile(),{path:'drawing.excalidraw.md'});
 const leaf={view:{editor,exitPresentation}},app={plugins:{plugins:{'obsidian-excalidraw-plugin':{}}},vault:{getAbstractFileByPath:()=>source},workspace:{getLeavesOfType:()=>[leaf]}};
 const m=new Module('drawings-navigation.cjs'),noop=()=>{};
 m.require=id=>id==='obsidian'?{TFile}:id==='./drawing-navigation'?{openEmbeddedDrawing:async()=>{calls.push('open');return true}}:new Proxy({},{get:()=>noop});
 m._compile(buildSync({entryPoints:['src/drawings.tsx'],bundle:true,platform:'node',format:'cjs',external:['*'],write:false,jsx:'automatic'}).outputFiles[0].text,'drawings-navigation.cjs');
 return {open:()=>m.exports.openDrawing(app,drawing,{sourcePath:source.path,editor}),calls};
}
test('opening an embedded drawing waits for presentation fullscreen to exit',async()=>{
 let finish;const f=fixture(()=>new Promise(resolve=>{finish=resolve})),opening=f.open();
 assert.deepEqual(f.calls,[]);finish();await opening;assert.deepEqual(f.calls,['open']);
});
test('a failed fullscreen exit does not switch to an inaccessible drawing tab',async()=>{
 const f=fixture(async()=>{throw Error('fullscreen exit failed')});await assert.rejects(f.open(),/fullscreen exit failed/);assert.deepEqual(f.calls,[]);
});
test('ordinary embedded drawing navigation works without a presentation controller',async()=>{
 const f=fixture(undefined);await f.open();assert.deepEqual(f.calls,['open']);
});
