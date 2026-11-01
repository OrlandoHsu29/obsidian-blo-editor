const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor,Node,Transforms}=require('slate');
const {withHistory}=require('slate-history');
const loaded=new Module('ordered-list-policy.cjs');
loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en',Platform:{isMacOS:false}}:require(id);
loaded._compile(buildSync({stdin:{contents:"export {ListPlugin} from './src/wysimark/list-plugin'; export {ConvertElementPlugin} from './src/wysimark/convert-element-plugin'; export {listItems} from './src/wysimark/toolbar-plugin/items/list-items'; export {headingListState,setHeadingListStyle,toggleHeadingListLevel} from './src/blocks/heading-numbering'",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history'],write:false}).outputFiles[0].text,'ordered-list-policy.cjs');
const {ListPlugin,ConvertElementPlugin,listItems,headingListState,setHeadingListStyle,toggleHeadingListLevel}=loaded.exports;
const toolbar=listItems.find(item=>item!=='divider'&&item.title==='Numbered List');
const bullet=listItems.find(item=>item!=='divider'&&item.title==='Bullet List');
const heading=level=>({type:'heading',level,children:[{text:'title'}]});
const fixture=nodes=>{
 const editor=withHistory(createEditor());editor.wysimark={readOnly:false};
 ConvertElementPlugin.fn(editor);editor.convertElement.addConvertElementType(['paragraph','heading']);
 const plugin=ListPlugin.fn(editor,{}, {createPolicy:p=>p});
 editor.children=nodes;Transforms.select(editor,Editor.start(editor,[0]));
 return {editor,backspace:()=>plugin.editor.deleteBackward('character'),key:(style='number')=>{
  const digit=style==='number'?7:8;
  const result={prevented:false,stopped:false};
  plugin.editableProps.onKeyDown({nativeEvent:{key:String(digit),code:'Digit'+digit,which:48+digit,keyCode:48+digit,ctrlKey:true,shiftKey:true,altKey:false,metaKey:false},preventDefault:()=>result.prevented=true,stopPropagation:()=>result.stopped=true});
  return result;
 }};
};

for(const level of [1,2,3,4])for(const style of ['hash','number']){
 test(`${style} H${level} allows its own control and blocks the opposite toolbar and shortcut`,()=>{
  const node=style==='number'?{type:'ordered-list-item',depth:0,blockChildren:true,children:[heading(level)]}:heading(level);
  const {editor,key}=fixture([node]);const before=structuredClone(editor.children),selection=structuredClone(editor.selection);
  const current=style==='number'?toolbar:bullet,opposite=style==='number'?bullet:toolbar,otherStyle=style==='number'?'hash':'number';
  assert.equal(opposite.disabled(editor),true);assert.equal(current.disabled(editor),false);assert.equal(current.active(editor),true);
  opposite.action(editor);assert.deepEqual(key(otherStyle),{prevented:true,stopped:true});
  assert.deepEqual(editor.children,before);assert.deepEqual(editor.selection,selection);
  current.action(editor);assert.equal(editor.children[0].type,'heading');assert.equal(editor.children[0].__headingList.enabled,false);
  assert.equal(current.active(editor),false);assert.equal(opposite.disabled(editor),true);
  assert.deepEqual(key(style),{prevented:true,stopped:true});assert.equal(current.active(editor),true);
  assert.equal(Node.string(editor.children[0]),'title');
  editor.undo();assert.equal(editor.children[0].__headingList.enabled,false);editor.redo();assert.equal(current.active(editor),true);
 });
}

for(const node of [{type:'paragraph',children:[{text:'body'}]},heading(5)]){
 for(const mode of ['toolbar','shortcut'])test(`${mode} still adds and removes ordered lists for ${node.type==='heading'?'subtitles':'body text'}`,()=>{
  const {editor,key}=fixture([structuredClone(node)]);
  assert.equal(toolbar.disabled(editor),false);
  if(mode==='toolbar')toolbar.action(editor);else assert.deepEqual(key(),{prevented:true,stopped:true});
  assert.equal(editor.children[0].type,'ordered-list-item');
  if(node.type==='heading')assert.equal(editor.children[0].children[0].level,5);
  assert.equal(toolbar.disabled(editor),false);
  if(mode==='toolbar')toolbar.action(editor);else key();
  assert.equal(editor.children[0].type,node.type);
  assert.equal(Editor.string(editor,Editor.range(editor,[0])),node.children[0].text);
 });
}

test('a heading/body selection applies the current type together as one undo step',()=>{
 const {editor,key}=fixture([heading(2),{type:'paragraph',children:[{text:'body'}]}]);
 Transforms.select(editor,{anchor:Editor.start(editor,[0]),focus:Editor.end(editor,[1])});
 const before=structuredClone(editor.children),selection=structuredClone(editor.selection);
 assert.equal(toolbar.disabled(editor),true);assert.equal(bullet.disabled(editor),false);key('hash');
 assert.equal(editor.children[0].type,'heading');assert.equal(editor.children[1].type,'unordered-list-item');
 editor.undo();assert.deepEqual(editor.children,before);assert.deepEqual(editor.selection,selection);
});

test('body content inside a numbered heading container cannot toggle the entire heading list',()=>{
 const {editor,key}=fixture([{type:'ordered-list-item',depth:0,blockChildren:true,children:[heading(1),{type:'paragraph',children:[{text:'attached body'}]}]}]);
 Transforms.select(editor,Editor.start(editor,[0,1]));
 const before=structuredClone(editor.children);
 assert.equal(toolbar.disabled(editor),true);editor.list.convertOrderedList(true);key();assert.deepEqual(editor.children,before);
});

for(const style of ['number','hash'])for(const depth of [0,2])test(`Backspace removes ${style} heading prefix at depth ${depth} without changing its type`,()=>{
 const node=style==='number'?{type:'ordered-list-item',depth,blockChildren:true,children:[heading(2)]}:{...heading(2),__blockDepth:depth};
 const {editor,backspace}=fixture([{type:'paragraph',children:[{text:'before'}]},node]);
 Transforms.select(editor,Editor.start(editor,[1]));const before=structuredClone(editor.children),selection=structuredClone(editor.selection);
 assert.equal(backspace(),true);assert.equal(editor.children.length,2);assert.equal(editor.children[1].type,'heading');assert.equal(editor.children[1].level,2);
 assert.equal(editor.children[1].__headingList.enabled,false);assert.equal(editor.children[1].__headingList.style,style);assert.equal(Node.string(editor.children[1]),'title');
 assert.equal(editor.children[1].__blockDepth??0,depth);assert.equal(editor.history.undos.length,1);
 editor.undo();assert.deepEqual(editor.children,before);assert.deepEqual(editor.selection,selection);editor.redo();assert.equal(editor.children[1].__headingList.enabled,false);
});

test('a level is selected only when all headings of that level have the selected list style',()=>{
 const num=level=>({type:'ordered-list-item',depth:0,blockChildren:true,children:[heading(level)]});
 const {editor}=fixture([num(1),num(2),num(2)]);Transforms.select(editor,Editor.start(editor,[1]));toolbar.action(editor);
 assert(!headingListState(editor).levels.includes(2));toggleHeadingListLevel(editor,2);
 assert(headingListState(editor).levels.includes(2));assert.equal(editor.children[1].type,'ordered-list-item');assert.equal(editor.children[2].type,'ordered-list-item');
});

test('changing the document mode reverses disabled controls without offering a mixed mode',()=>{
 const {editor,key}=fixture([heading(1),heading(2)]);setHeadingListStyle(editor,'number');
 assert.equal(bullet.disabled(editor),true);setHeadingListStyle(editor,'hash');assert.equal(toolbar.disabled(editor),true);assert.equal(bullet.disabled(editor),false);
 const before=structuredClone(editor.children);key('number');assert.deepEqual(editor.children,before);assert.equal(headingListState(editor).style,'hash');
});

test('body lists can still switch freely between ordered and unordered styles',()=>{
 const {editor,key}=fixture([{type:'paragraph',children:[{text:'body'}]}]);key('number');assert.equal(editor.children[0].type,'ordered-list-item');
 key('hash');assert.equal(editor.children[0].type,'unordered-list-item');key('number');assert.equal(editor.children[0].type,'ordered-list-item');
});

test('prefix removal ignores expanded selections, mid-title edits and read-only documents',()=>{
 const {editor,backspace}=fixture([{type:'ordered-list-item',depth:0,blockChildren:true,children:[heading(2)]}]);
 Transforms.select(editor,{anchor:{path:[0,0,0],offset:1},focus:{path:[0,0,0],offset:1}});assert.equal(backspace(),false);
 Transforms.select(editor,{anchor:{path:[0,0,0],offset:0},focus:{path:[0,0,0],offset:2}});assert.equal(backspace(),false);
 Transforms.select(editor,Editor.start(editor,[0]));editor.wysimark.readOnly=true;const before=structuredClone(editor.children);toolbar.action(editor);backspace();assert.deepEqual(editor.children,before);
});

test('a cross-block selection starting inside attached prose does not change its unselected owner heading',()=>{
 const owner={type:'ordered-list-item',depth:0,blockChildren:true,children:[heading(1),{type:'paragraph',children:[{text:'attached body'}]}]};
 const {editor,key}=fixture([owner,{type:'ordered-list-item',depth:0,blockChildren:true,children:[heading(2)]}]);
 Transforms.select(editor,{anchor:Editor.start(editor,[0,1]),focus:Editor.end(editor,[1])});const before=structuredClone(editor.children[0]);
 key('number');assert.deepEqual(editor.children[0],before);assert.equal(editor.children[1].type,'heading');assert.equal(editor.children[1].__headingList.enabled,false);
});
