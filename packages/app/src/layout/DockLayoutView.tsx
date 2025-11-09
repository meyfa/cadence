import { closestCenter, DndContext, DragOverlay, MouseSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { findPaneByTabId, moveTabBetweenPanes } from '@editor/layout/layout.js'
import type { DockLayout, Tab, TabId } from '@editor/state/layout.js'
import clsx from 'clsx'
import { useCallback, useState, type FunctionComponent } from 'react'
import { TabComponent } from '../components/TabComponent.js'
import { useTabRendererContext } from '../panes/render-tab.js'
import { useLayoutNodeDispatch, type LayoutDispatch } from '../state/LayoutContext.js'
import { renderNode } from './render-node.js'

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

  const onDragStart = useCallback(({ active }: DragStartEvent) => {
    const activeId = active.id.toString() as TabId
    const sourcePane = findPaneByTabId(layout, activeId)
    setDraggedTab(sourcePane?.tabs.find((tab) => tab.id === activeId))
  }, [layout])

  const onDragOver = useCallback(({ active, over }: DragEndEvent) => {
    // TODO show split preview
  }, [])

  const finalizeDrag = useCallback(() => {
    // Delay resetting drag state as HeadlessUI may still mess with focus during the same tick
    queueMicrotask(() => {
      setDraggedTab(undefined)
    })
  }, [])

  const onDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    dispatch((layout) => {
      const activeId = active.id.toString() as TabId
      const overId = (over ?? active).id.toString() as TabId
      return moveTabBetweenPanes(layout, activeId, overId)
    })

    finalizeDrag()
  }, [dispatch, finalizeDrag])

  return (
    <DndContext
      collisionDetection={closestCenter}
      sensors={sensors}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragCancel={finalizeDrag}
      onDragEnd={onDragEnd}
    >
      <div className={clsx('flex flex-col', className)}>
        {renderNode(layout.main, tabRendererContext, draggedTab != null ? undefined : mainDispatch)}
      </div>

      {draggedTab != null && (
        <DragOverlay dropAnimation={null} className='opacity-60'>
          <TabComponent tab={draggedTab} context={tabRendererContext} disabled={true} selected={true} />
        </DragOverlay>
      )}
    </DndContext>
  )
}
