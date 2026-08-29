import { describe, expect, it, beforeEach, vi } from 'vitest'

vi.mock('@/lib/technocore/client', () => ({ fetchRooms: vi.fn() }))

import { parseRooms } from '@/lib/technocore/adapter'
import { fetchRooms } from '@/lib/technocore/client'
import { ParseError } from '@/lib/technocore/errors'
import type { Room } from '@/lib/technocore/types'
import { useWorldStore } from '@/stores/world-store'

const fetchRoomsMock = vi.mocked(fetchRooms)

// The real fetchRooms is typed Promise<string>; the hook fetcher deliberately
// tolerates pre-parsed arrays and arbitrary objects for test mocks.
const resolveRoomsOnce = (payload: unknown): void => {
  fetchRoomsMock.mockResolvedValueOnce(payload as string)
}

const SAMPLE_ROOMS: Room[] = [
  { name: 'alpha', topic: 'Alpha topic', messageCount: 5, sizeBytes: 1229, idleSeconds: 0 },
  { name: 'beta', topic: 'Beta topic', messageCount: 3, sizeBytes: 640, idleSeconds: 120 },
]

const SAMPLE_TABLE = [
  '| /r/alpha | Alpha topic | 5 | 1.2k | 0s | read-write |',
  '| /r/beta | Beta topic | 3 | 640 | 2m | read-only |',
].join('\n')

// Mirror of the inline SWR fetcher in useRooms (branch-for-branch), so the
// coercion/parse logic is exercised without SWR's network infrastructure.
async function fetcher(): Promise<Room[]> {
  const raw = (await fetchRooms()) as unknown
  if (Array.isArray(raw)) return raw as Room[]
  if (typeof raw === 'string') return parseRooms(raw)
  return parseRooms(String(raw))
}

describe('useRooms fetcher', () => {
  beforeEach(() => {
    fetchRoomsMock.mockReset()
    useWorldStore.setState({
      rooms: new Map(),
      agents: new Map(),
      selectedRoomId: null,
      selectedAgentKey: null,
      selectedAgentScreenPos: null,
      lastUpdate: 0,
    })
  })

  it('passes a pre-parsed array through unchanged', async () => {
    resolveRoomsOnce(SAMPLE_ROOMS)
    await expect(fetcher()).resolves.toBe(SAMPLE_ROOMS)
  })

  it('parses a raw table string via parseRooms', async () => {
    resolveRoomsOnce(SAMPLE_TABLE)
    await expect(fetcher()).resolves.toEqual(SAMPLE_ROOMS)
  })

  it('coerces other values with String()', async () => {
    resolveRoomsOnce(Object.assign(Object.create({}), { toString: () => SAMPLE_TABLE }))
    await expect(fetcher()).resolves.toEqual(SAMPLE_ROOMS)
  })

  it('propagates ParseError for unparseable responses', async () => {
    resolveRoomsOnce('garbage')
    await expect(fetcher()).rejects.toBeInstanceOf(ParseError)
  })

  it('propagates network failures', async () => {
    fetchRoomsMock.mockRejectedValueOnce(new Error('network down'))
    await expect(fetcher()).rejects.toThrow('network down')
  })
})

describe('useRooms world-store mirror', () => {
  beforeEach(() => {
    useWorldStore.setState({
      rooms: new Map(),
      agents: new Map(),
      selectedRoomId: null,
      selectedAgentKey: null,
      selectedAgentScreenPos: null,
      lastUpdate: 0,
    })
  })

  it('mirrors fetched rooms into the world store', () => {
    useWorldStore.getState().setRooms(SAMPLE_ROOMS)
    const state = useWorldStore.getState()
    expect(state.rooms.size).toBe(2)
    expect(state.rooms.get('alpha')?.topic).toBe('Alpha topic')
    expect(state.lastUpdate).toBeGreaterThan(0)
  })

  it('replaces rather than merges on subsequent syncs', () => {
    const { setRooms } = useWorldStore.getState()
    setRooms(SAMPLE_ROOMS)
    setRooms(SAMPLE_ROOMS.slice(0, 1))
    const state = useWorldStore.getState()
    expect(state.rooms.size).toBe(1)
    expect(state.rooms.get('alpha')).not.toBeUndefined()
    expect(state.rooms.get('beta')).toBeUndefined()
  })

  it('end-to-end: fetch → parse → world store', async () => {
    resolveRoomsOnce(SAMPLE_TABLE)
    const data = await fetcher()
    useWorldStore.getState().setRooms(data)
    expect(data).toEqual(SAMPLE_ROOMS)
    const state = useWorldStore.getState()
    expect(state.rooms.get('alpha')?.sizeBytes).toBe(1229)
    expect(state.rooms.get('beta')?.idleSeconds).toBe(120)
  })
})
