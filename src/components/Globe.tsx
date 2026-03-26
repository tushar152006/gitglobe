// ── Globe.tsx (Phase 3) ───────────────────────────────────────────────────────
// Adds: Society glow rings on the globe surface + Pulse layer

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { Society } from './societies'
import { PulseManager } from './PulseLayer'

// ── Types ──────────────────────────────────────────────────────────────────
export interface Repo {
  name: string; desc: string; stars: number; forks: number
  lang: string; owner: string; lat: number; lng: number
  loc: string; topics: string; trending?: boolean
}

interface GlobeProps {
  repos: Repo[]
  onSelect: (repo: Repo | null) => void
  onHover: (repo: Repo | null, x: number, y: number) => void
  flyTarget: { lat: number; lng: number } | null
  trendingNames: Set<string>
  // ── Phase 3 additions ──
  societies: Society[]
  activeSociety: Society | null
  onSocietyClick: (s: Society) => void
  pulseEnabled: boolean
}

// ── Language colours ───────────────────────────────────────────────────────
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

const GLOBE_R = 1

function latLngToVec3(lat: number, lng: number, r: number) {
  const phi   = (90 - lat)  * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  )
}

function nodeRadius(stars: number) {
  return 0.013 + Math.log10(Math.max(stars, 1)) * 0.006
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

// ── Clustering ─────────────────────────────────────────────────────────────
interface ClusterItem {
  lat: number; lng: number; repos: Repo[]
  totalStars: number; primaryLang: string; isTrending: boolean
}

function clusterRepos(repos: Repo[], gridSize: number, trendingNames: Set<string>): ClusterItem[] {
  if (gridSize === 0) {
    return repos.map(r => ({
      lat: r.lat, lng: r.lng, repos: [r], totalStars: r.stars,
      primaryLang: r.lang, isTrending: trendingNames.has(r.name),
    }))
  }
  const grid = new Map<string, ClusterItem>()
  repos.forEach(repo => {
    const key = `${Math.round(repo.lat / gridSize)},${Math.round(repo.lng / gridSize)}`
    if (!grid.has(key)) grid.set(key, { lat: repo.lat, lng: repo.lng, repos: [], totalStars: 0, primaryLang: repo.lang, isTrending: false })
    const g = grid.get(key)!
    g.repos.push(repo); g.totalStars += repo.stars
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

// ── Society ring builder ────────────────────────────────────────────────────
function buildSocietyRings(
  scene: THREE.Scene,
  societies: Society[],
  activeSociety: Society | null,
  globe: THREE.Mesh,
  existingRings: THREE.Object3D[],
) {
  existingRings.forEach(o => scene.remove(o))
  existingRings.length = 0

  const rotMat = new THREE.Matrix4().makeRotationFromEuler(globe.rotation)

  societies.forEach(soc => {
    const isActive = activeSociety?.id === soc.id
    const color = new THREE.Color(soc.color)
    const segments = 64
    const points: THREE.Vector3[] = []

    const centerVec = latLngToVec3(soc.centerLat, soc.centerLng, 1)
    const radiusRad = (soc.radiusDeg * Math.PI) / 180

    const axis = centerVec.clone().normalize()
    const perp = new THREE.Vector3(1, 0, 0)
    if (Math.abs(axis.dot(perp)) > 0.9) perp.set(0, 1, 0)
    const tangent = axis.clone().cross(perp).normalize().multiplyScalar(Math.sin(radiusRad))

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      const rotAround = new THREE.Quaternion().setFromAxisAngle(axis, angle)
      const pt = tangent.clone().applyQuaternion(rotAround)
        .add(axis.clone().multiplyScalar(Math.cos(radiusRad)))
        .normalize()
        .multiplyScalar(GLOBE_R + 0.008)
      pt.applyMatrix4(rotMat)
      points.push(pt)
    }

    const ringGeo = new THREE.BufferGeometry().setFromPoints(points)
    const ringMat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: isActive ? 0.9 : 0.35,
      depthWrite: false,
      linewidth: isActive ? 2 : 1,
    })
    const ring = new THREE.Line(ringGeo, ringMat)
    scene.add(ring)
    existingRings.push(ring)

    const discGeo = new THREE.CircleGeometry(Math.sin(radiusRad) * GLOBE_R, 48)
    const discMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: isActive ? 0.07 : 0.025,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const disc = new THREE.Mesh(discGeo, discMat)
    const centerPos = axis.clone().multiplyScalar(Math.cos(radiusRad) * GLOBE_R + 0.005)
    centerPos.applyMatrix4(rotMat)
    disc.position.copy(centerPos)
    disc.lookAt(0, 0, 0)
    scene.add(disc)
    existingRings.push(disc)

    const dotGeo = new THREE.SphereGeometry(isActive ? 0.022 : 0.014, 8, 8)
    const dotMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: isActive ? 0.95 : 0.6 })
    const dot = new THREE.Mesh(dotGeo, dotMat)
    const dotPos = axis.clone().multiplyScalar(GLOBE_R + 0.016)
    dotPos.applyMatrix4(rotMat)
    dot.position.copy(dotPos)
    dot.userData = { isSocietyDot: true, societyId: soc.id }
    scene.add(dot)
    existingRings.push(dot)
  })
}

// ── Component ──────────────────────────────────────────────────────────────
export default function Globe({
  repos, onSelect, onHover, flyTarget, trendingNames,
  societies, activeSociety, onSocietyClick, pulseEnabled,
}: GlobeProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<{
    camera: THREE.PerspectiveCamera
    globe: THREE.Mesh
    flyTarget: { x: number; y: number; progress: number } | null
    currentGridSize: number
    autoRot: boolean
    tick: number
    animId: number
    rotVel: { x: number; y: number }
    isDragging: boolean
    wasDragging: boolean
    prevMouse: { x: number; y: number }
  } | null>(null)

  const reposRef      = useRef(repos)
  const trendRef      = useRef(trendingNames)
  const societiesRef  = useRef(societies)
  const activeSocRef  = useRef(activeSociety)
  const pulseRef      = useRef(pulseEnabled)

  reposRef.current     = repos
  trendRef.current     = trendingNames
  societiesRef.current = societies
  activeSocRef.current = activeSociety
  pulseRef.current     = pulseEnabled

  // ── Main three.js setup ──────────────────────────────────────────────────
  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setClearColor(0x04070f, 1)
    renderer.domElement.style.display = 'block'
    el.appendChild(renderer.domElement)

    const syncSize = () => {
      const w = window.innerWidth, h = window.innerHeight
      if (renderer.domElement.width !== w || renderer.domElement.height !== h) {
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }
    }
    setTimeout(syncSize, 0)
    setTimeout(syncSize, 200)

    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.z = 2.8

    // Globe
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_R, 64, 64),
      new THREE.MeshPhongMaterial({ color: 0x0a1628, emissive: 0x040810, specular: 0x1a3060, shininess: 18 }),
    )
    scene.add(globe)

    // Grid lines
    const gridMat = new THREE.LineBasicMaterial({ color: 0x1a3060, transparent: true, opacity: 0.35 })
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
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(GLOBE_R*1.08,64,64), new THREE.MeshPhongMaterial({color:0x1a6aff,side:THREE.FrontSide,transparent:true,opacity:0.06})))
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(GLOBE_R*1.12,64,64), new THREE.MeshPhongMaterial({color:0x3399ff,side:THREE.BackSide,transparent:true,opacity:0.12})))

    // Stars background
    const starPos = new Float32Array(3000*3)
    for (let i = 0; i < 3000; i++) {
      const r2=80+Math.random()*120, t2=Math.random()*Math.PI*2, p2=Math.acos(2*Math.random()-1)
      starPos[i*3]=r2*Math.sin(p2)*Math.cos(t2); starPos[i*3+1]=r2*Math.cos(p2); starPos[i*3+2]=r2*Math.sin(p2)*Math.sin(t2)
    }
    const sg = new THREE.BufferGeometry()
    sg.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({color:0xffffff,size:0.5,sizeAttenuation:false,transparent:true,opacity:0.7})))

    // Lights
    scene.add(new THREE.AmbientLight(0x1a2a4a, 0.8))
    const sun = new THREE.DirectionalLight(0x4488ff, 1.4); sun.position.set(5,3,5); scene.add(sun)
    scene.add(new THREE.DirectionalLight(0x0022ff, 0.3)).position.set(-5,-2,-5)

    // ── Nodes ─────────────────────────────────────────────────────────────
    let nodes: THREE.Mesh[] = []
    let rings: THREE.Mesh[] = []
    let currentGridSize = 20
    let hoveredNode: THREE.Mesh | null = null
    let selectedNode: THREE.Mesh | null = null
    const sceneNodes: THREE.Object3D[] = []

    // ── Society rings storage ─────────────────────────────────────────────
    const societyRings: THREE.Object3D[] = []

    // ── Pulse manager ──────────────────────────────────────────────────────
    const pulse = new PulseManager(scene, globe)
    let pulseTimer = 0

    function buildNodes(gridSize: number) {
      sceneNodes.forEach(o => scene.remove(o))
      sceneNodes.length = 0
      nodes = []; rings = []
      hoveredNode = null; selectedNode = null

      const items = clusterRepos(reposRef.current, gridSize, trendRef.current)
      const rotMat = new THREE.Matrix4().makeRotationFromEuler(globe.rotation)

      items.forEach(item => {
        const count   = item.repos.length
        const isTrend = item.isTrending
        const color   = new THREE.Color(isTrend ? '#ffd700' : getLangColor(item.primaryLang))
        const radius  = count > 1 ? Math.min(0.014 + Math.log10(count+1)*0.014, 0.06) : nodeRadius(item.totalStars)
        const pos     = latLngToVec3(item.lat, item.lng, GLOBE_R + 0.012)
        pos.applyMatrix4(rotMat)

        const ring = new THREE.Mesh(
          new THREE.SphereGeometry(radius*2.6, 10, 10),
          new THREE.MeshBasicMaterial({color, transparent:true, opacity: isTrend?0.25:0.12, depthWrite:false}),
        )
        ring.position.copy(pos)
        scene.add(ring); rings.push(ring); sceneNodes.push(ring)

        const node = new THREE.Mesh(
          new THREE.SphereGeometry(radius, 14, 14),
          new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.92}),
        )
        node.position.copy(pos)
        node.userData = { repo: item.repos[0], repos: item.repos, count, isTrending: isTrend, originalColor: color.clone(), radius, ringIdx: rings.length-1 }
        scene.add(node); nodes.push(node); sceneNodes.push(node)
      })

      currentGridSize = gridSize
      if (stateRef.current) stateRef.current.currentGridSize = gridSize

      // Rebuild society rings when nodes rebuild
      buildSocietyRings(scene, societiesRef.current, activeSocRef.current, globe, societyRings)
    }

    buildNodes(currentGridSize)

    const state = {
      camera, globe, flyTarget: null as {x:number;y:number;progress:number}|null,
      currentGridSize, autoRot: true, tick: 0, animId: 0,
      rotVel: {x:0,y:0}, isDragging: false, wasDragging: false, prevMouse: {x:0,y:0},
    }
    stateRef.current = state

    function syncNodes() {
      const rotMat = new THREE.Matrix4().makeRotationFromEuler(globe.rotation)
      nodes.forEach((node, i) => {
        const base = latLngToVec3(node.userData.repo.lat, node.userData.repo.lng, GLOBE_R + 0.012)
        base.applyMatrix4(rotMat)
        node.position.copy(base)
        rings[i].position.copy(base)
      })
    }

    // ── Interaction ───────────────────────────────────────────────────────
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    function highlightNode(node: THREE.Mesh | null, on: boolean) {
      if (!node) return
      const { originalColor, ringIdx, isTrending } = node.userData
      const ring = rings[ringIdx]; if (!ring) return
      const rm = ring.material as THREE.MeshBasicMaterial
      if (on) {
        ;(node.material as THREE.MeshBasicMaterial).color.set(0xffffff)
        ;(node.material as THREE.MeshBasicMaterial).opacity = 1
        ring.scale.setScalar(1.5); rm.opacity = 0.35
      } else if (node !== selectedNode) {
        ;(node.material as THREE.MeshBasicMaterial).color.copy(originalColor)
        ;(node.material as THREE.MeshBasicMaterial).opacity = 0.92
        ring.scale.setScalar(1); rm.opacity = isTrending ? 0.25 : 0.12
      }
    }

    function visibleNodes() {
      const camDir = camera.position.clone().normalize()
      return nodes.filter(n => {
        const wp = new THREE.Vector3(); n.getWorldPosition(wp)
        return camDir.dot(wp.normalize()) > -0.05
      })
    }

    function onMouseMove(e: MouseEvent) {
      mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(visibleNodes())
      if (hits.length > 0) {
        const node = hits[0].object as THREE.Mesh
        if (node !== hoveredNode) { highlightNode(hoveredNode,false); hoveredNode=node; highlightNode(node,true) }
        onHover(node.userData.repo, e.clientX, e.clientY)
        if (el) el.style.cursor = 'pointer'
      } else {
        if (hoveredNode) { highlightNode(hoveredNode,false); hoveredNode=null; onHover(null,0,0) }
        if (el) el.style.cursor = state.isDragging ? 'grabbing' : 'grab'
      }
    }

    function onClick() {
      raycaster.setFromCamera(mouse, camera)

      // Check society dots first
      const societyDots = societyRings.filter(o => o.userData?.isSocietyDot)
      const socHits = raycaster.intersectObjects(societyDots)
      if (socHits.length > 0) {
        const id = socHits[0].object.userData.societyId
        const soc = societiesRef.current.find(s => s.id === id)
        if (soc) { onSocietyClick(soc); return }
      }

      const hits = raycaster.intersectObjects(visibleNodes())
      if (hits.length > 0) {
        const node = hits[0].object as THREE.Mesh
        if (selectedNode && selectedNode !== node) highlightNode(selectedNode,false)
        selectedNode = node; highlightNode(node,true); onSelect(node.userData.repo)
      } else if (!state.wasDragging) {
        if (selectedNode) { highlightNode(selectedNode,false); selectedNode=null }
        onSelect(null)
      }
    }

    function onMouseDown(e: MouseEvent) {
      state.isDragging=true; state.wasDragging=false
      state.prevMouse={x:e.clientX,y:e.clientY}; state.rotVel={x:0,y:0}; state.autoRot=false
    }
    function onMouseMoveGlobe(e: MouseEvent) {
      if (!state.isDragging) return
      const dx=e.clientX-state.prevMouse.x, dy=e.clientY-state.prevMouse.y
      if (Math.abs(dx)+Math.abs(dy)>2) state.wasDragging=true
      state.rotVel.x=dy*0.004; state.rotVel.y=dx*0.004
      globe.rotation.x+=state.rotVel.x; globe.rotation.y+=state.rotVel.y
      syncNodes()
      buildSocietyRings(scene, societiesRef.current, activeSocRef.current, globe, societyRings)
      state.prevMouse={x:e.clientX,y:e.clientY}
    }
    function onMouseUp() { state.isDragging=false }
    function onWheel(e: WheelEvent) { camera.position.z=Math.max(1.4,Math.min(6,camera.position.z+e.deltaY*0.002)) }
    function onResize() {
      const w=window.innerWidth, h=window.innerHeight
      camera.aspect=w/h
      camera.updateProjectionMatrix()
      renderer.setSize(w,h)
    }

    el.addEventListener('mousemove', onMouseMove)
    el.addEventListener('click', onClick)
    el.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMoveGlobe)
    window.addEventListener('mouseup', onMouseUp)
    el.addEventListener('wheel', onWheel, {passive:true})
    window.addEventListener('resize', onResize)

    // ── Render loop ───────────────────────────────────────────────────────
    function animate() {
      state.animId = requestAnimationFrame(animate)
      state.tick++

      // LOD
      const z = camera.position.z
      const newGrid = z>3.5?20:z>2.4?10:z>1.9?4:0
      if (newGrid !== state.currentGridSize) buildNodes(newGrid)

      // Inertia
      if (!state.isDragging && (Math.abs(state.rotVel.x)>0.0001||Math.abs(state.rotVel.y)>0.0001)) {
        globe.rotation.x+=state.rotVel.x; globe.rotation.y+=state.rotVel.y
        syncNodes()
        buildSocietyRings(scene, societiesRef.current, activeSocRef.current, globe, societyRings)
        state.rotVel.x*=0.93; state.rotVel.y*=0.93
      }

      // Fly-to
      if (state.flyTarget) {
        state.flyTarget.progress=Math.min(1,state.flyTarget.progress+0.03)
        const t=easeInOut(state.flyTarget.progress)
        globe.rotation.x+=(state.flyTarget.x-globe.rotation.x)*t*0.08
        globe.rotation.y+=(state.flyTarget.y-globe.rotation.y)*t*0.08
        syncNodes()
        buildSocietyRings(scene, societiesRef.current, activeSocRef.current, globe, societyRings)
        if (state.flyTarget.progress>=1) state.flyTarget=null
      }

      // Pulse layer tick
      if (pulseRef.current) {
        pulse.tick(globe.rotation)
        pulseTimer++
        if (pulseTimer % 45 === 0 && reposRef.current.length > 0) {
          pulse.simulateAmbient(reposRef.current)
        }
      }

      // Node pulse animation
      nodes.forEach((node,i) => {
        const isTrend = node.userData.isTrending as boolean
        const phase=(state.tick*0.02+i*0.4)%(Math.PI*2)
        node.scale.setScalar(1+Math.sin(phase)*(isTrend?0.14:0.08))
        const ring=rings[i]
        const rPhase=(state.tick*0.015+i*0.3)%(Math.PI*2)
        ring.scale.setScalar(node===selectedNode?1.5:1+Math.sin(rPhase)*0.15)
      })

      // Animate active society dot glow
      societyRings.forEach(o => {
        if (o.userData?.isSocietyDot) {
          const isSocActive = activeSocRef.current?.id === o.userData.societyId
          if (isSocActive) {
            const pulse2 = 1 + Math.sin(state.tick * 0.05) * 0.2
            o.scale.setScalar(pulse2)
          }
        }
      })

      renderer.render(scene, camera)
    }
    animate()

    // Auto-rotate
    ;(function autoRotate() {
      if (!state.autoRot) return
      globe.rotation.y+=0.003; syncNodes()
      buildSocietyRings(scene, societiesRef.current, activeSocRef.current, globe, societyRings)
      requestAnimationFrame(autoRotate)
    })()

    return () => {
      cancelAnimationFrame(state.animId)
      pulse.dispose()
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
  }, [repos, trendingNames, societies, activeSociety])

  // Fly-to
  useEffect(() => {
    if (!flyTarget || !stateRef.current) return
    stateRef.current.flyTarget = {
      x: -flyTarget.lat*Math.PI/180,
      y: (-flyTarget.lng*Math.PI/180)-Math.PI,
      progress: 0,
    }
    stateRef.current.camera.position.z = Math.min(stateRef.current.camera.position.z, 2.0)
  }, [flyTarget])

  return <div ref={mountRef} style={{ position:'fixed', inset:0, cursor:'grab', background:'#04070f', overflow:'hidden' }} />
}
