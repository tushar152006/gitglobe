// ── PulseLayer.ts ─────────────────────────────────────────────────────────────
// Phase 3: Pulse system — ripple rings, brightness flares, fork arcs

import * as THREE from 'three'
import type { Repo } from './Globe'

// ── Pulse event types ─────────────────────────────────────────────────────────
export type PulseEventType = 'commit' | 'star' | 'fork'

export interface PulseEvent {
  type: PulseEventType
  lat: number
  lng: number
  targetLat?: number   // for fork arcs
  targetLng?: number
  intensity: number    // 0–1
}

// ── Color map per event type ──────────────────────────────────────────────────
const PULSE_COLORS: Record<PulseEventType, number> = {
  commit: 0x00e5ff,   // cyan
  star:   0xffd700,   // gold
  fork:   0xa78bfa,   // violet
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

// ── Ripple ring ───────────────────────────────────────────────────────────────
interface Ripple {
  mesh: THREE.Mesh
  born: number
  lifespan: number
  baseLat: number
  baseLng: number
  color: number
}

// ── Fork arc ─────────────────────────────────────────────────────────────────
interface ForkArc {
  line: THREE.Line
  born: number
  lifespan: number
}

// ── Flare ─────────────────────────────────────────────────────────────────────
interface Flare {
  mesh: THREE.Mesh
  born: number
  lifespan: number
  baseLat: number
  baseLng: number
}

export class PulseManager {
  private scene: THREE.Scene
  private globe: THREE.Object3D
  private ripples: Ripple[] = []
  private arcs: ForkArc[] = []
  private flares: Flare[] = []
  private clock = 0

  constructor(scene: THREE.Scene, globe: THREE.Object3D) {
    this.scene = scene
    this.globe = globe
  }

  // ── Emit a pulse event ─────────────────────────────────────────────────────
  emit(event: PulseEvent) {
    if (event.type === 'commit') this.addRipple(event)
    if (event.type === 'star')   this.addFlare(event)
    if (event.type === 'fork' && event.targetLat !== undefined && event.targetLng !== undefined) {
      this.addArc(event)
    }
  }

  private getPos(lat: number, lng: number, r = GLOBE_R + 0.015) {
    const v = latLngToVec3(lat, lng, r)
    const rotMat = new THREE.Matrix4().makeRotationFromEuler((this.globe as THREE.Mesh).rotation)
    v.applyMatrix4(rotMat)
    return v
  }

  // ── Ripple ring (commit) ───────────────────────────────────────────────────
  private addRipple(event: PulseEvent) {
    const geo = new THREE.RingGeometry(0.02, 0.028, 32)
    const mat = new THREE.MeshBasicMaterial({
      color: PULSE_COLORS[event.type],
      transparent: true,
      opacity: 0.8 * event.intensity,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(this.getPos(event.lat, event.lng))
    mesh.lookAt(new THREE.Vector3(0, 0, 0))
    this.scene.add(mesh)

    this.ripples.push({
      mesh, born: this.clock, lifespan: 120 + Math.random() * 60,
      baseLat: event.lat, baseLng: event.lng,
      color: PULSE_COLORS[event.type],
    })
  }

  // ── Brightness flare (star) ────────────────────────────────────────────────
  private addFlare(event: PulseEvent) {
    const geo = new THREE.SphereGeometry(0.025, 8, 8)
    const mat = new THREE.MeshBasicMaterial({
      color: PULSE_COLORS.star,
      transparent: true,
      opacity: event.intensity,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(this.getPos(event.lat, event.lng))
    this.scene.add(mesh)

    this.flares.push({
      mesh, born: this.clock, lifespan: 80,
      baseLat: event.lat, baseLng: event.lng,
    })
  }

  // ── Fork arc ───────────────────────────────────────────────────────────────
  private addArc(event: PulseEvent) {
    const from = latLngToVec3(event.lat, event.lng, GLOBE_R + 0.02)
    const to   = latLngToVec3(event.targetLat!, event.targetLng!, GLOBE_R + 0.02)
    const mid  = from.clone().add(to).multiplyScalar(0.5).normalize().multiplyScalar(GLOBE_R * 1.35)

    const curve = new THREE.QuadraticBezierCurve3(from, mid, to)
    const pts   = curve.getPoints(40)
    const geo   = new THREE.BufferGeometry().setFromPoints(pts)
    const mat   = new THREE.LineBasicMaterial({
      color: PULSE_COLORS.fork, transparent: true, opacity: 0.7, depthWrite: false,
    })
    const line = new THREE.Line(geo, mat)

    const rotMat = new THREE.Matrix4().makeRotationFromEuler((this.globe as THREE.Mesh).rotation)
    line.applyMatrix4(rotMat)
    this.scene.add(line)

    this.arcs.push({ line, born: this.clock, lifespan: 150 })
  }

  // ── Tick — call every animation frame ─────────────────────────────────────
  tick(globeRotation: THREE.Euler) {
    this.clock++
    const rotMat = new THREE.Matrix4().makeRotationFromEuler(globeRotation)

    // Update ripples
    this.ripples = this.ripples.filter(r => {
      const age = this.clock - r.born
      const t   = age / r.lifespan
      if (t >= 1) { this.scene.remove(r.mesh); r.mesh.geometry.dispose(); return false }

      const pos = latLngToVec3(r.baseLat, r.baseLng, GLOBE_R + 0.015)
      pos.applyMatrix4(rotMat)
      r.mesh.position.copy(pos)
      r.mesh.lookAt(0, 0, 0)

      const s = 1 + t * 4
      r.mesh.scale.setScalar(s);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - t)
      return true
    })

    // Update flares
    this.flares = this.flares.filter(f => {
      const age = this.clock - f.born
      const t   = age / f.lifespan
      if (t >= 1) { this.scene.remove(f.mesh); f.mesh.geometry.dispose(); return false }

      const pos = latLngToVec3(f.baseLat, f.baseLng, GLOBE_R + 0.015)
      pos.applyMatrix4(rotMat)
      f.mesh.position.copy(pos)

      const brightness = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;
      (f.mesh.material as THREE.MeshBasicMaterial).opacity = brightness
      f.mesh.scale.setScalar(1 + t * 1.5)
      return true
    })

    // Fade out arcs
    this.arcs = this.arcs.filter(a => {
      const t = (this.clock - a.born) / a.lifespan
      if (t >= 1) { this.scene.remove(a.line); a.line.geometry.dispose(); return false }
      ;(a.line.material as THREE.LineBasicMaterial).opacity = 0.7 * (1 - t)
      return true
    })
  }

  // ── Simulate events from existing repo data ────────────────────────────────
  simulateAmbient(repos: Repo[]) {
    if (repos.length === 0) return
    const idx = Math.floor(Math.random() * Math.min(repos.length, 80))
    const repo = repos[idx]
    if (!repo || !repo.lat || !repo.lng) return

    const roll = Math.random()
    if (roll < 0.55) {
      this.emit({ type: 'commit', lat: repo.lat, lng: repo.lng, intensity: 0.4 + Math.random() * 0.5 })
    } else if (roll < 0.8) {
      this.emit({ type: 'star', lat: repo.lat, lng: repo.lng, intensity: 0.5 + Math.random() * 0.5 })
    } else {
      const idx2 = Math.floor(Math.random() * Math.min(repos.length, 80))
      const target = repos[idx2]
      if (target?.lat && target?.lng && target.name !== repo.name) {
        this.emit({ type: 'fork', lat: repo.lat, lng: repo.lng, targetLat: target.lat, targetLng: target.lng, intensity: 0.8 })
      }
    }
  }

  dispose() {
    ;[...this.ripples, ...this.flares].forEach(r => {
      this.scene.remove(r.mesh); r.mesh.geometry.dispose()
    })
    this.arcs.forEach(a => { this.scene.remove(a.line); a.line.geometry.dispose() })
    this.ripples = []; this.flares = []; this.arcs = []
  }
}
