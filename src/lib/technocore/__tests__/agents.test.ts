import { describe, test, expect } from 'vitest'
import { aggregateAgents } from '../agents'
import type { Message } from '../types'
import { fingerprint } from '../fingerprint'

function msg(overrides: Partial<Message> & { seq: number; from: string }): Message {
  return {
    seq: overrides.seq,
    from: overrides.from,
    isSigned: overrides.isSigned ?? false,
    text: overrides.text ?? 'hello',
    ts: overrides.ts ?? '',
  }
}

describe('aggregateAgents', () => {
  test('empty input → empty maps', async () => {
    const { agents, byRoom } = await aggregateAgents(new Map())
    expect(agents.size).toBe(0)
    expect(byRoom.size).toBe(0)
  })

  test('unsigned single message', async () => {
    const m = new Map<string, Message[]>([['lobby', [msg({ seq: 1, from: '~alice', isSigned: false })]]])
    const { agents, byRoom } = await aggregateAgents(m)
    expect(agents.size).toBe(1)
    const agent = agents.get('unsigned:alice')
    expect(agent).toBeDefined()
    expect(agent!.displayName).toBe('alice')
    expect(agent!.isSigned).toBe(false)
    expect(agent!.didKey).toBeUndefined()
    expect(agent!.key).toBe('unsigned:alice')
    expect(agent!.messageCount).toBe(1)
    expect(Array.from(agent!.rooms)).toEqual(['lobby'])
    expect(byRoom.get('lobby')).toEqual(['unsigned:alice'])
  })

  test('signed single message fingerprint', async () => {
    const did = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK'
    const expected = await fingerprint(did)
    const m = new Map<string, Message[]>([['lobby', [msg({ seq: 1, from: did, isSigned: true })]]])
    const { agents, byRoom } = await aggregateAgents(m)
    expect(agents.size).toBe(1)
    const agent = agents.get(expected)
    expect(agent).toBeDefined()
    expect(agent!.key).toBe(expected)
    expect(agent!.displayName).toBe(expected)
    expect(agent!.isSigned).toBe(true)
    expect(agent!.didKey).toBe(did)
    expect(agent!.messageCount).toBe(1)
    expect(agent!.rooms.has('lobby')).toBe(true)
    expect(byRoom.get('lobby')).toContain(expected)
  })

  test('signed memo: same didKey twice → same key, messageCount 2, rooms dedup', async () => {
    const did = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK'
    const fp = await fingerprint(did)
    const m = new Map<string, Message[]>([
      ['lobby', [msg({ seq: 1, from: did, isSigned: true }), msg({ seq: 2, from: did, isSigned: true })]],
    ])
    const { agents, byRoom } = await aggregateAgents(m)
    expect(agents.size).toBe(1)
    const a = agents.get(fp)!
    expect(a.messageCount).toBe(2)
    expect(a.rooms.size).toBe(1)
    expect(byRoom.get('lobby')!.length).toBe(1)
    expect(byRoom.get('lobby')![0]).toBe(fp)
  })

  test('signed memo caches fingerprint across rooms', async () => {
    const did = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK'
    const fp = await fingerprint(did)
    const m = new Map<string, Message[]>([
      ['lobby', [msg({ seq: 1, from: did, isSigned: true })]],
      ['meta', [msg({ seq: 1, from: did, isSigned: true })]],
    ])
    const { agents } = await aggregateAgents(m)
    expect(agents.size).toBe(1)
    expect(agents.get(fp)!.messageCount).toBe(2)
    expect(Array.from(agents.get(fp)!.rooms).sort()).toEqual(['lobby', 'meta'])
  })

  test('unsigned handling: from with ~ prefix stripped for key', async () => {
    const m = new Map<string, Message[]>([
      ['lobby', [msg({ seq: 1, from: '~bob', isSigned: false })]],
    ])
    const { agents } = await aggregateAgents(m)
    expect(agents.has('unsigned:bob')).toBe(true)
    // raw nick without ~ also normalized
    const m2 = new Map<string, Message[]>([
      ['lobby', [msg({ seq: 1, from: 'bob', isSigned: false })]],
    ])
    const { agents: a2 } = await aggregateAgents(m2)
    expect(a2.has('unsigned:bob')).toBe(true)
    expect(a2.get('unsigned:bob')!.displayName).toBe('bob')
  })

  test('unsigned multi-room dedup', async () => {
    // Map with duplicate key 'lobby' last wins, so need single map with both messages in separate rooms via different structure
    const combined = new Map<string, Message[]>([
      ['lobby', [msg({ seq: 1, from: '~alice', isSigned: false }), msg({ seq: 3, from: '~alice', isSigned: false })]],
      ['meta', [msg({ seq: 2, from: '~alice', isSigned: false })]],
    ])
    const { agents, byRoom } = await aggregateAgents(combined)
    expect(agents.size).toBe(1)
    const a = agents.get('unsigned:alice')!
    expect(a.messageCount).toBe(3)
    expect(Array.from(a.rooms).sort()).toEqual(['lobby', 'meta'])
    expect(byRoom.get('lobby')).toContain('unsigned:alice')
    expect(byRoom.get('meta')).toContain('unsigned:alice')
  })

  test('multi agent multi room byRoom mapping', async () => {
    const did1 = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK'
    const did2 = 'did:key:z6MkTestDifferentKey1234567890'
    const fp1 = await fingerprint(did1)
    const fp2 = await fingerprint(did2)
    const m = new Map<string, Message[]>([
      ['lobby', [msg({ seq: 1, from: did1, isSigned: true }), msg({ seq: 2, from: '~bob', isSigned: false })]],
      ['meta', [msg({ seq: 1, from: did2, isSigned: true }), msg({ seq: 2, from: '~bob', isSigned: false })]],
    ])
    const { agents, byRoom } = await aggregateAgents(m)
    expect(agents.size).toBe(3) // fp1, fp2, unsigned:bob
    expect(agents.get(fp1)!.rooms.has('lobby')).toBe(true)
    expect(agents.get(fp2)!.rooms.has('meta')).toBe(true)
    const bob = agents.get('unsigned:bob')!
    expect(bob.messageCount).toBe(2)
    expect(Array.from(bob.rooms).sort()).toEqual(['lobby', 'meta'])
    expect(byRoom.get('lobby')!.sort()).toEqual([fp1, 'unsigned:bob'].sort())
    expect(byRoom.get('meta')!.sort()).toEqual([fp2, 'unsigned:bob'].sort())
  })

  test('byRoom lists are per room and do not duplicate agent keys', async () => {
    const m = new Map<string, Message[]>([
      ['lobby', [msg({ seq: 1, from: '~alice', isSigned: false }), msg({ seq: 2, from: '~alice', isSigned: false })]],
    ])
    const { byRoom } = await aggregateAgents(m)
    // same agent appears twice in same room but byRoom should list once
    expect(byRoom.get('lobby')).toEqual(['unsigned:alice'])
  })

  test('signed and unsigned same nick are distinct keys', async () => {
    const did = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK'
    const fp = await fingerprint(did)
    const m = new Map<string, Message[]>([
      ['lobby', [msg({ seq: 1, from: did, isSigned: true }), msg({ seq: 2, from: '~alice', isSigned: false })]],
    ])
    const { agents } = await aggregateAgents(m)
    expect(agents.has(fp)).toBe(true)
    expect(agents.has('unsigned:alice')).toBe(true)
    expect(agents.size).toBe(2)
  })

  test('rooms Set per agent is independent', async () => {
    const m = new Map<string, Message[]>([
      ['lobby', [msg({ seq: 1, from: '~charlie', isSigned: false })]],
    ])
    const { agents } = await aggregateAgents(m)
    const a = agents.get('unsigned:charlie')!
    a.rooms.add('injected')
    const { agents: a2 } = await aggregateAgents(m)
    expect(a2.get('unsigned:charlie')!.rooms.has('injected')).toBe(false)
  })
})
