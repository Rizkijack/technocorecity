import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { Agent, Room } from '@/lib/technocore/types'

export interface WorldState {
  rooms: Map<string, Room>
  agents: Map<string, Agent>
  selectedRoomId: string | null
  selectedAgentKey: string | null
  selectedAgentScreenPos: { x: number; y: number } | null
  lastUpdate: number
  newlyCreatedAt: Map<string, number>
}

export interface WorldActions {
  setRooms: (rooms: Room[]) => void
  upsertAgent: (agent: Agent) => void
  mergeAgents: (agents: Agent[]) => void
  selectRoom: (id: string | null) => void
  selectAgent: (
    key: string | null,
    screenPos?: { x: number; y: number },
  ) => void
  clearSelection: () => void
  markRoomNew: (name: string) => void
}

export type WorldStore = WorldState & WorldActions

export const useWorldStore = create<WorldStore>()(
  subscribeWithSelector((set) => ({
    rooms: new Map(),
    agents: new Map(),
    selectedRoomId: null,
    selectedAgentKey: null,
    selectedAgentScreenPos: null,
    lastUpdate: 0,
    newlyCreatedAt: new Map(),

    setRooms: (rooms) =>
      set(() => {
        const next = new Map<string, Room>()
        for (const room of rooms) {
          next.set(room.name, room)
        }
        return { rooms: next, lastUpdate: Date.now() }
      }),

    upsertAgent: (agent) =>
      set((state) => {
        const next = new Map(state.agents)
        const existing = next.get(agent.key)
        if (existing) {
          const mergedRooms = new Set(existing.rooms)
          for (const room of agent.rooms) {
            mergedRooms.add(room)
          }
          next.set(agent.key, {
            ...existing,
            ...agent,
            rooms: mergedRooms,
            messageCount: existing.messageCount + agent.messageCount,
          })
        } else {
          next.set(agent.key, {
            ...agent,
            rooms: new Set(agent.rooms),
          })
        }
        return { agents: next }
      }),

    mergeAgents: (agents) =>
      set((state) => {
        if (agents.length === 0) {
          return state
        }
        const next = new Map(state.agents)
        for (const incoming of agents) {
          const existing = next.get(incoming.key)
          if (existing) {
            const mergedRooms = new Set(existing.rooms)
            for (const room of incoming.rooms) {
              mergedRooms.add(room)
            }
            next.set(incoming.key, {
              ...existing,
              ...incoming,
              rooms: mergedRooms,
              messageCount: existing.messageCount + incoming.messageCount,
            })
          } else {
            next.set(incoming.key, {
              ...incoming,
              rooms: new Set(incoming.rooms),
            })
          }
        }
        return { agents: next }
      }),

    selectRoom: (id) =>
      set(() => ({
        selectedRoomId: id,
        selectedAgentKey: null,
        selectedAgentScreenPos: null,
      })),

    selectAgent: (key, screenPos) =>
      set(() => ({
        selectedAgentKey: key,
        selectedAgentScreenPos: key === null ? null : screenPos ?? null,
        selectedRoomId: null,
      })),

    clearSelection: () =>
      set(() => ({
        selectedRoomId: null,
        selectedAgentKey: null,
        selectedAgentScreenPos: null,
      })),

    markRoomNew: (name) =>
      set((state) => {
        const next = new Map(state.newlyCreatedAt)
        next.set(name, Date.now())
        return { newlyCreatedAt: next }
      }),
  })),
)
