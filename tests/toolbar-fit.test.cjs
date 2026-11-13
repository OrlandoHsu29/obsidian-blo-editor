const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const loaded=new Module('toolbar-fit.cjs');loaded.require=require;
loaded._compile(buildSync({entryPoints:['src/wysimark/toolbar-plugin/components/toolbar/fit-toolbar.ts'],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text,'toolbar-fit.cjs');
const {fitToolbar,toolbarIndices}=loaded.exports;
const items=[{title:'style'},'divider',{title:'bold'},{title:'italic'},'divider',{title:'table'},{title:'link'},{title:'attachment'},'divider',{title:'drawing'}];
const widths=items.map(item=>item==='divider'?8:32);
const order=[9,3,2,7,6,5,0];
const titles=indices=>indices.filter(index=>items[index]!=='divider').map(index=>items[index].title);

test('priority fitting keeps right-hand essential controls while optional controls disappear',()=>{
 assert.deepEqual(titles(fitToolbar(items,widths,235,32,items.length,order)),['style','bold','table','link','attachment']);
 assert.deepEqual(titles(fitToolbar(items,widths,180,32,items.length,order)),['style','table','link','attachment']);
 assert.deepEqual(titles(fitToolbar(items,widths,140,32,items.length,order)),['style','table','link']);
});

test('every width preserves priority, original button order and separator hygiene',()=>{
 for(let width=0;width<=350;width++){
  const visible=fitToolbar(items,widths,width,32,items.length,order),set=new Set(visible);
  assert.deepEqual(visible,[...visible].sort((a,b)=>a-b));
  let seenVisible=false;
  for(const index of order){if(set.has(index))seenVisible=true;else assert.equal(seenVisible,false,'lower-priority tool survived a primary tool')}
  if(visible.length){assert.notEqual(items[visible[0]],'divider');assert.notEqual(items[visible.at(-1)],'divider')}
  for(let i=1;i<visible.length;i++)assert.ok(items[visible[i]]!=='divider'||items[visible[i-1]]!=='divider');
  const used=visible.reduce((sum,index)=>sum+widths[index],0)+(visible.filter(i=>items[i]!=='divider').length<7?32:0);
  if(width>=32)assert.ok(used<=width+.5);
 }
 assert.deepEqual(fitToolbar(items,widths,350,32,items.length,order),items.map((_,index)=>index));
});

test('menu separator normalization handles noncontiguous removals and empty groups',()=>{
 const visible=new Set(fitToolbar(items,widths,180,32,items.length,order));
 const hidden=toolbarIndices(items,index=>!visible.has(index));assert.deepEqual(titles(hidden),['bold','italic','drawing']);
 assert.deepEqual(toolbarIndices(items,()=>false),[]);
});
