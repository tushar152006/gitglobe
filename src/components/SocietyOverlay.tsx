// ── SocietyOverlay.tsx ────────────────────────────────────────────────────────
// Phase 3: Renders society region labels + selection UI as an HTML overlay

import type { Society } from './societies'

interface SocietyOverlayProps {
  societies: Society[]
  activeSociety: Society | null
  onSelect: (s: Society) => void
  visible: boolean
}

export default function SocietyOverlay({ societies, activeSociety, onSelect, visible }: SocietyOverlayProps) {
  if (!visible) return null

  return (
    <div className="society-overlay">
      <div className="society-grid">
        {societies.map(s => (
          <button
            key={s.id}
            className={`society-chip ${activeSociety?.id === s.id ? 'active' : ''}`}
            style={{
              '--s-color': s.color,
              '--s-glow': s.glowColor,
              borderColor: activeSociety?.id === s.id ? s.color : s.color + '50',
            } as React.CSSProperties}
            onClick={() => onSelect(s)}
          >
            <span className="sc-badge">{s.badge}</span>
            <span className="sc-name">{s.name}</span>
            <span className="sc-count" style={{ color: s.color }}>{s.memberCount}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
