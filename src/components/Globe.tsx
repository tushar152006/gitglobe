import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export interface Repo {
  name: string; desc: string; stars: number; forks: number; lang: string; owner: string;
  lat: number; lng: number; loc: string; topics: string;
}

// Pillar 2: Societies Definition
export const SOCIETIES = {
  AI: { id: 'ai', name: 'AI Society', color: '#00e5ff', icon: '🧠', keywords: ['ai', 'ml', 'tensor', 'gpt', 'neural', 'cuda'] },
  WEB: { id: 'web', name: 'Web Society', color: '#fbbf24', icon: '🌐', keywords: ['react', 'vue', 'web', 'css', 'html', 'nextjs', 'tailwind'] },
  SYSTEMS: { id: 'sys', name: 'Systems Society', color: '#f472b6', icon: '⚙️', keywords: ['kernel', 'compiler', 'rust', 'cpp', 'llvm', 'os', 'c'] },
  BLOCKCHAIN: { id: 'bc', name: 'Chain Society', color: '#a78bfa', icon: '🔗', keywords: ['eth', 'solana', 'crypto', 'web3', 'smart-contract'] },
  GENERAL: { id: 'gen', name: 'Local Society', color: '#64748b', icon: '📦', keywords: [] }
}

export function getSociety(repo: Repo) {
  const text = (repo.topics + " " + repo.desc + " " + repo.lang).toLowerCase();
  if (SOCIETIES.AI.keywords.some(k => text.includes(k))) return SOCIETIES.AI;
  if (SOCIETIES.BLOCKCHAIN.keywords.some(k => text.includes(k))) return SOCIETIES.BLOCKCHAIN;
  if (SOCIETIES.SYSTEMS.keywords.some(k => text.includes(k))) return SOCIETIES.SYSTEMS;
  if (SOCIETIES.WEB.keywords.some(k => text.includes(k))) return SOCIETIES.WEB;
  return SOCIETIES.GENERAL;
}

const GLOBE_R = 1;

export default function Globe({ repos, onSelect, flyTarget }: any) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<any>(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el || repos.length === 0) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, el.clientWidth / el.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 2.8);
    camera.lookAt(0, 0, 0);

    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_R, 64, 64),
      new THREE.MeshPhongMaterial({ color: 0x0a1628, emissive: 0x050d1e, specular: 0x1a3060, shininess: 22 })
    );
    scene.add(globe);

    // Pillar 3: Pulse Layer Geometries
    const nodeInst = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 12), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9 }), repos.length);
    const ringInst = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 12), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.3, depthWrite: false }), repos.length);

    const _mat = new THREE.Matrix4();
    const _quat = new THREE.Quaternion();
    const _scale = new THREE.Vector3();
    const _color = new THREE.Color();

    repos.forEach((repo: Repo, i: number) => {
      const society = getSociety(repo);
      const pos = new THREE.Vector3().setFromSphericalCoords(GLOBE_R + 0.015, (90 - repo.lat) * (Math.PI / 180), (repo.lng + 180) * (Math.PI / 180));
      const radius = 0.013 + Math.log10(Math.max(repo.stars, 1)) * 0.006;

      _scale.setScalar(radius);
      _mat.compose(pos, _quat, _scale);
      nodeInst.setMatrixAt(i, _mat);
      _color.set(society.color);
      nodeInst.setColorAt(i, _color);

      _scale.setScalar(radius * 2.5);
      _mat.compose(pos, _quat, _scale);
      ringInst.setMatrixAt(i, _mat);
      ringInst.setColorAt(i, _color);
    });

    scene.add(nodeInst); scene.add(ringInst);
    scene.add(new THREE.AmbientLight(0x1a2a4a, 0.9));
    const sun = new THREE.DirectionalLight(0x4488ff, 1.5); sun.position.set(5,3,5); scene.add(sun);

    const state = { renderer, scene, camera, globe, nodeInst, ringInst, tick: 0, animId: 0 };
    stateRef.current = state;

    function animate() {
      state.animId = requestAnimationFrame(animate);
      state.tick++;
      // Centering fix: ensures renderer follows container size
      if (renderer.domElement.width !== el!.clientWidth || renderer.domElement.height !== el!.clientHeight) {
        renderer.setSize(el!.clientWidth, el!.clientHeight);
        camera.aspect = el!.clientWidth / el!.clientHeight;
        camera.updateProjectionMatrix();
      }
      // Pulse Animation
      const s = 1 + Math.sin(state.tick * 0.05) * 0.15;
      ringInst.scale.set(s, s, s);
      globe.rotation.y += 0.001;
      renderer.render(scene, camera);
    }
    animate();
    window.dispatchEvent(new Event('resize')); // Immediate centering fix

    return () => { cancelAnimationFrame(state.animId); renderer.dispose(); if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement); };
  }, [repos]);

  return <div ref={mountRef} style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />;
}