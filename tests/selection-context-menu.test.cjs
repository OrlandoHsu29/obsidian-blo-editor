const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const Module = require('node:module');

const subject = new Module('selection-context-menu.cjs', module);
subject.require = name => name === 'obsidian' ? { Platform: { isMacOS: false } } : require(name);
subject._compile(buildSync({
  entryPoints: ['src/selection-context-menu.ts'],
  bundle: true, platform: 'node', format: 'cjs', external: ['obsidian'], write: false,
}).outputFiles[0].text, 'selection-context-menu.cjs');
const { addSelectionContextAction } = subject.exports;

function fixture(trusted = true) {
  const listeners = new Map();
  let items, requested = false, stopped = false, quotes = 0;
  const window = {
    setTimeout: () => 1, clearTimeout() {},
    electron: {
      ipcRenderer: {
        on: (channel, listener) => listeners.set(channel, listener),
        removeListener: channel => listeners.delete(channel),
        send: () => { requested = true; },
      },
      remote: {
        getCurrentWindow() {},
        getCurrentWebContents: () => ({}),
        Menu: { buildFromTemplate: template => ({ popup() { items = template; } }) },
      },
    },
  };
  const host = { isConnected: true, ownerDocument: { defaultView: window, getSelection: () => 'excerpt' } };
  return {
    open: (editable, hotkeys) => addSelectionContextAction({ isTrusted: trusted, stopImmediatePropagation() { stopped = true; } },
      host, editable, { label: 'Copy as AI quote', hotkeys, run() { quotes++; } }),
    reply: details => listeners.get('context-menu')?.(null, details),
    get items() { return items; }, get requested() { return requested; },
    get stopped() { return stopped; }, get quotes() { return quotes; },
    listeners,
  };
}

test('native edit actions and the AI quote share one context menu', () => {
  const f = fixture();
  f.open(true);
  assert(f.stopped && f.requested);
  f.reply({ editFlags: { canCut: true, canCopy: true, canPaste: false } });
  assert.deepEqual(f.items.map(item => item.role ?? item.type ?? item.label),
    ['cut', 'copy', 'paste', 'pasteAndMatchStyle', 'separator', 'Copy as AI quote']);
  assert.equal(f.items[2].enabled, false);
  assert.equal(f.items.at(-1).accelerator, undefined);
  assert.equal(f.listeners.size, 0);
  f.items.at(-1).click();
  assert.equal(f.quotes, 1);
});

test('read-only and synthetic contexts preserve the applicable native behavior', () => {
  const f = fixture();
  f.open(false);
  f.reply({ editFlags: { canCopy: true } });
  assert.deepEqual(f.items.map(item => item.role).filter(Boolean), ['copy']);
  const synthetic = fixture(false);
  synthetic.open(true);
  assert.equal(synthetic.requested, false);
  assert.equal(synthetic.stopped, false);
});

test('the AI quote menu uses the native shortcut column without registering a second binding', () => {
  for (const [hotkeys, expected] of [
    [[{ key: 'C', modifiers: ['Mod', 'Shift'] }], 'CmdOrCtrl+Shift+C'],
    [[{ key: 'C', modifiers: ['Alt'] }], 'Alt+C'],
    [[{ key: 'ArrowRight', modifiers: ['Ctrl'] }], 'Ctrl+Right'],
    [[{ key: '+', modifiers: ['Ctrl'] }], 'Ctrl+Plus'],
    [[{ key: '中', modifiers: ['Alt'] }], undefined],
    [[], undefined],
  ]) {
    const f = fixture();
    f.open(true, hotkeys);
    f.reply({ editFlags: { canCopy: true } });
    assert.equal(f.items.at(-1).label, 'Copy as AI quote');
    assert.equal(f.items.at(-1).accelerator, expected);
    assert.equal(f.items.at(-1).registerAccelerator, false);
  }
});
