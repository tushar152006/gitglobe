import type { VercelRequest, VercelResponse } from '@vercel/node'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

interface RepoRecord {
  name: string
  desc: string
  stars: number
  forks: number
  owner: string
  lat: number
  lng: number
  loc: string
  topics: string
}

function distanceScore(latA: number, lngA: number, latB: number, lngB: number) {
  const dLat = latA - latB
  const dLng = lngA - lngB
  const dist = Math.sqrt(dLat * dLat + dLng * dLng)
  return Math.max(0, 1 - dist / 180)
}

function overlap(setA: Set<string>, setB: Set<string>) {
  if (setA.size === 0 || setB.size === 0) return 0
  let inter = 0
  setA.forEach((x) => { if (setB.has(x)) inter++ })
  return inter / Math.max(setA.size, setB.size)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const repoId = typeof req.query.repo_id === 'string' ? req.query.repo_id : ''
  const lat = Number(req.query.lat ?? 0)
  const lng = Number(req.query.lng ?? 0)

  const reposPath = path.resolve(process.cwd(), 'public/data/repos.json')
  const repos = JSON.parse(await readFile(reposPath, 'utf8')) as RepoRecord[]
  const source = repos.find((r) => r.name === repoId) ?? repos[0]
  const sourceTopics = new Set((source.topics || '').split(',').filter(Boolean))

  const recs = repos
    .filter((r) => r.name !== source.name)
    .map((candidate) => {
      const candTopics = new Set((candidate.topics || '').split(',').filter(Boolean))
      const similarity = overlap(sourceTopics, candTopics)
      const sameRegion = distanceScore(lat || source.lat, lng || source.lng, candidate.lat, candidate.lng)
      const sharedContributors = overlap(new Set(source.owner.split('-')), new Set(candidate.owner.split('-')))
      const popularity = Math.min(1, Math.log10(candidate.stars + 1) / 6)
      const score = similarity * 0.4 + sameRegion * 0.2 + sharedContributors * 0.2 + popularity * 0.2
      return {
        repo_id: candidate.name,
        score: Number(score.toFixed(4)),
        reason: `Similarity ${(similarity * 100).toFixed(0)}% · Region ${(sameRegion * 100).toFixed(0)}%`,
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)

  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate')
  return res.status(200).json(recs)
}
