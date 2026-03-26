// ── SocietyPanel.tsx ──────────────────────────────────────────────────────────
// Phase 3: Society detail panel — slides in from the left

import { useMemo } from 'react'
import type { Society, SocietyTier, ActivityLevel } from './societies'
import { getLangColor, fmt } from './Globe'
import { TIER_BADGES, ACTIVITY_BADGES } from './societies'

interface SocietyPanelProps {
  society: Society | null
  onClose: () => void
  onSelectRepo: (repoName: string) => void
}

const TIER_LABELS: Record<SocietyTier, string> = {
  elite: 'Elite Society',
  rising: 'Rising Society',
  local: 'Local Society',
}
const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  hot: 'Hot',
  accelerating: 'Accelerating',
  steady: 'Steady',
  dormant: 'Dormant',
}
const TIER_COLORS: Record<SocietyTier, string> = {
  elite: '#ffd700',
  rising: '#60a5fa',
  local: '#4ade80',
}
const ACTIVITY_COLORS: Record<ActivityLevel, string> = {
  hot: '#ff6b35',
  accelerating: '#fbbf24',
  steady: '#60a5fa',
  dormant: '#64748b',
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', flex: 1 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
    </div>
  )
}

export default function SocietyPanel({ society, onClose, onSelectRepo }: SocietyPanelProps) {
  const topRepos = useMemo(() => society?.repos.slice(0, 12) ?? [], [society])

  const langBreakdown = useMemo(() => {
    if (!society) return []
    const counts: Record<string, number> = {}
    society.repos.forEach(r => { counts[r.lang] = (counts[r.lang] || 0) + 1 })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [society])

  const totalForBreakdown = langBreakdown.reduce((s, [, c]) => s + c, 0)

  return (
    <div className={`society-panel ${society ? 'open' : ''}`}>
      {society && (
        <>
          {/* Header */}
          <div className="sp-header" style={{ borderColor: society.color + '40' }}>
            <button className="sp-close" onClick={onClose}>×</button>

            <div className="sp-badge-row">
              <span className="sp-tier-badge" style={{ color: TIER_COLORS[society.tier], borderColor: TIER_COLORS[society.tier] + '50' }}>
                {TIER_BADGES[society.tier]} {TIER_LABELS[society.tier]}
              </span>
              <span className="sp-activity-badge" style={{ color: ACTIVITY_COLORS[society.activity], borderColor: ACTIVITY_COLORS[society.activity] + '50' }}>
                {ACTIVITY_BADGES[society.activity]} {ACTIVITY_LABELS[society.activity]}
              </span>
            </div>

            <div className="sp-name" style={{ color: society.color }}>{society.name}</div>
            <div className="sp-desc">{society.description}</div>
          </div>

          {/* Stats Row */}
          <div className="sp-stats-row">
            <div className="sp-stat">
              <span className="sp-stat-val" style={{ color: society.color }}>{society.memberCount}</span>
              <span className="sp-stat-key">repos</span>
            </div>
            <div className="sp-stat-divider" />
            <div className="sp-stat">
              <span className="sp-stat-val">{fmt(Math.round(society.avgStars))}</span>
              <span className="sp-stat-key">avg ⭐</span>
            </div>
            <div className="sp-stat-divider" />
            <div className="sp-stat">
              <span className="sp-stat-val">{fmt(society.totalStars)}</span>
              <span className="sp-stat-key">total ⭐</span>
            </div>
          </div>

          {/* Language Breakdown */}
          <div className="sp-section">
            <div className="sp-section-label">Language Mix</div>
            <div className="sp-lang-bars">
              {langBreakdown.map(([lang, count]) => (
                <div key={lang} className="sp-lang-row">
                  <span className="sp-lang-dot" style={{ background: getLangColor(lang) }} />
                  <span className="sp-lang-name">{lang}</span>
                  <MiniBar value={count} max={totalForBreakdown} color={getLangColor(lang)} />
                  <span className="sp-lang-pct">{Math.round((count / totalForBreakdown) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Repos */}
          <div className="sp-section sp-section-repos">
            <div className="sp-section-label">Top Repositories</div>
            <div className="sp-repo-list">
              {topRepos.map((repo, i) => (
                <div
                  key={repo.name}
                  className="sp-repo-item"
                  onClick={() => onSelectRepo(repo.name)}
                  style={{ '--accent': getLangColor(repo.lang) } as React.CSSProperties}
                >
                  <span className="sp-repo-rank">#{i + 1}</span>
                  <div className="sp-repo-info">
                    <div className="sp-repo-name">{repo.name}</div>
                    <div className="sp-repo-meta">
                      <span style={{ color: getLangColor(repo.lang), fontSize: 9 }}>⬤</span>
                      <span>{repo.lang}</span>
                      <span className="sp-repo-loc">{repo.loc.split(',').pop()?.trim()}</span>
                    </div>
                  </div>
                  <div className="sp-repo-stars">⭐ {fmt(repo.stars)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Coordinates */}
          <div className="sp-footer">
            <span>📍 {society.centerLat.toFixed(1)}°, {society.centerLng.toFixed(1)}°</span>
            <span>{society.name}</span>
          </div>
        </>
      )}
    </div>
  )
}
