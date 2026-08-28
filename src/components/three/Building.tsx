'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { Room } from '@/lib/technocore/types'
import { useWorldStore } from '@/stores/world-store'

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

  const baseIntensity = useMemo(() => {
    const log = Math.log10(room.messageCount + 1)
    // 0.15 baseline, subtle grow for active rooms, cap ~0.5
    return Math.min(0.5, 0.15 + log * 0.05)
  }, [room.messageCount])

  const emissiveIntensity = isSelected ? baseIntensity * 2 : baseIntensity

  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    if (!meshRef.current) return
    if (isSelected) {
      meshRef.current.rotation.y += 0.2 * delta
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
        {/* eslint-disable-next-line react/no-unknown-property */}
        <boxGeometry args={[width, height, depth]} />
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
