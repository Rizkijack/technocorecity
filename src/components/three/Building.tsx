'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Room } from '@/lib/technocore/types'
import { useWorldStore } from '@/stores/world-store'
import {
  createBuildingGeometry,
  floorBandGeometryFor,
  podiumGeometryFor,
  rooftopGeometryFor,
  sharedAntennaGeometry,
  sharedWindowGeometry,
} from '@/lib/three/geometry'
import {
  floorBandMaterialInst,
  podiumMaterialInst,
  rooftopMaterialInst,
  windowMaterialInst,
} from '@/lib/three/materials'

/**
 * Sprite-based room label rendered as a 3D mesh so it works under
 * PointerLockControls and is always visible regardless of DOM stacking.
 *
 * We draw the label into a 2D canvas at render time, upload it as a
 * CanvasTexture, and mount a <sprite> above the building roof. Sprites
 * always face the camera in three.js (no manual billboarding needed),
 * and they're a single textured quad — cheap enough for 50+ rooms.
 *
 * Two states: idle (translucent dark pill, white text) and
 * active (selected OR hovered, full cyan background).
 */
const LABEL_FONT = '500 12px ui-monospace, "JetBrains Mono", Menlo, monospace'
const LABEL_PADDING_X = 8
const LABEL_PADDING_Y = 4
const LABEL_RADIUS = 10

function makeLabelTexture(text: string, active: boolean): THREE.CanvasTexture {
  // Measure first to size the canvas exactly
  const measure = document.createElement('canvas')
  const mctx = measure.getContext('2d')!
  mctx.font = active ? '600 14px ui-monospace, "JetBrains Mono", Menlo, monospace' : LABEL_FONT
  const fullText = `r/${text}`
  const textW = Math.ceil(mctx.measureText(fullText).width)
  const prefixW = Math.ceil(mctx.measureText('r/').width)
  const fontSize = active ? 14 : 12
  const fontWeight = active ? 600 : 500

  const w = textW + LABEL_PADDING_X * 2
  const h = fontSize + LABEL_PADDING_Y * 2
  const dpr = 2 // sharper text
  const canvas = document.createElement('canvas')
  canvas.width = w * dpr
  canvas.height = h * dpr
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)

  // Pill background
  ctx.beginPath()
  const r = Math.min(LABEL_RADIUS, h / 2)
  ctx.moveTo(LABEL_PADDING_X, 0)
  ctx.arcTo(w - LABEL_PADDING_X, 0, w - LABEL_PADDING_X, h, r)
  ctx.arcTo(w - LABEL_PADDING_X, h, LABEL_PADDING_X, h, r)
  ctx.arcTo(LABEL_PADDING_X, h, LABEL_PADDING_X, 0, r)
  ctx.arcTo(LABEL_PADDING_X, 0, w - LABEL_PADDING_X, 0, r)
  ctx.closePath()

  if (active) {
    ctx.fillStyle = 'rgba(0, 212, 255, 0.95)'
    ctx.shadowColor = 'rgba(0, 212, 255, 0.55)'
    ctx.shadowBlur = 12
  } else {
    ctx.fillStyle = 'rgba(10, 14, 39, 0.7)'
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
    ctx.shadowBlur = 6
  }
  ctx.fill()
  ctx.shadowBlur = 0

  // Border
  ctx.strokeStyle = active
    ? 'rgba(0, 212, 255, 1)'
    : 'rgba(255, 255, 255, 0.18)'
  ctx.lineWidth = 1
  ctx.stroke()

  // Text
  ctx.font = `${fontWeight} ${fontSize}px ui-monospace, "JetBrains Mono", Menlo, monospace`
  ctx.textBaseline = 'middle'
  // 'r/' prefix dimmer than name
  ctx.fillStyle = active ? 'rgba(10, 14, 39, 0.55)' : 'rgba(232, 234, 246, 0.45)'
  ctx.fillText('r/', LABEL_PADDING_X, h / 2 + 0.5)
  ctx.fillStyle = active ? '#0a0e27' : '#e8eaf6'
  ctx.fillText(text, LABEL_PADDING_X + prefixW, h / 2 + 0.5)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.needsUpdate = true
  return tex
}

// Cache building box geometries by dimension tuple.
const geometryCache = new Map<string, THREE.BoxGeometry>()
function sharedBuildingGeometry(w: number, h: number, d: number): THREE.BoxGeometry {
  const key = `${w.toFixed(2)}|${h.toFixed(2)}|${d.toFixed(2)}`
  let geo = geometryCache.get(key)
  if (!geo) {
    geo = createBuildingGeometry(w, h, d)
    geometryCache.set(key, geo)
  }
  return geo
}

interface BuildingProps {
  room: Room
  position: [number, number, number]
  index: number
}

export function Building({ room, position, index: _index }: BuildingProps) {
  const [x, , z] = position

  const height = useMemo(
    () => Math.max(3, Math.min(30, Math.log10(room.messageCount + 1) * 4)),
    [room.messageCount],
  )
  const width = useMemo(() => 4 + Math.min(room.topic.length / 8, 4), [room.topic.length])
  const depth = 4

  const selectedRoomId = useWorldStore((s) => s.selectedRoomId)
  const isSelected = selectedRoomId === room.name
  const [hovered, setHovered] = useState(false)

  const newAt = useWorldStore((s) => s.newlyCreatedAt.get(room.name))

  const emissiveIntensity = useMemo(() => {
    const base = Math.min(0.5, 0.15 + Math.log10(room.messageCount + 1) * 0.05)
    const withHover = base + (hovered ? 0.05 : 0)
    return isSelected ? Math.min(0.9, withHover * 2) : withHover
  }, [room.messageCount, hovered, isSelected])

  const groupRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)

  // floor segmentation — one band every 3 units
  const bandYs = useMemo(() => {
    const ys: number[] = []
    for (let y = 3; y < height - 0.3; y += 3) ys.push(0.4 + y)
    return ys
  }, [height])

  // windows — up to 3, spaced vertically inside the building
  const windowYs = useMemo(() => {
    const count = Math.min(3, Math.max(1, bandYs.length + 1))
    // if single floor, center it
    if (count === 1) return [0.4 + height / 2]
    return Array.from({ length: count }, (_, i) => 0.4 + ((i + 1) * height) / (count + 1))
  }, [bandYs.length, height])

  // Room label: CanvasTexture rendered into a Sprite.
  // - `active` = selected OR hovered → full cyan pill, dark text.
  // - idle → translucent dark pill, light text.
  // Texture is rebuilt only when name or active changes; old texture is
  // disposed to avoid GPU leaks.
  const labelActive = isSelected || hovered
  const labelTexture = useMemo(() => {
    return makeLabelTexture(room.name, labelActive)
  }, [room.name, labelActive])
  useEffect(() => {
    return () => {
      labelTexture.dispose()
    }
  }, [labelTexture])

  // Sprite scale. With `sizeAttenuation=false` the shader compensates for
  // camera distance so the sprite renders at a constant *screen* size.
  // Empirically (fov 50, typical camera dist 50-60 from the building ring
  // of radius 10-60) a world scale of ~0.06 produces a pill ~40-50 px tall
  // on a 1080p viewport — comfortably readable in free view and clearly
  // prominent when the room is selected ("inside gedung" mode).
  const labelScale = useMemo(() => {
    const img = labelTexture.image as HTMLCanvasElement | undefined
    const aspect = img && img.width > 0 ? img.width / img.height : 4
    const worldHeight = isSelected ? 0.09 : 0.06
    return { x: worldHeight * aspect, y: worldHeight }
  }, [labelTexture, isSelected])

  const edgesGeometry = useMemo(
    () => new THREE.EdgesGeometry(sharedBuildingGeometry(width, height, depth)),
    [width, height, depth],
  )
  useEffect(() => () => edgesGeometry.dispose(), [edgesGeometry])

  useEffect(() => {
    if (newAt === undefined) return
    if (groupRef.current) groupRef.current.scale.setScalar(0)
  }, [newAt])

  useFrame((_, delta) => {
    if (!groupRef.current || !meshRef.current) return

    // F-101 scale-in: 0→1 over 1.5s cubic ease-out, then * hover/selected multiplier
    let base = 1
    if (newAt !== undefined) {
      const elapsed = (Date.now() - newAt) / 1500
      if (elapsed < 1) {
        const t = Math.max(0, elapsed)
        base = 1 - Math.pow(1 - t, 3)
      }
    }
    const mult = isSelected ? 1.05 : hovered ? 1.02 : 1
    const finalScale = base * mult
    if (Math.abs(groupRef.current.scale.x - finalScale) > 0.0005) {
      groupRef.current.scale.setScalar(finalScale)
    }

    if (!isSelected) return
    const TWO_PI = Math.PI * 2
    if (meshRef.current.rotation.y < TWO_PI) {
      meshRef.current.rotation.y = Math.min(TWO_PI, meshRef.current.rotation.y + 0.2 * delta)
    }
  })

  const podiumY = 0.2
  const buildingY = 0.4 + height / 2
  const rooftopY = 0.4 + height + 0.3
  const antennaY = 0.4 + height + 0.6 + 0.5
  const labelY = 0.4 + height + 1.4

  return (
    // eslint-disable-next-line react/no-unknown-property
    <group ref={groupRef} position={[x, 0, z]}>
      {/* podium — slightly wider, high roughness */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <mesh
        position={[0, podiumY, 0]}
        castShadow
        receiveShadow
        geometry={podiumGeometryFor(width, depth)}
        material={podiumMaterialInst}
      />

      {/* main building */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <mesh
        ref={meshRef}
        position={[0, buildingY, 0]}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation()
          useWorldStore.getState().selectRoom(room.name)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
          setHovered(true)
        }}
        onPointerOut={(e) => {
          e.stopPropagation()
          document.body.style.cursor = ''
          setHovered(false)
        }}
      >
        <primitive object={sharedBuildingGeometry(width, height, depth)} attach="geometry" />
        {/* eslint-disable-next-line react/no-unknown-property */}
        <meshStandardMaterial
          color="#1c2347"
          emissive="#00d4ff"
          emissiveIntensity={emissiveIntensity}
          roughness={0.4}
          metalness={0.6}
        />
      </mesh>

      {/* bevel / edge highlight */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <lineSegments position={[0, buildingY, 0]} geometry={edgesGeometry}>
        {/* eslint-disable-next-line react/no-unknown-property */}
        <lineBasicMaterial
          color="#00d4ff"
          transparent
          opacity={isSelected ? 0.24 : hovered ? 0.2 : 0.08}
        />
      </lineSegments>

      {/* horizontal floor bands */}
      {bandYs.map((y) => (
        // eslint-disable-next-line react/no-unknown-property
        <mesh
          key={`band-${y.toFixed(1)}`}
          position={[0, y, 0]}
          geometry={floorBandGeometryFor(width, depth)}
          material={floorBandMaterialInst}
          castShadow
          receiveShadow
        />
      ))}

      {/* window planes — front (+z) and side (+x) */}
      {windowYs.map((y) => (
        // eslint-disable-next-line react/no-unknown-property
        <mesh
          key={`wf-${y.toFixed(1)}`}
          position={[0, y, depth / 2 + 0.016]}
          geometry={sharedWindowGeometry}
          material={windowMaterialInst}
        />
      ))}
      {windowYs.map((y) => (
        // eslint-disable-next-line react/no-unknown-property
        <mesh
          key={`ws-${y.toFixed(1)}`}
          position={[width / 2 + 0.016, y, 0]}
          rotation={[0, Math.PI / 2, 0]}
          geometry={sharedWindowGeometry}
          material={windowMaterialInst}
        />
      ))}

      {/* rooftop */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <mesh
        position={[0, rooftopY, 0]}
        geometry={rooftopGeometryFor(width, depth)}
        material={rooftopMaterialInst}
        castShadow
        receiveShadow
      />
      {/* antenna */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <mesh position={[0, antennaY, 0]} geometry={sharedAntennaGeometry} castShadow>
        {/* eslint-disable-next-line react/no-unknown-property */}
        <meshStandardMaterial
          color="#2a3160"
          emissive="#00d4ff"
          emissiveIntensity={isSelected ? 0.6 : 0.22}
          roughness={0.4}
          metalness={0.55}
        />
      </mesh>

      {/* selected glow — stronger */}
      {isSelected ? (
        // eslint-disable-next-line react/no-unknown-property
        <pointLight position={[0, rooftopY + 1.2, 0]} intensity={1.25} distance={16} color="#00d4ff" decay={2} />
      ) : null}

      {/* room label — sprite with CanvasTexture.
       * Always faces camera, fixed world size, immune to DOM stacking.
       * Texture is regenerated when the active (selected|hovered) state
       * changes (see labelTexture memo); previous texture is disposed.
       * sizeAttenuation=false keeps the label at a constant pixel size
       * regardless of camera distance, so the name is always legible in
       * both free view and inside-building (selected) mode. */}
      <sprite position={[0, labelY, 0]} scale={[labelScale.x, labelScale.y, 1]}>
        <spriteMaterial
          attach="material"
          map={labelTexture}
          transparent
          depthTest
          depthWrite={false}
          sizeAttenuation={false}
          toneMapped={false}
        />
      </sprite>
    </group>
  )
}
