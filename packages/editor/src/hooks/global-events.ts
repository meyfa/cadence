import { useEffect } from 'react'
import { useLatestRef } from './latest-ref.js'

function useWindowEvent<K extends keyof WindowEventMap> (
  type: K,
  handler: (ev: WindowEventMap[K]) => void
): void {
  const handlerRef = useLatestRef(handler)

  useEffect(() => {
    const listener = (event: WindowEventMap[K]) => {
      handlerRef.current(event)
    }

    window.addEventListener(type, listener)
    return () => {
      window.removeEventListener(type, listener)
    }
  }, [type])
}

export function useGlobalKeydown (handler: (event: KeyboardEvent) => void): void {
  useWindowEvent('keydown', handler)
}

export function useGlobalMouseMove (handler: (event: MouseEvent) => void): void {
  useWindowEvent('mousemove', handler)
}

export function useGlobalMouseUp (handler: (event: MouseEvent) => void): void {
  useWindowEvent('mouseup', handler)
}

export function useGlobalEscapePress (handler: (event: KeyboardEvent) => void): void {
  useGlobalKeydown((event) => {
    const { code, ctrlKey, metaKey, shiftKey, altKey } = event

    if (code === 'Escape' && !ctrlKey && !metaKey && !shiftKey && !altKey) {
      handler(event)
    }
  })
}
