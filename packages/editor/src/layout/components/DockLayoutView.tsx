import { DndContext, DragOverlay, MouseSensor, pointerWithin, useSensor, useSensors, type CollisionDetection, type DragEndEvent, type DragStartEvent, type Modifier } from '@dnd-kit/core'
import { getEventCoordinates } from '@dnd-kit/utilities'
import { useCallback, useState, type ComponentType, type FunctionComponent } from 'react'
import type { FallbackProps } from 'react-error-boundary'
import { findPaneById, findPaneByTabId } from '../algorithms/find.js'
import { moveTabBetweenPanes, moveTabIntoPane, moveTabToSplit } from '../algorithms/mutate.js'
import type { DockLayout, Tab, TabId } from '../types.js'
import type { LayoutDispatch } from './LayoutContext.js'
import { LayoutNodeView } from './LayoutNodeView.js'
import { PanelErrorBoundary } from './PanelErrorBoundary.js'
import { parsePaneNodeDropTarget } from './PaneNodeView.js'
import { PanelTabTitle, type TabTitleProps } from './TabTitle.js'

const DRAGGED_TAB_OPACITY = 0.6

const snapOverlayTopLeftToCursor: Modifier = ({
  activatorEvent,
  draggingNodeRect,
  transform
}) => {
  if (draggingNodeRect == null || activatorEvent == null) {
    return transform
  }

  const activatorCoordinates = getEventCoordinates(activatorEvent)
  if (activatorCoordinates == null) {
    return transform
  }

  const offsetX = activatorCoordinates.x - draggingNodeRect.left
  const offsetY = activatorCoordinates.y - draggingNodeRect.top

  return {
    ...transform,
    x: transform.x + offsetX,
    y: transform.y + offsetY
  }
}

export interface DockLayoutStyles {
  readonly highlightColor: string
  readonly tabListBackgroundColor: string
  readonly tabListBorderColor: string
  readonly dropIndicatorColor: string
}

export interface DockLayoutViewProps {
  readonly TabTitleComponent: ComponentType<TabTitleProps>
  readonly FallbackComponent: ComponentType<FallbackProps>
  readonly styles: DockLayoutStyles
  readonly layout: DockLayout
  readonly dispatch: LayoutDispatch
  readonly className?: string
}

export const DockLayoutView: FunctionComponent<DockLayoutViewProps> = (props) => {
  const { FallbackComponent } = props

  return (
    <PanelErrorBoundary FallbackComponent={FallbackComponent}>
      <InternalDockLayoutView {...props} />
    </PanelErrorBoundary>
  )
}

const InternalDockLayoutView: FunctionComponent<DockLayoutViewProps> = ({
  TabTitleComponent,
  FallbackComponent,
  styles,
  layout,
  dispatch,
  className
}) => {
  const [draggedTab, setDraggedTab] = useState<Tab | undefined>(undefined)

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 10
    }
  })

  const sensors = useSensors(mouseSensor)

  // Custom collision detection to treat tab-lists as the last tab in their pane.
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const collisions = pointerWithin(args)
    if (collisions.length === 0) {
      return collisions
    }

    const firstCollision = collisions[0]
    const dropTarget = parsePaneNodeDropTarget(firstCollision.id.toString())
    if (dropTarget == null || dropTarget.target !== 'tab-list') {
      return collisions
    }

    const tabId = findPaneById(layout, dropTarget.nodeId)?.tabs.at(-1)?.id
    if (tabId == null) {
      return collisions
    }

    return [{ ...firstCollision, id: tabId }]
  }, [layout])

  const onDragStart = useCallback(({ active }: DragStartEvent) => {
    const activeId = active.id.toString() as TabId
    const sourcePane = findPaneByTabId(layout, activeId)
    setDraggedTab(sourcePane?.tabs.find((tab) => tab.id === activeId))
  }, [layout])

  const finalizeDrag = useCallback(() => {
    // Delay resetting drag state as HeadlessUI may still mess with focus during the same tick
    queueMicrotask(() => {
      setDraggedTab(undefined)
    })
  }, [])

  const onDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    dispatch((layout) => {
      if (over == null) {
        return layout
      }

      const activeId = active.id.toString() as TabId

      const dropTarget = parsePaneNodeDropTarget(over.id.toString())
      const overPane = dropTarget != null ? findPaneById(layout, dropTarget.nodeId) : undefined

      if (dropTarget != null && overPane != null) {
        return dropTarget.target === 'center' || dropTarget.target === 'tab-list'
          ? moveTabIntoPane(layout, activeId, overPane.id)
          : moveTabToSplit(layout, activeId, overPane.id, dropTarget.target)
      }

      return moveTabBetweenPanes(layout, activeId, over.id.toString() as TabId)
    })

    finalizeDrag()
  }, [dispatch, finalizeDrag])

  return (
    <DndContext
      collisionDetection={collisionDetection}
      sensors={sensors}
      onDragStart={onDragStart}
      onDragCancel={finalizeDrag}
      onDragEnd={onDragEnd}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }} className={className}>
        {layout.main == null && (
          <div style={{ width: '100%', height: '100%' }} />
        )}
        {layout.main != null && (
          <LayoutNodeView
            TabTitleComponent={TabTitleComponent}
            FallbackComponent={FallbackComponent}
            styles={styles}
            node={layout.main}
            focusedTabId={layout.focusedTabId}
            dispatch={draggedTab != null ? undefined : dispatch}
          />
        )}
      </div>

      {draggedTab != null && (
        <DragOverlay
          dropAnimation={null}
          modifiers={[snapOverlayTopLeftToCursor]}
          style={{ pointerEvents: 'none', opacity: DRAGGED_TAB_OPACITY }}
        >
          <PanelTabTitle TabTitleComponent={TabTitleComponent} tab={draggedTab} state='dragging' />
        </DragOverlay>
      )}
    </DndContext>
  )
}
