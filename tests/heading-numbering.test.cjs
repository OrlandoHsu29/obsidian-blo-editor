const {test} = require('node:test');
const assert = require('node:assert/strict');
const {buildSync} = require('esbuild');
const Module = require('node:module');
const {createEditor, Editor, Node, Transforms} = require('slate');
const {withHistory} = require('slate-history');
const loaded = new Module('heading-numbering.cjs');
loaded.require = id => id === 'obsidian' ? {getLanguage: () => 'en'} : require(id);
loaded._compile(buildSync({stdin:{contents:"export * from './src/blocks/heading-numbering'; export {resolveOrderedNumbers} from './src/blocks/model'; export {parse,serialize} from './src/wysimark/convert'",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history'],write:false}).outputFiles[0].text, 'heading-numbering.cjs');
const {resolveOrderedNumbers, headingListState, toggleHeadingListLevel, setHeadingListStyle, parse, serialize} = loaded.exports;
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

const headingListLevels=editor=>headingListState(editor).levels;

test('subtitle letter labels survive Markdown save and reload without becoming literal text',()=>{
 const nodes=[numbered(2),numbered(5,{start:26,__numbering:'explicit'}),numbered(5),numbered(5)];
 const source=serialize(nodes),restored=parse(source);
 assert.deepEqual(Array.from(resolveOrderedNumbers(restored).numberLabels.values()),['1.','z.','aa.','ab.']);
 assert(!source.includes('aa.'));
 assert.equal(Node.string(restored[2]),'Title 5');
});

test('style conversion preserves selection and marks in one undo step',()=>{
 const editor=fixture([heading(1,{__blockDepth:1}),paragraph('body'),heading(2,{__blockDepth:1}),heading(5)]);
 Transforms.select(editor,{anchor:{path:[0,0],offset:2},focus:{path:[2,0],offset:4}});
 const before=structuredClone(editor.children),selection=structuredClone(editor.selection);
 setHeadingListStyle(editor,'number');const after=structuredClone(editor.children);
 assert.deepEqual(editor.selection,{anchor:{path:[0,0,0],offset:2},focus:{path:[2,0,0],offset:4}});
 assert.equal(editor.history.undos.length,1);
 editor.undo();assert.deepEqual(editor.children,before);assert.deepEqual(editor.selection,selection);
 editor.redo();assert.deepEqual(editor.children,after);
});

test('clearing a numbered heading keeps the heading at root and preserves attached body indentation',()=>{
 const editor=fixture([numbered(1,{depth:2,children:[heading(1),paragraph('attached body')]}),heading(5)]);
 toggleHeadingListLevel(editor,1);
 assert.equal(editor.children[0].type,'heading');assert.equal(editor.children[0].__blockDepth,0);
 assert.equal(editor.children[1].__blockDepth,2);assert.equal(Node.string(editor.children[1]),'attached body');
 assert.deepEqual(editor.children[2],heading(5));
});

test('reselecting the current style performs no operations and creates no undo entry',()=>{
 const editor=fixture([heading(1),heading(2)]);
 setHeadingListStyle(editor,'number');const count=editor.operations.length,undos=editor.history.undos.length,nodes=editor.children;
 setHeadingListStyle(editor,'number');
 assert.equal(editor.children,nodes);assert.equal(editor.operations.length,count);assert.equal(editor.history.undos.length,undos);
});

test('a style choice does not re-enable levels that were switched off',()=>{
 const editor=fixture([heading(1),heading(2)]);
 toggleHeadingListLevel(editor,1);toggleHeadingListLevel(editor,2);
 setHeadingListStyle(editor,'number');assert.deepEqual(headingListLevels(editor),[]);assert.deepEqual(labels(editor),[]);
 const reopened=fixture(parse(serialize(editor.children)));
 assert.equal(headingListState(reopened).style,'number');assert.deepEqual(headingListLevels(reopened),[]);
 setHeadingListStyle(reopened,'hash');assert.deepEqual(headingListLevels(reopened),[]);
 toggleHeadingListLevel(reopened,2);assert.deepEqual(headingListLevels(reopened),[2]);
});

test('selection and body edits reuse the same heading state cache',()=>{
 const editor=fixture([heading(1),heading(2),paragraph('body')]),first=headingListState(editor);
 Transforms.select(editor,Editor.start(editor,[2]));assert.equal(headingListState(editor),first);
 editor.insertText('more ');assert.equal(headingListState(editor),first);
});

test('invalid metadata is ignored and old slider metadata retains its per-heading enabled state',()=>{
 const source=saved=>'<!-- wysimark-block:v1 '+encodeURIComponent(JSON.stringify({depth:0,headingStyles:[saved]}))+' -->\n\n# Alpha\n';
 for(const saved of [null,{path:[-1],style:'hash',enabled:true},{path:[],style:'unknown',enabled:true},{path:[],style:'number',enabled:'yes'},{path:[99],style:'hash',enabled:true}]){
  const nodes=parse(source(saved));assert.equal(nodes[0].__headingList,undefined);assert.equal(Node.string(nodes[0]),'Alpha');
 }
 const editor=fixture(parse(source({path:[],style:'number',enabled:false,maxLevel:2})));
 assert.equal(headingListState(editor).style,'number');assert.deepEqual(headingListLevels(editor),[]);
 assert.deepEqual(editor.children[0].__headingList,{style:'number',enabled:false});
});

for(const style of ['hash','number']) {
  test(`${style} level buttons toggle independently, preserve siblings and survive saving`,()=>{
    const subtitle=numbered(5),body={type:'ordered-list-item',depth:0,start:8,__numbering:'explicit',children:[{text:'body'}]};
    const editor=fixture([heading(1),heading(2),heading(3),heading(4),subtitle,body]);
    setHeadingListStyle(editor,style);
    assert.deepEqual(headingListLevels(editor),[1,2,3,4]);
    const before=structuredClone(editor.children);
    toggleHeadingListLevel(editor,2);
    assert.deepEqual(headingListLevels(editor),[1,3,4]);
    assert.deepEqual(editor.children[0],before[0]);assert.deepEqual(editor.children[2],before[2]);assert.deepEqual(editor.children[3],before[3]);
    assert.deepEqual(editor.children[4],subtitle);assert.deepEqual(editor.children[5],body);
    if(style==='number')assert.deepEqual(labels(editor),['1.','1.','1.1','a.','8.']);
    const disabled=structuredClone(editor.children);
    editor.undo();assert.deepEqual(editor.children,before);
    editor.redo();assert.deepEqual(editor.children,disabled);
    const reopened=fixture(parse(serialize(editor.children)));
    assert.deepEqual(headingListLevels(reopened),[1,3,4]);
    toggleHeadingListLevel(reopened,1);assert.deepEqual(headingListLevels(reopened),[3,4]);
    toggleHeadingListLevel(reopened,4);assert.deepEqual(headingListLevels(reopened),[3]);
    toggleHeadingListLevel(reopened,2);assert.deepEqual(headingListLevels(reopened),[2,3]);
    if(style==='number')assert.deepEqual(labels(reopened).slice(0,2),['1.','1.1']);
  });
}

test('a disabled H2 resets H3 numbering separately in each section while its own H4 children keep their hierarchy',()=>{
 const editor=fixture([heading(1),heading(2),heading(3),heading(3),heading(4),heading(2),heading(3)]);
 setHeadingListStyle(editor,'number');toggleHeadingListLevel(editor,2);
 assert.deepEqual(labels(editor),['1.','1.','2.','2.1','1.']);
});

test('level buttons cannot change a read-only document',()=>{
 const editor=fixture([heading(1),heading(2)]),before=structuredClone(editor.children);
 editor.wysimark.readOnly=true;toggleHeadingListLevel(editor,1);
 assert.deepEqual(editor.children,before);
});
