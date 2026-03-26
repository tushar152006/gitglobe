// ── societies.ts ─────────────────────────────────────────────────────────────
// Phase 3: Society classification engine
// Axes: Geography · Popularity · Activity

import type { Repo } from './Globe'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SocietyTier = 'elite' | 'rising' | 'local'
export type ActivityLevel = 'hot' | 'accelerating' | 'steady' | 'dormant'

export interface Society {
  id: string
  name: string
  shortName: string
  region: string
  tier: SocietyTier
  activity: ActivityLevel
  color: string          // primary hex
  glowColor: string      // glow hex
  borderColor: string    // globe border hex
  repos: Repo[]
  totalStars: number
  avgStars: number
  topLang: string
  centerLat: number
  centerLng: number
  radiusDeg: number      // approximate geographic radius
  memberCount: number
  description: string
  badge: string          // emoji badge
}

// ── Geographic Regions ────────────────────────────────────────────────────────

const GEO_REGIONS: Record<string, {
  name: string; latMin: number; latMax: number; lngMin: number; lngMax: number
  centerLat: number; centerLng: number; color: string; glowColor: string; borderColor: string
}> = {
  'us-hub':        { name: 'US Innovation Hub',       latMin:30,  latMax:50,  lngMin:-130, lngMax:-65,  centerLat:39,   centerLng:-98,  color:'#4f9eff', glowColor:'#4f9eff40', borderColor:'#4f9eff' },
  'eu-network':    { name: 'Europe Tech Network',     latMin:35,  latMax:72,  lngMin:-12,  lngMax:45,   centerLat:52,   centerLng:13,   color:'#a78bfa', glowColor:'#a78bfa40', borderColor:'#a78bfa' },
  'india-cluster': { name: 'India Developer Cluster', latMin:6,   latMax:36,  lngMin:65,   lngMax:98,   centerLat:20,   centerLng:78,   color:'#fb923c', glowColor:'#fb923c40', borderColor:'#fb923c' },
  'east-asia':     { name: 'East Asia Rising',        latMin:20,  latMax:50,  lngMin:100,  lngMax:145,  centerLat:35,   centerLng:120,  color:'#f472b6', glowColor:'#f472b640', borderColor:'#f472b6' },
  'latam':         { name: 'LatAm Builders',          latMin:-40, latMax:15,  lngMin:-82,  lngMax:-34,  centerLat:-15,  centerLng:-55,  color:'#4ade80', glowColor:'#4ade8040', borderColor:'#4ade80' },
  'mena':          { name: 'MENA Tech Hub',           latMin:15,  latMax:42,  lngMin:25,   lngMax:65,   centerLat:28,   centerLng:45,   color:'#fbbf24', glowColor:'#fbbf2440', borderColor:'#fbbf24' },
  'southeast-asia':{ name: 'Southeast Asia Rising',   latMin:-11, latMax:22,  lngMin:95,   lngMax:140,  centerLat:10,   centerLng:115,  color:'#34d399', glowColor:'#34d39940', borderColor:'#34d399' },
  'oceania':       { name: 'Oceania Cluster',         latMin:-47, latMax:-10, lngMin:110,  lngMax:180,  centerLat:-28,  centerLng:150,  color:'#67e8f9', glowColor:'#67e8f940', borderColor:'#67e8f9' },
  'africa':        { name: 'Africa Tech Rising',      latMin:-35, latMax:38,  lngMin:-18,  lngMax:52,   centerLat:5,    centerLng:22,   color:'#f87171', glowColor:'#f8717140', borderColor:'#f87171' },
}

// ── Classification Helpers ────────────────────────────────────────────────────

function getRegionKey(lat: number, lng: number): string | null {
  for (const [key, r] of Object.entries(GEO_REGIONS)) {
    if (lat >= r.latMin && lat <= r.latMax && lng >= r.lngMin && lng <= r.lngMax) return key
  }
  return null
}

function classifyTier(avgStars: number, memberCount: number): SocietyTier {
  const score = avgStars * Math.log10(memberCount + 1)
  if (score > 50000) return 'elite'
  if (score > 8000)  return 'rising'
  return 'local'
}

function classifyActivity(repos: Repo[]): ActivityLevel {
  const avgRatio = repos.reduce((s, r) => s + r.forks / Math.max(r.stars, 1), 0) / repos.length
  const hasHeavyweights = repos.some(r => r.stars > 50000)
  if (avgRatio > 0.3 && hasHeavyweights) return 'hot'
  if (avgRatio > 0.2) return 'accelerating'
  if (avgRatio > 0.08) return 'steady'
  return 'dormant'
}

function topLanguage(repos: Repo[]): string {
  const counts: Record<string, number> = {}
  repos.forEach(r => { counts[r.lang] = (counts[r.lang] || 0) + r.stars })
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Unknown'
}

const TIER_BADGES: Record<SocietyTier, string> = { elite: '👑', rising: '🚀', local: '🌱' }
const ACTIVITY_BADGES: Record<ActivityLevel, string> = { hot: '🔥', accelerating: '⚡', steady: '💫', dormant: '🌙' }

function societyDescription(regionName: string, tier: SocietyTier, activity: ActivityLevel, topLang: string): string {
  const tierDesc = tier === 'elite' ? 'Elite hub with globally-impactful repos' : tier === 'rising' ? 'Fast-growing developer ecosystem' : 'Vibrant local community'
  const actDesc = activity === 'hot' ? 'blazing with activity' : activity === 'accelerating' ? 'rapidly accelerating' : activity === 'steady' ? 'steadily active' : 'quietly building'
  return `${tierDesc} in ${regionName}, ${actDesc}. Dominated by ${topLang} developers.`
}

// ── Main Builder ──────────────────────────────────────────────────────────────

export function buildSocieties(repos: Repo[]): Society[] {
  const buckets = new Map<string, Repo[]>()

  repos.forEach(r => {
    const key = getRegionKey(r.lat, r.lng)
    if (!key) return
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(r)
  })

  const societies: Society[] = []

  buckets.forEach((members, key) => {
    if (members.length < 3) return
    const geo = GEO_REGIONS[key]
    const totalStars = members.reduce((s, r) => s + r.stars, 0)
    const avgStars = totalStars / members.length
    const tier = classifyTier(avgStars, members.length)
    const activity = classifyActivity(members)
    const topLang = topLanguage(members)
    const sorted = [...members].sort((a, b) => b.stars - a.stars)

    const wLat = members.reduce((s, r) => s + r.lat * r.stars, 0) / totalStars
    const wLng = members.reduce((s, r) => s + r.lng * r.stars, 0) / totalStars

    const maxDist = members.reduce((mx, r) => {
      const d = Math.sqrt((r.lat - wLat) ** 2 + (r.lng - wLng) ** 2)
      return Math.max(mx, d)
    }, 0)

    societies.push({
      id: key,
      name: geo.name,
      shortName: geo.name.split(' ')[0],
      region: key,
      tier,
      activity,
      color: geo.color,
      glowColor: geo.glowColor,
      borderColor: geo.borderColor,
      repos: sorted,
      totalStars,
      avgStars,
      topLang,
      centerLat: wLat,
      centerLng: wLng,
      radiusDeg: Math.max(maxDist * 0.6, 8),
      memberCount: members.length,
      description: societyDescription(geo.name, tier, activity, topLang),
      badge: TIER_BADGES[tier] + ACTIVITY_BADGES[activity],
    })
  })

  return societies.sort((a, b) => b.totalStars - a.totalStars)
}

export { GEO_REGIONS, TIER_BADGES, ACTIVITY_BADGES }
