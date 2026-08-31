'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Room } from '@/lib/technocore/types'
import { useWorldStore } from '@/stores/world-store'
import { formatNumber, formatRoomName, truncate } from '@/lib/utils/format'
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
 * Sprite-based room label — Billboard equivalent.
 * Sprite always faces camera (native Billboard), sizeAttenuation:false
 * gives constant screen-size like Html distanceFactor 12-15,
 * and fog:false keeps it visible in fog 50-140 (FREE VIEW [0,30,50]).
 *
 * Visual spec (07-design-language):
 *  - r/<name> mono 12px bold #e8eaf6 + halo #0a0e27
 *  - topic truncated 24 sans 9px #a0a8c8 (if any)
 *  - badge "x msgs" compact via formatNumber, bg #1c2347 rounded
 *  - hover: scale 1.1 + text-accent-cyan, selected: scale 1.15 + brighter halo
 *
 * CanvasTexture is rebuilt only when room data or hover/selected changes;
 * previous texture disposed — no memory leak. 50 sprites is fine for MVP.
 */

// Keep legacy single-line API for regression guard (test expects export)
const LABEL_FONT = '500 12px ui-monospace, "JetBrains Mono", Menlo, monospace'
const LABEL_PADDING_X = 8
const LABEL_PADDING_Y = 4
const LABEL_RADIUS = 10

export function makeLabelTexture(text: string, active: boolean): THREE.CanvasTexture {
  const measure = document.createElement('canvas')
  const mctx = measure.getContext('2d')!
  mctx.font = active ? '600 14px ui-monospace, "JetBrains Mono", Menlo, monospace' : LABEL_FONT
  const fullText = formatRoomName(text)
  const textW = Math.ceil(mctx.measureText(fullText).width)
  const prefixW = Math.ceil(mctx.measureText('r/').width)
  const fontSize = active ? 14 : 12
  const fontWeight = active ? 600 : 500

  const w = textW + LABEL_PADDING_X * 2
  const h = fontSize + LABEL_PADDING_Y * 2
  const dpr = 2
  const canvas = document.createElement('canvas')
  canvas.width = w * dpr
  canvas.height = h * dpr
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)

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

  ctx.strokeStyle = active ? 'rgba(0, 212, 255, 1)' : 'rgba(255, 255, 255, 0.18)'
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.font = `${fontWeight} ${fontSize}px ui-monospace, "JetBrains Mono", Menlo, monospace`
  ctx.textBaseline = 'middle'
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

// Solid 3-line label: r/name + topic (24ch) + messageCount badge
// Billboard via Sprite + Html transform occlude={false} distanceFactor={12} equivalent
export function makeSolidLabelTexture(room: Room, hovered: boolean, isSelected: boolean): THREE.CanvasTexture {
  const hasTopic = typeof room.topic === 'string' && room.topic.trim().length > 0
  const topicTrunc = hasTopic ? truncate(room.topic.trim(), 24) : ''
  const badgeText = `${formatNumber(room.messageCount)} msgs`

  const PAD_X = 10
  const PAD_Y = 7
  const GAP = 4
  const NAME_H = 12
  const TOPIC_H = 9
  const BADGE_H = 13
  const BADGE_PAD_X = 7

  // measure widths
  const m = document.createElement('canvas')
  const mctx = m.getContext('2d')!
  mctx.font = '700 12px ui-monospace, "JetBrains Mono", Menlo, monospace'
  const fullName = formatRoomName(room.name)
  const nameW = Math.ceil(mctx.measureText(fullName).width)
  // prefix split for two-tone rendering
  // (measure prefix for offset, but width already in nameW)
  const prefixW = Math.ceil(mctx.measureText('r/').width)
  let topicW = 0
  if (hasTopic) {
    mctx.font = '400 9px Inter, system-ui, sans-serif'
    topicW = Math.ceil(mctx.measureText(topicTrunc).width)
  }
  mctx.font = '600 9px ui-monospace, "JetBrains Mono", Menlo, monospace'
  const badgeW = Math.ceil(mctx.measureText(badgeText).width)
  const badgePillW = badgeW + BADGE_PAD_X * 2

  const contentW = Math.max(nameW, topicW, badgePillW)
  const w = Math.ceil(contentW + PAD_X * 2)
  let h = PAD_Y * 2 + NAME_H
  if (hasTopic) h += GAP + TOPIC_H
  h += GAP + BADGE_H

  const dpr = 2
  const canvas = document.createElement('canvas')
  canvas.width = w * dpr
  canvas.height = h * dpr
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)

  // outer pill — uses bg-deep #0a0e27 halo for contrast, not lost in fog
  const r = 12
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.arcTo(w, 0, w, h, r)
  ctx.arcTo(w, h, 0, h, r)
  ctx.arcTo(0, h, 0, 0, r)
  ctx.arcTo(0, 0, w, 0, r)
  ctx.closePath()
  if (isSelected) {
    ctx.fillStyle = 'rgba(0, 212, 255, 0.96)'
    ctx.shadowColor = 'rgba(0, 212, 255, 0.6)'
    ctx.shadowBlur = 16
  } else if (hovered) {
    ctx.fillStyle = 'rgba(18, 24, 58, 0.92)'
    ctx.shadowColor = 'rgba(0, 212, 255, 0.35)'
    ctx.shadowBlur = 10
  } else {
    ctx.fillStyle = 'rgba(10, 14, 39, 0.84)'
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)'
    ctx.shadowBlur = 8
  }
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.strokeStyle = isSelected ? 'rgba(0,212,255,1)' : hovered ? 'rgba(0,212,255,0.5)' : 'rgba(255,255,255,0.14)'
  ctx.lineWidth = 1
  ctx.stroke()

  // layout y — name at top
  let y = PAD_Y + NAME_H / 2
  const cx = w / 2

  // --- name line: r/ (dim) + name (bold) centered as block ---
  ctx.textBaseline = 'middle'
  // outline halo #0a0e27 for contrast on fog
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  const nameStartX = cx - nameW / 2
  const nameY = y
  // halo stroke
  ctx.font = '700 12px ui-monospace, "JetBrains Mono", Menlo, monospace'
  ctx.strokeStyle = '#0a0e27'
  ctx.lineWidth = 3.5
  ctx.textAlign = 'left'
  ctx.strokeText('r/', nameStartX, nameY)
  ctx.strokeText(room.name, nameStartX + prefixW, nameY)
  // fill
  if (isSelected) {
    ctx.fillStyle = 'rgba(10,14,39,0.55)'
    ctx.fillText('r/', nameStartX, nameY)
    ctx.fillStyle = '#0a0e27'
    ctx.fillText(room.name, nameStartX + prefixW, nameY)
  } else if (hovered) {
    ctx.fillStyle = 'rgba(0,212,255,0.6)'
    ctx.fillText('r/', nameStartX, nameY)
    ctx.fillStyle = '#00d4ff'
    ctx.fillText(room.name, nameStartX + prefixW, nameY)
  } else {
    ctx.fillStyle = 'rgba(232,234,246,0.45)'
    ctx.fillText('r/', nameStartX, nameY)
    ctx.fillStyle = '#e8eaf6'
    ctx.fillText(room.name, nameStartX + prefixW, nameY)
  }

  y += NAME_H / 2 + GAP

  // --- topic line ---
  if (hasTopic) {
    y += TOPIC_H / 2
    ctx.font = '400 9px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    // halo
    ctx.strokeStyle = '#0a0e27'
    ctx.lineWidth = 2.5
    ctx.strokeText(topicTrunc, cx, y)
    ctx.fillStyle = hovered ? '#c8d0f0' : '#a0a8c8'
    ctx.fillText(topicTrunc, cx, y)
    y += TOPIC_H / 2 + GAP
  } else {
    // no topic: y already at gap position, keep for badge
  }

  // --- badge line ---
  y += BADGE_H / 2
  const badgeX = cx - badgePillW / 2
  const badgeY = y - BADGE_H / 2
  // badge pill bg #1c2347 (bg-elev)
  ctx.beginPath()
  const br = BADGE_H / 2
  ctx.moveTo(badgeX + br, badgeY)
  ctx.arcTo(badgeX + badgePillW, badgeY, badgeX + badgePillW, badgeY + BADGE_H, br)
  ctx.arcTo(badgeX + badgePillW, badgeY + BADGE_H, badgeX, badgeY + BADGE_H, br)
  ctx.arcTo(badgeX, badgeY + BADGE_H, badgeX, badgeY, br)
  ctx.arcTo(badgeX, badgeY, badgeX + badgePillW, badgeY, br)
  ctx.closePath()
  ctx.fillStyle = isSelected ? 'rgba(28,35,71,1)' : 'rgba(28,35,71,0.96)'
  ctx.fill()
  ctx.strokeStyle = isSelected ? 'rgba(0,212,255,0.45)' : 'rgba(255,255,255,0.10)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.font = '600 9px ui-monospace, "JetBrains Mono", Menlo, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // badge text halo #0a0e27 already via pill contrast
  ctx.fillStyle = '#e8eaf6'
  ctx.fillText(badgeText, cx, y)

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
    if (count === 1) return [0.4 + height / 2]
    return Array.from({ length: count }, (_, i) => 0.4 + ((i + 1) * height) / (count + 1))
  }, [bandYs.length, height])

  // Solid 3-line Billboard label — directly from room prop (world-store ← useRooms → fetchRooms → parseRooms)
  // No manual fetch; sync via world-store. Billboard via Sprite (always faces camera),
  // sizeAttenuation=false ≈ Html distanceFactor 12-15, fog:false so not lost in fog, free-view orbit/pan/zoom agnostic.
  const labelTexture = useMemo(() => {
    return makeSolidLabelTexture(room, hovered, isSelected)
  }, [room, hovered, isSelected])
  useEffect(() => {
    return () => {
      labelTexture.dispose()
    }
  }, [labelTexture])

  // Sprite scale — sizeAttenuation=false keeps constant screen size (readable 5-40 units)
  // hover 1.1, selected 1.15 as per AC; halo brighter when selected
  const labelScale = useMemo(() => {
    const img = labelTexture.image as HTMLCanvasElement | undefined
    const aspect = img && img.width > 0 ? img.width / img.height : 3.2
    const baseH = 0.055
    const mult = isSelected ? 1.15 : hovered ? 1.1 : 1
    const worldHeight = baseH * mult
    return { x: worldHeight * aspect, y: worldHeight }
  }, [labelTexture, isSelected, hovered])

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
  const labelY = 0.4 + height + 1.6

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

      {/* Billboard room label — Sprite is native Billboard (always faces camera).
          Html alternative would be <Billboard><Html transform occlude={false} distanceFactor={12}>…</Html></Billboard>
          but Sprite avoids DOM layer issues under PointerLockControls, cheaper for 50 buildings,
          and sizeAttenuation={false} + fog={false} keeps it SOLID in FREE VIEW (orbit/pan/zoom, fog 50,140, camera [0,30,50]).
          Uses makeSolidLabelTexture (r/name mono 12px bold #e8eaf6 halo #0a0e27, topic sans 9px truncated 24, badge #1c2347).
          Hover 1.1 cyan text, selected 1.15 brighter halo — no geometry per frame. */}
      <sprite position={[0, labelY, 0]} scale={[labelScale.x, labelScale.y, 1]}>
        <spriteMaterial
          attach="material"
          map={labelTexture}
          transparent
          depthTest
          depthWrite={false}
          sizeAttenuation={false}
          fog={false}
          toneMapped={false}
        />
      </sprite>
    </group>
  )
}
