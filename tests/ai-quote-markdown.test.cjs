const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const Module = require('node:module');
const { Editor, createEditor } = require('slate');

const loaded = new Module('ai-quote-markdown.cjs', module);
let clipboardText = '';
const notices = [];
loaded.require = name => {
  if (name === 'obsidian') return {
    getLanguage: () => 'en',
    htmlToMarkdown: html => html,
    Notice: class { constructor(message) { notices.push(message); } },
  };
  if (name === 'electron') return { clipboard: { writeText(text) { clipboardText = text; } } };
  if (name === 'slate-react') return { ReactEditor: { toSlateRange: (_editor, selection) => selection.range } };
  return require(name);
};
loaded._compile(buildSync({
  stdin: { contents: "export * from './src/ai-quote-markdown'; export { prepareAiQuote } from './src/ai-quote'; export { parse } from './src/wysimark/convert';", resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'cjs', external: ['obsidian', 'slate', 'slate-react', 'electron'], write: false,
}).outputFiles[0].text, 'ai-quote-markdown.cjs');
const { aiQuoteLocation, aiQuoteMarkdown, aiQuotePrompt, prepareAiQuote, parse } = loaded.exports;

test('an AI quote preserves the selected structure without Blo typography and metadata', () => {
  const fixture = parse([
    '# Heading',
    '',
    '<span style="color:red">**First**</span> [[Note|label]] and `value`',
    '',
    '- item',
    '  - child',
    '',
    '> quoted',
    '',
    '| A | B |',
    '| :---: | ---: |',
    '| one | two |',
    '',
    '![[chart.png|300x200]]',
    '',
    '```html',
    '<span style="color:red">code example</span>',
    '```',
  ].join('\n'));
  fixture[0].__blockId = 'fixture-id';
  fixture[0].__headingList = { style: 'number', enabled: true };
  fixture.find(node => node.type === 'table').headerColumn = true;
  const original = structuredClone(fixture);
  const output = aiQuoteMarkdown(fixture, () => '');
  assert.match(output, /^# Heading\n\nFirst \[label\]\(Note\) and `value`/);
  assert.match(output, /- item\n {4}- child\n\n> quoted/);
  assert.match(output, /\|A\|B\|\n\|---\|---\|\n\|one\|two\|/);
  assert.match(output, /!\[\]\(chart\.png\)/);
  assert.match(output, /```html\n<span style="color:red">code example<\/span>\n```/);
  assert.doesNotMatch(output, /wysimark|fixture-id|300x200|\*\*First\*\*/);
  assert.deepEqual(fixture, original);
});

test('the prompt gives an absolute source path and safely encloses nested Markdown fences', () => {
  const source = 'E:\\Vault folders\\Notes\\[reference].md';
  const markdown = '```md\n@selection\n```\n~~~~\nexample\n~~~~';
  const prompt = aiQuotePrompt(source, { firstBlock: 3, lastBlock: 4, heading: 'Details' }, markdown);
  assert(prompt.includes('`' + source + '`'));
  assert(prompt.includes('3–4'));
  assert(prompt.includes('`Details`'));
  assert(prompt.endsWith('~~~~~markdown\n' + markdown + '\n~~~~~\n\n'));
});

test('quote location resolves a backwards range and skips hidden editor spacers', () => {
  const editor = createEditor();
  editor.children = parse('# Details\n\nFirst\n\nSecond\n\nAfter');
  editor.children.splice(1, 0, { type: 'paragraph', __collapsible: true, children: [{ text: '' }] });
  const range = { anchor: Editor.start(editor, [4]), focus: { path: [2, 0], offset: 2 } };
  assert.deepEqual(aiQuoteLocation(editor, range), { firstBlock: 2, lastBlock: 3, heading: 'Details' });
});

test('the selection action writes only the chosen text, its location, and the absolute note path', () => {
  const editor = createEditor();
  editor.children = parse('# Details\n\nprefix **chosen** suffix\n\nOutside selection');
  const anchorNode = {}, focusNode = {};
  const selection = { anchorNode, focusNode, range: Editor.range(editor, [1, 1]) };
  const host = {
    contains: node => node === anchorNode || node === focusNode,
    ownerDocument: { getSelection: () => selection },
  };
  const adapter = { getFullPath: path => 'E:/Personal Vault/' + path };
  const copy = prepareAiQuote(editor, host, adapter, 'Notes/Draft.md');
  assert.equal(typeof copy, 'function');
  copy();
  assert.match(clipboardText, /E:\/Personal Vault\/Notes\/Draft\.md/);
  assert.match(clipboardText, /Quoted body blocks 2/);
  assert.match(clipboardText, /~~~markdown\nchosen\n~~~/);
  assert.doesNotMatch(clipboardText, /prefix|suffix|Outside selection/);
  assert.equal(notices.at(-1), 'AI quote copied');
});
