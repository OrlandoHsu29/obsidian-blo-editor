const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const Module = require('node:module');
const { Editor, Node, Transforms, createEditor } = require('slate');
const { HistoryEditor, withHistory } = require('slate-history');

const loaded = new Module('text-drag.cjs', module);
loaded.require = require;
loaded._compile(buildSync({
  entryPoints: ['src/blocks/text-drag.ts'],
  bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
}).outputFiles[0].text, 'text-drag.cjs');
const { moveTextSelection } = loaded.exports;

const point = (block, offset) => ({ path: [block, 0], offset });
const body = editor => editor.children.map(Node.string);

test('a backwards rich-text move has its own undo and redo entry', () => {
  const editor = withHistory(createEditor());
  editor.children = [
    { type: 'paragraph', children: [{ text: 'alpha ' }, { text: 'bravo', bold: true }, { text: ' charlie' }] },
    { type: 'paragraph', children: [{ text: 'delta' }] },
  ];
  Transforms.insertText(editor, '!', { at: Editor.end(editor, [1]) });
  const edited = structuredClone(editor.children);
  const source = { anchor: { path: [0, 1], offset: 5 }, focus: { path: [0, 1], offset: 0 } };
  assert.equal(moveTextSelection(editor, source, point(1, 0)), true);
  assert.deepEqual(body(editor), ['alpha  charlie', 'bravodelta!']);
  assert.equal(editor.children[1].children[0].bold, true);
  HistoryEditor.undo(editor);
  assert.deepEqual(editor.children, edited);
  assert.deepEqual(editor.selection, source);
  HistoryEditor.redo(editor);
  assert.deepEqual(body(editor), ['alpha  charlie', 'bravodelta!']);
  HistoryEditor.undo(editor);
  HistoryEditor.undo(editor);
  assert.deepEqual(body(editor), ['alpha bravo charlie', 'delta']);
});

test('a drop on the original selection leaves the undo stack untouched', () => {
  const editor = withHistory(createEditor());
  editor.children = [{ type: 'paragraph', children: [{ text: 'alpha bravo' }] }];
  assert.equal(moveTextSelection(editor, { anchor: point(0, 0), focus: point(0, 5) }, point(0, 3)), false);
  assert.deepEqual(body(editor), ['alpha bravo']);
  assert.equal(editor.history.undos.length, 0);
});
