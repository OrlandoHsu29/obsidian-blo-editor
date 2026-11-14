const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor,Node,Range,Transforms}=require('slate');
const {withHistory}=require('slate-history');
const loaded=new Module('link-cut.cjs');loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en',Platform:{isMacOS:false}}:require(id);
loaded._compile(buildSync({stdin:{contents:`import {createWithSink} from './src/wysimark/sink/editor';import {AnchorPlugin} from './src/wysimark/anchor-plugin';import {TablePlugin} from './src/wysimark/table-plugin';export const withLinks=createWithSink([AnchorPlugin.fn,TablePlugin.fn]);export * from './src/wysimark/anchor-plugin/link-keyboard';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history','slate-react','react','react-dom'],write:false}).outputFiles[0].text,'link-cut.cjs');
const {withLinks,selectLink,isLinkFullySelected,isLinkIconSelected}=loaded.exports;
const pointerLoaded=new Module('link-pointer.cjs');pointerLoaded.require=loaded.require;
pointerLoaded._compile(buildSync({entryPoints:['src/wysimark/anchor-plugin/pointer-selection.ts'],bundle:true,platform:'node',format:'cjs',external:['slate','slate-react'],write:false}).outputFiles[0].text,'link-pointer.cjs');
const {linkIconSelectionRange}=pointerLoaded.exports;
const link=(text='Title',href='https://example.test')=>({type:'anchor',href,title:'Keep title',children:[{text,bold:true}]});
const paragraph=children=>({type:'paragraph',children});
const entries=editor=>[...Editor.nodes(editor,{at:[],match:n=>n.type==='anchor'})];
function fixture(children){const editor=withLinks(withHistory(createEditor()),{});editor.wysimark={readOnly:false};editor.children=children;Editor.normalize(editor,{force:true});editor.history.undos=[];return editor}

for(const backward of [false,true])for(const offset of [0,1,3,5])test(`icon selection includes partial label ${offset}, ${backward?'backward':'forward'}`,()=>{
 const editor=fixture([paragraph([{text:'before '},link(),{text:' after'}])]);
 const anchor=Editor.end(editor,[0,0]),focus={path:[0,1,0],offset};
 Transforms.select(editor,backward?{anchor:focus,focus:anchor}:{anchor,focus});
 assert.equal(isLinkIconSelected(editor,[0,1]),true);
 assert.equal(isLinkFullySelected(editor,[0,1]),offset===5);
});
test('label-only and preceding text selections do not include the icon',()=>{
 const editor=fixture([paragraph([{text:'before '},link(),{text:' after'}])]);
 for(const range of [Editor.range(editor,[0,1]),Editor.range(editor,[0,0]),{anchor:Editor.start(editor,[0,1]),focus:{path:[0,1,0],offset:1}}]){
  Transforms.select(editor,range);assert.equal(isLinkIconSelected(editor,[0,1]),false);
 }
});

for(const mode of ['icon','forward drag including icon','backward drag including icon'])test(`cut from ${mode} removes the complete link, preserving clipboard metadata and undo`,()=>{
 const editor=fixture([paragraph([{text:'before '},link(),{text:' after'}])]);
 if(mode==='icon')selectLink(editor,[0,1]);else{
  const anchor={path:[0,0],offset:7},focus={path:[0,1,0],offset:5};Transforms.select(editor,mode==='forward drag including icon'?{anchor,focus}:{anchor:focus,focus:anchor});
 }
 assert.equal(isLinkFullySelected(editor,[0,1]),true);
 const before=structuredClone(editor.children),fragment=editor.getFragment();
 assert.ok([...Node.elements({children:fragment})].some(([n])=>n.type==='anchor'&&n.href==='https://example.test'));
 editor.deleteFragment();assert.equal(entries(editor).length,0);assert.equal(Node.string(editor),'before  after');assert.equal(editor.children[0].type,'paragraph');
 assert.equal(editor.history.undos.length,1);editor.undo();assert.deepEqual(editor.children,before);editor.redo();assert.equal(entries(editor).length,0);
});

for(const backward of [false,true])test(`replacing the entire text label ${backward?'backward':'forward'} preserves the link target and excludes its icon`,()=>{
 const editor=fixture([paragraph([{text:'before '},link(),{text:' after'}])]);
 const anchor={path:[0,1,0],offset:0},focus={path:[0,1,0],offset:5};Transforms.select(editor,backward?{anchor:focus,focus:anchor}:{anchor,focus});
 assert.equal(isLinkFullySelected(editor,[0,1]),false);editor.deleteFragment();editor.insertText('Changed');
 assert.equal(entries(editor).length,1);assert.equal(entries(editor)[0][0].href,'https://example.test');assert.equal(Node.string(entries(editor)[0][0]),'Changed');assert.equal(Node.string(editor),'before Changed after');
});

test('partial text cuts keep the remaining link text and target',()=>{
 const editor=fixture([paragraph([{text:'before'},link(),{text:'after'}])]);
 Transforms.select(editor,{anchor:{path:[0,1,0],offset:0},focus:{path:[0,1,0],offset:2}});assert.equal(isLinkFullySelected(editor,[0,1]),false);
 editor.deleteFragment();assert.equal(entries(editor).length,1);assert.equal(Node.string(entries(editor)[0][0]),'tle');assert.equal(entries(editor)[0][0].href,'https://example.test');
});

test('cutting body text through multiple complete links leaves no empty anchor shell',()=>{
 const editor=fixture([paragraph([{text:'before '},link('first'),{text:' middle '},link('last'),{text:' after'}])]);
 Transforms.select(editor,{anchor:{path:[0,0],offset:3},focus:{path:[0,3,0],offset:4}});editor.deleteFragment();
 assert.equal(entries(editor).length,0);assert.equal(Node.string(editor),'bef after');
});

for(const text of ['',' '])test(`cutting adjacent icon-only links (${JSON.stringify(text)}) removes one node per cut`,()=>{
 const editor=fixture([paragraph([{text:'body'},link(text,'https://one.test'),{text:''},link(text,'https://two.test'),{text:''}])]);
 for(const remaining of [1,0]){const [,path]=entries(editor).at(-1);selectLink(editor,path);assert.equal(Range.isExpanded(editor.selection),true);editor.deleteFragment();assert.equal(entries(editor).length,remaining);assert.ok(Node.string(editor).startsWith('body'))}
 assert.equal(Node.string(editor),'body');
});

test('cutting a complete link inside a table keeps its cell, row and neighboring content',()=>{
 const cell=children=>({type:'table-cell',children:[{type:'table-content',children}]});
 const table={type:'table',columns:[{align:'left'},{align:'left'}],children:[{type:'table-row',children:[cell([{text:'before'},link(),{text:'after'}]),cell([{text:'neighbor'}])]}]};
 const editor=fixture([table]);const [,path]=entries(editor)[0];selectLink(editor,path);editor.deleteFragment();
 assert.equal(entries(editor).length,0);assert.equal(editor.children[0].type,'table');assert.equal(editor.children[0].children[0].children.length,2);assert.equal(Node.string(editor),'beforeafterneighbor');
});

test('dragging backward across the icon ends exactly after preceding body text',()=>{
 const editor=fixture([paragraph([{text:'before'},link(),{text:'after'}])]);
 const range=linkIconSelectionRange(editor,[0,1],Editor.end(editor,[0,1]));
 assert.deepEqual(range.focus,{path:[0,0],offset:6});Transforms.select(editor,range);assert.equal(isLinkFullySelected(editor,[0,1]),true);
 editor.deleteFragment();assert.equal(Node.string(editor),'beforeafter');assert.equal(entries(editor).length,0);
});
test('dragging forward onto the icon includes its boundary without selecting the first label character',()=>{
 const editor=fixture([paragraph([{text:'before'},link(),{text:'after'}])]);
 const anchor={path:[0,0],offset:6},range=linkIconSelectionRange(editor,[0,1],anchor);
 assert.deepEqual(range,{anchor,focus:{path:[0,1,0],offset:0}});assert.equal(Editor.string(editor,range),'');
});
test('dragging from the first label character onto the icon never consumes preceding body text',()=>{
 const editor=fixture([paragraph([{text:'before'},link(),{text:'after'}])]);
 const range=linkIconSelectionRange(editor,[0,1],Editor.start(editor,[0,1]));
 assert.deepEqual(range.focus,{path:[0,0],offset:6});assert.equal(Editor.string(editor,range),'');
});
test('a standalone link uses the empty leading text boundary without requiring another character',()=>{
 const editor=fixture([paragraph([{text:''},link(),{text:''}])]);
 const range=linkIconSelectionRange(editor,[0,1],Editor.end(editor,[0,1]));assert.deepEqual(range.focus,{path:[0,0],offset:0});
 Transforms.select(editor,range);assert.equal(isLinkFullySelected(editor,[0,1]),true);editor.deleteFragment();assert.equal(entries(editor).length,0);assert.equal(editor.children[0].type,'paragraph');
});
