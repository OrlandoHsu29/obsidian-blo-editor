const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor,Node,Range,Transforms}=require('slate');
const {withHistory}=require('slate-history');
const loaded=new Module('link-boundary.cjs');loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en'}:require(id);
loaded._compile(buildSync({stdin:{contents:`export * from './src/wysimark/anchor-plugin/link-keyboard';export {parse,serialize} from './src/wysimark/convert';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history','slate-react','react','react-dom'],write:false}).outputFiles[0].text,'link-boundary.cjs');
const {handleLinkKey,selectLink,isIconOnlyLink,parse,serialize}=loaded.exports;
const link=(text,url='https://example.test')=>({type:'anchor',href:url,title:'Keep title',children:[{text,bold:true}]});
function fixture(children){const editor=withHistory(createEditor());editor.wysimark={readOnly:false};editor.isInline=node=>node.type==='anchor';editor.children=[{type:'paragraph',children}];Editor.normalize(editor,{force:true});editor.history.undos=[];Transforms.select(editor,Editor.end(editor,[0]));return editor}
function backspace(editor){if(!handleLinkKey(editor,'Backspace'))editor.deleteBackward('character')}
const anchors=editor=>[...Editor.nodes(editor,{at:[],match:node=>node.type==='anchor'})];

for(const text of ['',' ','\u200b','\u00a0'])test(`adjacent icon-only links (${JSON.stringify(text)}) delete one at a time without touching body text`,()=>{
 const editor=fixture([{text:'正文。'},link(text,'https://one.test'),{text:''},link(text,'https://two.test'),{text:''}]);
 for(const remaining of [2,1]){
  const before=structuredClone(editor.children);backspace(editor);assert.deepEqual(editor.children,before);assert.equal(anchors(editor).length,remaining);
  backspace(editor);assert.equal(anchors(editor).length,remaining-1);assert.ok(Node.string(editor).startsWith('正文。'));assert.equal(editor.children[0].type,'paragraph');
 }
 assert.equal(Node.string(editor),'正文。');
});

test('an empty link click can select the token and undo restores only that link',()=>{
 const editor=fixture([{text:'before'},link(''),{text:''}]);selectLink(editor,[0,1]);
 assert.equal(Range.isCollapsed(editor.selection),false);assert.equal(handleLinkKey(editor,'Backspace'),true);assert.equal(Node.string(editor),'before');assert.equal(anchors(editor).length,0);
 editor.undo();assert.equal(anchors(editor).length,1);assert.equal(Node.string(editor),'before');
});

test('icon selection does not survive an unrelated cursor movement',()=>{
 const editor=fixture([{text:'before'},link(''),{text:''}]);selectLink(editor,[0,1]);Transforms.select(editor,{path:[0,0],offset:2});
 backspace(editor);assert.equal(Node.string(editor),'bfore');assert.equal(anchors(editor).length,1);
});

test('backspace and arrows at visible link text use normal Slate character editing',()=>{
 const editor=fixture([{text:''},link('Link'),{text:''}]);
 Transforms.select(editor,Editor.end(editor,[0,1]));
 assert.equal(handleLinkKey(editor,'ArrowLeft'),false);backspace(editor);
 assert.equal(Node.string(editor),'Lin');assert.equal(anchors(editor).length,1);assert.equal(anchors(editor)[0][0].href,'https://example.test');
 Transforms.select(editor,Editor.end(editor,[0,1]));assert.equal(handleLinkKey(editor,'Backspace'),false);editor.deleteBackward('character');assert.equal(Node.string(editor),'Li');
 assert.equal(Node.leaf(editor,editor.selection.anchor.path).bold,true);
});

test('explicit selection can delete a text link while keeping its paragraph and neighbors',()=>{
 const editor=fixture([{text:'before '},link('Link'),{text:' after'}]);selectLink(editor,[0,1]);
 assert.equal(handleLinkKey(editor,'Delete'),true);assert.equal(Node.string(editor),'before  after');assert.equal(editor.children[0].type,'paragraph');
});

test('forward deletion and arrow exit respect empty inline boundaries',()=>{
 const editor=fixture([{text:'before'},link(''),{text:'after'}]);Transforms.select(editor,{path:[0,0],offset:6});
 assert.equal(handleLinkKey(editor,'ArrowRight'),true);assert.equal(anchors(editor).length,1);
 assert.equal(handleLinkKey(editor,'ArrowRight'),true);assert.deepEqual(editor.selection.anchor,{path:[0,2],offset:0});
 Transforms.select(editor,{path:[0,0],offset:6});assert.equal(handleLinkKey(editor,'Delete'),true);assert.equal(anchors(editor).length,1);
 assert.equal(handleLinkKey(editor,'Delete'),true);assert.equal(Node.string(editor),'beforeafter');
});

test('read-only links are never changed by boundary handling',()=>{
 const editor=fixture([{text:'body'},link(''),{text:''}]);editor.wysimark.readOnly=true;const before=structuredClone(editor.children);
 assert.equal(handleLinkKey(editor,'Backspace'),false);assert.deepEqual(editor.children,before);
});

test('blank citations keep their targets through Markdown serialization without placeholder text',()=>{
 for(const text of ['',' ','\u200b']){
  const editor=fixture([{text:'body'},link(text),{text:''}]),markdown=serialize(editor.children),reopened=parse(markdown);
  const node=[...Node.elements({children:reopened})].find(([node])=>node.type==='anchor')?.[0];assert.ok(node);assert.equal(node.href,'https://example.test');assert.equal(isIconOnlyLink(node),true);
  assert.ok(!markdown.includes('\ufeff'));
 }
});
