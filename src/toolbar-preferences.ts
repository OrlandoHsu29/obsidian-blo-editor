/** Shared across open views; updating the toolbar never edits the document. */
const fixedButtons = new Set([
  'paragraph-style', 'clear-formatting', 'undo', 'redo', 'text-color', 'find-replace',
  'table', 'link', 'image',
]);
export const isFixedToolbarButton = (id: string) => fixedButtons.has(id);

export class ToolbarPreferences {
  private hidden: readonly string[] = [];
  private listeners = new Set<() => void>();
  getSnapshot = () => this.hidden;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  setHidden(ids: readonly string[]) {
    this.hidden = ids.filter(id => !isFixedToolbarButton(id));
    this.listeners.forEach(listener => listener());
  }
}
