import type { DependencyLink } from '../types/intelligence'

interface DependencyPanelProps {
  visible: boolean
  selectedRepoId: string | null
  affinityLinks: DependencyLink[]
  manifestLinks: DependencyLink[]
  onClose: () => void
  onSelectRepo: (repoId: string) => void
}

export default function DependencyPanel({
  visible,
  selectedRepoId,
  affinityLinks,
  manifestLinks,
  onClose,
  onSelectRepo,
}: DependencyPanelProps) {
  if (!visible) return null

  const scopedManifest = selectedRepoId
    ? manifestLinks.filter((link) => link.source_repo === selectedRepoId || link.target_repo === selectedRepoId)
    : manifestLinks.slice(0, 10)
  const scopedAffinity = selectedRepoId
    ? affinityLinks.filter((link) => link.source_repo === selectedRepoId || link.target_repo === selectedRepoId)
    : affinityLinks.slice(0, 10)
  const scoped = scopedManifest.length > 0 ? scopedManifest : scopedAffinity
  const sourceLabel = scopedManifest.length > 0 ? 'Manifest dependency graph' : 'Dependency affinity'
  const helperText = scopedManifest.length > 0
    ? 'Showing links derived from parsed package manifests.'
    : 'Showing inferred affinity links where manifest coverage is not available yet.'

  return (
    <div className="dependency-panel">
      <div className="trending-header">
        <span>{selectedRepoId ? sourceLabel : 'Dependency ecosystem'}</span>
        <button onClick={onClose}>x</button>
      </div>
      <div className="trending-loading">{helperText}</div>
      {scoped.length === 0 && <div className="trending-loading">Select a repository to inspect its package ecosystem links.</div>}
      {scoped.map((link) => {
        const counterpart = selectedRepoId === link.source_repo ? link.target_repo : link.source_repo
        return (
          <button key={`${link.source_repo}-${link.target_repo}`} className="intel-row" onClick={() => onSelectRepo(counterpart)}>
            <div className="intel-main">
              <strong>{link.source_repo}</strong>
              <span>{link.rationale}</span>
            </div>
            <div className="intel-main intel-main-right">
              <strong>{link.target_repo}</strong>
              <span>{link.ecosystem ? `${link.ecosystem} · ` : ''}{Math.round(link.weight * 100)} match</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
