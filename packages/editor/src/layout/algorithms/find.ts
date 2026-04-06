import type { DockLayout, LayoutNode, LayoutNodeId, PaneNode, Tab, TabId } from '../types.js'

export function findNode (layout: DockLayout, predicate: (node: LayoutNode) => boolean): LayoutNode | undefined {
  const findInNode = (node: LayoutNode): LayoutNode | undefined => {
    if (predicate(node)) {
      return node
    }

    if (node.type === 'split') {
      return node.children.map(findInNode).find((item) => item != null)
    }
  }

  return layout.main != null ? findInNode(layout.main) : undefined
}

export function findNodeById (layout: DockLayout, nodeId: LayoutNodeId): LayoutNode | undefined {
  return findNode(layout, (node) => node.id === nodeId)
}

export function findPane (layout: DockLayout, predicate: (pane: PaneNode) => boolean): PaneNode | undefined {
  return findNode(layout, (node) => node.type === 'pane' && predicate(node)) as PaneNode | undefined
}

export function findPaneById (layout: DockLayout, nodeId: LayoutNodeId): PaneNode | undefined {
  return findPane(layout, (pane) => pane.id === nodeId)
}

export function findPaneByTabId (layout: DockLayout, tabId: TabId): PaneNode | undefined {
  return findPane(layout, (pane) => pane.tabs.some((tab) => tab.id === tabId))
}

export function findTab (layout: DockLayout, predicate: (tab: Tab) => boolean): Tab | undefined {
  const findInNode = (node: LayoutNode): Tab | undefined => {
    switch (node.type) {
      case 'pane':
        return node.tabs.find(predicate)
      case 'split':
        return node.children.map(findInNode).find((item) => item != null)
    }
  }

  return layout.main != null ? findInNode(layout.main) : undefined
}

export function findTabByComponentType (layout: DockLayout, componentType: string): Tab | undefined {
  return findTab(layout, (tab) => tab.component.type === componentType)
}
