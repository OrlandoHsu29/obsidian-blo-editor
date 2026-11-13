const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const loaded=new Module('toolbar-layout.cjs');
loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en',Platform:{isMacOS:false}}:require(id);
loaded._compile(buildSync({entryPoints:['src/wysimark/toolbar-plugin/items/index.tsx'],bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history','slate-react','react','react-dom'],write:false}).outputFiles[0].text,'toolbar-layout.cjs');
const {toolbarItemLayout,visibleToolbarItems,toolbarGroups}=loaded.exports;
const buttons=items=>items.filter(item=>item!=='divider');

test('regular toolbars retain the complete ordered tool set',()=>{
 const layout=toolbarItemLayout(()=>true);assert.deepEqual(layout.items,visibleToolbarItems());assert.equal(layout.primaryCount,layout.items.length);
});

test('memo toolbars preserve primary tools and put every other tool in More exactly once',()=>{
 const {items,primaryCount}=toolbarItemLayout(()=>true,true),primary=visibleToolbarItems(()=>true,true);
 assert.deepEqual(items.slice(0,primaryCount),primary);assert.ok(items.length>primaryCount);
 const actual=buttons(items),expected=buttons(visibleToolbarItems());assert.equal(actual.length,expected.length);
 assert.equal(new Set(actual).size,expected.length);for(const item of expected)assert.ok(actual.includes(item));
 assert.notEqual(items[0],'divider');assert.notEqual(items.at(-1),'divider');
 for(let i=1;i<items.length;i++)assert.ok(items[i]!=='divider'||items[i-1]!=='divider');
});

test('unavailable integrations stay excluded from both memo layers',()=>{
 const drawing=toolbarGroups.flat().find(entry=>entry.id==='drawing').item;
 const {items}=toolbarItemLayout(item=>item!==drawing,true);assert.ok(!items.includes(drawing));
 const formula=toolbarGroups.flat().find(entry=>entry.id==='inline-math').item;
 assert.ok(items.includes(formula));
});

test('collapse order hides optional tools right-to-left before any memo primary tool',()=>{
 const {items,collapseOrder}=toolbarItemLayout(()=>true),primary=new Set(buttons(visibleToolbarItems(()=>true,true)));
 const optionalIndices=items.flatMap((item,index)=>item!=='divider'&&!primary.has(item)?[index]:[]).reverse();
 const primaryIndices=items.flatMap((item,index)=>item!=='divider'&&primary.has(item)?[index]:[]).reverse();
 assert.deepEqual(collapseOrder,[...optionalIndices,...primaryIndices]);
 const idFor=item=>toolbarGroups.flat().find(entry=>entry.item===item)?.id;
 assert.deepEqual(collapseOrder.slice(0,5).map(index=>idFor(items[index])),['drawing','indent','outdent','horizontal-rule','inline-math']);
});
