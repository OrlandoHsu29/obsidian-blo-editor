const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Node,Transforms}=require('slate');
const {withHistory}=require('slate-history');
const loaded=new Module('drag-drop.cjs');
loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en'}:require(id);
loaded._compile(buildSync({entryPoints:['src/blocks/model.ts'],bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history'],write:false}).outputFiles[0].text,'drag-drop.cjs');
const {blockDragGroup,blockDropTarget,moveBlockGroup,rootCache}=loaded.exports;
const item=(text,depth=0,extra={})=>({type:'unordered-list-item',depth,__blockDepth:depth,children:[{text}],...extra});
const fixture=nodes=>{const e=withHistory(createEditor());e.wysimark={readOnly:false};e.children=nodes;return e};

for(const target of [1,2,3])for(const position of ['before','after'])test(`hovering source subtree row ${target} ${position} keeps its boundary above the source`,()=>{
 const nodes=[item('previous'),item('source'),item('child',1),item('grandchild',2),item('next')],group=blockDragGroup(nodes,1);
 const drop=blockDropTarget(group,target,position,1);
 assert.equal(drop.destination,1);assert.equal(drop.previous,0);assert.equal(drop.depth,1);
 const e=fixture(nodes),before=structuredClone(nodes);Transforms.select(e,{path:[1,0],offset:0});
 assert.equal(moveBlockGroup(e,1,target,position,drop.depth),true);
 assert.deepEqual(e.children.map(Node.string),nodes.map(Node.string));assert.deepEqual(e.children.map(n=>n.depth),[0,1,2,3,0]);
 e.undo();assert.deepEqual(e.children,before);
});

test('self drop excludes spacers and the dragged subtree from its preceding anchor',()=>{
 const spacer={type:'paragraph',__collapsible:true,children:[{text:''}]};
 const nodes=[item('previous'),spacer,item('source'),spacer,item('child',1),item('next')],group=blockDragGroup(nodes,2);
 assert.equal(blockDropTarget(group,4,'after',1).previous,0);
});

test('top-of-document self drop stays at depth zero on both halves',()=>{
 const nodes=[item('source'),item('child',1),item('next')],group=blockDragGroup(nodes,0);
 for(const target of [0,1])for(const position of ['before','after']){
  const drop=blockDropTarget(group,target,position,8);assert.equal(drop.destination,0);assert.equal(drop.previous,-1);assert.equal(drop.depth,0);
 }
});

test('multi-block selection retains every selected subtree while reindenting in place',()=>{
 const nodes=[item('previous'),item('first'),item('child',1),item('second'),item('second child',1),item('next')],group=blockDragGroup(nodes,1,4),e=fixture(nodes);
 const drop=blockDropTarget(group,4,'after',1);assert.equal(drop.destination,1);assert.equal(drop.previous,0);
 assert.equal(moveBlockGroup(e,1,4,'after',drop.depth,group.end),true);assert.deepEqual(e.children.map(n=>n.depth),[0,1,2,1,2,0]);
});

test('moving below a different subtree anchors below its last retained child',()=>{
 const nodes=[item('source'),item('parent'),item('child',1),item('next')],group=blockDragGroup(nodes,0),e=fixture(nodes);
 const drop=blockDropTarget(group,1,'after',0);assert.equal(drop.previous,2);assert.equal(drop.destination,3);
 moveBlockGroup(e,0,1,'after',0);assert.deepEqual(e.children.map(Node.string),['parent','child','source','next']);
});

test('folded target descendants map to their visible parent for the preview',()=>{
 const nodes=[item('source'),item('parent',0,{__collapsed:true}),item('child',1),item('next')],group=blockDragGroup(nodes,0),e=fixture(nodes);
 const drop=blockDropTarget(group,1,'after',0),cache=rootCache(e);assert.equal(cache.foldedBy.get(nodes[drop.previous]),nodes[1]);
});

test('deepest descendant limits indentation without rejecting the drop',()=>{
 const nodes=[item('previous',30),item('source'),item('child',31)],group=blockDragGroup(nodes,1);
 const drop=blockDropTarget(group,2,'after',32);assert.equal(drop.depth,1);assert.equal(drop.previous,0);
});
