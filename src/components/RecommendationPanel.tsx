import type { AIRecommendation } from '../types/relationships'

interface RecommendationPanelProps {
  recommendations: AIRecommendation[]
  onSelect: (repoId: string) => void
}

export default function RecommendationPanel({ recommendations, onSelect }: RecommendationPanelProps) {
  return (
    <div className="ai-panel">
      <div className="trending-header">
        <span>Recommended Repositories</span>
      </div>
      {recommendations.map((rec) => (
        <button key={rec.repo_id} className="ai-item" onClick={() => onSelect(rec.repo_id)}>
          <div className="ai-title">{rec.repo_id}</div>
          <div className="ai-rationale">{rec.reason}</div>
          <div className="ai-meta">
            <span>score</span>
            <span>{(rec.score * 100).toFixed(0)}%</span>
          </div>
        </button>
      ))}
      {recommendations.length === 0 && <div className="trending-loading">No recommendations yet.</div>}
    </div>
  )
}
