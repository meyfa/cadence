import { DndContext, DragOverlay, MouseSensor, pointerWithin, useSensor, useSensors, type CollisionDetection, type DragEndEvent, type DragStartEvent, type Modifier } from '@dnd-kit/core'
import { getEventCoordinates } from '@dnd-kit/utilities'
import { findPaneById, findPaneByTabId, moveTabBetweenPanes, moveTabIntoPane, moveTabToSplit } from '@editor/layout/layout.js'
import type { DockLayout, Tab, TabId } from '@editor/state/layout.js'
import clsx from 'clsx'
import { useCallback, useState, type FunctionComponent } from 'react'
import { TabComponent } from '../components/TabComponent.js'
import { useTabRendererContext } from '../panes/render-tab.js'
import { useLayoutNodeDispatch, type LayoutDispatch } from '../state/LayoutContext.js'
import { parsePaneNodeDropTarget } from './PaneNodeView.js'
import { renderNode } from './render-node.js'

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

export const DockLayoutView: FunctionComponent<{
  className?: string
  layout: DockLayout
  dispatch: LayoutDispatch
}> = ({ className, layout, dispatch }) => {
  const mainDispatch = useLayoutNodeDispatch(dispatch, 'main')

  // Passed down to not call for every tab pane
  const tabRendererContext = useTabRendererContext()

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
      <div className={clsx('flex flex-col', className)}>
        {renderNode(layout.main, tabRendererContext, draggedTab != null ? undefined : mainDispatch)}
      </div>

      {draggedTab != null && (
        <DragOverlay
          dropAnimation={null}
          modifiers={[snapOverlayTopLeftToCursor]}
          className='pointer-events-none opacity-60 shadow-sm'
        >
          <TabComponent tab={draggedTab} context={tabRendererContext} disabled={true} selected={true} />
        </DragOverlay>
      )}
    </DndContext>
  )
}
