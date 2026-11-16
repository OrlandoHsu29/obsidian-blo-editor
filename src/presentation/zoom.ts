/** A centered 100% stop with a useful 50–200% range on either side. */
export function sliderToScale(value: number): number { return 1 + value / (value < 0 ? 200 : 100) }
export function scaleToSlider(scale: number): number { return (scale - 1) * (scale < 1 ? 200 : 100) }
export function snapToDefault(scale: number): number { return Math.abs(scale - 1) <= 0.035 ? 1 : scale }
/** The default point becomes interactive at 80% / 120% and beyond. */
export function canResetZoom(scale: number): boolean { return Math.abs(scale - 1) >= 0.2 - 1e-9 }
