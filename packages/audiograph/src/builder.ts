import type { Asset, AssetId, NoteEvent } from '@core'
import { isPitch } from '@core'
import type { Numeric } from '@utility'
import type { EntityKey } from './entities.js'
import type { AnyNode, AudioGraph, Edge, Meters, NodeId } from './graph.js'

export interface AudioGraphBuilder<TNode extends AnyNode = AnyNode> {
  readonly addNode: <T extends TNode> (type: T['type'], node: Omit<T, 'id' | 'type'>) => NodeId
  readonly addEdge: (from: NodeId, to: NodeId) => void
  readonly addEdges: (from: readonly NodeId[], to: readonly NodeId[]) => void
  readonly setOutput: (nodeId: NodeId) => void

  readonly addAsset: (asset: Asset) => void

  readonly addNoteEvents: (nodeId: NodeId, events: readonly NoteEvent[]) => void

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
  const noteEvents = new Map<NodeId, readonly NoteEvent[]>()
  const meters = new Map<EntityKey, Meters>()

  let nextId = 1 as NodeId

  const addNode: AudioGraphBuilder<TNode>['addNode'] = <T extends TNode>(type: T['type'], node: Omit<T, 'id' | 'type'>): NodeId => {
    const id = nextId++ as NodeId
    const newNode = { ...node, type } as T
    nodes.set(id, newNode)
    return id
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

function validateNoteEvent (event: NoteEvent): void {
  if (!Number.isFinite(event.time.value) || event.time.value < 0) {
    throw invalidNoteEvent(event)
  }

  if (event.pitch != null && !isPitch(event.pitch)) {
    throw invalidNoteEvent(event)
  }

  if (!Number.isFinite(event.velocity.value) || event.velocity.value < 0 || event.velocity.value > 1) {
    throw invalidNoteEvent(event)
  }

  if (event.gate?.value != null && (!Number.isFinite(event.gate.value) || event.gate.value < 0)) {
    throw invalidNoteEvent(event)
  }
}

function invalidNoteEvent (event: NoteEvent): Error {
  return new Error(`Invalid note event: ${JSON.stringify(event)}`)
}
