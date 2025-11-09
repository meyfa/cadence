import type { DockLayout, LayoutNode, LayoutNodeId, PaneNode, TabId } from '../state/layout.js'
import { arrayInsert, arrayMove, arrayRemove } from '../utilities/arrays.js'

export function findPaneByTabId (layout: DockLayout, tabId: TabId): PaneNode | undefined {
  const findInNode = (node: LayoutNode): PaneNode | undefined => {
    switch (node.type) {
      case 'pane':
        return node.tabs.some((tab) => tab.id === tabId) ? node : undefined
      case 'split':
        return node.children.map(findInNode).find((item) => item != null)
    }
  }

  return layout.main != null ? findInNode(layout.main) : undefined
}

export function moveTabBetweenPanes (layout: DockLayout, tabId: TabId, beforeTabId: TabId): DockLayout {
  if (tabId === beforeTabId) {
    return layout
  }

  const sourcePane = findPaneByTabId(layout, tabId)
  const targetPane = findPaneByTabId(layout, beforeTabId)
  if (sourcePane == null || targetPane == null) {
    return layout
  }

  const tabIndex = sourcePane.tabs.findIndex((tab) => tab.id === tabId)
  const beforeTabIndex = targetPane.tabs.findIndex((tab) => tab.id === beforeTabId)
  if (tabIndex < 0 || beforeTabIndex < 0) {
    return layout
  }

  if (sourcePane === targetPane) {
    return updateNodesInLayout(layout, new Map([
      [
        sourcePane.id,
        {
          ...sourcePane,
          tabs: arrayMove([...sourcePane.tabs], tabIndex, beforeTabIndex),
          activeTabId: tabId
        }
      ]
    ]))
  }

  // If the tab was the only tab in the source pane, we cannot move it (for now)
  // TODO Implement pane splitting and merging to handle this
  if (sourcePane.tabs.length <= 1) {
    return layout
  }

  const tabToMove = sourcePane.tabs[tabIndex]
  const activeTabIdAfterMove = sourcePane.activeTabId === tabId
    ? sourcePane.tabs.find((tab) => tab.id !== tabId)?.id ?? ('' as TabId)
    : sourcePane.activeTabId

  return updateNodesInLayout(layout, new Map([
    [
      sourcePane.id,
      {
        ...sourcePane,
        tabs: arrayRemove(sourcePane.tabs, tabIndex),
        activeTabId: activeTabIdAfterMove
      }
    ],
    [
      targetPane.id,
      {
        ...targetPane,
        tabs: arrayInsert(targetPane.tabs, beforeTabIndex, tabToMove),
        activeTabId: tabId
      }
    ]
  ]))
}

function updateNodesInLayout (layout: DockLayout, updates: ReadonlyMap<LayoutNodeId, LayoutNode>): DockLayout {
  const updateNode = (node: LayoutNode): LayoutNode => {
    const updatedNode = updates.get(node.id) ?? node
    switch (updatedNode.type) {
      case 'pane':
        return updatedNode
      case 'split':
        return { ...updatedNode, children: updatedNode.children.map(updateNode) }
    }
  }

  return { ...layout, main: layout.main != null ? updateNode(layout.main) : undefined }
}
