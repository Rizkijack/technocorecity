import { describe, expect, it, beforeEach, vi } from 'vitest'

vi.mock('@/lib/technocore/client', () => ({ fetchRooms: vi.fn() }))

import { parseRooms } from '@/lib/technocore/adapter'
import { fetchRooms } from '@/lib/technocore/client'
import { ParseError } from '@/lib/technocore/errors'
import { filterLoadableRooms, ROOMS_LIMIT } from '@/lib/technocore/intake'
import type { Room } from '@/lib/technocore/types'
import { useWorldStore } from '@/stores/world-store'

const fetchRoomsMock = vi.mocked(fetchRooms)

// The real fetchRooms is typed Promise<string>; the hook fetcher deliberately
// tolerates pre-parsed arrays and arbitrary objects for test mocks.
const resolveRoomsOnce = (payload: unknown): void => {
  fetchRoomsMock.mockResolvedValueOnce(payload as string)
}

// beta has 3 messages (< MIN_MESSAGES_FOR_LOADING) and must be dropped by the
// hook's intake filter; alpha (5) is the only loadable room.
const SAMPLE_ROOMS: Room[] = [
  { name: 'alpha', topic: 'Alpha topic', messageCount: 5, sizeBytes: 1229, idleSeconds: 0 },
  { name: 'beta', topic: 'Beta topic', messageCount: 3, sizeBytes: 640, idleSeconds: 120 },
]

const LOADABLE_ONLY = [SAMPLE_ROOMS[0]!]

const SAMPLE_TABLE = [
  '| /r/alpha | Alpha topic | 5 | 1.2k | 0s | read-write |',
  '| /r/beta | Beta topic | 3 | 640 | 2m | read-only |',
].join('\n')

// Mirror of the inline SWR fetcher in useRooms (branch-for-branch), so the
// coercion/parse/filter logic is exercised without SWR's network infrastructure.
async function fetcher(): Promise<Room[]> {
  const raw = (await fetchRooms(ROOMS_LIMIT)) as unknown
  let parsed: Room[]
  if (Array.isArray(raw)) parsed = raw as Room[]
  else if (typeof raw === 'string') parsed = parseRooms(raw)
  else parsed = parseRooms(String(raw))
  return filterLoadableRooms(parsed)
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
      searchQuery: '',
    })
  })

  it('requests ROOMS_LIMIT (200) from the client', async () => {
    resolveRoomsOnce(SAMPLE_TABLE)
    await fetcher()
    expect(fetchRoomsMock).toHaveBeenCalledWith(ROOMS_LIMIT)
  })

  it('filters a pre-parsed array down to loadable rooms', async () => {
    resolveRoomsOnce(SAMPLE_ROOMS)
    await expect(fetcher()).resolves.toEqual(LOADABLE_ONLY)
  })

  it('parses a raw table string via parseRooms, then filters', async () => {
    resolveRoomsOnce(SAMPLE_TABLE)
    await expect(fetcher()).resolves.toEqual(LOADABLE_ONLY)
  })

  it('coerces other values with String()', async () => {
    resolveRoomsOnce(Object.assign(Object.create({}), { toString: () => SAMPLE_TABLE }))
    await expect(fetcher()).resolves.toEqual(LOADABLE_ONLY)
  })

  it('drops rooms below MIN_MESSAGES_FOR_LOADING and keeps the rest', async () => {
    const mixed: Room[] = [
      ...LOADABLE_ONLY,
      { name: 'quiet', topic: '', messageCount: 4, sizeBytes: 10, idleSeconds: 1 },
      { name: 'busy', topic: '', messageCount: 1000, sizeBytes: 10, idleSeconds: 1 },
    ]
    resolveRoomsOnce(mixed)
    await expect(fetcher()).resolves.toEqual([
      LOADABLE_ONLY[0]!,
      { name: 'busy', topic: '', messageCount: 1000, sizeBytes: 10, idleSeconds: 1 },
    ])
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
      searchQuery: '',
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

  it('end-to-end: fetch → parse → filter → world store', async () => {
    resolveRoomsOnce(SAMPLE_TABLE)
    const data = await fetcher()
    useWorldStore.getState().setRooms(data)
    expect(data).toEqual(LOADABLE_ONLY)
    const state = useWorldStore.getState()
    expect(state.rooms.get('alpha')?.sizeBytes).toBe(1229)
    expect(state.rooms.get('beta')).toBeUndefined()
  })
})
