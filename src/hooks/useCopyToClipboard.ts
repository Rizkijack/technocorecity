'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const RESET_MS = 2000

export interface UseCopyToClipboardResult {
  copy: (text: string) => Promise<boolean>
  isCopied: boolean
}

function isClipboardAvailable(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.clipboard !== 'undefined' &&
    typeof navigator.clipboard.writeText === 'function'
  )
}

function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined') return false
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '0'
  textarea.style.left = '0'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'
  document.body.appendChild(textarea)

  const prev = document.activeElement as HTMLElement | null
  textarea.focus()
  textarea.select()
  textarea.setSelectionRange(0, text.length)

  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  } finally {
    document.body.removeChild(textarea)
    if (prev && typeof prev.focus === 'function') prev.focus()
  }
  return ok
}

/**
 * Clipboard hook with 2s isCopied pulse.
 * Uses async clipboard API with textarea fallback.
 */
export function useCopyToClipboard(): UseCopyToClipboardResult {
  const [isCopied, setIsCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      let ok = false
      try {
        if (isClipboardAvailable()) {
          await navigator.clipboard.writeText(text)
          ok = true
        } else {
          ok = legacyCopy(text)
        }
      } catch {
        ok = legacyCopy(text)
      }

      if (ok) {
        setIsCopied(true)
        clearTimer()
        timerRef.current = setTimeout(() => {
          setIsCopied(false)
          timerRef.current = null
        }, RESET_MS)
      }

      return ok
    },
    [clearTimer],
  )

  useEffect(() => {
    return () => clearTimer()
  }, [clearTimer])

  return { copy, isCopied }
}

export default useCopyToClipboard
