const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor,Transforms}=require('slate');
const loaded=new Module('toolbar-layout.cjs');
loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en',Platform:{isMacOS:false}}:require(id);
loaded._compile(buildSync({entryPoints:['src/wysimark/toolbar-plugin/items/index.tsx'],bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history','slate-react','react','react-dom'],write:false}).outputFiles[0].text,'toolbar-layout.cjs');
const {toolbarItemLayout,visibleToolbarItems,toolbarGroups}=loaded.exports;
const buttons=items=>items.filter(item=>item!=='divider');

for(const id of ['text-color','highlight'])test(`${id} toggles its preview color on click and retains its palette`,()=>{
 const item=toolbarGroups.flat().find(entry=>entry.id===id).item,e=createEditor();
 e.wysimark={readOnly:false,getTextColor:()=> '#1677FF',getHighlightColor:()=> '#7C3AED'};
 e.children=[{type:'paragraph',children:[{text:'Selected'}]}];Transforms.select(e,Editor.range(e,[0]));
 item.action(e);assert(e.children[0].children[0].inlineStyle);
 if(id==='highlight')assert.equal(e.children[0].children[0].highlight,true);
 item.action(e);assert.equal(e.children[0].children[0].inlineStyle,undefined);assert.equal(e.children[0].children[0].highlight,undefined);
 assert(item.Component);assert.equal(item.focusEditor,false);
});

test('highlight sits between text color and bold and reuses the highlight command',()=>{
 const entries=toolbarGroups.flat(),index=entries.findIndex(entry=>entry.id==='highlight'),item=entries[index].item;
 assert.equal(entries[index-1].id,'text-color');assert.equal(entries[index+1].id,'bold');
 assert.equal(item.hotkey,'mod+alt+h');assert.equal(item.Component.name,'HighlightColorMenu');
 assert.equal(typeof item.active,'function');
 assert(buttons(visibleToolbarItems(()=>true,true)).includes(item),'highlight is a primary memo tool');
 assert.equal(item.show({wysimark:{disableHighlight:true}}),false);
});

test('color tools follow caret formatting independently of the preferred palette color',()=>{
 const entries=toolbarGroups.flat(),color=entries.find(entry=>entry.id==='text-color').item,highlight=entries.find(entry=>entry.id==='highlight').item;
 const e=createEditor();e.wysimark={getTextColor:()=> '#1677FF',getHighlightColor:()=> '#FFD000'};
 e.children=[{type:'paragraph',children:[{text:'plain'},{text:'color',inlineStyle:'color:#DF2A3F'},{text:'background',inlineStyle:'background-color:rgba(22,119,255,0.14)'},{text:'highlight',highlight:true}]}];
 for(const [index,expectedColor,expectedHighlight]of [[0,false,false],[1,true,false],[2,false,true],[3,false,true]]){
  Transforms.select(e,{path:[0,index],offset:1});assert.equal(color.active(e),expectedColor);assert.equal(highlight.active(e),expectedHighlight);
 }
});

test('regular toolbars retain the complete ordered tool set',()=>{
 const layout=toolbarItemLayout(()=>true);assert.deepEqual(layout.items,visibleToolbarItems());assert.equal(layout.primaryCount,layout.items.length);
});

test('memo toolbars preserve primary tools and put every other tool in More exactly once',()=>{
 const {items,primaryCount}=toolbarItemLayout(()=>true,true),primary=visibleToolbarItems(()=>true,true);
 assert.deepEqual(items.slice(0,primaryCount),primary);assert.ok(items.length>primaryCount);
 const actual=buttons(items),expected=buttons(visibleToolbarItems());assert.equal(actual.length,expected.length);
 for(const id of ['outdent','indent'])assert.ok(primary.includes(toolbarGroups.flat().find(entry=>entry.id===id).item));
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
 assert.deepEqual(collapseOrder.slice(0,5).map(index=>idFor(items[index])),['drawing','horizontal-rule','inline-math','code-block','quote']);
});
