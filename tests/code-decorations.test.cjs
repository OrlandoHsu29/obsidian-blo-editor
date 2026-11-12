const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor,Node}=require('slate');
const loaded=new Module('code-decorations.cjs');
loaded._compile(buildSync({entryPoints:['src/wysimark/code-block-plugin/decorate.tsx'],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text,'code-decorations.cjs');
const {decorate}=loaded.exports;
const line=(...children)=>({type:'code-block-line',children:children.map(text=>typeof text==='string'?{text}:text)});
test('multiline tokens retain valid endpoints across empty lines and marked leaves',()=>{
 const editor=createEditor(),node={type:'code-block',language:'javascript',children:[line('/* 😀 first'),line(''),line({text:'last',bold:true},' */'),line('const value = 42;')]};
 editor.children=[node];const ranges=decorate([node,[0]]);
 const comment=ranges.find(r=>r.prismToken==='comment');assert.equal(Editor.string(editor,comment),'/* 😀 firstlast */');
 assert.deepEqual(comment.anchor,{path:[0,0,0],offset:0});assert.deepEqual(comment.focus,{path:[0,2,1],offset:3});
 assert(ranges.some(r=>r.prismToken==='number'&&Editor.string(editor,r)==='42'));
 for(const range of ranges)for(const point of [range.anchor,range.focus])assert(point.offset<=Node.get(editor,point.path).text.length);
});
test('cached highlighting follows a moved block without retokenizing its text',()=>{
 const node={type:'code-block',language:'javascript',children:[line('const value = 42;')]},first=decorate([node,[0]]),again=decorate([node,[0]]),moved=decorate([node,[5]]);
 assert.strictEqual(first,again);assert.deepEqual(moved,first.map(r=>({...r,anchor:{...r.anchor,path:[5,...r.anchor.path.slice(1)]},focus:{...r.focus,path:[5,...r.focus.path.slice(1)]}})));
});
test('long blocks locate tokens on their final line correctly',()=>{
 const count=2000,node={type:'code-block',language:'javascript',children:Array.from({length:count},(_,i)=>line(`const item${i} = ${i};`))},ranges=decorate([node,[3]]);
 const last=ranges.find(r=>r.prismToken==='number'&&r.anchor.path[1]===count-1);assert(last);assert.equal(last.focus.offset-last.anchor.offset,4);
});
