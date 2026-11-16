const {test}=require('node:test'),assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module');
const m=new Module('markdown-import-strong.cjs');m.require=id=>id==='obsidian'?{getLanguage:()=> 'en'}:require(id);
m._compile(buildSync({stdin:{contents:"export {parse,serialize} from './src/wysimark/convert';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',external:['obsidian','slate','slate-history','slate-react','react','react-dom'],write:false}).outputFiles[0].text,'markdown-import-strong.cjs');
const {parse,serialize}=m.exports;

for(const source of ['+ `F`** (系列)**：代表通用型。','| 分类 | 代表 |\n| --- | --- |\n| **无线系列**<br/>** (Wireless)** | **集成无线通信**<font style="color:rgb(15, 17, 21);">。</font> |'])test('import repairs spaced parenthetical strong delimiters: '+source.slice(0,24),()=>{
 const nodes=parse(source),text=JSON.stringify(nodes);assert(!text.includes('**'));assert(text.includes('"bold":true'));const again=parse(serialize(nodes));assert(!JSON.stringify(again).includes('**'));
});
test('literal code and escaped parenthetical delimiters stay literal',()=>{
 for(const source of ['`** (Wireless)**`','```text\n** (Wireless)**\n```','\\*\\* (Wireless)\\*\\*'])assert(JSON.stringify(parse(source)).includes('** (Wireless)**'));
});

test('an escaped closing delimiter remains literal rather than becoming a strong wrapper',()=>{
 const nodes=JSON.stringify(parse('** (literal)\\**'));
 assert(!nodes.includes('"bold":true'));assert(nodes.includes('** (literal)**'));
});
