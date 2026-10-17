import type { RenderChunkProps } from 'slate-react'
/** Slate owns the node/selection mapping; these wrappers only limit painting. */
export function renderEditorChunk({attributes,children,lowest}:RenderChunkProps) {
 return <div {...attributes} className={lowest?'ks-editor-chunk ks-editor-chunk-leaf':'ks-editor-chunk'}>{children}</div>
}
