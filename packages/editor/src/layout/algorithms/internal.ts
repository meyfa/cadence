import type { DockLayout, LayoutNode, LayoutNodeId, PaneNode, SplitNode, TabId } from '../types.js'

export type NodeUpdates = ReadonlyMap<LayoutNodeId, LayoutNode>

export interface NodeUpdateOptions {
  readonly normalize?: boolean
  readonly focusTabId?: TabId
}

export function updateNodesInLayout (layout: DockLayout, updates: NodeUpdates, options?: NodeUpdateOptions): DockLayout {
  const applied = new Set<LayoutNodeId>()
  const tabIds = new Set<TabId>()

  const updateNode = (node: LayoutNode): LayoutNode => {
    const updatedNode = applied.has(node.id) ? node : (updates.get(node.id) ?? node)
    applied.add(node.id)

    switch (updatedNode.type) {
      case 'pane': {
        for (const tab of updatedNode.tabs) {
          tabIds.add(tab.id)
        }
        return updatedNode
      }

      case 'split': {
        return { ...updatedNode, children: updatedNode.children.map(updateNode) }
      }
    }
  }

  const main = layout.main != null ? updateNode(layout.main) : undefined

  const hasPreviouslyFocusedTab = layout.focusedTabId != null && tabIds.has(layout.focusedTabId)
  const hasNewFocusedTab = options?.focusTabId != null && tabIds.has(options.focusTabId)

  const focusedTabId = (hasNewFocusedTab ? options.focusTabId : undefined) ??
    (hasPreviouslyFocusedTab ? layout.focusedTabId : undefined)

  const updatedLayout = { ...layout, main, focusedTabId }

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
