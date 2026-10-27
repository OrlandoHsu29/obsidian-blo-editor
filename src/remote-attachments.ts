import { requestUrl } from 'obsidian'

const extensions: Record<string, string> = {
  'image/png':'png', 'image/jpeg':'jpg', 'image/gif':'gif', 'image/webp':'webp', 'image/svg+xml':'svg', 'image/avif':'avif', 'image/bmp':'bmp',
  'application/pdf':'pdf', 'application/zip':'zip', 'text/plain':'txt', 'text/markdown':'md', 'text/html':'html',
  'audio/mpeg':'mp3', 'audio/wav':'wav', 'audio/ogg':'ogg', 'audio/mp4':'m4a', 'audio/flac':'flac',
  'video/mp4':'mp4', 'video/webm':'webm', 'video/quicktime':'mov',
}

/** Explicit URL imports download first, then use the same attachment saver as local files. */
export async function downloadAttachment(value: string): Promise<File> {
  const url = new URL(value.trim())
  if (!/^https?:$/.test(url.protocol)) throw new Error('Attachment URL must use HTTP or HTTPS')
  const response = await requestUrl({ url: url.href, throw: false,
    headers: /(?:^|\.)nlark\.com$/i.test(url.hostname) ? { Referer:'https://www.yuque.com/' } : undefined })
  if (response.status < 200 || response.status >= 300) throw new Error('Attachment download failed: ' + response.status)
  const header = (name: string) => Object.entries(response.headers).find(([key]) => key.toLowerCase() === name)?.[1] ?? ''
  const disposition = header('content-disposition')
  const encoded = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(disposition)?.[1]
  const plain = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/i.exec(disposition)
  let name = encoded || plain?.[1] || plain?.[2] || url.pathname.split('/').pop() || 'attachment'
  try { name = decodeURIComponent(name.trim()) } catch { /* Keep literal percent signs. */ }
  name = name.replace(/\\/g,'/').split('/').pop()?.trim() || 'attachment'
  let type = header('content-type').split(';')[0].trim().toLowerCase()
  const bytes = new Uint8Array(response.arrayBuffer)
  // Some file hosts return application/octet-stream even for images or PDFs.
  if (!type || type === 'application/octet-stream') {
    type = bytes[0]===137&&bytes[1]===80?'image/png':bytes[0]===255&&bytes[1]===216?'image/jpeg':
      String.fromCharCode(...bytes.slice(0,3))==='GIF'?'image/gif':String.fromCharCode(...bytes.slice(0,4))==='%PDF'?'application/pdf':
      String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'?'image/webp':type
  }
  if (!/\.[a-z\d]{1,12}$/i.test(name) && extensions[type]) name += '.' + extensions[type]
  return new File([response.arrayBuffer], name, { type })
}
