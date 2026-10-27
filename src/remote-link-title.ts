import { requestUrl } from 'obsidian'

/** Fetch a webpage title for an explicitly inserted link; failures use the URL. */
export async function fetchLinkTitle(value: string, doc: Document): Promise<string | undefined> {
  let url: URL
  try { url = new URL(value) } catch { return }
  if (!/^https?:$/.test(url.protocol)) return
  const win = doc.defaultView
  if (!win) return
  let timer: number | undefined
  try {
    const response = await Promise.race([
      requestUrl({ url: url.href, throw: false }),
      new Promise<undefined>(resolve => { timer = win.setTimeout(() => resolve(undefined), 6000) }),
    ])
    if (!response || response.status < 200 || response.status >= 300) return
    const contentType = Object.entries(response.headers).find(([key]) => key.toLowerCase() === 'content-type')?.[1] ?? ''
    if (contentType && !/\b(?:text\/html|application\/xhtml\+xml)\b/i.test(contentType)) return
    const page = new win.DOMParser().parseFromString(response.text, 'text/html')
    return page.querySelector('title')?.textContent?.replace(/\s+/g, ' ').trim() || undefined
  } catch { return }
  finally { if (timer !== undefined) win.clearTimeout(timer) }
}
