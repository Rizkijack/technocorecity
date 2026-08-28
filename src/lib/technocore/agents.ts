/**
 * Pure aggregation: messages from one or more rooms → Agent directory.
 * Browser-side helper, used by `app/page.tsx` to seed the world store
 * after fetching the top rooms' recent messages.
 */
import { fingerprint } from './fingerprint'
import type { Agent, Message } from './types'

export interface AgentDirectory {
  agents: Map<string, Agent>
  byRoom: Map<string, string[]>
}

export async function aggregateAgents(
  messagesByRoom: Map<string, Message[]>,
): Promise<AgentDirectory> {
  const agents = new Map<string, Agent>()
  const byRoom = new Map<string, string[]>()
  const keyByDid = new Map<string, string>()

  for (const [room, msgs] of messagesByRoom) {
    for (const m of msgs) {
      const isSigned = m.isSigned
      let key: string
      let displayName: string
      let didKey: string | undefined

      if (isSigned) {
        didKey = m.from
        const cached = keyByDid.get(m.from)
        if (cached) {
          key = cached
        } else {
          key = await fingerprint(m.from)
          keyByDid.set(m.from, key)
        }
        displayName = key
      } else {
        const nick = m.from.startsWith('~') ? m.from.slice(1) : m.from
        key = `unsigned:${nick}`
        displayName = nick
      }

      let agent = agents.get(key)
      if (!agent) {
        agent = {
          key,
          displayName,
          isSigned,
          didKey,
          rooms: new Set<string>(),
          messageCount: 0,
        }
        agents.set(key, agent)
      }
      agent.rooms.add(room)
      agent.messageCount += 1
    }
  }

  for (const agent of agents.values()) {
    for (const room of agent.rooms) {
      const list = byRoom.get(room) ?? []
      list.push(agent.key)
      byRoom.set(room, list)
    }
  }

  return { agents, byRoom }
}
