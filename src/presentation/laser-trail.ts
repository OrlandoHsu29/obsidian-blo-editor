type Point = { x: number; y: number; time: number; stroke: number }
export class LaserTrail {
  private points: Point[] = []
  private groups: { points: Point[] }[] | undefined
  private stroke = 0
  private drawing = false
  private releases = new Map<number, { time: number; delay: number; duration: number; initialRate: number }>()
  readonly lifetime = 1200
  readonly releaseDuration = 600
  readonly releaseDelay = 300
  begin(x: number, y: number, time: number) {
    this.end(time); this.drawing = true; ++this.stroke; this.add(x, y, time)
  }
  move(x: number, y: number, time: number) { if (this.drawing) this.add(x, y, time) }
  end(time: number) {
    if (this.drawing) {
      const points = this.points.filter(point => point.stroke === this.stroke)
      const length = arcLength(smoothedTrail(points, time, this.lifetime))
      const before = arcLength(smoothedTrail(points, time - 1, this.lifetime))
      const speed = Math.max(0, before - length)
      // Match the moving tail's velocity. If very little remains, finish sooner
      // rather than slowing down to stretch the sweep to the usual duration.
      const duration = speed > 0 ? Math.min(this.releaseDuration, length / (2 * speed)) : this.releaseDuration
      this.releases.set(this.stroke, { time, delay: speed > 0 ? 0 : this.releaseDelay, duration, initialRate: length > 0 ? speed * duration / length : 0 })
    }
    this.drawing = false
  }
  clear() { this.points = []; this.groups = undefined; this.drawing = false; this.releases.clear() }
  private add(x: number, y: number, time: number) {
    const previous = this.points[this.points.length - 1]
    if (previous?.stroke === this.stroke) {
      const distance = Math.hypot(x - previous.x, y - previous.y)
      if (distance < 0.75) return
      // Spatial smoothing suppresses hand jitter without depending on event rate.
      const weight = 1 - Math.exp(-distance / 8)
      x = previous.x + (x - previous.x) * weight
      y = previous.y + (y - previous.y) * weight
      // Give even a fast flick a spatially ordered decay. Otherwise all of its
      // samples have nearly the same timestamp and disappear simultaneously.
      time = Math.max(time, previous.time + Math.hypot(x - previous.x, y - previous.y) * 2)
    }
    this.points.push({ x, y, time, stroke: this.stroke })
    this.groups = undefined
    if (this.points.length > 512) this.points.splice(0, this.points.length - 512)
  }
  sample(time: number) {
    if (!this.groups) {
      this.groups = []
      for (const point of this.points) {
        let current = this.groups[this.groups.length - 1]
        if (!current || current.points[0].stroke !== point.stroke) { current = { points: [] }; this.groups.push(current) }
        current.points.push(point)
      }
    }
    const strokes = this.groups.map(({ points }) => {
      const release = this.releases.get(points[0].stroke)
      return { points, progress: release === undefined ? 0 : Math.max(0, (time - release.time - release.delay) / Math.max(0.001, release.duration)), cutoff: (release?.time ?? time) - this.lifetime, initialRate: release?.initialRate ?? 0 }
    })
    // Keep each live gesture's curve stable. Removing control points one by
    // one makes both the curve and its taper jump at sampling boundaries.
    const live = strokes.filter(stroke => stroke.progress < 1 && stroke.points[stroke.points.length - 1].time > stroke.cutoff)
    if (live.length !== strokes.length) { this.points = live.flatMap(stroke => stroke.points); this.groups = live }
    const ids = new Set(live.map(stroke => stroke.points[0].stroke))
    for (const id of this.releases.keys()) if (!ids.has(id)) this.releases.delete(id)
    return { strokes: live, active: live.length > 0, time }
  }
}

type TrailPoint = { x: number; y: number; time: number }
// Group snapshots remain immutable until pointer input changes. Reuse their
// smoothed geometry while only the decay boundary/width changes between frames.
const curves = new WeakMap<TrailPoint[], TrailPoint[]>()
function arcLength(points: TrailPoint[]) {
  let length = 0
  for (let i = 1; i < points.length; i++) length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  return length
}
function smoothedTrail(points: TrailPoint[], time: number, lifetime: number) {
  if (points.length < 2) return []
  let center = curves.get(points)
  if (!center) {
    center = [points[0]]
    const midpoint = (a: TrailPoint, b: TrailPoint): TrailPoint => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, time: (a.time + b.time) / 2 })
    let start = points[0]
    for (let i = 1; i < points.length; i++) {
      const control = points[i], end = i === points.length - 1 ? control : midpoint(control, points[i + 1])
      const steps = Math.max(1, Math.min(32, Math.ceil((Math.hypot(control.x - start.x, control.y - start.y) + Math.hypot(end.x - control.x, end.y - control.y)) / 3)))
      for (let step = 1; step <= steps; step++) {
        const t = step / steps, u = 1 - t
        center.push({ x: u * u * start.x + 2 * u * t * control.x + t * t * end.x, y: u * u * start.y + 2 * u * t * control.y + t * t * end.y, time: u * u * start.time + 2 * u * t * control.time + t * t * end.time })
      }
      start = end
    }
    curves.set(points, center)
  }
  // Clip the smoothed curve at a continuous time boundary, including between
  // sparse pointer events, instead of snapping the tail to the next sample.
  const cutoff = time - lifetime, first = center.findIndex(point => point.time > cutoff)
  if (first < 0) return []
  if (first > 0) {
    const before = center[first - 1], after = center[first], t = (cutoff - before.time) / (after.time - before.time)
    center = [{ x: before.x + (after.x - before.x) * t, y: before.y + (after.y - before.y) * t, time: cutoff }, ...center.slice(first)]
  }
  return center
}
/** A single filled ribbon avoids overlapping caps and tapers the ageing tail. */
export function laserOutline(points: TrailPoint[], time: number, lifetime: number, progress = 0, initialRate = 0) {
  if (progress >= 1) return []
  let center = smoothedTrail(points, time, lifetime)
  if (center.length < 2) return []
  const swept = initialRate * progress + (1 - initialRate) * progress * progress
  // Release sweeps a fraction of the visible arc, so every gesture finishes in
  // the same duration. Interpolate the moving boundary rather than drop points.
  if (progress > 0) {
    let remaining = arcLength(center) * swept
    for (let i = 1; i < center.length; i++) {
      const before = center[i - 1], after = center[i], length = Math.hypot(after.x - before.x, after.y - before.y)
      if (remaining < length) {
        const t = remaining / length
        center = [{ x: before.x + (after.x - before.x) * t, y: before.y + (after.y - before.y) * t, time: before.time + (after.time - before.time) * t }, ...center.slice(i)]
        break
      }
      remaining -= length
    }
  }
  const visibleLength = arcLength(center)
  const taperLength = Math.max(0.001, Math.min(64, visibleLength * 0.35))
  const left: { x: number; y: number }[] = [], right: { x: number; y: number }[] = []
  let distance = 0
  for (let i = 0; i < center.length; i++) {
    const p = center[i], before = center[Math.max(0, i - 1)], after = center[Math.min(center.length - 1, i + 1)]
    distance += Math.hypot(p.x - before.x, p.y - before.y)
    const length = Math.hypot(after.x - before.x, after.y - before.y) || 1
    const remaining = Math.max(0, Math.min(1, (lifetime - (time - p.time)) / 450))
    // Match the accelerating sweep: keep the early stroke substantial, then
    // narrow the remaining ribbon to zero when the release sweep ends.
    const radius = 1.8 * Math.min(1, distance / taperLength) * remaining * remaining * (3 - 2 * remaining) * (1 - swept)
    const nx = -(after.y - before.y) / length * radius, ny = (after.x - before.x) / length * radius
    left.push({ x: p.x + nx, y: p.y + ny }); right.push({ x: p.x - nx, y: p.y - ny })
  }
  // Round the live end of the ribbon; the old end already converges to a point.
  const last = center[center.length - 1], previous = center[center.length - 2]
  const angle = Math.atan2(last.y - previous.y, last.x - previous.x), radius = Math.hypot(left[left.length - 1].x - last.x, left[left.length - 1].y - last.y)
  const cap = Array.from({ length: 7 }, (_, i) => { const a = angle + Math.PI / 2 - Math.PI * (i + 1) / 8; return { x: last.x + Math.cos(a) * radius, y: last.y + Math.sin(a) * radius } })
  return [...left, ...cap, ...right.reverse()]
}
