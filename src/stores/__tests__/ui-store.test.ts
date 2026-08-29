import { describe, test, expect, beforeEach } from 'vitest'
import { useUiStore } from '../ui-store'

describe('ui-store', () => {
  beforeEach(() => {
    useUiStore.setState({
      legendCollapsed: false,
      hudVisible: true,
      errorBanner: null,
      mobileNoticeDismissed: false,
    })
  })

  test('initial state', () => {
    const s = useUiStore.getState()
    expect(s.legendCollapsed).toBe(false)
    expect(s.hudVisible).toBe(true)
    expect(s.errorBanner).toBeNull()
    expect(s.mobileNoticeDismissed).toBe(false)
  })

  test('toggleLegend flips', () => {
    expect(useUiStore.getState().legendCollapsed).toBe(false)
    useUiStore.getState().toggleLegend()
    expect(useUiStore.getState().legendCollapsed).toBe(true)
    useUiStore.getState().toggleLegend()
    expect(useUiStore.getState().legendCollapsed).toBe(false)
    // multiple toggles
    useUiStore.getState().toggleLegend()
    useUiStore.getState().toggleLegend()
    useUiStore.getState().toggleLegend()
    expect(useUiStore.getState().legendCollapsed).toBe(true)
  })

  test('setHudVisible sets boolean', () => {
    useUiStore.getState().setHudVisible(false)
    expect(useUiStore.getState().hudVisible).toBe(false)
    useUiStore.getState().setHudVisible(true)
    expect(useUiStore.getState().hudVisible).toBe(true)
    useUiStore.getState().setHudVisible(false)
    expect(useUiStore.getState().hudVisible).toBe(false)
  })

  test('showError without retryAfter', () => {
    useUiStore.getState().showError('oops', 'error')
    const b = useUiStore.getState().errorBanner
    expect(b).toEqual({ message: 'oops', variant: 'error' })
    expect(b?.retryAfter).toBeUndefined()
  })

  test('showError with retryAfter', () => {
    useUiStore.getState().showError('busy', 'warning', 5)
    expect(useUiStore.getState().errorBanner).toEqual({ message: 'busy', variant: 'warning', retryAfter: 5 })
  })

  test('showError variant info', () => {
    useUiStore.getState().showError('info msg', 'info', 0)
    expect(useUiStore.getState().errorBanner?.variant).toBe('info')
    expect(useUiStore.getState().errorBanner?.retryAfter).toBe(0)
  })

  test('showError overwrites previous banner', () => {
    useUiStore.getState().showError('first', 'error', 1)
    useUiStore.getState().showError('second', 'warning', 2)
    const b = useUiStore.getState().errorBanner!
    expect(b.message).toBe('second')
    expect(b.variant).toBe('warning')
    expect(b.retryAfter).toBe(2)
  })

  test('dismissError clears banner', () => {
    useUiStore.getState().showError('msg', 'error')
    expect(useUiStore.getState().errorBanner).not.toBeNull()
    useUiStore.getState().dismissError()
    expect(useUiStore.getState().errorBanner).toBeNull()
    // idempotent
    useUiStore.getState().dismissError()
    expect(useUiStore.getState().errorBanner).toBeNull()
  })

  test('dismissMobileNotice sets true', () => {
    expect(useUiStore.getState().mobileNoticeDismissed).toBe(false)
    useUiStore.getState().dismissMobileNotice()
    expect(useUiStore.getState().mobileNoticeDismissed).toBe(true)
    // second call stays true
    useUiStore.getState().dismissMobileNotice()
    expect(useUiStore.getState().mobileNoticeDismissed).toBe(true)
  })

  test('toggleLegend does not affect other state', () => {
    useUiStore.getState().showError('err', 'error', 3)
    const beforeHud = useUiStore.getState().hudVisible
    const beforeBanner = useUiStore.getState().errorBanner
    useUiStore.getState().toggleLegend()
    expect(useUiStore.getState().hudVisible).toBe(beforeHud)
    expect(useUiStore.getState().errorBanner).toEqual(beforeBanner)
  })

  test('setHudVisible does not affect legend', () => {
    useUiStore.getState().toggleLegend()
    expect(useUiStore.getState().legendCollapsed).toBe(true)
    useUiStore.getState().setHudVisible(false)
    expect(useUiStore.getState().legendCollapsed).toBe(true)
    expect(useUiStore.getState().hudVisible).toBe(false)
  })
})
