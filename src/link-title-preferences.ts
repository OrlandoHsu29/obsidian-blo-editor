/** Shared by link dialogs and paste handlers in all open editor views. */
export class LinkTitlePreferences {
  private enabled = true
  private listeners = new Set<() => void>()
  getSnapshot = () => this.enabled
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  setEnabled(enabled: boolean) {
    if (enabled === this.enabled) return
    this.enabled = enabled
    this.listeners.forEach(listener => listener())
  }
}
