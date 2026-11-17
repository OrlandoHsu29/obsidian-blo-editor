import { setIcon } from 'obsidian'
import { ui } from '../wysimark/utils/translations'
import { LaserTrail, laserOutline } from './laser-trail'
import { isDomElement } from '../dom-guards'
import { registerPresentationExit } from './navigation'
import { sliderToScale, scaleToSlider, snapToDefault, canResetZoom } from './zoom'

/** Fullscreen note surface with an ephemeral, viewport-local laser overlay. */
export class PresentationMode {
  private readonly doc: Document
  private readonly win: Window
  private readonly scroller: HTMLElement | null
  private readonly trail = new LaserTrail()
  private controls?: HTMLDivElement
  private canvas?: HTMLCanvasElement
  private dot?: HTMLDivElement
  private laserButton?: HTMLButtonElement
  private mouseButton?: HTMLButtonElement
  private zoomInput?: HTMLInputElement
  private zoomSlider?: HTMLInputElement
  private zoomMarker?: HTMLButtonElement
  private contentScale = 1
  private zoomFrame = 0
  private pendingScale = 1
  private frame = 0
  private laser = false
  private pointer?: number
  private finished = false
  private exiting?: Promise<void>
  private width = 0
  private height = 0
  private left = 0
  private top = 0
  private scrollX = 0
  private scrollY = 0
  private readonly cleanups: (() => void)[] = []
  private readonly overlays = new Set<HTMLElement>()

  constructor(private host: HTMLElement, private onExit: () => void, private beforeExit?: () => void) {
    this.doc = host.ownerDocument; this.win = this.doc.defaultView!
    this.scroller = host.querySelector<HTMLElement>('.wysimark-editor-container')
  }
  async enter() {
    for (const name of ['--blo-presentation-scale', '--blo-presentation-content-width']) {
      const original = this.host.style.getPropertyValue(name)
      this.cleanups.push(() => { if (original) this.host.style.setProperty(name, original); else this.host.style.removeProperty(name) })
    }
    this.cleanups.push(registerPresentationExit(this.doc, () => this.exit(), this.mountOverlay))
    this.host.classList.add('blo-presentation')
    this.canvas = this.doc.createElement('canvas'); this.canvas.className = 'blo-presentation-trail'; this.canvas.setAttribute('aria-hidden', 'true')
    this.dot = this.doc.createElement('div'); this.dot.className = 'blo-presentation-dot'; this.dot.hidden = true
    this.controls = this.doc.createElement('div'); this.controls.className = 'blo-presentation-controls'; this.controls.setAttribute('role', 'toolbar'); this.controls.setAttribute('aria-label', ui('演示模式'))
    const button = (icon: string, label: string, action: () => void) => {
      const el = this.doc.createElement('button'); el.type = 'button'; el.setAttribute('aria-label', label); el.dataset.tooltipPosition = 'top'; setIcon(el, icon)
      el.addEventListener('click', action); this.controls!.append(el); return el
    }
    this.mouseButton = button('mouse-pointer-2', ui('普通光标'), () => this.setLaser(false))
    this.laserButton = button('pen', ui('激光笔'), () => this.setLaser(true))
    const laserIcon = this.laserButton.querySelector('svg')!
    laserIcon.replaceChildren()
    const svgPart = (tag: string, attributes: Record<string, string>) => {
      const part = this.doc.createElementNS('http://www.w3.org/2000/svg', tag)
      Object.entries(attributes).forEach(([name, value]) => part.setAttribute(name, value)); laserIcon.append(part)
    }
    svgPart('path', { d: 'M8 13 17 4a2.12 2.12 0 0 1 3 3l-9 9-4 1zM15 6l3 3' })
    svgPart('circle', { cx: '3.5', cy: '20.5', r: '1.5', fill: '#ff3344', stroke: 'none' })
    this.createZoomControl()
    button('minimize', ui('退出演示（Esc）'), () => { void this.exit() })
    this.host.append(this.canvas, this.dot, this.controls); this.setLaser(false)
    this.listen(this.host, 'pointerdown', this.down, true)
    this.listen(this.host, 'pointermove', this.move, true)
    this.listen(this.host, 'pointerup', this.up, true)
    this.listen(this.host, 'pointercancel', this.up, true)
    this.listen(this.host, 'pointerleave', () => { if (this.pointer === undefined) this.hideDot() })
    this.listen(this.host, 'mousedown', this.blockClick, true)
    this.listen(this.host, 'click', this.blockClick, true)
    this.listen(this.win, 'blur', () => { this.up(); this.hideDot() })
    this.listen(this.win, 'resize', this.resize)
    this.listen(this.win, 'keydown', this.zoomKey, true)
    this.listen(this.win, 'wheel', this.zoomWheel, { capture: true, passive: false })
    if (this.scroller) this.listen(this.scroller, 'scroll', this.scroll)
    this.listen(this.doc, 'fullscreenchange', () => {
      if (this.doc.fullscreenElement === this.host) this.resize()
      else this.finish()
    })
    this.listen(this.doc, 'keydown', event => {
      const key = event as KeyboardEvent
      if (key.target === this.zoomInput) return
      if (key.key === 'Escape' && Array.from(this.overlays).some(element => element.getClientRects().length > 0)) { key.preventDefault(); return }
      if (key.key === 'Escape') { key.preventDefault(); key.stopPropagation(); void this.exit() }
    }, true)
    this.resize()
    try { await this.host.requestFullscreen({ navigationUI: 'hide' }) }
    catch (error) { this.finish(); throw error }
  }
  private listen(target: EventTarget, name: string, handler: (event: any) => void, options: boolean | AddEventListenerOptions = false) {
    target.addEventListener(name, handler, options)
    this.cleanups.push(() => target.removeEventListener(name, handler, typeof options === 'boolean' ? options : options.capture))
  }
  private controlTarget(event: Event) { return isDomElement(event.target) && (this.controls?.contains(event.target) || !!event.target.closest('.blo-presentation-overlay')) }
  private mountOverlay = (element: HTMLElement) => {
    if (this.finished || this.overlays.has(element)) return
    const parent = element.parentNode, next = element.nextSibling
    this.overlays.add(element); element.classList.add('blo-presentation-overlay'); this.host.append(element)
    this.hideDot()
    this.cleanups.push(() => {
      element.classList.remove('blo-presentation-overlay'); this.overlays.delete(element)
      if (parent && element.parentNode === this.host) parent.insertBefore(element, next?.parentNode === parent ? next : null)
    })
  }
  private setLaser(laser: boolean) {
    this.laser = laser; this.host.classList.toggle('blo-presentation-laser', laser)
    this.mouseButton?.setAttribute('aria-pressed', String(!laser)); this.laserButton?.setAttribute('aria-pressed', String(laser))
    this.up(); this.hideDot(); this.trail.clear(); this.paint()
  }
  private hideDot() { if (this.dot) this.dot.hidden = true }
  private createZoomControl() {
    const group = this.doc.createElement('span'); group.className = 'blo-presentation-zoom'
    const track = this.doc.createElement('span'); track.className = 'blo-presentation-zoom-track'
    const marker = this.doc.createElement('button'); marker.type = 'button'; marker.className = 'blo-presentation-zoom-reset'; marker.setAttribute('aria-label', ui('恢复100%缩放')); marker.disabled = true
    const dot = this.doc.createElement('span'); dot.className = 'blo-presentation-zoom-default'; dot.setAttribute('aria-hidden', 'true')
    const slider = this.doc.createElement('input'); slider.type = 'range'; slider.min = '-100'; slider.max = '100'; slider.step = 'any'; slider.value = '0'; slider.className = 'blo-presentation-zoom-slider'; slider.setAttribute('aria-label', ui('缩放比例')); slider.setAttribute('aria-valuetext', '100%')
    const input = this.doc.createElement('input'); input.type = 'text'; input.inputMode = 'decimal'; input.value = '100%'; input.className = 'blo-presentation-zoom-value'; input.setAttribute('aria-label', ui('输入缩放百分比'))
    this.zoomSlider = slider; this.zoomInput = input; this.zoomMarker = marker
    track.append(slider, marker, dot); group.append(track, input); this.controls!.append(group)
    this.listen(marker, 'click', () => this.setContentScale(1))
    this.listen(slider, 'input', () => {
      this.queueContentScale(snapToDefault(sliderToScale(slider.valueAsNumber)))
    })
    this.listen(input, 'focus', () => input.setSelectionRange(0, input.value.replace(/%$/, '').length))
    this.listen(input, 'change', () => { const percent = Number(input.value.trim().replace(/%$/, '')); this.setContentScale(Number.isFinite(percent) && percent > 0 ? percent / 100 : this.contentScale) })
    this.listen(input, 'keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); input.blur() }
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); input.value = `${Math.round(this.contentScale * 1000) / 10}%`; input.blur() }
    })
  }
  private queueContentScale(scale: number) {
    this.pendingScale = scale
    if (!this.zoomFrame) this.zoomFrame = this.win.requestAnimationFrame(() => { this.zoomFrame = 0; this.setContentScale(this.pendingScale) })
  }
  private zoomKey = (event: KeyboardEvent) => {
    if (this.doc.fullscreenElement !== this.host || !(event.ctrlKey || event.metaKey) || event.altKey) return
    if (!['+', '=', '-', '_', '0'].includes(event.key)) return
    event.preventDefault(); event.stopImmediatePropagation()
    this.setContentScale(event.key === '0' ? 1 : snapToDefault(this.contentScale + (event.key === '-' || event.key === '_' ? -0.1 : 0.1)))
  }
  private zoomWheel = (event: WheelEvent) => {
    if (this.doc.fullscreenElement !== this.host || !(event.ctrlKey || event.metaKey)) return
    event.preventDefault(); event.stopImmediatePropagation()
    const delta = Math.max(-200, Math.min(200, event.deltaY * (event.deltaMode === 1 ? 16 : 1)))
    this.queueContentScale((this.zoomFrame ? this.pendingScale : this.contentScale) * Math.exp(-delta * 0.001))
  }
  private setContentScale(scale: number) {
    if (this.finished) return
    this.win.cancelAnimationFrame(this.zoomFrame); this.zoomFrame = 0
    this.contentScale = Math.max(0.5, Math.min(2, Math.round(scale * 1000) / 1000))
    this.host.style.setProperty('--blo-presentation-scale', String(this.contentScale))
    this.host.style.setProperty('--blo-presentation-content-width', `${1120 * Math.max(1, this.contentScale)}px`)
    const label = `${Math.round(this.contentScale * 1000) / 10}%`
    if (this.zoomSlider) { this.zoomSlider.value = String(scaleToSlider(this.contentScale)); this.zoomSlider.setAttribute('aria-valuetext', label) }
    if (this.zoomInput) this.zoomInput.value = label
    if (this.zoomMarker) this.zoomMarker.disabled = !canResetZoom(this.contentScale)
    this.trail.clear(); this.paint()
  }
  private position(event: PointerEvent) {
    const x = event.clientX - this.left, y = event.clientY - this.top
    if (this.dot) { this.dot.hidden = false; this.dot.style.transform = `translate(${x}px,${y}px)` }
    return { x: x + this.scrollX, y: y + this.scrollY }
  }
  private down = (event: PointerEvent) => {
    if (!this.laser || this.controlTarget(event) || event.button !== 0) return
    event.preventDefault(); event.stopPropagation(); this.pointer = event.pointerId
    this.host.setPointerCapture(event.pointerId)
    const { x, y } = this.position(event); this.trail.begin(x, y, this.win.performance.now()); this.schedule()
  }
  private move = (event: PointerEvent) => {
    if (!this.laser || this.controlTarget(event)) { this.hideDot(); return }
    const { x, y } = this.position(event)
    if (this.pointer === event.pointerId) { this.trail.move(x, y, this.win.performance.now()); this.schedule() }
  }
  private up = () => {
    if (this.pointer !== undefined && this.host.hasPointerCapture(this.pointer)) this.host.releasePointerCapture(this.pointer)
    this.pointer = undefined; this.trail.end(this.win.performance.now())
  }
  private blockClick = (event: MouseEvent) => {
    if (this.laser && !this.controlTarget(event)) { event.preventDefault(); event.stopPropagation() }
  }
  private scroll = () => {
    this.scrollX = this.scroller?.scrollLeft ?? 0; this.scrollY = this.scroller?.scrollTop ?? 0
    this.schedule()
  }
  private resize = () => {
    if (!this.canvas) return
    const dpr = Math.min(this.win.devicePixelRatio || 1, 2)
    const bounds = this.host.getBoundingClientRect(); this.left = bounds.left; this.top = bounds.top
    this.width = this.host.clientWidth; this.height = this.host.clientHeight
    this.canvas.width = Math.ceil(this.width * dpr); this.canvas.height = Math.ceil(this.height * dpr)
    this.canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.scroll()
  }
  private schedule() { if (!this.finished && !this.frame) this.frame = this.win.requestAnimationFrame(this.paint) }
  private paint = () => {
    if (this.frame) this.win.cancelAnimationFrame(this.frame); this.frame = 0
    const context = this.canvas?.getContext('2d'); if (!context || this.finished) return
    context.clearRect(0, 0, this.width, this.height)
    context.save(); context.translate(-this.scrollX, -this.scrollY)
    const now = this.win.performance.now(), sample = this.trail.sample(now)
    for (const { points, progress, cutoff, initialRate } of sample.strokes) {
      const outline = laserOutline(points, cutoff + this.trail.lifetime, this.trail.lifetime, progress, initialRate)
      if (!outline.length) continue
      context.fillStyle = '#ff232d'; context.beginPath(); context.moveTo(outline[0].x, outline[0].y)
      for (let i = 1; i < outline.length; i++) context.lineTo(outline[i].x, outline[i].y)
      context.closePath(); context.fill()
    }
    context.restore()
    if (sample.active) this.schedule()
  }
  exit(): Promise<void> { return this.exiting ??= this.leave() }
  private async leave() {
    this.beforeExit?.()
    try { if (this.doc.fullscreenElement === this.host) await this.doc.exitFullscreen() }
    finally { this.finish() }
  }
  private finish() {
    if (this.finished) return
    if (!this.exiting) this.beforeExit?.()
    this.finished = true; this.up(); this.win.cancelAnimationFrame(this.frame); this.frame = 0; this.trail.clear()
    this.win.cancelAnimationFrame(this.zoomFrame); this.zoomFrame = 0
    this.cleanups.splice(0).forEach(cleanup => cleanup()); this.canvas?.remove(); this.dot?.remove(); this.controls?.remove()
    this.host.classList.remove('blo-presentation', 'blo-presentation-laser'); this.onExit()
  }
}
