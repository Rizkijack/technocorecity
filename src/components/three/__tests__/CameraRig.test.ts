/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars */
/**
 * @vitest-environment jsdom
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { act } from 'react-dom/test-utils'
import { createRoot } from 'react-dom/client'
import * as THREE from 'three'

// ---------------------------------------------------------------------------
// Mock @react-three/drei — OrbitControls becomes a div + forwarding ref that
// exposes a shared mockControls object (camera + target + update).
// This avoids needing a real <Canvas> / WebGL context.
// ---------------------------------------------------------------------------
vi.mock('@react-three/drei', () => {
  const ReactMod = require('react')
  const THREEMod = require('three')
  const cam = new THREEMod.PerspectiveCamera(50, 1, 0.1, 1000)
  cam.position.set(0, 30, 50)
  cam.lookAt(0, 0, 0)
  cam.updateMatrixWorld(true)
  const target = new THREEMod.Vector3(0, 0, 0)
  let updateCallCount = 0
  const mockControls: any = {
    object: cam,
    target,
    update: () => {
      updateCallCount++
      ;(globalThis as any).__mockUpdateCount = updateCallCount
    },
  }
  ;(globalThis as any).__mockControls = mockControls
  ;(globalThis as any).__mockCamera = cam
  ;(globalThis as any).__mockTarget = target
  ;(globalThis as any).__mockUpdateCount = 0
  ;(globalThis as any).__resetMock = () => {
    cam.position.set(0, 30, 50)
    cam.lookAt(0, 0, 0)
    cam.updateMatrixWorld(true)
    target.set(0, 0, 0)
    updateCallCount = 0
    ;(globalThis as any).__mockUpdateCount = 0
    ;(globalThis as any).__forceNullControls = false
  }
  return {
    OrbitControls: ReactMod.forwardRef((props: any, ref: any) => {
      const forceNull = (globalThis as any).__forceNullControls
      ReactMod.useImperativeHandle(ref, () => (forceNull ? null : mockControls))
      ;(globalThis as any).__lastOrbitProps = props
      return ReactMod.createElement('div', { 'data-testid': 'orbit-controls' })
    }),
  }
})

// Import after mock — vitest hoists vi.mock but this keeps readability.
import { CameraRig } from '../CameraRig'

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function getMockControls(): any {
  return (globalThis as any).__mockControls
}
function getMockCamera(): THREE.PerspectiveCamera {
  return (globalThis as any).__mockCamera
}
function getMockTarget(): THREE.Vector3 {
  return (globalThis as any).__mockTarget
}
function getLastProps(): any {
  return (globalThis as any).__lastOrbitProps
}
function resetMock(): void {
  const fn = (globalThis as any).__resetMock as (() => void) | undefined
  if (fn) fn()
}
function getUpdateCount(): number {
  return (globalThis as any).__mockUpdateCount ?? 0
}

const activeUnmounts: Array<() => void> = []

function mountRig(): { container: HTMLDivElement; unmount: () => void } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(React.createElement(CameraRig))
  })
  const unmount = () => {
    try {
      act(() => root.unmount())
    } catch {}
    try {
      container.remove()
    } catch {}
    const idx = activeUnmounts.indexOf(unmount)
    if (idx >= 0) activeUnmounts.splice(idx, 1)
  }
  activeUnmounts.push(unmount)
  return {
    container,
    unmount,
  }
}

function cleanupAllMounts(): void {
  // called in beforeEach/afterEach to prevent leak doubling WASD moves
  const copy = [...activeUnmounts]
  copy.forEach((fn) => {
    try {
      fn()
    } catch {}
  })
  activeUnmounts.length = 0
  document.body.innerHTML = ''
}

function dispatchKey(key: string): { ev: KeyboardEvent; preventDefaultSpy: ReturnType<typeof vi.spyOn> } {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  const spy = vi.spyOn(ev, 'preventDefault')
  window.dispatchEvent(ev)
  return { ev, preventDefaultSpy: spy }
}

function installMatchMedia(matches = false): any {
  const listeners: Array<(e: any) => void> = []
  const mql: any = {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: vi.fn((type: string, cb: any) => listeners.push(cb)),
    removeEventListener: vi.fn((type: string, cb: any) => {
      const idx = listeners.indexOf(cb)
      if (idx >= 0) listeners.splice(idx, 1)
    }),
    // legacy
    addListener: vi.fn((cb: any) => listeners.push(cb)),
    removeListener: vi.fn((cb: any) => {
      const idx = listeners.indexOf(cb)
      if (idx >= 0) listeners.splice(idx, 1)
    }),
    _listeners: listeners,
    _dispatch: (newMatches: boolean) => {
      mql.matches = newMatches
      listeners.forEach((cb) => cb({ matches: newMatches }))
    },
  }
  window.matchMedia = vi.fn(() => mql) as unknown as typeof window.matchMedia
  return mql
}

// ---------------------------------------------------------------------------
// suite
// ---------------------------------------------------------------------------
describe('CameraRig FREE VIEW', () => {
  let mql: any

  beforeEach(() => {
    cleanupAllMounts()
    resetMock()
    mql = installMatchMedia(false)
    // reset activeElement to body
    if (document.activeElement && document.activeElement !== document.body) {
      ;(document.activeElement as HTMLElement).blur?.()
    }
  })

  afterEach(() => {
    cleanupAllMounts()
    vi.restoreAllMocks()
    // clean force-null flag
    ;(globalThis as any).__forceNullControls = false
    // if matchMedia was deleted, restore via install
    if (!window.matchMedia) installMatchMedia(false)
  })

  test('happy: renders without throwing and exposes OrbitControls', () => {
    const { unmount } = mountRig()
    expect(document.querySelector('[data-testid="orbit-controls"]')).not.toBeNull()
    expect(getLastProps()).toBeDefined()
    unmount()
  })

  test('happy: OrbitControls props — FREE VIEW (no limits, damping 0.05, pan/zoom/rotate enabled)', () => {
    const { unmount } = mountRig()
    const props = getLastProps()
    expect(props.enableDamping).toBe(true)
    expect(props.dampingFactor).toBe(0.05)
    expect(props.enablePan).toBe(true)
    expect(props.enableZoom).toBe(true)
    expect(props.enableRotate).toBe(true)
    // FREE VIEW must NOT set limits
    expect(props.minDistance).toBeUndefined()
    expect(props.maxDistance).toBeUndefined()
    expect(props.maxPolarAngle).toBeUndefined()
    expect(props.minPolarAngle).toBeUndefined()
    expect(props.autoRotate).toBeUndefined()
    unmount()
  })

  test('happy: registers prefers-reduced-motion listener and cleans up on unmount (addEventListener branch)', () => {
    const { unmount } = mountRig()
    expect(window.matchMedia).toHaveBeenCalled()
    expect(mql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    unmount()
    expect(mql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })

  test('happy: legacy addListener branch when addEventListener is not a function', () => {
    // prepare mql without addEventListener
    const listeners: any[] = []
    const legacyMql: any = {
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      // no addEventListener
      addListener: vi.fn((cb: any) => listeners.push(cb)),
      removeListener: vi.fn((cb: any) => {
        const i = listeners.indexOf(cb)
        if (i >= 0) listeners.splice(i, 1)
      }),
    }
    window.matchMedia = vi.fn(() => legacyMql) as unknown as typeof window.matchMedia
    const { unmount } = mountRig()
    expect(legacyMql.addListener).toHaveBeenCalledWith(expect.any(Function))
    unmount()
    expect(legacyMql.removeListener).toHaveBeenCalled()
  })

  test('happy: no throw when window.matchMedia is undefined', () => {
    // @ts-expect-error intentionally undefined for test - matchMedia may be missing in some environments
    window.matchMedia = undefined
    expect(() => {
      const { unmount } = mountRig()
      unmount()
    }).not.toThrow()
  })

  test('happy: W pans forward (negative Z when camera looks at origin from [0,30,50])', () => {
    const { unmount } = mountRig()
    const cam = getMockCamera()
    const target = getMockTarget()
    const beforePos = cam.position.clone()
    const beforeTarget = target.clone()
    const { preventDefaultSpy } = dispatchKey('w')
    expect(preventDefaultSpy).toHaveBeenCalled()
    // forward projected to horizontal plane is (0,0,-1), step 2 -> z-2
    expect(cam.position.z).toBeCloseTo(beforePos.z - 2, 5)
    expect(cam.position.x).toBeCloseTo(beforePos.x, 5)
    expect(target.z).toBeCloseTo(beforeTarget.z - 2, 5)
    expect(getUpdateCount()).toBe(1)
    unmount()
  })

  test('happy: s pans backward (opposite of w)', () => {
    const { unmount } = mountRig()
    const cam = getMockCamera()
    const target = getMockTarget()
    dispatchKey('s')
    expect(cam.position.z).toBeCloseTo(50 + 2, 5) // 50 +2
    expect(target.z).toBeCloseTo(2, 5)
    unmount()
  })

  test('happy: a pans left (negative right)', () => {
    const { unmount } = mountRig()
    const cam = getMockCamera()
    const target = getMockTarget()
    dispatchKey('a')
    // right is (1,0,0) so a = -right = (-1,0,0)*2 = -2 on X
    expect(cam.position.x).toBeCloseTo(-2, 5)
    expect(target.x).toBeCloseTo(-2, 5)
    unmount()
  })

  test('happy: d pans right (positive right)', () => {
    const { unmount } = mountRig()
    const cam = getMockCamera()
    dispatchKey('d')
    expect(cam.position.x).toBeCloseTo(2, 5)
    expect(getMockTarget().x).toBeCloseTo(2, 5)
    unmount()
  })

  test('happy: Arrow keys map to WASD', () => {
    const { unmount: u1 } = mountRig()
    dispatchKey('ArrowUp')
    expect(getMockCamera().position.z).toBeCloseTo(48, 5)
    u1()
    resetMock()
    installMatchMedia(false)
    const { unmount: u2 } = mountRig()
    dispatchKey('ArrowDown')
    expect(getMockCamera().position.z).toBeCloseTo(52, 5)
    u2()
    resetMock()
    installMatchMedia(false)
    const { unmount: u3 } = mountRig()
    dispatchKey('ArrowLeft')
    expect(getMockCamera().position.x).toBeCloseTo(-2, 5)
    u3()
    resetMock()
    installMatchMedia(false)
    const { unmount: u4 } = mountRig()
    dispatchKey('ArrowRight')
    expect(getMockCamera().position.x).toBeCloseTo(2, 5)
    u4()
  })

  test('happy: uppercase W also pans (case-insensitive)', () => {
    const { unmount } = mountRig()
    dispatchKey('W')
    expect(getMockCamera().position.z).toBeCloseTo(48, 5)
    unmount()
  })

  test('edge: non-pan key does not move and does not preventDefault', () => {
    const { unmount } = mountRig()
    const cam = getMockCamera()
    const before = cam.position.clone()
    const { preventDefaultSpy } = dispatchKey('q')
    expect(preventDefaultSpy).not.toHaveBeenCalled()
    expect(cam.position.equals(before)).toBe(true)
    expect(getUpdateCount()).toBe(0)
    unmount()
  })

  test('edge: input focused → pan ignored', () => {
    const { unmount } = mountRig()
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    expect(document.activeElement).toBe(input)
    const cam = getMockCamera()
    const before = cam.position.clone()
    dispatchKey('w')
    expect(cam.position.equals(before)).toBe(true)
    input.remove()
    unmount()
  })

  test('edge: textarea focused → pan ignored', () => {
    const { unmount } = mountRig()
    const ta = document.createElement('textarea')
    document.body.appendChild(ta)
    ta.focus()
    const before = getMockCamera().position.clone()
    dispatchKey('a')
    expect(getMockCamera().position.equals(before)).toBe(true)
    ta.remove()
    unmount()
  })

  test('edge: select focused → pan ignored', () => {
    const { unmount } = mountRig()
    const sel = document.createElement('select')
    document.body.appendChild(sel)
    sel.focus()
    const before = getMockCamera().position.clone()
    dispatchKey('d')
    expect(getMockCamera().position.equals(before)).toBe(true)
    sel.remove()
    unmount()
  })

  test('edge: contentEditable focused → pan ignored', () => {
    const { unmount } = mountRig()
    const div = document.createElement('div')
    div.contentEditable = 'true'
    document.body.appendChild(div)
    // jsdom focus on contentEditable div is unreliable (needs tabIndex), so stub activeElement
    const origDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'activeElement')
      ?? Object.getOwnPropertyDescriptor(Object.getPrototypeOf(document), 'activeElement')
    Object.defineProperty(document, 'activeElement', {
      get: () => div,
      configurable: true,
    })
    // ensure isContentEditable is true (jsdom may keep it false until connected)
    Object.defineProperty(div, 'isContentEditable', { value: true, configurable: true })
    const before = getMockCamera().position.clone()
    dispatchKey('w')
    expect(getMockCamera().position.equals(before)).toBe(true)
    // restore
    if (origDescriptor) {
      Object.defineProperty(document, 'activeElement', origDescriptor)
    } else {
      // fallback to body
      Object.defineProperty(document, 'activeElement', { get: () => document.body, configurable: true })
    }
    div.remove()
    unmount()
  })

  test('edge: looking straight down → forward fallback to world -Z (does not NaN)', () => {
    const { unmount } = mountRig()
    const cam = getMockCamera()
    const target = getMockTarget()
    // straight down: camera above origin looking down — triggers lengthSq < 1e-6 fallback to (0,0,-1)
    cam.position.set(0, 10, 0)
    target.set(0, 0, 0)
    cam.lookAt(0, 0, 0)
    cam.updateMatrixWorld(true)
    // sanity: direction is (0,-1,0)
    const dir = new THREE.Vector3()
    cam.getWorldDirection(dir)
    expect(dir.y).toBeCloseTo(-1, 5)
    dispatchKey('w')
    // fallback forward = (0,0,-1) -> moves -Z by PAN_STEP=2
    expect(cam.position.z).toBeCloseTo(-2, 5)
    expect(cam.position.x).toBeCloseTo(0, 5)
    expect(Number.isNaN(cam.position.x)).toBe(false)
    expect(Number.isNaN(cam.position.z)).toBe(false)
    unmount()
  })

  test('edge: controlsRef null → handler no-throw (early return)', () => {
    ;(globalThis as any).__forceNullControls = true
    const { unmount } = mountRig()
    expect(() => dispatchKey('w')).not.toThrow()
    // no move, no update, no preventDefault? Actually handler returns before preventDefault
    // In code, isPanKey check happens after null check? No, null check is first, so preventDefault not called.
    // But if force null, no crash is the assertion.
    expect(getUpdateCount()).toBe(0)
    unmount()
    ;(globalThis as any).__forceNullControls = false
  })

  test('edge: window keydown listener removed on unmount (no leak)', () => {
    const { unmount } = mountRig()
    const cam = getMockCamera()
    unmount()
    const before = cam.position.clone()
    dispatchKey('w')
    expect(cam.position.equals(before)).toBe(true)
    expect(getUpdateCount()).toBe(0)
  })

  test('edge: multiple WASD presses accumulate correctly', () => {
    const { unmount } = mountRig()
    dispatchKey('w')
    dispatchKey('w')
    dispatchKey('d')
    const cam = getMockCamera()
    expect(cam.position.z).toBeCloseTo(46, 5) // 50 -2 -2
    expect(cam.position.x).toBeCloseTo(2, 5)
    expect(getUpdateCount()).toBe(3)
    unmount()
  })
})
