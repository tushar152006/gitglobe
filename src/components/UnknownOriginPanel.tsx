import type { Repo } from './Globe'
import { fmt, getLangColor } from './Globe'

interface UnknownOriginPanelProps {
  visible: boolean
  repos: Repo[]
  onClose: () => void
  onSelectRepo: (repo: Repo) => void
}

export default function UnknownOriginPanel({
  visible,
  repos,
  onClose,
  onSelectRepo,
}: UnknownOriginPanelProps) {
  if (!visible) return null

  return (
    <div className="unknown-panel">
      <div className="trending-header">
        <span>Unknown origin</span>
        <button onClick={onClose}>×</button>
      </div>
      {repos.length === 0 && <div className="trending-loading">All visible repositories have resolved coordinates.</div>}
      {repos.slice(0, 12).map((repo) => (
        <button key={repo.name} className="nearby-item" onClick={() => onSelectRepo(repo)}>
          <span className="result-dot" style={{ background: getLangColor(repo.lang) }} />
          <div className="nearby-main">
            <strong>{repo.name}</strong>
            <span>{repo.loc || 'Unknown location'}</span>
          </div>
          <div className="nearby-meta">
            <span>{repo.lang}</span>
            <span>★ {fmt(repo.stars)}</span>
          </div>
        </button>
      ))}
    </div>
  )
}
