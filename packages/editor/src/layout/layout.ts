import { randomId } from '@editor/utilities/id.js'
import type { DockLayout, LayoutNode, LayoutNodeId, PaneNode, SerializedComponent, SplitNode, Tab, TabId } from '../state/layout.js'
import { arrayInsert, arrayMove, arrayRemove } from '../utilities/arrays.js'

export function findPane (layout: DockLayout, predicate: (pane: PaneNode) => boolean): PaneNode | undefined {
  const findInNode = (node: LayoutNode): PaneNode | undefined => {
    switch (node.type) {
      case 'pane':
        return predicate(node) ? node : undefined
      case 'split':
        return node.children.map(findInNode).find((item) => item != null)
    }
  }

  return layout.main != null ? findInNode(layout.main) : undefined
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
      main: newPane
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
  ]))
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
        tabs: arrayRemove(pane.tabs, tabIndex)
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
  ]), { normalize: false })
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
        tabs: arrayRemove(sourcePane.tabs, tabIndex)
      }
    ],
    [
      targetPane.id,
      {
        ...targetPane,
        tabs: arrayInsert(targetPane.tabs, insertPosition, tab),
        activeTabId: tabId
      }
    ]
  ]))
}

export function moveTabBetweenPanes (layout: DockLayout, tabId: TabId, beforeTabId: TabId): DockLayout {
  const sourcePane = findPaneByTabId(layout, tabId)
  const targetPane = findPaneByTabId(layout, beforeTabId)
  if (sourcePane == null || targetPane == null) {
    return layout
  }

  // We know for sure that both tabs exist in their panes
  const tabIndex = sourcePane.tabs.findIndex((tab) => tab.id === tabId)
  const beforeTabIndex = targetPane.tabs.findIndex((tab) => tab.id === beforeTabId)

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

  return updateNodesInLayout(layout, new Map([
    [
      sourcePane.id,
      {
        ...sourcePane,
        tabs: arrayRemove(sourcePane.tabs, tabIndex)
      }
    ],
    [
      targetPane.id,
      {
        ...targetPane,
        tabs: arrayInsert(targetPane.tabs, beforeTabIndex, sourcePane.tabs[tabIndex]),
        activeTabId: tabId
      }
    ]
  ]))
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
        tabs: arrayRemove(sourcePane.tabs, tabIndex)
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
  ]))
}

type NodeUpdates = ReadonlyMap<LayoutNodeId, LayoutNode>

interface NodeUpdateOptions {
  readonly normalize?: boolean
}

function updateNodesInLayout (layout: DockLayout, updates: NodeUpdates, options?: NodeUpdateOptions): DockLayout {
  const applied = new Set<LayoutNodeId>()

  const updateNode = (node: LayoutNode): LayoutNode => {
    const updatedNode = applied.has(node.id) ? node : (updates.get(node.id) ?? node)
    applied.add(node.id)

    switch (updatedNode.type) {
      case 'pane':
        return updatedNode
      case 'split':
        return { ...updatedNode, children: updatedNode.children.map(updateNode) }
    }
  }

  const updatedLayout = {
    ...layout,
    main: layout.main != null ? updateNode(layout.main) : undefined
  }

  return options?.normalize === false ? updatedLayout : normalizeLayout(updatedLayout)
}

function normalizeLayout (layout: DockLayout): DockLayout {
  const normalizePaneNode = (node: PaneNode): LayoutNode | undefined => {
    if (node.tabs.length === 0) {
      return undefined
    }

    if (!node.tabs.some((tab) => tab.id === node.activeTabId)) {
      return { ...node, activeTabId: node.tabs[0].id }
    }

    return node
  }

  const normalizeSplitNode = (node: SplitNode): LayoutNode | undefined => {
    const children: LayoutNode[] = []
    const sizes: number[] = []

    for (const [index, child] of node.children.entries()) {
      const normalized = normalizeNode(child)
      if (normalized != null) {
        children.push(normalized)
        sizes.push(node.sizes[index] ?? 1)
      }
    }

    // If no children remain, remove this node
    if (children.length === 0) {
      return undefined
    }

    // Merge child splits with the same orientation
    const mergedChildren: LayoutNode[] = []
    const mergedSizes: number[] = []

    for (const [index, child] of children.entries()) {
      const size = sizes.at(index) ?? 1

      if (child.type === 'split' && child.orientation === node.orientation) {
        for (const [otherIndex, otherChild] of child.children.entries()) {
          mergedChildren.push(otherChild)
          mergedSizes.push(size * (child.sizes.at(otherIndex) ?? 1))
        }
      } else {
        mergedChildren.push(child)
        mergedSizes.push(size)
      }
    }

    // If only one child remains, lift it up
    if (mergedChildren.length === 1) {
      return mergedChildren[0]
    }

    // Normalize sizes
    const totalSize = mergedSizes.reduce((sum, size) => sum + size, 0)
    const normalizedSizes = mergedSizes.map((size) => size / totalSize)

    return { ...node, children: mergedChildren, sizes: normalizedSizes }
  }

  const normalizeNode = (node: LayoutNode): LayoutNode | undefined => {
    switch (node.type) {
      case 'pane':
        return normalizePaneNode(node)
      case 'split':
        return normalizeSplitNode(node)
    }
  }

  return {
    ...layout,
    main: layout.main != null ? normalizeNode(layout.main) : layout.main
  }
}
