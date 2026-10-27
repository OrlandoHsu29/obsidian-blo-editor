import { IMAGE_FILE_PATTERN, MEDIA_FILE_PATTERN } from './vault-media'
import { wikiEmbedUrl } from './wysimark/convert/obsidian-links'

/** Uploads and clipboard transfers use the same supported preview formats. */
export function attachmentPreviewUrl(file: Pick<File, 'name' | 'type'>, url: string): string | undefined {
  if (file.type.startsWith('image/') || IMAGE_FILE_PATTERN.test(file.name)) return url
  if (/^(?:audio|video)\//.test(file.type) || MEDIA_FILE_PATTERN.test(file.name)) {
    let target = url
    try { target = decodeURI(url) } catch { /* Keep literal percent signs. */ }
    return wikiEmbedUrl(target)
  }
}
