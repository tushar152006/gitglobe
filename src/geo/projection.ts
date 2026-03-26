export interface GeoViewport {
  width: number
  height: number
}

export function projectLngLat([lng, lat]: [number, number], viewport: GeoViewport) {
  const x = ((lng + 180) / 360) * viewport.width
  const y = ((90 - lat) / 180) * viewport.height
  return [x, y] as const
}

export function arcControlPoint(
  start: readonly [number, number],
  end: readonly [number, number],
  curvature = 0.12,
) {
  const mx = (start[0] + end[0]) / 2
  const my = Math.min(start[1], end[1]) - Math.abs(start[0] - end[0]) * curvature
  return [mx, my] as const
}
