// ── App.tsx (Phase 3) ─────────────────────────────────────────────────────────
// Adds: Societies system · Pulse layer · Society detail panel

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import Globe, { getLangColor, fmt } from './components/Globe'
import type { Repo } from './components/Globe'
import SocietyPanel from './components/SocietyPanel'
import SocietyOverlay from './components/SocietyOverlay'
import { buildSocieties } from './components/societies'
import type { Society } from './components/societies'
import './App.css'

const REGIONS: Record<string, {latMin:number;latMax:number;lngMin:number;lngMax:number}> = {
  'North America': {latMin:24, latMax:72, lngMin:-168,lngMax:-52},
  'Europe':        {latMin:35, latMax:72, lngMin:-12, lngMax:45 },
  'Asia':          {latMin:5,  latMax:55, lngMin:45,  lngMax:150},
  'South America': {latMin:-56,latMax:13, lngMin:-82, lngMax:-34},
  'Oceania':       {latMin:-47,latMax:-10,lngMin:110, lngMax:180},
  'Africa':        {latMin:-35,latMax:38, lngMin:-18, lngMax:52 },
}

const STAR_FILTERS = [
  {label:'1k+',  min:1000  }, {label:'10k+', min:10000 },
  {label:'50k+', min:50000 }, {label:'100k+',min:100000},
]

function inRegion(repo: Repo, region: string) {
  const r = REGIONS[region]
  return r ? repo.lat>=r.latMin&&repo.lat<=r.latMax&&repo.lng>=r.lngMin&&repo.lng<=r.lngMax : false
}

function useCountUp(target: number, duration = 800) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!target) return
    let cur = 0
    const step = target/(duration/16)
    const t = setInterval(()=>{ cur=Math.min(cur+step,target); setVal(Math.round(cur)); if(cur>=target) clearInterval(t) },16)
    return ()=>clearInterval(t)
  }, [target])
  return val
}

interface LiveRepo {
  name: string; desc: string; stars: number; forks: number
  lang: string; owner: string; lat: number | null; lng: number | null
  loc: string; topics: string; live?: boolean
}
interface TrendingRepo { name:string; desc:string; stars:number; forks:number; lang:string; owner:string; topics:string; trending:boolean }

export default function App() {
  const [repos, setRepos]               = useState<Repo[]>([])
  const [selected, setSelected]         = useState<Repo|null>(null)
  const [flyTarget, setFlyTarget]       = useState<{lat:number;lng:number}|null>(null)
  const [query, setQuery]               = useState('')
  const [localResults, setLocalResults] = useState<Repo[]>([])
  const [liveResults,  setLiveResults]  = useState<LiveRepo[]>([])
  const [liveLoading,  setLiveLoading]  = useState(false)
  const [showResults,  setShowResults]  = useState(false)
  const [activeIdx,    setActiveIdx]    = useState(-1)
  const [loading,      setLoading]      = useState(true)
  const [loadPct,      setLoadPct]      = useState(0)
  const [tooltip,      setTooltip]      = useState<{repo:Repo;x:number;y:number}|null>(null)
  const [showFilters,  setShowFilters]  = useState(false)
  const [showAbout,    setShowAbout]    = useState(false)
  const [copied,       setCopied]       = useState(false)
  const [trendingRepos,   setTrendingRepos]   = useState<TrendingRepo[]>([])
  const [trendingMode,    setTrendingMode]    = useState(false)
  const [showTrending,    setShowTrending]    = useState(false)
  const [trendingLoading, setTrendingLoading] = useState(false)
  const [langFilter,   setLangFilter]   = useState<string|null>(null)
  const [regionFilter, setRegionFilter] = useState<string|null>(null)
  const [starsFilter,  setStarsFilter]  = useState<number|null>(null)

  // ── Phase 3 state ──────────────────────────────────────────────────────────
  const [activeSociety,   setActiveSociety]   = useState<Society|null>(null)
  const [showSocietyPanel,setShowSocietyPanel]= useState(false)
  const [showSocieties,   setShowSocieties]   = useState(false)
  const [pulseEnabled,    setPulseEnabled]    = useState(true)

  const searchRef = useRef<HTMLInputElement>(null)
  const liveTimer = useRef<ReturnType<typeof setTimeout>|null>(null)

  useEffect(() => {
    setLoadPct(30)
    fetch('/data/repos.json').then(r=>r.json()).then((data:Repo[])=>{
      setLoadPct(80); setRepos(data)
      setTimeout(()=>{setLoadPct(100);setTimeout(()=>setLoading(false),400)},300)
    }).catch(()=>setLoading(false))
  }, [])

  useEffect(() => {
    setTrendingLoading(true)
    fetch('/api/trending').then(r=>r.json()).then(data=>{
      setTrendingRepos(data.trending||[])
    }).catch(()=>{}).finally(()=>setTrendingLoading(false))
  }, [])

  // ── Build societies from loaded repos ────────────────────────────────────
  const societies = useMemo(() => buildSocieties(repos), [repos])

  const trendingNames = useMemo(()=>new Set(trendingRepos.map(r=>r.name)),[trendingRepos])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if(e.key==='/'&&document.activeElement!==searchRef.current){e.preventDefault();searchRef.current?.focus()}
      if(e.key==='Escape'){
        setShowResults(false);setShowFilters(false);setShowAbout(false);
        setShowTrending(false);setSelected(null);
        setShowSocietyPanel(false);setActiveSociety(null);setShowSocieties(false)
        searchRef.current?.blur()
      }
      if(e.key==='f'&&document.activeElement!==searchRef.current){setShowFilters(v=>!v);setShowResults(false)}
      if(e.key==='t'&&document.activeElement!==searchRef.current){setTrendingMode(v=>!v)}
      // Phase 3 shortcuts
      if(e.key==='s'&&document.activeElement!==searchRef.current){setShowSocieties(v=>!v)}
      if(e.key==='p'&&document.activeElement!==searchRef.current){setPulseEnabled(v=>!v)}
    }
    window.addEventListener('keydown',onKey)
    return()=>window.removeEventListener('keydown',onKey)
  },[])

  useEffect(()=>{
    const p=new URLSearchParams(window.location.search)
    if(p.get('lang'))    setLangFilter(p.get('lang'))
    if(p.get('region'))  setRegionFilter(p.get('region'))
    if(p.get('stars'))   setStarsFilter(Number(p.get('stars')))
  },[])

  const availableLangs = useMemo(()=>[...new Set(repos.map(r=>r.lang))].sort(),[repos])

  const filteredRepos = useMemo(()=>{
    const base = repos.filter(r=>{
      if(langFilter   && r.lang!==langFilter)      return false
      if(regionFilter && !inRegion(r,regionFilter)) return false
      if(starsFilter  && r.stars<starsFilter)       return false
      // Society filter: show only repos in the active society
      if(activeSociety && showSocietyPanel) {
        return activeSociety.repos.some((sr: Repo) => sr.name === r.name)
      }
      return true
    })
    return base.map(r=>trendingMode&&trendingNames.has(r.name)?{...r,trending:true}:r)
  },[repos,langFilter,regionFilter,starsFilter,trendingMode,trendingNames,activeSociety,showSocietyPanel])

  const activeFilterCount = [langFilter,regionFilter,starsFilter].filter(Boolean).length
  const countries = useMemo(()=>new Set(repos.map(r=>r.loc.split(',').pop()?.trim())).size,[repos])
  const repoCount    = useCountUp(filteredRepos.length)
  const countryCount = useCountUp(countries)

  function clearFilters(){setLangFilter(null);setRegionFilter(null);setStarsFilter(null)}

  useEffect(()=>{
    if(!query.trim()){setLocalResults([]);setLiveResults([]);setShowResults(false);return}
    const q=query.toLowerCase()
    setLocalResults(filteredRepos.filter(r=>
      r.name.toLowerCase().includes(q)||r.lang.toLowerCase().includes(q)||
      r.loc.toLowerCase().includes(q)||r.desc.toLowerCase().includes(q)||
      r.topics.toLowerCase().includes(q)
    ).slice(0,5))
    setShowResults(true); setActiveIdx(-1)
    if(liveTimer.current) clearTimeout(liveTimer.current)
    liveTimer.current=setTimeout(async()=>{
      setLiveLoading(true)
      try{
        const res=await fetch(`/api/search?q=${encodeURIComponent(query)}&per_page=8`)
        if(!res.ok) throw new Error()
        const data=await res.json()
        const localNames=new Set(repos.map(r=>r.name))
        setLiveResults((data.repos||[]).filter((r:LiveRepo)=>!localNames.has(r.name)))
      }catch{setLiveResults([])}
      finally{setLiveLoading(false)}
    },500)
  },[query,filteredRepos])

  function selectRepo(repo:LiveRepo){
    const r:Repo={...repo,lat:repo.lat??0,lng:repo.lng??0}
    setSelected(r)
    if(repo.lat&&repo.lng) setFlyTarget({lat:repo.lat,lng:repo.lng})
    setQuery(''); setShowResults(false)
  }

  function handleKeyDown(e:React.KeyboardEvent){
    const total=localResults.length+liveResults.length
    if(e.key==='ArrowDown'){setActiveIdx(i=>Math.min(i+1,total-1));e.preventDefault()}
    if(e.key==='ArrowUp')  {setActiveIdx(i=>Math.max(i-1,0));e.preventDefault()}
    if(e.key==='Enter'&&activeIdx>=0){const all=[...localResults,...liveResults];if(all[activeIdx])selectRepo(all[activeIdx] as LiveRepo)}
    if(e.key==='Escape'){setShowResults(false);setShowFilters(false);searchRef.current?.blur()}
  }

  const handleHover=useCallback((repo:Repo|null,x:number,y:number)=>{
    setTooltip(repo?{repo,x,y}:null)
  },[])

  function handleShare(){
    const params=new URLSearchParams()
    if(langFilter)   params.set('lang',langFilter)
    if(regionFilter) params.set('region',regionFilter)
    if(starsFilter)  params.set('stars',String(starsFilter))
    if(trendingMode) params.set('trending','1')
    if(activeSociety) params.set('society',activeSociety.id)
    const url=`${window.location.origin}${params.toString()?'?'+params.toString():''}`
    navigator.clipboard.writeText(url).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000)})
  }

  // ── Society handlers ───────────────────────────────────────────────────────
  function handleSocietyClick(s: Society) {
    setActiveSociety(s)
    setShowSocietyPanel(true)
    setFlyTarget({ lat: s.centerLat, lng: s.centerLng })
    setShowSocieties(false)
  }

  function handleSocietyClose() {
    setShowSocietyPanel(false)
    setActiveSociety(null)
  }

  function handleSocietyRepoSelect(repoName: string) {
    const repo = repos.find(r => r.name === repoName)
    if (repo) {
      setSelected(repo)
      setFlyTarget({ lat: repo.lat, lng: repo.lng })
      setShowSocietyPanel(false)
    }
  }

  const allResults=[...localResults,...liveResults]

  return (
    <>
      {loading&&(
        <div className={`loading ${loadPct===100?'fade':''}`}>
          <div className="loading-logo">Git<span>Globe</span></div>
          <div className="loading-sub">Mapping global open-source innovation</div>
          <div className="loading-bar-wrap"><div className="loading-bar" style={{width:`${loadPct}%`}}/></div>
          <div className="loading-msg">{loadPct<40?'Connecting to data…':loadPct<90?'Mapping repositories…':'Launching globe…'}</div>
        </div>
      )}

      {!loading&&(
        <Globe
          repos={filteredRepos}
          onSelect={setSelected}
          onHover={handleHover}
          flyTarget={flyTarget}
          trendingNames={trendingNames}
          societies={societies}
          activeSociety={activeSociety}
          onSocietyClick={handleSocietyClick}
          pulseEnabled={pulseEnabled}
        />
      )}

      {tooltip&&(
        <div className="tooltip" style={{left:tooltip.x+16,top:tooltip.y-12}}>
          <strong>{tooltip.repo.name}</strong>
          {trendingNames.has(tooltip.repo.name)&&<span className="tooltip-fire">🔥</span>}
          <span>⭐ {fmt(tooltip.repo.stars)}</span>
          <span className="tooltip-lang" style={{color:getLangColor(tooltip.repo.lang)}}>{tooltip.repo.lang}</span>
        </div>
      )}

      <div className="hud-top">
        <div className="logo" onClick={()=>setShowAbout(v=>!v)}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="12" stroke="#4f9eff" strokeWidth="1.2" opacity="0.6"/>
            <ellipse cx="14" cy="14" rx="5" ry="12" stroke="#4f9eff" strokeWidth="1" opacity="0.5"/>
            <line x1="2" y1="14" x2="26" y2="14" stroke="#4f9eff" strokeWidth="0.8" opacity="0.4"/>
            <circle cx="14" cy="14" r="2.5" fill="#00e5ff"/>
          </svg>
          <span className="logo-text">Git<span>Globe</span></span>
        </div>

        <div className="search-wrap" onBlur={()=>setTimeout(()=>{setShowResults(false);setShowFilters(false)},180)}>
          <svg className="search-icon" width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
            <line x1="10" y1="10" x2="14" y2="14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input ref={searchRef} className="search-input" type="text" placeholder="Search any GitHub repo… ( / )"
            value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={handleKeyDown}
            onFocus={()=>query&&setShowResults(true)} autoComplete="off"/>
          <button className={`filter-btn ${showFilters?'active':''} ${activeFilterCount>0?'has-filters':''}`}
            onMouseDown={e=>{e.preventDefault();setShowFilters(v=>!v);setShowResults(false)}} title="Filter (F)">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="4" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="6" y1="12" x2="10" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {activeFilterCount>0&&<span className="filter-badge">{activeFilterCount}</span>}
          </button>
          {query&&<button className="search-clear" onClick={()=>{setQuery('');setShowResults(false)}}>×</button>}

          {showResults&&!showFilters&&(
            <div className="search-results">
              {localResults.length>0&&(
                <>{<div className="results-section-label">In your globe</div>}
                {localResults.map((r,i)=>(
                  <div key={r.name} className={`result-item ${i===activeIdx?'active':''}`} onMouseDown={()=>selectRepo(r as unknown as LiveRepo)}>
                    <span className="result-dot" style={{background:getLangColor(r.lang)}}/>
                    {trendingNames.has(r.name)&&<span style={{fontSize:11}}>🔥</span>}
                    <span className="result-name">{r.name}</span>
                    <span className="result-loc">{r.loc.split(',')[0]}</span>
                    <span className="result-meta">⭐ {fmt(r.stars)}</span>
                  </div>
                ))}</>
              )}
              <div className="results-section-label">Live GitHub search {liveLoading&&<span className="live-spinner"/>}</div>
              {liveResults.length===0&&!liveLoading&&<div className="search-empty">{query.length<2?'Keep typing…':'No live results'}</div>}
              {liveResults.map((r,i)=>{
                const idx=localResults.length+i
                return(
                  <div key={r.name} className={`result-item result-live ${idx===activeIdx?'active':''}`} onMouseDown={()=>selectRepo(r)}>
                    <span className="result-dot" style={{background:getLangColor(r.lang)}}/>
                    <span className="result-name">{r.name}</span>
                    <span className="result-loc">{r.loc?.split(',')[0]||'—'}</span>
                    <span className="result-meta">⭐ {fmt(r.stars)}</span>
                    <span className="live-badge">LIVE</span>
                  </div>
                )
              })}
              {allResults.length===0&&!liveLoading&&<div className="search-empty">No results</div>}
              <div className="search-hint">↑↓ navigate · Enter select · Esc close</div>
            </div>
          )}

          {showFilters&&(
            <div className="filter-panel">
              <div className="filter-section">
                <div className="filter-label">Min stars</div>
                <div className="chip-row">
                  {STAR_FILTERS.map(s=>(
                    <button key={s.label} className={`chip ${starsFilter===s.min?'active':''}`}
                      onMouseDown={e=>{e.preventDefault();setStarsFilter(starsFilter===s.min?null:s.min)}}>{s.label}</button>
                  ))}
                </div>
              </div>
              <div className="filter-section">
                <div className="filter-label">Region</div>
                <div className="chip-row">
                  {Object.keys(REGIONS).map(r=>(
                    <button key={r} className={`chip ${regionFilter===r?'active':''}`}
                      onMouseDown={e=>{e.preventDefault();setRegionFilter(regionFilter===r?null:r)}}>{r}</button>
                  ))}
                </div>
              </div>
              <div className="filter-section">
                <div className="filter-label">Language</div>
                <div className="chip-row chip-row-wrap">
                  {availableLangs.map(l=>(
                    <button key={l} className={`chip chip-lang ${langFilter===l?'active':''}`}
                      style={langFilter===l?{borderColor:getLangColor(l),color:getLangColor(l)}:{}}
                      onMouseDown={e=>{e.preventDefault();setLangFilter(langFilter===l?null:l)}}>
                      <span className="chip-dot" style={{background:getLangColor(l)}}/>{l}
                    </button>
                  ))}
                </div>
              </div>
              {activeFilterCount>0&&<button className="clear-filters" onMouseDown={e=>{e.preventDefault();clearFilters()}}>Clear all filters</button>}
              <div className="filter-count">{filteredRepos.length} of {repos.length} repos visible</div>
            </div>
          )}
        </div>

        <div className="hud-stats">
          <div className="stat-pill"><span className="stat-dot"/><span className="stat-val">{repoCount}</span><span className="stat-label">repos</span></div>
          <div className="stat-pill"><span className="stat-val">{countryCount}</span><span className="stat-label">countries</span></div>
          <div className="stat-pill"><span className="stat-val">{societies.length}</span><span className="stat-label">societies</span></div>

          {/* ── Phase 3 buttons ── */}
          <button
            className={`society-globe-btn ${showSocieties?'active':''}`}
            onClick={()=>setShowSocieties(v=>!v)}
            title="Societies (S)"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/>
              <ellipse cx="8" cy="8" rx="2.5" ry="6" stroke="currentColor" strokeWidth="1" opacity="0.7"/>
              <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="0.9" opacity="0.6"/>
            </svg>
            <span>Societies</span>
          </button>

          <button
            className={`pulse-btn ${pulseEnabled?'active':''}`}
            onClick={()=>setPulseEnabled(v=>!v)}
            title="Toggle Pulse (P)"
          >
            <span className={`pulse-dot-anim ${pulseEnabled?'live':''}`}/>
            <span>Pulse</span>
          </button>

          <button className={`trending-btn ${trendingMode?'active':''}`} onClick={()=>setTrendingMode(v=>!v)} title="Toggle trending (T)">
            <span style={{fontSize:14}}>🔥</span><span>Trending</span>
            {trendingLoading&&<span className="live-spinner"/>}
          </button>
          <button className={`trending-list-btn ${showTrending?'active':''}`} onClick={()=>setShowTrending(v=>!v)}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <polyline points="2,12 6,7 9,9 14,3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </button>
          <button className={`share-btn ${copied?'copied':''}`} onClick={handleShare}>
            {copied
              ?<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 8l4 4 8-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              :<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="12" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.3"/><circle cx="12" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.3"/><circle cx="4" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.3"/><line x1="10.6" y1="3.9" x2="5.4" y2="7.1" stroke="currentColor" strokeWidth="1.3"/><line x1="10.6" y1="12.1" x2="5.4" y2="8.9" stroke="currentColor" strokeWidth="1.3"/></svg>
            }
            <span>{copied?'Copied!':'Share'}</span>
          </button>
        </div>
      </div>

      {/* ── Phase 3: Society overlay chip grid ─────────────────────────── */}
      <SocietyOverlay
        societies={societies}
        activeSociety={activeSociety}
        onSelect={handleSocietyClick}
        visible={showSocieties}
      />

      {/* ── Phase 3: Society detail panel ─────────────────────────────── */}
      <SocietyPanel
        society={showSocietyPanel ? activeSociety : null}
        onClose={handleSocietyClose}
        onSelectRepo={handleSocietyRepoSelect}
      />

      {/* ── Trending panel ──────────────────────────────────────────────── */}
      {showTrending&&(
        <div className="trending-panel">
          <div className="trending-header">
            <span>🔥 Trending this week</span>
            <button onClick={()=>setShowTrending(false)}>×</button>
          </div>
          {trendingLoading&&<div className="trending-loading">Loading…</div>}
          {trendingRepos.slice(0,15).map((repo,i)=>(
            <div key={repo.name} className="trending-item" onClick={()=>{
              const match=repos.find(r=>r.name===repo.name)
              if(match){setSelected(match);setFlyTarget({lat:match.lat,lng:match.lng})}
              setShowTrending(false)
            }}>
              <span className="trending-rank">#{i+1}</span>
              <div className="trending-info">
                <div className="trending-name">{repo.name}</div>
                <div className="trending-meta">
                  <span style={{color:getLangColor(repo.lang),fontSize:10}}>⬤</span>
                  <span>{repo.lang}</span>
                  <span>⭐ {fmt(repo.stars)}</span>
                </div>
              </div>
            </div>
          ))}
          {trendingRepos.length===0&&!trendingLoading&&<div className="trending-loading">No trending data</div>}
        </div>
      )}

      {(activeFilterCount>0||trendingMode||activeSociety)&&(
        <div className="active-filters-bar">
          {trendingMode&&<span className="active-chip active-chip-trend">🔥 Trending<button onClick={()=>setTrendingMode(false)}>×</button></span>}
          {activeSociety&&(
            <span className="active-chip active-chip-society" style={{borderColor: activeSociety.color+'80', color: activeSociety.color}}>
              {activeSociety.badge} {activeSociety.shortName}
              <button onClick={handleSocietyClose}>×</button>
            </span>
          )}
          {langFilter&&<span className="active-chip" style={{borderColor:getLangColor(langFilter)}}><span className="chip-dot" style={{background:getLangColor(langFilter)}}/>{langFilter}<button onClick={()=>setLangFilter(null)}>×</button></span>}
          {regionFilter&&<span className="active-chip">{regionFilter}<button onClick={()=>setRegionFilter(null)}>×</button></span>}
          {starsFilter&&<span className="active-chip">⭐ {starsFilter>=1000?(starsFilter/1000)+'k+':starsFilter+'+'}<button onClick={()=>setStarsFilter(null)}>×</button></span>}
          <button className="clear-all-btn" onClick={()=>{clearFilters();setTrendingMode(false);handleSocietyClose()}}>Clear all</button>
        </div>
      )}

      <div className={`info-panel ${selected?'open':''}`}>
        <div className="panel-header">
          <button className="panel-close" onClick={()=>setSelected(null)}>×</button>
          {selected&&trendingNames.has(selected.name)&&<span className="trending-flame-badge">🔥 Trending</span>}
          {(selected as unknown as LiveRepo)?.live&&<span className="live-badge panel-live-badge">LIVE</span>}
          <div className="panel-repo-name">{selected?.name}</div>
          <div className="panel-desc">{selected?.desc}</div>
        </div>
        {selected&&(
          <div className="panel-body">
            <div className="panel-row"><span className="panel-key">Stars</span><span className="panel-val green">⭐ {fmt(selected.stars)}</span></div>
            <div className="panel-row"><span className="panel-key">Forks</span><span className="panel-val">{fmt(selected.forks)}</span></div>
            <div className="panel-row"><span className="panel-key">Language</span><span className="lang-badge"><span className="lang-dot" style={{background:getLangColor(selected.lang)}}/>{selected.lang}</span></div>
            <div className="panel-row"><span className="panel-key">Location</span><span className="panel-val accent">{selected.loc}</span></div>
            <div className="panel-row"><span className="panel-key">Owner</span><span className="panel-val">{selected.owner}</span></div>
            <div className="panel-row"><span className="panel-key">Topics</span><span className="panel-val">{selected.topics?.split(',').join(' · ')}</span></div>
            {/* Society membership badge */}
            {(() => {
              const soc = societies.find((s: Society) => s.repos.some((r: Repo) => r.name === selected.name))
              return soc ? (
                <div className="panel-row">
                  <span className="panel-key">Society</span>
                  <button className="panel-society-badge" style={{color:soc.color, borderColor:soc.color+'50'}}
                    onClick={()=>handleSocietyClick(soc)}>
                    {soc.badge} {soc.name} →
                  </button>
                </div>
              ) : null
            })()}
            <a className="panel-link" href={`https://github.com/${selected.name}`} target="_blank" rel="noopener noreferrer">View on GitHub →</a>
            {selected.lat!==0&&selected.lng!==0&&<div className="panel-coords">lat: {selected.lat.toFixed(4)}  lng: {selected.lng.toFixed(4)}</div>}
            <button className="panel-filter-btn" onClick={()=>{setLangFilter(selected.lang);setSelected(null)}}>Show all {selected.lang} repos →</button>
          </div>
        )}
      </div>

      {showAbout&&(
        <div className="about-panel">
          <button className="panel-close" style={{position:'absolute',top:16,right:16}} onClick={()=>setShowAbout(false)}>×</button>
          <div className="about-logo">Git<span>Globe</span></div>
          <div className="about-desc">Interactive 3D map of global open-source innovation.</div>
          <div className="about-stats">
            <div className="about-stat"><span>{repos.length}</span>repositories</div>
            <div className="about-stat"><span>{countries}</span>countries</div>
            <div className="about-stat"><span>{societies.length}</span>societies</div>
          </div>
          <div className="about-shortcuts">
            <div className="shortcut-row"><kbd>/</kbd><span>Focus search</span></div>
            <div className="shortcut-row"><kbd>F</kbd><span>Toggle filters</span></div>
            <div className="shortcut-row"><kbd>T</kbd><span>Toggle trending</span></div>
            <div className="shortcut-row"><kbd>S</kbd><span>Toggle societies</span></div>
            <div className="shortcut-row"><kbd>P</kbd><span>Toggle pulse</span></div>
            <div className="shortcut-row"><kbd>Esc</kbd><span>Close panels</span></div>
          </div>
          <div className="about-phase">Phase 3 — Societies + Pulse Active</div>
        </div>
      )}

      <div className="legend">
        <div className="legend-title">Language</div>
        {[...new Set(filteredRepos.map(r=>r.lang))].slice(0,10).map(l=>(
          <div key={l} className={`legend-row ${langFilter===l?'legend-active':''}`}
            onClick={()=>setLangFilter(langFilter===l?null:l)} style={{cursor:'pointer'}}>
            <span className="legend-dot" style={{background:getLangColor(l)}}/>{l}
          </div>
        ))}
      </div>

      {!loading&&<div className="hint">Drag to rotate · Scroll to zoom · Press / to search · S for Societies</div>}
    </>
  )
}
