export type ConfidenceLevel = 'EXACT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN'

export interface Coordinates {
  lat: number
  lng: number
}

export interface GeocodedLocation {
  id: string
  originalString: string
  resolvedName: string | null
  coords: Coordinates | null
  confidence: ConfidenceLevel
  source: string
}

export interface GeocodingDataset {
  version: string
  generatedAt: string
  locations: GeocodedLocation[]
  summary: {
    total: number
    resolved: number
    unknown: number
  }
}
