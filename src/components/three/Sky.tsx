'use client';

// Background color is set directly on the Canvas via <color attach="background" />.
// This component is intentionally a no-op pass-through so the scene tree remains
// stable when future skybox work lands.
export function Sky(): null {
  return null;
}
