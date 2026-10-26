import createCache, { EmotionCache } from '@emotion/cache'

/**
 * Emotion injects its styles into the document that owns each cache. The editor
 * therefore needs one cache per document, so a popout window such as Flash
 * Memo's quick memo panel gets the same layout styles instead of unstyled markup.
 */
export type EditorStyleCache = {
  /** Cache for the main window. */
  cache: EmotionCache
  forDocument(doc: Document): EmotionCache
}

/** One cache per plugin lifecycle, shared by all document views. */
export function createEditorStyleCache(): EditorStyleCache {
  const cache = createCache({ key: 'ks-editor' })
  // Weak keys keep a closed popout collectable; the main window stays cached.
  const caches = new WeakMap<Document, EmotionCache>([[document, cache]])
  const forDocument = (doc: Document): EmotionCache => {
    if (!doc || doc === document || !doc.head) return cache
    let scoped = caches.get(doc)
    if (!scoped) {
      scoped = createCache({ key: 'ks-editor', container: doc.head })
      caches.set(doc, scoped)
    }
    return scoped
  }
  return { cache, forDocument }
}
