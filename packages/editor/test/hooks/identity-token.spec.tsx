import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useIdentityToken } from '../../src/hooks/identity-token.ts'

describe('hooks/identity-token.ts', () => {
  it('returns the same hook object across renders', () => {
    const { result, rerender } = renderHook(() => useIdentityToken())

    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })

  it('creates and returns a new token with next()', () => {
    const { result } = renderHook(() => useIdentityToken())

    const initial = result.current.current
    const next = result.current.next()

    expect(next).not.toBe(initial)
    expect(result.current.current).toBe(next)
  })

  it('invalidates the current token on unmount', () => {
    const { result, unmount } = renderHook(() => useIdentityToken())

    const hook = result.current
    const token = hook.next()
    unmount()

    expect(hook.current).not.toBe(token)
  })
})
