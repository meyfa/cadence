import { useDroppable } from '@dnd-kit/core'
import { horizontalListSortingStrategy, SortableContext } from '@dnd-kit/sortable'
import { TabGroup, TabList, TabPanels } from '@headlessui/react'
import type { CSSProperties, FunctionComponent, PropsWithChildren, WheelEvent } from 'react'
import { useCallback, useRef } from 'react'
import { removeTabFromPane, transformNode, updateFocusedTab } from '../algorithms/mutate.js'
import type { LayoutNodeId, PaneNode, TabId } from '../types.js'
import type { DockLayoutStyles } from './DockLayoutView.js'
import type { LayoutNodeViewProps } from './LayoutNodeView.js'
import { TabContent } from './TabContent.js'
import { parseTabDropTarget, TabTitle } from './TabTitle.js'

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
  FallbackComponent,
  styles,
  node,
  focusedTabId,
  currentDropTargetId,
  dispatch
}) => {
  const { id: nodeId, tabs, activeTabId } = node
  const tabDropTarget = currentDropTargetId != null ? parseTabDropTarget(currentDropTargetId) : undefined
  const paneDropTarget = currentDropTargetId != null ? parsePaneNodeDropTarget(currentDropTargetId) : undefined
  const tabListElementRef = useRef<HTMLDivElement | null>(null)
  const endDropAreaElementRef = useRef<HTMLDivElement | null>(null)
  const tabElementsRef = useRef(new Map<TabId, HTMLDivElement>())

  const onTabFocus = useCallback((id: TabId) => {
    dispatch?.((layout) => updateFocusedTab(layout, id))
  }, [dispatch])

  const selectedIndex = Math.max(0, tabs.findIndex((tab) => tab.id === activeTabId))

  const onSelectionChange = useCallback((index: number) => {
    const selectedTab = tabs.at(index)
    if (selectedTab != null) {
      dispatch?.((layout) => transformNode(layout, nodeId, (node) => {
        if (node.type !== 'pane') {
          return node
        }
        return { ...node, activeTabId: selectedTab.id }
      }))
      onTabFocus(selectedTab.id)
    }
  }, [dispatch, onTabFocus, nodeId, tabs])

  const onClose = useCallback((id: TabId) => {
    dispatch?.((layout) => removeTabFromPane(layout, id))
  }, [dispatch])

  const setTabListElement = useCallback((element: HTMLDivElement | null) => {
    tabListElementRef.current = element
  }, [])

  const setTabElement = useCallback((tabId: TabId, element: HTMLDivElement | null) => {
    if (element == null) {
      tabElementsRef.current.delete(tabId)
      return
    }

    tabElementsRef.current.set(tabId, element)
  }, [])

  const setEndDropAreaElement = useCallback((element: HTMLDivElement | null) => {
    endDropAreaElementRef.current = element
  }, [])

  const dropIndicatorOffset = getDropIndicatorOffset(
    node.id,
    tabDropTarget,
    paneDropTarget,
    tabListElementRef.current,
    tabElementsRef.current,
    endDropAreaElementRef.current
  )

  return (
    <TabGroup
      selectedIndex={selectedIndex}
      onChange={onSelectionChange}
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <TabListDroppable
        node={node}
        styles={styles}
        dropIndicatorOffset={dropIndicatorOffset}
        onElementRef={setTabListElement}
        onEndDropAreaElementRef={setEndDropAreaElement}
      >
        <SortableContext items={tabs.map((tab) => tab.id)} strategy={horizontalListSortingStrategy}>
          {tabs.map((tab) => (
            <TabTitle
              key={tab.id}
              TabTitleComponent={TabTitleComponent}
              onElementRef={setTabElement}
              tab={tab}
              state={tab.id === focusedTabId ? 'focused' : tab.id === activeTabId ? 'active' : 'inactive'}
              onTabFocus={() => onTabFocus(tab.id)}
              onClose={() => onClose(tab.id)}
            />
          ))}
        </SortableContext>
      </TabListDroppable>
      <TabPanelsDroppable node={node} styles={styles}>
        {tabs.map((tab) => (
          <TabContent
            key={tab.id}
            FallbackComponent={FallbackComponent}
            tab={tab}
            dispatch={dispatch}
          />
        ))}
      </TabPanelsDroppable>
    </TabGroup>
  )
}

const TabListDroppable: FunctionComponent<PropsWithChildren<{
  node: PaneNode
  styles: DockLayoutStyles
  dropIndicatorOffset?: number
  onElementRef: (element: HTMLDivElement | null) => void
  onEndDropAreaElementRef: (element: HTMLDivElement | null) => void
}>> = ({ children, node, styles, dropIndicatorOffset, onElementRef, onEndDropAreaElementRef }) => {
  const onWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    const { currentTarget, deltaY, shiftKey } = event

    if (shiftKey || deltaY === 0 || currentTarget.scrollWidth <= currentTarget.clientWidth) {
      return
    }

    const maxScrollLeft = currentTarget.scrollWidth - currentTarget.clientWidth
    const scrollAmount = deltaY * 0.5

    const nextScrollLeft = Math.max(0, Math.min(maxScrollLeft, currentTarget.scrollLeft + scrollAmount))

    if (nextScrollLeft !== currentTarget.scrollLeft) {
      currentTarget.scrollLeft = nextScrollLeft
      event.preventDefault()
    }
  }, [])

  return (
    <TabList
      ref={onElementRef}
      onWheel={onWheel}
      style={{
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        overflowX: 'auto',
        overflowY: 'hidden',
        backgroundColor: styles.tabListBackgroundColor,
        borderBottom: `1px solid ${styles.tabListBorderColor}`,
        scrollbarWidth: 'thin'
      }}
    >
      {children}
      <TabListEndDropArea node={node} onElementRef={onEndDropAreaElementRef} />
      <TabDropIndicator dropIndicatorColor={styles.dropIndicatorColor} offset={dropIndicatorOffset} />
    </TabList>
  )
}

const TabListEndDropArea: FunctionComponent<{
  node: PaneNode
  onElementRef: (element: HTMLDivElement | null) => void
}> = ({ node, onElementRef }) => {
  const { setNodeRef } = useDroppable({
    id: getPaneNodeDropTargetId(node, 'tab-list')
  })

  const setElementRef = useCallback((element: HTMLDivElement | null) => {
    setNodeRef(element)
    onElementRef(element)
  }, [onElementRef, setNodeRef])

  return (
    <div
      ref={setElementRef}
      style={{ position: 'relative', flex: 1, alignSelf: 'stretch', minWidth: '1rem' }}
    />
  )
}

const TabDropIndicator: FunctionComponent<{
  dropIndicatorColor: string
  offset?: number
}> = ({ dropIndicatorColor, offset }) => {
  return (
    <div
      style={{
        display: offset != null ? 'block' : 'none',
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: offset != null ? `${offset}px` : undefined,
        width: '0.125rem',
        transform: 'translateX(-50%)',
        backgroundColor: dropIndicatorColor,
        pointerEvents: 'none'
      }}
    />
  )
}

function getDropIndicatorOffset (
  nodeId: LayoutNodeId,
  tabDropTarget: ReturnType<typeof parseTabDropTarget>,
  paneDropTarget: ReturnType<typeof parsePaneNodeDropTarget>,
  tabListElement: HTMLDivElement | null,
  tabElements: ReadonlyMap<TabId, HTMLDivElement>,
  endDropAreaElement: HTMLDivElement | null
): number | undefined {
  if (tabListElement == null) {
    return undefined
  }

  const tabListRect = tabListElement.getBoundingClientRect()
  const scrollOffset = tabListElement.scrollLeft

  if (tabDropTarget != null) {
    const tabElement = tabElements.get(tabDropTarget.tabId)
    if (tabElement == null) {
      return undefined
    }

    const tabRect = tabElement.getBoundingClientRect()
    return tabDropTarget.position === 'before'
      ? scrollOffset + tabRect.left - tabListRect.left
      : scrollOffset + tabRect.right - tabListRect.left
  }

  if (paneDropTarget?.nodeId === nodeId && paneDropTarget.target === 'tab-list' && endDropAreaElement != null) {
    return scrollOffset + endDropAreaElement.getBoundingClientRect().left - tabListRect.left
  }

  return undefined
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

const dropHitAreaStyles: Record<PaneNodeDropZone, CSSProperties> = {
  north: { inset: 0, bottom: '80%' },
  south: { inset: 0, top: '80%' },
  east: { inset: 0, left: '80%' },
  west: { inset: 0, right: '80%' },
  center: { inset: 0 }
}

const dropVisualStyles: Record<PaneNodeDropZone, CSSProperties> = {
  north: { inset: 0, bottom: '50%' },
  south: { inset: 0, top: '50%' },
  east: { inset: 0, left: '50%' },
  west: { inset: 0, right: '50%' },
  center: { inset: 0 }
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
    <div style={{ pointerEvents: isOver ? 'auto' : 'none' }}>
      <div
        ref={setNodeRef}
        style={{
          position: 'absolute',
          ...dropHitAreaStyles[zone]
        }}
      />
      <div
        style={{
          position: 'absolute',
          opacity: 0.25,
          transition: 'background-color 200ms',
          backgroundColor: isOver ? styles.highlightColor : undefined,
          ...dropVisualStyles[zone]
        }}
      />
    </div>
  )
}
