const {test}=require('node:test'),assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module');
const {Node,createEditor,Editor,Transforms}=require('slate'),{withHistory}=require('slate-history');
const loaded=new Module('heading-export.cjs');
loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en'}:require(id);
loaded._compile(buildSync({stdin:{contents:"export {exportHeadingLists} from './src/note-export/heading-lists'; export {portableDocument,portableMarkdown} from './src/note-export/portable-document'",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history'],write:false}).outputFiles[0].text,'heading-export.cjs');
const {exportHeadingLists,portableDocument,portableMarkdown}=loaded.exports;
const heading=(level,text,extra={})=>({type:'heading',level,children:[{text}],...extra});
const numbered=(level,text,extra={})=>({type:'ordered-list-item',depth:0,blockChildren:true,children:[heading(level,text)],...extra});
const paragraph=text=>({type:'paragraph',children:[{text}]});
const markdown=nodes=>portableMarkdown(portableDocument(nodes));

test('hash and disabled heading prefixes export as ordinary headings without decorative hashes or numbers',()=>{
 const nodes=[heading(1,'Alpha',{__headingList:{style:'hash',enabled:true}}),heading(2,'Beta',{__headingList:{style:'hash',enabled:false}})];
 assert.equal(markdown(nodes),'# Alpha\n\n## Beta\n');
 assert.deepEqual(exportHeadingLists(nodes).map(Node.string),['Alpha','Beta']);
 assert(!markdown(nodes).includes('wysimark-block'));
});

test('numeric heading labels become heading text instead of external list markers',()=>{
 const nodes=[numbered(1,'Alpha'),numbered(2,'Beta'),numbered(3,'Gamma'),numbered(2,'Delta')];
 const output=exportHeadingLists(nodes);
 assert.deepEqual(output.map(n=>n.type),['heading','heading','heading','heading']);
 assert.deepEqual(output.map(Node.string),['1. Alpha','1.1 Beta','1.1.1 Gamma','1.2 Delta']);
 assert.equal(markdown(nodes),'# 1\\. Alpha\n\n## 1.1 Beta\n\n### 1.1.1 Gamma\n\n## 1.2 Delta\n');
});

test('unnumbered H2 barriers and repeated subsections use the same numbering as the editor',()=>{
 const nodes=[numbered(1,'Alpha'),heading(2,'No number'),numbered(3,'One'),numbered(3,'Two'),heading(2,'Next section'),numbered(3,'Reset')];
 assert.deepEqual(exportHeadingLists(nodes).map(Node.string),['1. Alpha','No number','1. One','2. Two','Next section','1. Reset']);
});

test('explicit starts and manual restarts retain their actual labels',()=>{
 const nodes=[numbered(1,'Chapter',{start:3,__numbering:'explicit'}),numbered(2,'Section',{start:7,__numbering:'explicit'}),numbered(2,'Restart',{__numbering:'restart'})];
 assert.deepEqual(exportHeadingLists(nodes).map(Node.string),['3. Chapter','3.7 Section','3.1 Restart']);
});

test('body lists and subtitles remain real lists with independent sequence values',()=>{
 const body={type:'ordered-list-item',depth:0,start:8,__numbering:'explicit',children:[{text:'Body'}]};
 const nodes=[numbered(1,'Alpha'),numbered(2,'Beta'),numbered(5,'Subtitle'),numbered(5,'Second subtitle'),body];
 const output=exportHeadingLists(nodes);
 assert.equal(output[2].type,'ordered-list-item');assert.equal(output[2].start,1);assert.equal(Node.string(output[2]),'Subtitle');
 assert.equal(output[3].start,2);assert.equal(output[4].start,8);assert.equal(Node.string(output[4]),'Body');
 assert.match(markdown(nodes),/1\. \*\*Subtitle\*\*/);assert.match(markdown(nodes),/2\. \*\*Second subtitle\*\*/);assert.match(markdown(nodes),/8\. Body/);
});

test('lifting a heading preserves marks, indentation and additional list children',()=>{
 const nodes=[numbered(2,'',{depth:2,children:[heading(2,'',{children:[{text:'Color',bold:true,inlineStyle:'color:#ff0000'}, {text:' code',code:true}]}),paragraph('Attached body')]})];
 const output=exportHeadingLists(nodes);
 assert.equal(output.length,2);assert.equal(output[0].__blockDepth,2);assert.equal(output[1].__blockDepth,2);
 assert.deepEqual(output[0].children.slice(1),nodes[0].children[0].children);assert.equal(Node.string(output[1]),'Attached body');
 assert(markdown(nodes).includes('Attached body'));
});

test('nested heading lists use their own sequence and literal title text stays literal',()=>{
 const nodes=[{type:'block-quote',children:[numbered(1,'Alpha'),numbered(2,'Beta')]}];
 assert.deepEqual(exportHeadingLists(nodes)[0].children.map(Node.string),['1. Alpha','1.1 Beta']);
 assert.equal(Node.string(exportHeadingLists([heading(1,'2024. Literal')])[0]),'2024. Literal');
 assert.equal(Node.string(exportHeadingLists([numbered(6,'Legacy H6')])[0]),'1. Legacy H6');
});

test('export is detached, repeatable, and does not change document, selection or history',()=>{
 const editor=withHistory(createEditor());editor.children=[numbered(1,'Alpha'),numbered(2,'Beta')];
 Transforms.select(editor,Editor.start(editor,[1]));const before=structuredClone(editor.children),selection=structuredClone(editor.selection),history=structuredClone(editor.history);
 const output=exportHeadingLists(editor.children);assert.deepEqual(exportHeadingLists(output),output);
 markdown(editor.children);assert.deepEqual(editor.children,before);assert.deepEqual(editor.selection,selection);assert.deepEqual(editor.history,history);
 assert.notEqual(output[0],editor.children[0].children[0]);assert.notEqual(output[0].children[1],editor.children[0].children[0].children[0]);
});
