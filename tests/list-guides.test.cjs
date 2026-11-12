const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Transforms}=require('slate');
const loaded=new Module('list-guides.cjs');
loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en'}:require(id);
loaded._compile(buildSync({entryPoints:['src/blocks/model.ts'],bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history'],write:false}).outputFiles[0].text,'list-guides.cjs');
const {rootCache}=loaded.exports;
const item=(type,depth)=>({type,depth,children:[{text:'item'}]});
const bullet=depth=>item('unordered-list-item',depth),number=depth=>item('ordered-list-item',depth),task=depth=>item('task-list-item',depth);
const masks=nodes=>{const editor=createEditor();editor.children=nodes;const guides=rootCache(editor).listGuides;return nodes.map(n=>guides.get(n)??0)};

test('ordered and unordered parents keep continuous guide levels when mixed',()=>{
 assert.deepEqual(masks([number(0),bullet(1),number(2),bullet(1),number(0)]),[0,1,3,1,0]);
});
test('task-only hierarchies do not draw guide lines',()=>{
 assert.deepEqual(masks([task(0),task(1),task(2)]),[0,0,0]);
});
test('task parents omit their own guide without breaking non-task ancestors',()=>{
 assert.deepEqual(masks([bullet(0),task(1),bullet(2),number(3)]),[0,1,1,5]);
 assert.deepEqual(masks([task(0),number(1),bullet(2)]),[0,0,2]);
});
test('spacers preserve hierarchy while a new root starts a new guide group',()=>{
 const spacer={type:'paragraph',__collapsible:true,children:[{text:''}]};
 assert.deepEqual(masks([bullet(0),spacer,number(1),task(0),bullet(1)]),[0,0,1,0,0]);
});
test('skipped indentation levels do not invent parent guides',()=>{
 assert.deepEqual(masks([bullet(2),number(3)]),[0,4]);
});
test('changing a parent list type updates descendant guide masks without editing descendants',()=>{
 const editor=createEditor();editor.children=[number(0),bullet(1)];const child=editor.children[1];
 assert.equal(rootCache(editor).listGuides.get(child),1);Transforms.setNodes(editor,{type:'task-list-item'},{at:[0]});
 assert.equal(editor.children[1],child);assert.equal(rootCache(editor).listGuides.get(child),undefined);
});

for(const type of ['ordered-list-item','unordered-list-item'])for(const level of [1,2,3,4,5])test(`${type} H${level} neither draws nor starts a guide`,()=>{
 const heading={type,depth:1,blockChildren:true,children:[{type:'heading',level,children:[{text:'heading'}]}]};
 assert.deepEqual(masks([bullet(0),heading,bullet(2),bullet(3)]),[0,0,1,5]);
 assert.deepEqual(masks([{...heading,depth:0},bullet(1)]),[0,0]);
});

test('legacy subtitles and hash headings do not create guide lines',()=>{
 const subtitle={...number(0),__subtitle:true};
 const heading={type:'heading',level:2,__blockDepth:0,__headingList:{style:'hash',enabled:true},children:[{text:'heading'}]};
 assert.deepEqual(masks([subtitle,bullet(1),heading,bullet(1)]),[0,0,0,0]);
});

for(const type of ['paragraph','block-quote','code-block','table','image-block'])test(`${type} at child depth continues the parent list guide`,()=>{
 const body={type,__blockDepth:1,children:[{text:'body'}]};
 assert.deepEqual(masks([number(0),body,bullet(1),number(0)]),[0,1,1,0]);
});

test('intervening body blocks preserve multiple ancestor guides without starting their own',()=>{
 const body={type:'paragraph',__blockDepth:2,children:[{text:'body'}]};
 assert.deepEqual(masks([number(0),bullet(1),body,number(3)]),[0,1,3,3]);
});

test('unindented prose ends a list guide and task parents still do not start one',()=>{
 const body={type:'paragraph',__blockDepth:0,children:[{text:'body'}]};
 assert.deepEqual(masks([number(0),bullet(1),body,bullet(1)]),[0,1,0,0]);
 assert.deepEqual(masks([task(0),{...body,__blockDepth:1},bullet(1)]),[0,0,0]);
});
