const {test}=require('node:test'),assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module');
const {createEditor,Transforms}=require('slate'),{withHistory}=require('slate-history');
const m=new Module('task-completion.cjs');m.require=id=>id==='obsidian'?{getLanguage:()=> 'en'}:require(id);
m._compile(buildSync({entryPoints:['src/blocks/model.ts'],bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history'],write:false}).outputFiles[0].text,'task-completion.cjs');
const {rootCache}=m.exports;
const task=(depth,checked=false)=>({type:'task-list-item',depth,checked,children:[{text:'Task'}]});
const body=(type,depth)=>({type,__blockDepth:depth,children:[{text:'Body'}]});
const completed=e=>e.children.map(n=>rootCache(e).completedTasks.has(n));

test('completed tasks style all descendant blocks and stop before siblings',()=>{
 const e=createEditor();e.children=[task(0,true),task(1),body('paragraph',2),body('unordered-list-item',1),body('block-quote',2),task(0),task(1)];
 assert.deepEqual(completed(e),[true,true,true,true,true,false,false]);
 assert.equal(e.children[1].checked,false);
});

test('toggling and undoing a parent updates inherited presentation without changing child checkboxes',()=>{
 const e=withHistory(createEditor());e.children=[task(0),task(1),task(1,true),task(2),task(0)];
 const children=e.children.slice(1);
 assert.deepEqual(completed(e),[false,false,true,true,false]);
 Transforms.setNodes(e,{checked:true},{at:[0]});assert.deepEqual(completed(e),[true,true,true,true,false]);
 assert(children.every((child,i)=>e.children[i+1]===child));
 e.undo();assert.deepEqual(completed(e),[false,false,true,true,false]);
});

test('spacers and folding preserve completion scope while outdenting ends it',()=>{
 const e=createEditor();e.children=[{...task(0,true),__collapsed:true},{...body('paragraph',0),__collapsible:true,children:[{text:''}]},task(1),task(2,true),task(3),body('paragraph',0)];
 assert.deepEqual(completed(e),[true,false,true,true,true,false]);
 Transforms.setNodes(e,{depth:0},{at:[2]});assert.deepEqual(completed(e),[true,false,false,true,true,false]);
});
