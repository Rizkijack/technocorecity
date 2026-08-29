import { create } from 'zustand'

export type ErrorVariant = 'error' | 'warning' | 'info'

export interface ErrorBanner {
  message: string
  variant: ErrorVariant
  retryAfter?: number
}

export interface Toast {
  message: string
  id: number
}

export interface UiState {
  legendCollapsed: boolean
  hudVisible: boolean
  errorBanner: ErrorBanner | null
  mobileNoticeDismissed: boolean
  toast: Toast | null
}

export interface UiActions {
  toggleLegend: () => void
  setHudVisible: (v: boolean) => void
  showError: (message: string, variant: ErrorVariant, retryAfter?: number) => void
  dismissError: () => void
  dismissMobileNotice: () => void
  showToast: (message: string) => void
  dismissToast: () => void
}

export type UiStore = UiState & UiActions

let toastCounter = 0

export const useUiStore = create<UiStore>()((set) => ({
  legendCollapsed: false,
  hudVisible: true,
  errorBanner: null,
  mobileNoticeDismissed: false,
  toast: null,

  toggleLegend: () =>
    set((state) => ({ legendCollapsed: !state.legendCollapsed })),

  setHudVisible: (v) => set(() => ({ hudVisible: v })),

  showError: (message, variant, retryAfter) =>
    set(() => ({
      errorBanner:
        retryAfter !== undefined
          ? { message, variant, retryAfter }
          : { message, variant },
    })),

  dismissError: () => set(() => ({ errorBanner: null })),

  dismissMobileNotice: () => set(() => ({ mobileNoticeDismissed: true })),

  showToast: (message) => {
    toastCounter += 1
    set(() => ({ toast: { message, id: toastCounter } }))
  },

  dismissToast: () => set(() => ({ toast: null })),
}))
