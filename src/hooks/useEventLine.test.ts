import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'

vi.mock('@/lib/technocore/client', () => ({ fetchEvents: vi.fn() }))
vi.mock('@/lib/technocore/adapter', () => ({ parseEventLine: vi.fn() }))

import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import React from 'react'

import { fetchEvents } from '@/lib/technocore/client'
import { parseEventLine } from '@/lib/technocore/adapter'
import type { EventLine } from '@/lib/technocore/types'
import { useEventLine } from './useEventLine'

const fetchEventsMock = vi.mocked(fetchEvents)
const parseEventLineMock = vi.mocked(parseEventLine)

const makeEvents = (from: number, count: number): EventLine[] =>
  Array.from({ length: count }, (_, i) => ({
    type: 'room.created',
    roomName: `room-${from + i}`,
    ts: '2026-08-29T00:00:00.000Z',
  }))

interface ProbeSlot {
  events: EventLine[]
  lastSeq: number
}

let slot: ProbeSlot | null = null

function Probe(): null {
  const result = useEventLine()
  slot = { events: result.events, lastSeq: result.lastSeq }
  return null
}

let root: Root | null = null
let container: HTMLDivElement | null = null

async function unmountProbe(): Promise<void> {
  const current = root
  if (!current) return
  await act(async () => {
    current.unmount()
  })
  root = null
}

/** Advance fake time and drain the polling loop's microtasks inside act. */
async function drain(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe('useEventLine', () => {
  beforeEach(() => {
    fetchEventsMock.mockReset()
    parseEventLineMock.mockReset()
    // Defaults: no events yet; the loop keeps polling every 1000ms.
    parseEventLineMock.mockReturnValue([])
    fetchEventsMock.mockImplementation(async () => '')
    slot = null
    container = document.createElement('div')
    document.body.appendChild(container)
    vi.useFakeTimers()
    root = createRoot(container)
    act(() => {
      root!.render(React.createElement(Probe))
    })
  })

  afterEach(async () => {
    await unmountProbe()
    container?.remove()
    container = null
    vi.useRealTimers()
  })

  it('appends fetched events and tracks lastSeq', async () => {
    parseEventLineMock.mockReturnValueOnce(makeEvents(1, 3))
    await drain(1100)

    expect(slot?.events).toHaveLength(3)
    expect(slot?.events.map((e) => e.roomName)).toEqual(['room-1', 'room-2', 'room-3'])
    expect(slot?.lastSeq).toBe(3)
  })

  it('accumulates events FIFO across multiple fetch cycles', async () => {
    parseEventLineMock
      .mockReturnValueOnce(makeEvents(1, 2))
      .mockReturnValueOnce(makeEvents(3, 2))
    await drain(1100)

    expect(slot?.events).toHaveLength(4)
    expect(slot?.events.map((e) => e.roomName)).toEqual(['room-1', 'room-2', 'room-3', 'room-4'])
    expect(slot?.lastSeq).toBe(4)
  })

  it('caps the buffer at 200 events and drops the oldest', async () => {
    parseEventLineMock
      .mockReturnValueOnce(makeEvents(1, 80))
      .mockReturnValueOnce(makeEvents(81, 80))
      .mockReturnValueOnce(makeEvents(161, 80))
    await drain(1100)

    const names = slot?.events.map((e) => e.roomName) ?? []
    expect(slot?.events).toHaveLength(200)
    expect(slot?.lastSeq).toBe(240)
    expect(names[0]).toBe('room-41')
    expect(names).not.toContain('room-1')
    expect(names).toContain('room-240')
  })

  it('backs off 2s after an error before retrying', async () => {
    // The beforeEach probe already consumed fetchEvents #1 with the default
    // mock ('' -> no events -> 1000ms poll). Remount after configuring the
    // once-mocks so the reject is call #1 again from t=0.
    await unmountProbe()
    fetchEventsMock.mockClear()
    parseEventLineMock.mockReturnValueOnce(makeEvents(1, 2))
    fetchEventsMock.mockRejectedValueOnce(new Error('boom'))
    fetchEventsMock.mockImplementationOnce(async () => 'created room-1\ncreated room-2')
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => {
      root!.render(React.createElement(Probe))
    })

    // First fetch rejects; backoff timer is armed.
    await drain(100)
    expect(fetchEventsMock).toHaveBeenCalledTimes(1)

    // Still inside the 2s backoff window: no second fetch yet.
    await drain(1850)
    expect(fetchEventsMock).toHaveBeenCalledTimes(1)

    // Past the 2s window: retry succeeds and events are appended.
    // The successful fetch loops immediately for the next poll, so the exact
    // call count at this point depends on baseline polls — assert >= 2.
    await drain(500)
    expect(fetchEventsMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(slot?.events).toHaveLength(2)
    expect(slot?.lastSeq).toBe(2)
  })

  it('stops the polling loop after unmount', async () => {
    parseEventLineMock.mockReturnValueOnce(makeEvents(1, 1))
    await drain(1100)
    expect(fetchEventsMock.mock.calls.length).toBeGreaterThanOrEqual(2)

    await unmountProbe()
    const callsAfterUnmount = fetchEventsMock.mock.calls.length

    await drain(5000)
    expect(fetchEventsMock.mock.calls.length).toBe(callsAfterUnmount)
  })
})
