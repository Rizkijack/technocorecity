'use client'

import { useEffect, useMemo, useRef } from 'react'
import useSWR from 'swr'

import { fetchRoom, longPollRoom } from '@/lib/technocore/client'
import { parseRoomMessages } from '@/lib/technocore/adapter'
import { RateLimitError } from '@/lib/technocore/errors'
import type { Message } from '@/lib/technocore/types'
import { useUiStore } from '@/stores/ui-store'
import { createVisibilityGate } from '@/lib/utils/throttle'

const BACKOFF_MS = 2000

let lastShownAt = 0

export interface UseRoomMessagesResult {
  messages: Message[]
  isLoading: boolean
  error: Error | undefined
  lastSeq: number
}

function toMessages(raw: unknown): Message[] {
  if (Array.isArray(raw)) return raw as Message[]
  if (typeof raw === 'string') return parseRoomMessages(raw)
  return parseRoomMessages(String(raw ?? ''))
}

/**
 * SWR + long-poll for a single room.
 * - If room === null → disabled SWR, returns empty.
 * - Initial fetcher: fetchRoom(room)
 * - After mount, starts long-poll loop via longPollRoom(room, lastSeq, signal)
 *   with wait=10, pause when hidden via createVisibilityGate, abort on unmount/room change, backoff 2s on error.
 */
export function useRoomMessages(room: string | null): UseRoomMessagesResult {
  const swrKey = useMemo(() => (room ? (['room', room] as const) : null), [room])

  const { data, error, isLoading, mutate } = useSWR<Message[], Error>(
    swrKey,
    async () => {
      if (!room) return []
      try {
        const raw = await fetchRoom(room)
        return toMessages(raw)
      } catch (err) {
        if (err instanceof RateLimitError) {
          const now = Date.now()
          if (now - lastShownAt > (err.retryAfter ?? 1) * 1000) {
            lastShownAt = now
            useUiStore
              .getState()
              .showError('Server busy — retrying in...', 'warning', err.retryAfter)
          }
        }
        throw err
      }
    },
    {
      dedupingInterval: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      keepPreviousData: true,
      refreshInterval: 0,
    },
  )

  const messages = useMemo(() => data ?? [], [data])
  const lastSeq = useMemo(() => {
    if (messages.length === 0) return 0
    return messages[messages.length - 1]!.seq
  }, [messages])

  // Keep mutable seq for poll loop without restarting effect on every new message
  const seqRef = useRef<number>(lastSeq)
  useEffect(() => {
    seqRef.current = lastSeq
  }, [lastSeq])

  useEffect(() => {
    if (!room) return
    if (isLoading) return

    let active = true
    const controller = new AbortController()
    const gate = createVisibilityGate()

    const sleep = (ms: number): Promise<void> =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, ms)
        controller.signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timer)
            resolve()
          },
          { once: true },
        )
      })

    const loop = async (): Promise<void> => {
      while (active && !controller.signal.aborted) {
        if (!gate.isOpen()) {
          await gate.waitOpen()
          if (!active || controller.signal.aborted) return
        }

        try {
          const raw = await longPollRoom(room, seqRef.current, controller.signal)
          if (!active || controller.signal.aborted) return

          const next = toMessages(raw)
          if (next.length > 0) {
            seqRef.current = next[next.length - 1]!.seq
            await mutate(
              (prev) => {
                const prevArr = prev ?? []
                const seen = new Set(prevArr.map((m) => m.seq))
                const merged = [...prevArr]
                for (const m of next) {
                  if (!seen.has(m.seq)) {
                    merged.push(m)
                    seen.add(m.seq)
                  }
                }
                merged.sort((a, b) => a.seq - b.seq)
                return merged
              },
              { revalidate: false },
            )
          }
        } catch (err) {
          if (!active || controller.signal.aborted) return
          if (err instanceof Error && err.name === 'AbortError') return
          if (err instanceof RateLimitError) {
            const now = Date.now()
            if (now - lastShownAt > (err.retryAfter ?? 1) * 1000) {
              lastShownAt = now
              useUiStore
                .getState()
                .showError('Server busy — retrying in...', 'warning', err.retryAfter)
            }
          }
          await sleep(BACKOFF_MS)
        }
      }
    }

    void loop()

    return () => {
      active = false
      controller.abort()
      gate.dispose()
    }
  }, [room, isLoading, mutate])

  if (room === null) {
    return { messages: [], isLoading: false, error: undefined, lastSeq: 0 }
  }

  return {
    messages,
    isLoading,
    error: error as Error | undefined,
    lastSeq,
  }
}

export default useRoomMessages
