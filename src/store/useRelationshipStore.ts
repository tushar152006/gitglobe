import { useSyncExternalStore } from 'react'
import type { AIRecommendation, ContributorOverlap, ForkArc, OrgConstellation } from '../types/relationships'

type State = {
  showForkArcs: boolean
  showContributorNetwork: boolean
  showOrgConstellations: boolean
  timeMode: boolean
  selectedOrg: string | null
  isolatedRepoId: string | null
  selectedCountry: string | null
  timeRange: [number, number]
  recommendations: AIRecommendation[]
  forkArcs: ForkArc[]
  contributorOverlaps: ContributorOverlap[]
  orgConstellations: OrgConstellation[]
  loadedSnapshots: Record<number, boolean>
}

const store: State = {
  showForkArcs: true,
  showContributorNetwork: false,
  showOrgConstellations: false,
  timeMode: true,
  selectedOrg: null,
  isolatedRepoId: null,
  selectedCountry: null,
  timeRange: [2019, new Date().getUTCFullYear()],
  recommendations: [],
  forkArcs: [],
  contributorOverlaps: [],
  orgConstellations: [],
  loadedSnapshots: {},
}

const listeners = new Set<() => void>()
function emit() { listeners.forEach((fn) => fn()) }
function setState(patch: Partial<State>) {
  Object.assign(store, patch)
  emit()
}

export function useRelationshipStore() {
  const snapshot = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb) },
    () => store,
  )
  return {
    ...snapshot,
    setShowForkArcs: (value: boolean) => setState({ showForkArcs: value }),
    setShowContributorNetwork: (value: boolean) => setState({ showContributorNetwork: value }),
    setShowOrgConstellations: (value: boolean) => setState({ showOrgConstellations: value }),
    setTimeMode: (value: boolean) => setState({ timeMode: value }),
    setSelectedOrg: (value: string | null) => setState({ selectedOrg: value }),
    setIsolatedRepoId: (value: string | null) => setState({ isolatedRepoId: value }),
    setSelectedCountry: (value: string | null) => setState({ selectedCountry: value }),
    setTimeRange: (value: [number, number]) => setState({ timeRange: value }),
    setRecommendations: (value: AIRecommendation[]) => setState({ recommendations: value }),
    setRelationshipData: (payload: Pick<State, 'forkArcs' | 'contributorOverlaps' | 'orgConstellations'>) => setState(payload),
    setSnapshotLoaded: (year: number) => setState({ loadedSnapshots: { ...store.loadedSnapshots, [year]: true } }),
  }
}
