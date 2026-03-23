import { useEffect, useState, useMemo } from 'react'
import Globe, { SOCIETIES, getSociety } from './components/Globe'
import type { Repo } from './components/Globe'
import './App.css'

export default function App() {
  const [repos, setRepos] = useState<Repo[]>([])
  const [selected, setSelected] = useState<Repo|null>(null)
  const [activeSociety, setActiveSociety] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/data/repos.json').then(r=>r.json()).then((data:Repo[]) => {
      setRepos(data); setLoading(false)
    }).catch(()=>setLoading(false))
  }, [])

  const filteredRepos = useMemo(() => {
    return repos.filter(r => !activeSociety || getSociety(r).id === activeSociety)
  }, [repos, activeSociety])

  return (
    <>
      {loading ? <div className="loading">Initializing Societies...</div> : (
        <Globe repos={filteredRepos} onSelect={setSelected} />
      )}

      <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 999, background: 'rgba(0,0,0,0.6)', border: '1px solid #4f9eff', borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 12 }}>
        repos: {repos.length}
        <br />filtered: {filteredRepos.length}
        <br />activeSociety: {activeSociety ?? 'all'}
        <br />selected: {selected ? selected.name : 'none'}
      </div>

      <div className="hud-top">
        <div className="logo"><span className="logo-text">Git<span>Globe</span></span></div>
      </div>

      {/* Pillar 2: Society Legend [cite: 35] */}
      <div className="legend society-legend">
        <div className="legend-title">World Societies</div>
        {Object.values(SOCIETIES).map(s => (
          <div key={s.id} className={`legend-row ${activeSociety === s.id ? 'legend-active' : ''}`} onClick={() => setActiveSociety(activeSociety === s.id ? null : s.id)}>
            <span className="legend-dot" style={{ background: s.color }} />
            <span>{s.icon} {s.name}</span>
          </div>
        ))}
      </div>

      {/* Info Panel [cite: 44] */}
      <div className={`info-panel ${selected ? 'open' : ''}`}>
        <div className="panel-header">
          <button className="panel-close" onClick={() => setSelected(null)}>×</button>
          {selected && (
            <>
              <div className="society-tag" style={{ color: getSociety(selected).color }}>
                {getSociety(selected).icon} {getSociety(selected).name}
              </div>
              <div className="panel-repo-name">{selected.name}</div>
              <p className="panel-desc">{selected.desc}</p>
            </>
          )}
        </div>
      </div>
    </>
  )
}