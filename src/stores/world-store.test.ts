import { describe, expect, it, beforeEach } from 'vitest'

import { useWorldStore } from './world-store'
import type { Agent, Room } from '@/lib/technocore/types'

// Inline fixture builders — kept local so this test stays self-contained.
function makeRoom(name: string, overrides: Partial<Room> = {}): Room {
  return {
    name,
    topic: `topic for ${name}`,
    messageCount: 0,
    sizeBytes: 0,
    idleSeconds: 0,
    ...overrides,
  }
}

function makeAgent(
  key: string,
  rooms: string[] = [],
  messageCount = 0,
  overrides: Partial<Agent> = {},
): Agent {
  return {
    key,
    displayName: `display-${key}`,
    isSigned: false,
    rooms: new Set(rooms),
    messageCount,
    ...overrides,
  }
}

describe('useWorldStore', () => {
  beforeEach(() => {
    // Reset to a known starting state before each test.
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

  describe('setRooms', () => {
    it('replaces existing rooms entirely (does not merge)', () => {
      useWorldStore.setState({
        rooms: new Map([
          ['old-1', makeRoom('old-1')],
          ['old-2', makeRoom('old-2')],
        ]),
        lastUpdate: 100,
      })

      const incoming = [makeRoom('new-1'), makeRoom('new-2', { messageCount: 5 })]
      useWorldStore.getState().setRooms(incoming)

      const state = useWorldStore.getState()
      expect(state.rooms).toBeInstanceOf(Map)
      expect(state.rooms.size).toBe(2)
      expect(state.rooms.has('old-1')).toBe(false)
      expect(state.rooms.has('old-2')).toBe(false)
      expect(state.rooms.get('new-1')?.messageCount).toBe(0)
      expect(state.rooms.get('new-2')?.messageCount).toBe(5)
    })

    it('updates lastUpdate to a recent timestamp', () => {
      const before = useWorldStore.getState().lastUpdate
      useWorldStore.getState().setRooms([makeRoom('r1')])
      const after = useWorldStore.getState().lastUpdate
      expect(after).toBeGreaterThanOrEqual(before)
      // Date.now() value should be a meaningful epoch ms, not the 0 baseline.
      expect(after).toBeGreaterThan(0)
    })

    it('clears rooms when called with an empty list', () => {
      useWorldStore.setState({
        rooms: new Map([['keep', makeRoom('keep')]]),
      })
      useWorldStore.getState().setRooms([])
      expect(useWorldStore.getState().rooms.size).toBe(0)
    })
  })

  describe('upsertAgent', () => {
    it('adds a new agent with rooms as a Set and preserves messageCount', () => {
      const agent = makeAgent('alpha', ['lobby', 'general'], 7)

      useWorldStore.getState().upsertAgent(agent)

      const stored = useWorldStore.getState().agents.get('alpha')
      expect(stored).toBeDefined()
      expect(stored?.rooms).toBeInstanceOf(Set)
      expect(stored?.rooms instanceof Set).toBe(true)
      expect(Array.from(stored!.rooms)).toEqual(['lobby', 'general'])
      expect(stored?.messageCount).toBe(7)
      expect(stored?.displayName).toBe('display-alpha')
    })

    it('copies the rooms set on insert so external mutation does not leak', () => {
      const sourceRooms = new Set(['lobby'])
      const agent: Agent = {
        key: 'beta',
        displayName: 'display-beta',
        isSigned: true,
        rooms: sourceRooms,
        messageCount: 1,
      }

      useWorldStore.getState().upsertAgent(agent)

      const stored = useWorldStore.getState().agents.get('beta')!
      sourceRooms.add('injected')
      expect(stored.rooms.has('injected')).toBe(false)
    })

    it('unions rooms and sums messageCount on existing key', () => {
      const existing = makeAgent('gamma', ['a', 'b'], 3)
      useWorldStore.getState().upsertAgent(existing)

      const incoming = makeAgent('gamma', ['b', 'c'], 5, { isSigned: true })
      useWorldStore.getState().upsertAgent(incoming)

      const stored = useWorldStore.getState().agents.get('gamma')
      expect(stored).toBeDefined()
      expect(stored?.rooms).toBeInstanceOf(Set)
      // 'b' must appear exactly once (deduped union), 'a' and 'c' retained.
      expect(Array.from(stored!.rooms).sort()).toEqual(['a', 'b', 'c'])
      expect(stored?.rooms.size).toBe(3)
      expect(stored?.messageCount).toBe(8) // 3 + 5
      expect(stored?.isSigned).toBe(true) // incoming overrides
    })

    it('does not mutate the prior agent rooms set when merging', () => {
      const priorRooms = new Set(['a'])
      const prior: Agent = {
        key: 'delta',
        displayName: 'display-delta',
        isSigned: false,
        rooms: priorRooms,
        messageCount: 1,
      }
      useWorldStore.getState().upsertAgent(prior)

      useWorldStore.getState().upsertAgent(makeAgent('delta', ['b'], 2))

      // The pre-existing Set instance must remain exactly { 'a' }.
      expect(Array.from(priorRooms)).toEqual(['a'])
    })
  })

  describe('mergeAgents', () => {
    it('is a no-op for an empty batch and returns the same state object', () => {
      useWorldStore.setState({
        agents: new Map([['keep', makeAgent('keep', ['x'], 4)]]),
        lastUpdate: 1234,
      })

      const beforeState = useWorldStore.getState()
      useWorldStore.getState().mergeAgents([])
      const afterState = useWorldStore.getState()

      expect(afterState).toBe(beforeState)
      expect(afterState.agents.size).toBe(1)
      expect(afterState.agents.get('keep')?.messageCount).toBe(4)
      expect(afterState.lastUpdate).toBe(1234)
    })

    it('inserts new agents in a single batch with Set semantics', () => {
      useWorldStore.getState().mergeAgents([
        makeAgent('a', ['room-1'], 2),
        makeAgent('b', ['room-1', 'room-2'], 5),
      ])

      const agents = useWorldStore.getState().agents
      expect(agents.size).toBe(2)
      expect(agents.get('a')?.rooms).toBeInstanceOf(Set)
      expect(agents.get('b')?.rooms).toBeInstanceOf(Set)
      expect(agents.get('b')?.messageCount).toBe(5)
    })

    it('merges into existing keys within the batch: unions rooms, sums messageCount', () => {
      // Seed one existing agent.
      useWorldStore.getState().upsertAgent(makeAgent('shared', ['r1'], 2))

      // Batch inserts a new 'fresh' and merges into 'shared' twice (idempotency
      // check: union of [r1,r2] and [r2,r3] = {r1,r2,r3}, count = 2+3+4=9).
      useWorldStore.getState().mergeAgents([
        makeAgent('fresh', ['only'], 1),
        makeAgent('shared', ['r1', 'r2'], 3),
        makeAgent('shared', ['r2', 'r3'], 4),
      ])

      const agents = useWorldStore.getState().agents
      expect(agents.size).toBe(2)
      const shared = agents.get('shared')!
      expect(shared.rooms).toBeInstanceOf(Set)
      expect(Array.from(shared.rooms).sort()).toEqual(['r1', 'r2', 'r3'])
      expect(shared.rooms.size).toBe(3)
      expect(shared.messageCount).toBe(9) // 2 + 3 + 4
      expect(agents.get('fresh')?.messageCount).toBe(1)
    })
  })

  describe('selectRoom', () => {
    it('sets selectedRoomId and clears any agent selection', () => {
      useWorldStore.setState({
        selectedRoomId: null,
        selectedAgentKey: 'some-agent',
        selectedAgentScreenPos: { x: 10, y: 20 },
      })

      useWorldStore.getState().selectRoom('lobby')

      const state = useWorldStore.getState()
      expect(state.selectedRoomId).toBe('lobby')
      expect(state.selectedAgentKey).toBeNull()
      expect(state.selectedAgentScreenPos).toBeNull()
    })

    it('accepts null to clear the room selection without touching other state', () => {
      useWorldStore.setState({
        selectedRoomId: 'lobby',
        selectedAgentKey: 'agent-1',
        selectedAgentScreenPos: { x: 1, y: 2 },
      })

      useWorldStore.getState().selectRoom(null)

      const state = useWorldStore.getState()
      expect(state.selectedRoomId).toBeNull()
      // selectRoom always clears agent fields, even when id is null.
      expect(state.selectedAgentKey).toBeNull()
      expect(state.selectedAgentScreenPos).toBeNull()
    })
  })

  describe('selectAgent', () => {
    it('sets selectedAgentKey and clears room selection', () => {
      useWorldStore.setState({ selectedRoomId: 'some-room' })

      useWorldStore.getState().selectAgent('agent-x')

      const state = useWorldStore.getState()
      expect(state.selectedAgentKey).toBe('agent-x')
      expect(state.selectedRoomId).toBeNull()
    })

    it('defaults screenPos to null when key is non-null and screenPos is undefined', () => {
      useWorldStore.getState().selectAgent('agent-y')

      const state = useWorldStore.getState()
      expect(state.selectedAgentKey).toBe('agent-y')
      expect(state.selectedAgentScreenPos).toBeNull()
    })

    it('records screenPos when provided with a non-null key', () => {
      useWorldStore.getState().selectAgent('agent-z', { x: 100, y: 200 })

      const state = useWorldStore.getState()
      expect(state.selectedAgentKey).toBe('agent-z')
      expect(state.selectedAgentScreenPos).toEqual({ x: 100, y: 200 })
    })

    it('clears screenPos when key is null regardless of screenPos argument', () => {
      useWorldStore.setState({
        selectedAgentKey: 'preexisting',
        selectedAgentScreenPos: { x: 5, y: 5 },
      })

      // Even if a caller passes a screenPos, a null key forces it back to null.
      useWorldStore.getState().selectAgent(null, { x: 999, y: 999 })

      const state = useWorldStore.getState()
      expect(state.selectedAgentKey).toBeNull()
      expect(state.selectedAgentScreenPos).toBeNull()
      expect(state.selectedRoomId).toBeNull()
    })
  })

  describe('clearSelection', () => {
    it('resets all three selection fields in a single call', () => {
      useWorldStore.setState({
        selectedRoomId: 'some-room',
        selectedAgentKey: 'some-agent',
        selectedAgentScreenPos: { x: 42, y: 24 },
      })

      useWorldStore.getState().clearSelection()

      const state = useWorldStore.getState()
      expect(state.selectedRoomId).toBeNull()
      expect(state.selectedAgentKey).toBeNull()
      expect(state.selectedAgentScreenPos).toBeNull()
    })

    it('is idempotent on an already-clear store', () => {
      useWorldStore.getState().clearSelection()
      const before = useWorldStore.getState()
      useWorldStore.getState().clearSelection()
      const after = useWorldStore.getState()

      expect(after.selectedRoomId).toBeNull()
      expect(after.selectedAgentKey).toBeNull()
      expect(after.selectedAgentScreenPos).toBeNull()
      // Non-selection state is untouched.
      expect(after.rooms).toBe(before.rooms)
      expect(after.agents).toBe(before.agents)
    })
  })

  describe('searchQuery', () => {
    it('defaults to an empty string', () => {
      expect(useWorldStore.getState().searchQuery).toBe('')
    })

    it('setSearchQuery stores the raw query string', () => {
      useWorldStore.getState().setSearchQuery('lobby')
      expect(useWorldStore.getState().searchQuery).toBe('lobby')
      useWorldStore.getState().setSearchQuery('')
      expect(useWorldStore.getState().searchQuery).toBe('')
    })

    it('updating the query leaves rooms untouched', () => {
      useWorldStore.getState().setRooms([makeRoom('a', { messageCount: 9 })])
      useWorldStore.getState().setSearchQuery('zzz')
      const state = useWorldStore.getState()
      expect(state.rooms.size).toBe(1)
      expect(state.rooms.get('a')?.messageCount).toBe(9)
    })
  })
})
