const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor,Node,Transforms}=require('slate');
const {withHistory,HistoryEditor}=require('slate-history');
const loaded=new Module('link-label.cjs');loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en'}:require(id);
loaded._compile(buildSync({stdin:{contents:`export * from './src/wysimark/convert/link-label';export * from './src/wysimark/convert/obsidian-links';export {parse,serialize} from './src/wysimark/convert';export {insertLink} from './src/wysimark/anchor-plugin/methods/insertLink';export {editLink} from './src/wysimark/anchor-plugin/methods/editLink';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history','slate-react','react','react-dom'],write:false}).outputFiles[0].text,'link-label.cjs');
const {normalizeLinkLabel,parse,serialize,insertLink,editLink,wikiLinkHref,wikiLinkDisplayText,normalizeWikiLinkInput,serializeWikiLinkHref}=loaded.exports;
const links=editor=>[...Editor.nodes(editor,{at:[],match:n=>n.type==='anchor'})];
const readLinks=nodes=>[...Node.elements({children:nodes})].filter(([n])=>n.type==='anchor').map(([n])=>n);
function fixture(){const editor=withHistory(createEditor());editor.isInline=n=>n.type==='anchor';editor.children=[{type:'paragraph',children:[{text:'before'}]}];Transforms.select(editor,Editor.end(editor,[0]));return editor}

test('display-label normalization distinguishes blank text from an empty field',()=>{
 assert.equal(normalizeLinkLabel(''),'');for(const label of [' ','   ','\t\n','\u00a0\u00a0'])assert.equal(normalizeLinkLabel(label),' ');
 assert.equal(normalizeLinkLabel('  One    two  '),'One two');
});

test('inserting and editing a space-only link preserves an intentional label and undo',()=>{
 const editor=fixture();insertLink(editor,'https://one.test','   ',{title:'original'});let [node,path]=links(editor)[0];assert.equal(Node.string(node),' ');
 const before=structuredClone(editor.children);
 HistoryEditor.withNewBatch(editor,()=>editLink(editor,{href:'https://two.test',text:'\t  ',title:'title'},{at:path}));
 [node]=links(editor)[0];assert.equal(Node.string(node),' ');assert.equal(node.href,'https://two.test');editor.undo();assert.deepEqual(editor.children,before);
});

for(const label of [' ','   ','\t\n'])test(`external blank label ${JSON.stringify(label)} saves as one linked space and reopens`,()=>{
 const nodes=[{type:'paragraph',children:[{text:'before'},{type:'anchor',href:'https://one.test',title:'title',children:[{text:label}]},{text:'after'}]}];
 const original=structuredClone(nodes),markdown=serialize(nodes);assert.deepEqual(nodes,original);assert.ok(markdown.includes('[ ](https://one.test'));
 const link=readLinks(parse(markdown))[0];assert.equal(Node.string(link),' ');assert.equal(link.href,'https://one.test');assert.equal(link.title,'title');
});

test('internal link aliases preserve one blank space through input, serialization and parsing',()=>{
 assert.deepEqual(normalizeWikiLinkInput('[[Note|    ]]'),{target:'Note',display:' '});
 assert.deepEqual(normalizeWikiLinkInput('Note|   '),{target:'Note',display:' '});
 assert.equal(wikiLinkDisplayText('Note|   '),' ');assert.equal(serializeWikiLinkHref(wikiLinkHref('Note|  '),'  '),'[[Note| ]]');
 const nodes=[{type:'paragraph',children:[{text:''},{type:'anchor',href:wikiLinkHref('Note|   '),children:[{text:'   '}]},{text:''}]}];
 const markdown=serialize(nodes);assert.ok(markdown.includes('[[Note| ]]'));assert.equal(Node.string(readLinks(parse(markdown))[0]),' ');
});

test('a genuinely empty external link remains empty rather than acquiring a space',()=>{
 const nodes=[{type:'paragraph',children:[{text:''},{type:'anchor',href:'https://one.test',children:[{text:''}]},{text:''}]}];
 const markdown=serialize(nodes);assert.ok(markdown.includes('[](https://one.test)'));assert.equal(Node.string(readLinks(parse(markdown))[0]),'');
});
