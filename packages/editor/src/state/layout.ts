import { array, enums, lazy, literal, number, optional, record, string, type, union, unknown, type Struct } from 'superstruct'
import type { DockLayout, LayoutNode, LayoutNodeId, PaneNode, SerializedComponent, SplitNode, SplitOrientation, Tab, TabId } from '../layout/types.js'
import { brandedString, readonly, type StructValidation } from '../utilities/validation.js'

const splitOrientation: Struct<SplitOrientation> = enums(['horizontal', 'vertical'])

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
  orientation: splitOrientation,
  children: readonly(array(lazy(() => layoutNode))),
  sizes: readonly(array(number()))
})

const layoutNode: Struct<LayoutNode> = union([paneNode, splitNode])

export const dockLayoutSchema: Struct<DockLayout> = type({
  main: optional(layoutNode)
})

export function validateDockLayout (data: unknown): StructValidation<DockLayout> {
  return dockLayoutSchema.validate(data, { coerce: true })
}
