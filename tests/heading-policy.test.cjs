const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor,Transforms}=require('slate');
const loaded=new Module('heading-policy.cjs');
loaded.require=id=>require(id);
loaded._compile(buildSync({entryPoints:['src/blocks/heading-policy.ts'],bundle:true,platform:'node',format:'cjs',external:['slate'],write:false}).outputFiles[0].text,'heading-policy.cjs');
const {selectionHasHeading}=loaded.exports;
test('heading existence stops at the first match in a large selection',()=>{
 const e=createEditor();e.children=Array.from({length:10000},(_,i)=>({type:'heading',level:2,children:[{text:String(i)}]}));Transforms.select(e,Editor.range(e,[]));
 const nodes=Editor.nodes;let matches=0;
 Editor.nodes=(editor,options)=>nodes(editor,{...options,match:(...args)=>{matches++;return options.match(...args)}});
 try{assert.equal(selectionHasHeading(e),true);assert(matches<10,`visited ${matches} nodes despite the first heading matching`)}finally{Editor.nodes=nodes}
});
test('body and missing selections still report no heading',()=>{
 const e=createEditor();e.children=[{type:'paragraph',children:[{text:'body'}]}];assert.equal(selectionHasHeading(e),false);Transforms.select(e,Editor.range(e,[]));assert.equal(selectionHasHeading(e),false);
});
