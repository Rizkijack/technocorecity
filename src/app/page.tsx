'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'

import { AgentPopover } from '@/components/ui/AgentPopover'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Hud } from '@/components/ui/Hud'
import { Legend } from '@/components/ui/Legend'
import { MobileNotice } from '@/components/ui/MobileNotice'
import { LoadingVeil } from '@/components/ui/LoadingVeil'
import { RoomPanel } from '@/components/ui/RoomPanel'
import { Toast } from '@/components/ui/Toast'
import { useEventLine } from '@/hooks/useEventLine'
import { useRooms } from '@/hooks/useRooms'
import { parseRoomMessages } from '@/lib/technocore/adapter'
import { aggregateAgents } from '@/lib/technocore/agents'
import { fetchRoom } from '@/lib/technocore/client'
import type { Message } from '@/lib/technocore/types'
import { useUiStore } from '@/stores/ui-store'
import { useWorldStore } from '@/stores/world-store'

// World contains the entire R3F canvas — load only on the client.
const World = dynamic(
  () => import('@/components/three/World').then((m) => m.World),
  {
    ssr: false,
    loading: () => <LoadingVeil isVisible />,
  },
)

const TOP_ROOMS_FOR_AGENTS = 12

export default function Page() {
  const {
    rooms,
    isLoading,
    error,
    phase: _phase,
    progress: roomsProgress,
  } = useRooms()
  const mergeAgents = useWorldStore((s) => s.mergeAgents)
  const [agentProgress, setAgentProgress] = useState<
    { loaded: number; total: number } | null
  >(null)

  // F-101: feed `created <room>` events into the world (scale-in tween) and
  // the UI (bottom-left toast). Toast is debounced to ≤1 per 5s; markRoomNew
  // always fires so concurrent new rooms still animate in.
  const { events } = useEventLine()
  const lastToastAtRef = useRef(0)
  const processedEventsRef = useRef(0)
  useEffect(() => {
    if (events.length <= processedEventsRef.current) return
    const fresh = events.slice(processedEventsRef.current)
    processedEventsRef.current = events.length
    for (const event of fresh) {
      useWorldStore.getState().markRoomNew(event.roomName)
      if (Date.now() - lastToastAtRef.current > 5000) {
        lastToastAtRef.current = Date.now()
        useUiStore.getState().showToast(`New room: ${event.roomName}`)
      }
    }
  }, [events])

  // Background: derive an agent directory from the busiest rooms' recent
  // messages. Without this, <World> sees an empty agents Map and renders
  // no points.
  useEffect(() => {
    if (!rooms || rooms.length === 0) return
    const top = [...rooms]
      .sort((a, b) => b.messageCount - a.messageCount)
      .slice(0, TOP_ROOMS_FOR_AGENTS)
    let cancelled = false
    let loaded = 0
    setAgentProgress({ loaded: 0, total: top.length })

    const controller = new AbortController()
    void (async () => {
      const messagesByRoom = new Map<string, Message[]>()
      const results = await Promise.allSettled(
        top.map(async (r) => {
          if (cancelled || controller.signal.aborted) return
          try {
            const text = await fetchRoom(r.name, undefined, controller.signal)
            return { name: r.name, msgs: parseRoomMessages(text) } as const
          } finally {
            loaded += 1
            if (!cancelled) setAgentProgress({ loaded, total: top.length })
          }
        }),
      )
      for (const res of results) {
        if (res.status === 'fulfilled' && res.value) {
          messagesByRoom.set(res.value.name, res.value.msgs)
        }
      }
      if (cancelled) return
      try {
        const { agents } = await aggregateAgents(messagesByRoom)
        if (cancelled) return
        mergeAgents(Array.from(agents.values()))
      } catch {
        // non-critical — buildings still render
      }
      if (!cancelled) setAgentProgress(null)
    })()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [rooms, mergeAgents])

  const veilVisible = isLoading || agentProgress !== null
  const veilLabel = isLoading
    ? 'Loading rooms…'
    : agentProgress
      ? `Loading ${agentProgress.loaded} of ${agentProgress.total} rooms…`
      : ''
  const veilProgress = isLoading ? roomsProgress : agentProgress ?? undefined

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-bg-deep">
      <World />
      <Hud />
      <Legend />
      <MobileNotice />
      <RoomPanel />
      <AgentPopover />
      <ErrorBanner />
      <Toast />
      {veilVisible ? (
        <LoadingVeil isVisible label={veilLabel} progress={veilProgress} />
      ) : null}
      {error ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="rounded-md border border-red-500/40 bg-red-950/80 px-4 py-2 text-sm text-red-200">
            Failed to load rooms. Retrying…
          </div>
        </div>
      ) : null}
    </main>
  )
}
