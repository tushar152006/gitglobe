import type { AIRecommendation } from '../types/relationships'

export async function fetchRecommendations(params: { repoId?: string; lat?: number; lng?: number }) {
  const search = new URLSearchParams()
  if (params.repoId) search.set('repo_id', params.repoId)
  if (typeof params.lat === 'number') search.set('lat', String(params.lat))
  if (typeof params.lng === 'number') search.set('lng', String(params.lng))

  const res = await fetch(`/api/recommendations?${search.toString()}`)
  if (!res.ok) throw new Error('Failed recommendations request')
  return res.json() as Promise<AIRecommendation[]>
}
