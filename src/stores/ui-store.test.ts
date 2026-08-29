import { describe, expect, it, beforeEach } from 'vitest'

import { useUiStore } from './ui-store'

describe('useUiStore', () => {
  beforeEach(() => {
    useUiStore.setState({
      legendCollapsed: false,
      hudVisible: true,
      errorBanner: null,
    })
  })

  describe('toggleLegend', () => {
    it('collapses an expanded legend', () => {
      useUiStore.getState().toggleLegend()
      expect(useUiStore.getState().legendCollapsed).toBe(true)
    })

    it('expands a collapsed legend', () => {
      useUiStore.setState({ legendCollapsed: true })
      useUiStore.getState().toggleLegend()
      expect(useUiStore.getState().legendCollapsed).toBe(false)
    })

    it('alternates the flag over repeated calls', () => {
      const store = useUiStore.getState()
      expect(store.legendCollapsed).toBe(false)

      store.toggleLegend()
      expect(useUiStore.getState().legendCollapsed).toBe(true)

      store.toggleLegend()
      expect(useUiStore.getState().legendCollapsed).toBe(false)

      store.toggleLegend()
      expect(useUiStore.getState().legendCollapsed).toBe(true)

      store.toggleLegend()
      expect(useUiStore.getState().legendCollapsed).toBe(false)
    })
  })

  describe('setHudVisible', () => {
    it('shows the HUD', () => {
      useUiStore.setState({ hudVisible: false })
      useUiStore.getState().setHudVisible(true)
      expect(useUiStore.getState().hudVisible).toBe(true)
    })

    it('hides the HUD', () => {
      useUiStore.setState({ hudVisible: true })
      useUiStore.getState().setHudVisible(false)
      expect(useUiStore.getState().hudVisible).toBe(false)
    })

    it('sets an absolute value instead of toggling', () => {
      useUiStore.getState().setHudVisible(false)
      expect(useUiStore.getState().hudVisible).toBe(false)

      useUiStore.getState().setHudVisible(true)
      expect(useUiStore.getState().hudVisible).toBe(true)
    })
  })

  describe('showError / dismissError', () => {
    it('stores the message with its variant', () => {
      useUiStore.getState().showError('Connection lost', 'error')
      expect(useUiStore.getState().errorBanner).toEqual({
        message: 'Connection lost',
        variant: 'error',
      })
    })

    it('replaces the previous banner with the latest error', () => {
      useUiStore.getState().showError('First problem', 'error')
      useUiStore.getState().showError('Later warning', 'warning')
      useUiStore.getState().showError('Final info', 'info')

      expect(useUiStore.getState().errorBanner).toEqual({
        message: 'Final info',
        variant: 'info',
      })
    })

    it('clears the banner on dismiss and allows dismissing again', () => {
      useUiStore.getState().showError('Gone soon', 'warning')
      useUiStore.getState().dismissError()
      expect(useUiStore.getState().errorBanner).toBeNull()

      // No-op when already cleared.
      useUiStore.getState().dismissError()
      expect(useUiStore.getState().errorBanner).toBeNull()

      // A new error can be shown after dismissal.
      useUiStore.getState().showError('Back again', 'error')
      expect(useUiStore.getState().errorBanner).toEqual({
        message: 'Back again',
        variant: 'error',
      })
    })
  })
})
