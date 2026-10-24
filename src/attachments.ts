import { App, TFolder, normalizePath } from 'obsidian'

export const DEFAULT_ATTACHMENT_FOLDER = '附件'

export function normalizeAttachmentFolder(value: string): string {
  const path = value.trim().replace(/\\/g, '/')
  if (/^(?:\/|[a-z]:)/i.test(path) || path.split('/').some(part => part === '..') || /[:*?"<>|]/.test(path)) {
    throw new Error('Attachment folder must be relative to the vault')
  }
  return path ? normalizePath(path).replace(/^\.\/?$|\/$/g, '') : ''
}

/** A root attachment folder owns root files, not every directory in the vault. */
export function isAttachmentPath(path: string, folder: string): boolean {
  let directory: string
  try { directory = normalizeAttachmentFolder(folder) }
  catch { return false }
  return directory ? path.startsWith(directory + '/') : !path.includes('/')
}

/** Both images and drawings use the same vault-relative folder and collision policy. */
export async function attachmentPath(app: App, folder: string, filename: string): Promise<string> {
  const directory = normalizeAttachmentFolder(folder)
  if (directory) {
    if (!app.vault.getAbstractFileByPath(directory)) {
      try { await app.vault.createFolder(directory) }
      catch (error) {
        if (!(app.vault.getAbstractFileByPath(directory) instanceof TFolder)) throw error
      }
    }
    if (!(app.vault.getAbstractFileByPath(directory) instanceof TFolder)) throw new Error('Attachment folder path is occupied by a file')
  }
  const safeName = filename.replace(/[\\/:*?"<>|]/g, '-')
  const match = /^(.*?)(\.excalidraw\.md|\.[^.]+)?$/.exec(safeName)!
  const base = `${directory ? directory + '/' : ''}${match[1]}`, extension = match[2] ?? ''
  let path = `${base}${extension}`, suffix = 1
  while (app.vault.getAbstractFileByPath(path)) path = `${base} ${suffix++}${extension}`
  return path
}
