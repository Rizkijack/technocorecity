'use client'

import {
  groundPlaneGeometry,
  sharedCurbXGeometry,
  sharedCurbZGeometry,
  sharedRoadGeometry,
} from '@/lib/three/geometry'
import { curbMaterial, groundMaterial, roadMaterial } from '@/lib/three/materials'

const ROAD_W = 8
const CURB_H = 0.08
const CURB_D = 0.4
const CURB_OFFSET = ROAD_W / 2 + CURB_D / 2 // 4.2 — derive from constants, avoid magic

export function Ground({ size = 200 }: { size?: number }) {
  // Shared geometry/materials — no per-frame allocation.
  // Layers (low → high): horizon (-0.05) < ground (0) < grid (0.01) < roads (0.015/0.025) < curbs (0.04)
  // Road delta 0.01 (0.015 vs 0.025) avoids z-fighting at intersection vs 0.001.
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
      {/* main roads — cross X & Z through center, 8 wide, #1a1f3d — use sharedRoadGeometry (was dead export) */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.015, 0]}
        scale={[size, ROAD_W, 1]}
        geometry={sharedRoadGeometry}
        material={roadMaterial()}
        receiveShadow={false}
      />
      {/* eslint-disable-next-line react/no-unknown-property */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.025, 0]}
        scale={[ROAD_W, size, 1]}
        geometry={sharedRoadGeometry}
        material={roadMaterial()}
        receiveShadow={false}
      />
      {/* curbs — thin box 0.08h × 0.4d along road edges — positions derived from ROAD_W/CURB_D */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <mesh
        position={[0, CURB_H / 2, CURB_OFFSET]}
        scale={[size, 1, 1]}
        geometry={sharedCurbXGeometry}
        material={curbMaterial()}
        receiveShadow={false}
      />
      {/* eslint-disable-next-line react/no-unknown-property */}
      <mesh
        position={[0, CURB_H / 2, -CURB_OFFSET]}
        scale={[size, 1, 1]}
        geometry={sharedCurbXGeometry}
        material={curbMaterial()}
        receiveShadow={false}
      />
      {/* eslint-disable-next-line react/no-unknown-property */}
      <mesh
        position={[CURB_OFFSET, CURB_H / 2, 0]}
        scale={[1, 1, size]}
        geometry={sharedCurbZGeometry}
        material={curbMaterial()}
        receiveShadow={false}
      />
      {/* eslint-disable-next-line react/no-unknown-property */}
      <mesh
        position={[-CURB_OFFSET, CURB_H / 2, 0]}
        scale={[1, 1, size]}
        geometry={sharedCurbZGeometry}
        material={curbMaterial()}
        receiveShadow={false}
      />
      {/* grid — fewer divisions (40 vs 50) = larger cells, less clutter after roads */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <gridHelper args={[size, 40, '#2a3160', '#1c2347']} position={[0, 0.01, 0]} />
    </>
  )
}
