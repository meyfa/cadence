import type { Numeric } from '@core/numeric.js'
import type { Pitch } from '@core/program.js'

type Id<Tag extends string> = number & { __tag: Tag }

export type NodeId = Id<'audiograph.Node'>

export interface AnyNode {
  readonly id: NodeId
  readonly type: string
}

export interface Edge {
  readonly from: NodeId
  readonly to: NodeId
}

export interface NoteOptions {
  readonly time: number
  readonly pitch?: Pitch | number
  readonly velocity: number
  readonly duration?: number
}

export interface AudioGraph<TNode = AnyNode> {
  readonly nodes: ReadonlyMap<NodeId, TNode>
  readonly edges: readonly Edge[]
  readonly outputIds: readonly NodeId[]

  readonly tempo: Numeric<'bpm'>
  readonly length: Numeric<'beats'>

  readonly noteEvents: ReadonlyMap<NodeId, readonly NoteOptions[]>
}
