export type SplitDirection = 'horizontal' | 'vertical'

export interface SerializedComponent {
  readonly type: string
  readonly props?: Record<string, unknown>
}

export interface Tab {
  readonly id: string
  readonly component: SerializedComponent
}

export type LayoutNode = PaneNode | SplitNode
export type NodeType = LayoutNode['type']

export interface BaseLayoutNode {
  readonly type: string
  readonly id: string
}

export interface PaneNode extends BaseLayoutNode {
  readonly type: 'pane'
  readonly tabs: readonly Tab[]
  readonly activeTabId: string
}

export interface SplitNode extends BaseLayoutNode {
  readonly type: 'split'
  readonly direction: SplitDirection
  readonly children: readonly LayoutNode[]
  readonly sizes: readonly number[]
}

export interface DockLayout {
  readonly main: LayoutNode
}
