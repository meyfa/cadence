import { useContext, type Context } from 'react'

export function useSafeContext<T> (context: Context<T | undefined>, contextName: string): T {
  const result = useContext(context)
  if (result == null) {
    throw new Error(`${contextName} used outside provider`)
  }

  return result
}
