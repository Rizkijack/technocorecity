import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import type { Mock } from 'vitest'
import { act } from 'react-dom/test-utils'
import { createRoot } from 'react-dom/client'
import React from 'react'

import { useAgentDirectory } from './useAgentDirectory'
import type { Agent, Message } from '@/lib/technocore/types'

vi.mock('@/lib/technocore/fingerprint', () => ({
  fingerprint: vi.fn(async (did: string) => did.slice(0, 16)),
}))

// Hidden behind vi.mock above; the typed alias below exposes the mock surface.
import { fingerprint } from '@/lib/technocore/fingerprint'

type FingerprintFn = (did: string) => Promise<string>
type FingerprintMock = Mock<FingerprintFn>
const fingerprintMock = fingerprint as unknown as FingerprintMock

// DIDs must differ in their first 16 chars so fingerprint mock keys never collide.
const didA = 'did:key:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const didB = 'did:key:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'
const didShare = 'did:key:SHAREDDDDDDDDDDDDDDDDDDDDDDDD'
const didOther = 'did:key:DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD'

type MessagesInput = Map<string, Message[]> | Message[]

function makeMessage(from: string, isSigned: boolean, seq: number): Message {
  return { from, isSigned, seq, text: `m${seq}`, ts: '' }
}

interface DirectorySlot {
  agents: Map<string, Agent>
  byRoom: Map<string, string[]>
}

interface ProbeProps {
  input?: MessagesInput
  roomName?: string
  slot: { current: DirectorySlot | null }
}

function Probe({ input, roomName, slot }: ProbeProps) {
  const directory = useAgentDirectory(input, roomName)
  slot.current = directory
  return null
}

interface MountedProbe {
  slot: { current: DirectorySlot | null }
  render: (input?: MessagesInput, roomName?: string) => void
  unmount: () => void
}

function mountProbe(input?: MessagesInput, roomName?: string): MountedProbe {
  const slot: { current: DirectorySlot | null } = { current: null }
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  const render = (nextInput?: MessagesInput, nextRoom?: string): void => {
    act(() => {
      root.render(
        React.createElement(Probe, { input: nextInput, roomName: nextRoom, slot }),
      )
    })
  }

  const unmount = (): void => {
    act(() => root.unmount())
    container.remove()
  }

  render(input, roomName)
  return { slot, render, unmount }
}

async function flushEffect(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('useAgentDirectory', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    fingerprintMock.mockReset()
    fingerprintMock.mockImplementation(async (did: string) => did.slice(0, 16))
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('returns empty directory when called without arguments', async () => {
    const probe = mountProbe()
    await flushEffect()

    const { agents, byRoom } = probe.slot.current!
    expect(agents.size).toBe(0)
    expect(byRoom.size).toBe(0)
    expect(fingerprintMock).not.toHaveBeenCalled()

    probe.unmount()
  })

  it('builds signed agents keyed by fingerprint with merged counts and rooms', async () => {
    const messages = new Map<string, Message[]>([
      ['lobby', [makeMessage(didA, true, 1), makeMessage(didB, true, 2), makeMessage(didA, true, 3)]],
    ])
    const probe = mountProbe(messages)
    await flushEffect()

    const { agents, byRoom } = probe.slot.current!
    expect(agents.size).toBe(2)
    expect(fingerprintMock.mock.calls.length).toBe(2)

    const agentA = agents.get(didA.slice(0, 16))
    expect(agentA).toBeDefined()
    expect(agentA!.isSigned).toBe(true)
    expect(agentA!.didKey).toBe(didA)
    expect(agentA!.displayName).toBe(didA.slice(0, 16))
    expect(agentA!.messageCount).toBe(2)
    expect([...agentA!.rooms]).toEqual(['lobby'])

    const byLobby = byRoom.get('lobby')
    expect(byLobby).toHaveLength(2)
    expect(byLobby).toEqual([didA.slice(0, 16), didB.slice(0, 16)])

    probe.unmount()
  })

  it('groups array input under "unknown" room when roomName is omitted', async () => {
    const messages = [makeMessage('~alice', false, 1), makeMessage(didA, true, 2)]
    const probe = mountProbe(messages)
    await flushEffect()

    const { byRoom } = probe.slot.current!
    expect(byRoom.get('unknown')).toEqual(['unsigned:alice', didA.slice(0, 16)])
    expect(byRoom.has('unknown')).toBe(true)

    probe.unmount()
  })

  it('groups array input under the provided roomName', async () => {
    const messages = [makeMessage('~alice', false, 1), makeMessage(didA, true, 2)]
    const probe = mountProbe(messages, 'engineering')
    await flushEffect()

    const { byRoom } = probe.slot.current!
    expect(byRoom.get('engineering')).toEqual(['unsigned:alice', didA.slice(0, 16)])
    expect(byRoom.has('unknown')).toBe(false)

    probe.unmount()
  })

  it('derives unsigned agents from nick with tilde stripped and never fingerprints', async () => {
    const messages = [
      makeMessage('~alice', false, 1),
      makeMessage('~bob', false, 2),
      makeMessage('charlie', false, 3),
    ]
    const probe = mountProbe(messages)
    await flushEffect()

    const { agents, byRoom } = probe.slot.current!
    expect(agents.size).toBe(3)

    for (const nick of ['alice', 'bob', 'charlie']) {
      const agent = agents.get(`unsigned:${nick}`)
      expect(agent).toBeDefined()
      expect(agent!.isSigned).toBe(false)
      expect(agent!.didKey).toBeUndefined()
      expect(agent!.displayName).toBe(nick)
    }

    expect(byRoom.get('unknown')).toEqual([
      'unsigned:alice',
      'unsigned:bob',
      'unsigned:charlie',
    ])
    expect(fingerprintMock).not.toHaveBeenCalled()

    probe.unmount()
  })

  it('merges the same signed DID across rooms into one agent', async () => {
    const messages = new Map<string, Message[]>([
      ['lobby', [makeMessage(didShare, true, 1), makeMessage(didOther, true, 2)]],
      ['engineering', [makeMessage(didShare, true, 3)]],
    ])
    const probe = mountProbe(messages)
    await flushEffect()

    const { agents, byRoom } = probe.slot.current!
    expect(agents.size).toBe(2)

    const shared = agents.get(didShare.slice(0, 16))
    expect(shared).toBeDefined()
    expect(shared!.isSigned).toBe(true)
    expect(shared!.didKey).toBe(didShare)
    expect(shared!.messageCount).toBe(2)
    expect([...shared!.rooms].sort()).toEqual(['engineering', 'lobby'])

    expect(byRoom.get('engineering')).toEqual([didShare.slice(0, 16)])
    expect(byRoom.get('lobby')).toEqual([didShare.slice(0, 16), didOther.slice(0, 16)])
    expect(fingerprintMock.mock.calls.length).toBe(2)

    probe.unmount()
  })

  it('merges unsigned agents with the same nick across rooms', async () => {
    const messages = new Map<string, Message[]>([
      ['lobby', [makeMessage('~alice', false, 1)]],
      ['engineering', [makeMessage('~alice', false, 2)]],
    ])
    const probe = mountProbe(messages)
    await flushEffect()

    const { agents, byRoom } = probe.slot.current!
    expect(agents.size).toBe(1)

    const alice = agents.get('unsigned:alice')
    expect(alice).toBeDefined()
    expect(alice!.isSigned).toBe(false)
    expect(alice!.messageCount).toBe(2)
    expect([...alice!.rooms].sort()).toEqual(['engineering', 'lobby'])

    expect(byRoom.get('lobby')).toEqual(['unsigned:alice'])
    expect(byRoom.get('engineering')).toEqual(['unsigned:alice'])

    probe.unmount()
  })

  it('fingerprints each unique DID exactly once despite repeated messages', async () => {
    const messages = new Map<string, Message[]>([
      ['lobby', [makeMessage(didA, true, 1), makeMessage(didB, true, 2), makeMessage(didA, true, 3)]],
      ['engineering', [makeMessage(didB, true, 4), makeMessage(didA, true, 5), makeMessage(didB, true, 6)]],
    ])
    const probe = mountProbe(messages)
    await flushEffect()

    const { agents } = probe.slot.current!
    expect(agents.size).toBe(2)
    expect(fingerprintMock.mock.calls.length).toBe(2)
    expect(fingerprintMock).toHaveBeenCalledWith(didA)
    expect(fingerprintMock).toHaveBeenCalledWith(didB)

    probe.unmount()
  })

  it('does not update state after unmount when fingerprint resolves late', async () => {
    let resolveFp: ((value: string) => void) | undefined
    fingerprintMock.mockReset()
    fingerprintMock.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveFp = resolve
        }),
    )

    const messages = new Map<string, Message[]>([['lobby', [makeMessage(didA, true, 1)]]])
    const probe = mountProbe(messages)
    await flushEffect()

    // Computation is still pending: only the initial empty directory was rendered.
    const staleAgents = probe.slot.current!.agents
    expect(staleAgents.size).toBe(0)
    expect(resolveFp).toBeDefined()

    probe.unmount()

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await act(async () => {
      resolveFp!(didA.slice(0, 16))
    })
    await flushEffect()
    errorSpy.mockRestore()

    // Cancelled flag gated setState: same initial maps reference, no error raised.
    expect(probe.slot.current!.agents).toBe(staleAgents)
    expect(probe.slot.current!.agents.size).toBe(0)
  })

  it('recomputes directory when the input changes', async () => {
    const mapA = new Map<string, Message[]>([['lobby', [makeMessage(didA, true, 1)]]])
    const mapB = new Map<string, Message[]>([['lobby', [makeMessage(didB, true, 1)]]])
    const probe = mountProbe(mapA)
    await flushEffect()

    expect(probe.slot.current!.agents.has(didA.slice(0, 16))).toBe(true)

    probe.render(mapB)
    await flushEffect()

    const { agents } = probe.slot.current!
    expect(agents.has(didB.slice(0, 16))).toBe(true)
    expect(agents.has(didA.slice(0, 16))).toBe(false)
    expect(fingerprintMock.mock.calls.length).toBe(2)

    probe.unmount()
  })
})
