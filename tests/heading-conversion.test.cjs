const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const {createEditor,Editor,Node,Transforms}=require('slate');
const {withHistory}=require('slate-history');
const loaded=new Module('heading-conversion.cjs');
loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en'}:require(id);
loaded._compile(buildSync({stdin:{contents:`
 export {createHeadingMethods} from './src/wysimark/heading-plugin/methods';
 export {ConvertElementPlugin} from './src/wysimark/convert-element-plugin';
 export {CollapsibleParagraphPlugin} from './src/wysimark/collapsible-paragraph-plugin';
 export {headingListState,setHeadingListStyle,toggleHeadingListLevel} from './src/blocks/heading-numbering';
 export {resolveOrderedNumbers} from './src/blocks/model';
 export {parse,serialize} from './src/wysimark/convert';
 `,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history'],write:false}).outputFiles[0].text,'heading-conversion.cjs');
const {createHeadingMethods,ConvertElementPlugin,CollapsibleParagraphPlugin,headingListState,setHeadingListStyle,toggleHeadingListLevel,resolveOrderedNumbers,parse,serialize}=loaded.exports;
const heading=level=>({type:'heading',level,children:[{text:'existing'}]});
const paragraph=text=>({type:'paragraph',children:[{text,bold:true}]});
function fixture(nodes){
 const editor=withHistory(createEditor());editor.wysimark={readOnly:false};
 ConvertElementPlugin.fn(editor);editor.convertElement.addConvertElementType(['paragraph','heading','ordered-list-item','unordered-list-item','task-list-item']);
 editor.normalizeAfterDelete={};CollapsibleParagraphPlugin.fn(editor);
 editor.heading=createHeadingMethods(editor);editor.children=nodes;return editor;
}
const titles=editor=>[...Editor.nodes(editor,{at:[],match:n=>n.type==='heading'})].map(([n])=>n);
const labels=editor=>[...resolveOrderedNumbers(editor.children).numberLabels.values()];

for(const level of [1,2,3,4])for(const style of ['number','hash'])for(const enabled of [true,false]){
 test(`new H${level} inherits ${style} mode and ${enabled?'selected':'unselected'} level before changing totals`,()=>{
  const editor=fixture([paragraph('new'),heading(level)]);setHeadingListStyle(editor,style);
  if(!enabled)toggleHeadingListLevel(editor,level);
  Transforms.select(editor,{path:[0,0],offset:2});
  const before=structuredClone(editor.children),selection=structuredClone(editor.selection),undos=editor.history.undos.length;
  editor.heading.convertHeading(level,true);
  assert.deepEqual(titles(editor)[0].__headingList,{style,enabled});
  assert.deepEqual(editor.children[1],before[1]);
  assert.deepEqual(headingListState(editor).levels,enabled?[level]:[]);
  assert.equal(headingListState(editor).style,style);
  assert.equal(editor.selection.anchor.offset,2);assert.equal(Node.leaf(editor,editor.selection.anchor.path).bold,true);
  assert.equal(editor.history.undos.length,undos+1);
  const after=structuredClone(editor.children);
  editor.undo();assert.deepEqual(editor.children,before);assert.deepEqual(editor.selection,selection);
  editor.redo();assert.deepEqual(editor.children,after);
  const reopened=fixture(parse(serialize(editor.children)));
  assert.deepEqual(headingListState(reopened).levels,enabled?[level]:[]);assert.equal(headingListState(reopened).style,style);
  if(style==='number'&&enabled)assert.deepEqual(labels(reopened),['1.','2.']);
 });
}

test('a new level stays disabled in numeric mode instead of introducing a hash prefix',()=>{
 const editor=fixture([paragraph('new'),heading(1)]);setHeadingListStyle(editor,'number');
 Transforms.select(editor,Editor.start(editor,[0]));editor.heading.convertHeading(2,false);
 assert.deepEqual(titles(editor)[0].__headingList,{style:'number',enabled:false});
 assert.deepEqual(headingListState(editor).levels,[1]);assert.equal(headingListState(editor).style,'number');
});

test('cross-block conversion uses one snapshot for every new heading',()=>{
 const editor=fixture([paragraph('first'),paragraph('second'),heading(1)]);setHeadingListStyle(editor,'number');
 Transforms.select(editor,{anchor:Editor.start(editor,[0]),focus:Editor.end(editor,[1])});
 editor.heading.convertHeading(1,false);
 assert.deepEqual(labels(editor),['1.','2.','3.']);assert.deepEqual(headingListState(editor).levels,[1]);
});

for(const type of ['ordered-list-item','unordered-list-item','task-list-item']){
 test(`converting ${type} preserves ordered owners and applies document defaults to other list types`,()=>{
  const editor=fixture([{type,depth:2,checked:true,children:[{text:'new'}]},heading(1)]);setHeadingListStyle(editor,'number');
  Transforms.select(editor,Editor.start(editor,[0]));editor.heading.convertHeading(1,false);
  const title=titles(editor)[0];assert.equal(title.level,1);assert.deepEqual(title.__headingList,type==='ordered-list-item'?undefined:{style:'number',enabled:true});
  assert.equal(editor.children[0].type,'ordered-list-item');assert.equal(editor.children[0].depth,0);
  assert.deepEqual(headingListState(editor).levels,[1]);
 });
}

test('multiline conversion also inherits the selected numeric heading level',()=>{
 const editor=fixture([paragraph('first\nsecond'),heading(1)]);setHeadingListStyle(editor,'number');
 Transforms.select(editor,Editor.range(editor,[0]));editor.heading.convertHeading(1,false);
 assert(titles(editor).every(n=>n.__headingList?.style==='number'&&n.__headingList.enabled));
 assert.deepEqual(headingListState(editor).levels,[1]);
});

test('changing heading levels adopts the target level while reapplying the same level preserves local formatting',()=>{
 const editor=fixture([heading(2),heading(1)]);setHeadingListStyle(editor,'number');toggleHeadingListLevel(editor,2);
 Transforms.select(editor,Editor.start(editor,[0]));editor.heading.convertHeading(1,false);
 assert.deepEqual(labels(editor),['1.','2.']);assert.deepEqual(headingListState(editor).levels,[1]);
 toggleHeadingListLevel(editor,1);
 editor.heading.convertHeading(1,false);assert.equal(titles(editor)[0].__headingList.enabled,false);
});

test('subtitles, heading toggle-off and first headings retain their existing behavior',()=>{
 const editor=fixture([paragraph('new'),heading(1)]);setHeadingListStyle(editor,'number');
 Transforms.select(editor,Editor.start(editor,[0]));editor.heading.convertHeading(5,false);
 assert.equal(editor.children[0].type,'heading');assert.equal(editor.children[0].level,5);assert.equal(editor.children[0].__headingList,undefined);
 editor.heading.convertHeading(5,true);assert.equal(editor.children[0].type,'paragraph');
 const empty=fixture([paragraph('first')]);Transforms.select(empty,Editor.start(empty,[0]));empty.heading.convertHeading(1,false);
 assert.equal(empty.children[0].type,'heading');assert.equal(empty.children[0].__headingList,undefined);
});

for(const level of [1,2,3,4,5])for(const command of ['paragraph','toggle']){
 test(`numbered H${level} becomes numbered body via ${command}, preserving attached content and one undo`,()=>{
  const owner={type:'ordered-list-item',depth:2,blockChildren:true,__numbering:'continue',children:[
   {...heading(level),__headingList:{style:'number',enabled:true}},paragraph('attached body'),
  ]};
  const editor=fixture([owner,paragraph('following')]);
  Transforms.select(editor,{path:[0,0,0],offset:3});
  const before=structuredClone(editor.children),selection=structuredClone(editor.selection);
  if(command==='paragraph')editor.collapsibleParagraph.convertParagraph();else editor.heading.convertHeading(level,true);
  const list=editor.children[0];assert.equal(list.type,'ordered-list-item');assert.equal(list.depth,2);
  assert.equal(list.children[0].type,'paragraph');assert.equal(list.children[0].__headingList,undefined);assert.equal(list.children[0].level,undefined);
  assert.equal(Node.string(list.children[0]),'existing');assert.equal(Node.string(list.children[1]),'attached body');
  assert.deepEqual(list.children[1],owner.children[1]);assert.equal(Node.string(editor.children[1]),'following');
  assert.deepEqual(labels(editor),['1.']);assert.equal(editor.selection.anchor.offset,3);assert.equal(editor.history.undos.length,1);
  const after=structuredClone(editor.children);editor.undo();assert.deepEqual(editor.children,before);assert.deepEqual(editor.selection,selection);
  editor.redo();assert.deepEqual(editor.children,after);
  const reopened=fixture(parse(serialize(after)));assert.equal(reopened.children[0].type,'ordered-list-item');assert.deepEqual(labels(reopened),['1.']);
 });
}

test('ordinary numbered body keeps its owner and explicit start when converted to the first heading',()=>{
 const editor=fixture([{type:'ordered-list-item',depth:1,start:8,__numbering:'explicit',children:[{text:'body'}]}]);
 Transforms.select(editor,Editor.start(editor,[0]));editor.heading.convertHeading(1,false);
 assert.equal(editor.children[0].type,'ordered-list-item');assert.equal(editor.children[0].children[0].level,1);assert.equal(editor.children[0].depth,0);
 assert.deepEqual(labels(editor),['8.']);assert.equal(editor.children[0].__numbering,'explicit');assert.equal(editor.children[0].start,8);
});

test('converting attached body alone does not remove an unselected heading owner',()=>{
 const editor=fixture([{type:'ordered-list-item',depth:1,blockChildren:true,children:[heading(1),paragraph('attached')]}]);
 Transforms.select(editor,Editor.start(editor,[0,1]));editor.collapsibleParagraph.convertParagraph();
 assert.equal(editor.children[0].type,'ordered-list-item');assert.equal(editor.children[0].children[0].type,'heading');
});

test('cross-block heading to body conversion keeps both list owners and attached siblings',()=>{
 const editor=fixture([1,2].map(level=>({type:'ordered-list-item',depth:0,blockChildren:true,children:[heading(level),paragraph('attached '+level)]})));
 Transforms.select(editor,{anchor:Editor.start(editor,[0,0]),focus:Editor.end(editor,[1,0])});
 const before=structuredClone(editor.children);editor.collapsibleParagraph.convertParagraph();
 assert(editor.children.every(node=>node.type==='ordered-list-item'));assert.deepEqual(editor.children.flatMap(node=>node.children.map(Node.string)),['existing','attached 1','existing','attached 2']);
 assert.equal(editor.history.undos.length,1);editor.undo();assert.deepEqual(editor.children,before);
});

for(const level of [1,2,3,4,5])for(const style of ['hash','number'])test(`ordered body keeps numbering when switching to H${level} under ${style} document settings`,()=>{
 const editor=fixture([{type:'ordered-list-item',depth:1,start:4,__numbering:'explicit',__blockId:'keep-id',children:[{text:'body',bold:true}]},heading(1)]);
 setHeadingListStyle(editor,style);if(style==='number')toggleHeadingListLevel(editor,1);
 Transforms.select(editor,{path:[0,0],offset:2});const before=structuredClone(editor.children),selection=structuredClone(editor.selection),count=editor.history.undos.length;
 editor.heading.convertHeading(level,false);const owner=editor.children[0];
 assert.equal(owner.type,'ordered-list-item');assert.equal(owner.depth,0);assert.equal(owner.start,4);assert.equal(owner.__numbering,'explicit');assert.equal(owner.__blockId,'keep-id');
 assert.equal(owner.children[0].level,level);assert.equal(Node.leaf(editor,editor.selection.anchor.path).bold,true);assert.equal(editor.selection.anchor.offset,2);
 const after=structuredClone(editor.children);assert.equal(editor.history.undos.length,count+1);editor.undo();assert.deepEqual(editor.children,before);assert.deepEqual(editor.selection,selection);editor.redo();assert.deepEqual(editor.children,after);
 const reopened=fixture(parse(serialize(after)));assert.equal(reopened.children[0].type,'ordered-list-item');assert.equal(reopened.children[0].__blockId,'keep-id');assert.equal(reopened.children[0].start,4);
});

test('multiline ordered items keep their owner, rich text and soft breaks through heading and body styles',()=>{
 const editor=fixture([{type:'ordered-list-item',depth:1,start:7,__numbering:'explicit',children:[{text:'first\nsecond',italic:true}]}]);
 Transforms.select(editor,{path:[0,0],offset:8});editor.heading.convertHeading(2,false);
 assert.equal(editor.children.length,1);assert.equal(editor.children[0].type,'ordered-list-item');assert.equal(Node.string(editor.children[0]),'first\nsecond');assert.equal(editor.children[0].depth,0);assert.deepEqual(labels(editor),['7.']);
 editor.collapsibleParagraph.convertParagraph();assert.equal(editor.children[0].type,'ordered-list-item');assert.equal(Node.string(editor.children[0]),'first\nsecond');assert.equal(Node.leaf(editor,editor.selection.anchor.path).italic,true);
 assert.equal(editor.selection.anchor.offset,8);assert.deepEqual(labels(editor),['7.']);
});

test('selecting paragraph on an ordinary ordered body item leaves list properties intact',()=>{
 const owner={type:'ordered-list-item',depth:2,start:9,__numbering:'explicit',__blockId:'ordered-body',children:[{text:'body'}]};
 const editor=fixture([owner]);Transforms.select(editor,{path:[0,0],offset:2});editor.collapsibleParagraph.convertParagraph();
 assert.deepEqual(editor.children,[owner]);assert.equal(editor.selection.anchor.offset,2);
});

test('legacy alphabetic list subtitles retain their list when switching to a main heading',()=>{
 const editor=fixture([{type:'ordered-list-item',depth:0,__subtitle:true,__numbering:'restart',children:[{text:'legacy'}]}]);
 Transforms.select(editor,{path:[0,0],offset:2});editor.heading.convertHeading(2,false);
 assert.equal(editor.children[0].type,'ordered-list-item');assert.equal(editor.children[0].__subtitle,undefined);
 assert.equal(editor.children[0].children[0].level,2);assert.deepEqual(labels(editor),['1.']);
});

test('mixed multiline selections keep existing ordered blocks through heading and body conversion',()=>{
 const editor=fixture([paragraph('plain\ntext'),{type:'ordered-list-item',depth:1,start:6,__numbering:'explicit',__blockId:'mixed-id',children:[{text:'listed\ntext',bold:true}]},paragraph('last')]);
 Transforms.select(editor,{anchor:Editor.start(editor,[0]),focus:Editor.end(editor,[2])});
 const before=structuredClone(editor.children);editor.heading.convertHeading(3,false);
 const numbered=editor.children.find(node=>node.__blockId==='mixed-id');assert.equal(numbered.type,'ordered-list-item');assert.equal(numbered.start,6);assert.equal(Node.string(numbered),'listed\ntext');assert.equal(numbered.children[0].level,3);
 const after=structuredClone(editor.children);assert.equal(editor.history.undos.length,1);editor.undo();assert.deepEqual(editor.children,before);editor.redo();assert.deepEqual(editor.children,after);
 Transforms.select(editor,Editor.range(editor,[]));editor.collapsibleParagraph.convertParagraph();
 const body=editor.children.find(node=>node.__blockId==='mixed-id');assert.equal(body.type,'ordered-list-item');assert.equal(body.start,6);assert.equal(Node.string(body),'listed\ntext');assert.equal(body.children[0].type,'paragraph');
});
