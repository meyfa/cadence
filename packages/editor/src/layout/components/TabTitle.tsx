import { useSortable } from '@dnd-kit/sortable'
import { Tab as HUITab } from '@headlessui/react'
import React, { useCallback, type ComponentType, type FunctionComponent } from 'react'
import type { Tab } from '../types.js'

const MOUSE_BUTTON_MIDDLE = 1

export interface TabTitleProps {
  readonly tab: Tab
  readonly state: 'inactive' | 'active' | 'focused' | 'dragging'
  readonly onClose?: () => void
}

export const TabTitle: FunctionComponent<TabTitleProps & {
  TabTitleComponent: ComponentType<TabTitleProps>
  dropIndicatorColor: string
  onTabFocus?: () => void
}> = ({
  TabTitleComponent,
  dropIndicatorColor,
  tab,
  state,
  onClose,
  onTabFocus
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging, isOver, isSorting } = useSortable({ id: tab.id })

  const disabled = isSorting || state === 'dragging'

  const showDropIndicator = isOver && !isDragging
  const dropIndicatorOnRightSide = showDropIndicator && (transform?.x ?? 0) < 0

  const onMouseDown = useCallback((event: React.MouseEvent) => {
    if (event.button === MOUSE_BUTTON_MIDDLE) {
      // Even if the tab is not closeable, default behavior must still be prevented to avoid
      // platform-specific behaviors.
      event.preventDefault()
      // Disallow drag initiation.
      event.stopPropagation()
    }
  }, [])

  const onMouseUp = useCallback((event: React.MouseEvent) => {
    // Middle click closes tab.
    if (event.button === MOUSE_BUTTON_MIDDLE) {
      event.preventDefault()
      event.stopPropagation()

      // On some platforms, middle-clicking initiates a paste into the last focused text field.
      // This cannot be reliably prevented via event.preventDefault() alone.
      const options = { once: true, capture: true }
      const listener = (e: ClipboardEvent) => {
        e.preventDefault()
      }

      window.addEventListener('paste', listener, options)
      setTimeout(() => {
        window.removeEventListener('paste', listener, options)
      }, 0)

      if (!disabled) {
        onClose?.()
      }
    }
  }, [disabled, onClose])

  return (
    <HUITab
      as='div'
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onFocusCapture={disabled ? undefined : onTabFocus}
      style={{ position: 'relative', outline: 'none', pointerEvents: disabled ? 'none' : undefined }}
    >
      <div onMouseDown={onMouseDown} onMouseUp={onMouseUp}>
        <TabTitleComponent
          tab={tab}
          state={state}
          onClose={onClose}
        />
      </div>

      <div
        style={{
          display: showDropIndicator ? 'block' : 'none',
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: dropIndicatorOnRightSide ? undefined : 0,
          right: dropIndicatorOnRightSide ? 0 : undefined,
          width: '0.125rem',
          backgroundColor: dropIndicatorColor
        }}
      />
    </HUITab>
  )
}
