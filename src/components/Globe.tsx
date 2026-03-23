import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export interface Repo {
  name: string; desc: string; stars: number; forks: number; lang: string; owner: string;
  lat: number; lng: number; loc: string; topics: string;
}

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

export default function Globe({ repos, onSelect }: any) {
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

    // Nodes as individual meshes for interaction
    const nodes: THREE.Mesh[] = []
    repos.forEach((repo: Repo) => {
      const society = getSociety(repo);
      const pos = new THREE.Vector3().setFromSphericalCoords(GLOBE_R + 0.01, (90 - repo.lat) * (Math.PI / 180), (repo.lng + 180) * (Math.PI / 180));
      const radius = 0.008 + Math.log10(Math.max(repo.stars, 1)) * 0.0045;
      const node = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 10, 10),
        new THREE.MeshBasicMaterial({ color: society.color })
      );
      node.position.copy(pos);
      node.userData = repo;
      scene.add(node);
      nodes.push(node);
    });

    // Rings as instanced for performance
    const ringInst = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 10), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.3, depthWrite: false }), repos.length);

    const _mat = new THREE.Matrix4();
    const _quat = new THREE.Quaternion();
    const _scale = new THREE.Vector3();
    const _color = new THREE.Color();

    repos.forEach((repo: Repo, i: number) => {
      const society = getSociety(repo);
      const pos = new THREE.Vector3().setFromSphericalCoords(GLOBE_R + 0.01, (90 - repo.lat) * (Math.PI / 180), (repo.lng + 180) * (Math.PI / 180));
      const radius = 0.008 + Math.log10(Math.max(repo.stars, 1)) * 0.0045;

      _scale.setScalar(radius * 2.5);
      _mat.compose(pos, _quat, _scale);
      ringInst.setMatrixAt(i, _mat);
      _color.set(society.color);
      ringInst.setColorAt(i, _color);
    });

    scene.add(ringInst);
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const sun = new THREE.DirectionalLight(0x4488ff, 1.5); sun.position.set(5,3,5); scene.add(sun);

    const state = { renderer, scene, camera, globe, nodes, ringInst, tick: 0, animId: 0 };
    stateRef.current = state;

    // Raycaster for interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function onMouseMove(e: MouseEvent) {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(nodes);
      if (hits.length > 0) {
        document.body.style.cursor = 'pointer';
      } else {
        document.body.style.cursor = 'default';
      }
    }

    function onClick() {
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(nodes);
      if (hits.length > 0) {
        onSelect(hits[0].object.userData);
      } else {
        onSelect(null);
      }
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('click', onClick);

    function onResize() {
      if (!el) return;
      const w = el.clientWidth; const h = el.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    function animate() {
      state.animId = requestAnimationFrame(animate);
      state.tick++;
      const s = 1 + Math.sin(state.tick * 0.05) * 0.15;
      ringInst.scale.set(s, s, s);
      globe.rotation.y += 0.002;
      renderer.render(scene, camera);
    }
    animate();

    return () => { 
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('click', onClick);
      cancelAnimationFrame(state.animId); 
      renderer.dispose(); 
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement); 
    };
  }, [repos, onSelect]);

  return <div ref={mountRef} style={{ position: 'fixed', inset: 0, width: '100%', height: '100%' }} />;
}