import type { Tab } from '@editor/state/layout.js'
import { Close } from '@mui/icons-material'
import clsx from 'clsx'
import React, { useCallback, type FunctionComponent } from 'react'
import { isTabCloseable, renderTabNotificationCount, renderTabTitle, type TabRendererContext } from '../panes/render-tab.js'

const MOUSE_BUTTON_MIDDLE = 1

export const TabComponent: FunctionComponent<{
  tab: Tab
  context: TabRendererContext
  disabled?: boolean
  selected?: boolean
  onClose?: (tab: Tab) => void
}> = ({ tab, context, disabled, selected, onClose }) => {
  const title = renderTabTitle(tab.component, context)
  const notificationCount = renderTabNotificationCount(tab.component, context)
  const closeable = isTabCloseable(tab.component)

  const onCloseClick = useCallback((event: React.MouseEvent) => {
    if (!disabled && closeable) {
      event.stopPropagation()
      onClose?.(tab)
    }
  }, [disabled, closeable, onClose, tab])

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

      if (!disabled && closeable) {
        onClose?.(tab)
      }
    }
  }, [disabled, closeable, onClose, tab])

  // Mirror the selected tab appearance; ensure it's outside hit-testing
  return (
    <div
      className={clsx(
        'group select-none flex items-center gap-2 px-4 h-7 text-sm font-semibold leading-none border-t-2 border-r border-r-surface-100',
        disabled ? 'pointer-events-none' : 'cursor-pointer',
        selected
          ? 'bg-surface-300 border-t-accent-200 text-content-300'
          : 'bg-surface-200 border-t-transparent text-content-200 hocus:bg-surface-300 hocus:text-content-300'
      )}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
    >
      {title}

      {notificationCount > 0 && (
        <div className='px-1 py-0.5 text-xs leading-none bg-error-surface text-error-content rounded'>
          {notificationCount}
        </div>
      )}

      {closeable && onClose != null && (
        <button
          type='button'
          className={clsx(
            'p-0.5 -mr-2 rounded text-content-50 cursor-default',
            selected ? '' : 'opacity-0 enabled:group-hocus:opacity-100',
            'enabled:cursor-pointer enabled:hocus:bg-content-100/20 enabled:hocus:text-content-300'
          )}
          onClick={onCloseClick}
          aria-label={`Close ${title} tab`}
        >
          <Close className='text-base!' />
        </button>
      )}
    </div>
  )
}
