import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Edges, OrbitControls } from '@react-three/drei'
import { useEffect, useMemo, useRef, type ComponentRef } from 'react'
import { Color } from 'three'
import { useDesign } from '../store/designStore'
import type { Box, Panel } from '../core/types'

const S = 0.001 // mm → metres
const FRONT = new Set<Panel['role']>(['door', 'drawer-front'])
const SELECT = '#2d5b4c'
const HIGHLIGHT = '#f2c230'

/**
 * Non-authoritative preview: renders the model's panels exactly as built, never edits them.
 * Click a panel to select the space that owns it.
 */
export default function Viewer3D() {
  const designId = useDesign(s => s.design.id)
  const bounds = useDesign(s => s.model.bounds)
  return (
    <Canvas camera={{ fov: 32, near: 0.01, far: 100 }} dpr={[1, 2]} shadows={false}
      onPointerMissed={() => useDesign.getState().select(null)}>
      <color attach="background" args={['#e7eae7']} />
      <hemisphereLight args={['#ffffff', '#b9bdb6', 1.1]} />
      <directionalLight position={[2.5, 4, 3]} intensity={1.6} />
      <directionalLight position={[-3, 2, -1]} intensity={0.35} />
      <Panels />
      <ContactShadows position={[bounds.x * S + (bounds.w * S) / 2, -0.0005, bounds.z * S + (bounds.d * S) / 2]}
        scale={Math.max(bounds.w, bounds.d) * S * 2.2} blur={2.4} opacity={0.38} far={1.2} />
      <Fit key={designId} bounds={bounds} />
    </Canvas>
  )
}

function Fit({ bounds }: { bounds: Box }) {
  const { camera, size: view } = useThree()
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const target = useMemo(() => [(bounds.x + bounds.w / 2) * S, (bounds.y + bounds.h / 2) * S, (bounds.z + bounds.d / 2) * S] as const, [bounds])
  // Distance that fits the bounding sphere in the narrower field of view.
  const radius = 0.5 * Math.hypot(bounds.w, bounds.h, bounds.d) * S
  const vfov = (32 * Math.PI) / 180
  const aspect = view.width > 10 && view.height > 10 ? view.width / view.height : 1
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect)
  const fitDist = (radius / Math.sin(Math.min(vfov, hfov) / 2)) * 1.08
  // Frame once per design (and when the user asks); editing dimensions must not yank the camera.
  useEffect(() => {
    const dist = fitDist / Math.hypot(0.55, 0.35, 0.85)
    camera.position.set(target[0] + dist * 0.55, target[1] + dist * 0.35, target[2] + dist * 0.85)
    camera.lookAt(...target)
    controls.current?.target.set(...target)
    controls.current?.update()
    const onFit = () => {
      camera.position.set(target[0] + dist * 0.55, target[1] + dist * 0.35, target[2] + dist * 0.85)
      controls.current?.target.set(...target)
      controls.current?.update()
    }
    window.addEventListener('fb:fit', onFit)
    return () => window.removeEventListener('fb:fit', onFit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.12} minDistance={0.2} maxDistance={20} />
}

function Panels() {
  const panels = useDesign(s => s.model.panels)
  const materials = useDesign(s => s.design.materials)
  const productId = useDesign(s => s.design.product.id)
  const selectedId = useDesign(s => s.selectedId)
  const highlight = useDesign(s => s.highlight)
  const showFronts = useDesign(s => s.showFronts)
  const select = useDesign(s => s.select)
  const colors = useMemo(() => new Map(materials.map(m => [m.id, m.color])), [materials])
  const hl = useMemo(() => new Set(highlight), [highlight])

  return (
    <group>
      {panels.filter(p => showFronts || !FRONT.has(p.role)).map(p => {
        const b = p.box
        const selected = selectedId !== null && p.nodeId === selectedId
        const lit = hl.has(p.id)
        const base = colors.get(p.materialId) ?? '#cccccc'
        const color = lit ? HIGHLIGHT : selected ? new Color(base).lerp(new Color(SELECT), 0.45).getStyle() : base
        return (
          <mesh key={p.id} position={[(b.x + b.w / 2) * S, (b.y + b.h / 2) * S, (b.z + b.d / 2) * S]}
            onClick={e => { e.stopPropagation(); select(p.nodeId === productId ? null : p.nodeId) }}>
            <boxGeometry args={[b.w * S, b.h * S, b.d * S]} />
            <meshStandardMaterial color={color} roughness={0.78} metalness={0} transparent={p.role === 'back'} opacity={p.role === 'back' ? 0.92 : 1} />
            <Edges threshold={15} color={selected ? SELECT : '#3b403c'} lineWidth={selected ? 1.6 : 1} />
          </mesh>
        )
      })}
    </group>
  )
}
