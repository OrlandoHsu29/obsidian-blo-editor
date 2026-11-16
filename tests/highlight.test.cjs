const {test}=require('node:test'),assert=require('node:assert/strict');
const {buildSync}=require('esbuild'),Module=require('node:module');
const {createEditor,Editor,Transforms,Node}=require('slate'),{withHistory}=require('slate-history');
const loaded=new Module('highlight.cjs');loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en'}:require(id);
loaded._compile(buildSync({stdin:{contents:`
import {createWithSink} from './src/wysimark/sink/editor';
import {MarksPlugin} from './src/wysimark/marks-plugin';
export const withMarks=createWithSink([MarksPlugin.fn]);
export {parse,serialize} from './src/wysimark/convert';
export {applyHighlightColor,DEFAULT_HIGHLIGHT_COLOR} from './src/wysimark/marks-plugin/methods/highlight-color';
`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history','slate-react','react','react-dom'],write:false}).outputFiles[0].text,'highlight.cjs');
const {withMarks,parse,serialize}=loaded.exports;
const {applyHighlightColor,DEFAULT_HIGHLIGHT_COLOR}=loaded.exports;
test('highlight toggles only selected text, saves native delimiters and supports undo',()=>{
 const e=withHistory(createEditor());e.wysimark={readOnly:false};withMarks(e,{});
 e.children=[{type:'paragraph',children:[{text:'First important last',bold:true}]}];
 Transforms.select(e,{anchor:{path:[0,0],offset:6},focus:{path:[0,0],offset:15}});const before=structuredClone(e.children);
 e.marksPlugin.toggleHighlight();const after=structuredClone(e.children);
 assert.equal(e.children[0].children[1].text,'important');assert.equal(e.children[0].children[1].highlight,true);
 assert.equal(e.children[0].children[0].highlight,undefined);assert.match(serialize(e.children),/==important==/);
 assert(!serialize(e.children).includes('<mark>'));e.undo();assert.deepEqual(e.children,before);e.redo();assert.deepEqual(e.children,after);
 e.marksPlugin.toggleHighlight();assert.equal([...Node.texts(e)].some(([leaf])=>leaf.highlight),false);
});
for(const source of['==important==','**==strong==**','==before **strong** after==','<mark>legacy</mark>'])test(`highlight roundtrip: ${source}`,()=>{
 const first=parse(source),markdown=serialize(first),second=parse(markdown);
 const highlighted=nodes=>nodes.flatMap(node=>[...Node.texts(node)]).filter(([leaf])=>leaf.highlight).map(([leaf])=>leaf.text).join('');
 assert(highlighted(first).length);assert.equal(highlighted(second),highlighted(first));assert(markdown.includes('=='));
});

test('changing and clearing highlight preserves foreground and other marks, including undo and persistence',()=>{
 const e=withHistory(createEditor());e.wysimark={readOnly:false};withMarks(e,{});
 e.children=[{type:'paragraph',children:[{text:'Color',bold:true,inlineStyle:'color:#DF2A3F'}]}];Transforms.select(e,Editor.range(e,[0]));
 const before=structuredClone(e.children);applyHighlightColor(e,'#1677FF');
 const blue=e.children[0].children[0];assert(blue.highlight);assert(blue.inlineStyle.includes('color:#DF2A3F'));assert(blue.inlineStyle.includes('background-color:'));
 const reopened=[...Node.texts(parse(serialize(e.children))[0])][0][0];assert(reopened.highlight);assert.equal(reopened.inlineStyle,blue.inlineStyle);
 e.undo();assert.deepEqual(e.children,before);e.redo();
 applyHighlightColor(e,'#7C3AED');assert.notEqual(e.children[0].children[0].inlineStyle,blue.inlineStyle);
 applyHighlightColor(e,DEFAULT_HIGHLIGHT_COLOR);assert.equal(e.children[0].children[0].inlineStyle,'color:#DF2A3F');assert(e.children[0].children[0].highlight);
 applyHighlightColor(e,null);assert.equal(e.children[0].children[0].highlight,undefined);assert.equal(e.children[0].children[0].inlineStyle,'color:#DF2A3F');assert(e.children[0].children[0].bold);
});
test('the highlight shortcut uses the selected color and toggles it off cleanly',()=>{
 const e=withHistory(createEditor());e.wysimark={readOnly:false,getHighlightColor:()=> '#1677FF'};withMarks(e,{});
 e.children=[{type:'paragraph',children:[{text:'Word'}]}];Transforms.select(e,Editor.range(e,[0]));
 e.marksPlugin.toggleHighlight();assert(e.children[0].children[0].inlineStyle.includes('background-color:'));
 e.marksPlugin.toggleHighlight();assert.equal(e.children[0].children[0].highlight,undefined);assert.equal(e.children[0].children[0].inlineStyle,undefined);
});
