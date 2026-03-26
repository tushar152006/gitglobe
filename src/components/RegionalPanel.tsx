import type { CountrySignal, RegionSignal } from '../services/intelligence'
import { getDomainColor } from '../services/intelligence'

interface RegionalPanelProps {
  visible: boolean
  domain: string | null
  countrySignals: CountrySignal[]
  regionSignals: RegionSignal[]
  onClose: () => void
  onFocusCountry: (country: CountrySignal) => void
}

export default function RegionalPanel({
  visible,
  domain,
  countrySignals,
  regionSignals,
  onClose,
  onFocusCountry,
}: RegionalPanelProps) {
  if (!visible) return null

  return (
    <div className="intelligence-panel">
      <div className="trending-header">
        <span>{domain ? `${domain} regional intelligence` : 'Regional intelligence'}</span>
        <button onClick={onClose}>×</button>
      </div>
      <div className="intel-section">
        <div className="intel-label">Top countries</div>
        {countrySignals.slice(0, 7).map((item, idx) => (
          <button key={item.country} className="intel-row" onClick={() => onFocusCountry(item)}>
            <span className="intel-rank">#{idx + 1}</span>
            <div className="intel-main">
              <strong>{item.country}</strong>
              <span>{item.repoCount} repos · {item.totalStars.toLocaleString()} stars</span>
            </div>
            <span className="intel-tag" style={{ borderColor: `${getDomainColor(item.dominantDomain)}66`, color: getDomainColor(item.dominantDomain) }}>
              {item.dominantDomain}
            </span>
          </button>
        ))}
      </div>
      <div className="intel-section">
        <div className="intel-label">Top regions</div>
        {regionSignals.slice(0, 6).map((item) => (
          <div key={item.region} className="intel-row intel-row-static">
            <div className="intel-main">
              <strong>{item.region}</strong>
              <span>{item.repoCount} repos · {item.totalStars.toLocaleString()} stars</span>
            </div>
            <span className="intel-tag intel-tag-neutral">{item.topLanguage}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
