const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const Module = require('node:module');
const { createEditor, Editor, Node, Transforms } = require('slate');
const { withHistory } = require('slate-history');

const loaded = new Module('code-block-language.cjs');
loaded.require = id => id === 'obsidian' ? { getLanguage: () => 'en' } : require(id);
loaded._compile(buildSync({
  stdin: { contents: `
    import { CodeBlockPlugin } from './src/wysimark/code-block-plugin';
    import { createWithSink } from './src/wysimark/sink/editor';
    export const install = createWithSink([CodeBlockPlugin.fn]);
  `, resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'cjs', write: false,
  external: ['obsidian', 'slate', 'slate-history', 'slate-react', 'react', 'react-dom'],
}).outputFiles[0].text, 'code-block-language.cjs');

const paragraph = text => ({ type: 'paragraph', children: [{ text }] });
const code = language => ({ type: 'code-block', language,
  children: [{ type: 'code-block-line', children: [{ text: 'existing' }] }] });

function fixture(target = paragraph('')) {
  const editor = withHistory(createEditor());
  editor.wysimark = { readOnly: false };
  loaded.exports.install(editor, {});
  editor.children = [code('python'), target];
  return editor;
}

function newBlock(editor, selection = Editor.start(editor, [1])) {
  Transforms.select(editor, selection);
  editor.codeBlock.toggleCodeBlock();
  return [...Editor.nodes(editor, { at: [], match: node => node.type === 'code-block' })].at(-1)[0];
}

test('new sessions start with text even when a saved code block uses another language', () => {
  const first = fixture();
  assert.equal(first.codeBlock.setCodeBlockLanguage('javascript', { at: [0] }), true);
  assert.equal(newBlock(first).language, 'javascript');
  assert.equal(newBlock(fixture()).language, 'text');
});

for (const target of [paragraph(''), paragraph('selected'), { ...paragraph('item'), type: 'unordered-list-item', depth: 0 }]) {
  test(`a newly created code block remembers the language from ${target.type} ${Node.string(target)}`, () => {
    const editor = fixture(target);
    editor.codeBlock.setCodeBlockLanguage('rust', { at: [0] });
    const selection = Node.string(target) ? Editor.range(editor, [1]) : Editor.start(editor, [1]);
    const block = newBlock(editor, selection);
    assert.equal(block.language, 'rust');
    assert.equal(Node.string(block), Node.string(target));
  });
}

test('only a successful language change updates the default, including a change back to text', () => {
  const editor = fixture();
  editor.codeBlock.setCodeBlockLanguage('sql', { at: [0] });
  assert.equal(editor.codeBlock.setCodeBlockLanguage('go', { at: [1] }), false);
  const first = newBlock(editor);
  Transforms.insertNodes(editor, code('python'), { at: [2] });
  assert.equal(editor.codeBlock.setCodeBlockLanguage('python', { at: [2] }), false);
  Transforms.insertNodes(editor, paragraph(''), { at: [3] });
  assert.equal(newBlock(editor, Editor.start(editor, [3])).language, 'sql');
  assert.equal(editor.codeBlock.setCodeBlockLanguage('text', { at: [0] }), true);
  Transforms.insertNodes(editor, paragraph(''), { at: [4] });
  assert.equal(newBlock(editor, Editor.start(editor, [4])).language, 'text');
  assert.equal(first.language, 'sql');
});
