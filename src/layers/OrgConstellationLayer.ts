import type { OrgConstellation } from '../types/relationships'

interface OrgLayerArgs {
  data: OrgConstellation[]
  visible: boolean
  selectedOrg: string | null
}

export interface OrgEdge {
  org: string
  source: [number, number]
  target: [number, number]
}

export function createOrgConstellationConfig({
  data,
  visible,
  selectedOrg,
}: OrgLayerArgs) {
  const orgData = selectedOrg ? data.filter((org) => org.org === selectedOrg) : data
  const edges: OrgEdge[] = []
  const nodes: Array<{ org: string; repoId: string; coords: [number, number]; hub: boolean }> = []

  orgData.forEach((org) => {
    if (org.repos.length < 2) return
    const hub = org.hub ?? org.repos[0].coords
    org.repos.forEach((repo) => {
      nodes.push({ org: org.org, repoId: repo.id, coords: repo.coords, hub: repo.coords[0] === hub[0] && repo.coords[1] === hub[1] })
      if (repo.coords[0] === hub[0] && repo.coords[1] === hub[1]) return
      edges.push({ org: org.org, source: hub, target: repo.coords })
    })
  })

  if (!visible) return { edges: [], nodes: [] }
  return { edges, nodes }
}
