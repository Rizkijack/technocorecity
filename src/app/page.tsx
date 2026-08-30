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
  const lastScannedKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (!rooms || rooms.length === 0) return
    const top = [...rooms]
      .sort((a, b) => b.messageCount - a.messageCount)
      .slice(0, TOP_ROOMS_FOR_AGENTS)
    // Dedupe: SWR may return a new array instance with same content on
    // revalidation (e.g. revalidateOnFocus). Skip rescan if top 12 are identical.
    const key = top.map((r) => `${r.name}:${r.messageCount}`).join('|')
    if (lastScannedKeyRef.current === key) return
    lastScannedKeyRef.current = key
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
            return { name: r.name, msgs: parseRoomMessages(text).messages } as const
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

  // Only block the 3D view while rooms are loading. Agent scanning is
  // non-critical and runs in background — show it as a tiny bottom bar
  // instead of a full-screen veil, otherwise buildings stay hidden behind
  // the veil for >60s while 12 rooms are fetched (user report: 1m scan).
  const veilVisible = isLoading
  const veilLabel = 'Loading rooms…'
  const veilProgress = roomsProgress

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
      {agentProgress ? (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full border border-bg-light bg-bg-mid px-4 py-2 text-xs text-text-secondary shadow-panel-elev">
          Scanning agents {agentProgress.loaded}/{agentProgress.total}…
        </div>
      ) : null}
      {error ? (
        <div
          className="pointer-events-auto fixed inset-x-0 bottom-4 z-40 flex justify-center px-4"
          data-testid="rooms-error"
        >
          <div className="max-w-xl rounded-md border border-red-500/40 bg-red-950/80 px-4 py-2 text-sm text-red-200">
            <div className="font-mono font-semibold">Failed to load rooms</div>
            <div className="mt-1 break-words font-mono text-xs text-red-300/90">
              {error.name}: {error.message}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
