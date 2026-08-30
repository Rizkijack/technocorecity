'use client'

import { useEffect, useRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

/**
 * FREE VIEW CameraRig
 * - OrbitControls bebas tanpa batas (no minDistance/maxDistance/maxPolarAngle)
 * - No autoRotate, no fly-to lerp — click Building tetap selectRoom tapi tidak gerakkan kamera
 * - enableDamping 0.05, enablePan/Zoom/Rotate true
 * - WASD + Arrow keys untuk pan (horizontal plane, moves target + camera together)
 * - Honors prefers-reduced-motion (kept as ref/listener, no fly animation to disable — damping tetap 0.05)
 */
export function CameraRig() {
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const prefersReduced = useRef(false)

  // Keep prefers-reduced-motion listener for accessibility.
  // FREE VIEW has no fly-to lerp, so there is no instant-teleport branch;
  // we just keep the ref in sync (damping stays 0.05 as required by AC).
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      prefersReduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
      const handler = (e: MediaQueryListEvent) => {
        prefersReduced.current = e.matches
      }
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', handler)
        return () => mql.removeEventListener('change', handler)
      }
      const legacy = mql as unknown as {
        addListener: (cb: (e: MediaQueryListEvent) => void) => void
        removeListener: (cb: (e: MediaQueryListEvent) => void) => void
      }
      if (typeof legacy.addListener === 'function') {
        legacy.addListener(handler)
        return () => legacy.removeListener(handler)
      }
    }
    return undefined
  }, [])

  // WASD / Arrow keys to pan — moves both camera and target on the horizontal plane.
  // Cleanup via removeEventListener (no setInterval, no leak).
  useEffect(() => {
    const PAN_STEP = 2

    const onKeyDown = (e: KeyboardEvent) => {
      const ctrl = controlsRef.current
      if (!ctrl) return

      const active = document.activeElement as HTMLElement | null
      const tag = active?.tagName?.toLowerCase() ?? ''
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || active?.isContentEditable) {
        return
      }

      const key = e.key.toLowerCase()
      const isPanKey =
        key === 'w' || key === 'a' || key === 's' || key === 'd' || key === 'arrowup' || key === 'arrowdown' || key === 'arrowleft' || key === 'arrowright'
      if (!isPanKey) return

      e.preventDefault()

      const camera = ctrl.object as THREE.PerspectiveCamera
      const forward = new THREE.Vector3()
      camera.getWorldDirection(forward)
      forward.y = 0
      if (forward.lengthSq() < 1e-6) {
        // looking straight down/up — fall back to world -Z
        forward.set(0, 0, -1)
      }
      forward.normalize()

      const worldUp = new THREE.Vector3(0, 1, 0)
      const right = new THREE.Vector3().crossVectors(forward, worldUp).normalize()

      const move = new THREE.Vector3()
      if (key === 'w' || key === 'arrowup') move.copy(forward).multiplyScalar(PAN_STEP)
      else if (key === 's' || key === 'arrowdown') move.copy(forward).multiplyScalar(-PAN_STEP)
      else if (key === 'a' || key === 'arrowleft') move.copy(right).multiplyScalar(-PAN_STEP)
      else if (key === 'd' || key === 'arrowright') move.copy(right).multiplyScalar(PAN_STEP)

      camera.position.add(move)
      ctrl.target.add(move)
      ctrl.update()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <OrbitControls
      ref={controlsRef as unknown as React.Ref<OrbitControlsImpl>}
      enableDamping
      dampingFactor={0.05}
      enablePan
      enableZoom
      enableRotate
    />
  )
}
