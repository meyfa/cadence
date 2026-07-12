import type { Asset, AssetId, NoteEvent } from '@core'
import type { Brand, Numeric } from '@utility'
import type { EntityKey } from './entities.js'

export interface AudioGraph<TNode = AnyNode> {
  readonly nodes: ReadonlyMap<NodeId, TNode>
  readonly edges: readonly Edge[]
  readonly outputIds: readonly NodeId[]

  readonly tempo: Numeric<'bpm'>
  readonly length: Numeric<'beats'>

  readonly assets: ReadonlyMap<AssetId, Asset>

  readonly noteEvents: ReadonlyMap<NodeId, readonly NoteEvent[]>

  readonly meters: ReadonlyMap<EntityKey, Meters>
}

export type NodeId = Brand<number, 'audiograph.NodeId'>

export interface AnyNode {
  readonly type: string
}

export interface Edge {
  readonly from: NodeId
  readonly to: NodeId
}

export interface Meters {
  readonly gainMeterId: NodeId
}
