'use client'

import {
  groundPlaneGeometry,
  sharedCurbXGeometry,
  sharedCurbZGeometry,
} from '@/lib/three/geometry'
import { curbMaterial, groundMaterial, roadMaterial } from '@/lib/three/materials'

export function Ground({ size = 200 }: { size?: number }) {
  // Shared geometry/materials — no per-frame allocation.
  // Layers (low → high): horizon (-0.05) < ground (0) < grid (0.01) < roads (0.015) < curbs (0.04)
  return (
    <>
      {/* horizon — larger plane slightly below to hide edge & extend fog depth */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.05, 0]}
        scale={[size * 2, size * 2, 1]}
        geometry={groundPlaneGeometry}
        material={groundMaterial()}
        receiveShadow={false}
      />
      {/* base ground 200x200 */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        scale={[size, size, 1]}
        geometry={groundPlaneGeometry}
        material={groundMaterial()}
        receiveShadow={false}
      />
      {/* main roads — cross X & Z through center, 8 wide, #1a1f3d */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.015, 0]}
        scale={[size, 8, 1]}
        geometry={groundPlaneGeometry}
        material={roadMaterial()}
        receiveShadow={false}
      />
      {/* eslint-disable-next-line react/no-unknown-property */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.016, 0]}
        scale={[8, size, 1]}
        geometry={groundPlaneGeometry}
        material={roadMaterial()}
        receiveShadow={false}
      />
      {/* curbs — thin box 0.08h × 0.4d along road edges */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <mesh
        position={[0, 0.04, 4.2]}
        scale={[size, 1, 1]}
        geometry={sharedCurbXGeometry}
        material={curbMaterial()}
        receiveShadow={false}
      />
      {/* eslint-disable-next-line react/no-unknown-property */}
      <mesh
        position={[0, 0.04, -4.2]}
        scale={[size, 1, 1]}
        geometry={sharedCurbXGeometry}
        material={curbMaterial()}
        receiveShadow={false}
      />
      {/* eslint-disable-next-line react/no-unknown-property */}
      <mesh
        position={[4.2, 0.04, 0]}
        scale={[1, 1, size]}
        geometry={sharedCurbZGeometry}
        material={curbMaterial()}
        receiveShadow={false}
      />
      {/* eslint-disable-next-line react/no-unknown-property */}
      <mesh
        position={[-4.2, 0.04, 0]}
        scale={[1, 1, size]}
        geometry={sharedCurbZGeometry}
        material={curbMaterial()}
        receiveShadow={false}
      />
      {/* grid — more solid: size 200, divisions 40 (was 50) */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <gridHelper args={[size, 40, '#2a3160', '#1c2347']} position={[0, 0.01, 0]} />
    </>
  )
}
