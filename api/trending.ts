import type { VercelRequest, VercelResponse } from '@vercel/node'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' })

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'GitGlobe/2.0',
  }
  if (GITHUB_TOKEN) headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`

  try {
    // Get repos created in last 7 days with 50+ stars — these are genuinely trending
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0]

    const queries = [
      `created:>${since} stars:>50`,
      `created:>${since} stars:>20 language:Python`,
      `created:>${since} stars:>20 language:TypeScript`,
      `created:>${since} stars:>20 language:Rust`,
      `created:>${since} stars:>20 language:Go`,
    ]

    const seen = new Set<string>()
    const allRepos: any[] = []

    for (const q of queries) {
      if (allRepos.length >= 50) break
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=20`
      const r   = await fetch(url, { headers })
      if (!r.ok) continue
      const data = await r.json()
      for (const item of (data.items || [])) {
        if (!seen.has(item.full_name)) {
          seen.add(item.full_name)
          allRepos.push(item)
        }
      }
      await new Promise(r => setTimeout(r, 200))
    }

    // Sort by stars descending — most starred new repos = trending
    allRepos.sort((a, b) => b.stargazers_count - a.stargazers_count)

    const trending = allRepos.slice(0, 30).map(item => ({
      name:        item.full_name,
      desc:        (item.description || '').slice(0, 120),
      stars:       item.stargazers_count,
      forks:       item.forks_count,
      lang:        item.language || 'Other',
      owner:       item.owner.login,
      topics:      (item.topics || []).slice(0, 6).join(','),
      created_at:  item.created_at,
      pushed_at:   item.pushed_at,
      trending:    true,
    }))

    // Cache for 30 minutes
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate')
    return res.status(200).json({ trending, fetched_at: new Date().toISOString() })

  } catch (err) {
    console.error('Trending API error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
