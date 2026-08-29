import { describe, test, expect, beforeEach } from 'vitest'
import { useWorldStore } from '../world-store'
import type { Agent, Room } from '@/lib/technocore/types'

function makeRoom(name: string, overrides: Partial<Room> = {}): Room {
  return { name, topic: `topic ${name}`, messageCount: 0, sizeBytes: 0, idleSeconds: 0, ...overrides }
}
function makeAgent(key: string, rooms: string[] = [], count = 0, overrides: Partial<Agent> = {}): Agent {
  return { key, displayName: `display-${key}`, isSigned: false, rooms: new Set(rooms), messageCount: count, ...overrides }
}

describe('world-store (stores/__tests__)', () => {
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

  test('setRooms replaces and updates lastUpdate', () => {
    useWorldStore.getState().setRooms([makeRoom('a'), makeRoom('b', { messageCount: 3 })])
    const s = useWorldStore.getState()
    expect(s.rooms.size).toBe(2)
    expect(s.rooms.get('a')?.topic).toBe('topic a')
    expect(s.lastUpdate).toBeGreaterThan(0)
  })

  test('upsertAgent unions rooms and sums count', () => {
    useWorldStore.getState().upsertAgent(makeAgent('k1', ['r1'], 2))
    useWorldStore.getState().upsertAgent(makeAgent('k1', ['r2'], 3))
    const a = useWorldStore.getState().agents.get('k1')!
    expect(a.messageCount).toBe(5)
    expect(Array.from(a.rooms).sort()).toEqual(['r1', 'r2'])
  })

  test('selectRoom clears agent selection', () => {
    useWorldStore.getState().selectAgent('agent', { x: 1, y: 2 })
    useWorldStore.getState().selectRoom('lobby')
    const s = useWorldStore.getState()
    expect(s.selectedRoomId).toBe('lobby')
    expect(s.selectedAgentKey).toBeNull()
    expect(s.selectedAgentScreenPos).toBeNull()
  })

  test('selectAgent clears room and records pos', () => {
    useWorldStore.setState({ selectedRoomId: 'lobby' })
    useWorldStore.getState().selectAgent('agent-x', { x: 5, y: 6 })
    const s = useWorldStore.getState()
    expect(s.selectedAgentKey).toBe('agent-x')
    expect(s.selectedAgentScreenPos).toEqual({ x: 5, y: 6 })
    expect(s.selectedRoomId).toBeNull()
  })

  test('selectAgent null clears pos even if provided', () => {
    useWorldStore.getState().selectAgent(null, { x: 999, y: 999 })
    const s = useWorldStore.getState()
    expect(s.selectedAgentKey).toBeNull()
    expect(s.selectedAgentScreenPos).toBeNull()
  })

  test('clearSelection resets all', () => {
    useWorldStore.setState({ selectedRoomId: 'r', selectedAgentKey: 'a', selectedAgentScreenPos: { x: 1, y: 1 } })
    useWorldStore.getState().clearSelection()
    const s = useWorldStore.getState()
    expect(s.selectedRoomId).toBeNull()
    expect(s.selectedAgentKey).toBeNull()
    expect(s.selectedAgentScreenPos).toBeNull()
  })
})
