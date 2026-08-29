'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { Agent, Room } from '@/lib/technocore/types'
import { sharedAgentGeometry } from '@/lib/three/geometry'
import { signedMaterial, unsignedMaterial } from '@/lib/three/materials'
import { useWorldStore } from '@/stores/world-store'

/**
 * One instanced cube per (agent × room) pair. R3F's <instancedMesh> issues a
 * single draw call for all instances — replacing ~250 individual <mesh> nodes
 * with two (one for signed, one for unsigned). This keeps 60 FPS even at the
 * 1000-agent stress-test target (docs/08 §InstancedMesh).
 *
 * Per-instance state (position, color, bob) lives in:
 *   - `setMatrixAt` (4x4 matrix, 16 floats per instance)
 *   - `setColorAt` (RGB, 3 floats per instance) — only used to distinguish
 *     signed vs unsigned, which we already split by mesh; left as a no-op
 *     here for simplicity.
 *
 * Labels remain a separate React tree (one <Html> per agent) below the
 * instanced mesh, since <Html> can't be instanced. Picking is done by reading
 * `event.instanceId` and mapping it back to the (agent, room) pair.
 */

interface AgentInstance {
  agent: Agent
  roomName: string
  position: [number, number, number]
  /** Deterministic phase offset for the bob animation. */
  phase: number
  /** True if this instance uses the signed (cyan) material. */
  isSigned: boolean
}

interface AgentCloudProps {
  /** Pre-computed list of instances to render. */
  instances: AgentInstance[]
}

const SIGNED_COLOR = new THREE.Color(0x00d4ff)
const UNSIGNED_COLOR = new THREE.Color(0xe8eaf6)
const _matrix = new THREE.Matrix4()
const _position = new THREE.Vector3()
const _scale = new THREE.Vector3(1, 1, 1)
const _quat = new THREE.Quaternion()

function hashSeed(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function AgentCloud({ instances }: AgentCloudProps) {
  const signedRef = useRef<THREE.InstancedMesh>(null)
  const unsignedRef = useRef<THREE.InstancedMesh>(null)
  const selectAgent = useWorldStore((s) => s.selectAgent)

  // If the component unmounts while the pointer is over a mesh (agents churn),
  // onPointerOut never fires and the cursor would stick as 'pointer'. Restore
  // it on unmount.
  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.cursor = ''
      }
    }
  }, [])

  // Partition into two arrays so each <instancedMesh> only holds its kind.
  const { signed, unsigned, all } = useMemo(() => {
    const signed: AgentInstance[] = []
    const unsigned: AgentInstance[] = []
    for (const inst of instances) {
      if (inst.isSigned) signed.push(inst)
      else unsigned.push(inst)
    }
    return { signed, unsigned, all: instances }
  }, [instances])

  // Map instance index → AgentInstance for picking. We use a single index
  // space: signed instances get [0..signed.length-1], unsigned get
  // [signed.length..signed.length+unsigned.length-1] across the union.
  // The two refs are separate though, so each ref's `instanceId` is its own
  // local 0-based index. We handle this in the click handler below.
  const signedToInstance = useMemo(() => new Map(signed.map((s, i) => [i, s])), [signed])
  const unsignedToInstance = useMemo(
    () => new Map(unsigned.map((s, i) => [i + signed.length, s])),
    [unsigned, signed.length],
  )

  // Per-frame: update each instance's matrix to apply the bob.
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const update = (
      ref: React.RefObject<THREE.InstancedMesh | null>,
      list: AgentInstance[],
    ) => {
      const mesh = ref.current
      if (!mesh || list.length === 0) return
      for (let i = 0; i < list.length; i++) {
        const inst = list[i]
        if (!inst) continue
        const bob = Math.sin(t * 0.9 + inst.phase) * 0.22
        _position.set(inst.position[0], inst.position[1] + bob, inst.position[2])
        // Signed agents breathe (gentle scale pulse, amplitude 0.08 at
        // 2 rad/s, phase-locked per instance); unsigned stay static-size.
        const pulse = inst.isSigned
          ? 1 + 0.08 * Math.sin(t * 2.0 + inst.phase)
          : 1
        _scale.set(pulse, pulse, pulse)
        _matrix.compose(_position, _quat, _scale)
        mesh.setMatrixAt(i, _matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    }
    update(signedRef, signed)
    update(unsignedRef, unsigned)
  })

  // Handle instance click → selectAgent.
  const handleClick = (
    e: THREE.Intersection & {
      instanceId?: number
      stopPropagation?: () => void
    },
    isSignedMesh: boolean,
  ) => {
    e.stopPropagation?.()
    if (e.instanceId === undefined) return
    const inst = isSignedMesh
      ? signedToInstance.get(e.instanceId)
      : unsignedToInstance.get(e.instanceId + signed.length)
    if (inst) {
      // nativeEvent carries the DOM coords; cast through unknown for the
      // optional clientX/Y fields not in the typed Intersection.
      const ne = (e as unknown as { clientX?: number; clientY?: number })
      selectAgent(inst.agent.key, {
        x: ne.clientX ?? 0,
        y: ne.clientY ?? 0,
      })
    }
  }

  return (
    <>
      <instancedMesh
        ref={signedRef}
        args={[sharedAgentGeometry, signedMaterial, Math.max(1, signed.length)]}
        frustumCulled={false}
        onClick={(e) => handleClick(e, true)}
        onPointerOver={(e) => {
          e.stopPropagation()
          if (typeof document !== 'undefined') {
            document.body.style.cursor = 'pointer'
          }
        }}
        onPointerOut={(e) => {
          e.stopPropagation()
          if (typeof document !== 'undefined') {
            document.body.style.cursor = ''
          }
        }}
      >
        {/* Color attribute: defaults to shared material color; instance colors
            left as identity so the shared material wins. */}
      </instancedMesh>

      <instancedMesh
        ref={unsignedRef}
        args={[sharedAgentGeometry, unsignedMaterial, Math.max(1, unsigned.length)]}
        frustumCulled={false}
        onClick={(e) => handleClick(e, false)}
        onPointerOver={(e) => {
          e.stopPropagation()
          if (typeof document !== 'undefined') {
            document.body.style.cursor = 'pointer'
          }
        }}
        onPointerOut={(e) => {
          e.stopPropagation()
          if (typeof document !== 'undefined') {
            document.body.style.cursor = ''
          }
        }}
      />

      {/* Labels remain a separate React tree — <Html> can't be instanced. */}
      {all.map((inst) => (
        <Html
          key={`${inst.agent.key}:${inst.roomName}`}
          position={[inst.position[0], inst.position[1] + 0.5, inst.position[2]]}
          center
          distanceFactor={10}
          className="pointer-events-none select-none whitespace-nowrap font-mono text-[10px] text-[#e8eaf6]"
          style={{ fontFamily: 'var(--font-mono), JetBrains Mono, monospace' }}
        >
          {inst.agent.displayName.slice(0, 16)}
        </Html>
      ))}
    </>
  )
}

/**
 * Build the list of agent instances from the world store + layout. Kept as a
 * pure function so it can be memoized at the call site (World.tsx) and tested.
 */
export function buildAgentInstances(
  agents: Map<string, Agent>,
  rooms: Map<string, Room>,
  positions: Map<string, readonly [number, number]>,
): AgentInstance[] {
  const out: AgentInstance[] = []
  for (const agent of agents.values()) {
    for (const roomName of agent.rooms) {
      const p = positions.get(roomName)
      if (!p) continue
      const seed = hashSeed(`${agent.key}:${roomName}`)
      const offsetX = ((seed % 8) - 4) * 0.8
      const offsetZ = (((seed * 7) % 8) - 4) * 0.8
      out.push({
        agent,
        roomName,
        position: [p[0] + offsetX, 1, p[1] + offsetZ],
        phase: (seed % 1000) * 0.012,
        isSigned: agent.isSigned,
      })
    }
  }
  return out
}

// Silence unused-var warning: SIGNED_COLOR and UNSIGNED_COLOR are reserved for
// future per-instance color overrides (e.g. "active agent pulse" highlight).
void SIGNED_COLOR
void UNSIGNED_COLOR
