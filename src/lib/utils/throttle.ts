/**
 * SSR-safe visibility gate and throttle helpers.
 * Pauses polling / expensive work while the tab is hidden.
 */

export interface VisibilityGate {
  /** True when the document is visible (or SSR). */
  isOpen(): boolean
  /** Resolve when the tab becomes visible. No-op if already visible. */
  waitOpen(): Promise<void>
  /** Alias for `waitOpen` — used by some consumers. */
  wait(): Promise<void>
  /** Remove visibility listener and resolve any pending waiter. */
  dispose(): void
}

/**
 * Create a gate that tracks `document.visibilityState`.
 * On the server `isOpen()` returns true so initial fetches run.
 */
export function createVisibilityGate(): VisibilityGate {
  if (typeof document === 'undefined') {
    return {
      isOpen: () => true,
      waitOpen: () => Promise.resolve(),
      wait: () => Promise.resolve(),
      dispose: () => {},
    }
  }

  let pending: {
    promise: Promise<void>
    resolve: () => void
  } | null = null

  const handle = (): void => {
    if (document.visibilityState !== 'hidden' && pending) {
      const p = pending
      pending = null
      p.resolve()
    }
  }

  document.addEventListener('visibilitychange', handle)

  const waitOpen = (): Promise<void> => {
    if (document.visibilityState !== 'hidden') return Promise.resolve()
    if (pending) return pending.promise
    let resolve!: () => void
    const promise = new Promise<void>((r) => {
      resolve = r
    })
    pending = { promise, resolve }
    return promise
  }

  return {
    isOpen: () => document.visibilityState !== 'hidden',
    waitOpen,
    wait: waitOpen,
    dispose: () => {
      document.removeEventListener('visibilitychange', handle)
      if (pending) {
        pending.resolve()
        pending = null
      }
    },
  }
}

/**
 * Wrap `fn` so it is throttled and defers while the tab is hidden.
 * While hidden, the last call is queued and flushed when visible.
 */
export function visibilityThrottle<T extends (...args: never[]) => void>(
  fn: T,
  delayMs = 1000,
): (...args: Parameters<T>) => void {
  let last = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let pendingArgs: Parameters<T> | null = null

  const invoke = (args: Parameters<T>): void => {
    last = Date.now()
    fn(...args)
  }

  return (...args: Parameters<T>): void => {
    if (
      typeof document !== 'undefined' &&
      document.visibilityState === 'hidden'
    ) {
      pendingArgs = args
      const onVisible = (): void => {
        if (document.visibilityState !== 'hidden' && pendingArgs) {
          const a = pendingArgs
          pendingArgs = null
          invoke(a)
          document.removeEventListener('visibilitychange', onVisible)
        }
      }
      document.addEventListener('visibilitychange', onVisible, { once: true })
      return
    }

    const now = Date.now()
    const elapsed = now - last

    if (elapsed >= delayMs) {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      pendingArgs = null
      invoke(args)
      return
    }

    pendingArgs = args
    if (timer === null) {
      timer = setTimeout(() => {
        timer = null
        if (pendingArgs) {
          const a = pendingArgs
          pendingArgs = null
          invoke(a)
        }
      }, delayMs - elapsed)
    }
  }
}
