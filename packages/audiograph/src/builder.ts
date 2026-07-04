import type { Asset, AssetId } from '@core'
import type { Numeric } from '@utility'
import type { EntityKey } from './entities.js'
import type { AnyNode, AudioGraph, Edge, Meters, NodeId, NoteOptions } from './graph.js'

export interface AudioGraphBuilder<TNode extends AnyNode = AnyNode> {
  readonly addNode: <T extends TNode> (type: T['type'], node: Omit<T, 'id' | 'type'>) => T
  readonly addEdge: (from: NodeId, to: NodeId) => void
  readonly addEdges: (from: readonly NodeId[], to: readonly NodeId[]) => void
  readonly setOutput: (nodeId: NodeId) => void

  readonly addAsset: (asset: Asset) => void

  readonly addNoteEvents: (nodeId: NodeId, events: readonly NoteOptions[]) => void

  readonly addMeters: (key: EntityKey, meters: Meters) => void

  readonly graph: () => AudioGraph<TNode>
}

export function createAudioGraphBuilder<TNode extends AnyNode = AnyNode> (meta: {
  readonly tempo: Numeric<'bpm'>
  readonly length: Numeric<'beats'>
}): AudioGraphBuilder<TNode> {
  if (!Number.isFinite(meta.tempo.value) || meta.tempo.value <= 0) {
    throw new Error(`Invalid tempo: ${meta.tempo.value}`)
  }

  if (!Number.isFinite(meta.length.value) || meta.length.value < 0) {
    throw new Error(`Invalid length: ${meta.length.value}`)
  }

  const nodes = new Map<NodeId, TNode>()
  const edges: Edge[] = []
  const outputIds: NodeId[] = []
  const assets = new Map<AssetId, Asset>()
  const noteEvents = new Map<NodeId, readonly NoteOptions[]>()
  const meters = new Map<EntityKey, Meters>()

  let nextId = 1 as NodeId

  const addNode: AudioGraphBuilder<TNode>['addNode'] = <T extends TNode>(type: T['type'], node: Omit<T, 'id' | 'type'>): T => {
    const id = nextId++ as NodeId
    const newNode = { ...node, id, type } as T
    nodes.set(id, newNode)
    return newNode
  }

  const addEdge: AudioGraphBuilder<TNode>['addEdge'] = (from, to) => {
    edges.push({ from, to })
  }

  const addEdges: AudioGraphBuilder<TNode>['addEdges'] = (from, to) => {
    for (const fromId of from) {
      for (const toId of to) {
        edges.push({ from: fromId, to: toId })
      }
    }
  }

  const setOutput: AudioGraphBuilder<TNode>['setOutput'] = (nodeId) => {
    outputIds.push(nodeId)
  }

  const addAsset: AudioGraphBuilder<TNode>['addAsset'] = (asset) => {
    assets.set(asset.id, asset)
  }

  const addNoteEvents: AudioGraphBuilder<TNode>['addNoteEvents'] = (nodeId, events) => {
    for (const event of events) {
      validateNoteEvent(event)
    }

    const existing = noteEvents.get(nodeId)
    if (existing == null) {
      noteEvents.set(nodeId, events)
      return
    }

    noteEvents.set(nodeId, [...existing, ...events])
  }

  const addMeters: AudioGraphBuilder<TNode>['addMeters'] = (key, value) => {
    meters.set(key, value)
  }

  const graph: AudioGraphBuilder<TNode>['graph'] = () => ({
    nodes,
    edges,
    outputIds,
    tempo: meta.tempo,
    length: meta.length,
    assets,
    noteEvents,
    meters
  })

  return {
    addNode,
    addEdge,
    addEdges,
    setOutput,
    addNoteEvents,
    addAsset,
    addMeters,
    graph
  }
}

function validateNoteEvent (event: NoteOptions): void {
  if (!Number.isFinite(event.time) || event.time < 0) {
    throw invalidNoteEvent(event)
  }

  if (event.pitch != null && (!Number.isFinite(event.pitch) || event.pitch < 0 || event.pitch > 127)) {
    throw invalidNoteEvent(event)
  }

  if (!Number.isFinite(event.velocity) || event.velocity < 0 || event.velocity > 1) {
    throw invalidNoteEvent(event)
  }

  if (event.duration != null && (!Number.isFinite(event.duration) || event.duration < 0)) {
    throw invalidNoteEvent(event)
  }
}

function invalidNoteEvent (event: NoteOptions): Error {
  return new Error(`Invalid note event: ${JSON.stringify(event)}`)
}
