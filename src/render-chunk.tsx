import type { RenderChunkProps } from 'slate-react'
import { useLayoutEffect, useRef } from 'react'
import { observeChunkVisibility } from './chunk-visibility'

/** Slate owns the node/selection mapping; these wrappers only limit painting. */
export function renderEditorChunk({attributes,children,lowest}:RenderChunkProps) {
 return <EditorChunk attributes={attributes} lowest={lowest}>{children}</EditorChunk>
}

function EditorChunk({attributes,children,lowest}:Pick<RenderChunkProps,'attributes'|'children'|'lowest'>) {
 const ref=useRef<HTMLDivElement>(null)
 useLayoutEffect(()=>{if(lowest&&ref.current)return observeChunkVisibility(ref.current)},[lowest])
 return <div {...attributes} ref={ref} className={lowest?'ks-editor-chunk ks-editor-chunk-leaf':'ks-editor-chunk'}>{children}</div>
}
