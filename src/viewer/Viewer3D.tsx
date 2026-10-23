import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Edges, OrbitControls } from '@react-three/drei'
import { useEffect, useMemo, useRef, type ComponentRef } from 'react'
import { Color, DoubleSide, ExtrudeGeometry, FrontSide, Matrix4, Shape } from 'three'
import { explode } from '../core/explode'
import { inPlaneAxes, union } from '../core/geometry'
import { aabbOf } from '../core/shape'
import { useDesign } from '../store/designStore'
import { useView } from '../ui/useView'
import { useTheme } from '../ui/useTheme'
import type { Box, Panel } from '../core/types'

const S = 0.001 // mm → metres
const FRONT = new Set<Panel['role']>(['door', 'drawer-front'])
const SELECT = '#2d5b4c'
const HIGHLIGHT = '#f2c230'

const geoCache = new WeakMap<Panel, ExtrudeGeometry>()
const unit = (a: 'x' | 'y' | 'z') => [a === 'x' ? 1 : 0, a === 'y' ? 1 : 0, a === 'z' ? 1 : 0]
/** A profiled board (ADR-0040): its outline extruded through the thickness, placed on the blank's in-plane axes. */
function profileGeometry(p: Panel): ExtrudeGeometry {
  const hit = geoCache.get(p)
  if (hit) return hit
  if (p.shape?.kind !== 'profile') throw new Error('not a profile')
  const pts = p.shape.points
  const shape = new Shape()
  pts.forEach(([u, v], i) => (i ? shape.lineTo(u * S, v * S) : shape.moveTo(u * S, v * S)))
  const tAxis = p.thicknessAxis, t = tAxis === 'x' ? p.box.w : tAxis === 'y' ? p.box.h : p.box.d
  const g = new ExtrudeGeometry(shape, { depth: t * S, bevelEnabled: false })
  const [ua, va] = inPlaneAxes(tAxis)
  const [e1, e2, e3] = [unit(ua), unit(va), unit(tAxis)]
  g.applyMatrix4(new Matrix4().set(e1[0], e2[0], e3[0], p.box.x * S, e1[1], e2[1], e3[1], p.box.y * S, e1[2], e2[2], e3[2], p.box.z * S, 0, 0, 0, 1))
  g.computeVertexNormals()
  geoCache.set(p, g)
  return g
}

/**
 * Non-authoritative preview: renders the model's panels exactly as built, never edits them.
 * Click a panel to select the space that owns it.
 */
export default function Viewer3D() {
  const view = useView()
  const exploded = useDesign(s => s.exploded)
  const theme = useTheme()
  // Stage colours come from the stylesheet tokens so the canvas matches the light or dark theme.
  const bg = useMemo(() => { void theme; return getComputedStyle(document.documentElement).getPropertyValue('--stage-3d').trim() || '#e7eae7' }, [theme])
  const designId = `${view.mode === 'project' ? 'project' : `design:${useDesign.getState().design.id}`}:${exploded ? 'exploded' : 'built'}`
  // Exploded: positions only, for looking; parts, sheets and checks always use the built model.
  const panels = useMemo(() => (exploded ? explode(view.pieces) : view.model.panels), [exploded, view])
  const bounds = useMemo(() => (exploded ? union(panels.map(aabbOf)) : view.model.bounds), [exploded, panels, view])
  return (
    <Canvas camera={{ fov: 32, near: 0.01, far: 100 }} dpr={[1, 2]} shadows={false}
      onPointerMissed={() => { const st = useDesign.getState(); if (st.project && !st.editingItemId) st.selectItem(null); else st.select(null) }}>
      <color attach="background" args={[bg]} />
      <hemisphereLight args={['#ffffff', '#b9bdb6', 1.1]} />
      <directionalLight position={[2.5, 4, 3]} intensity={1.6} />
      <directionalLight position={[-3, 2, -1]} intensity={0.35} />
      <Panels panels={panels} />
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

function Panels({ panels }: { panels: Panel[] }) {
  const view = useView()
  const materials = view.materials
  const selectedSpace = useDesign(s => s.selectedId)
  const selectedItem = useDesign(s => s.selectedItemId)
  const selectedId = view.mode === 'project' ? selectedItem : selectedSpace
  const highlight = useDesign(s => s.highlight)
  const showFronts = useDesign(s => s.showFronts)
  const pick = useDesign(s => s.pick)
  const colors = useMemo(() => new Map(materials.map(m => [m.id, m.color])), [materials])
  const hl = useMemo(() => new Set(highlight), [highlight])

  return (
    <group>
      {panels.filter(p => showFronts || !FRONT.has(p.role)).map(p => {
        const b = p.box
        const selected = selectedId !== null && (view.mode === 'project' ? p.nodeId.startsWith(`${selectedId}:`) : p.nodeId === selectedId)
        const lit = hl.has(p.id)
        const base = colors.get(p.materialId) ?? '#cccccc'
        const color = lit ? HIGHLIGHT : selected ? new Color(base).lerp(new Color(SELECT), 0.45).getStyle() : base
        const look = <>
          <meshStandardMaterial color={color} roughness={0.78} metalness={0} transparent={p.role === 'back'} opacity={p.role === 'back' ? 0.92 : 1} side={p.shape?.kind === 'profile' ? DoubleSide : FrontSide} />
          <Edges threshold={15} color={selected ? SELECT : '#3b403c'} lineWidth={selected ? 1.6 : 1} />
        </>
        const onClick = (e: { stopPropagation: () => void }) => { e.stopPropagation(); pick(p.nodeId) }
        if (p.shape?.kind === 'profile') return <mesh key={p.id} geometry={profileGeometry(p)} onClick={onClick}>{look}</mesh>
        const mesh = (
          <mesh key={p.id} position={[(b.x + b.w / 2) * S, (b.y + b.h / 2) * S, (b.z + b.d / 2) * S]} onClick={onClick}>
            <boxGeometry args={[b.w * S, b.h * S, b.d * S]} />
            {look}
          </mesh>
        )
        if (p.shape?.kind !== 'tilt') return mesh
        // Tilted part (ADR-0040): the blank turned about its pivot, right-hand rule, as in the model.
        const s = p.shape, pv = [b.x + s.pivot[0], b.y + s.pivot[1], b.z + s.pivot[2]], a = (s.angleDeg * Math.PI) / 180
        return (
          <group key={p.id} position={[pv[0] * S, pv[1] * S, pv[2] * S]} rotation={[s.axis === 'x' ? a : 0, s.axis === 'y' ? a : 0, s.axis === 'z' ? a : 0]}>
            <mesh position={[(b.x + b.w / 2 - pv[0]) * S, (b.y + b.h / 2 - pv[1]) * S, (b.z + b.d / 2 - pv[2]) * S]} onClick={onClick}>
              <boxGeometry args={[b.w * S, b.h * S, b.d * S]} />
              {look}
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
