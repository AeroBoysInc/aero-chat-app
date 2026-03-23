import { useRef, useState, useCallback, useMemo, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { Chess, Square } from 'chess.js'

// ─── Types ────────────────────────────────────────────────────────────────────
interface BoardProps {
  chess: Chess
  myColor: 'blue' | 'green'
  lastMove: { from: string; to: string } | null
  onMove: (from: Square, to: Square, promotion?: string) => void
  disabled: boolean
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

// ─── Shared tile materials ────────────────────────────────────────────────────
const TILE_LIGHT = new THREE.MeshPhysicalMaterial({
  color: '#c8e4f8', metalness: 0, roughness: 0.08,
  clearcoat: 1.0, clearcoatRoughness: 0.05,
  transmission: 0.12, thickness: 0.2, ior: 1.5,
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
      {/* soft shadow blob */}
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

// ─── Background gradient ──────────────────────────────────────────────────────
function SkyBackground() {
  const texture = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 4; c.height = 512
    const ctx = c.getContext('2d')!
    const g = ctx.createLinearGradient(0, 0, 0, 512)
    g.addColorStop(0,    '#4dd8f0')   // bright sky cyan
    g.addColorStop(0.2,  '#0ea5e9')   // sky blue
    g.addColorStop(0.5,  '#0a3d8f')   // deep blue
    g.addColorStop(0.8,  '#050f28')   // near-black
    g.addColorStop(1,    '#020810')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 4, 512)
    const tex = new THREE.CanvasTexture(c)
    tex.needsUpdate = true
    return tex
  }, [])

  return (
    <mesh position={[0, 6, -30]} rotation={[0, 0, 0]}>
      <planeGeometry args={[90, 55]} />
      <meshBasicMaterial map={texture} depthWrite={false} side={THREE.FrontSide} />
    </mesh>
  )
}

// ─── Floating Frutiger Aero bubbles ──────────────────────────────────────────
interface BubbleDef { pos: [number, number, number]; r: number; speed: number; phase: number }

function Bubble({ pos, r, speed, phase }: BubbleDef) {
  const ref      = useRef<THREE.Mesh>(null)
  const phaseRef = useRef(phase)

  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime
    ref.current.position.y = pos[1] + Math.sin(t * speed + phaseRef.current) * 1.6
    ref.current.rotation.y = t * 0.08
    ref.current.rotation.x = t * 0.04
  })

  return (
    <mesh ref={ref} position={pos}>
      <sphereGeometry args={[r, 32, 32]} />
      <meshPhysicalMaterial
        color="#88ccff"
        transparent
        opacity={0.10}
        roughness={0}
        metalness={0.05}
        transmission={0.6}
        thickness={r * 1.5}
        ior={1.4}
        iridescence={1.0}
        iridescenceIOR={1.3}
        side={THREE.FrontSide}
      />
    </mesh>
  )
}

function FloatingBubbles() {
  const bubbles = useMemo<BubbleDef[]>(() =>
    [
      // behind the board, varied depths
      { pos: [-14, 2, -18], r: 2.4, speed: 0.12, phase: 0.0 },
      { pos: [12,  4, -22], r: 1.8, speed: 0.09, phase: 1.1 },
      { pos: [-6,  0, -25], r: 3.0, speed: 0.07, phase: 2.4 },
      { pos: [18,  1, -15], r: 1.2, speed: 0.15, phase: 0.7 },
      { pos: [-20, 5, -12], r: 1.6, speed: 0.11, phase: 3.2 },
      { pos: [6,   3, -28], r: 2.0, speed: 0.08, phase: 1.8 },
      // flanking the board at mid depth
      { pos: [-11, -1, -8], r: 1.0, speed: 0.18, phase: 4.1 },
      { pos: [10,   2, -9], r: 0.7, speed: 0.22, phase: 0.3 },
      { pos: [-8,   6, -20], r: 1.4, speed: 0.10, phase: 2.9 },
      { pos: [16,  -2, -20], r: 2.6, speed: 0.06, phase: 5.1 },
      { pos: [-3,   8, -26], r: 1.8, speed: 0.09, phase: 3.7 },
      { pos: [22,   3, -18], r: 1.0, speed: 0.14, phase: 1.5 },
    ]
  , [])

  return (
    <group>
      {bubbles.map((b, i) => <Bubble key={i} {...b} />)}
    </group>
  )
}

// ─── Board scene ──────────────────────────────────────────────────────────────
function BoardScene({ chess, myColor, lastMove, onMove, disabled }: BoardProps) {
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
      {/* ── Atmosphere ── */}
      <fog attach="fog" args={['#0a1628', 28, 65]} />

      {/* ── Lighting ── */}
      <hemisphereLight args={['#87ceeb', '#0a1628', 0.45]} />
      <directionalLight
        position={[4, 12, 6]} intensity={1.15} castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5} shadow-camera-far={50}
        shadow-camera-left={-7} shadow-camera-right={7}
        shadow-camera-top={7}   shadow-camera-bottom={-7}
      />
      <directionalLight position={[-4, 6, -3]} intensity={0.22} color="#5599cc" />
      <pointLight position={[0, 5, 0]}  intensity={0.70} color="#00aaff" />
      <pointLight position={[0, 3, 6]}  intensity={0.30} color="#00d4ff" />
      <pointLight position={[0, 3, -6]} intensity={0.30} color="#34d399" />

      {/* ── Background ── */}
      <SkyBackground />
      <FloatingBubbles />

      {/* ── Board platform ── */}
      {/* glow rim */}
      <mesh position={[0, -0.065, 0]}>
        <boxGeometry args={[8.72, 0.04, 8.72]} />
        <meshStandardMaterial color="#00d4ff" emissive="#00d4ff" emissiveIntensity={0.55} metalness={0.9} roughness={0.05} />
      </mesh>
      {/* glass slab */}
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

        let mat: THREE.MeshPhysicalMaterial
        if (isSel)          mat = TILE_SELECTED
        else if (isChkKing) mat = TILE_CHECK
        else if (isLastMv)  mat = isLight ? TILE_LASTMOVE_LIGHT : TILE_LASTMOVE_DARK
        else                mat = isLight ? TILE_LIGHT : TILE_DARK

        return (
          <mesh
            key={sq}
            material={mat}
            position={[x, 0.022, z]}
            receiveShadow
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

      {/* ── Post-processing ── */}
      <EffectComposer>
        <Bloom
          intensity={0.85}
          luminanceThreshold={0.45}
          luminanceSmoothing={0.4}
          mipmapBlur
          radius={0.7}
        />
      </EffectComposer>
    </>
  )
}

// ─── Canvas wrapper ───────────────────────────────────────────────────────────
export function ChessBoard3D(props: BoardProps) {
  return (
    <div style={{
      width: '100%',
      maxWidth: 520,
      aspectRatio: '1',
      borderRadius: 18,
      overflow: 'hidden',
      boxShadow: '0 0 0 1.5px rgba(0,212,255,0.30), 0 12px 60px rgba(0,100,255,0.35), 0 0 80px rgba(0,212,255,0.08)',
    }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 9, 7.5], fov: 48 }}
        gl={{
          antialias: true,
          alpha: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.15,
        }}
        style={{ background: '#020810' }}
      >
        <BoardScene {...props} />
      </Canvas>
    </div>
  )
}
