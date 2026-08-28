'use client'

import { Fragment, type ReactNode } from 'react'

// R3F Canvas already handles raycasting; this is a semantic pass-through
// so call sites can group interactive children without restructuring the tree.
interface RaycasterLayerProps {
  children: ReactNode
}

export function RaycasterLayer({ children }: RaycasterLayerProps) {
  return <Fragment>{children}</Fragment>
}
