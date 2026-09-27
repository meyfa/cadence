import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useNonNullValue } from '../../src/hooks/non-null-value.ts'

describe('hooks/non-null-value.ts', () => {
  it('returns the initial value', () => {
    const { result } = renderHook(({ value }) => {
      return useNonNullValue(value)
    }, {
      initialProps: { value: 'first' as string | undefined }
    })

    expect(result.current).toBe('first')
  })

  it('updates to a new non-null value', () => {
    const { result, rerender } = renderHook(({ value }) => {
      return useNonNullValue(value)
    }, {
      initialProps: { value: 'first' as string | undefined }
    })

    rerender({ value: 'second' })
    expect(result.current).toBe('second')
  })

  it('keeps the last non-null value when the input becomes null/undefined', () => {
    const { result, rerender } = renderHook(({ value }) => {
      return useNonNullValue(value)
    }, {
      initialProps: { value: 'first' as string | undefined }
    })

    rerender({ value: undefined })
    expect(result.current).toBe('first')
  })

  it('starts out undefined when the initial value is undefined', () => {
    const { result } = renderHook(({ value }) => {
      return useNonNullValue(value)
    }, {
      initialProps: { value: undefined as string | undefined }
    })

    expect(result.current).toBeUndefined()
  })
})
