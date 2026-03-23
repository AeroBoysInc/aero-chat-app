import { useRef, useState, useCallback, useMemo, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { Chess, Square } from 'chess.js'
import { Settings2 } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface BoardProps {
  chess: Chess
  myColor: 'blue' | 'green'
  lastMove: { from: string; to: string } | null
  onMove: (from: Square, to: Square, promotion?: string) => void
  disabled: boolean
}

interface SceneProps extends BoardProps {
  highQuality: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const
const ALL_SQUARES: Square[] = FILES.flatMap(f =>
  [1, 2, 3, 4, 5, 6, 7, 8].map(r => `${f}${r}` as Square)
)

function squareToXZ(sq: Square, flipped: boolean): [number, number] {
  const file = sq.charCodeAt(0) - 97
  const rank = parseInt(sq[1]) - 1
  const x = flipped ? 3.5 - file : file - 3.5
  const z = flipped ? rank - 3.5 : 3.5 - rank
  return [x, z]
}

// ─── Shared tile materials — high quality (clearcoat, NO transmission) ────────
// NOTE: transmission forces a second full-scene render pass — avoid it on repeated geometry
const TILE_LIGHT = new THREE.MeshPhysicalMaterial({
  color: '#c8e4f8', metalness: 0, roughness: 0.08,
  clearcoat: 1.0, clearcoatRoughness: 0.05,
})
const TILE_DARK = new THREE.MeshPhysicalMaterial({
  color: '#0e2d5c', metalness: 0.15, roughness: 0.2,
  clearcoat: 0.6, clearcoatRoughness: 0.1,
})
const TILE_SELECTED = new THREE.MeshPhysicalMaterial({
  color: '#7c3aed', emissive: '#5b21b6', emissiveIntensity: 0.9,
  metalness: 0, roughness: 0.1, clearcoat: 1.0,
})
const TILE_LASTMOVE_LIGHT = new THREE.MeshPhysicalMaterial({
  color: '#c8e4f8', emissive: '#92400e', emissiveIntensity: 0.55,
  metalness: 0, roughness: 0.08, clearcoat: 1.0,
})
const TILE_LASTMOVE_DARK = new THREE.MeshPhysicalMaterial({
  color: '#0e2d5c', emissive: '#92400e', emissiveIntensity: 0.45,
  metalness: 0.15, roughness: 0.2, clearcoat: 0.6,
})
const TILE_CHECK = new THREE.MeshPhysicalMaterial({
  color: '#991b1b', emissive: '#dc2626', emissiveIntensity: 1.1,
  metalness: 0, roughness: 0.1, clearcoat: 1.0,
})

// ─── Shared tile materials — low quality ──────────────────────────────────────
const TILE_LIGHT_LQ = new THREE.MeshStandardMaterial({ color: '#c8e4f8', roughness: 0.18, metalness: 0 })
const TILE_DARK_LQ  = new THREE.MeshStandardMaterial({ color: '#0e2d5c', roughness: 0.35, metalness: 0.1 })
const TILE_SELECTED_LQ      = new THREE.MeshStandardMaterial({ color: '#7c3aed', emissive: '#5b21b6', emissiveIntensity: 0.9 })
const TILE_LASTMOVE_LIGHT_LQ = new THREE.MeshStandardMaterial({ color: '#c8e4f8', emissive: '#92400e', emissiveIntensity: 0.55 })
const TILE_LASTMOVE_DARK_LQ  = new THREE.MeshStandardMaterial({ color: '#0e2d5c', emissive: '#92400e', emissiveIntensity: 0.45 })
const TILE_CHECK_LQ = new THREE.MeshStandardMaterial({ color: '#991b1b', emissive: '#dc2626', emissiveIntensity: 1.1 })

// ─── Piece material ───────────────────────────────────────────────────────────
function usePieceMat(isBlue: boolean, isSelected: boolean, isCheck: boolean) {
  const mat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color:             isBlue ? '#00d4ff' : '#34d399',
    emissive:          isCheck ? '#cc1111' : (isBlue ? '#003d5c' : '#0a2a1a'),
    emissiveIntensity: isSelected ? 2.2 : (isCheck ? 1.2 : 0.55),
    metalness: 0.25,
    roughness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    reflectivity: 1.0,
  }), [isBlue, isSelected, isCheck])
  useEffect(() => () => mat.dispose(), [mat])
  return mat
}

// ─── Piece geometry ───────────────────────────────────────────────────────────
function Pawn({ mat }: { mat: THREE.MeshPhysicalMaterial }) {
  return (
    <group>
      <mesh material={mat} position={[0, 0.04, 0]}><cylinderGeometry args={[0.30, 0.36, 0.08, 20]} /></mesh>
      <mesh material={mat} position={[0, 0.26, 0]}><cylinderGeometry args={[0.15, 0.22, 0.34, 16]} /></mesh>
      <mesh material={mat} position={[0, 0.52, 0]}><sphereGeometry    args={[0.23, 24, 24]} /></mesh>
    </group>
  )
}

function Rook({ mat }: { mat: THREE.MeshPhysicalMaterial }) {
  const bm: [number, number][] = [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]
  return (
    <group>
      <mesh material={mat} position={[0, 0.04, 0]}><cylinderGeometry args={[0.32, 0.37, 0.08, 20]} /></mesh>
      <mesh material={mat} position={[0, 0.30, 0]}><cylinderGeometry args={[0.23, 0.28, 0.42, 16]} /></mesh>
      <mesh material={mat} position={[0, 0.58, 0]}><cylinderGeometry args={[0.29, 0.23, 0.12, 20]} /></mesh>
      {bm.map(([bx, bz], i) => (
        <mesh key={i} material={mat} position={[bx, 0.73, bz]}><boxGeometry args={[0.09, 0.15, 0.09]} /></mesh>
      ))}
    </group>
  )
}

function Knight({ mat }: { mat: THREE.MeshPhysicalMaterial }) {
  return (
    <group>
      <mesh material={mat} position={[0,    0.04, 0.00]}><cylinderGeometry args={[0.32, 0.37, 0.08, 20]} /></mesh>
      <mesh material={mat} position={[0,    0.28, 0.00]}><cylinderGeometry args={[0.19, 0.25, 0.38, 16]} /></mesh>
      <mesh material={mat} position={[0,    0.59, 0.05]} rotation={[0.35, 0, 0]}><boxGeometry args={[0.28, 0.30, 0.20]} /></mesh>
      <mesh material={mat} position={[0,    0.55, 0.20]} rotation={[0.55, 0, 0]}><boxGeometry args={[0.18, 0.12, 0.16]} /></mesh>
    </group>
  )
}

function Bishop({ mat }: { mat: THREE.MeshPhysicalMaterial }) {
  return (
    <group>
      <mesh material={mat} position={[0, 0.04, 0]}><cylinderGeometry args={[0.32, 0.37, 0.08, 20]} /></mesh>
      <mesh material={mat} position={[0, 0.32, 0]}><cylinderGeometry args={[0.16, 0.23, 0.46, 16]} /></mesh>
      <mesh material={mat} position={[0, 0.61, 0]}><sphereGeometry    args={[0.15, 20, 20]} /></mesh>
      <mesh material={mat} position={[0, 0.90, 0]}><coneGeometry       args={[0.13, 0.42, 16]} /></mesh>
    </group>
  )
}

function Queen({ mat }: { mat: THREE.MeshPhysicalMaterial }) {
  const pts = [0, 72, 144, 216, 288].map(d => {
    const r = (d * Math.PI) / 180
    return [Math.sin(r) * 0.19, Math.cos(r) * 0.19] as [number, number]
  })
  return (
    <group>
      <mesh material={mat} position={[0, 0.04, 0]}><cylinderGeometry args={[0.34, 0.39, 0.08, 20]} /></mesh>
      <mesh material={mat} position={[0, 0.36, 0]}><cylinderGeometry args={[0.19, 0.26, 0.54, 16]} /></mesh>
      <mesh material={mat} position={[0, 0.72, 0]}><sphereGeometry    args={[0.23, 24, 24]} /></mesh>
      {pts.map(([cx, cz], i) => (
        <mesh key={i} material={mat} position={[cx, 0.96, cz]}>
          <coneGeometry args={[0.065, 0.20, 10]} />
        </mesh>
      ))}
    </group>
  )
}

function King({ mat }: { mat: THREE.MeshPhysicalMaterial }) {
  return (
    <group>
      <mesh material={mat} position={[0, 0.04, 0]}><cylinderGeometry args={[0.34, 0.39, 0.08, 20]} /></mesh>
      <mesh material={mat} position={[0, 0.38, 0]}><cylinderGeometry args={[0.21, 0.27, 0.58, 16]} /></mesh>
      <mesh material={mat} position={[0, 0.76, 0]}><sphereGeometry    args={[0.19, 20, 20]} /></mesh>
      <mesh material={mat} position={[0, 1.04, 0]}><boxGeometry args={[0.07, 0.40, 0.07]} /></mesh>
      <mesh material={mat} position={[0, 1.13, 0]}><boxGeometry args={[0.26, 0.07, 0.07]} /></mesh>
    </group>
  )
}

const PIECE_COMPONENTS: Record<string, React.ComponentType<{ mat: THREE.MeshPhysicalMaterial }>> = {
  p: Pawn, r: Rook, n: Knight, b: Bishop, q: Queen, k: King,
}

// ─── Animated piece ───────────────────────────────────────────────────────────
function PieceMesh({
  type, isBlue, isSelected, isCheck, x, z, onClick,
}: {
  type: string; isBlue: boolean; isSelected: boolean; isCheck: boolean
  x: number; z: number; onClick: () => void
}) {
  const groupRef      = useRef<THREE.Group>(null)
  const isSelectedRef = useRef(isSelected)
  isSelectedRef.current = isSelected

  const mat = usePieceMat(isBlue, isSelected, isCheck)

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    groupRef.current.position.y = isSelectedRef.current
      ? 0.16 + Math.sin(clock.elapsedTime * 3.8) * 0.07
      : 0
  })

  const Part = PIECE_COMPONENTS[type]
  if (!Part) return null

  return (
    <group ref={groupRef} position={[x, 0, z]} onClick={e => { e.stopPropagation(); onClick() }}>
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.30, 20]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.22} />
      </mesh>
      <Part mat={mat} />
    </group>
  )
}

// ─── Valid-move indicators ────────────────────────────────────────────────────
function PulseDot({ x, z, isCapture }: { x: number; z: number; isCapture: boolean }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    if (matRef.current)
      matRef.current.emissiveIntensity = 0.7 + Math.sin(clock.elapsedTime * 4) * 0.5
  })
  return (
    <mesh position={[x, 0.052, z]} rotation={[-Math.PI / 2, 0, 0]}>
      {isCapture ? <ringGeometry args={[0.34, 0.46, 32]} /> : <circleGeometry args={[0.18, 20]} />}
      <meshStandardMaterial ref={matRef} color="#00d4ff" emissive="#00d4ff" emissiveIntensity={1.0} transparent opacity={0.9} />
    </mesh>
  )
}

// ─── Frutiger Aero sky dome ───────────────────────────────────────────────────
// Matches the landing page palette: deep saturated blues with bright cyan zenith
function AeroSkyDome() {
  const texture = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 2; c.height = 512
    const ctx = c.getContext('2d')!
    // Top of canvas (y=0) maps to sphere zenith (flipY), bottom to underground
    const g = ctx.createLinearGradient(0, 0, 0, 512)
    g.addColorStop(0,    '#5fd4f4')  // zenith — bright Aero cyan
    g.addColorStop(0.18, '#2592d8')  // upper sky — vivid sky blue
    g.addColorStop(0.38, '#1e78c8')  // mid sky — landing page blue
    g.addColorStop(0.55, '#1560aa')  // rich blue
    g.addColorStop(0.70, '#0f4a8a')  // deep navy — landing page base
    g.addColorStop(0.84, '#0a3d8f')  // near-horizon underside
    g.addColorStop(1,    '#050f28')  // underground — near black
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 2, 512)
    const tex = new THREE.CanvasTexture(c)
    tex.needsUpdate = true
    return tex
  }, [])

  return (
    <mesh>
      <sphereGeometry args={[200, 32, 16]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} depthWrite={false} />
    </mesh>
  )
}

// ─── Volumetric cloud layer beneath the board ─────────────────────────────────
function VolumetricClouds() {
  const groupRef = useRef<THREE.Group>(null)

  const cloudTexture = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 512; c.height = 512
    const ctx = c.getContext('2d')!

    const puff = (x: number, y: number, r: number, a: number) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0,   `rgba(215,238,255,${a})`)
      g.addColorStop(0.5, `rgba(195,225,255,${a * 0.5})`)
      g.addColorStop(1,   `rgba(180,215,255,0)`)
      ctx.fillStyle = g
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    }
    puff(256, 256, 200, 0.60); puff(340, 200, 160, 0.50)
    puff(170, 230, 145, 0.45); puff(300, 330, 125, 0.40)
    puff(195, 305, 135, 0.42); puff(390, 290, 105, 0.35)
    puff(125, 325, 100, 0.30); puff(430, 145,  95, 0.35)

    const tex = new THREE.CanvasTexture(c)
    tex.needsUpdate = true
    return tex
  }, [])

  const layers = useMemo(() => [
    { y: -1.8, x:  0,  z:  0,  s: 36, op: 0.70, rot: 0.00 },
    { y: -2.2, x:  3,  z: -3,  s: 29, op: 0.58, rot: 0.40 },
    { y: -2.6, x: -3,  z:  3,  s: 42, op: 0.48, rot: -0.30 },
    { y: -1.5, x: -6,  z: -4,  s: 22, op: 0.42, rot: 0.80 },
    { y: -3.0, x:  2,  z:  1,  s: 52, op: 0.32, rot: 0.15 },
  ], [])

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    groupRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.025) * 0.04
  })

  return (
    <group ref={groupRef}>
      {layers.map((l, i) => (
        <mesh key={i} position={[l.x, l.y, l.z]} rotation={[-Math.PI / 2, 0, l.rot]}>
          <planeGeometry args={[l.s, l.s]} />
          <meshBasicMaterial map={cloudTexture} transparent opacity={l.op} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

// ─── Background bubbles — InstancedMesh (1 draw call for all) ────────────────
interface BubbleDef { pos: [number, number, number]; r: number; speed: number; phase: number }

// Scattered in all directions, well away from the board
const BG_BUBBLES: BubbleDef[] = [
  { pos: [-14,  2, -18], r: 2.4, speed: 0.12, phase: 0.0 },
  { pos: [ 12,  4, -22], r: 1.8, speed: 0.09, phase: 1.1 },
  { pos: [ -6,  0, -25], r: 3.0, speed: 0.07, phase: 2.4 },
  { pos: [ 18,  1, -15], r: 1.2, speed: 0.15, phase: 0.7 },
  { pos: [-20,  5, -12], r: 1.6, speed: 0.11, phase: 3.2 },
  { pos: [  6,  3, -28], r: 2.0, speed: 0.08, phase: 1.8 },
  { pos: [-10,  2,  15], r: 1.8, speed: 0.10, phase: 0.9 },
  { pos: [  8,  0,  18], r: 2.2, speed: 0.08, phase: 2.1 },
  { pos: [-18,  3,  10], r: 1.4, speed: 0.13, phase: 4.5 },
  { pos: [ 14,  5,  16], r: 1.0, speed: 0.17, phase: 1.3 },
  { pos: [-22,  2,   2], r: 2.6, speed: 0.09, phase: 3.7 },
  { pos: [-25,  1, -12], r: 3.2, speed: 0.06, phase: 5.2 },
  { pos: [ 22,  3,  -4], r: 2.0, speed: 0.10, phase: 2.8 },
  { pos: [ 26,  4,  -8], r: 2.8, speed: 0.07, phase: 4.0 },
  { pos: [ -8, 13, -14], r: 2.0, speed: 0.06, phase: 1.2 },
  { pos: [ 10, 15,  -8], r: 1.6, speed: 0.08, phase: 3.9 },
  { pos: [  0, 17,   0], r: 2.4, speed: 0.05, phase: 0.3 },
  { pos: [-15, 11,   6], r: 1.8, speed: 0.09, phase: 2.2 },
]
const BG_BUBBLE_COUNT_HQ = BG_BUBBLES.length  // 18
const BG_BUBBLE_COUNT_LQ = 7

function BackgroundBubbles({ highQuality }: { highQuality: boolean }) {
  const meshRef  = useRef<THREE.InstancedMesh>(null!)
  const dummy    = useMemo(() => new THREE.Object3D(), [])
  const geo      = useMemo(() => new THREE.SphereGeometry(1, 14, 14), [])
  const mat      = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#88ccff',
    transparent: true,
    opacity: 0.11,
    roughness: 0,
    metalness: 0.05,
    // No transmission — avoid expensive extra render pass
    iridescence: 1.0,
    iridescenceIOR: 1.3,
    side: THREE.FrontSide,
  }), [])

  const count = highQuality ? BG_BUBBLE_COUNT_HQ : BG_BUBBLE_COUNT_LQ

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const t = clock.elapsedTime
    meshRef.current.count = count
    for (let i = 0; i < count; i++) {
      const b = BG_BUBBLES[i]
      dummy.position.set(b.pos[0], b.pos[1] + Math.sin(t * b.speed + b.phase) * 1.6, b.pos[2])
      dummy.rotation.set(t * 0.04, t * 0.08, 0)
      dummy.scale.setScalar(b.r)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={meshRef} args={[geo, mat, BG_BUBBLE_COUNT_HQ]} />
}

// ─── Poppable bubbles — near board periphery, clickable ──────────────────────
interface PopBubbleDef { pos: [number, number, number]; r: number; speed: number; phase: number }

// Positioned at the board edge (x/z ≥ ±4.8) so they never cover pieces
const POP_BUBBLE_DEFS: PopBubbleDef[] = [
  { pos: [-5.5,  1.8,   0], r: 0.55, speed: 0.15, phase: 0.0 },
  { pos: [ 5.5,  2.2,  -1], r: 0.65, speed: 0.12, phase: 1.3 },
  { pos: [-4.8,  3.2,   3], r: 0.48, speed: 0.18, phase: 2.6 },
  { pos: [ 4.8,  1.2,   3], r: 0.72, speed: 0.14, phase: 0.8 },
  { pos: [ 0.5,  3.8,  -5.5], r: 0.50, speed: 0.16, phase: 3.2 },
  { pos: [-1.5,  2.6,   5.5], r: 0.62, speed: 0.13, phase: 1.7 },
]

const popBubbleMat = new THREE.MeshPhysicalMaterial({
  color: '#aadeff',
  transparent: true,
  opacity: 0.20,
  roughness: 0,
  metalness: 0.1,
  iridescence: 1.0,
  iridescenceIOR: 1.4,
  side: THREE.FrontSide,
})

function PoppableBubble({ def }: { def: PopBubbleDef }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const stateRef = useRef<{ phase: 'idle' | 'popping' | 'waiting'; t: number }>({
    phase: 'idle', t: 0,
  })

  useFrame(({ clock }, delta) => {
    if (!meshRef.current) return
    const s = stateRef.current
    const t = clock.elapsedTime

    if (s.phase === 'idle') {
      meshRef.current.visible = true
      meshRef.current.position.y = def.pos[1] + Math.sin(t * def.speed + def.phase) * 0.55
      meshRef.current.scale.setScalar(1)
    } else if (s.phase === 'popping') {
      s.t += delta
      const scale = 1 + (s.t / 0.18) * 1.6  // expand to ~2.6x over 0.18s
      meshRef.current.scale.setScalar(scale)
      if (scale >= 2.6) {
        meshRef.current.visible = false
        s.phase = 'waiting'
        s.t = 0
      }
    } else {
      s.t += delta
      if (s.t >= 2.8) {
        s.phase = 'idle'
        s.t = 0
        meshRef.current.visible = true
      }
    }
  })

  return (
    <mesh
      ref={meshRef}
      position={def.pos}
      material={popBubbleMat}
      onClick={e => {
        e.stopPropagation()
        if (stateRef.current.phase === 'idle')
          stateRef.current = { phase: 'popping', t: 0 }
      }}
      onPointerEnter={() => { document.body.style.cursor = 'pointer' }}
      onPointerLeave={() => { document.body.style.cursor = 'auto' }}
    >
      <sphereGeometry args={[def.r, 20, 20]} />
    </mesh>
  )
}

function PoppableBubbles() {
  return (
    <group>
      {POP_BUBBLE_DEFS.map((d, i) => <PoppableBubble key={i} def={d} />)}
    </group>
  )
}

// ─── Board scene ──────────────────────────────────────────────────────────────
function BoardScene({ chess, myColor, lastMove, onMove, disabled, highQuality }: SceneProps) {
  const [selected,   setSelected]   = useState<Square | null>(null)
  const [validMoves, setValidMoves] = useState<Square[]>([])

  const flipped = myColor === 'green'

  const handleClick = useCallback((sq: Square) => {
    if (disabled) return

    if (selected) {
      if (validMoves.includes(sq)) {
        const piece  = chess.get(selected)
        const isPromo =
          piece?.type === 'p' &&
          ((myColor === 'blue'  && sq[1] === '8') ||
           (myColor === 'green' && sq[1] === '1'))
        onMove(selected, sq, isPromo ? 'q' : undefined)
        setSelected(null); setValidMoves([])
        return
      }
      const p    = chess.get(sq)
      const mine = p && ((myColor === 'blue' && p.color === 'w') || (myColor === 'green' && p.color === 'b'))
      if (mine) {
        setSelected(sq)
        setValidMoves(chess.moves({ square: sq, verbose: true }).map(m => m.to as Square))
      } else {
        setSelected(null); setValidMoves([])
      }
      return
    }

    const p    = chess.get(sq)
    const mine = p && ((myColor === 'blue' && p.color === 'w') || (myColor === 'green' && p.color === 'b'))
    if (!mine) return
    setSelected(sq)
    setValidMoves(chess.moves({ square: sq, verbose: true }).map(m => m.to as Square))
  }, [disabled, selected, validMoves, chess, myColor, onMove])

  return (
    <>
      {/* ── Sky + atmosphere ── */}
      <AeroSkyDome />
      <fog attach="fog" args={['#0f4a8a', 38, 80]} />

      {/* ── Lighting ── */}
      <hemisphereLight args={['#4dd8f0', '#0a1628', 0.50]} />
      <directionalLight
        position={[4, 12, 6]} intensity={1.15}
        castShadow={highQuality}
        shadow-mapSize={highQuality ? [2048, 2048] : [512, 512]}
        shadow-camera-near={0.5} shadow-camera-far={50}
        shadow-camera-left={-7} shadow-camera-right={7}
        shadow-camera-top={7}   shadow-camera-bottom={-7}
      />
      <directionalLight position={[-4, 6, -3]} intensity={0.22} color="#5599cc" />
      <pointLight position={[0, 5, 0]}  intensity={0.70} color="#00aaff" />
      <pointLight position={[0, 3, 6]}  intensity={0.30} color="#00d4ff" />
      <pointLight position={[0, 3, -6]} intensity={0.30} color="#34d399" />

      {/* ── Environment ── */}
      <VolumetricClouds />
      <BackgroundBubbles highQuality={highQuality} />
      <PoppableBubbles />

      {/* ── Board platform ── */}
      <mesh position={[0, -0.065, 0]}>
        <boxGeometry args={[8.72, 0.04, 8.72]} />
        <meshStandardMaterial color="#00d4ff" emissive="#00d4ff" emissiveIntensity={0.55} metalness={0.9} roughness={0.05} />
      </mesh>
      <mesh position={[0, -0.04, 0]} receiveShadow>
        <boxGeometry args={[8.52, 0.06, 8.52]} />
        <meshPhysicalMaterial color="#08152e" metalness={0.4} roughness={0.15} clearcoat={0.8} clearcoatRoughness={0.1} />
      </mesh>

      {/* ── Tiles ── */}
      {ALL_SQUARES.map(sq => {
        const [x, z]    = squareToXZ(sq, flipped)
        const isLight   = (sq.charCodeAt(0) + parseInt(sq[1])) % 2 === 0
        const isSel     = sq === selected
        const isLastMv  = sq === lastMove?.from || sq === lastMove?.to
        const p         = chess.get(sq)
        const isChkKing = chess.inCheck() && p?.type === 'k' && p.color === chess.turn()

        let mat: THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial
        if (highQuality) {
          if (isSel)         mat = TILE_SELECTED
          else if (isChkKing)mat = TILE_CHECK
          else if (isLastMv) mat = isLight ? TILE_LASTMOVE_LIGHT : TILE_LASTMOVE_DARK
          else               mat = isLight ? TILE_LIGHT : TILE_DARK
        } else {
          if (isSel)         mat = TILE_SELECTED_LQ
          else if (isChkKing)mat = TILE_CHECK_LQ
          else if (isLastMv) mat = isLight ? TILE_LASTMOVE_LIGHT_LQ : TILE_LASTMOVE_DARK_LQ
          else               mat = isLight ? TILE_LIGHT_LQ : TILE_DARK_LQ
        }

        return (
          <mesh
            key={sq}
            material={mat}
            position={[x, 0.022, z]}
            receiveShadow={highQuality}
            onClick={e => { e.stopPropagation(); handleClick(sq) }}
          >
            <boxGeometry args={[0.965, 0.044, 0.965]} />
          </mesh>
        )
      })}

      {/* ── Valid move indicators ── */}
      {validMoves.map(sq => {
        const [x, z] = squareToXZ(sq, flipped)
        return <PulseDot key={sq} x={x} z={z} isCapture={!!chess.get(sq)} />
      })}

      {/* ── Pieces ── */}
      {ALL_SQUARES.map(sq => {
        const piece = chess.get(sq)
        if (!piece) return null
        const [x, z]    = squareToXZ(sq, flipped)
        const isBlue    = piece.color === 'w'
        const isChkKing = chess.inCheck() && piece.type === 'k' && piece.color === chess.turn()
        return (
          <PieceMesh
            key={sq}
            type={piece.type}
            isBlue={isBlue}
            isSelected={sq === selected}
            isCheck={isChkKing}
            x={x} z={z}
            onClick={() => handleClick(sq)}
          />
        )
      })}

      {/* ── Camera ── */}
      <OrbitControls
        enablePan={false}
        minDistance={6.5}
        maxDistance={20}
        minPolarAngle={Math.PI * 0.10}
        maxPolarAngle={Math.PI * 0.43}
        target={[0, 0, 0]}
        enableDamping
        dampingFactor={0.06}
      />

      {/* ── Post-processing — high quality only ── */}
      {highQuality && (
        <EffectComposer>
          <Bloom intensity={0.85} luminanceThreshold={0.45} luminanceSmoothing={0.4} mipmapBlur radius={0.7} />
        </EffectComposer>
      )}
    </>
  )
}

// ─── Canvas wrapper ───────────────────────────────────────────────────────────
export function ChessBoard3D(props: BoardProps) {
  const [highQuality, setHighQuality] = useState(true)
  const [settingsHovered, setSettingsHovered] = useState(false)

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      maxWidth: 520,
      aspectRatio: '1',
      borderRadius: 18,
      overflow: 'hidden',
      boxShadow: '0 0 0 1.5px rgba(0,212,255,0.30), 0 12px 60px rgba(0,100,255,0.35), 0 0 80px rgba(0,212,255,0.08)',
    }}>

      {/* ── Quality toggle ── */}
      <div
        style={{ position: 'absolute', top: 8, right: 8, zIndex: 20 }}
        onMouseEnter={() => setSettingsHovered(true)}
        onMouseLeave={() => setSettingsHovered(false)}
      >
        <button
          onClick={() => setHighQuality(q => !q)}
          style={{
            width: 28, height: 28, borderRadius: '50%',
            background: highQuality ? 'rgba(0,212,255,0.18)' : 'rgba(255,255,255,0.10)',
            border: `1px solid ${highQuality ? 'rgba(0,212,255,0.50)' : 'rgba(255,255,255,0.20)'}`,
            color: highQuality ? '#00d4ff' : 'rgba(255,255,255,0.50)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', outline: 'none',
            backdropFilter: 'blur(8px)',
            boxShadow: highQuality ? '0 0 10px rgba(0,212,255,0.30)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <Settings2 style={{ width: 13, height: 13 }} />
        </button>
        {settingsHovered && (
          <div style={{
            position: 'absolute', right: 34, top: '50%', transform: 'translateY(-50%)',
            background: 'rgba(8,18,45,0.95)', border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 8, padding: '4px 9px', fontSize: 11, whiteSpace: 'nowrap',
            color: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.35)', pointerEvents: 'none',
          }}>
            {highQuality ? 'High quality' : 'Low quality'}
          </div>
        )}
      </div>

      <Canvas
        shadows={highQuality}
        dpr={[1, 1.5]}
        camera={{ position: [0, 9, 7.5], fov: 48 }}
        gl={{
          antialias: true,
          alpha: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.15,
        }}
      >
        <BoardScene {...props} highQuality={highQuality} />
      </Canvas>
    </div>
  )
}
