import type { Repo } from './Globe'

export interface ForkArc {
  id: string
  source: string
  target: string
  strength: number
  startMonth: number
  endMonth: number
  reason: string
}

export interface ContributorOverlap {
  id: string
  a: string
  b: string
  overlapScore: number
  sharedSignals: string[]
}

export interface OrgConstellation {
  id: string
  owner: string
  repoNames: string[]
  totalStars: number
  topLang: string
}

export interface AIRecommendation {
  id: string
  title: string
  rationale: string
  repoNames: string[]
  confidence: number
}

export interface Phase4Insights {
  months: string[]
  forkArcs: ForkArc[]
  overlaps: ContributorOverlap[]
  constellations: OrgConstellation[]
  recommendations: AIRecommendation[]
}

function hash(str: string) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

function topLang(repos: Repo[]) {
  const tally: Record<string, number> = {}
  repos.forEach(r => { tally[r.lang] = (tally[r.lang] ?? 0) + r.stars })
  return Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Other'
}

function monthLabels(count = 18): string[] {
  const labels: string[] = []
  const now = new Date()
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    labels.push(d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }))
  }
  return labels
}

export function buildPhase4Insights(repos: Repo[]): Phase4Insights {
  const months = monthLabels()
  const monthCount = months.length
  const byStars = [...repos].sort((a, b) => b.stars - a.stars).slice(0, 120)

  const arcs: ForkArc[] = []
  for (let i = 0; i < byStars.length; i++) {
    for (let j = i + 1; j < byStars.length; j++) {
      const a = byStars[i]
      const b = byStars[j]
      if (a.owner === b.owner) continue
      const aTopics = new Set(a.topics.split(',').filter(Boolean))
      const bTopics = b.topics.split(',').filter(Boolean)
      const shared = bTopics.filter(t => aTopics.has(t))
      if (shared.length === 0) continue
      const strength = (Math.min(a.forks, b.forks) / Math.max(a.stars, b.stars, 1)) + shared.length * 0.09
      if (strength < 0.12) continue
      const startMonth = hash(`${a.name}:${b.name}`) % Math.max(monthCount - 6, 1)
      const span = 3 + (hash(`${b.name}:${a.name}`) % 6)
      arcs.push({
        id: `${a.name}->${b.name}`,
        source: a.name,
        target: b.name,
        strength,
        startMonth,
        endMonth: Math.min(monthCount - 1, startMonth + span),
        reason: shared.slice(0, 2).join(' + ') || 'fork affinity',
      })
    }
  }

  const overlaps = arcs
    .slice()
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 36)
    .map((arc, idx) => ({
      id: `ov-${idx}`,
      a: arc.source,
      b: arc.target,
      overlapScore: Math.min(99, Math.round(arc.strength * 100)),
      sharedSignals: arc.reason.split(' + '),
    }))

  const byOwner = new Map<string, Repo[]>()
  repos.forEach(repo => {
    const owner = repo.owner?.trim()
    if (!owner) return
    if (!byOwner.has(owner)) byOwner.set(owner, [])
    byOwner.get(owner)!.push(repo)
  })
  const constellations = [...byOwner.entries()]
    .filter(([, rs]) => rs.length >= 2)
    .map(([owner, rs]) => ({
      id: owner,
      owner,
      repoNames: rs.map(r => r.name),
      totalStars: rs.reduce((sum, r) => sum + r.stars, 0),
      topLang: topLang(rs),
    }))
    .sort((a, b) => b.totalStars - a.totalStars)
    .slice(0, 12)

  const recommendations: AIRecommendation[] = constellations.slice(0, 5).map((c, idx) => ({
    id: `rec-${idx}`,
    title: `Explore ${c.owner}'s ${c.topLang} cluster`,
    rationale: `High cohesion org constellation with ${c.repoNames.length} repos and strong fork gravity.`,
    repoNames: c.repoNames.slice(0, 3),
    confidence: Math.max(62, Math.min(96, 58 + c.repoNames.length * 7)),
  }))

  return {
    months,
    forkArcs: arcs.sort((a, b) => b.strength - a.strength).slice(0, 140),
    overlaps,
    constellations,
    recommendations,
  }
}
