const {test}=require('node:test'),assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module');
const {createEditor,Node}=require('slate'),{withHistory}=require('slate-history');const m=new Module('search-window.cjs');m.require=require;m._compile(buildSync({entryPoints:['src/search/model.ts'],bundle:true,platform:'node',format:'cjs',external:['slate','slate-history'],write:false}).outputFiles[0].text,'search-window.cjs');const{findText,replaceMatches}=m.exports;
test('search and replace cover a long document including collapsed descendants without relying on DOM',()=>{
 const e=withHistory(createEditor());e.wysimark={readOnly:false};e.children=Array.from({length:1200},(_,i)=>({type:'paragraph',__blockDepth:i%2,children:[{text:i===1199?'last Needle':'Needle '+i}]}));e.children[0].__collapsed=true;
 const hits=findText(e,'Needle');assert.equal(hits.length,1200);assert.equal(hits.at(-1).anchor.path[0],1199);const original=structuredClone(e.children);
 assert.equal(replaceMatches(e,hits,'Replacement'),1200);assert.equal(findText(e,'Needle').length,0);assert.equal(findText(e,'Replacement').length,1200);e.undo();assert.deepEqual(e.children,original);
});
test('search spans formatting leaves and readonly replacement cannot change content',()=>{
 const e=createEditor();e.wysimark={readOnly:false};e.children=[{type:'paragraph',children:[{text:'nee',bold:true},{text:'dle',italic:true}]}];assert.equal(findText(e,'NEEDLE').length,1);assert.equal(findText(e,'NEEDLE',true).length,0);
 const before=Node.string(e);e.wysimark.readOnly=true;assert.equal(replaceMatches(e,findText(e,'needle'),'changed'),0);assert.equal(Node.string(e),before);
});
