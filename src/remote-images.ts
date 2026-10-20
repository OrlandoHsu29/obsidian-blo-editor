import { App, Notice, requestUrl } from 'obsidian'
import { Editor, Element, Node, Path, PathRef, Transforms } from 'slate'
import { HistoryEditor } from 'slate-history'
import type { OnImageSaveHandler } from './wysimark/entry'
import { ui } from './wysimark/utils/translations'

const remote = (value: string) => /^https?:\/\//i.test(value)
const imageNode = (node: Node) => Element.isElement(node) && (node.type === 'image-block' || node.type === 'image-inline') && remote(node.url)

/** Localize imported/pasted image nodes, never literal code or arbitrary note text. */
export function watchRemoteImages(app: App, sourcePath: string, editor: Editor,
  createSaver: () => OnImageSaveHandler, current: () => boolean): () => void {
  type Job = { url: string; refs: PathRef[]; local?: string; queued: boolean; failed?: boolean }
  const jobs = new Map<string, Job>(), queue: Job[] = []
  let active = 0, disposed = false, warned = false
  const valid = (ref: PathRef, url: string) => {
    if (!current() || disposed || editor.wysimark.readOnly || !ref.current || !Node.has(editor, ref.current)) return false
    const node = Node.get(editor, ref.current)
    return Element.isElement(node) && (node.type === 'image-block' || node.type === 'image-inline') && node.url === url
  }
  const process = async (job: Job) => {
    try {
      if (!job.refs.some(ref => valid(ref, job.url))) return
      const save = createSaver()
      if (job.local && !app.metadataCache.getFirstLinkpathDest(decodeURI(job.local), sourcePath)) job.local = undefined
      if (!job.local) {
        const url = new URL(job.url)
        const response = await requestUrl({ url: url.href, throw: false,
          headers: /(?:^|\.)nlark\.com$/i.test(url.hostname) ? { Referer: 'https://www.yuque.com/' } : undefined })
        if (response.status < 200 || response.status >= 300 || !response.arrayBuffer.byteLength) throw new Error('Image request failed')
        const type = Object.entries(response.headers).find(([key]) => key.toLowerCase() === 'content-type')?.[1].split(';')[0].trim().toLowerCase() ?? ''
        const bytes = new Uint8Array(response.arrayBuffer)
        const inferred = bytes[0]===137&&bytes[1]===80?'image/png':bytes[0]===255&&bytes[1]===216?'image/jpeg':
          String.fromCharCode(...bytes.slice(0,3))==='GIF'?'image/gif':String.fromCharCode(...bytes.slice(8,12))==='WEBP'?'image/webp':''
        const mime = type.startsWith('image/') ? type : inferred
        if (!mime) throw new Error('Response is not an image')
        let name = decodeURIComponent(url.pathname.split('/').pop() || 'image')
        const extension = ({'image/png':'png','image/jpeg':'jpg','image/gif':'gif','image/webp':'webp','image/svg+xml':'svg','image/avif':'avif','image/bmp':'bmp'} as Record<string,string>)[mime]
        if (!/\.(?:png|jpe?g|gif|webp|svg|avif|bmp)$/i.test(name) && extension) name += '.' + extension
        if (!job.refs.some(ref => valid(ref, job.url))) return
        job.local = await save(new File([response.arrayBuffer], name, { type: mime }), name)
      }
      const update = () => Editor.withoutNormalizing(editor, () => {
        for (const ref of job.refs) if (valid(ref, job.url)) Transforms.setNodes(editor, { url: job.local }, { at: ref.current! })
      })
      // Download completion is maintenance, not an extra user undo step.
      if (HistoryEditor.isHistoryEditor(editor)) HistoryEditor.withoutSaving(editor, update)
      else update()
    } catch {
      job.failed = true
      if (!disposed && current() && !warned) { warned = true; new Notice(ui('网络图片下载失败，已保留原链接')) }
    } finally { for (const ref of job.refs) ref.unref(); job.refs = []; job.queued = false }
  }
  const pump = () => {
    while (!disposed && active < 2 && queue.length) {
      const job = queue.shift()!; active++
      void process(job).finally(() => { active--; pump() })
    }
  }
  const enqueue = (at: Path = []) => {
    if (disposed || !current() || editor.wysimark.readOnly || !Node.has(editor, at)) return
    for (const [node, path] of Editor.nodes(editor, { at, match: imageNode })) {
      if (!Element.isElement(node) || !('url' in node)) continue
      let job = jobs.get(node.url)
      if (!job) { job = { url: node.url, refs: [], queued: false }; jobs.set(node.url, job) }
      if (job.failed) continue
      job.refs.push(Editor.pathRef(editor, path))
      if (!job.queued) { job.queued = true; queue.push(job) }
    }
    queueMicrotask(pump)
  }
  const apply = editor.apply
  const wrapped: Editor['apply'] = operation => {
    apply(operation)
    if (operation.type === 'insert_node' || operation.type === 'set_node' && 'url' in operation.newProperties) enqueue(operation.path)
  }
  editor.apply = wrapped
  const activated = app.workspace.on('active-leaf-change', () => enqueue())
  queueMicrotask(() => enqueue())
  return () => {
    disposed = true
    app.workspace.offref(activated)
    if (editor.apply === wrapped) editor.apply = apply
    for (const job of jobs.values()) { for (const ref of job.refs) ref.unref(); job.refs = [] }
    jobs.clear(); queue.length = 0
  }
}
