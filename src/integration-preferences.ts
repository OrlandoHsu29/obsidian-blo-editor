export type IntegrationFlags = { imageViewer: boolean; drawings: boolean }
const allEnabled: IntegrationFlags = { imageViewer: true, drawings: true }
export const getDefaultIntegrations = () => allEnabled
export const subscribeDefaultIntegrations = () => () => {}

/** Optional integrations update open views without replacing the Slate editor. */
export class IntegrationPreferences {
  private value: IntegrationFlags = { imageViewer: false, drawings: false }
  private listeners = new Set<() => void>()
  getSnapshot = () => this.value
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  set(value: IntegrationFlags) {
    if (value.imageViewer === this.value.imageViewer && value.drawings === this.value.drawings) return
    this.value = value; this.listeners.forEach(listener => listener())
  }
}
