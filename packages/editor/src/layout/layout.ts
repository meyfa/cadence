import type { DockLayout, LayoutNode, LayoutNodeId, PaneNode, SplitNode, TabId } from '../state/layout.js'
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

export function moveTabIntoPane (
  layout: DockLayout,
  tabId: TabId,
  targetNodeId: LayoutNodeId
): DockLayout {
  const sourcePane = findPaneByTabId(layout, tabId)
  const targetPane = findPaneById(layout, targetNodeId)
  if (sourcePane == null || targetPane == null) {
    return layout
  }

  if (sourcePane === targetPane) {
    return updateNodesInLayout(layout, new Map([
      [
        sourcePane.id,
        {
          ...sourcePane,
          activeTabId: tabId
        }
      ]
    ]))
  }

  const tabIndex = sourcePane.tabs.findIndex((tab) => tab.id === tabId)
  const tab = sourcePane.tabs.at(tabIndex)
  const selectedTab = targetPane.tabs.find((tab) => tab.id === targetPane.activeTabId) ?? targetPane.tabs.at(0)
  if (tab == null || selectedTab == null) {
    return layout
  }

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
        tabs: arrayInsert(
          targetPane.tabs,
          targetPane.tabs.findIndex((t) => t.id === selectedTab.id) + 1,
          tab
        ),
        activeTabId: tab.id
      }
    ]
  ]))
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

export function moveTabToSplit (
  layout: DockLayout,
  tabId: TabId,
  siblingNodeId: LayoutNodeId,
  placement: 'north' | 'south' | 'east' | 'west'
): DockLayout {
  const sourcePane = findPaneByTabId(layout, tabId)
  if (sourcePane == null) {
    return layout
  }

  const tabIndex = sourcePane.tabs.findIndex((tab) => tab.id === tabId)
  if (tabIndex < 0) {
    return layout
  }

  // First pass: remove the tab from its source pane

  const tabToMove = sourcePane.tabs[tabIndex]
  const activeTabIdAfterMove = sourcePane.activeTabId === tabId
    ? sourcePane.tabs.find((tab) => tab.id !== tabId)?.id ?? ('' as TabId)
    : sourcePane.activeTabId

  const layoutAfterRemoval = updateNodesInLayout(layout, new Map([
    [
      sourcePane.id,
      {
        ...sourcePane,
        tabs: arrayRemove(sourcePane.tabs, tabIndex),
        activeTabId: activeTabIdAfterMove
      }
    ]
  ]), { normalize: false })

  // Second pass: create a new pane with the moved tab and insert it into a new split

  const siblingNode = findPaneById(layoutAfterRemoval, siblingNodeId)
  if (siblingNode == null) {
    return layoutAfterRemoval
  }

  const splitDirection = (placement === 'north' || placement === 'south') ? 'vertical' : 'horizontal'
  const isBefore = placement === 'north' || placement === 'west'

  const newPaneNode: PaneNode = {
    type: 'pane',
    id: randomLayoutNodeId(),
    tabs: [tabToMove],
    activeTabId: tabToMove.id
  }

  return updateNodesInLayout(layoutAfterRemoval, new Map([
    [
      siblingNode.id,
      {
        type: 'split',
        id: randomLayoutNodeId(),
        direction: splitDirection,
        sizes: [0.5, 0.5],
        children: isBefore ? [newPaneNode, siblingNode] : [siblingNode, newPaneNode]
      }
    ]
  ]))
}

function updateNodesInLayout (
  layout: DockLayout,
  updates: ReadonlyMap<LayoutNodeId, LayoutNode>,
  options?: {
    normalize?: boolean
  }
): DockLayout {
  const applied = new Set<LayoutNodeId>()

  const updateNode = (node: LayoutNode): LayoutNode => {
    const updatedNode = applied.has(node.id)
      ? node
      : updates.get(node.id) ?? node
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

    for (let i = 0; i < node.children.length; ++i) {
      const child = normalizeNode(node.children[i])
      if (child != null) {
        children.push(child)
        sizes.push(node.sizes[i] ?? 1)
      }
    }

    // If no children remain, remove this node
    if (children.length === 0) {
      return undefined
    }

    // Merge child splits with the same direction
    const mergedChildren: LayoutNode[] = []
    const mergedSizes: number[] = []

    for (let i = 0; i < children.length; ++i) {
      const child = children[i]
      const size = sizes[i] ?? 1

      if (child.type === 'split' && child.direction === node.direction) {
        for (let j = 0; j < child.children.length; ++j) {
          mergedChildren.push(child.children[j])
          mergedSizes.push(size * (child.sizes[j] ?? 1))
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

const randomLayoutNodeId = (): LayoutNodeId => randomId() as LayoutNodeId

function randomId (): string {
  // TODO better random ID generation
  return Math.random().toString(36).slice(2, 10)
}
