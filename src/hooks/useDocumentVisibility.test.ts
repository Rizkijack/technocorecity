import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'

import { useDocumentVisibility } from './useDocumentVisibility'

// Named boundary types (strict mode: no inline casts).
interface VisibilityOverride {
  visibilityState?: DocumentVisibilityState
}

interface VisibilitySlot {
  visible: boolean
}

interface ProbeProps {
  slot: VisibilitySlot
}

function Probe({ slot }: ProbeProps): null {
  slot.visible = useDocumentVisibility()
  return null
}

describe('useDocumentVisibility', () => {
  let visibilityState: DocumentVisibilityState = 'visible'
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  function mountProbe(slot: VisibilitySlot): void {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => {
      root?.render(React.createElement(Probe, { slot }))
    })
  }

  function unmountProbe(): void {
    act(() => {
      root?.unmount()
    })
    container?.remove()
    root = null
    container = null
  }

  beforeEach(() => {
    visibilityState = 'visible'
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    })
  })

  afterEach(() => {
    // Safety net: unmount a probe left mounted by a failed test.
    if (root !== null) unmountProbe()
    delete (document as VisibilityOverride).visibilityState
    vi.restoreAllMocks()
  })

  it('returns true when the document is visible', () => {
    const slot: VisibilitySlot = { visible: false }
    mountProbe(slot)
    expect(slot.visible).toBe(true)
  })

  it('returns false when the document starts hidden', () => {
    visibilityState = 'hidden'
    const slot: VisibilitySlot = { visible: true }
    mountProbe(slot)
    expect(slot.visible).toBe(false)
  })

  it('turns false when a visibilitychange reports hidden', async () => {
    const slot: VisibilitySlot = { visible: false }
    mountProbe(slot)
    expect(slot.visible).toBe(true)

    await act(async () => {
      visibilityState = 'hidden'
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(slot.visible).toBe(false)
  })

  it('turns true again when a visibilitychange reports visible', async () => {
    const slot: VisibilitySlot = { visible: false }
    mountProbe(slot)

    await act(async () => {
      visibilityState = 'hidden'
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(slot.visible).toBe(false)

    await act(async () => {
      visibilityState = 'visible'
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(slot.visible).toBe(true)
  })

  it('registers exactly one visibilitychange listener while mounted', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const countVisibilityListeners = (): number => {
      const added = addSpy.mock.calls.filter(([event]) => event === 'visibilitychange').length
      const removed = removeSpy.mock.calls.filter(([event]) => event === 'visibilitychange').length
      return added - removed
    }

    const slot: VisibilitySlot = { visible: false }
    mountProbe(slot)
    expect(countVisibilityListeners()).toBe(1)

    unmountProbe()
    expect(countVisibilityListeners()).toBe(0)
  })

  it('removes its listener on unmount and ignores later events', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const slot: VisibilitySlot = { visible: false }
    mountProbe(slot)

    expect(addSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))

    unmountProbe()
    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))

    // Firing after unmount must not throw or change the captured state.
    visibilityState = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    expect(slot.visible).toBe(true)
  })

  it('does not double-register listeners across remounts', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const countVisibilityListeners = (): number => {
      const added = addSpy.mock.calls.filter(([event]) => event === 'visibilitychange').length
      const removed = removeSpy.mock.calls.filter(([event]) => event === 'visibilitychange').length
      return added - removed
    }

    const slot: VisibilitySlot = { visible: false }
    mountProbe(slot)
    unmountProbe()
    mountProbe(slot)
    expect(countVisibilityListeners()).toBe(1)

    unmountProbe()
    expect(countVisibilityListeners()).toBe(0)
  })
})
