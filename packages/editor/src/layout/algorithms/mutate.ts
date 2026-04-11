import { insertAt, randomId, removeAt } from '@utility'
import type { DockLayout, LayoutNode, LayoutNodeId, PaneNode, SerializedComponent, Tab, TabId } from '../types.js'
import { findNodeById, findPaneById, findPaneByTabId, findTabByComponentType } from './find.js'
import { updateNodesInLayout } from './internal.js'

type TabInsertionPosition = 'before' | 'after'

export function transformNode (layout: DockLayout, nodeId: LayoutNodeId, fn: (node: LayoutNode) => LayoutNode): DockLayout {
  const node = findNodeById(layout, nodeId)
  if (node == null) {
    return layout
  }

  return updateNodesInLayout(layout, new Map([[nodeId, fn(node)]]))
}

export function createTab (layout: DockLayout, component: SerializedComponent): DockLayout {
  // TODO Improve tab placement logic

  const tab: Tab = {
    id: randomId() as TabId,
    component
  }

  // Find the "largest" tab pane
  let targetPane: PaneNode | undefined
  let targetPaneSize = 0

  const recurse = (node: LayoutNode, size: number): void => {
    switch (node.type) {
      case 'pane':
        if (size > targetPaneSize) {
          targetPane = node
          targetPaneSize = size
        }
        break

      case 'split':
        for (const [index, child] of node.children.entries()) {
          const childSize = size * (node.sizes.at(index) ?? 1)
          recurse(child, childSize)
        }
        break
    }
  }

  if (layout.main != null) {
    recurse(layout.main, 1)
  }

  // Create a new pane if none exists
  if (targetPane == null) {
    const newPane: PaneNode = {
      type: 'pane',
      id: randomId() as LayoutNodeId,
      tabs: [tab],
      activeTabId: tab.id
    }

    return {
      ...layout,
      main: newPane,
      focusedTabId: tab.id
    }
  }

  return updateNodesInLayout(layout, new Map([
    [
      targetPane.id,
      {
        ...targetPane,
        tabs: [...targetPane.tabs, tab],
        activeTabId: tab.id
      }
    ]
  ]), { focusTabId: tab.id })
}

export function removeTabFromPane (layout: DockLayout, tabId: TabId): DockLayout {
  const pane = findPaneByTabId(layout, tabId)
  if (pane == null) {
    return layout
  }

  const tabIndex = pane.tabs.findIndex((tab) => tab.id === tabId)
  if (tabIndex === -1) {
    return layout
  }

  return updateNodesInLayout(layout, new Map([
    [
      pane.id,
      {
        ...pane,
        tabs: removeAt(pane.tabs, tabIndex)
      }
    ]
  ]))
}

export function activateTabInPane (layout: DockLayout, tabId: TabId): DockLayout {
  const pane = findPaneByTabId(layout, tabId)
  if (pane == null) {
    return layout
  }

  return updateNodesInLayout(layout, new Map([
    [
      pane.id,
      {
        ...pane,
        activeTabId: tabId
      }
    ]
  ]), { normalize: false, focusTabId: tabId })
}

export function moveTabIntoPane (layout: DockLayout, tabId: TabId, targetNodeId: LayoutNodeId): DockLayout {
  const sourcePane = findPaneByTabId(layout, tabId)
  const targetPane = findPaneById(layout, targetNodeId)

  if (sourcePane == null || targetPane == null || sourcePane === targetPane) {
    return activateTabInPane(layout, tabId)
  }

  // This must exist
  const tabIndex = sourcePane.tabs.findIndex((tab) => tab.id === tabId)
  const tab = sourcePane.tabs[tabIndex]

  // If not found, the tab will be inserted at the start
  const insertPosition = targetPane.tabs.findIndex((tab) => tab.id === targetPane.activeTabId) + 1

  return updateNodesInLayout(layout, new Map([
    [
      sourcePane.id,
      {
        ...sourcePane,
        tabs: removeAt(sourcePane.tabs, tabIndex)
      }
    ],
    [
      targetPane.id,
      {
        ...targetPane,
        tabs: insertAt(targetPane.tabs, insertPosition, tab),
        activeTabId: tabId
      }
    ]
  ]), { focusTabId: tabId })
}

export function moveTabBetweenPanes (
  layout: DockLayout,
  tabId: TabId,
  targetTabId: TabId,
  position: TabInsertionPosition = 'before'
): DockLayout {
  const sourcePane = findPaneByTabId(layout, tabId)
  const targetPane = findPaneByTabId(layout, targetTabId)
  if (sourcePane == null || targetPane == null) {
    return layout
  }

  const targetTabIndex = targetPane.tabs.findIndex((tab) => tab.id === targetTabId)

  return moveTabToPaneIndex(layout, tabId, targetPane.id, targetTabIndex + (position === 'after' ? 1 : 0))
}

export function moveTabToPaneEnd (layout: DockLayout, tabId: TabId, targetNodeId: LayoutNodeId): DockLayout {
  const targetPane = findPaneById(layout, targetNodeId)
  if (targetPane == null) {
    return layout
  }

  return moveTabToPaneIndex(layout, tabId, targetPane.id, targetPane.tabs.length)
}

export function activateTabOfType (layout: DockLayout, type: string, create: () => SerializedComponent): DockLayout {
  const tab = findTabByComponentType(layout, type)

  // If no such tab exists, create one
  if (tab == null) {
    return createTab(layout, create())
  }

  return activateTabInPane(layout, tab.id)
}

export function updateFocusedTab (layout: DockLayout, tabId: TabId): DockLayout {
  return updateNodesInLayout(layout, new Map(), { focusTabId: tabId })
}

function moveTabToPaneIndex (layout: DockLayout, tabId: TabId, targetNodeId: LayoutNodeId, targetIndex: number): DockLayout {
  const sourcePane = findPaneByTabId(layout, tabId)
  const targetPane = findPaneById(layout, targetNodeId)
  if (sourcePane == null || targetPane == null) {
    return layout
  }

  const tabIndex = sourcePane.tabs.findIndex((tab) => tab.id === tabId)
  if (tabIndex === -1) {
    return layout
  }

  const tab = sourcePane.tabs[tabIndex]
  const targetTabCount = targetPane.tabs.length
  const normalizedTargetIndex = Math.max(0, Math.min(targetIndex, targetTabCount))

  if (sourcePane === targetPane) {
    const adjustedTargetIndex = normalizedTargetIndex > tabIndex ? normalizedTargetIndex - 1 : normalizedTargetIndex
    const remainingTabs = removeAt(sourcePane.tabs, tabIndex)

    return updateNodesInLayout(layout, new Map([
      [
        sourcePane.id,
        {
          ...sourcePane,
          tabs: insertAt(remainingTabs, adjustedTargetIndex, tab),
          activeTabId: tabId
        }
      ]
    ]), { focusTabId: tabId })
  }

  return updateNodesInLayout(layout, new Map([
    [
      sourcePane.id,
      {
        ...sourcePane,
        tabs: removeAt(sourcePane.tabs, tabIndex)
      }
    ],
    [
      targetPane.id,
      {
        ...targetPane,
        tabs: insertAt(targetPane.tabs, normalizedTargetIndex, tab),
        activeTabId: tabId
      }
    ]
  ]), { focusTabId: tabId })
}

export type SplitPlacement = 'north' | 'south' | 'east' | 'west'

export function moveTabToSplit (layout: DockLayout, tabId: TabId, siblingId: LayoutNodeId, placement: SplitPlacement): DockLayout {
  const sourcePane = findPaneByTabId(layout, tabId)
  if (sourcePane == null) {
    return layout
  }

  // We know for sure this index exists
  const tabIndex = sourcePane.tabs.findIndex((tab) => tab.id === tabId)
  const tab = sourcePane.tabs[tabIndex]

  // First pass: remove the tab from its source pane

  const layoutAfterRemoval = updateNodesInLayout(layout, new Map([
    [
      sourcePane.id,
      {
        ...sourcePane,
        tabs: removeAt(sourcePane.tabs, tabIndex)
      }
    ]
  ]), { normalize: false })

  // Second pass: create a new pane with the moved tab and insert it into a new split

  const siblingNode = findPaneById(layoutAfterRemoval, siblingId)
  if (siblingNode == null) {
    // Cannot find the sibling node, abort
    return layout
  }

  const splitOrientation = (placement === 'north' || placement === 'south') ? 'vertical' : 'horizontal'
  const isBefore = placement === 'north' || placement === 'west'

  const newPaneNode: PaneNode = {
    type: 'pane',
    id: randomId() as LayoutNodeId,
    tabs: [tab],
    activeTabId: tab.id
  }

  return updateNodesInLayout(layoutAfterRemoval, new Map([
    [
      siblingNode.id,
      {
        type: 'split',
        id: randomId() as LayoutNodeId,
        orientation: splitOrientation,
        sizes: [0.5, 0.5],
        children: isBefore ? [newPaneNode, siblingNode] : [siblingNode, newPaneNode]
      }
    ]
  ]), { focusTabId: tab.id })
}
