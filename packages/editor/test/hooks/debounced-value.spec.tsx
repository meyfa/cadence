import { act, renderHook } from '@testing-library/react'
import { numeric } from '@utility'
import { describe, expect, it, vi } from 'vitest'
import { useDebouncedValue } from '../../src/hooks/debounced-value.js'

describe('hooks/debounced-value.ts', () => {
  it('delays updates until the debounce interval elapses', () => {
    vi.useFakeTimers()

    try {
      const { result, rerender } = renderHook(({ value }) => {
        return useDebouncedValue(value, numeric('s', 0.25))
      }, {
        initialProps: { value: 'alpha' }
      })

      expect(result.current).toBe('alpha')

      rerender({ value: 'beta' })
      expect(result.current).toBe('alpha')

      act(() => {
        vi.advanceTimersByTime(249)
      })
      expect(result.current).toBe('alpha')

      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(result.current).toBe('beta')
    } finally {
      vi.useRealTimers()
    }
  })
})
