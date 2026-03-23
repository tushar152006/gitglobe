import type { VercelRequest, VercelResponse } from '@vercel/node'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN

interface GitHubRepo {
  full_name: string
  description: string | null
  stargazers_count: number
  forks_count: number
  language: string | null
  owner: {
    login: string
    type: string
  }
  topics: string[]
  homepage: string | null
}

interface GitHubSearchResponse {
  items: GitHubRepo[]
  total_count: number
}

// Same city map subset for server-side geocoding
const CITY_MAP: Record<string, [number, number, string] | null> = {
  "san francisco": [37.7749, -122.4194, "San Francisco, CA, USA"],
  "new york":      [40.7128, -74.0060,  "New York, USA"],
  "seattle":       [47.6062, -122.3321, "Seattle, WA, USA"],
  "london":        [51.5074, -0.1278,   "London, UK"],
  "berlin":        [52.5200, 13.4050,   "Berlin, Germany"],
  "paris":         [48.8566, 2.3522,    "Paris, France"],
  "tokyo":         [35.6762, 139.6503,  "Tokyo, Japan"],
  "beijing":       [39.9042, 116.4074,  "Beijing, China"],
  "shanghai":      [31.2304, 121.4737,  "Shanghai, China"],
  "bangalore":     [12.9716, 77.5946,   "Bangalore, India"],
  "mumbai":        [19.0760, 72.8777,   "Mumbai, India"],
  "delhi":         [28.6139, 77.2090,   "New Delhi, India"],
  "singapore":     [1.3521,  103.8198,  "Singapore"],
  "hong kong":     [22.3193, 114.1694,  "Hong Kong"],
  "seoul":         [37.5665, 126.9780,  "Seoul, South Korea"],
  "sydney":        [-33.8688, 151.2093, "Sydney, Australia"],
  "toronto":       [43.6532, -79.3832,  "Toronto, Canada"],
  "amsterdam":     [52.3676, 4.9041,    "Amsterdam, Netherlands"],
  "madrid":        [40.4168, -3.7038,   "Madrid, Spain"],
  "moscow":        [55.7558, 37.6173,   "Moscow, Russia"],
  "sao paulo":     [-23.5505, -46.6333, "São Paulo, Brazil"],
  "berlin":        [52.5200, 13.4050,   "Berlin, Germany"],
  "stockholm":     [59.3293, 18.0686,   "Stockholm, Sweden"],
  "warsaw":        [52.2297, 21.0122,   "Warsaw, Poland"],
  "prague":        [50.0755, 14.4378,   "Prague, Czech Republic"],
  "zurich":        [47.3769, 8.5417,    "Zurich, Switzerland"],
  "oslo":          [59.9139, 10.7522,   "Oslo, Norway"],
  "helsinki":      [60.1699, 24.9384,   "Helsinki, Finland"],
  "istanbul":      [41.0082, 28.9784,   "Istanbul, Turkey"],
  "cairo":         [30.0444, 31.2357,   "Cairo, Egypt"],
  "lagos":         [6.5244,  3.3792,    "Lagos, Nigeria"],
  "nairobi":       [-1.2921, 36.8219,   "Nairobi, Kenya"],
  "johannesburg":  [-26.2041, 28.0473,  "Johannesburg, South Africa"],
  "buenos aires":  [-34.6037, -58.3816, "Buenos Aires, Argentina"],
  "mexico city":   [19.4326, -99.1332,  "Mexico City, Mexico"],
  "bogota":        [4.7110, -74.0721,   "Bogotá, Colombia"],
  "tel aviv":      [32.0853, 34.7818,   "Tel Aviv, Israel"],
  "dubai":         [25.2048, 55.2708,   "Dubai, UAE"],
  "usa":           [37.0902, -95.7129,  "USA"],
  "united states": [37.0902, -95.7129,  "USA"],
  "uk":            [51.5074, -0.1278,   "London, UK"],
  "germany":       [51.1657, 10.4515,   "Germany"],
  "france":        [46.2276, 2.2137,    "France"],
  "india":         [20.5937, 78.9629,   "India"],
  "china":         [35.8617, 104.1954,  "China"],
  "japan":         [36.2048, 138.2529,  "Japan"],
  "canada":        [56.1304, -106.3468, "Canada"],
  "australia":     [-25.2744, 133.7751, "Australia"],
  "russia":        [61.5240, 105.3188,  "Russia"],
  "brazil":        [-14.2350, -51.9253, "Brazil"],
  "south korea":   [35.9078, 127.7669,  "South Korea"],
  "netherlands":   [52.1326, 5.2913,    "Netherlands"],
  "sweden":        [60.1282, 18.6435,   "Sweden"],
  "switzerland":   [46.8182, 8.2275,    "Switzerland"],
  "norway":        [60.4720, 8.4689,    "Norway"],
  "finland":       [61.9241, 25.7482,   "Finland"],
  "poland":        [51.9194, 19.1451,   "Poland"],
  "spain":         [40.4637, -3.7492,   "Spain"],
  "italy":         [41.8719, 12.5674,   "Italy"],
  "portugal":      [39.3999, -8.2245,   "Portugal"],
  "taiwan":        [23.6978, 120.9605,  "Taiwan"],
  "remote":        null,
  "worldwide":     null,
  "global":        null,
}

function geocodeString(raw: string): [number, number, string] | null {
  if (!raw) return null
  const text = raw.toLowerCase().replace(/[,.()\[\]]+/g, ' ').replace(/\s+/g, ' ').trim()
  const skip = new Set(["remote","worldwide","global","internet","earth","anywhere","unknown"])
  if (skip.has(text) || text.length < 2) return null

  if (text in CITY_MAP) return CITY_MAP[text] ?? null

  let best: [number, number, string] | null = null
  let bestLen = 0
  for (const [key, val] of Object.entries(CITY_MAP)) {
    if (val && text.includes(key) && key.length > bestLen) {
      best = val; bestLen = key.length
    }
  }
  return best
}

async function fetchUserLocation(username: string): Promise<[number, number, string] | null> {
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "GitGlobe/2.0",
  }
  if (GITHUB_TOKEN) headers["Authorization"] = `Bearer ${GITHUB_TOKEN}`

  try {
    const res  = await fetch(`https://api.github.com/users/${username}`, { headers })
    if (!res.ok) return null
    const data = await res.json()
    const loc  = (data.location || "").trim()
    if (loc) return geocodeString(loc)
  } catch { /* ignore */ }
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
  if (req.method === "OPTIONS") return res.status(200).end()
  if (req.method !== "GET")    return res.status(405).json({ error: "Method not allowed" })

  const { q, per_page = "10" } = req.query
  if (!q || typeof q !== "string") {
    return res.status(400).json({ error: "Missing query parameter q" })
  }

  const headers: Record<string, string> = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "GitGlobe/2.0",
  }
  if (GITHUB_TOKEN) headers["Authorization"] = `Bearer ${GITHUB_TOKEN}`

  try {
    const limit   = Math.min(parseInt(per_page as string) || 10, 20)
    const ghUrl   = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${limit}`
    const ghRes   = await fetch(ghUrl, { headers })

    if (!ghRes.ok) {
      const err = await ghRes.json()
      return res.status(ghRes.status).json({ error: err.message || "GitHub API error" })
    }

    const data: GitHubSearchResponse = await ghRes.json()

    // Geocode each result
    const repos = await Promise.all(
      data.items.map(async (item) => {
        const loc = await fetchUserLocation(item.owner.login)
        return {
          name:   item.full_name,
          desc:   (item.description || "").slice(0, 120),
          stars:  item.stargazers_count,
          forks:  item.forks_count,
          lang:   item.language || "Other",
          owner:  item.owner.login,
          lat:    loc ? loc[0] : null,
          lng:    loc ? loc[1] : null,
          loc:    loc ? loc[2] : "Unknown",
          topics: (item.topics || []).slice(0, 6).join(",") || (item.language || "").toLowerCase(),
          live:   true,  // flag to distinguish live results from dataset
        }
      })
    )

    return res.status(200).json({
      repos,
      total_count: data.total_count,
      query: q,
    })

  } catch (err) {
    console.error("Search API error:", err)
    return res.status(500).json({ error: "Internal server error" })
  }
}
