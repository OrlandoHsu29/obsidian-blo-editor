import { App, Platform, TFile, WorkspaceLeaf, WorkspaceWindow } from 'obsidian'

/**
 * Flash Memo hosts the quick memo panel: a small popout window that keeps one
 * note (or drawing) and shows its own name bar. Blo only reads the public
 * pieces it needs -- the plugin id and the body class that marks the window.
 */
export const MEMO_PANEL_PLUGIN_ID = 'flash-memo'
const MEMO_PANEL_BODY_CLASS = 'flash-memo-window'
const MEMO_PANEL_COMMAND_ID = `${MEMO_PANEL_PLUGIN_ID}:toggle`

type MemoPanelPlugin = {
  toggle?: () => Promise<void>
}

function memoPanelPlugin(app: App): MemoPanelPlugin | undefined {
  const registry = (app as App & { plugins?: { plugins?: Record<string, unknown> } }).plugins?.plugins
  return registry?.[MEMO_PANEL_PLUGIN_ID] as MemoPanelPlugin | undefined
}

export function memoPanelEnabled(app: App): boolean {
  return Platform.isDesktop && !!memoPanelPlugin(app)
}

export type MemoPanelStatus = 'unsupported' | 'missing' | 'disabled' | 'enabled'

export function memoPanelStatus(app: App): MemoPanelStatus {
  if (!Platform.isDesktop) return 'unsupported'
  if (memoPanelEnabled(app)) return 'enabled'
  const manager = (app as App & { plugins?: { manifests?: Record<string, unknown> } }).plugins
  return manager?.manifests?.[MEMO_PANEL_PLUGIN_ID] ? 'disabled' : 'missing'
}

/** The document of a desktop popout window, or null for main-window leaves. */
export function popoutDocument(leaf: WorkspaceLeaf): Document | null {
  const container = leaf.getContainer()
  return container instanceof WorkspaceWindow ? container.doc : null
}

/** True while a document is the quick memo popout. */
export function isMemoPanelDocument(doc: Document): boolean {
  return !!doc.body?.classList.contains(MEMO_PANEL_BODY_CLASS)
}

/**
 * Only the host's explicit window marker identifies a memo panel. Opening the
 * same file in another popout must not give that window memo-panel behavior.
 */
export function isMemoPanelLeaf(_app: App, leaf: WorkspaceLeaf, _file?: TFile | null): boolean {
  const doc = popoutDocument(leaf)
  return !!doc && isMemoPanelDocument(doc)
}

/** Open or hide the quick memo panel without depending on its internal state. */
export async function toggleMemoPanel(app: App): Promise<boolean> {
  const commands = (app as App & { commands?: { executeCommandById(id: string): boolean } }).commands
  try { if (commands?.executeCommandById?.(MEMO_PANEL_COMMAND_ID)) return true } catch { /* Use the plugin instance below. */ }
  const plugin = memoPanelPlugin(app)
  if (!plugin?.toggle) return false
  await plugin.toggle()
  return true
}
