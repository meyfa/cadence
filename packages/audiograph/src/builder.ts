import type { Numeric } from '@core/numeric.js'
import type { AnyNode, AudioGraph, Edge, NodeId, NoteOptions } from './graph.js'

export interface AudioGraphBuilder<TNode extends AnyNode = AnyNode> {
  readonly addNode: <T extends TNode> (type: T['type'], node: Omit<T, 'id' | 'type'>) => T

  readonly addEdge: (from: NodeId, to: NodeId) => void
  readonly addEdges: (from: readonly NodeId[], to: readonly NodeId[]) => void

  readonly setOutput: (nodeId: NodeId) => void

  readonly addNoteEvents: (nodeId: NodeId, events: readonly NoteOptions[]) => void

  readonly graph: () => AudioGraph<TNode>
}

export function createAudioGraphBuilder<TNode extends AnyNode = AnyNode> (meta: {
  readonly tempo: Numeric<'bpm'>
  readonly length: Numeric<'beats'>
}): AudioGraphBuilder<TNode> {
  const nodes = new Map<NodeId, TNode>()
  const edges: Edge[] = []
  const outputIds: NodeId[] = []
  const noteEvents = new Map<NodeId, readonly NoteOptions[]>()

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

  const addNoteEvents: AudioGraphBuilder<TNode>['addNoteEvents'] = (nodeId, events) => {
    const existing = noteEvents.get(nodeId)
    if (existing == null) {
      noteEvents.set(nodeId, events)
      return
    }

    noteEvents.set(nodeId, [...existing, ...events])
  }

  const graph: AudioGraphBuilder<TNode>['graph'] = () => ({
    nodes,
    edges,
    outputIds,
    tempo: meta.tempo,
    length: meta.length,
    noteEvents
  })

  return {
    addNode,
    addEdge,
    addEdges,
    setOutput,
    addNoteEvents,
    graph
  }
}
