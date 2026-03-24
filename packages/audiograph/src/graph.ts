import type { MidiNote } from '@core'
import type { Brand, Numeric } from '@utility'

export type NodeId = Brand<number, 'audiograph.NodeId'>

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
  readonly pitch?: MidiNote
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
