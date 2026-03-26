import type { Repo } from './Globe'
import type { NearbyRepo } from '../services/intelligence'
import { fmt, getLangColor } from './Globe'

interface NearbyPanelProps {
  visible: boolean
  loading: boolean
  nearbyRepos: NearbyRepo[]
  originLabel: string
  summary: { topLanguage: string; topDomain: string; avgDistanceKm: number } | null
  onClose: () => void
  onRequestLocation: () => void
  onSelectRepo: (repo: Repo) => void
}

export default function NearbyPanel({
  visible,
  loading,
  nearbyRepos,
  originLabel,
  summary,
  onClose,
  onRequestLocation,
  onSelectRepo,
}: NearbyPanelProps) {
  if (!visible) return null

  return (
    <div className="nearby-panel">
      <div className="trending-header">
        <span>Discover nearby</span>
        <button onClick={onClose}>×</button>
      </div>
      <div className="nearby-body">
        <button className="nearby-locate-btn" onClick={onRequestLocation} disabled={loading}>
          {loading ? 'Finding your location…' : originLabel ? `Refresh location · ${originLabel}` : 'Use my location'}
        </button>
        {summary && (
          <div className="nearby-summary">
            <span>{summary.topDomain} cluster</span>
            <span>{summary.topLanguage} strongest</span>
            <span>{summary.avgDistanceKm} km avg</span>
          </div>
        )}
        {nearbyRepos.length === 0 && !loading && <div className="trending-loading">Use location to see repositories near you.</div>}
        {nearbyRepos.slice(0, 8).map(({ repo, distanceKm }) => (
          <button key={repo.name} className="nearby-item" onClick={() => onSelectRepo(repo)}>
            <span className="result-dot" style={{ background: getLangColor(repo.lang) }} />
            <div className="nearby-main">
              <strong>{repo.name}</strong>
              <span>{repo.loc}</span>
            </div>
            <div className="nearby-meta">
              <span>{Math.round(distanceKm)} km</span>
              <span>★ {fmt(repo.stars)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
