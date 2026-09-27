import { render } from '@testing-library/react'
import { createContext } from 'react'
import { describe, expect, it } from 'vitest'
import { useSafeContext } from '../../src/hooks/safe-context.ts'

describe('hooks/safe-context.ts', () => {
  const TestContext = createContext<string | undefined>(undefined)

  function Consumer ({ contextName }: { contextName: string }) {
    const value = useSafeContext(TestContext, contextName)
    return <>{value}</>
  }

  it('returns the provided context value', () => {
    const { container } = render(
      <TestContext value='hello'>
        <Consumer contextName='TestContext' />
      </TestContext>
    )

    expect(container.textContent).toBe('hello')
  })

  it('throws a descriptive error when used outside a provider', () => {
    expect(() => render(
      <Consumer contextName='TestContext' />
    )).toThrow('TestContext used outside provider')
  })
})
