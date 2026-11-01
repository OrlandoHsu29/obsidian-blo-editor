const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const loaded=new Module('ordered-numbering.cjs');
loaded.require=id=>id==='obsidian'?{getLanguage:()=> 'en'}:require(id);
loaded._compile(buildSync({entryPoints:['src/blocks/model.ts'],bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history'],write:false}).outputFiles[0].text,'ordered-numbering.cjs');
const {resolveOrderedNumbers}=loaded.exports;
const heading=(level,numbered=false,depth=0,extra={})=>numbered
 ?{type:'ordered-list-item',blockChildren:true,depth,children:[{type:'heading',level,children:[{text:'heading'}]}],...extra}
 :{type:'heading',level,__blockDepth:depth,children:[{text:'heading'}]};
const item=(extra={})=>({type:'ordered-list-item',depth:0,children:[{text:'item'}],...extra});
const paragraph=()=>({type:'paragraph',children:[{text:'body'}]});
const labels=nodes=>{const resolved=resolveOrderedNumbers(nodes);return nodes.filter(n=>n.type==='ordered-list-item').map(n=>resolved.numberLabels.get(n))};
test('unnumbered H2 blocks inheritance from a numbered H1, including a second H2',()=>{
 assert.deepEqual(labels([heading(1,true),heading(2),paragraph(),heading(2),heading(5,true),heading(5,true)]),['1.','1.','2.']);
});
test('numbered heading children inherit their immediate numbered parent',()=>{
 assert.deepEqual(labels([heading(1,true),heading(2,true),heading(3,true),heading(3,true),heading(2,true)]),['1.','1.1','1.1.1','1.1.2','1.2']);
});
test('plain paragraphs and quotes do not break continuation',()=>{
 assert.deepEqual(labels([heading(1,true),heading(2,true),paragraph(),{type:'block-quote',children:[paragraph()]},heading(2,true)]),['1.','1.1','1.2']);
});
test('a plain intermediate heading blocks inheritance, then numbered children can form their own path',()=>{
 assert.deepEqual(labels([heading(1,true),heading(2),heading(3,true),heading(4,true),heading(4,true)]),['1.','1.','1.1','1.2']);
});
test('a new plain heading starts a separate child series',()=>{
 assert.deepEqual(labels([heading(1,true),heading(2),heading(5,true),heading(5,true),heading(2),heading(5,true)]),['1.','1.','2.','1.']);
});
test('leaving a plain subsection restores the next numbered parent scope',()=>{
 assert.deepEqual(labels([heading(1,true),heading(2),heading(5,true),heading(2,true),heading(5,true)]),['1.','1.','1.1','1.']);
});
test('missing heading levels do not create phantom numbers',()=>{
 assert.deepEqual(labels([heading(1,true),heading(4,true),heading(4,true)]),['1.','1.1','1.2']);
});
test('unnumbered headings at a deeper indentation also block inheritance',()=>{
 assert.deepEqual(labels([heading(2,true),heading(2,false,1),heading(2,true,2),heading(2,true,2)]),['1.','1.','2.']);
});
test('restart, explicit starts and continuation retain their local numbers',()=>{
 const nodes=[heading(1,true),heading(2),heading(5,true,0,{start:7,__numbering:'explicit'}),heading(5,true),heading(5,true,0,{__numbering:'restart'}),heading(5,true)];
 assert.deepEqual(labels(nodes),['1.','7.','8.','1.','2.']);
});
test('ordinary numbered paragraphs keep their established continuation and indentation behavior',()=>{
 assert.deepEqual(labels([item(),paragraph(),item(),item({depth:1}),item({depth:1}),item(),item({__numbering:'restart'}),item()]),['1.','2.','1.','2.','3.','1.','2.']);
});
test('the resolver is read-only and deterministic',()=>{
 const nodes=[heading(1,true),heading(2),heading(5,true)],before=structuredClone(nodes);
 assert.deepEqual(labels(nodes),labels(nodes));assert.deepEqual(nodes,before);
});
test('legacy numbered subtitle paragraphs respect an unnumbered heading barrier',()=>{
 assert.deepEqual(labels([heading(1,true),heading(2),item({__subtitle:true}),item({__subtitle:true})]),['1.','1.','2.']);
});

test('subtitles use independent numbers under fully numbered H1–H4 headings',()=>{
 assert.deepEqual(labels([heading(1,true),heading(2,true),heading(3,true),heading(4,true),heading(5,true),heading(5,true),heading(5,true)]),['1.','1.1','1.1.1','1.1.1.1','1.','2.','3.']);
});

test('legacy subtitles also use independent numbers and do not become a numbering ancestor',()=>{
 assert.deepEqual(labels([heading(1,true),heading(2,true),item({__subtitle:true}),item({__subtitle:true}),heading(3,true)]),['1.','1.1','1.','2.','1.1.1']);
});
