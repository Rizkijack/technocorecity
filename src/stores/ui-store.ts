import { create } from 'zustand'

export type ErrorVariant = 'error' | 'warning' | 'info'

export interface ErrorBanner {
  message: string
  variant: ErrorVariant
  retryAfter?: number
}

export interface UiState {
  legendCollapsed: boolean
  hudVisible: boolean
  errorBanner: ErrorBanner | null
  mobileNoticeDismissed: boolean
}

export interface UiActions {
  toggleLegend: () => void
  setHudVisible: (v: boolean) => void
  showError: (message: string, variant: ErrorVariant, retryAfter?: number) => void
  dismissError: () => void
  dismissMobileNotice: () => void
}

export type UiStore = UiState & UiActions

export const useUiStore = create<UiStore>()((set) => ({
  legendCollapsed: false,
  hudVisible: true,
  errorBanner: null,
  mobileNoticeDismissed: false,

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
}))
