import { useEffect, useRef } from 'react'
import * as THREE from 'three'

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
     r * Math.sin(phi) * Math.sin(theta)
  )
}

function nodeRadius(stars: number) {
  return 0.013 + Math.log10(Math.max(stars, 1)) * 0.006
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

interface ClusterItem {
  lat: number; lng: number; repos: Repo[]
  totalStars: number; primaryLang: string
}

function clusterRepos(repos: Repo[], gridSize: number): ClusterItem[] {
  const grid = new Map<string, ClusterItem>()
  repos.forEach(repo => {
    const key = `${Math.round(repo.lat / gridSize)},${Math.round(repo.lng / gridSize)}`
    if (!grid.has(key)) grid.set(key, { lat: repo.lat, lng: repo.lng, repos: [], totalStars: 0, primaryLang: repo.lang })
    const g = grid.get(key)!
    g.repos.push(repo); g.totalStars += repo.stars
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

export default function Globe({ repos, onSelect, onHover, flyTarget, trendingNames }: GlobeProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    globe: THREE.Mesh
    nodeGroup: THREE.Group
    nodes: THREE.Mesh[]
    rings: THREE.Mesh[]
    pulseRings: THREE.Mesh[]  // extra rings for trending pulse
    rotVel: { x: number; y: number }
    isDragging: boolean
    wasDragging: boolean
    prevMouse: { x: number; y: number }
    flyTarget: { x: number; y: number; progress: number } | null
    tick: number
    animId: number
    autoRot: boolean
    currentGridSize: number
  } | null>(null)

  const reposRef        = useRef<Repo[]>(repos)
  const trendingRef     = useRef<Set<string>>(trendingNames)
  reposRef.current      = repos
  trendingRef.current   = trendingNames

  useEffect(() => {
    const el = mountRef.current
    if (!el || repos.length === 0) return

    const W = window.innerWidth, H = window.innerHeight
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(W, H)
    renderer.setClearColor(0x04070f, 1)
    el.appendChild(renderer.domElement)

    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 1000)
    camera.position.z = 2.8

    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_R, 64, 64),
      new THREE.MeshPhongMaterial({ color: 0x0a1628, emissive: 0x050d1e, specular: 0x1a3060, shininess: 22 })
    )
    scene.add(globe)

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

    scene.add(new THREE.Mesh(new THREE.SphereGeometry(GLOBE_R*1.08,64,64), new THREE.MeshPhongMaterial({color:0x1a6aff,side:THREE.FrontSide,transparent:true,opacity:0.055})))
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(GLOBE_R*1.13,64,64), new THREE.MeshPhongMaterial({color:0x3399ff,side:THREE.BackSide,transparent:true,opacity:0.10})))

    const starPos = new Float32Array(3000*3)
    for (let i = 0; i < 3000; i++) {
      const r2=80+Math.random()*120, t2=Math.random()*Math.PI*2, p2=Math.acos(2*Math.random()-1)
      starPos[i*3]=r2*Math.sin(p2)*Math.cos(t2); starPos[i*3+1]=r2*Math.cos(p2); starPos[i*3+2]=r2*Math.sin(p2)*Math.sin(t2)
    }
    const sg = new THREE.BufferGeometry()
    sg.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({color:0xffffff,size:0.5,sizeAttenuation:false,transparent:true,opacity:0.7})))

    scene.add(new THREE.AmbientLight(0x1a2a4a, 0.9))
    const sun = new THREE.DirectionalLight(0x4488ff, 1.5); sun.position.set(5,3,5); scene.add(sun)
    const fill = new THREE.DirectionalLight(0x0022ff, 0.3); fill.position.set(-5,-2,-5); scene.add(fill)

    let nodeGroup = new THREE.Group()
    let nodes: THREE.Mesh[] = []
    let rings: THREE.Mesh[] = []
    let pulseRings: THREE.Mesh[] = []
    let currentGridSize = 20
    let hoveredNode: THREE.Mesh | null = null
    let selectedNode: THREE.Mesh | null = null

    function buildNodes(gridSize: number) {
      scene.remove(nodeGroup)
      nodeGroup.traverse(obj => {
        if (obj instanceof THREE.Mesh) { obj.geometry.dispose(); (obj.material as THREE.Material).dispose() }
      })

      nodeGroup = new THREE.Group()
      nodes = []; rings = []; pulseRings = []

      const isClustered = gridSize > 0
      const items: ClusterItem[] = isClustered
        ? clusterRepos(reposRef.current, gridSize)
        : reposRef.current.map(r => ({ lat:r.lat, lng:r.lng, repos:[r], totalStars:r.stars, primaryLang:r.lang }))

      items.forEach(item => {
        const count   = item.repos.length
        const isTrend = item.repos.some(r => trendingRef.current.has(r.name))
        const color   = new THREE.Color(isTrend ? '#ffd700' : getLangColor(item.primaryLang))
        const radius  = (isClustered && count > 1)
          ? Math.min(0.014 + Math.log10(count+1)*0.014, 0.06)
          : nodeRadius(item.totalStars)
        const pos = latLngToVec3(item.lat, item.lng, GLOBE_R + 0.013)

        // Glow ring
        const ring = new THREE.Mesh(
          new THREE.SphereGeometry(radius*2.8,10,10),
          new THREE.MeshBasicMaterial({color, transparent:true, opacity: isTrend ? 0.25 : 0.18, depthWrite:false})
        )
        ring.position.copy(pos); nodeGroup.add(ring); rings.push(ring)

        // Trending pulse ring (extra outer ring)
        const pulseRing = new THREE.Mesh(
          new THREE.SphereGeometry(radius*4.5,10,10),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color('#ffd700'),
            transparent:true, opacity: isTrend ? 0.12 : 0,
            depthWrite:false
          })
        )
        pulseRing.position.copy(pos); nodeGroup.add(pulseRing); pulseRings.push(pulseRing)

        // Core node
        const node = new THREE.Mesh(
          new THREE.SphereGeometry(radius,16,16),
          new THREE.MeshBasicMaterial({color, transparent:true, opacity: isTrend ? 1.0 : 0.95})
        )
        node.position.copy(pos)
        node.userData = {
          repo: item.repos[0], repos: item.repos, count,
          isClustered: isClustered && count>1,
          isTrending: isTrend,
          originalColor: color.clone(), radius,
          ringIdx: rings.length-1,
        }
        nodeGroup.add(node); nodes.push(node)
      })

      nodeGroup.rotation.copy(globe.rotation)
      scene.add(nodeGroup)
      currentGridSize = gridSize
      hoveredNode = null; selectedNode = null

      if (sceneRef.current) {
        sceneRef.current.nodeGroup = nodeGroup
        sceneRef.current.nodes     = nodes
        sceneRef.current.rings     = rings
        sceneRef.current.pulseRings = pulseRings
        sceneRef.current.currentGridSize = gridSize
      }
    }

    buildNodes(currentGridSize)

    const state = {
      renderer, scene, camera, globe, nodeGroup, nodes, rings, pulseRings,
      rotVel: {x:0,y:0}, isDragging:false, wasDragging:false,
      prevMouse:{x:0,y:0}, flyTarget: null as {x:number;y:number;progress:number}|null,
      tick:0, animId:0, autoRot:true, currentGridSize,
    }
    sceneRef.current = state

    function syncNodes() { nodeGroup.rotation.copy(globe.rotation) }

    function updateVisibility() {
      const camDir = camera.position.clone().normalize()
      nodes.forEach((node, i) => {
        const wp = new THREE.Vector3(); node.getWorldPosition(wp)
        const dot = camDir.dot(wp.normalize())
        const vis = dot > -0.05
        node.visible = vis; rings[i].visible = vis; pulseRings[i].visible = vis
      })
    }

    function highlightNode(node: THREE.Mesh|null, on: boolean) {
      if (!node) return
      const {originalColor, ringIdx, isTrending} = node.userData
      const ring = rings[ringIdx]; if (!ring) return
      const rm   = ring.material as THREE.MeshBasicMaterial
      if (on) {
        ;(node.material as THREE.MeshBasicMaterial).color.set(0xffffff)
        ;(node.material as THREE.MeshBasicMaterial).opacity = 1
        ring.scale.setScalar(1.6); rm.opacity = 0.4
      } else if (node !== selectedNode) {
        ;(node.material as THREE.MeshBasicMaterial).color.copy(originalColor)
        ;(node.material as THREE.MeshBasicMaterial).opacity = isTrending ? 1.0 : 0.95
        ring.scale.setScalar(1); rm.opacity = isTrending ? 0.25 : 0.18
      }
    }

    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    function onMouseMove(e: MouseEvent) {
      mouse.x = (e.clientX/window.innerWidth)*2-1
      mouse.y = -(e.clientY/window.innerHeight)*2+1
      raycaster.setFromCamera(mouse, camera)
      const visible = nodes.filter(n => n.visible)
      const hits = raycaster.intersectObjects(visible)
      if (hits.length > 0) {
        const node = hits[0].object as THREE.Mesh
        if (node !== hoveredNode) { highlightNode(hoveredNode,false); hoveredNode=node; highlightNode(hoveredNode,true) }
        onHover(node.userData.repo as Repo, e.clientX, e.clientY)
        if (el) el.style.cursor = 'pointer'
      } else {
        if (hoveredNode) { highlightNode(hoveredNode,false); hoveredNode=null; onHover(null,0,0) }
        if (el) el.style.cursor = state.isDragging ? 'grabbing' : 'grab'
      }
    }

    function onClick() {
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(nodes.filter(n=>n.visible))
      if (hits.length > 0) {
        const node = hits[0].object as THREE.Mesh
        if (selectedNode && selectedNode !== node) highlightNode(selectedNode,false)
        selectedNode = node; highlightNode(selectedNode,true)
        onSelect(node.userData.repo as Repo)
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
      syncNodes(); state.prevMouse={x:e.clientX,y:e.clientY}
    }
    function onMouseUp() { state.isDragging=false }
    function onWheel(e: WheelEvent) { camera.position.z=Math.max(1.4,Math.min(6,camera.position.z+e.deltaY*0.002)) }
    function onResize() { camera.aspect=window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth,window.innerHeight) }

    el.addEventListener('mousemove', onMouseMove)
    el.addEventListener('click', onClick)
    el.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMoveGlobe)
    window.addEventListener('mouseup', onMouseUp)
    el.addEventListener('wheel', onWheel, {passive:true})
    window.addEventListener('resize', onResize)

    function animate() {
      state.animId = requestAnimationFrame(animate)
      state.tick++

      const z = camera.position.z
      const newGrid = z>3.5?20:z>2.4?10:z>1.9?4:0
      if (newGrid !== state.currentGridSize) buildNodes(newGrid)

      if (!state.isDragging && (Math.abs(state.rotVel.x)>0.0001||Math.abs(state.rotVel.y)>0.0001)) {
        globe.rotation.x+=state.rotVel.x; globe.rotation.y+=state.rotVel.y
        syncNodes(); state.rotVel.x*=0.93; state.rotVel.y*=0.93
      }

      if (state.flyTarget) {
        state.flyTarget.progress = Math.min(1, state.flyTarget.progress+0.025)
        const t = easeInOut(state.flyTarget.progress)
        globe.rotation.x += (state.flyTarget.x-globe.rotation.x)*t*0.1
        globe.rotation.y += (state.flyTarget.y-globe.rotation.y)*t*0.1
        syncNodes()
        if (state.flyTarget.progress>=1) state.flyTarget=null
      }

      updateVisibility()
      nodes.forEach((node,i) => {
        if (!node.visible) return
        const isTrend = node.userData.isTrending as boolean
        const phase   = (state.tick*0.018 + i*0.35) % (Math.PI*2)
        node.scale.setScalar(1 + Math.sin(phase)*(isTrend ? 0.14 : 0.07))

        const ring   = rings[i]
        const rPhase = (state.tick*0.012 + i*0.28) % (Math.PI*2)
        ring.scale.setScalar(node===selectedNode ? 1.6 : 1+Math.sin(rPhase)*0.2)

        // Trending pulse ring — expands and fades
        const pr = pulseRings[i]
        const prMat = pr.material as THREE.MeshBasicMaterial
        if (isTrend) {
          const pPhase = (state.tick*0.025 + i*0.15) % (Math.PI*2)
          const t = (Math.sin(pPhase)+1)/2  // 0→1→0
          pr.scale.setScalar(1 + t*1.2)
          prMat.opacity = 0.18 * (1-t)
        }
      })

      renderer.render(scene, camera)
    }
    animate()

    ;(function autoRotate() {
      if (!state.autoRot) return
      globe.rotation.y+=0.0025; syncNodes()
      requestAnimationFrame(autoRotate)
    })()

    return () => {
      cancelAnimationFrame(state.animId)
      el.removeEventListener('mousemove',onMouseMove); el.removeEventListener('click',onClick)
      el.removeEventListener('mousedown',onMouseDown); window.removeEventListener('mousemove',onMouseMoveGlobe)
      window.removeEventListener('mouseup',onMouseUp); el.removeEventListener('wheel',onWheel)
      window.removeEventListener('resize',onResize); renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [repos, trendingNames])

  useEffect(() => {
    if (!flyTarget || !sceneRef.current) return
    sceneRef.current.flyTarget = {
      x: -flyTarget.lat*Math.PI/180,
      y: (-flyTarget.lng*Math.PI/180)-Math.PI,
      progress: 0,
    }
    sceneRef.current.camera.position.z = Math.min(sceneRef.current.camera.position.z, 2.0)
  }, [flyTarget])

  return <div ref={mountRef} style={{position:'fixed',inset:0,cursor:'grab',background:'#04070f'}}/>
}
