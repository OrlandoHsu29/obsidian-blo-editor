const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const Module=require('node:module');
const loaded=new Module('editor-hotkeys.cjs');loaded.require=id=>id==='obsidian'?{Platform:{isMacOS:false},getLanguage:()=> 'en'}:require(id);
loaded._compile(buildSync({entryPoints:['src/editor-hotkeys.ts'],bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history','slate-react','react','react-dom'],write:false}).outputFiles[0].text,'editor-hotkeys.cjs');
const {installEditorHotkeys,editorCommands,matchesHotkey}=loaded.exports;
const event=(key,options={})=>({key,code:'',ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,isComposing:false,preventDefault(){this.prevented=true},stopPropagation(){this.stopped=true},...options});
function fixture(missing=[],initial={},extensionCommands=[]){
 const custom=new Map(Object.entries(initial)),defaults=new Map(),registered=new Map(),calls=[],cleanups=[];let active,saves=0;
 const native=Object.fromEntries(editorCommands().filter(c=>c.nativeId&&!missing.includes(c.nativeId)).map(c=>[c.nativeId,{checkCallback:checking=>{if(!checking)calls.push(c.nativeId);return true}}]));
 for(const id of extensionCommands)native[id]={};
 const manifests=Object.fromEntries(extensionCommands.map(id=>[id.split(':')[0],{}]));
 defaults.set('editor:toggle-bold',[{key:'b',modifiers:['Mod']}]);
 defaults.set('editor:insert-link',[{key:'k',modifiers:['Mod']}]);
 defaults.set('editor:open-search',[{key:'f',modifiers:['Mod']}]);
 defaults.set('markdown:toggle-preview',[{key:'e',modifiers:['Mod']}]);
 const manager={getHotkeys:id=>custom.get(id),getDefaultHotkeys:id=>defaults.get(id),addDefaultHotkeys:(id,keys)=>defaults.set(id,keys),removeDefaultHotkeys:id=>defaults.delete(id),setHotkeys:(id,keys)=>custom.set(id,keys),save:async()=>{saves++},printHotkeyForCommand:id=>{const k=(custom.get(id)??defaults.get(id)??[])[0];return k?[...k.modifiers,k.key].join('+'):''}};
 const plugin={manifest:{id:'blo-editor'},app:{hotkeyManager:manager,plugins:{manifests},commands:{commands:native,executeCommandById:id=>calls.push(id)}},register:fn=>cleanups.push(fn),addCommand(c){registered.set(c.id,c);native['blo-editor:'+c.id]=c;defaults.set('blo-editor:'+c.id,c.hotkeys)}};
 for(const c of editorCommands())if(!c.run)defaults.set('blo-editor:'+c.id,c.hotkeys);
 const e={wysimark:{openSearch:replace=>calls.push(replace?'replace':'find'),openLink:()=>calls.push('link'),toggleReading:()=>calls.push('reading')},marksPlugin:{toggleStrike:()=>calls.push('strike'),toggleBold:()=>calls.push('bold'),toggleUnderline:()=>calls.push('underline')},inlineCode:{toggleInlineCode:()=>calls.push('code')},list:{convertTaskList:toggle=>calls.push(['task',toggle])}};
 const commands=installEditorHotkeys(plugin,()=>active);
 return {commands,custom,defaults,registered,calls,e,native,manager,get saves(){return saves},unload(){cleanups.forEach(fn=>fn())},setActive(value){active=value}};
}
test('only Blo-only commands register separate shortcuts when the native command exists',()=>{
 const f=fixture();for(const id of ['toggle-bold','toggle-strikethrough','toggle-inline-code','insert-link','heading-5'])assert.equal(f.registered.has(id),false);
 for(const id of ['toggle-task-list','undo','redo'])assert.ok(f.registered.has(id));
 assert.deepEqual(f.registered.get('toggle-underline').hotkeys,[{key:'u',modifiers:['Mod']}]);
 f.custom.set('blo-editor:toggle-underline',[{key:'F8',modifiers:[]}]);f.commands.handle(f.e,event('F8'));assert.deepEqual(f.calls,['underline']);
});
test('task-list formatting retains its own Ctrl+Shift+9 shortcut',()=>{
 const f=fixture();assert.deepEqual(f.registered.get('toggle-task-list').hotkeys,[{key:'9',modifiers:['Mod','Shift']}]);
 f.commands.handle(f.e,event('(',{code:'Digit9',ctrlKey:true,shiftKey:true}));assert.deepEqual(f.calls,[['task',true]]);
});
test('unclaimed legacy shortcuts become native defaults without overwriting native choices',()=>{
 const f=fixture([],{'blo-editor:toggle-strikethrough':[{key:'F6',modifiers:[]}],'editor:toggle-highlight':[]});
 assert.deepEqual(f.defaults.get('editor:toggle-strikethrough'),[{key:'F6',modifiers:[]}]);
 assert.equal(f.defaults.get('editor:toggle-highlight'),undefined);
 assert.equal(f.defaults.get('editor:toggle-code'),undefined,'Ctrl+E belongs to native reading mode');
 f.commands.handle(f.e,event('F6'));assert.deepEqual(f.calls,['strike']);
 f.unload();assert.equal(f.defaults.get('editor:toggle-strikethrough'),undefined);
 assert.deepEqual(f.defaults.get('markdown:toggle-preview'),[{key:'e',modifiers:['Mod']}]);
});
test('legacy keys can be retained after a different native binding frees their chord',()=>{
 const f=fixture([],{'markdown:toggle-preview':[{key:'p',modifiers:['Mod','Alt']}]});
 assert.deepEqual(f.defaults.get('editor:toggle-code'),[{key:'e',modifiers:['Mod']}]);
 f.commands.handle(f.e,event('e',{ctrlKey:true}));assert.deepEqual(f.calls,['code']);
});
test('migration moves active Blo keys to cleared native entries and respects existing native assignments',async()=>{
 const f=fixture([],{'editor:open-search':[],'editor:save-file':[],'blo-editor:save-note':[{key:'F7',modifiers:[]}],'editor:toggle-bold':[{key:'F9',modifiers:[]}]});
 assert.equal(await f.commands.migrateClearedNativeBindings(),true);
 assert.equal(f.saves,1);
 assert.deepEqual(f.custom.get('editor:open-search'),[{key:'f',modifiers:['Mod']}]);
 assert.deepEqual(f.custom.get('editor:save-file'),[{key:'F7',modifiers:[]}]);
 assert.deepEqual(f.custom.get('editor:toggle-bold'),[{key:'F9',modifiers:[]}]);
 f.custom.set('editor:open-search',[]);f.commands.handle(f.e,event('f',{ctrlKey:true}));assert.deepEqual(f.calls,[]);
});
test('a failed migration restores the previous native bindings',async()=>{
 const f=fixture([],{'editor:open-search':[]});f.manager.save=async()=>{throw Error('cannot write')};
 await assert.rejects(f.commands.migrateClearedNativeBindings(),/cannot write/);
 assert.deepEqual(f.custom.get('editor:open-search'),[]);
});
test('migration preserves the Blo save key when another editor plugin also uses it',async()=>{
 const id='drawing-plugin:save';
 const f=fixture([],{'editor:save-file':[],[id]:[{key:'s',modifiers:['Mod']}]},[id]);
 f.e.wysimark.save=()=>f.calls.push('save');
 await f.commands.migrateClearedNativeBindings();
 f.commands.handle(f.e,event('s',{ctrlKey:true}));
 assert.deepEqual(f.calls,['save']);
 assert.deepEqual(f.custom.get(id),[{key:'s',modifiers:['Mod']}]);
});
test('an older Obsidian without a shared command retains the Blo fallback',()=>{
 const f=fixture(['editor:toggle-highlight']);assert.ok(f.registered.has('toggle-highlight'));
});
test('native command callbacks preserve the native editor and detach on unload',()=>{
 const f=fixture(),entry=f.native['editor:insert-link'],wrapped=entry.checkCallback;
 entry.checkCallback(false);assert.deepEqual(f.calls,['editor:insert-link']);
 f.setActive(f.e);assert.equal(entry.checkCallback(true),true);
 f.e.wysimark.readOnly=true;assert.equal(entry.checkCallback(true),false);
 f.unload();assert.notEqual(entry.checkCallback,wrapped);assert.equal(entry.checkCallback(true),true);
});
test('rebinding takes effect immediately and retires the original hardcoded shortcut',()=>{
 const f=fixture();f.custom.set('editor:toggle-strikethrough',[{key:'F8',modifiers:[]}]);
 const old=event('X',{code:'KeyX',ctrlKey:true,shiftKey:true});assert.equal(f.commands.handle(f.e,old),true);assert.equal(old.prevented,true);assert.deepEqual(f.calls,[]);
 assert.equal(f.commands.handle(f.e,event('F8')),true);assert.deepEqual(f.calls,['strike']);
 f.custom.set('editor:toggle-strikethrough',[{key:'y',modifiers:['Alt']}]);f.commands.handle(f.e,event('y',{altKey:true}));assert.deepEqual(f.calls,['strike','strike']);
});
test('removing a binding prevents fallback to Slate and upstream aliases',()=>{
 const f=fixture();f.custom.set('editor:toggle-bold',[]);f.commands.handle(f.e,event('b',{ctrlKey:true}));assert.deepEqual(f.calls,[]);
 f.custom.set('editor:toggle-code',[]);f.commands.handle(f.e,event('e',{ctrlKey:true}));f.commands.handle(f.e,event('j',{ctrlKey:true}));assert.deepEqual(f.calls,['reading']);
});
test('find follows the native command and ignores stale Blo bindings',()=>{
 const f=fixture();f.custom.set('blo-editor:find-text',[{key:'F7',modifiers:[]}]);f.custom.set('editor:open-search',[{key:'F8',modifiers:[]}]);
 f.commands.handle(f.e,event('f',{ctrlKey:true}));assert.equal(f.commands.handle(f.e,event('F7')),false);assert.deepEqual(f.calls,[]);
 f.commands.handle(f.e,event('F8'));assert.deepEqual(f.calls,['find']);
});
test('labels reflect custom bindings and removal immediately',()=>{
 const f=fixture(),name=editorCommands().find(c=>c.id==='toggle-strikethrough').name;assert.equal(f.commands.label(name),'Mod+Shift+x');f.custom.set('editor:toggle-strikethrough',[{key:'F8',modifiers:[]}]);assert.equal(f.commands.label(name),'F8');f.custom.set('editor:toggle-strikethrough',[]);assert.equal(f.commands.label(name),undefined);assert.equal(f.commands.label('unknown','Tab'),'Tab');
});

test('find toolbar label follows the find command binding rather than a fixed fallback',()=>{
 const f=fixture(),title='Find / replace';assert.equal(f.commands.label(title,'Ctrl+F'),'Mod+f');
 f.custom.set('editor:open-search',[{key:'F8',modifiers:[]}]);assert.equal(f.commands.label(title,'Ctrl+F'),'F8');
 f.custom.set('editor:open-search',[]);assert.equal(f.commands.label(title,'Ctrl+F'),undefined);
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
 const f=fixture();assert.equal(f.registered.has('insert-table'),false);f.e.wysimark.openToolbarTool=title=>f.calls.push(title);f.custom.set('editor:insert-table',[{key:'F8',modifiers:[]}]);f.commands.handle(f.e,event('F8'));assert.deepEqual(f.calls,[editorCommands().find(c=>c.id==='insert-table').name]);
});
test('Ctrl+K opens the Blo link tool through the native binding and stops after it is unassigned',()=>{
 const f=fixture(),ctrlK=event('k',{ctrlKey:true});
 assert.equal(f.commands.handle(f.e,ctrlK),true);assert.deepEqual(f.calls,['link']);
 f.custom.set('editor:insert-link',[]);f.commands.handle(f.e,event('k',{ctrlKey:true}));assert.deepEqual(f.calls,['link']);
});
test('a retired shortcut assigned to an unrelated Obsidian command passes through',()=>{
 const f=fixture();f.native['other:command']={};f.custom.set('other:command',[{key:'x',modifiers:['Mod','Shift']}]);f.custom.set('editor:toggle-strikethrough',[]);
 assert.equal(f.commands.handle(f.e,event('X',{code:'KeyX',ctrlKey:true,shiftKey:true})),false);
});
