const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor,Node,Transforms}=require('slate');
const {withHistory,HistoryEditor}=require('slate-history');
const {IS_COMPOSING}=require('slate-dom');
const {ReactEditor}=require('slate-react');
const loaded=new Module('link-input.cjs');loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en',Platform:{isMacOS:false}}:require(id);
loaded._compile(buildSync({stdin:{contents:`import {createWithSink} from './src/wysimark/sink/editor';import {AnchorPlugin} from './src/wysimark/anchor-plugin';import {MarksPlugin} from './src/wysimark/marks-plugin';export const withLinks=createWithSink([AnchorPlugin.fn,MarksPlugin.fn]);export * from './src/wysimark/anchor-plugin/link-input';export {handleLinkKey} from './src/wysimark/anchor-plugin/link-keyboard';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-dom','slate-history','slate-react','react','react-dom'],write:false}).outputFiles[0].text,'link-input.cjs');
const {withLinks,prepareLinkEndInput,handleLinkKey}=loaded.exports;
const link=()=>({type:'anchor',href:'https://example.test',children:[{text:'Title',bold:true,inlineStyle:'color:#ff0000'}]});
function fixture(extra={},suffix=''){
 const e=withHistory(createEditor());e.wysimark={readOnly:false};withLinks(e,{});
 e.children=[{type:'paragraph',...extra,children:[{text:'before'},link(),{text:suffix}]}];Editor.normalize(e,{force:true});e.history.undos=[];return e;
}
for(const extra of [{},{type:'heading',level:2},{type:'list-item',ordered:true,depth:2},{type:'list-item',ordered:false,checked:false}])for(const from of ['label','right'])test(`${JSON.stringify(extra)} typing at end from ${from} stays plain, and Backspace preserves the label`,()=>{
 const e=fixture(extra),before=structuredClone(e.children),point=from==='label'?Editor.end(e,[0,1]):Editor.start(e,[0,2]);
 Transforms.select(e,point);assert.deepEqual(e.selection.anchor,Editor.start(e,[0,2]));
 assert.deepEqual(e.marks,{});assert.deepEqual(e.activeMarks,{});
 HistoryEditor.withNewBatch(e,()=>e.insertText('\u4e2d\u6587x'));
 assert.equal(Node.string(e.children[0].children[1]),'Title');assert.deepEqual(e.children[0].children[2],{text:'\u4e2d\u6587x'});
 const typed=structuredClone(e.children),caret=structuredClone(e.selection);e.undo();assert.deepEqual(e.children,before);e.redo();assert.deepEqual(e.children,typed);Transforms.select(e,caret);
 for(const remaining of ['\u4e2d\u6587','\u4e2d','']){HistoryEditor.withNewBatch(e,()=>e.deleteBackward('character'));assert.equal(Node.string(e.children[0].children[1]),'Title');assert.equal(e.children[0].children[2].text,remaining)}
 for(const [key,value]of Object.entries(extra))assert.deepEqual(e.children[0][key],value);
});
test('ordinary text to the right keeps its own characters when typing and deleting at the boundary',()=>{
 const e=fixture({},' after');Transforms.select(e,{path:[0,2],offset:1});Transforms.move(e,{distance:1,reverse:true});e.insertText('X');
 assert.equal(Node.string(e),'beforeTitleX after');e.deleteBackward('character');assert.equal(Node.string(e),'beforeTitle after');
});
test('editing inside a label and replacing its entire text retain the link',()=>{
 const e=fixture();Transforms.select(e,{path:[0,1,0],offset:2});e.insertText('x');assert.equal(Node.string(e.children[0].children[1]),'Tixtle');
 Transforms.select(e,Editor.range(e,[0,1]));e.insertText('Replacement');assert.equal(Node.string(e.children[0].children[1]),'Replacement');
});
test('a composition already in progress does not move its selection or clear its marks',()=>{
 const e=fixture();IS_COMPOSING.set(e,true);
 try{const point=Editor.end(e,[0,1]);Transforms.select(e,point);e.insertText('\u4e2d');assert.equal(Node.string(e.children[0].children[1]),'Title\u4e2d')}
 finally{IS_COMPOSING.set(e,false)}
});
test('IME preparation synchronizes the native caret once, before composition starts',()=>{
 const e=fixture();Transforms.select(e,Editor.end(e,[0,1]));const node={},old=ReactEditor.toDOMRange;let writes=0;
 const native={anchorNode:{},anchorOffset:5,isCollapsed:true,setBaseAndExtent(a,ao,f,fo){assert.equal(a,f);assert.equal(ao,fo);this.anchorNode=a;this.anchorOffset=ao;writes++}};
 ReactEditor.toDOMRange=(_e,range)=>{assert.deepEqual(range.anchor,Editor.start(e,[0,2]));return{startContainer:node,startOffset:1}};
 try{prepareLinkEndInput(e,{getSelection:()=>native});prepareLinkEndInput(e,{getSelection:()=>native});assert.equal(writes,1);assert.equal(native.anchorOffset,1)}finally{ReactEditor.toDOMRange=old}
});
test('read-only selections are left alone',()=>{
 const e=fixture();e.wysimark.readOnly=true;const point=Editor.end(e,[0,1]);Transforms.select(e,point);assert.deepEqual(e.selection.anchor,point);
});
test('moving left from the shared endpoint enters the label instead of getting trapped',()=>{
 const e=fixture();Transforms.select(e,Editor.end(e,[0,1]));assert.deepEqual(e.selection.anchor,Editor.start(e,[0,2]));
 assert.equal(handleLinkKey(e,'ArrowLeft'),true);assert.deepEqual(e.selection.anchor,{path:[0,1,0],offset:4});
 e.insertText('X');assert.equal(Node.string(e.children[0].children[1]),'TitlXe');
 Transforms.move(e,{distance:1});assert.deepEqual(e.selection.anchor,Editor.start(e,[0,2]));
});
