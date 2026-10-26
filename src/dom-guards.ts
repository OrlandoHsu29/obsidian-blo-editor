/**
 * Realm-safe DOM element check. Obsidian popout windows have their own
 * constructors, so `node instanceof HTMLElement` is false for their nodes.
 */
export function isDomElement(value: unknown): value is Element {
  return !!value && typeof value === "object" && (value as { nodeType?: number }).nodeType === 1
}
