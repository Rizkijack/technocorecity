'use client'

import { useEffect, useRef, useState } from 'react'

import { parseEventLine } from '@/lib/technocore/adapter'
import type { EventLine } from '@/lib/technocore/types'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'https://technocore.chat'
const POLL_INTERVAL_MS = 1000
const ERROR_BACKOFF_MS = 2000
const EVENT_CAP = 200

export interface UseEventLineResult {
  events: EventLine[]
  lastSeq: number
}

function toEvents(raw: unknown): EventLine[] {
  if (Array.isArray(raw)) return raw as EventLine[]
  if (typeof raw === 'string') return parseEventLine(raw)
  return parseEventLine(String(raw ?? ''))
}

async function fetchEvents(since: number, signal: AbortSignal): Promise<string> {
  const url = `${API_BASE}/r/events?since=${since}&wait=10`
  const res = await fetch(url, {
    signal,
    cache: 'no-store',
    headers: { accept: 'text/plain' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  return res.text()
}

/**
 * Long-poll /r/events via fetchEvents, continuous loop, return {events, lastSeq}.
 * Simple for P1.
 */
export function useEventLine(): UseEventLineResult {
  const [events, setEvents] = useState<EventLine[]>([])
  const [lastSeq, setLastSeq] = useState(0)
  const lastSeqRef = useRef(0)
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false
    const controller = new AbortController()

    const delay = (ms: number): Promise<void> =>
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
      while (!cancelledRef.current && !controller.signal.aborted) {
        let received = false
        try {
          const raw = await fetchEvents(lastSeqRef.current, controller.signal)
          if (cancelledRef.current || controller.signal.aborted) return
          const next = toEvents(raw)
          if (next.length > 0) {
            received = true
            setEvents((prev) => {
              const merged = prev.concat(next)
              if (merged.length <= EVENT_CAP) return merged
              return merged.slice(merged.length - EVENT_CAP)
            })
            const nextSeq = lastSeqRef.current + next.length
            lastSeqRef.current = nextSeq
            setLastSeq(nextSeq)
          }
        } catch (err) {
          if (cancelledRef.current || controller.signal.aborted) return
          if (err instanceof Error && err.name === 'AbortError') return
          await delay(ERROR_BACKOFF_MS)
          continue
        }

        if (!received) {
          await delay(POLL_INTERVAL_MS)
        }
      }
    }

    void loop()

    return () => {
      cancelledRef.current = true
      controller.abort()
    }
  }, [])

  return { events, lastSeq }
}

export default useEventLine
