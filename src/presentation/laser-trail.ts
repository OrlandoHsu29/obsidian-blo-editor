type Point = { x: number; y: number; time: number; stroke: number }
const MAX_TRAIL_POINTS = 512
const MAX_TIME_LEAD = 2000
const HELD_DECAY_STAGES = [{ points: 320, rate: 1.25 }, { points: 416, rate: 1.6 }]

export class LaserTrail {
  private points: Point[] = []
  private groups: { points: Point[] }[] | undefined
  private stroke = 0
  private drawing = false
  private heldTime = 0
  private lastTime = 0
  private lastPoint?: Point
  private heldPoints = 0
  private decayStage = 0
  private releases = new Map<number, { time: number; cutoff: number }>()
  readonly lifetime = 1200
  readonly releaseDuration = 600
  begin(x: number, y: number, time: number) {
    this.end(time); this.drawing = true; ++this.stroke
    this.heldTime = this.lastTime = time
    this.heldPoints = this.decayStage = 0; this.lastPoint = undefined
    this.add(x, y, time)
  }
  move(x: number, y: number, time: number) { if (this.drawing) this.add(x, y, time) }
  end(time: number) {
    if (this.drawing) {
      const heldTime = this.advanceHeldTime(time)
      this.releases.set(this.stroke, { time, cutoff: heldTime - this.lifetime })
    }
    this.drawing = false
  }
  clear() { this.points = []; this.groups = this.lastPoint = undefined; this.drawing = false; this.releases.clear() }
  private get heldRate() { return HELD_DECAY_STAGES[this.decayStage - 1]?.rate ?? 1 }
  private advanceHeldTime(time: number) {
    if (time > this.lastTime) {
      this.heldTime += (time - this.lastTime) * this.heldRate
      this.lastTime = time
    }
    return this.heldTime
  }
  private add(x: number, y: number, time: number) {
    time = this.advanceHeldTime(time)
    const cutoff = time - this.lifetime
    const previous = this.lastPoint
    if (previous) {
      const distance = Math.hypot(x - previous.x, y - previous.y)
      if (distance < 0.75) return
      // Spatial smoothing suppresses hand jitter without depending on event rate.
      const weight = 1 - Math.exp(-distance / 8)
      x = previous.x + (x - previous.x) * weight
      y = previous.y + (y - previous.y) * weight
      let previousTime = previous.time
      if (previousTime <= cutoff) {
        // Keep the last pen position through expiry so the next movement draws immediately.
        this.points.splice(this.points.length - this.heldPoints, this.heldPoints, { ...previous, time })
        this.heldPoints = 1
        this.decayStage = 0
        previousTime = time
      }
      const spacedTime = previousTime + Math.hypot(x - previous.x, y - previous.y) * 2
      time = Math.max(time, Math.min(spacedTime, time + MAX_TIME_LEAD))
    }
    this.lastPoint = { x, y, time, stroke: this.stroke }
    this.points.push(this.lastPoint)
    this.heldPoints++
    this.groups = undefined
    const nextStage = HELD_DECAY_STAGES[this.decayStage]
    if (this.heldPoints >= (nextStage?.points ?? Infinity) || this.points.length > MAX_TRAIL_POINTS) {
      this.trimExpired(cutoff)
      if (nextStage && this.heldPoints >= nextStage.points) this.decayStage++
      if (this.points.length > MAX_TRAIL_POINTS) this.compact()
    }
  }
  private trimExpired(cutoff: number) {
    const start = this.points.length - this.heldPoints
    let expired = 0
    // Retain two control points before the cutoff to keep interpolation stable.
    while (this.points[start + expired + 2]?.time < cutoff) expired++
    this.points.splice(start, expired)
    this.heldPoints -= expired
  }
  private compact() {
    // Reduce the sampling density without letting input events drag the tail.
    this.points = this.points.filter((point, index, points) => index % 2 === 0 ||
      points[index - 1]?.stroke !== point.stroke || points[index + 1]?.stroke !== point.stroke)
    let first = this.points.length - MAX_TRAIL_POINTS
    if (first > 0) {
      const discardedStroke = this.points[first - 1].stroke
      while (this.points[first]?.stroke === discardedStroke) first++
      this.points.splice(0, first)
    }
    this.heldPoints = this.points.length - this.points.findIndex(point => point.stroke === this.stroke)
  }
  sample(time: number) {
    const heldCutoff = (this.drawing ? this.advanceHeldTime(time) : time) - this.lifetime
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
      return { points, progress: release === undefined ? 0 : Math.max(0, (time - release.time) / this.releaseDuration), cutoff: release?.cutoff ?? heldCutoff }
    })
    // Keep each live gesture's curve stable between input events.
    const live = strokes.filter(stroke => stroke.progress < 1 && stroke.points[stroke.points.length - 1].time > stroke.cutoff)
    if (live.length !== strokes.length) { this.points = live.flatMap(stroke => stroke.points); this.groups = live }
    const ids = new Set(live.map(stroke => stroke.points[0].stroke))
    if (this.drawing && !ids.has(this.stroke)) this.heldPoints = this.decayStage = 0
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
export function laserOutline(points: TrailPoint[], time: number, lifetime: number, progress = 0) {
  if (progress >= 1) return []
  const center = smoothedTrail(points, time, lifetime)
  if (center.length < 2) return []
  const visibleLength = arcLength(center)
  const last = center[center.length - 1]
  const ageSpan = last.time - center[0].time
  const taperLength = Math.max(0.001, Math.min(64, visibleLength * 0.35))
  const left: { x: number; y: number }[] = [], right: { x: number; y: number }[] = []
  let distance = 0
  for (let i = 0; i < center.length; i++) {
    const p = center[i], before = center[Math.max(0, i - 1)], after = center[Math.min(center.length - 1, i + 1)]
    distance += Math.hypot(p.x - before.x, p.y - before.y)
    const length = Math.hypot(after.x - before.x, after.y - before.y) || 1
    const remaining = Math.max(0, Math.min(1, (lifetime - (time - p.time)) / 450))
    let releaseWidth = 1
    if (progress > 0) {
      // Older ink narrows a little faster across the whole released outline.
      const age = ageSpan > 0 ? (last.time - p.time) / ageSpan : 1 - distance / Math.max(visibleLength, 0.001)
      releaseWidth = Math.max(0, 1 - progress * (1 + 0.18 * age))
    }
    const radius = 1.8 * Math.min(1, distance / taperLength) * remaining * remaining * (3 - 2 * remaining) * releaseWidth
    const nx = -(after.y - before.y) / length * radius, ny = (after.x - before.x) / length * radius
    left.push({ x: p.x + nx, y: p.y + ny }); right.push({ x: p.x - nx, y: p.y - ny })
  }
  // Round the live end of the ribbon; the old end already converges to a point.
  const previous = center[center.length - 2]
  const angle = Math.atan2(last.y - previous.y, last.x - previous.x), radius = Math.hypot(left[left.length - 1].x - last.x, left[left.length - 1].y - last.y)
  const cap = Array.from({ length: 7 }, (_, i) => { const a = angle + Math.PI / 2 - Math.PI * (i + 1) / 8; return { x: last.x + Math.cos(a) * radius, y: last.y + Math.sin(a) * radius } })
  return [...left, ...cap, ...right.reverse()]
}
