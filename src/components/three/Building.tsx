'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { Room } from '@/lib/technocore/types'
import { useWorldStore } from '@/stores/world-store'
import { createBuildingGeometry } from '@/lib/three/geometry'

// Cache building box geometries by dimension tuple. With 50+ rooms and only
// a handful of width/height/depth combos, this keeps GPU buffers bounded.
const geometryCache = new Map<string, THREE.BoxGeometry>()
function sharedBuildingGeometry(
  w: number,
  h: number,
  d: number,
): THREE.BoxGeometry {
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
  const width = useMemo(
    () => 4 + Math.min(room.topic.length / 8, 4),
    [room.topic.length],
  )
  const depth = 4

  const selectedRoomId = useWorldStore((s) => s.selectedRoomId)
  const isSelected = selectedRoomId === room.name

  // F-101: timestamp (ms epoch) when this room was first observed via
  // `created <room>` events. When set within the last 1.5s, the building
  // tweens in from scale 0 → 1 with ease-out. Selects the primitive number
  // so zustand re-renders correctly when the underlying Map is replaced.
  const newAt = useWorldStore((s) => s.newlyCreatedAt.get(room.name))

  const baseIntensity = useMemo(() => {
    const log = Math.log10(room.messageCount + 1)
    // 0.15 baseline, subtle grow for active rooms, cap ~0.5
    return Math.min(0.5, 0.15 + log * 0.05)
  }, [room.messageCount])

  const emissiveIntensity = isSelected ? baseIntensity * 2 : baseIntensity

  const meshRef = useRef<THREE.Mesh>(null)

  // When a new timestamp is set, snap to scale 0 so the first frame of the
  // tween doesn't show the building at full size (R3F's first commit happens
  // after the React render but before useFrame runs).
  useEffect(() => {
    if (newAt === undefined) return
    if (meshRef.current) {
      meshRef.current.scale.setScalar(0)
    }
  }, [newAt])

  // Cap rotation at one full turn (2π) so selected buildings don't spin
  // indefinitely when the panel stays open. Resets each time selection toggles
  // (deselecting flips isSelected false → guards on the next frame, and the
  // mesh's rotation.y is reset to 0 on the next click via selectRoom toggling).
  // Also runs the F-101 scale-in tween for newly created rooms.
  useFrame((_, delta) => {
    if (!meshRef.current) return

    // F-101: scale 0 → 1 over 1.5s with ease-out (cubic).
    if (newAt !== undefined) {
      const elapsed = (Date.now() - newAt) / 1500
      if (elapsed < 1) {
        const t = Math.max(0, elapsed)
        const eased = 1 - Math.pow(1 - t, 3)
        meshRef.current.scale.setScalar(eased)
      } else if (meshRef.current.scale.x !== 1) {
        meshRef.current.scale.setScalar(1)
      }
    }

    if (!isSelected) return
    const TWO_PI = Math.PI * 2
    if (meshRef.current.rotation.y < TWO_PI) {
      meshRef.current.rotation.y = Math.min(
        TWO_PI,
        meshRef.current.rotation.y + 0.2 * delta,
      )
    }
  })

  return (
    <group>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <mesh
        ref={meshRef}
        position={[x, height / 2, z]}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation()
          useWorldStore.getState().selectRoom(room.name)
        }}
        onPointerOver={() => {
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = ''
        }}
      >
        <primitive
          object={sharedBuildingGeometry(width, height, depth)}
          attach="geometry"
        />
        {/* eslint-disable-next-line react/no-unknown-property */}
        <meshStandardMaterial
          color="#1c2347"
          emissive="#00d4ff"
          emissiveIntensity={emissiveIntensity}
          roughness={0.4}
          metalness={0.6}
        />
      </mesh>

      {/* selected glow */}
      {isSelected ? (
        // eslint-disable-next-line react/no-unknown-property
        <pointLight
          position={[x, height + 0.5, z]}
          intensity={0.8}
          distance={12}
          color="#00d4ff"
          decay={2}
        />
      ) : null}

      {/* room label — monospace, billboard-like via Html */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <Html
        position={[x, height + 1, z]}
        center
        distanceFactor={10}
        className="pointer-events-none select-none whitespace-nowrap font-mono text-[11px] text-[#e8eaf6]"
        style={{ fontFamily: 'var(--font-mono), JetBrains Mono, monospace' }}
      >
        {room.name}
      </Html>
    </group>
  )
}
