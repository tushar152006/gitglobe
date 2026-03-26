export interface ForkConnectionRepo {
  repo_id: string
  name: string
  location: [number, number]
  parent_id?: string
  fork_count: number
  top_forks: Array<{ id: string; location: [number, number]; stars: number }>
}

export interface ForkArc {
  repoId: string
  parentId: string
  parentCoords: [number, number]
  forkId: string
  forkCoords: [number, number]
  stars: number
}

export interface ContributorOverlap {
  source_country: string
  source_coords: [number, number]
  target_country: string
  target_coords: [number, number]
  shared_contributors: number
}

export interface OrgConstellation {
  org: string
  hub?: [number, number]
  repos: Array<{ id: string; coords: [number, number] }>
}

export interface AIRecommendation {
  repo_id: string
  score: number
  reason: string
}
