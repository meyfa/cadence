import type { DockLayout, LayoutNode, LayoutNodeId, PaneNode, SplitNode, SplitOrientation, TabId } from '../types.ts'

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
  return {
    ...layout,
    main: layout.main != null ? normalizeNode(layout.main) : layout.main
  }
}

function normalizeNode (node: LayoutNode): LayoutNode | undefined {
  switch (node.type) {
    case 'pane':
      return normalizePaneNode(node)
    case 'split':
      return normalizeSplitNode(node)
  }
}

function normalizePaneNode (node: PaneNode): LayoutNode | undefined {
  if (node.tabs.length === 0) {
    return undefined
  }

  if (!node.tabs.some((tab) => tab.id === node.activeTabId)) {
    return { ...node, activeTabId: node.tabs[0].id }
  }

  return node
}

function normalizeSplitNode (node: SplitNode): LayoutNode | undefined {
  const normalized = normalizeChildren(node)
  if (normalized.children.length === 0) {
    // the split node can be removed
    return undefined
  }

  const merged = mergeSplitsWithOrientation(normalized, node.orientation)
  if (merged.children.length === 1) {
    // lift the single child up
    return merged.children[0]
  }

  const totalSize = merged.sizes.reduce((sum, size) => sum + size, 0)
  const normalizedSizes = merged.sizes.map((size) => size / totalSize)

  return { ...node, children: merged.children, sizes: normalizedSizes }
}

type ChildrenWithSize = Pick<SplitNode, 'children' | 'sizes'>

function normalizeChildren (input: ChildrenWithSize): ChildrenWithSize {
  const children: LayoutNode[] = []
  const sizes: number[] = []

  for (const [index, child] of input.children.entries()) {
    const normalized = normalizeNode(child)
    if (normalized != null) {
      children.push(normalized)
      sizes.push(input.sizes[index] ?? 1)
    }
  }

  return { children, sizes }
}

function mergeSplitsWithOrientation (input: ChildrenWithSize, orientation: SplitOrientation): ChildrenWithSize {
  const children: LayoutNode[] = []
  const sizes: number[] = []

  for (const [index, child] of input.children.entries()) {
    const size = input.sizes.at(index) ?? 1

    if (child.type !== 'split' || child.orientation !== orientation) {
      children.push(child)
      sizes.push(size)
      continue
    }

    for (const [otherIndex, otherChild] of child.children.entries()) {
      children.push(otherChild)
      sizes.push(size * (child.sizes.at(otherIndex) ?? 1))
    }
  }

  return { children, sizes }
}
