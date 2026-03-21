import type { InstrumentId } from '@core/program.js'

type Id<Tag extends string> = number & { __tag: Tag }

export type NodeId = Id<'audiograph.Node'>

export interface Node {
  readonly id: NodeId
  readonly type: string
}

export interface Edge {
  readonly from: NodeId
  readonly to: NodeId
}

export interface AudioGraph {
  readonly nodes: ReadonlyMap<NodeId, Node>
  readonly edges: readonly Edge[]
  readonly outputIds: readonly NodeId[]
  readonly instruments: ReadonlyMap<InstrumentId, NodeId>
}
