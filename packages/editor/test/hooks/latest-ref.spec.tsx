import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useLatestRef } from '../../src/hooks/latest-ref.js'

describe('hooks/latest-ref.ts', () => {
  it('always exposes the latest value while keeping the same ref object', () => {
    const { result, rerender } = renderHook(({ value }) => {
      return useLatestRef(value)
    }, {
      initialProps: { value: 'alpha' }
    })

    const firstRef = result.current
    expect(firstRef.current).toBe('alpha')

    rerender({ value: 'beta' })
    expect(result.current).toBe(firstRef)
    expect(result.current.current).toBe('beta')

    rerender({ value: 'gamma' })
    expect(result.current).toBe(firstRef)
    expect(result.current.current).toBe('gamma')
  })
})
