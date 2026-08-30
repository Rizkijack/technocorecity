'use client'

import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { useWorldStore } from '@/stores/world-store'
import { computePositions } from '@/lib/three/layout'
import { Ground } from './Ground'
import { Building } from './Building'
import { AgentCloud, buildAgentInstances } from './AgentCloud'
import { CameraRig } from './CameraRig'
import { PostFX } from '@/lib/three/postprocessing'

export function World() {
  const rooms = useWorldStore((s) => s.rooms)
  const agents = useWorldStore((s) => s.agents)

  const roomsArray = useMemo(() => Array.from(rooms.values()), [rooms])
  const positions = useMemo(() => computePositions(roomsArray), [roomsArray])

  // Build the agent instance list once per (rooms, agents, positions) change.
  // All (agent, room) pairs are flattened here so <AgentCloud> can render them
  // in 2 instanced draw calls instead of N individual <mesh> nodes.
  const agentInstances = useMemo(
    () => buildAgentInstances(agents, rooms, positions),
    [agents, rooms, positions],
  )

  return (
    <Canvas
      // FREE VIEW: initial camera [0,30,50] fov 50 near 0.1 far 200 — OrbitControls bebas tanpa fly-to
      camera={{ position: [0, 30, 50], fov: 50, near: 0.1, far: 200 }}
      dpr={[1, 2]}
      shadows={false}
      gl={{
        antialias: true,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
      }}
    >
      {/* eslint-disable-next-line react/no-unknown-property */}
      <color attach="background" args={['#0a0e27']} />
      {/* eslint-disable-next-line react/no-unknown-property */}
      <fog attach="fog" args={['#0a0e27', 50, 140]} />

      {/* lighting — per docs/07-design-language.md */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <ambientLight intensity={0.3} color="#ffffff" />
      {/* eslint-disable-next-line react/no-unknown-property */}
      <hemisphereLight args={['#00d4ff', '#0a0e27', 0.4]} />
      {/* eslint-disable-next-line react/no-unknown-property */}
      <directionalLight position={[10, 20, 5]} intensity={0.8} color="#ffffff" />
      {/* eslint-disable-next-line react/no-unknown-property */}
      <pointLight position={[0, 5, 0]} intensity={0.5} color="#00d4ff" distance={20} />

      <Ground />

      {/* buildings in circle — computePositions handles radius = max(20, n*3) */}
      {roomsArray.map((room, i) => {
        const p = positions.get(room.name) ?? [0, 0]
        const [x, z] = p
        return <Building key={room.name} room={room} position={[x, 0, z]} index={i} />
      })}

      {/* agent cloud — single <instancedMesh> per signed/unsigned group */}
      <AgentCloud instances={agentInstances} />

      <CameraRig />
      <PostFX />
    </Canvas>
  )
}
