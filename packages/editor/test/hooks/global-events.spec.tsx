import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useGlobalEscapePress, useGlobalKeydown, useGlobalMouseMove, useGlobalMouseUp } from '../../src/hooks/global-events.ts'

describe('hooks/global-events.ts', () => {
  describe('useGlobalKeydown()', () => {
    it('invokes the handler when a keydown event is dispatched on the window', () => {
      const events: KeyboardEvent[] = []

      renderHook(() => useGlobalKeydown((event) => events.push(event)))

      const event = new KeyboardEvent('keydown', { code: 'KeyA' })
      act(() => {
        window.dispatchEvent(event)
      })

      expect(events).toHaveLength(1)
      expect(events[0]).toBe(event)
    })

    it('removes the listener when unmounted', () => {
      const events: KeyboardEvent[] = []

      const { unmount } = renderHook(() => useGlobalKeydown((event) => events.push(event)))
      unmount()

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }))
      })

      expect(events).toHaveLength(0)
    })
  })

  describe('useGlobalMouseMove()', () => {
    it('invokes the handler when a mousemove event is dispatched on the window', () => {
      const events: MouseEvent[] = []

      renderHook(() => useGlobalMouseMove((event) => events.push(event)))

      const event = new MouseEvent('mousemove')
      act(() => {
        window.dispatchEvent(event)
      })

      expect(events).toHaveLength(1)
      expect(events[0]).toBe(event)
    })
  })

  describe('useGlobalMouseUp()', () => {
    it('invokes the handler when a mouseup event is dispatched on the window', () => {
      const events: MouseEvent[] = []

      renderHook(() => useGlobalMouseUp((event) => events.push(event)))

      const event = new MouseEvent('mouseup')
      act(() => {
        window.dispatchEvent(event)
      })

      expect(events).toHaveLength(1)
      expect(events[0]).toBe(event)
    })
  })

  describe('useGlobalEscapePress()', () => {
    it('invokes the handler on a plain Escape keydown', () => {
      const events: KeyboardEvent[] = []

      renderHook(() => useGlobalEscapePress((event) => events.push(event)))

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }))
      })

      expect(events).toHaveLength(1)
    })

    it('ignores Escape presses combined with modifier keys', () => {
      const events: KeyboardEvent[] = []

      renderHook(() => useGlobalEscapePress((event) => events.push(event)))

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', ctrlKey: true }))
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', metaKey: true }))
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', shiftKey: true }))
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', altKey: true }))
      })

      expect(events).toHaveLength(0)
    })

    it('ignores keydown events for keys other than Escape', () => {
      const events: KeyboardEvent[] = []

      renderHook(() => useGlobalEscapePress((event) => events.push(event)))

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }))
      })

      expect(events).toHaveLength(0)
    })
  })
})
