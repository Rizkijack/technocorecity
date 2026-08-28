import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'

import { visibilityThrottle } from './throttle'

// Test in a controllable fake-document environment (vitest.config sets node env
// globally, so we build a minimal document with only the surface the throttle
// touches: visibilityState getter + addEventListener/removeEventListener/
// dispatchEvent for 'visibilitychange').
function makeFakeDocument(initialState: 'visible' | 'hidden' = 'visible') {
  const listeners: Array<() => void> = []
  let state: 'visible' | 'hidden' = initialState
  return {
    get visibilityState(): 'visible' | 'hidden' {
      return state
    },
    setVisibility(next: 'visible' | 'hidden'): void {
      state = next
    },
    addEventListener: (event: string, handler: () => void): void => {
      if (event === 'visibilitychange') listeners.push(handler)
    },
    removeEventListener: (event: string, handler: () => void): void => {
      if (event !== 'visibilitychange') return
      const i = listeners.indexOf(handler)
      if (i >= 0) listeners.splice(i, 1)
    },
    fireVisibilityChange(): void {
      for (const fn of listeners.slice()) fn()
    },
    listenerCount(): number {
      return listeners.length
    },
  }
}

describe('visibilityThrottle', () => {
  let fakeDoc: ReturnType<typeof makeFakeDocument>
  let originalDocument: unknown

  beforeEach(() => {
    fakeDoc = makeFakeDocument('visible')
    originalDocument = (globalThis as { document?: unknown }).document
    ;(globalThis as { document: unknown }).document = fakeDoc
  })

  afterEach(() => {
    if (originalDocument === undefined) {
      delete (globalThis as { document?: unknown }).document
    } else {
      ;(globalThis as { document: unknown }).document = originalDocument
    }
  })

  it('registers exactly one visibility listener even with many calls while hidden', () => {
    const fn = vi.fn()
    const throttled = visibilityThrottle(fn, 1000)

    fakeDoc.setVisibility('hidden')
    // 10 calls while hidden should add at most 1 visibilitychange listener.
    for (let i = 0; i < 10; i++) throttled()
    expect(fakeDoc.listenerCount()).toBe(1)

    // Returning to visible fires the queued call exactly once.
    fakeDoc.setVisibility('visible')
    fakeDoc.fireVisibilityChange()

    expect(fn).toHaveBeenCalledTimes(1)
    // Listener is removed after firing, so the throttle is ready for next cycle.
    expect(fakeDoc.listenerCount()).toBe(0)
  })

  it('flushes only the most recent queued call when becoming visible', () => {
    const fn = vi.fn()
    const throttled = visibilityThrottle(fn, 1000)

    fakeDoc.setVisibility('hidden')
    throttled('first')
    throttled('second')
    throttled('third')

    fakeDoc.setVisibility('visible')
    fakeDoc.fireVisibilityChange()

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('third')
  })
})
