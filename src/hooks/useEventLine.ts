'use client'

import { useEffect, useRef, useState } from 'react'

import { parseEventLine } from '@/lib/technocore/adapter'
import { fetchEvents } from '@/lib/technocore/client'
import { RateLimitError } from '@/lib/technocore/errors'
import type { EventLine } from '@/lib/technocore/types'
import { useUiStore } from '@/stores/ui-store'

const POLL_INTERVAL_MS = 5000
const ERROR_BACKOFF_MS = 5000
const EVENT_CAP = 200

let lastShownAt = 0

export interface UseEventLineResult {
  events: EventLine[]
  lastSeq: number
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

    const delay = (ms: number): Promise<void> => {
      if (controller.signal.aborted) return Promise.resolve()
      return new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, ms)
        controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true })
      })
    }


    const loop = async (): Promise<void> => {
      while (!cancelledRef.current && !controller.signal.aborted) {
        let received = false
        try {
          const raw = await fetchEvents(lastSeqRef.current, controller.signal)
          if (cancelledRef.current || controller.signal.aborted) return
          const next = parseEventLine(raw)
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
          if (err instanceof RateLimitError) {
            const now = Date.now()
            if (now - lastShownAt > (err.retryAfter ?? 1) * 1000) {
              lastShownAt = now
              useUiStore
                .getState()
                .showError('Server busy — retrying in...', 'warning', err.retryAfter)
            }
          }
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
