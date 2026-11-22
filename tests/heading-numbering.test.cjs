const {test} = require('node:test');
const assert = require('node:assert/strict');
const {buildSync} = require('esbuild');
const Module = require('node:module');
const {createEditor, Editor, Node, Transforms} = require('slate');
const {withHistory} = require('slate-history');
const loaded = new Module('heading-numbering.cjs');
loaded.require = id => id === 'obsidian' ? {getLanguage: () => 'en'} : require(id);
loaded._compile(buildSync({stdin:{contents:"export * from './src/blocks/heading-numbering'; export {resolveOrderedNumbers,rootCache} from './src/blocks/model'; export {parse,serialize} from './src/wysimark/convert'; export {outlineHeadings} from './src/outline'",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history'],write:false}).outputFiles[0].text, 'heading-numbering.cjs');
const {resolveOrderedNumbers, headingListState, toggleHeadingListLevel, convertSelectedHeadingList, deleteHeadingListPrefix, parse, serialize} = loaded.exports;
const heading = (level, extra={}) => ({type:'heading',level,children:[{text:`Title ${level}`,bold:true}],...extra});
const paragraph = text => ({type:'paragraph',children:[{text}]});
const numbered = (level, extra={}) => ({type:'ordered-list-item',blockChildren:true,depth:0,children:[heading(level)],...extra});
const fixture = nodes => {
  const editor = withHistory(createEditor());
  editor.wysimark = {readOnly:false};
  editor.children = nodes;
  return editor;
};
const labels = editor => Array.from(resolveOrderedNumbers(editor.children).numberLabels.values());

function setAllHeadingLevels(editor,style){
 for(const level of [1,2,3,4])if(headingListState(editor).byLevel[level]!==style)toggleHeadingListLevel(editor,level,style);
}
const headingListLevels=editor=>[1,2,3,4].filter(level=>headingListState(editor).byLevel[level]!==null);

test('formula-only and mixed numbered headings retain their formula and source position in the outline',()=>{
 const {outlineHeadings,rootCache}=loaded.exports;
 const editor=fixture(parse('# Root\n\n1. ## $x+y$\n\n2. ## Energy $E=mc^2$\n\n##### Hidden'));
 const positions=[{start:{line:2}},{start:{line:4}}];
 const {headings}=rootCache(editor);
 const outline=outlineHeadings([{level:1,heading:'Root'},{level:5,heading:'Hidden'}],headings,positions.map(position=>({position})));
 assert.deepEqual(outline.map(item=>item.heading),['Root','1. $x+y$','2. Energy $E=mc^2$']);
 assert.equal(outline[1].position,positions[0]);
 assert.deepEqual(outline.slice(1).map(item=>item.__bloHeadingIndex),[1,2]);
});

test('subtitle letter labels survive Markdown save and reload without becoming literal text',()=>{
 const nodes=[numbered(2),numbered(5,{start:26,__numbering:'explicit'}),numbered(5),numbered(5)];
 const source=serialize(nodes),restored=parse(source);
 assert.deepEqual(Array.from(resolveOrderedNumbers(restored).numberLabels.values()),['1.','z.','aa.','ab.']);
 assert(!source.includes('aa.'));
 assert.equal(Node.string(restored[2]),'Title 5');
});

test('style conversion preserves selection and marks in one undo step',()=>{
 const editor=fixture([heading(1,{__blockDepth:1}),paragraph('body'),heading(1,{__blockDepth:1}),heading(5)]);
 Transforms.select(editor,{anchor:{path:[0,0],offset:2},focus:{path:[2,0],offset:4}});
 const before=structuredClone(editor.children),selection=structuredClone(editor.selection);
 toggleHeadingListLevel(editor,1,'number');const after=structuredClone(editor.children);
 assert.deepEqual(editor.selection,{anchor:{path:[0,0,0],offset:2},focus:{path:[2,0,0],offset:4}});
 assert.equal(editor.history.undos.length,1);
 editor.undo();assert.deepEqual(editor.children,before);assert.deepEqual(editor.selection,selection);
 editor.redo();assert.deepEqual(editor.children,after);
});

test('clearing a numbered heading keeps the heading at root and preserves attached body indentation',()=>{
 const editor=fixture([numbered(1,{depth:2,children:[heading(1),paragraph('attached body')]}),heading(5)]);
 toggleHeadingListLevel(editor,1,'number');
 assert.equal(editor.children[0].type,'heading');assert.equal(editor.children[0].__blockDepth,0);
 assert.equal(editor.children[1].__blockDepth,2);assert.equal(Node.string(editor.children[1]),'attached body');
 assert.deepEqual(editor.children[2],heading(5));
});

test('selection and body edits reuse the same heading state cache',()=>{
 const editor=fixture([heading(1),heading(2),paragraph('body')]),first=headingListState(editor);
 Transforms.select(editor,Editor.start(editor,[2]));assert.equal(headingListState(editor),first);
 editor.insertText('more ');assert.equal(headingListState(editor),first);
});

test('changing a level reuses cached title locations after an intervening block move',()=>{
 const quote={type:'block-quote',children:[heading(2),heading(3)]};
 const editor=fixture([heading(2),paragraph('body'),quote,numbered(2)]);
 headingListState(editor);
 Transforms.moveNodes(editor,{at:[1],to:[0]});
 toggleHeadingListLevel(editor,2,'hash');
 assert.deepEqual(editor.children.map(node=>node.type),['paragraph','heading','block-quote','heading']);
 assert.equal(editor.children[2].children[0].__headingList.style,'hash');
 assert.equal(editor.children[2].children[1],quote.children[1]);
 assert(!headingListState(editor).activeLevels.number.includes(2));
});

test('unifying a mixed level does not rewrite a heading already using the target settings',()=>{
 const title=numbered(2,{__blockDepth:0,__numbering:'continue',children:[heading(2,{__blockDepth:0,__headingList:{style:'number',enabled:true}})]});
 const editor=fixture([paragraph('body'),title,heading(2)]);
 toggleHeadingListLevel(editor,2,'number');
 assert.equal(editor.children[1],title);
 assert.deepEqual(labels(editor),['1.','2.']);
});

test('each heading level has an independent ordered, unordered or cleared preset',()=>{
 const editor=fixture([heading(1),heading(2),heading(3)]);
 toggleHeadingListLevel(editor,1,'number');toggleHeadingListLevel(editor,3,'hash');toggleHeadingListLevel(editor,4,'number');
 const mixed={1:'number',2:'hash',3:null,4:'number'};
 assert.deepEqual(headingListState(editor).byLevel,mixed);assert.deepEqual(labels(editor),['1.']);
 const reopened=fixture(parse(serialize(editor.children)));assert.deepEqual(headingListState(reopened).byLevel,mixed);
 toggleHeadingListLevel(reopened,1,'hash');assert.deepEqual(headingListState(reopened).byLevel,{...mixed,1:'hash'});
 toggleHeadingListLevel(reopened,1,'hash');assert.deepEqual(headingListState(reopened).byLevel,{...mixed,1:null});
 reopened.undo();assert.deepEqual(headingListState(reopened).byLevel,{...mixed,1:'hash'});
 reopened.undo();assert.deepEqual(headingListState(reopened).byLevel,mixed);
});

test('old single-style document presets migrate when reopening',()=>{
 const legacy=encodeURIComponent(JSON.stringify({depth:0,headingDefaults:{style:'number',levels:[1,4]}}));
 const editor=fixture(parse('<!-- wysimark-block:v1 '+legacy+' -->\n\nBody\n'));
 assert.deepEqual(headingListState(editor).byLevel,{1:'number',2:null,3:null,4:'number'});
});

test('default prefixes are active on H1–H3 but not H4, and an older H4 preset still wins',()=>{
 const editor=fixture(parse('# A\n\n## B\n\n### C\n\n#### D'));
 assert.deepEqual(headingListState(editor).activeLevels,{hash:[1,2,3],number:[]});
 Transforms.select(editor,Editor.start(editor,[3]));assert.equal(deleteHeadingListPrefix(editor),false);
 toggleHeadingListLevel(editor,4,'hash');assert.deepEqual(headingListState(editor).activeLevels.hash,[1,2,3,4]);
 const legacy=encodeURIComponent(JSON.stringify({depth:0,headingDefaults:{style:'hash',levels:[1,2,3,4]}}));
 const reopened=fixture(parse('<!-- wysimark-block:v1 '+legacy+' -->\n\n#### D\n'));
 assert.deepEqual(headingListState(reopened).activeLevels.hash,[1,2,3,4]);
});

for(const style of ['hash','number'])test(`mixed H2 displays both rows, then unifies to ${style} on click`,()=>{
 const editor=fixture([heading(1),numbered(2),heading(2),heading(3)]);
 const mixed=()=>headingListState(editor);
 assert(mixed().activeLevels.hash.includes(2));assert(mixed().activeLevels.number.includes(2));
 assert.equal(mixed().byLevel[2],null);
 toggleHeadingListLevel(editor,2,style);
 const other=style==='hash'?'number':'hash';
 assert.equal(mixed().byLevel[2],style);assert(mixed().activeLevels[style].includes(2));assert(!mixed().activeLevels[other].includes(2));
 assert.deepEqual(labels(editor),style==='number'?['1.','2.']:[]);
 toggleHeadingListLevel(editor,2,style);
 assert(!mixed().activeLevels.hash.includes(2));assert(!mixed().activeLevels.number.includes(2));
 editor.undo();editor.undo();assert(mixed().activeLevels.hash.includes(2));assert(mixed().activeLevels.number.includes(2));
});

for(const style of ['hash','number'])test(`a locally disabled H2 makes the level non-uniform without changing its preset (${style})`,()=>{
 const editor=fixture([heading(1,{__headingDefaults:{1:'hash',2:'hash',3:'hash',4:'hash'}}),heading(2),heading(2),heading(3)]);
 setAllHeadingLevels(editor,style);assert.deepEqual(headingListLevels(editor),[1,2,3,4]);
 Transforms.select(editor,Editor.start(editor,[1]));const before=structuredClone(editor.children);
 assert.equal(convertSelectedHeadingList(editor,style,true),true);
 assert.deepEqual(headingListLevels(editor),[1,3,4]);assert.equal(headingListState(editor).defaults[2],style);
 const remaining=editor.children[2].type==='heading'?editor.children[2]:editor.children[2].children[0];assert.notEqual(remaining.__headingList?.enabled,false);
 const disabled=structuredClone(editor.children);editor.undo();assert.deepEqual(editor.children,before);assert.deepEqual(headingListLevels(editor),[1,2,3,4]);editor.redo();assert.deepEqual(editor.children,disabled);assert.deepEqual(headingListLevels(editor),[1,3,4]);
 const reopened=fixture(parse(serialize(editor.children)));assert.deepEqual(headingListLevels(reopened),[1,3,4]);
 Transforms.select(editor,Editor.start(editor,[1]));convertSelectedHeadingList(editor,style,true);assert.deepEqual(headingListLevels(editor),[1,2,3,4]);
});

test('Backspace prefix removal updates only the corresponding heading level state',()=>{
 const editor=fixture([heading(1,{__headingDefaults:{1:'hash',2:'hash',3:'hash',4:'hash'}}),heading(2),heading(2)]);
 Transforms.select(editor,Editor.start(editor,[1]));assert.equal(deleteHeadingListPrefix(editor),true);assert.deepEqual(headingListLevels(editor),[1,3,4]);
});

test('absent levels still use saved presets rather than existing headings of other levels',()=>{
 const editor=fixture([heading(1,{__headingDefaults:{1:'hash',2:null,3:'hash',4:'hash'}}),heading(3)]);
 assert.deepEqual(headingListLevels(editor),[1,3,4]);toggleHeadingListLevel(editor,2,'hash');assert.deepEqual(headingListLevels(editor),[1,2,3,4]);
 assert.equal(editor.children.filter(n=>n.type==='heading'&&n.level===2).length,0);
});

test('invalid metadata is ignored and old slider metadata retains its per-heading enabled state',()=>{
 const source=saved=>'<!-- wysimark-block:v1 '+encodeURIComponent(JSON.stringify({depth:0,headingStyles:[saved]}))+' -->\n\n# Alpha\n';
 for(const saved of [null,{path:[-1],style:'hash',enabled:true},{path:[],style:'unknown',enabled:true},{path:[],style:'number',enabled:'yes'},{path:[99],style:'hash',enabled:true}]){
  const nodes=parse(source(saved));assert.equal(nodes[0].__headingList,undefined);assert.equal(Node.string(nodes[0]),'Alpha');
 }
 const editor=fixture(parse(source({path:[],style:'number',enabled:false,maxLevel:2})));
 assert.equal(headingListState(editor).byLevel[2],'number');assert.deepEqual(headingListLevels(editor),[2,3]);
 assert.deepEqual(editor.children[0].__headingList,{style:'number',enabled:false});
});

for(const style of ['hash','number']) {
  test(`${style} level buttons toggle independently, preserve siblings and survive saving`,()=>{
    const subtitle=numbered(5),body={type:'ordered-list-item',depth:0,start:8,__numbering:'explicit',children:[{text:'body'}]};
    const editor=fixture([heading(1),heading(2),heading(3),heading(4),subtitle,body]);
    setAllHeadingLevels(editor,style);
    assert.deepEqual(headingListLevels(editor),[1,2,3,4]);
    const before=structuredClone(editor.children);
    toggleHeadingListLevel(editor,2,style);
    assert.deepEqual(headingListLevels(editor),[1,3,4]);
    const content=node=>JSON.parse(JSON.stringify(node,(key,value)=>['__headingList','__headingDefaults'].includes(key)?undefined:value));
    for(const index of [0,2,3])assert.deepEqual(content(editor.children[index]),content(before[index]));
    assert.deepEqual(editor.children[4],subtitle);assert.deepEqual(editor.children[5],body);
    if(style==='number')assert.deepEqual(labels(editor),['1.','1.','1.1','a.','8.']);
    const disabled=structuredClone(editor.children);
    editor.undo();assert.deepEqual(editor.children,before);
    editor.redo();assert.deepEqual(editor.children,disabled);
    const reopened=fixture(parse(serialize(editor.children)));
    assert.deepEqual(headingListLevels(reopened),[1,3,4]);
    toggleHeadingListLevel(reopened,1,style);assert.deepEqual(headingListLevels(reopened),[3,4]);
    toggleHeadingListLevel(reopened,4,style);assert.deepEqual(headingListLevels(reopened),[3]);
    toggleHeadingListLevel(reopened,2,style);assert.deepEqual(headingListLevels(reopened),[2,3]);
    if(style==='number')assert.deepEqual(labels(reopened).slice(0,2),['1.','1.1']);
  });
}

test('a disabled H2 resets H3 numbering separately in each section while its own H4 children keep their hierarchy',()=>{
 const editor=fixture([heading(1),heading(2),heading(3),heading(3),heading(4),heading(2),heading(3)]);
 setAllHeadingLevels(editor,'number');toggleHeadingListLevel(editor,2,'number');
 assert.deepEqual(labels(editor),['1.','1.','2.','2.1','1.']);
});

test('level buttons cannot change a read-only document',()=>{
 const editor=fixture([heading(1),heading(2)]),before=structuredClone(editor.children);
 editor.wysimark.readOnly=true;toggleHeadingListLevel(editor,1,'hash');
 assert.deepEqual(editor.children,before);
});
