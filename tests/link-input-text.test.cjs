const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {createEditor}=require('slate');
let editor,path;
const loaded=new Module('link-input-text.cjs');
loaded.require=id=>id==='slate-react'?{useSlateStatic:()=>editor,ReactEditor:{findPath:()=>path}}:require(id);
loaded._compile(buildSync({entryPoints:['src/wysimark/anchor-plugin/render-element/link-input-text.tsx'],bundle:true,platform:'node',format:'cjs',external:['react','slate','slate-react'],write:false}).outputFiles[0].text,'link-input-text.cjs');
for(const scenario of ['after link','empty after link','ordinary text','inside link'])test(`the DOM-only caret marker is scoped to ${scenario}`,()=>{
 editor=createEditor();const link={type:'anchor',href:'https://example.test',children:[{text:'label'}]};
 const text={text:scenario==='empty after link'?'':'suffix'};
 editor.children=[{type:'paragraph',children:scenario==='ordinary text'?[{text:'before'},text]:[link,text]}];
 path=scenario==='inside link'?[0,0,0]:[0,1];const leaf=scenario==='inside link'?link.children[0]:text;
 const before=structuredClone(editor.children);
 const html=renderToStaticMarkup(loaded.exports.renderLinkInputText({text:leaf,attributes:{'data-slate-node':'text'},children:React.createElement('span',{'data-slate-leaf':true},React.createElement('span',{'data-slate-string':true},leaf.text))}));
 assert.equal(html.includes('data-slate-zero-width="z"'),scenario==='after link');
 if(scenario==='after link'){assert(html.includes('data-slate-length="0"'));assert.equal((html.match(/suffix/g)||[]).length,1)}
 assert.deepEqual(editor.children,before);assert.equal(JSON.stringify(editor.children).includes('\uFEFF'),false);assert.deepEqual(editor.operations,[]);
});
