'use client'

import { useEffect } from 'react'
import useSWR from 'swr'

import { parseRooms } from '@/lib/technocore/adapter'
import { fetchRooms } from '@/lib/technocore/client'
import { RateLimitError } from '@/lib/technocore/errors'
import type { Room } from '@/lib/technocore/types'
import { useUiStore } from '@/stores/ui-store'
import { useWorldStore } from '@/stores/world-store'

export interface UseRoomsResult {
  rooms: Room[] | undefined
  isLoading: boolean
  error: Error | undefined
  refresh: () => Promise<Room[] | undefined>
  phase: 'rooms' | 'done'
  progress: { loaded: number; total: number }
}

/**
 * SWR-backed room list.
 * - key ['rooms']
 * - fetcher parses text via parseRooms (supports both string and pre-parsed array for test mocks)
 * - dedup 5s, revalidateOnFocus true, refreshInterval 0
 * - on every successful fetch, mirrors the result into the world store
 *   so the 3D scene can render buildings without re-fetching.
 */
export function useRooms(): UseRoomsResult {
  const { data, error, isLoading, mutate } = useSWR<Room[], Error>(
    ['rooms'],
    async () => {
      try {
        const raw = (await fetchRooms()) as unknown
        if (Array.isArray(raw)) return raw as Room[]
        if (typeof raw === 'string') return parseRooms(raw)
        return parseRooms(String(raw))
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[useRooms] fetchRooms failed:', err)
        throw err
      }
    },
    {
      dedupingInterval: 30_000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshInterval: 0,
    },
  )

  const setRooms = useWorldStore((s) => s.setRooms)
  useEffect(() => {
    if (data) setRooms(data)
  }, [data, setRooms])

  useEffect(() => {
    if (!error) return
    if (error instanceof RateLimitError) {
      useUiStore
        .getState()
        .showError('Server busy — retrying in...', 'warning', error.retryAfter)
      return
    }
    useUiStore.getState().showError(error.message, 'error')
  }, [error])

  return {
    rooms: data,
    isLoading,
    error: error as Error | undefined,
    refresh: () => mutate(),
    phase: data === undefined ? 'rooms' : 'done',
    progress: { loaded: data ? 1 : 0, total: 1 },
  }
}
