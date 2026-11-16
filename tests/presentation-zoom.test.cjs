const {test}=require('node:test'),assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module');
const m=new Module('presentation-zoom.cjs');m.require=id=>id==='obsidian'?{}:require(id);
m._compile(buildSync({stdin:{contents:"export * from './src/presentation/zoom';export {PresentationMode} from './src/presentation/presentation-mode';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian'],write:false}).outputFiles[0].text,'presentation-zoom.cjs');
const {sliderToScale,scaleToSlider,snapToDefault,canResetZoom,PresentationMode}=m.exports;
test('zoom slider centers 100% and maps continuously over 50–200%',()=>{
 assert.equal(sliderToScale(-100),0.5);assert.equal(sliderToScale(0),1);assert.equal(sliderToScale(100),2);
 for(const scale of [0.5,0.755,1,1.374,2])assert(Math.abs(sliderToScale(scaleToSlider(scale))-scale)<1e-10);
 assert.equal(snapToDefault(1.03),1);assert.equal(snapToDefault(0.97),1);assert.equal(snapToDefault(1.05),1.05);
});
test('default-point hit testing begins at exactly 80% / 120%',()=>{
 for(const scale of [1,0.801,1.199,0.85,1.15])assert.equal(canResetZoom(scale),false);
 for(const scale of [0.8,1.2,0.5,2])assert.equal(canResetZoom(scale),true);
});
function fixture(){
 const styles=new Map(),frames=new Map();let next=0;
 const win={performance:{now:()=>100},requestAnimationFrame:fn=>{frames.set(++next,fn);return next},cancelAnimationFrame:id=>frames.delete(id)};
 const doc={defaultView:win},host={ownerDocument:doc,querySelector:()=>null,style:{setProperty:(k,v)=>styles.set(k,v)}};doc.fullscreenElement=host;
 const mode=new PresentationMode(host,()=>{});mode.zoomInput={value:''};mode.zoomSlider={value:'',setAttribute(){}};mode.zoomMarker={disabled:false};
 return {mode,doc,styles,flush(){const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn())}};
}
test('whole-content zoom preserves the minimum column and synchronizes slider, input and reset marker',()=>{
 const {mode,styles}=fixture();mode.setContentScale(0.75);assert.equal(styles.get('--blo-presentation-content-width'),'1120px');assert.equal(styles.get('--blo-presentation-scale'),'0.75');assert.equal(mode.zoomInput.value,'75%');
 mode.setContentScale(1.5);assert.equal(styles.get('--blo-presentation-content-width'),'1680px');assert.equal(mode.zoomMarker.disabled,false);
 mode.setContentScale(1);assert.equal(mode.zoomInput.value,'100%');assert.equal(mode.zoomSlider.value,'0');assert.equal(mode.zoomMarker.disabled,true);
});
test('presentation keys and Ctrl-wheel use the same scale and stop intercepting outside fullscreen',()=>{
 const f=fixture();let prevented=0;const event={ctrlKey:true,metaKey:false,altKey:false,preventDefault(){prevented++},stopImmediatePropagation(){}};
 f.mode.zoomKey({...event,key:'+'});assert.equal(f.mode.zoomInput.value,'110%');
 f.mode.zoomKey({...event,key:'-'});assert.equal(f.mode.zoomInput.value,'100%');
 f.mode.zoomWheel({...event,deltaY:-100,deltaMode:0});f.flush();assert(f.mode.contentScale>1);
 f.mode.zoomKey({...event,key:'0'});assert.equal(f.mode.contentScale,1);assert.equal(prevented,4);
 f.doc.fullscreenElement=null;f.mode.zoomKey({...event,key:'+'});assert.equal(prevented,4);assert.equal(f.mode.contentScale,1);
});

