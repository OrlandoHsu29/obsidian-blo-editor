const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor,Transforms}=require('slate');
const {withHistory}=require('slate-history');
const loaded=new Module('markdown-reader.cjs');
loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en',Platform:{isMacOS:false}}:require(id);
loaded._compile(buildSync({stdin:{contents:`export * from './src/wysimark/entry/markdown-reader'; export {parse,serialize} from './src/wysimark/convert';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history','slate-react','react','react-dom'],write:false}).outputFiles[0].text,'markdown-reader.cjs');
const {createMarkdownReader,parse,serialize}=loaded.exports;

test('unchanged long documents serialize once across callbacks, saves and selection changes',()=>{
 const editor=createEditor();editor.children=parse(Array.from({length:2000},(_,i)=>`Paragraph ${i}: **important** content.`).join('\n\n'));
 let calls=0;const read=createMarkdownReader(editor,children=>{calls++;return serialize(children)});
 const expected=serialize(editor.children);
 for(let i=0;i<20;i++){Transforms.select(editor,Editor.start(editor,[i]));assert.equal(read(),expected)}
 assert.equal(calls,1);
});

test('text, marks, insertion, undo, redo and external replacement invalidate the cached result',()=>{
 const editor=withHistory(createEditor());editor.children=parse('Original\n\nSecond');
 let calls=0;const read=createMarkdownReader(editor,children=>{calls++;return serialize(children)});
 const check=()=>{const before=calls;assert.equal(read(),serialize(editor.children));assert.equal(calls,before+1);read();assert.equal(calls,before+1)};
 check();Transforms.select(editor,Editor.end(editor,[0]));editor.insertText(' changed');check();
 Transforms.setNodes(editor,{bold:true},{at:[0,0]});check();
 Transforms.insertNodes(editor,{type:'paragraph',children:[{text:'New block'}]},{at:[2]});check();
 editor.undo();check();editor.redo();check();
 editor.children=parse('| A | B |\n| --- | --- |\n| 1 | 2 |\n\n```mermaid\ngraph LR; A-->B\n```');check();
});

test('serialization failures do not cache an incomplete result',()=>{
 const editor=createEditor();editor.children=parse('Original');let fail=true;
 const read=createMarkdownReader(editor,children=>{if(fail)throw Error('failure');return serialize(children)});
 assert.throws(read,/failure/);fail=false;assert.equal(read(),'Original');
});
