import type { ForkArc } from '../types/relationships'

interface ForkArcLayerArgs {
  data: ForkArc[]
  visible: boolean
  highlightedRepoId: string | null
}

const MAX_OVERLAY_ARCS = 18
const MAX_ARCS_PER_PARENT = 2

function sameCoords(a: [number, number], b: [number, number]) {
  return Math.abs(a[0] - b[0]) < 0.001 && Math.abs(a[1] - b[1]) < 0.001
}

function arcDistanceScore(a: [number, number], b: [number, number]) {
  const lng = Math.abs(a[0] - b[0])
  const lat = Math.abs(a[1] - b[1])
  return lng + lat * 1.25
}

export function createForkArcLayerConfig({
  data,
  visible,
  highlightedRepoId,
}: ForkArcLayerArgs) {
  if (!visible) return []

  const scopedData = highlightedRepoId
    ? data.filter((arc) => arc.repoId === highlightedRepoId || arc.parentId === highlightedRepoId || arc.forkId === highlightedRepoId)
    : data

  const perParent = new Map<string, number>()

  return scopedData
    .filter((arc) => !sameCoords(arc.parentCoords, arc.forkCoords))
    .sort((a, b) => {
      const aScore = a.stars * 0.7 + arcDistanceScore(a.parentCoords, a.forkCoords)
      const bScore = b.stars * 0.7 + arcDistanceScore(b.parentCoords, b.forkCoords)
      return bScore - aScore
    })
    .filter((arc) => {
      if (highlightedRepoId) return true
      const count = perParent.get(arc.parentId) ?? 0
      if (count >= MAX_ARCS_PER_PARENT) return false
      perParent.set(arc.parentId, count + 1)
      return true
    })
    .slice(0, highlightedRepoId ? scopedData.length : MAX_OVERLAY_ARCS)
    .map((d) => ({
      ...d,
      width: Math.max(0.75, Math.log10(d.stars + 1) * 0.85),
      dimmed: Boolean(highlightedRepoId && d.repoId !== highlightedRepoId),
    }))
}
