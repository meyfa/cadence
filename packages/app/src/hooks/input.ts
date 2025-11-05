import { useEffect, type DependencyList } from 'react'

function useWindowEvent<K extends keyof WindowEventMap> (
  type: K,
  handler: (ev: WindowEventMap[K]) => void,
  deps: DependencyList
): void {
  useEffect(() => {
    window.addEventListener(type, handler)
    return () => {
      window.removeEventListener(type, handler)
    }
  }, deps)
}

export function useGlobalKeydown (handler: (event: KeyboardEvent) => void, deps: DependencyList): void {
  useWindowEvent('keydown', handler, deps)
}

export function useGlobalMouseMove (handler: (event: MouseEvent) => void, deps: DependencyList): void {
  useWindowEvent('mousemove', handler, deps)
}

export function useGlobalMouseUp (handler: (event: MouseEvent) => void, deps: DependencyList): void {
  useWindowEvent('mouseup', handler, deps)
}
