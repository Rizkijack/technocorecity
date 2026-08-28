'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { Agent } from '@/lib/technocore/types'
import { sharedAgentGeometry } from '@/lib/three/geometry'
import { signedMaterial, unsignedMaterial } from '@/lib/three/materials'
import { useWorldStore } from '@/stores/world-store'

interface AgentPointProps {
  agent: Agent
  roomPosition: [number, number, number]
  offsetSeed: number
}

export function AgentPoint({ agent, roomPosition, offsetSeed }: AgentPointProps) {
  const groupRef = useRef<THREE.Group>(null)

  // deterministic offset inside building footprint — spread agents around roof
  const basePos = useMemo<[number, number, number]>(() => {
    const [rx, , rz] = roomPosition
    const offsetX = ((offsetSeed % 8) - 4) * 0.8
    // use seed*7 variant for Z to decorrelate axes, fallback to /8 partition if needed
    const offsetZ = (((offsetSeed * 7) % 8) - 4) * 0.8
    // Y fixed just above ground/building base for MVP; bob adds vertical motion
    // We intentionally do not depend on building height here (no coupling to Building internals).
    return [rx + offsetX, 1, rz + offsetZ]
  }, [roomPosition, offsetSeed])

  // gentle bob — deterministic phase per seed
  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime
    const phase = (offsetSeed % 1000) * 0.012
    const bob = Math.sin(t * 0.9 + phase) * 0.22
    groupRef.current.position.set(basePos[0], basePos[1] + bob, basePos[2])
  })

  return (
    // eslint-disable-next-line react/no-unknown-property
    <group ref={groupRef} position={basePos}>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <mesh
        geometry={sharedAgentGeometry}
        material={agent.isSigned ? signedMaterial : unsignedMaterial}
        onClick={(e) => {
          e.stopPropagation()
          useWorldStore.getState().selectAgent(agent.key, {
            x: e.clientX,
            y: e.clientY,
          })
        }}
        onPointerOver={() => {
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = ''
        }}
      />

      {/* mono label — Html billboard approximated via center+distanceFactor */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <Html
        center
        distanceFactor={10}
        position={[0, 0.5, 0]}
        className="pointer-events-none select-none whitespace-nowrap font-mono text-[10px] text-[#e8eaf6]"
        style={{ fontFamily: 'var(--font-mono), JetBrains Mono, monospace' }}
      >
        {agent.displayName.slice(0, 16)}
      </Html>
    </group>
  )
}
