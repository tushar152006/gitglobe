import type { ContributorOverlap } from '../types/relationships'

interface ContributorLayerArgs {
  data: ContributorOverlap[]
  visible: boolean
  selectedCountry: string | null
}

export function createContributorLayerConfig({
  data,
  visible,
  selectedCountry,
}: ContributorLayerArgs) {
  if (!visible) return []
  return data.map((d) => ({
    ...d,
    width: Math.max(1, Math.log2(d.shared_contributors + 1)),
    dimmed: Boolean(selectedCountry && d.source_country !== selectedCountry && d.target_country !== selectedCountry),
  }))
}
