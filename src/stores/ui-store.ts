import { create } from 'zustand'
import type { LodTier } from '@/lib/three/lod'

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
  /** Camera→target LOD tier (0 near / 1 mid / 2 far) — drives Building detail visibility. */
  cameraLod: LodTier
}

export interface UiActions {
  toggleLegend: () => void
  setHudVisible: (v: boolean) => void
  showError: (message: string, variant: ErrorVariant, retryAfter?: number) => void
  dismissError: () => void
  dismissMobileNotice: () => void
  showToast: (message: string) => void
  dismissToast: () => void
  /** Update camera LOD tier — no-op when the tier is unchanged. */
  setCameraLod: (t: LodTier) => void
}

export type UiStore = UiState & UiActions

let toastCounter = 0

export const useUiStore = create<UiStore>()((set) => ({
  legendCollapsed: false,
  hudVisible: true,
  errorBanner: null,
  mobileNoticeDismissed: false,
  toast: null,
  cameraLod: 0,

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

  // LOD tier set — returning the same state object when the tier is unchanged
  // makes zustand skip the update entirely (Object.is check): no state swap,
  // no subscriber notification, no Building re-render while orbiting inside a
  // tier band. CameraRig calls this on every OrbitControls 'change'.
  setCameraLod: (t) =>
    set((state) => (state.cameraLod === t ? state : { cameraLod: t })),
}))
