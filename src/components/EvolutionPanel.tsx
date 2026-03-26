interface EvolutionRegion {
  region: string
  stars: number
  repos: number
}

interface EvolutionPanelProps {
  visible: boolean
  year: number
  rows: EvolutionRegion[]
  onClose: () => void
}

export default function EvolutionPanel({ visible, year, rows, onClose }: EvolutionPanelProps) {
  if (!visible) return null

  return (
    <div className="evolution-panel">
      <div className="trending-header">
        <span>Regional evolution · {year}</span>
        <button onClick={onClose}>×</button>
      </div>
      {rows.length === 0 && <div className="trending-loading">No snapshot data loaded for this year yet.</div>}
      {rows.map((row, idx) => (
        <div key={row.region} className="intel-row intel-row-static">
          <span className="intel-rank">#{idx + 1}</span>
          <div className="intel-main">
            <strong>{row.region}</strong>
            <span>{row.repos} repos represented</span>
          </div>
          <span className="intel-tag intel-tag-neutral">{row.stars.toLocaleString()}★</span>
        </div>
      ))}
    </div>
  )
}
