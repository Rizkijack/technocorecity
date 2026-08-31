'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
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

  const edgesGeometry = useMemo(
    () => new THREE.EdgesGeometry(sharedBuildingGeometry(width, height, depth)),
    [width, height, depth],
  )

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

      {/* room label */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <Html
        position={[0, labelY, 0]}
        center
        distanceFactor={6}
        sprite
        zIndexRange={[10, 0]}
        className="pointer-events-none select-none"
        style={{
          fontFamily: 'var(--font-mono), JetBrains Mono, monospace',
          fontSize: isSelected || hovered ? '13px' : '11px',
          fontWeight: isSelected ? 600 : 500,
          lineHeight: 1.2,
          padding: '3px 8px',
          borderRadius: '999px',
          whiteSpace: 'nowrap',
          color: isSelected ? '#0a0e27' : hovered ? '#00d4ff' : '#e8eaf6',
          background: isSelected
            ? 'rgba(0, 212, 255, 0.95)'
            : hovered
              ? 'rgba(10, 14, 39, 0.85)'
              : 'rgba(10, 14, 39, 0.55)',
          border: isSelected
            ? '1px solid rgba(0, 212, 255, 1)'
            : hovered
              ? '1px solid rgba(0, 212, 255, 0.6)'
              : '1px solid rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(4px)',
          textShadow: '0 1px 2px rgba(0, 0, 0, 0.4)',
          boxShadow: isSelected
            ? '0 0 16px rgba(0, 212, 255, 0.45)'
            : hovered
              ? '0 0 8px rgba(0, 212, 255, 0.25)'
              : 'none',
          transition:
            'font-size 120ms ease, color 120ms ease, background 120ms ease, border 120ms ease, box-shadow 120ms ease',
        }}
      >
        <span style={{ opacity: 0.55 }}>r/</span>
        {room.name}
      </Html>
    </group>
  )
}
