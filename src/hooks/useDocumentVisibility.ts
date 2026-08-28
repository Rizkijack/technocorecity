'use client'

import { useEffect, useState } from 'react'

/**
 * Return true when document is visible.
 * SSR → true.
 * Listens to visibilitychange.
 */
export function useDocumentVisibility(): boolean {
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof document === 'undefined') return true
    return document.visibilityState === 'visible'
  })

  useEffect(() => {
    if (typeof document === 'undefined') return

    const handler = (): void => {
      setVisible(document.visibilityState === 'visible')
    }

    document.addEventListener('visibilitychange', handler)
    // Sync in case visibility changed between render and effect
    handler()

    return () => {
      document.removeEventListener('visibilitychange', handler)
    }
  }, [])

  return visible
}

export default useDocumentVisibility
