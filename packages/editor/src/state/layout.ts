import { brandedString, readonly, type StructValidation } from '@editor/utilities/validation.js'
import { array, enums, lazy, literal, number, optional, record, string, type, union, unknown, type Struct } from 'superstruct'

// Types

export type SplitDirection = 'horizontal' | 'vertical'

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
  readonly direction: SplitDirection
  readonly children: readonly LayoutNode[]
  readonly sizes: readonly number[]
}

export interface DockLayout {
  readonly main: LayoutNode
}

// Schema

const splitDirection: Struct<SplitDirection> = enums(['horizontal', 'vertical'])

const serializedComponent: Struct<SerializedComponent> = type({
  type: string(),
  props: optional(record(string(), unknown()))
})

const tab: Struct<Tab> = type({
  id: brandedString<TabId>(),
  component: serializedComponent
})

const paneNode: Struct<PaneNode> = type({
  type: literal('pane'),
  id: brandedString<LayoutNodeId>(),
  tabs: readonly(array(tab)),
  activeTabId: brandedString<TabId>()
})

const splitNode: Struct<SplitNode> = type({
  type: literal('split'),
  id: brandedString<LayoutNodeId>(),
  direction: splitDirection,
  children: readonly(array(lazy(() => layoutNode))),
  sizes: readonly(array(number()))
})

const layoutNode: Struct<LayoutNode> = union([paneNode, splitNode])

export const dockLayoutSchema: Struct<DockLayout> = type({
  main: layoutNode
})

// Validation

export function validateDockLayout (data: unknown): StructValidation<DockLayout> {
  return dockLayoutSchema.validate(data, { coerce: true })
}
