const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const loaded=new Module('editor-hotkeys.cjs');loaded.require=id=>id==='obsidian'?{Platform:{isMacOS:false},getLanguage:()=> 'en'}:require(id);
loaded._compile(buildSync({entryPoints:['src/editor-hotkeys.ts'],bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history','slate-react','react','react-dom'],write:false}).outputFiles[0].text,'editor-hotkeys.cjs');
const {installEditorHotkeys,editorCommands,matchesHotkey}=loaded.exports;
const event=(key,options={})=>({key,code:'',ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,isComposing:false,preventDefault(){this.prevented=true},stopPropagation(){this.stopped=true},...options});
function fixture(){
 const custom=new Map(),defaults=new Map(),registered=new Map(),calls=[];let active;
 const manager={getHotkeys:id=>custom.get(id),getDefaultHotkeys:id=>defaults.get(id),printHotkeyForCommand:id=>{const k=(custom.get(id)??defaults.get(id)??[])[0];return k?[...k.modifiers,k.key].join('+'):''}};
 const plugin={manifest:{id:'blo-editor'},app:{hotkeyManager:manager,commands:{executeCommandById:id=>calls.push(id)}},addCommand(c){registered.set(c.id,c);defaults.set('blo-editor:'+c.id,c.hotkeys)}};
 for(const c of editorCommands())if(!c.run)defaults.set('blo-editor:'+c.id,c.hotkeys);
 const e={wysimark:{},marksPlugin:{toggleStrike:()=>calls.push('strike'),toggleBold:()=>calls.push('bold')},inlineCode:{toggleInlineCode:()=>calls.push('code')}};
 const commands=installEditorHotkeys(plugin,()=>active);
 return {commands,custom,registered,calls,e,setActive(value){active=value}};
}
test('formatting commands are registered under independent Blo IDs',()=>{
 const f=fixture();for(const id of ['toggle-bold','toggle-strikethrough','toggle-inline-code','toggle-task-list','insert-link','heading-5'])assert.ok(f.registered.has(id));assert.deepEqual(f.registered.get('toggle-strikethrough').hotkeys,[{key:'x',modifiers:['Mod','Shift']}]);
 f.setActive(undefined);assert.equal(f.registered.get('toggle-bold').checkCallback(true),false);
});
test('rebinding takes effect immediately and retires the original hardcoded shortcut',()=>{
 const f=fixture();f.custom.set('blo-editor:toggle-strikethrough',[{key:'F8',modifiers:[]}]);
 const old=event('X',{code:'KeyX',ctrlKey:true,shiftKey:true});assert.equal(f.commands.handle(f.e,old),true);assert.equal(old.prevented,true);assert.deepEqual(f.calls,[]);
 assert.equal(f.commands.handle(f.e,event('F8')),true);assert.deepEqual(f.calls,['strike']);
 f.custom.set('blo-editor:toggle-strikethrough',[{key:'y',modifiers:['Alt']}]);f.commands.handle(f.e,event('y',{altKey:true}));assert.deepEqual(f.calls,['strike','strike']);
});
test('removing a binding prevents fallback to Slate and upstream aliases',()=>{
 const f=fixture();f.custom.set('blo-editor:toggle-bold',[]);f.commands.handle(f.e,event('b',{ctrlKey:true}));assert.deepEqual(f.calls,[]);
 f.custom.set('blo-editor:toggle-inline-code',[]);f.commands.handle(f.e,event('e',{ctrlKey:true}));f.commands.handle(f.e,event('j',{ctrlKey:true}));assert.deepEqual(f.calls,[]);
});
test('existing command IDs use current custom bindings instead of hardcoded search keys',()=>{
 const f=fixture();f.custom.set('blo-editor:find-text',[{key:'F8',modifiers:[]}]);f.commands.handle(f.e,event('f',{ctrlKey:true}));assert.deepEqual(f.calls,[]);f.commands.handle(f.e,event('F8'));assert.deepEqual(f.calls,['blo-editor:find-text']);
});
test('labels reflect custom bindings and removal immediately',()=>{
 const f=fixture(),name=editorCommands().find(c=>c.id==='toggle-strikethrough').name;assert.equal(f.commands.label(name),'Mod+Shift+x');f.custom.set('blo-editor:toggle-strikethrough',[{key:'F8',modifiers:[]}]);assert.equal(f.commands.label(name),'F8');f.custom.set('blo-editor:toggle-strikethrough',[]);assert.equal(f.commands.label(name),undefined);assert.equal(f.commands.label('unknown','Tab'),'Tab');
});
test('read-only views and composition do not mutate text; unrelated shortcuts pass through',()=>{
 const f=fixture();f.e.wysimark.readOnly=true;f.commands.handle(f.e,event('x',{ctrlKey:true,shiftKey:true}));assert.deepEqual(f.calls,[]);
 assert.equal(f.commands.handle(f.e,event('b',{ctrlKey:true,isComposing:true})),false);assert.equal(f.commands.handle(f.e,event('c',{ctrlKey:true})),false);assert.equal(f.commands.handle(f.e,event('a',{ctrlKey:true})),false);
});
test('modifier matching supports shifted digits, Mac Cmd and exact modifiers',()=>{
 assert.equal(matchesHotkey(event('&',{code:'Digit7',ctrlKey:true,shiftKey:true}),{key:'7',modifiers:['Mod','Shift']},false),true);
 assert.equal(matchesHotkey(event('b',{metaKey:true}),{key:'b',modifiers:['Mod']},true),true);
 assert.equal(matchesHotkey(event('b',{metaKey:true,altKey:true}),{key:'b',modifiers:['Mod']},true),false);
});
test('tools without defaults can be assigned shortcuts and reuse toolbar actions',()=>{
 const f=fixture();assert.deepEqual(f.registered.get('insert-table').hotkeys,[]);f.e.wysimark.openToolbarTool=title=>f.calls.push(title);f.custom.set('blo-editor:insert-table',[{key:'F8',modifiers:[]}]);f.commands.handle(f.e,event('F8'));assert.deepEqual(f.calls,[editorCommands().find(c=>c.id==='insert-table').name]);
});
