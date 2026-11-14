const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor,Node,Transforms}=require('slate');
const {withHistory}=require('slate-history');
const loaded=new Module('inline-code-toggle.cjs');
loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en',Platform:{isMacOS:false}}:require(id);
loaded._compile(buildSync({stdin:{contents:`import {createWithSink} from './src/wysimark/sink/editor';import {InlineCodePlugin} from './src/wysimark/inline-code-plugin';export const withCode=createWithSink([InlineCodePlugin.fn]);export {parse,serialize} from './src/wysimark/convert';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history','slate-react','react','react-dom'],write:false}).outputFiles[0].text,'inline-code-toggle.cjs');
const text=value=>({text:value}),code=(value='USB')=>({type:'inline-code',children:[{text:value,bold:true}]}),p=children=>({type:'paragraph',children});
function fixture(nodes=[p([text('before '),code(),text(' after')])]){const e=loaded.exports.withCode(withHistory(createEditor()),{});e.wysimark={};e.children=nodes;Editor.normalize(e,{force:true});e.history.undos=[];return e}
const codes=e=>[...Editor.nodes(e,{at:[],match:n=>n.type==='inline-code'})].map(([n])=>n);
const reopen=e=>fixture(loaded.exports.parse(loaded.exports.serialize(e.children)));
for(const boundary of ['inside','left outside','right outside','both outside'])for(const backward of [false,true])test(`toggle off ${boundary}, ${backward?'backward':'forward'} selection: no empty code and one undo`,()=>{
 const e=fixture(),anchor=boundary==='left outside'||boundary==='both outside'?{path:[0,0],offset:7}:{path:[0,1,0],offset:0},focus=boundary==='right outside'||boundary==='both outside'?{path:[0,2],offset:0}:{path:[0,1,0],offset:3};
 Transforms.select(e,backward?{anchor:focus,focus:anchor}:{anchor,focus});const before=structuredClone(e.children),selection=structuredClone(e.selection);
 e.inlineCode.toggleInlineCode();assert.equal(codes(e).length,0);assert.equal(Node.string(e),'before USB after');assert.ok([...Node.texts(e)].some(([n])=>n.text==='USB'&&n.bold));assert.equal(e.history.undos.length,1);
 e.undo();assert.deepEqual(e.children,before);assert.deepEqual(e.selection,selection);e.redo();assert.equal(codes(e).length,0);
});
test('partial code text retains the existing whole-code toggle behavior',()=>{
 const e=fixture();Transforms.select(e,{anchor:{path:[0,1,0],offset:1},focus:{path:[0,1,0],offset:2}});e.inlineCode.toggleInlineCode();assert.equal(codes(e).length,0);assert.equal(Node.string(e),'before USB after');
});
test('mixed code and text applies code without styling a zero-length endpoint',()=>{
 const e=fixture([p([text(''),code('USB'),text(' body gap '),code('Keep'),text('')])]);
 Transforms.select(e,{anchor:{path:[0,0],offset:0},focus:{path:[0,2],offset:5}});e.inlineCode.toggleInlineCode();assert.ok(codes(e).every(n=>Node.string(n).length>0));assert.equal(Node.string(e),'USB body gap Keep');e.inlineCode.toggleInlineCode();assert.deepEqual(codes(e).map(Node.string),['Keep']);
});
test('a collapsed caret still creates the intentional empty code input',()=>{
 const e=fixture([p([text('body')])]);Transforms.select(e,{path:[0,0],offset:4});e.inlineCode.toggleInlineCode();assert.equal(codes(e).length,1);assert.equal(Node.string(codes(e)[0]),'');e.inlineCode.toggleInlineCode();assert.equal(codes(e).length,0);
});
for(const side of ['left','right','both'])for(const backward of [false,true])test(`adding code to ${side} neighboring text merges frames, ${backward?'backward':'forward'}`,()=>{
 const e=fixture([p([text('left '),code('USB'),{text:' right',italic:true}])]);
 const anchor=side==='right'?{path:[0,1,0],offset:0}:{path:[0,0],offset:0},focus=side==='left'?{path:[0,1,0],offset:3}:{path:[0,2],offset:6};
 Transforms.select(e,backward?{anchor:focus,focus:anchor}:{anchor,focus});const before=structuredClone(e.children),selection=structuredClone(e.selection);
 e.inlineCode.toggleInlineCode();assert.equal(codes(e).length,1);assert.equal(Node.string(codes(e)[0]),side==='left'?'left USB':side==='right'?'USB right':'left USB right');assert.equal(Node.string(e),'left USB right');
 assert.ok(codes(e)[0].children.some(n=>n.text==='USB'&&n.bold));if(side!=='left')assert.ok(codes(e)[0].children.some(n=>n.text===' right'&&n.italic));
 assert.equal(e.history.undos.length,1);const after=structuredClone(e.children);e.undo();assert.deepEqual(e.children,before);assert.deepEqual(e.selection,selection);e.redo();assert.deepEqual(e.children,after);
 const reopened=reopen(e);assert.equal(codes(reopened).length,1);assert.equal(Node.string(codes(reopened)[0]),Node.string(codes(e)[0]));assert.ok(codes(reopened)[0].children.some(n=>n.bold));
 e.inlineCode.toggleInlineCode();assert.equal(codes(e).length,0);
});
test('plain text and paragraph boundaries keep separate code frames',()=>{
 const e=fixture([p([text(''),code('one'),text(' gap '),code('two'),text('')]),p([text(''),code('three'),text('')])]);assert.deepEqual(codes(e).map(Node.string),['one','two','three']);
});
for(const space of [' ','   ','\u00a0'])for(const backward of [false,true])test(`outside whitespace ${JSON.stringify(space)} does not invert removing code, ${backward?'backward':'forward'}`,()=>{
 const e=fixture([p([text('prefix'+space),{type:'inline-code',children:[{text:'1 µF',bold:true},{text:' 电容',italic:true}]},text(space+'suffix')])]);
 const anchor={path:[0,0],offset:6},focus={path:[0,2],offset:space.length};Transforms.select(e,backward?{anchor:focus,focus:anchor}:{anchor,focus});const before=structuredClone(e.children),selection=structuredClone(e.selection);
 e.inlineCode.toggleInlineCode();assert.equal(codes(e).length,0);assert.equal(Node.string(e),'prefix'+space+'1 µF 电容'+space+'suffix');assert.ok([...Node.texts(e)].some(([n])=>n.text==='1 µF'&&n.bold));assert.ok([...Node.texts(e)].some(([n])=>n.text===' 电容'&&n.italic));
 assert.equal(e.history.undos.length,1);e.undo();assert.deepEqual(e.children,before);assert.deepEqual(e.selection,selection);e.redo();assert.equal(codes(e).length,0);
});
test('formatting multiple marked leaves and paragraphs yields one frame per paragraph',()=>{
 const e=fixture([p([text('before '),{text:'1 µF',bold:true},{text:' capacitor',inlineStyle:'color:#ff0000'},text(' after')]),p([text('second '),{text:'row',italic:true}])]);
 Transforms.select(e,{anchor:{path:[0,1],offset:0},focus:{path:[1,1],offset:3}});const before=structuredClone(e.children);e.inlineCode.toggleInlineCode();assert.deepEqual(codes(e).map(Node.string),['1 µF capacitor after','second row']);assert.ok(codes(e)[0].children.some(n=>n.inlineStyle==='color:#ff0000'));assert.equal(e.history.undos.length,1);
 e.undo();assert.deepEqual(e.children,before);e.redo();e.inlineCode.toggleInlineCode();assert.equal(codes(e).length,0);
});
for(const side of ['left','right'])for(const outside of [false,true])for(const backward of [false,true])test(`new code ${side} of unselected existing code stays independent (${outside?'touching code boundary':'text only'}, ${backward?'backward':'forward'})`,()=>{
 const e=fixture([p([text('left'),code('USB'),text('right')])]);
 const anchor=side==='left'?{path:[0,0],offset:0}:outside?{path:[0,1,0],offset:3}:{path:[0,2],offset:0};
 const focus=side==='right'?{path:[0,2],offset:5}:outside?{path:[0,1,0],offset:0}:{path:[0,0],offset:4};
 Transforms.select(e,backward?{anchor:focus,focus:anchor}:{anchor,focus});const before=structuredClone(e.children),selection=structuredClone(e.selection);
 e.inlineCode.toggleInlineCode();assert.deepEqual(codes(e).map(Node.string),side==='left'?['left','USB']:['USB','right']);assert.equal(Node.string(e),'leftUSBright');assert.equal(e.history.undos.length,1);const after=structuredClone(e.children);
 e.undo();assert.deepEqual(e.children,before);assert.deepEqual(e.selection,selection);e.redo();assert.deepEqual(e.children,after);assert.deepEqual(codes(reopen(e)).map(Node.string),codes(e).map(Node.string));
});
test('a formatted code frame preserves literal Markdown and HTML symbols after saving',()=>{
 const e=fixture([p([text('before '),{type:'inline-code',children:[{text:'`**<&|',bold:true},{text:' >_*[]',italic:true}]},text(' after')])]);
 const reopened=reopen(e);assert.equal(codes(reopened).length,1);assert.equal(Node.string(reopened),Node.string(e));assert.deepEqual(codes(reopened)[0].children,codes(e)[0].children);
});
test('a code frame preserves color, emphasis and decorations when reopened',()=>{
 const e=fixture([p([text(''),{type:'inline-code',children:[{text:'1 µF',bold:true,inlineStyle:'color:#DF2A3F'},{text:' value',italic:true,underline:true,strike:true,highlight:true}]},text('')])]);
 assert.deepEqual(codes(reopen(e))[0].children,codes(e)[0].children);
});
test('table code frames preserve literal pipes and separate adjacent frames',()=>{
 const nodes=[{type:'table',columns:[{align:'left'},{align:'left'}],headerRow:false,children:[{type:'table-row',children:[{type:'table-cell',children:[p([text(''),{type:'inline-code',children:[{text:'a|b',bold:true},{text:' & <c>',italic:true}]},text('')])]},{type:'table-cell',children:[p([text(''),code('one'),text(''),code('two'),text('')])]}]}]}];
 for(const cell of nodes[0].children[0].children)cell.children[0].type='table-content';
 const before=fixture(nodes),after=reopen(before);assert.deepEqual(codes(after).map(Node.string),['a|b & <c>','one','two']);assert.equal(after.children.find(n=>n.type==='table').children[0].children.length,2);
});
