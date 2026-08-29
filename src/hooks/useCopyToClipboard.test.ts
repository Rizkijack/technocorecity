import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'

import { useCopyToClipboard } from './useCopyToClipboard'

// Named boundary types (strict mode: no inline casts).
interface ClipboardOverride {
  clipboard?: { writeText: unknown }
}

interface ProbeSlot {
  copy: (text: string) => Promise<boolean>
  isCopied: boolean
}

interface ProbeProps {
  slot: ProbeSlot
}

function Probe({ slot }: ProbeProps): null {
  const result = useCopyToClipboard()
  slot.copy = result.copy
  slot.isCopied = result.isCopied
  return null
}

describe('useCopyToClipboard', () => {
  const noopCopy = (): Promise<boolean> => Promise.resolve(false)
  let root: Root | null = null
  let container: HTMLDivElement | null = null
  let writeTextMock: ReturnType<typeof vi.fn>
  let execCommandMock: ReturnType<typeof vi.fn>

  function mountProbe(slot: ProbeSlot): void {
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
    vi.useFakeTimers()
    writeTextMock = vi.fn()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    })
    execCommandMock = vi.fn(() => true)
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommandMock,
    })
  })

  afterEach(() => {
    // Safety net: unmount a probe left mounted by a failed test.
    if (root !== null) unmountProbe()
    vi.useRealTimers()
    delete (navigator as ClipboardOverride).clipboard
    delete (document as unknown as { execCommand?: unknown }).execCommand
    vi.restoreAllMocks()
  })

  it('copies via the async clipboard API and reports success', async () => {
    const slot: ProbeSlot = { copy: noopCopy, isCopied: false }
    mountProbe(slot)
    writeTextMock.mockResolvedValue(undefined)

    let copied: boolean | undefined
    await act(async () => {
      copied = await slot.copy('hello world')
    })

    expect(copied).toBe(true)
    expect(writeTextMock).toHaveBeenCalledWith('hello world')
    expect(slot.isCopied).toBe(true)
  })

  it('resets isCopied to false after the 2s pulse', async () => {
    const slot: ProbeSlot = { copy: noopCopy, isCopied: false }
    mountProbe(slot)
    writeTextMock.mockResolvedValue(undefined)

    await act(async () => {
      await slot.copy('pulse')
    })
    expect(slot.isCopied).toBe(true)

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(slot.isCopied).toBe(false)
  })

  it('falls back to the textarea execCommand copy when the clipboard API rejects', async () => {
    const slot: ProbeSlot = { copy: noopCopy, isCopied: false }
    mountProbe(slot)
    writeTextMock.mockRejectedValue(new Error('clipboard denied'))

    let copied: boolean | undefined
    await act(async () => {
      copied = await slot.copy('fallback text')
    })

    expect(copied).toBe(true)
    expect(writeTextMock).toHaveBeenCalledWith('fallback text')
    expect(execCommandMock).toHaveBeenCalledWith('copy')
    expect(slot.isCopied).toBe(true)
  })

  it('returns false and keeps isCopied false when clipboard and execCommand both fail', async () => {
    const slot: ProbeSlot = { copy: noopCopy, isCopied: false }
    mountProbe(slot)
    writeTextMock.mockRejectedValue(new Error('clipboard denied'))
    execCommandMock.mockReturnValue(false)

    let copied: boolean | undefined
    await act(async () => {
      copied = await slot.copy('doomed')
    })

    expect(copied).toBe(false)
    expect(execCommandMock).toHaveBeenCalledWith('copy')
    expect(slot.isCopied).toBe(false)
  })

  it('clears the pending reset timer on unmount', async () => {
    const slot: ProbeSlot = { copy: noopCopy, isCopied: false }
    mountProbe(slot)
    writeTextMock.mockResolvedValue(undefined)

    await act(async () => {
      await slot.copy('timed')
    })
    expect(slot.isCopied).toBe(true)

    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    unmountProbe()
    expect(clearTimeoutSpy).toHaveBeenCalled()

    // Advancing past the pulse window after unmount must be a no-op.
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
  })
})
