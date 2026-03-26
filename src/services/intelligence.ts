import type { Repo } from '../components/Globe'

export interface DomainOption {
  name: string
  count: number
  color: string
}

export interface CountrySignal {
  country: string
  coords: [number, number]
  repoCount: number
  totalStars: number
  dominantDomain: string
  topRepo: string
}

export interface RegionSignal {
  region: string
  repoCount: number
  totalStars: number
  topLanguage: string
}

export interface NearbyRepo {
  repo: Repo
  distanceKm: number
}

const DOMAIN_COLORS: Record<string, string> = {
  AI: '#52d2ff',
  Web: '#4ade80',
  Mobile: '#fb923c',
  DevOps: '#f472b6',
  Data: '#c084fc',
  Security: '#f87171',
  Systems: '#fde68a',
  Cloud: '#60a5fa',
  Tools: '#94a3b8',
  Learning: '#ffd166',
}

const DOMAIN_RULES: Array<{ name: string; terms: string[] }> = [
  { name: 'AI', terms: ['ai', 'llm', 'ml', 'machine-learning', 'deep-learning', 'rag', 'agent', 'model', 'transformer'] },
  { name: 'Web', terms: ['web', 'frontend', 'backend', 'react', 'vue', 'next', 'css', 'html', 'javascript', 'typescript'] },
  { name: 'Mobile', terms: ['android', 'ios', 'mobile', 'flutter', 'react-native', 'swift'] },
  { name: 'DevOps', terms: ['devops', 'docker', 'kubernetes', 'terraform', 'ansible', 'ci', 'cd', 'monitoring'] },
  { name: 'Data', terms: ['data', 'database', 'analytics', 'etl', 'vector', 'sql', 'warehouse'] },
  { name: 'Security', terms: ['security', 'auth', 'oauth', 'crypto', 'hacking', 'privacy'] },
  { name: 'Systems', terms: ['compiler', 'kernel', 'linux', 'rust', 'c++', 'engine', 'runtime'] },
  { name: 'Cloud', terms: ['cloud', 'serverless', 'aws', 'azure', 'gcp', 'infra', 'platform'] },
]

const LANGUAGE_DOMAINS: Record<string, string> = {
  TypeScript: 'Web',
  JavaScript: 'Web',
  HTML: 'Web',
  Dart: 'Mobile',
  Swift: 'Mobile',
  Kotlin: 'Mobile',
  Python: 'AI',
  Jupyter: 'Data',
  'Jupyter Notebook': 'Data',
  Shell: 'DevOps',
  Go: 'Cloud',
  Rust: 'Systems',
  C: 'Systems',
  'C++': 'Systems',
}

export const REGION_BOUNDS: Record<string, { latMin: number; latMax: number; lngMin: number; lngMax: number }> = {
  'North America': { latMin: 24, latMax: 72, lngMin: -168, lngMax: -52 },
  Europe: { latMin: 35, latMax: 72, lngMin: -12, lngMax: 45 },
  Asia: { latMin: 5, latMax: 55, lngMin: 45, lngMax: 150 },
  'South America': { latMin: -56, latMax: 13, lngMin: -82, lngMax: -34 },
  Oceania: { latMin: -47, latMax: -10, lngMin: 110, lngMax: 180 },
  Africa: { latMin: -35, latMax: 38, lngMin: -18, lngMax: 52 },
}

function topKey(record: Record<string, number>, fallback = 'Mixed') {
  return Object.entries(record).sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback
}

function getCountry(repo: Repo) {
  return repo.loc.split(',').pop()?.trim() || 'Unknown'
}

export function inferRegion(lat: number, lng: number) {
  return Object.entries(REGION_BOUNDS).find(([, r]) => (
    lat >= r.latMin && lat <= r.latMax && lng >= r.lngMin && lng <= r.lngMax
  ))?.[0] ?? 'Other'
}

function getRegion(repo: Repo) {
  return Object.entries(REGION_BOUNDS).find(([, r]) => (
    repo.lat >= r.latMin && repo.lat <= r.latMax && repo.lng >= r.lngMin && repo.lng <= r.lngMax
  ))?.[0] ?? 'Other'
}

export function inferDomain(repo: Repo) {
  const haystack = `${repo.name} ${repo.desc} ${repo.topics} ${repo.lang}`.toLowerCase()
  const direct = DOMAIN_RULES.find((rule) => rule.terms.some((term) => haystack.includes(term)))
  if (direct) return direct.name
  return LANGUAGE_DOMAINS[repo.lang] ?? 'Tools'
}

export function getDomainColor(domain: string) {
  return DOMAIN_COLORS[domain] ?? '#94a3b8'
}

export function buildDomainOptions(repos: Repo[]): DomainOption[] {
  const counts: Record<string, number> = {}
  repos.forEach((repo) => {
    const domain = inferDomain(repo)
    counts[domain] = (counts[domain] ?? 0) + 1
  })
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count, color: getDomainColor(name) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
}

export function buildCountrySignals(repos: Repo[]): CountrySignal[] {
  const map = new Map<string, CountrySignal & { domainCounts: Record<string, number>; topStars: number }>()
  repos.forEach((repo) => {
    const country = getCountry(repo)
    if (!map.has(country)) {
      map.set(country, {
        country,
        coords: [repo.lng, repo.lat],
        repoCount: 0,
        totalStars: 0,
        dominantDomain: 'Tools',
        topRepo: repo.name,
        domainCounts: {},
        topStars: repo.stars,
      })
    }
    const item = map.get(country)!
    const domain = inferDomain(repo)
    item.repoCount += 1
    item.totalStars += repo.stars
    item.domainCounts[domain] = (item.domainCounts[domain] ?? 0) + 1
    if (repo.stars > item.topStars) {
      item.topRepo = repo.name
      item.topStars = repo.stars
    }
  })
  return [...map.values()]
    .map(({ domainCounts, topStars: _topStars, ...item }) => ({ ...item, dominantDomain: topKey(domainCounts, 'Tools') }))
    .sort((a, b) => b.totalStars - a.totalStars)
}

export function buildRegionSignals(repos: Repo[]): RegionSignal[] {
  const map = new Map<string, { repoCount: number; totalStars: number; langs: Record<string, number> }>()
  repos.forEach((repo) => {
    const region = getRegion(repo)
    if (!map.has(region)) map.set(region, { repoCount: 0, totalStars: 0, langs: {} })
    const item = map.get(region)!
    item.repoCount += 1
    item.totalStars += repo.stars
    item.langs[repo.lang] = (item.langs[repo.lang] ?? 0) + 1
  })
  return [...map.entries()]
    .map(([region, item]) => ({
      region,
      repoCount: item.repoCount,
      totalStars: item.totalStars,
      topLanguage: topKey(item.langs, 'Mixed'),
    }))
    .sort((a, b) => b.totalStars - a.totalStars)
}

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const dLat = toRadians(bLat - aLat)
  const dLng = toRadians(bLng - aLng)
  const q =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(aLat)) * Math.cos(toRadians(bLat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q))
}

export function buildNearbyRepos(
  repos: Repo[],
  origin: { lat: number; lng: number },
  domain: string | null,
  lang: string | null,
) {
  return repos
    .filter((repo) => !domain || inferDomain(repo) === domain)
    .filter((repo) => !lang || repo.lang === lang)
    .map((repo) => ({
      repo,
      distanceKm: distanceKm(origin.lat, origin.lng, repo.lat, repo.lng),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
}

export function summarizeNearby(repos: NearbyRepo[]) {
  const top = repos.slice(0, 12)
  const langs: Record<string, number> = {}
  const domains: Record<string, number> = {}
  top.forEach(({ repo }) => {
    langs[repo.lang] = (langs[repo.lang] ?? 0) + 1
    domains[inferDomain(repo)] = (domains[inferDomain(repo)] ?? 0) + 1
  })
  return {
    topLanguage: topKey(langs, 'Mixed'),
    topDomain: topKey(domains, 'Tools'),
    avgDistanceKm: top.length ? Math.round(top.reduce((sum, item) => sum + item.distanceKm, 0) / top.length) : 0,
  }
}
