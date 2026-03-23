import { useEffect, useRef } from 'react'
import * as THREE from 'three'

// ── Types ──────────────────────────────────────────────
export interface Repo {
  name: string
  desc: string
  stars: number
  forks: number
  lang: string
  owner: string
  lat: number
  lng: number
  loc: string
  topics: string
  trending?: boolean
}

interface GlobeProps {
  repos: Repo[]
  onSelect: (repo: Repo | null) => void
  onHover: (repo: Repo | null, x: number, y: number) => void
  flyTarget: { lat: number; lng: number } | null
  trendingNames: Set<string>
}

// ── Language colours ───────────────────────────────────
export const LANG_COLORS: Record<string, string> = {
  JavaScript: '#fbbf24', TypeScript: '#60a5fa', Python:  '#4ade80',
  Rust:       '#fb923c', Go:         '#22d3ee', Java:    '#f59e0b',
  'C++':      '#f472b6', Ruby:       '#f87171', Swift:   '#fd8c73',
  Kotlin:     '#a78bfa', PHP:        '#c084fc', 'C#':    '#6ee7b7',
  Shell:      '#86efac', Dart:       '#67e8f9', Scala:   '#fca5a5',
  Zig:        '#fde68a', Haskell:    '#c4b5fd', C:       '#94a3b8',
  Other:      '#64748b',
}

export function getLangColor(lang: string) {
  return LANG_COLORS[lang] ?? LANG_COLORS['Other']
}

export function fmt(n: number) {
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n)
}

// ── Constants ──────────────────────────────────────────
const GLOBE_R     = 1
const NODE_HEIGHT = 0.013   // altitude above globe surface
const MAX_NODES   = 2000    // instanced mesh capacity

// ── Helpers ────────────────────────────────────────────
function latLngToVec3(lat: number, lng: number, r: number): THREE.Vector3 {
  const phi   = (90 - lat)  * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta)
  )
}

function nodeRadius(stars: number): number {
  return 0.013 + Math.log10(Math.max(stars, 1)) * 0.006
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

// ── Clustering ─────────────────────────────────────────
interface ClusterItem {
  lat: number; lng: number
  repos: Repo[]
  totalStars: number
  primaryLang: string
  isTrending: boolean
}

function clusterRepos(repos: Repo[], gridSize: number, trendingNames: Set<string>): ClusterItem[] {
  if (gridSize === 0) {
    return repos.map(r => ({
      lat: r.lat, lng: r.lng,
      repos: [r], totalStars: r.stars,
      primaryLang: r.lang,
      isTrending: trendingNames.has(r.name),
    }))
  }
  const grid = new Map<string, ClusterItem>()
  repos.forEach(repo => {
    const key = `${Math.round(repo.lat / gridSize)},${Math.round(repo.lng / gridSize)}`
    if (!grid.has(key)) {
      grid.set(key, {
        lat: repo.lat, lng: repo.lng,
        repos: [], totalStars: 0,
        primaryLang: repo.lang,
        isTrending: false,
      })
    }
    const g = grid.get(key)!
    g.repos.push(repo)
    g.totalStars += repo.stars
    if (trendingNames.has(repo.name)) g.isTrending = true
  })
  grid.forEach(g => {
    const counts: Record<string, number> = {}
    g.repos.forEach(r => { counts[r.lang] = (counts[r.lang] || 0) + 1 })
    g.primaryLang = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    g.lat = g.repos.reduce((s, r) => s + r.lat, 0) / g.repos.length
    g.lng = g.repos.reduce((s, r) => s + r.lng, 0) / g.repos.length
  })
  return Array.from(grid.values())
}

// ── Component ──────────────────────────────────────────
export default function Globe({ repos, onSelect, onHover, flyTarget, trendingNames }: GlobeProps) {
  const mountRef    = useRef<HTMLDivElement>(null)
  const stateRef    = useRef<{
    renderer:      THREE.WebGLRenderer
    scene:         THREE.Scene
    camera:        THREE.PerspectiveCamera
    globe:         THREE.Mesh
    // Instanced meshes — ONE draw call each
    nodeInstances: THREE.InstancedMesh
    ringInstances: THREE.InstancedMesh
    // Per-node data (indexed same as instances)
    nodeData:      ClusterItem[]
    // Interaction
    hoveredIdx:    number
    selectedIdx:   number
    rotVel:        { x: number; y: number }
    isDragging:    boolean
    wasDragging:   boolean
    prevMouse:     { x: number; y: number }
    flyTarget:     { x: number; y: number; progress: number } | null
    tick:          number
    animId:        number
    autoRot:       boolean
    currentGrid:   number
    // Temp objects (reused every frame — avoids GC pressure)
    _mat:          THREE.Matrix4
    _pos:          THREE.Vector3
    _quat:         THREE.Quaternion
    _scale:        THREE.Vector3
    _color:        THREE.Color
  } | null>(null)

  const reposRef    = useRef(repos)
  const trendRef    = useRef(trendingNames)
  reposRef.current  = repos
  trendRef.current  = trendingNames

  // ── Build instanced mesh from cluster data ─────────────
  function buildInstances(
    scene:   THREE.Scene,
    globe:   THREE.Mesh,
    repos:   Repo[],
    grid:    number,
    trending: Set<string>
  ): {
    nodeInstances: THREE.InstancedMesh
    ringInstances: THREE.InstancedMesh
    nodeData:      ClusterItem[]
  } {
    const items    = clusterRepos(repos, grid, trending)
    const count    = Math.min(items.length, MAX_NODES)

    // Shared geometries — one sphere, used for all instances
    const nodeGeo  = new THREE.SphereGeometry(1, 12, 12)  // radius=1, scaled per instance
    const ringGeo  = new THREE.SphereGeometry(1, 8, 8)

    // Instanced materials
    const nodeMat  = new THREE.MeshBasicMaterial({ transparent: true, opacity: 1 })
    const ringMat  = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.18, depthWrite: false })

    const nodeInst = new THREE.InstancedMesh(nodeGeo, nodeMat, count)
    const ringInst = new THREE.InstancedMesh(ringGeo, ringMat, count)

    nodeInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    ringInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

    const mat    = new THREE.Matrix4()
    const quat   = new THREE.Quaternion()
    const scale  = new THREE.Vector3()
    const color  = new THREE.Color()

    const globeRot = new THREE.Matrix4().makeRotationFromEuler(globe.rotation)

    items.slice(0, count).forEach((item, i) => {
      const isTrend  = item.isTrending
      const radius   = item.repos.length > 1
        ? Math.min(0.014 + Math.log10(item.repos.length + 1) * 0.014, 0.06)
        : nodeRadius(item.totalStars)

      const basePos  = latLngToVec3(item.lat, item.lng, GLOBE_R + NODE_HEIGHT)
      basePos.applyMatrix4(globeRot)

      // Node instance
      scale.setScalar(radius)
      mat.compose(basePos, quat, scale)
      nodeInst.setMatrixAt(i, mat)
      color.set(isTrend ? '#ffd700' : getLangColor(item.primaryLang))
      nodeInst.setColorAt(i, color)

      // Ring instance (2.8x node radius)
      scale.setScalar(radius * 2.8)
      mat.compose(basePos, quat, scale)
      ringInst.setMatrixAt(i, mat)
      ringInst.setColorAt(i, color)
    })

    nodeInst.instanceMatrix.needsUpdate = true
    ringInst.instanceMatrix.needsUpdate = true
    if (nodeInst.instanceColor) nodeInst.instanceColor.needsUpdate = true
    if (ringInst.instanceColor) ringInst.instanceColor.needsUpdate = true

    nodeInst.count = count
    ringInst.count = count

    scene.add(nodeInst)
    scene.add(ringInst)

    return { nodeInstances: nodeInst, ringInstances: ringInst, nodeData: items.slice(0, count) }
  }

  // ── Sync instanced positions to globe rotation ─────────
  function syncInstances(
    nodeInst: THREE.InstancedMesh,
    ringInst: THREE.InstancedMesh,
    nodeData: ClusterItem[],
    globeRot: THREE.Euler,
    mat: THREE.Matrix4,
    quat: THREE.Quaternion,
    scale: THREE.Vector3
  ) {
    const rotMat = new THREE.Matrix4().makeRotationFromEuler(globeRot)
    nodeData.forEach((item, i) => {
      const radius  = item.repos.length > 1
        ? Math.min(0.014 + Math.log10(item.repos.length + 1) * 0.014, 0.06)
        : nodeRadius(item.totalStars)
      const pos = latLngToVec3(item.lat, item.lng, GLOBE_R + NODE_HEIGHT)
      pos.applyMatrix4(rotMat)

      scale.setScalar(radius)
      mat.compose(pos, quat, scale)
      nodeInst.setMatrixAt(i, mat)

      scale.setScalar(radius * 2.8)
      mat.compose(pos, quat, scale)
      ringInst.setMatrixAt(i, mat)
    })
    nodeInst.instanceMatrix.needsUpdate = true
    ringInst.instanceMatrix.needsUpdate = true
  }

  // ── Mount ─────────────────────────────────────────────
  useEffect(() => {
    const el = mountRef.current
    if (!el || repos.length === 0) return

    // Renderer — init with placeholder size, forceResize sets real size
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setClearColor(0x04070f, 1)
    renderer.info.autoReset = false
    renderer.domElement.style.display = 'block'
    el.appendChild(renderer.domElement)

    const W = window.innerWidth
    const H = window.innerHeight
    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 1000)
    camera.position.set(0, 0, 2.8)
    camera.lookAt(0, 0, 0)

    // Globe
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_R, 64, 64),
      new THREE.MeshPhongMaterial({ color: 0x0a1628, emissive: 0x050d1e, specular: 0x1a3060, shininess: 22 })
    )
    scene.add(globe)

    // Grid lines
    const gridMat = new THREE.LineBasicMaterial({ color: 0x1a3060, transparent: true, opacity: 0.28 })
    const GR = GLOBE_R + 0.001
    for (let lat = -75; lat <= 75; lat += 15) {
      const pts: THREE.Vector3[] = []
      const phi = (90 - lat) * Math.PI / 180
      for (let lng = 0; lng <= 360; lng += 3) {
        const theta = lng * Math.PI / 180
        pts.push(new THREE.Vector3(GR*Math.sin(phi)*Math.cos(theta), GR*Math.cos(phi), GR*Math.sin(phi)*Math.sin(theta)))
      }
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat))
    }
    for (let lng = 0; lng < 360; lng += 15) {
      const pts: THREE.Vector3[] = []
      const theta = lng * Math.PI / 180
      for (let lat2 = -90; lat2 <= 90; lat2 += 3) {
        const phi = (90 - lat2) * Math.PI / 180
        pts.push(new THREE.Vector3(GR*Math.sin(phi)*Math.cos(theta), GR*Math.cos(phi), GR*Math.sin(phi)*Math.sin(theta)))
      }
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat))
    }

    // Atmosphere
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(GLOBE_R*1.08,64,64),
      new THREE.MeshPhongMaterial({color:0x1a6aff,side:THREE.FrontSide,transparent:true,opacity:0.055})))
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(GLOBE_R*1.13,64,64),
      new THREE.MeshPhongMaterial({color:0x3399ff,side:THREE.BackSide,transparent:true,opacity:0.10})))

    // Stars
    const starPos = new Float32Array(3000*3)
    for (let i = 0; i < 3000; i++) {
      const r2=80+Math.random()*120, t2=Math.random()*Math.PI*2, p2=Math.acos(2*Math.random()-1)
      starPos[i*3]=r2*Math.sin(p2)*Math.cos(t2); starPos[i*3+1]=r2*Math.cos(p2); starPos[i*3+2]=r2*Math.sin(p2)*Math.sin(t2)
    }
    const sg = new THREE.BufferGeometry()
    sg.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({color:0xffffff,size:0.5,sizeAttenuation:false,transparent:true,opacity:0.7})))

    // Lights
    scene.add(new THREE.AmbientLight(0x1a2a4a, 0.9))
    const sun = new THREE.DirectionalLight(0x4488ff, 1.5); sun.position.set(5,3,5); scene.add(sun)
    scene.add(new THREE.DirectionalLight(0x0022ff, 0.3)).position.set(-5,-2,-5)

    // Reusable transform objects — allocated ONCE, reused every frame
    const _mat   = new THREE.Matrix4()
    const _pos   = new THREE.Vector3()
    const _quat  = new THREE.Quaternion()
    const _scale = new THREE.Vector3()
    const _color = new THREE.Color()

    // Build initial instanced nodes
    let currentGrid = 20
    let { nodeInstances, ringInstances, nodeData } = buildInstances(scene, globe, repos, currentGrid, trendingNames)

    const state = {
      renderer, scene, camera, globe,
      nodeInstances, ringInstances, nodeData,
      hoveredIdx: -1, selectedIdx: -1,
      rotVel: {x:0,y:0}, isDragging:false, wasDragging:false,
      prevMouse:{x:0,y:0},
      flyTarget: null as {x:number;y:number;progress:number}|null,
      tick:0, animId:0, autoRot:true, currentGrid,
      _mat, _pos, _quat, _scale, _color,
    }
    stateRef.current = state

    // ── Raycaster — uses instanced mesh directly ───────────
    const raycaster = new THREE.Raycaster()
    raycaster.params.Mesh = { threshold: 0.01 }
    const mouse = new THREE.Vector2()

    function getHitIndex(e: MouseEvent): number {
      mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObject(nodeInstances)
      if (hits.length === 0) return -1
      // Back-face cull — ignore nodes on far side of globe
      const camDir = camera.position.clone().normalize()
      for (const hit of hits) {
        if (hit.instanceId === undefined) continue
        nodeInstances.getMatrixAt(hit.instanceId, _mat)
        _pos.setFromMatrixPosition(_mat)
        if (camDir.dot(_pos.clone().normalize()) > -0.05) return hit.instanceId
      }
      return -1
    }

    function highlightInstance(idx: number, on: boolean, isSelected = false) {
      if (idx < 0 || idx >= nodeData.length) return
      const item    = nodeData[idx]
      const isTrend = item.isTrending
      const radius  = item.repos.length > 1
        ? Math.min(0.014 + Math.log10(item.repos.length+1)*0.014, 0.06)
        : nodeRadius(item.totalStars)

      nodeInstances.getMatrixAt(idx, _mat)
      _pos.setFromMatrixPosition(_mat)

      if (on || isSelected) {
        _color.set(0xffffff)
        _scale.setScalar(radius * 1.5)
      } else {
        _color.set(isTrend ? '#ffd700' : getLangColor(item.primaryLang))
        _scale.setScalar(radius)
      }
      _mat.compose(_pos, _quat, _scale)
      nodeInstances.setMatrixAt(idx, _mat)
      nodeInstances.setColorAt(idx, _color)
      nodeInstances.instanceMatrix.needsUpdate = true
      if (nodeInstances.instanceColor) nodeInstances.instanceColor.needsUpdate = true
    }

    function onMouseMove(e: MouseEvent) {
      const idx = getHitIndex(e)
      if (idx !== state.hoveredIdx) {
        if (state.hoveredIdx >= 0 && state.hoveredIdx !== state.selectedIdx) {
          highlightInstance(state.hoveredIdx, false)
        }
        state.hoveredIdx = idx
        if (idx >= 0 && idx !== state.selectedIdx) {
          highlightInstance(idx, true)
        }
      }
      if (idx >= 0) {
        onHover(nodeData[idx].repos[0], e.clientX, e.clientY)
        if (el) el.style.cursor = 'pointer'
      } else {
        onHover(null, 0, 0)
        if (el) el.style.cursor = state.isDragging ? 'grabbing' : 'grab'
      }
    }

    function onClick() {
      const idx = state.hoveredIdx
      if (idx >= 0) {
        if (state.selectedIdx >= 0 && state.selectedIdx !== idx) {
          highlightInstance(state.selectedIdx, false)
        }
        state.selectedIdx = idx
        highlightInstance(idx, true, true)
        onSelect(nodeData[idx].repos[0])
      } else if (!state.wasDragging) {
        if (state.selectedIdx >= 0) highlightInstance(state.selectedIdx, false)
        state.selectedIdx = -1
        onSelect(null)
      }
    }

    function onMouseDown(e: MouseEvent) {
      state.isDragging=true; state.wasDragging=false
      state.prevMouse={x:e.clientX,y:e.clientY}
      state.rotVel={x:0,y:0}; state.autoRot=false
    }

    function onMouseMoveGlobe(e: MouseEvent) {
      if (!state.isDragging) return
      const dx=e.clientX-state.prevMouse.x, dy=e.clientY-state.prevMouse.y
      if (Math.abs(dx)+Math.abs(dy)>2) state.wasDragging=true
      state.rotVel.x=dy*0.004; state.rotVel.y=dx*0.004
      globe.rotation.x+=state.rotVel.x; globe.rotation.y+=state.rotVel.y
      syncInstances(nodeInstances, ringInstances, nodeData, globe.rotation, _mat, _quat, _scale)
      state.prevMouse={x:e.clientX,y:e.clientY}
    }

    function onMouseUp() { state.isDragging=false }
    function onWheel(e: WheelEvent) { camera.position.z=Math.max(1.4,Math.min(6,camera.position.z+e.deltaY*0.002)) }
    function onResize() {
      const w = window.innerWidth
      const h = window.innerHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }

    el.addEventListener('mousemove', onMouseMove)
    el.addEventListener('click', onClick)
    el.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMoveGlobe)
    window.addEventListener('mouseup', onMouseUp)
    el.addEventListener('wheel', onWheel, {passive:true})
    window.addEventListener('resize', onResize)

    // ── Render loop ────────────────────────────────────────
    function animate() {
      state.animId = requestAnimationFrame(animate)
      state.tick++
      renderer.info.reset()

      // LOD — rebuild instanced mesh only when zoom threshold crossed
      const z = camera.position.z
      const newGrid = z>3.5?20:z>2.4?10:z>1.9?4:0
      if (newGrid !== state.currentGrid) {
        // Remove old instances
        scene.remove(nodeInstances); scene.remove(ringInstances)
        nodeInstances.geometry.dispose()
        ringInstances.geometry.dispose()
        ;(nodeInstances.material as THREE.Material).dispose()
        ;(ringInstances.material as THREE.Material).dispose()
        // Build new instances
        const built = buildInstances(scene, globe, reposRef.current, newGrid, trendRef.current)
        nodeInstances = built.nodeInstances
        ringInstances = built.ringInstances
        nodeData      = built.nodeData
        state.nodeInstances = nodeInstances
        state.ringInstances = ringInstances
        state.nodeData      = nodeData
        state.currentGrid   = newGrid
        state.hoveredIdx    = -1
        state.selectedIdx   = -1
      }

      // Inertia
      if (!state.isDragging && (Math.abs(state.rotVel.x)>0.0001||Math.abs(state.rotVel.y)>0.0001)) {
        globe.rotation.x+=state.rotVel.x; globe.rotation.y+=state.rotVel.y
        syncInstances(nodeInstances, ringInstances, nodeData, globe.rotation, _mat, _quat, _scale)
        state.rotVel.x*=0.93; state.rotVel.y*=0.93
      }

      // Fly-to
      if (state.flyTarget) {
        state.flyTarget.progress=Math.min(1,state.flyTarget.progress+0.025)
        const t=easeInOut(state.flyTarget.progress)
        globe.rotation.x+=(state.flyTarget.x-globe.rotation.x)*t*0.1
        globe.rotation.y+=(state.flyTarget.y-globe.rotation.y)*t*0.1
        syncInstances(nodeInstances, ringInstances, nodeData, globe.rotation, _mat, _quat, _scale)
        if (state.flyTarget.progress>=1) state.flyTarget=null
      }

      // Pulse animation — update only ring instances (cheaper than node)
      // Batch all ring updates, one instanceMatrix.needsUpdate at end
      let ringDirty = false
      const camDir  = camera.position.clone().normalize()

      nodeData.forEach((item, i) => {
        // Back-face visibility via colour alpha trick — hide far-side nodes
        nodeInstances.getMatrixAt(i, _mat)
        _pos.setFromMatrixPosition(_mat)
        const dot = camDir.dot(_pos.clone().normalize())
        const vis = dot > -0.05

        // Fade opacity based on dot product — smooth edge transition
        if (i === state.selectedIdx || i === state.hoveredIdx) return // skip animated ones

        // Update ring scale for pulse
        const rPhase = (state.tick*0.012 + i*0.28) % (Math.PI*2)
        const radius = item.repos.length>1
          ? Math.min(0.014+Math.log10(item.repos.length+1)*0.014,0.06)
          : nodeRadius(item.totalStars)

        const rScale = item.isTrending
          ? radius*2.8*(1+Math.sin(rPhase)*0.3)   // bigger pulse for trending
          : radius*2.8*(1+Math.sin(rPhase)*0.18)

        ringInstances.getMatrixAt(i, _mat)
        _pos.setFromMatrixPosition(_mat)
        _scale.setScalar(vis ? rScale : 0)  // scale to 0 = invisible (no draw)
        _mat.compose(_pos, _quat, _scale)
        ringInstances.setMatrixAt(i, _mat)

        // Node pulse
        const nPhase = (state.tick*0.018 + i*0.35) % (Math.PI*2)
        const nScale = item.isTrending
          ? radius*(1+Math.sin(nPhase)*0.14)
          : radius*(1+Math.sin(nPhase)*0.07)

        nodeInstances.getMatrixAt(i, _mat)
        _scale.setScalar(vis ? nScale : 0)
        _mat.compose(_pos, _quat, _scale)
        nodeInstances.setMatrixAt(i, _mat)

        ringDirty = true
      })

      if (ringDirty) {
        nodeInstances.instanceMatrix.needsUpdate = true
        ringInstances.instanceMatrix.needsUpdate = true
      }

      renderer.render(scene, camera)
    }
    const forceResize = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    setTimeout(forceResize, 0)
    setTimeout(forceResize, 200)
    setTimeout(forceResize, 500)
    setTimeout(forceResize, 1000)
    setTimeout(forceResize, 2000)
    window.dispatchEvent(new Event('resize'))

    animate()

    // Auto-rotation
    ;(function autoRotate() {
      if (!state.autoRot) return
      globe.rotation.y+=0.0025
      syncInstances(nodeInstances, ringInstances, nodeData, globe.rotation, _mat, _quat, _scale)
      requestAnimationFrame(autoRotate)
    })()

    return () => {
      cancelAnimationFrame(state.animId)
      el.removeEventListener('mousemove',onMouseMove)
      el.removeEventListener('click',onClick)
      el.removeEventListener('mousedown',onMouseDown)
      window.removeEventListener('mousemove',onMouseMoveGlobe)
      window.removeEventListener('mouseup',onMouseUp)
      el.removeEventListener('wheel',onWheel)
      window.removeEventListener('resize',onResize)
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [repos, trendingNames])

  // ── External fly-to ───────────────────────────────────
  useEffect(() => {
    if (!flyTarget || !stateRef.current) return
    stateRef.current.flyTarget = {
      x: -flyTarget.lat * Math.PI / 180,
      y: (-flyTarget.lng * Math.PI / 180) - Math.PI,
      progress: 0,
    }
    stateRef.current.camera.position.z = Math.min(stateRef.current.camera.position.z, 2.0)
  }, [flyTarget])

  return (
    <div
      ref={mountRef}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        cursor: 'grab',
        background: '#04070f',
      }}
    />
  )
}
