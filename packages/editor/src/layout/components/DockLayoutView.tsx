import { DndContext, DragOverlay, MouseSensor, pointerWithin, useSensor, useSensors, type CollisionDetection, type DragEndEvent, type DragOverEvent, type DragStartEvent, type Modifier } from '@dnd-kit/core'
import { getEventCoordinates } from '@dnd-kit/utilities'
import { useCallback, useState, type ComponentType, type FunctionComponent } from 'react'
import type { FallbackProps } from 'react-error-boundary'
import { findPaneById, findPaneByTabId } from '../algorithms/find.js'
import { moveTabBetweenPanes, moveTabIntoPane, moveTabToPaneEnd, moveTabToSplit } from '../algorithms/mutate.js'
import type { DockLayout, Tab, TabId } from '../types.js'
import type { LayoutDispatch } from './LayoutContext.js'
import { LayoutNodeView } from './LayoutNodeView.js'
import { PanelErrorBoundary } from './PanelErrorBoundary.js'
import { parsePaneNodeDropTarget } from './PaneNodeView.js'
import { PanelTabTitle, parseTabDropTarget, type TabTitleProps } from './TabTitle.js'

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
  const [currentDropTargetId, setCurrentDropTargetId] = useState<string | undefined>(undefined)

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 10
    }
  })

  const sensors = useSensors(mouseSensor)

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const collisions = pointerWithin(args)
    if (collisions.length === 0) {
      return collisions
    }

    const tabDropCollision = collisions.find((collision) => parseTabDropTarget(collision.id.toString()) != null)
    if (tabDropCollision != null) {
      return [tabDropCollision]
    }

    const tabListCollision = collisions.find((collision) => {
      const dropTarget = parsePaneNodeDropTarget(collision.id.toString())
      return dropTarget?.target === 'tab-list'
    })
    if (tabListCollision != null) {
      return [tabListCollision]
    }

    return collisions
  }, [])

  const onDragStart = useCallback(({ active }: DragStartEvent) => {
    const activeId = active.id.toString() as TabId
    const sourcePane = findPaneByTabId(layout, activeId)
    setDraggedTab(sourcePane?.tabs.find((tab) => tab.id === activeId))
    setCurrentDropTargetId(undefined)
  }, [layout])

  const onDragOver = useCallback(({ over }: DragOverEvent) => {
    setCurrentDropTargetId(over?.id.toString())
  }, [])

  const finalizeDrag = useCallback(() => {
    // Delay resetting drag state as HeadlessUI may still mess with focus during the same tick
    queueMicrotask(() => {
      setDraggedTab(undefined)
      setCurrentDropTargetId(undefined)
    })
  }, [])

  const onDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    dispatch((layout) => {
      if (over == null) {
        return layout
      }

      const activeId = active.id.toString() as TabId
      const tabDropTarget = parseTabDropTarget(over.id.toString())

      if (tabDropTarget != null) {
        return moveTabBetweenPanes(layout, activeId, tabDropTarget.tabId, tabDropTarget.position)
      }

      const dropTarget = parsePaneNodeDropTarget(over.id.toString())
      const overPane = dropTarget != null ? findPaneById(layout, dropTarget.nodeId) : undefined

      if (dropTarget != null && overPane != null) {
        if (dropTarget.target === 'center') {
          return moveTabIntoPane(layout, activeId, overPane.id)
        }

        if (dropTarget.target === 'tab-list') {
          return moveTabToPaneEnd(layout, activeId, overPane.id)
        }

        return moveTabToSplit(layout, activeId, overPane.id, dropTarget.target)
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
      onDragOver={onDragOver}
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
            currentDropTargetId={currentDropTargetId}
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
