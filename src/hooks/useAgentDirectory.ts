'use client'

import { useEffect, useState } from 'react'

import { fingerprint } from '@/lib/technocore/fingerprint'
import type { Agent, Message } from '@/lib/technocore/types'

export interface AgentDirectoryResult {
  agents: Map<string, Agent>
  byRoom: Map<string, string[]>
}

type MessagesInput = Map<string, Message[]> | Message[]

function isMapInput(v: unknown): v is Map<string, Message[]> {
  return v instanceof Map
}

/**
 * Derive agent directory from messages.
 *
 * Supports multiple call signatures for compatibility:
 * - useAgentDirectory(messagesByRoom: Map<string, Message[]>)  // spec / docs
 * - useAgentDirectory(messages: Message[], roomName: string)   // MVP simplified per task
 * - useAgentDirectory()                                         // no args → empty
 *
 * Deterministic:
 * - signed: key = await fingerprint(didKey) (16 hex)
 * - unsigned: key = "unsigned:" + nick (nick stripped of leading ~)
 * Uses async fingerprint with per-DID memoization and Promise.all.
 */
export function useAgentDirectory(
  messagesOrMap?: MessagesInput,
  roomName?: string,
): AgentDirectoryResult {
  const [directory, setDirectory] = useState<AgentDirectoryResult>(() => ({
    agents: new Map<string, Agent>(),
    byRoom: new Map<string, string[]>(),
  }))

  useEffect(() => {
    let cancelled = false

    async function compute(): Promise<AgentDirectoryResult> {
      // Normalize input to Map<string, Message[]>
      let messagesByRoom: Map<string, Message[]>

      if (!messagesOrMap) {
        return { agents: new Map(), byRoom: new Map() }
      }

      if (Array.isArray(messagesOrMap)) {
        const name = roomName ?? 'unknown'
        messagesByRoom = new Map<string, Message[]>([[name, messagesOrMap]])
      } else if (isMapInput(messagesOrMap)) {
        messagesByRoom = messagesOrMap
      } else {
        return { agents: new Map(), byRoom: new Map() }
      }

      const agents = new Map<string, Agent>()
      const byRoom = new Map<string, string[]>()

      // Memoize fingerprint per DID
      const keyByDid = new Map<string, string>()

      // Collect unique signed DIDs first to batch fingerprint via Promise.all for determinism + speed
      const signedDids = new Set<string>()
      for (const [, msgs] of messagesByRoom) {
        for (const m of msgs) {
          if (m.isSigned) signedDids.add(m.from)
        }
      }

      // Resolve all fingerprints in parallel deterministically
      await Promise.all(
        Array.from(signedDids).map(async (did) => {
          const fp = await fingerprint(did)
          keyByDid.set(did, fp)
        }),
      )

      for (const [room, msgs] of messagesByRoom) {
        for (const m of msgs) {
          if (!m.isSigned) {
            const nick = m.from.startsWith('~') ? m.from.slice(1) : m.from
            const key = `unsigned:${nick}`
            const displayName = nick
            upsertAgent(agents, byRoom, key, displayName, false, undefined, room)
          } else {
            const didKey = m.from
            // fingerprint already resolved; fallback to sync compute if missing (should not happen)
            const key = keyByDid.get(didKey) ?? didKey.slice(0, 16)
            // displayName per spec is 16 hex fingerprint; keep didKey for reference
            const displayName = key
            upsertAgent(agents, byRoom, key, displayName, true, didKey, room)
          }
        }
      }

      return { agents, byRoom }
    }

    void (async () => {
      const next = await compute()
      if (!cancelled) setDirectory(next)
    })()

    return () => {
      cancelled = true
    }
    // Use JSON-like dep: messagesOrMap reference changes trigger recompute.
    // For Map, caller should provide stable reference or we stringify size as fallback.
  }, [messagesOrMap, roomName])

  return directory
}

function upsertAgent(
  agents: Map<string, Agent>,
  byRoom: Map<string, string[]>,
  key: string,
  displayName: string,
  isSigned: boolean,
  didKey: string | undefined,
  room: string,
): void {
  const existing = agents.get(key)
  if (existing) {
    existing.rooms.add(room)
    existing.messageCount += 1
  } else {
    agents.set(key, {
      key,
      displayName,
      isSigned,
      didKey,
      rooms: new Set<string>([room]),
      messageCount: 1,
    })
  }

  const roomKeys = byRoom.get(room)
  if (roomKeys) {
    if (!roomKeys.includes(key)) roomKeys.push(key)
  } else {
    byRoom.set(room, [key])
  }
}

export default useAgentDirectory
