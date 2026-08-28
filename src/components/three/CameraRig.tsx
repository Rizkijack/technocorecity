'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useWorldStore } from '@/stores/world-store'
import { computePositions } from '@/lib/three/layout'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

const OVERVIEW_POS: [number, number, number] = [0, 30, 50]
const OVERVIEW_TARGET: [number, number, number] = [0, 0, 0]

export function CameraRig() {
  const camera = useThree((s) => s.camera)
  const selectedRoomId = useWorldStore((s) => s.selectedRoomId)
  const rooms = useWorldStore((s) => s.rooms)

  const targetLookAt = useRef(new THREE.Vector3(...OVERVIEW_TARGET))
  const targetPos = useRef(new THREE.Vector3(...OVERVIEW_POS))
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const prefersReduced = useRef(false)

  const roomsArray = useMemo(() => Array.from(rooms.values()), [rooms])
  const positions = useMemo(() => computePositions(roomsArray), [roomsArray])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      prefersReduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
      const handler = (e: MediaQueryListEvent) => {
        prefersReduced.current = e.matches
      }
      // modern browsers
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', handler)
        return () => mql.removeEventListener('change', handler)
      }
      // safari fallback
      const legacy = mql as unknown as { addListener: (cb: (e: MediaQueryListEvent) => void) => void; removeListener: (cb: (e: MediaQueryListEvent) => void) => void }
      if (typeof legacy.addListener === 'function') {
        legacy.addListener(handler)
        return () => legacy.removeListener(handler)
      }
    }
    return undefined
  }, [])

  useEffect(() => {
    if (!selectedRoomId) {
      targetPos.current.set(...OVERVIEW_POS)
      targetLookAt.current.set(...OVERVIEW_TARGET)
      return
    }
    const room = rooms.get(selectedRoomId)
    if (!room) {
      targetPos.current.set(...OVERVIEW_POS)
      targetLookAt.current.set(...OVERVIEW_TARGET)
      return
    }
    const p = positions.get(room.name)
    if (!p) {
      targetPos.current.set(...OVERVIEW_POS)
      targetLookAt.current.set(...OVERVIEW_TARGET)
      return
    }
    const buildingHeight = Math.max(3, Math.min(30, Math.log10(room.messageCount + 1) * 4))
    const [x, z] = p
    targetPos.current.set(x, 15, z + 12)
    targetLookAt.current.set(x, buildingHeight / 2, z)
  }, [selectedRoomId, rooms, positions])

  useFrame((_, delta) => {
    if (prefersReduced.current) {
      camera.position.copy(targetPos.current)
      const ctrl = controlsRef.current
      if (ctrl) {
        ctrl.target.copy(targetLookAt.current)
        ctrl.update()
      } else {
        camera.lookAt(targetLookAt.current)
      }
      return
    }

    const lerp = 1 - Math.pow(0.001, delta)
    camera.position.lerp(targetPos.current, lerp)
    const ctrl = controlsRef.current
    if (ctrl) {
      ctrl.target.lerp(targetLookAt.current, lerp)
      ctrl.update()
    } else {
      // fallback when controls not yet mounted
      camera.lookAt(targetLookAt.current)
    }
  })

  return (
    <OrbitControls
      ref={controlsRef as unknown as React.Ref<OrbitControlsImpl>}
      enableDamping
      dampingFactor={0.05}
      minDistance={10}
      maxDistance={120}
      maxPolarAngle={Math.PI / 2.1}
      autoRotate={!selectedRoomId}
      autoRotateSpeed={0.3}
    />
  )
}
