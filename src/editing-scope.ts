/** Vault-relative scope shared by file opening, restored views and settings. */
export function normalizeEditingFolder(value: string): string {
  return value.trim().replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^\/+|\/+$/g, '')
}
export function isPathInEditingScope(path: string, folder: string): boolean {
  const scope = normalizeEditingFolder(folder)
  return !scope || path.replace(/\\/g, '/').startsWith(scope + '/')
}