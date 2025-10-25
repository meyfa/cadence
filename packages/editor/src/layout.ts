export type Render<E> = () => E

export type SplitDirection = 'horizontal' | 'vertical'

export interface Tab<E = unknown> {
  readonly id: string
  readonly title: string
  readonly render: Render<E>
}

export type LayoutNode<E = unknown> = PaneNode<E> | SplitNode<E>
export type NodeType = LayoutNode['type']

export interface BaseLayoutNode {
  readonly type: string
  readonly id: string
}

export interface PaneNode<E = unknown> extends BaseLayoutNode {
  readonly type: 'pane'
  readonly tabs: ReadonlyArray<Tab<E>>
  readonly activeTabId: string
}

export interface SplitNode<E = unknown> extends BaseLayoutNode {
  readonly type: 'split'
  readonly direction: SplitDirection
  readonly children: ReadonlyArray<LayoutNode<E>>
  readonly sizes: readonly number[]
}

export interface DockLayout<E = unknown> {
  readonly main: LayoutNode<E>
}
