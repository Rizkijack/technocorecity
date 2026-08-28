'use client'

import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import type { FC } from 'react'

/**
 * Bloom configuration placeholder — tune without touching the component tree.
 * Kept minimal so scenes can import the config and override per-world.
 */
export const BloomConfig = {
  intensity: 0.4,
  luminanceThreshold: 0.6,
  luminanceSmoothing: 0.4,
  mipmapBlur: true,
  blendFunction: BlendFunction.ADD,
} as const

/**
 * Cinematic post-processing: a single Bloom pass that lets emissive
 * agents and building edges glow without washing the whole scene.
 */
export const PostFX: FC = () => (
  <EffectComposer multisampling={4}>
    <Bloom
      intensity={BloomConfig.intensity}
      luminanceThreshold={BloomConfig.luminanceThreshold}
      luminanceSmoothing={BloomConfig.luminanceSmoothing}
      mipmapBlur={BloomConfig.mipmapBlur}
      blendFunction={BloomConfig.blendFunction}
    />
  </EffectComposer>
)

export default PostFX
