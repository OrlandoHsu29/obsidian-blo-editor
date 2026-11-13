import { useEffect, useRef, useState } from 'react'
import { App, Component, MarkdownRenderer } from 'obsidian'
import { ui } from './wysimark/utils/translations'

export function MermaidPreview({ app, sourcePath, code }: { app: App; sourcePath: string; code: string }) {
  const previewRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const previewEl = previewRef.current
    if (!previewEl) return
    let cancelled = false
    const component = new Component()
    component.load()
    // Each render owns a separate target. A late result from an earlier code
    // revision must not clear or append to the current diagram.
    const target = previewEl.createDiv()
    setLoading(true)
    void MarkdownRenderer.render(app, `\`\`\`mermaid\n${code}\n\`\`\``, target, sourcePath, component).then(() => {
      if (!cancelled) setLoading(false)
    }).catch((error: unknown) => {
      if (cancelled) return
      target.setText(error instanceof Error ? error.message : ui('Invalid Mermaid diagram'))
      target.setAttribute('role', 'alert')
      setLoading(false)
    })
    return () => {
      cancelled = true
      component.unload()
      target.remove()
    }
  }, [app, code, sourcePath])

  return <div className="wysimark-mermaid-preview">
    {loading && <div role="status">{ui('Rendering diagram...')}</div>}
    <div ref={previewRef} />
  </div>
}
