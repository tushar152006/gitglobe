import { useCallback, useMemo } from 'react'
import { CanvasOverlay } from '../geo/canvasOverlay'
import { arcControlPoint, projectLngLat } from '../geo/projection'
import { useViewportSize } from '../hooks/useViewportSize'
import { createContributorLayerConfig } from '../layers/ContributorLayer'
import { createForkArcLayerConfig } from '../layers/ForkArcLayer'
import { createOrgConstellationConfig } from '../layers/OrgConstellationLayer'
import type { ContributorOverlap, ForkArc, OrgConstellation } from '../types/relationships'

interface RelationshipDeckProps {
  forkArcs: ForkArc[]
  contributorOverlaps: ContributorOverlap[]
  orgConstellations: OrgConstellation[]
  showForkArcs: boolean
  showContributorNetwork: boolean
  showOrgConstellations: boolean
  selectedOrg: string | null
  isolatedRepoId: string | null
  selectedCountry: string | null
  onCountryClick: (country: string | null) => void
  onRepoArcClick: (repoId: string | null) => void
}

interface RenderCurve {
  kind: 'fork' | 'contributor'
  sourceRepoId?: string
  sourceCountry?: string
  start: [number, number]
  control: [number, number]
  end: [number, number]
  width: number
  stroke: string
}

interface RenderLine {
  start: [number, number]
  end: [number, number]
  width: number
  stroke: string
}

function toPoint(point: readonly [number, number]): [number, number] {
  return [point[0], point[1]]
}

function distanceToSegment(point: [number, number], start: [number, number], end: [number, number]) {
  const [px, py] = point
  const [x1, y1] = start
  const [x2, y2] = end
  const dx = x2 - x1
  const dy = y2 - y1
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) return Math.hypot(px - x1, py - y1)
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq))
  const cx = x1 + t * dx
  const cy = y1 + t * dy
  return Math.hypot(px - cx, py - cy)
}

function distanceToQuadraticCurve(point: [number, number], curve: RenderCurve) {
  let minDistance = Number.POSITIVE_INFINITY
  let previous = curve.start
  const steps = 24
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps
    const inv = 1 - t
    const current: [number, number] = [
      inv * inv * curve.start[0] + 2 * inv * t * curve.control[0] + t * t * curve.end[0],
      inv * inv * curve.start[1] + 2 * inv * t * curve.control[1] + t * t * curve.end[1],
    ]
    minDistance = Math.min(minDistance, distanceToSegment(point, previous, current))
    previous = current
  }
  return minDistance
}

export default function RelationshipDeck(props: RelationshipDeckProps) {
  const viewport = useViewportSize()

  const forkConfig = useMemo(() => createForkArcLayerConfig({
    data: props.forkArcs,
    visible: props.showForkArcs,
    highlightedRepoId: props.isolatedRepoId,
  }), [props.forkArcs, props.showForkArcs, props.isolatedRepoId])
  const contributorConfig = useMemo(() => createContributorLayerConfig({
    data: props.contributorOverlaps,
    visible: props.showContributorNetwork,
    selectedCountry: props.selectedCountry,
  }), [props.contributorOverlaps, props.showContributorNetwork, props.selectedCountry])
  const orgConfig = useMemo(() => createOrgConstellationConfig({
    data: props.orgConstellations,
    visible: props.showOrgConstellations,
    selectedOrg: props.selectedOrg,
  }), [props.orgConstellations, props.showOrgConstellations, props.selectedOrg])

  const curves = useMemo<RenderCurve[]>(() => {
    const forkCurves = forkConfig.map((arc) => {
      const start = toPoint(projectLngLat(arc.parentCoords, viewport))
      const end = toPoint(projectLngLat(arc.forkCoords, viewport))
      const control = toPoint(arcControlPoint(start, end))
      return {
        kind: 'fork' as const,
        sourceRepoId: arc.repoId,
        start,
        control,
        end,
        width: arc.width,
        stroke: arc.dimmed ? 'rgba(100,100,130,0.2)' : 'rgba(95,205,255,0.38)',
      }
    })
    const contributorCurves = contributorConfig.map((arc) => {
      const start = toPoint(projectLngLat(arc.source_coords, viewport))
      const end = toPoint(projectLngLat(arc.target_coords, viewport))
      const control = toPoint(arcControlPoint(start, end))
      return {
        kind: 'contributor' as const,
        sourceCountry: arc.source_country,
        start,
        control,
        end,
        width: arc.width,
        stroke: arc.dimmed ? 'rgba(100,100,130,0.25)' : 'rgba(255,155,90,0.55)',
      }
    })
    return [...forkCurves, ...contributorCurves]
  }, [contributorConfig, forkConfig, viewport])

  const lines = useMemo<RenderLine[]>(
    () => orgConfig.edges.map((edge) => ({
      start: toPoint(projectLngLat(edge.source, viewport)),
      end: toPoint(projectLngLat(edge.target, viewport)),
      width: 1,
      stroke: 'rgba(255,255,120,0.36)',
    })),
    [orgConfig.edges, viewport],
  )

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    curves.forEach((curve) => {
      ctx.beginPath()
      ctx.moveTo(curve.start[0], curve.start[1])
      ctx.quadraticCurveTo(curve.control[0], curve.control[1], curve.end[0], curve.end[1])
      ctx.strokeStyle = curve.stroke
      ctx.lineWidth = curve.width
      ctx.stroke()
    })

    lines.forEach((line) => {
      ctx.beginPath()
      ctx.moveTo(line.start[0], line.start[1])
      ctx.lineTo(line.end[0], line.end[1])
      ctx.strokeStyle = line.stroke
      ctx.lineWidth = line.width
      ctx.stroke()
    })
  }, [curves, lines])

  const hitTest = useCallback((clientX: number, clientY: number) => {
    const point: [number, number] = [clientX, clientY]
    for (const curve of curves) {
      const threshold = Math.max(6, curve.width + 4)
      if (distanceToQuadraticCurve(point, curve) <= threshold) {
        return { payload: curve, cursor: 'pointer' as const }
      }
    }
    return null
  }, [curves])

  return (
    <CanvasOverlay
      className="relationship-overlay"
      width={viewport.width}
      height={viewport.height}
      visible
      draw={draw}
      hitTest={hitTest}
      onHit={(hit) => {
        if (hit.kind === 'fork' && hit.sourceRepoId) {
          props.onRepoArcClick(hit.sourceRepoId)
        } else if (hit.kind === 'contributor' && hit.sourceCountry) {
          props.onCountryClick(hit.sourceCountry)
        }
      }}
    />
  )
}
