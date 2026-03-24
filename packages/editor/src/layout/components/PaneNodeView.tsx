import { useDroppable } from '@dnd-kit/core'
import { horizontalListSortingStrategy, SortableContext } from '@dnd-kit/sortable'
import { TabGroup, TabList, TabPanels } from '@headlessui/react'
import { useCallback, type CSSProperties, type FunctionComponent, type PropsWithChildren } from 'react'
import { removeTabFromPane } from '../algorithms.js'
import type { LayoutNodeId, PaneNode, Tab } from '../types.js'
import type { DockLayoutStyles } from './DockLayoutView.js'
import { useLayout } from './LayoutContext.js'
import type { LayoutNodeViewProps } from './LayoutNodeView.js'
import { TabContent } from './TabContent.js'
import { TabTitle } from './TabTitle.js'

const paneNodeDropZones = ['north', 'south', 'east', 'west', 'center'] as const
type PaneNodeDropZone = typeof paneNodeDropZones[number]

const paneNodeDropTargets = [...paneNodeDropZones, 'tab-list'] as const
type PaneNodeDropTarget = typeof paneNodeDropTargets[number]

function getPaneNodeDropTargetId (node: PaneNode, zone: PaneNodeDropTarget): string {
  return `${node.id}:${zone}`
}

interface PaneNodeDropTargetInfo {
  readonly nodeId: LayoutNodeId
  readonly target: PaneNodeDropTarget
}

export function parsePaneNodeDropTarget (id: string): PaneNodeDropTargetInfo | undefined {
  const [nodeId, target] = id.split(':') as [LayoutNodeId, PaneNodeDropTarget]
  return paneNodeDropTargets.includes(target) ? { nodeId, target } : undefined
}

export const PaneNodeView: FunctionComponent<LayoutNodeViewProps<PaneNode>> = ({
  TabTitleComponent,
  TabContentComponent,
  FallbackComponent,
  styles,
  node,
  dispatch,
  onBeforeTabClose
}) => {
  const { tabs, activeTabId } = node

  const selectedIndex = tabs.findIndex((tab) => tab.id === activeTabId)

  const onSelectionChange = useCallback((index: number) => {
    const selectedTab = tabs.at(index)
    if (selectedTab != null) {
      dispatch?.((node) => node.type === 'pane' ? { ...node, activeTabId: selectedTab.id } : node)
    }
  }, [dispatch, tabs])

  // TODO unify this with the LayoutNodeDispatch prop
  const [, layoutDispatch] = useLayout()

  const onClose = useCallback((tab: Tab) => {
    if (onBeforeTabClose?.(tab) === false) {
      return
    }

    layoutDispatch((layout) => removeTabFromPane(layout, tab.id))
  }, [onBeforeTabClose, layoutDispatch])

  return (
    <TabGroup
      selectedIndex={selectedIndex >= 0 ? selectedIndex : 0}
      onChange={onSelectionChange}
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <TabListDroppable node={node} styles={styles}>
        <SortableContext items={tabs.map((tab) => tab.id)} strategy={horizontalListSortingStrategy}>
          {tabs.map((tab) => (
            <TabTitle
              key={tab.id}
              TabTitleComponent={TabTitleComponent}
              dropIndicatorColor={styles.dropIndicatorColor}
              tab={tab}
              onClose={() => onClose(tab)}
            />
          ))}
        </SortableContext>
      </TabListDroppable>
      <TabPanelsDroppable node={node} styles={styles}>
        {tabs.map((tab) => (
          <TabContent
            key={tab.id}
            TabContentComponent={TabContentComponent}
            FallbackComponent={FallbackComponent}
            tab={tab}
          />
        ))}
      </TabPanelsDroppable>
    </TabGroup>
  )
}

const TabListDroppable: FunctionComponent<PropsWithChildren<{
  node: PaneNode
  styles: DockLayoutStyles
}>> = ({ children, node, styles }) => {
  const { setNodeRef } = useDroppable({
    id: getPaneNodeDropTargetId(node, 'tab-list')
  })

  return (
    <TabList
      ref={setNodeRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        backgroundColor: styles.tabListBackgroundColor,
        borderBottom: `1px solid ${styles.tabListBorderColor}`
      }}
    >
      {children}
    </TabList>
  )
}

const TabPanelsDroppable: FunctionComponent<PropsWithChildren<{
  node: PaneNode
  styles: DockLayoutStyles
}>> = ({ children, node, styles }) => {
  return (
    <TabPanels style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}>
      {children}
      {paneNodeDropZones.map((zone) => (
        <PaneNodeDropArea key={zone} node={node} zone={zone} styles={styles} />
      ))}
    </TabPanels>
  )
}

const dropStyles: Record<PaneNodeDropZone, CSSProperties> = {
  north: { top: 0, left: 0, right: 0, height: '25%' },
  south: { bottom: 0, left: 0, right: 0, height: '25%' },
  east: { top: 0, right: 0, bottom: 0, width: '25%' },
  west: { top: 0, left: 0, bottom: 0, width: '25%' },
  center: { top: 0, left: 0, right: 0, bottom: 0 }
}

const PaneNodeDropArea: FunctionComponent<{
  node: PaneNode
  zone: PaneNodeDropZone
  styles: DockLayoutStyles
}> = ({ node, zone, styles }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: getPaneNodeDropTargetId(node, zone)
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        position: 'absolute',
        pointerEvents: 'none',
        opacity: 0.25,
        transition: 'background-color 200ms',
        backgroundColor: isOver ? styles.highlightColor : undefined,
        ...dropStyles[zone]
      }}
    />
  )
}
