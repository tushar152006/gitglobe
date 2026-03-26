export interface GeoIntelligenceRecord {
  repo_id: string
  country: string
  region: string
  geocode_confidence: number
  location_source: 'profile' | 'org' | 'derived' | 'unknown'
  is_unknown_origin: boolean
}

export interface DependencyLink {
  source_repo: string
  target_repo: string
  source_coords: [number, number]
  target_coords: [number, number]
  weight: number
  rationale: string
  ecosystem?: string
  data_source?: 'affinity' | 'manifest'
  shared_packages?: string[]
}
