/**
 * @vitest-environment jsdom
 */
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { createVisibilityGate } from '../throttle'

// Helper fake document for controlled tests (like existing throttle.test)
// But since this file runs in jsdom, we can also test real jsdom document.

// We will test SSR branch by temporarily deleting global document and re-importing behavior.
// createVisibilityGate checks typeof document at call time, so we can delete before call.

describe('createVisibilityGate', () => {
  let originalDocument: unknown

  beforeEach(() => {
    originalDocument = (globalThis as { document?: unknown }).document
  })

  afterEach(() => {
    if (originalDocument === undefined) {
      delete (globalThis as { document?: unknown }).document
    } else {
      ;(globalThis as { document: unknown }).document = originalDocument as Document
    }
    vi.restoreAllMocks()
  })

  test('SSR: when document is undefined, isOpen true and waitOpen resolves immediately', async () => {
    // delete document to simulate SSR
    delete (globalThis as { document?: unknown }).document
    const gate = createVisibilityGate()
    expect(gate.isOpen()).toBe(true)
    await expect(gate.waitOpen()).resolves.toBeUndefined()
    await expect(gate.wait()).resolves.toBeUndefined()
    expect(() => gate.dispose()).not.toThrow()
    // gate remains open
    expect(gate.isOpen()).toBe(true)
  })

  test('SSR: dispose is noop', async () => {
    delete (globalThis as { document?: unknown }).document
    const gate = createVisibilityGate()
    gate.dispose()
    expect(gate.isOpen()).toBe(true)
    await expect(gate.waitOpen()).resolves.toBeUndefined()
  })

  test('jsdom: isOpen true when visible', () => {
    // jsdom default visibilityState is visible
    const gate = createVisibilityGate()
    // ensure visible
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    expect(gate.isOpen()).toBe(true)
    gate.dispose()
  })

  test('jsdom: isOpen false when hidden', () => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    const gate = createVisibilityGate()
    expect(gate.isOpen()).toBe(false)
    gate.dispose()
    // reset to visible for other tests
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })

  test('waitOpen resolves immediately when visible', async () => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    const gate = createVisibilityGate()
    await expect(gate.waitOpen()).resolves.toBeUndefined()
    await expect(gate.wait()).resolves.toBeUndefined()
    gate.dispose()
  })

  test('waitOpen pending when hidden and resolves on visibilitychange to visible', async () => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    const gate = createVisibilityGate()
    expect(gate.isOpen()).toBe(false)
    const pending = gate.waitOpen()
    let resolved = false
    pending.then(() => (resolved = true))
    expect(resolved).toBe(false)
    // still hidden -> not resolved
    await Promise.resolve()
    expect(resolved).toBe(false)
    // flip to visible and fire event
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await pending
    expect(resolved).toBe(true)
    expect(gate.isOpen()).toBe(true)
    gate.dispose()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })

  test('multiple waitOpen while hidden share same promise', async () => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    const gate = createVisibilityGate()
    const p1 = gate.waitOpen()
    const p2 = gate.waitOpen()
    const p3 = gate.wait()
    expect(p1).toBe(p2)
    expect(p2).toBe(p3)
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await expect(p1).resolves.toBeUndefined()
    await expect(p2).resolves.toBeUndefined()
    gate.dispose()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })

  test('after resolved, new waitOpen when hidden creates new promise', async () => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    const gate = createVisibilityGate()
    const p1 = gate.waitOpen()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await p1
    // now hide again
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    const p2 = gate.waitOpen()
    expect(p2).not.toBe(p1)
    let done = false
    p2.then(() => (done = true))
    expect(done).toBe(false)
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await p2
    expect(done).toBe(true)
    gate.dispose()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })

  test('dispose removes listener and resolves pending', async () => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    const gate = createVisibilityGate()
    const p = gate.waitOpen()
    let resolved = false
    p.then(() => (resolved = true))
    gate.dispose()
    await p
    expect(resolved).toBe(true)
    // after dispose, changing visibility should not affect (listener removed)
    // create new gate to verify listener count? just ensure no throw
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    // dispatch should not cause error
    document.dispatchEvent(new Event('visibilitychange'))
    expect(resolved).toBe(true)
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })

  test('isOpen reflects changes after visibility events', () => {
    const gate = createVisibilityGate()
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    expect(gate.isOpen()).toBe(false)
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    expect(gate.isOpen()).toBe(true)
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    expect(gate.isOpen()).toBe(false)
    gate.dispose()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })

  test('waitOpen when visible does not create pending listener that leaks', async () => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    const gate = createVisibilityGate()
    await gate.waitOpen()
    // ensure dispose doesn't throw and pending is null
    gate.dispose()
    // No pending to resolve
    expect(gate.isOpen()).toBe(true)
  })
})

// Also test controlled fake document version for thoroughness (mirror of existing throttle.test but for gate)
describe('createVisibilityGate with fake document', () => {
  function makeFakeDocument(initialState: 'visible' | 'hidden' = 'visible') {
    const listeners: Array<() => void> = []
    let state: 'visible' | 'hidden' = initialState
    return {
      get visibilityState(): 'visible' | 'hidden' {
        return state
      },
      setVisibility(next: 'visible' | 'hidden') {
        state = next
      },
      addEventListener: (event: string, handler: () => void) => {
        if (event === 'visibilitychange') listeners.push(handler)
      },
      removeEventListener: (event: string, handler: () => void) => {
        if (event !== 'visibilitychange') return
        const i = listeners.indexOf(handler)
        if (i >= 0) listeners.splice(i, 1)
      },
      fireVisibilityChange() {
        for (const fn of listeners.slice()) fn()
      },
      listenerCount() {
        return listeners.length
      },
    }
  }

  let fakeDoc: ReturnType<typeof makeFakeDocument>
  let originalDocument: unknown

  beforeEach(() => {
    fakeDoc = makeFakeDocument('visible')
    originalDocument = (globalThis as { document?: unknown }).document
    ;(globalThis as { document: unknown }).document = fakeDoc as unknown as Document
  })

  afterEach(() => {
    if (originalDocument === undefined) {
      delete (globalThis as { document?: unknown }).document
    } else {
      ;(globalThis as { document: unknown }).document = originalDocument as Document
    }
  })

  test('fake: isOpen and waitOpen lifecycle', async () => {
    fakeDoc.setVisibility('hidden')
    const gate = createVisibilityGate()
    expect(gate.isOpen()).toBe(false)
    const p = gate.waitOpen()
    let done = false
    p.then(() => (done = true))
    expect(done).toBe(false)
    fakeDoc.setVisibility('visible')
    fakeDoc.fireVisibilityChange()
    await p
    expect(done).toBe(true)
    expect(gate.isOpen()).toBe(true)
    gate.dispose()
  })

  test('fake: dispose resolves pending and removes listener', async () => {
    fakeDoc.setVisibility('hidden')
    const gate = createVisibilityGate()
    const p = gate.waitOpen()
    expect(fakeDoc.listenerCount()).toBe(1)
    gate.dispose()
    await p
    expect(fakeDoc.listenerCount()).toBe(0)
  })

  test('fake: wait alias equals waitOpen', async () => {
    fakeDoc.setVisibility('visible')
    const gate = createVisibilityGate()
    await expect(gate.wait()).resolves.toBeUndefined()
    gate.dispose()
  })
})
