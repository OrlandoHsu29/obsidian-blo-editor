import createCache from '@emotion/cache'
/** One cache per plugin lifecycle, shared by all document views. */
export function createEditorStyleCache(){return createCache({key:'ks-editor'})}
