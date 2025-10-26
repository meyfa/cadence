import { readonly, type StructValidation } from '@editor/utilities/validation.js'
import { array, enums, lazy, literal, number, optional, record, string, type, union, unknown, type Struct } from 'superstruct'

// Types

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

// Schema

const splitDirection: Struct<SplitDirection> = enums(['horizontal', 'vertical'])

const serializedComponent: Struct<SerializedComponent> = type({
  type: string(),
  props: optional(record(string(), unknown()))
})

const tab: Struct<Tab> = type({
  id: string(),
  component: serializedComponent
})

const paneNode: Struct<PaneNode> = type({
  type: literal('pane'),
  id: string(),
  tabs: readonly(array(tab)),
  activeTabId: string()
})

const splitNode: Struct<SplitNode> = type({
  type: literal('split'),
  id: string(),
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
