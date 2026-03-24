export type SplitOrientation = 'horizontal' | 'vertical'

export interface SerializedComponent {
  readonly type: string
  readonly props?: Record<string, unknown>
}

export type TabId = string & { __brand: 'TabId' }
export type LayoutNodeId = string & { __brand: 'LayoutNodeId' }

export interface Tab {
  readonly id: TabId
  readonly component: SerializedComponent
}

export type LayoutNode = PaneNode | SplitNode
export type NodeType = LayoutNode['type']

export interface BaseLayoutNode {
  readonly type: string
  readonly id: LayoutNodeId
}

export interface PaneNode extends BaseLayoutNode {
  readonly type: 'pane'
  readonly tabs: readonly Tab[]
  readonly activeTabId: TabId
}

export interface SplitNode extends BaseLayoutNode {
  readonly type: 'split'
  readonly orientation: SplitOrientation
  readonly children: readonly LayoutNode[]
  readonly sizes: readonly number[]
}

export interface DockLayout {
  readonly main?: LayoutNode
}
