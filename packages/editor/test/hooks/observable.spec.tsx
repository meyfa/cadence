import { act, renderHook } from '@testing-library/react'
import { MutableObservable } from '@meyfa/cadence-utility'
import { describe, expect, it } from 'vitest'
import { useObservable } from '../../src/hooks/observable.ts'

describe('hooks/observable.ts', () => {
  it('returns the current value of the observable', () => {
    const observable = new MutableObservable('first')

    const { result } = renderHook(() => useObservable(observable))

    expect(result.current).toBe('first')
  })

  it('updates when the observable emits a new value', () => {
    const observable = new MutableObservable('first')

    const { result } = renderHook(() => useObservable(observable))

    act(() => {
      observable.set('second')
    })

    expect(result.current).toBe('second')
  })

  it('resubscribes when given a different observable', () => {
    const first = new MutableObservable('first')
    const second = new MutableObservable('second')

    const { result, rerender } = renderHook(({ observable }) => useObservable(observable), {
      initialProps: { observable: first }
    })

    expect(result.current).toBe('first')

    rerender({ observable: second })
    expect(result.current).toBe('second')

    act(() => {
      first.set('gamma')
    })
    expect(result.current).toBe('second')
  })
})
