const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
let active;
const compiled=buildSync({entryPoints:['src/search/FindBar.ts'],bundle:true,platform:'node',format:'cjs',external:['obsidian','slate-react','./model','../wysimark/utils/translations'],write:false}).outputFiles[0].text;
const loaded=new Module('find-bar.cjs');loaded.require=id=>id==='obsidian'?{setIcon(){}}:id==='slate-react'?{ReactEditor:{toDOMRange(){active.conversions++;return {getBoundingClientRect:()=>({top:200,bottom:220})}},focus(){}}}:id==='./model'?{findText(){active.searches++;return Array.from({length:20},(_,i)=>({anchor:{path:[i,0],offset:0},focus:{path:[i,0],offset:1}}))},replaceMatches(){}}:id==='../wysimark/utils/translations'?{ui:text=>text}:require(id);loaded._compile(compiled,'find-bar.cjs');
function fixture(){
 const e={searches:0,conversions:0,frames:new Map(),next:0,editor:{children:[],selection:null},observed:new Set(),unobserved:[]};active=e;
 const win={CSS:{highlights:new Map()},Highlight:class{constructor(...ranges){this.ranges=ranges}},requestAnimationFrame:fn=>{e.frames.set(++e.next,fn);return e.next},cancelAnimationFrame:id=>e.frames.delete(id),ResizeObserver:class{observe(el){e.observed.add(el)}unobserve(el){e.observed.delete(el);e.unobserved.push(el)}disconnect(){e.observed.clear()}}};
 const doc={defaultView:win};
 class El{
  constructor(){this.ownerDocument=doc;this.children=[];this.value='';this.hidden=false;this.values=new Map();this.style={getPropertyValue:k=>this.values.get(k)||'',setProperty:(k,v)=>this.values.set(k,v),removeProperty:k=>this.values.delete(k)}}
  createDiv(){return this.createEl('div')}createSpan(){return this.createEl('span')}createEl(tag){const child=new El();child.tag=tag;this.append(child);return child}
  append(child){child.parentElement?.children.splice(child.parentElement.children.indexOf(child),1);this.children.push(child);child.parentElement=this}
  setAttribute(){}addEventListener(){}focus(){}select(){}remove(){}
  getBoundingClientRect(){return {top:0,bottom:30,height:30}}
  querySelectorAll(tag){return this.children.filter(child=>child.tag===tag)}
  querySelector(selector){return selector==='[data-wysimark-find-slot]'?e.slot:selector==='[data-wysimark-toolbar]'?e.toolbar:null}
 }
 doc.head=new El();e.host=new El();e.slot=new El();e.toolbar=new El();e.flush=()=>{for(const [id,fn]of [...e.frames]){e.frames.delete(id);fn()}};
 e.bar=new loaded.exports.FindBar(e.host,()=>e.editor,()=>false);e.bar.open();e.flush();return e;
}
test('navigating results only updates the active highlight',()=>{
 const e=fixture(),conversions=e.conversions;for(let i=0;i<10;i++)e.bar.navigate(1);assert.equal(e.searches,1);assert.equal(e.conversions-conversions,10);e.bar.destroy();
});
test('unchanged refreshes reuse search results, document edits invalidate them',()=>{
 const e=fixture();for(let i=0;i<10;i++){e.bar.refresh();e.flush()}assert.equal(e.searches,1);
 e.editor.children=[{}];e.bar.refresh();e.flush();assert.equal(e.searches,2);e.bar.close();e.bar.open();e.flush();assert.equal(e.searches,3);e.bar.destroy();
});
test('reattaching releases the old toolbar and destroy cancels owner-window work',()=>{
 const e=fixture(),old=e.toolbar;e.toolbar={getBoundingClientRect:()=>({height:40})};e.bar.attach();assert(e.unobserved.includes(old));assert(!e.observed.has(old));
 e.bar.refresh();assert.equal(e.frames.size,1);e.bar.destroy();assert.equal(e.frames.size,0);assert.equal(e.observed.size,0);assert.equal(e.host.ownerDocument.defaultView.CSS.highlights.size,0);
});
