import { useDroppable } from '@dnd-kit/core'
import { horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable'
import type { LayoutNodeId, Tab as LayoutTab, PaneNode, SerializedComponent } from '@editor/state/layout.js'
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react'
import clsx from 'clsx'
import { useCallback, type FunctionComponent, type PropsWithChildren } from 'react'
import { TabComponent } from '../components/TabComponent.js'
import { renderTabContent, type TabRendererContext } from '../panes/render-tab.js'
import type { LayoutNodeDispatch } from '../state/LayoutContext.js'

const paneNodeDropZones = ['north', 'south', 'east', 'west', 'center'] as const
type PaneNodeDropZone = typeof paneNodeDropZones[number]

const paneNodeDropTargets = [...paneNodeDropZones, 'tab-list'] as const
type PaneNodeDropTarget = typeof paneNodeDropTargets[number]

function getPaneNodeDropTargetId (node: PaneNode, zone: PaneNodeDropTarget): string {
  return `${node.id}:${zone}`
}

export function parsePaneNodeDropTarget (id: string): { nodeId: LayoutNodeId, target: PaneNodeDropTarget } | undefined {
  const [nodeId, target] = id.split(':')
  if (paneNodeDropTargets.includes(target as PaneNodeDropTarget)) {
    return {
      nodeId: nodeId as LayoutNodeId,
      target: target as PaneNodeDropTarget
    }
  }

  return undefined
}

export const PaneNodeView: FunctionComponent<{
  node: PaneNode
  tabRendererContext: TabRendererContext
  dispatch?: LayoutNodeDispatch
}> = ({ node, tabRendererContext, dispatch }) => {
  const { tabs, activeTabId } = node

  const selectedIndex = tabs.findIndex((tab) => tab.id === activeTabId)
  const onSelectionChange = useCallback((index: number) => {
    const selectedTab = tabs.at(index)
    if (selectedTab != null) {
      dispatch?.((node) => {
        if (node.type !== 'pane') {
          return node
        }

        return { ...node, activeTabId: selectedTab.id }
      })
    }
  }, [dispatch, tabs])

  return (
    <TabGroup
      className='flex flex-col h-full'
      selectedIndex={selectedIndex >= 0 ? selectedIndex : 0}
      onChange={onSelectionChange}
    >
      <TabListDroppable node={node} className='bg-surface-200 border-b border-b-frame-200 flex items-center'>
        <SortableContext
          items={tabs.map((tab) => tab.id)}
          strategy={horizontalListSortingStrategy}
        >
          {tabs.map((tab) => (
            <TabTitle key={tab.id} tab={tab} context={tabRendererContext} />
          ))}
        </SortableContext>
      </TabListDroppable>
      <TabPanelsDroppable node={node} className='flex-1 min-h-0 min-w-0'>
        {tabs.map((tab) => (
          <TabContent key={tab.id} component={tab.component} context={tabRendererContext} />
        ))}
      </TabPanelsDroppable>
    </TabGroup>
  )
}

const TabListDroppable: FunctionComponent<PropsWithChildren<{
  node: PaneNode
  className?: string
}>> = ({ node, className, children }) => {
  const { setNodeRef } = useDroppable({
    id: getPaneNodeDropTargetId(node, 'tab-list')
  })

  return (
    <TabList ref={setNodeRef} className={clsx('relative', className)}>
      {children}
    </TabList>
  )
}

const TabPanelsDroppable: FunctionComponent<PropsWithChildren<{
  node: PaneNode
  className?: string
}>> = ({ node, className, children }) => {
  return (
    <TabPanels className={clsx('relative', className)}>
      {children}

      {paneNodeDropZones.map((zone) => (
        <PaneNodeDropArea key={zone} node={node} zone={zone} />
      ))}
    </TabPanels>
  )
}

const PaneNodeDropArea: FunctionComponent<{
  node: PaneNode
  zone: PaneNodeDropZone
}> = ({ node, zone }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: getPaneNodeDropTargetId(node, zone)
  })

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'absolute pointer-events-none opacity-20 transition-colors duration-200',
        zone === 'north' && 'top-0 left-0 right-0 h-1/4',
        zone === 'south' && 'bottom-0 left-0 right-0 h-1/4',
        zone === 'east' && 'top-0 right-0 bottom-0 w-1/4',
        zone === 'west' && 'top-0 left-0 bottom-0 w-1/4',
        zone === 'center' && 'inset-0',
        isOver && 'bg-accent-600 dark:bg-accent-400'
      )}
    />
  )
}

const TabTitle: FunctionComponent<{
  tab: LayoutTab
  context: TabRendererContext
}> = ({ tab, context }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging, isOver, isSorting } = useSortable({ id: tab.id })

  const showDropIndicator = isOver && !isDragging
  const dropIndicatorOnRightSide = showDropIndicator && (transform?.x ?? 0) < 0

  return (
    <Tab ref={setNodeRef} {...attributes} {...listeners} className='outline-none relative'>
      {({ disabled, selected }) => (
        <>
          <TabComponent tab={tab} context={context} disabled={disabled || isSorting} selected={selected} />
          {showDropIndicator && (
            <div className={clsx(
              'absolute top-0 bottom-0 w-0.5 bg-content-300',
              dropIndicatorOnRightSide ? 'right-0' : 'left-0'
            )}
            />
          )}
        </>
      )}
    </Tab>
  )
}

const TabContent: FunctionComponent<{
  component: SerializedComponent
  context: TabRendererContext
}> = ({ component, context }) => {
  return (
    <TabPanel unmount={false} className='h-full w-full relative'>
      {renderTabContent(component, context)}
    </TabPanel>
  )
}
