const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const loaded=new Module('resize-preview.cjs');
loaded._compile(buildSync({entryPoints:['src/wysimark/image-plugin/render-element/image-with-controls/image-resize-controls/resize-preview.ts'],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text,'resize-preview.cjs');
const {createResizePreview}=loaded.exports;
function fixture(){
 let id=0;const frames=new Map(),published=[];
 const preview=createResizePreview({requestAnimationFrame(fn){frames.set(++id,fn);return id},cancelAnimationFrame:id=>frames.delete(id)},size=>published.push(size));
 return {preview,published,frames,paint(){for(const [id,fn]of frames){frames.delete(id);fn()}}};
}
test('pointer bursts publish only their latest size once per animation frame',()=>{
 const f=fixture();for(let i=0;i<120;i++)f.preview.queue({width:i,height:i*2});
 assert.equal(f.frames.size,1);assert.equal(f.published.length,0);f.paint();assert.deepEqual(f.published,[{width:119,height:238}]);
 f.preview.queue({width:80,height:160});f.paint();assert.deepEqual(f.published.at(-1),{width:80,height:160});
});
test('ending or cancelling a gesture discards a stale scheduled preview',()=>{
 const f=fixture();f.preview.queue({width:100,height:200});f.preview.cancel();f.paint();
 assert.equal(f.frames.size,0);assert.equal(f.published.length,0);
 f.preview.queue({width:50,height:100});f.paint();assert.deepEqual(f.published,[{width:50,height:100}]);
});
