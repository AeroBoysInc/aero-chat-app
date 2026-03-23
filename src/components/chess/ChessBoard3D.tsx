import { useRef, useState, useCallback, useMemo, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
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
  const file = sq.charCodeAt(0) - 97   // a=0 … h=7
  const rank = parseInt(sq[1]) - 1     // 1=0 … 8=7
  const x = flipped ? 3.5 - file : file - 3.5
  const z = flipped ? rank - 3.5 : 3.5 - rank
  return [x, z]
}

// ─── Shared piece material ────────────────────────────────────────────────────
function usePieceMat(isBlue: boolean, isSelected: boolean, isCheck: boolean) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color:             isBlue ? '#00d4ff' : '#34d399',
    emissive:          isCheck ? '#cc1111' : (isBlue ? '#003d5c' : '#0a2a1a'),
    emissiveIntensity: isSelected ? 1.8 : (isCheck ? 1.0 : 0.4),
    metalness: 0.72,
    roughness: 0.18,
  }), [isBlue, isSelected, isCheck])
  useEffect(() => () => mat.dispose(), [mat])
  return mat
}

// ─── Piece geometry components ────────────────────────────────────────────────
function Pawn({ mat }: { mat: THREE.MeshStandardMaterial }) {
  return (
    <group>
      <mesh material={mat} position={[0, 0.05, 0]}><cylinderGeometry args={[0.30, 0.34, 0.10, 16]} /></mesh>
      <mesh material={mat} position={[0, 0.28, 0]}><cylinderGeometry args={[0.16, 0.22, 0.36, 12]} /></mesh>
      <mesh material={mat} position={[0, 0.55, 0]}><sphereGeometry    args={[0.22, 16, 16]} /></mesh>
    </group>
  )
}

function Rook({ mat }: { mat: THREE.MeshStandardMaterial }) {
  const battlements: [number, number][] = [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]
  return (
    <group>
      <mesh material={mat} position={[0, 0.05, 0]}><cylinderGeometry args={[0.32, 0.36, 0.10, 16]} /></mesh>
      <mesh material={mat} position={[0, 0.32, 0]}><cylinderGeometry args={[0.24, 0.28, 0.44, 12]} /></mesh>
      <mesh material={mat} position={[0, 0.62, 0]}><cylinderGeometry args={[0.30, 0.24, 0.14, 16]} /></mesh>
      {battlements.map(([bx, bz], i) => (
        <mesh key={i} material={mat} position={[bx, 0.77, bz]}><boxGeometry args={[0.10, 0.16, 0.10]} /></mesh>
      ))}
    </group>
  )
}

function Knight({ mat }: { mat: THREE.MeshStandardMaterial }) {
  return (
    <group>
      <mesh material={mat} position={[0, 0.05,  0.00]}><cylinderGeometry args={[0.32, 0.36, 0.10, 16]} /></mesh>
      <mesh material={mat} position={[0, 0.30,  0.00]}><cylinderGeometry args={[0.20, 0.26, 0.40, 12]} /></mesh>
      <mesh material={mat} position={[0, 0.62,  0.06]} rotation={[0.35, 0, 0]}><boxGeometry args={[0.30, 0.32, 0.22]} /></mesh>
      <mesh material={mat} position={[0, 0.58,  0.22]} rotation={[0.55, 0, 0]}><boxGeometry args={[0.20, 0.14, 0.18]} /></mesh>
    </group>
  )
}

function Bishop({ mat }: { mat: THREE.MeshStandardMaterial }) {
  return (
    <group>
      <mesh material={mat} position={[0, 0.05, 0]}><cylinderGeometry args={[0.32, 0.36, 0.10, 16]} /></mesh>
      <mesh material={mat} position={[0, 0.34, 0]}><cylinderGeometry args={[0.18, 0.24, 0.48, 12]} /></mesh>
      <mesh material={mat} position={[0, 0.64, 0]}><sphereGeometry    args={[0.16, 12, 12]} /></mesh>
      <mesh material={mat} position={[0, 0.94, 0]}><coneGeometry       args={[0.14, 0.44, 12]} /></mesh>
    </group>
  )
}

function Queen({ mat }: { mat: THREE.MeshStandardMaterial }) {
  const crowns = [0, 72, 144, 216, 288].map(deg => {
    const rad = (deg * Math.PI) / 180
    return [Math.sin(rad) * 0.20, Math.cos(rad) * 0.20] as [number, number]
  })
  return (
    <group>
      <mesh material={mat} position={[0, 0.05, 0]}><cylinderGeometry args={[0.34, 0.38, 0.10, 16]} /></mesh>
      <mesh material={mat} position={[0, 0.38, 0]}><cylinderGeometry args={[0.20, 0.27, 0.56, 12]} /></mesh>
      <mesh material={mat} position={[0, 0.74, 0]}><sphereGeometry    args={[0.24, 16, 16]} /></mesh>
      {crowns.map(([cx, cz], i) => (
        <mesh key={i} material={mat} position={[cx, 0.98, cz]}>
          <coneGeometry args={[0.07, 0.22, 8]} />
        </mesh>
      ))}
    </group>
  )
}

function King({ mat }: { mat: THREE.MeshStandardMaterial }) {
  return (
    <group>
      <mesh material={mat} position={[0, 0.05, 0]}><cylinderGeometry args={[0.34, 0.38, 0.10, 16]} /></mesh>
      <mesh material={mat} position={[0, 0.40, 0]}><cylinderGeometry args={[0.22, 0.28, 0.60, 12]} /></mesh>
      <mesh material={mat} position={[0, 0.78, 0]}><sphereGeometry    args={[0.20, 12, 12]} /></mesh>
      <mesh material={mat} position={[0, 1.06, 0]}><boxGeometry args={[0.08, 0.42, 0.08]} /></mesh>
      <mesh material={mat} position={[0, 1.15, 0]}><boxGeometry args={[0.28, 0.08, 0.08]} /></mesh>
    </group>
  )
}

const PIECE_COMPONENTS: Record<string, React.ComponentType<{ mat: THREE.MeshStandardMaterial }>> = {
  p: Pawn, r: Rook, n: Knight, b: Bishop, q: Queen, k: King,
}

// ─── Animated piece wrapper ───────────────────────────────────────────────────
function PieceMesh({
  type, isBlue, isSelected, isCheck, x, z, onClick,
}: {
  type: string; isBlue: boolean; isSelected: boolean; isCheck: boolean
  x: number; z: number; onClick: () => void
}) {
  const groupRef     = useRef<THREE.Group>(null)
  const isSelectedRef = useRef(isSelected)
  isSelectedRef.current = isSelected

  const mat = usePieceMat(isBlue, isSelected, isCheck)

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    groupRef.current.position.y = isSelectedRef.current
      ? 0.14 + Math.sin(clock.elapsedTime * 4) * 0.06
      : 0
  })

  const Part = PIECE_COMPONENTS[type]
  if (!Part) return null

  return (
    <group ref={groupRef} position={[x, 0, z]} onClick={e => { e.stopPropagation(); onClick() }}>
      {/* soft drop shadow */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.32, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.28} />
      </mesh>
      <Part mat={mat} />
    </group>
  )
}

// ─── Valid-move indicators ────────────────────────────────────────────────────
function PulseDot({ x, z, isCapture }: { x: number; z: number; isCapture: boolean }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    if (matRef.current) matRef.current.emissiveIntensity = 0.55 + Math.sin(clock.elapsedTime * 3.5) * 0.45
  })
  return (
    <mesh position={[x, 0.015, z]} rotation={[-Math.PI / 2, 0, 0]}>
      {isCapture
        ? <ringGeometry   args={[0.35, 0.46, 32]} />
        : <circleGeometry args={[0.19, 16]} />}
      <meshStandardMaterial
        ref={matRef}
        color="#00d4ff"
        emissive="#00d4ff"
        emissiveIntensity={0.8}
        transparent
        opacity={0.88}
      />
    </mesh>
  )
}

// ─── Full board scene (rendered inside Canvas) ────────────────────────────────
function BoardScene({ chess, myColor, lastMove, onMove, disabled }: BoardProps) {
  const [selected,   setSelected]   = useState<Square | null>(null)
  const [validMoves, setValidMoves] = useState<Square[]>([])

  const flipped = myColor === 'green'

  const handleClick = useCallback((sq: Square) => {
    if (disabled) return

    if (selected) {
      if (validMoves.includes(sq)) {
        const piece = chess.get(selected)
        const isPromo =
          piece?.type === 'p' &&
          ((myColor === 'blue'  && sq[1] === '8') ||
           (myColor === 'green' && sq[1] === '1'))
        onMove(selected, sq, isPromo ? 'q' : undefined)
        setSelected(null); setValidMoves([])
        return
      }
      const p = chess.get(sq)
      const mine = p && ((myColor === 'blue' && p.color === 'w') || (myColor === 'green' && p.color === 'b'))
      if (mine) {
        setSelected(sq)
        setValidMoves(chess.moves({ square: sq, verbose: true }).map(m => m.to as Square))
      } else {
        setSelected(null); setValidMoves([])
      }
      return
    }

    const p = chess.get(sq)
    const mine = p && ((myColor === 'blue' && p.color === 'w') || (myColor === 'green' && p.color === 'b'))
    if (!mine) return
    setSelected(sq)
    setValidMoves(chess.moves({ square: sq, verbose: true }).map(m => m.to as Square))
  }, [disabled, selected, validMoves, chess, myColor, onMove])

  // Board tile colors
  const tileData = useMemo(() => ALL_SQUARES.map(sq => {
    const [x, z] = squareToXZ(sq, flipped)
    const isLight = (sq.charCodeAt(0) + parseInt(sq[1])) % 2 === 0
    return { sq, x, z, isLight }
  }), [flipped])

  return (
    <>
      {/* ── Lighting ── */}
      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 10, 6]}  intensity={1.1} castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={0.5}
        shadow-camera-far={50}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
      />
      <directionalLight position={[-3, 5, -4]} intensity={0.30} color="#4488bb" />
      <pointLight       position={[0, 4,  0]}  intensity={0.55} color="#2266aa" />

      {/* ── Board frame/platform ── */}
      <mesh position={[0, -0.12, 0]} receiveShadow>
        <boxGeometry args={[8.5, 0.22, 8.5]} />
        <meshStandardMaterial color="#071224" metalness={0.55} roughness={0.28} />
      </mesh>

      {/* ── Tiles ── */}
      {tileData.map(({ sq, x, z, isLight }) => {
        const isSel     = sq === selected
        const isLastMv  = sq === lastMove?.from || sq === lastMove?.to
        const piece     = chess.get(sq)
        const isChkKing = chess.inCheck() && piece?.type === 'k' && piece.color === chess.turn()

        let color    = isLight ? '#c2dff5' : '#1e4878'
        let emissive = '#000000'
        let emissInt = 0
        if (isSel)      { color = '#7c3aed'; emissive = '#4c1d95'; emissInt = 0.9 }
        else if (isChkKing) { color = '#991b1b'; emissive = '#7f1d1d'; emissInt = 1.0 }
        else if (isLastMv)  { emissive = '#92400e'; emissInt = isLight ? 0.45 : 0.35 }

        return (
          <mesh
            key={sq}
            position={[x, 0.01, z]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
            onClick={e => { e.stopPropagation(); handleClick(sq) }}
          >
            <planeGeometry args={[0.97, 0.97]} />
            <meshStandardMaterial
              color={color}
              emissive={emissive}
              emissiveIntensity={emissInt}
              metalness={isLight ? 0.05 : 0.20}
              roughness={isLight ? 0.22 : 0.42}
            />
          </mesh>
        )
      })}

      {/* ── Valid-move dots / capture rings ── */}
      {validMoves.map(sq => {
        const [x, z] = squareToXZ(sq, flipped)
        return (
          <PulseDot key={sq} x={x} z={z} isCapture={!!chess.get(sq)} />
        )
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

      {/* ── Coordinate labels rendered as board-edge tiles ── */}
      {FILES.map((file, fi) => {
        const x = flipped ? 3.5 - fi : fi - 3.5
        return (
          <mesh key={`fl-${file}`} position={[x, 0.005, 4.25]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.9, 0.42]} />
            <meshBasicMaterial color="#071224" transparent opacity={0} />
          </mesh>
        )
      })}

      {/* ── Camera ── */}
      <OrbitControls
        enablePan={false}
        minDistance={7}
        maxDistance={18}
        minPolarAngle={Math.PI * 0.12}
        maxPolarAngle={Math.PI * 0.44}
        target={[0, 0, 0]}
      />
    </>
  )
}

// ─── Canvas wrapper ───────────────────────────────────────────────────────────
export function ChessBoard3D(props: BoardProps) {
  return (
    <div style={{
      width: '100%',
      maxWidth: 500,
      aspectRatio: '1',
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: '0 8px 40px rgba(0,150,255,0.30), 0 0 0 2px rgba(0,212,255,0.22)',
    }}>
      <Canvas
        shadows
        camera={{ position: [0, 9.5, 7.5], fov: 46 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: 'linear-gradient(175deg, #060d1f 0%, #0a1628 100%)' }}
      >
        <BoardScene {...props} />
      </Canvas>
    </div>
  )
}
