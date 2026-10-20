/** Decode presentation-only HTML images without importing arbitrary layout or HTML. */
export function htmlImages(value: string): { url: string; alt: string; title?: string; width?: number; height?: number }[] | undefined {
  if (!/<img\b/i.test(value)) return
  const body = new DOMParser().parseFromString(value, 'text/html').body
  if (body.textContent?.trim() || body.querySelector(':not(img):not(p):not(div):not(a):not(figure)')) return
  const images = Array.from(body.querySelectorAll('img'))
  if (!images.length || images.some(image => !image.getAttribute('src')?.trim())) return
  return images.map(image => {
    const dimension = (name: string) => {
      const raw = image.getAttribute(name)?.trim() ?? ''
      if (!/^\d+(?:\.\d+)?(?:px)?$/i.test(raw)) return undefined
      const value = parseFloat(raw)
      return value > 0 && Number.isFinite(value) ? value : undefined
    }
    return { url: image.getAttribute('src')!.trim(), alt: image.getAttribute('alt') ?? '',
      title: image.getAttribute('title') || undefined, width: dimension('width'), height: dimension('height') }
  })
}
