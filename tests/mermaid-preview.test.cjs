const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor}=require('slate');

function compile(entry,external,requireFn){
 const loaded=new Module(entry);loaded.require=requireFn;
 loaded._compile(buildSync({entryPoints:[entry],bundle:true,platform:'node',format:'cjs',jsx:'automatic',external,write:false}).outputFiles[0].text,entry);
 return loaded.exports;
}

function codeFixture(readOnly=false){
 const editor=createEditor(),block={type:'code-block',language:'mermaid',children:[{type:'code-block-line',children:[{text:'graph LR; A-->B'}]}]};
 editor.children=[{type:'paragraph',children:[{text:'before'}]},block];
 editor.selection=Editor.range(editor,[0]);editor.wysimark={renderMermaidPreview:code=>code};
 let focused=0;
 const {CodeBlock}=compile('src/wysimark/code-block-plugin/render-element/CodeBlock.tsx',
  ['./*','../*','react','react/*','slate','slate-react'],id=>{
   if(id==='react')return {...require('react'),useRef:()=>({current:null}),useCallback:fn=>fn};
   if(id==='slate-react')return {useSlateStatic:()=>editor,useSelected:()=>false,useReadOnly:()=>readOnly,ReactEditor:{findPath:()=>[1],focus:()=>focused++}};
   if(id.endsWith('/use-editor-focused'))return {useEditorFocused:()=>false};
   if(id.endsWith('/use-layer'))return {useLayer:()=>({})};
   if(id.endsWith('/use-block-selection'))return {useBlockSelection:()=>false};
   if(id==='../styles')return {$CodeBlock:'div'};
   if(id==='../../utils/translations')return {ui:key=>key};
   if(id==='../icons/ChevronDownIcon')return {};
   if(id==='./LanguageMenu'||id==='./CodeBlockActions')return {};
   if(id==='obsidian')return {getLanguage:()=> 'en'};
   return require(id);
  });
 const tree=CodeBlock({element:block,attributes:{},children:'hidden source'}),scroll=tree.props.children[0];
 return {editor,scroll,get focused(){return focused}};
}
function pointer(target,currentTarget,button=0){
 return {target,currentTarget,button,prevented:false,stopped:false,preventDefault(){this.prevented=true},stopPropagation(){this.stopped=true}};
}

test('scrollbar press/drag preserves the preview selection and native scrolling',()=>{
 const f=codeFixture(),before=structuredClone(f.editor.selection),scroller={scrollWidth:1600,clientWidth:500,scrollHeight:300,clientHeight:285};
 const event=pointer(scroller,scroller);f.scroll.props.onMouseDown(event);
 assert.equal(event.prevented,false);assert.equal(event.stopped,true);
 assert.deepEqual(f.editor.selection,before);assert.equal(f.focused,0);
 const overlay=pointer({scrollWidth:700,clientWidth:300,scrollHeight:180,clientHeight:180},scroller);
 f.scroll.props.onMouseDown(overlay);
 assert.equal(overlay.prevented,false);assert.deepEqual(f.editor.selection,before);
});
test('clicking diagram content still enters Mermaid source editing',()=>{
 const f=codeFixture(),event=pointer({scrollWidth:0,clientWidth:0,scrollHeight:0,clientHeight:0},{});
 f.scroll.props.onMouseDown(event);
 assert.equal(event.prevented,true);assert.equal(f.focused,1);
 assert.deepEqual(f.editor.selection,{anchor:Editor.start(f.editor,[1]),focus:Editor.start(f.editor,[1])});
});
test('read-only and secondary-button preview interactions do not select source',()=>{
 for(const [readOnly,button] of [[true,0],[false,2]]){
  const f=codeFixture(readOnly),before=structuredClone(f.editor.selection),event=pointer({}, {}, button);
  f.scroll.props.onMouseDown(event);
  assert.equal(event.prevented,false);assert.deepEqual(f.editor.selection,before);assert.equal(f.focused,0);
 }
});

function previewFixture(){
 let effect,state=true,loads=0,unloads=0;
 const targets=[],pending=[];
 const host={createDiv(){const target={text:'',attributes:{},attached:true,setText(text){this.text=text},setAttribute(key,value){this.attributes[key]=value},remove(){this.attached=false}};targets.push(target);return target}};
 const {MermaidPreview}=compile('src/MermaidPreview.tsx',['react','react/*','obsidian'],id=>{
  if(id==='react')return {useRef:()=>({current:host}),useState:()=>[state,value=>{state=value}],useEffect:fn=>{effect=fn}};
  if(id==='obsidian')return {getLanguage:()=> 'en',Component:class {load(){loads++}unload(){unloads++}},MarkdownRenderer:{render(app,source,target){return new Promise((resolve,reject)=>pending.push({resolve,reject,target,source}))}}};
  return require(id);
 });
 return {render(code){const tree=MermaidPreview({app:{},sourcePath:'note.md',code});return {tree,mount:()=>effect()}},targets,pending,get loading(){return state},get loads(){return loads},get unloads(){return unloads}};
}
const flush=async()=>{await Promise.resolve();await Promise.resolve()};

test('loading indicator is separate from renderer output and disappears after rendering',async()=>{
 const f=previewFixture(),initial=f.render('graph LR; A-->B');
 assert.equal(initial.tree.props.children[0].props.role,'status');
 const cleanup=initial.mount();
 assert.equal(f.targets[0].text,'','loading text must never be inserted into renderer output');
 f.targets[0].text='<svg>diagram</svg>';f.pending[0].resolve();await flush();
 assert.equal(f.loading,false);
 assert.equal(f.render('graph LR; A-->B').tree.props.children[0],false);
 assert.equal(f.targets[0].text,'<svg>diagram</svg>');
 cleanup();assert.equal(f.unloads,1);assert.equal(f.targets[0].attached,false);
});
test('late rendering from an obsolete revision cannot clear the new diagram or its loading state',async()=>{
 const f=previewFixture(),cleanupFirst=f.render('old diagram').mount();cleanupFirst();
 const cleanupSecond=f.render('new diagram').mount();
 f.targets[1].text='<svg>new</svg>';f.pending[0].resolve();await flush();
 assert.equal(f.loading,true);assert.equal(f.targets[1].attached,true);assert.equal(f.targets[1].text,'<svg>new</svg>');
 f.pending[1].resolve();await flush();assert.equal(f.loading,false);
 cleanupSecond();assert.equal(f.loads,f.unloads);
});
test('renderer errors replace loading with a visible error and cancel safely after unmount',async()=>{
 const f=previewFixture(),cleanup=f.render('invalid').mount();
 f.pending[0].reject(new Error('Invalid syntax'));await flush();
 assert.equal(f.loading,false);assert.equal(f.targets[0].text,'Invalid syntax');assert.equal(f.targets[0].attributes.role,'alert');cleanup();
 const g=previewFixture(),dispose=g.render('gone').mount();dispose();g.pending[0].reject(new Error('late'));await flush();
 assert.equal(g.targets[0].text,'');assert.equal(g.targets[0].attached,false);
});

test('Mermaid source switching keeps the clicked block stationary until keyboard editing takes over',()=>{
 const editor=createEditor();editor.children=[{type:'paragraph',children:[{text:'before'}]}];editor.wysimark={};editor.getMarkdown=()=> 'source';
 let scrollCalls=0;
 const {Editable}=compile('src/wysimark/entry/index.tsx',['./*','../*','react','react/*','slate','slate-react'],id=>{
  if(id==='react')return {useRef:value=>({current:value}),useCallback:fn=>fn,useEffect:()=>{}};
  if(id==='slate-react')return {Slate:'slate',defaultScrollSelectionIntoView:()=>scrollCalls++};
  if(id==='../convert')return {parse:()=>editor.children,serialize:()=> 'source'};
  if(id.endsWith('/throttle'))return {throttle:fn=>Object.assign(fn,{cancel(){},flush(){}})};
  if(id==='./markdown-change-tracker')return {MarkdownChangeTracker:class {next(){}}};
  if(id.endsWith('/pointer-selection'))return {isPointerSelecting:()=>false,trackLinkIconSelection:()=>{}};
  if(id.endsWith('/cell-selection'))return {tableCellSelection:()=>null};
  if(id.endsWith('/dom-guards'))return {isDomElement:node=>!!node?.closest};
  if(id==='./SinkEditable')return {SinkEditable:'editable'};
  if(id.startsWith('.'))return {};
  return require(id);
 });
 const editable=Editable({editor,value:'source',onChange(){}}).props.children[0];
 const caret={},outside={},block={isConnected:true,contains:node=>node===caret};
 const scroller={closest:selector=>selector==='[data-wysimark-code-block]'?block:null};
 const target={closest:selector=>selector==='[data-wysimark-mermaid-scroller]'?scroller:null};
 editable.props.onMouseDownCapture({target,currentTarget:{contains:node=>node===block}});
 editable.props.scrollSelectionIntoView(editor,{startContainer:caret,endContainer:caret});
 assert.equal(scrollCalls,0,'switching the clicked diagram must not reveal/center the code start');
 editable.props.scrollSelectionIntoView(editor,{startContainer:outside,endContainer:outside});
 assert.equal(scrollCalls,1,'unrelated selections must still scroll normally');
 editable.props.onKeyDownCapture({key:'ArrowRight',nativeEvent:{keyCode:39}});
 editable.props.scrollSelectionIntoView(editor,{startContainer:caret,endContainer:caret});
 assert.equal(scrollCalls,2,'typing/navigation restores normal caret scrolling');
});
