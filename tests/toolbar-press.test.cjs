const {test}=require('node:test'),assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module');
let active;
const hooks={useCallback:fn=>fn,useRef:value=>active.refs[active.index++]??(active.refs[active.index-1]={current:value})};
const m=new Module('toolbar-press.cjs');
m.require=id=>id==='react'?hooks:id==='slate-react'?{useSlate:()=>active.editor,useSlateStatic:()=>active.editor}:
 id==='../../../shared-overlays'?{formatHotkey:x=>x,Menu:()=>null}:
 id==='../../../shared-overlays/menu-action'?{runMenuAction:(item,editor)=>item.action(editor)}:
 id==='../../../use-layer'?{useLayer:()=>({layer:active.layer,open:Component=>{active.opens++;active.layer={Component}},close:()=>{active.closes++;active.layer=null}})}:
 id==='../../../use-tooltip'?{tooltipLabel:()=>''}:id==='../../../utils/translations'?{r:()=>undefined}:
 id==='../../styles'?{$ToolbarButton:'div'}:require(id);
m._compile(buildSync({entryPoints:['src/wysimark/toolbar-plugin/components/toolbar/toolbar-button.tsx'],bundle:true,platform:'node',format:'cjs',jsx:'automatic',external:['react','react/*','clsx','slate-react','../../../shared-overlays','../../../shared-overlays/menu-action','../../../use-layer','../../../use-tooltip','../../../utils/translations','../../styles'],write:false}).outputFiles[0].text,'toolbar-press.cjs');
function fixture(extra={},props={}){
 const e={refs:[],index:0,editor:{wysimark:{}},layer:null,opens:0,closes:0,actions:0};active=e;
 const item={title:'Tool',icon:()=>null,children:[],...extra};
 e.render=()=>{active=e;e.index=0;const node=m.exports.ToolbarButton({item,...props});node.props.ref.current={};return node.props};
 e.down=()=>e.render().onMouseDown({button:0,preventDefault(){}});
 e.click=detail=>e.render().onClick({detail});return e;
}
test('expandable tools open on press, do not repeat on release, and retain the same menu on repeated presses',()=>{
 for(const props of [{},{menuToggle:true},{inOverflow:true}]){
  const e=fixture({},props);e.down();assert.equal(e.opens,1);const panel=e.layer.Component;
  e.click(1);e.down();e.click(2);assert.equal(e.opens,1);assert.equal(e.closes,0);assert.equal(e.layer.Component,panel);
 }
});
test('color-style actions run once per press while their palette stays mounted',()=>{
 const e=fixture({action:()=>e.actions++});e.down();e.click(1);assert.equal(e.actions,1);
 const panel=e.layer.Component;e.down();e.click(2);assert.equal(e.actions,2);assert.equal(e.opens,1);assert.equal(e.layer.Component,panel);
});
test('ordinary tools keep click behavior; disabled tools do nothing and programmatic activation remains available',()=>{
 const plain=fixture({children:undefined,action:()=>plain.actions++});plain.down();assert.equal(plain.actions,0);plain.click(1);assert.equal(plain.actions,1);
 const disabled=fixture({disabled:()=>true});disabled.down();disabled.click(0);assert.equal(disabled.opens,0);
 const programmatic=fixture();programmatic.click(0);assert.equal(programmatic.opens,1);
});
