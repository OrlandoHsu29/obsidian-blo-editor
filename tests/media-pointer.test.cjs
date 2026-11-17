const {test}=require('node:test'),assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module');
const {createEditor,Editor,Transforms}=require('slate');
const m=new Module('media-pointer.cjs');m.require=id=>id==='slate-react'?{ReactEditor:{toSlateNode:(_e,el)=>el.slate,findPath:(e,node)=>[e.children.indexOf(node)],toSlatePoint:(_e,[node])=>node.point}}:require(id);
m._compile(buildSync({stdin:{contents:"export {mediaRangeFromPointer,pointerRangeFromPoint,tableEdgeRangeFromPointer} from './src/blocks/pointer-selection';export {selectImageWithModifier} from './src/blocks/selection';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['slate','slate-react','react','react-dom','slate-history'],write:false}).outputFiles[0].text,'media-pointer.cjs');
for(const url of ['picture.png','diagram.excalidraw.md','manual.pdf'])test('text-to-media Shift and drag share complete native boundaries: '+url,()=>{
 const e=createEditor();e.wysimark={readOnly:false};e.isVoid=n=>n.type==='image-block';
 e.children=[{type:'paragraph',children:[{text:'Before text'}]},{type:'image-block',url,alt:'',children:[{text:''}]},{type:'paragraph',__collapsible:true,children:[{text:''}]},{type:'paragraph',children:[{text:'After text'}]}];
 const anchor={path:[0,0],offset:4},root={slate:e.children[1]},media={closest:()=>root},hit={closest:()=>media};
 const host={ownerDocument:{elementFromPoint:()=>hit},contains:el=>el===media};
 const forward=m.exports.mediaRangeFromPointer(e,host,100,100,anchor);
 assert.deepEqual(forward,{anchor,focus:Editor.start(e,[2])});
 Transforms.select(e,anchor);assert.equal(m.exports.selectImageWithModifier(e,1,true),true);assert.deepEqual(e.selection,forward);
 const reverse={path:[3,0],offset:3};assert.deepEqual(m.exports.mediaRangeFromPointer(e,host,100,100,reverse),{anchor:reverse,focus:Editor.start(e,[1])});
 assert.equal(m.exports.mediaRangeFromPointer(e,{...host,contains:()=>false},100,100,anchor),undefined);
 // On the left/bottom border Chromium may hit the editor and map its caret
 // to the void's hidden leaf instead of hitting the painted media element.
 let focus=Editor.start(e,[1]);
 const borderHost={contains:()=>true,ownerDocument:{elementFromPoint:()=>null,caretRangeFromPoint:()=>({startContainer:{point:focus},startOffset:focus.offset})}};
 assert.deepEqual(m.exports.pointerRangeFromPoint(e,borderHost,100,100,anchor),forward);
 assert.deepEqual(m.exports.pointerRangeFromPoint(e,borderHost,100,100,reverse),{anchor:reverse,focus:Editor.start(e,[1])});
 focus={path:[3,0],offset:2};
 assert.deepEqual(m.exports.pointerRangeFromPoint(e,borderHost,100,100,anchor),{anchor,focus});
 focus=anchor;
 assert.deepEqual(m.exports.pointerRangeFromPoint(e,borderHost,100,100,anchor),{anchor,focus:anchor});
 assert.equal(m.exports.pointerRangeFromPoint(e,{...borderHost,contains:()=>false},100,100,anchor),undefined);
});

test('table gutters use the leading/trailing edge and never map the lower gap back to the first cell',()=>{
 const e=createEditor(),cell=text=>({type:'table-cell',children:[{type:'table-content',children:[{text}]}]});
 e.children=[{type:'paragraph',children:[{text:'Before'}]},{type:'table',columns:[{align:'left'},{align:'left'}],children:[{type:'table-row',children:[cell('A'),cell('B')]},{type:'table-row',children:[cell('C'),cell('D')]}]},{type:'paragraph',children:[{text:'After'}]}];
 const table={slate:e.children[1],getBoundingClientRect:()=>({top:70,bottom:200})};
 const frame={querySelector:()=>table,getBoundingClientRect:()=>({left:0,right:100,top:50,bottom:210})};
 let direct=true;
 const host={contains:el=>el===frame,ownerDocument:{elementFromPoint:()=>({closest:s=>direct&&s==='.blo-table-frame'?frame:null}),caretRangeFromPoint:()=>({startContainer:{nodeType:1,closest:()=>frame}})}};
 const anchor={path:[0,0],offset:2},range=m.exports.tableEdgeRangeFromPointer;
 for(const x of[1,50,99]){
  assert.deepEqual(range(e,host,x,60,anchor),{anchor,focus:Editor.start(e,[1])});
  assert.deepEqual(range(e,host,x,205,anchor),{anchor,focus:Editor.end(e,[1])});
 }
 direct=false;assert.deepEqual(range(e,host,50,220,anchor),{anchor,focus:Editor.end(e,[1])});
 assert.equal(range(e,host,50,100,anchor),undefined); // real cell text stays native
 assert.equal(range(e,host,110,60,anchor),undefined);
 assert.equal(range(e,host,50,60,Editor.start(e,[1])),undefined); // inside-table gestures stay owned by the table
 assert.equal(range(e,{...host,contains:()=>false},50,60,anchor),undefined);
 const reverse=Editor.end(e,[2]);assert.deepEqual(range(e,host,50,205,reverse),{anchor:reverse,focus:Editor.end(e,[1])});
});
