import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/react-dom'
import { useRef, type FunctionComponent, type PropsWithChildren } from 'react'
import { createPortal } from 'react-dom'
import { useGlobalKeydown, useGlobalMouseUp } from '../hooks/input.js'

export const Popover: FunctionComponent<PropsWithChildren<{
  anchor?: HTMLElement | null
  onClose: () => void
}>> = ({ anchor, onClose, children }) => {
  const popoverRef = useRef<HTMLDivElement>(null)

  const { x, y, strategy, refs } = useFloating({
    elements: {
      reference: anchor
    },
    placement: 'bottom-start',
    strategy: 'fixed',
    middleware: [offset(0), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate
  })

  useGlobalMouseUp((event) => {
    const element = popoverRef.current
    if (element == null || !event.composedPath().includes(element)) {
      onClose()
    }
  }, [onClose])

  useGlobalKeydown((event) => {
    if (event.code === 'Escape') {
      onClose()
    }
  }, [onClose])

  if (anchor == null) {
    return null
  }

  return createPortal((
    <div
      ref={(node) => {
        popoverRef.current = node
        refs.setFloating(node)
      }}
      className='z-20 min-w-48 px-2 py-1 bg-surface-300 border border-frame-300 text-content-300 text-sm rounded shadow-lg'
      style={{
        position: strategy,
        top: y,
        left: x
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  ), document.body)
}
