const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const {buildSync} = require('esbuild');

class FileSystemAdapter {
  files = new Map();
  folders = new Set();
  writes = 0;
  getBasePath() { return 'D:/My Vault'; }
  async exists(file) { return this.files.has(file) || this.folders.has(file); }
  async mkdir(folder) { this.folders.add(folder); }
  async read(file) { return this.files.get(file); }
  async write(file, content) { this.files.set(file, content); this.writes++; }
}
class TFile { constructor(path) { this.path=path; } }
let language = 'zh';
const loaded = new Module('ai-skill.cjs');
loaded.require = id => id === 'obsidian' ? {
  FileSystemAdapter, TFile, normalizePath: p => p.replace(/\\/g, '/'), getLanguage: () => language,
} : require(id);
loaded._compile(buildSync({stdin:{contents:"export * from './src/ai-skill'; export * from './src/ai-directory-rules'; export {parse,serialize} from './src/wysimark/convert'",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',loader:{'.md':'text'},external:['obsidian','slate','slate-history'],write:false}).outputFiles[0].text, 'ai-skill.cjs');
const {AI_SKILL_FILES, aiSkillDirectory, aiSkillInstallPrompt, writeAiSkill, directoryRulesPath, directoryRulesBody, mergeDirectoryRules, writeDirectoryRules, parse, serialize} = loaded.exports;
const manifest = {id:'blo-editor',version:'0.1.30',dir:'custom-config/plugins/blo-editor'};

test('standard plugin install materializes a complete skill and repairs missing or outdated resources',async()=>{
  const adapter = new FileSystemAdapter(), app = {vault:{adapter,configDir:'custom-config'}};
  await writeAiSkill(app,manifest);
  const root = aiSkillDirectory(app,manifest);
  assert.equal(root,'custom-config/plugins/blo-editor/skills/blo-editor-notes');
  assert.equal(adapter.files.size,5);
  const writes=adapter.writes;
  await writeAiSkill(app,manifest);
  assert.equal(adapter.writes,writes,'unchanged resources must not be rewritten');
  adapter.files.set(`${root}/references/format.md`,'old');
  adapter.files.delete(`${root}/assets/example.excalidraw.md`);
  adapter.files.set(`${root}/personal.md`,'keep');
  await writeAiSkill(app,manifest);
  assert.equal(adapter.writes,writes+2);
  assert.equal(adapter.files.get(`${root}/personal.md`),'keep');
  for(const [file,content] of Object.entries(AI_SKILL_FILES)) {
    assert.equal(adapter.files.get(`${root}/${file}`),content);
    for(const match of content.matchAll(/\]\(([^)]+\.md)\)/g)) {
      assert(adapter.files.has(path.posix.normalize(`${root}/${path.posix.dirname(file)}/${match[1]}`)),`${file}: missing ${match[1]}`);
    }
  }
});

test('installation prompt uses the actual vault and plugin path in both languages',()=>{
  const app={vault:{adapter:new FileSystemAdapter(),configDir:'custom-config'}};
  for(const lang of ['zh','en']) {
    language=lang;
    const prompt=aiSkillInstallPrompt(app,manifest);
    assert(prompt.includes('D:/My Vault/custom-config/plugins/blo-editor/skills/blo-editor-notes'));
    assert(prompt.includes(manifest.version));
    assert(!prompt.includes('{path}'));
    assert(prompt.includes('references')&&prompt.includes('assets'));
  }
  assert.equal(aiSkillDirectory(app,{id:'blo-editor'}),'custom-config/plugins/blo-editor/skills/blo-editor-notes');
});

test('resource write failure is surfaced to callers without changing unrelated files',async()=>{
  const adapter=new FileSystemAdapter();adapter.write=async()=>{throw new Error('read-only');};
  await assert.rejects(writeAiSkill({vault:{adapter,configDir:'.obsidian'}},manifest),/read-only/);
});

test('Windows vault paths remain readable and come from the current installation',()=>{
  const adapter = new FileSystemAdapter();
  adapter.getBasePath = () => 'F:\\Another Vault\\';
  const app = {vault:{adapter,configDir:'.custom'}};
  const prompt = aiSkillInstallPrompt(app,{id:'blo-editor',version:'1.0.0',dir:'.custom/plugins/blo-editor'});
  assert(prompt.includes('F:/Another Vault/.custom/plugins/blo-editor/skills/blo-editor-notes'));
  assert(!prompt.includes('D:/My Vault'));
  assert(!prompt.includes('\\\\'));
});

test('bundled note preserves block structure, folding, styles, table, formula and drawing through the real codec',()=>{
  const source=AI_SKILL_FILES['assets/example-note.md'];
  const nodes=parse(source), restored=parse(serialize(nodes));
  for(const result of [nodes,restored]) {
    assert.equal(result.length,11);
    assert.equal(result[1].children[0].type,'heading');
    assert.equal(result[1].children[0].__headingList.style,'number');
    assert.equal(result[2].__collapsed,true);
    for(const index of [3,4,5,6]) assert.equal(result[index].__blockDepth,1);
    assert.equal(result[5].type,'table');
    assert.equal(result[5].headerRow,true);assert.equal(result[5].headerColumn,true);
    assert.equal(result[7].type,'heading');assert.equal(result[7].level,5);assert.equal(result[7].__blockDepth,0);
    assert.equal(result[8].type,'image-block');assert(result[8].url.includes('example.excalidraw.md'));
    assert.equal(result[9].type,'task-list-item');assert.equal(result[9].checked,false);
    assert(result[10].children.some(child=>child.type==='math-inline'&&child.latex==='E=mc^2'));
    assert(result[3].children.some(child=>child.bold&&child.inlineStyle?.includes('#1677FF')));
  }
});

test('bundled skill has valid discovery fields and a complete editable drawing scene',()=>{
  const source=AI_SKILL_FILES['SKILL.md'];
  assert.match(source,/^---\r?\nname: blo-editor-notes\r?\ndescription: [^\r\n]+\r?\n---/);
  const file=AI_SKILL_FILES['assets/example.excalidraw.md'];
  const scene=JSON.parse(file.match(/```json\s+([\s\S]*?)```/)[1]);
  assert.match(file,/excalidraw-plugin: parsed/);
  assert.equal(scene.type,'excalidraw');assert.equal(scene.version,2);
  assert.equal(new Set(scene.elements.map(el=>el.id)).size,scene.elements.length);
  for(const type of ['rectangle','arrow','text']) assert(scene.elements.some(el=>el.type===type));
  assert.deepEqual(scene.files,{});
  assert(fs.existsSync('skills/blo-editor-notes/assets/example.excalidraw.md'));
});

test('directory rules preserve personal instructions, line endings and repeated generation',()=>{
  const source='# Personal rules\r\n\r\nKeep my links.\r\n';
  const generated=mergeDirectoryRules(source,'## Blo\nRead Skill.');
  assert(generated.startsWith(source));
  assert(!/(?<!\r)\n/.test(generated));
  assert.equal(mergeDirectoryRules(generated,'## Blo\nRead Skill.'),generated);
  const withUserTail=generated+'\r\n## More rules\r\nUse Chinese.\r\n';
  const updated=mergeDirectoryRules(withUserTail,'## Blo updated');
  assert(updated.startsWith(source));
  assert(updated.endsWith('\r\n## More rules\r\nUse Chinese.\r\n'));
  assert(!updated.includes('Read Skill.'));
});

test('broken or ambiguous managed sections cannot overwrite a user instruction file',()=>{
  const start='<!-- blo-editor:notes-rules:start -->',end='<!-- blo-editor:notes-rules:end -->';
  for(const source of [start,end,end+start,start+end+start+end]) {
    assert.throws(()=>mergeDirectoryRules(source,'new rules'),/Conflicting/);
  }
});

test('rules target the configured scope with a portable relative link to the complete local Skill',()=>{
  const app={vault:{configDir:'.custom'}};
  assert.equal(directoryRulesPath(''),'AGENTS.md');
  assert.equal(directoryRulesPath('Notes\\Projects'),'Notes/Projects/AGENTS.md');
  for(const folder of ['../outside','Notes/../outside','C:/Vault','/root','Notes\nOther']) {
    assert.throws(()=>directoryRulesPath(folder),/Invalid/);
  }
  for(const lang of ['zh','en']) {
    language=lang;
    const body=directoryRulesBody(app,manifest,'Notes/Projects');
    assert(body.includes('<../../custom-config/plugins/blo-editor/skills/blo-editor-notes/SKILL.md>'));
    assert(body.includes('blo-editor-notes'));
    assert(!body.includes('E:/PERSONAL'));
  }
});

test('manual generation writes only the selected rules file and merges against latest content',async()=>{
  const adapter=new FileSystemAdapter(), files=new Map();adapter.folders.add('Notes');
  const vault={adapter,configDir:'.custom',getAbstractFileByPath:p=>files.get(p),
    create:async(p,text)=>{assert(!adapter.files.has(p));const file=new TFile(p);files.set(p,file);adapter.files.set(p,text);return file;},
    process:async(file,fn)=>{adapter.files.set(file.path,fn(adapter.files.get(file.path)));},
  };
  const app={vault};
  assert.equal(adapter.files.size,0,'loading code alone must not generate rules');
  assert.equal(await writeDirectoryRules(app,manifest,'Notes'),'Notes/AGENTS.md');
  assert.equal(adapter.files.size,1);
  const generated=adapter.files.get('Notes/AGENTS.md');
  adapter.files.set('Notes/AGENTS.md','# My conventions\n\n'+generated+'\nPersonal footer.\n');
  await writeDirectoryRules(app,manifest,'Notes');
  const updated=adapter.files.get('Notes/AGENTS.md');
  assert(updated.startsWith('# My conventions\n\n'));
  assert(updated.endsWith('\nPersonal footer.\n'));
  assert.equal(updated.split('<!-- blo-editor:notes-rules:start -->').length,2);
  await assert.rejects(writeDirectoryRules(app,manifest,'Missing'),/does not exist/);
  assert(!adapter.files.has('AGENTS.md'));
});
