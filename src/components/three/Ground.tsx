'use client'

import { groundPlaneGeometry } from '@/lib/three/geometry'
import { groundMaterial } from '@/lib/three/materials'

export function Ground({ size = 200 }: { size?: number }) {
  // Use shared geometry/material to keep GPU memory to one buffer.
  // groundPlaneGeometry is 1x1, scale at mesh level.
  return (
    <>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        scale={[size, size, 1]}
        geometry={groundPlaneGeometry}
        material={groundMaterial()}
        receiveShadow={false}
      />
      {/* subtle spatial reference grid — #2a3160 on both axes */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <gridHelper args={[size, 50, '#2a3160', '#1c2347']} position={[0, 0.01, 0]} />
    </>
  )
}
