import { create } from 'zustand'

export type ErrorVariant = 'error' | 'warning' | 'info'

export interface ErrorBanner {
  message: string
  variant: ErrorVariant
}

export interface UiState {
  legendCollapsed: boolean
  hudVisible: boolean
  errorBanner: ErrorBanner | null
}

export interface UiActions {
  toggleLegend: () => void
  setHudVisible: (v: boolean) => void
  showError: (message: string, variant: ErrorVariant) => void
  dismissError: () => void
}

export type UiStore = UiState & UiActions

export const useUiStore = create<UiStore>()((set) => ({
  legendCollapsed: false,
  hudVisible: true,
  errorBanner: null,

  toggleLegend: () =>
    set((state) => ({ legendCollapsed: !state.legendCollapsed })),

  setHudVisible: (v) => set(() => ({ hudVisible: v })),

  showError: (message, variant) =>
    set(() => ({ errorBanner: { message, variant } })),

  dismissError: () => set(() => ({ errorBanner: null })),
}))
