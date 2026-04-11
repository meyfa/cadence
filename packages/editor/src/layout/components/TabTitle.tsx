import { useSortable } from '@dnd-kit/sortable'
import { Tab as HUITab } from '@headlessui/react'
import { useDroppable } from '@dnd-kit/core'
import React, { useCallback, type ComponentType, type FunctionComponent } from 'react'
import type { ModuleRenderFn, PanelId, PanelProps } from '../../modules/types.js'
import type { Tab, TabId } from '../types.js'
import { usePanelById } from './panel-lookup.js'
import { ErrorBoundary } from 'react-error-boundary'

const MOUSE_BUTTON_MIDDLE = 1

type TabTitleState = 'inactive' | 'active' | 'focused' | 'dragging'
type TabDropPosition = 'before' | 'after'

function getTabDropTargetId (tab: Tab, position: TabDropPosition): string {
  return `${tab.id}:${position}`
}

export interface TabDropTargetInfo {
  readonly tabId: Tab['id']
  readonly position: TabDropPosition
}

export function parseTabDropTarget (id: string): TabDropTargetInfo | undefined {
  const [tabId, position] = id.split(':') as [Tab['id'], string]
  return position === 'before' || position === 'after' ? { tabId, position } : undefined
}

export interface TabTitleProps {
  readonly TitleComponent: ModuleRenderFn<PanelProps, string>
  readonly NotificationsComponent: ModuleRenderFn<PanelProps, number | null>
  readonly tab: Tab
  readonly state: TabTitleState
  readonly closeable: boolean
  readonly onClose?: () => void
}

const NullComponent: ModuleRenderFn<PanelProps, null> = () => null

const EmptyStringComponent: ModuleRenderFn<PanelProps, string> = () => ''
const ErrorStringComponent: ModuleRenderFn<PanelProps, string> = () => 'Error'

export const PanelTabTitle: FunctionComponent<{
  TabTitleComponent: ComponentType<TabTitleProps>
  tab: Tab
  state: TabTitleState
  onClose?: () => void
}> = ({ TabTitleComponent, tab, state, onClose }) => {
  const panel = usePanelById(tab.component.type as PanelId)
  const closeable = panel?.closeable ?? false

  return (
    <ErrorBoundary
      fallback={(
        <TabTitleComponent
          TitleComponent={ErrorStringComponent}
          NotificationsComponent={NullComponent}
          tab={tab}
          state={state}
          closeable={closeable}
          onClose={closeable ? onClose : undefined}
        />
      )}
    >
      <TabTitleComponent
        TitleComponent={panel?.Title ?? EmptyStringComponent}
        NotificationsComponent={panel?.Notifications ?? NullComponent}
        tab={tab}
        state={state}
        closeable={closeable}
        onClose={closeable ? onClose : undefined}
      />
    </ErrorBoundary>
  )
}

export const TabTitle: FunctionComponent<{
  TabTitleComponent: ComponentType<TabTitleProps>
  tab: Tab
  state: TabTitleState
  onClose: () => void
  onElementRef?: (tabId: TabId, element: HTMLDivElement | null) => void
  onTabFocus?: () => void
}> = ({
  TabTitleComponent,
  tab,
  state,
  onClose,
  onElementRef,
  onTabFocus
}) => {
  const { attributes, listeners, setNodeRef, isSorting } = useSortable({ id: tab.id })
  const { setNodeRef: setBeforeDropRef } = useDroppable({ id: getTabDropTargetId(tab, 'before') })
  const { setNodeRef: setAfterDropRef } = useDroppable({ id: getTabDropTargetId(tab, 'after') })
  const panel = usePanelById(tab.component.type as PanelId)

  const disabled = isSorting || state === 'dragging'
  const resolvedOnClose = panel?.closeable === true ? onClose : undefined

  const setElementRef = useCallback((element: HTMLDivElement | null) => {
    setNodeRef(element)
    onElementRef?.(tab.id, element)
  }, [onElementRef, setNodeRef, tab.id])

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
        resolvedOnClose?.()
      }
    }
  }, [disabled, resolvedOnClose])

  return (
    <HUITab
      as='div'
      ref={setElementRef}
      {...attributes}
      {...listeners}
      onFocusCapture={disabled ? undefined : onTabFocus}
      style={{ position: 'relative', outline: 'none', pointerEvents: disabled ? 'none' : undefined }}
    >
      <div
        ref={setBeforeDropRef}
        style={{ position: 'absolute', inset: 0, right: '50%', pointerEvents: 'none' }}
      />
      <div
        ref={setAfterDropRef}
        style={{ position: 'absolute', inset: 0, left: '50%', pointerEvents: 'none' }}
      />

      <div onMouseDown={onMouseDown} onMouseUp={onMouseUp}>
        <PanelTabTitle
          TabTitleComponent={TabTitleComponent}
          tab={tab}
          state={state}
          onClose={resolvedOnClose}
        />
      </div>
    </HUITab>
  )
}
