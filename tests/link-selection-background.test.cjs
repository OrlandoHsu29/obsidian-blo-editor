const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor}=require('slate');
const loaded=new Module('link-selection-background.cjs');
let calls=[];
loaded.require=id=>id==='slate-react'?{ReactEditor:{toDOMRange(_editor,range){
 calls.push(range);assert.deepEqual(range.anchor.path,range.focus.path,'measure actual leaves, not nested wrapper rectangles');
 const width=(range.focus.offset-range.anchor.offset)*(range.anchor.path.at(-1)===0?8:10);
 return {getClientRects:()=>[{width:width/2},{width:width/2}]};
}}}:require(id);
loaded._compile(buildSync({entryPoints:['src/wysimark/anchor-plugin/render-element/use-selection-background.ts'],bundle:true,platform:'node',format:'cjs',external:['react','slate','slate-react'],write:false}).outputFiles[0].text,'link-selection-background.cjs');
const {textRangeWidth}=loaded.exports;
function fixture(){const e=createEditor();e.isInline=n=>n.type==='anchor';e.children=[{type:'paragraph',children:[{text:'before'},{type:'anchor',href:'https://example.test',children:[{text:'AB',bold:true},{text:'CDE',italic:true}]},{text:'after'}]}];return e}
test('partial selected text measures each styled leaf once, including wrapped fragments',()=>{
 const e=fixture(),before=structuredClone(e.children);calls=[];
 assert.equal(textRangeWidth(e,{anchor:{path:[0,1,0],offset:1},focus:{path:[0,1,1],offset:2}}),28);
 assert.equal(calls.length,2);assert.deepEqual(e.children,before);assert.deepEqual(e.operations,[]);
});
test('prefix measurement and backward selection share the same text geometry',()=>{
 const e=fixture(),range={anchor:Editor.start(e,[0,1]),focus:{path:[0,1,1],offset:1}};calls=[];
 assert.equal(textRangeWidth(e,range),26);
 assert.equal(textRangeWidth(e,{anchor:range.focus,focus:range.anchor}),26);
});
test('collapsed ranges and a selection ending at the next leaf start do not paint empty text',()=>{
 const e=fixture(),point={path:[0,1,1],offset:0};calls=[];
 assert.equal(textRangeWidth(e,{anchor:point,focus:point}),0);assert.equal(calls.length,0);
 assert.equal(textRangeWidth(e,{anchor:Editor.start(e,[0,1]),focus:point}),16);assert.equal(calls.length,1);
});
